# Oferta por valor y competencia — 01/11/2026

## Decisión y alcance

El fundador pidió en el chat de Scalaris Negocio actualizar completamente la plataforma con los precios recomendados. La aclaración previa del mismo día fija el criterio: valor para el comprador y competencia realista, sin usar una tarifa por horas ni buscar ser la alternativa más barata.

Se adopta la oferta para **nuevas propuestas**. Los acuerdos aceptados conservan sus condiciones. La investigación fechada se mantiene en `../scalaris-negocio/investigaciones/2026-11-01-precios-valor-y-competencia.json`; sus bandas anteriores conservan carácter histórico de propuesta.

La entrega comprende Inicio, Productos, Web, Catálogo, comparación de planes, propuesta imprimible, cartel, Consulta, condiciones, navegación y material descargable. Los sistemas operativos mantienen sus versiones y aceptación propias. El ERP no ingresa como oferta lista para contratar.

## Fuentes de autoridad

- Web y referencias de Menú, Mesa y CRM: [portfolio-offer.json](../commercial/portfolio-offer.json).
- Catálogo: [oferta del producto](../../scalaris-comercio/commercial/offer.json); la proyección pública queda versionada para CI sin repositorio hermano.
- Gestudio: [estrategia canónica](../../Gestudio/docs/comercial/estrategia-comercial.md). `gestudio-offer.mjs` lee su tabla y condiciones. El snapshot generado permite verificar y construir el sitio cuando sólo está disponible este checkout; no es una segunda fuente editable.
- Campaña anterior: cerrada en [launch-promotion.json](../commercial/launch-promotion.json), conservando su [evidencia del 28/10](evidence/launch-promotion-2026-10-28.json).

La escala completa y vigente se consulta en esas fuentes. Las páginas, scripts de referencia y flyers son proyecciones de sus datos.

## Presentación y condiciones

La modalidad inicial es mensual. Web y Catálogo conservan la escala base y el anual opcional con descuento sólo sobre el abono. La implementación completa se paga una vez al comenzar y por separado en ambas modalidades. Se retiran para nuevas propuestas la bonificación de implementación, el redondeo adicional, el dominio incluido y las tres cuotas de lanzamiento. Registro y renovación del dominio quedan a nombre y cargo del cliente.

Menú, Mesa y CRM muestran referencias por negocio, local y equipo pequeño; requieren relevamiento, implementación y aceptación acordadas. No adquieren por arrastre un descuento anual o un total cerrado. Gestudio publica los cuatro tramos por alumnos activos, su anual propio y su implementación definida por la estrategia. Conserva el programa piloto administrado mientras falte aceptación productiva.

La consulta calcula totales únicamente para los cinco planes fijos Web/Catálogo. Los parámetros de URL seleccionan productos y planes admitidos; no cambian importes, implementación ni beneficios. Una fecha o elegibilidad anterior no reactiva la campaña.

## Material y reproducción

`npm run offers:build` actualiza las proyecciones desde sus fuentes. `npm run flyers:sync` genera la colección vigente desde esos JSON, con once piezas en dos formatos, SVG editables, miniaturas y dos ZIP. Ya no importa precios o beneficios de `contenido-redes`.

La generación de imágenes requiere `sharp` y `@napi-rs/canvas` del runtime local; `SCALARIS_ASSET_MODULES` permite señalar el directorio `node_modules` que los contiene. ZIP usa Python estándar. Esas herramientas no son dependencias del sitio servido ni del check remoto: los recursos generados se versionan.

La colección anterior permanece en `legacy/flyers-2026-10-28/`, fuera de publicación. Los PNG históricos se cotejaron por SHA-256 con la fuente original, que permanece intacta. Las URL anteriores de ZIP redirigen a los paquetes actuales.

## Evaluación del estándar

Se mantiene HTML/CSS/JavaScript estático con Cloudflare Pages, Node para generación y controles, y los proxies existentes a demos. No hace falta incorporar React, backend, base de datos ni migraciones para esta modificación comercial. El beneficio es una oferta consistente y verificable; los riesgos relevantes son desajustes entre fuentes, cálculo incorrecto, material anterior y atribución de capacidades no aceptadas. Se cubren con proyecciones explícitas, checks de correspondencia, pruebas del resumen económico, archivo histórico y estados de producto conservados.

## Verificación

- Generación de ofertas y material actualizada sin errores.
- `npm run check`: 183 pruebas aprobadas, recursos y privacidad pública verificados.
- Selector Web/Catálogo y portfolio: mensual inicial; anual opcional cambia sólo el abono y conserva la implementación.
- Navegador local: Productos en escritorio; Catálogo y consulta en 390 px; Vidriera anual muestra implementación completa y total inicial correcto. No se compartió la consulta ni se efectuó un pago.
- Flyers: once piezas, veintidós PNG con dimensiones verificadas, ZIP íntegros y revisión visual de ambos formatos. Detalle generado en `public/flyers/validation.json`.

La publicación usa el flujo existente: `main` de `JerePrograma/scalaris` y Cloudflare Pages. El cierre remoto y el commit se registran en el estado comercial una vez comprobados; estas pruebas no acreditan la operación productiva de las aplicaciones mostradas.
