# Scalaris Catálogo: integración y publicación

Fecha: 27/10/2026, Argentina. **Estado: publicación en proceso.** Esta nota reúne cambios y evidencia local; los resultados del despliegue y la verificación pública serán completados por el responsable de publicación.

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

## Cierre de publicación pendiente

Completar aquí la revisión de cambios, revisión/versiones publicadas, resultados HTTP y navegación en el dominio real, comprobación de demos y limitaciones operativas efectivas. No se declara producción aprobada hasta disponer de esos resultados.
