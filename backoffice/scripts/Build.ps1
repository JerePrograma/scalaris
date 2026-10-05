param([switch]$SkipTests)
. (Join-Path $PSScriptRoot 'Common.ps1')
$operation=Lock-ScalarisOperation
$previousEnvironment=Save-ScalarisEnvironment
try {
if(Read-OwnedProcess){throw 'Detené Scalaris antes de reconstruir el JAR.'}
if(Get-NetTCPConnection -State Listen -LocalPort $Scalaris.Port -ErrorAction SilentlyContinue) { throw "Hay una instancia o proceso en el puerto $($Scalaris.Port). Coordiná su parada antes del build; no se detiene un proceso ajeno." }
Set-ScalarisToolchain -WithNode
$maven=Resolve-Tool $Scalaris.MavenCommand 'mvn.cmd' 'artifacts\tooling\apache-maven-*\bin\mvn.cmd'
$pnpm=Resolve-Tool $Scalaris.PnpmCommand 'pnpm.cmd' ''
Push-Location (Join-Path $BackofficeRoot 'frontend')
try { Invoke-Checked $pnpm @('install','--frozen-lockfile'); Invoke-Checked $pnpm @('run','build'); if(-not $SkipTests){Invoke-Checked $pnpm @('run','test')} } finally { Pop-Location }
# Regenerate only compiled React resources; preserve sources, dependencies and unrelated files.
$compiledRoot=[IO.Path]::GetFullPath((Join-Path $BackofficeRoot 'backend\target\classes'))
$compiledStatic=[IO.Path]::GetFullPath((Join-Path $compiledRoot 'static'))
if($compiledStatic -ne (Join-Path $compiledRoot 'static') -or -not $compiledStatic.StartsWith($BackofficeRoot+'\backend\target\',[StringComparison]::OrdinalIgnoreCase)) { throw 'La ruta de recursos compilados no está dentro de backend/target. Build detenido.' }
if(-not (Test-Path -LiteralPath (Join-Path $BackofficeRoot 'frontend\dist\index.html'))) { throw 'El build React no generó dist/index.html; no se modifica el empaquetado anterior.' }
foreach($generatedPath in @((Join-Path $BackofficeRoot 'backend\target'),$compiledRoot,$compiledStatic)) {
    if(Test-Path -LiteralPath $generatedPath) {
        $generatedItem=Get-Item -LiteralPath $generatedPath -Force
        if($generatedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Los recursos compilados contienen un enlace o junction. No se elimina ningún archivo.' }
    }
}
if(Test-Path -LiteralPath $compiledStatic) {
    if(Get-ChildItem -LiteralPath $compiledStatic -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Los recursos compilados contienen enlaces. No se elimina ningún archivo.' }
    Remove-Item -LiteralPath $compiledStatic -Recurse -Force
}
Push-Location (Join-Path $BackofficeRoot 'backend')
try { $arguments=@('--batch-mode','--no-transfer-progress','package');if($SkipTests){$arguments+='-DskipTests'};Invoke-Checked $maven $arguments } finally { Pop-Location }
Push-Location $RepoRoot
try { Invoke-Checked 'node' @('scripts/check.mjs');Invoke-Checked 'node' @('--test','scripts/public-form.test.mjs') } finally { Pop-Location }
Write-Host "Build listo: $JarPath"
} finally { Restore-ScalarisEnvironment $previousEnvironment; $operation.Dispose() }
