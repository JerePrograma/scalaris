. (Join-Path $PSScriptRoot 'Common.ps1')
$operation=Lock-ScalarisOperation
try {
    $process=Read-OwnedProcess
    if($process){Stop-OwnedScalaris}else{Write-Host 'No hay proceso propio de Scalaris en ejecución.'}
    if(Test-Path -LiteralPath $StatePath){Remove-Item -LiteralPath $StatePath}
} finally { $operation.Dispose() }
