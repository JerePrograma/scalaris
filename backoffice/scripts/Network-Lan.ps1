[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Enable','Disable')][string]$Action,
    [Parameter(Mandatory)][string]$LocalAddress,
    [Parameter(Mandatory)][string]$InterfaceAlias,
    [Parameter(Mandatory)][ValidateRange(1,2147483647)][int]$InterfaceIndex,
    [Parameter(Mandatory)][string]$NetworkName,
    [Parameter(Mandatory)][string]$RemoteSubnet
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Assert-NetworkAdministrator {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    $principal=New-Object Security.Principal.WindowsPrincipal($identity)
    if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Esta operación de red requiere PowerShell como administrador. No se cambió red ni firewall; no hay elevación automática.' }
}
function Assert-ApprovedNetwork {
    $ip=$null
    if(-not [Net.IPAddress]::TryParse($LocalAddress,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $LocalAddress -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') { throw 'LocalAddress debe ser una IPv4 privada explícitamente aprobada.' }
    $parts=$RemoteSubnet.Split('/')
    $network=$null
    if($parts.Count -ne 2 -or -not [Net.IPAddress]::TryParse($parts[0],[ref]$network) -or $network.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $parts[1] -notmatch '^([1-9]|[12][0-9]|30)$') { throw 'RemoteSubnet debe ser una subred IPv4 CIDR explícita, sin comodines.' }
    $addresses=@(Get-NetIPAddress -InterfaceIndex $InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -eq $LocalAddress -and $_.InterfaceAlias -eq $InterfaceAlias -and $_.AddressState -eq 'Preferred' })
    if($addresses.Count -ne 1 -or $addresses[0].PrefixLength -ne [int]$parts[1]) { throw 'La IPv4/interfaz/prefijo actuales no coinciden con los aprobados. Revisá DHCP; no se amplía el alcance.' }
    $ipBytes=$ip.GetAddressBytes();$networkBytes=$network.GetAddressBytes();$remaining=[int]$parts[1]
    for($i=0;$i -lt 4;$i++) {
        $bits=[Math]::Min(8,[Math]::Max(0,$remaining));$mask=if($bits -eq 0){0}else{256-[int][Math]::Pow(2,8-$bits)}
        if(($ipBytes[$i] -band $mask) -ne $networkBytes[$i]) { throw 'RemoteSubnet no es la subred local exacta aprobada o contiene bits de host.' }
        $remaining-=8
    }
    $profiles=@(Get-NetConnectionProfile -InterfaceIndex $InterfaceIndex -ErrorAction Stop)
    if($profiles.Count -ne 1 -or $profiles[0].InterfaceAlias -ne $InterfaceAlias -or $profiles[0].Name -ne $NetworkName) { throw 'La interfaz o nombre de red actual cambió. No se reutiliza la aprobación en otra red.' }
    return $profiles[0]
}
function Get-ManagedRule {
    # A failed query must never be treated as an absent rule.
    $rules=@(Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction Stop | Where-Object Name -eq $NetworkRuleName)
    if($rules.Count -gt 1) { throw 'Hay más de una regla con el nombre reservado. No se modifica ninguna.' }
    if($rules.Count) { return $rules[0] }
    return $null
}
function Read-NetworkState {
    if(-not (Test-Path -LiteralPath $NetworkStatePath)) { return $null }
    try { $state=Get-Content -LiteralPath $NetworkStatePath -Raw | ConvertFrom-Json }
    catch { throw 'El estado de red propio no es legible. No se adopta ni se modifica una regla existente.' }
    $owner=[Guid]::Empty
    if(-not $state -or $state.version -ne 1 -or -not [Guid]::TryParse($state.owner,[ref]$owner) -or $state.ruleName -ne $NetworkRuleName -or $state.originalCategory -ne 'Public' -or $state.phase -notin @('Prepared','Enabled','Disabled') -or $state.localAddress -ne $LocalAddress -or $state.interfaceAlias -ne $InterfaceAlias -or $state.interfaceIndex -ne $InterfaceIndex -or $state.networkName -ne $NetworkName -or $state.remoteSubnet -ne $RemoteSubnet -or $state.program -ne $NetworkProgram) { throw 'El estado de red no corresponde al contrato aprobado actual. No se modifica red ni firewall.' }
    return $state
}
function Save-NetworkState($State) {
    $temporary=$NetworkStatePath+'.tmp'
    [IO.File]::WriteAllText($temporary,($State | ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($true))
    if(Test-Path -LiteralPath $NetworkStatePath) { [IO.File]::Replace($temporary,$NetworkStatePath,[NullString]::Value) }
    else { [IO.File]::Move($temporary,$NetworkStatePath) }
}
function Assert-OwnedNetworkRule($Rule,$State) {
    $description='Scalaris Network-Lan.ps1 owner='+$State.owner
    if($Rule.Name -ne $NetworkRuleName -or $Rule.Description -ne $description -or $Rule.DisplayName -ne 'Scalaris Backoffice LAN 8081' -or $Rule.Enabled -ne 'True' -or $Rule.Direction -ne 'Inbound' -or $Rule.Action -ne 'Allow' -or $Rule.Profile -ne 'Private' -or $Rule.EdgeTraversalPolicy -ne 'Block') { throw 'La regla existente no es la regla propia exacta. No se adopta, modifica ni elimina.' }
    $port=$Rule | Get-NetFirewallPortFilter
    $address=$Rule | Get-NetFirewallAddressFilter
    $application=$Rule | Get-NetFirewallApplicationFilter
    $interface=$Rule | Get-NetFirewallInterfaceFilter
    $remoteParts=$RemoteSubnet.Split('/');$maskBytes=@();$remaining=[int]$remoteParts[1]
    for($i=0;$i -lt 4;$i++) { $bits=[Math]::Min(8,[Math]::Max(0,$remaining));$maskBytes+=if($bits -eq 0){0}else{256-[int][Math]::Pow(2,8-$bits)};$remaining-=8 }
    $equivalentMask=$remoteParts[0]+'/'+($maskBytes -join '.')
    $remoteAddresses=@($address.RemoteAddress)
    $exactRemote=($remoteAddresses.Count -eq 1 -and $remoteAddresses[0] -in @($RemoteSubnet,$equivalentMask))
    if($port.Protocol -ne 'TCP' -or (@($port.LocalPort) -join ',') -ne '8081' -or (@($port.RemotePort) -join ',') -ne 'Any' -or (@($address.LocalAddress) -join ',') -ne $LocalAddress -or -not $exactRemote -or $application.Program -ne $NetworkProgram -or (@($interface.InterfaceAlias) -join ',') -ne $InterfaceAlias) { throw 'Los filtros de la regla propia cambiaron. No se modifica ni elimina una regla con otro alcance.' }
}
function Assert-NoLanListener {
    $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 8081 -and $_.LocalAddress -in @($LocalAddress,'0.0.0.0','::') })
    if($listeners.Count) { throw 'El puerto 8081 sigue escuchando en LAN. Detené Scalaris antes de cambiar el perfil o revertir la regla; volver a Public podría activar otra regla existente.' }
}
function Restore-OwnedNetwork($State) {
    $profile=Assert-ApprovedNetwork
    $rule=Get-ManagedRule
    if($rule) { Assert-OwnedNetworkRule $rule $State }
    if($profile.NetworkCategory -notin @('Public','Private')) { throw 'El perfil actual no coincide con el estado esperado. Reversión detenida sin tocar otro perfil.' }
    Assert-NoLanListener
    if($rule) {
        # Recheck identity and rule filters immediately before removing only the owned rule.
        $null=Assert-ApprovedNetwork
        $rule=Get-ManagedRule
        Assert-OwnedNetworkRule $rule $State
        $rule | Remove-NetFirewallRule -ErrorAction Stop
        if(Get-ManagedRule) { throw 'La regla propia no terminó de eliminarse. Se conserva el estado para revisar o reintentar.' }
    }
    $profile=Assert-ApprovedNetwork
    if($profile.NetworkCategory -eq 'Private') {
        Assert-NoLanListener
        Set-NetConnectionProfile -InterfaceIndex $InterfaceIndex -NetworkCategory Public -ErrorAction Stop
        if((Assert-ApprovedNetwork).NetworkCategory -ne 'Public') { throw 'El perfil original no quedó restaurado. Se conserva el estado para reintentar.' }
    }
    $State.phase='Disabled'
    Save-NetworkState $State
}
function Invoke-ApprovedNetworkAction {
    $profile=Assert-ApprovedNetwork
    $state=Read-NetworkState
    $rule=Get-ManagedRule
    if($rule -and -not $state) { throw 'Ya existe una regla con ese nombre sin estado propio. No se adopta ni se modifica.' }
    if($rule) { Assert-OwnedNetworkRule $rule $state }
    if($Action -eq 'Disable') {
        if(-not $state) { Write-Host 'No hay activación de red propia para revertir. No se modificó nada.';return }
        if($state.phase -eq 'Disabled') {
            if($rule) { throw 'El estado ya está revertido pero reapareció una regla. Revisá la inconsistencia; no se modifica nada.' }
            Write-Host 'La activación propia ya está revertida. No se cambia un perfil que haya sido modificado posteriormente.'
            return
        }
        Restore-OwnedNetwork $state
        Write-Host 'Red revertida: solo se eliminó la regla propia; esta red volvió a su perfil Public original. No se detuvo la aplicación.'
        return
    }
    if($state -and $state.phase -eq 'Enabled' -and $rule -and $profile.NetworkCategory -eq 'Private') { Write-Host 'La regla LAN propia y el perfil aprobado ya están activos. No se duplicó ni modificó nada.';return }
    if($profile.NetworkCategory -ne 'Public' -and -not ($state -and $state.phase -ne 'Disabled' -and $profile.NetworkCategory -eq 'Private')) { throw 'El perfil esperado antes de habilitar es Public. No se cambia ni se adopta un perfil distinto sin revisar la aprobación.' }
    if(-not $state) {
        $state=[PSCustomObject]@{version=1;owner=[Guid]::NewGuid().ToString();ruleName=$NetworkRuleName;originalCategory='Public';phase='Prepared';localAddress=$LocalAddress;interfaceAlias=$InterfaceAlias;interfaceIndex=$InterfaceIndex;networkName=$NetworkName;remoteSubnet=$RemoteSubnet;program=$NetworkProgram;preparedAt=[DateTime]::UtcNow.ToString('o')}
    }
    $state.phase='Prepared'
    # Persist the original profile and complete rule contract BEFORE any network writes.
    Save-NetworkState $state
    try {
        Assert-NoLanListener
        $profile=Assert-ApprovedNetwork
        if($profile.NetworkCategory -eq 'Public') { Set-NetConnectionProfile -InterfaceIndex $InterfaceIndex -NetworkCategory Private -ErrorAction Stop }
        if((Assert-ApprovedNetwork).NetworkCategory -ne 'Private') { throw 'La interfaz no quedó en el perfil Private aprobado.' }
        $rule=Get-ManagedRule
        if($rule) { Assert-OwnedNetworkRule $rule $state }
        else {
            $description='Scalaris Network-Lan.ps1 owner='+$state.owner
            $null=New-NetFirewallRule -PolicyStore PersistentStore -Name $NetworkRuleName -DisplayName 'Scalaris Backoffice LAN 8081' -Description $description -Enabled True -Direction Inbound -Action Allow -Profile Private -Protocol TCP -LocalPort 8081 -RemotePort Any -LocalAddress $LocalAddress -RemoteAddress $RemoteSubnet -InterfaceAlias $InterfaceAlias -Program $NetworkProgram -EdgeTraversalPolicy Block -ErrorAction Stop
        }
        $rule=Get-ManagedRule
        if(-not $rule) { throw 'La regla propia no quedó creada.' }
        Assert-OwnedNetworkRule $rule $state
        $state.phase='Enabled'
        Save-NetworkState $state
    } catch {
        $originalError=$_
        try { Restore-OwnedNetwork $state }
        catch { Write-Warning 'La reversión automática no pudo verificarse. Se conserva el estado original; no se eliminan reglas ajenas. Revisá la regla y repetí Disable sobre esta misma red.' }
        throw $originalError
    }
    Write-Host "LAN preparada para $RemoteSubnet en $InterfaceAlias/${NetworkName}: perfil Private, TCP 8081, IP $LocalAddress y Java 25. No se inició la aplicación ni se abrió PostgreSQL."
}

# Main entry: require elevation before creating state files or changing anything.
Assert-NetworkAdministrator
. (Join-Path $PSScriptRoot 'Common.ps1')
if($Scalaris.Port -ne 8081) { throw 'Este contrato de red se limita al puerto aprobado 8081.' }
$NetworkProgram=Resolve-Java
$NetworkRuleName='Scalaris-Backoffice-LAN-8081'
$NetworkStatePath=Join-Path $RuntimeRoot 'network-lan.json'
$operation=Lock-ScalarisOperation
try { Invoke-ApprovedNetworkAction } finally { $operation.Dispose() }
