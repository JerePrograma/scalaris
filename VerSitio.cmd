@echo off
setlocal
cd /d "%~dp0"
set "SCALARIS_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "SCALARIS_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo Abriendo la vista local de Scalaris...
echo Inicio: http://127.0.0.1:8080
echo Tienda: http://127.0.0.1:8080/tienda/
echo Mantene esta ventana abierta mientras revisas el sitio.
"%SCALARIS_NODE%" scripts\serve.mjs --open
pause
