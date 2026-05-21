"""자연어 진단 보고서 생성 — Claude Haiku 4.5 (저지연).

구조: 원인 분석 / 대처방안 / 사용 가능한 리소스 (군더더기 없이).
근거 정확성: σ는 표준편차 단위로만(배 금지), 주어진 센서·조치만 사용(환각 방지).
키(ANTHROPIC_API_KEY) 없거나 호출 실패 시 템플릿 폴백 → 대시보드 항상 동작.
"""
import os
import re

MODEL = "claude-haiku-4-5"  # 사용자 지정 — 저지연


def _format(text: str) -> str:
    """출력 정규화 — '시그마' 단어 → σ 기호, 원인/대처/리소스 빈 줄 분리."""
    text = text.strip()
    text = text.replace("시그마", "σ").replace("표준편차σ", "표준편차")
    # 라벨이 문장 중간에 붙어 있으면 앞에 빈 줄 삽입
    for lab in ("대처:", "리소스:"):
        text = re.sub(r"\s*" + lab, "\n\n" + lab, text)
    text = re.sub(r"^\s*원인\s*:", "원인:", text)
    # 3개 초과 빈 줄 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# 센서 영문 → 한글 (작업자 직접 도움)
SENSOR_KO = {
    "Injection_Time": "사출 시간", "Filling_Time": "충전 시간", "Plasticizing_Time": "가소화 시간",
    "Cycle_Time": "사이클 시간", "Clamp_Close_Time": "형체결 시간", "Cushion_Position": "쿠션 위치",
    "Plasticizing_Position": "가소화 위치", "Clamp_Open_Position": "형개방 위치",
    "Max_Injection_Speed": "최대 사출 속도", "Max_Screw_RPM": "최대 스크류 회전수",
    "Average_Screw_RPM": "평균 스크류 회전수", "Max_Injection_Pressure": "최대 사출 압력",
    "Max_Switch_Over_Pressure": "최대 전환 압력", "Max_Back_Pressure": "최대 배압",
    "Average_Back_Pressure": "평균 배압", "Barrel_Temperature_1": "배럴 온도1",
    "Barrel_Temperature_2": "배럴 온도2", "Barrel_Temperature_3": "배럴 온도3",
    "Barrel_Temperature_4": "배럴 온도4", "Barrel_Temperature_5": "배럴 온도5",
    "Barrel_Temperature_6": "배럴 온도6", "Hopper_Temperature": "호퍼 온도",
    "Mold_Temperature_3": "금형 온도3", "Mold_Temperature_4": "금형 온도4",
}

# ── 안정적 system 프롬프트 (prompt caching 대상) ──
SYSTEM_PROMPT = """당신은 사출성형 라인 AI 진단 어시스턴트입니다.

[배경] IM-7 사출성형기를 4개 AI(Autoencoder·Isolation Forest·One-Class SVM·LOF)가 합의 투표로 이상탐지합니다. 정상 데이터만 학습한 준지도 방식이며, 센서 이상도는 σ(시그마, 정상 평균 대비 표준편차)로 표현됩니다.

[출력 형식 — 반드시 아래 3개 항목만. 각 항목 1~2문장. 라벨 그대로 사용]
각 항목은 반드시 줄바꿈으로 분리하고, 항목과 항목 사이에는 빈 줄을 하나 넣어라. 아래 형식 그대로:
원인: (어느 센서가 얼마나 비정상인지 σ 기준으로. 정상이면 "이상 없음".)

대처: (작업자가 지금 할 구체적 행동. 정상이면 "현재 설정 유지".)

리소스: (활용 가능한 자원 — 반장·설비보전팀 호출, HMI 제어판 설정 조정, 비상정지, 해당 센서 점검 절차 중 관련된 것만. 정상이면 이 항목 생략.)

[엄격 규칙 — 위반 금지]
1. σ는 표준편차 단위다. 절대 "배"로 환산하지 마라. 반드시 σ 기호로만 표기하고("+8.4σ", "-7.5σ" 형태), "시그마"라는 한글 단어는 절대 쓰지 마라. (복원오차 비율 '배'는 전체 이상강도이지 센서값이 아니다 — 센서는 무조건 σ.)
2. 주어진 상위 센서와 제공된 권장 조치 안에서만 말하라. 주어지지 않은 센서·부품·온도 등을 추론해 덧붙이지 마라.
3. 인사말·감탄사·격려·"평소대로"·과거 사례 등 군더더기 금지. 사실과 행동만.
4. 한국어. 마크다운 헤더·불릿·이모지·정가운데 정렬 금지. "원인:", "대처:", "리소스:" 라벨만 사용하고 각 라벨은 새 줄에서 시작.
5. 톤: worker=쉬운 용어+존댓말, supervisor=공정 관점, director=위험도·영향 중심. 어떤 톤이든 위 3항목 구조와 규칙은 동일."""

_client = None
_load_failed = False


def _get_client():
    global _client, _load_failed
    if _client is None and not _load_failed:
        try:
            import anthropic
            key = os.environ.get("ANTHROPIC_API_KEY")
            if not key:
                _load_failed = True
                return None
            _client = anthropic.Anthropic(api_key=key)
        except Exception:
            _load_failed = True
            return None
    return _client


def _ko(name: str) -> str:
    return SENSOR_KO.get(name, name)


def _fallback(ctx: dict, tone: str) -> str:
    status = ctx.get("status_ko", ctx.get("status", "—"))
    top = ctx.get("top_sensors", [])
    if not top or ctx.get("status") == "NORMAL":
        return "원인: 이상 없음.\n\n대처: 현재 설정 유지. (LLM 미연결 — 템플릿)"
    s0 = top[0]
    return _format(
        f"원인: {_ko(s0['name'])} {s0['sigma']} 비정상.\n\n"
        f"대처: {s0.get('action', '해당 센서 점검')}.\n\n"
        f"리소스: 반장·설비보전팀 호출, HMI 제어판 점검. (LLM 미연결 — 템플릿)")


def generate(ctx: dict, tone: str = "worker") -> dict:
    client = _get_client()
    if client is None:
        return {"text": _fallback(ctx, tone), "model": "template", "cached": False}

    tone_ko = {"worker": "작업자", "supervisor": "반장", "director": "부서장"}.get(tone, "작업자")
    top = ctx.get("top_sensors", [])
    if top:
        lines = "\n".join(
            f"- {_ko(t['name'])}({t['name']}): {t['sigma']} → 권장 조치: {t.get('action', '점검')}"
            for t in top[:5]
        )
    else:
        lines = "- (이상 센서 없음)"

    user_msg = (
        f"[독자] {tone_ko}\n"
        f"[판정] {ctx.get('status_ko', ctx.get('status'))}\n"
        f"[복원오차] {ctx.get('recon_error', 0):.3f} = 임계값 {ctx.get('threshold', 0):.3f}의 "
        f"{ctx.get('ratio', 0):.1f}배 (※ 이건 전체 이상강도 비율이고, 아래 센서값과 다름)\n"
        f"[4-AI 합의] {ctx.get('agree', 0)}/4 동의 (soft {ctx.get('soft', 0):.3f})\n"
        f"[이상 상위 센서 — σ는 표준편차]\n{lines}\n\n"
        f"위 결과로 {tone_ko}용 보고서를 '원인/대처/리소스' 3항목으로 작성하라."
    )

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=500,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_msg}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "")
        cached = bool(getattr(resp.usage, "cache_read_input_tokens", 0))
        return {"text": _format(text), "model": MODEL, "cached": cached}
    except Exception as e:
        return {"text": _fallback(ctx, tone), "model": f"fallback({type(e).__name__})", "cached": False}
