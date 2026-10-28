# Refactor de la web comercial — 28/10/2026

## Alcance y aceptación

El usuario autorizó un refactor profundo para comunicar calidad, diferenciales, precios y claridad, con referencias de servicios consolidados. Confirmó aplicar la propuesta investigada: Origen $15.000/mes + $100.000 de puesta en marcha; Web hasta cinco páginas $25.000 + $200.000; Vidriera $15.000 + $50.000; Flujo $25.000 + $75.000; Pulso $35.000 + $100.000. Anual opcional con 10% de descuento exclusivamente sobre el abono, doce meses anticipados y puesta en marcha cobrada en ambas modalidades. Dominio separado, a nombre y cargo del cliente. No se presenta el costo del VPS en el precio unitario.

Aceptación: navegación y diseño consistentes en portada, Productos, Web, Catálogo, demos, propuesta, Proyectos y Consulta; precios provenientes de las fuentes; mensual como modo inicial; continuidad de producto/plan/modalidad hasta el desglose de la consulta; alta siempre adicional; distinción de planes fijos, referencias de implementación, demos y proyectos en preparación; navegación móvil y teclado; enlaces, recursos y metadatos válidos; ausencia de promesas operativas o testimonios inventados.

Las demostraciones y sus backends conservan sus rutas, identidades y datos. El rediseño comercial no autoriza despliegues ni cambios en Gestudio, CRM, Mesa o Catálogo operativo. Los flyers locales anteriores no se actualizan automáticamente al cambiar las fuentes web.

## Evaluación vigente del estándar

Inspección del 28/10/2026: HTML/CSS/JavaScript estáticos, generadores Node, fuentes JSON, Cloudflare Pages conectado a main y verificación en CI. No hay persistencia propia en el sitio comercial. Mantener este stack es apropiado: la tarea necesita presentación, comparación y consulta, sin autenticación ni transacciones nuevas. Migrar a React/Spring/PostgreSQL añadiría mantenimiento sin resolver un flujo requerido. La separación de generadores y shell compartido reduce duplicaciones y protege la regeneración de precios y navegación. No se cambian migraciones ni bases de datos.

Se conserva la identidad Scalaris, la tipografía Inter y el dominio existente. Las referencias de diseño son las páginas oficiales de Linear, Stripe, Shopify y Basecamp, más las referencias comerciales documentadas en la investigación. Sirven para estudiar jerarquía, demostración y claridad; sus cifras de clientes, conversión o disponibilidad no se atribuyen a Scalaris. Observaciones en `redesign-references-2026-10-28.md`.

## Verificación

Verificación local del 28/10/2026:

- `npm run offers:build`: las cuatro proyecciones se generan en orden. Segunda generación comparada por SHA-256 de todo `public/`: ningún archivo cambia.
- `npm run check`: 168 pruebas aprobadas, sin fallos; referencias locales y dinámicas, sintaxis, canonical/OpenGraph, 19 fichas de proyectos y ausencia de campos privados en JSON público.
- Navegador en `127.0.0.1:8094`, escritorio y 390 px: portada, Productos, Web, Catálogo, demos, propuesta, Proyectos y Consulta. Sin desbordamiento horizontal en los recorridos verificados; capturas y recursos de producto cargados. La propuesta local se prueba con `.html`, porque el servidor de desarrollo no reproduce las URL limpias de Pages.
- Selector mensual/anual: cinco abonos, descuento de 10%, cinco altas completas, enlaces con producto/plan/modalidad y rechazo de importes arbitrarios en la URL. Menú móvil, Escape, preguntas frecuentes y navegación sin JavaScript comprobados.
- Consulta de Flujo mensual: $25.000 + $75.000 = $100.000 inicial. La revisión y la vuelta a corregir conservan respuestas. El total anual y el dominio separado quedan en el desglose de consulta. No se envían consultas de prueba ni se abre WhatsApp.
- `git diff --check`: sin errores. Evidencia visual local en `artifacts/refactor-web-2026-10-28/`, ignorada por Git.

La publicación se verifica después del push con el commit, el check Cloudflare Pages y el contenido del dominio público. Un render local no constituye prueba de despliegue. Los controles son proporcionales a una web comercial estática; no constituyen una auditoría integral de accesibilidad ni pruebas operativas de los backends de las demos.
