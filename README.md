# Scalaris

Web estática de Scalaris: soporte informático local y desarrollo de software a medida.

Sitio público: https://scalaris.pages.dev

## Archivos

`public/` contiene la web portable de HTML, CSS, JavaScript del formulario, imágenes, logos y fuentes Inter con su licencia. No necesita dependencias ni compilación.

Fuente visual original: `Scalaris_01_Identidad_Complementos_Web_2026-09-30.zip`, carpeta `05_Web_Estatica`. La importación inicial de los 12 archivos se verificó byte por byte contra el ZIP; la portada y el formulario se mantienen ahora en este repositorio. El Site original de ChatGPT permanece independiente y sin modificaciones.

La portada prioriza la consulta guiada en la navegación, el inicio, los servicios y el contacto. En móvil, la tarjeta guiada aparece antes del WhatsApp directo. El símbolo de WhatsApp junto al número proviene de [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/whatsapp.svg).

## Verificación y vista local

```powershell
node scripts/check.mjs
python -m http.server 8080 --directory public
```

Abrir http://localhost:8080. También puede abrirse `public/index.html` directamente.

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

Contacto: [WhatsApp](https://wa.me/5491141477227), 1141477227.

## Backoffice local y formulario guiado

El backoffice Java/Spring Boot + React/TypeScript + PostgreSQL está separado en `backoffice/`. Ver [uso, configuración local/LAN, cálculos, archivos y respaldos](backoffice/README.md). No se publica en Cloudflare Pages, no tiene login y no se conecta al sitio público.

**Para abrirlo diariamente en Jeremias, hacer doble clic en Scalaris LAN del escritorio**, o ejecutar `AbrirScalaris.cmd -Mode Lan` desde `C:\laburo\Scalaris`. La [guía COMO-USAR](backoffice/COMO-USAR.md) reúne apertura, parada, actualización, pantallas reales, backups y reversión a Local. El modo LAN aprobado sirve React y API juntos en `http://192.168.1.9:8081/`; el propietario confirmó Tablero y Clientes desde su celular físico. El modo Local seguro y Vite quedan como alternativas.

La [verificación de acceso del 5/10/2026](backoffice/VERIFICATION-20261005-ACCESS.md) reúne la evidencia actual del 403, arranque cotidiano, recursos compilados, guardias de prueba y límites del acceso LAN.

La [rectificación de arquitectura y arranque del 4/10/2026](backoffice/VERIFICATION-20261004-REFACTOR.md) documenta la separación física por responsabilidades, configuración IntelliJ/scripts, diagnóstico de almacenamiento y resultados efectivos de pruebas. Los informes anteriores permanecen disponibles como evidencia histórica.

El [seguimiento de IntelliJ y Vite del 5/10/2026](backoffice/VERIFICATION-20261005-VITE.md) confirma el Run real aportado por el usuario y documenta la corrección del 403 en desarrollo, UTF-8 HTTP y la configuración Scalaris Vite.

La consulta guiada independiente está en `public/consulta/index.html`. Los enlaces de equipos y software preseleccionan el servicio. Prepara un resumen y una ficha JSON descargable; la acción principal copia el resumen y abre WhatsApp para revisarlo y pegarlo manualmente. El saludo del enlace no incluye el nombre ni el teléfono ingresados. La importación en backoffice también es manual. No persiste datos personales por defecto ni requiere servidor público.

Verificar además el formulario: `node --test scripts/public-form.test.mjs`. El comando y directorio de build de Pages permanecen iguales. Cloudflare publica únicamente `public/`; el backoffice sigue siendo una aplicación local.
