@echo off
REM SmartFactory XAI 대시보드 실행 스크립트
chcp 65001 >nul
call conda activate smf
streamlit run app.py
