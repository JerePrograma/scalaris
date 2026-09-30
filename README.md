# Scalaris

Web estática de Scalaris: soporte informático local y desarrollo de software a medida.

Sitio público: https://scalaris.pages.dev

## Archivos

`public/` conserva la copia portable original de HTML, CSS, JavaScript, imágenes, logos y fuentes Inter con su licencia. No necesita dependencias ni compilación. La carpeta local `imagenes/` queda fuera de Git.

Fuente: `Scalaris_01_Identidad_Complementos_Web_2026-09-30.zip`, carpeta `05_Web_Estatica`. Los 12 archivos de la web se verificaron byte por byte contra el ZIP. El Site original de ChatGPT permanece independiente y sin modificaciones.

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

Contacto: [WhatsApp](https://wa.me/5492291402230), 2291402230.
