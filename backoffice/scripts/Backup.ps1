param([string]$Destination='',[ValidatePattern('^scalaris_test_[a-zA-Z0-9_]+$')][string]$TestDatabase='')
. (Join-Path $PSScriptRoot 'Common.ps1')
$previousEnvironment=Save-ScalarisEnvironment
try {
if($TestDatabase){Set-ApplicationEnvironment -TestDatabase $TestDatabase}else{Set-DatabaseEnvironment}
$identity=Assert-DatabaseIdentity
$dump=Pg-Tool 'pg_dump.exe';$psql=Pg-Tool 'psql.exe'
$restore=Pg-Tool 'pg_restore.exe'
$destinationPath=if($Destination){[IO.Path]::GetFullPath($Destination)}else{Join-Path $Scalaris.BackupDirectory ('scalaris-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))}
if($destinationPath.StartsWith($RepoRoot+'\',[StringComparison]::OrdinalIgnoreCase)-or(Test-Path -LiteralPath $destinationPath)){throw 'Destino debe ser nuevo y estar fuera del repositorio.'}
$lock=Lock-Storage
try{
    if($env:SCALARIS_DB_PASSWORD){$env:PGPASSWORD=$env:SCALARIS_DB_PASSWORD}
    [IO.Directory]::CreateDirectory($destinationPath)|Out-Null
    $attachmentsPath=Join-Path $destinationPath 'attachments';[IO.Directory]::CreateDirectory($attachmentsPath)|Out-Null
    Invoke-Checked $dump @('-w','--format=custom','--no-owner','--no-acl','--file',(Join-Path $destinationPath 'database.dump'))
    $toc=@(& $restore --list (Join-Path $destinationPath 'database.dump'));if($LASTEXITCODE -ne 0 -or $toc.Count -eq 0){throw 'Respaldo ilegible por pg_restore.'}
    $toc | Set-Content -LiteralPath (Join-Path $destinationPath 'database.toc.txt') -Encoding utf8
    $hasAttachments=& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT to_regclass('public.attachments') IS NOT NULL";if($LASTEXITCODE -ne 0){throw 'No se pudo verificar esquema de adjuntos.'}
    $references=@()
    if($hasAttachments -eq 't') { $references=@(& $psql -X -w -v ON_ERROR_STOP=1 -At -c "SELECT storage_name::text || '|' || sha256 FROM attachments ORDER BY id" | Where-Object { $_ });if($LASTEXITCODE -ne 0){throw 'No se pudo leer referencias de adjuntos.'} }
    foreach($ref in $references){$parts=$ref.Split('|');$name=$parts[0];if($name -notmatch '^[0-9a-f-]{36}$'-or$parts.Count -ne 2){throw 'Referencia de adjunto inválida.'};$file=Join-Path $storagePath $name;if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $parts[1]){throw 'Adjunto no coincide con su hash en PostgreSQL.'};Copy-Item -LiteralPath $file -Destination (Join-Path $attachmentsPath $name)}
    $hashes=@{};Get-ChildItem -LiteralPath $destinationPath -Recurse -File | ForEach-Object { $relative=$_.FullName.Substring($destinationPath.Length+1);$hashes[$relative]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    @{version=1;createdAt=(Get-Date).ToUniversalTime().ToString('o');database=$Scalaris.DbName;identity=$identity;attachments=$references.Count;hashes=$hashes} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationPath 'manifest.json') -Encoding utf8
    Write-Host "Respaldo coordinado completado: $destinationPath"
}finally{$lock.Dispose()}
} finally { Restore-ScalarisEnvironment $previousEnvironment }
