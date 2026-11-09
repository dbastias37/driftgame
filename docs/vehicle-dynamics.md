# Conducción, pintura y humo — prealpha.3

El objetivo es dar masa, inercia y suspensión perceptibles a los autos, tomando GTA IV como referencia de sensación. Es un modelo propio y jugable: no reproduce el solver de RAGE ni pretende homologar el comportamiento de cada automóvil real.

## Fuentes y decisiones

- [MathWorks, Vehicle Body 3DOF](https://www.mathworks.com/help/vdynblks/ref/vehiclebody3dof.html): ecuaciones de fuerza longitudinal/lateral, momento de giro, distancias a los ejes, carga y ángulos de deriva. Se usan esas relaciones generales, sin código de MathWorks.
- [Chalmers, Vehicle Dynamics Compendium (2020)](https://research.chalmers.se/publication/520229/file/520229_Fulltext.pdf): agarre combinado y sensibilidad a la carga. La implementación usa una aproximación suave y acotada, sin un ajuste completo de Pacejka ni datos medidos del neumático.
- [FunGt, guía original de handling.dat de GTA IV](https://www.gta-modding.com/iv/tutorials/handling_dat.html): referencia comunitaria de parámetros de masa, centro de gravedad, tracción, dirección y amortiguación. Describe parámetros expuestos; no es documentación oficial del motor ni prueba de su solver interno.

## Dinámica compartida

`js/vehicle-dynamics.js` trabaja en metros, segundos, newtons y kilogramos. El paso del juego/servidor es 1/60 s, dividido en subpasos de hasta 1/120 s. La vista no integra movimiento.

1. La velocidad de cada eje incluye el giro del chasis; su orientación produce el ángulo de deriva. Una curva `tanh` limita gradualmente la fuerza lateral.
2. Motor y frenos demandan fuerza longitudinal. La pareja de fuerzas del neumático se limita mediante un círculo de fricción: acelerar/frenar y doblar comparten adherencia.
3. El centro de gravedad y la aceleración transfieren carga entre ejes. La transferencia lateral y la sensibilidad a la carga reducen el agarre disponible al inclinarse. La suma de las cargas de ejes conserva el peso.
4. El momento de las fuerzas cambia la velocidad angular según la inercia del chasis. Soltar la dirección no pone a cero ese giro; la dirección también tiene una velocidad limitada.
5. Las aceleraciones longitudinal y lateral alimentan una carrocería con muelles y amortiguadores. Las cuatro ruedas mantienen sus contactos geométricos con el terreno. Las mejoras de suspensión modifican la respuesta.

Los perfiles son ajustes del juego: Skyline reparte la fuerza entre ejes; Nova, RX-7 y Fujiwara usan propulsión trasera; Yugo tracción delantera. El Nova tiene mayor inercia y recorrido de carrocería; RX-7 responde más rápido y puede sobrevirar al acelerar. Masa, centro de gravedad, rigidez y reparto no son una ficha técnica homologada.

Se conserva la lógica de cambios y el taller. Los snapshots del protocolo 2 incluyen aceleraciones y deslizamientos, necesarios para reconciliar y reproducir la predicción. Una prueba compara las configuraciones reales offline/servidor con los mismos comandos para los cinco autos, además de la prueba de restauración y repetición de snapshots.

## Velocidad +10%

Se escala una vez la fuerza de motor y los umbrales de marcha/velocidad por 1,10 y se ajusta la resistencia cuadrática inversamente. Esto mantiene el incremento también en el auto cuya velocidad final depende del equilibrio motor/resistencia. No se multiplica el tiempo de simulación, el reloj de vuelta, la gravedad ni la suspensión.

Medición automatizada: auto de serie, llano, acelerador sostenido 180 s, cambio automático, paso 1/60 s. Referencia: clase `Car` de la versión anterior conservada como fixture.

| Auto | Antes (km/h) | Ahora (km/h) | Cambio |
|---|---:|---:|---:|
| Skyline R34 | 198,00 | 217,80 | +10% |
| RX-7 RedSuns | 198,00 | 217,80 | +10% |
| Nova SS | 194,52 | 213,97 | +10% |
| Yugo Koral 55 | 145,00 | 159,50 | +10% |
| Fujiwara AE86 | 198,00 | 217,80 | +10% |

Son velocidades del juego. Una curva, una pendiente o una preparación no tiene por qué ser exactamente 10% más rápida: allí también cambian el agarre, los frenos y la transferencia de carga. Los récords TT nuevos usan `:physics-v2`; los anteriores se conservan bajo sus claves existentes.

## Pintura y migración

El garaje ofrece original, siete colores y un selector personalizado. Se guarda `paintColor` por auto en el perfil existente, gratis. Máscaras específicas de cada atlas recolorean la chapa y conservan ruedas, vidrios, luces y gráficos. Los materiales y mapas pintados pertenecen a cada instancia; al cambiar de modelo se liberan y se restauran los originales para su disposición normal. La atmósfera conserva instancias `Color` después de clonar materiales.

Se retira el C’Maro de los catálogos local/online. Sus niveles se combinan con los del Nova usando el máximo por pieza; no se suman niveles ni se inventan créditos. Las preferencias se migran del índice antiguo al ID del modelo. Las partidas guardadas, misiones y dinero siguen disponibles.

## Humo

Las partículas nacen en los contactos de las ruedas que derrapan o patinan, con separación interpolada durante el movimiento. Tienen velocidad, elevación, tamaño, giro y opacidad individuales. Se expanden y desvanecen en 2,1–3 s. El volumen cosmético modifica tamaño/densidad sin ampliar los límites de memoria.

La vista usa una malla de quads con textura nubosa determinista, ordenación por distancia, transparencia y buffers reutilizados. Límite por auto: 800 partículas de simulación (480 táctil); límite visible total: 450 (120 en calidad ligera/render compatible). El modo compatible interpreta también el alfa del color de vértice. Los rivales online producen humo a partir del deslizamiento recibido.

## Verificación y límites

`npm run test:core` cubre la velocidad medida, conservación de cargas, disipación de energía pasiva, frenado sin propulsión inversa, inercia, agarre combinado, equivalencia 30/60/120 Hz, suspensión, predicción, pintura, migraciones y emisión/vida del humo, además de las regresiones del juego. La revisión de navegador comprueba garaje, pintura persistente, materiales y conducción con humo.

La revisión visual disponible usa render compatible sin WebGL. Falta medir FPS en GPU y probar el tacto en teléfono físico. No hay neumáticos deformables, desgaste térmico, colisiones entre autos, deformación de carrocerías ni suspensión física completa de seis grados de libertad. El balance final de cada auto y de los objetivos de campaña requiere partidas humanas.
