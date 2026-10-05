param(
    [Parameter(Mandatory)][ValidatePattern('^scalaris_test_[a-zA-Z0-9_]+$')][string]$Database,
    [Parameter(Mandatory)][string]$Url
)
. (Join-Path $PSScriptRoot 'Common.ps1')
$target=$null
if(-not [Uri]::TryCreate($Url,[UriKind]::Absolute,[ref]$target) -or
    $target.Scheme -ne 'http' -or $target.Host -notin @('127.0.0.1','localhost') -or
    $target.UserInfo -or $target.Query -or $target.Fragment -or $target.AbsolutePath -ne '/' -or
    $target.Port -ne $Scalaris.Port) {
    throw 'E2E requiere una URL HTTP de loopback con el puerto configurado, sin credenciales, ruta, query ni fragmento.'
}
$previousEnvironment=Save-ScalarisEnvironment
try {
    Set-ScalarisToolchain
    Set-ApplicationEnvironment -Mode Local -TestDatabase $Database
    $null=Assert-DatabaseIdentity
    $owned=Read-OwnedProcess
    if(-not $owned) { throw 'E2E requiere una instancia descartable iniciada mediante Start.ps1 -TestDatabase; no hay proceso propio verificado.' }
    $state=Read-ScalarisProcessState
    if(-not $state.PSObject.Properties['frontendDev'] -or $state.frontendDev -isnot [bool]) {
        throw 'El estado E2E no informa un modo de desarrollo verificable.'
    }
    Set-ApplicationEnvironment -Mode Local -TestDatabase $Database -FrontendDev:$state.frontendDev
    Assert-OwnedContract -Mode Local -FrontendDev:$state.frontendDev
    Wait-OwnedScalarisReady -Process $owned -Url (Get-ScalarisUrl -Mode Local)
    Write-Host "Destino E2E descartable verificado: $Database, PID $($owned.Id), puerto $($Scalaris.Port)."
} finally { Restore-ScalarisEnvironment $previousEnvironment }
