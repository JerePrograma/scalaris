# Scalaris

Web estática de Scalaris: soporte informático, desarrollo de software, galería de proyectos y tienda contra pedido.

Sitio público: https://scalaris.com.ar

Dirección anterior, con redirección permanente: https://scalaris.pages.dev

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

- `public/proyectos/` reúne 19 fichas. Las tres primeras muestran las demos de Scalaris Comercio: Corralón Punto Obra, Ronda Mayorista y Almacén La Esquina, con acceso directo a `/comercio/t/corralon-demo`, `/comercio/t/mayorista-demo` y `/comercio/t/almacen-demo`. La cuarta presenta Scalaris Mesa en `/mesa/`, una demo de gestión para restaurantes y cafés con un entorno independiente y datos ficticios por visitante. Conserva Remodelaya, Shekinah, Tu Comida, E-MEDICAPP, Burger House, Gestudio, FourBubbles, Scalaris CRM, PharmaHome, Calendario de servicios, Inventarios Mueblería, Gym & Academy Manager, Presupuestador Flete, HogarIA y CJ Préstamos. Distingue los proyectos desplegados, las demos interactivas y los proyectos en preparación. Burger House es un proyecto desplegado y Tu Comida es una demo interactiva. Las fichas pendientes ofrecen una consulta, sin publicar una dirección de demo todavía inexistente. Tu Comida, E-MEDICAPP y Burger House se abren en `/tu-comida/`, `/e-medicapp/` y `/burger-house-3/`. Las 19 fichas tienen miniatura: trece capturas reales (nueve WebP, tres JPEG y un PNG) y seis portadas SVG originales identificadas como vistas ilustrativas. Gestudio, FourBubbles y Mesa muestran datos ficticios; PharmaHome muestra un formulario vacío. Shekinah conserva su captura local identificada porque el acceso público fue bloqueado por FortiGuard en este entorno.
- Cada ficha declara `data-project` y `data-state` (`live`, `demo` o `preparation`). Al verificar una nueva publicación, actualizar juntos estado, etiqueta, nota y enlace de la ficha correspondiente. La verificación de publicación exige las 19 fichas, identificadores únicos, estados válidos y los enlaces de las demos de Comercio y Mesa. También comprueba que Mesa se presente como demo, use su captura y explique los datos ficticios y el entorno por visitante.
- Evaluación del estándar (24/10/2026, fuentes: `package.json`, `wrangler.jsonc`, `.github/workflows/check.yml`, las páginas de `public/` y `functions/mesa/[[path]].js`): la galería usa HTML/CSS estáticos y Cloudflare Pages con CI; no necesita un backend ni base de datos propios. Conservar esa arquitectura permite agregar Mesa mediante una ficha, una captura y el control existente, con bajo esfuerzo y sin introducir otra compilación o despliegue para la galería. La aplicación Mesa mantiene su frontend React, backend Spring y PostgreSQL en el VPS, bajo el prefijo público `/mesa/`. La aceptación de esta ampliación es encontrar la ficha, identificarla como demo con datos ficticios por visitante y abrir `/mesa/` tanto desde la miniatura como desde el enlace. Las capturas de Comercio se tomaron de sus páginas públicas el 23/10/2026; la de Mesa se tomó el 24/10/2026 en 1440 × 900, con el salón y una cuenta ficticia.
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
- No requiere secretos ni variables de entorno.
- Dominio principal: `scalaris.com.ar`; `www.scalaris.com.ar` redirige a la misma ruta del dominio principal, conservando los parámetros.

La integración Git de Pages está configurada desde la cuenta Cloudflare. Cada push a `main` publica los archivos de `public/` después de la verificación.

### Dominio propio

El dominio se activó el 21/10/2026. La zona `scalaris.com.ar` está activa en el plan Free, en la misma cuenta Cloudflare que el proyecto Pages `scalaris`. La delegación de NIC Argentina y las consultas DNS públicas confirman los servidores `adam.ns.cloudflare.com` y `tia.ns.cloudflare.com`.

Registros guardados en Cloudflare, ambos proxied con TTL Auto:

| Tipo | Nombre | Destino |
|---|---|---|
| CNAME | `scalaris.com.ar` | `scalaris.pages.dev` |
| CNAME | `www.scalaris.com.ar` | `scalaris.com.ar` |

La regla habilitada **Scalaris: www al dominio principal** redirige `http*://www.scalaris.com.ar/*` a `https://scalaris.com.ar/${2}` con estado 301 y **Preserve query string** activado. Se verificó desde HTTP y HTTPS con `/consulta/?service=SOFTWARE`: conserva la ruta y los parámetros.

El dominio está asociado en **Pages → scalaris → Custom domains**. Esa asociación y la delegación DNS son necesarias para servir el sitio; crear sólo un CNAME no completa la configuración. Las redirecciones por dominio se configuran en Cloudflare.

La lista Bulk Redirects `scalaris_pages_to_domain` y su regla habilitada **Scalaris: Pages al dominio principal** redirigen `scalaris.pages.dev/` a `https://scalaris.com.ar/` con estado 301. Están activados **Preserve query string**, **Subpath matching** y **Preserve path suffix**. Se verificaron portada, `/consulta/?service=SOFTWARE` y `/tienda/?q=ssd`: cada enlace llega al dominio principal en un salto, conserva ruta y parámetros y termina en 200, sin bucles. La coincidencia se limita al host de producción `scalaris.pages.dev`.

La verificación pública del 21/10/2026 confirmó HTTPS válido y respuestas 200 en portada, consulta, proyectos, tienda, `robots.txt`, `sitemap.xml`, catálogo con 7.305 productos y 12 recursos CSS, JavaScript y SVG. Las cuatro páginas, el catálogo, robots y sitemap coinciden con los archivos publicados del repositorio.

Las cuatro páginas publican canonical y OpenGraph con el dominio principal. `public/robots.txt` referencia `https://scalaris.com.ar/sitemap.xml`, que enumera las cuatro rutas públicas. Los enlaces internos y recursos siguen siendo relativos para conservar la vista local.

Referencias: [dominios de Pages](https://developers.cloudflare.com/pages/configuration/custom-domains/), [redirecciones de Pages](https://developers.cloudflare.com/pages/configuration/redirects/) y [delegación en NIC Argentina](https://www.punto.gov.ar/ayuda/instructivos/delegacion-de-dominios).

Contacto: [WhatsApp](https://wa.me/5491172789289), 1172789289.

## Demos en el VPS

Publicaciones verificadas el 22/10/2026:

- https://scalaris.com.ar/gestudio/: dos organizaciones sintéticas, 28 alumnos y cuenta `DEMO_COMERCIAL` de consulta. El botón **Entrar a la demo** usa exclusivamente esa cuenta; los accesos de administración y MFA permanecen privados. La semilla oficial registra 48 recibos históricos sin generar PDF: la interfaz pública explica ese alcance y deshabilita su descarga.
- https://scalaris.com.ar/fourbubbles/: cuenta pública exclusiva `REPORT_VIEWER`, tres clientes ficticios, tres pedidos y dos ciclos simulados. El acceso de demo abre Pedidos; no permite modificar la operación.
- https://scalaris.com.ar/pharmahome/: aplicación estática con datos guardados en el navegador. Su service worker y cachés quedan limitados a su prefijo.
- https://scalaris.com.ar/calendario-servicios/: calendario y PDF locales al navegador, sin anuncios ni analítica.

Las funciones de `lib/vps-demo-proxy.js` usan un origen fijo del VPS. Los API públicos rechazan escrituras de negocio y orígenes ajenos; permiten sólo los POST de sesión declarados. Cada aplicación Java tiene su cookie propia, con `Secure`, `HttpOnly`, ruta restringida y respuestas sin caché. Caddy conserva los prefijos y dirige cada demo a su contenedor. Bases y Java carecen de puertos públicos; el correo y los procesos programados de Gestudio están desactivados.

El KVM 2 tiene 2 CPU y 8 GB de RAM. Las nuevas demos limitan Gestudio a 1.3125 GiB, FourBubbles a 1.1875 GiB y cada estático a 64 MiB. Estos topes no son una prueba de capacidad o concurrencia. Se compiló secuencialmente con un constructor limitado a 1 CPU y 2 GiB.

`scripts/vps/backup-demos.sh` respalda datos, configuración privada, Caddy y los paquetes de código de Gestudio. Su timer diario de las 03:55 de Buenos Aires admite hasta diez minutos de demora y conserva snapshots generados durante aproximadamente 14 días. La primera ejecución del servicio terminó con éxito. Se restauraron ambos PostgreSQL en contenedores temporales sin red ni puertos, preservando propietarios y permisos; Gestudio también pasó el aislamiento Alpha/Beta y el rechazo sin contexto de organización. La excepción de los recibos sintéticos queda registrada de forma explícita. Las copias permanecen en el mismo VPS: falta una copia externa. Ver [procedimientos de respaldo](scripts/vps/BACKUPS.md).

CRM, Inventarios Mueblería, Gym & Academy Manager, Presupuestador Flete, HogarIA y CJ Préstamos siguen en preparación. Las fichas muestran su propuesta sin exponer bases operativas ni publicar una demo no verificada.

## Scalaris Mesa

La demo pública está en https://scalaris.com.ar/mesa/ y la aplicación se ejecuta en el VPS. `functions/mesa/[[path]].js` conecta exclusivamente ese prefijo con el origen fijo del servidor; conserva la ruta y limita la cookie de sesión a `mesa_session`. `public/_routes.json` incluye `/mesa` y sus subrutas. La galería permanece estática y usa la captura real `public/assets/proyectos/scalaris-mesa.png`.

Cada visitante inicia un negocio demo independiente, con dos sucursales y datos ficticios, que vence a las ocho horas. Permite probar el plano de mesas, los pedidos, las comandas de cocina y barra, la división de cuentas y el registro manual de pagos, propinas y vuelto. Los cobros son de prueba y los tickets son internos; la demo no procesa pagos ni emite facturas fiscales. La interfaz adapta la operación a celulares, tablets y computadora.

La verificación pública del 24/10/2026 aprobó los 18 controles de API de Mesa: aislamiento entre negocios demo, sesión y permisos, origen y CSRF, importes, pagos parciales, idempotencia y devoluciones. Esa comprobación usa negocios ficticios nuevos y no requiere credenciales operativas.

## Demo E-MEDICAPP

La demo se comparte en https://scalaris.com.ar/e-medicapp/. La función
`functions/e-medicapp/[[path]].js` sirve la compilación estática de
`https://jereprograma.github.io/E-MEDICAPP/`; sus recursos relativos permiten usar
ambas rutas. `public/_routes.json` limita la función a `/e-medicapp` y sus subrutas.
El acceso sin barra final redirige conservando los parámetros. Sólo admite GET y
HEAD; no reenvía cookies ni credenciales del navegador al origen. La portada y
`deployment.json` se consultan sin caché para confirmar el commit y backend vigentes.

Cada publicación del repositorio `JerePrograma/E-MEDICAPP` actualiza la demo sin
copiar archivos ni volver a publicar Scalaris. El backend y los datos de la demo
se ejecutan en el VPS, administrados por los scripts de E-MEDICAPP. El backend admite
los orígenes `https://scalaris.com.ar` y `https://jereprograma.github.io`.
La compilación de Pages sigue usando `node scripts/check.mjs` y `public`; Cloudflare
también compila la carpeta `functions/`. No requiere secretos adicionales.

## Tu Comida

La ruta `https://scalaris.com.ar/tu-comida/` utiliza la misma integración de
Cloudflare Pages Functions que E-MEDICAPP, con publicaciones y datos independientes:

- `/tu-comida/` y `/tu-comida/editar/` sirven los archivos estáticos del Worker
  `tu-comida-web`, compilados con la base pública `/tu-comida/`.
- `/tu-comida/gestion/` sirve la aplicación de gestión de `tu-comida-management`.
- `/tu-comida/backend/` conecta con `tu-comida-api`, conservando sus rutas
  `/api/...` y `/admin/login`.
- `/tu-comida/editor-api/` conecta con el servicio `tu-comida-catalog-editor`.

`functions/tu-comida/[[path]].js` sólo utiliza esos cuatro orígenes fijos. Los
recursos y las redirecciones permanecen bajo la ruta pública. El proxy no envía
cookies de Scalaris; únicamente reenvía la sesión Bearer de la aplicación a sus
dos APIs. `public/_routes.json` conserva E-MEDICAPP y limita la nueva función a
`/tu-comida` y sus subrutas. El resto de las páginas continúa siendo estático.

`wrangler.jsonc` conserva el proyecto Pages `scalaris`, su salida `public` y
habilita `global_fetch_strictly_public`, necesario para consultar las publicaciones
Workers de la misma cuenta a través de sus direcciones públicas. La comprobación
previa al despliegue sigue siendo `node scripts/check.mjs`.

El catálogo y los servicios de Tu Comida se publican en Cloudflare; no requieren
que esta computadora permanezca encendida. La integración no modifica los datos
ni el funcionamiento de E-MEDICAPP, la tienda o el backoffice local de Scalaris.

## Backoffice local y formulario guiado

El backoffice Java/Spring Boot + React/TypeScript + PostgreSQL está separado en `backoffice/`. Ver [uso, configuración local/LAN, cálculos, archivos y respaldos](backoffice/README.md). No se publica en Cloudflare Pages, no tiene login y no se conecta al sitio público.

**Para abrirlo diariamente en Jeremias, hacer doble clic en Scalaris LAN del escritorio**, o ejecutar `AbrirScalaris.cmd -Mode Lan` desde `C:\laburo\Scalaris`. La [guía COMO-USAR](backoffice/COMO-USAR.md) reúne apertura, parada, actualización, pantallas reales, backups y reversión a Local. El modo LAN aprobado sirve React y API juntos en `http://192.168.1.9:8081/`; el propietario confirmó Tablero y Clientes desde su celular físico. El modo Local seguro y Vite quedan como alternativas.

La [verificación de acceso del 5/10/2026](backoffice/VERIFICATION-20261005-ACCESS.md) reúne la evidencia actual del 403, arranque cotidiano, recursos compilados, guardias de prueba y límites del acceso LAN.

La [rectificación de arquitectura y arranque del 4/10/2026](backoffice/VERIFICATION-20261004-REFACTOR.md) documenta la separación física por responsabilidades, configuración IntelliJ/scripts, diagnóstico de almacenamiento y resultados efectivos de pruebas. Los informes anteriores permanecen disponibles como evidencia histórica.

El [seguimiento de IntelliJ y Vite del 5/10/2026](backoffice/VERIFICATION-20261005-VITE.md) confirma el Run real aportado por el usuario y documenta la corrección del 403 en desarrollo, UTF-8 HTTP y la configuración Scalaris Vite.

La consulta guiada independiente está en `public/consulta/index.html`. Los enlaces de equipos y software preseleccionan el servicio. Prepara un resumen y una ficha JSON descargable; la acción principal copia el resumen y abre WhatsApp para revisarlo y pegarlo manualmente. El saludo del enlace no incluye el nombre ni el teléfono ingresados. La importación en backoffice también es manual. No persiste datos personales por defecto ni requiere servidor público.

Verificar además el formulario: `node --test scripts/public-form.test.mjs`. El comando y directorio de build de Pages permanecen iguales. Cloudflare publica únicamente `public/`; el backoffice sigue siendo una aplicación local.
