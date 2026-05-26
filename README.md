# SmartFactory XAI

**4-AI 합의 + SHAP 기반 사출성형 통합 운영 플랫폼**

> 2026 스마트 공장 운영 시스템 MVP 개발 해커톤 출품작
> 차세대융합기술연구원 메이커스페이스 · 데이콘 운영

KAMP 공공 사출성형 24센서 데이터를 활용해, 정상 데이터만 학습한 **4-AI 합의 모델**(Autoencoder + Isolation Forest + One-Class SVM + LOF)과 **GradientSHAP** 설명 기법으로 불량을 **탐지·진단·처방**하고, **품질·설비·안전·생산** 4축 운영을 하나의 대시보드에서 통합 관리합니다.

---

## 라이브 데모

| | URL | 상태 |
|---|---|---|
| 프론트엔드 (Vercel) | **[smartfactory-xai.vercel.app](https://smartfactory-xai.vercel.app)** | Live |
| 백엔드 (Render) | [smartfactory-xai-api.onrender.com/api/health](https://smartfactory-xai-api.onrender.com/api/health) | Live |
| 소스 코드 | [github.com/tkddnjs-dlqslek/smartfactory-xai](https://github.com/tkddnjs-dlqslek/smartfactory-xai) | — |

> Render 무료 플랜은 15분 유휴 시 슬립합니다. 데모 전 `/api/health`를 한 번 호출해 깨워주세요(첫 요청 30–50초 콜드스타트).

---

## 핵심 성능 (검증셋 1,379건 · KAMP CN7)

| 지표 | 값 | 95% Bootstrap CI |
|---|---|---|
| ROC-AUC | **0.9254** | [0.879, 0.966] |
| F1-Score | **0.7324** | [0.597, 0.835] |
| Precision (AE 단독) | 0.8125 | [0.656, 0.943] |
| Recall (AE 단독) | 0.6667 | [0.510, 0.805] |
| Recall (4-AI ≥1/4 합집합) | **0.7949** (31/39 탐지) | — |
| FP (4-AI ≥3/4 합의) | **5건** · Precision **0.844** | — |
| 임계값 τ | 0.3198 | 99-percentile + F1-optimal 평균 |

핵심: **단일 모델로는 거짓경보 多 → 4-AI 합의(≥3/4)로 FP를 31→5건, 정밀도 0.50→0.844로 끌어올림.**

---

## 무엇이 다른가

1. **4-AI 합의(앙상블 다양성)** — 서로 다른 가정의 모델 4종이 ≥3/4 동의해야 이상으로 판정. 단일 모델 알람 피로(거짓경보 무시 문제) 해결.
2. **2단계 판정** — 합의가 "이상 여부"를, AE 복원오차 비율이 **경고/위험/긴급** 심각도를 결정.
3. **인과 추적이 가능한 XAI** — GradientSHAP + Pearson 인과 그래프(24노드 / 173 엣지)로 "어떤 센서가 원인인지" 설명.
4. **AI 자가개선 어드바이저** — 모델 사각지대(예: 온도 계통 11건)를 Claude API가 자동 진단하고 **개선 코드(.ipynb)+계획서(.md)를 자동 생성**.
5. **한 엔진, 4축 운영** — 동일 추론 결과를 **품질·설비·안전·생산** 4개 운영 화면으로 분기.

---

## 데이터 흐름 — 무엇이 라이브이고 무엇이 사전 계산인가

플랫폼이 정직성을 지키기 위해 두 영역을 분리해 설계했습니다.

| 구성 | 입력 | 추론 | 비고 |
|---|---|---|---|
| Tab1 실시간 진단 (LIVE 스트림·시나리오) | 저장된 KAMP 샷 재생 | **매 요청 모델 forward** | 시뮬레이션 입력 + 실제 추론 |
| Tab1 What-if 슬라이더 | 사용자 입력 24센서 | **매 요청 모델 forward** | 완전 라이브 |
| Tab2 SHAP 인과 분석 | 선택된 샷 | **매 요청 GradientSHAP 계산** | 완전 라이브 |
| Tab3 τ 슬라이더 | 1,379샷 | 사전 저장된 점수 재분류 | 1,379번 재추론 비용 회피 |
| Tab3 헤드라인 지표 (ROC-AUC 등) | — | 학습 시점 평가 결과 | 평가 무결성 유지 |
| Tab5 안전 모니터링 | Tab1과 동기화 | Tab1 추론 결과 재사용 | 라이브 |
| AI 보고서·자가개선 | 현재 샷 | **매 요청 Claude API 호출** | 완전 라이브 |

즉 **시연의 메인(Tab1·Tab2)은 100% 라이브 추론**이고, Tab3의 정량 평가 지표만 검증 결과로 고정합니다 — 매번 재계산하면 부동소수점 오차로 헤드라인이 흔들리기 때문(보고서 관행).

데이터 자체는 모두 GitHub에 추적되어 있어 Render가 빌드 시 git clone으로 가져옵니다. 외부 DB·API 의존성 없음.

---

## 7개 탭 구성

| # | 탭 | 핵심 기능 |
|---|---|---|
| 01 | 랜딩 (`/`) | 문제 정의 + 데이터 흐름 + 4축 운영 진입 |
| 02 | 실시간 진단 (`/dashboard`) | 24센서 즉시 판정·What-if·라이브 스트림·AI 보고서 |
| 03 | 불량 원인 분석 (`/dashboard/cause`) | SHAP Waterfall·인과 그래프·AI 자가개선 어드바이저 |
| 04 | 전체 이력 분석 (`/dashboard/batch`) | 1,379샷 일괄 평가·혼동행렬·τ 슬라이더 |
| 05 | 모델 신뢰도 (`/dashboard/trust`) | ROC·PR·Bootstrap CI·앙상블 합의 분석 |
| 06 | 안전 위험 모니터링 (`/dashboard/safety`) | 과열·과압·기계 3계열 σ 기반 위험도 |
| 07 | 설비 예지정비 (`/dashboard/history`) | 정비 우선순위·온도 계통 사각지대 표시 |
| 08 | 생산 OEE (`/dashboard/production`) | 가동률 × 성능 × 양품률·불량 Pareto |

---

## 아키텍처

```
[KAMP 24센서] ─→ StandardScaler ─→ Autoencoder (24→16→8→16→24)
                                       ↓ 복원 오차
                                ┌──────┴──────┐
                                ↓             ↓
              τ=0.3198 판정               GradientSHAP
                                ↓             ↓
               ┌──────┬──────┬──────┐    Top-3 원인 센서
               ↓      ↓      ↓      ↓         ↓
               AE   IsoFor OCSVM   LOF    Pearson 인과 그래프
               └──────┴──┬───┴──────┘         ↓
                         ↓                   원인 추적
                  ≥3/4 합의 투표
                         ↓
              [품질·설비·안전·생산 4축 분기]
                         ↓
                  Claude API (NLG + 자가개선)
```

**판정 로직 (2단계):**
1. 4-AI 합의(≥3/4)가 **이상 여부** 결정
2. AE 복원오차/τ 비율이 **심각도** 결정: <1.5× 경고 / <2.5× 위험 / ≥2.5× 긴급

---

## 기술 스택

**프론트엔드**
- Next.js 14 (App Router) · TypeScript · React 18
- Vercel 무료 플랜 배포

**백엔드**
- FastAPI · Python 3.11
- PyTorch 2.3.1 (CPU 휠) · scikit-learn 1.2.2 · SHAP 0.48
- Render 무료 플랜 배포 (CPU only)

**AI**
- 4-AI 앙상블 (Autoencoder + Isolation Forest + One-Class SVM + LOF)
- GradientSHAP (XAI)
- Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`) — 자연어 보고서 + 자가개선 코드 생성

**데이터**
- KAMP 공공 사출성형 데이터 (공공데이터포털)
- 학습/검증: 1,379샷 · 39 불량(1.03%, 극심한 불균형)
- 24 센서 (시간·위치·압력·온도·속도 6계열)

---

## 빠른 시작 (로컬 실행)

### 사전 준비
- **Python 3.11** (Anaconda 권장 — 3.13은 SHAP segfault)
- **Node.js 18+** (프론트)
- 8GB RAM, CPU only

### 1. 클론·설치
```bash
git clone https://github.com/tkddnjs-dlqslek/smartfactory-xai.git
cd smartfactory-xai

# 백엔드
pip install -r backend/requirements.txt

# 프론트
cd web && npm install && cd ..
```

### 2. 환경변수 (선택 — AI 보고서·자가개선 사용 시)
프로젝트 루트에 `.env` 파일:
```
ANTHROPIC_API_KEY=sk-ant-...
```
키 없어도 핵심 기능(예측·SHAP·이상탐지·What-if)은 모두 작동하고, AI 보고서만 템플릿으로 폴백됩니다.

### 3. 두 서버 동시 실행
```bash
# 터미널 1 — 백엔드 (포트 8100)
uvicorn backend.main:app --host 127.0.0.1 --port 8100

# 터미널 2 — 프론트 (포트 3000)
cd web && npm run dev
```

`web/.env.local`에 `NEXT_PUBLIC_API_URL=http://127.0.0.1:8100` 이 들어있어야 합니다(기본값 포함).

브라우저 → `http://localhost:3000` 접속.

---

## 배포 (재현용)

상세 가이드: [DEPLOY.md](DEPLOY.md)

**Render 백엔드** — render.yaml Blueprint로 한 번에. GitHub 로그인 → New + → Blueprint → smartfactory-xai 선택 → Apply.

**Vercel 프론트** — Root Directory를 `web`으로 설정, 환경변수 `NEXT_PUBLIC_API_URL`에 Render URL 입력. 또는 Vercel CLI로:
```bash
cd web
vercel link --project smartfactory-xai
vercel env add NEXT_PUBLIC_API_URL production
vercel deploy --prod
```

CORS는 `*.vercel.app` 정규식 자동 허용 — 별도 등록 불필요.

---

## 검증 방법론

1. **Data Leakage 방지** — StandardScaler train fit only
2. **80/20 분할** — `random_state=42` 재현성 확보
3. **Bootstrap 95% CI** 1,000회 — 소표본 통계 신뢰도
4. **Pseudo Hold-out** — 불량 마지막 20건 분리
5. **Cross-Machine 외부 검증** — CN7 + RG3 별도 금형
6. **앙상블 다양성 분석** — 4-AI residual 직교성 확인

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
├── backend/                  # FastAPI 백엔드
│   ├── main.py               # API 엔트리포인트
│   ├── engine.py             # AE 추론 + 4-AI 합의
│   ├── report.py             # Claude NLG 보고서
│   ├── improve.py            # AI 자가개선 어드바이저
│   └── requirements.txt
├── web/                      # Next.js 14 프론트엔드
│   ├── app/                  # App Router 페이지 (7개 탭)
│   ├── components/parts.tsx  # 공통 UI 컴포넌트
│   ├── lib/api.ts            # 백엔드 API 클라이언트 + pub/sub 스토어
│   └── package.json
├── src/                      # 학습·평가 파이프라인
│   ├── model.py              # Autoencoder 정의
│   ├── trainer.py
│   ├── detector.py           # 임계값·판정
│   └── xai.py                # SHAP 연동
├── scripts/                  # 학습·평가·스코어링 스크립트
├── models/                   # 학습된 가중치 (autoencoder.pt, scaler.pkl, baselines.pkl)
├── results/                  # 평가 결과·SHAP 값·val_shots.json·val_scores.json
├── render.yaml               # Render Blueprint
├── DEPLOY.md                 # 배포 가이드
└── REPRODUCE.md              # 학습 재현 가이드
```

---

## 라이선스

- **소스 코드**: MIT
- **KAMP 데이터**: 공공데이터포털 라이선스 (상업적 이용 시 별도 확인)

---

## 팀

**김상원** · SmartFactory XAI
2026 스마트 공장 운영 시스템 MVP 개발 해커톤 · 2026-05-22
