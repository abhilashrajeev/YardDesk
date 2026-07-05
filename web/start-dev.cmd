@echo off
REM Dev launcher for the Yard ERP web app (Vite).
REM Injects Node into PATH (the app's spawn env can be stale after installing Node).
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npm run dev
