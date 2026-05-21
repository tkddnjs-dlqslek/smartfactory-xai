"""자연어 진단 보고서 생성 — Claude Haiku 4.5 (저지연).

작업자/반장/부서장 3가지 톤으로 사출성형 이상탐지 결과를 설명.
키(ANTHROPIC_API_KEY) 없거나 호출 실패 시 템플릿 폴백 → 대시보드 항상 동작.
prompt caching: 안정적인 system(도메인 컨텍스트+톤 정의)에 cache_control.
"""
import os
from typing import Optional

MODEL = "claude-haiku-4-5"  # 사용자 지정 — 저지연

# ── 안정적 system 프롬프트 (prompt caching 대상) ──
# 주의: Haiku 4.5 최소 캐시 prefix는 4096토큰. 이 프롬프트가 그보다 짧으면
# 캐시는 silent로 미적용(에러 없음). 구조는 올바르게 두어 추후 확장 시 자동 캐시.
SYSTEM_PROMPT = """당신은 사출성형 라인의 AI 진단 어시스턴트입니다.

[배경] IM-7 사출성형기를 4개 AI(Autoencoder·Isolation Forest·One-Class SVM·LOF)가 합의 투표로 이상탐지합니다.
정상 데이터만 학습한 준지도 방식이며, 복원 오차(recon error)가 임계값(τ)을 넘고 다수 모델이 동의하면 불량으로 판정합니다.
SHAP로 어느 센서가 원인인지 설명 가능합니다. 센서 값은 z-score(σ, 정상 대비 표준편차)로 표현됩니다.

[당신의 임무] 주어진 진단 결과를 요청된 독자 톤에 맞춰 한국어로 간결하게 설명합니다.

[톤 정의]
- 작업자(worker): 지금 당장 뭘 해야 하는지. 전문용어 최소화, 1~2문장 + 즉시 조치. 친근한 존댓말.
- 반장(supervisor): 공정 관점. 어느 센서가 왜 문제인지 + 라인 운영상 판단. 2~3문장.
- 부서장(director): 경영 관점. 위험도·예상 영향·권고 결정 중심. 수치 근거 포함, 2~3문장.

[규칙]
- 주어진 수치만 사용. 없는 데이터 지어내지 말 것.
- 과장 금지. 정상이면 정상이라고 명확히.
- 마크다운 헤더·불릿 없이 자연스러운 문단으로. 화면 정가운데 정렬 표현 쓰지 말 것.
- 3~4문장 이내."""

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


def _fallback(ctx: dict, tone: str) -> str:
    """키/호출 실패 시 템플릿."""
    status = ctx.get("status_ko", ctx.get("status", "—"))
    recon = ctx.get("recon_error", 0)
    agree = ctx.get("agree", 0)
    top = ctx.get("top_sensors", [])
    s0 = top[0]["name"] if top else "—"
    return (f"현재 라인은 {status} 상태입니다. 4개 AI 중 {agree}개가 동의했고, "
            f"복원 오차는 {recon:.3f}입니다. 주요 원인 센서는 {s0}입니다. "
            f"(LLM 미연결 — 템플릿 응답)")


def generate(ctx: dict, tone: str = "worker") -> dict:
    """진단 보고서 생성. ctx: status_ko, recon_error, threshold, ratio, agree, soft, top_sensors[]."""
    client = _get_client()
    if client is None:
        return {"text": _fallback(ctx, tone), "model": "template", "cached": False}

    tone_ko = {"worker": "작업자", "supervisor": "반장", "director": "부서장"}.get(tone, "작업자")
    top = ctx.get("top_sensors", [])
    top_str = ", ".join(f"{t['name']} {t['sigma']}" for t in top[:5]) or "없음"
    user_msg = (
        f"[독자] {tone_ko}\n"
        f"[진단 결과]\n"
        f"- 상태: {ctx.get('status_ko', ctx.get('status'))}\n"
        f"- 복원 오차: {ctx.get('recon_error', 0):.3f} (임계값 τ {ctx.get('threshold', 0):.3f}, 비율 {ctx.get('ratio', 0):.1f}배)\n"
        f"- 4-AI 합의: {ctx.get('agree', 0)}/4 동의, soft 점수 {ctx.get('soft', 0):.3f}\n"
        f"- 이상 상위 센서(σ): {top_str}\n"
        f"위 결과를 {tone_ko} 톤으로 설명해줘."
    )

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=600,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": user_msg}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "")
        cached = bool(getattr(resp.usage, "cache_read_input_tokens", 0))
        return {"text": text.strip(), "model": MODEL, "cached": cached}
    except Exception as e:
        return {"text": _fallback(ctx, tone), "model": f"fallback({type(e).__name__})", "cached": False}
