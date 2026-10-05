param([Parameter(Mandatory)][string]$Backup,[Parameter(Mandatory)][ValidatePattern('^scalaris_restore_[a-zA-Z0-9_]+$')][string]$Database,[Parameter(Mandatory)][string]$Storage)
. (Join-Path $PSScriptRoot 'Common.ps1')
$previousEnvironment=Save-ScalarisEnvironment
try {
Set-DatabaseEnvironment
$null=Assert-DatabaseIdentity
$sourcePath=[IO.Path]::GetFullPath($Backup);$targetPath=[IO.Path]::GetFullPath($Storage)
if($targetPath.StartsWith($RepoRoot+'\',[StringComparison]::OrdinalIgnoreCase)-or(Test-Path -LiteralPath $targetPath)){throw 'Almacenamiento de restauración debe ser nuevo y fuera del repositorio.'}
if($Database -eq $Scalaris.DbName){throw 'No se restaura sobre la base configurada.'}
$manifest=Get-Content -LiteralPath (Join-Path $sourcePath 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.version -ne 1){throw 'Versión de respaldo inválida.'}
foreach($property in $manifest.hashes.PSObject.Properties){$relative=$property.Name;if($relative -notin @('database.dump','database.toc.txt') -and $relative -notmatch '^attachments[\\/][0-9a-f-]{36}$'){throw 'Ruta de manifest inválida.'};$file=Join-Path $sourcePath $relative;if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $property.Value){throw "Checksum incorrecto: $relative"}}
if(-not $manifest.hashes.PSObject.Properties['database.dump']){throw 'Falta hash de base.'}
$restore=Pg-Tool 'pg_restore.exe';$createdb=Pg-Tool 'createdb.exe';$psql=Pg-Tool 'psql.exe'
$lock=Lock-Storage
try{
    if($env:SCALARIS_DB_PASSWORD){$env:PGPASSWORD=$env:SCALARIS_DB_PASSWORD}
    # createdb fails if name exists. No --clean, DROP, TRUNCATE, or overwrite.
    Invoke-Checked $createdb @($Database)
    Invoke-Checked $restore @('--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname',$Database,(Join-Path $sourcePath 'database.dump'))
    [IO.Directory]::CreateDirectory($targetPath)|Out-Null
    $env:PGDATABASE=$Database
    $hasModel=& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT to_regclass('public.attachments') IS NOT NULL";if($LASTEXITCODE -ne 0){throw 'Falló lectura de esquema restaurado.'}
    $refs=@()
    if($hasModel -eq 't') { $refs=@(& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT storage_name::text || '|' || sha256 FROM attachments ORDER BY id" | Where-Object { $_ });if($LASTEXITCODE -ne 0){throw 'Falló lectura de adjuntos restaurados.'} }
    foreach($ref in $refs){$parts=$ref.Split('|');$name=$parts[0];if($name -notmatch '^[0-9a-f-]{36}$'-or$parts.Count -ne 2){throw 'Referencia inválida.'};$relative='attachments\'+$name;if(-not $manifest.hashes.PSObject.Properties[$relative]){throw 'Adjunto no incluido en manifest.'};$file=Join-Path $sourcePath $relative;if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $parts[1]){throw 'Adjunto no coincide con referencia en la base restaurada.'};Copy-Item -LiteralPath $file -Destination (Join-Path $targetPath $name)}
    if($hasModel -eq 't') { Invoke-Checked $psql @('-X','-w','-v','ON_ERROR_STOP=1','-c','SELECT (SELECT count(*) FROM clients) clients,(SELECT count(*) FROM cases) cases,(SELECT count(*) FROM revisions) revisions,(SELECT count(*) FROM payments) payments,(SELECT count(*) FROM attachments) attachments,(SELECT count(*) FROM events) events;') }
    else { Invoke-Checked $psql @('-X','-w','-v','ON_ERROR_STOP=1','-c',"SELECT count(*) AS public_tables FROM pg_tables WHERE schemaname='public';") }
    Write-Host "Restauración en base separada verificada: $Database; adjuntos: $targetPath. Para usarla, revisá y cambiá config.local.ps1 manualmente."
}finally{$lock.Dispose()}
} finally { Restore-ScalarisEnvironment $previousEnvironment }
