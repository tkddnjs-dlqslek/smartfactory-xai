import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
import pandas as pd
import torch
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.config import MODEL_DIR, RESULT_DIR, SENSOR_COLS, DATA_DIR

print("=" * 50)
print("Step 3: 비라벨 데이터 스코어링 (moldset_unlabeled_cn7)")

model_cls = __import__('src.model', fromlist=['Autoencoder', 'recon_error'])
Autoencoder = model_cls.Autoencoder
recon_error = model_cls.recon_error

model = Autoencoder(input_dim=24)
model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'autoencoder.pt'), map_location='cpu'))
model.eval()

with open(os.path.join(MODEL_DIR, 'threshold.json')) as f:
    threshold = json.load(f)['value']
print(f"Threshold: {threshold:.6f}")

scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
print("학습 scaler 로드 완료")

# moldset_unlabeled_cn7: cn7 설비 비라벨 데이터 35,239행
target_file = os.path.join(DATA_DIR, 'moldset_unlabeled_cn7.csv')
df_unl = pd.read_csv(target_file, index_col=0)
print(f"\n데이터 로드: {len(df_unl):,}행 × {len(SENSOR_COLS)}센서")

X = scaler.transform(df_unl[SENSOR_COLS].values).astype(np.float32)
errors = recon_error(model, torch.FloatTensor(X)).numpy()
is_anomaly = (errors >= threshold).astype(int)

scored = df_unl[SENSOR_COLS].copy()
scored['recon_error'] = errors
scored['is_anomaly'] = is_anomaly
scored['shot_id'] = range(len(scored))

out_path = os.path.join(RESULT_DIR, 'scored_unlabeled.parquet')
scored.to_parquet(out_path, index=False)

anomaly_rate = is_anomaly.mean() * 100
print(f"\n총 {len(scored):,}행 스코어링 완료")
print(f"이상 탐지: {is_anomaly.sum():,}건 ({anomaly_rate:.2f}%)")
print(f"저장 → {out_path}")

# 시각화: 복원 오차 시계열
fig, ax = plt.subplots(figsize=(14, 4))
ax.plot(scored['recon_error'].values, color='steelblue', alpha=0.6, linewidth=0.5, label='복원 오차')
ax.axhline(threshold, color='crimson', linestyle='--', linewidth=1.5, label=f'임계값 ({threshold:.4f})')
anomaly_idx = np.where(is_anomaly)[0]
ax.scatter(anomaly_idx, errors[anomaly_idx], color='crimson', s=8, zorder=5, label='이상 탐지')
ax.set_xlabel('Shot Index')
ax.set_ylabel('Reconstruction Error (MSE)')
ax.set_title(f'사출 공정 이상 탐지 시계열 (총 {len(scored):,}샷, 이상 {is_anomaly.sum():,}건)')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'scored_timeseries.png'), dpi=150)
plt.close()
print("시계열 차트 저장 → results/scored_timeseries.png")
print("완료!")
