# Scalaris · backoffice v1

Aplicación local para consultas, clientes, presupuestos y trabajos de reparación/mantenimiento, repuestos y web/software. Monolito Spring Boot con API JDBC, PostgreSQL y una interfaz React en español. El JAR sirve React desde el mismo origen. El sitio público en `../public/` permanece independiente.

**Uso diario en Jeremias: doble clic en Scalaris LAN del escritorio**, o `AbrirScalaris.cmd -Mode Lan` desde `C:\laburo\Scalaris`. Ver [COMO-USAR.md](COMO-USAR.md) para apertura, parada, actualización, pantallas y backups. El modo LAN aprobado sirve React compilado y API juntos en `http://192.168.1.9:8081/`; el propietario confirmó Tablero y Clientes desde su celular físico. Local seguro se conserva como alternativa; cambiar de modo requiere Stop previo.

La evidencia de acceso y arranque cotidiano del 5/10/2026 está en [VERIFICATION-20261005-ACCESS.md](VERIFICATION-20261005-ACCESS.md); distingue pruebas del agente, confirmación física del usuario y reversión real aún no ejecutada.

## Acceso y límites de seguridad

**No hay login, usuarios ni roles. Toda persona con acceso a la red y al servicio puede consultar y modificar los datos.** La trazabilidad usa origen operativo anónimo/local: no verifica quién hizo un cambio y no es auditoría inviolable. Los administradores de PostgreSQL y de los archivos pueden alterar la información. No usar este servicio en redes públicas o no confiables.

Modo Local escucha en `127.0.0.1`. Modo Lan requiere interfaz, IPv4 y nombre exacto de red aprobados, con perfil Private; escucha solo en esa IPv4 y admite hosts/orígenes exactos. Si cambia la red, la IP o el perfil, el arranque se rechaza para revisión. Antes de cambiar binding, perfil o firewall se requiere aprobación del alcance. La lista de Host, verificación de Origin, encabezado de mutaciones, Fetch Metadata y CSP ayudan a impedir solicitudes desde sitios ajenos; **no son autenticación ni convierten CORS en control de acceso**. Un cliente de red puede construir solicitudes. No se habilita CORS.

No abrir puertos del router, crear túneles ni publicar el backoffice. Los lanzadores `Start.ps1` y `Open.ps1` no modifican firewall ni perfil de red. El helper separado `Network-Lan.ps1` prepara la activación/reversión del alcance exacto de LAN y exige aprobación puntual y PowerShell administrador antes de modificar perfil o firewall; su existencia no autoriza ejecutarlo. Si otro dispositivo no conecta, comprobar primero IP, puerto, misma red y aislamiento Wi-Fi. La prueba desde la propia IP LAN no demuestra acceso desde otro dispositivo.

PostgreSQL debe escuchar únicamente en loopback (`listen_addresses = 'localhost'` o `'127.0.0.1'`). La aplicación comprueba dirección y configuración al iniciar y rechaza una base que escuche en interfaces de red. No registrar claves, contraseñas o credenciales de clientes en ningún campo ni adjunto.

## Versiones y prerrequisitos

Versiones fijadas y verificadas en este repositorio:

La rectificación de arquitectura y arranque del 4/10/2026 está en [VERIFICATION-20261004-REFACTOR.md](VERIFICATION-20261004-REFACTOR.md), con árboles físicos, mapa de clases, transacciones, pruebas y límites. [VERIFICATION-20261004.md](VERIFICATION-20261004.md) y `VALIDATION.md` conservan la evidencia anterior; sus estados de procesos no describen una instancia actual.

| Componente | Versión |
|---|---|
| Java | 25 LTS (Temurin 25.0.4.1+1, Windows x64) |
| Spring Boot | 3.5.16 |
| Maven | 3.9.12 (mínimo compatible 3.6.3) |
| PostgreSQL | 18.6 local en 5433 (NUMERIC, JSONB y secuencias) |
| Flyway / JDBC / Jackson | Flyway 11.14.1 por soporte PostgreSQL 18; JDBC/Jackson administrados por Spring Boot |
| Node / npm | 24 LTS (24.21.0) / 11.19.0; usar npm.cmd en PowerShell |
| React / TypeScript / Vite | 19.3.0 / 5.9.3 / 8.3.2 |
| pnpm | 11.19.0; lockfile versionado |
| PDFBox | 3.0.7; fuente Inter local |
| Pruebas UI | Vitest 5.0.3 y Playwright 1.63.0 |

Referencias oficiales: [Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/system-requirements.html), [Vite](https://vite.dev/guide/), [PostgreSQL Windows](https://www.postgresql.org/download/windows/). No se requiere Docker. Las herramientas portables usadas para validar esta PC están en `../artifacts/tooling/` (ignoradas por Git), no cambian el Java 8 instalado ni registran servicios.

Para uso habitual, disponer de JDK 25, Node 24 LTS, pnpm, Maven y PostgreSQL 18 local, con `psql`, `pg_dump`, `pg_restore` y `createdb`. PowerShell 5.1 o 7 con permisos normales. La toolchain, identidad de base y restauración de variables se comprobaron también en Windows PowerShell 5.1.

En esta PC, Java 25 está en `C:\Program Files\Java\jdk-25.0.4.1+1`, Node/npm en `C:\Users\Jerem\AppData\Local\Programs\nodejs24\node-v24.21.0-win-x64`, pnpm en `C:\Users\Jerem\AppData\Local\Programs\ScalarisTools\pnpm.cmd` y Maven en `artifacts/tooling/apache-maven-3.9.12/bin/mvn.cmd`. No hay wrapper Maven/Gradle. `config.local.ps1` guarda estas rutas sin contraseñas. `Build.ps1`, `Start.ps1` y `Migrate.ps1` restauran JAVA_HOME/PATH y variables de conexión al terminar; sus procesos hijos reciben la configuración de Scalaris. Molineros conserva Java 8 y PostgreSQL 9.6/5432.

La instalación per-user agregó entradas a PATH sin quitar las anteriores. Una terminal ya abierta puede conservar el PATH anterior: abrir una nueva o usar las rutas absolutas. `npm.cmd --version` evita depender de `npm.ps1`. Este frontend usa `pnpm-lock.yaml`, por lo que la instalación reproducible es `pnpm.cmd install --frozen-lockfile`; `npm ci` no corresponde porque no hay package-lock. No hay script de lint; el build ejecuta TypeScript y Vite.

## Preparar una base de uso real

No se crean credenciales ni una base de uso real automáticamente. Usar una base dedicada y una cuenta local propia que pueda ejecutar las migraciones. Crear rol/base desde la administración local de PostgreSQL con una contraseña que el propietario elija; `psql` permite `\password scalaris` para introducirla sin ponerla en un script. No usar la base descartable de pruebas como datos reales. La cuenta requiere conexión, creación de tablas/secuencias/funciones en su esquema y operaciones sobre sus propios objetos. No necesita superusuario.

La base **existente** `scalaris/public` fue identificada y migrada el 4/10/2026 en `127.0.0.1:5433`, PostgreSQL 18.6, con el usuario configurado `postgres`. No ejecutar el ejemplo de creación siguiente para esta PC. Los scripts comprueban base, usuario, esquema, versión 18, puerto 5433 y listener loopback antes de iniciar, respaldar o migrar. Un esquema con tablas pero sin historial se detiene para revisión; no hay baseline automático ni reparación de checksums.

Ejemplo de estructura, ejecutado por el administrador local con sus credenciales (solo si aún no existen):

```sql
CREATE ROLE scalaris LOGIN;
-- En psql: \password scalaris (introducir una contraseña propia)
CREATE DATABASE scalaris OWNER scalaris;
```

Configurar PostgreSQL para acceso local y SCRAM según su instalación. El backoffice nunca cambia `postgresql.conf`, `pg_hba.conf` o contraseñas de una instalación existente. `Migrate.ps1` aplica migraciones revisadas y autorizadas después de un respaldo verificado. El arranque de la base real únicamente valida: una migración pendiente detiene el inicio para revisión y aprobación antes de aplicar ese cambio. Solo las bases descartables con prefijo `scalaris_test_` permiten la preparación automática de Flyway durante los tests. No editar una migración ya aplicada; agregar otra. La V4 redondea los precios originales de V2 a múltiplos de cinco, pero solo cuando el precio de catálogo sigue coincidiendo con el valor inicial: conserva los cambios manuales.

## Configuración sin secretos

Desde `C:\laburo\Scalaris`:

En Jeremias ya existe `config.local.ps1`: conservarlo, no copiar el ejemplo encima ni volver a crear base/credenciales. El ejemplo siguiente se reserva a una instalación nueva. `LanAddress`, `LanInterfaceAlias` y `LanNetworkName` solo se configuran después de aprobar la exposición de red y comprobar la interfaz, IP y nombre de red actuales (propiedad `Name` de `Get-NetConnectionProfile`). La misma interfaz/IP en otra red no reutiliza esa autorización.

```powershell
Copy-Item .\backoffice\config.example.ps1 .\backoffice\config.local.ps1
# Editar config.local.ps1: base, usuario, rutas de herramientas y almacenamiento.
# LAN requiere aprobación previa, LanAddress, LanInterfaceAlias y LanNetworkName explícitos.
# Si no se usa un CredentialFile protegido con DPAPI, proporcionar contraseña en esta sesión:
$secret = Read-Host 'Contraseña de PostgreSQL' -AsSecureString
$env:SCALARIS_DB_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
```

`config.local.ps1`, `.runtime`, `target`, `dist`, `node_modules`, archivos `.env` y herramientas de validación están ignorados. No copiar contraseñas a archivos versionados. `Storage` y `BackupDirectory` deben estar fuera del repositorio y de cualquier directorio servido públicamente. Los scripts usan `PGPASSWORD` transitoriamente para herramientas PostgreSQL; un `pgpass` propio puede servir a esas herramientas, pero no suministra la contraseña a Spring/JDBC. El proceso Java requiere `SCALARIS_DB_PASSWORD`, tomada del entorno o de `CredentialFile` DPAPI. Los scripts no crean roles ni guardan claves en texto plano.

En esta PC se preservó la credencial local que ya estaba configurada en `CredentialFile`, un PSCredential cifrado mediante DPAPI para este usuario y esta PC, fuera del repositorio. No copiar ese archivo a Git; no funciona como secreto portable para otra cuenta. Se puede reemplazar mediante `Read-Host -AsSecureString` y `Export-Clixml` sobre un PSCredential propio. Los lanzadores transmiten la contraseña mediante el entorno del proceso. La configuración actual de `application.properties` usa un placeholder vacío; no conserva una contraseña literal de respaldo. La edición anterior solo se registra como historia en `VERIFICATION-20261005-VITE.md`; no describe el contrato vigente ni reproduce el secreto.

También se puede ejecutar el JAR directamente con variables:

| Variable | Valor por defecto / significado |
|---|---|
| `SCALARIS_BIND` | `127.0.0.1` |
| `SCALARIS_PORT` | `8081` |
| `SCALARIS_ORIGINS` | `http://localhost:8081,http://127.0.0.1:8081`; lista exacta sin slash final |
| `SCALARIS_DB_URL` | `jdbc:postgresql://127.0.0.1:5433/scalaris` |
| `SCALARIS_DB_USER` | `postgres` (cuenta local existente; configurar una propia si se decide luego) |
| `SCALARIS_DB_PASSWORD` | vacío; usar credencial propia |
| `SCALARIS_STORAGE` | `%USERPROFILE%/ScalarisData/attachments` |

No usar proxies inversos ni confiar en encabezados forwarded en v1. En desarrollo, el proxy de Vite conserva Host y Origin y exige agregar ambos orígenes de puerto 5173 a `SCALARIS_ORIGINS`.

## Construir, iniciar y detener

```powershell
Set-Location 'C:\laburo\Scalaris'
.\AbrirScalaris.cmd -Mode Lan
# Abrir diariamente comprueba/inicia la instancia propia y espera health HTTP.
.\backoffice\scripts\Stop.ps1

# Actualizar código con la aplicación detenida:
.\backoffice\scripts\Build.ps1
.\AbrirScalaris.cmd -Mode Lan

# Alternativa exclusivamente en la PC, con loopback:
.\backoffice\scripts\Stop.ps1
.\AbrirScalaris.cmd
# Abrir http://127.0.0.1:8081/ en la PC.
.\backoffice\scripts\Stop.ps1
```

La recomendación diaria usa la LAN autorizada Wi-Fi / RSO37518-5G / 192.168.1.9:8081 para todos los dispositivos de 192.168.1.0/24. El comando sin `-Mode Lan` mantiene Local como valor seguro por defecto y no cambia una instancia activa. Elegir Local no revierte automáticamente el perfil Private ni la regla de firewall; la [guía](COMO-USAR.md) incluye Stop → Disable con UAC → apertura Local para una reversión completa. La IP, red e interfaz deben seguir coincidiendo con el contrato aprobado.

El build genera `backend/target/backoffice-1.0.0.jar` con React. `Start.ps1 -Build` reconstruye primero cuando no hay instancia activa; la apertura diaria no recompila. `Migrate.ps1` se reserva a migraciones revisadas y autorizadas, no al uso cotidiano ni a corregir un 403. El arranque de la base real únicamente valida V1–V3. Los scripts conservan PID, hora exacta de inicio, ruta del JAR, base y almacenamiento; comprueban su identidad y detienen solo ese proceso. Un PID reutilizado se rechaza. `Stop.ps1` usa el Attach local del JDK 25 para solicitar `System.exit(0)`: se ejecutan los hooks de Spring/JVM, Tomcat termina solicitudes activas y se cierran Hikari y el bloqueo de archivos. El helper se compila en `.runtime/stop-helper`; no agrega un endpoint ni necesita contraseña. Si Attach está deshabilitado o la parada no termina en 30 segundos, el script informa el fallo sin forzar una terminación. No toca PostgreSQL u otros servicios. Antes de reconstruir el JAR, detener la aplicación.

Logs en `.runtime/app.log` y `error.log`. No incluyen registros de solicitudes ni los cuerpos ingresados por defecto. No habilitar logs SQL con parámetros o cuerpos de solicitudes en una instalación con datos reales.

Desarrollo opcional (dos terminales; los scripts seleccionan Java 25 solo para Scalaris):

```powershell
# Terminal API, desde la raíz del repo
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Start.ps1 -Mode Local -FrontendDev

# Terminal React, desde la raíz del repo
Set-Location 'C:\laburo\Scalaris\backoffice\frontend'
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Vite escucha solo localmente en desarrollo y hace proxy de `/api` a 8081. El modo LAN normal usa el build servido por Spring Boot.

Para usar el frontend en **5173**, el backend debe autorizar explícitamente los orígenes de desarrollo. El proxy conserva Host y Origin (`changeOrigin: false`); la configuración local normal solo admite 8081 y por eso rechaza solicitudes de Vite con 403.

Con IntelliJ ya abierto por el lanzador y la base elegida en su entorno, detener **solo el Run actual de Scalaris** y seleccionar la configuración compartida **Scalaris Vite → Run**. Esta configuración conserva base, almacenamiento y credencial heredados, y fija únicamente bind loopback, puerto 8081 y esta lista no sensible:

```text
SCALARIS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173
```

Si la configuración nueva todavía no aparece, agregar esa variable a la configuración actual en **Run → Edit Configurations → Environment variables**, conservar las demás variables y reiniciar ese Run. No iniciar ambas instancias simultáneamente.

Para abrir un IntelliJ cerrado con el mismo contrato desde scripts:

```powershell
powershell.exe -NoProfile `
  -File .\backoffice\scripts\Start-IntelliJ.ps1 `
  -IdeaPath 'C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\bin\idea64.exe' `
  -TestDatabase scalaris_test_ui_refactor_20261004 -FrontendDev
# En el IDE: Scalaris Vite → Run.

# Frontend desde backoffice/frontend:
pnpm.cmd dev
```

`Start.ps1 -TestDatabase scalaris_test_ui_refactor_20261004 -FrontendDev` ofrece lo mismo para el JAR, si 8081 está libre. `-FrontendDev` requiere modo Local y puerto 8081, agrega solo localhost/127.0.0.1 en 5173 y no cambia configuración persistente, CORS, firewall o red. Sin esa opción, los scripts conservan los orígenes normales de 8081. Respuestas HTTP y errores del filtro usan UTF-8 mediante `server.servlet.encoding.*` y charset explícito antes de escribir el rechazo. La evidencia del arreglo del 5/10/2026 está en [VERIFICATION-20261005-VITE.md](VERIFICATION-20261005-VITE.md).

## Arranque reproducible desde IntelliJ

Abrir el proyecto Maven `backoffice/backend`, módulo `backoffice`, SDK `Scalaris Temurin 25`, cuyo home es `C:\Program Files\Java\jdk-25.0.4.1+1`. La configuración compartida `.run/Scalaris_Local.run.xml` ejecuta `ar.scalaris.Application`, construye el módulo antes de iniciar y fija UTF-8 para archivos/stdout/stderr. El working directory es el backend; `Start.ps1` usa la raíz. Ambos reciben la misma ruta absoluta desde `Common.ps1`, por lo que esa diferencia no cambia los adjuntos.

IntelliJ debe estar cerrado normalmente para recibir el entorno del lanzador. Desde una terminal del proyecto:

```powershell
powershell.exe -NoProfile `
  -File .\backoffice\scripts\Start-IntelliJ.ps1 `
  -IdeaPath 'C:\Program Files\JetBrains\IntelliJ IDEA 2026.2.3\bin\idea64.exe'
# En IntelliJ: seleccionar Scalaris Local y pulsar Run.
```

Los comandos actuales no cambian ExecutionPolicy ni usan Bypass. Si PowerShell rechaza un archivo antes de ejecutarlo, conservar el mensaje exacto y consultar `Get-ExecutionPolicy -List` para revisar la política aplicable. No cambiar globalmente la seguridad para abrir Scalaris; una política de grupo requiere revisión por su administrador.

Este lanzador reutiliza `config.local.ps1` y la credencial DPAPI existente; la contraseña se transmite únicamente por el entorno heredado del proceso, sin `.env`, argumentos ni XML sensible. Restaura el entorno de la terminal al terminar. Si falta la credencial, usar `Read-Host -AsSecureString` en la terminal propia como arriba; no introducir secretos en el chat. Un IntelliJ ya abierto conserva el entorno con el que se inició: ejecutar otro launcher no lo actualiza. Si el IDE no puede abrir por su propio bloqueo de configuración, resolver primero ese inicio normalmente; no borrar locks ni cambiar preferencias globales para probar Scalaris. La verificación automática del Run real del IDE quedó pendiente en el informe de refactor; crear el archivo `.run` no equivale a haberlo ejecutado.

`Start-IntelliJ.ps1 -TestDatabase scalaris_test_nombre_nuevo` y `Start.ps1 -TestDatabase scalaris_test_nombre_nuevo` seleccionan la misma base descartable y `%USERPROFILE%\ScalarisData\tests\scalaris_test_nombre_nuevo\attachments`. La base debe existir antes; estos nombres permiten migración automática solo en pruebas. `Backup.ps1 -TestDatabase` usa el mismo destino de prueba, para verificar exclusión sin respaldar datos reales.

## Contrato y precedencia de configuración

La configuración local de PowerShell **no se carga automáticamente en Spring ni en IntelliJ**. Los lanzadores cargan primero `config.example.ps1` y luego `config.local.ps1`; las claves locales sustituyen los ejemplos. `Set-ApplicationEnvironment` es el punto compartido de base, almacenamiento, puerto, bind y origins. Esos valores configurados prevalecen sobre variables homónimas heredadas; la contraseña usa primero `SCALARIS_DB_PASSWORD` del proceso y después `CredentialFile` DPAPI si falta. No se imprime su valor. `PGPASSWORD` solo se utiliza transitoriamente para herramientas PostgreSQL y se restaura al finalizar.

En Spring, sin perfiles adicionales, el orden relevante de mayor a menor prioridad es: argumentos `--propiedad=valor`, propiedades JVM `-Dpropiedad=valor`, variables de entorno y `application.properties`. En los lanzadores del proyecto no se agregan overrides JDBC por argumentos. `Scalaris Local` hereda el entorno y fija las opciones de codificación; `Scalaris Vite` agrega los valores no sensibles de bind, puerto y orígenes de desarrollo indicados arriba. Para un JAR directo, definir las variables de la tabla anterior; no esperar carga de `.env` ni de `config.local.ps1`. El contrato recomendado utiliza contraseña de entorno o DPAPI, sin un valor de respaldo en archivos versionables.

`SCALARIS_STORAGE`/`Storage` debe ser una ruta absoluta normalizada, fuera del repositorio, sin enlaces simbólicos. El destino normal de esta PC es `C:\Users\Jerem\ScalarisData\attachments`, asociado a `scalaris/public` en `127.0.0.1:5433`. Cambiar de base requiere elegir conscientemente su almacenamiento; las opciones `-TestDatabase` lo derivan del nombre de prueba. El puerto normal es 8081, bind local 127.0.0.1 y perfil `default`. Los lanzadores rechazan un puerto ocupado y no alteran firewall, red ni configuración global.

## Paquetes y funcionalidades

Solo `Application` permanece en `ar.scalaris`. `controller` adapta HTTP a servicios; `service` coordina casos de uso y mantiene los límites transaccionales; `domain` contiene reglas puras de importes, saldo, estado y vencimiento; `repository/jdbc` contiene SQL y mapeo de filas. `dto/request`, `dto/response` y `mapper` explicitan los contratos actuales. `config` conserva la guardia de base y los filtros/límites; `exception` expresa errores de frontera; `storage` administra exclusión, archivos y validación. El dominio no conoce Spring, JDBC, Jackson ni contratos HTTP. Los controladores no acceden a repositorios o SQL.

React tiene `features/dashboard`, `clients`, `catalog`, `cases`, `quotes`, `imports` y `audit`, con componentes/API/tipos/hooks solo donde se utilizan. `App` compone las pantallas, `app/useBackofficeData` coordina consultas y `shared` conserva únicamente HTTP, controles y formato reutilizado. Los importes autoritativos se calculan en Java con BigDecimal. Las pruebas livianas comprueban dependencias sin agregar un framework arquitectónico.

## Uso y reglas de negocio

1. Registrar cliente con nombre o identificación útil. Teléfono, correo, dirección y observaciones son opcionales. Usar «Ver consultas» para su historial.
2. Crear consulta de equipo, repuesto o software. Software tiene necesidad, alcance, requisitos y entregables; no obliga a completar un equipo físico. Editar ficha y agregar notas/archivos al caso.
3. Avanzar a diagnóstico/relevamiento. Preparar un borrador de presupuesto, seleccionar servicios del catálogo o agregar mano de obra/repuestos/otros manualmente. El catálogo se copia; no hay stock. El concepto inicial de hora de software del catálogo tiene una tarifa editable de ARS 15.000/h, que se copia al seleccionarlo. Un concepto manual nuevo comienza con precio cero y se completa explícitamente.
4. Calcular, revisar y descargar el PDF. «Registrar envío» congela esa revisión y representa un envío realizado manualmente. No envía mensajes. Para cambiar lo enviado, crear otra revisión.
5. Registrar aceptación con fecha/hora, canal y nota sobre la revisión exacta. Crea/actualiza la orden. Las revisiones aceptadas son inmutables; una nueva revisión necesita envío y aceptación explícita. Los pagos se conservan al cambiar de revisión; no se acepta un nuevo total menor a lo ya cobrado sin corregir primero los pagos.
6. Registrar tareas, avances, recepción, horas reales y entrega en la orden. Las horas reales no cambian el importe aceptado. Flujo: consulta → diagnóstico → presupuesto enviado → aceptado → en trabajo → listo → entregado. Rechazado/cancelado son cierres; corrección/reapertura exige motivo y no omite los requisitos de aceptación. La entrega requiere constancia manual en la orden.
7. Registrar pagos manuales con fecha, importe, medio, referencia y nota. Sin pago/parcial/pagado se calcula aparte del estado de trabajo. La seña sugerida del 10% y el saldo son advertencias: no bloquean trabajo o entrega. No hay pagos online ni facturación fiscal.

Buscador de casos por nombre, número y detalle; filtros por cliente, servicio, estado y fecha de creación. Paginación de 100 casos. Clientes: búsqueda en servidor, hasta 500 resultados; afinar el nombre/teléfono si hay más. Los eventos se paginan de 100 en 100. Las ediciones de cliente, caso, catálogo, borrador y orden usan versión: un cambio concurrente devuelve conflicto y exige recargar.

### Importes y fechas

Solo ARS. El transporte de importes usa strings decimales con punto; Java `BigDecimal`, PostgreSQL `NUMERIC(16,2)`. La interfaz usa formato argentino solo para mostrar. Cantidad: hasta 3 decimales, positiva y máximo 100.000; precio unitario: hasta 2 decimales, no negativo y máximo 1.000.000.000. Máximo 80 conceptos y subtotal/total de 999.999.999.999,99.

Orden de cálculo: cantidad × precio → redondeo `HALF_UP` a 2 decimales por renglón → descuento explícito del renglón (importe total del renglón o porcentaje de su bruto, redondeado a 2) → suma de netos → descuento general (sobre esa suma, redondeado a 2) → ajuste de total manual. «Subtotal» suma brutos y «descuento» acumula los de renglón y general. Ningún descuento puede superar su base; porcentaje entre 0 y 100; NONE requiere cero. El ajuste conserva conceptos y diferencia exacta; exige motivo aunque el total manual coincida. El backend siempre calcula el resultado.

Presupuestos con secuencia global y revisiones por caso, protegidos con bloqueo transaccional. Snapshot de cliente, descripciones, tarifas, condiciones e importes. La aceptación registra la fecha/hora informada manualmente (puede preceder su carga en el sistema, pero no la fecha de emisión ni ser futura); la revisión debe estar enviada. El evento registra aparte el instante de carga. Eventos y aceptación usan `TIMESTAMPTZ`; pagos usan fecha comercial `DATE` e instante de carga `TIMESTAMPTZ`. Presentación/reglas: `America/Argentina/Buenos_Aires`. Vencimiento sugerido: 5 días de lunes a viernes, excluyendo emisión; **no considera feriados**, y se puede editar. Plazo de realización manual. El PDF usa exclusivamente el snapshot de la revisión seleccionada, se identifica como presupuesto y no agrega garantía ni renuncias de derechos.

### Pagos y trazabilidad

Cada pago tiene UUID de operación; repetir la misma operación se rechaza. Se detecta posible duplicado por caso, importe, fecha, medio y referencia entre pagos vigentes. Dos pagos legítimos iguales requieren referencias distintas. Se bloquea el caso para impedir sobrepago concurrente. La anulación agrega una contrapartida enlazada al pago; no borra ni modifica el original. Los eventos y pagos tienen protección de actualización/borrado en la base; esta protección no cubre intervención administrativa.

### Adjuntos

Hasta 20 por caso, 8 MiB por archivo: JPEG/PNG (máximo 25 megapíxeles), PDF sin cifrado, hasta 100 páginas y sin acciones/formularios/archivos incrustados, TXT UTF-8 sin contenido activo evidente. Validación de firma/contenido y MIME, nombre original saneado, almacenamiento UUID sin extensión ejecutable, SHA-256 y descarga con `nosniff` y disposición attachment. No se aceptan SVG, HTML, Office, ZIP ni ejecutables. Esto limita tipos admitidos; no es un antivirus ni sustituye el cuidado del operador al abrir descargas. No se borran adjuntos confirmados automáticamente; una escritura parcial o transacción revertida limpia solo el archivo creado por esa carga.

## Formulario público y ficha JSON

Página `public/consulta/index.html`, vinculada desde el contacto existente. Árbol de reparación/mantenimiento, repuestos y software; preguntas adicionales según el motivo. Sin IA, precios públicos, servidor, inbox, base pública, analítica o conexión a esta PC. Estado transitorio en memoria: recargar/cerrar pierde las respuestas.

Revisión/corrección, copiar resumen, descargar JSON v1 y abrir `wa.me` con un mensaje breve. Antes de abrir se explica qué se comparte y se muestra el mensaje. El enlace omite nombre/teléfono ingresados y limita el motivo a 160 caracteres. El cliente decide enviarlo y adjuntar la ficha manualmente. Copiar/descargar no envía datos; abrir WhatsApp no garantiza recepción. No se solicitan fotos ni información sensible.

Importar ficha en backoffice: elegir JSON de hasta 32 KiB, vista previa validada, asociar cliente existente o crear con sus datos, confirmar. Se valida esquema/version, UUID, fecha, tipos, campos conocidos, longitudes y necesidad principal. Se detecta tanto UUID repetido como contenido normalizado repetido sin depender de fecha/UUID de descarga. Restricciones de JSON: cuerpos API hasta 256 KiB con longitud fija, profundidad 30, strings 12.000 y números 20 caracteres; claves duplicadas rechazadas. Contrato documentado en `docs/inquiry-v1.schema.json`.

## Respaldo coordinado y restauración

Usar una base dedicada sin escritores externos. **Detener todas las instancias de Scalaris antes de respaldar.** La aplicación mantiene un bloqueo de almacenamiento, y los scripts de respaldo/restauración exigen acceso exclusivo: rechazan ejecución con la app abierta y bloquean un nuevo inicio durante la operación. No agregar archivos al directorio manualmente durante el respaldo.

```powershell
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Backup.ps1
# O destino nuevo y fuera del repo:
.\backoffice\scripts\Backup.ps1 -Destination 'D:\Respaldos\Scalaris\copia-20261003'

# Restaurar primero en BASE NUEVA y DIRECTORIO NUEVO:
.\backoffice\scripts\Restore.ps1 -Backup 'D:\Respaldos\Scalaris\copia-20261003' `
  -Database 'scalaris_restore_verificacion' -Storage 'D:\ScalarisRestaurado\attachments'
```

El respaldo contiene `database.dump` de `pg_dump -Fc`, adjuntos referenciados y `manifest.json` con SHA-256, versión y conteo. Verifica los hashes de adjuntos contra PostgreSQL. La restauración verifica rutas/hash, exige base `scalaris_restore_*` nueva, usa transacción única, no borra ninguna base y no sobrescribe directorios. Verifica referencias y hashes contra la base restaurada, muestra conteos y conserva el resultado para inspección. Ante error deja el destino de diagnóstico; nunca limpia datos por su cuenta. El rol local que ejecuta `createdb` debe tener permiso para crear una base; otorgarlo es decisión del administrador, no del script.

Después de restaurar, iniciar la app apuntando temporalmente a esa base y almacenamiento nuevos, revisar casos, PDFs, cronología y descargas; comparar conteos y saldo con el origen. Para usarlo como recuperación, cambiar configuración manualmente tras revisión. Conservar la base/directorio anteriores y el respaldo. Un hash no demuestra autenticidad ante alguien que pueda modificar también el manifest; guardar copias en un destino controlado y con acceso restringido.

## Pruebas

```powershell
node scripts/check.mjs
node --test scripts/public-form.test.mjs
pnpm.cmd --dir backoffice/frontend test

# Base PostgreSQL 18 DESCARTABLE ya creada en 5433 en esta PC:
.\backoffice\scripts\Test.ps1 -Database scalaris_test_jdk25_20261004
```

Los tests PostgreSQL se omiten explícitamente si no existe la variable; no confundir «skipped» con comprobación. Rechazan URLs que no sean locales o bases que no empiecen `scalaris_test_`. Vacían **solo esa base de prueba** antes de cada test. No apuntarlos a datos reales. Tests unitarios: cálculo, redondeo, descuentos, ajuste, fechas, validación, contenido de archivos. Integración: migraciones, snapshots/aceptación exacta, transiciones, independencia de cobros, duplicados/anulaciones, concurrencia, importación, adjuntos y auditoría.

Recorridos de navegador con app empaquetada abierta sobre una base descartable y sitio público servido localmente en 8082:

```powershell
# Terminal del sitio público desde la raíz (solo loopback):
python -m http.server 8082 --bind 127.0.0.1 --directory public
# Otra terminal:
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Start.ps1 -Mode Local -TestDatabase scalaris_test_e2e_20261004
$env:SCALARIS_E2E_DATABASE='scalaris_test_e2e_20261004'
$env:SCALARIS_E2E_URL='http://127.0.0.1:8081'
pnpm.cmd --dir backoffice/frontend test:e2e
Remove-Item Env:\SCALARIS_E2E_DATABASE
Remove-Item Env:\SCALARIS_E2E_URL
.\backoffice\scripts\Stop.ps1
.\AbrirScalaris.cmd -Mode Lan # Volver al uso cotidiano real aprobado.
```

No ejecutar los recorridos sobre una base de uso real: crean clientes, casos, pagos y consultas. `workflow.spec.ts` exige `SCALARIS_E2E_DATABASE` con prefijo `scalaris_test_*` y `SCALARIS_E2E_URL` HTTP de loopback; antes de navegar o escribir llama a `scripts/Assert-TestInstance.ps1`, que comprueba identidad de PostgreSQL, proceso propio, contrato de base/almacenamiento y health HTTP. Sin ambas variables o ante un destino no verificable, se detiene. La prueba `coordination.spec.ts` usa respuestas simuladas y no necesita esas variables de base.

`Test.ps1` exige un nombre `scalaris_test_*`, verifica identidad, carga la credencial protegida y restaura todas las variables de entorno. `Start.ps1 -TestDatabase` selecciona esa base y almacenamiento separado sin editar config.local. En esta PC, el servidor público de la prueba se ejecutó con el Python incluido en el runtime de Codex, porque `python.exe` del PATH era un alias de Windows. Chromium ya está disponible; no se requiere reinstalarlo. Evidencia de acceso/guardias actual en [VERIFICATION-20261005-ACCESS.md](VERIFICATION-20261005-ACCESS.md); arquitectura/pruebas del refactor en `VERIFICATION-20261004-REFACTOR.md`. `VERIFICATION-20261004.md` y `VALIDATION.md` son históricas. Capturas/reportes y JAR local en `../artifacts/` y `backend/target/`, sin versionarlos. Build/check público sigue siendo `node scripts/check.mjs`, salida Pages `public`, rama de producción `main`. No se hizo push, deploy ni publicación.

## Organización del código

La separación física actual está descrita en «Paquetes y funcionalidades» y en el [mapa completo del refactor](VERIFICATION-20261004-REFACTOR.md). `Api`, `Store`, `ApiViews`, `Input` y `Files` fueron divididos y sus archivos anteriores ya no existen en fuentes. Los repositorios contienen el SQL, los servicios conservan la coordinación transaccional y el dominio puro permite probar importes y estados sin HTTP/JDBC. Se mantuvo el monolito Maven y no se agregaron interfaces por clase, jerarquías ni frameworks arquitectónicos.
