# Summit — 1.0.0-prealpha.20

## Conducción y escenario

El archivo recibido `assets/bonus/summit.glb` se mantiene sin modificar. Se reutilizan su geometría y su atlas; el soporte físico se reconstruye de sus triángulos y se integra en Track/Car, la IA, las vueltas, el cronómetro y las cámaras de DR1FT. No se atribuye un porcentaje de identidad con el juego original sin una comparación de capturas equivalente.

- 1.723 secciones transversales conectadas; circuito cerrado de 10.296,66 m.
- Ancho variable, aproximadamente 8–14,7 m; 251 m de desnivel.
- Tres pasos cubiertos con altura máxima de cámara y supresión de precipitación.
- Carrera de cuatro/cinco vueltas, contrarreloj, los cinco autos y rivales nativos.
- Carga asíncrona con carretera provisional, reintento al reabrir y cancelación al cambiar de pista.
- Mallas agrupadas por celdas para limitar las llamadas de dibujo. No se necesitan recursos remotos para el paisaje.

La reconstrucción se regenera con `python scripts/build-summit-route.py` (dependencias de desarrollo: numpy y scipy). Los datos generados ya están incluidos: Python no es necesario para jugar.

## Correcciones de altura y subidas

La suspensión tenía un suelo absoluto en Y=0, aunque las ruedas usaban la elevación real. Se conserva ese límite únicamente en los circuitos planos. En Summit y Cerro Abajo, la carrocería puede seguir alturas negativas. La animación de aproximación a la parrilla vuelve a muestrear el contacto en su posición visual.

El primer cambio entregaba solo un 22 % de la fuerza al arrancar. En pendientes fuertes esa rampa no podía vencer la gravedad. El embrague ahora se adapta a la carga de la pendiente sin exceder la fuerza disponible del motor ni el agarre de los neumáticos. Se mantienen las velocidades máximas en plano. El freno sigue reteniendo el vehículo detenido en subida.

## Nieve

Ocho estados: reposo, avance, crucero, alta velocidad, aceleración, frenada, derrape y reversa. Longitud, anchura, exposición y movimiento cambian continuamente. Se utilizan posiciones persistentes en el mundo y velocidad relativa a la cámara, con aceleración suavizada, límites de estela y reinicio en cortes/teletransportes. La pausa congela los copos y los túneles los ocultan. Se reutilizan hasta 360 quads (120 en calidad ligera); la intensidad determina cuántos se dibujan. No cambia el agarre.

## Verificación

- Núcleo: 238/238 pruebas aprobadas, incluidas las regresiones de altura negativa, arranque en pendiente y animación de salida.
- Cinco autos arrancando desde parado, tras soltar el freno, en la subida más fuerte (27,56 %).
- Carrocería y ruedas verificadas en todo el circuito, también por debajo de cero.
- Carrera automática de cinco autos con colisiones: todos completaron los 10,30 km, en 599–671 segundos simulados; desviación máxima de suspensión de 2,39 cm. Hubo tres contactos de barrera y 119 muestras fuera del asfalto entre los cinco autos. Resultado completo: `summit-drive-validation.json`, reproducible con `node scripts/validate-summit.cjs`.
- Navegador: selección de Summit, garaje, carrera, contacto del auto y aceleración revisados con el renderizador compatible. El navegador de verificación no habilita WebGL; rendimiento GPU y móviles físicos pendientes de medir.

Ejecutar localmente: `npm ci` seguido de `npm run preview`. El servicio multijugador existente se inicia con `npm start`.
