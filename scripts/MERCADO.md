# Referencias públicas de mercado

El pipeline mantiene un estado para cada ID del catálogo, sin publicar precios ni costos. Una búsqueda indexada, una ficha descargada, una coincidencia técnica y un precio verificado son evidencias distintas.

Entradas privadas:

- `.private/market-research/product-identities.json`: identidades y atributos críticos, sin fusionar productos por GTIN o nombre.
- `search-batches/*.json`: búsquedas con `records[{id,results,storeResults,mlResults,status,researchedAt}]`. Los precios de sus snippets nunca son precios verificados.
- `fetch-batches/*.json`: checkpoints `{version,batchId,observedAt,urls,attempts,response}`, donde `response` es la respuesta completa del tool `tinyfish_fetch_content`, incluso cuando devuelve errores.

```powershell
node scripts/market-references.mjs plan --limit 40
node scripts/market-references.mjs report
node scripts/market-references.mjs dashboard
node --test scripts/market-references.test.mjs
```

`plan` devuelve trabajos listos para el conector gratuito. No hace llamadas de red por su cuenta. El host ejecuta únicamente `tinyfish_fetch_content` con los `fetchArgs` emitidos, hasta cuatro lotes a la vez, y guarda cada respuesta en `fetch-batches/<batchId>.json`. Cada lote contiene como máximo diez URLs, `format: json`, `ttl: 0` y metadatos de página. No se usa `run_web_automation`, agentes de navegador, credenciales externas ni una API LLM de pago. El precio del conector debe comprobarse antes de iniciar o reanudar una sesión; estos comandos no autorizan un servicio de pago.

La función exportada `executeFetchPlan` permite a un host inyectar el tool conectado y un escritor privado de checkpoints. Limita la concurrencia a cuatro, guarda los intentos, respeta el backoff de 429 y reintenta como máximo dos veces las URLs afectadas. No reintenta 401, 403 ni captchas. El ejecutor no elude bloqueos.

Después de cada ronda se ejecuta `report`. El próximo `plan` lee todos los lotes de búsqueda disponibles, incluidos los nuevos, y omite las URLs ya resueltas. Las URLs compartidas se descargan una vez, pero se comparan por separado con cada ID; no se fusionan productos. Una página bloqueada o un error definitivo queda registrado, sin reintentos ilimitados. Los 429 pueden retomarse cuando vence su backoff, hasta el máximo previsto.

Salidas privadas: `market-references.json` contiene todos los IDs y la evidencia normalizada; `fetch-checkpoint.json` conserva el resumen y las URLs pendientes. El resumen separa cobertura de búsqueda, errores, URLs solicitadas, productos con lectura, coincidencias y precios verificados. La cobertura es parcial mientras existan IDs sin búsqueda o con lecturas pendientes; que exista una fila no significa que haya sido investigada.

`dashboard` regenera esos archivos y crea `market-evidence-dashboard.html`, un tablero privado de evidencia externa que se abre directamente como archivo. Permite buscar por nombre/ID y filtrar estados. No llama servicios externos ni expone costos mayoristas; los enlaces a fichas se abren sólo cuando el usuario los elige. El tablero general con costos y precios propios se genera por separado con `node scripts/build-market-dashboard.mjs` y conserva el nombre `research-dashboard.html`.

La validación exige un nodo de producto, identificadores y atributos críticos visibles: calidad, marco, red 4G/5G, color, formato de pila y capacidades según la identidad local. Un GTIN aislado no anula una diferencia de variante. Las afirmaciones “Original” no autentican procedencia. Se excluyen relacionados, cuotas, precios sin impuestos, ahorros y cargos de envío del precio base. Una discrepancia entre metadatos y precio visible queda como conflicto, sin elegir el menor.

`verifiedProductPrice` sólo acredita la coincidencia y el importe ARS del producto con disponibilidad observada. No confirma las condiciones de todos los medios de pago ni el costo de entregarlo al domicilio del cliente: `verifiedDeliveredPrice` permanece falso sin esa evidencia. Cuando la extracción omite precio, moneda, stock o atributos, se registra lo que falta; no se reconstruye con snippets ni suposiciones.
