# Estrategia de venta Scalaris

El 21/10/2026 el usuario pidió cerrar las búsquedas y fijar el patrón de recargos con los productos ya cargados. Se eliminó el heartbeat y se deshabilitó la investigación. Los checkpoints conservan evidencia histórica, con cobertura parcial del mercado.

La tienda vende contra pedido, por transferencia y con envío al cliente cotizado aparte. El flete del proveedor a Scalaris es gratuito según el acuerdo confirmado. Antes de cobrar, confirmar disponibilidad y plazo.

## Regla activa

Los porcentajes, categorías, excepciones, reserva y condiciones comerciales se guardan exclusivamente en `.private/market-research/pricing-settings.json`, ignorado por Git. El generador exige esa configuración explícita y no inventa valores si falta.

```text
costo base = costo final ARS + gastos explícitos absorbidos
precio mínimo = costo base × (1 + recargo de la categoría)
precio publicado = redondear hacia arriba respetando el piso de costos y reserva
contribución = venta - costo base - comisión - reserva presupuestada
```

No agregar IVA nuevamente al costo final confirmado. El recargo se calcula sobre el costo; la contribución se mide sobre la venta. La reserva es un presupuesto operativo: no equivale a impuestos calculados ni a utilidad contable neta.

Para pedidos pequeños, evaluar el aporte total y agrupar productos. El ticket orientativo permanece como recomendación interna; no se impuso un mínimo de compra ni una ganancia fija a cada unidad.

Las referencias anteriores no alteran el patrón final. Sus importes sólo aparecen mientras sean estrictos y vigentes. Snippets y búsquedas nunca habilitan un precio de mercado.

## Actualización manual

```powershell
node scripts/build-store-prices.mjs
node scripts/build-store-prices.mjs --apply-public
node scripts/build-market-dashboard.mjs
node scripts/build-public-market-progress.mjs
npm run check
```

El primer comando calcula la propuesta privada para revisar. `--apply-public` respalda el catálogo y copia sólo campos públicos de venta. Costos, recargos, márgenes y reportes permanecen fuera del hosting y del repositorio.

La validez de cada precio depende de la fecha del costo fuente. Regenerar el catálogo no renueva esa fecha. Recalcular sin cambiar el precio o sus condiciones conserva su fecha anterior. Productos vencidos o con costo pendiente siguen bloqueados. Para actualizar la política, editar la configuración privada, revisar todos los productos y publicar los cambios autorizados.
