@echo off
REM Production-build preview launcher for the Yard ERP web app (Vite), used to verify PWA registration.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npm run preview -- --port 4173 --strictPort
