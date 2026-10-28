# Referencias para la presentación de Scalaris

Consulta: **28/10/2026**. Se abrieron páginas oficiales de cuatro productos de software. Estas observaciones describen su comunicación; no prueban que el diseño cause ventas, conversión o calidad operativa. Se mantienen la identidad de Scalaris y sus hechos verificables.

| Referencia primaria | Observación | Aplicación concreta en Scalaris |
| --- | --- | --- |
| [Linear](https://linear.app/) | Presenta una función principal y enseña el producto con pantallas antes de desarrollar cada flujo. La navegación separa producto, precios y documentación. | Una introducción breve y capturas reales en la galería. Descripciones que expliquen una tarea; acceso directo a la demo disponible. Evitar que una lista de tecnologías sustituya la explicación de utilidad. |
| [Stripe](https://stripe.com/en-ch) | Agrupa soluciones por necesidades y modelos de negocio. Los casos enlazados identifican la solución usada y distinguen el producto de sus pruebas y resultados. | Navegar por problema y estado. No transformar los proyectos propios, datos de demo o referencias visuales en clientes, testimonios o resultados comprobados. No copiar métricas de otros proveedores. |
| [Basecamp](https://basecamp.com/) | Una presentación concreta del trabajo que organiza acompaña una demostración de interfaz y un recorrido corto. El acceso a producto y contratación está localizado en la navegación. | La consulta conserva dos pasos visibles: describir la necesidad y revisar lo que se comparte. Se explica el siguiente paso y se mantiene el control del envío en el usuario. |
| [Fudo: precios](https://fu.do/es-ar/precios/) | Distingue los planes, la periodicidad y los módulos adicionales, con condiciones junto al precio y una comparación más detallada después. | La información económica procede de la oferta vigente y se revisa dentro de la consulta. No incluir importes en URLs ni presentar un relevamiento como contratación automática. La adaptación visual no modifica las reglas de cálculo. |

La dirección visual elegida es blanca, con texto marino, acentos azules e Inter. Los espacios, la jerarquía de títulos y los límites de ancho deben ayudar a leer. Las capturas del proyecto constituyen evidencia visual de una pantalla, no una validación de producción. Los seis proyectos cuya demostración está pendiente mantienen esa condición explícita; Gestudio y FourBubbles conservan el acceso de consulta.

La galería utiliza tres grupos con navegación anclada: demos disponibles, proyectos publicados y propuestas en preparación. Los 19 identificadores `data-project`, sus estados `data-state`, imágenes y destinos reales se conservan. Sin JavaScript, los grupos siguen disponibles en el documento.

La consulta conserva `#form-root`, `#error`, la lista `.steps` y el contrato `scalaris.inquiry` v1. La hoja local se limita al contenido de la consulta para respetar el header y footer compartidos. No se cambia la lógica de selección, cálculo, validación, descarga o WhatsApp, ni se envían consultas durante la verificación.

Evaluación vigente del estándar: la web continúa siendo HTML/CSS/JavaScript estático en Cloudflare Pages. Esta modificación de presentación no requiere React, backend, base de datos o migraciones nuevos. El riesgo principal es perder contexto o destinos al reorganizar contenido; se verifica la conservación de las 19 fichas, los estados y los enlaces, y se revisa el flujo de consulta en anchos de escritorio y móvil.
