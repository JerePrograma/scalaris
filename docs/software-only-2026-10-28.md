# Oferta pública centrada en software — 28/10/2026

## Alcance y aceptación

Solicitud del usuario del 28/10/2026: retirar de la web pública el armado, la reparación y la venta de equipos. Aclaración confirmada en la misma conversación: conservar productos y desarrollo de software, automatizaciones e integraciones.

La web debe conservar Web, Catálogo, Menú, Mesa, Gestudio, CRM, sus planes y las demos de software. La portada, la navegación, los metadatos y el formulario deben ofrecer únicamente software. La tienda, su catálogo y sus imágenes deben salir del directorio de publicación; sus enlaces anteriores deben conducir a Productos. Los generadores y controles deben impedir la reintroducción accidental de hardware.

## Evaluación vigente del estándar

Fuentes inspeccionadas el 28/10/2026: `package.json`, `wrangler.jsonc`, `.github/workflows/check.yml`, `public/`, `scripts/check.mjs` y los generadores de oferta.

El sitio usa HTML, CSS y JavaScript estáticos, Cloudflare Pages y verificaciones en CI. Esta modificación es editorial y elimina un flujo comercial; no requiere persistencia, React, Spring Boot ni PostgreSQL nuevos. Se recomienda conservar el stack estático. Una migración al stack general agregaría compilación y mantenimiento sin aportar valor al alcance solicitado. El esfuerzo es acotado a contenido, consulta, generadores y publicación. Los riesgos principales son enlaces antiguos, archivos aún accesibles y la regeneración de la tienda retirada; se cubren mediante archivo fuera de `public`, redirecciones y controles de publicación.

El backoffice y las aplicaciones de software mantienen su alcance independiente. Las herramientas históricas de hardware se conservan fuera de la web pública. No se modifica ninguna base de datos.

## Verificación local

Evidencia del 28/10/2026:

- `npm run offers:build`: seis familias y cinco planes fijos regenerados correctamente, sin enlaces a la tienda.
- `npm run check`: 163 pruebas aprobadas, sin fallos; controles de recursos, ofertas, consulta, galería y ausencia de hardware público correctos.
- Revisión de navegador: portada de escritorio y móvil a 390 píxeles; menú móvil con Productos, Planes, Demos, Desarrollo y Consultar.
- Consulta desde un enlace anterior con `service=EQUIPMENT` y plan Web anual: abre software, conserva producto/modalidad y muestra $96.000 de abono anual + $45.000 de instalación = $141.000 iniciales.
- Consulta móvil desde `service=PARTS`: abre software, permite automatización/integración y conserva los sistemas a conectar en el resumen. Las consultas de prueba no se enviaron.
- Revisión independiente de los cambios sin defectos materiales; comprobación de espacios del diff aprobada.

La consulta conserva el formato `scalaris.inquiry` versión 1 para importación manual al backoffice. Los códigos de servicio de hardware se rechazan en el modelo público. Las páginas generadas no vuelven a introducir equipos ni soporte de hardware. La oferta económica y las condiciones de los productos de software se conservan.

## Publicación

El destino existente es `https://scalaris.com.ar`, Cloudflare Pages desde `main` de `JerePrograma/scalaris`, con salida exclusiva `public/`. `legacy/hardware-store/` no forma parte de esa salida. Las reglas 301 cubren la tienda y todos sus recursos anteriores. El resultado remoto de cada despliegue se verifica mediante el check Cloudflare Pages del commit y respuestas HTTP del dominio público.
