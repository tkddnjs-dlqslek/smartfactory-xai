"""
results/metrics.json이 업데이트될 때마다 자동으로 PROJECT_STATUS.md를 갱신.
02_evaluate.py 마지막에서 호출됨.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
from datetime import datetime
from src.config import MODEL_DIR, RESULT_DIR

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUS_OUT = os.path.join(BASE_DIR, 'PROJECT_STATUS.md')
MEMORY_OUT = r"C:\Users\user\.claude\projects\c--Users-user\memory\project_hackathon_factory.md"

def load_metrics():
    path = os.path.join(RESULT_DIR, 'metrics.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def load_shap_top():
    path = os.path.join(RESULT_DIR, 'shap_values.npy')
    if not os.path.exists(path):
        return []
    from src.config import SENSOR_COLS
    sv   = np.load(path)
    ma   = np.abs(sv).mean(axis=0)
    idx  = np.argsort(ma)[::-1][:5]
    return [(SENSOR_COLS[i], float(ma[i])) for i in idx]

def load_scored_stats():
    path = os.path.join(RESULT_DIR, 'scored_unlabeled.parquet')
    if not os.path.exists(path):
        return None
    import pandas as pd
    df = pd.read_parquet(path)
    thr_path = os.path.join(MODEL_DIR, 'threshold.json')
    thr = json.load(open(thr_path))['value']
    anom = (df['recon_error'] >= thr).sum()
    return {'total': len(df), 'anomaly': int(anom), 'rate': anom/len(df)*100}

def write_status():
    m    = load_metrics()
    shap = load_shap_top()
    sc   = load_scored_stats()
    now  = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if m is None:
        print("metrics.json 없음 — 스킵")
        return

    thr  = m.get('threshold', 0.0)
    lines = [
        f"# SmartFactory XAI — 프로젝트 현황",
        f"",
        f"> 자동 생성: {now}",
        f"",
        f"## 모델 성능 (V2)",
        f"",
        f"| 지표 | 값 | 목표 | 달성 |",
        f"|---|---|---|---|",
        f"| ROC-AUC   | {m['roc_auc']:.4f}    | ≥ 0.80 | {'✅' if m['roc_auc']>=0.80 else '❌'} |",
        f"| PR-AUC    | {m['pr_auc']:.4f}     | —      | — |",
        f"| F1-Score  | {m['f1']:.4f}         | —      | — |",
        f"| Recall    | {m['recall']:.4f}     | ≥ 0.70 | {'✅' if m['recall']>=0.70 else '❌'} |",
        f"| Precision | {m['precision']:.4f}  | —      | — |",
        f"| 임계값    | {thr:.4f}             | —      | — |",
        f"",
    ]

    if shap:
        lines += [
            f"## 이상 원인 상위 센서 (SHAP)",
            f"",
        ]
        for rank, (col, val) in enumerate(shap, 1):
            lines.append(f"{rank}. **{col.replace('_',' ')}** — {val:.4f}")
        lines.append("")

    if sc:
        lines += [
            f"## 비라벨 스코어링 현황",
            f"",
            f"- 총 샷: {sc['total']:,}건",
            f"- 이상 탐지: {sc['anomaly']:,}건 ({sc['rate']:.2f}%)",
            f"- 정상: {sc['total']-sc['anomaly']:,}건",
            f"",
        ]

    lines += [
        f"## 결과물 파일",
        f"",
        f"| 파일 | 설명 |",
        f"|---|---|",
        f"| models/autoencoder.pt | V2 학습 모델 |",
        f"| models/scaler.pkl | StandardScaler |",
        f"| models/threshold.json | 임계값 {thr:.4f} |",
        f"| results/metrics.json | 평가 지표 |",
        f"| results/scored_unlabeled.parquet | 35K 스코어링 |",
        f"| results/shap_values.npy | SHAP 값 |",
        f"",
        f"## 실행 명령",
        f"",
        f"```bash",
        f"# 전체 파이프라인",
        f"C:/anaconda/python.exe scripts/01_train.py",
        f"C:/anaconda/python.exe scripts/02_evaluate.py   # 자동으로 이 파일 갱신",
        f"C:/anaconda/python.exe scripts/03_score_unlabeled.py",
        f"C:/anaconda/python.exe scripts/04_compute_shap.py",
        f"C:/anaconda/python.exe -m streamlit run app.py --server.port 8501",
        f"```",
    ]

    with open(STATUS_OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"PROJECT_STATUS.md 갱신 → {STATUS_OUT}")

    # memory 파일도 업데이트
    try:
        mem_content = f"""---
name: 2026 스마트 공장 해커톤 — XAI 이상탐지 플랫폼
description: 사출성형기 이상탐지 + SHAP XAI 해커톤 프로젝트 현황 및 기술 결정사항
type: project
---

# 2026 스마트 공장 운영 시스템 MVP 개발 해커톤

**예선 제출 마감: 2026-05-13 (PPT 기획서 제출)**
**마지막 자동 갱신: {now}**

## 디렉토리
- 프로젝트: `C:/Users/user/Desktop/2026 스마트 공장 운영 시스템 MVP 개발 해커톤/smart_factory_xai/`
- 데이터셋: `../dataset/` (프로젝트 기준 상위)

## 실행 환경
- **Python**: `C:/anaconda/python.exe` (Python 3.11) — Python 3.13은 MINGW NumPy segfault로 사용 불가
- **Streamlit 실행**: `C:/anaconda/python.exe -m streamlit run app.py --server.port 8501`

## V2 모델 현황
- ROC-AUC={m['roc_auc']:.4f}, PR-AUC={m['pr_auc']:.4f}, F1={m['f1']:.4f}, Recall={m['recall']:.4f}, Precision={m['precision']:.4f}
- 임계값: {thr:.4f}
- 학습 데이터: `supervised_label_cn7.csv` 단일 파일 (6,697 정상행)
- **V1 백업**: `models/v1_backup_autoencoder.pt` 등

## 핵심 기술 결정사항
1. **단일 파일 학습**: 3개 파일 혼합 시 raw/z-score 불일치 → V2는 supervised_label_cn7.csv만 사용
2. **비라벨 스코어링**: moldset_unlabeled_cn7.csv(35,239행) 사용
3. **SHAP 상위 원인**: {', '.join(f'{c}({v:.2f})' for c,v in shap[:3]) if shap else 'N/A'}

## 완료된 결과물
- `results/`: 모든 차트 + metrics.json + scored_unlabeled.parquet + shap 파일
- `app.py`: Streamlit 5탭 대시보드 (탐지→진단→처방→추적 커버)
- `landing_education.md`: 사용자 교육 자료
- `PROJECT_STATUS.md`: 자동 생성 현황 보고서

## 남은 작업
- [ ] PPT 기획서 작성 (8장 이상, PDF 제출, 마감 2026-05-13)

## Why
2026 해커톤 예선 통과 + AI 엔지니어 포트폴리오. 반지도학습 + XAI 조합이 차별점.
"""
        if os.path.exists(os.path.dirname(MEMORY_OUT)):
            with open(MEMORY_OUT, 'w', encoding='utf-8') as f:
                f.write(mem_content)
            print(f"Memory 갱신 → {MEMORY_OUT}")
    except Exception as e:
        print(f"Memory 갱신 실패 (무시): {e}")

if __name__ == '__main__':
    write_status()
    print("완료!")
