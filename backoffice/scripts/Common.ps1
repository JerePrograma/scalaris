Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$BackofficeRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $BackofficeRoot -Parent
$RuntimeRoot = Join-Path $BackofficeRoot '.runtime'
$JarPath = Join-Path $BackofficeRoot 'backend\target\backoffice-1.0.0.jar'
$StatePath = Join-Path $RuntimeRoot 'process.json'
$OperationLockPath = Join-Path $RuntimeRoot 'operation.lock'
. (Join-Path $BackofficeRoot 'config.example.ps1')
$localConfig = Join-Path $BackofficeRoot 'config.local.ps1'
if (Test-Path -LiteralPath $localConfig) { . $localConfig }
if ($Scalaris.DbHost -notin @('127.0.0.1','localhost','::1')) { throw 'PostgreSQL debe ser local.' }
if ($Scalaris.DbPort -ne 5433) { throw 'Scalaris requiere PostgreSQL 18 en 5433. No conectar a Molineros/5432.' }
if ($Scalaris.DbName -notmatch '^[a-zA-Z][a-zA-Z0-9_]*$') { throw 'Nombre de base inválido.' }
if ($Scalaris.Port -lt 1024 -or $Scalaris.Port -gt 65535) { throw 'Puerto de aplicación inválido.' }
if (-not [IO.Path]::IsPathRooted($Scalaris.Storage)) { throw 'Storage debe ser una ruta absoluta, independiente del directorio de trabajo.' }
$storagePath = [IO.Path]::GetFullPath($Scalaris.Storage)
if ($storagePath.Equals($RepoRoot,[StringComparison]::OrdinalIgnoreCase) -or $storagePath.StartsWith($RepoRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Almacenamiento debe estar fuera del repositorio.' }
function Resolve-Tool([string]$Configured,[string]$Name,[string]$PortablePattern) {
    if ($Configured) { if (-not (Test-Path -LiteralPath $Configured)) { throw "No existe herramienta: $Configured" }; return $Configured }
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    if ($PortablePattern) { $portable = Get-ChildItem -Path (Join-Path $RepoRoot $PortablePattern) -ErrorAction SilentlyContinue | Select-Object -First 1; if ($portable) { return $portable.FullName } }
    throw "Falta $Name. Instalá el prerrequisito o configurá su ruta en config.local.ps1."
}
function Resolve-Java {
    $jdkPath=$Scalaris.JdkHome
    if (-not $jdkPath) { throw 'Configurá JdkHome con Temurin 25 LTS para Scalaris.' }
    $javaCommand=Join-Path $jdkPath 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $javaCommand)) { throw "Falta Java 25 en $jdkPath." }
    # java -version writes stderr; PowerShell 5.1 otherwise treats it as NativeCommandError.
    $javaInfo=New-Object Diagnostics.ProcessStartInfo
    $javaInfo.FileName=$javaCommand
    $javaInfo.Arguments='-version'
    $javaInfo.UseShellExecute=$false
    $javaInfo.CreateNoWindow=$true
    $javaInfo.RedirectStandardOutput=$true
    $javaInfo.RedirectStandardError=$true
    $javaProcess=[Diagnostics.Process]::Start($javaInfo)
    try { $javaVersion=$javaProcess.StandardOutput.ReadToEnd()+$javaProcess.StandardError.ReadToEnd();$javaProcess.WaitForExit();if($javaProcess.ExitCode -ne 0){throw 'Java no pudo informar su versión.'} }
    finally { $javaProcess.Dispose() }
    if($javaVersion -notmatch 'version "25\.') { throw 'Scalaris requiere JDK 25 LTS.' }
    return $javaCommand
}
function Save-ScalarisEnvironment {
    $values=@{}
    foreach($name in @('JAVA_HOME','PATH','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','SCALARIS_DB_URL','SCALARIS_DB_USER','SCALARIS_DB_PASSWORD','SCALARIS_STORAGE','SCALARIS_PORT','SCALARIS_BIND','SCALARIS_ORIGINS','SCALARIS_TEST_DB_URL','SCALARIS_TEST_DB_USER','SCALARIS_TEST_DB_PASSWORD')) {
        $values[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
    }
    return $values
}
function Restore-ScalarisEnvironment([hashtable]$Values) {
    foreach($name in $Values.Keys) {
        if($null -eq $Values[$name]) { [Environment]::SetEnvironmentVariable($name,[NullString]::Value,'Process') }
        else { [Environment]::SetEnvironmentVariable($name,$Values[$name],'Process') }
    }
}
function Set-ScalarisToolchain([switch]$WithNode) {
    $null=Resolve-Java
    $env:JAVA_HOME=$Scalaris.JdkHome
    $paths=@((Join-Path $Scalaris.JdkHome 'bin'))
    if($WithNode -and $Scalaris.NodeHome) { $paths+=$Scalaris.NodeHome }
    $env:PATH=($paths -join ';')+';'+$env:PATH
    if($WithNode) {
        $nodeVersion=(& node.exe --version | Out-String).Trim()
        if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') { throw 'Configurá NodeHome con Node 24 LTS.' }
    }
}
function Set-DatabaseEnvironment {
    $jdbcHost=if($Scalaris.DbHost -eq '::1'){'[::1]'}else{$Scalaris.DbHost}
    $env:SCALARIS_DB_URL = "jdbc:postgresql://${jdbcHost}:$($Scalaris.DbPort)/$($Scalaris.DbName)"
    $env:SCALARIS_DB_USER = $Scalaris.DbUser
    $env:SCALARIS_STORAGE = $storagePath
    $env:PGHOST = $Scalaris.DbHost
    $env:PGPORT = [string]$Scalaris.DbPort
    $env:PGDATABASE = $Scalaris.DbName
    $env:PGUSER = $Scalaris.DbUser
    if(-not $env:SCALARIS_DB_PASSWORD -and $Scalaris.CredentialFile) {
        $credential=Import-Clixml -LiteralPath $Scalaris.CredentialFile
        if($credential -isnot [PSCredential] -or $credential.UserName -ne $Scalaris.DbUser) { throw 'Credencial protegida no corresponde al usuario configurado.' }
        $env:SCALARIS_DB_PASSWORD=$credential.GetNetworkCredential().Password
    }
    if($env:SCALARIS_DB_PASSWORD) { $env:PGPASSWORD=$env:SCALARIS_DB_PASSWORD }
}
function Set-ApplicationEnvironment([string]$Mode='Local',[string]$TestDatabase='',[switch]$FrontendDev) {
    if($FrontendDev -and $Mode -ne 'Local') { throw 'FrontendDev requiere Mode Local; Vite solo se autoriza en loopback.' }
    if($FrontendDev -and $Scalaris.Port -ne 8081) { throw 'FrontendDev requiere backend en 8081, destino del proxy Vite del proyecto.' }
    if($TestDatabase) {
        if($TestDatabase -notmatch '^scalaris_test_[a-zA-Z0-9_]+$') { throw 'El destino de prueba debe ser descartable scalaris_test_*.' }
        $Scalaris.DbName=$TestDatabase
        $script:storagePath=[IO.Path]::GetFullPath((Join-Path $env:USERPROFILE "ScalarisData\tests\$TestDatabase\attachments"))
    }
    Set-DatabaseEnvironment
    if(-not $env:SCALARIS_DB_PASSWORD) { throw 'Falta SCALARIS_DB_PASSWORD. Ingresá la contraseña mediante Read-Host -AsSecureString o reutilizá CredentialFile DPAPI; no la pongas en argumentos ni archivos versionados.' }
    $env:SCALARIS_PORT=[string]$Scalaris.Port
    $env:SCALARIS_BIND='127.0.0.1'
    $env:SCALARIS_ORIGINS="http://localhost:$($Scalaris.Port),http://127.0.0.1:$($Scalaris.Port)"
    if($FrontendDev) { $env:SCALARIS_ORIGINS+=',http://localhost:5173,http://127.0.0.1:5173' }
    if($Mode -eq 'Lan') {
        $lanIp=$null
        if(-not [Net.IPAddress]::TryParse($Scalaris.LanAddress,[ref]$lanIp) -or $lanIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $Scalaris.LanAddress -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)'){throw 'Configurá LanAddress con una IPv4 privada de esta PC.'}
        if(-not $Scalaris.ContainsKey('LanInterfaceAlias') -or -not $Scalaris.LanInterfaceAlias) { throw 'Configurá LanInterfaceAlias con la interfaz aprobada antes de activar LAN.' }
        $interface=@(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq $Scalaris.LanAddress -and $_.InterfaceAlias -eq $Scalaris.LanInterfaceAlias -and $_.AddressState -eq 'Preferred' })
        if($interface.Count -ne 1){throw 'La IPv4 aprobada ya no está asignada a esa interfaz. Revisá DHCP y obtené aprobación de la nueva dirección; no se amplía el binding.'}
        $profile=Get-NetConnectionProfile -InterfaceIndex $interface[0].InterfaceIndex -ErrorAction Stop
        if($profile.NetworkCategory -ne 'Private') { throw 'El modo LAN exige que la interfaz aprobada ya tenga perfil Private. El script no cambia el perfil ni habilita redes públicas/corporativas.' }
        if(-not $Scalaris.ContainsKey('LanNetworkName') -or -not $Scalaris.LanNetworkName -or $profile.Name -ne $Scalaris.LanNetworkName) { throw 'El nombre de la red actual no coincide con LanNetworkName aprobado. Revisá la red y obtené aprobación antes de activar LAN; no se reutiliza el permiso en otra red.' }
        $env:SCALARIS_BIND=$Scalaris.LanAddress
        $env:SCALARIS_ORIGINS+=",http://$($Scalaris.LanAddress):$($Scalaris.Port)"
    }
}
function Assert-DatabaseIdentity {
    $psql=Pg-Tool 'psql.exe'
    $sql="SELECT json_build_object('database',current_database(),'version',version(),'major',current_setting('server_version_num')::int/10000,'address',host(inet_server_addr()),'port',inet_server_port(),'user',current_user,'schema',current_schema(),'listen',current_setting('listen_addresses'))::text;"
    $result=& $psql -X -w -v ON_ERROR_STOP=1 -At -c $sql
    if($LASTEXITCODE -ne 0) { throw 'Falló verificación de identidad PostgreSQL. Ingresá la credencial por mecanismo seguro.' }
    $identity=$result | ConvertFrom-Json
    if($identity.database -ne $Scalaris.DbName -or $identity.user -ne $Scalaris.DbUser -or $identity.schema -ne 'public' -or $identity.major -ne 18 -or $identity.port -ne 5433 -or $identity.address -notin @('127.0.0.1','::1')) { throw 'Identidad PostgreSQL no coincide con Scalaris local/18/5433/public. Operación detenida.' }
    foreach($address in $identity.listen.Split(',')) { if($address.Trim() -notin @('localhost','127.0.0.1','::1')) { throw 'PostgreSQL debe escuchar solamente en loopback.' } }
    return $identity
}
function Pg-Tool([string]$Name) {
    $configured=if($Scalaris.PgBin){Join-Path $Scalaris.PgBin $Name}else{''}
    return Resolve-Tool $configured $Name "artifacts\tooling\postgres\pgsql\bin\$Name"
}
function Invoke-Checked([string]$Command,[string[]]$Arguments) { & $Command @Arguments; if ($LASTEXITCODE -ne 0) { throw "Falló $([IO.Path]::GetFileName($Command)) (código $LASTEXITCODE)." } }
function Lock-ScalarisOperation([int]$TimeoutSeconds=60) {
    [IO.Directory]::CreateDirectory($RuntimeRoot) | Out-Null
    $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try { return [IO.File]::Open($OperationLockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
        catch [IO.IOException] {
            $nativeCode=$_.Exception.HResult -band 0xffff
            if($nativeCode -notin @(32,33)) { throw 'No se pudo abrir el bloqueo de operaciones. Revisá permisos de backoffice/.runtime; no borres un bloqueo activo.' }
            if([DateTime]::UtcNow -ge $deadline) { throw 'Hay otra operación de Scalaris (inicio, parada o build) activa. Esperá a que termine; no borres operation.lock.' }
            Start-Sleep -Milliseconds 250
        }
    } while($true)
}
function Read-ScalarisProcessState {
    if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
    try { $state=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json }
    catch { throw 'process.json no es legible. No se adopta ni se detiene ningún proceso; revisá la instancia y el archivo de estado.' }
    if(-not $state -or -not $state.PSObject.Properties['pid'] -or -not $state.PSObject.Properties['startTime'] -or -not $state.PSObject.Properties['jar'] -or [string]$state.pid -notmatch '^[1-9][0-9]*$') { throw 'process.json no contiene una identidad válida. No se adopta ni se detiene ningún proceso.' }
    return $state
}
function Read-OwnedProcess {
    $state=Read-ScalarisProcessState
    if(-not $state) { return $null }
    $process=Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    $details=Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)"
    if(-not $details) { if(-not(Get-Process -Id $state.pid -ErrorAction SilentlyContinue)){return $null};throw 'No se pudo verificar la identidad del proceso. No se detendrá.' }
    $recordedTime=if($state.startTime -is [datetime]){$state.startTime.ToUniversalTime()}else{[datetime]::Parse($state.startTime).ToUniversalTime()}
    if ($process.StartTime.ToUniversalTime().Ticks -ne $recordedTime.Ticks -or $state.jar -ne $JarPath -or -not $details.CommandLine -or -not $details.CommandLine.Contains('"'+$JarPath+'"') -or $details.ExecutablePath -ne (Join-Path $Scalaris.JdkHome 'bin\java.exe')) { throw 'El PID fue reutilizado o no pertenece a Scalaris. No se detendrá ese proceso.' }
    return $process
}
function Assert-OwnedContract([string]$Mode,[switch]$FrontendDev) {
    $state=Read-ScalarisProcessState
    foreach($name in @('mode','database','storage','port','bind','frontendDev')) {
        if(-not $state.PSObject.Properties[$name]) { throw 'La instancia propia tiene un estado anterior sin contrato completo. Detenela con Stop.ps1 y volvé a abrir Scalaris.' }
    }
    if($state.mode -ne $Mode -or $state.database -ne $Scalaris.DbName -or $state.storage -ne $storagePath -or $state.port -ne $Scalaris.Port -or $state.bind -ne $env:SCALARIS_BIND -or [bool]$state.frontendDev -ne [bool]$FrontendDev) {
        throw 'La instancia propia usa otro modo, base, almacenamiento, puerto o entorno de desarrollo. Detenela con Stop.ps1 antes de cambiar de destino; no se reutiliza como entorno real local.'
    }
}
function Get-ScalarisUrl([string]$Mode='Local') {
    $address=if($Mode -eq 'Lan'){$Scalaris.LanAddress}else{'127.0.0.1'}
    return "http://${address}:$($Scalaris.Port)"
}
function Wait-OwnedScalarisReady([Diagnostics.Process]$Process,[string]$Url,[int]$TimeoutSeconds=60) {
    $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastStatus='sin respuesta HTTP válida'
    do {
        $owned=Read-OwnedProcess
        if(-not $owned -or $owned.Id -ne $Process.Id) { throw 'La aplicación terminó o cambió de identidad. Revisá .runtime/app.log y error.log.' }
        $listener=@(Get-NetTCPConnection -State Listen -LocalPort $Scalaris.Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $Process.Id -and $_.LocalAddress -eq $env:SCALARIS_BIND })
        if($listener.Count -gt 0) {
            try {
                $response=Invoke-WebRequest -Uri ($Url+'/api/health') -UseBasicParsing -Headers @{Accept='application/json'} -TimeoutSec 2 -MaximumRedirection 0
                $health=$response.Content | ConvertFrom-Json
                if($response.StatusCode -eq 200 -and $response.Headers['Content-Type'] -like 'application/json*' -and $health.status -eq 'ok' -and $health.database -eq 1) {
                    $checked=Read-OwnedProcess
                    if($checked -and $checked.Id -eq $Process.Id) { return }
                }
                $lastStatus='la respuesta de /api/health no confirmó aplicación y base'
            } catch {
                $lastStatus='falló GET /api/health'
                if($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) { $lastStatus="GET /api/health devolvió HTTP $([int]$_.Exception.Response.StatusCode)" }
            }
        }
        if([DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 500 }
    } while([DateTime]::UtcNow -lt $deadline)
    throw "No se verificó disponibilidad HTTP en $TimeoutSeconds segundos ($lastStatus). Revisá .runtime/app.log y error.log; iniciar la JVM no confirma que Scalaris esté listo."
}
function Lock-Storage {
    [IO.Directory]::CreateDirectory($storagePath) | Out-Null
    try { return [IO.File]::Open((Join-Path $storagePath '.scalaris.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
    catch [UnauthorizedAccessException] { throw "Sin permiso para abrir el bloqueo de almacenamiento: $storagePath\.scalaris.lock. Revisá permisos; no borres el archivo." }
    catch [IO.IOException] {
        $nativeCode=$_.Exception.HResult -band 0xffff
        if($nativeCode -in @(32,33)) { throw "Almacenamiento en uso: $storagePath\.scalaris.lock. Detené de forma coordinada la instancia o esperá al respaldo activo. La existencia del archivo no prueba un bloqueo; no lo borres." }
        throw "No se pudo abrir el bloqueo $storagePath\.scalaris.lock (error de E/S $nativeCode). Revisá el almacenamiento y permisos; no borres el archivo."
    }
}
function Stop-OwnedScalaris {
    $owned=Read-OwnedProcess
    if(-not $owned) { return }
    $java=Resolve-Java
    $jdkBin=Join-Path $Scalaris.JdkHome 'bin'
    $helperRoot=Join-Path $RuntimeRoot 'stop-helper'
    [IO.Directory]::CreateDirectory($helperRoot) | Out-Null
    $source=Join-Path $PSScriptRoot 'java\GracefulStop.java'
    $helperJar=Join-Path $helperRoot 'scalaris-stop.jar'
    Invoke-Checked (Join-Path $jdkBin 'javac.exe') @('--add-modules','jdk.attach','-encoding','UTF-8','-d',$helperRoot,$source)
    [IO.File]::WriteAllText((Join-Path $helperRoot 'manifest.mf'),"Manifest-Version: 1.0`nAgent-Class: GracefulStop`n`n",[Text.UTF8Encoding]::new($false))
    Invoke-Checked (Join-Path $jdkBin 'jar.exe') @('--create','--file',$helperJar,'--manifest',(Join-Path $helperRoot 'manifest.mf'),'-C',$helperRoot,'GracefulStop.class')
    # Recheck PID/start time/JAR after compilation; never signal a reused or unrelated PID.
    $checked=Read-OwnedProcess
    if(-not $checked) { return }
    if($checked.Id -ne $owned.Id) { throw 'Cambió la instancia durante la parada; no se señaliza ningún proceso.' }
    try { Invoke-Checked $java @('--add-modules','jdk.attach','-cp',$helperRoot,'GracefulStop',[string]$owned.Id,$helperJar) }
    catch { if(Get-Process -Id $owned.Id -ErrorAction SilentlyContinue) { throw }; Write-Host 'El JVM terminó durante la respuesta a la señal de cierre.' }
    try { Wait-Process -Id $owned.Id -Timeout 30 -ErrorAction Stop }
    catch { if(Get-Process -Id $owned.Id -ErrorAction SilentlyContinue) { throw 'La parada limpia no terminó en 30 segundos. No se fuerza la terminación; revisá la instancia.' } }
    Write-Host 'Instancia propia de Scalaris cerrada mediante hooks de Spring/JVM.'
}
