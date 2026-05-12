# 재현 가이드 — SmartFactory XAI 이상탐지 플랫폼

## 환경 요구사항

| 항목 | 버전 |
|------|------|
| Python | **3.11** (필수 — 3.13은 PyTorch segfault 발생) |
| OS | Windows 10/11 또는 Linux |
| CUDA | 선택 (CPU 전용으로도 동작) |

Anaconda 환경 사용 권장:
```bash
conda create -n smf python=3.11
conda activate smf
pip install -r requirements.txt
```

---

## 데이터 배치

`dataset/` 디렉토리에 아래 파일을 배치하세요 (KAMP 공공데이터포털 다운로드):

| 파일 | 행 수 | 용도 |
|------|-------|------|
| `supervised_label_cn7.csv` | 6,736 | 학습/검증 (라벨 포함, z-score 완료) |
| `moldset_labeled_cn7.csv` | 1,211 | 학습/검증 (라벨 포함, z-score 완료) |
| `moldset_labeled_rg3.csv` | 1,182 | 학습/검증 (라벨 포함, z-score 완료) |
| `moldset_labeled.csv` | 2,607 | Scaler 학습용 (raw 스케일) |
| `labeled_data.csv` | 7,996 | Scaler 학습용 (raw 스케일) |
| `unlabeled_data.csv` | 795,315 | 대규모 스코어링용 |

---

## 실행 순서 (반드시 순서 준수)

모든 명령어는 `smart_factory_xai/` 루트에서 실행합니다.

### Step 1 — 모델 학습
```bash
python scripts/01_train.py
```
- 출력: `models/autoencoder.pt`, `models/scaler.pkl`, `models/X_val.npy`, `models/y_val.npy`
- 소요 시간: CPU 약 3~5분 / GPU 약 1분

**데이터 분할 상세** (재현성 핵심):
```python
# src/data_loader.py prepare_train_val()
# 정상 데이터만 80/20 분리 (random_state=42)
X_train_raw, X_val_normal_raw = train_test_split(normal, test_size=0.2, random_state=42)
# Scaler는 train 데이터로만 fit (leakage 없음)
# Val set = 정상 ~1,810건 + 불량 전체 81건
# DataLoader 미사용 (numpy 직접 처리) → DataLoader shuffle seed 불필요
```

### Step 2 — 성능 평가 + 임계값 결정
```bash
python scripts/02_evaluate.py
```
- 출력: `results/metrics.json` (ROC-AUC, F1, Recall, Precision, threshold)
- 출력: `results/*.png` (ROC curve, PR curve, 오차 분포)

### Step 3 — 비라벨 데이터 대규모 스코어링
```bash
python scripts/03_score_unlabeled.py
```
- 출력: `results/scored_unlabeled.parquet` (795,315행 × recon_error)
- 소요 시간: CPU 약 10~20분

### Step 4 — SHAP 사전 계산
```bash
python scripts/04_compute_shap.py
```
- 출력: `results/shap_values.npy`, `results/shap_top500.npy`
- 소요 시간: CPU 약 5~15분 (KernelSHAP 50개 배경 샘플)
- **배경 샘플**: 학습 정상 샘플(anomaly-free)만 사용 → K-Means 50개 대표점으로 압축
  - 정상 샘플만 사용하는 이유: 이상 샘플이 배경에 섞이면 SHAP baseline이 오염되어 설명력 저하

### Step 5 — Bootstrap CI 계산
```bash
python scripts/06_bootstrap_ci.py
```
- `results/metrics.json`에 95% 신뢰구간 추가 (1,000회 반복, seed=42)
- 출력 예시: `ROC-AUC 95%CI: [0.8793, 0.9659]`

### Step 6 — 대시보드 실행
```bash
C:/anaconda/python.exe -m streamlit run app.py
```
또는 (conda 활성화 후):
```bash
streamlit run app.py
```
- 브라우저: http://localhost:8501

### Step 7 — PPT 생성 (선택)
```bash
python scripts/generate_ppt.py
```
- 출력: `output/스마트공장XAI_예선기획서.pptx`

---

## 재현성 설정

모든 스크립트에 아래 seed가 고정되어 있습니다:
- `random_state=42` (scikit-learn, pandas sampling)
- `numpy.random.seed(42)` / `np.random.default_rng(42)` (Bootstrap)
- `torch.manual_seed(42)` (PyTorch 모델 초기화)

**GPU 환경 추가 설정** (비결정성 제거):
```python
import torch
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False
```

---

## 기대 결과값

| 지표 | 값 | 95% CI |
|------|-----|--------|
| ROC-AUC | 0.9254 | [0.879, 0.966] |
| F1-Score | 0.7324 | [0.597, 0.835] |
| Recall | 0.6667 | [0.510, 0.805] |
| Precision | 0.8125 | [0.656, 0.943] |
| 임계값 | 0.3198 | — |

> **Circular Evaluation 안내**: 임계값은 검증셋으로 결정하고 동일 검증셋에서 F1을 측정합니다.
> 불량 39건 소표본 특성상 별도 hold-out 분리가 어렵습니다.
> CI 폭이 넓은 이유이며, 추가 데이터 수집 시 개선됩니다.

## 외부 기계 검증 (Cross-Machine Generalization)

학습에 전혀 사용하지 않은 별도 금형 세트 데이터로 모델 일반화 능력을 검증합니다.
대시보드 Tab 1 → "평가 방법론 및 주의사항" 확장 시 자동 계산됩니다.

| 데이터셋 | 파일 | 샘플 수 | 불량 수 |
|---|---|---|---|
| CN7 금형 세트 | `moldset_labeled_cn7.csv` | 1,211 | 17 |
| RG3 금형 세트 | `moldset_labeled_rg3.csv` | 1,182 | 25 |

학습 데이터: `supervised_label_cn7.csv` 단일 파일 (V2 모델)
→ 위 두 파일은 완전히 별도 기계 데이터 — Circular Evaluation 없는 진정한 외부 검증

---

## 최소 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|-----------|-----------|
| OS | Windows 10 64-bit | Windows 11 / Ubuntu 20.04+ |
| RAM | **8 GB** (불량 샘플 적어 학습 경량) | 16 GB (비라벨 795K 스코어링 시) |
| CPU | 4코어 / 2.0GHz 이상 | 8코어 이상 |
| 디스크 | 5 GB (모델+데이터+결과) | 10 GB |
| GPU | 불필요 (CPU 전용 동작) | CUDA 12.x (Step 1 학습 3배 단축) |
| Python | **3.11** (3.13 segfault) | 3.11 |

> 공장 현장 PC 보급형(RAM 8 GB, i5 이상)에서 정상 동작 확인됨.

---

## 공장 네트워크 배포 (온프레미스)

**공정 데이터는 외부로 전송되지 않습니다** — 모든 처리는 로컬에서 완결됩니다.

### 단일 PC (로컬 전용)
```bash
streamlit run app.py --server.port 8501
```
접속: `http://localhost:8501` (해당 PC에서만)

### 사내망 다수 PC 접근 (공장 내 서버)
```bash
streamlit run app.py --server.port 8501 --server.address 0.0.0.0
```
접속: `http://<서버IP>:8501` (사내망 PC에서 접근 가능)

> **방화벽 주의**: 8501 포트를 사내망 대역(예: 192.168.x.x)에만 허용하세요.

### 보안 점검 체크리스트 (운영 전 확인)

- [ ] Streamlit 서버가 인터넷(WAN)에 노출되지 않도록 방화벽 설정
- [ ] `models/autoencoder.pt` 파일 원본 SHA-256 해시 기록 (교체 감지용)
- [ ] `results/anomaly_log.json` 정기 백업 (ISO 9001 이력 보존)
- [ ] 접근 가능 IP 대역 방화벽 화이트리스트 제한

### autoencoder.pt 무결성 검증

```bash
# 최초 배포 시 해시 기록
python -c "import hashlib; print(hashlib.sha256(open('models/autoencoder.pt','rb').read()).hexdigest())"

# 이후 실행 전마다 비교 (값이 다르면 파일 교체 의심)
python -c "import hashlib; print(hashlib.sha256(open('models/autoencoder.pt','rb').read()).hexdigest())"
```

---

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| `segmentation fault` | Python 3.13 → 3.11로 교체 |
| `ModuleNotFoundError: torch` | `pip install torch>=2.6.0` |
| `FileNotFoundError: scored_unlabeled.parquet` | Step 3 먼저 실행 |
| `UnicodeDecodeError` | `encoding='utf-8'` 명시 또는 Windows cmd 대신 conda 프롬프트 사용 |
| Streamlit 포트 충돌 | `streamlit run app.py --server.port 8502` |
| 메모리 부족 (Step 3) | RAM 8 GB 미만 → `scored_unlabeled.parquet` 청크 처리: `03_score_unlabeled.py` 내 `CHUNK_SIZE` 줄이기 |
