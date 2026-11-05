# Oferta con presentación personalizada — decisión del 05/11/2026

El fundador pidió revisar la oferta frente a Tiendanube, Propia Tienda y Bitwobi, sin competir por ser la alternativa más barata, y hacer más visible y atractivo el pago anual. Después autorizó definir los precios concretos e implementar la recomendación en la web. Los valores siguientes son la selección realizada bajo esa autorización; no se presentan como importes elegidos individualmente por el fundador ni como precios aceptados por clientes.

La oferta se orienta a negocios que necesitan una presentación propia y acompañamiento directo para mostrar servicios o vender mediante WhatsApp. El valor incluye relevamiento, propuesta visual individual, personalización de diseño y código de presentación, implementación, mantenimiento y soporte delimitados. Nuevas funciones e integraciones conservan presupuesto y aceptación propios.

## Fuentes y selección fechada

Las fuentes editables para cotizar siguen siendo [portfolio-offer.json](../commercial/portfolio-offer.json) para Web y [offer.json de Catálogo](../../scalaris-comercio/commercial/offer.json). Esta tabla registra la decisión de hoy y no sustituye esas fuentes para futuras propuestas.

| Plan | Abono mensual ARS | Implementación única ARS | Abono anual anticipado ARS | Ahorro en abono ARS | Total inicial con anual ARS |
|---|---:|---:|---:|---:|---:|
| Web Origen | 69.900 | 350.000 | 629.100 | 209.700 | 979.100 |
| Web de hasta 5 páginas | 99.900 | 650.000 | 899.100 | 299.700 | 1.549.100 |
| Catálogo Vidriera | 89.900 | 300.000 | 809.100 | 269.700 | 1.109.100 |
| Catálogo Flujo | 119.900 | 450.000 | 1.079.100 | 359.700 | 1.529.100 |
| Catálogo Pulso | 149.900 | 650.000 | 1.349.100 | 449.700 | 1.999.100 |

La vigencia de estas referencias para nuevas propuestas llega al 30/11/2026. Los acuerdos ya aceptados mantienen sus condiciones. No hay ventas, cobros ni rentabilidad acreditados por adoptar esta escala.

## Anualidad y presentación económica

Se adopta 25% de descuento sólo en el abono de Web y Catálogo: doce meses de servicio cuestan el equivalente a nueve mensualidades vigentes al contratar. El equivalente mensual es 75% del mensual de lista; el abono anual es nueve veces ese mensual; el ahorro es tres veces ese mensual. El período se abona completo por adelantado y el precio del abono permanece fijo durante esos doce meses.

La implementación se cobra completa una sola vez y por separado, en ambas modalidades. El total inicial anual suma implementación y abono anual. El porcentaje no debe presentarse como descuento sobre esa suma. El ahorro compara doce abonos al precio de lista vigente al contratar; no proyecta ajustes trimestrales futuros. Registro y renovación de dominio continúan separados, a nombre y cargo del cliente.

La web debe mostrar porcentaje, equivalente mensual identificado, pago anual completo, ahorro monetario e implementación separada. Mensual sigue siendo la modalidad inicial. Gestudio conserva su escala y su 15% anual específico; Menú, Mesa y CRM conservan sus referencias y requisitos de presupuesto, sin un anual automático.

## Entregables y aceptación

Web conserva una página con hasta cinco secciones o hasta cinco páginas, según plan. Catálogo conserva sus secciones y capacidades actuales: productos simples, una imagen por URL HTTPS, carrito a WhatsApp y pedidos o caja manual según plan. No se agrega un checkout con pagos online ni facturación fiscal por cambiar la oferta.

La implementación incorpora una propuesta visual individual y dos rondas de ajustes agrupados sobre esa propuesta, antes de la aceptación y dentro de páginas, secciones y funciones contratadas. La personalización comprende identidad, composición, presentación de contenido y recorrido de contacto. Las referencias visuales existentes sirven para el relevamiento; el diseño final no queda limitado a elegir uno de esos estilos.

Se conservan componentes y núcleo compartidos. El alcance no implica exclusividad de todo el código, desarrollo desde cero de cada componente, cesión automática de repositorios ni funciones futuras ilimitadas. Funciones e integraciones adicionales, ampliaciones de alcance y rediseños posteriores se cotizan por separado.

La aceptación de cada entrega debe comprobar la propuesta visual acordada, el contenido y las páginas o secciones contratadas, las dos rondas de revisión, el recorrido de consulta o pedido y la visualización en celular y computadora. Las capacidades operativas, aislamiento, respaldo y recuperación mantienen la aceptación técnica del producto y de su instalación. Una demo disponible o una oferta publicada no reemplazan esos controles.

## Evaluación y verificación de este cambio

El cambio afecta oferta y presentación comercial; se mantiene la evaluación técnica del sitio estático registrada en la [decisión del 01/11](precios-por-valor-2026-11-01.md). No se necesita modificar arquitectura, aplicación operativa, base de datos o despliegue de los productos para actualizar estos datos. Los riesgos de esta entrega son cálculos incorrectos, proyecciones antiguas y promesas de personalización mayores que el alcance.

Verificación de fuentes completada: ambos JSON válidos; cinco equivalentes anuales iguales al 75% del abono mensual; cinco abonos anuales iguales a nueve mensualidades; ahorro equivalente a tres mensualidades; implementación completa separada; dos rondas de ajustes en cada plan. Se comparó el cambio de Catálogo contra una copia basal para conservar y distinguir sus modificaciones preexistentes.

Se generaron las proyecciones de Inicio, Productos, Web, Catálogo, condiciones y referencias de consulta. Se regeneraron once piezas, veintidós PNG y dos ZIP íntegros, con revisión visual del flyer Flujo y controles de dimensiones y superposiciones. La colección del 01/11 se conserva fuera de publicación y sus enlaces de ZIP redirigen a la vigente.

`npm run check` aprobó 182 pruebas, incluidas las de ahorro, total anticipado, implementación completa, protección frente a importes manipulados por URL, privacidad y condiciones propias de Gestudio. La revisión de navegador local comprobó selección anual de Catálogo en escritorio, Web a 390 px sin desborde horizontal y desglose anual de Origen en consulta. Se corrigió además la lectura de controles al revisar la consulta y la conservación del botón al cambiar el tipo de proyecto; el primer submit de Flujo anual mostró ahorro y total correctos en navegador. No se enviaron mensajes ni se efectuaron pagos. El cierre de publicación y cualquier verificación posterior quedan en `artifacts/precios-2026-11-05/publicacion.json` y en el estado de Scalaris Negocio.
