# DR1FT · Carreteras, climas y Summit

Versión **1.0.0-prealpha.18** · 11 de noviembre de 2026.

## Contenido

- 20 carreteras nuevas de 7.9 a 11.0 km, cinco por clima: despejado, lluvia, bruma y nieve.
- Desniveles, cambios de peralte, puentes, túneles con pendiente y sectores identificables. Carrera de 4/5 vueltas y contrarreloj.
- Cámara de seguimiento con acercamiento gradual del 20 % al túnel, conservando objetivo, dirección, FOV y suavizado. Las cámaras montadas mantienen sus posiciones.
- Árboles `tree4` y `tree6` del FBX suministrado: geometría original cercana, malla reducida a distancia, UV y texturas de hojas/corteza. Instancias agrupadas en celdas de 64 m; no se dibujan los dos niveles simultáneamente.
- Nieve ambiental y partículas suprimidas dentro de los túneles. La nieve conserva el agarre de seco; no simula hielo.
- Rivales con carril estable, comprobación de espacio para adelantar y cambios de carril progresivos. Los ajustes se limitan a las carreteras nuevas con tráfico; no cambian las fuerzas del jugador.
- Los cinco Circuitos 2.0 anteriores vuelven al selector y conservan su clave de récord `TOURING.v1`. Se mantienen las pistas cortas, campaña, descenso, entrenamiento, multijugador, vehículos y 22 canciones del RAR.
- Bonus **Summit** accesible desde el menú principal: modelo suministrado, atlas original incrustado, giro, desplazamiento, zoom, vista aérea y controles de puntero/pellizco. Es un visor visual; no tiene conducción.

## Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| Núcleo `npm run test:core` | 230 aprobadas, 0 fallos |
| Vuelta individual, clima correspondiente | 20/20 completadas; 0 salidas y 0 impactos de barrera |
| Tráfico: jugador automatizado + 4 rivales | Rutas 1, 6, 11 y 16; todos terminan; 0 salidas y 0 impactos de barrera |
| Rayos contra carretera/terreno/estructuras | Las 20 escenas; sin huecos ni terreno sobre asfalto en las muestras |
| Diferencia máxima entre calzada y apoyo | 1.74 cm en la prueba de 20 escenas; 3,33 cm en el muestreo adicional más denso del piloto |
| Presupuesto de geometría visible | Máximo observado 144,040 triángulos, detalle ligero y distancia de 440 m; es una cota geométrica, no una medición de FPS |
| Summit | 1.205 mallas, 59.037 triángulos y un atlas PNG de 512 × 512; agrupación en 84 bloques sin alterar dimensiones |
| Arranque estático y música | Servidor local, páginas, modelos y respuesta parcial de audio comprobados |
| Visuales | Vistas aéreas producidas con el renderizador de software del juego |

Los resultados completos están en `roads-core-tests.txt`, `roads-all-laps.json`, `roads-traffic-validation.json` y `roads-touring-validation.json`.

## Límites pendientes

El ejecutor bloqueó el arranque de Chromium por permisos de sockets; el intento de ejecución fuera del aislamiento también fue rechazado por la política del entorno. **No se ejecutaron las diez pruebas Playwright**, ni se verificaron FPS WebGL, GPU, teléfono físico o sensación de conducción manual. El workflow incluye instalación de Chromium y ejecución de esas pruebas cuando se suba el código a GitHub; eso no equivale a un resultado aprobado.

Las vueltas se probaron con entradas automatizadas. La prueba con tráfico cubre una ruta por clima; no certifica todas las combinaciones de autos, dificultades y trazados. Las imágenes de software no certifican el resultado del shader de nieve en GPU.

Summit conserva el archivo recibido byte por byte. No se declara una reconstrucción visual idéntica al 100 % al juego original: la iluminación, el cielo y los contenidos ausentes del modelo no pueden comprobarse contra NFS III. White Mountain se inspeccionó como referencia (3.802 mallas, 475.043 vértices y 282.732 polígonos); no se añadió como otro circuito jugable.

## Uso

Extrae el ZIP. En Windows abre `INICIAR_WINDOWS.bat` (requiere Node.js 22 o posterior). También puedes ejecutar `npm run preview` y visitar `http://127.0.0.1:8787`. La vista local no necesita instalar paquetes. No abras `index.html` directamente con `file://`, porque los módulos y recursos necesitan HTTP.

Entra a **Jugar ahora → Carrera rápida / Contrarreloj** para elegir las carreteras. Los clásicos aparecen después del grupo Nieve. **SUMMIT · BONUS** está en el pie del menú principal.

Para el servidor multijugador o las pruebas: `npm ci`, `npm start` o `npm run test:core`, según corresponda. Para las pruebas de navegador instala Chromium con `npx playwright install chromium` y ejecuta `node --test tests/regression.cjs`.

Entrega en ZIP. No se modificó GitHub ni se desplegó en Render en esta entrega.
