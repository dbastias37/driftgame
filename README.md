# Drift Racer 0.3 — 2D + 3D

Juego de drift estático para navegador, con dos vistas intercambiables de **una misma simulación**. Mantiene cuatro autos, veinte desafíos, editor de circuitos, transmisión manual/automática y contrarreloj con fantasma local.

[Jugar en Render](https://driftgame.onrender.com)

## Jugar y ejecutar

Servir la raíz del repositorio con cualquier servidor estático, por ejemplo:

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. No necesita compilación ni instalar dependencias para jugar. `index.html` es el punto de entrada; `index_*` son versiones históricas.

- **Carrera rápida:** garaje → carrera de cinco vueltas.
- **Desafíos:** circuito desbloqueado → garaje → objetivo de puntos → siguiente desafío.
- **Contrarreloj:** garaje → vueltas libres con el fantasma del récord. «Cambiar circuito» permite elegir cualquiera de los veinte trazados.
- **Creativo:** dibujar circuito cerrado → garaje → carrera. Los códigos `TRK` y `TRK2` siguen siendo compatibles.
- **Configuración:** vista, cámara, calidad, movimiento reducido y controles táctiles automáticos/forzados.

## Controles

| Acción | Tecla |
| --- | --- |
| Acelerar / frenar | W / S o flechas arriba / abajo |
| Girar | A / D o flechas izquierda / derecha |
| Freno de mano | Espacio |
| Subir / bajar marcha manual | Shift / Control |
| **Alternar 2D / 3D** | **V** o botón Vista |
| **Cámara 3D: seguimiento / aérea / capó** | **C** o botón Cámara |
| Zoom de vista | Rueda del mouse |
| Pausar / reanudar o volver de un menú | Esc |
| Volver a la pista, gastando una vida | R durante la carrera |
| Reintentar al terminar | R |
| Mostrar / ocultar fantasma | G |
| Ayuda | H |

La ayuda pausa la conducción. Cambiar de pestaña o perder foco también pausa y libera las entradas. En móvil hay dirección, acelerador, freno, freno de mano y marchas manuales. La radio es opcional y solo se reproduce por una acción explícita.

## Una física, dos representaciones

`Car`, el paso fijo de 1/60 s, las reglas de puntuación, los cambios, las penalizaciones de salida y las puertas de vueltas se conservan. La vista 3D lee `player`, `track` y el fantasma; no integra otra física ni reinicia carreras al cambiar de vista. La escena genera el asfalto a partir de los mismos puntos, normales y ancho del circuito, incluidas las pistas dibujadas/importadas.

- `js/view3d.js`: Three.js r170, modelos geométricos de los cuatro autos, ruedas orientables, humo, huellas, cámaras y entorno. La decoración no añade colisiones a las reglas originales.
- `js/software-renderer.js`: proyección 3D con búfer de profundidad sobre Canvas para equipos sin WebGL. Reduce resolución y detalle; es más lenta que WebGL y se recomienda 2D si no resulta fluida.
- `js/experience.js`: navegación, configuración, preferencias y HUD.
- `css/experience.css`: interfaz adaptable y estilo visual.
- `vendor/`: Three.js distribuido localmente, con licencia MIT. El juego no depende de una CDN para el 3D.

Las geometrías, materiales y texturas de la pista anterior se liberan al cambiar de circuito. La calidad limita la resolución y la cantidad de árboles. Los modelos son una primera interpretación geométrica de los autos existentes, sin assets externos ni simulación de suspensión.

## Datos guardados

Se mantienen las claves `tt:*` y `challenge:*` y el formato de los fantasmas existentes. Las preferencias nuevas usan `drift:preferences:v3`. Los datos pertenecen al navegador y dominio actuales: mantener `driftgame.onrender.com` evita cambiar ese origen. Borrar datos del sitio elimina el progreso.

## Pruebas

Node.js 20.19+ (recomendado 22+). Las pruebas de simulación y render de compatibilidad no necesitan dependencias:

```sh
npm run test:core
```

Comprueban la equivalencia de una conducción de 900 pasos con cambios repetidos de vista, igualdad de la clase `Car` con 0.2, cuatro ajustes de auto, veinte circuitos, vueltas, pausa/configuración, estados finales, vidas, persistencia, fantasmas, importación y comportamiento ante fallo 3D. También construyen y renderizan la escena real con los cuatro autos y tres cámaras, comprobando que no modifica la simulación.

Suite de navegador existente (requiere Playwright y Chromium):

```sh
npm ci
npx playwright install chromium
npm test
```

Usar `CHROMIUM_EXECUTABLE=/ruta/a/chromium` para un Chromium instalado. La suite bloquea servicios externos y controla el RAF cuando necesita pasos deterministas.

### Validación de esta entrega

Pruebas de núcleo y geometría ejecutadas. Revisión de interfaz en navegador: menús, garaje, carrera, intercambio 2D/3D, pausa y tamaños de 390×844 y 844×390. El navegador de revisión no dispone de WebGL: la inspección 3D se realizó con el render de compatibilidad. Falta medir rendimiento y revisar el acabado WebGL en una GPU real y el multitáctil en un teléfono físico; la suite Playwright completa no se ejecutó en este entorno.

## Render

Sitio estático, directorio público `.` y sin paso de compilación. Mantener el servicio y dominio existentes. Publicar también `js/`, `css/`, `vendor/` y `assets/`; los `.js` deben servirse como JavaScript y no redirigirse a HTML.
