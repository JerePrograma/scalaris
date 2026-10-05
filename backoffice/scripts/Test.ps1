param([Parameter(Mandatory)][ValidatePattern('^scalaris_test_[a-zA-Z0-9_]+$')][string]$Database)
. (Join-Path $PSScriptRoot 'Common.ps1')
# The existing integration suite resets ONLY the explicitly selected disposable test database.
$previousEnvironment=Save-ScalarisEnvironment
try {
    Set-ScalarisToolchain
    $Scalaris.DbName=$Database
    Set-DatabaseEnvironment
    $null=Assert-DatabaseIdentity
    $env:SCALARIS_TEST_DB_URL=$env:SCALARIS_DB_URL
    $env:SCALARIS_TEST_DB_USER=$env:SCALARIS_DB_USER
    $env:SCALARIS_TEST_DB_PASSWORD=$env:SCALARIS_DB_PASSWORD
    $maven=Resolve-Tool $Scalaris.MavenCommand 'mvn.cmd' 'artifacts\tooling\apache-maven-*\bin\mvn.cmd'
    Push-Location (Join-Path $BackofficeRoot 'backend')
    try { Invoke-Checked $maven @('--batch-mode','--no-transfer-progress','test') }
    finally { Pop-Location }
} finally { Restore-ScalarisEnvironment $previousEnvironment }
