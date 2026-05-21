# SmartFactory XAI — Product Requirements Document (PRD)

> Claude design 전달용 · 본선 진출 후 디자인 시스템 정립용
> 2026 스마트 공장 운영 시스템 MVP 해커톤 본선 (2026-05-22)

---

## 1. 제품 개요

**제품명**: SmartFactory XAI
**세부 주제**: 품질 이상 예측 및 불량률 개선 플랫폼 (KAMP 사출성형 24센서 기반)
**한 줄 소개**: 4-AI 합의 + KernelSHAP 설명 기법으로 사출성형 불량을 탐지·진단·처방까지 한 화면에 통합한 품질 개선 플랫폼

### 핵심 가치 제안
- **탐지 → 진단 → 처방 → 추적** 4단계를 한 시스템에서 자동화
- **ROC-AUC 0.9254 / Recall 0.7949 / Precision 0.8125** (실측, KAMP 검증셋 1,379건)
- 평가위원 어필 포인트: ① 공개 KAMP 데이터 ② 비지도 + KernelSHAP ③ Cross-Machine + Bootstrap CI ④ 24개 처방 통합

---

## 2. 타깃 사용자 (Personas)

| 페르소나 | 역할 | 사용 빈도 | 주요 화면 | 핵심 액션 |
|---|---|---|---|---|
| **작업자 (Operator)** | 사출성형 3교대 현장 작업자 | 상시 (실시간) | 실시간 진단 | 이상 알람 확인 → 처방 카드 → 즉시 조치 |
| **반장 (Foreman)** | 라인 관리자 | 매 교대 (8시간) | 실시간 진단 + 이상 이력 | 50건 이력 점검 → CSV 다운로드 → 인수인계 |
| **부서장 (Manager)** | 생산기술 부서장 | 일·월 | 생산 이력 + 일일 리포트 | 트렌드 분석 → 정비 권고 → 월 KPI 보고 |

### 사용자 시나리오 — 5분 데모 코스
1. **사이드바** → 데모 시나리오 (정상/경고/위험/긴급, 모두 KAMP 실측 불량 #8/#27/#37 재현) → 1클릭 적용
2. **실시간 진단 탭** → 빨간 DANGER 배너 + 다중 AI 합의 미터 + 처방 카드 자동 표시
3. **불량 원인 분석 탭** → SHAP Top-5 막대 차트 → 어떤 센서가 원인인지 정량 분해
4. **모델 신뢰도 탭** → ROC Curve + Bootstrap CI + 합의 알고리즘 비교 표
5. **사이드바 LIVE 모드 ON** → 검증셋 1,379건 자동 스트리밍 재생 (10초 간격)

---

## 3. 핵심 기능 (Features)

### MVP 핵심 5기능 (예선 단계 모두 구현 완료)
1. **F1. AI 자동 이상탐지** — Autoencoder (24→16→8→16→24), ROC-AUC 0.9254
2. **F2. SHAP 24센서 원인 진단** — KernelSHAP, Top-5 자동 도출
3. **F3. 처방 카드 24개** — 센서별 처방, 조작 가능 / 정비 필요 자동 분류
4. **F4. 심각도 3단계 + 알람** — 경고 / 위험 / 긴급, 작업자 → 반장 → 부서장 에스컬레이션
5. **F5. 교대 인수인계 자동화** — 이상 이력 50건 + CSV·MD 다운로드 + JSON 영속

### 차별화 5기능 (F6~F10)
6. **F6. 다중 AI 합의** — Autoencoder + Isolation Forest + One-Class SVM + LOF (Recall 0.6667 → 0.7949)
7. **F7. LIVE 디지털 트윈** — 검증셋 1,379건 10초 스트리밍 (본선 OPC-UA 동치 시연)
8. **F8. What-if 시뮬레이터** — Counterfactual ("얼마나 고쳐야 정상이 되나" 자동 계산)
9. **F9. AI 자연어 진단 보고서** — 부서장·반장 보고용 Markdown 자동 생성
10. **F10. Active Learning** — 라벨 30건 누적 시 모델 재학습 트리거 (Feedback Loop)

### 본선 1일 추가 구현 (P1~P5)
- P1. OPC-UA / MQTT 실시간 PLC 연동
- P2. SMS / 이메일 알람 자동화
- P3. 멀티 설비 모델 관리
- P4. 예측 정비 (Predictive Maintenance)
- P5. AWS 클라우드 옵션

---

## 4. 화면 구조 (Information Architecture)

```
┌─ Sidebar (280px) ────────────────────────────────────────┐
│  설정                                                      │
│   ├─ 설비 선택 (사출성형기 #1)                              │
│   ├─ 데모 시나리오 (정상/경고/위험/긴급)                     │
│   └─ 🔴 디지털 트윈 LIVE 토글                              │
├─ Main Tabs (5) ──────────────────────────────────────────┤
│  [1] 실시간 진단                                            │
│      ├─ 운영 모드 선택 (균형/탐지우선/정밀)                  │
│      ├─ 센서값 입력 (24 슬라이더, 5그룹)                    │
│      ├─ 판정 결과 (배너 + 다중 AI 미터 + 게이지)             │
│      ├─ 대응 권고 (Top-3 처방 카드)                         │
│      ├─ σ 이탈 차트                                        │
│      ├─ What-if 시뮬레이터                                  │
│      ├─ AI 자연어 진단 보고서                               │
│      └─ 이상 감지 이력 (Active Learning 라벨링)            │
│  [2] 불량 원인 분석 (SHAP)                                  │
│      ├─ 센서별 평균 SHAP 기여도 (Top-5 빨강 / Top-6~10 시안) │
│      ├─ 상위 5 이상 원인 센서 카드                          │
│      ├─ 개별 샘플 SHAP Waterfall                           │
│      ├─ 24센서 인과 그래프                                  │
│      └─ 불량 패턴 PCA 클러스터                              │
│  [3] 전체 이력 일괄 분석                                    │
│      ├─ 복원 오차 시계열                                    │
│      └─ 이상 오차 상위 20건                                 │
│  [4] 생산 이력                                              │
│      ├─ 장비 건강도 스코어카드 (7개)                        │
│      ├─ 복원 오차 시계열 (1,379샷 전체)                    │
│      ├─ 구간별 이상률 (100샷 단위 바 차트)                  │
│      └─ Top 10 이상 집중 구간 표                           │
│  [5] 모델 신뢰도 확인                                       │
│      ├─ 5 KPI 스코어카드 (ROC/PR/F1/Recall(4-AI)/Precision) │
│      ├─ 오차 분포 + ROC + PR + Confusion Matrix            │
│      ├─ AI 모델 구조 (Autoencoder 다이어그램)              │
│      ├─ 검증 데이터셋 구성                                  │
│      ├─ 학습 곡선                                          │
│      ├─ 가설 검증 (Mann-Whitney U)                         │
│      ├─ 임계값 민감도 + Cost-Sensitive Threshold (Q3)      │
│      └─ 비용 기반 의사결정 프레임                           │
└──────────────────────────────────────────────────────────┘
```

---

## 5. 디자인 토큰 (현재 적용 중)

### 컬러 시스템 — 다크 인더스트리얼
```css
/* 배경 계층 */
--bg:        #080808;   /* 최외곽 */
--card:      #111111;   /* 카드 배경 */
--card2:     #1A1A1A;   /* 보조 카드 */

/* 텍스트 */
--text:      #EFEFEF;   /* 본문 */
--dim:       #AEAEAE;   /* 부가 정보 */
--muted:     #6B6B6B;   /* 비활성 */

/* 시그널 (위험·강조 — 절제) */
--red:       #D42121;   /* 위험·알람 전용 */
--red-bg:    rgba(212,33,33,0.12);
--accent:    #00D4FF;   /* 강조·AI 점수 */
--ok:        #4CAF50;   /* 정상 (최소 사용) */
--warn:      #FFA500;   /* 경고 */

/* 구분선 */
--border:    #1A1A1A;
--grid:      #222222;
```

### 타이포그래피
```
Primary:   Pretendard (한글), Inter (영문)
Mono:      JetBrains Mono (수치, 코드)

H1 (탭):    1.05rem, weight 700, letter-spacing -0.01em
H2 (sec):   0.67rem, weight 600, uppercase, letter-spacing 0.10em
KPI 값:     1.4rem, weight 700, Mono
KPI 라벨:   0.65rem, weight 600, uppercase, letter-spacing 0.09em
본문:       0.82rem, weight 500
캡션:       0.72rem, weight 400, color: dim
```

### 컴포넌트
- **카드**: `1px solid #1A1A1A` 보더, `border-radius: 6px`, no shadow
- **버튼**: 검은 텍스트 + 흰 배경, `border-radius: 5px`, 호버 시 opacity 0.85
- **배지 (pill)**: `border-radius: 3px`, `font-size: 0.67rem`, uppercase
- **탭**: 하단 2px 빨간 underline (활성), 회색 텍스트 (비활성)
- **슬라이더**: 트랙 회색, 핸들 빨강
- **데이터프레임**: 1px 보더, 헤더 카드 톤, 본문 모노 폰트

### 디자인 원칙
1. **무채색 기본** — 빨강·시안은 위험·정보 강조 전용
2. **데이터 밀도 높지만 위계 명확** — 큰 KPI 숫자 + 작은 부연
3. **둥근 모서리 최소화** — `border-radius: 0~6px`
4. **그라데이션·그림자 없음** — 산업미 (NASA mission control 톤)
5. **이모지 절제** — 위험 상황 (🚨, 🔴, ⚠) 만 사용

---

## 6. 인터랙션 패턴

- **이상 감지 시 자동 노출**: 정상일 땐 회색 톤, 이상이면 빨간 알람 + 처방 카드 자동 등장
- **운영 모드 전환**: 한 클릭으로 임계값 ×0.75 / ×1.0 / ×1.35 자동 조정
- **데모 시나리오 1클릭**: 24개 슬라이더가 KAMP 실측 불량 패턴으로 자동 세팅
- **LIVE 모드**: 토글 ON 시 검증셋 1,379건이 10초 간격으로 자동 재생
- **다운로드**: 이상 이력 CSV (교대 인수인계용), 일일 리포트 MD (부서장 보고용)

---

## 7. 본선 발표용 핵심 메시지

> **"기존 솔루션이 '이상하다'에서 멈출 때, 우리는 '왜·얼마나 바꿔야·어떻게 보고할지'까지 답합니다."**

### 정직성 어필 포인트
- "7가지 합의 알고리즘 모두 실험" → 단순 4-AI 엄격 규칙 (F1 0.7606)이 Stacking (F1 0.6914)보다 우위라는 결과를 그대로 공개
- Bootstrap 95% CI 1,000회로 소표본 한계 정량 공개
- Cross-Machine 외부 검증 (CN7 AUC 0.83, RG3 0.42)을 정직히 노출 — RG3는 일반화 안 됨

### 차별화 4가지
1. 공개 KAMP 데이터 (재현성)
2. 비지도 + KernelSHAP (라벨 없이 설명 가능)
3. Cross-Machine + Bootstrap CI (통계 검증)
4. 24개 처방 통합 (탐지+원인+조치 단일 화면)

---

# 🚀 배포 전략: Streamlit vs Vercel

## 결론: **현재는 Streamlit 유지, 본선 후 Next.js + Vercel 마이그레이션** 권장

### 비교 분석

| 항목 | Streamlit (현재) | Next.js + Vercel | 결론 |
|---|---|---|---|
| **본선 시연 (5/22 하루)** | 로컬 실행 즉시 | 배포 + 데이터 연결 필요 | ✅ Streamlit |
| **개발 속도** | Python만 (1인 가능) | TS + Python API 분리 (2인 권장) | ✅ Streamlit |
| **AI 통합** | PyTorch/SHAP/sklearn 네이티브 | Python API → fetch (지연 + 보안) | ✅ Streamlit |
| **인터랙티브 차트** | Plotly (네이티브) | Plotly.js 또는 Recharts | 동급 |
| **상태 관리** | session_state (간단) | Zustand / Jotai (강력) | ✅ Next.js |
| **모바일 반응형** | 제한적 (수직 스택만) | 완전 제어 | ✅ Next.js |
| **인증·권한 분리** | 외부 라이브러리 의존 | NextAuth 등 풍부 | ✅ Next.js |
| **다국어 (i18n)** | 수동 | next-intl 즉시 | ✅ Next.js |
| **SEO·공유** | SSR 약함 | SSR/ISR 완비 | ✅ Next.js |
| **배포 비용** | 자체 호스팅 또는 Streamlit Cloud (제한) | Vercel 무료 (개인) | ✅ Next.js |
| **다중 사용자 동시 접속** | 한 번에 1세션 (병목) | 무제한 (Edge functions) | ✅ Next.js |
| **현재 코드 재사용** | 100% | 0% (재작성 필요) | ✅ Streamlit |

### 단계별 권장 경로

#### **Phase 1: 본선 (2026-05-22) — Streamlit 유지** ⭐
- 5/22 단 하루에 P1~P5 추가 구현 + 시연 리허설
- Next.js 재작성은 8시간 안에 불가능
- 평가위원이 평가하는 건 **AI 활용 + MVP 구현**이지 UI 프레임워크 X
- 현재 Streamlit 대시보드는 이미 5탭 풀 기능 + Pretendard 디자인 시스템 적용 완료

#### **Phase 2: 본선 후 (PoC 단계, 1~2개월) — Next.js + Vercel 마이그레이션**
**아키텍처**:
```
┌─ Next.js (Vercel) — Frontend ──────────────────────────┐
│  ├─ /dashboard            (5탭 UI)                      │
│  ├─ /api/predict          (모델 추론 프록시)             │
│  ├─ /api/shap             (XAI 결과)                    │
│  └─ /api/history          (이상 이력 CSV/MD)            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌─ Python FastAPI (별도 호스팅: Fly.io / Railway) ────────┐
│  ├─ Autoencoder + IF + OCSVM + LOF 모델 로드            │
│  ├─ KernelSHAP / GradientSHAP                            │
│  └─ Counterfactual (DiCE)                                │
└─────────────────────────────────────────────────────────┘
```

**장점**:
- 평가위원 / 잠재 고객에게 영구 URL 공유 가능 (`smartfactory-xai.vercel.app`)
- 모바일·태블릿 시연 가능 (반장이 현장 태블릿에서 사용)
- 권한 분리 (작업자/반장/부서장 별 화면)
- 다국어 (한/영) → 해외 진출 기반

**비용**:
- Vercel: Hobby 플랜 무료, Pro $20/월 (필요 시)
- FastAPI 호스팅: Fly.io $5/월, Railway $5/월
- 합계: 월 $25 이하

#### **Phase 3: 상용화 — AWS 옵션 (P5)**
- 다지점 공장 = ECS/EKS, RDS, S3
- 본선 P5 항목으로 이미 슬라이드에 명시

---

## 8. Claude design에 작업 요청 시 우선순위

1. **로고·브랜드 마크** — 4-AI 합의를 상징하는 미니멀 마크 (4개 점이 합쳐지는 형태?)
2. **랜딩 페이지 디자인** — 본선 후 vercel.app 배포용 (제품 소개, 시연 영상, GitHub 링크)
3. **5탭 대시보드 리디자인** — Next.js 마이그레이션용 컴포넌트 mockup
4. **모바일 뷰** — 반장이 태블릿/폰에서 빠르게 이상 알람 확인하는 UI
5. **발표 슬라이드 보강 이미지** — 본선 발표용 추가 시각 자료 (아키텍처 다이어그램, 4-AI 합의 흐름도)

### Claude design 프롬프트 (요약 버전)
```
SmartFactory XAI — 사출성형 24센서 이상탐지·진단·처방 통합 플랫폼.
"NASA mission control × Bloomberg terminal" 톤.
다크 (#080808 BG), Pretendard, 빨강(#D42121)·시안(#00D4FF) 강조 한정.
타깃: 중소 사출성형 공장 작업자/반장/부서장 3계층.
필요 산출물: 로고, 랜딩 페이지, 5탭 대시보드 mockup, 모바일 뷰.
레퍼런스: Bloomberg Terminal, Linear, Tesla Autopilot UI, Stripe Dashboard.
피해야 할 것: 그라데이션, 둥근 모서리 8px+, 일러스트, 채도 높은 색.
산출 형식: HTML/CSS 또는 React/Tailwind 컴포넌트.
```

---

## 9. 측정 가능한 성공 지표

| 지표 | 현재 (예선) | 본선 목표 | 상용화 (1년 후) |
|---|---|---|---|
| ROC-AUC | 0.9254 | 0.96+ (Q1/Q2/Q3 적용 시) | 0.97+ |
| Recall (4-AI) | 0.7949 | 0.85+ | 0.90+ |
| SHAP latency | 3,000ms | <100ms (DeepSHAP) | <50ms |
| 동시 접속 | 1 (Streamlit) | 1 (본선) | 50+ (Vercel) |
| 도입 공장 수 | 0 | PoC 1건 시작 | 5+ (KAMP 보급사업 진입) |
| 월 활성 사용자 | 1 (개발자) | 10+ (본선 평가위원) | 200+ |

---

## 10. 참고 자료

- **GitHub**: https://github.com/tkddnjs-dlqslek/smartfactory-xai
- **KAMP 데이터**: https://www.data.go.kr/data/15089213
- **현재 대시보드**: `http://localhost:8501` (`streamlit run app.py`)
- **PPT 양식**: `output/스마트공장XAI_예선기획서_최종.pdf`
- **재현 가이드**: `REPRODUCE.md` (7단계)
- **발표 가이드**: `발표_가이드.md` (5분 데모 코스)
