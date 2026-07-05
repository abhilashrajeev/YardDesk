@echo off
REM Dev launcher for the Yard ERP backend.
REM Injects Node into PATH (the app's spawn env can be stale after installing Node),
REM then starts the NestJS dev server from this folder.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npm run start:dev
