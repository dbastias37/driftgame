@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas Node.js 22 o posterior. Instala la version LTS de https://nodejs.org
  pause
  exit /b 1
)
start "" http://127.0.0.1:8787
node scripts/preview.mjs
pause
