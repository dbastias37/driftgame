# Entrenamiento, letras y salida — prealpha.6

## Cambios visibles

- Fuente propia **Drift Display Heavy**, derivada de Anton (SIL OFL). Tiene proporciones condensadas y trazos gruesos; rasterización base de 48 px, espaciado proporcional y bordes escalonados. Reemplaza la fuente de celdas pequeñas en menús, pausa, controles, marcador, tablero y letreros 3D. La fuente WOFF está incorporada en CSS y se carga antes de dibujar carteles en Canvas. Texto descriptivo usa una sans de lectura. Licencias en `assets/fonts/Anton-OFL.txt` y `assets/fonts/LICENSE.txt`.
- La lluvia usa el tiempo acumulado de presentación y carrera, independiente del cronómetro competitivo. Desde la primera escena, avanza con la simulación; la pausa detiene ambos tiempos y no recupera tiempo perdido al reanudar.
- Parrilla desplazada 4 m detrás de la línea, también en las reglas online compartidas. Carrera rápida y entrenamiento presentan cuatro segundos de avance a posición y dos de espera y transición a seguimiento 3D. Después muestran 3, 2, 1, ¡YA! Durante la cuenta, teclado, táctil y mando permiten subir RPM sin desplazar el auto. El cronómetro se inicia con YA. Online conserva su cuenta autoritativa sincronizada.
- Demanda de balanceo y cabeceo de carrocería aumentada un 24%, con límites de recorrido y muelles algo más suaves. Contactos de rueda, masa, velocidad y adherencia mantienen sus reglas. La respuesta vuelve al reposo sin oscilación persistente.

## Mercado Ocho

Un estacionamiento plano de 248 × 196 m con bolsillos de entrada, supermercado, ventanales, puertas, canopy, equipos de techo, siete faroles iluminados, arbustos en jardineras y dos barreras de brazo automático. Las luces responden al control día/noche. Los puestos y flechas son pintura; no cortan las vueltas.

El recorrido en ocho tiene siete metros de semiancho, 134 conos y un cruce central despejado. Una abertura comunica con el área libre. Ocho puertas ordenadas cuentan vueltas e impiden sumar por tomar un atajo en el cruce. La práctica es independiente de campaña/economía, sin límite de tiempo ni vidas. R devuelve al trazado sin retirar puntos; Reiniciar restaura conos y marcador. La repetición está deshabilitada aquí porque aún no registra objetos dinámicos.

Cada cono representa una pieza ligera de 3,8 kg, con base de 0,72 m y altura de 0,82 m, fricción 0,68 y restitución 0,18. Son parámetros de jugabilidad, no mediciones de un producto real. El contacto con la carrocería transmite impulso lineal y angular; una parte de la energía horizontal produce el salto. Los conos chocan entre sí, caen por gravedad, rebotan, rozan el suelo y finalmente reposan. Derribarlos descuenta 100 puntos una sola vez por cono, incluso si cae por el impacto de otro. El marcador puede ser negativo. Un roce leve puede desplazar un cono sin derribarlo.

Los contactos del vehículo se subdividen y recorren el desplazamiento entre ticks para no saltarse conos ni paredes del estacionamiento. Curbs, jardineras, bases y brazos bajados son sólidos. Los brazos se levantan al aproximarse y bajan al alejarse. Los límites laterales cierran también los bolsillos de salida.

## Coste y validación

El escenario estático se agrupa por material y región; los conos usan tres mallas instanciadas con buffers reutilizados. Las luces usan manchas y halos de luz sin añadir siete sombras dinámicas. Los objetos dormidos no integran gravedad.

- `npm run test:core`: 167 pruebas, incluyendo parrilla, tiempo de salida, acelerador retenido, pausa, reloj de lluvia, suspensión, colisiones de conos, impulsos secundarios, penalización única, barreras, límites a alta velocidad, vueltas y render de objetos dinámicos.
- `node scripts/validate-rivals.mjs`: 40/40 carreras completadas por los tres rivales, veinte circuitos en seco y lluvia, con colisiones activas.
- Revisión interactiva de menú, mapa, zoom, garaje, salida, conducción, conos y pausa en navegador con render compatible por software. El entorno de revisión no expone GPU WebGL ni un mando USB físico.

Generación reproducible de la fuente: descargar `Anton-Regular.ttf` de Google Fonts y ejecutar `python3 scripts/build-display-font.py /ruta/Anton-Regular.ttf`. Se conserva el copyright y la licencia originales; la derivación tiene un nombre de familia diferente.
