@echo off
cd /d "%~dp0"
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Node.js neni v PATH. Nainstalujte Node z https://nodejs.org a znovu otevrete terminal.
  pause
  exit /b 1
)
call npm.cmd install
call npm.cmd run dev
