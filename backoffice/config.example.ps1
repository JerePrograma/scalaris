# Copiar a config.local.ps1 (ignorado por Git). No contiene secretos.
$Scalaris = @{
    Port = 8081
    LanAddress = '' # IPv4 privada actual aprobada por el propietario; obligatorio para -Mode Lan.
    LanInterfaceAlias = '' # Interfaz aprobada, ej. Wi-Fi; debe conservar perfil Private. No se cambia automáticamente.
    LanNetworkName = '' # Nombre exacto de la red aprobada (Get-NetConnectionProfile.Name); impide reutilizar el permiso en otra red.
    DbHost = '127.0.0.1'
    DbPort = 5433
    DbName = 'scalaris'
    DbUser = 'postgres' # Cuenta local existente; no cambia roles de PostgreSQL.
    Storage = (Join-Path $env:USERPROFILE 'ScalarisData\attachments')
    BackupDirectory = (Join-Path $env:USERPROFILE 'ScalarisData\backups')
    JdkHome = 'C:\Program Files\Java\jdk-25.0.4.1+1' # Exclusivo de Scalaris; no cambia JAVA_HOME global.
    NodeHome = '' # Instalación Node 24 LTS; configurar la ruta real en config.local.ps1.
    MavenCommand = '' # mvn.cmd o ruta absoluta
    PnpmCommand = '' # pnpm.cmd o ruta absoluta
    PgBin = 'C:\Program Files\PostgreSQL\18\bin' # psql/pg_dump/pg_restore/createdb compatibles.
    CredentialFile = '' # PSCredential protegido con DPAPI del usuario, fuera del repositorio.
}
# Contraseña Java: SCALARIS_DB_PASSWORD en la sesión o CredentialFile DPAPI existente.
# Un pgpass propio solo sirve para herramientas PostgreSQL; no configura Spring/JDBC.
# Los scripts no inventan, imprimen ni guardan contraseñas.
