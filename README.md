# SmartFactory XAI

**4-AI 합의 기반 사출성형 이상탐지 · 진단 · 처방 통합 플랫폼**

> 2026 스마트 공장 운영 시스템 MVP 개발 해커톤 출품작
> 차세대융합기술연구원 메이커스페이스 · 데이콘 운영

KAMP 공공 사출성형 24센서 데이터를 활용해, 정상 데이터만 학습한 **4-AI 합의 모델**(Autoencoder + Isolation Forest + One-Class SVM + Local Outlier Factor)과 **KernelSHAP** 설명 기법으로 불량을 탐지·진단·처방하는 통합 대시보드.

---

## 핵심 성능 (검증셋 1,379건)

| 지표 | 값 | 95% Bootstrap CI |
|---|---|---|
| ROC-AUC | **0.9254** | [0.879, 0.966] |
| Recall (AE 단독) | 0.6667 | [0.510, 0.805] |
| **Recall (4-AI 합집합)** | **0.7949** (31/39 탐지) | — |
| Precision | 0.8125 | [0.656, 0.943] |
| F1-Score | 0.7324 | [0.597, 0.835] |
| 임계값 | 0.3198 | 99th percentile + F1-optimal |

---

## 주요 기능 10개 (예선 단계 모두 구현 완료)

| # | 기능 | 위치 |
|---|---|---|
| 01 | AI 자동 이상탐지 (Autoencoder) | 모델 신뢰도 |
| 02 | 24센서 즉시 판정 (이상 점수 + 심각도) | 실시간 진단 |
| 03 | 데모 시나리오 4종 — 정상/경고/위험/긴급 (KAMP 실측 불량 #8/#27/#37) | 사이드바 |
| 04 | SHAP 24센서 기여도 (Waterfall + Bar) | 불량 원인 분석 |
| 05 | 처방 카드 24개 (조작 가능 / 정비 필요 자동 분류) | 실시간 진단 |
| 06 | 심각도 3단계 + 알람 에스컬레이션 | 실시간 진단 |
| 07 | 이상 이력 50건 + CSV·MD 다운로드 + JSON 영속 | 실시간 진단 |
| 08 | Bootstrap 95% CI + Cross-Machine 외부 검증 | 모델 신뢰도 |
| 09 | 검증셋 1,379건 일괄 스코어링 | 전체 이력 일괄 분석 |
| 10 | LIVE 디지털 트윈 (10초 스트리밍) | 사이드바 |

추가 차별화 5기능 — 다중 AI 합의 미터, What-if 시뮬레이터, AI 자연어 진단 보고서, Active Learning 트리거, 24센서 인과 그래프.

---

## 빠른 시작

### 사전 준비
- **Python 3.11** (Anaconda 권장 — 3.13은 SHAP segfault 발생)
- 8GB RAM, CPU만으로 충분 (GPU 불필요)

### 1. 설치 (Windows)
```bash
install.bat
```
또는 수동:
```bash
pip install -r requirements.txt
```

### 2. KAMP 데이터 다운로드
공공데이터포털 [data.go.kr/data/15089213](https://www.data.go.kr/data/15089213) 에서 사출성형 24센서 데이터셋을 받아 `../dataset/` 폴더에 배치.

필요 파일:
- `supervised_label_cn7.csv` (6,736행)
- `moldset_labeled_cn7.csv` · `moldset_labeled_rg3.csv` (외부 검증용)
- `moldset_labeled.csv` · `labeled_data.csv` (Scaler fit용)

### 3. 모델 학습 (선택 — 이미 `models/` 에 학습된 가중치 포함)
```bash
python scripts/01_train.py
python scripts/02_evaluate.py
```

### 4. 대시보드 실행
```bash
streamlit run app.py
```
또는 Windows에서 `run_dashboard.bat` 더블클릭. 브라우저에서 `http://localhost:8501` 접속.

---

## 아키텍처

```
입력 24센서 → StandardScaler → Autoencoder (24→16→8→16→24)
                                 ↓ 복원 오차
                            임계값 0.3198 판정
                                 ↓
            ┌────────────────────┼────────────────────┐
            ↓                    ↓                    ↓
        KernelSHAP        다중 AI 합의 (4모델)     처방 카드 24개
        (원인 진단)        AE+IF+OCSVM+LOF        (조작/정비 자동)
            ↓
        Waterfall 차트
        센서 인과 그래프
```

---

## 검증 방법론

1. **StandardScaler** train fit only (data leakage 방지)
2. **80/20 분할** (random_state=42, 재현성)
3. **Bootstrap 95% CI** 1,000회 (소표본 통계 신뢰도)
4. **Pseudo Hold-out** (불량 마지막 20건 분리)
5. **Cross-Machine 외부 검증** (CN7 + RG3 별도 금형)
6. **다중 AI 합의** (Recall 0.667 → 0.795, +5건 회복)

---

## 학술 레퍼런스

1. MDPI Processes 13(3), 912 (2025) — KAMP 직접 비교 (XGBoost + XAI)
2. arXiv:2511.08108 (2025) — LSTM + SHAP/Grad-CAM/LIME, F1=0.92
3. Brito et al. MAKE 6(1), 16 (2024) — SHAP 베어링 진단 98.5%
4. PhysiCausalNet IEEE TII (2024) — Cross-Machine FD
5. EWAD-IIoT WGAN (Sci. Reports 2025) — Bootstrap 95% CI 정당성
6. Survey arXiv:2503.13195 (2025) — Deep AD 종합 서베이
7. Ketonen & Blech ICPS (2021) — VAE+RNN 사출성형 root-cause

---

## 디렉토리 구조

```
smart_factory_xai/
├── app.py                  # Streamlit 메인 대시보드 (5탭)
├── src/
│   ├── config.py           # 경로·상수
│   ├── data_loader.py      # KAMP 데이터 로딩
│   ├── model.py            # Autoencoder 정의
│   ├── trainer.py
│   ├── detector.py         # 임계값·판정
│   └── xai.py              # SHAP 연동
├── scripts/                # 학습·평가·스코어링·SHAP 사전 계산
├── models/                 # 학습된 가중치 (autoencoder.pt, scaler.pkl)
├── results/                # 평가 결과·차트·SHAP 값
├── output/                 # PPT/PDF 산출물
├── assets/                 # 대시보드 CSS
├── REPRODUCE.md            # 7단계 재현 가이드
└── 발표_가이드.md           # 5분 시연 코스
```

---

## 라이선스

본 프로젝트는 해커톤 출품작으로, 평가 및 학습 목적으로 공개합니다.
- **소스 코드**: MIT
- **KAMP 데이터**: 공공데이터포털 라이선스 준수 (상업적 이용 시 별도 확인)

---

## 팀

**김상원** · SmartFactory XAI
2026 스마트 공장 운영 시스템 MVP 개발 해커톤
