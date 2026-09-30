# Scalaris

Web estática de Scalaris: soporte informático local y desarrollo de software a medida.

## Archivos

`public/` conserva la copia portable original de HTML, CSS, JavaScript, imágenes, logos y fuentes Inter con su licencia. No necesita dependencias ni compilación. La carpeta local `imagenes/` queda fuera de Git.

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
