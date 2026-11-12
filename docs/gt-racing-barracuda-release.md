# DR1FT 1.0.0-prealpha.23

Base de este paquete: `main`, commit `c7de412f36bc0983e40d665960223a8e6335e483`.

## Cambios

- Colección **GT Racing 2** en Carrera rápida y Contrarreloj, separada de NFS III Especial, Carreteras y Clásicos.
- **Glen Canyon Dam**: vuelta cerrada de 3.131,53 m sobre el asfalto del modelo, alturas y contactos extraídos de sus triángulos. El trazado utiliza el desvío existente para evitar los buses estacionados. Caminos secundarios y objetos originales conservados.
- GLB de 19.039.016 bytes: geometría y resolución de las 21 texturas conservadas. Imágenes opacas recompresas a JPEG calidad 92; transparencias conservadas en PNG.
- **Plymouth Barracuda 1970**, sexto vehículo: modelo original, cuatro ruedas animadas, faros, luces de freno, pintura selectiva, configuración de conducción V8 pesada y tracción trasera. Compatible con garaje, carrera, rivales, fantasmas, taller y guardado por vehículo.
- Pino del archivo recibido, con texturas y dos niveles de detalle, sustituyendo árboles procedurales en circuitos cortos, montaña y entrenamiento. Los dos árboles FBX existentes coinciden con el segundo ZIP y se mantienen.
- Un derrape terminado normalmente muestra **DERRAPE COMPLETADO** y sus puntos. Choques y salidas muestran **RACHA PERDIDA**. Las reglas de acumulación de puntuación se mantienen.
- Música arriba a la derecha; créditos monetarios del garaje más grandes; estilos compartidos entre menús.
- Protocolo online 6 para el sexto vehículo y el resultado del derrape. Cliente y servidor deben actualizarse juntos.

## Instalación manual

Descomprimir el ZIP y copiar su contenido en la raíz del repositorio, conservando las carpetas y reemplazando los archivos existentes. El ZIP contiene solo archivos añadidos o modificados respecto de la base indicada; no incluye el repositorio completo, dependencias, archivos originales de importación ni credenciales. No hay archivos que deban borrarse.

Subir los archivos extraídos, no el ZIP como archivo del juego. Después del despliegue, recargar con Ctrl+F5. Esta entrega no publica cambios en GitHub ni Render.

## Comprobaciones y límites

`npm run test:core`: **267 pruebas aprobadas, 0 fallidas**. Sintaxis de JavaScript, referencias locales y `git diff --check` correctos.

- Muestreo del trazado cada 3 m: cero puntos sin piso y cero contactos con obstáculos en la línea; error máximo de altura 0,0116 m.
- Skyline, RX-7 y Barracuda completan una vuelta más 40 m mediante el controlador de rivales, sin salidas ni impactos contra el escenario.
- Pruebas del modelo, ruedas, marcha atrás, luces, pintura, carga asíncrona, guardados, menú y resultados de derrape.
- Verificación visual en navegador del selector GT Racing 2, paisaje, garaje del Barracuda, carrera y pausa con el renderizador compatible.
- WebGL no está disponible en el navegador de esta sesión; no se midió rendimiento GPU ni se probó en un teléfono físico. La suite de navegador Playwright no pudo ejecutarse porque su Chromium no está instalado; la validación visual se realizó con el navegador disponible.

## Atribuciones

Glen Canyon Dam: modelo publicado por **amogusstrikesback2**, GT Racing 2 (Gameloft), licencia **CC BY 4.0** según los metadatos incluidos en el GLB. Fuente: https://sketchfab.com/3d-models/gt-racing-2-glen-canyon-dam-194f8a8c465f4e578ef45e3a4cc3932a . Se adaptaron trazado, colisiones y compresión de imágenes.

Barracuda y vegetación: archivos aportados por el usuario; sus archivos no identifican de manera fiable al autor original. No se les asignó una autoría o licencia inventada. Los créditos del juego conservan esta distinción.
