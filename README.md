# Scalaris

Web estática de Scalaris: productos de software, desarrollo a medida, automatizaciones, integraciones y galería de proyectos.

Sitio público: https://scalaris.com.ar

Dirección anterior, con redirección permanente: https://scalaris.pages.dev

## Presentación mensual y flyers vigentes — 28/10/2026

La comunicación vigente destaca el abono mensual equivalente con pago anual anticipado de doce meses: Origen/Vidriera $13.500, Flujo/Web de cinco páginas $22.500 y Pulso $31.500. Menú desde $18.000, Mesa desde $22.500 y Gestudio desde $27.000, con implementación a cotizar. El selector abre en anual; la opción mes a mes mantiene sus tarifas base y el alta en tres cuotas durante el lanzamiento. La condición anual queda junto al precio.

Los importes completos se muestran en el segundo paso de Consulta, antes de compartir o pagar. Una bonificación adicional redondea hacia abajo el total de los cinco planes fijos a múltiplos de $5.000: $160.000/$160.000/$305.000/$425.000/$370.000 (Origen/Vidriera/Flujo/Pulso/Web cinco páginas). No cambia el abono base, el descuento anual del 10% ni los porcentajes de alta. Esa línea se detalla en la revisión y no se aplica a mensual, promociones vencidas o presupuestos de otros sistemas.

Galería pública: https://scalaris.com.ar/flyers/ con 46 piezas y 92 PNG. Fuentes, 92 SVG, textos y ZIPs en `../contenido-redes/flyers-mensuales-2026-10-28/`. `npm run flyers:sync` publica los PNG y los dos ZIP de redes, con versión de caché nueva. El ZIP de editables permanece local por su tamaño. Las colecciones anteriores conservan valor histórico. Investigación, decisiones y verificación en [presentación mensual](docs/monthly-pricing-presentation-2026-10-28.md).

## Antecedente: lanzamiento y flyers — 28/10/2026

La web aplica la oferta confirmada de lanzamiento a los primeros cinco clientes nuevos o hasta el 30/11/2026, sujeta a confirmación de cupo. Anual: 10% sobre el abono, alta 100% bonificada en Origen/Vidriera y 50% en Flujo/Pulso/Web de cinco páginas, más primer año de dominio disponible a nombre del cliente. Totales anuales: $162.000/$162.000/$307.500/$428.000/$370.000. Mensual: alta completa en tres cuotas sin recargo más abono. Incluye ayuda inicial de contenido hasta 60 minutos y carga de 30/60/100 productos en Catálogo.

La política única está en `commercial/launch-promotion.json`; `public/offer-policy.js` comparte el cálculo entre selectores y consulta. Otros prearmados: 50% de implementación estándar hasta $50.000, con anual y presupuesto individual; no aplica ese tope a los cinco planes fijos. Condiciones en /promociones/. No se publica contador ficticio; al completar las cinco altas se cierra la política, se regenera y se actualizan las piezas. Dominio/vinculación y elegibilidad se confirman antes de contratar.

La galería /flyers/ aloja 46 piezas en dos formatos, con búsqueda y descarga de 92 PNG. Editables y ZIP completos: `../contenido-redes/flyers-lanzamiento-2026-10-28/`. Las colecciones anteriores son históricas. Alcance, evaluación del estándar y pruebas en [nota de lanzamiento](docs/launch-redesign-2026-10-28.md).

## Antecedente: refactor y tarifas base — 28/10/2026

La web comercial comparte identidad, navegación y componentes entre Inicio, Productos, Web, Catálogo, sus demos/propuesta, Proyectos y Consulta. Presenta seis familias por necesidad, capturas reales, diferencias de alcance, puesta en marcha y condiciones. La galería conserva 19 proyectos y distingue demos, publicaciones y propuestas en preparación.

Precios finales en ARS aprobados por el usuario:

| Plan | Abono mensual | Puesta en marcha única |
| --- | ---: | ---: |
| Origen | $15.000 | $100.000 |
| Web de hasta 5 páginas | $25.000 | $200.000 |
| Vidriera | $15.000 | $50.000 |
| Flujo | $25.000 | $75.000 |
| Pulso | $35.000 | $100.000 |

Mensual por defecto. Anual opcional: 12 meses por adelantado, con 10% de descuento sólo sobre el abono. La puesta en marcha se cobra en ambas modalidades. Dominio propio, registro y renovación a nombre y cargo del cliente; alojamiento y HTTPS incluidos. Menú desde $20.000/mes, Mesa desde $25.000/mes y Gestudio desde $30.000/mes, con implementación a cotizar; CRM según relevamiento. Las referencias no reemplazan el presupuesto y la aceptación de cada implementación.

Fuentes editables: `commercial/portfolio-offer.json` y `../scalaris-comercio/commercial/offer.json`. `npm run offers:build` regenera Catálogo, Productos, Web e Inicio en ese orden, mediante `scripts/site-shell.mjs` y los generadores de cada página. Las proyecciones públicas se versionan para que Cloudflare no dependa del repositorio hermano. Después ejecutar `npm run check`.

La [nota de aceptación y arquitectura](docs/website-refactor-2026-10-28.md) y las [referencias de diseño](docs/redesign-references-2026-10-28.md) registran criterio, fuentes y comprobaciones. Los flyers locales anteriores conservan sus precios históricos y requieren actualización antes de volver a distribuirlos. Las secciones siguientes conservan antecedentes fechados; cualquier precio anterior queda reemplazado por esta oferta.

## Oferta pública de software — 28/10/2026

Por solicitud del usuario, la web ofrece únicamente productos y desarrollo de software. Se retiraron la oferta de armado, reparación, mantenimiento y venta de equipos, su navegación y las ramas de hardware de la consulta. Se conservan Web, Catálogo, Menú, Mesa, Gestudio, CRM, las demos y el desarrollo a medida, las automatizaciones e integraciones. La consulta entra directamente a software en dos pasos y conserva el contexto del producto, plan y modalidad.

La tienda y sus recursos históricos se archivaron en `legacy/hardware-store/`, fuera de `public/`. Los enlaces `/tienda` y `/tienda/*` redirigen a `/productos/`; la tienda ya no aparece en el sitemap. Los importadores y generadores históricos no deben escribir en `public/`. `npm run check` rechaza su reintroducción. La [nota del cambio](docs/software-only-2026-10-28.md) registra alcance, evaluación del estándar y verificaciones. Las menciones de la tienda en las secciones históricas siguientes describen publicaciones anteriores al retiro.

## Antecedente: nombres de planes y precio de Gestudio — 28/10/2026

La web adopta los nombres del flyer aportado por el usuario: **Origen** para Web de una página; **Vidriera** para Catálogo para WhatsApp; **Flujo** para Catálogo con seguimiento de pedidos; **Pulso** para Catálogo con pedidos y caja manual. Se conservan los IDs `presencia`, `catalogo`, `pedidos` y `gestion`, los precios, la instalación y las modalidades. El segundo plan Web conserva su nombre. La descripción de alcance acompaña cada nombre en la comparación y en su página de planes.

El usuario confirmó publicar **Gestudio desde $30.000 ARS por mes para una institución**, con **implementación y migración a cotizar**. El importe aparece en Productos y como referencia informativa en la consulta y su ficha editable. Se genera desde `commercial/portfolio-offer.json`, sin instalación numérica, total inicial ni modalidad anual para Gestudio. Los parámetros de URL no modifican importes. El relevamiento y el piloto de aceptación siguen siendo necesarios antes del uso operativo; la demo de lectura no equivale a una implementación productiva ni a una app Android publicada.

Referencias oficiales consultadas el 28/10/2026: [Relevé](https://releve.com.ar/) publica $10.000/$20.000/$40.000 ARS mensuales; [CompuCampus](https://www.compucampus.net/public/home), $15.000/$30.000/$60.000 ARS mensuales; [EDUV.AR](https://eduv.ar/), $50.000 ARS mensuales para su plan básico. Son precios publicados con alcances diferentes, sin homogeneizar impuestos ni acreditar contratación o funcionamiento. Los $30.000 de Gestudio son una decisión comercial confirmada por el usuario; la comparación no acredita rentabilidad ni capacidad ilimitada.

Evaluación vigente del estándar: este cambio de nombres y presentación de precios mantiene HTML/CSS/JavaScript y Cloudflare Pages. Agregar React, backend o base de datos no aporta valor a este alcance; la modificación no cambia aplicaciones operativas, permisos ni datos. La fuente de Catálogo sigue en `../scalaris-comercio/commercial/offer.json`; sus proyecciones públicas se versionan en este repositorio para no depender del checkout hermano durante el build remoto.

Verificación local: `npm run offers:build` y `npm run check`, 165 pruebas aprobadas; 5 pruebas de la oferta comercial de Catálogo aprobadas. Navegador: nombres y selector mensual/anual en escritorio, planes de Catálogo y resumen de Gestudio en ancho móvil de 390 píxeles, sin desbordamiento horizontal en la consulta. La consulta de prueba no se envió. Evidencia visual local ignorada por Git: `artifacts/planes-2026-10-28/`. La publicación se comprueba contra el commit de Cloudflare Pages y el dominio público.

## Antecedente: portafolio y oferta comercial — 27/10/2026

Criterio editorial y visual confirmado: presentación sobria, mensaje claro y directo. Usar títulos funcionales, descripciones breves y botones con acciones concretas. Mostrar abono, modalidad e instalación sin repetir aclaraciones; agrupar las condiciones detalladas sin ocultar costos o restricciones relevantes. Mantener fondos claros, acento azul y pocas etiquetas.

`/productos/` organiza seis familias por necesidad: Web, Catálogo, Menú gastronómico, Mesa, Gestudio y CRM. La navegación común lleva a sus planes y demos; `/proyectos/` conserva la galería completa. `/web/` explica los dos paquetes institucionales. El selector anual/mensual conserva la modalidad al pasar al formulario. Los totales anuales se calculan al revisar la consulta, con instalación separada y sin cobro automático.

La fuente de Web, las referencias y los alcances es `commercial/portfolio-offer.json`. Catálogo conserva su fuente en `../scalaris-comercio/commercial/offer.json`; el sincronizador aplica su proyección pública y no copia campos internos. Ejecutar `npm run offers:build` tras cambiar la oferta y luego `npm run check`. Los generadores se conservan en `scripts/build-portfolio-offer.mjs`, `scripts/build-web-offer.mjs` y `scripts/sync-catalog-product.mjs`. Cloudflare publica los archivos generados y versionados de `public/` sin depender de repositorios hermanos durante el build remoto.

Los nombres comerciales conservan sus IDs: `presencia` = Origen; `negocio` = Web de hasta 5 páginas; `catalogo` = Vidriera; `pedidos` = Flujo; `gestion` = Pulso. Las descripciones explican la progresión: preparar el mensaje en WhatsApp, guardar y seguir solicitudes, y registrar movimientos y cierres de caja. Los nombres operativos internos no cambian códigos, datos ni permisos.

Web de una página: $8.000 por mes con anual / $12.000 mes a mes, instalación $45.000. Web de hasta 5 páginas: $15.000 / $20.000, instalación $90.000. La instalación Web se cobra en ambas modalidades. Incluyen un dominio .com.ar a nombre del negocio con registro/renovación mientras esté activo y configuración de hasta cinco casillas Zoho Free si está disponible para la organización; migraciones, IMAP/POP y licencias pagas se cotizan. La opción de hasta cinco páginas incluye un lote mensual de cambios simples de hasta veinte minutos, no acumulable; la de una página incluye mantenimiento técnico, sin cambios de contenido posteriores al alta.

Catálogo mantiene $10.000/$20.000/$30.000 por mes con anual y $15.000/$30.000/$45.000 mes a mes; instalaciones $30.000/$50.000/$80.000 bonificadas con anual durante la promoción hasta el 30/11/2026. Su dirección pertenece a Scalaris; dominio propio y correo son adicionales. Menú ($25.000/mes e instalación $90.000, desde) y Mesa ($29.000/mes e instalación $120.000, desde) requieren revisión y presupuesto. Gestudio publica desde $30.000/mes, con implementación y migración a cotizar tras relevamiento; CRM se cotiza según alcance. El formulario no inventa importes cerrados para estas cuatro implementaciones.

La [auditoría de capacidades](docs/portfolio-capabilities-2026-10-27.md) registra fuentes, límites y pendientes. Menú y Mesa se implementan por separado: no se promete sincronización de productos, pedidos, stock o caja. Mesa requiere aceptación del piloto; Gestudio conserva su demo de consulta y aceptación productiva pendiente; CRM necesita adaptación y no se ofrece con envíos automáticos habilitados. El estudio de proveedores y los escenarios de costos se guardan en `.private/research/portfolio-2026-10-27/`, fuera de Git y del sitio. Las capturas publicitarias aportadas son referencias sin contratación ni validación del proveedor.

Evaluación vigente del estándar: se mantiene HTML/CSS/JavaScript estático con Cloudflare Pages, apropiado para presentación, precios y consultas sin persistencia propia. La ampliación no necesita React, backend ni base de datos adicionales; introducirlos ahora aumentaría el mantenimiento sin resolver un flujo requerido. Las aplicaciones operativas mantienen su arquitectura, permisos y despliegue. La aceptación de esta ampliación comprende seis familias, ambos modos de precio, instalación correcta por producto, continuidad de la consulta, vistas de escritorio/móvil y ausencia de datos privados en las proyecciones públicas.

## Integración de Scalaris Catálogo — 27/10/2026

La navegación orientada a productos, la oferta, los planes y las demos están publicados en este dominio. La [nota de integración y publicación](docs/publicacion-catalogo-2026-10-27.md) registra el alcance, la evaluación vigente del estándar, las 143 pruebas aprobadas y la comprobación pública en escritorio y ancho móvil de 390 píxeles. El producto está en `/catalogo/` y las demos en `/catalogo/demos/`. Las evaluaciones anteriores se conservan como evidencia histórica de sus respectivos alcances.

## Archivos

`public/` contiene la web portable de HTML, CSS, JavaScript, catálogo público, imágenes, logos y fuentes Inter con su licencia. No necesita dependencias ni compilación. Los costos mayoristas y el cotizador personal quedan en `.private/`, fuera de la publicación y excluidos de Git.

Fuente visual original: `Scalaris_01_Identidad_Complementos_Web_2026-09-30.zip`, carpeta `05_Web_Estatica`. La importación inicial de los 12 archivos se verificó byte por byte contra el ZIP; la portada y el formulario se mantienen ahora en este repositorio. El Site original de ChatGPT permanece independiente y sin modificaciones.

La portada prioriza la consulta guiada en la navegación, el inicio, los servicios y el contacto. En móvil, la tarjeta guiada aparece antes del WhatsApp directo. El símbolo de WhatsApp junto al número proviene de [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/whatsapp.svg).

## Verificación y vista local

```powershell
node scripts/check.mjs
node scripts/serve.mjs
```

Abrir http://127.0.0.1:8080. Para abrirlo con doble clic, usar `VerSitio.cmd` y mantener su ventana abierta. La portada y la galería también pueden abrirse directamente; la consulta con importes vigentes requiere HTTP para cargar la oferta.

## Galería y antecedentes de la tienda retirada

- `public/proyectos/` reúne 19 fichas. Las tres primeras muestran las demos de Scalaris Comercio: Corralón Punto Obra, Ronda Mayorista y Almacén La Esquina, con acceso directo a `/comercio/t/corralon-demo`, `/comercio/t/mayorista-demo` y `/comercio/t/almacen-demo`. La cuarta presenta Scalaris Mesa en `/mesa/`, una demo de gestión para restaurantes y cafés con un entorno independiente y datos ficticios por visitante. Conserva Remodelaya, Shekinah, Tu Comida, E-MEDICAPP, Burger House, Gestudio, FourBubbles, Scalaris CRM, PharmaHome, Calendario de servicios, Inventarios Mueblería, Gym & Academy Manager, Presupuestador Flete, HogarIA y CJ Préstamos. Distingue los proyectos desplegados, las demos interactivas y los proyectos en preparación. Burger House es un proyecto desplegado y Tu Comida es una demo interactiva. Las fichas pendientes ofrecen una consulta, sin publicar una dirección de demo todavía inexistente. Tu Comida, E-MEDICAPP y Burger House se abren en `/tu-comida/`, `/e-medicapp/` y `/burger-house-3/`. Las 19 fichas tienen miniatura: trece capturas reales (nueve WebP, tres JPEG y un PNG) y seis portadas SVG originales identificadas como vistas ilustrativas. Gestudio, FourBubbles y Mesa muestran datos ficticios; PharmaHome muestra un formulario vacío. Shekinah conserva su captura local identificada porque el acceso público fue bloqueado por FortiGuard en este entorno.
- Cada ficha declara `data-project` y `data-state` (`live`, `demo` o `preparation`). Al verificar una nueva publicación, actualizar juntos estado, etiqueta, nota y enlace de la ficha correspondiente. La verificación de publicación exige las 19 fichas, identificadores únicos, estados válidos y los enlaces de las demos de Comercio y Mesa. También comprueba que Mesa se presente como demo, use su captura y explique los datos ficticios y el entorno por visitante.
- Evaluación del estándar (24/10/2026, fuentes: `package.json`, `wrangler.jsonc`, `.github/workflows/check.yml`, las páginas de `public/` y `functions/mesa/[[path]].js`): la galería usa HTML/CSS estáticos y Cloudflare Pages con CI; no necesita un backend ni base de datos propios. Conservar esa arquitectura permite agregar Mesa mediante una ficha, una captura y el control existente, con bajo esfuerzo y sin introducir otra compilación o despliegue para la galería. La aplicación Mesa mantiene su frontend React, backend Spring y PostgreSQL en el VPS, bajo el prefijo público `/mesa/`. La aceptación de esta ampliación es encontrar la ficha, identificarla como demo con datos ficticios por visitante y abrir `/mesa/` tanto desde la miniatura como desde el enlace. Las capturas de Comercio, Mesa y E-MEDICAPP se renovaron desde sus páginas públicas el 27/10/2026 con la paleta azul. Mesa conserva la vista del salón y una cuenta ficticia a 1440 × 900; E-MEDICAPP muestra su acceso y perfiles de demostración.
- La antigua `public/tienda/`, archivada desde el 28/10/2026 en `legacy/hardware-store/`, permitía buscar, filtrar y preparar pedidos de hardware. Su catálogo, imágenes y flujo de consulta ya no se publican. Los datos de importación y precios siguientes se conservan como antecedentes, sin vigencia comercial actual.
- Importación del 20/10/2026: 7.305 productos (NB 1.409, DistriLand 2.796 y TecnoPrices 3.100). Las fotos de NB usan sus URL originales; las de TecnoPrices se extrajeron del PDF y se alojan localmente (2.730 archivos únicos, 12,3 MB). DistriLand queda con un marcador explícito de imagen pendiente. Las descripciones son las referencias disponibles en las fuentes; no se inventan especificaciones.
- El catálogo público contiene nombres, categorías, fotos y referencias; no expone costo, escalas mayoristas, stock histórico ni información interna. El importador y los controles usan una lista explícita de campos públicos. Los nombres iguales entre proveedores conservan sus referencias: no se asume que variantes diferentes sean el mismo producto.
- Hay 7.292 productos habilitados con precio de venta ARS por transferencia. Otros 13 quedan fuera de venta: 12 titulados “VENCIDO” y una referencia NB sin costo actual. Un precio público sólo se muestra si es positivo y tiene `priceValidUntil` vigente; al vencer aparece “No disponible” y se impide agregarlo al pedido. La vigencia queda limitada a siete días desde el costo de origen, sin renovarse por regenerar archivos. Confirmar disponibilidad, envío y plazo antes de cobrar sigue siendo parte de la operación contra pedido.
- Los precios se calculan desde los costos finales y el patrón comercial guardado exclusivamente en `.private/market-research/pricing-settings.json`. El usuario cerró las búsquedas el 21/10/2026 y se eliminó el seguimiento automático. La evidencia anterior conserva sus fechas y sólo se muestra mientras siga vigente. Ver [estrategia de venta](scripts/ESTRATEGIA-PRECIOS.md) y [validación de referencias](scripts/MERCADO.md).

Para actualizar listas, fotos o costos NB en pesos, seguir [Importar catálogos](scripts/IMPORTAR-CATALOGOS.md). La actualización NB del 20/10/2026 (`NB-Lista-Precios-20_10_2026_01_55-84844.xls`) aporta **1.408 costos finales en ARS**, unidos por identificador de URL al código NB original. Se usa la columna `Costo`; las fotos y referencias provienen del catálogo anterior. El producto `nb-124029` (Kit Gigabyte promoción) no figura en esta lista: conserva su costo histórico USD y requiere confirmación antes de cotizar. El XLSX anterior se conserva como procedencia histórica, sin convertir sus importes automáticamente. El CSV opcional `id,costARS` sigue disponible para actualizaciones manuales.

## Identidad de las demos — 27/10/2026

Las demos que utilizaban verde como marca recuperan la paleta original de `public/styles.css`: azul `#145cdb`, marino `#0b1f33`, celeste `#53c9f4`, fondo `#eef5fa`, texto secundario `#496479`, bordes `#d7e3ed` y hover `#104bb5`. La aplicación abarca Scalaris Comercio (Corralón Punto Obra, Ronda Mayorista y Almacén La Esquina), Scalaris Mesa y E-MEDICAPP. Los estados de éxito, disponibilidad, conexión o mesas listas conservan sus colores funcionales. Las marcas de clientes y las demos con otra identidad quedan fuera de este cambio de verde a azul.

Evaluación acotada del proyecto existente: la galería HTML/CSS y su publicación en Cloudflare Pages permiten reflejar la nueva marca actualizando las cinco capturas y el texto alternativo del acceso de E-MEDICAPP. No se necesita migración de stack; beneficio de consistencia visual, esfuerzo bajo y riesgo de miniaturas desactualizadas, cubierto con capturas de las páginas públicas y el control existente de recursos y enlaces.

El 27/10/2026 se comprobaron las tres muestras de Comercio en navegador público a 1265 × 712, sin desbordamiento horizontal, con acento `#145cdb`, botones azules y texto blanco. La publicación usa exclusivamente el frontend anterior más el parche de paleta; no incorpora la ampliación de producto que sigue pendiente localmente. El VPS conserva los archivos de backend y datos de referencia y el mismo contenedor/volumen PostgreSQL, comprobados antes y después. Imagen: `scalaris-comercio:blue-20261027-ab27a7b0`; respaldo visual/configuración previo: `/var/backups/scalaris/comercio-palette/20261027T181941Z-ab27a7b0`.

Mesa se publicó mediante su procedimiento existente en el commit `3ccb2619e16879c48392261d2b9ea7f499721920`; backend, web y base terminaron saludables. Se abrió una demo ficticia independiente desde la URL pública y se capturó el salón y el detalle de una cuenta a 1440 × 900. E-MEDICAPP se publicó en GitHub Pages desde `b397093d02465fb3c47852228a04d8bcde4c03ca` ([ejecución aprobada](https://github.com/JerePrograma/E-MEDICAPP/actions/runs/40558148909)); el `deployment.json` público coincide con ese commit y conserva el backend. El botón y el título públicos usan azul y marino; su captura del acceso mide 1910 × 889. Las cinco miniaturas actualizadas provienen de esas páginas públicas, sin alterar su contenido.

Verificación de las aplicaciones: Comercio aprobó TypeScript y compilación aislada; Mesa aprobó compilación y 14 pruebas frontend; E-MEDICAPP aprobó compilación y 47 pruebas. Los pares azul/blanco y azul/fondo claro superan 4,5:1; no constituyen una auditoría completa de accesibilidad ni nuevas pruebas integrales de negocio.

## Cotizador personal

Abrir `.private/cotizador.html` con doble clic. Es una herramienta local autónoma, con búsqueda por producto y cálculo de precio, envío absorbido, comisión de cobro, reserva, margen, ganancia mínima y comparación de mercado. Los 1.408 costos NB en pesos se precargan al elegir el producto, con IVA ya incluido. DistriLand usa los importes finales confirmados por el propietario. Para una referencia ausente en la última lista o todavía en USD, se requiere confirmar el costo final. El envío proveedor → Scalaris se carga en $0 según el acuerdo confirmado; el envío al cliente se cobra por separado en la tienda.

Para regenerarlo después de importar listas: `node scripts/build-price-calculator.mjs`. Ver [Criterio de precios y uso](scripts/PRECIOS.md). El cotizador permite simular condiciones distintas; no publica datos en la tienda. `build-store-prices.mjs` genera la propuesta y requiere `--apply-public` para actualizar el catálogo público. `.private/` necesita respaldo local independiente si se quiere conservar.

El control de publicación verifica recursos de todas las páginas, sintaxis, ofertas de software, ausencia de hardware público y las pruebas de consultas y herramientas históricas: `node scripts/check.mjs`. Las pruebas del importador se ejecutan con Python según su documentación.

## Cloudflare Pages

- Repositorio: `JerePrograma/scalaris`.
- Rama de producción: `main`.
- Framework: None.
- Comando de build: `node scripts/check.mjs`.
- Directorio de salida: `public`.
- Directorio raíz: raíz del repositorio.
- Despliegues automáticos de producción habilitados.
- No requiere secretos ni variables de entorno.
- Dominio principal: `scalaris.com.ar`; `www.scalaris.com.ar` redirige a la misma ruta del dominio principal, conservando los parámetros.

La integración Git de Pages está configurada desde la cuenta Cloudflare. Cada push a `main` publica los archivos de `public/` después de la verificación.

### Dominio propio

El dominio se activó el 21/10/2026. La zona `scalaris.com.ar` está activa en el plan Free, en la misma cuenta Cloudflare que el proyecto Pages `scalaris`. La delegación de NIC Argentina y las consultas DNS públicas confirman los servidores `adam.ns.cloudflare.com` y `tia.ns.cloudflare.com`.

Registros guardados en Cloudflare, ambos proxied con TTL Auto:

| Tipo | Nombre | Destino |
|---|---|---|
| CNAME | `scalaris.com.ar` | `scalaris.pages.dev` |
| CNAME | `www.scalaris.com.ar` | `scalaris.com.ar` |

La regla habilitada **Scalaris: www al dominio principal** redirige `http*://www.scalaris.com.ar/*` a `https://scalaris.com.ar/${2}` con estado 301 y **Preserve query string** activado. Se verificó desde HTTP y HTTPS con `/consulta/?service=SOFTWARE`: conserva la ruta y los parámetros.

El dominio está asociado en **Pages → scalaris → Custom domains**. Esa asociación y la delegación DNS son necesarias para servir el sitio; crear sólo un CNAME no completa la configuración. Las redirecciones por dominio se configuran en Cloudflare.

La lista Bulk Redirects `scalaris_pages_to_domain` y su regla habilitada **Scalaris: Pages al dominio principal** redirigen `scalaris.pages.dev/` a `https://scalaris.com.ar/` con estado 301. Están activados **Preserve query string**, **Subpath matching** y **Preserve path suffix**. Se verificaron portada, `/consulta/?service=SOFTWARE` y `/tienda/?q=ssd`: cada enlace llega al dominio principal en un salto, conserva ruta y parámetros y termina en 200, sin bucles. La coincidencia se limita al host de producción `scalaris.pages.dev`.

La verificación pública del 21/10/2026 confirmó HTTPS válido y respuestas 200 en portada, consulta, proyectos, tienda, `robots.txt`, `sitemap.xml`, catálogo con 7.305 productos y 12 recursos CSS, JavaScript y SVG. Las cuatro páginas, el catálogo, robots y sitemap coinciden con los archivos publicados del repositorio.

Las cuatro páginas publican canonical y OpenGraph con el dominio principal. `public/robots.txt` referencia `https://scalaris.com.ar/sitemap.xml`, que enumera las cuatro rutas públicas. Los enlaces internos y recursos siguen siendo relativos para conservar la vista local.

Referencias: [dominios de Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/), [redirecciones de Pages](https://developers.cloudflare.com/pages/configuration/redirects/) y [delegación en NIC Argentina](https://www.punto.gov.ar/ayuda/instructivos/delegacion-de-dominios).

Contacto: [WhatsApp](https://wa.me/5491172789289), 1172789289.

## Demos en el VPS

Publicaciones verificadas el 22/10/2026:

- https://scalaris.com.ar/gestudio/: dos organizaciones sintéticas, 28 alumnos y cuenta `DEMO_COMERCIAL` de consulta. El botón **Entrar a la demo** usa exclusivamente esa cuenta; los accesos de administración y MFA permanecen privados. La semilla oficial registra 48 recibos históricos sin generar PDF: la interfaz pública explica ese alcance y deshabilita su descarga.
- https://scalaris.com.ar/fourbubbles/: cuenta pública exclusiva `REPORT_VIEWER`, tres clientes ficticios, tres pedidos y dos ciclos simulados. El acceso de demo abre Pedidos; no permite modificar la operación.
- https://scalaris.com.ar/pharmahome/: aplicación estática con datos guardados en el navegador. Su service worker y cachés quedan limitados a su prefijo.
- https://scalaris.com.ar/calendario-servicios/: calendario y PDF locales al navegador, sin anuncios ni analítica.

Las funciones de `lib/vps-demo-proxy.js` usan un origen fijo del VPS. Los API públicos rechazan escrituras de negocio y orígenes ajenos; permiten sólo los POST de sesión declarados. Cada aplicación Java tiene su cookie propia, con `Secure`, `HttpOnly`, ruta restringida y respuestas sin caché. Caddy conserva los prefijos y dirige cada demo a su contenedor. Bases y Java carecen de puertos públicos; el correo y los procesos programados de Gestudio están desactivados.

El KVM 2 tiene 2 CPU y 8 GB de RAM. Las nuevas demos limitan Gestudio a 1.3125 GiB, FourBubbles a 1.1875 GiB y cada estático a 64 MiB. Estos topes no son una prueba de capacidad o concurrencia. Se compiló secuencialmente con un constructor limitado a 1 CPU y 2 GiB.

`scripts/vps/backup-demos.sh` respalda datos, configuración privada, Caddy y los paquetes de código de Gestudio. Su timer diario de las 03:55 de Buenos Aires admite hasta diez minutos de demora y conserva snapshots generados durante aproximadamente 14 días. La primera ejecución del servicio terminó con éxito. Se restauraron ambos PostgreSQL en contenedores temporales sin red ni puertos, preservando propietarios y permisos; Gestudio también pasó el aislamiento Alpha/Beta y el rechazo sin contexto de organización. La excepción de los recibos sintéticos queda registrada de forma explícita. Las copias permanecen en el mismo VPS: falta una copia externa. Ver [procedimientos de respaldo](scripts/vps/BACKUPS.md).

CRM, Inventarios Mueblería, Gym & Academy Manager, Presupuestador Flete, HogarIA y CJ Préstamos siguen en preparación. Las fichas muestran su propuesta sin exponer bases operativas ni publicar una demo no verificada.

## Scalaris Mesa

La demo pública está en https://scalaris.com.ar/mesa/ y la aplicación se ejecuta en el VPS. `functions/mesa/[[path]].js` conecta exclusivamente ese prefijo con el origen fijo del servidor; conserva la ruta y limita la cookie de sesión a `mesa_session`. `public/_routes.json` incluye `/mesa` y sus subrutas. La galería permanece estática y usa la captura real `public/assets/proyectos/scalaris-mesa.png`.

Cada visitante inicia un negocio demo independiente, con dos sucursales y datos ficticios, que vence a las ocho horas. Permite probar el plano de mesas, los pedidos, las comandas de cocina y barra, la división de cuentas y el registro manual de pagos, propinas y vuelto. Los cobros son de prueba y los tickets son internos; la demo no procesa pagos ni emite facturas fiscales. La interfaz adapta la operación a celulares, tablets y computadora.

La verificación pública del 24/10/2026 aprobó los 18 controles de API de Mesa: aislamiento entre negocios demo, sesión y permisos, origen y CSRF, importes, pagos parciales, idempotencia y devoluciones. Esa comprobación usa negocios ficticios nuevos y no requiere credenciales operativas.

## Demo E-MEDICAPP

La demo se comparte en https://scalaris.com.ar/e-medicapp/. La función
`functions/e-medicapp/[[path]].js` sirve la compilación estática de
`https://jereprograma.github.io/E-MEDICAPP/`; sus recursos relativos permiten usar
ambas rutas. `public/_routes.json` limita la función a `/e-medicapp` y sus subrutas.
El acceso sin barra final redirige conservando los parámetros. Sólo admite GET y
HEAD; no reenvía cookies ni credenciales del navegador al origen. La portada y
`deployment.json` se consultan sin caché para confirmar el commit y backend vigentes.

Cada publicación del repositorio `JerePrograma/E-MEDICAPP` actualiza la demo sin
copiar archivos ni volver a publicar Scalaris. El backend y los datos de la demo
se ejecutan en el VPS, administrados por los scripts de E-MEDICAPP. El backend admite
los orígenes `https://scalaris.com.ar` y `https://jereprograma.github.io`.
La compilación de Pages sigue usando `node scripts/check.mjs` y `public`; Cloudflare
también compila la carpeta `functions/`. No requiere secretos adicionales.

## Tu Comida

La ruta `https://scalaris.com.ar/tu-comida/` utiliza la misma integración de
Cloudflare Pages Functions que E-MEDICAPP, con publicaciones y datos independientes:

- `/tu-comida/` y `/tu-comida/editar/` sirven los archivos estáticos del Worker
  `tu-comida-web`, compilados con la base pública `/tu-comida/`.
- `/tu-comida/gestion/` sirve la aplicación de gestión de `tu-comida-management`.
- `/tu-comida/backend/` conecta con `tu-comida-api`, conservando sus rutas
  `/api/...` y `/admin/login`.
- `/tu-comida/editor-api/` conecta con el servicio `tu-comida-catalog-editor`.

`functions/tu-comida/[[path]].js` sólo utiliza esos cuatro orígenes fijos. Los
recursos y las redirecciones permanecen bajo la ruta pública. El proxy no envía
cookies de Scalaris; únicamente reenvía la sesión Bearer de la aplicación a sus
dos APIs. `public/_routes.json` conserva E-MEDICAPP y limita la nueva función a
`/tu-comida` y sus subrutas. El resto de las páginas continúa siendo estático.

`wrangler.jsonc` conserva el proyecto Pages `scalaris`, su salida `public` y
habilita `global_fetch_strictly_public`, necesario para consultar las publicaciones
Workers de la misma cuenta a través de sus direcciones públicas. La comprobación
previa al despliegue sigue siendo `node scripts/check.mjs`.

El catálogo y los servicios de Tu Comida se publican en Cloudflare; no requieren
que esta computadora permanezca encendida. La integración no modifica los datos
ni el funcionamiento de E-MEDICAPP, la tienda o el backoffice local de Scalaris.

## Backoffice local y formulario guiado

El backoffice Java/Spring Boot + React/TypeScript + PostgreSQL está separado en `backoffice/`. Ver [uso, configuración local/LAN, cálculos, archivos y respaldos](backoffice/README.md). No se publica en Cloudflare Pages, no tiene login y no se conecta al sitio público.

**Para abrirlo diariamente en Jeremias, hacer doble clic en Scalaris LAN del escritorio**, o ejecutar `AbrirScalaris.cmd -Mode Lan` desde `C:\laburo\Scalaris`. La [guía COMO-USAR](backoffice/COMO-USAR.md) reúne apertura, parada, actualización, pantallas reales, backups y reversión a Local. El modo LAN aprobado sirve React y API juntos en `http://192.168.1.9:8081/`; el propietario confirmó Tablero y Clientes desde su celular físico. El modo Local seguro y Vite quedan como alternativas.

La [verificación de acceso del 5/10/2026](backoffice/VERIFICATION-20261005-ACCESS.md) reúne la evidencia actual del 403, arranque cotidiano, recursos compilados, guardias de prueba y límites del acceso LAN.

La [rectificación de arquitectura y arranque del 4/10/2026](backoffice/VERIFICATION-20261004-REFACTOR.md) documenta la separación física por responsabilidades, configuración IntelliJ/scripts, diagnóstico de almacenamiento y resultados efectivos de pruebas. Los informes anteriores permanecen disponibles como evidencia histórica.

El [seguimiento de IntelliJ y Vite del 5/10/2026](backoffice/VERIFICATION-20261005-VITE.md) confirma el Run real aportado por el usuario y documenta la corrección del 403 en desarrollo, UTF-8 HTTP y la configuración Scalaris Vite.

La consulta guiada independiente está en `public/consulta/index.html`. Los enlaces de equipos y software preseleccionan el servicio. Prepara un resumen y una ficha JSON descargable; la acción principal copia el resumen y abre WhatsApp para revisarlo y pegarlo manualmente. El saludo del enlace no incluye el nombre ni el teléfono ingresados. La importación en backoffice también es manual. No persiste datos personales por defecto ni requiere servidor público.

Verificar además el formulario: `node --test scripts/public-form.test.mjs`. El comando y directorio de build de Pages permanecen iguales. Cloudflare publica únicamente `public/`; el backoffice sigue siendo una aplicación local.
