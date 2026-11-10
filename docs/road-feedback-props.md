# Vibración, vectores PSX y neumáticos — prealpha.7

## Controles

**Ajustes → Cámara** tiene dos intensidades de 0–200%: auto/ruedas (65% inicial) y cámara (35% inicial). Se guardan por separado. Cero desactiva el efecto correspondiente y Movimiento reducido desactiva ambos, además de los vectores de velocidad. Los ajustes se pueden probar en la vista en vivo y desde la pausa.

La vibración es visual: crece progresivamente con la velocidad, desaparece al detenerse o caer y se congela con la pausa. Mezcla dos oscilaciones pequeñas con fases distintas para las cuatro ruedas. A 100% su desplazamiento máximo de carrocería es 11 mm y el giro de cámara no supera 0,115°. No modifica dirección, adherencia, contactos, velocidad ni reloj. Las cámaras montadas toman primero la suspensión física; no heredan la vibración visual del auto cuando su propio control está a cero.

## Render

Los vectores sustituyen por completo el dibujo de líneas sobre el Canvas del HUD. Son triángulos afilados dentro de la escena, con prueba de profundidad: autos y objetos cercanos pueden ocultarlos. Comparten resolución, cuantización de color, temblor de vértices y CRT del render PSX. Se conservan origen desde el auto/centro, apagado e intensidad.

El polvo flota dentro del volumen de los faroles encendidos, solo cerca de la cámara. Tiene brillo cálido, tamaño pequeño y movimiento lento; la lluvia reduce su presencia. No agrega luces dinámicas. Límites: 56 vectores (34 en calidad ligera), 224 motas en un buffer fijo y 12 motas por farol en calidad ligera. Las posiciones y colores se reutilizan sin crear geometría por fotograma.

## Obstáculos

Hay hasta nueve neumáticos sueltos en tres curvas separadas de cada circuito o descenso predefinido y en Mercado Ocho. Se colocan junto al borde exterior, lejos de la salida y sin cerrar la trazada. Los circuitos personalizados se conservan tal como fueron dibujados. Online mantiene sus obstáculos actuales para conservar la simulación del servidor.

El contacto usa el mismo cálculo de impulso y punto de impacto de los conos, con material propio: masa 10 kg, radio 0,42 m, fricción 0,54 y restitución 0,32. Los neumáticos reciben fuerza, transmiten una pequeña reacción al auto, giran, saltan, se deslizan y reposan; también chocan entre ellos. En montaña se actualiza su altura respecto al terreno. El barrido entre pasos evita atravesarlos a alta velocidad y descarta trayectos de recuperación/teletransporte.

El primer golpe descuenta 100 puntos, rompe el combo y cuenta como impacto en el objetivo de vuelta limpia. Empujarlo de nuevo no repite la penalización. El aviso aparece en el HUD. Pausar los congela; reiniciar repone los obstáculos. La repetición de carreras conserva sus posiciones y giros mediante canales acotados: nueve neumáticos y tres autos ocupan menos de 7,6 MB para diez minutos. Entrenamiento conserva su exclusión de repeticiones, porque los conos no se graban.

Los récords de contrarreloj con neumáticos usan `:tyres-v1`, para separarlos de vueltas anteriores sin estos obstáculos. No se borran registros ni progreso.

## Validación

- 176 pruebas de núcleo. Incluyen intensidad, cero, movimiento reducido, independencia de cámaras montadas, no acumulación de offsets, profundidad real de los vectores, buffers de polvo, colocación en los 40 trazados, impulso, penalización única, descanso, terrenos inclinados, barrido rápido, pausa, recuperación, reinicio y repetición.
- Auditoría de 40 carreras: veinte circuitos en seco y lluvia, tres rivales, colisiones y 356 neumáticos colocados en total. Las 40 terminan; los pilotos evitan estos obstáculos en sus trazadas de validación. Los impactos se verifican aparte con pruebas dirigidas.
- Revisión en navegador: guardado tras recarga, controles a cero, movimiento reducido, escena nocturna, vectores pixelados y conducción en Mercado Ocho. El entorno usa render compatible por software; no se atribuye una cifra de FPS a hardware WebGL real.

## Referencias de implementación

- [Three.js: BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html): atributos de posición/color reutilizables.
- [Three.js: InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): geometría compartida de los neumáticos con matrices independientes.
- [Robert Nystrom: Object Pool](https://gameprogrammingpatterns.com/object-pool.html): mantener acotada y reutilizar la memoria de efectos frecuentes.

Los valores de vibración son un ajuste visual del juego, no una medición de suspensión de un auto real.
