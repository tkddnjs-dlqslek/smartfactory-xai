# SmartFactory XAI 배포 가이드

프론트(Vercel) + 백엔드(Render). repo: `github.com/tkddnjs-dlqslek/smartfactory-xai`

---

## 1. 백엔드 — Render (먼저)

1. https://render.com 로그인 (GitHub 계정)
2. **New +** → **Blueprint** → `smartfactory-xai` repo 선택 → `render.yaml` 자동 인식 → Apply
   - (Blueprint 안 보이면: **New Web Service** → repo 선택 → Runtime `Python 3`,
     Build `pip install -r backend/requirements.txt`,
     Start `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`,
     Health Check Path `/api/health`, 환경변수 `PYTHON_VERSION=3.11.9`)
   - **환경변수 `ANTHROPIC_API_KEY` 추가** (자연어 보고서 NLG용) — Render 대시보드 Environment 탭. 없으면 NLG는 템플릿 폴백으로 동작(나머지 기능은 정상)
3. 빌드 5~10분 (torch CPU 휠 설치). 완료 후 URL 확인 (예: `https://smartfactory-xai-api.onrender.com`)
4. 검증: 브라우저로 `<URL>/api/health` → `{"status":"ok",...}`

> ⚠️ 무료 플랜은 15분 유휴 후 슬립 → 첫 요청 30~50초 콜드스타트.
> 시연 전 미리 `/api/health` 한 번 열어 깨워두기. (또는 UptimeRobot 5분 핑)

## 2. 프론트 — Vercel

1. https://vercel.com 로그인 (GitHub) → **Add New Project** → `smartfactory-xai` repo
2. **Root Directory** = `web` 로 지정 (중요)
3. **Environment Variables** 추가:
   - `NEXT_PUBLIC_API_URL` = Render 백엔드 URL (1단계, 끝에 `/` 없이)
4. **Deploy** → 2~3분 → `https://smartfactory-xai.vercel.app` 류 URL

> CORS는 백엔드가 `*.vercel.app`을 자동 허용하므로 추가 설정 불필요.
> 커스텀 도메인 쓰면 Render 환경변수 `ALLOWED_ORIGINS`에 해당 도메인 추가.

## 3. 검증
- Vercel URL `/dashboard` 접속 → 시나리오 버튼 클릭 시 숫자 변동 (= 백엔드 연동 성공)
- 안 바뀌면: 브라우저 콘솔 네트워크 탭에서 `/api/predict` CORS/404 확인

## 로컬 폴백 (본선장 인터넷 사고 대비)
```
# 백엔드
cd smart_factory_xai && C:/anaconda/python.exe -m uvicorn backend.main:app --port 8100
# 프론트 (.env.local: NEXT_PUBLIC_API_URL=http://127.0.0.1:8100)
cd smart_factory_xai/web && ./node_modules/.bin/next dev -p 3000
```
