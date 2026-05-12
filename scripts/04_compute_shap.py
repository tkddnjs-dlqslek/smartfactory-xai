import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.config import MODEL_DIR, RESULT_DIR, SENSOR_COLS
from src.model import Autoencoder
from src.detector import compute_errors
from src.xai import build_explainer, compute_shap_values, get_top_features

print("=" * 50)
print("Step 4: SHAP 사전 계산")

model = Autoencoder(input_dim=24)
model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'autoencoder.pt'), map_location='cpu'))
model.eval()

with open(os.path.join(MODEL_DIR, 'threshold.json')) as f:
    threshold = json.load(f)['value']

X_train = np.load(os.path.join(MODEL_DIR, 'X_train.npy'))
X_val   = np.load(os.path.join(MODEL_DIR, 'X_val.npy'))
y_val   = np.load(os.path.join(MODEL_DIR, 'y_val.npy'))

# 이상 샘플 추출 (검증셋 불량 + 임계값 초과 정상)
errors = compute_errors(model, X_val)
anomaly_mask = (errors >= threshold)
X_anomaly = X_val[anomaly_mask]
print(f"이상 샘플 수: {len(X_anomaly)}")

# 최대 200개만 SHAP 계산 (속도)
n_shap = min(200, len(X_anomaly))
X_explain = X_anomaly[:n_shap]

print(f"\nKernelExplainer 배경 데이터 준비 (100 kmeans)...")
explainer = build_explainer(model, X_train, n_background=100)

print(f"SHAP 계산 중 ({n_shap}샘플 × nsamples=100)...")
shap_vals = compute_shap_values(explainer, X_explain, nsamples=100)

np.save(os.path.join(RESULT_DIR, 'shap_values.npy'), shap_vals)
np.save(os.path.join(RESULT_DIR, 'shap_X_explain.npy'), X_explain)
print(f"SHAP 저장 → results/shap_values.npy")

top_features = get_top_features(shap_vals, top_n=10)
print("\n=== 상위 10개 이상 원인 센서 ===")
for feat, val in top_features:
    print(f"  {feat}: {val:.4f}")

# SHAP bar chart 저장
import shap
fig, ax = plt.subplots(figsize=(8, 6))
mean_abs = np.abs(shap_vals).mean(axis=0)
sorted_idx = np.argsort(mean_abs)
ax.barh([SENSOR_COLS[i] for i in sorted_idx],
        mean_abs[sorted_idx], color='steelblue')
ax.set_xlabel('Mean |SHAP value|')
ax.set_title('센서별 이상 기여도 (XAI)')
ax.grid(True, alpha=0.3, axis='x')
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'shap_bar.png'), dpi=150)
plt.close()
print("SHAP bar chart 저장 → results/shap_bar.png")
print("완료!")
