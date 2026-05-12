@echo off
REM ============================================================
REM SmartFactory XAI - 원클릭 설치 스크립트 (Windows)
REM ============================================================
REM 사용법: install.bat 더블 클릭 또는 cmd에서 실행
REM 자동으로 conda 환경 생성, 의존성 설치, 데이터 확인까지 수행
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 >nul

echo.
echo ============================================================
echo   SmartFactory XAI - 원클릭 설치 시작
echo ============================================================
echo.

REM 1. Anaconda 확인
where conda >nul 2>nul
if errorlevel 1 (
    echo [오류] Anaconda 또는 Miniconda가 설치되어 있지 않습니다.
    echo        https://www.anaconda.com/download 에서 다운로드 후 재실행하세요.
    pause
    exit /b 1
)
echo [1/5] Anaconda 확인 완료

REM 2. conda 환경 smf 생성 (이미 있으면 skip)
conda env list | findstr /B "smf " >nul
if errorlevel 1 (
    echo [2/5] conda 환경 'smf' 생성 중 (Python 3.11)...
    call conda create -n smf python=3.11 -y
) else (
    echo [2/5] conda 환경 'smf' 이미 존재 - skip
)

REM 3. 의존성 설치
echo [3/5] 의존성 패키지 설치 중...
call conda activate smf
pip install -r requirements.txt
if errorlevel 1 (
    echo [오류] pip install 실패
    pause
    exit /b 1
)

REM 4. 데이터셋 확인
echo [4/5] 데이터셋 확인 중...
if not exist "dataset\supervised_label_cn7.csv" (
    echo [경고] dataset\supervised_label_cn7.csv 파일이 없습니다.
    echo        KAMP 공공데이터포털(data.go.kr/data/15089213)에서 다운로드 후
    echo        dataset\ 폴더에 배치하세요.
)
if exist "models\autoencoder.pt" (
    echo [4/5] 학습된 모델이 이미 존재합니다 - 학습 단계 skip 가능
) else (
    echo [4/5] 학습된 모델이 없습니다. 다음 명령으로 학습을 실행하세요:
    echo        python scripts\01_train.py
    echo        python scripts\02_evaluate.py
    echo        python scripts\03_score_unlabeled.py
    echo        python scripts\04_compute_shap.py
    echo        python scripts\06_bootstrap_ci.py
)

REM 5. 모델 무결성 해시 기록
echo [5/5] 모델 무결성 해시 기록...
if exist "models\autoencoder.pt" (
    python scripts\verify_model.py --record
)

echo.
echo ============================================================
echo   설치 완료!
echo ============================================================
echo.
echo 대시보드 실행:
echo   conda activate smf
echo   streamlit run app.py
echo.
echo 또는:
echo   run_dashboard.bat
echo.
pause
