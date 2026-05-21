"""SmartFactory XAI — FastAPI 백엔드 (하이브리드).

라이브 추론: POST /api/predict, /api/explain  (torch + shap)
사전계산 서빙: GET /api/metrics, /api/batch, /api/history, /api/causal, /api/pca
"""
import os
import json
from typing import List, Optional

# .env 로드 (ANTHROPIC_API_KEY 등) — 프로젝트 루트의 .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
except Exception:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .engine import get_engine, SENSOR_COLS, RESULT_DIR
from . import report as report_mod

app = FastAPI(title="SmartFactory XAI API", version="1.0")

# 로컬 + 환경변수(ALLOWED_ORIGINS, 콤마구분) + 모든 *.vercel.app 미리보기/프로덕션 허용
_env_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", *_env_origins],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 데모 시나리오 (z-score, 실측 KAMP 불량 사례) ──
_SCENARIO_Z = {
    "정상 운영": {},
    "경고 #8 (162%)": {
        "Injection_Time": 0.85, "Filling_Time": 1.54, "Plasticizing_Time": -1.21,
        "Cycle_Time": -1.63, "Max_Injection_Speed": -2.75, "Max_Screw_RPM": -1.24,
        "Average_Screw_RPM": 1.31, "Max_Switch_Over_Pressure": 1.33,
        "Barrel_Temperature_6": -1.32, "Hopper_Temperature": -0.88,
        "Mold_Temperature_3": -1.25, "Mold_Temperature_4": -1.15,
    },
    "위험 #27 (523%)": {
        "Injection_Time": -0.87, "Filling_Time": -1.29, "Plasticizing_Position": 0.70,
        "Max_Injection_Speed": 6.56, "Max_Screw_RPM": 1.60, "Average_Screw_RPM": 1.32,
        "Max_Switch_Over_Pressure": 0.59, "Max_Back_Pressure": -1.00,
        "Mold_Temperature_3": 2.61, "Mold_Temperature_4": 3.12,
    },
    "긴급 #37 (978%)": {
        "Injection_Time": 2.79, "Filling_Time": 4.82, "Plasticizing_Time": -1.00,
        "Cycle_Time": 2.53, "Max_Injection_Speed": -7.53, "Average_Screw_RPM": 1.32,
        "Max_Switch_Over_Pressure": 3.71, "Max_Back_Pressure": 8.45,
        "Average_Back_Pressure": 2.32, "Hopper_Temperature": -0.68,
        "Mold_Temperature_3": -1.17, "Mold_Temperature_4": -1.07,
    },
}


def _full_z(sparse: dict) -> List[float]:
    return [round(float(sparse.get(c, 0.0)), 4) for c in SENSOR_COLS]


def _load_json(name: str):
    path = os.path.join(RESULT_DIR, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── 스키마 ──
class PredictIn(BaseModel):
    z: List[float]
    required_votes: Optional[int] = 3


class ExplainIn(BaseModel):
    z: List[float]
    top_n: Optional[int] = 5


class ReportIn(BaseModel):
    z: List[float]
    tone: Optional[str] = "worker"  # worker | supervisor | director


# ── 엔드포인트 ──
@app.get("/api/health")
def health():
    try:
        eng = get_engine()
        return {"status": "ok", "threshold": eng.threshold, "sensors": len(SENSOR_COLS)}
    except Exception as e:
        raise HTTPException(500, f"engine load failed: {e}")


@app.get("/api/sensors")
def sensors():
    return {"sensor_cols": SENSOR_COLS}


@app.get("/api/scenarios")
def scenarios():
    return {"scenarios": [{"name": k, "z": _full_z(v)} for k, v in _SCENARIO_Z.items()]}


@app.post("/api/predict")
def predict(body: PredictIn):
    if len(body.z) != 24:
        raise HTTPException(400, f"센서 24개 필요, {len(body.z)}개 받음")
    try:
        return get_engine().predict(body.z, required_votes=body.required_votes or 3)
    except Exception as e:
        raise HTTPException(500, f"predict failed: {e}")


@app.post("/api/explain")
def explain(body: ExplainIn):
    if len(body.z) != 24:
        raise HTTPException(400, f"센서 24개 필요, {len(body.z)}개 받음")
    try:
        return get_engine().explain(body.z, top_n=body.top_n or 5)
    except Exception as e:
        raise HTTPException(500, f"explain failed: {e}")


_STATUS_KO = {"NORMAL": "정상", "WARNING": "경고", "DANGER": "위험", "CRITICAL": "긴급"}


@app.post("/api/report")
def report(body: ReportIn):
    if len(body.z) != 24:
        raise HTTPException(400, f"센서 24개 필요, {len(body.z)}개 받음")
    try:
        pred = get_engine().predict(body.z)
    except Exception as e:
        raise HTTPException(500, f"predict failed: {e}")
    # 이상 상위 센서 (처방 기반 top-3)
    top = [{"name": p["sensor"], "sigma": p["sigma"]} for p in pred["prescriptions"]]
    ctx = {
        "status": pred["status"], "status_ko": _STATUS_KO.get(pred["status"], pred["status"]),
        "recon_error": pred["recon_error"], "threshold": pred["threshold"], "ratio": pred["ratio"],
        "agree": pred["agree"], "soft": pred["soft"], "top_sensors": top,
    }
    return report_mod.generate(ctx, tone=body.tone or "worker")


@app.get("/api/metrics")
def metrics():
    return {
        "metrics": _load_json("metrics.json"),
        "ensemble": _load_json("ensemble_metrics.json"),
        "soft_voting": _load_json("soft_voting_metrics.json"),
        "stacking": _load_json("stacking_metrics.json"),
        "baseline": _load_json("baseline_metrics.json"),
        "cost_threshold": _load_json("cost_threshold_metrics.json"),
        "hypothesis_test": _load_json("hypothesis_test.json"),
    }


@app.get("/api/batch")
def batch():
    return {
        "metrics": _load_json("metrics.json"),
        "anomaly_log": _load_json("anomaly_log.json"),
    }


@app.get("/api/history")
def history():
    return {"anomaly_log": _load_json("anomaly_log.json")}


@app.get("/api/causal")
def causal():
    return _load_json("causal_graph.json") or {}


@app.get("/api/pca")
def pca():
    return _load_json("pca_data.json") or {}
