# Scalaris

Web estática de Scalaris: soporte informático, desarrollo de software, galería de proyectos y tienda contra pedido.

Sitio público: https://scalaris.pages.dev

## Archivos

`public/` contiene la web portable de HTML, CSS, JavaScript, catálogo público, imágenes, logos y fuentes Inter con su licencia. No necesita dependencias ni compilación. Los costos mayoristas y el cotizador personal quedan en `.private/`, fuera de la publicación y excluidos de Git.

Fuente visual original: `Scalaris_01_Identidad_Complementos_Web_2026-09-30.zip`, carpeta `05_Web_Estatica`. La importación inicial de los 12 archivos se verificó byte por byte contra el ZIP; la portada y el formulario se mantienen ahora en este repositorio. El Site original de ChatGPT permanece independiente y sin modificaciones.

La portada prioriza la consulta guiada en la navegación, el inicio, los servicios y el contacto. En móvil, la tarjeta guiada aparece antes del WhatsApp directo. El símbolo de WhatsApp junto al número proviene de [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/whatsapp.svg).

## Verificación y vista local

```powershell
node scripts/check.mjs
node scripts/serve.mjs
```

Abrir http://127.0.0.1:8080. Para abrirlo con doble clic, usar `VerSitio.cmd` y mantener su ventana abierta. La portada y la galería también pueden abrirse directamente; la tienda requiere la vista local o un hosting HTTP para cargar su catálogo.

## Galería y tienda

- `public/proyectos/` muestra Remodelaya, Shekinah y Burger House 3 con miniaturas, descripciones y enlaces a sus URL reales. Shekinah usa una captura local identificada porque el acceso público fue bloqueado por FortiGuard en este entorno; Burger House es una demo con pagos simulados.
- `public/tienda/` permite buscar por modelo/marca, filtrar por categoría, ordenar por precio, revisar fichas y agregar hasta 12 productos distintos a un pedido. Muestra precios unitarios, subtotales y total por transferencia; el envío se cotiza aparte por código postal. Las cantidades, referencias y el total se preparan en un enlace de WhatsApp; la persona revisa y envía el mensaje. No hay cobro automático ni reserva de stock. La selección se conserva en la sesión del navegador, sin datos personales.
- Importación del 20/10/2026: 7.305 productos (NB 1.409, DistriLand 2.796 y TecnoPrices 3.100). Las fotos de NB usan sus URL originales; las de TecnoPrices se extrajeron del PDF y se alojan localmente (2.730 archivos únicos, 12,3 MB). DistriLand queda con un marcador explícito de imagen pendiente. Las descripciones son las referencias disponibles en las fuentes; no se inventan especificaciones.
- El catálogo público contiene nombres, categorías, fotos y referencias; no expone costo, escalas mayoristas, stock histórico ni información interna. El importador y los controles usan una lista explícita de campos públicos. Los nombres iguales entre proveedores conservan sus referencias: no se asume que variantes diferentes sean el mismo producto.
- Hay 7.292 productos habilitados con precio de venta ARS por transferencia. Otros 13 quedan fuera de venta: 12 titulados “VENCIDO” y una referencia NB sin costo actual. Un precio público sólo se muestra si es positivo y tiene `priceValidUntil` vigente; al vencer aparece “No disponible” y se impide agregarlo al pedido. La vigencia queda limitada a siete días desde el costo de origen, sin renovarse por regenerar archivos. Confirmar disponibilidad, envío y plazo antes de cobrar sigue siendo parte de la operación contra pedido.
- Los precios se calculan desde los costos finales y el patrón comercial guardado exclusivamente en `.private/market-research/pricing-settings.json`. El usuario cerró las búsquedas el 21/10/2026 y se eliminó el seguimiento automático. La evidencia anterior conserva sus fechas y sólo se muestra mientras siga vigente. Ver [estrategia de venta](scripts/ESTRATEGIA-PRECIOS.md) y [validación de referencias](scripts/MERCADO.md).

Para actualizar listas, fotos o costos NB en pesos, seguir [Importar catálogos](scripts/IMPORTAR-CATALOGOS.md). La actualización NB del 20/10/2026 (`NB-Lista-Precios-20_10_2026_01_55-84844.xls`) aporta **1.408 costos finales en ARS**, unidos por identificador de URL al código NB original. Se usa la columna `Costo`; las fotos y referencias provienen del catálogo anterior. El producto `nb-124029` (Kit Gigabyte promoción) no figura en esta lista: conserva su costo histórico USD y requiere confirmación antes de cotizar. El XLSX anterior se conserva como procedencia histórica, sin convertir sus importes automáticamente. El CSV opcional `id,costARS` sigue disponible para actualizaciones manuales.

## Cotizador personal

Abrir `.private/cotizador.html` con doble clic. Es una herramienta local autónoma, con búsqueda por producto y cálculo de precio, envío absorbido, comisión de cobro, reserva, margen, ganancia mínima y comparación de mercado. Los 1.408 costos NB en pesos se precargan al elegir el producto, con IVA ya incluido. DistriLand usa los importes finales confirmados por el propietario. Para una referencia ausente en la última lista o todavía en USD, se requiere confirmar el costo final. El envío proveedor → Scalaris se carga en $0 según el acuerdo confirmado; el envío al cliente se cobra por separado en la tienda.

Para regenerarlo después de importar listas: `node scripts/build-price-calculator.mjs`. Ver [Criterio de precios y uso](scripts/PRECIOS.md). El cotizador permite simular condiciones distintas; no publica datos en la tienda. `build-store-prices.mjs` genera la propuesta y requiere `--apply-public` para actualizar el catálogo público. `.private/` necesita respaldo local independiente si se quiere conservar.

El control de publicación verifica recursos de todas las páginas, sintaxis, campos del catálogo y las pruebas de consultas y precios: `node scripts/check.mjs`. Las pruebas del importador se ejecutan con Python según su documentación.

## Cloudflare Pages

- Repositorio: `JerePrograma/scalaris`.
- Rama de producción: `main`.
- Framework: None.
- Comando de build: `node scripts/check.mjs`.
- Directorio de salida: `public`.
- Directorio raíz: raíz del repositorio.
- Despliegues automáticos de producción habilitados.
- No requiere secretos, variables de entorno ni dominio personalizado.

La integración Git de Pages debe estar configurada desde la cuenta Cloudflare. Cada push a `main` publicará los archivos de `public/` después de la verificación.

Contacto: [WhatsApp](https://wa.me/5491172789289), 1172789289.

## Backoffice local y formulario guiado

El backoffice Java/Spring Boot + React/TypeScript + PostgreSQL está separado en `backoffice/`. Ver [uso, configuración local/LAN, cálculos, archivos y respaldos](backoffice/README.md). No se publica en Cloudflare Pages, no tiene login y no se conecta al sitio público.

**Para abrirlo diariamente en Jeremias, hacer doble clic en Scalaris LAN del escritorio**, o ejecutar `AbrirScalaris.cmd -Mode Lan` desde `C:\laburo\Scalaris`. La [guía COMO-USAR](backoffice/COMO-USAR.md) reúne apertura, parada, actualización, pantallas reales, backups y reversión a Local. El modo LAN aprobado sirve React y API juntos en `http://192.168.1.9:8081/`; el propietario confirmó Tablero y Clientes desde su celular físico. El modo Local seguro y Vite quedan como alternativas.

La [verificación de acceso del 5/10/2026](backoffice/VERIFICATION-20261005-ACCESS.md) reúne la evidencia actual del 403, arranque cotidiano, recursos compilados, guardias de prueba y límites del acceso LAN.

La [rectificación de arquitectura y arranque del 4/10/2026](backoffice/VERIFICATION-20261004-REFACTOR.md) documenta la separación física por responsabilidades, configuración IntelliJ/scripts, diagnóstico de almacenamiento y resultados efectivos de pruebas. Los informes anteriores permanecen disponibles como evidencia histórica.

El [seguimiento de IntelliJ y Vite del 5/10/2026](backoffice/VERIFICATION-20261005-VITE.md) confirma el Run real aportado por el usuario y documenta la corrección del 403 en desarrollo, UTF-8 HTTP y la configuración Scalaris Vite.

La consulta guiada independiente está en `public/consulta/index.html`. Los enlaces de equipos y software preseleccionan el servicio. Prepara un resumen y una ficha JSON descargable; la acción principal copia el resumen y abre WhatsApp para revisarlo y pegarlo manualmente. El saludo del enlace no incluye el nombre ni el teléfono ingresados. La importación en backoffice también es manual. No persiste datos personales por defecto ni requiere servidor público.

Verificar además el formulario: `node --test scripts/public-form.test.mjs`. El comando y directorio de build de Pages permanecen iguales. Cloudflare publica únicamente `public/`; el backoffice sigue siendo una aplicación local.
