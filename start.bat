@echo off
setlocal
cd /d "%~dp0"
title CodeProof AI

echo.
echo  CodeProof AI - local MVP
echo  Measure Understanding. Build Real Skills.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22 or newer is required.
  echo Install Node.js, reopen this terminal, and run start.bat again.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python 3.11 or newer is required for model training.
  echo Install Python with "Add Python to PATH" enabled, then retry.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] Creating the local Python environment...
  python -m venv --system-site-packages .venv
  if errorlevel 1 goto :failed
)

call ".venv\Scripts\activate.bat"
python -c "import numpy, sklearn" >nul 2>nul
if errorlevel 1 (
  echo [2/4] Installing local model dependencies...
  python -m pip install -r requirements.txt
  if errorlevel 1 goto :failed
) else (
  echo [2/4] Python model dependencies are ready.
)

if not exist "app\lib\generated-model.json" (
  echo [3/4] Training the local style model...
  python -m ml.train_model
  if errorlevel 1 goto :failed
) else (
  echo [3/4] Trained model artifact is ready.
)

set "npm_config_cache=%CD%\.npm-cache"
if not exist "node_modules\vinext\dist\cli.js" (
  echo [4/4] Installing application dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
) else (
  echo [4/4] Application dependencies are ready.
)

echo.
echo  CodeProof AI is starting at:
echo  http://localhost:3000
echo.
echo  Keep this window open. Press Ctrl+C to stop the app.
echo.
call npm.cmd run dev
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo ERROR: CodeProof AI could not start. Review the message above.
echo The terminal will remain open so the error is visible.
pause
exit /b 1
