# Presentación mensual de precios y flyers

Fecha de revisión: 28/10/2026. Reemplaza la presentación comercial del lanzamiento anterior; sus documentos y colecciones se conservan como antecedentes.

## Usuario, problema y resultado

El usuario prioriza comercios y pymes de Argentina que necesitan puesta en marcha y acompañamiento. Observó rechazo visual ante los totales anuales en las tarjetas y pidió precios mensuales destacados, redondeo a la baja y coherencia entre toda la web y todos los flyers. La contratación conserva la modalidad mensual o doce meses anticipados; Consulta prepara un presupuesto de referencia y no cobra ni contrata.

## Investigación y aplicación

Se consultaron fuentes primarias de diseño y comercialización, sin atribuirles resultados de conversión propios de Scalaris:

- [Hostinger Argentina, creador de páginas web](https://www.hostinger.com/ar/creador-de-paginas-web): patrón observable de precio mensual destacado con contratación anticipada, beneficio de plazo y renovación. Su página también expone el pago completo; no es correcto afirmar que sólo lo revela en caja. Aplicamos la jerarquía mensual y mantenemos la condición del período junto al importe.
- [Nielsen Norman Group, confianza en B2B](https://www.nngroup.com/articles/b2b-trust-from-b2c/): los presupuestos, la complejidad de compra y la claridad de precios y alcances influyen en la evaluación. Se ordenan las comparaciones con los mismos campos, se diferencia abono de implementación y se mantiene la posibilidad de explorar demos.
- [Baymard Institute, abandono de compra](https://baymard.com/blog/reduce-cart-abandonment): los gastos inesperados y la fricción en la revisión perjudican la experiencia de compra. Se indica la modalidad anual desde el precio y se muestra el desglose completo antes de compartir la consulta o realizar cualquier pago. Su investigación es principalmente de comercio electrónico; aplicarla a esta consulta comercial es una decisión de diseño, no una estimación de conversión.

El redondeo se adopta por la preferencia explícita del usuario y como descuento comercial adicional. No se sostiene que un número redondo convierta universalmente mejor ni se promete un aumento porcentual de ventas. El siguiente paso comercial sería medir consultas calificadas y contrataciones por modalidad sobre una base comparable; no se instaló analítica nueva ni se inventaron resultados.

## Presentación y cálculo

El anual queda seleccionado por defecto. El precio principal corresponde al abono mensual equivalente y lleva junto a él «con pago anual anticipado de 12 meses». Los totales anuales y sumas del primer pago salen de las superficies de marketing, carteles, propuesta imprimible, demos, galerías y textos para redes. La puesta en marcha pendiente se muestra separada cuando corresponde. El importe completo se muestra en el segundo paso de Consulta, antes de compartir o pagar.

| Plan | Abono mes a mes | Equivalente mensual con anual | Alta anual a pagar | Crédito adicional | Total anual de revisión |
| --- | ---: | ---: | ---: | ---: | ---: |
| Origen | $15.000 | $13.500 | $0 | $2.000 | $160.000 |
| Vidriera | $15.000 | $13.500 | $0 | $2.000 | $160.000 |
| Flujo | $25.000 | $22.500 | $37.500 | $2.500 | $305.000 |
| Pulso | $35.000 | $31.500 | $50.000 | $3.000 | $425.000 |
| Web de hasta cinco páginas | $25.000 | $22.500 | $100.000 | $0 | $370.000 |

Fórmula: doce abonos equivalentes + alta después de bonificar − bonificación adicional de redondeo. El último concepto es el resto de dividir ese importe por $5.000. Se calcula en centavos enteros y se publica como línea separada en la revisión, cuando es mayor que cero. No se afirma que el precio principal multiplicado por doce sea el importe final: el precio corresponde al abono; las bonificaciones y el alta integran el desglose.

Menú, Mesa y Gestudio muestran referencias mensuales equivalentes desde $18.000/$22.500/$27.000, con doce meses anticipados e implementación a cotizar. Sus tarifas mes a mes siguen en $20.000/$25.000/$30.000. Otros sistemas conservan presupuesto individual y sus estados reales.

Se mantienen los cinco cupos compartidos o 30/11/2026, lo que ocurra primero; confirmación real de cupo; alta bonificada 100%/50%; primer año de .com.ar disponible y vinculable, a nombre del cliente; renovación posterior a su cargo; ayuda de contenido de 60 minutos; una revisión; carga de 30/60/100 productos y capacitación de 20/30/45 minutos. Otros prearmados conservan 50% de implementación estándar hasta $50.000 con anual. El tope no limita el beneficio de Web de cinco páginas. No se da un valor ficticio al subdominio ni se presentan funciones o implementaciones pendientes como activas.

La tarifa mensual no se redondea ni aumenta; el alta completa conserva sus tres cuotas sin recargo durante la promoción. El crédito adicional no se aplica a mensual, a otras implementaciones cotizadas ni fuera de la promoción. La rentabilidad sigue sin estar medida: no se definió un valor de hora ni se midieron los tiempos de entrega. VPS tratado como costo marginal por decisión del usuario; dominio incluido supone un costo comercial real del primer año.

## Entrega y arquitectura

Se conservan la web estática, sus generadores Node, Cloudflare Pages y los proxies existentes. La evaluación del estándar ya documentada en la nota de refactor sigue vigente: no hay necesidad nueva de backend, base de datos o migración a React para este cambio comercial. La política compartida permanece en `commercial/launch-promotion.json` y `public/offer-policy.js`; los parámetros de URL seleccionan planes permitidos, nunca precios ni beneficios. Se corrige que una modalidad inválida pudiera convertirse en una modalidad por defecto al generar el texto inicial.

La colección vigente se guarda en `../contenido-redes/flyers-mensuales-2026-10-28/`: 46 piezas en 1080×1350 para Facebook/Instagram y 1080×1920 para WhatsApp, 92 PNG y 92 SVG. La galería y los PNG se publican en `/flyers/`, junto con dos ZIP de PNG. SVG, fuentes y ZIP editable de aproximadamente 112,6 MB quedan locales. Las colecciones anteriores se conservan. `npm run flyers:sync` sólo sustituye sus recursos generados y retira los dos ZIP públicos anteriores.

## Verificación

- `node scripts/check.mjs`: 178 pruebas aprobadas; referencias, canonicals, navegación, datos privados, cálculos, cuotas, elegibilidad, vencimiento, redondeo y parámetros manipulados.
- Comprobación de marketing sin importes anuales antiguos o nuevos y sin columnas de total/primer pago. Resumen económico de Consulta conserva los importes exactos y el crédito adicional.
- Revisión visual de Inicio, Productos, Web, Catálogo, Promociones, Consulta y galería en escritorio y celular. Flujo anual se recorre hasta la revisión local, sin enviar mensajes ni realizar pagos.
- QA de flyers: 92 tamaños correctos, 92 layouts sin solapamientos detectados, notas de al menos 23 px, cuatro montajes y nueve piezas representativas inspeccionadas; 186 referencias locales válidas e integridad de los tres ZIP.
- Evidencia y comprobación de publicación: `artifacts/mensual-2026-10-28/`, fuera del sitio público. La publicación se confirma con el estado de CI/Cloudflare y comparación de los recursos públicos contra los archivos locales.
