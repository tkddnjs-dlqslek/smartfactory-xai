import numpy as np
import torch
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    average_precision_score, precision_recall_curve, roc_curve,
    confusion_matrix
)
from src.config import THRESHOLD_PERCENTILE
from src.model import recon_error


def compute_errors(model, X: np.ndarray, batch_size=2048) -> np.ndarray:
    model.eval()
    errors = []
    for i in range(0, len(X), batch_size):
        xb = torch.FloatTensor(X[i:i+batch_size])
        errors.append(recon_error(model, xb).numpy())
    return np.concatenate(errors)


def find_threshold(model, X_val_normal: np.ndarray,
                   X_val: np.ndarray, y_val: np.ndarray):
    errors_normal = compute_errors(model, X_val_normal)
    percentile_thresh = float(np.percentile(errors_normal, THRESHOLD_PERCENTILE))

    all_errors = compute_errors(model, X_val)
    precision, recall, thresholds = precision_recall_curve(y_val, all_errors)
    f1s = 2 * precision * recall / (precision + recall + 1e-9)
    best_idx = np.argmax(f1s[:-1])
    f1_thresh = float(thresholds[best_idx])

    # 두 값의 평균을 최종 임계값으로 사용
    final_thresh = (percentile_thresh + f1_thresh) / 2
    print(f"Percentile({THRESHOLD_PERCENTILE}th) threshold : {percentile_thresh:.6f}")
    print(f"F1-optimal threshold             : {f1_thresh:.6f}")
    print(f"Final threshold (avg)            : {final_thresh:.6f}")
    return final_thresh, errors_normal, all_errors


def evaluate(model, X_val: np.ndarray, y_val: np.ndarray, threshold: float):
    errors = compute_errors(model, X_val)
    y_pred = (errors >= threshold).astype(int)

    metrics = {
        'roc_auc':  float(roc_auc_score(y_val, errors)),
        'pr_auc':   float(average_precision_score(y_val, errors)),
        'f1':       float(f1_score(y_val, y_pred, zero_division=0)),
        'precision': float(precision_score(y_val, y_pred, zero_division=0)),
        'recall':   float(recall_score(y_val, y_pred, zero_division=0)),
        'threshold': threshold,
    }
    cm = confusion_matrix(y_val, y_pred)
    fpr, tpr, _ = roc_curve(y_val, errors)
    prec_curve, rec_curve, _ = precision_recall_curve(y_val, errors)

    return metrics, errors, cm, (fpr, tpr), (prec_curve, rec_curve)
