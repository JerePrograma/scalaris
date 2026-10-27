# Scalaris Catálogo: integración y publicación

Fecha: 27/10/2026, Argentina. **Estado: publicado y verificado en el dominio real.** Esta nota reúne cambios, evidencia local y comprobaciones de publicación. La aceptación de un primer negocio y los pendientes operativos se distinguen del lanzamiento público de las demos.

## Cambios preparados

La portada presenta Scalaris Catálogo y conduce a producto, planes, demos y consulta. La navegación compartida incorpora Productos, Planes, Demos, Soporte y servicios, Equipos y Consultar; el menú móvil usa `aria-expanded`, cierre con Escape y retorno del foco. El footer ofrece rutas de regreso coherentes.

`/productos/` agrupa soluciones por necesidad. `/catalogo/` presenta alcance y planes; `/catalogo/demos/` permite elegir la experiencia por plan; `/catalogo/propuesta.html` ofrece una versión imprimible. La galería conserva sus 19 fichas y la tienda mantiene sus 7.305 productos, precios con vigencia y campos públicos permitidos.

| Plan | Mes a mes | Equivalente mensual anual | Pago anual anticipado |
| --- | ---: | ---: | ---: |
| Base | $15.000 | $10.000 | $120.000 |
| Pedidos | $30.000 | $20.000 | $240.000 |
| Gestión | $45.000 | $30.000 | $360.000 |

Precios finales en ARS. Alta mensual: $30.000 / $50.000 / $80.000; bonificada pagando el año durante la promoción hasta el 30/11/2026. El importe anual destacado es un equivalente mensual, con los doce meses abonados al comienzo. La fuente editable permanece en el proyecto de producto y `scripts/sync-catalog-product.mjs` prepara su proyección pública, sin incorporar datos privados.

La consulta reconoce producto, plan y modalidad mediante una lista de valores admitidos. Prellena necesidad y alcance editables, conserva la ficha `scalaris.inquiry` versión 1 y no toma importes de la URL. Preparar o compartir la consulta no contrata ni activa un plan. WhatsApp conserva el envío manual por parte de la persona.

## Evaluación del estándar vigente

El sitio existente usa HTML/CSS/JavaScript estáticos, Cloudflare Pages y CI; las aplicaciones de demostración conservan sus servicios independientes. Fuentes locales: `package.json`, `wrangler.jsonc`, `public/`, `functions/` y `scripts/check.mjs`, revisadas el 27/10/2026.

Se mantiene esa arquitectura para esta integración de presentación. Difiere del frontend React/TypeScript predeterminado, pero migrar el sitio ahora agregaría esfuerzo y riesgo sin resolver una necesidad de backend o base propia. La reutilización del diseño y del proceso de publicación aporta navegación común y menor duplicación. El esfuerzo es moderado; los riesgos principales son enlaces rotos, desincronización de tarifas y exposición accidental de información interna, cubiertos por validaciones locales. El backend y el aislamiento multiempresa se evalúan en el proyecto de producto, sin atribuirlos a esta web estática.

## Evidencia local

- `node scripts/check.mjs`: **143 pruebas aprobadas, cero fallos y cero omitidas**. Incluye las pruebas existentes de tienda, referencias, consultas y proxies, más navegación y validación de referencias públicas.
- Referencias relativas y absolutas desde `/`, parámetros y anclas entre páginas comprobados sin consultas de red. Las rutas dinámicas requieren configuración de Pages y función existente; Burger House conserva una excepción explícita como ruta gestionada fuera de Pages.
- Canonical/OpenGraph de ocho páginas y sitemap con Productos, Catálogo y Demos comprobados. Oferta pública validada por lista de campos y precios coherentes entre datos, HTML y selector.
- Se conservan los controles de costos privados de hardware y se rechazan campos bancarios, fiscales o de credenciales dentro de JSON público. Los datos de cobranza, CUIT, titular y claves permanecen fuera de este directorio de publicación.
- `git diff --check`: aprobado. Esta evidencia no acredita por sí sola despliegue ni funcionamiento público.

## Publicación comprobada

El sitio se publicó por el flujo existente de GitHub y Cloudflare Pages: implementación `8893b23` y corrección de caché/canonical `e67288d`. Las ejecuciones CI [40567858143](https://github.com/JerePrograma/scalaris/actions/runs/40567858143) y [40568489875](https://github.com/JerePrograma/scalaris/actions/runs/40568489875) finalizaron aprobadas. El ajuste versiona los recursos y la dependencia `model.js`, de modo que el navegador que conservaba el formulario antiguo cargó el nuevo sin vaciar su caché.

Se verificaron HTTP 200 y contenido correcto de portada, Productos, Catálogo, Demos, propuesta, cartel, datos públicos y consulta. En navegador público, a 1440 × 1000 y 390 × 844, se comprobaron selector anual/mensual, consulta Gestión mes a mes con respuestas editables, menú móvil y Escape, acceso a pedidos y detalle de caja mediante roles de demostración de lectura. Base preparó un mensaje con producto y precio recalculado usando datos ficticios; no se abrió WhatsApp ni se envió el mensaje. El conteo agregado de pedidos permaneció en 22 tras esa prueba.

La aplicación de `/comercio/` sirve la release `1e2c27d4fc52fe6397f727fff95c98bcf23ee1d54bbfc6af0af4e7b1c1db5959`, con salud y versión públicas comprobadas. La actualización conservó las filas de los tres comercios anteriores, la imagen y los montajes de PostgreSQL. Se aprobaron tres restauraciones aisladas: antes del corte, con app detenida y después de publicar. Resultado: seis demos, 54 productos, 22 pedidos, una caja sintética cerrada y tres movimientos. Las nuevas demos tienen seis productos por negocio; las anteriores mantienen doce cada una.

El informe HTTP de producto está en `scalaris-comercio/docs/http-publication-audit-2026-10-27.json`. Comprueba rechazo anónimo de administración, privacidad de precios mayoristas y que las rutas privadas no entregan archivos de configuración ni JSON privado. Algunas rutas inexistentes devuelven la página HTML pública con HTTP 200; no se reportan como 404. Las capturas locales están en `scalaris/artifacts/catalogo-publication-2026-10-27/`, fuera de Git y del directorio público.

Pendientes independientes: copia externa automatizada y restauración desde ese destino, enlaces reales de Mercado Pago para el abono de Scalaris, revisión bancaria del titular y aceptación del primer negocio en un teléfono físico. El circuito inicial de contratación, conciliación y activación es asistido. Los datos fiscales y bancarios permanecen privados; la publicación no realiza cobros ni emite facturas.

## Corrección visual de Productos

El usuario detectó después del lanzamiento que las capturas de las tarjetas conservaban un alto HTML de 900 píxeles aunque el CSS reducía su ancho. `aspect-ratio` sin `height:auto` no corregía ese alto y `object-fit:contain` centraba una imagen pequeña en un bloque muy alto. La captura destacada conservaba igualmente un alto HTML de 712 píxeles. La revisión anterior no había detectado este defecto de la página Productos.

Se añadió `public/productos/productos.css?v=20261027-2`, limitado a esta página: alturas automáticas, proporciones estables, encuadre superior, separación uniforme y enlaces de acción alineados. El recurso nuevo evita que el navegador conserve la presentación anterior por caché. No cambia precios, consultas ni servicios. Se mantiene la arquitectura estática evaluada arriba; el cambio no requiere migración de stack ni base de datos.

La revisión visual local cubrió 1440 × 1000, 768 × 1024 y 390 × 844, incluyendo las capturas y los cuerpos de las tarjetas. `node scripts/check.mjs` aprobó las 143 pruebas existentes. La comprobación pública y las capturas finales se realizan sobre la misma versión publicada.

## Presentación de precios revisada

Por indicación del usuario, la presentación comercial destaca $10.000 / $20.000 / $30.000 por mes con plan anual, con selector visible a $15.000 / $30.000 / $45.000 mes a mes. Una nota breve indica pago anual anticipado. La instalación figura junto a cada plan: $30.000 / $50.000 / $80.000 por única vez en modalidad mensual y bonificada en anual. Se retiraron los totales anuales y los importes del primer pago de portada, Productos, planes, propuesta genérica y cartel; se mantienen los importes reales y las reglas de cobro.

La inspiración de jerarquía comercial se contrastó el 27/10/2026 con las páginas oficiales de [Pency](https://web.pency.app/) —precio por mes con nota de anualidad— y [Tiendanube](https://www.tiendanube.com/planes-y-precios) —selector mensual/anual y descuento visible—. Son referencias de presentación; no se copiaron sus precios ni se atribuyen sus funcionalidades al producto.

El paso de revisión de la consulta muestra el desglose del plan elegido antes de compartirlo: modalidad, abono, instalación y total inicial. Obtiene únicamente la oferta pública vigente; los parámetros de URL no suministran importes. La descarga JSON mantiene el contrato `scalaris.inquiry` v1. No se añadieron contratación ni pagos automáticos. Los accesos comerciales históricos de `/comercio/planes/` redirigen mediante una lista explícita a las páginas actuales de `/catalogo/`, conservando la operación del backend sin desplegarlo de nuevo por un cambio de presentación.

Validación local de esta revisión: 152 pruebas del sitio aprobadas y 13 pruebas de oferta/cobranza aprobadas en el proyecto del producto; selector y resumen mensual comprobados en navegador. Los controles incluyen cálculo anual y mensual, rechazo de ofertas inválidas y redirecciones comerciales sin acceso al upstream. La comprobación pública y sus capturas acompañan la publicación.
