# Respaldos de las demos

`backup-demos.sh` se instala como `/usr/local/sbin/scalaris-demos-backup`, con dueño root y modo 700. Requiere Python 3, Git, tar, Docker y Compose. La unidad oneshot ejecuta como root con umask 077; el timer programa las 03:55 de la zona horaria del VPS, con hasta 10 minutos de demora aleatoria, y recupera ejecuciones omitidas mediante `Persistent=true`.

La instalación de estos archivos no acredita una ejecución: antes de habilitar el timer se debe ejecutar el servicio, comprobar su resultado y revisar los archivos producidos sin imprimir secretos.

Desde el checkout de Scalaris en el VPS, como administrador:

```sh
install -o root -g root -m 700 scripts/vps/backup-demos.sh /usr/local/sbin/scalaris-demos-backup
install -o root -g root -m 644 scripts/vps/scalaris-demos-backup.service /etc/systemd/system/scalaris-demos-backup.service
install -o root -g root -m 644 scripts/vps/scalaris-demos-backup.timer /etc/systemd/system/scalaris-demos-backup.timer
systemctl daemon-reload
systemctl start scalaris-demos-backup.service
systemctl status scalaris-demos-backup.service --no-pager
```

Sólo después de comprobar el resultado correcto de esa primera corrida:

```sh
systemctl enable --now scalaris-demos-backup.timer
systemctl list-timers scalaris-demos-backup.timer --no-pager
```

Instalación y primera ejecución verificadas el 22/10/2026 UTC: `Result=success`, `ExecMainStatus=0` y timer habilitado. La primera copia conjunta quedó en `demo-configuration/20261022T021738Z`; los tres overlays archivados aprobaron su manifiesto SHA-256. Se preservaron los timers previos de las otras aplicaciones y de configuración general.

## Contenido

- FourBubbles: dump validado por su script oficial, configuración privada y revisión Git.
- Gestudio: dump custom validado, archivo de recibos disponibles, hashes, configuración y revisión Git. La semilla oficial registra 48 recibos sintéticos sin generar sus PDF físicos. El estado privado del helper se archiva desde **`/srv/private/gestudio-demo`**; incluye credenciales y evidencia de aprovisionamiento, por lo que su archivo permanece privado.
- Los overlays de código Gestudio existentes en `/root/gestudio-code-overlay.tar.gz`, `/root/gestudio-provision-helper.tar.gz` y `/root/gestudio-public-demo.tar.gz` se copian cuando están presentes, con `gestudio-code.SHA256SUMS`. Se conservan por separado del `.env`; el backup no introduce configuración privada en los archivos de código. La ausencia de un overlay posterior no bloquea una primera copia.
- PharmaHome y Calendario de servicios: revisiones Git para reconstruir los estáticos.
- Caddy: copia de la configuración de sitios, incluidas las rutas anidadas.

Las copias del coordinador quedan en `/var/backups/scalaris/demo-configuration`. Los datos de Gestudio quedan en `/var/backups/scalaris/gestudio`; FourBubbles usa `/var/backups/scalaris/fourbubbles`.

## Retención acotada

Después de completar los respaldos, se eliminan snapshots generados hace más de 14 días en los dos directorios explícitos de configuración y Gestudio. Se exige nombre UTC `YYYYMMDDTHHMMSSZ`, ubicación como hijo directo del directorio permitido, contenido conocido y ausencia de modificaciones recientes o enlaces simbólicos. Una configuración antigua se elimina completa, incluidas sus rutas Caddy; una carpeta desconocida o modificada se conserva y se informa. FourBubbles conserva su propia retención de dumps de 14 días.

El coordinador no elimina volúmenes, aplicaciones, respaldos de otras aplicaciones ni el estado privado vivo. Las copias permanecen en el mismo VPS: no son un respaldo externo.

## Validador de restauración aislada para Gestudio

`validate-gestudio-backup.py` implementa una prueba real de recuperación completa. La ejecución en el VPS sobre `gestudio/20261022T020641Z` terminó con `PASS_ISOLATED_FULL_ACL_RESTORE`, base activa intacta y contenedor temporal retirado. Aprobó propietarios/ACL, 28 alumnos, dos tenants, baseline B12, salud `GREEN` y los tres controles de aislamiento del rol de aplicación. El resultado declara expresamente los 48 PDF no generados por la semilla.

En el VPS, elegir un snapshot existente y ejecutar:

```sh
python3 scripts/vps/validate-gestudio-backup.py --self-test
python3 scripts/vps/validate-gestudio-backup.py --app-root /srv/apps/gestudio-demo --backup /var/backups/scalaris/gestudio/SNAPSHOT_UTC
```

El validador:

1. Comprueba SHA-256 del dump y del tar de recibos, lee todo el archivo y rechaza rutas fuera de la raíz, enlaces y miembros no regulares.
2. Utiliza únicamente la imagen PostgreSQL 15.18 ya cacheada en el daemon local. No descarga imágenes ni usa un contexto Docker remoto.
3. Crea un contenedor con nombre y etiqueta únicos, sin red ni puertos, 512 MiB y 0,5 CPU. La base usa un tmpfs de 384 MiB; las dos únicas vinculaciones del host (backup e inicializador oficial de roles) son de lectura.
4. Inicializa los mismos logins y grupos técnicos con el `.env` privado existente y el script oficial. Recrea también el rol global `gestudio_health`, ausente en un `pg_dump` de una sola base.
5. Ejecuta `pg_restore --exit-on-error` **con propietarios y ACL completos**, sin `--no-owner` ni `--no-acl`.
6. Comprueba 28 alumnos, dos tenants, una fila Flyway `SQL_BASELINE` de versión 12 y salud multitenant `GREEN`; exige los archivos de todos los recibos referenciados. Sólo admite la excepción exacta de la semilla oficial: las 48 referencias Alpha `recibos/demo-pago-001.pdf` a `048.pdf`, sin otros recibos y con el tar sin archivos. Informa `syntheticReceiptPdfsNotGeneratedByOfficialFixture=48`; rechaza referencias incompletas, archivos parcialmente presentes y cualquier recibo operativo faltante.
7. Cambia al login real de aplicación en la copia y verifica Alpha con 28 alumnos, Beta sin alumnos ajenos y rechazo `42501` sin contexto tenant.
8. En `finally`, elimina únicamente el contenedor cuya etiqueta y nombre coinciden con la ejecución. No monta ni conecta la base viva. Informa resultados sin imprimir secretos, SQL ni salidas crudas de Docker.

La prueba valida la recuperación de esta demo sintética y su aislamiento conocido. Los 48 PDF de la semilla nunca se generaron: un resultado aprobado con esa excepción no acredita su restauración. La demo pública informa esa limitación y tiene deshabilitada su descarga. El validador no inicia un backend recuperado ni certifica todos los flujos de interfaz. El coordinador debe guardar el resultado ejecutado antes de declarar una restauración aprobada.

El self-test cubre la excepción exacta de 48 referencias sin archivos y los recibos normales presentes. Deben fallar un recibo operativo ausente, 47 referencias, referencias adicionales o duplicadas y un archivo de recibos incompleto o con archivos ajenos a la excepción.

Controles locales de retención: `python scripts/vps/backup-retention.test.py`. Se ejecutaron cuatro casos y se omitió el caso de symlink porque este Windows no permite crearlos sin elevación; no se probó la eliminación de copias del VPS.

## Restauración aislada de FourBubbles

`validate-fourbubbles-backup.py --backupfile /var/backups/scalaris/fourbubbles/fourbubbles-20261022T012755Z.dump` aprobó en el VPS con `PASS_ISOLATED_FULL_ACL_RESTORE`. Recuperó tres clientes sintéticos, tres pedidos, dos ciclos completos y las once migraciones, preservando propietarios y las cuentas exclusivas `REPORT_VIEWER`/`ADMIN`. El archivo de origen conservó sus bytes y el contenedor temporal se retiró.

Este validador también fuerza el socket Docker local y una imagen PostgreSQL ya cacheada, sin red ni puertos, con memoria/CPU limitadas y sin montar volúmenes activos. No necesita las credenciales reales. Los informes sin secretos de ambas ejecuciones se conservaron en `/var/log/scalaris-four-restore-validation.log` y `/var/log/scalaris-gestudio-restore-validation.log`.
