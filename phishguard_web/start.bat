@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt
cd backend
python app.py
pause
