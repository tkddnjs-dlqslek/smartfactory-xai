# SmartFactory XAI — 프로젝트 현황

> 자동 생성: 2026-05-02 10:39:52

## 모델 성능 (V2)

| 지표 | 값 | 목표 | 달성 |
|---|---|---|---|
| ROC-AUC   | 0.9254    | ≥ 0.80 | ✅ |
| PR-AUC    | 0.7080     | —      | — |
| F1-Score  | 0.7324         | —      | — |
| Recall    | 0.6667     | ≥ 0.70 | ❌ |
| Precision | 0.8125  | —      | — |
| 임계값    | 0.3198             | —      | — |

## 이상 원인 상위 센서 (SHAP)

1. **Filling Time** — 21.0203
2. **Injection Time** — 7.1100
3. **Max Switch Over Pressure** — 2.9099
4. **Max Injection Speed** — 2.7697
5. **Cycle Time** — 1.3664

## 비라벨 스코어링 현황

- 총 샷: 35,239건
- 이상 탐지: 2건 (0.01%)
- 정상: 35,237건

## 결과물 파일

| 파일 | 설명 |
|---|---|
| models/autoencoder.pt | V2 학습 모델 |
| models/scaler.pkl | StandardScaler |
| models/threshold.json | 임계값 0.3198 |
| results/metrics.json | 평가 지표 |
| results/scored_unlabeled.parquet | 35K 스코어링 |
| results/shap_values.npy | SHAP 값 |

## 실행 명령

```bash
# 전체 파이프라인
C:/anaconda/python.exe scripts/01_train.py
C:/anaconda/python.exe scripts/02_evaluate.py   # 자동으로 이 파일 갱신
C:/anaconda/python.exe scripts/03_score_unlabeled.py
C:/anaconda/python.exe scripts/04_compute_shap.py
C:/anaconda/python.exe -m streamlit run app.py --server.port 8501
```