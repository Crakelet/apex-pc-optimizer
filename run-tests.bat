@echo off
setlocal
call "%~dp0run.bat" --test-mode
exit /b %ERRORLEVEL%
