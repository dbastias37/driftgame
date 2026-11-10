# Gravilla y agua — prealpha.17

## Comportamiento

La franja de escape situada después del piano produce piedras pequeñas y polvo desde cada rueda que la pisa. La velocidad, el deslizamiento lateral, el freno, el freno de mano y una desaceleración brusca aumentan la emisión. También funciona marcha atrás. El pasto y el asfalto seco no producen piedras, y un auto detenido no mantiene una nube artificial.

Con **Lluvia** o **Lluvia intensa**, las ruedas levantan gotas estiradas en la dirección de su movimiento y una bruma fina, aunque el auto circule recto. La lluvia reduce el polvo y el humo de neumáticos. El color del agua no depende del color de humo comprado en el taller. No se agregan charcos falsos ni objetos de gravilla permanentes.

Las ruedas consultan la superficie dibujada: asfalto hasta 0,16 m después del semiancho; piano hasta 0,86 m; gravilla hasta 4 m en los circuitos planos, 1,3 m en descenso y el borde de 15,8 m de la plataforma de Circuitos 2.0. Se usa distancia exacta a segmentos, incluida la unión de caminos que se cruzan. Los puentes y túneles de Circuitos 2.0 tienen hombros de hormigón; dentro del túnel no se generan gotas nuevas. Las partículas ya emitidas se disipan por su vida limitada.

Las piedras tienen caras, rotación, gravedad, un rebote y desaparición gradual. Las gotas terminan al tocar el piso. Polvo y bruma se expanden y disipan, con velocidades distintas. La colisión consulta la superficie real cerca del suelo para respetar altura, peralte y piano; en vuelo utiliza una aproximación local de la pendiente. No son cuerpos físicos capaces de golpear un auto.

## Integración y límites

- `road-contact.js`: clasificación de superficie con caché espacial para circuitos planos; reutiliza los muestreadores de montaña. No modifica fuerzas ni adherencia.
- `wheel-particles.js`: efectos por rueda, generador aleatorio independiente y objetos reutilizados. Tope de 384 partículas por auto; 192 en dispositivos táctiles y en repetición. Los circuitos grandes no aumentan este límite.
- `wheel-particles-renderer.js`: dos mallas para todos los autos. Máximo de 420 partículas detalladas y 192 suaves en calidad normal; 140 y 64 en calidad ligera. Descarte a 110/65 m. Los buffers se crean una vez, no una malla por piedra.
- Los rivales online usan el clima de la sala. El servidor y la reconciliación no generan estos efectos ni transmiten partículas por la red.
- Las repeticiones reconstruyen una ventana visual de dos segundos desde las poses guardadas. Pausar congela las partículas; retroceder o saltar reconstruye la estela sin ejecutar física ni aumentar el tamaño de la grabación. No es una copia exacta de cada piedra de la carrera original.
- Recuperación, cambio de pista y caída reinician el emisor para evitar estelas que atraviesen el mapa.

## Validación

Las pruebas cubren límites de superficie, cruces, segmentos importados largos, ruedas de un solo lado, marcha atrás, frenado, lluvia en línea recta, reducción de polvo mojado, límites/reutilización, aterrizaje, recuperación, túneles, puentes, pendientes, repetición y conservación de la trayectoria cliente/servidor. El renderizado repetido no cambia el estado de los autos ni de los efectos.

Medición local de CPU del emisor con tres autos a 126 km/h, lluvia intensa y freno de mano sobre la franja de una ruta con desniveles: 2.400 pasos a 60 Hz; mediana 0,44 ms, percentil 95 de 0,71 ms y percentil 99 de 1,07 ms por paso para los tres autos juntos. Se excluyeron 120 pasos de calentamiento. Es una medición de este entorno, no una promesa de FPS para teléfonos.

Inspección visual en navegador mediante el renderizador de compatibilidad: gravilla en un lado, gotas/bruma con lluvia, desnivel y túnel seco. Este navegador no ofrece WebGL; el rendimiento GPU y la sensación en un Android físico quedan por verificar. Los controles especiales para la revisión están solo en el archivo temporal de QA y no se publican.

[Captura de gravilla](wheel-gravel.png) · [Captura de gotas y bruma](wheel-water.png).

## Referencias de implementación

- [Three.js: actualización de geometrías y buffers preasignados](https://threejs.org/manual/pages/how-to-update-things.html).
- [Three.js: BufferGeometry y drawRange](https://threejs.org/docs/pages/BufferGeometry.html).
- [Three.js: BufferAttribute y DynamicDrawUsage](https://threejs.org/docs/pages/BufferAttribute.html).

Se aplican esos mecanismos al Three.js incluido en el repositorio, manteniendo el renderizador de compatibilidad. La calibración de las partículas es una decisión visual de DriftGame, no una simulación hidráulica ni geotécnica.
