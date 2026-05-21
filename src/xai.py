import numpy as np
import torch
import torch.nn as nn
import shap
from src.config import SENSOR_COLS
from src.model import recon_error


# ── 기존 KernelSHAP (느림: 1샘플 ~3000ms, fallback용으로 유지) ──
def make_predict_fn(model):
    def predict_fn(X):
        X_t = torch.FloatTensor(X.astype(np.float32))
        return recon_error(model, X_t).numpy()
    return predict_fn


def build_explainer(model, X_background: np.ndarray, n_background=100):
    """KernelExplainer (느림). 호환성 위해 유지. 신규 코드는 build_gradient_explainer 권장."""
    predict_fn = make_predict_fn(model)
    background = shap.kmeans(X_background, n_background)
    explainer = shap.KernelExplainer(predict_fn, background)
    return explainer


def compute_shap_values(explainer, X_explain: np.ndarray, nsamples=200):
    return explainer.shap_values(X_explain, nsamples=nsamples)


# ── M4. DeepSHAP / GradientExplainer (50배 빠름: 1샘플 < 100ms) ──
class _ReconErrorWrapper(nn.Module):
    """AE를 복원 오차 출력으로 wrap — GradientExplainer 호환 단일 스칼라 출력."""
    def __init__(self, ae_model):
        super().__init__()
        self.ae = ae_model

    def forward(self, x):
        x_hat = self.ae(x)
        # 각 샘플의 평균 제곱 오차 → (B, 1) 형태 반환
        return ((x - x_hat) ** 2).mean(dim=1, keepdim=True)


def build_gradient_explainer(model, X_background: np.ndarray, n_background=100,
                              random_state=42):
    """GradientExplainer 기반 빠른 SHAP — 1샘플 < 100ms 목표.
    AE를 복원 오차 출력으로 wrap하여 단일 스칼라 explainer 구성.
    """
    rng = np.random.RandomState(random_state)
    n = len(X_background)
    if n_background < n:
        idx = rng.choice(n, n_background, replace=False)
        bg = X_background[idx]
    else:
        bg = X_background
    bg_tensor = torch.FloatTensor(bg.astype(np.float32))

    wrapper = _ReconErrorWrapper(model)
    wrapper.eval()
    # GradientExplainer: 모델은 모듈, 배경은 텐서
    explainer = shap.GradientExplainer(wrapper, bg_tensor)
    return explainer


def compute_gradient_shap(explainer, X_explain: np.ndarray, nsamples=50):
    """GradientExplainer로 SHAP 값 계산.
    Returns: (n_samples, n_features) numpy array
    """
    X_t = torch.FloatTensor(X_explain.astype(np.float32))
    sv = explainer.shap_values(X_t, nsamples=nsamples)
    # shap.GradientExplainer는 list[array] or array 반환 (출력 차원에 따라)
    if isinstance(sv, list):
        sv = sv[0]
    sv = np.asarray(sv)
    # (n_samples, n_features, 1) → squeeze
    if sv.ndim == 3:
        sv = sv.squeeze(-1)
    return sv


def get_top_features(shap_vals: np.ndarray, top_n=5):
    """절대 SHAP 값 평균 기준 상위 n개 피처 반환"""
    mean_abs = np.abs(shap_vals).mean(axis=0)
    top_idx = np.argsort(mean_abs)[::-1][:top_n]
    return [(SENSOR_COLS[i], mean_abs[i]) for i in top_idx]
