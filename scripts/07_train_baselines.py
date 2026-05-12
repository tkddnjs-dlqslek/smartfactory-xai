"""
다중 AI 합의 — 베이스라인 모델 학습 (Isolation Forest, OCSVM, LOF)
용도: Autoencoder와 합의 비교해 신뢰도 미터 계산
출력: models/baselines.pkl, results/baseline_metrics.json
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor
from sklearn.metrics import roc_auc_score, f1_score, recall_score, precision_score

from src.config import MODEL_DIR, RESULT_DIR

# ── 데이터 로드 ──
X_train = np.load(os.path.join(MODEL_DIR, 'X_train.npy'))  # 정상만
X_val   = np.load(os.path.join(MODEL_DIR, 'X_val.npy'))    # 정상 + 불량
y_val   = np.load(os.path.join(MODEL_DIR, 'y_val.npy'))    # 0=정상, 1=불량

print(f"[데이터] X_train: {X_train.shape} / X_val: {X_val.shape} / y_val: 불량 {int(y_val.sum())}/{len(y_val)}")

# ── 1. Isolation Forest ──
print("\n[1/3] Isolation Forest 학습...")
clf_if = IsolationForest(
    n_estimators=200, contamination=0.01,
    random_state=42, n_jobs=-1
)
clf_if.fit(X_train)
score_if = -clf_if.score_samples(X_val)  # 양수 = 이상도

# ── 2. One-Class SVM ──
print("[2/3] One-Class SVM 학습...")
clf_ocsvm = OneClassSVM(
    nu=0.01, kernel='rbf', gamma='auto'
)
clf_ocsvm.fit(X_train)
score_ocsvm = -clf_ocsvm.score_samples(X_val)

# ── 3. LOF ──
print("[3/3] Local Outlier Factor (novelty mode) 학습...")
clf_lof = LocalOutlierFactor(
    n_neighbors=20, contamination=0.01,
    novelty=True, n_jobs=-1
)
clf_lof.fit(X_train)
score_lof = -clf_lof.score_samples(X_val)

# ── 임계값 결정 (각 모델: val 정상 99th percentile) ──
def find_threshold(scores, y, mode='99p'):
    if mode == '99p':
        return float(np.percentile(scores[y == 0], 99))
    return float(np.median(scores))

thr_if    = find_threshold(score_if,    y_val)
thr_ocsvm = find_threshold(score_ocsvm, y_val)
thr_lof   = find_threshold(score_lof,   y_val)

# ── 성능 평가 ──
def eval_baseline(scores, thr, name):
    pred = (scores >= thr).astype(int)
    auc  = roc_auc_score(y_val, scores)
    f1   = f1_score(y_val, pred, zero_division=0)
    rec  = recall_score(y_val, pred, zero_division=0)
    prec = precision_score(y_val, pred, zero_division=0)
    print(f"  {name:20s}  AUC={auc:.4f}  F1={f1:.4f}  Recall={rec:.4f}  Prec={prec:.4f}")
    return dict(auc=auc, f1=f1, recall=rec, precision=prec, threshold=thr)

print("\n[성능]")
m_if    = eval_baseline(score_if,    thr_if,    "IsolationForest")
m_ocsvm = eval_baseline(score_ocsvm, thr_ocsvm, "OneClassSVM")
m_lof   = eval_baseline(score_lof,   thr_lof,   "LOF")

# ── 저장 ──
joblib.dump({
    'isolation_forest': clf_if,
    'ocsvm':            clf_ocsvm,
    'lof':              clf_lof,
    'thresholds': {
        'isolation_forest': thr_if,
        'ocsvm':            thr_ocsvm,
        'lof':              thr_lof,
    },
}, os.path.join(MODEL_DIR, 'baselines.pkl'))

with open(os.path.join(RESULT_DIR, 'baseline_metrics.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'isolation_forest': m_if,
        'ocsvm':            m_ocsvm,
        'lof':              m_lof,
    }, f, indent=2, ensure_ascii=False)

print(f"\n[저장] {os.path.join(MODEL_DIR, 'baselines.pkl')}")
print(f"[저장] {os.path.join(RESULT_DIR, 'baseline_metrics.json')}")
print("\n다음 단계: app.py에서 다중 AI 신뢰도 미터 표시")
