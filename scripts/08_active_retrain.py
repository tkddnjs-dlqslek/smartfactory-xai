"""
Active Learning 재학습 스크립트
- 작업자가 라벨링한 anomaly_log.json의 true_label을 활용해 모델 재학습
- TP(진짜 이상) → 검증 셋 보강 / FP(오탐) → 학습 셋 추가 (정상으로 간주)
- 백업: 기존 모델은 models/active_backup/ 으로 이동
"""
import sys, os, json, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import torch
import joblib
from datetime import datetime

from src.config import MODEL_DIR, RESULT_DIR, SENSOR_COLS

# ── 1. 라벨 데이터 로드 ──
LOG_PATH = os.path.join(RESULT_DIR, 'anomaly_log.json')
if not os.path.exists(LOG_PATH):
    print("[중단] anomaly_log.json 없음 — 라벨 수집 후 재실행")
    sys.exit(1)

with open(LOG_PATH, encoding='utf-8') as f:
    log = json.load(f)

# 라벨된 샘플만 추출
labeled = [e for e in log if e.get('true_label', '미확인') != '미확인']
print(f"[로드] 전체 이력 {len(log)}건 / 라벨링된 샘플 {len(labeled)}건")

if len(labeled) < 30:
    print(f"[중단] 라벨 부족 ({len(labeled)}/30) — 더 수집 후 재실행")
    sys.exit(1)

# ── 2. 백업 ──
backup_dir = os.path.join(MODEL_DIR, f'active_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
os.makedirs(backup_dir, exist_ok=True)
for fname in ['autoencoder.pt', 'scaler.pkl', 'threshold.json']:
    src = os.path.join(MODEL_DIR, fname)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(backup_dir, fname))
print(f"[백업] {backup_dir}")

# ── 3. 라벨 통계 ──
tp = sum(1 for e in labeled if '진짜 이상' in e.get('true_label', ''))
fp = sum(1 for e in labeled if '오탐' in e.get('true_label', ''))
print(f"[통계] 진짜 이상 (TP) {tp}건 / 오탐 (FP) {fp}건")

# ── 4. 라벨 데이터를 재학습용 추가 셋으로 export ──
# 실제 재학습은 현장 데이터(원본 센서값)가 필요하지만,
# MVP 시연용으로는 라벨 통계만 저장
export_path = os.path.join(RESULT_DIR, 'active_learning_export.json')
with open(export_path, 'w', encoding='utf-8') as f:
    json.dump({
        'timestamp': datetime.now().isoformat(),
        'labeled_total': len(labeled),
        'tp': tp,
        'fp': fp,
        'next_action': 'merge into training set after operator verification',
        'samples': labeled,
    }, f, ensure_ascii=False, indent=2)

print(f"[저장] {export_path}")
print(f"\n[다음 단계]")
print(f"  1. FP 샘플의 원본 센서값을 정상 학습 데이터에 추가")
print(f"  2. TP 샘플의 원본 센서값을 검증 셋 불량에 추가")
print(f"  3. python scripts/01_train.py 재실행")
print(f"  4. python scripts/verify_model.py --record (해시 갱신)")
print(f"\n*MVP 시연용 — 본선에서 자동 파이프라인 구현 예정")
