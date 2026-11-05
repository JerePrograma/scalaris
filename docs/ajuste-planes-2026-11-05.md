# Ajuste de planes — corrección del 05/11/2026

El fundador corrigió la propuesta de precios y condiciones del mismo día: fijó una escala mensual y anual para Catálogo, aumentó los administradores y la capacitación, y pidió que la implementación inicial quede bonificada al contratar el pago anual. Esta decisión sustituye para nuevas propuestas los datos correspondientes de la [decisión anterior del 05/11](precios-personalizacion-2026-11-05.md), que se conserva íntegra como evidencia histórica. Los acuerdos ya aceptados mantienen sus condiciones.

Las fuentes editables siguen siendo [portfolio-offer.json](../commercial/portfolio-offer.json) para Web y condiciones generales y [offer.json de Catálogo](../../scalaris-comercio/commercial/offer.json) para sus planes. Esta nota registra el corte de la decisión, no reemplaza esas fuentes para cotizar.

| Plan de Catálogo | Mensual ARS | Equivalente mensual con anual ARS | Pago anual anticipado ARS | Implementación con mensual ARS | Implementación con anual ARS | Administradores | Capacitación incluida |
|---|---:|---:|---:|---:|---:|---:|---|
| Vidriera | 70.000 | 60.000 | 720.000 | 300.000 | 0 | 2 | 1 hora |
| Flujo | 90.000 | 80.000 | 960.000 | 450.000 | 0 | 4 | 2 horas |
| Pulso | 115.000 | 100.000 | 1.200.000 | 650.000 | 0 | 6 | 3 horas |

No hay un 25% uniforme de descuento en el abono de Catálogo. Se deriva de cada pareja de importes como `1 - annualMonthlyEquivalent / monthlyPrice`: aproximadamente 14,29%, 11,11% y 13,04%, respectivamente. El ahorro anual del abono es $120.000/$120.000/$180.000 frente a doce abonos al precio mensual actual constante. La implementación bonificada agrega $300.000/$450.000/$650.000 de ahorro inicial separado. Comparando el primer año completo, el ahorro total es $420.000/$570.000/$830.000. No se deben sumar porcentajes con bases distintas ni presentar este ahorro inicial de implementación como recurrente en cada renovación.

En el modelo de datos de Catálogo, `billing.annualDiscountRate` es `null` para indicar que la tasa varía por plan; los importes mensual y equivalente anual son la fuente de cálculo. `billing.setupAnnualWaived` pasa a `true`. No se duplican tasas decimales editables en los planes.

Web conserva sus dos planes, precios y 25% de descuento en el abono definidos en la decisión anterior. Sólo cambia la implementación inicial del anual, bonificada al 100%: Origen conserva $69.900 mensual, $52.425 equivalente anual y $350.000 de implementación en modalidad mensual; Web de hasta cinco páginas conserva $99.900, $74.925 y $650.000, respectivamente. Sus pagos anuales completos son $629.100 y $899.100 y, al quedar la implementación inicial en cero con anual, esos mismos importes son el total inicial anual. No se crea una nueva escala Web de tres planes por analogía con Catálogo.

Se mantienen doce meses abonados por adelantado, precio del abono fijo durante ese período y dominio propio y renovación por separado a nombre y cargo del cliente. La comparación de ahorro usa la tarifa mensual vigente al contratar, sin proyectar futuros ajustes. La implementación continúa cobrándose completa una sola vez al comenzar con modalidad mensual. Gestudio conserva sus condiciones propias; Menú, Mesa y CRM no adquieren un anual automático.

La personalización, propuesta visual individual y dos rondas de ajustes conservan el alcance previo. Productos, imágenes, carga inicial, funciones de pedidos/caja, exclusiones y aceptación de cada instalación siguen en sus fuentes. Cada plan incluye la capacitación indicada, con agenda y modalidad acordadas; no constituye soporte ilimitado ni nuevas funciones.

## Aceptación y estado técnico

Las fuentes JSON deben reflejar exactamente las parejas de precios, implementación anual cero, cupos y minutos de la tabla. Las proyecciones deben calcular el ahorro del abono y de implementación por separado, y el total inicial debe usar el valor de implementación correspondiente a la modalidad.

La inspección de `scalaris-comercio/server/plans.mjs` previa a esta corrección encontró límites de administradores de 1/2/3. Bajo la autorización acotada para sostener los cupos comerciales, se modificaron exclusivamente esos tres límites a 2/4/6 y la prueba de aprovisionamiento en `scripts/admin-provision.test.mjs`. El alta privada ya consulta el límite en servidor y conserva el bloqueo transaccional por comercio. No se modificaron esquema, permisos, funciones de negocio ni trabajo previo de Tío Tom.

Se revisó la [evaluación del producto del 27/10](../../scalaris-comercio/docs/standard-assessment-2026-10-27.md): el cambio de cupos no altera dominios ni arquitectura. Se mantiene la excepción documentada de Node.js para este monolito existente; migrarlo a Spring Boot tendría esfuerzo y riesgo desproporcionados para ajustar una política de cantidad. PostgreSQL, aislamiento y mecanismo de autorización se conservan. No se necesita migración de base.

Aceptación local del cambio de cupos: cinco pruebas aprobadas, cero fallos y cero omitidas, ejecutadas exclusivamente contra `scalaris_catalogo_test` en loopback 16547. Cubren rechazo del rol web para aprovisionar o escribir credenciales; altas concurrentes limitadas exactamente a 2/4/6 por plan; rechazo del excedente; conservación del acceso del propietario sin sobrescritura; y validación de argumentos de la herramienta privada. Se usó el cluster local existente, sin crear bases ni aplicar migraciones. Esta aceptación no implica publicación de los límites en el VPS.

El Dockerfile incorpora `server/` dentro de la imagen y Compose no monta esas fuentes desde el host. La aplicación ya en ejecución no recarga este cambio local; su adopción requiere una entrega técnica propia. Se inspeccionaron los publicadores y la guía de releases sólo en lectura, sin ejecutar despliegues, migraciones ni acceso al VPS. Antes de un alta real se debe comprobar que el ambiente elegido haya adoptado los cupos contratados; mientras tanto no se presenta la aceptación local como producción actualizada.

Se conserva una copia basal de cada oferta antes del ajuste para distinguir estos cambios del trabajo anterior. La generación de proyecciones, las pruebas comerciales y técnicas aplicables, la revisión visual y la publicación se registrarán en el cierre de la entrega; este documento no acredita que esas tareas posteriores hayan pasado.

## Verificación del sitio comercial

Se regeneraron Inicio, Productos, Web, Catálogo, Condiciones, consulta, propuesta, cartel y material descargable. Los blancos quedan siempre en modalidad mensual, con precio sin descuento, puesta en marcha y «Total inicial primer mes», incluso al abrir una URL anual. Los verdes muestran el equivalente mensual, doce meses anticipados, puesta en marcha en cero y ahorro del abono y del primer año separados. Se retiraron los selectores que sustituían esos importes y el aviso anterior de cupos en Proyectos.

`npm run check`: 183 pruebas aprobadas. Navegador local: escritorio de 1280×900, Catálogo a390px sin desborde y revisión de Flujo anual por $960.000, puesta en marcha $0 y ahorro del primer año $570.000. No se enviaron mensajes ni se efectuaron pagos. Se generaron once piezas, veintidós PNG y dos ZIP íntegros con nombres de la edición anual bonificada, y se revisó visualmente el flyer Flujo. La edición anterior del25% uniforme se conserva en `legacy/flyers-2026-11-05-25porciento/`; sus ZIP redirigen a los vigentes. El cierre remoto y las capturas se registran en `artifacts/ajuste-planes-2026-11-05/publicacion.json` y Scalaris Negocio.
