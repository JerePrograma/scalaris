param([ValidateSet('Local','Lan')][string]$Mode='Local')
. (Join-Path $PSScriptRoot 'Common.ps1')
# Start verifies the real database, process contract, listener ownership and HTTP readiness.
# Daily opening never selects a test database or grants Vite development origins.
& (Join-Path $PSScriptRoot 'Start.ps1') -Mode $Mode
if(-not $?) { throw 'Scalaris no quedó disponible. Revisá el error anterior; no se abre una URL sin confirmar el arranque.' }
$url=Get-ScalarisUrl -Mode $Mode
Start-Process -FilePath $url | Out-Null
Write-Host "Abierto en el navegador: $url"
