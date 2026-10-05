# Verificación local de Scalaris · 4 de octubre de 2026

Trabajo realizado en Windows sobre `C:\laburo\Scalaris`, rama existente `codex/backoffice-v1`. El staging previo del usuario se preservó: no se hizo git add, commit, push, deploy ni cambios en QA/producción. No se encontraron AGENTS.md en la raíz, ancestros o subcarpetas revisadas. `VALIDATION.md` conserva la validación histórica del 3/10; este documento registra el entorno real y las verificaciones nuevas.

## Diagnóstico e intervención incremental

Backend existente: Spring Boot 3.5.16, Maven, JDBC/JdbcTemplate, Flyway y PDFBox. No hay wrapper Maven/Gradle, JPA, Hibernate ni Lombok utilizados. Frontend existente: React 19.3.0, TypeScript 5.9.3, Vite 8.3.2, Vitest y Playwright, pnpm-lock.yaml. No hay script de lint. Se respetó pnpm; npm ci no corresponde sin package-lock.

Problemas confirmados por código: Api contenía SQL y acceso directo a Store/JDBC; Store.balance calculaba saldo y estado; Workflow mezclaba coordinación con transiciones; el contrato GET dependía de filas JDBC sin proyección explícita; App y QuoteEditor mezclaban JSX con coordinación HTTP. React duplicaba la selección de estados pendientes y podía mostrar un cálculo tardío correspondiente a una edición anterior. IntelliJ tenía SDK 1.8 para Scalaris. Los scripts usaban 5432/scalaris mientras el cambio local en application.properties apuntaba a 5433/postgres.

Ya estaban bien: Money centralizaba BigDecimal y HALF_UP; el backend era autoritativo sobre importes; existían transacciones, bloqueos y versiones para concurrencia; snapshots de presupuestos y PDF, pagos/eventos inmutables, validación de archivos e importación; api.ts separaba transporte HTTP. No se encontró SQL en React. La fecha de vencimiento del frontend se conservó como sugerencia editable, sin agregar otro endpoint.

Secuencia ejecutada: inspección y caracterización del original; instalación de runtimes aislada de Molineros; refactors concretos con contratos preservados; verificación de identidad y respaldo; migración real; tests en bases descartables; arranque y smoke de solo lectura contra la base real; segunda validación de arranque y revisión del diff.

## Versiones, procedencia y aislamiento

| Herramienta | Versión y ruta comprobadas |
|---|---|
| Java Scalaris | Temurin 25.0.4.1+1 LTS x64, `C:\Program Files\Java\jdk-25.0.4.1+1` |
| Java global/Molineros | Java 8u251 y JAVA_HOME `C:\Program Files\Java\jdk1.8.0_251`, conservados |
| Maven | 3.9.12, `artifacts/tooling/apache-maven-3.9.12/bin/mvn.cmd`; JVM efectiva Temurin 25.0.4.1 instalada |
| Node / npm | Node 24.21.0 LTS Krypton / npm 11.19.0, `C:\Users\Jerem\AppData\Local\Programs\nodejs24\node-v24.21.0-win-x64` |
| pnpm | 11.19.0, `C:\Users\Jerem\AppData\Local\Programs\ScalarisTools\pnpm.cmd` |
| PostgreSQL real | 18.6, herramientas `C:\Program Files\PostgreSQL\18\bin`, loopback:5433 |
| PostgreSQL Molineros | Servicio postgresql-9.6 / 5432, conservado sin reinicio ni reconfiguración |

Adoptium API oficial seleccionó Temurin 25.0.4.1+1 y enlazó el ZIP de adoptium/temurin25-binaries. SHA-256 del ZIP verificado: `00c847d804f4a78e9f04f2683faf14fed898535b177b7fc704486cb0284e9283`. ZIP Node de nodejs.org/dist/v24.21.0, verificado contra SHASUMS256 oficial: `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`. No se eligió Node 26 Current. La instalación final Java requirió UAC normal, aceptado por el usuario.

La falta inicial de npm se debía a que solo el Node del runtime de Codex estaba en el PATH del proceso, sin una instalación habitual Node/npm. Después de instalar Node para el usuario, una terminal nueva verificó node, npm.cmd, npm y pnpm.cmd. Se agregaron rutas al final del PATH de usuario conservando todas las anteriores; PATH de máquina y JAVA_HOME global no cambiaron.

Inicialmente Windows PowerShell tenía política efectiva Restricted y bloqueó el instalador local. El usuario cambió explícitamente su instrucción inicial y autorizó quitar esa restricción. Se aplicó RemoteSigned exclusivamente a CurrentUser, sin Bypass, Unrestricted ni cambios en Machine/GPO. Los scripts del proyecto se guardaron como UTF-8 con BOM para que Windows PowerShell 5.1 interprete correctamente textos en español.

IntelliJ: `.idea/misc.xml` del backend apunta a `Scalaris Temurin 25`, nivel JDK_25; se agregó ese SDK en la tabla de IntelliJ manteniendo la definición 1.8. Los originales se conservaron fuera de Git. Se verificaron los archivos guardados; la recarga en memoria del IDE abierto no se comprobó.

Spring Boot 3.5.16 declara compatibilidad Java 17–25; se conservó esa versión. Compiler 3.14.1, Surefire 3.5.6 y JDBC 42.7.11 se mantuvieron. Flyway 11.7.2 advertía soporte máximo PostgreSQL 17; antes de migrate se actualizó únicamente flyway.version a 11.14.1 dentro de la línea 11, con soporte PostgreSQL 18. PDFBox 3.0.7 se mantuvo y se comprobó con PDF real en Java 25. No se halló certificación individual expresa de Java 25 para cada biblioteca; se distingue compatibilidad documentada de ejecución comprobada. Fuentes y evidencia completas en `artifacts/runtime-20261004/compatibility.json` y `runtimes.json`.

Fuentes oficiales: [Adoptium](https://adoptium.net/temurin/releases/), [roadmap Java LTS](https://www.oracle.com/java/technologies/java-se-support-roadmap.html), [Node LTS](https://nodejs.org/en/about/previous-releases), [Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/system-requirements.html), [Maven 3.9.12](https://maven.apache.org/docs/3.9.12/release-notes.html), [Flyway 11.14.1 / PostgreSQL 18](https://github.com/flyway/flyway/blob/flyway-11.14.1/flyway-database/flyway-database-postgresql/src/main/java/org/flywaydb/database/postgresql/PostgreSQLDatabase.java).

## Refactors y pruebas que los demuestran

| Problema | Cambio / criterio | Evidencia |
|---|---|---|
| SQL y persistencia en REST | Api delega, BackofficeQueries coordina y BackofficeRepository consulta; SRP, cohesión y bajo acoplamiento | ApiContractTest y HTTP real de PostgresTest conservan JSON, errores y headers PDF |
| Reglas de saldo/pagos en Store | Account experto inmutable; Store obtiene hechos, Payments coordina la transacción | ServiceCharacterizationTest cubre impago/parcial/pagado, saldo, sobrepago y revisión por debajo de lo cobrado |
| Transiciones en Workflow y pendientes duplicados en React | CaseState concentra reglas; dashboard envía pendingCases autoritativo | Caracterización de estados/reapertura/entrega; integración dashboard/OPEN; UI muestra el valor recibido |
| Filas JDBC como contrato | ApiViews incluye DTOs y proyección explícita, sin publicar columnas nuevas accidentalmente | DomainTest verifica exclusión de campo interno y copia del JSON; contrato REST preservado |
| Snapshot mutable de Money.Result | Copias defensivas al construir y obtener; encapsulación | DomainTest modifica snapshot recibido sin alterar resultado original |
| JSX y coordinación HTTP juntos | useBackofficeData y useQuoteDraft mantienen estado y solicitudes; componentes presentan | 5 Vitest y 3 Playwright con API simulada |
| Cálculo viejo reaparece después de editar | Contador de versión del borrador invalida respuestas anteriores | La regresión falló antes del fix y pasó después; traza previa conservada |
| Riesgo de base/puerto erróneos o migración al iniciar sin respaldo | LocalDatabase verifica identidad; real/restore solo validan; Migrate.ps1 respalda antes de migrar | DatabaseGuardTest verifica identidades y migrate nunca llamado para real/restore; arranques reales validan sin migrar |
| Rollback sin evidencia específica | Test falla después de asignar número/versión al editar una revisión inexistente | PostgreSQL revierte número/versión y no deja revisión/evento parcial |

Se aplicaron SRP y Experto donde había evidencia, composición y dependencias explícitas. No se agregaron interfaces por clase, jerarquías ni extensiones hipotéticas para aparentar OCP/LSP/ISP/DIP. La persistencia JDBC y el SQL transaccional de los servicios de escritura existentes se conservaron: no se afirma que todo el SQL haya sido movido a repositorios.

## Migración REAL, historial y datos

La base existente se identificó mediante la configuración local y esta consulta antes de escribir:

```sql
SELECT current_database(), version(), inet_server_addr(), inet_server_port();
```

Resultado: `scalaris`, PostgreSQL 18.6 x64 Windows, `127.0.0.1`, `5433`. Usuario `postgres`, esquema `public`, listen_addresses `localhost`. No se inventó ni creó otra base como destino real. Antes no había tablas públicas ni historial: no existía esquema legado a incorporar mediante baseline.

La credencial ya configurada se utilizó sin imprimirla y se preservó en un PSCredential protegido con DPAPI del usuario en `C:\Users\Jerem\ScalarisData\credentials\postgres-5433.clixml`, fuera del repositorio. config.local solo referencia su ruta. application.properties ahora tiene `spring.datasource.password=${SCALARIS_DB_PASSWORD:}` sin secreto de respaldo. Las variables existentes, vacías y ausentes se restauran exactamente al terminar los scripts, comprobado en PowerShell 7 y Windows PowerShell 5.1.

Se revisaron V1–V3: creación del modelo, seeds editables con ON CONFLICT y restricciones de integridad. No se modificaron esos SQL. Info confirmó las tres pendientes. Validate previo admitió únicamente el estado esperado `*:pending`, manteniendo control de checksums/errores; la validación posterior fue estricta. El primer intento previo se detuvo al detectar la versión Flyway incompatible y el estado pending: no aplicó SQL ni usó repair/baseline/clean.

Con respaldo completo verificado, Migrate.ps1 ejecutó info, validate, migrate, validate e info. Historial real:

| Rank | Versión | Script | Checksum | Estado |
|---|---|---|---|---|
| 1 | 1 | V1__model.sql | -967404013 | Success |
| 2 | 2 | V2__editable_catalog.sql | -735505370 | Success |
| 3 | 3 | V3__revision_and_reversal_integrity.sql | -2106124092 | Success |

Una segunda corrida de migración informó esquema actualizado, sin ninguna migración necesaria. Los 21 CHECK/FK revisados están convalidated=true. Conteos reales finales: clients=0, cases=0, revisions=0, payments=0, attachments=0, events=0; catalog=29 y distinct seed_key=29. Los datos comerciales siguen vacíos como al comienzo; solo se incorporaron los seeds previstos. Historial idéntico antes/después de los arranques, sin seeds duplicados.

Evidencia ignorada por Git: `artifacts/verification-20261004/migration.log`, `migration-repeat.log`, `database-after-migration.txt`, `history-final.jsonl`, `real-smoke-counts.json` y `database-identity-final.json`.

## Respaldos y restauración comprobada

Respaldos fuera del repositorio:

- Previo: `C:\Users\Jerem\ScalarisData\backups\pre-migration-20261004`.
- Asociado a la migración: `C:\Users\Jerem\ScalarisData\backups\migration-20261004`.
- Posterior: `C:\Users\Jerem\ScalarisData\backups\post-migration-20261004`.
- Previo a repetir migrate: `C:\Users\Jerem\ScalarisData\backups\repeat-migration-20261004`.

Cada copia contiene database.dump custom, database.toc.txt, attachments y manifest.json con SHA-256. pg_dump18.6 terminó con exit0; pg_restore18.6 leyó TOC y se verificaron hashes. Se corrigió el respaldo/restauración para admitir legítimamente el destino inicial sin tabla attachments.

Se restauraron el respaldo previo y el posterior usando Restore.ps1, sin sobrescribir ni borrar nada, en `scalaris_restore_premigration_20261004` y `scalaris_restore_postmigration_20261004`, ambas PG18/5433. La primera conservó cero tablas públicas; la segunda conservó el historial V1–V3/checksums y 29 seeds distintos. Almacenamientos nuevos en ScalarisData/restore-premigration-20261004 y restore-postmigration-20261004. Estas bases son verificación de restauración, no el destino de uso.

SHA-256 de database.dump previo: `30169183A36B178258077FA635A23D78554C7B7F458F2479C66FFD9104AE3345`; posterior: `072473B90B5405169870E78625028A8ED2A24DD9D3519286B6CF659C55F3401D`.

Restauración reproducible, eligiendo nombres/rutas NUEVOS:

```powershell
Set-Location C:\laburo\Scalaris
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Restore.ps1 `
  -Backup 'C:\Users\Jerem\ScalarisData\backups\post-migration-20261004' `
  -Database 'scalaris_restore_revision_nueva' `
  -Storage 'C:\Users\Jerem\ScalarisData\restore-revision-nueva\attachments'
# Revisar la base restaurada; config.local sigue apuntando al destino original.
.\backoffice\scripts\Start.ps1 -Mode Local
```

No guardar los dumps/datos en Git. Para recuperación, revisar y cambiar configuración de forma explícita; el script no reemplaza el destino real.

## Verificaciones ejecutadas

| Verificación | Resultado real |
|---|---|
| Caracterización original antes del refactor | 15/15 con el Java21 previamente usado por el proyecto; se distingue del resultado final25 |
| package final backend Java25 + PG18 | 39 tests, 0 failures/errors/skipped; release25 / bytecode major69 |
| Test.ps1 en Windows PowerShell 5.1 / Java25 / PG18 | 39/39, incluidos 19 tests PostgreSQL; sin omisiones |
| pnpm frozen install / Node24.21 | Correcto; pnpm-lock.yaml intacto |
| Vitest | 5/5 |
| TypeScript + Vite | Build correcto, incluido en JAR |
| Playwright | 5/5: 3 coordinación UI con API simulada + 2 recorridos HTTP/PostgreSQL reales de prueba |
| Sitio público | scripts/check.mjs aprobado y 5/5 public-form.test.mjs |
| Build.ps1 en Windows PowerShell 5.1 | React/Maven/package/público correcto; -SkipTests solo para empaquetar después de los tests completos ya aprobados |
| API de base REAL migrada | health/dashboard/clients/cases/catalog/audit HTTP200; React servido por el mismo JAR |
| Navegador contra base REAL | Chromium sin mocks: 20 GET HTTP200, 0 errores JS, 0 intentos de mutación; inicio/clientes/consultas/catálogo29/auditoría correctos |
| Segundo arranque REAL | Valida V1–V3 sin migrate; historial y seeds iguales |
| Backup con app abierta | Rechazado por bloqueo de almacenamiento; no creó destino de copia |
| PDF Java25 | Descarga HTTP200/application-pdf, 25.617 bytes, A4/1 página; render Poppler y extracción pypdf con texto/importes correctos |
| Adjuntos y saldo | TXT descargado idéntico; caso entregado, total15000/pago1500/saldo13500/PARTIAL |
| git diff --check | Correcto; únicamente avisos de conversión habitual LF/CRLF |
| Molineros | Servicios PostgreSQL con mismos PID/estado/ruta; release Java8 mismo SHA-256; JAVA_HOME global8 conservado |

Las escrituras de tests se realizaron únicamente en `scalaris_test_jdk25_20261004` y `scalaris_test_e2e_20261004`, creadas y separadas del destino real. Se conservaron para inspección, sin DROP/TRUNCATE del destino real. Los tests existentes vacían solo su base descartable seleccionada. Los recorridos comprobaron cliente→consulta→diagnóstico→presupuesto15000→aceptación→pago1500→entrega con saldo13500→TXT; y formulario→JSON→importación→duplicado. No se abrió ni envió WhatsApp.

Evidencia: surefire-reports; test-ps51-final.log; build-ps51-final.log; playwright-final.log/json; workflow-smoke.json; presupuesto-jdk25.pdf/png/txt; real-browser-smoke.json/log y real-backoffice.png; capturas desktop/móvil y original-captures-sha256.json. Las capturas originales del 3/10 conservaron sus hashes. La regresión de cálculo tardío conserva trace.zip/error-context antes del fix en frontend-race-before.

Se observan avisos no bloqueantes de Mockito por self-attach futuro, commons-logging y APIs de tests deprecadas; no se ocultaron con flags forzados. pdftotext no estaba disponible y la extracción se comprobó con pypdf incluido; Poppler renderizó correctamente. No se probaron otra PC física/LAN, otros navegadores ni la recarga del SDK en memoria del IDE; no son evidencia de esta ejecución local.

## Operación y archivos

La aplicación se deja iniciada en modo Local en `http://localhost:8081`, contra `scalaris/public` PG18/5433. Se detuvo el servidor público temporal8082 y las instancias de prueba. Los scripts no cambiaron firewall, router o servicios de PostgreSQL. Readiness ahora exige que el puerto pertenezca al proceso Java recién creado, rechaza puerto ocupado y verifica PID/hora/JAR para detener solo la instancia propia.

Comandos desde la raíz:

```powershell
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Build.ps1
.\backoffice\scripts\Migrate.ps1 # respaldo nuevo, valida, solo aplica pendientes
.\backoffice\scripts\Start.ps1 -Mode Local
.\backoffice\scripts\Test.ps1 -Database scalaris_test_jdk25_20261004
pnpm.cmd --dir backoffice/frontend test
```

Build sin variable TEST explícita puede omitir integración; Test.ps1 es el comando comprobado que exige la base descartable y ejecuta esos tests. Para npm usar npm.cmd; para dependencias del frontend usar pnpm.cmd install --frozen-lockfile.

Archivos de backend modificados: pom.xml; Api, Errors, Files, LocalDatabase, Money, Payments, Quotes, Store, Workflow; application.properties; RulesTest y PostgresTest. Nuevos: Account, CaseState, BusinessRuleException, ApiViews, BackofficeQueries, BackofficeRepository; ApiContractTest, ServiceCharacterizationTest, DomainTest y DatabaseGuardTest.

Frontend: App.tsx, QuoteEditor.tsx, api.test.ts, package.json (packageManager/engines) y rutas de capturas workflow.spec.ts; nuevos useBackofficeData.ts, useQuoteDraft.ts, coordination.spec.ts. No se modificó el lockfile.

Operación/documentación: Common, Build, Start, Stop, Backup, Restore y config.example; nuevos Migrate.ps1, Test.ps1 y este informe; README actualizado. Config.local, credencial DPAPI, .idea/SDK, runtimes, JAR, logs y respaldos son locales. Migraciones SQL V1–V3 y funcionalidades del sitio público preservadas.
