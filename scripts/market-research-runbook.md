# Corridas de referencias de precios

El usuario autorizó mostrar los precios calculados ahora, completar las referencias públicas por lotes y publicar lo terminado en `main`, también al cerrar las siguientes tandas. El heartbeat nativo existente es `completar-referencias-de-precios-de-scalaris`, en `America/Buenos_Aires`; conservar su programación guardada. No crear otra automatización ni dejar un proceso permanente entre corridas.

La configuración operativa está en `.private/market-research/search-run-config.json`. Cada corrida retoma checkpoints, realiza un lote acotado y guarda el progreso. No necesita una nueva autorización para continuar dentro de ese alcance. Si el usuario desactiva la configuración o pausa el heartbeat, respetar ese estado.

## Antes de cada corrida

Trabajar desde `C:\laburo\Scalaris projects\scalaris`. Usar los ejecutables de Node y Python disponibles en el runtime del host; no instalar otro servicio de investigación. Verificar con el tool conectado `tinyfish_get_wallet` que **Search y Fetch siguen costando USD 0**. Si una tarifa dejó de ser gratuita, detener esa parte y registrar el motivo. No habilitar recargas, agentes ni navegadores de pago.

Leer la configuración, `product-identities.json` y el estado de la cola. No enviar costos ni otros datos privados al buscador: las consultas usan únicamente nombres, modelos y atributos públicos.

```powershell
python .private/market-research/search-queue.py summary
python .private/market-research/search-queue.py next --retry-errors --limit 80
```

El helper devuelve el próximo `batchNumber` y los IDs todavía pendientes. `--retry-errors` incluye los errores reintentables junto a los productos nunca consultados. Un resultado válido nuevo puede reemplazar el último error del mismo ID en otro checkpoint; no se deben volver a registrar como nuevos los IDs ya resueltos.

Los conteos tienen significados distintos:

- `attemptedProducts`: IDs con algún intento, incluidos errores.
- `completedProducts`: búsqueda terminada con `indexed` o `noIndexedResults`.
- `errorProducts` y `retryableErrors`: errores existentes y cuáles pueden retomarse.
- `pending`: todos los IDs sin búsqueda terminada, incluidos errores.
- `neverAttemptedProducts`: IDs sin ningún intento.
- `queuedThisMode`: tamaño de la selección actual; sin `--retry-errors` excluye los errores.

El campo histórico `processed` significa **intentados**, no completados. Una búsqueda completada tampoco equivale a un precio verificado ni a una ficha leída.

## Buscar y guardar el lote

Invocar exclusivamente `tinyfish_search` con argumentos estructurados: `normalizedQuery + " Argentina precio"`, `location: "AR"`, `language: "es"`, `domain_type: "web"`. No interpolar los nombres de producto en comandos del sistema.

Usar un limitador global de **25 solicitudes por minuto**, separado de la concurrencia: dejar al menos **2.400 ms entre inicios de solicitud**. El máximo de ocho búsquedas concurrentes no autoriza una ráfaga de ocho solicitudes. Las búsquedas generales, el segundo intento de Mercado Libre y los reintentos consumen el mismo cupo. Si se comparte cupo con lecturas de fichas, mantener también esas llamadas dentro del límite global.

Si la búsqueda general no contiene un dominio de Mercado Libre, realizar una segunda búsqueda con `include_domains: "mercadolibre.com.ar,listado.mercadolibre.com.ar,articulo.mercadolibre.com.ar"`. Si no hay resultados, conservar ese resultado como tal. No sustituirlo por una variante aproximada.

Clasificar Mercado Libre por el hostname exacto `mercadolibre.com.ar` o un subdominio que termine en `.mercadolibre.com.ar`. En el entorno JavaScript reducido de `functions.exec`, no asumir que existe el constructor `URL`; usar una extracción explícita del host o la clasificación del lector local de Node. No clasificar por una coincidencia suelta dentro de la ruta.

Ante un 429, respetar el tiempo `Retry in`/`Retry-After` del proveedor, con hasta dos reintentos de la consulta afectada. Esperar en tramos de hasta 60 segundos. Si el error persiste o aparece un error sistémico de acceso, guardar el checkpoint y terminar la corrida. No aumentar concurrencia, rotar cuentas ni buscar una vía para eludir el límite. No reintentar bloqueos 401, 403 ni captchas de una ficha.

Cada lote se guarda únicamente en `.private/market-research/search-batches/batch-00003.json`, continuando el número indicado por el helper. No sobrescribir lotes anteriores. El formato es:

```json
{
  "version": 1,
  "batchNumber": 3,
  "generatedAt": "fecha ISO real de esta corrida",
  "stats": {"requests": 0, "generalQueries": 0, "mlQueries": 0, "cacheHits": 0, "rateRetries": 0},
  "systemicStop": false,
  "records": [{
    "id": "ID real del catálogo",
    "query": "consulta pública realizada",
    "researchedAt": "fecha ISO real de la consulta",
    "results": [{"title": "título", "url": "URL pública", "snippet": "extracto del índice"}],
    "mlResults": [],
    "storeResults": [],
    "status": "indexed",
    "indexOnly": true
  }]
}
```

`mlResults` contiene los resultados de Mercado Libre y `storeResults` los restantes candidatos; ninguno se considera una oferta verificada. `status` sólo puede ser `indexed`, `noIndexedResults` o `error`. Para un error agregar `error`, `errorType` y `retryEligible`; un error de acceso definitivo no es reintentable. Guardar también los resultados generales ya obtenidos si sólo falló la búsqueda adicional. Así no se pierde evidencia válida por un error posterior.

Puede reutilizarse la respuesta de una consulta exactamente idéntica cuando `canReuseQuery` lo indica, conservando una fila para cada ID. No fusionar productos por nombre, foto, GTIN o similitud. Hay GTIN compartidos con variantes distintas y repuestos con diferencias de OLED/Incell, calidad, marco, código de equipo, color o red 4G/5G.

Guardar checkpoints después de cada lote acotado y antes de terminar una corrida incompleta. No mantener una tarea de varias horas dentro de un despertar del heartbeat ni superponer corridas; el siguiente despertar retoma lo pendiente.

## Leer las fichas candidatas

Después de guardar búsquedas, obtener el plan local:

```powershell
node scripts/market-references.mjs plan --limit 40
```

`plan` no llama a Internet: devuelve `jobs[].fetchArgs` para el tool gratuito `tinyfish_fetch_content`. Ejecutar esos argumentos con máximo cuatro lotes concurrentes y diez URLs por llamada, `format: "json"`, `ttl: 0` y metadatos de página. La función exportada `executeFetchPlan` admite el tool y un escritor de checkpoints inyectados; sus límites y reintentos no reemplazan el limitador global de solicitudes.

Antes de cualquier lectura, rechazar URLs de acciones de compra, carrito, checkout y credenciales o sesiones, incluidas sus formas codificadas. No limpiar una URL de acción para reutilizar la respuesta como ficha segura. Conservar incidentes anteriores como observaciones excluidas de evidencia, sin repetir la acción.

Guardar la respuesta completa de cada llamada, incluso errores, en `.private/market-research/fetch-batches/<batchId>.json`:

```json
{"version":1,"batchId":"ID del plan","observedAt":"fecha ISO real","urls":[],"attempts":1,"response":{}}
```

No usar snippets como precios. Las fichas requieren coincidencia visible de producto y atributos, importe ARS, condiciones y disponibilidad. El parser separa cuotas, impuestos excluidos, relacionados y envío; si falta un dato, conserva el estado incompleto. Los bloqueos de Mercado Libre permanecen registrados sin elusión. Las lecturas compartidas se reutilizan por URL, pero se evalúan por separado para cada ID.

Si el JSON omite el importe final visible, puede leerse la misma ficha de los IDs de la tanda con Fetch gratuito en `format: "html"`. Guardar la respuesta íntegra en `fetch-batches` con `evidenceOnly: true`: es evidencia adicional para revisión, no reemplaza el JSON ni cierra por sí sola una lectura pendiente. Antes de aceptar un seed, leer el encabezado y modelo completos, total ARS, rótulo de transferencia y stock del producto. Separar impuestos excluidos, cuotas, importes anteriores o ambiguos y relacionados. Documentar archivo y fecha de lectura, fragmentos y comprobaciones en la revisión privada; nunca convertir automáticamente metadatos o estados parciales en seeds estrictos. La condición comercial se revisa por ID; no se equiparan publicaciones usadas/outlet con productos ordinarios.

## Cerrar la corrida y actualizar los paneles

```powershell
node scripts/market-references.mjs report
node scripts/build-market-dashboard.mjs
```

`report` actualiza los estados de todos los IDs en `market-references.json` y las URLs pendientes en `fetch-checkpoint.json`. El segundo comando regenera el **panel comercial privado** `.private/market-research/research-dashboard.html`, con costos, precios propios y cobertura real de investigación.

Para el panel técnico de evidencia externa, el comando opcional es:

```powershell
node scripts/market-references.mjs dashboard
```

Ese comando genera `.private/market-research/market-evidence-dashboard.html`; no reemplaza al panel comercial. En una corrida de fondo, regenerar los archivos sin abrir ventanas.

Revisar el resumen final de la cola y del reporte. Los errores no cuentan como completados y los índices no cuentan como precios verificados. Mantener separados los productos investigados sin coincidencia, los pendientes de lectura y los que tienen evidencia estricta. Los comandos de esta guía escriben salidas privadas; una actualización pública de precios debe seguir la política comercial y la autorización vigentes, nunca una cifra extraída de un snippet.

## Publicar cada tanda terminada

La autorización del usuario del 20/10/2026 permite publicar en `main` el avance y las referencias aceptadas, conservando privados los costos, márgenes, proveedores y reportes completos. El resumen público cuenta búsquedas completadas; no afirma que esas búsquedas sean precios verificados.

```powershell
node scripts/build-store-prices.mjs --apply-public
node scripts/build-public-market-progress.mjs
npm run check
git diff --check
```

El cálculo mantiene el piso rentable, transferencia y envío separado; nunca renueva la fecha del costo fuente al recalcular. Sólo `normalized-seeds.json` con evidencia estricta vigente puede alimentar referencias o ajustes de mercado. Los estados parciales de `market-references.json` y los snippets no habilitan esos ajustes. `market-progress.json` contiene exclusivamente agregados públicos e IDs con fuentes estrictas aceptadas; el exportador aplica una lista explícita de campos y descarta enlaces de acción, sesiones o credenciales.

Revisar los cambios y la lista exacta de archivos antes de hacer commit. Incluir únicamente el catálogo y resumen públicos de la tanda y cambios de código propios comprobados; nunca `.private/`, respaldos, reportes o cambios ajenos. Si hay un cambio público útil, hacer commit y push normal a `origin/main`, sin force, y verificar el despliegue de `https://scalaris.pages.dev/tienda/` y su `market-progress.json`. No crear commits vacíos. Si cambió el remoto, integrar sus cambios sin descartar trabajo local. Registrar el commit y la verificación en el checkpoint privado.

El heartbeat debe seguir su política de avisos existente: permanecer en silencio en avances rutinarios y avisar sólo ante finalización, hallazgo comercial importante o intervención necesaria. No declarar terminado el universo mientras queden búsquedas sin resolver o fichas pendientes. Ver [MERCADO.md](MERCADO.md) para el contrato de validación de referencias.
