@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -File "%~dp0backoffice\scripts\Open.ps1" %*
set "scalarisExit=%errorlevel%"
if not "%scalarisExit%"=="0" (
    echo.
    echo No se pudo abrir Scalaris. Revisar el mensaje anterior.
    echo Si PowerShell bloquea el script, revisar la politica local; este lanzador no la cambia.
    pause
)
exit /b %scalarisExit%
