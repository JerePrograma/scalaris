# Usar Scalaris en Jeremias

La forma recomendada de uso diario es hacer doble clic en **Scalaris LAN** en el escritorio de Jeremias. Scalaris sirve el frontend React compilado y la API desde el mismo servidor, en **http://192.168.1.9:8081/**, para la PC y los dispositivos de la red aprobada. No necesitás Vite ni dos consolas para trabajar. El propietario confirmó que **Tablero y Clientes cargan desde su celular físico** conectado a esa Wi-Fi.

Este documento describe la instalación local y las pantallas que existen actualmente. La evidencia de acceso del 5/10/2026 y sus límites están en [VERIFICATION-20261005-ACCESS.md](VERIFICATION-20261005-ACCESS.md); los informes anteriores se conservan como historial. Un proceso o una IP registrados allí corresponden al momento de esa prueba: el lanzador vuelve a comprobar la disponibilidad actual.

## Abrir cada día

Hacé doble clic en el acceso **Scalaris LAN** (`C:\Users\Jerem\Desktop\Scalaris LAN.lnk`). También podés copiar estos comandos en Windows PowerShell:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\AbrirScalaris.cmd -Mode Lan
```

El lanzador reutiliza una instancia propia sana; si no existe, usa `Start.ps1`. Comprueba el propietario del proceso y puerto y espera una respuesta correcta de `/api/health` antes de abrir el navegador. Volver a abrirlo no crea otra JVM. Si el puerto pertenece a una instancia ajena o no puede verificar el arranque, muestra el error y conserva los logs para revisarlo.

Cerrar la pestaña del navegador no detiene Scalaris. Para volver a entrar mientras está activo, abrí el mismo acceso del escritorio o **http://192.168.1.9:8081/** desde la PC o el celular. Las pantallas se cambian con los botones del menú y mantienen la URL `/`; al recargar se vuelve al Tablero. No existen rutas independientes como `/clientes` o `/presupuestos`.

## Requisitos de esta instalación

- PC encendida y PostgreSQL 18.6 local disponible en `localhost:5433`, base **scalaris**. PostgreSQL 9.6 en 5432 y Java 8 de Molineros son otra instalación y no se utilizan.
- Java 25.0.4.1 para Scalaris y el JAR construido en `backoffice\backend\target\backoffice-1.0.0.jar`.
- `backoffice\config.local.ps1` con las rutas propias de herramientas, base y almacenamiento. La credencial protegida existente se carga localmente; no se escribe en comandos, Git ni documentación.
- Windows PowerShell 5.1 o 7. Los lanzadores no cambian la política de ejecución global ni usan `ExecutionPolicy Bypass`.
- Para actualizar: Node 24, pnpm 11.19.0 y Maven 3.9.12 según la configuración del proyecto. Spring Boot permanece en 3.5.16 y Vite en 8.3.2.

Las herramientas y variables se seleccionan para este proyecto y los scripts restauran el entorno de la terminal al terminar. La instalación del frontend usa `pnpm.cmd install --frozen-lockfile`; no sustituir el lockfile ni actualizar versiones para abrir la aplicación.

## Detener

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
```

La parada identifica el PID, hora de inicio y JAR registrados por los scripts y solicita el cierre de esa JVM. No detiene todos los `java.exe` ni PostgreSQL. Si identifica un proceso diferente o la parada no termina, informa el problema y no fuerza la terminación. Si arrancaste Scalaris mediante el Run de IntelliJ, detené ese Run desde el IDE: los scripts no adoptan una JVM ajena.

## Alternativa para usar solamente la PC

El modo Local seguro se conserva ligado a loopback. Para cambiar desde una instancia LAN, primero detenela:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\AbrirScalaris.cmd
```

En ese modo la URL es **http://127.0.0.1:8081/**, también accesible por `http://localhost:8081/` en la PC. El celular no alcanza el loopback de la PC. El lanzador sin `-Mode Lan` mantiene Local como valor seguro por defecto; no cambia de modo una instancia activa. Elegir Local **no revierte automáticamente** el perfil Private ni la regla de firewall; la reversión completa está documentada más abajo. Para volver al uso compartido, ejecutá Stop y después `AbrirScalaris.cmd -Mode Lan`.

## Actualizar después de un cambio de código

Abrir diariamente no recompila. Para incorporar cambios del frontend o backend, desde PowerShell:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Build.ps1
.\AbrirScalaris.cmd -Mode Lan
```

Si el build falla, corregí el error antes de abrir de nuevo. `Build.ps1` instala con el lockfile congelado, ejecuta TypeScript/Vite y empaqueta los recursos actuales en el JAR. Al preparar los recursos reemplaza solamente el directorio estático generado para evitar JS/CSS sobrantes de una compilación anterior. La fuente del frontend está en `backoffice\frontend\src`, no en `target` ni `dist`.

El arranque real **valida V1–V3**. No ejecutes `Migrate.ps1` para actualizar el frontend, abrir diariamente o resolver un 403. Una migración pendiente requiere revisión y aprobación específica; el script de migración conserva su circuito de backup y validación. No modificar migraciones ya aplicadas.

## Trabajar con las pantallas existentes

### Clientes y equipos

1. Entrá en **Clientes** → **+ Nuevo cliente**. Completá **Nombre o identificación**; teléfono, correo, dirección y observaciones son opcionales. Guardá. Para corregir datos usá **Editar** y para consultar el historial, **Ver consultas**.
2. Entrá en **Consultas y trabajos** → **+ Nueva consulta**, o usá **Nueva consulta** desde el Tablero. Seleccioná el cliente, el servicio y un título. Si todavía no hay clientes, la pantalla ofrece registrar uno primero.
3. Para un equipo, elegí **Reparación / mantenimiento** y completá los campos pertinentes: **Tipo de equipo**, **Marca / modelo**, **Número de serie**, **Accesorios recibidos**, **Falla declarada / repuesto solicitado**, **Condición de recepción** y **Diagnóstico**. Para software, **Web / software** presenta necesidad, alcance, requisitos y entregables. Los equipos se registran dentro de la ficha de consulta; no hay una pantalla de inventario separada.
4. Abrí la consulta desde su lista. **Editar ficha** permite corregir sus datos. **Cambiar estado / reabrir** registra el avance o una corrección con los requisitos del flujo existente. Notas, adjuntos y la cronología están dentro del caso.

No guardes contraseñas ni credenciales de clientes en campos o archivos. El menú **Catálogo** permite editar conceptos y tarifas; al usarlos en un presupuesto se copia su valor actual. No administra stock.

### Presupuestos y PDF

1. Dentro de una consulta, usá **+ Presupuesto**. Agregá conceptos mediante **Agregar desde catálogo** o **+ Concepto manual / repuesto**. Completá cantidades, unidades, precios y plazo; usá punto para decimales al ingresar importes.
2. Usá **Calcular importes**, revisá total, descuentos y condiciones, y **Crear revisión**. Para un borrador existente, **Editar borrador** y **Guardar borrador** conservan esa revisión.
3. En **Presupuestos y revisiones**, **Descargar PDF** descarga el presupuesto de la revisión seleccionada. El PDF conserva sus conceptos e importes históricos. **Ver conceptos e importes históricos** muestra ese detalle en la pantalla.
4. Después de enviar el PDF manualmente al cliente, usá **Registrar envío** → **Confirmar registro de envío**. Esa acción congela la revisión y registra lo ocurrido; no envía WhatsApp ni correo.
5. Cuando el cliente acepte, elegí **Registrar aceptación**, completá fecha/hora de Buenos Aires, canal y constancia y confirmá la revisión exacta. Esto crea o actualiza la **Orden de trabajo**. Para cambiar una revisión enviada, usá **Nueva revisión desde ésta** y registrá su envío y aceptación explícitamente.

### Trabajo y pagos

1. En la **Orden de trabajo**, **Editar tareas / recepción / entrega** permite cargar tareas, avances, horas reales y constancias. Las horas reales no cambian el total aceptado.
2. Con una revisión aceptada, **Registrar pago** solicita importe, fecha, medio, referencia y nota. Revisá el saldo y usá **Confirmar pago**. Es un registro manual; no procesa pagos online.
3. El estado del trabajo y **Sin pago / Parcial / Pagado** se muestran por separado. La seña sugerida y el saldo generan advertencias; no bloquean por sí solos el trabajo o la entrega.
4. Si un pago está mal, en **Cobros manuales** usá **Anular con motivo**, completá el motivo y **Confirmar anulación**. Se conserva el original y se agrega una contrapartida; no se borra el pago.

El menú **Trazabilidad** permite consultar eventos registrados. No identifica usuarios porque el backoffice no tiene login. **Importar ficha** permite previsualizar y confirmar un JSON compatible de la consulta pública; no hay recepción automática desde el sitio público.

## Backup

Los backups se hacen desde scripts; no hay un botón de backup en la interfaz. Detené todas las instancias de Scalaris, incluida una posible ejecución desde IntelliJ, antes de copiar la base y sus adjuntos:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Backup.ps1
.\AbrirScalaris.cmd -Mode Lan
```

Esperá el mensaje **Respaldo coordinado completado** y conservá el destino indicado por el script. El backup predeterminado usa el directorio configurado fuera del repositorio, con un nombre nuevo fechado. Contiene `database.dump`, los adjuntos referenciados y `manifest.json` con hashes; el script verifica que el dump sea legible y que los adjuntos coincidan con PostgreSQL. Si falla, conservá los logs y revisá el resultado antes de considerarlo válido.

Para elegir un destino, pasá una carpeta **nueva**, fuera del repositorio, por ejemplo:

```powershell
.\backoffice\scripts\Backup.ps1 -Destination 'D:\Respaldos\Scalaris\copia-nueva'
```

El disco y la carpeta padre deben existir o ser accesibles; el nombre de copia no debe estar usado. El script rechaza un almacenamiento activo. No borres `.scalaris.lock` para forzar un backup o un arranque.

Restaurar es una operación separada. `Restore.ps1` exige base `scalaris_restore_*` y almacenamiento nuevos y verifica los hashes; **nunca se restaura encima de scalaris para probar**. El comando y la revisión posterior están en [README.md](README.md#respaldo-coordinado-y-restauraci%C3%B3n). Conservá la base y los archivos originales hasta revisar una recuperación.

## Celular y otros dispositivos: LAN aprobada, activa y comprobada

Scalaris usa modo **Lan**, ligado exclusivamente a **192.168.1.9:8081**. Esa es la URL tanto para la PC como para el celular. `localhost` en el teléfono se refiere al propio teléfono y no sirve para alcanzar Jeremias.

El 5 de octubre de 2026 se activó, con aprobación puntual y UAC, la interfaz **Wi-Fi**, índice **15**, IPv4 **192.168.1.9/24**, red **RSO37518-5G**, pasando su perfil de Public a **Private**. El teléfono informado por el propietario usa **192.168.1.12**. La URL **http://192.168.1.9:8081/** se verificó desde la PC y el propietario confirmó **Tablero y Clientes en el teléfono físico** conectado a esa Wi-Fi. La visualización móvil de la PC se comprobó aparte y no se utilizó como sustituto de esa confirmación. Las direcciones pueden cambiar por DHCP.

**Este backoffice no tiene login. Cualquier persona que pueda alcanzar el servicio por la red podría ver y editar clientes, presupuestos y pagos.** Una LAN corporativa no es automáticamente confiable. El propietario aprobó puntualmente el alcance para **todos los dispositivos de 192.168.1.0/24**, no únicamente el teléfono. La regla efectiva **Scalaris-Backoffice-LAN-8081** está limitada a TCP 8081, el ejecutable de Java 25 de Scalaris, dirección local 192.168.1.9, interfaz Wi-Fi y origen 192.168.1.0/24, únicamente en perfil Private. No se habilitaron Public ni todos los perfiles.

**Cambiar la Wi-Fi de Public a Private también hace aplicables las reglas Private ya existentes de Windows para otras aplicaciones.** La regla nueva de Scalaris queda limitada al alcance indicado, pero el cambio de perfil tiene ese efecto adicional sobre reglas que ya existían. No se modifican ni eliminan esas reglas ajenas.

Los scripts de apertura y arranque no cambian el perfil de red ni el firewall. `Start.ps1 -Mode Lan` exige tres valores aprobados ya configurados en `config.local.ps1`: `LanAddress='192.168.1.9'`, `LanInterfaceAlias='Wi-Fi'` y `LanNetworkName='RSO37518-5G'` (propiedad `Name` de `Get-NetConnectionProfile`). Verifica además que la IP sea actual y el perfil **Private**; escucha solo en esa IP y mantiene una lista exacta de hosts/orígenes. Si cambia el nombre de red, rechaza el arranque incluso si conserva interfaz e IP. Una red o alcance distintos requieren revisión y aprobación propia.

El helper separado `Network-Lan.ps1` ya activó la regla exacta y el cambio de perfil y registró el valor original para revertirlo. **No se ejecuta para abrir cada día**. Este comando se conserva para una reactivación del mismo contrato aprobado, si fuera necesaria; solicita UAC y abre Windows PowerShell 5.1 para revisar el resultado, sin Bypass ni cambio de ExecutionPolicy:

```powershell
Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs `
  -ArgumentList '-NoProfile -NoExit -File "C:\laburo\Scalaris\backoffice\scripts\Network-Lan.ps1" -Action Enable -LocalAddress "192.168.1.9" -InterfaceAlias "Wi-Fi" -InterfaceIndex 15 -NetworkName "RSO37518-5G" -RemoteSubnet "192.168.1.0/24"'
```

Revisá el mensaje de éxito en esa ventana elevada antes de continuar; si falla, conservá el error y no arranques LAN. El helper no inicia Scalaris ni cambia las otras reglas del firewall. Para cambiar desde una instancia Local al uso compartido ya configurado, usá una terminal normal:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\AbrirScalaris.cmd -Mode Lan
```

La PC debe estar encendida, conectada y el servidor activo. Suspensión, apagado, cambio de Wi-Fi, VPN o cambio de IP interrumpen el acceso. Si DHCP cambia la IP, hay que comprobar interfaz, nombre de red y perfil, actualizar el permiso exacto y volver a verificar; no se amplía la allowlist a cualquier host ni se traslada la autorización a otra red.

El formulario **Registrar pago** conserva su clave de operación también sobre HTTP de una IP LAN. Esa compatibilidad se prueba de forma aislada. Los recorridos con pagos se verificaron en una base descartable; la confirmación física del teléfono comprende lecturas de Tablero y Clientes, sin crear pagos ni modificar datos reales. El detalle técnico se basa en las restricciones de contexto de [Web Cryptography API](https://w3c.github.io/webcrypto/#crypto-interface).

Para revertir después de una activación aprobada, primero detené Scalaris. Luego solicitá UAC para ejecutar **Disable** con el mismo contrato; el helper verifica su regla propia antes de eliminarla y devuelve esa red al perfil Public original:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs `
  -ArgumentList '-NoProfile -NoExit -File "C:\laburo\Scalaris\backoffice\scripts\Network-Lan.ps1" -Action Disable -LocalAddress "192.168.1.9" -InterfaceAlias "Wi-Fi" -InterfaceIndex 15 -NetworkName "RSO37518-5G" -RemoteSubnet "192.168.1.0/24"'
```

Revisá el resultado en la ventana elevada. Para abrir en loopback desde la terminal normal:

```powershell
Set-Location 'C:\laburo\Scalaris'
.\AbrirScalaris.cmd
```

El estado original y la identidad de la regla se conservan en `backoffice\.runtime\network-lan.json`, fuera de Git. El registro se retiene después de la reversión y ante un fallo para diagnóstico o reintento; no lo borres para forzar una operación. Si cambió la red, IP, programa o los filtros de la regla, el helper rechaza la operación para revisión y no elimina reglas ajenas. La activación real está verificada; **la reversión real no se ejecutó** y su resultado debe comprobarse cuando se utilice. PostgreSQL **5433** permanece local; los dispositivos usan únicamente **8081**. No se configuran router, port forwarding, túneles ni publicación en Internet. La conexión disponible es HTTP; no se configura HTTPS.

## Desarrollo opcional con Vite

Para modificar React con recarga automática, podés usar dos terminales. Es una alternativa de desarrollo, no el circuito diario. La API continúa en 8081 y Vite solo escucha en loopback en 5173. Si ya hay una instancia diaria de Scalaris, detenela antes de cambiar su configuración de desarrollo:

```powershell
# Terminal 1, desde la raíz
Set-Location 'C:\laburo\Scalaris'
.\backoffice\scripts\Stop.ps1
.\backoffice\scripts\Start.ps1 -Mode Local -FrontendDev
```

```powershell
# Terminal 2
Set-Location 'C:\laburo\Scalaris\backoffice\frontend'
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
# Abrir http://127.0.0.1:5173/
```

`-FrontendDev` autoriza únicamente los orígenes locales de 5173, además de los habituales de 8081. El proxy preserva Host y Origin (`changeOrigin: false`); la API sigue usando rutas relativas `/api`. No agrega CORS con comodín ni acepta sitios ajenos. Al terminar, detené Vite con Ctrl+C y usá `Stop.ps1` para la API. Para volver al circuito diario, ejecutá `AbrirScalaris.cmd -Mode Lan`. Si cambiaste código, primero completá la actualización descrita arriba.

Las pruebas que crean clientes, presupuestos, pagos, PDFs o adjuntos deben usar una base `scalaris_test_*` y almacenamiento separado. No ejecutar `workflow.spec.ts` ni otros recorridos con escrituras contra **scalaris**. `Test.ps1 -Database scalaris_test_nombre` y `Start.ps1 -TestDatabase scalaris_test_nombre` conservan las guardias de entorno descartable; la base de prueba debe existir. Los recorridos E2E con escrituras exigen también `SCALARIS_E2E_DATABASE` y `SCALARIS_E2E_URL`: `scripts/Assert-TestInstance.ps1` verifica identidad de base, proceso y almacenamiento propios y disponibilidad HTTP antes de navegar o escribir. Los [comandos de pruebas del README](README.md#pruebas) muestran el circuito completo para una base descartable.

## Errores frecuentes

| Situación | Qué comprobar |
|---|---|
| El navegador no abre o el lanzador muestra un fallo | Leer el mensaje del lanzador y `backoffice\.runtime\app.log` / `error.log`. La disponibilidad se comprueba por HTTP, no solamente por haber iniciado Java. No compartir secretos ni datos de clientes de esos logs. |
| Puerto 8081 ocupado | Identificar su PID y origen. Si es el Run de Scalaris en IntelliJ, detener ese Run. No finalizar todos los procesos Java ni adoptar una instancia que los scripts no puedan identificar. |
| Instancia activa con otro modo | Usar Stop antes de cambiar Local/Lan/FrontendDev. Para el uso diario aprobado, abrir Scalaris LAN del escritorio o `AbrirScalaris.cmd -Mode Lan`; el comando sin parámetros conserva Local como valor seguro. |
| Falta el JAR | Ejecutar `Build.ps1` con la aplicación detenida y revisar su resultado; abrir diariamente no compila por defecto. |
| 403 usando 5173 | La instancia backend debe haberse iniciado con `-FrontendDev`. El proxy conserva Host y Origin; una lista exclusiva de 8081 rechaza el Host de Vite. No atribuir esa respuesta HTTP al firewall ni habilitar todos los orígenes. |
| 403 usando un origen ajeno | El rechazo es esperado: mantener las guardias y usar la URL autorizada. |
| Error de base o migración pendiente | Confirmar PostgreSQL 18.6, loopback, puerto 5433 y base scalaris. No cambiar contraseña, ejecutar migraciones, reparar Flyway o tocar PostgreSQL 9.6 sin evidencia y revisión. |
| Almacenamiento bloqueado | Comprobar otra instancia de Scalaris o backup activo. Detener la instancia por su mecanismo propio; no borrar un lock activo. |
| PowerShell rechaza el archivo antes de ejecutarlo | Consultar `Get-ExecutionPolicy -List` y conservar el mensaje exacto. Revisar el origen de los archivos o la política aplicable; los lanzadores no cambian políticas globales ni evitan una política de grupo. |
| La pantalla parece desactualizada | Completar Stop → Build → Abrir y recargar la pestaña. Los assets del JAR deben corresponder al build de React; arrancar un Run de IntelliJ antiguo no actualiza automáticamente esos recursos. |
| El celular no conecta tras aprobar LAN | Primero verificar servidor activo, IP/binding y health desde la PC; después Host/Origin, regla de firewall aprobada y red del teléfono. Wi-Fi de invitados, aislamiento entre dispositivos o una VPN pueden impedir la conexión aunque ambos tengan Internet. |

Para comprobar la instancia LAN actual desde la PC sin escribir datos:

```powershell
Invoke-RestMethod 'http://192.168.1.9:8081/api/health' -TimeoutSec 5
```

La respuesta sana debe incluir `status: ok`. Una API inexistente debe conservar su error HTTP/JSON; no debe entregar el HTML del frontend. La verificación real no crea ejemplos ni modifica clientes, presupuestos o pagos.
