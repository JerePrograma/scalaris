param(
    [Parameter(Mandatory)][string]$IdeaPath,
    [ValidatePattern('^scalaris_test_[a-zA-Z0-9_]+$')][string]$TestDatabase='',
    [switch]$FrontendDev
)
. (Join-Path $PSScriptRoot 'Common.ps1')
if(-not (Test-Path -LiteralPath $IdeaPath) -or [IO.Path]::GetFileName($IdeaPath) -ne 'idea64.exe') { throw 'Indicá la ruta existente de idea64.exe.' }
# IntelliJ reuses its first process: a second launcher cannot update that process environment.
if(Get-Process idea64 -ErrorAction SilentlyContinue) { throw 'Cerrá IntelliJ normalmente antes de usar este lanzador. Una instancia abierta conserva su entorno anterior.' }
if(Get-NetTCPConnection -State Listen -LocalPort $Scalaris.Port -ErrorAction SilentlyContinue) { throw "El puerto $($Scalaris.Port) está ocupado. Coordiná la parada de su propietario antes de iniciar otra instancia." }
$previousEnvironment=Save-ScalarisEnvironment
try {
    Set-ScalarisToolchain
    Set-ApplicationEnvironment -TestDatabase $TestDatabase -FrontendDev:$FrontendDev
    $null=Assert-DatabaseIdentity
    # Inherit the existing credential only in memory; no .env, XML or command argument contains it.
    Start-Process -FilePath $IdeaPath -ArgumentList ('"'+(Join-Path $BackofficeRoot 'backend')+'"') -WorkingDirectory (Join-Path $BackofficeRoot 'backend') -WindowStyle Normal | Out-Null
    Write-Host "IntelliJ: abrí la configuración Scalaris Local. Base $($Scalaris.DbName), puerto $($Scalaris.Port), almacenamiento $storagePath."
} finally { Restore-ScalarisEnvironment $previousEnvironment }
