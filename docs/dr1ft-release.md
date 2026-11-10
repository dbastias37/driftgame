# DR1FT — prealpha.8

## Identidad y puntuación

La portada, los menús, los créditos, el garaje y los letreros del circuito usan DR1FT. La marca conserva la fuente gruesa y el tratamiento PSX de la interfaz. Los mensajes de derrape, multiplicadores, rachas, objetivos y resultados están en español; las cifras de puntos usan formato chileno.

Las claves de progreso, compras, pintura y ajustes siguen siendo las mismas. El cambio de nombre no reinicia la partida.

## Presentación

La exhibición alterna tomas de siete segundos: dron, tapabarro izquierdo, curva fija, mirada trasera, capó, dron, tapabarro derecho, parachoques y vista aérea. Las cámaras montadas siguen los anclajes del modelo y la suspensión; capó y parachoques ocultan la carrocería propia para evitar obstrucciones. Las tomas exteriores la vuelven a mostrar. El modo de movimiento reducido mantiene la vista aérea estable.

El montaje usa el reloj de la exhibición y se congela al pausar. La secuencia de posicionamiento y cuenta regresiva de carrera conserva su duración.

## Suelo estable con efectos PSX

El terreno verde se recorta alrededor de la huella completa del circuito, incluidos bordes y escapatoria. Ya no existe un plano verde bajo el asfalto que compita por profundidad cuando los vértices se ajustan a la cuadrícula PSX. Terreno y escapatoria comparten exactamente los mismos vértices y altura en la unión.

En los descensos, la pintura central y el asfalto son regiones adyacentes a igual altura. También se elimina el solapamiento entre el estacionamiento y el acceso del supermercado. Se conserva el temblor de vértices y la deformación de texturas configurables; no se cambia el contacto físico de los autos con la carretera.

## Pilas de neumáticos

Cada curva seleccionada tiene tres pilas, de 3, 4 y 5 neumáticos. Se colocan hasta tres grupos por trazado, con un máximo de 36 unidades. El grupo se desplaza hacia fuera cuando una curva cerrada necesita más espacio. Los neumáticos no bloquean la línea normal de carrera.

Una pila intacta recibe el impacto con su masa conjunta: 30, 40 o 50 kg. Después libera neumáticos de 10 kg que reciben impulso, giran, rebotan, rozan el suelo y chocan con otras unidades. Pueden derribar una pila vecina. Cada pila golpeada descuenta 100 puntos una sola vez; los golpes posteriores a sus unidades no repiten la penalización.

Las pilas intactas y las unidades asentadas quedan en reposo. El dibujo usa una sola malla con instancias. La repetición captura las 36 unidades, incluidas posición, altura y rotación; los récords nuevos de contrarreloj usan `:tyres-v2` para separar esta disposición de obstáculos.

## Validación

- 183 pruebas de núcleo aprobadas, incluidas uniones del suelo en los veinte circuitos, cruces y horquillas personalizados, pintura de descensos y cámara baja con temblor PSX.
- Pruebas de las ocho cámaras, restauración de carrocería, pausa y continuidad de la exhibición.
- Pruebas de pilas estables, impulso acotado por la masa, choques en cadena, penalización única, 36 instancias y grabación/interpolación del último neumático.
- 40 carreras simuladas con tres rivales, obstáculos y condiciones de seco/lluvia: todos los rivales terminan.
- Revisión visual en navegador mediante el render compatible. No equivale a una medición de FPS ni a una validación en GPU o teléfono físico.
