@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
"%~dp0node_modules\.bin\expo.cmd" start --web --port 8081
pause
