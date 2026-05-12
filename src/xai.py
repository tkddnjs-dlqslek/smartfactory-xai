import numpy as np
import torch
import shap
from src.config import SENSOR_COLS
from src.model import recon_error


def make_predict_fn(model):
    def predict_fn(X):
        X_t = torch.FloatTensor(X.astype(np.float32))
        return recon_error(model, X_t).numpy()
    return predict_fn


def build_explainer(model, X_background: np.ndarray, n_background=100):
    predict_fn = make_predict_fn(model)
    background = shap.kmeans(X_background, n_background)
    explainer = shap.KernelExplainer(predict_fn, background)
    return explainer


def compute_shap_values(explainer, X_explain: np.ndarray, nsamples=200):
    return explainer.shap_values(X_explain, nsamples=nsamples)


def get_top_features(shap_vals: np.ndarray, top_n=5):
    """절대 SHAP 값 평균 기준 상위 n개 피처 반환"""
    mean_abs = np.abs(shap_vals).mean(axis=0)
    top_idx = np.argsort(mean_abs)[::-1][:top_n]
    return [(SENSOR_COLS[i], mean_abs[i]) for i in top_idx]
