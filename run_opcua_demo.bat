@echo off
REM SmartFactory XAI — OPC-UA 시연 원클릭 실행 (P1)
REM Terminal 1: OPC-UA 서버 + 클라이언트 (검증셋 publish)
REM Terminal 2: Streamlit 대시보드
REM 중지: 각 창에서 Ctrl+C

setlocal
chcp 65001 > nul
cd /d "%~dp0"

echo ============================================================
echo  SmartFactory XAI — OPC-UA 본선 시연 (P1)
echo ============================================================
echo.
echo  [1/2] OPC-UA 서버 + 클라이언트 별도 창에서 시작...
start "OPC-UA Runner" cmd /k "C:\anaconda\python.exe scripts\opcua_runner.py"

echo  [2/2] Streamlit 대시보드 시작 (3초 대기)...
timeout /t 3 /nobreak > nul
start "Streamlit Dashboard" cmd /k "C:\anaconda\python.exe -m streamlit run app.py"

echo.
echo ============================================================
echo  실행 완료. 사용 방법:
echo   1. 브라우저: http://localhost:8501
echo   2. 사이드바 [OPC-UA] 토글 ON
echo   3. 24 슬라이더가 1초마다 자동 갱신됨
echo   4. 중지: 각 창에서 Ctrl+C
echo ============================================================
echo.
pause
