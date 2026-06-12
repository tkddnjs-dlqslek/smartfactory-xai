# 포트폴리오 PPTX 명세 · 검증 기록

> 대상: `output/스마트공장XAI_포트폴리오.pptx` (14슬라이드, 16:9 다크 테마)
> 빌더: `scripts/build_portfolio_pptx.py` (python-pptx) — 문구 수정 후 재실행하면 동일 품질로 재생성
> 검증일: 2026-06-12 · 검증 방법: 슬라이드 전수 PNG 렌더링 → 배포 사이트 캡처/라이브 텍스트와 수치 대조

---

## 1. 수치 출처 (SSOT)

모든 수치는 `슬라이드_데이터.md` = `results/slide_data.json` (검증 1,379샷 실측) 확정값.
임의 반올림·수정 금지. 슬라이드 수정 시 이 파일과 대조할 것.

## 2. 슬라이드 구성

| # | 제목 | 사용 캡처 (output/_pptx_shots/) |
|---|---|---|
| 1 | 표지 | 01_landing_hero.png |
| 2 | 프로젝트 개요 (스탯 카드 4 + 테크스택) | — |
| 3 | 문제 정의 — 3대 문제 | — |
| 4 | 시스템 아키텍처 — 단일 엔진 → 4축 분기 | — |
| 5 | TAB 01 실시간 진단 (NLG 보고서 · What-if · 이상이력) | 03_tab1_danger_nlg.png |
| 6 | TAB 01 실측 KAMP 스트림 (NLG 보고서 · 이상이력 테이블) | 05_tab1_live_nlg.png |
| 7 | TAB 02 SHAP 원인분석 | 06_tab2_shap_top.png |
| 8 | TAB 03 임계값 시뮬레이터 | 07_tab3_batch_top.png |
| 9 | TAB 04 설비 예지정비 | 08_tab4_rul_top.png |
| 10 | TAB 05 안전 위험 모니터링 | 09_tab5_safety_top.png |
| 11 | TAB 06 생산 OEE | 10_tab6_oee_top.png |
| 12 | TAB 07 모델 신뢰도 | 11_tab7_trust_top.png |
| 13 | 정직한 공개 (한계 4건) | — |
| 14 | 정리 — 차별점 5 + 링크 | — |

캡처는 전부 배포 사이트(https://smartfactory-xai.vercel.app) 실화면, 1600×900 헤드리스 브라우저 촬영.
풀페이지 버전(`*_full.png`)도 동일 폴더에 보관.

## 3. 슬라이드 ↔ 캡처 수치 대조 결과 (전수 검증 완료)

| 슬라이드 | 검증 항목 | 결과 |
|---|---|---|
| 2 | ROC-AUC 0.9254 / F1 0.7324 / P 0.8125 / R 0.6667 / FP 31→5 (0.50→0.84) / 1,379샷(1,340+39) / 24센서 | 일치 |
| 5 | τ 0.320 · FP 31→5 · 4모델 FIRE/HOLD · ≥3/4 합의 · 처방 즉시/5분 내/관찰 | 일치 |
| 6 | "13샷 중 불량률 15.4%" = 캡처 `이상 2/13샷 누적 · 15.4%` | 일치 |
| 7 | GradientExplainer <100ms · 기준 0.048→예측 0.639 · 충전시간 r=0.95 · 정상 1,340/이상 39 | 일치 |
| 8 | TP 26/FN 13/FP 6 · P 0.813/R 0.667/F1 0.732 · 이상샷 #0455 505.92×τ | 일치 |
| 9 | 불량 39건 · 탐지율 온도 0%/시간 80%/속도 100%/압력 100% · #01 온도 냉각수·가열대 | 일치 |
| 10 | ISO 12100 · 발생가능성×심각도 매트릭스 · E-STOP 체크리스트 · 15/16센서 94% | 일치 |
| 11 | OEE 94.2×91.5×97.17=83.8% · 양품 1,340+불량 39 · Pareto 11/10/8/8/2 누적 95% | 일치 |
| 12 | CI [0.879, 0.966] · Hard Voting F1 0.761★ · Stacking LOOCV F1 0.691(오버피팅 의심) · τ 0.3198 vs 0.5171 · FN 50만/FP 3만 | 라이브 사이트 재검증 일치 |
| 13 | 온도 불량 11건 중 탐지 0건 · 미탐 13 중 11 온도 · 합집합 Recall 0.79(실측 0.795) | 일치 |

**참고:** 슬라이드 5·6 캡처는 Tab01 scrollHeight=1474px 하단 섹션(scroll 574px~). WHAT-IF · 자연어 진단 보고서(Claude Haiku) · 이상 감지 이력 3열 구성이 화면에 보임.

## 4. 레이아웃 품질 규칙 (재생성 시 유지할 것)

- **한글 단어 잘림 방지**: 모든 run에 `lang="ko-KR"` + `altLang="en-US"` 필수 (없으면 "사출성/형"처럼 음절 분리됨). 단락 `eaLnBrk="0"` 단독 사용, `latinLnBrk` 속성은 존재만으로 역효과 — 절대 추가 금지. "What-if"는 비분리 하이픈(U+2011).
- **이미지 경계**: 슬라이드 높이 7.5in — 이미지 y+height ≤ 7.3 확인 (표지 히어로 w=6.85).
- **모델명 표기**: 약자(AE·IF·OCSVM·LOF) 금지 — Autoencoder · Isolation Forest · One-Class SVM · Local Outlier Factor 풀네임.
- **검증 절차**: 빌드 후 PowerPoint COM으로 PNG export(1600×900) → 전 슬라이드 육안 확인.
  ```powershell
  $app = New-Object -ComObject PowerPoint.Application
  $pres = $app.Presentations.Open($pptx, $true, $false, $false)
  $pres.Export($outDir, "PNG", 1600, 900); $pres.Close()
  ```

## 5. 재생성 / 캡처 갱신

```bash
# PPTX 재생성 (캡처·문구 수정 후)
C:/anaconda/python.exe scripts/build_portfolio_pptx.py

# 캡처 갱신: Render 콜드스타트 → /api/health로 깨운 뒤
# 헤드리스 브라우저로 각 탭 viewport(1600x900) + full 캡처
# 주의: Tab2(SHAP)는 계산 ~20초 대기 후 촬영 (로딩 화면 찍힘 방지)
```

심사위원 페르소나 검토 결과(2026-06-12): 95/100 — 문제정의 19/20 · AI활용 24/25 · 플랫폼기획 19/20 · MVP완성도 24/25 · 발표 9/10.
