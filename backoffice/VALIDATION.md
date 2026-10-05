# Evidencia de validación · 3 de octubre de 2026

Trabajo local en `C:\laburo\Scalaris`, remoto verificado `https://github.com/JerePrograma/scalaris.git`, rama `codex/backoffice-v1`. Estado inicial: `main`, sin cambios seguidos y con `presupuestos/` sin seguimiento; esa carpeta se conservó. No se encontraron instrucciones AGENTS aplicables. No se hizo push, deploy, cambio de firewall, router, túneles, credenciales del sistema o servicios de otros proyectos.

Los 71 archivos de implementación/documentación quedaron preparados en staging. Se intentó `git commit`, pero Git rechazó la operación por falta de `user.name` y `user.email`. No se inventó identidad de autor ni se modificó configuración global. El commit permanece pendiente de una identidad elegida por el propietario; el código, rama, JAR y pruebas están disponibles localmente.

## Resultados ejecutados

| Verificación | Resultado real |
|---|---|
| `backoffice/scripts/Build.ps1` | React + TypeScript + Vite y Maven `package`: éxito, JAR con React incluido |
| `mvn test` con `SCALARIS_TEST_DB_URL` local descartable | 27 pruebas: 10 unitarias, 17 con PostgreSQL; 0 fallos, 0 errores, 0 omitidas |
| `pnpm --dir backoffice/frontend test` | 2 pruebas Vitest aprobadas |
| `node --test scripts/public-form.test.mjs` | 5 pruebas aprobadas |
| `pnpm --dir backoffice/frontend test:e2e` | 2 recorridos Playwright aprobados, usando HTTP real y PostgreSQL |
| `node scripts/check.mjs` | Sitio público, contacto, recursos, fuentes/licencia, anclas y sintaxis/recursos del formulario: aprobado |
| Comparación del HTML con `main:public/index.html` | Al retirar el enlace agregado al formulario y normalizar saltos de línea, idéntico al original |
| `pnpm audit` (todas las dependencias) | Sin vulnerabilidades conocidas reportadas por el registro en esta ejecución |
| `git diff --check` | Sin errores de espacios; Git avisa conversión habitual LF/CRLF |

El backend se probó con Temurin 21.0.12.1, Maven 3.9.12 y PostgreSQL 17.11 portable. Node 24.19.0 y pnpm 11.19.0. El cluster descartable se creó en `artifacts/test-pg`, puerto 55432, usuario de prueba sin contraseña, autenticación trust **solo en ese cluster de prueba con listener 127.0.0.1**. No se utiliza esa configuración para datos reales ni se registró servicio de Windows. Se detuvo al terminar la validación. Las bases y respaldos de prueba se conservaron para inspección, sin limpiar directorios ajenos.

## Cobertura comprobada

Cálculo decimal y redondeo HALF_UP, orden de descuentos, ajuste explícito/motivo y preservación del desglose; límites y entradas inválidas; vencimiento excluyendo emisión y fines de semana; campos opcionales de cliente; snapshots de cliente/presupuesto y aceptación de revisión exacta; nueva aceptación explícita sin alterar la anterior; fecha informada de aceptación distinta de su fecha de carga; transiciones, reapertura con motivo y constancia de entrega; entrega sin seña; cobros independientes, duplicados, sobrepago, anulación trazable y bloqueo concurrente; cuatro revisiones concurrentes sin repetir número; rechazo de actualización con versión antigua; importación hostil, duplicada y concurrente; archivos, nombres, MIME y límite de cantidad; PDF con acciones rechazado; eventos/pagos inmutables por las rutas de aplicación/base; seed repetible sin sobrescribir tarifas editadas; JSON con claves duplicadas rechazado; Host/Origin/Fetch Metadata y encabezado de mutación; rechazo de URL de base remota antes de conectar/migrar.

Recorrido UI 1: cliente → caso de equipo → diagnóstico → presupuesto calculado de ARS 15.000 → registro manual de envío → aceptación R1 → pago ARS 1.500 → tareas/horas reales/entrega → en trabajo → listo → entregado con saldo ARS 13.500 → adjunto TXT. Todo persistido en PostgreSQL, sin respuestas simuladas de API.

Recorrido UI 2: formulario software → respuestas → revisión → corregir → JSON descargado → vista previa en backoffice → importación confirmada → segunda importación detectada como duplicada. Se verificó que el enlace WhatsApp no contuviera el nombre ingresado; no se abrió ni envió WhatsApp.

Capturas desktop 1280 px y móvil 390 px revisadas; ambas interfaces sin desbordamiento horizontal en los recorridos. Presupuesto de una página renderizado con Poppler y revisado. También se generó un presupuesto de 35 conceptos largos, de 8 páginas: se renderizaron/revisaron las 8 páginas, con importes, texto y pies legibles. Evidencia local ignorada por Git en `artifacts/backoffice-desktop.png`, `backoffice-mobile.png`, `public-form-desktop.png`, `public-form-mobile.png`, `presupuesto-validacion.pdf` y `pdf-largo-*.png`.

## Operación, LAN y restauración

`Start.ps1 -Mode Local`, `Start.ps1 -Mode Lan` y `Stop.ps1` se ejecutaron. Se detectó y corrigió una diferencia de parsing de fechas de PowerShell en la comprobación del PID; la parada posterior funcionó con verificación de PID/hora/JAR. PostgreSQL y el servidor estático siguieron funcionando después de parar la app.

En LAN, `/api/health` respondió desde la propia PC por `http://192.168.1.9:8081`, con base accesible. El listener del backoffice fue general (socket dual IPv4/IPv6 de Java) y el de PostgreSQL únicamente `127.0.0.1:55432`. **No se comprobó desde un segundo dispositivo físico**, ni se cambió firewall. La dirección 192.168.1.9 es la observada durante esta sesión, puede cambiar por DHCP.

`Backup.ps1` rechazó la ejecución con la app abierta debido al bloqueo exclusivo de almacenamiento. Con la app detenida, respaldo y `Restore.ps1` en una base nueva completaron dump, verificación de manifest y referencias/SHA-256. Última restauración verificada:

- Base: `scalaris_restore_20261003142704` en el cluster de prueba.
- Respaldo: `C:\Users\Jerem\AppData\Local\Temp\scalaris-backup-20261003142704`.
- Adjuntos restaurados: `C:\Users\Jerem\AppData\Local\Temp\scalaris-restore-20261003142704`.
- Conteos: 2 clientes, 2 casos, 1 revisión, 1 pago, 1 adjunto y 15 eventos.
- Se inició la aplicación apuntando a esa base y almacenamiento separados. Snapshot de revisión y saldo coincidieron con el origen. Se descargaron el PDF y el adjunto: el texto completo del PDF y el contenido del TXT fueron idénticos al origen. Se detuvo la instancia restaurada.

Es una restauración de datos descartables, **nunca sobre datos reales**. La base de prueba se reutilizó después para la corrida final de tests/recorridos; el respaldo anterior conserva el estado indicado.

## Pendientes y límites del entorno

- Configurar base dedicada local y credenciales elegidas/provistas por el propietario para uso real; no se inventó una contraseña ni se dejó configuración productiva con trust.
- Verificar acceso desde un celular u otra PC de la misma LAN. Solo si un bloqueo de firewall se confirma, decidir su permiso puntual; los scripts no lo cambian.
- Verificar PowerShell 5.1 si se elige esa versión; la ejecución comprobada fue PowerShell 7.
- Probar navegadores distintos de Chromium y un dispositivo físico si se requieren garantías específicas de compatibilidad. Se comprobó viewport móvil en Chromium, no hardware móvil real.
- La configuración de Pages se inspeccionó en README/workflow: build `node scripts/check.mjs`, salida `public`, producción `main`. No se verificó el panel remoto de la cuenta Cloudflare. No hubo publicación ni cambios a sus ajustes.
- El control de origen y los registros internos no autentican personas. La validación de archivos no es antivirus. Las copias/hash no constituyen auditoría inviolable. Estos límites están explicados en el README.

Al terminar quedaron detenidos la app, el servidor estático temporal y el cluster PostgreSQL creado para la prueba. Se retiró únicamente el `config.local.ps1` temporal creado por esta implementación; los ejemplos permanecen sin secretos.
