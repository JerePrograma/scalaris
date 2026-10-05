param(
    [ValidateSet('Local','Lan')][string]$Mode='Local',
    [switch]$Build,
    [ValidatePattern('^scalaris_test_[a-zA-Z0-9_]+$')][string]$TestDatabase='',
    [switch]$FrontendDev
)
. (Join-Path $PSScriptRoot 'Common.ps1')
# Build owns its own operation lock; recheck the instance after that lock is released.
if($Build) {
    & (Join-Path $PSScriptRoot 'Build.ps1')
    if(-not $?) { throw 'Build falló; no se inicia Scalaris.' }
}
$operation=Lock-ScalarisOperation
$previousEnvironment=Save-ScalarisEnvironment
try {
    Set-ScalarisToolchain
    $java=Resolve-Java
    Set-ApplicationEnvironment -Mode $Mode -TestDatabase $TestDatabase -FrontendDev:$FrontendDev
    $null=Assert-DatabaseIdentity
    $url=Get-ScalarisUrl -Mode $Mode
    $existing=Read-OwnedProcess
    if($existing) {
        Assert-OwnedContract -Mode $Mode -FrontendDev:$FrontendDev
        Wait-OwnedScalarisReady -Process $existing -Url $url
        Write-Host "Scalaris ya está disponible: $url (PID $($existing.Id), $Mode, base $($Scalaris.DbName))."
        return
    }
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $Scalaris.Port -ErrorAction SilentlyContinue)
    if($listeners.Count -gt 0) {
        $owners=($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        throw "El puerto $($Scalaris.Port) está ocupado por PID $owners. Coordiná su parada con su propietario; no se adopta ni se detiene otra instancia."
    }
    if(-not(Test-Path -LiteralPath $JarPath)) { throw 'Falta el JAR. Ejecutá .\backoffice\scripts\Build.ps1 para construir antes de abrir diariamente.' }
    [IO.Directory]::CreateDirectory($RuntimeRoot) | Out-Null
    $process=Start-Process -FilePath $java -ArgumentList @('-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-jar',('"'+$JarPath+'"')) -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RuntimeRoot 'app.log') -RedirectStandardError (Join-Path $RuntimeRoot 'error.log') -PassThru
    @{pid=$process.Id;startTime=$process.StartTime.ToUniversalTime().ToString('o');jar=$JarPath;mode=$Mode;database=$Scalaris.DbName;storage=$storagePath;port=$Scalaris.Port;bind=$env:SCALARIS_BIND;frontendDev=[bool]$FrontendDev} | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding utf8
    try {
        Wait-OwnedScalarisReady -Process $process -Url $url
    } catch {
        $startupError=$_
        try {
            $owned=Read-OwnedProcess
            if($owned) { Stop-OwnedScalaris }
            if(Test-Path -LiteralPath $StatePath) { Remove-Item -LiteralPath $StatePath }
        } catch { Write-Warning 'No se pudo cerrar limpiamente la instancia fallida. Se conserva su estado; revisá logs y usá Stop.ps1. No se fuerza su terminación.' }
        throw $startupError
    }
    Write-Host "Scalaris disponible: $url (PID $($process.Id), $Mode, base $($Scalaris.DbName))."
    if($Mode -eq 'Lan') { Write-Host "LAN: $url; interfaz $($Scalaris.LanInterfaceAlias). Sin login: el acceso de red permite consultar y modificar datos." }
    Write-Host 'Para detener: .\backoffice\scripts\Stop.ps1. No se modificó firewall, perfil de red ni router.'
} finally { Restore-ScalarisEnvironment $previousEnvironment; $operation.Dispose() }
