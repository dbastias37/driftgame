# Rivales, impactos, instrumentos y mandos — prealpha.5

## Rivales

Cada circuito tiene un perfil de velocidad calculado por curvatura y adherencia. Un barrido hacia atrás determina dónde empezar a frenar antes de la curva. La velocidad máxima objetivo en recta sube de 25 a 46 m/s; el motor, los cambios, la resistencia y el trazado siguen limitando la velocidad real. El margen de curva depende del vehículo y de la lluvia.

Cuando hay colisiones, los rivales buscan un lateral libre para pasar a un auto lento o detenido. La separación entre filas de parrilla es de 9 m y la maniobra a baja velocidad usa un objetivo más cercano para salir del atasco.

Gas y freno son progresivos. La banda de retención y los umbrales distintos de entrada/salida evitan alternar el pedal cada pocos fotogramas. Se mantienen las fuerzas de los autos, el cronómetro normal y las puertas de vuelta. Los rivales no se desplazan directamente sobre un carril invisible.

Comparación local, Skyline de serie, circuito Club, manejo estándar, seco, sin contacto: la vuelta pasó de **45,1 s a aproximadamente 37,3 s**, y las entradas al freno de **50 a 5**. La prueba automatizada exige menos de 40 s, hasta 8 entradas al freno y cero fotogramas fuera de pista. Son medidas de esta simulación, no una predicción del tiempo de vuelta de un jugador.

## Impactos

La intersección de cajas orientadas proporciona normal, penetración y centro de contacto. El impulso incluye la velocidad angular en ese punto y la inercia de cada carrocería. Un golpe fuera del centro produce giro, además de intercambio de velocidad. La fricción tangencial transmite parte del movimiento lateral. La restitución es baja y se anula en contactos lentos; la corrección de penetración no añade velocidad.

Se conserva el momento lineal y se comprueba que la energía cinética total (traslación más rotación) no aumente. El interruptor de colisiones de Carrera rápida sigue permitiendo atravesar a los rivales. Online conserva carreras sin contacto.

## Tablero

Dos instrumentos de aguja muestran RPM (escala ×1000) y km/h. Las lecturas numéricas y la marcha facilitan la lectura. El ralentí y el límite de vueltas dependen del modelo; el RPM se estima a partir de la velocidad, la marcha actual, el embrague y el deslizamiento. Es telemetría de presentación: no se ha añadido una simulación completa de cigüeñal/transmisión ni cambiado las fuerzas por mover la aguja.

## Mando USB

**Ajustes → Mando** muestra el dispositivo detectado, todos los botones y ejes expuestos por el navegador. Pulsar un botón después de conectar permite que el navegador lo haga visible. No se requieren permisos WebUSB ni se instalan controladores desde el juego.

Distribución estándar (incluido DualShock 4 cuando el navegador lo reconoce):

| Control | Función |
|---|---|
| Stick izquierdo | Dirección analógica |
| R2 / L2 | Acelerar / frenar progresivamente |
| Cruz / Triángulo | Drift / cámara |
| Cuadrado / Options | Reaparecer / pausa |
| R1 / L1 | Subir / bajar marcha manual |
| Cruceta / Cruz / Círculo | Navegar / seleccionar / volver en menús |

La pestaña Mando es un comprobador: las pulsaciones no accionan el auto ni cierran el menú. Zona muerta, sensibilidad, inversión, centrado del stick y asignación de botones/ejes se guardan por identificador de dispositivo. Los gatillos genéricos pueden asignarse como botones, semiejes positivos/negativos o ejes completos −1→+1 / +1→−1. El teclado y los controles táctiles siguen disponibles.

Al perder el foco o desconectarse, se anula la entrada. Es necesario soltar los controles antes de volver a activarlos. Si el mando se desconecta durante la conducción, se abre la pausa; en online el auto frena mientras el servidor continúa la carrera.

El protocolo online **4** transmite gas y freno normalizados con precisión de 0,001. Cliente y servidor integran el mismo paquete; los datos se validan antes de usarlos. Versiones anteriores deben recargar.

## Validación y límites

`npm run test:core`: **155 pruebas aprobadas**. `node scripts/validate-rivals.mjs`: los tres rivales completan las **40 carreras** (20 pistas, seco y lluvia, colisiones activadas y jugador detenido en la salida).

Se prueban entradas PS4 estándar y USB genéricas simuladas, gatillos proporcionales, calibración persistente, pérdida de foco, desconexión, selección de dispositivo, pruebas visuales de botones/ejes y coincidencia exacta cliente/servidor. Se verifica giro por impactos laterales para los cinco autos, choques centrados sin giro artificial y contactos estáticos sin energía añadida.

La revisión de navegador comprueba el tablero y el estado sin mando. Este entorno no tiene un mando USB físico: la compatibilidad final depende de que el sistema operativo y el navegador expongan ese dispositivo mediante Gamepad API.

Referencias primarias: [W3C Gamepad](https://www.w3.org/TR/gamepad/) para distribución estándar, ejes y botones; [Box2D — Simulation](https://box2d.org/documentation/md_simulation.html) para el tratamiento de contactos, impulsos, fricción e inercia. La implementación de fuerzas de Driftgame sigue siendo propia, sin añadir Box2D como dependencia.
