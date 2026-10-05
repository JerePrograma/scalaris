# Acceso cotidiano a Scalaris · 5 de octubre de 2026

Intervención en la PC Jeremias, `C:\laburo\Scalaris`, rama existente `codex/backoffice-v1`. Se inspeccionaron estado Git, configuración, scripts e informes previos antes de editar. No se encontraron AGENTS.md en los ancestros ni en el proyecto revisado. Se conservaron los cambios staged/unstaged y archivos nuevos recibidos, incluidos `presupuestos/`. No se hizo staging, commit, push, reset, limpieza del checkout ni publicación.

## Resultado actual

Uso recomendado: doble clic en **Scalaris LAN** del escritorio (`C:\Users\Jerem\Desktop\Scalaris LAN.lnk`), o **AbrirScalaris.cmd -Mode Lan** desde `C:\laburo\Scalaris`. Sirve React compilado y API en el mismo origen: **http://192.168.1.9:8081/**. El propietario confirmó Tablero y Clientes desde su teléfono físico conectado a la Wi-Fi aprobada. La guía completa es [COMO-USAR.md](COMO-USAR.md).

Estado de la última comprobación, a las **11:49:55 ART del 5/10/2026**, conservado en `final-state.json`:

| Elemento | Estado verificado |
|---|---|
| Aplicación | JAR `backend/target/backoffice-1.0.0.jar`, Java 25.0.4.1, Spring Boot 3.5.16 |
| JVM propia | **PID 19200**, inicio 11:40:59 ART, Started Application 11:41:05 ART, perfil Spring `default` |
| Modo | **Lan**, binding exclusivo **192.168.1.9:8081**, sin orígenes Vite |
| Base efectiva | PostgreSQL **18.6**, **127.0.0.1:5433/scalaris**, esquema public, cuenta configurada |
| PostgreSQL | PID 27476, listeners 127.0.0.1 y ::1 en 5433, `listen_addresses=localhost` |
| Frontend | 11 archivos idénticos entre dist, classes/static, JAR y bytes HTTP |
| URL PC y celular | **http://192.168.1.9:8081/**; health HTTP 200, status ok, database 1 |
| Vite y servidor QA público | Detenidos; no hay listener 5173 ni 8082 |
| Red y firewall | Wi-Fi, índice 15, RSO37518-5G, perfil Private; regla Scalaris-Backoffice-LAN-8081 verificada en ActiveStore |
| Teléfono físico | **Confirmado por el usuario**: Tablero y Clientes cargan desde su celular por la Wi-Fi aprobada |
| Reversión real | **No ejecutada**; helper Disable comprobado con simulaciones, comandos documentados |

El estado de un proceso es puntual: el lanzador vuelve a verificarlo en cada apertura. Cerrar el navegador no detiene la aplicación. El comando sin `-Mode Lan` mantiene Local como valor seguro por defecto; cambiar una instancia LAN a Local requiere Stop previo y no revierte automáticamente perfil o firewall.

## Causa demostrada del 403

Se observó inicialmente el Run de IntelliJ PID 11600, iniciado a las 10:50:27 ART y escuchando en loopback 8081, y Vite PID 4792 en 5173. Ambos dejaron de existir durante la inspección, antes de las peticiones controladas; no fueron detenidos por esta intervención. La pestaña del usuario conservaba el error del servidor. Se continuó con un arranque propio del JAR existente, usando la base real únicamente para lecturas.

El cuerpo completo del rechazo es UTF-8, 87 bytes:

```json
{"message":"Origen no autorizado. Abrí la aplicación en una dirección configurada."}
```

El componente es `backend/src/main/java/ar/scalaris/config/OriginGuard.java`: obtiene Host/Origin/Fetch Metadata en líneas 53–55 y rechaza `!hosts.contains(host)` en **línea 67**, antes de ejecutar controladores. La lista de hosts se deriva de `scalaris.allowed-origins`. Con la configuración Local normal solamente admite localhost/127.0.0.1 en 8081.

`frontend/vite.config.ts` tiene proxy `/api` hacia 127.0.0.1:8081, con **changeOrigin:false**. El backend recibe el Host **127.0.0.1:5173**; Origin se mantiene independiente y puede estar ausente o ser **http://127.0.0.1:5173**. La ausencia de Origin no evita el rechazo del Host. Vary, CSP y otras cabeceras no prueban CORS ni un problema de firewall.

| GET health/clients/catalog/dashboard | Antes, backend Local | Después, backend Local -FrontendDev |
|---|---|---|
| Directo 8081, sin Origin | 200 | 200 |
| Directo 8081, Origin local 8081 | 200 | 200 |
| Proxy 5173, sin Origin | 403 | 200 |
| Proxy 5173, Origin local 5173 | 403 | 200 |
| Directo o proxy, Origin example.invalid | 403 | 403 |

También se comprobó GET directo 8081 con Origin local de 5173: 200 en modo FrontendDev. Los logs DEBUG de `/api/health` corroboran los encabezados recibidos realmente por el backend, incluidos Host de 5173 y Origin independiente. La opción `-FrontendDev` ya estaba implementada en el trabajo recibido: la corrección efectiva consistió en arrancar con ese contrato y comprobarlo, en lugar de ampliar el contrato cotidiano. Vite y su proxy no requieren un cambio. No se implementó CORS ni se investigó preflight: el navegador usa `/api` de su mismo origen.

Host ajeno y `Sec-Fetch-Site: cross-site` conservan 403. El filtro mantiene el encabezado de mutación y la coincidencia exacta de Origin en escrituras. Las pruebas previas y finales de OriginGuard comprueban también origen distinto aunque permitido y encabezado ausente. No hay Spring Security/CSRF configurado como causa de este rechazo; la barrera existente está en OriginGuard y no fue desactivada.

## Cambios acotados

- **AbrirScalaris.cmd / scripts/Open.ps1:** apertura diaria sin build automático, Windows PowerShell 5.1 explícito, errores visibles y URL solamente después de readiness. No cambian ExecutionPolicy ni usan Bypass.
- **scripts/Common.ps1 / Start.ps1 / Stop.ps1:** serialización por un handle exclusivo de operation.lock, validación PID/hora/Java/JAR, contrato de modo/base/storage/puerto/bind/dev, propietario del listener y JSON health con conexión confirmada. Un Start repetido reutiliza solamente la misma instancia sana; una instancia de prueba o desarrollo no se presenta como la instancia real cotidiana. Parada mediante hooks Spring/JVM de la JVM propia, sin terminación forzada.
- **scripts/Build.ps1:** mantiene frozen install y versiones; regenera exclusivamente `backend/target/classes/static` antes de copiar React. Comprueba ruta absoluta y rechaza enlaces/junctions; no limpia fuentes, dependencias ni archivos del usuario. El build se rechaza si hay una instancia activa.
- **config.example.ps1 / Common.ps1:** LAN exige IPv4 privada asignada y Preferred, alias exacto, nombre exacto de red y perfil Private. Binding exclusivamente a la IPv4 aprobada, sin 0.0.0.0. Tras aprobación puntual se agregaron a config.local.ps1 ignorado únicamente LanAddress=192.168.1.9, LanInterfaceAlias=Wi-Fi y LanNetworkName=RSO37518-5G, conservando su configuración previa en `.runtime/config.local.before-lan-20261005.ps1`, fuera de Git y sin imprimir secretos.
- **scripts/Network-Lan.ps1:** helper separado de Enable/Disable con administrador requerido antes de efectos, contrato exacto de interfaz/IP/red/subred/Java25 y regla propia Scalaris-Backoffice-LAN-8081 en Private/TCP8081. Persiste perfil Public original, identidad GUID y filtros en `.runtime/network-lan.json` antes de cambiar red; verifica la propiedad de su regla al aplicar o revertir y retiene el estado para diagnóstico/reintento. Los lanzadores de apertura no realizan esas modificaciones. **Enable real aprobado terminó exit 0 a las 11:39:10 ART**; perfil y regla efectiva se comprobaron. Disable real no se ejecutó.
- **Acceso del escritorio Scalaris LAN.lnk:** target AbrirScalaris.cmd con argumento -Mode Lan y working directory C:\laburo\Scalaris; no cambia el valor Local seguro por defecto del comando.
- **OriginGuard.java:** diagnóstico DEBUG optativo solamente para GET `/api/health`, con indicadores de aceptación y encabezados desconocidos redactados. No registra query, cuerpos ni datos comerciales, y no modifica la condición del filtro. La instancia cotidiana final no tiene DEBUG habilitado.
- **application.properties:** contraseña de respaldo eliminada; placeholder vacío y credencial DPAPI existente fuera del repositorio. No se reprodujo el secreto. Charset UTF-8 y demás versiones permanecen.
- **frontend PaymentForms.tsx / shared/operationKey.ts / operationKey.test.ts:** UUID v4 con getRandomValues cuando randomUUID no está disponible. Corrige la apertura del formulario de pago en HTTP de una IP LAN, conservando contrato y aleatoriedad. La restricción de contexto seguro de randomUUID está en la [especificación W3C](https://w3c.github.io/webcrypto/#crypto-interface). La rama se probó aislada; esto no confirma conectividad LAN.
- **scripts/Assert-TestInstance.ps1 / e2e/workflow.spec.ts:** antes de cada recorrido que escribe, exige DB scalaris_test_*, URL loopback explícita y contrato/proceso/base/storage/readiness de la instancia descartable propia. Falla antes de navegar ante destino real o variables ausentes. Los tests de coordinación con mocks siguen independientes.
- **README raíz / README backoffice / COMO-USAR.md / este informe:** instrucciones vigentes, pantallas existentes, backup, errores, límites y evidencia. Los informes históricos se preservan.

No hubo cambios de arquitectura, endpoints de negocio, transacciones, migraciones V1–V3, POM, pnpm-lock.yaml ni versiones. La API del navegador, PDFs y adjuntos usan rutas relativas `/api`.

## Pruebas efectivas

| Verificación | Resultado |
|---|---|
| Test.ps1 con PS5.1, fuentes backend finales | **60/60**, 0 failures/errors/skipped; incluye 20 PostgreSQL en scalaris_test_refactor_20261004; terminó 11:08:49 ART |
| Vitest frontend | **10/10**, incluidos UUID nativo y fallback para HTTP LAN |
| Build.ps1 -SkipTests con PS5.1 | Frozen install, TypeScript/Vite y Maven package OK; no se presenta como ejecución de tests. Se usaron las suites anteriores sobre las fuentes finales |
| Check público / tests formulario público del Build | OK / **5/5** |
| Scripts aislados PS5.1 con rutas con espacios | **28 comprobaciones** de contrato, restauración de entorno, estado, PID ajeno, operación concurrente y guardias LAN mock |
| Network-Lan.ps1 aislado, Windows PowerShell 5.1 | **26 comprobaciones simuladas** del helper de activación/reversión; Disable real no se ejecutó |
| Network-Lan.ps1 Enable real aprobado con UAC | **Exit 0, 11:39:10 ART**; Wi-Fi15/RSO37518-5G pasó a Private; regla exacta verificada en ActiveStore |
| Guardias E2E negativas | Variables ausentes y DB scalaris: rechazo antes de goto/escrituras |
| Playwright con app empaquetada y DB scalaris_test_ui_refactor_20261004 | **5/5**: 3 coordinación mock, 2 recorridos reales descartables; pago parcial, entrega, importación, vista móvil; 17,5 s |
| Matrices HTTP antes/después | GET 200 para contratos correctos; origen ajeno 403; Host ajeno y cross-site 403 |
| Build con aplicación activa | Rechazado sin cambiar PID ni reconstruir JAR |
| Puerto ajeno temporal de QA | Rechazado; no se adoptó ni detuvo su proceso |
| Dos Start simultáneos desde app detenida, Local previo a LAN | Ambos exit 0, una sola JVM/listener **PID 5636** |
| AbrirScalaris.cmd sobre instancia Local previa | Exit 0, reutilizó PID 5636 y abrió la URL local |
| Stop Local y Start Lan tras aprobación | PID 5636 detenido por su mecanismo propio; una sola JVM/listener LAN **PID 19200**; PostgreSQL real conectado y V1–V3 validate |
| AbrirScalaris.cmd -Mode Lan sobre instancia sana | **Exit 0**, reutilizó PID 19200 y abrió http://192.168.1.9:8081/ |
| Scalaris LAN.lnk del escritorio | Creado; Target, argumentos -Mode Lan y working directory verificados. El mismo comando target pasó; **el agente no ejecutó el doble clic del .lnk** |
| Assets finales | **11/11** coinciden byte a byte entre React dist, classes/static, JAR y HTTP; no hay bundles sobrantes |
| Rutas | `/` carga/recarga correctamente; `/api/nonexistent` y `/clientes` devuelven **404 JSON** |
| Brave, base real, lecturas | Tablero, Clientes y recarga `/` sin 403 inesperado; logs de navegador observados sin errores/avisos |
| Vista móvil Brave 390×844 | Sin overflow horizontal; captura guardada; viewport restaurado |
| Matriz GET por IPv4 LAN desde PC | Contratos esperados **200**, Origin y Host ajenos **403**; **11/11 assets** idénticos, rutas inexistentes **404 JSON** |
| Navegador por URL LAN desde PC | Tablero, Clientes y recarga correctos; **0 errores/avisos** observados; vista móvil 390×844 sin overflow horizontal |
| Teléfono físico en RSO37518-5G | **Confirmación del usuario**: Tablero y Clientes cargan por http://192.168.1.9:8081/; no se hicieron escrituras reales para QA |
| PDF de fixture descartable | GET PDF 200, 25.489 bytes, 1 página; pypdf confirma Revisión/días/Seña sin caracteres de reemplazo; Poppler render inspeccionado, sin clips/solapamientos |
| Datos reales, incluido control final después de LAN | Identidad y consulta final en **BEGIN READ ONLY**; ocho campos agregados e historial de tres migraciones V1–V3 idénticos antes/después; **solo lecturas**, sin Migrate |
| Git diff --check | Sin errores; advertencias existentes de futura conversión LF/CRLF |

React utiliza estado interno para sus pantallas, sin router: la ruta real es `/`. Recargar una pantalla vuelve al Tablero. No se agregó un fallback SPA para rutas inventadas; los errores `/api` conservan HTTP/JSON.

Durante el arnés de concurrencia, PowerShell 5.1 no conservó inicialmente ExitCode de un Process sin el handle adquirido; se corrigió el arnés de QA y se repitió, verificando ambos exit 0. No era un fallo de los scripts de producción. La extracción PDF se validó por Unicode y archivo UTF-8, porque la codificación de stdout de Python podía mostrar acentos dañados en la consola aunque el PDF fuera correcto. Una navegación automatizada de la pestaña antigua fue bloqueada por el cliente del navegador; la pestaña abierta por el lanzador sí se verificó y recargó normalmente, sin alterar protecciones del navegador.

La revisión automática rechazó el intento del agente de abrir el archivo `Scalaris LAN.lnk` mediante Start-Process (`blocked by policy`); el intento no produjo efectos. Se verificaron la creación y propiedades del acceso, y se ejecutó su mismo target `AbrirScalaris.cmd -Mode Lan` con exit 0 y reutilización de PID 19200. No se declara un doble clic del acceso ejecutado por el agente; el servicio y el comando cotidiano están operativos.

Evidencia ignorada: `artifacts/access-20261005/` contiene backend-tests-final.log, build.log, http-before.json, http-dev-after.json, dev-app.log, assets-and-http-final.json, real-before/after.jsonl, logs de guardias y apertura, Playwright, PDF/texto/render y capturas local-desktop/local-mobile. La evidencia LAN incluye `network-effective.json` (regla/listeners/health/rechazos y confirmación física del usuario), `real-after-lan.jsonl`, `real-after-lan-verification.json`, `final-state.json`, `lan-desktop.png` y `lan-mobile.png`. La prueba aislada de scripts está en `artifacts/script checks 20261005/`; las 26 comprobaciones simuladas de red están en `artifacts/network checks 20261005/network-mocks.log`. No se almacenan contraseñas ni cuerpos de clientes como evidencia.

## Base preservada y red activada con aprobación

PostgreSQL real comprobado antes de operar y al final: 18.6, loopback:5433, scalaris/public, listen localhost; servicio activo con inicio automático. Historial V1–V3 con checksums **-967404013, -735505370, -2106124092**, success true. El control final después de LAN a las 11:46:35 ART verificó identidad y lecturas en BEGIN READ ONLY: conteos agregados e historial idénticos. No se ejecutó Migrate, restore, repair, baseline ni migración nueva. Las pruebas con escrituras usaron bases/storage descartables. No se tocó Molineros, Java 8 ni PostgreSQL 9.6/5432: conserva PID 8104 y sus listeners previos; PostgreSQL 18 conserva PID 27476 y loopback5433.

Red vigente comprobada tras activar con aprobación y UAC: **Wi-Fi**, índice **15**, **192.168.1.9/24**, red **RSO37518-5G**, perfil **Private** (antes Public). El usuario confirmó que la Wi-Fi es de confianza y aportó la IP del celular **192.168.1.12**; después pidió acceso para **cualquier dispositivo de la red**, por lo que se aprobó puntualmente la subred **192.168.1.0/24** y los cambios exactos de perfil/binding/firewall. La preferencia previa de alcance no se trató por sí sola como autorización del cambio de perfil de Windows.

URL PC y móvil activa: **http://192.168.1.9:8081/**, ruta `/`. Se verificó por HTTP y navegador desde la PC; **el usuario confirmó Tablero y Clientes en su teléfono físico** conectado a RSO37518-5G, registrado a las 11:46:07 ART. La regla **Scalaris-Backoffice-LAN-8081** comprobada en ActiveStore es Private, TCP 8081, programa `C:\Program Files\Java\jdk-25.0.4.1+1\bin\java.exe`, dirección local 192.168.1.9, interfaz Wi-Fi y remotos 192.168.1.0/255.255.255.0 (equivalente a /24). La revisión efectiva excluyó candidatos restringidos a paquetes de Windows; no encontró otra regla Allow aplicable a este programa/puerto/IP/Perfil. Nunca se abrió PostgreSQL 5433, router, túneles ni Internet. **Cambiar Wi-Fi de Public a Private también hace aplicables las reglas Private ya existentes de Windows para otras aplicaciones**, además de la regla nueva limitada de Scalaris; no se modificaron ni eliminaron esas reglas ajenas. El backoffice no tiene login: quien pueda alcanzarlo puede consultar/modificar clientes, presupuestos y pagos. La confirmación física fue una lectura del usuario; no se probaron escrituras con datos reales ni se tomó el viewport móvil de la PC como prueba de conectividad física.

La activación real está comprobada. **La reversión real no se ejecutó**; Disable tiene cobertura simulada. La reversión documentada en [COMO-USAR.md](COMO-USAR.md) comienza con **Stop.ps1**, luego ejecuta **Network-Lan.ps1 -Action Disable** con UAC y el mismo contrato para eliminar solo la regla propia exacta y restaurar el perfil Public original, y finalmente abre **AbrirScalaris.cmd** en Local. El registro `.runtime/network-lan.json` se conserva después de revertir o ante fallos para diagnóstico/reintento; no se elimina para forzar la operación. Cambiar solo el modo de la aplicación a Local no revierte automáticamente red ni firewall. DHCP, otra red, suspensión, VPN o aislamiento Wi-Fi pueden impedir acceso; la PC debe permanecer encendida y el servidor activo.
