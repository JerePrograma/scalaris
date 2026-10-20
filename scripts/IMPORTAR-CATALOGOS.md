# Catálogos de proveedores

El sitio publica un catálogo de consulta. Los costos, las cantidades históricas del proveedor y las escalas mayoristas quedan en `.private/catalog-costs.json`, fuera del directorio público y excluidos de Git. El importador nunca calcula ni publica un precio de venta por su cuenta.

## Importar una nueva lista

Requiere Python 3.10 o posterior con `openpyxl`, `pdfplumber` y `pypdf`. Para XLS binario también usa `xlrd`. Desde la carpeta `scalaris`:

```powershell
python scripts/import-catalog.py --nb "C:\ruta\lista-NB.xlsx" --distriland "C:\ruta\distriland.txt" --tecnoprices "C:\ruta\tecnoprices.pdf" --as-of 2026-10-20
```

La operación lee los originales y produce:

- `.private/catalog-costs.json`: costos con moneda, IVA, origen y ubicación de cada registro. Conserva las variantes por SKU y las escalas de cantidad de TecnoPrices.
- `public/tienda/catalog.json`: únicamente nombre, referencia, categoría, marca, foto y descripción para consultar. `price` queda en `null` y `currency` en `ARS`, la moneda prevista para la venta.
- `public/tienda/assets/products/`: miniaturas originales de TecnoPrices. Se vinculan por la fila y el código del producto y se deduplican por contenido. NB utiliza las URL de imágenes incluidas en la planilla. El texto de DistriLand no aporta fotos, de modo que esos productos quedan sin imagen.

No copies el catálogo privado, las listas originales ni el CSV de costos a `public/`. Al actualizar listas cambian los precios y la disponibilidad del proveedor: cada pedido requiere una confirmación nueva. El stock del proveedor se conserva como dato histórico privado y nunca se convierte en stock propio.

`--skip-pdf-images` evita volver a extraer las miniaturas. Si el PDF es idéntico al de la importación anterior y las imágenes siguen en disco, conserva sus referencias en ambos catálogos. Si el PDF cambió o se perdió el catálogo privado anterior, no reutiliza fotos sin verificar: omití ese parámetro para extraerlas nuevamente. La importación habitual de costos NB en pesos puede ejecutarse sin este parámetro.

## NB en pesos

La primera lista XLSX recibida el 20/10/2026 tiene 1.409 productos y todos dicen `U$S` en la columna `MONEDA`. `PRECIO FINAL` incluye el IVA indicado. Esa fuente original, sus fotos y sus metadatos se conservan.

La segunda lista `NB-Lista-Precios-20_10_2026_01_55-84844.xls` es XLS binario real y contiene 1.408 productos en el esquema `Identificador de URL`, `Nombre`, `Categorías`, `Stock`, `SKU`, `Precio`, `Costo`, `Impuesto interno`. El propietario confirmó que es su exportación en pesos. Para actualizar sólo los costos NB, sin releer los otros proveedores ni modificar el catálogo público:

```powershell
python scripts/import-catalog.py --update-nb "C:\ruta\NB-pesos.xls" --nb-currency ARS --as-of 2026-10-20
```

Se usa exclusivamente **Costo**. `Precio` no interviene en el cálculo: en la lista recibida hay 444 diferencias de un centavo entre ambas columnas. El vínculo se realiza por `Identificador de URL`, que corresponde al código NB de la lista anterior, y se valida también el nombre exacto y el SKU del fabricante. Se conservan fotos, galería, categorías, garantía y los demás datos de la ficha. Los registros de DistriLand y TecnoPrices permanecen iguales.

La exportación no trae una columna de moneda ni alícuota. Por eso se exige `--nb-currency ARS` como declaración explícita, y el tratamiento de IVA se conserva de la ficha previa del mismo producto. El importe de **Costo** ya es final: no se multiplica nuevamente por IVA ni se convierte desde USD. La procedencia del nuevo costo queda en `costSource`; el costo USD anterior permanece en `costFromSource`, asociado a su fuente original.

La actualización real del 20/10/2026 cargó 1.408 costos ARS. El único producto anterior ausente en la nueva lista es `nb-124029`, KIT GIGABYTE PROMOCION. Conserva la ficha y el costo USD anterior, pero queda marcado `missingFromLatestNbList: true` y `costRequiresConfirmation: true`. No se inventa un costo ARS ni se interpreta su ausencia como falta de stock.

El modo `--update-nb` rechaza IDs desconocidos, duplicados, variantes que no coinciden y costos inválidos antes de guardar. Los productos nuevos necesitan primero una ficha detallada para incorporar sus metadatos. El resultado incluye un conteo de filas actualizadas, IDs ausentes y una huella de integridad de los otros proveedores.

Si `xlrd` no está disponible, puede instalarse únicamente en el directorio aislado e ignorado del proyecto, sin modificar el runtime:

```powershell
python -m pip install --target artifacts/python-deps xlrd==2.0.2
```

El importador busca ese directorio por defecto; para otro destino usá `--xls-deps RUTA`. Detecta XLS y XLSX por su firma binaria. Algunas exportaciones NB presentan el defecto OLE `Workbook corruption: seen[...] == ...`: sólo para ese error conocido registra la incidencia y reintenta la lectura tolerante, seguida de las validaciones de esquema, identidad y costos. Cualquier otro error de lectura detiene la operación. El archivo original nunca se modifica.

### Alternativa: costos ARS manuales

Para una carga manual sigue disponible el CSV privado con dos columnas:

```csv
id,costARS
nb-CODIGO_DE_PRODUCTO,COSTO_FINAL_EN_PESOS
```

Reemplazá los textos por el ID existente y el costo final numérico con IVA incluido, sin separador de miles y con punto decimal. No se aplica descuento, conversión ni recargo al valor del CSV.

```powershell
python scripts/import-catalog.py --nb "C:\ruta\lista-NB.xlsx" --nb-ars ".private\nb-pesos.csv" --distriland "C:\ruta\distriland.txt" --tecnoprices "C:\ruta\tecnoprices.pdf" --as-of 2026-10-20
```

Esto reemplaza el costo de trabajo de esos productos por ARS y conserva el importe original en `costFromSource`. En una importación completa desde la lista USD, los productos no incluidos en el CSV siguen en USD y no deben cotizarse como pesos. El CSV modifica costos privados; los precios públicos siguen pendientes de cotización.

## Particularidades de cada fuente

- **NB detallado:** usa el costo `PRECIO FINAL` y la moneda declarada. Conserva también costo neto, alícuota, fabricante y garantía. No utiliza `PRECIO FINAL CON UTILIDAD` como precio de venta. La actualización de la exportación en pesos usa la columna `Costo`, sin cambiar las fichas ni publicar precios.
- **TecnoPrices:** el PDF declara precios ARS con IVA incluido. Para una unidad toma `x1`; `x3`, `x5` y `x10` se conservan por separado y sólo corresponden al volumen indicado. Las columnas se leen por su posición, sin desplazar descuentos cuando hay celdas vacías.
- **DistriLand:** el texto permite recuperar nombre y precio mostrado en pesos. No acredita si ese importe es mayorista ni si incluye IVA. `vatIncluded` y `vatRate` quedan en `null`: confirmalos antes de cotizar. Los IDs se derivan del nombre exacto porque el adjunto no contiene SKU.

Para verificar el importador sin releer todas las listas:

```powershell
python scripts/catalog-import.test.py
```
