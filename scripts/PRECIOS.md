# Cotizar sin perder margen

La tienda vende contra pedido, con precios visibles por transferencia y envío al cliente separado. Antes de cobrar se confirma la disponibilidad con el proveedor, se cotiza el envío y se acuerda el plazo. El importador conserva las listas como referencia; no representan stock propio. La política de publicación está en [Estrategia de precios](ESTRATEGIA-PRECIOS.md).

## Abrir el cotizador visual

Abrir `.private/cotizador.html` con doble clic. Funciona sin servidor ni conexión: buscá un producto, completá los costos reales y tocá **Calcular precio sugerido**. No publica nada ni guarda cambios; al cerrar se pierden los valores ingresados.

La lista NB en pesos recibida el 20/10/2026 aporta 1.408 costos finales ARS: se precargan al elegir el producto y no se vuelve a sumar IVA. Se usa la columna `Costo` del XLS, vinculada por `Identificador de URL` con el código NB, y se conservan las fotos anteriores. `nb-124029` (Kit Gigabyte promoción) no figura en la nueva lista: su importe histórico USD no se precarga como pesos y requiere confirmar el costo actual. TecnoPrices aplica su escala por cantidad. DistriLand usa los 2.796 importes finales confirmados por el propietario; no se inventa una alícuota de IVA ni se agrega impuesto otra vez.

Los gastos desconocidos quedan vacíos y deben completarse, incluso si confirmaste que son cero. Los valores iniciales de margen, reserva, ganancia mínima y redondeo están marcados como simulación editable. El resultado también es una simulación hasta confirmar costos, disponibilidad y entrega.

Después de actualizar las listas, regenerar este archivo privado con:

```powershell
node scripts/build-price-calculator.mjs
```

El HTML contiene información mayorista y debe permanecer dentro de `.private/`, que está excluida del repositorio. No subirlo al hosting ni compartirlo con clientes.

## Cálculo interno

`pricing.mjs` cotiza en pesos y no escribe en `public/`, no publica precios y no modifica el catálogo. El costo unitario ingresado debe ser el costo final del proveedor con IVA incluido. No se agrega IVA otra vez. Una condición tributaria no confirmada debe resolverse antes de usar ese costo para vender.

Con `q` unidades:

```text
C = costo_unitario_final × tipo_de_cambio × q
    + envío_proveedor + envío_cliente_absorbido + embalaje + cargos_fijos

P_margen = C / (1 - comisión - reserva - margen_objetivo)
P_mínimo = (C + ganancia_mínima_del_pedido) / (1 - comisión - reserva)

precio_unitario = redondear_hacia_arriba(max(P_margen, P_mínimo) / q)
ganancia_del_pedido = venta_total - C - comisión_sobre_venta - reserva_sobre_venta
```

Todos los envíos, el embalaje, los cargos fijos y la ganancia mínima se ingresan como totales del pedido en ARS. Se prorratean entre las unidades. Si un costo es por unidad, multiplicalo por la cantidad antes de ingresarlo. En pedidos de varios proveedores se suman todos los envíos necesarios; no presupongas un solo flete.

El usuario confirmó que el envío del proveedor a él es gratis: usar `inboundShipping: 0` para ese acuerdo. El envío al cliente todavía debe cotizarse e ingresarse explícitamente si Scalaris lo absorbe; no se asume gratuito.

Las tasas son proporciones del precio bruto de venta (`0.20` significa 20%). La reserva es un presupuesto elegido para imprevistos, garantías u otros costos variables; no es un impuesto calculado. La ganancia resultante es una contribución después de estos costos, no una utilidad contable neta de todos los gastos del negocio.

Un margen del 20% necesita un recargo del 25% sobre el costo si no existen otros gastos. Agregar 20% al costo deja 16,67% de margen. El 20% es solamente un ejemplo configurable, no una rentabilidad aprobada ni garantizada.

## Uso

Crear un archivo privado, por ejemplo `.private/cotizacion.json`:

```json
{
  "unitCost": 10000,
  "currency": "ARS",
  "quantity": 1,
  "inboundShipping": 0,
  "outboundShipping": 4000,
  "packaging": 500,
  "fixedFees": 0,
  "paymentFeeRate": 0,
  "reserveRate": 0.03,
  "targetMarginRate": 0.20,
  "minimumProfit": 3000,
  "roundTo": 100,
  "marketReference": 25000
}
```

Los números son una simulación. Completar cada costo, incluso si corresponde `0`; no se toman datos desconocidos como costo cero. Para `currency: "USD"`, agregar `exchangeRate` con la cotización efectiva que cobra el proveedor. Para ARS, omitirlo o usar `1`. La cantidad debe ser un entero positivo y la suma de comisión, reserva y margen debe ser menor que `1`.

```powershell
node scripts/pricing.mjs --input .private/cotizacion.json
node --test scripts/pricing.test.mjs
```

La salida contiene costos privados: no copiarla a la web ni a un presupuesto para el cliente. El archivo original de cada proveedor también es privado.

Para tomar un producto de `.private/catalog-costs.json`, omitir `unitCost` y `currency` del archivo de supuestos e indicar su ID:

```powershell
node scripts/pricing.mjs --id nb-119109 --input .private/supuestos.json
node scripts/pricing.mjs --id tp-20775 --input .private/supuestos.json
```

Se elige la escala que realmente alcanza la cantidad pedida. Los costos NB actualizados en ARS se toman directamente, sin `exchangeRate`. Un costo histórico USD exige una cotización efectiva explícita; no se cambia su moneda a ARS sin convertirlo. Si se recibe un costo final actualizado manualmente, usar la primera modalidad con `unitCost` y `currency: "ARS"`. Las referencias ausentes en la última lista o con impuestos sin confirmar se bloquean por ID hasta agregar `supplierFinalCostConfirmed: true` tras verificar el costo actual y final. El campo no calcula impuestos ni corrige el importe por sí mismo. DistriLand ya tiene esa condición final confirmada.

`marketReference` es opcional: precio final comparable por unidad con entrega, mismo modelo, variante, garantía, condición y medio de pago. La comparación informa si el precio calculado puede igualar o mejorar esa referencia. Nunca baja el precio calculado para forzar una venta. Si el piso queda arriba del precio competitivo, conviene revisar proveedor, agrupar pedidos o descartar ese producto.

## Datos de las listas

- **NB:** costos vigentes en ARS de la columna `Costo` del XLS del 20/10/2026, con IVA ya incluido. Se mantienen las referencias y fotos originales del XLSX; los importes anteriores USD quedan como historia. La referencia ausente `nb-124029` conserva su importe histórico y exige nueva confirmación. No se inventa una conversión ni se aplica la columna `Precio` como costo.
- **TecnoPrices:** el PDF indica precios en ARS con IVA incluido. Las columnas x1, x3, x5 y x10 son precios unitarios según cantidad; usar x1 para un pedido unitario. Que figurara con stock al generarse la lista no confirma disponibilidad actual.
- **DistriLand:** el propietario confirmó que los importes del texto son los costos finales que paga al proveedor. Se preservan esos valores y la confirmación, sin sumar IVA ni inferir una alícuota.

## Referencias verificadas el 20/10/2026

Mercado Pago informa que los costos de Link de pago dependen de provincia, medio de pago y plazo de acreditación; financiar cuotas agrega otro costo. Consultar la tasa efectiva de la cuenta para el cobro concreto. No se fija una comisión automática en este cotizador. [Link de pago: costos y condiciones oficiales](https://www.mercadopago.com.ar/herramientas-para-vender/link-de-pago).

Mercado Libre ofrece un simulador por categoría, publicación y logística. La documentación de costos exige considerar logística, modalidad y peso facturable para Argentina. Estos costos corresponden al canal Mercado Libre; para una venta en el sitio propio se usa la comisión del medio de cobro elegido. [Simulador de costos](https://vendedores.mercadolibre.com.ar/nota/como-usar-el-simulador-de-costos-de-mercado-libre?guideKeyId=GE53&moduleKeyId=MO322) y [documentación oficial de costos](https://developers.mercadolibre.com.ar/es_ar/pagos/comision-por-vender).

No hay un recargo universal que asegure competir. Cada referencia de mercado debe conservar URL, fecha, precio, envío, pago y disponibilidad; los resultados de buscadores pueden estar desactualizados.
