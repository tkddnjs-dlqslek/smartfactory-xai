import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import json
import numpy as np
import torch
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score
from src.config import MODEL_DIR, RESULT_DIR
from src.model import Autoencoder, recon_error as calc_recon_error

model = Autoencoder(input_dim=24)
model.load_state_dict(torch.load(os.path.join(MODEL_DIR, 'autoencoder.pt'), map_location='cpu'))
model.eval()

X_val = np.load(os.path.join(MODEL_DIR, 'X_val.npy'))
y_val = np.load(os.path.join(MODEL_DIR, 'y_val.npy'))

with torch.no_grad():
    val_errs = calc_recon_error(model, torch.FloatTensor(X_val)).numpy()

metrics_path = os.path.join(RESULT_DIR, 'metrics.json')
with open(metrics_path, encoding='utf-8') as f:
    metrics = json.load(f)

thr = metrics['threshold']
n_boot = 1000
rng    = np.random.default_rng(42)
n      = len(y_val)

aucs, f1s, precs, recs = [], [], [], []

for _ in range(n_boot):
    idx = rng.integers(0, n, size=n)
    y_b = y_val[idx]
    e_b = val_errs[idx]
    if y_b.sum() < 2 or (y_b == 0).sum() < 2:
        continue
    pred_b = (e_b >= thr).astype(int)
    aucs.append(roc_auc_score(y_b, e_b))
    f1s.append(f1_score(y_b, pred_b, zero_division=0))
    precs.append(precision_score(y_b, pred_b, zero_division=0))
    recs.append(recall_score(y_b, pred_b, zero_division=0))

def ci(arr):
    a = np.array(arr)
    return float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))

roc_lo, roc_hi = ci(aucs)
f1_lo,  f1_hi  = ci(f1s)
pr_lo,  pr_hi  = ci(precs)
re_lo,  re_hi  = ci(recs)

print(f"ROC-AUC  95%CI: [{roc_lo:.4f}, {roc_hi:.4f}]")
print(f"F1       95%CI: [{f1_lo:.4f},  {f1_hi:.4f}]")
print(f"Precision 95%CI: [{pr_lo:.4f}, {pr_hi:.4f}]")
print(f"Recall   95%CI: [{re_lo:.4f},  {re_hi:.4f}]")

metrics['roc_auc_ci_lo']   = roc_lo
metrics['roc_auc_ci_hi']   = roc_hi
metrics['f1_ci_lo']        = f1_lo
metrics['f1_ci_hi']        = f1_hi
metrics['precision_ci_lo'] = pr_lo
metrics['precision_ci_hi'] = pr_hi
metrics['recall_ci_lo']    = re_lo
metrics['recall_ci_hi']    = re_hi
metrics['roc_auc_boot_n']  = len(aucs)

with open(metrics_path, 'w', encoding='utf-8') as f:
    json.dump(metrics, f, ensure_ascii=False, indent=2)

print(f"metrics.json updated with all CIs")
