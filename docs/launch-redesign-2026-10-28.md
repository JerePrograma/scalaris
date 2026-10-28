# Lanzamiento comercial y piezas de Scalaris — 28/10/2026

## Alcance confirmado

El usuario autorizó rediseñar toda la web y todos los flyers con la promoción definida en doce respuestas: primeros cinco clientes nuevos en total o hasta el 30/11/2026; anual anticipado de doce meses con 10% en abono; alta 100% bonificada en Origen/Vidriera y 50% en Flujo/Pulso/Web de cinco páginas; primer año de un .com.ar disponible a nombre del cliente; renovación posterior a su cargo. Mensual: alta completa en tres cuotas sin recargo más abono.

Los totales anuales aprobados son $162.000/$162.000/$307.500/$428.000/$370.000, respectivamente. Web de cinco páginas mantiene $100.000 de bonificación; el tope de $50.000 sólo aplica a los otros prearmados, sobre 50% de la implementación estándar presupuestada. El resto del abono anual se calcula sobre el presupuesto individual con 10% de descuento.

Se incluyen hasta sesenta minutos iniciales de ayuda con contenido adicionales a configuración y capacitación, una revisión, y carga inicial de 30/60/100 productos para Vidriera/Flujo/Pulso; límites totales 100/300/1.000 y capacitación 20/30/45 minutos. Material, precios y fotos utilizables aportados y aprobados por el cliente. Fotografía, marca, audiovisual, migraciones complejas, funciones nuevas y terceros aparte.

La captación puede consumir margen y más horas como inversión. El costo de hora y los tiempos siguen sin medir: no se afirma rentabilidad ni se presupone aceptación de pérdidas. La hora adicional y el aumento de carga no estaban en los escenarios históricos.

## Arquitectura y fuentes

Se mantiene el sitio estático con HTML/CSS/JS, generadores Node y Cloudflare Pages. La evaluación del estándar sigue vigente: incorporar React, backend o base de datos no aporta valor a esta presentación y consulta sin cobro/persistencia nuevos. Esfuerzo acotado, beneficio de consistencia, riesgo de divergencia financiera tratado con una política común y pruebas de aritmética/contexto. No se cambian aplicaciones operativas, datos ni despliegues de demos.

- `commercial/portfolio-offer.json`: Web, seis familias y condiciones generales.
- `../scalaris-comercio/commercial/offer.json`: Catálogo, sus límites y alcances.
- `commercial/launch-promotion.json`: tasas, fechas, cupo, dominio y reglas de lanzamiento, sin costos internos ni datos de clientes.
- `public/offer-policy.js`: cálculo común de selectores y revisión de consulta; la política se proyecta desde la fuente con `scripts/launch-promotion.mjs`.
- `npm run offers:build`: sincroniza política, Catálogo, Productos/Promociones, Web e Inicio. Las proyecciones se versionan para CI sin repositorios hermanos.

El cálculo de cuotas utiliza centavos enteros y asigna el residuo a la tercera cuota. La revisión muestra el alta total, la cuota que se paga inicialmente y el saldo. Los parámetros de URL sólo eligen producto, plan y modalidad de listas permitidas. No aportan importes ni pueden activar bonificaciones arbitrarias. Los otros prearmados conservan presupuesto individual y estado de preparación; se amplió la lista permitida de contexto de consulta sin darles cargos cerrados.

La elegibilidad de lanzamiento es una referencia sujeta a confirmación: las fechas se evalúan con límites de Buenos Aires. Al vencer o establecer `availability: "closed"`, el cálculo vuelve al alta estándar sin dominio ni cuotas promocionales. La disponibilidad real de los cinco cupos se confirma contra las contrataciones; no existe contador de clientes automático ni se publican cinco cupos restantes. Al completar las cinco altas, cerrar la política y regenerar/publicar las piezas correspondientes. Los flyers tienen vigencia impresa y requieren retiro/reemplazo al agotarse el cupo.

## Dominio y condiciones operativas

El beneficio distingue registro, titularidad y conexión. La disponibilidad del dominio y la vinculación a cada solución se verifican antes de aceptar el contrato. Catálogo no tiene acreditado un mapeo universal de dominios: esta edición comercial no afirma que ya exista. El presupuesto incluye una conexión validada para el caso concreto; una redirección no se presenta como equivalente al catálogo bajo dominio propio.

El cliente acuerda entrega, baja y tratamiento del saldo del trabajo inicial antes del primer pago. No se inventaron una permanencia, una penalidad ni una política de devoluciones. La consulta no contrata ni activa un servicio. El precio del año rige desde la activación acordada; la renovación se informa con treinta días y no repite el alta del mismo alcance.

## Flyers y alojamiento

Nueva colección local en `../contenido-redes/flyers-lanzamiento-2026-10-28/`: 46 piezas, 92 PNG y 92 SVG editables. Incluye las 37 anteriores rediseñadas, siete productos adicionales y dos piezas generales. Facebook/Instagram 1080×1350; WhatsApp 1080×1920. Las colecciones históricas se conservan.

La exportación pública revisada se aloja en `public/flyers/` y `/flyers/`: 92 PNG, 46 miniaturas, galería, estilos, script y manifiesto público; sin rutas locales, fuentes internas ni SVG pesados. Los dos ZIP de PNG también se publican, con 10,9 MB y 14,7 MB, ambos por debajo del límite por recurso. Los editables completos y su ZIP de 112,6 MB quedan en la colección local. Las referencias de clientes y demos no se convierten en productos ni se les inventan prestaciones. PharmaHome y el calendario conservan acceso público; adaptaciones adicionales a presupuestar.

## Verificación

Las comprobaciones se registran en `artifacts/lanzamiento-2026-10-28/`. Se verifican generación repetible, precios y cuotas, descuento de 10% real, excepción de Web de cinco páginas, vencimiento/cierre, contexto de consulta, referencias públicas y ausencia de datos privados. QA de escritorio/celular, navegación, formulario sin envío, galería y descarga de imágenes. No constituye una nueva aceptación de los backends ni una auditoría integral de accesibilidad.

La publicación se confirma con el commit, GitHub/Cloudflare y contenido del dominio público. Los resultados finales y la correspondencia de archivos se conservan en la evidencia de publicación, fuera de `public/`.

Validación local integrada: 177 pruebas aprobadas; segunda generación de ofertas y flyers comparada por SHA-256 de todo `public/`, sin cambios. Las 92 imágenes PNG públicas tienen sus dimensiones esperadas y los cinco importes del manifiesto coinciden con la política web. Galería comprobada en navegador a 390 px y escritorio, filtros y búsqueda con acentos, sin errores observados. Dos ZIP públicos verificados por tamaño y los tres ZIP locales por integridad. Revisión independiente de la consulta, fechas, redondeo y notas de expiración; sin consultas enviadas ni cambios de negocio.
