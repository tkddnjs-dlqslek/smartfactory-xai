import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.config import MODEL_DIR, RESULT_DIR
from src.model import Autoencoder
from src.detector import find_threshold, evaluate

print("=" * 50)
print("Step 2: 성능 평가")

model = Autoencoder(input_dim=24)
model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'autoencoder.pt'), map_location='cpu'))
model.eval()

X_train = np.load(os.path.join(MODEL_DIR, 'X_train.npy'))
X_val   = np.load(os.path.join(MODEL_DIR, 'X_val.npy'))
y_val   = np.load(os.path.join(MODEL_DIR, 'y_val.npy'))
X_val_normal = X_val[y_val == 0]

threshold, errors_normal, all_errors = find_threshold(model, X_val_normal, X_val, y_val)
metrics, errors, cm, (fpr, tpr), (prec_c, rec_c) = evaluate(model, X_val, y_val, threshold)

print("\n=== 성능 지표 ===")
for k, v in metrics.items():
    print(f"  {k}: {v:.4f}")

# threshold.json 저장
import json
with open(os.path.join(MODEL_DIR, 'threshold.json'), 'w') as f:
    json.dump({'value': threshold}, f)

# metrics.json 저장
with open(os.path.join(RESULT_DIR, 'metrics.json'), 'w', encoding='utf-8') as f:
    json.dump(metrics, f, ensure_ascii=False, indent=2)

# ── 시각화 1: 복원 오차 분포 ──
fig, ax = plt.subplots(figsize=(9, 4))
errors_def = errors[y_val == 1]
errors_norm = errors[y_val == 0]
ax.hist(errors_norm, bins=60, alpha=0.7, color='steelblue', label='정상')
ax.hist(errors_def,  bins=20, alpha=0.8, color='crimson',   label='불량')
ax.axvline(threshold, color='black', linestyle='--', linewidth=2, label=f'Threshold={threshold:.4f}')
ax.set_xlabel('Reconstruction Error (MSE)')
ax.set_ylabel('Count')
ax.set_title('복원 오차 분포: 정상 vs 불량')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'error_distribution.png'), dpi=150)
plt.close()

# ── 시각화 2: ROC Curve ──
fig, ax = plt.subplots(figsize=(6, 5))
ax.plot(fpr, tpr, color='darkorange', lw=2,
        label=f'ROC (AUC={metrics["roc_auc"]:.3f})')
ax.plot([0, 1], [0, 1], 'k--')
ax.set_xlabel('False Positive Rate')
ax.set_ylabel('True Positive Rate')
ax.set_title('ROC Curve')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'roc_curve.png'), dpi=150)
plt.close()

# ── 시각화 3: Precision-Recall Curve ──
fig, ax = plt.subplots(figsize=(6, 5))
ax.plot(rec_c, prec_c, color='navy', lw=2,
        label=f'PR (AUC={metrics["pr_auc"]:.3f})')
ax.set_xlabel('Recall')
ax.set_ylabel('Precision')
ax.set_title('Precision-Recall Curve')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'pr_curve.png'), dpi=150)
plt.close()

# ── 시각화 4: Confusion Matrix ──
fig, ax = plt.subplots(figsize=(4, 4))
im = ax.imshow(cm, cmap='Blues')
ax.set_xticks([0,1]); ax.set_yticks([0,1])
ax.set_xticklabels(['정상 예측', '불량 예측'])
ax.set_yticklabels(['실제 정상', '실제 불량'])
for i in range(2):
    for j in range(2):
        ax.text(j, i, str(cm[i, j]), ha='center', va='center',
                color='white' if cm[i,j] > cm.max()/2 else 'black', fontsize=14)
ax.set_title('Confusion Matrix')
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'confusion_matrix.png'), dpi=150)
plt.close()

# ── 곡선 데이터 numpy 저장 (app.py Plotly용) ──
np.savez(os.path.join(RESULT_DIR, 'curve_roc.npz'), fpr=fpr, tpr=tpr)
np.savez(os.path.join(RESULT_DIR, 'curve_pr.npz'),  prec=prec_c, rec=rec_c)
np.save(os.path.join(RESULT_DIR, 'val_errors.npy'), errors)

print(f"\n시각화 4개 + 곡선 데이터 저장 → results/")

# ── 보고서 자동 갱신 ── (숫자 접두사 파일명이라 import 불가, subprocess로 호출)
import subprocess, sys as _sys
subprocess.run([_sys.executable, os.path.join(os.path.dirname(__file__), '05_update_report.py')],
               check=False, capture_output=True)

print("완료!")
