# Edición y recursos

## Maestros

Los 12 SVG de marca fueron copiados sin modificar desde el Brand Kit aprobado: isotipo, horizontal y vertical en cuatro variantes. Cada composición inserta una copia del contenido vectorial del maestro horizontal; no hay logos generados de nuevo. `Maestros_SHA256.json` permite verificar identidad de archivos. Facetas, franjas y ampliaciones parciales usan la geometría del símbolo.

## Qué es editable

- `03_SVG_Editables`: texto vivo editable, formas vectoriales y logo en curvas. Puede variar la interpretación de Inter entre aplicaciones; revisar al abrir. No se declara un formato nativo de Illustrator, Figma o Canva.
- `04_SVG_Reproduccion`: todo el texto está convertido en trazados. No depende de Inter, pero ya no se edita como texto.
- Fotografías ilustrativas: mapas de bits incrustados en SVG; no son objetos ni capas fotográficas editables. Los PNG originales están en Recursos. En piezas 12 y 18 se coloca la misma escena de notebook con distinta composición; en 13, la escena de armado.
- PNG: exportaciones aplanadas en sRGB. PDF A4: elementos vectoriales, sin fotografías raster.

## Tipografía

Inter, pesos 400, 500, 600 y 700. Fuente oficial: https://rsms.me/inter/ . Licencia: SIL Open Font License 1.1, https://openfontlicense.org/open-font-license-official-text/ . Los entregables no adjuntan archivos de fuentes. La marca trazada mantiene las proporciones del maestro aprobado.

## Colores y medidas

Azul noche #0B1F33; azul #145CDB; celeste #53C9F4; blanco #FFFFFF; fondo claro #EEF5FA; texto secundario #425A70; línea #CCDCE8. Verde #137E46 solo en la señal junto al CTA de WhatsApp. Márgenes laterales de 72 px en piezas de 1080 px; 15 mm en A4. El símbolo y los textos nunca se deforman para llenar un formato.

## Producción complementaria

Los scripts de `08_Fuentes_Produccion` registran cómo se construyó la colección. Requieren Python, Pillow, PyMuPDF, FontTools, lxml y ReportLab, más las instancias locales de Inter y la estructura de trabajo original. No son una aplicación autónoma lista para ejecutar; los SVG son la fuente práctica de edición. No se distribuyen credenciales ni dependencias binarias.
