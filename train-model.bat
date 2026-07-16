@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" python -m venv --system-site-packages .venv
call ".venv\Scripts\activate.bat"
python -c "import numpy, sklearn" >nul 2>nul
if errorlevel 1 python -m pip install -r requirements.txt
python -m ml.train_model
if errorlevel 1 (
  echo Model training failed.
  pause
  exit /b 1
)
echo Model training complete.
pause
