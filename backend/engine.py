"""추론 엔진 — 모델/베이스라인/임계값 로드 후 z-score 입력으로 4-AI 합의 + SHAP.

핵심: 4개 모델(AE/IF/OCSVM/LOF) 모두 z-score(정규화) 입력에서 동작.
프론트엔드는 σ(z-score) 공간에서 통신하므로 scaler 변환 불필요.
"""
import os
import json
import numpy as np
import torch
import joblib

from .model import Autoencoder, recon_error

# ── 경로 ──
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)            # smart_factory_xai/
MODEL_DIR = os.path.join(PROJECT_DIR, "models")
RESULT_DIR = os.path.join(PROJECT_DIR, "results")

# ── 24 센서 (학습 순서 고정) ──
SENSOR_COLS = [
    "Injection_Time", "Filling_Time", "Plasticizing_Time", "Cycle_Time",
    "Clamp_Close_Time", "Cushion_Position", "Plasticizing_Position",
    "Clamp_Open_Position", "Max_Injection_Speed", "Max_Screw_RPM",
    "Average_Screw_RPM", "Max_Injection_Pressure", "Max_Switch_Over_Pressure",
    "Max_Back_Pressure", "Average_Back_Pressure",
    "Barrel_Temperature_1", "Barrel_Temperature_2", "Barrel_Temperature_3",
    "Barrel_Temperature_4", "Barrel_Temperature_5", "Barrel_Temperature_6",
    "Hopper_Temperature", "Mold_Temperature_3", "Mold_Temperature_4",
]

# ── 센서 그룹 (프론트 5그룹 그리드용) ──
SENSOR_GROUPS = [
    ("시간 / TIME", ["Injection_Time", "Filling_Time", "Plasticizing_Time", "Cycle_Time", "Clamp_Close_Time"]),
    ("위치 / POS", ["Cushion_Position", "Plasticizing_Position", "Clamp_Open_Position"]),
    ("속도 / RPM", ["Max_Injection_Speed", "Max_Screw_RPM", "Average_Screw_RPM"]),
    ("압력 / PRESS", ["Max_Injection_Pressure", "Max_Switch_Over_Pressure", "Max_Back_Pressure", "Average_Back_Pressure"]),
    ("온도 / TEMP", ["Barrel_Temperature_1", "Barrel_Temperature_2", "Barrel_Temperature_3",
                     "Barrel_Temperature_4", "Barrel_Temperature_5", "Barrel_Temperature_6",
                     "Hopper_Temperature", "Mold_Temperature_3", "Mold_Temperature_4"]),
]

# ── AUC-가중 soft voting (app.py와 동일) ──
_AUC_W = {"ae": 0.9254, "if": 0.9571, "oc": 0.9600, "lof": 0.9312}
_W_SUM = sum(_AUC_W.values())
_W_NORM = {k: v / _W_SUM for k, v in _AUC_W.items()}

# ── 처방 룩업 (주요 센서 → 조치) ──
PRESCRIPTIONS = {
    "Barrel_Temperature_1": "배럴 1존 가열 출력 점검 · 과열 시 -10%",
    "Barrel_Temperature_6": "노즐단 배럴 온도 점검 · 가열대 출력 조정",
    "Hopper_Temperature": "호퍼 건조 온도 · 수지 함수율 확인",
    "Mold_Temperature_3": "금형 3존 냉각수 유량 점검",
    "Mold_Temperature_4": "금형 4존 냉각수 유량 점검",
    "Filling_Time": "게이트 막힘 점검 · MFR 확인 · 노즐 청소 Lv.2",
    "Injection_Time": "사출 속도 프로파일 재설정 · 충전 구간 점검",
    "Cushion_Position": "역류방지밸브 마모 점검 · 사출량 캘리브레이션",
    "Max_Injection_Pressure": "사출 압력 상한 점검 · 흐름 저항 확인",
    "Max_Switch_Over_Pressure": "전환 압력 재설정 · V/P 절환점 확인",
    "Max_Back_Pressure": "배압 설정 점검 · 스크류 계량 안정화",
    "Average_Back_Pressure": "평균 배압 모니터링 · 계량 편차 확인",
    "Max_Injection_Speed": "사출 속도 상한 점검 · 충전 균일성 확인",
    "Max_Screw_RPM": "스크류 회전수 점검 · 가소화 안정화",
    "Average_Screw_RPM": "평균 스크류 RPM 모니터링",
    "Cycle_Time": "사이클 타임 편차 점검 · 공정 안정화",
}


# 정상 검증샷 평균 복원오차 (SHAP 워터폴 기준선 — 고정 상수). val_scores 정상분 평균=0.0477.
NORMAL_MEAN_ERR = 0.0477


def _sigmoid_norm(score, thr, scale=3.0):
    return float(1.0 / (1.0 + np.exp(-(score - thr) * scale)))


def _bar_pos(z: float) -> float:
    """z-score → 0~1 막대 위치 (가시화용)."""
    return float(np.clip(0.5 + z * 0.085, 0.02, 0.98))


class Engine:
    def __init__(self):
        self.ae = Autoencoder(24)
        self.ae.load_state_dict(torch.load(os.path.join(MODEL_DIR, "autoencoder.pt"), map_location="cpu"))
        self.ae.eval()

        with open(os.path.join(MODEL_DIR, "threshold.json"), encoding="utf-8") as f:
            self.threshold = float(json.load(f)["value"])

        self.baselines = joblib.load(os.path.join(MODEL_DIR, "baselines.pkl"))
        self.bl_thr = self.baselines["thresholds"]

        self._explainer = None  # GradientExplainer 지연 로딩

    # ── 4-AI 합의 예측 ──
    def predict(self, z, required_votes: int = 3) -> dict:
        x = np.asarray(z, dtype=np.float32).reshape(1, -1)
        if x.shape[1] != 24:
            raise ValueError(f"센서 24개 필요, {x.shape[1]}개 받음")

        # AE
        ae_err = float(recon_error(self.ae, torch.from_numpy(x))[0].item())
        ae_vote = ae_err >= self.threshold

        # IF / OCSVM / LOF (음수 부호 = 이상 점수)
        if_s = float(-self.baselines["isolation_forest"].score_samples(x)[0])
        oc_s = float(-self.baselines["ocsvm"].score_samples(x)[0])
        lof_s = float(-self.baselines["lof"].score_samples(x)[0])
        if_vote = if_s >= self.bl_thr["isolation_forest"]
        oc_vote = oc_s >= self.bl_thr["ocsvm"]
        lof_vote = lof_s >= self.bl_thr["lof"]

        votes = [int(ae_vote), int(if_vote), int(oc_vote), int(lof_vote)]
        scores = [round(ae_err, 4), round(if_s, 4), round(oc_s, 4), round(lof_s, 4)]
        agree = sum(votes)

        # soft voting
        soft = (_W_NORM["ae"] * _sigmoid_norm(ae_err, self.threshold)
                + _W_NORM["if"] * _sigmoid_norm(if_s, self.bl_thr["isolation_forest"])
                + _W_NORM["oc"] * _sigmoid_norm(oc_s, self.bl_thr["ocsvm"])
                + _W_NORM["lof"] * _sigmoid_norm(lof_s, self.bl_thr["lof"]))

        is_anom = agree >= required_votes
        ratio = ae_err / (self.threshold + 1e-9)
        if not is_anom:
            status, sev = "NORMAL", 0
        elif ratio < 1.5:
            status, sev = "WARNING", 1
        elif ratio < 2.5:
            status, sev = "DANGER", 2
        else:
            status, sev = "CRITICAL", 3

        # 센서 그리드 (그룹별 z-score)
        zlist = np.asarray(z, dtype=float).ravel().tolist()
        zmap = {c: zlist[i] for i, c in enumerate(SENSOR_COLS)}
        groups = []
        for gname, cols in SENSOR_GROUPS:
            rows = []
            for c in cols:
                zv = zmap[c]
                rows.append({
                    "name": c, "sigma": round(zv, 1),
                    "pos": round(_bar_pos(zv), 3),
                    "hot": abs(zv) >= 2.0, "warm": abs(zv) >= 1.0,
                })
            groups.append({"group": gname, "rows": rows})

        # 처방 Top-3 (|z| 상위 + 양의 이상 우선)
        order = sorted(range(24), key=lambda i: abs(zlist[i]), reverse=True)
        presc = []
        for i in order[:3]:
            c = SENSOR_COLS[i]
            presc.append({
                "sensor": c, "sigma": f"{'+' if zlist[i] >= 0 else ''}{zlist[i]:.1f}σ",
                "action": PRESCRIPTIONS.get(c, f"{c} 점검 권고"),
            })

        return {
            "recon_error": round(ae_err, 4),
            "threshold": round(self.threshold, 4),
            "ratio": round(ratio, 3),
            "status": status, "severity": sev,
            "votes": votes, "scores": scores,
            "agree": agree, "total": 4, "required": required_votes,
            "soft": round(soft, 4),
            "sensor_groups": groups,
            "prescriptions": presc,
        }

    # ── SHAP (GradientExplainer, 지연 로딩) ──
    def _get_explainer(self):
        if self._explainer is None:
            import shap
            import torch.nn as nn

            class _Wrap(nn.Module):
                def __init__(self, ae):
                    super().__init__()
                    self.ae = ae

                def forward(self, x):
                    return ((x - self.ae(x)) ** 2).mean(dim=1, keepdim=True)

            bg = np.load(os.path.join(MODEL_DIR, "X_train.npy")).astype(np.float32)
            rng = np.random.RandomState(42)
            if len(bg) > 100:
                bg = bg[rng.choice(len(bg), 100, replace=False)]
            wrap = _Wrap(self.ae)
            wrap.eval()
            self._explainer = shap.GradientExplainer(wrap, torch.from_numpy(bg))
        return self._explainer

    def explain(self, z, top_n: int = 5) -> dict:
        x = np.asarray(z, dtype=np.float32).reshape(1, -1)
        sv = self._get_explainer().shap_values(torch.from_numpy(x), nsamples=50)
        if isinstance(sv, list):
            sv = sv[0]
        sv = np.asarray(sv)
        if sv.ndim == 3:
            sv = sv.squeeze(-1)
        sv = sv.ravel()

        zlist = np.asarray(z, dtype=float).ravel()
        # 불량 원인 = 복원오차를 키운(=이상 쪽으로 민) 양의 SHAP. 큰 순으로 top_n.
        order = np.argsort(sv)[::-1][:top_n]
        total_pos = float(sv[sv > 0].sum()) + 1e-9  # 전체 '이상 기여' 합
        top = []
        for i in order:
            i = int(i)
            top.append({
                "name": SENSOR_COLS[i],
                "shap": round(float(sv[i]), 4),
                "abs_shap": round(float(abs(sv[i])), 4),
                "sigma": f"{'+' if zlist[i] >= 0 else ''}{zlist[i]:.1f}σ",
            })
        # top_n의 양의 기여가 전체 이상 기여에서 차지하는 비중
        cum = round(sum(max(0.0, float(sv[int(i)])) for i in order) / total_pos, 3)
        # 워터폴 기준 = 정상 평균 복원오차(고정 상수). SHAP 근사로 흔들리던 역산값 대신 의미있는 고정값 사용.
        pred_err = float(recon_error(self.ae, torch.from_numpy(x))[0].item())
        base = NORMAL_MEAN_ERR
        top_sum = float(sum(sv[int(i)] for i in order))
        rest = pred_err - base - top_sum   # '기타' 막대 = 예측 - 기준 - top합 (나머지+근사오차 흡수, 닫힘 보장)
        return {"top": top, "cumulative": cum, "n_features": 24,
                "base": round(base, 4), "pred": round(pred_err, 4),
                "rest": round(rest, 4), "rest_n": 24 - len(order)}


# 모듈 싱글톤 (앱 기동 시 1회 로드)
_engine = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = Engine()
    return _engine
