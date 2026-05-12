import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from src.config import MODEL_DIR, RESULT_DIR, SEED
from src.data_loader import load_labeled_files, prepare_train_val
from src.model import Autoencoder
from src.trainer import train

np.random.seed(SEED)
torch.manual_seed(SEED)

print("=" * 50)
print("Step 1: 데이터 로드")
df = load_labeled_files()
print(f"전체: {len(df)}행 | 정상: {(df.PassOrFail==0).sum()} | 불량: {(df.PassOrFail==1).sum()}")

X_train, X_val, y_val = prepare_train_val(df)
X_val_normal = X_val[y_val == 0]

print("\nStep 2: 오토인코더 학습")
model = Autoencoder(input_dim=X_train.shape[1])
history = train(model, X_train, X_val_normal)

model_path = os.path.join(MODEL_DIR, 'autoencoder.pt')
torch.save(model.state_dict(), model_path)
print(f"\n모델 저장 → {model_path}")

# 학습 곡선 저장
fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(history['train_loss'], label='Train Loss')
ax.plot(history['val_loss'], label='Val Loss (Normal)')
ax.set_xlabel('Epoch')
ax.set_ylabel('MSE Loss')
ax.set_title('Autoencoder Training Curve')
ax.legend()
ax.grid(True)
plt.tight_layout()
fig.savefig(os.path.join(RESULT_DIR, 'training_curve.png'), dpi=150)
plt.close()
print(f"학습 곡선 저장 → results/training_curve.png")

# train/val 데이터 저장 (이후 스크립트에서 재사용)
np.save(os.path.join(MODEL_DIR, 'X_train.npy'), X_train)
np.save(os.path.join(MODEL_DIR, 'X_val.npy'), X_val)
np.save(os.path.join(MODEL_DIR, 'y_val.npy'), y_val)

# 학습 history JSON 저장 (app.py Plotly용)
with open(os.path.join(RESULT_DIR, 'training_history.json'), 'w') as f:
    json.dump(history, f)

print("완료!")
