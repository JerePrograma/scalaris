# Rectificación de arquitectura y arranque · 4 de octubre de 2026

Intervención sobre `C:\laburo\Scalaris`, rama existente `codex/backoffice-v1`, horario ART. Se implementó una separación funcional real de paquetes Java y funcionalidades React. El arranque del JAR final por scripts superó conexión PostgreSQL, validación Flyway y adquisición del almacenamiento; respondió HTTP 200 en health y React. El Run efectivo dentro de IntelliJ queda pendiente: los intentos de operar el IDE no proporcionaron una ventana utilizable. Este límite es independiente del bloqueo Scalaris identificado.

`VERIFICATION-20261004.md` y `VALIDATION.md` se preservan como evidencia anterior. No hubo staging, commit, push, despliegue, reset, clean, cambios de firewall/red, instalación/actualización de herramientas, cambios de seguridad/globales, credenciales nuevas ni modificaciones de V1–V3. Se preservaron las 71 entradas y estados del staging recibido, el trabajo anterior y `presupuestos/`. Salidas compiladas anteriores se trasladaron exclusivamente a `artifacts/refactor-20261004/previous-classes` y `previous-test-classes`, tras comprobar las rutas dentro del workspace: permiten inspección y evitan cargar las clases antiguas junto con las nuevas. No se eliminaron datos ni se borró ningún lock real.

## Causa vigente y evidencia

Las dos ejecuciones aportadas tienen causas distintas. El primer SCRAM sin password demuestra contraseña no suministrada a esa conexión, sin probar servidor caído o password incorrecta. La última ejecución aportada conectó Hikari a `127.0.0.1:5433/scalaris`, reconoció PostgreSQL 18.6 y validó tres migraciones; falló al adquirir almacenamiento en Files. Se priorizó ese fallo.

Inspección real: Files abría `FileChannel` sobre `.scalaris.lock` y usaba `tryLock()` exclusivo. Backup/Restore usan `.NET File.Open(OpenOrCreate,ReadWrite,FileShare.None)` sobre el mismo archivo. Es exclusión del sistema, no un marcador de antigüedad. Windows Restart Manager identificó al PID **21776** como propietario del archivo abierto `C:\Users\Jerem\ScalarisData\attachments\.scalaris.lock`. Read-OwnedProcess comprobó PID/hora exacta/JAR; ese proceso, iniciado a las **00:58:09 ART**, escuchaba 8081 y respondía health `ok`. No se identificó respaldo activo pertinente.

El usuario autorizó explícitamente detener solo esa instancia. Se solicitó `System.exit(0)` por Attach local del JDK al proceso comprobado; el log de **01:26:35 ART** confirma `Graceful shutdown complete` y cierre Hikari. Puerto y archivo quedaron libres. No se detuvo PostgreSQL ni se borró el lock, se desactivó la exclusión o se cambió a una carpeta vacía para esconder el conflicto.

Defecto adicional confirmado: Files cerraba el canal cuando tryLock devolvía null, pero podía filtrarlo ante OverlappingFileLockException/IOException. Ahora `storage.StorageLock` es un bean independiente, cierra su canal ante toda adquisición parcial fallida y libera solo su lock/canal al cerrar Spring. Los mensajes incluyen ruta y distinguen ocupado, solapamiento JVM, permisos y E/S; solo el solapamiento comprobado incluye el PID actual. No se confía en metadatos PID residuales.

Files se dividió en `StorageLock`, `AttachmentStorage`, `AttachmentValidator`, `AttachmentService` y `AttachmentRepository`. El rollback limpia exclusivamente el archivo creado por esa carga; CREATE_NEW evita borrar un archivo anterior ante una colisión. La prueba PostgreSQL provoca una falla posterior al INSERT mediante una restricción temporal únicamente en la base descartable y comprueba rollback de archivo, metadata y evento.

`Stop.ps1` ahora revalida PID/hora/JAR y usa el helper local `scripts/java/GracefulStop.java`. Se ejecutan hooks de Spring/JVM, con cierre graceful de Tomcat/Hikari/storage. Si Attach no puede señalizar o excede 30 segundos, no hay terminación forzada. Se maneja la carrera de salida antes de responder a Attach. El helper se compila en `.runtime/stop-helper`, sin endpoint, secreto o dependencia adicional.

## Versiones y configuración verificadas

| Herramienta | Resultado efectivo |
|---|---|
| Java | Temurin 25.0.4.1+1 LTS, `C:\Program Files\Java\jdk-25.0.4.1+1` |
| Maven | 3.9.12, `artifacts/tooling/apache-maven-3.9.12/bin/mvn.cmd`, JVM efectiva Java 25 |
| Node / npm / pnpm | 24.21.0 / 11.19.0 / 11.19.0, instalaciones existentes por usuario |
| PostgreSQL / psql | 18.6, loopback 5433, `C:\Program Files\PostgreSQL\18\bin` |
| Spring Boot / Flyway / PDFBox | 3.5.16 / 11.14.1 / 3.0.7, comprobados en POM/dependencias y ejecución |
| Windows PowerShell | 5.1.26100.9444, suite final y contrato de rutas comprobados |
| IntelliJ instalado | 2026.2.3; módulo Maven `backoffice`, SDK local `Scalaris Temurin 25` en metadata existente |

Java 8 de Molineros y su PostgreSQL 9.6/5432 no se modificaron, detuvieron ni reconfiguraron. JAVA_HOME de usuario conserva `C:\Program Files\Java\jdk1.8.0_251`; no se modificó PATH/SDK/preferencias globales. Las toolchains se ajustan solo en el proceso de Scalaris y se restauran.

| Variable | Fuente y valor no sensible / ausencia |
|---|---|
| SCALARIS_DB_URL | Common: DbHost/DbPort/DbName → JDBC loopback; normal `jdbc:postgresql://127.0.0.1:5433/scalaris` |
| SCALARIS_DB_USER | Common: DbUser; cuenta existente configurada `postgres`, sin cambio de roles |
| SCALARIS_DB_PASSWORD | Entorno del proceso primero; CredentialFile DPAPI existente si falta. Solo presencia comprobada; nunca valor, chat, argumento o archivo versionado. Ausente → error temprano antes de conexión |
| SCALARIS_STORAGE | Common: Storage absoluto; normal `C:\Users\Jerem\ScalarisData\attachments`; prueba derivada de nombre DB |
| SCALARIS_PORT / SCALARIS_BIND | Common: Port 8081 / Local 127.0.0.1; puerto ocupado → rechazo |
| SCALARIS_ORIGINS | Common Local: `http://localhost:8081,http://127.0.0.1:8081`; LAN solo configuración explícita existente |
| PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD | Herramientas PostgreSQL, proceso temporal; conexión coincide y entorno se restaura |
| SCALARIS_TEST_DB_URL / SCALARIS_TEST_DB_USER / SCALARIS_TEST_DB_PASSWORD | Test.ps1: solo base explícita `scalaris_test_*`, con guardia de identidad; password no expuesto |
| SCALARIS_E2E_URL | Pruebas del navegador: `http://127.0.0.1:8081`, instancia descartable comprobada |

PowerShell carga ejemplo y luego config.local. Set-ApplicationEnvironment es común a Start y Start-IntelliJ: claves configuradas sustituyen variables heredadas, salvo password del proceso que tiene prioridad sobre DPAPI. Spring considera argumentos, propiedades JVM, entorno y application.properties en ese orden de prioridad dentro de estas fuentes. No hay perfiles adicionales activos ni .env automático. [Orden oficial Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html). Se eliminó el valor de respaldo sensible encontrado en application.properties; solo queda placeholder vacío.

Start usa working directory raíz; IntelliJ usa backend. Ambos resuelven la misma ruta absoluta y base mediante Common, probado en ambos directorios y PowerShell 5.1, con restauración exacta del entorno. Para otra base se elige su almacenamiento explícitamente; `-TestDatabase` deriva ambos de forma conjunta. No se agregó archivo persistente sensible.

`Start-IntelliJ.ps1` exige IDE cerrado para que no reutilice un proceso con entorno anterior, reutiliza DPAPI en el entorno del hijo y restaura el entorno llamador. `.run/Scalaris_Local.run.xml` fija Application, módulo backoffice, SDK Scalaris Temurin25, Build y UTF-8. `.idea` permanece local/ignorada; se ajustó únicamente la codificación de Scalaris, sin preferencias globales. [Configuración oficial de entornos IntelliJ](https://www.jetbrains.com/help/idea/program-arguments-and-environment-variables.html). Crear XML y ejecutar Maven no se toman como evidencia del Run del IDE.

UTF-8: fuentes/SQL/properties verificados por decodificación estricta antes de cambios; no hubo conversión masiva ni modificación de binarios. Maven fija source/report encoding, Surefire y JAR fijan file/stdout/stderr UTF-8; Spring fuerza charset HTTP UTF-8. Scripts conservan BOM para PowerShell5.1. Configuración IDE fija UTF-8 dentro del proyecto. La lectura visual de acentos en su consola queda pendiente junto con el Run real; no se modificaron preferencias globales de consola.

`dependency:tree` comprobó PDFBox3.0.7 → commons-logging1.3.5. Se excluyó solamente commons-logging en la dependencia PDFBox. La repetición del árbol conserva pdfbox/pdfbox-io/fontbox y spring-jcl6.2.19, sin commons-logging. No se borraron JAR del caché ni se ocultó el aviso mediante configuración de logs.

## Árbol antes, propuesta y árbol final

Antes: 21 clases superiores Java directamente en ar.scalaris: Application, Api, ApiViews, BackofficeQueries, BackofficeRepository, Store, Account, CaseState, Money, BusinessRuleException, Errors, Input, JsonLimits, OriginGuard, LocalDatabase, Workflow, Quotes, Payments, PublicImport, QuotePdf, Files. Nueve anidadas comprobadas en el working tree inicial: ApiViews.Health/Balance/Dashboard/Detail, Money.Result, QuotePdf.Writer, LocalDatabase.Destination/Identity y Files.Download. React tenía App, CaseView, Editors, QuoteEditor, ImportView, api, components y hooks en src.

La propuesta se mostró al usuario antes de mover: controller, service, domain, repository/jdbc, dto/response, mapper, config, exception, storage y features React. El inventario justificó dto/request y service/support, sin model/valueobject ficticios, carpetas vacías o interfaces por clase. Solo Application permanece en el paquete raíz. El inventario final es 54 clases/records superiores y ocho anidados; nested Money.Discount/Line/Totals, QuotePdf.Writer, LocalDatabase.Destination/Identity, StorageLock.Lease y AttachmentService.Download.

Árbol físico final Java:

```text
scalaris/
  config/
    JsonLimits.java
    LocalDatabase.java
    OriginGuard.java
  controller/
    AttachmentController.java
    CaseController.java
    CatalogController.java
    ClientController.java
    Errors.java
    ImportController.java
    PaymentController.java
    QuoteController.java
    ReadController.java
  domain/
    Account.java
    BusinessRuleException.java
    CaseState.java
    Money.java
    QuoteValidity.java
  dto/
    request/
      RequestInput.java
    response/
      Balance.java
      Dashboard.java
      Detail.java
      Health.java
      QuoteCalculation.java
  exception/
    MissingRecordException.java
    RequestErrors.java
  mapper/
    ApiMapper.java
    JsonDocuments.java
  repository/
    jdbc/
      AttachmentRepository.java
      BackofficeRepository.java
      CaseRepository.java
      CatalogRepository.java
      ClientRepository.java
      EventRepository.java
      ImportRepository.java
      JdbcRows.java
      PaymentRepository.java
      RevisionRepository.java
      RowValues.java
      WorkOrderRepository.java
  service/
    support/
      Concurrency.java
    AttachmentService.java
    BackofficeQueries.java
    Catalog.java
    Clients.java
    Payments.java
    PublicImport.java
    QuoteCalculator.java
    QuotePdf.java
    Quotes.java
    Workflow.java
  storage/
    AttachmentStorage.java
    AttachmentValidator.java
    StorageLock.java
  Application.java
```

Árbol físico final React:

```text
src/
  app/
    useBackofficeData.ts
  features/
    audit/
      components/
        AuditScreen.tsx
      api.ts
      types.ts
    cases/
      components/
        AttachmentsPanel.tsx
        CaseEditor.tsx
        CaseList.tsx
        CaseTimeline.tsx
        CaseView.tsx
        CasesScreen.tsx
        PaymentForms.tsx
        PaymentsPanel.tsx
        TransitionForm.tsx
        WorkEditor.tsx
        WorkPanel.tsx
      hooks/
        useCaseDetail.ts
      api.ts
      labels.ts
      types.ts
    catalog/
      components/
        CatalogEditor.tsx
        CatalogScreen.tsx
      api.ts
      labels.ts
      types.ts
    clients/
      components/
        ClientEditor.tsx
        ClientsScreen.tsx
      api.ts
      types.ts
    dashboard/
      components/
        DashboardScreen.tsx
      api.ts
      types.ts
    imports/
      components/
        ImportScreen.tsx
        ImportView.tsx
      api.ts
      types.ts
    quotes/
      components/
        AcceptanceForm.tsx
        QuoteEditor.tsx
        RevisionList.tsx
      hooks/
        useQuoteDraft.ts
      api.ts
      draft.test.ts
      draft.ts
      types.ts
  shared/
    api/
      http.test.ts
      http.ts
    components.tsx
    format.ts
    types.ts
  App.tsx
  main.tsx
  styles.css
```

La prueba Node de dependencias está en frontend/tests/architecture.test.ts, fuera de fuentes del navegador. No se cambiaron estilos, recursos, pnpm-lock ni diseño como efecto de las extracciones.

## Mapa realizado

| Antes | Después en ar.scalaris | Responsabilidad |
|---|---|---|
| Application | Application | Entrada Spring Boot y escaneo de subpaquetes |
| Api GET salud/tablero/clientes/catálogo/casos/detalle/auditoría | controller.ReadController | HTTP de consultas |
| Api escrituras clientes | controller.ClientController | HTTP de clientes |
| Api escrituras catálogo | controller.CatalogController | HTTP de catálogo |
| Api caso, notas, transición, orden | controller.CaseController | HTTP del trabajo |
| Api cotización, revisiones, PDF | controller.QuoteController | HTTP de presupuestos |
| Api pagos, anulaciones | controller.PaymentController | HTTP de pagos |
| Api adjuntos | controller.AttachmentController | HTTP y headers de adjuntos |
| Api importación | controller.ImportController | HTTP de importación manual |
| ApiViews.Health/Balance/Dashboard/Detail | dto.response.Health/Balance/Dashboard/Detail | Contratos JSON explícitos |
| ApiViews proyecciones | mapper.ApiMapper | Whitelist de campos, copia JSON y representación monetaria |
| Input | dto.request.RequestInput | Validación estricta de forma JSON, texto/decimal/fecha y datos admitidos |
| Input bad/conflict | exception.RequestErrors, delegados desde RequestInput | Errores de frontera con HTTP existente |
| Store.one inexistente | exception.MissingRecordException + controller.Errors | Falta de registro y traducción HTTP 404 |
| Store conversión de filas/JDBC genérico | repository.jdbc.JdbcRows | Conversión JSON/decimal/fecha y ejecución JDBC; usado solamente por repositorios y pruebas |
| Store helpers number/data | repository.jdbc.RowValues | Lectura explícita de filas |
| Store checkVersion | service.support.Concurrency | Validación de versión antes de mutar |
| Store casos + SQL Workflow/Quotes/Payments | repository.jdbc.CaseRepository | Lectura, FOR UPDATE y operaciones de caso |
| Store cuenta/pagado + SQL Payments | repository.jdbc.PaymentRepository | SQL financiero y carga de Account |
| SQL Workflow clientes | repository.jdbc.ClientRepository + service.Clients | Persistencia separada de coordinación cliente |
| SQL Workflow catálogo | repository.jdbc.CatalogRepository + service.Catalog | Persistencia separada de coordinación catálogo |
| SQL Workflow/Quotes órdenes | repository.jdbc.WorkOrderRepository | Persistencia de órdenes y revisión aceptada |
| SQL Quotes revisiones | repository.jdbc.RevisionRepository | Números por caso, revisiones, estado y congelación |
| Store.event | repository.jdbc.EventRepository | Auditoría append-only |
| SQL PublicImport | repository.jdbc.ImportRepository | Duplicados, advisory lock y registro de importación |
| SQL Files | repository.jdbc.AttachmentRepository | Conteo, inserción y búsqueda de metadatos |
| BackofficeRepository | repository.jdbc.BackofficeRepository | Consultas agregadas de pantalla, búsqueda y detalle |
| BackofficeQueries | service.BackofficeQueries | Coordina consultas y proyecciones; transacción de lectura |
| Workflow | service.Workflow | Casos/órdenes; clientes y catálogo extraídos a servicios con límites propios |
| Quotes | service.Quotes | Revisiones, envío manual, aceptación y snapshots históricos |
| Payments | service.Payments | Pago/reversa y prevención de duplicados bajo lock del caso |
| PublicImport | service.PublicImport | Validación ficha y coordinación de importación |
| Money.calculate JSON + Money.Result | service.QuoteCalculator + dto.response.QuoteCalculation | Validación y composición del snapshot JSON; copia defensiva |
| Money cálculos | domain.Money + Discount/Line/Totals | BigDecimal ARS, redondeo por línea, descuentos, ajuste explícito, seña y límites; sin HTTP/Jackson/JDBC/Spring |
| Input.expiry + validación vencimiento en Money | domain.QuoteValidity | Fecha sugerida de cinco días lunes-viernes sin feriados, editable; invariante de vencimiento no anterior a emisión |
| Account/CaseState/BusinessRuleException | domain.Account/CaseState/BusinessRuleException | Invariantes de saldo, estados y errores puros |
| QuotePdf + Writer | service.QuotePdf + Writer | Renderizado exclusivo del snapshot elegido; sin consulta de datos actuales |
| Errors | controller.Errors | Traduce reglas de dominio, faltantes y excepciones al contrato HTTP previo |
| JsonLimits/OriginGuard | config.JsonLimits/OriginGuard | Configuración Jackson y filtro local existente |
| LocalDatabase | config.LocalDatabase | Guardia de identidad/base y validate Flyway |
| Files | service.AttachmentService + storage.StorageLock/AttachmentStorage/AttachmentValidator | Exclusión, I/O y validación separadas |

## Dependencias permitidas y tamaños

Solo Application permanece en el paquete raíz. controller consume service, dto, mapper, domain y exception; nunca repositorios, storage ni JDBC. service coordina dominio y repositorios; dto.request puede participar en validación del caso de uso. repository.jdbc contiene SQL y RowMapper; JdbcRows es infraestructura pequeña, no un Store universal con reglas o casos de uso. domain importa solamente clases Java y dominio. storage depende de sus clases y errores de frontera; ningún DTO HTTP. mapper conoce dominio y representaciones. config queda para configuración/infraestructura.

No se crearon interfaces por clase, herencia, módulos Maven ni capas ficticias de vistas. BackofficeRepository permanece agrupado (139 líneas) porque sus SELECT forman una responsabilidad coherente de consultas de pantallas; cada escritura está en el repositorio funcional respectivo. QuotePdf/Writer se mantienen juntos porque su responsabilidad única es el documento histórico y la paginación; separar Writer no mejora el uso externo. ApiMapper mantiene proyecciones whitelist de Map para preservar las claves actuales y evitar que columnas internas nuevas lleguen al API. RequestInput mantiene validación común, sin distribuir utilidades diminutas por funcionalidades.

## Transacciones y secuencia preservadas

- `BackofficeQueries`: mismo `@Transactional(readOnly=true)` de clase y mismo conjunto de lecturas.
- `Clients.save`, `Catalog.save`: mismos límites antes en Workflow.client/catalog, métodos públicos no final, propagación Spring por defecto REQUIRED; creación/lock, versión, UPDATE, evento y lectura final en el mismo orden.
- `Workflow.createCase/editCase/transition/note/work`: métodos públicos `@Transactional`; bloqueo de caso antes de versión/estado/orden, UPDATE antes de evento, lectura final después. Entrega sigue independiente de saldo/seña.
- `Quotes.save`: primero FOR UPDATE del caso; cálculo y snapshot; asignación quote_number si falta; creación/lock revisión; validación, UPDATE/INSERT, evento, lectura final. Una revisión inexistente después de asignar quote_number provoca rollback de la modificación de caso. La secuencia PostgreSQL conserva su comportamiento propio de secuencia no transaccional.
- `Quotes.send`: lock caso, lock revisión, versión/DRAFT, regla de estado, UPDATE revisión, UPDATE caso condicional, evento, lectura. `Quotes.accept`: lock caso, lock revisión, versión/SENT, estado, total frente a pagos, fecha, UPDATE revisión, UPDATE caso, upsert orden y evento. Nunca se reemplaza silenciosamente la revisión aceptada por otra revisión creada/enviada.
- `Payments.pay/reverse`: mismo lock del caso antes de consultar cuenta y duplicados, mismo orden INSERT pago/reversa, evento y lectura de saldo. No cambia aislamiento ni se elimina serialización por caso. Reversa inserta nuevo registro inmutable.
- `PublicImport.confirm`: transacción pública REQUIRED, advisory lock de fingerprint antes de duplicado, selección/creación cliente y creación caso por beans distintos, registro importación y evento. Clientes/Workflow participan por proxies en la misma transacción; no se introducen REQUIRES_NEW ni auto-invocaciones que rompan el límite.
- Todos los repositorios reciben el mismo bean JdbcRows con el mismo JdbcTemplate. Spring sigue obteniendo la conexión desde el datasource vinculado a la transacción. Repositorios no crean conexiones, no hacen commits propios y no agregan `@Transactional` que altere propagación.
- `AttachmentService.upload`: coordinación de lock del caso, límite, validación, escritura, INSERT metadatos y evento conserva orden. Se conservó la limpieza de archivo propio tras rollback y se agregó limpieza ante escritura parcial o registro de sincronización fallido. La prueba descartable provoca una falla posterior al INSERT y comprueba atomicidad.



## Mapa de origen a destino

| Origen | Destino y responsabilidad |
|---|---|
| App.tsx, 558 líneas | App.tsx, 213 líneas: shell, navegación, selección del caso y diálogos de alta; seis pantallas extraídas a dashboard, cases, clients, catalog, imports y audit. CaseList pasa a cases y es reutilizado por el tablero. |
| CaseView.tsx, 796 líneas | cases/components/CaseView.tsx, 229 líneas: composición del detalle y apertura de acciones; useCaseDetail carga estado; RevisionList y AcceptanceForm pertenecen a quotes; pagos/reversas, orden, adjuntos y cronología tienen paneles/formularios propios en cases. |
| Editors.tsx | ClientEditor en clients, CatalogEditor en catalog y CaseEditor en cases. Se mantienen sus campos, validaciones HTML, textos y versiones de edición. |
| api.ts | shared/api/http conserva transporte, encabezado de mutación, errores y multipart; endpoints y payloads pasan a cada feature/api.ts; contratos TypeScript a feature/types.ts; labels a cases/catalog; formatos ARS y Buenos Aires a shared/format; sugerencia de vencimiento y payload de revisión a quotes/draft. |
| Api helpers de consultas | clients/listClients, catalog/listCatalog, dashboard/loadDashboard, cases/listCases y audit/listAudit se invocan desde app/useBackofficeData; la composición no conoce fetch ni rutas HTTP. |
| QuoteEditor.tsx / useQuoteDraft.ts | quotes/components y quotes/hooks. QuoteEditor conserva 251 líneas porque presenta un único formulario de conceptos, descuentos, plazo y cálculo; su coordinación HTTP y control contra resultados tardíos viven en el hook. |
| ImportView.tsx | imports/components/ImportView; Inquiry/ImportPreview en imports/types; preview/confirm en imports/api. ImportScreen presenta el marco de recepción manual. |
| components.tsx | shared/components: los seis controles reutilizados Field, Text, Dialog, Form, Empty y JsonView. |
| api.test.ts | 3 pruebas de transporte en shared/api/http.test; 2 de vencimiento/payload en quotes/draft.test. |

Las cantidades de líneas se calcularon con el mismo criterio antes/después sobre el contenido UTF-8, sin usar el índice previo como base. Los fuentes nuevos y reubicados se comprobaron con `TextDecoder('utf-8', { fatal: true })`, sin caracteres de reemplazo ni espacios finales. No se hizo conversión masiva ni se tocaron archivos binarios.

## Dependencias y comportamiento preservado

App/app coordinan features; los componentes y hooks invocan APIs de su funcionalidad; esas APIs usan el único transporte de shared. Shared no conoce features ni App. Las funcionalidades pueden consumir contratos de otras cuando representan relaciones reales: cases agrega cliente/revisiones/eventos, dashboard reutiliza CaseList y quotes copia datos de catálogo. Los imports de tipos son explícitos y no generan ciclos de ejecución.

Los importes definitivos siguen llegando del backend como cadenas decimales: el navegador solo formatea ARS o presenta la respuesta de cálculo. `quoteRequest` continúa excluyendo total/gross/discount calculados, cliente histórico y números de snapshot. El catálogo sigue editable y sus precios se copian al borrador; no se agregó una segunda tarifa autoritativa en React. Pagos y contrapartidas conservan endpoints/payloads, operationKey, motivos, versiones y confirmaciones. Los PDFs continúan descargándose por id de revisión; no se cambiaron los snapshots ni cálculos del servidor.

La extracción conservó los nodos JSX visibles, textos, clases, campos y orden de callbacks. Las pantallas se sustituyeron por componentes que devuelven los mismos fragmentos, sin nuevos wrappers DOM. No se modificó el aspecto visual ni los flujos de alta, aceptación, entrega o importación.



## Base real, migraciones y recursos de prueba

Lecturas de identidad real: `scalaris`, PostgreSQL18.6, `127.0.0.1:5433`, public, usuario configurado, listen_addresses localhost. Historial confirmado:

| Versión | Script | Checksum | Success |
|---|---|---|---|
| 1 | V1__model.sql | -967404013 | true |
| 2 | V2__editable_catalog.sql | -735505370 | true |
| 3 | V3__revision_and_reversal_integrity.sql | -2106124092 | true |

Flyway del arranque real solo valida; el log final confirma tres migraciones validadas sin DbMigrate. Historial y conteos agregados comparados antes/después de ese arranque son idénticos. Las consultas de verificación se ejecutaron con BEGIN READ ONLY. No hubo pagos, reversas, PDFs nuevos, seeds ni migraciones de prueba contra la base real. Hashes de V1–V3 permanecen idénticos a los capturados antes de editar. No se usó clean/drop/repair/baseline ni se modificaron checksums.

Se crearon dos bases nuevas reconocibles en PG18/5433: `scalaris_test_refactor_20261004` para suite y `scalaris_test_ui_refactor_20261004` para app/UI. Se conservaron para inspección. Suite: almacenamiento temporal con nombre DB + UUID. Scripts/UI: `C:\Users\Jerem\ScalarisData\tests\scalaris_test_ui_refactor_20261004\attachments`. Pruebas de lock/I/O: @TempDir. Solo estas bases reciben resets/fixtures y mutaciones. No se reutilizaron ni sobrescribieron respaldos/evidencia anteriores.

## Comandos, cantidades y resultados efectivos

| Verificación / comando | Resultado actual / código |
|---|---|
| Versiones java --version, mvn --version, node --version, npm.cmd --version, pnpm --version, psql --version | versiones anteriores, exit0; primer Resolve-Tool sin patrón portable detectó Maven fuera de PATH y se corrigió a ruta existente, sin reinstalar |
| Maven dependency:tree filtrado antes/después | exit0 en ambas; origen PDFBox confirmado y commons-logging ausente después |
| Maven test-compile inicial | Maven exit1, declaración package generada incorrectamente; corregida, sin atribuirlo a DB |
| Test.ps1 primera suite descartable | Maven exit1:55 tests,1failure/1error/0skipped; mapa del test omitía exception y fixture leía marcador bajo lock Windows |
| Test.ps1 tras correcciones | exit0,55/55,0skipped |
| `powershell.exe -NoProfile -File backoffice/scripts/Test.ps1 -Database scalaris_test_refactor_20261004` sobre fuentes finales congeladas | exit0,55 tests,0failures/errors/skipped,01:45:36ART;20 PostgreSQL +35 unit/domain/storage/config/contratos |
| pnpm --dir backoffice/frontend test | exit0,8/8 en3 archivos:5 previas +3 dependencias |
| pnpm --dir backoffice/frontend build | exit0,TypeScript/Vite54 módulos |
| Playwright coordinación contra Vite temporal5174 con API simulada | exit0,3/3; proceso propio detenido |
| `pnpm --dir backoffice/frontend exec playwright test --output=../../artifacts/refactor-20261004/playwright-latest` con JAR final y recursos descartables | exit0,5/5:3 simuladas +2 workflow reales,9.5s |
| Build.ps1 -SkipTests después de suite completa | exit0,frozen install/frontend/Maven/público; no representa integración por sí solo |
| Maven package -DskipTests final después de última suite | exit0,JAR final01:49:13ART |
| node scripts/check.mjs | exit0,recursos/anclas/WhatsApp/fuentes/licencia |
| node --test scripts/public-form.test.mjs | exit0,5/5 |
| Check-Configuration.ps1 en PowerShell5.1 | exit0,mismo JDBC/ruta/puerto desde raíz/backend y restauración exacta del entorno |
| Start.ps1 -TestDatabase / Stop.ps1 / reinicio con JAR final | exit0,HTTPhealth200,lock adquirido y cierre limpio comprobado |
| Doble Start.ps1 / segundo JAR mismo almacenamiento y puerto descartable8083 | rechazo esperado; segundo JAR PID4788 exit1 por lock y primera app sigue healthok; harness exit0 |
| Backup.ps1 -TestDatabase con app activa | rechazo esperado por lock antes de crear destino; destino inexistente |
| StorageLockTest + AttachmentStorageTest |11/11 dentro de55: doble JVM, ambos sentidos FileShare.None, fallo Spring, reinicio, parcial-init, marcador libre, I/O |
| PDF de revisión descartable existente: descarga + pypdf + Poppler + inspección visual | descarga200,25617 bytes,A4/1página,Inter,ARS15000; extract/render exit0, sin clips/solapamientos observados |
| Arranque REAL final Start.ps1 -Mode Local | exit0,PID19976 a01:53:46ART,Flywayvalidate3,storage real,HTTPhealth/React200; metadatos antes/después idénticos |
| Stop.ps1 real final | cierre limpio;8081 libre y lock liberado. La app queda detenida para permitir Run del IDE sin conflicto |
| Run efectivo IntelliJ | PENDIENTE; no se obtuvo ventana utilizable para pulsar Run y confirmar HTTP desde su JVM |

El conteo55 corresponde al log actual. Surefire conserva un XML histórico del DatabaseGuardTest anterior al cambio de paquete; sumarlo indiscriminadamente daría57 y sería incorrecto. Se usaron suites/timestamps actuales.

Los 20 tests PostgreSQL cubren snapshots/revisión aceptada exacta, sustitución explícita, parcial/reversa/inmutabilidad, duplicados, sobrepago concurrente, revisión concurrente, rollback al editar inexistente, importación concurrente, entrega con saldo, versiones, adjuntos y contenido hostil, auditoría y seed editable. Money/QuoteValidity se prueban aislados. Se conservaron ARS, BigDecimal, HALF_UP, tarifa editable ARS 15.000/h del concepto inicial del catálogo, snapshot histórico PDF, pagos parciales/reversas y locks/transacciones. Auditoría de 28 pares HTTP método/ruta: diferencias 0. La comparación SQL usa 68 expresiones de referencia en siete clases del índice recibido, leído sin modificarlo, complementadas por la inspección inicial del working tree; hay 60 expresiones finales deduplicadas, faltantes 0/nuevas 0 tras normalizar espacios. No se agregaron escrituras. jdeps: ciclos 0.

Fallas intermedias frontend conservadas: mock **/api/** interceptó también /src/shared/api/http.ts; se acotó a pathname /api/. El testNode de dependencias inicialmente estaba en src y se trasladó a tests. Ambas verificaciones finales pasaron. Las capturas de workflow ahora usan test.info().outputPath para no pisar evidencia del informe anterior.

## IntelliJ: comprobado, pendiente y acción mínima

Comprobados por archivo/código: JDK/módulo local, Application en raíz y component scan, .run compartida no sensible, ruta absoluta idéntica, entorno/password por DPAPI y proceso, UTF-8 de proyecto/JVM. No hay .env automático ni password persistida. La primera apertura permitió inspeccionar el proyecto; las aperturas posteriores del lanzador y Computer Use no expusieron una ventana utilizable. El helper informó `launched app did not expose a targetable window`; una lectura de Thread.print del JVM de ese intento lo situó en `StartupErrorReporter.showError`/`StartupUtil.lockSystemDirs`, antes de abrir el proyecto. Eso no confirma dueño ni causa precisa de un lock del IDE, y no se trató como el fallo Files de Scalaris. No se eliminaron archivos ni modificaron rutas de configuración globales del IDE.

Acción mínima pendiente del usuario, después de abrir/cerrar IntelliJ normalmente desde su escritorio: ejecutar el lanzador desde su terminal habitual, seleccionar **Scalaris Local**, Run y comprobar health200. Para comprobar primero con datos aislados, reutilizar la base de prueba conservada:

```powershell
Set-Location C:\laburo\Scalaris
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\backoffice\scripts\Start-IntelliJ.ps1 `
  -IdeaPath 'C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\bin\idea64.exe' `
  -TestDatabase scalaris_test_ui_refactor_20261004
# En el IDE: Scalaris Local → Run.
# HTTP esperado: http://127.0.0.1:8081/api/health
```

Si falta credencial, ingreso seguro por Read-Host -AsSecureString en la terminal propia o reutilización del CredentialFile ya existente; no se solicita por chat. No se requiere nueva configuración persistente sensible. Una instancia activa de scripts debe detenerse coordinadamente antes de Run. Al finalizar esta intervención los scripts dejaron Scalaris detenido y8081libre.

### Seguimiento: rechazo de PowerShell antes de cargar el lanzador

El 4/10/2026 el usuario informó `PSSecurityException / UnauthorizedAccess`: su terminal rechazó `Start-IntelliJ.ps1` por política de ejecución. Ese intento no llegó a ejecutar el lanzador ni iniciar IntelliJ o Scalaris. Se corrigió el comando reproducible anterior para iniciar `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`. El alcance es el proceso, sin cambios persistentes de CurrentUser/LocalMachine, sin privilegios de administrador y sin alterar políticas de grupo. [Referencia oficial Microsoft](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-5.1).

La consulta de solo lectura desde un proceso independiente de Windows PowerShell mostró CurrentUser RemoteSigned y MachinePolicy/UserPolicy Undefined; no demuestra cuál era la política efectiva de la terminal del usuario. La carga con el parámetro temporal se comprobó usando una ruta inexistente de IntelliJ: el script alcanzó su validación propia y rechazó esa ruta antes de iniciar el IDE. Esta comprobación no sustituye el Run efectivo de IntelliJ, que continúa pendiente.

## Archivos y revisión final

Modificados: README raíz/backoffice, .gitignore, backend/pom.xml/application.properties, todos los fuentes Java reubicados/divididos y tests adaptados/nuevos, Common/Start/Stop/Backup; nuevos Start-IntelliJ.ps1, scripts/java/GracefulStop.java, .run compartida y este informe. Frontend: fuentes movidos/extraídos por funcionalidades, tests de transporte/borrador/dependencias, vitest.config y interceptación/artefactosPlaywright. Migrate/Restore, migraciones, recursos PDF, estilos, package.json/pnpm-lock y sitio público se conservaron respecto del trabajo recibido. Metadata .idea de encodings se cambió localmente y queda ignorada; no se versionan secretos.

Evidencia reproducible ignorada en `artifacts/refactor-20261004/`: logs finales Maven55, build/package, Vitest8, Playwright5, semantic-audit, mapas de clases, identidad/metadatos reales solo lectura, arranques/doble arranque/cierre, PDF/render/extracción y capturas. Las 71 rutas y estados staged coinciden con el inventario inicial; no se ejecutó ninguna operación de staging. El hash binario de `.git/index` cambió durante la intervención y no se afirma identidad byte a byte ni se atribuye una causa sin evidencia. Los hashes de V1–V3 sí coinciden. Diff revisado y `git diff --check` sin errores. La revisión automatizada final decodificó 145 archivos de texto como UTF-8, no encontró candidatos de credenciales literales en los patrones revisados y validó el XML compartido y el placeholder de password vacío; resultado en `final-review.json`. La configuración sensible local y DPAPI permanecen fuera del control de versiones. Ningún aviso Mockito/agent/color se silenció para fingir un resultado.

Completado y probado: separación funcional física, contratos/transacciones, locks y liberación, logging, configuración común no sensible, suite/backend/frontend/público/PDF, arranque/cierre/reinicio por scripts y arranque real solo lectura. Pendiente por limitación de operación del IDE: Run efectivo con HTTP desde IntelliJ. También quedan fuera de esta intervención otra PC física/LAN, otros navegadores y despliegue. No se declara el RunIDE resuelto ni se confunde PostgreSQL conectado con readiness completa.
