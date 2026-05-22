"""모델 개선 어드바이저 — 사각지대 진단을 Claude가 평가해 개선안 + 시작 코드(스캐폴드) 생성.

흐름: 사각지대 진단(온도 0% 탐지) + 모델/데이터 요약 → Claude(JSON 응답)
      → recommendation/approach/rationale + notebook_cells + plan_md
      → 백엔드가 .ipynb / .md 로 조립해 반환 (브라우저 다운로드).
키 없거나 실패 시 템플릿 폴백 → 항상 동작.
"""
import os
import json
import datetime

MODEL = "claude-haiku-4-5"

# 현재 사각지대 진단(사용자 제공 문구) + 시스템 컨텍스트
BLIND_SPOT = (
    "⚠ 온도 계통 · 탐지율 0%\n"
    "불량 11건 중 11건 미탐. 4개 모델(AE·IF·OCSVM·LOF) 모두 이 계통 이상에 둔감 — "
    "합의 임계를 풀어도 못 잡음 → 전용 룰/SPC 관리도 보강 권장."
)
CONTEXT = """[시스템 개요]
- 사출성형 준지도 이상탐지. 24개 z-score 센서. 정상 5,357샷으로 학습, 검증 1,379샷(정상1,340+불량39).
- 판정: 4-AI(Autoencoder·IsolationForest·OneClassSVM·LOF) ≥3/4 합의. 강도등급은 AE 복원오차/τ(0.32).
- 성능: ROC-AUC 0.9254, F1 0.7324, Recall 0.667(26/39), Precision 0.8125.
[온도 계열 센서 9개 — z-벡터 인덱스]
- 15~20: Barrel_Temperature_1~6, 21: Hopper_Temperature, 22: Mold_Temperature_3, 23: Mold_Temperature_4
[사각지대 실측]
- 온도 주원인 불량 11건을 AE 0 / IF 4 / OCSVM 2 / LOF 1 탐지, 4-AI 합의로 1건. 4모델 전부 둔감.
- 원인: 온도는 정상 시에도 변동 폭이 커서(std≈1.0), 불량 시 편차(최대 ~2σ)가 정상 변동에 묻힘.
[데이터 파일]
- results/val_shots.json: {"shots": [[24개 z값]...], "labels": [0/1...]}  (1,379행)
- results/val_scores.json: {"errors": [AE 복원오차...], "labels": [...]}
"""

_client = None
_failed = False


def _get_client():
    global _client, _failed
    if _client is None and not _failed:
        try:
            import anthropic
            key = os.environ.get("ANTHROPIC_API_KEY")
            if not key:
                _failed = True; return None
            _client = anthropic.Anthropic(api_key=key)
        except Exception:
            _failed = True; return None
    return _client


SYSTEM = """당신은 사출성형 이상탐지 시스템의 ML 엔지니어입니다. '모델 사각지대 진단'을 받아,
온도 계통 미탐을 보강할 최선의 개선안을 평가하고 '실행 가능한 시작 코드(스캐폴드)'를 만듭니다.

[아래 형식 그대로만 출력. 구분자(===...===)는 정확히 그대로 쓰고, JSON·코드펜스 금지]
RECOMMENDATION: (한 줄 핵심 개선안)
APPROACH: (new_model / improve_existing / rule_based / hybrid 중 하나)
RATIONALE: (왜 이 방식인지 2~4문장. 4-AI 안 건드리는 이유 + 온도 둔감 원인 반영)
===PLAN===
(개선 계획 마크다운: 배경/방법/검증지표/통합방안/주의. 'AI 제안·스타터 코드'임과 SPC 대안 명시)
===CELL-MD===
(노트북 첫 마크다운 셀: 제목/배경)
===CELL-CODE===
(파이썬 코드: json으로 results/val_shots.json 로드 → 온도 9개 피처(인덱스 15~23) 추출 → 라벨)
===CELL-CODE===
(파이썬 코드: class_weight='balanced' 지도학습 + 5-fold OOF로 온도 불량 재현율/정밀도 평가, 4-AI와 OR 결합 설명 print)
===CELL-MD===
(마무리 마크다운: 통합 방안 + SPC 대안)
===END===

[규칙] 코드는 실제로 돌아가게(numpy·sklearn). 4-AI 합의는 유지하고 온도 보조판정기를 OR 결합 권장. 한국어. 코드 주석 간단히."""


def _parse_delim(txt: str):
    """구분자(===...===) 응답 → dict. 코드 이스케이프 없이 안전. 실패 시 None."""
    import re

    def field(name):
        m = re.search(rf"^{name}:\s*(.+)$", txt, re.MULTILINE)
        return m.group(1).strip() if m else ""

    rec, app, rat = field("RECOMMENDATION"), field("APPROACH"), field("RATIONALE")
    plan = ""
    if "===PLAN===" in txt:
        plan = txt.split("===PLAN===", 1)[1].split("===CELL")[0].split("===END===")[0].strip()
    cells = []
    parts = re.split(r"===CELL-(MD|CODE)===", txt)  # [before,'MD',body,'CODE',body,...]
    for i in range(1, len(parts) - 1, 2):
        body = parts[i + 1].split("===CELL")[0].split("===END===")[0].strip()
        if body:
            cells.append({"type": "markdown" if parts[i] == "MD" else "code", "source": body})
    if not rec or not cells:
        return None
    return {"recommendation": rec, "approach": app, "rationale": rat, "plan_md": plan, "notebook_cells": cells}


def _fallback():
    """Claude 미연결 시 — 온도 전용 분류기 스캐폴드 템플릿."""
    code1 = (
        "# 온도 전용 보조 분류기 — 4-AI가 못 잡는 온도 불량 보강\n"
        "import json, numpy as np\n"
        "from sklearn.linear_model import LogisticRegression\n"
        "from sklearn.metrics import recall_score, precision_score, confusion_matrix\n"
        "from sklearn.model_selection import StratifiedKFold, cross_val_predict\n\n"
        "d = json.load(open('results/val_shots.json', encoding='utf-8'))\n"
        "X = np.array(d['shots']); y = np.array(d['labels'])\n"
        "TEMP_IDX = list(range(15, 24))  # 온도 9개 (배럴1~6·호퍼·금형3·4)\n"
        "Xt = X[:, TEMP_IDX]\n"
        "print('온도 피처:', Xt.shape, '불량', int(y.sum()))"
    )
    code2 = (
        "# 불균형 가중 로지스틱 회귀 + 5-fold OOF 평가\n"
        "clf = LogisticRegression(class_weight='balanced', max_iter=1000)\n"
        "cv = StratifiedKFold(5, shuffle=True, random_state=42)\n"
        "pred = cross_val_predict(clf, Xt, y, cv=cv)\n"
        "tn, fp, fn, tp = confusion_matrix(y, pred).ravel()\n"
        "print(f'온도 보조기  TP{tp} FP{fp} FN{fn} TN{tn}')\n"
        "print(f'  Recall {recall_score(y,pred):.3f}  Precision {precision_score(y,pred):.3f}')\n"
        "print('→ 기존 4-AI(온도 0건 탐지)와 OR 결합 시 온도 불량 추가 탐지 기대')"
    )
    cells = [
        {"type": "markdown", "source": "# 온도 사각지대 보강 — 보조 분류기 스캐폴드\n4-AI가 온도 불량 11건을 0건 탐지하는 문제를, 온도 9개 피처 전용 지도 분류기로 보강합니다.\n\n> ⚠️ AI 제안 기반 시작 코드입니다. 실행·검증 후 채택하세요."},
        {"type": "code", "source": code1},
        {"type": "code", "source": code2},
        {"type": "markdown", "source": "## 통합 방안\n- 최종 판정 = **4-AI 합의 OR 온도 보조기** (미탐↓).\n- 비-AI 대안: 온도 **SPC 관리도(3σ 룰)** — 단순·설명 쉬움. 둘을 비교해 채택.\n- 검증 지표: 온도 불량 재현율, 전체 정밀도 하락 폭."},
    ]
    plan = (
        "# 온도 사각지대 보강 계획 (AI 제안)\n\n"
        "## 배경\n4-AI(AE·IF·OCSVM·LOF) 모두 온도 계통 이상에 둔감 → 온도 불량 11건 탐지율 0%. "
        "온도는 정상 변동 폭이 커서 복원오차·고립·밀도 신호가 약함.\n\n"
        "## 방법\n온도 9개 피처(인덱스 15~23) 전용 **불균형 가중 지도 분류기**(LogReg)를 추가, "
        "기존 4-AI 합의와 **OR 결합**해 온도 불량을 보조 탐지.\n\n"
        "## 검증\n온도 불량 재현율, 전체 정밀도 하락 폭(거짓경보 증가) 동시 추적. 5-fold OOF로 과적합 방지.\n\n"
        "## 대안\n비-AI **SPC 관리도(3σ)** — 온도처럼 단순 변동은 통계 룰이 더 적합할 수 있음. 둘 비교 권장.\n\n"
        "> ⚠️ AI가 제안한 시작 코드입니다. 실행·검증 후 채택 여부를 결정하세요."
    )
    return {"recommendation": "온도 전용 보조 분류기(지도학습) 추가 — 4-AI와 OR 결합",
            "approach": "hybrid", "rationale": "4-AI는 온도에 구조적으로 둔감하므로(복원·고립·밀도 모두 약함) 합의를 건드리기보다, 온도 9개 피처만 보는 가벼운 지도 분류기를 보조로 OR 결합하는 것이 미탐을 줄이는 가장 직접적 방법입니다. 온도는 SPC 관리도 같은 통계 룰도 효과적이라 함께 비교합니다.",
            "notebook_cells": cells, "plan_md": plan, "model": "template"}


def _build_ipynb(cells):
    nb = {"cells": [], "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
          "nbformat": 4, "nbformat_minor": 5}
    for c in cells:
        src = c.get("source", "")
        lines = [l + "\n" for l in src.split("\n")]
        if lines: lines[-1] = lines[-1].rstrip("\n")
        if c.get("type") == "code":
            nb["cells"].append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": lines})
        else:
            nb["cells"].append({"cell_type": "markdown", "metadata": {}, "source": lines})
    return nb


def generate() -> dict:
    client = _get_client()
    data = None
    if client is not None:
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=6000, temperature=0,   # 일관성 — 같은 진단엔 같은 개선안
                system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": f"[모델 사각지대 진단]\n{BLIND_SPOT}\n\n{CONTEXT}\n\n위 진단을 평가해 지정된 구분자 형식으로 개선안과 스캐폴드를 생성하라."}],
            )
            txt = next((b.text for b in resp.content if b.type == "text"), "")
            data = _parse_delim(txt)   # 구분자 파싱(코드 이스케이프 회피)
            if data:
                data["model"] = MODEL
        except Exception:
            data = None
    if not data or "notebook_cells" not in data:
        data = _fallback()

    ts = datetime.datetime.now().strftime("%Y%m%d")
    files = [
        {"name": f"improve_temperature_{ts}.ipynb", "kind": "ipynb",
         "content": json.dumps(_build_ipynb(data.get("notebook_cells", [])), ensure_ascii=False, indent=1)},
        {"name": f"IMPROVE_PLAN_{ts}.md", "kind": "md", "content": data.get("plan_md", "")},
    ]
    return {"recommendation": data.get("recommendation", ""), "approach": data.get("approach", ""),
            "rationale": data.get("rationale", ""), "model": data.get("model", "template"), "files": files}
