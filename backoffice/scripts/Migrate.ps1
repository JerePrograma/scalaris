param([string]$BackupDestination='')
. (Join-Path $PSScriptRoot 'Common.ps1')
if(Read-OwnedProcess) { throw 'Detené Scalaris antes de migrar y respaldar.' }
$previousEnvironment=Save-ScalarisEnvironment
try {
    Set-ScalarisToolchain
    Set-DatabaseEnvironment
    $identity=Assert-DatabaseIdentity
    Write-Host ($identity | ConvertTo-Json -Compress)
    $psql=Pg-Tool 'psql.exe'
    $history=& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT to_regclass('public.flyway_schema_history') IS NOT NULL;"
    if($LASTEXITCODE -ne 0) { throw 'No se pudo verificar historial.' }
    if($history -eq 'f') {
        $tables=& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
        if($LASTEXITCODE -ne 0) { throw 'No se pudo verificar esquema previo.' }
        if([long]$tables -ne 0) { throw 'Esquema previo sin historial Flyway: requiere un plan y aprobación explícita; no se ejecuta baseline.' }
    }
    $maven=Resolve-Tool $Scalaris.MavenCommand 'mvn.cmd' 'artifacts\tooling\apache-maven-*\bin\mvn.cmd'
    Push-Location (Join-Path $BackofficeRoot 'backend')
    try {
        Invoke-Checked $maven @('--batch-mode','--no-transfer-progress','flyway:info')
        # Before migrate only pending scripts are expected; checksum/missing/failed validation remains active.
        Invoke-Checked $maven @('--batch-mode','--no-transfer-progress','flyway:validate','-Dflyway.ignoreMigrationPatterns=*:pending')
        & (Join-Path $PSScriptRoot 'Backup.ps1') -Destination $BackupDestination
        if(-not $?) { throw 'Respaldo falló: no se migrará.' }
        Invoke-Checked $maven @('--batch-mode','--no-transfer-progress','flyway:migrate','flyway:validate','flyway:info')
        Invoke-Checked $psql @('-X','-w','-v','ON_ERROR_STOP=1','-c','SELECT installed_rank,version,description,type,script,checksum,success FROM public.flyway_schema_history ORDER BY installed_rank;')
    } finally { Pop-Location }
} finally { Restore-ScalarisEnvironment $previousEnvironment }
