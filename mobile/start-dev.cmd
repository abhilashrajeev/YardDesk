@echo off
REM Dev launcher for the Yard ERP mobile app (Expo, web preview mode).
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npx expo start --web
