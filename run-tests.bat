@echo off
setlocal
cd /d "%~dp0"
set "npm_config_cache=%CD%\.npm-cache"
call npm.cmd test
if errorlevel 1 (
  echo.
  echo One or more checks failed.
  pause
  exit /b 1
)
echo.
echo All CodeProof AI checks passed.
pause
