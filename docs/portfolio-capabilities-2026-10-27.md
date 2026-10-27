# Portafolio Scalaris: capacidades y paquetes

Fecha de revisión: 27/10/2026, Argentina. Alcance: lectura de fuentes y documentación de los proyectos existentes, más comprobaciones HTTP anónimas sin operaciones de negocio. No se modificaron aplicaciones, bases, credenciales ni despliegues durante esta auditoría.

Las rutas de fuentes citadas abajo parten de la raíz del workspace `Scalaris projects`; esta nota pertenece a `scalaris/docs/`. Un README acredita una declaración del proyecto. Un informe de validación acredita únicamente la versión, el ambiente, los resultados y los límites que registra. La disponibilidad HTTP de una demo no equivale a aceptación operativa de un cliente.

## Organización comercial recomendada

Se recomienda agrupar por necesidad del comprador, evitando presentar los nombres de repositorio como productos distintos cuando comparten la misma función:

| Familia | Entrega disponible | Diferencial sustentado | Forma de ofrecerla |
| --- | --- | --- | --- |
| Presencia web | Sitio institucional estático, contenido, servicios y enlaces de contacto/WhatsApp, adaptación móvil y metadatos SEO | Adaptación de una base propia a la identidad y actividad del negocio | Dos paquetes de alcance fijo: limitar secciones, revisiones, carga inicial y mantenimiento; definir los extras antes de aceptar |
| Scalaris Catálogo | Presentación configurable, catálogo administrable y carrito para WhatsApp; planes superiores con solicitudes, seguimiento y caja manual | Núcleo multiempresa, límites y capacidades en servidor; adaptación mediante configuración | Tres planes de precio fijo, conservando los importes y límites de la oferta aprobada |
| Menú gastronómico | Productos, variantes, ingredientes, adicionales, disponibilidad, fotos desde el celular, carrito y mensaje de WhatsApp; gestión interna opcional | Reglas gastronómicas y editor de imágenes que el catálogo simple todavía no incluye | Precio de referencia asistido, con instalación y abono por comercio; cerrar material, infraestructura y alcance antes de contratar |
| Scalaris Mesa | Salón, mesas, mostrador y para llevar; comandas, variantes/extras, cuentas, registro manual de pagos y caja | Operación del salón y coordinación con cocina, con continuidad restringida por dispositivo | Precio de referencia asistido y piloto por negocio/sucursal; configuración, capacitación y aceptación separadas |
| Gestudio | Gestión académica y financiera implementada: alumnos, disciplinas, inscripciones, asistencias, mensualidades, cargos, pagos, caja, inventario, recibos y reportes | Producto vertical con roles, pertenencia y aislamiento entre organizaciones | Demo y cotización; completar los gates y la aceptación del ambiente real antes de ofrecer operación productiva |
| CRM | Prospectos, seguimientos, agenda, etiquetas, notas, oportunidades/presupuestos, importación revisada y preparación de plantillas | Organización de la gestión comercial con permisos y seguimiento humano | Demo/relevamiento y cotización de implementación o adaptación; no prometer envíos reales actualmente habilitados |

Los dos paquetes web son una delimitación comercial de trabajo sobre capacidades existentes, no la afirmación de que existe un CMS general. Tu Comida y Burger House son referencias del paquete Menú gastronómico; no se recomienda publicitarlos como dos productos equivalentes separados.

## Capacidades reales y límites por familia

### Presencia web

Remodelaya es un sitio institucional de HTML/CSS/JavaScript estático. Tiene contenido, imágenes, enlaces de teléfono/correo y metadatos SEO. Su build copia fuentes revisadas; no incorpora un panel universal para que el cliente edite contenido.

Fuentes: `remodelaya/README.md`, `remodelaya/site/`, `scalaris/README.md` y `scalaris/public/`.

Los enlaces `mailto:` existentes no acreditan un servicio de aprovisionamiento y operación de casillas corporativas. No se identificó un flujo común que compre un dominio por cliente o cree correo corporativo automáticamente. En la oferta nueva de Web se incluye el registro y la renovación de un dominio .com.ar disponible a nombre del cliente mientras el plan esté activo, mediante alta asistida. El usuario confirmó cinco casillas gratuitas por dominio con Zoho: se incluye su configuración inicial si Zoho Free está disponible para la organización, con 5 GB por usuario y sin IMAP/POP, migraciones ni licencias pagas. Su disponibilidad se verifica antes de contratar. Catálogo conserva una dirección de Scalaris; dominio propio y correo se cotizan aparte.

### Scalaris Catálogo

El producto permite presentación configurable, categorías, productos, precios, visibilidad e imagen HTTPS. Base prepara WhatsApp con precios recalculados por servidor, sin guardar un pedido. Pedidos incorpora solicitudes guardadas y seguimiento. Gestión añade caja manual con apertura, ingresos/egresos, responsables, efectivo esperado, arqueo y diferencia. Los registros de transferencias y tarjetas se separan del efectivo físico. Registrar un pedido no acredita un cobro.

La instalación utiliza un núcleo multiempresa con roles, pertenencia y capacidades validadas en servidor; no exige copiar un proyecto por negocio. La oferta aprobada conserva límites de productos, administradores, carga inicial, capacitación y revisiones.

Límites: una imagen por URL pública HTTPS, sin carga de archivos de fotos en esta versión; menú de ítems simples, sin variantes/adicionales gastronómicos; sin procesamiento de pagos ni facturación fiscal. El piloto físico y la copia externa automatizada siguen siendo pendientes operativos.

Fuentes: `scalaris-comercio/docs/producto-y-lanzamiento-2026-10-27.md`, `scalaris-comercio/docs/backend-acceptance-2026-10-27.md`, `scalaris-comercio/docs/validation-2026-10-27.json`, `scalaris-comercio/server/plans.mjs` y `scalaris-comercio/commercial/offer.json`. La documentación registra la publicación del 27/10, conservación de datos legados y tres restauraciones aisladas en el VPS. Los resultados locales previos conservan su alcance histórico.

### Menú gastronómico: Tu Comida y Burger House

El catálogo público ofrece variantes, ingredientes, adicionales, disponibilidad manual, carrito persistente en el dispositivo y preparación de un mensaje de WhatsApp. El editor permite cargar fotos desde el celular, importar/exportar copias y mantener un borrador separado de la versión publicada. La publicación autentica al propietario, compara la revisión vigente y conserva la identidad de cada instalación.

La gestión interna es opcional y conserva datos separados del catálogo público. Puede cargarse manualmente un pedido recibido por WhatsApp o una venta de mostrador. Crear el pedido no confirma una venta ni descuenta insumos. La verificación manual del pago registra el cobro y descuenta ingredientes una vez; las reglas de preparación, cancelación, merma y reembolso son independientes.

Tu Comida utiliza Workers/D1. Burger House mantiene Node/SQLite y Docker en el VPS. La paridad de funcionalidades es de código; identidades, datos, imágenes, claves y alojamiento permanecen separados. Hoy se trata de instalaciones por comercio, no de un SaaS genérico con alta automática multiempresa. El precio de referencia debe incluir la revisión de configuración, permisos de publicación, material, recuperación y aceptación de la instalación concreta.

Fuentes: `tu-comida/README.md`, `tu-comida/docs/parity-2026-10-23.md`, `tu-comida/docs/standard-assessment.md`, `burger-house-3/README.md` y `burger-house-3/docs/parity-2026-10-23.md`.

### Scalaris Mesa

El recorrido implementado comprende atención en mesa, mostrador o para llevar; consumos con variantes, extras y notas; rondas a cocina/barra; preparación y entrega; división y registro manual de pagos; vuelto, cierre y liberación de mesa. La administración admite negocios, sucursales, usuarios y perfiles de propietario, encargado, caja, mesero y cocina.

La continuidad sin conexión tiene restricciones: una cuenta conserva un dispositivo responsable asignado en línea; las operaciones locales quedan pendientes de sincronización. Durante el corte las comandas nuevas no llegan a otras pantallas. El almacenamiento local no sustituye un respaldo y no hay conciliación automática de conflictos.

El informe del 24/10 registra demo pública, servicios saludables, 18 controles públicos de API y restauración aislada en el VPS. No acredita prueba de carga, aceptación de Android/iPad físicos ni impresión física. Se imprime mediante navegador; no se declara integración directa con impresoras. No hay integración bancaria, procesamiento de pagos ni factura fiscal. La devolución de propina no está implementada. La capacidad y conservación histórica necesitan medición y política antes de escalar.

Fuentes: `scalaris-resto/README.md`, `scalaris-resto/docs/validation-20261024.md`, `scalaris-resto/docs/environment-assessment.json`, `scalaris-resto/deployment/README.md`, `scalaris-resto/backend/src/main/java/com/scalaris/mesa/Domain.java` y `scalaris-resto/backend/src/main/java/com/scalaris/mesa/ApiController.java`.

### Gestudio

Hay código y validaciones para los flujos académicos y financieros. La demo VPS pública utiliza información sintética y el rol de consulta `DEMO_COMERCIAL`; bloquea escrituras salvo autenticación, no envía correo y deshabilita la descarga de recibos de fixtures que no tienen PDF. No debe presentarse ese ambiente como una institución en operación.

El README y el contexto propio conservan la aceptación productiva pendiente y gates de calidad/seguridad sin cerrar. Sus resultados históricos no se trasladan a cualquier working tree o instalación. Se recomienda demo, relevamiento y cotización de implementación, con aceptación de backend y ambiente real antes del primer uso operativo.

Android es un candidato de evaluación. El informe del 24/10 acredita APK debug, AAB y pruebas de navegador/emulador; los paquetes apuntan deliberadamente a `api.example.invalid`, no tienen backend operativo y mantienen `publishable=false`. No hay publicación de Google Play aceptada ni garantía de funcionamiento en los teléfonos del cliente. Se necesita titular/cuenta, identidad, soporte/privacidad, firma/custodia y aceptación contra backend real.

Fuentes: `Gestudio/README.md`, `Gestudio/deployment/vps/README.md`, `Gestudio/docs/android/README.md`, `Gestudio/docs/android/VALIDACION.md`, `Gestudio/GESTUDIO_FINALIZACION_SUPERADMIN_MEGAPROMPT.md` y `context-kit/projects/Gestudio-1678a1513ed5/CONTEXT.md`.

### CRM

El CRM dispone de gestión de prospectos, agenda y seguimientos, etiquetas, actividades, oportunidades/presupuestos, importación revisada CSV/XLSX, plantillas y simulación. La edición Scalaris configura cuentas, roles, etiquetas y referencias propias del negocio; una adaptación a otro cliente necesita alcance y aprovisionamiento propios.

El informe del 24/10 acredita despliegue en `crm.scalaris.com.ar`, HTTPS, autenticación/roles y restauración de 44 tablas. Conserva el estado `DEPLOYED_CLOSED_COMMUNICATIONS`: email NOOP, WhatsApp DEEPLINK_ONLY, dry-run y workers/red reales deshabilitados. No vender campañas, mensajes automáticos o integración real de proveedores como ya habilitados. Copia externa, custodio, recuperación fuera del host, RPO/RTO y retención aceptados siguen pendientes.

Fuentes: `crm-platform/README.md`, `crm-platform/docs/validation/crm-vps-deployment-2026-10-24.md`, `crm-platform/docs/continuity/current-context.md` y `crm-platform/docs/next-step.md`.

## Paquetes combinados e integraciones

No se identificó sincronización automática entre Catálogo, Tu Comida/Burger House, Mesa y CRM. Un paquete combinado puede coordinar la implementación de módulos independientes, con sus accesos y datos, pero no debe prometer que el pedido web entra automáticamente a cocina, que existe un único catálogo/stock/caja o que el contacto pasa al CRM sin una integración adicional.

Incluso dentro de Tu Comida/Burger House, publicar fotos o precios del catálogo público no reescribe recetas, precios o ventas de gestión. Esta separación debe explicarse antes de ofrecer una operación unificada. El desarrollo de integración, migración y conciliación requiere presupuesto y aceptación específicos.

## Costos y alcance de soporte

No se encontraron mediciones reales por cliente de minutos de instalación, soporte, infraestructura o adquisición comercial. No hay evidencia para declarar rentabilidad, disponibilidad garantizada, escala ilimitada ni un SLA a partir de los topes configurados de los contenedores.

El simulador histórico de `scalaris-comercio/commercial/internal/onboarding.html`, generado desde `commercial/build.mjs`, presenta supuestos editables, no costos medidos: hora de $15.000, instalación de 90 minutos, soporte de 10 minutos por mes, infraestructura de $500 y cobranza de 3%. Ese costo unitario de infraestructura se reemplaza, para esta investigación comercial, por el costo mensual declarado por el usuario dividido por la cantidad de clientes efectivos. Las respuestas sobre VPS, dominio y correo, los escenarios de 5/10/20 clientes y los supuestos no medidos se conservan fuera del sitio público en `.private/research/portfolio-2026-10-27/economics.json`. No acreditan rentabilidad comprobada, capacidad ilimitada ni un precio mínimo universal.

Los planes accesibles se sostienen mejor con diseños propios configurables, carga inicial y capacitación limitadas, ABM/autoservicio y soporte técnico acotado. Si se incluyen cambios manuales mensuales, definir cantidad, tamaño de tarea, tiempo máximo, material aportado y tratamiento de acumulados. No ofrecer cambios o soporte ilimitados por omisión.

## Referencia publicitaria aportada por el usuario

Las dos capturas de Grupo JV Argentina anuncian desde $17.000 por mes y mencionan dominio propio, correo corporativo, hosting, diseño personalizado y hasta cinco modificaciones mensuales. Se registran como **contenido publicitario aportado por el usuario**, sin fecha de vigencia contractual verificada, sin prueba del proveedor y sin comprobación independiente de qué significa cada modificación, las condiciones de baja, titularidad/renovación del dominio, alcance del correo, instalación o límites operativos.

La publicidad sirve para analizar claridad, promesa y presentación. No prueba la calidad, entregabilidad, costo interno o cumplimiento del proveedor, ni autoriza copiar su oferta como si Scalaris ya entregara todos esos componentes. La comparación de precio requiere revisar condiciones actuales y equivalencia de alcance; esta auditoría no sustituye la investigación de mercado de la coordinación.

## Comprobación pública de esta auditoría

El 27/10/2026 a las 20:11:55 UTC se efectuaron únicamente GET anónimos, sin iniciar sesión ni crear datos:

| Entrada | Resultado observado |
| --- | --- |
| `https://scalaris.com.ar/comercio/api/health` | HTTP 200, `status=ok`, `application=scalaris-comercio` |
| `https://scalaris.com.ar/mesa/api/health` | HTTP 200, `status=UP`, `service=scalaris-mesa` |
| `https://scalaris.com.ar/gestudio/` | HTTP 200, documento HTML Gestudio |
| `https://scalaris.com.ar/tu-comida/` | HTTP 200, catálogo Tu Comida |
| `https://scalaris.com.ar/burger-house-3/` | HTTP 200, catálogo Burger House |
| `https://crm.scalaris.com.ar/` | HTTP 200, pantalla del CRM Scalaris |

Estas respuestas verifican disponibilidad de las entradas en ese momento. No acreditan nuevos flujos, impresión física, aceptación móvil, cobros, envíos, recuperación externa ni garantías operativas.
