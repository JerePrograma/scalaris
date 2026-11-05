# Planes claros y actualización del VPS — 05/11/2026

El fundador autorizó continuar con las recomendaciones de simplificación de las tarjetas y dejar el VPS actualizado. Se mantienen los importes y alcances de la [corrección anterior](ajuste-planes-2026-11-05.md); esta entrega cambia la jerarquía de presentación y publica en el producto los cupos de administradores ya aprobados.

## Presentación comercial

Las tarjetas de Web y Catálogo conservan siempre visibles el abono mensual sin descuento, la puesta en marcha y el total inicial del primer mes. El botón mensual queda junto a ese bloque. El anual muestra el equivalente mensual identificado, un único total por doce meses anticipados, una línea de puesta en marcha bonificada, un ahorro total del primer año y su botón propio.

El desplegable «Ver qué incluye y cómo se calcula el ahorro» contiene el desglose de ahorro en abonos y alta, la carga inicial y el contenido acordado. Las condiciones breves explican precio anual fijo por doce meses, aviso de renovación con treinta días y dominio separado, con enlace a las condiciones completas. La consulta y propuesta mantienen su desglose económico completo.

En Catálogo quedan a la vista productos, administradores, horas de capacitación y tres funciones diferenciadoras. Se retiran el resumen de precios anterior a las tarjetas, el texto que explicaba los colores y las filas financieras repetidas de la comparación inferior; esa comparación se concentra en alcance. Productos y Condiciones usan tres columnas: plan, mensual y anual. La portada elimina su sección promocional repetida. El material descargable también usa una sola cifra de ahorro principal; se archiva la edición anterior y se actualizan sus redirecciones.

No se modifican tarifas, descuentos por plan, bonificación anual, capacidades ni acuerdos aceptados. Las fuentes editables siguen siendo `commercial/portfolio-offer.json`, `../scalaris-comercio/commercial/offer.json` y la estrategia propia de Gestudio.

## VPS de Catálogo

La actualización técnica se documenta en el [informe del producto](../../scalaris-comercio/docs/admin-limits-vps-2026-11-05.json). El release vigente es `c1b6bd2879e7b5a3afd25ce8d17375609f18913fce6db3db51e9be7b4cf1ddc7`. La imagen deriva de la imagen exacta en ejecución y cambia únicamente `server/plans.mjs` para aplicar 2/4/6 administradores. El manifiesto conserva idénticos los otros 6.135 archivos, la configuración de imagen y el frontend.

Se recreó únicamente la aplicación. La base conserva el mismo contenedor, imagen y volumen; no se ejecutaron migraciones, siembras ni servicios de operación. Salud y versión correctas, con cupos confirmados tanto desde el VPS como desde el navegador público en las tres API de catálogos demo. Las cinco pruebas locales de aprovisionamiento concurrente acreditan el código de cupos; las consultas públicas acreditan los valores realmente publicados.

Se retuvieron el release y la imagen anteriores. Un intento anterior activó la recuperación automática al fallar su comprobación externa; se verificó el retorno a la aplicación anterior saludable antes de completar el nuevo release. La evidencia y el procedimiento de recuperación se mantienen en el producto. Los otros requisitos de aceptación productiva de Catálogo conservan su estado propio.

## Verificación

`npm run offers:build` y la generación de once piezas, veintidós PNG y dos ZIP finalizaron correctamente. `npm run check`: 183 pruebas aprobadas, con importes de decisión fuera de desplegables, límites y condiciones propios, contexto de enlaces, privacidad y protección frente a importes en URL.

Navegador local: escritorio de 1280×900; Catálogo, Productos y Web a 390px sin desbordes horizontales. Se comprobó apertura y cierre del desglose de Flujo y la permanencia visible de mensual, total inicial, anual y ahorro. El navegador público confirmó la versión del VPS y los cupos 2/4/6. La comprobación visual de la publicación comercial y su commit se registra en `artifacts/planes-claros-2026-11-05/publicacion.json` y en el estado de Scalaris Negocio. No se enviaron consultas ni se efectuaron pagos.

Se conserva HTML/CSS/JavaScript estático con las proyecciones existentes y Cloudflare Pages; la evaluación técnica del sitio del 01/11 continúa aplicando. La actualización del módulo de cupos mantiene arquitectura y esquema de Catálogo y tiene aceptación acotada propia.
