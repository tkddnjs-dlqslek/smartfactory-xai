# SmartFactory XAI — 프로젝트 현황

> 자동 생성: 2026-05-19 00:39:52

## 모델 성능 (V2)

| 지표 | 값 | 목표 | 달성 |
|---|---|---|---|
| ROC-AUC   | 0.8986    | ≥ 0.80 | ✅ |
| PR-AUC    | 0.3986     | —      | — |
| F1-Score  | 0.3636         | —      | — |
| Recall    | 0.3210     | ≥ 0.70 | ❌ |
| Precision | 0.4194  | —      | — |
| 임계값    | 0.0088             | —      | — |

## 이상 원인 상위 센서 (SHAP)

1. **Filling Time** — 0.4394
2. **Injection Time** — 0.1574
3. **Max Switch Over Pressure** — 0.0937
4. **Cycle Time** — 0.0397
5. **Max Injection Speed** — 0.0267

## 비라벨 스코어링 현황

- 총 샷: 35,239건
- 이상 탐지: 26,209건 (74.37%)
- 정상: 9,030건

## 결과물 파일

| 파일 | 설명 |
|---|---|
| models/autoencoder.pt | V2 학습 모델 |
| models/scaler.pkl | StandardScaler |
| models/threshold.json | 임계값 0.0088 |
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