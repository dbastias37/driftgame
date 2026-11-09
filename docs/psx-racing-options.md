# Presentación PSX y carreras — prealpha.4

## Opciones

- **Carrera:** manejo Asistido / Estándar / Experto; 0–3 rivales locales en Carrera rápida; colisiones independientes, junto al selector de rivales. Los cambios de condiciones se aplican a la siguiente salida o reinicio. Se guardan en las preferencias existentes.
- **PSX:** presets Limpio, Equilibrado (480 líneas) y Clásico (240); resolución 240/360/480/720/pantalla; precisión de vértices, UV afín, RGB555 de 15 bits, RGB565 de 16 bits, RGB332 de 8 bits, 24 bits, dithering y CRT. La fuente pixelada, las paletas, los paneles y el CRT cubren también portada, menús, pausa, taller, HUD y repetición.
- **Clima:** despejado, nublado, niebla, lluvia y lluvia intensa, combinados con el control horario. La lluvia reduce el límite de fuerza de neumáticos, oscurece el asfalto y cambia su rugosidad; no acelera ni ralentiza el reloj. Niebla y lluvia reducen la distancia visible.
- **Cámara:** seguimiento, aérea, capó, ambos tapabarros, parachoques, mirada trasera, dron, TV fija y realización. C recorre las diez. La rueda del mouse conserva un ajuste separado para cada cámara; las montadas cambian el campo visual, las exteriores la distancia y TV fija su focal.
- **Mapa:** arrastrar desplaza; Shift o botón derecho + arrastrar gira en dos ejes; rueda acerca/aleja. En pantallas táctiles dos dedos permiten desplazar y acercar. Flechas, Shift + flechas, +/− y Home ofrecen control con teclado. «Centrar» restablece encuadre y zoom.

Los rivales recorren la geometría real con anticipación de curva, control de velocidad y las mismas fuerzas y condiciones del jugador. Completan puertas de vuelta en orden. Con colisiones se separan las cajas orientadas y se intercambian impulsos según masa; el impacto disipa energía. No hay daños de carrocería. Online conserva su modalidad sin contacto y el anfitrión elige manejo y clima comunes.

La salida de Carrera rápida muestra los autos avanzando hasta su casilla durante 2,4 segundos, con tres tomas, seguida de 3, 2, 1 y «¡YA!». Las posiciones animadas son copias de presentación: las fuerzas y el cronómetro arrancan al terminar la cuenta. Las vueltas, clasificación y repetición incluyen a los rivales.

## Correcciones

- `Texture.clone()` comparte `Source` en Three.js. La textura pintada ahora usa `new Source(canvas)`: conserva el atlas original para sucesivos repintados y no modifica las texturas de los otros autos. El color original se puede restaurar.
- Se separan los triángulos de ventanas del atlas del Nova y se aplica un material translúcido independiente. El Skyline deja de multiplicar el vidrio por su atlas oscuro. Los cristales no escriben profundidad y no entran en la máscara de pintura.
- El freno de mano pasa de 0 a 1 en unos 167 ms y se libera en 83 ms. Se reduce la demanda longitudinal trasera y se mantiene más agarre lateral durante su uso. El balanceo, la masa y el aumento de velocidad de 10% de prealpha.3 continúan activos.
- Récords TT nuevos: `physics-v3`, separados por manejo/clima y preparación. Se conservan los registros anteriores. Protocolo online 3 incluye la mezcla progresiva del freno de mano para reconciliación idéntica; clientes antiguos deben recargar.

## Render y rendimiento

El shader modifica XY de la posición proyectada y mantiene Z/W para evitar grietas de profundidad en pista y pianos. UV afín se reconstruye interpolando UV×W y W, con mezcla configurable. Un solo pase final aplica resolución, tone mapping, color, dithering y curvatura. El CRT de líneas y máscara cubre también la interfaz. Se conserva el depth buffer: es una interpretación visual, no un emulador del orden de polígonos de la consola.

En modo compatible CPU se reutilizan vértices transformados/proyectados, normales, tablas de color y mapas CRT; se omiten triángulos subpíxel. Los puntos de transparencias se copian antes de reutilizar geometría instanciada. Lluvia y humo usan buffers acotados. La resolución automática responde a carga sostenida; las vistas ocultas no se dibujan. La exhibición y el garaje pueden actualizar a 60 Hz con GPU y tienen un límite de trabajo menor en render compatible.

Medición local orientativa con Node, 600×400, tres Skyline reales, sin carga de red; mediana de 30 imágenes tras calentamiento. Se usa la misma escena y cámara; el render nuevo incluye el preset PSX equilibrado. Las texturas del banco usan datos sintéticos, por lo que no representa un benchmark de navegador ni garantiza FPS en otros dispositivos.

| Cámara | prealpha.3 | prealpha.4 |
|---|---:|---:|
| Seguimiento | 211,0 ms | 87,0 ms |
| Cinemática | 164,9 ms | 73,7 ms |

Reproducir: `node scripts/benchmark-renderer.mjs /ruta/al/checkout psx` (omitir `psx` para el render limpio).

## Verificación

- `npm run test:core`: **144 pruebas**. Incluye matriz cliente/servidor de 3 manejos × 5 climas, vueltas completas secas/mojadas en circuitos 1/8/20, cuenta regresiva sin movimiento de física, impulso/conservación de momento, colisiones desactivadas, repintado consecutivo y protección del atlas, cristales reales, zoom en diez cámaras, mapa y lluvia.
- Shaders Basic y Standard con texturas, instancias/flat shading y niebla, más postproceso, compilados con OpenGL EGL/llvmpipe. Preparación: `node scripts/prepare-retro-shaders.mjs /tmp/drift-glsl`; validación opcional con Python y moderngl: `python scripts/validate-retro-shaders.py /tmp/drift-glsl`.
- Revisión visual en navegador: portada, ajustes guardados, PSX/bit depth, lluvia/día, desplazamiento/zoom/recentrado de mapa, Nova rojo → verde → blanco, parrilla de cuatro, conducción, pausa y cámara de tapabarro.
- El navegador remoto no ofrece WebGL. La revisión visual usa el render compatible; falta una medición en GPU de escritorio y teléfono reales.

## Referencias

- [Sony — Net Yaroze Startup Guide](https://www.psxdev.net/downloads/Net%20Yaroze%20Official%20-%20Startup%20Guide.pdf): modos de imagen y texturas. Los modos de textura de 4/8 bits no describen la «potencia en bits» de toda la imagen.
- [PSX-SPX — GPU](https://psx-spx.consoledev.net/dev/ps1/gpu/misc/): UV sin corrección de perspectiva, coordenadas enteras y matriz de dithering. El modo nativo que se aproxima aquí es RGB555; 8/16/24 bits son opciones artísticas adicionales. CRT representa la pantalla, no el hardware de rasterización.
- [Three.js — Material](https://threejs.org/docs/pages/Material.html): extensión mediante `onBeforeCompile`. Three.js r170 está fijado en `vendor/`.
- La fuente **Drift Pixel** deriva de DejaVu Sans Mono; licencia incluida en `assets/fonts/LICENSE.txt`. `scripts/build-pixel-font.py` genera contornos sobre una cuadrícula de píxeles; no requiere servicios externos en ejecución.
