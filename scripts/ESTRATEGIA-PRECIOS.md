# Estrategia de venta Scalaris

## Modalidad elegida

Vender contra pedido con precio visible por transferencia y envío al cliente cotizado aparte por código postal. El proveedor entrega gratis a Scalaris. Confirmar disponibilidad y plazo antes del pago; no anunciar stock propio ni entrega inmediata. El cliente puede armar un pedido completo con total, sin preguntar el precio de cada artículo.

## Precio inicial

Usar el costo final ARS, sin volver a agregar IVA, y estos objetivos de contribución sobre la venta:

| Familia | Margen objetivo | Reserva adicional |
| --- | ---: | ---: |
| Equipos, componentes, almacenamiento, monitores, celulares y tablets | 20% | 3% |
| Accesorios, periféricos, audio, redes, impresión, hogar y consolas | 25% | 3% |
| Repuestos y herramientas | 30% | 3% |

Las categorías exactas y excepciones están en `build-store-prices.mjs`. La reserva presupuesta variaciones, embalaje y otros gastos todavía no medidos. Estas tasas son una decisión comercial inicial, editable; no garantizan utilidad neta contable. No se cobra comisión de tarjeta porque el precio publicado corresponde a transferencia.

```text
precio = costo final / (1 - margen objetivo - reserva)
```

Redondear hacia arriba: múltiplos de $50 para costos menores a $10.000, $100 hasta $100.000 y $500 por encima. No sumar una ganancia fija de $3.000 a cada unidad: distorsionaría productos baratos. Evaluar ese importe por pedido y agrupar accesorios pequeños en kits. El ticket sugerido de $15.000 es una métrica interna; no se impuso un mínimo de compra.

La primera aplicación habilita 7.292 precios y bloquea 13 referencias: 12 nombres contienen “VENCIDO” y un kit NB carece de costo actual. La vigencia máxima es de siete días desde el costo de origen. Regenerar archivos no vuelve vigente una lista vieja; al vencer se deshabilita el pedido hasta actualizarla.

## Comparación argentina por cada referencia

El objetivo es cubrir los 7.305 IDs, conservando las variantes y la procedencia. Se buscan tiendas argentinas y Mercado Libre por lotes. Para comparar se necesita modelo exacto, capacidad, color, calidad, marco y 4G/5G cuando corresponda; un título parecido o un GTIN compartido no basta.

Guardar URL, fecha, importe ARS, pago, disponibilidad y envío conocido/desconocido. Los snippets sólo descubren candidatos. Leer la ficha y registrar discrepancias entre precio visible y metadatos, productos agotados y accesos bloqueados. Un precio del producto sin envío confirmado no equivale a un total entregado.

Mercado Libre rechaza en este entorno las consultas anónimas directas; los resultados indexados siguen siendo candidatos. No se saltean bloqueos ni se presentan precios viejos como actuales. El seguimiento registra excepciones para que “relevado” no signifique que apareció cualquier enlace.

El reporte `market-references.json` distingue búsquedas y evidencia de producto. Para influir en precios se exige además evidencia exacta y reciente de pago por transferencia en `normalized-seeds.json`. Cuando existe, se propone 2% por debajo de la mediana comparable sólo si permite conservar el piso rentable. No ajustar automáticamente el sitio desde una búsqueda ni usar precios tachados o promesas de ahorro sin evidencia.

## Dónde competir

Priorizar productos con margen y referencias comprobadas. Competir también con selección, compatibilidad, asistencia y pedidos agrupados. Si el piso rentable supera al minorista, revisar proveedor o dejar ese artículo fuera de promociones; vender más con margen insuficiente no resuelve el problema.

Ejemplo observado el 20/10/2026: una ficha del Logitech MK345 en [Gaming City](https://www.gamingcity.com.ar/teclados-teclado-y-mouse-logitech-mk345-inalambrico--det--1792) muestra $49.399, frente al precio Scalaris inicial de $68.600. Es una señal para revisar el proveedor y las condiciones, no una referencia totalmente comparable de pago y entrega. El costo mayorista se conserva únicamente en el panel privado. No afirmar que todo el catálogo ya es competitivo.

## Operación y seguimiento

```powershell
node scripts/build-store-prices.mjs
node scripts/build-store-prices.mjs --apply-public
node scripts/build-market-dashboard.mjs
node scripts/check.mjs
```

El primer comando genera una propuesta privada; `--apply-public` hace una copia de respaldo y actualiza exclusivamente campos públicos de venta. La investigación programada no publica cambios de precio ni hace push.

Abrir `.private/market-research/research-dashboard.html` con doble clic para ver costos, precios propios, fuentes y cobertura. Es privado y no se sube al hosting. Ver [validación técnica](MERCADO.md) y [continuación por lotes](market-research-runbook.md). Los costos, políticas internas, fuentes mayoristas y reportes requieren respaldo local: Git y Cloudflare sólo reciben el catálogo público permitido.
