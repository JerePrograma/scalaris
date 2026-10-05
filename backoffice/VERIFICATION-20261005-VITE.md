# Seguimiento de IntelliJ y Vite · 5 de octubre de 2026

Intervención en `C:\laburo\Scalaris`, sobre el trabajo anterior, sin staging, commit, push, despliegue, instalación, cambios globales o de red. Se preservan los informes del 4/10/2026. El objetivo de este seguimiento es corregir el 403 del frontend de desarrollo en 5173 y la codificación de los errores del filtro.

## Estado confirmado del arranque IntelliJ

El usuario aportó el log de un Run real: Java Temurin 25.0.4.1, PID 28044, working directory backend, perfil default, PostgreSQL 18.6 en 5433, base `scalaris_test_ui_refactor_20261004`, tres migraciones validadas y esquema actualizado sin migraciones necesarias. Tomcat inició en 8081 y Application terminó el arranque a las 00:20:20 ART. El proceso tiene `idea_rt.jar` y main `ar.scalaris.Application`; se comprobó que escucha solo en 127.0.0.1:8081 y que `/api/health` devuelve 200/status ok. Por tanto, ese Run superó Files/StorageLock. La comprobación pendiente del informe anterior de arranque efectivo desde IntelliJ ahora tiene evidencia aportada por el usuario y corroboración HTTP/proceso.

El frontend del usuario escucha en 127.0.0.1:5173, PID 14724. Ambos procesos permanecieron activos durante esta intervención: no se cerró el IDE, el Run ni Vite del usuario.

## Causa del 403 y de los acentos dañados

`vite.config.ts` conserva Host/Origin mediante `changeOrigin: false` y envía `/api` al backend en 8081. El navegador presenta Host 127.0.0.1:5173 y Sec-Fetch-Site same-origin. La configuración normal del backend solo autoriza localhost/127.0.0.1 en 8081; `OriginGuard` rechaza por Host antes de ejecutar controladores. No es un fallo de PostgreSQL, Files, React ni instalación de dependencias.

La lectura de salud confirmó antes del cambio:

| Solicitud a la instancia del usuario | Resultado |
|---|---|
| 8081/api/health | 200/status ok |
| 5173/api/health a través del proxy | 403, application/json;charset=ISO-8859-1 |
| 8081/api/health con Origin 127.0.0.1:5173 | 403, mismo charset |

El error tenía tres caracteres inválidos al decodificar sus bytes como UTF-8. Las propiedades agregadas el 4/10 tenían el prefijo incorrecto `spring.servlet.encoding.*`; Spring Boot 3.5 utiliza `server.servlet.encoding.*`. Se corrige expresamente este defecto de la intervención anterior. [Documentación oficial Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/reference/web/servlet.html).

## Cambios implementados

- Nueva configuración compartida `backend/.run/Scalaris_Vite.run.xml`, nombre **Scalaris Vite**. Hereda base, almacenamiento y credenciales del entorno del IDE; configura solo valores no sensibles: bind 127.0.0.1, puerto 8081 y orígenes localhost/127.0.0.1 en 8081 y 5173. Application, módulo backoffice, JDK Scalaris Temurin 25, Build y opciones UTF-8 permanecen explícitos.
- `Common.ps1`, `Start.ps1` y `Start-IntelliJ.ps1` aceptan `-FrontendDev`. El valor normal sigue sin 5173. La opción exige modo Local y puerto 8081, destino ya existente del proxy, y agrega únicamente dos orígenes loopback exactos. El entorno se restaura al terminar. La lista coincide con la configuración compartida del IDE.
- `OriginGuard` fija UTF-8 antes de obtener el writer en los rechazos 403/413. No se alteraron las condiciones de rechazo, los límites, el encabezado de mutación, CSP ni las reglas de Host/Origin/Fetch Metadata.
- `application.properties` usa `server.servlet.encoding.charset=UTF-8`, enabled y force. La prueba de binding utiliza el `ServerProperties` real de Spring Boot con las propiedades enviadas.
- README actualizado con la diferencia Local/Vite, selección del Run y comandos `.cmd`/PowerShell con alcance de proceso.

No se habilitó CORS, se reescribió Origin/Host, se agregó wildcard ni se desactivó el filtro. No se cambió `vite.config.ts`, HTTP del frontend, JSX, estilos, endpoints, contratos, transacciones o reglas de negocio.

La propiedad de contraseña fue editada por el usuario desde la verificación anterior y ahora contiene un valor de respaldo no vacío. El usuario pidió explícitamente **conservar esa edición por ahora**. Se preservó sin reproducir su valor en este informe ni copiarlo a XML, argumentos o archivos nuevos. Los lanzadores continúan usando el entorno/DPAPI existente. Esta excepción no debe confundirse con el placeholder vacío documentado como estado del 4/10; la configuración recomendada continúa sin secretos en archivos versionables.

## Pruebas y evidencia actuales

Evidencia ignorada en `artifacts/vite-origin-20261005/`. Se ejecutó:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File backoffice/scripts/Test.ps1 -Database scalaris_test_refactor_20261004
```

Resultado: **60/60 tests**, 0 failures/errors/skipped, Maven exit 0, 38.684 s, final 00:27:44 ART. Son las 55 pruebas anteriores más cuatro de OriginGuard y una de binding HTTP. Las 20 PostgreSQL mutan exclusivamente `scalaris_test_refactor_20261004` con almacenamiento temporal, no la base usada por el Run del usuario ni la base real.

Las pruebas nuevas cubren rechazo de Vite en modo normal con mensaje UTF-8 intacto; aceptación explícita de ambos hosts locales y mutaciones same-origin; rechazo de hosts/orígenes ajenos, cross-site, origen distinto aunque esté en la allowlist y encabezado de mutación ausente; límite JSON 413; y binding del prefijo correcto de Spring Boot.

| Verificación | Resultado / código |
|---|---|
| Suite backend completa | 60/60, exit 0 |
| `check-settings.ps1` | Orígenes IDE/scripts iguales; modo normal sin Vite; FrontendDev+LAN rechazado; entorno restaurado, exit 0 |
| Maven package -DskipTests después de la suite | exit 0, JAR 00:29:55 ART |
| JAR aislado loopback 8083, storage exclusivo UUID y base scalaris_test_refactor_20261004 | health 200, ocho verificaciones HTTP aprobadas |
| Proxy Vite real aislado loopback 5174 hacia ese JAR | siete verificaciones HTTP aprobadas conservando headers de 5173, harness exit 0 |
| GET de salud a través del proxy con Host 127.0.0.1:5173 o localhost:5173 | 200, application/json;charset=UTF-8 |
| Cálculo de presupuesto same-origin a través del proxy | 200, UTF-8; cálculo sin persistencia |
| Origin ajeno, cross-site o mutación sin X-Scalaris-Request | 403 del backend, JSON UTF-8 con acentos íntegros |
| Host ajeno a través de Vite | 403 de Vite antes de llegar al backend, text/plain UTF-8 válido |
| Cierre de ambos procesos propios de prueba | Vite server.close y hooks JVM/Spring, sin terminación forzada; 8083/5174 libres |
| Parser PowerShell y git diff --check | sin errores |

La primera pasada del harness del proxy esperaba erróneamente JSON del backend para el Host ajeno. Vite ya lo rechaza antes de reenviar y devuelve texto plano. Se corrigió esa expectativa, sin cambiar la aplicación ni relajar controles; el log intermedio se conserva. La ejecución final usa el mismo JAR ya construido, sin repetir la suite o empaquetado.

Vitest 8/8 y build de 54 módulos fueron aportados por el usuario en este seguimiento. No se presentan como nuevas ejecuciones del agente ni se repitieron: no cambió código frontend. Playwright completo, PDF y sitio público conservan su evidencia del 4/10; no se volvieron a ejecutar en esta corrección acotada.

## Aplicar a la sesión del usuario

El PID 28044 mantiene las clases y el entorno con que arrancó. El arreglo está compilado y probado, pero su sesión seguirá devolviendo 403 hasta reiniciar su Run con la configuración correcta. Acción mínima:

1. En IntelliJ, detener solo el Run actual de Scalaris y esperar su cierre.
2. Seleccionar **Scalaris Vite** y ejecutar Run. Conserva la base descartable y almacenamiento heredados del IDE abierto.
3. Mantener `pnpm.cmd dev` en marcha y recargar http://127.0.0.1:5173/.
4. Comprobar http://127.0.0.1:5173/api/health: 200/status ok.

Si la nueva configuración no aparece aún, en **Run → Edit Configurations → Environment variables** agregar a la configuración que ya funciona, conservando las demás variables:

```text
SCALARIS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173
```

Luego detener y volver a ejecutar ese Run. No requiere cerrar IntelliJ, reinstalar dependencias ni actualizar pnpm. Esta aplicación en la sesión del usuario y la inspección visual final del tablero quedan pendientes de su reinicio; no se confunden con la comprobación aislada del proxy.
