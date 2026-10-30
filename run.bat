@echo off
setlocal
cd /d "%~dp0"
if exist "dist\win-unpacked\Apex PC Optimizer.exe" (
  start "" "dist\win-unpacked\Apex PC Optimizer.exe" %*
  exit /b 0
)
if exist "dist\Apex-PC-Optimizer-v1.0.2-Portable-x64.exe" (
  start "" "dist\Apex-PC-Optimizer-v1.0.2-Portable-x64.exe" %*
  exit /b 0
)
if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" . %*
  exit /b 0
)
echo No se encontro Apex. Compila la app o descarga una version oficial.
echo Si tu antivirus bloqueo un archivo, revisa la deteccion antes de continuar.
pause
exit /b 1
