# 0.5.0 — Pista limpia, render por zonas y día/noche

- Terreno de montaña recortado alrededor de la pista, sin superficies sobrepuestas. Planos de cámara ajustados en el reconocimiento aéreo.
- Mallas agrupadas por material/zona, vegetación por sectores y descarte tras niebla opaca. Cumbre pasa de 3.198 a 601 mallas de escenario antes de añadir farolas. Caché de alturas de huellas, búsqueda de terreno lejano reducida y resolución automática gradual.
- Barra persistente día/atardecer/noche; cielo, ambiente y niebla sincronizados. Farolas con halos y luz sobre el terreno; faros transparentes con una sola luz dinámica, sin sombras ni postprocesado.
- Fujiwara integrado como sexto auto con texturas originales, cuatro ruedas, apoyo independiente, huellas y humo alineados. Mecánicas de los cinco anteriores intactas.
- 59 pruebas de física, menús, geometría, modelos y render. Revisión visual en navegador compatible; rendimiento GPU/dispositivo real pendiente.

# 0.4.0 — Cerro abajo y Yugo Koral 55

- Nuevo challenge de sprint: tres descensos abiertos con altura real, horquillas, ladera, barrancos, guardarraíles parciales, salida y meta separadas.
- Reconocimiento aéreo y selección final en el garaje; HUD de 0 a 100%, objetivo de puntos, pendiente y distancia restante. Victoria solo al cruzar la meta con el puntaje requerido.
- Gravedad sobre pendiente, inercia de la masa al frenar, apoyo independiente de ruedas, suspensión y balanceo. Física exclusiva del descenso: los circuitos anteriores conservan su comportamiento.
- Caída y vuelco mediante impulsos de contacto e inercia de caja; recuperación con R o botón táctil al último punto seguro. Tres vidas y recuperación automática tras 4,5 segundos de caída.
- Progreso continuo validado y puntos solo sobre avance nuevo; no se puede llegar a la meta por un barranco ni repetir un tramo para acumular su puntaje.
- Récords independientes por descenso. Render compatible con colores por vértice y cámaras adaptadas a la elevación y las caídas.
- Nuevo quinto auto: Yugo Koral 55 retopologizado, atlas pixelado propio de 512×512, cuatro ruedas independientes y sprite 2D del mismo modelo. Mantiene los cuatro autos anteriores.
- Ajuste exclusivo de 790 kg y cinco marchas; prueba en llano de ≈145 km/h y 0–100 en 18 s. Estadísticas visibles en el garaje y dimensiones propias durante las caídas.
- 51 regresiones de física, flujo, geometría y render. Inspección en navegador compatible; GPU real, teléfono físico y ajuste final de dificultad mediante partidas humanas pendientes.

# 0.3.4 — Reconocimiento del circuito y garaje 3D

- Preparación unificada: elegir/previsualizar la pista → elegir auto en el garaje → correr. Incluye carrera, contrarreloj, desafíos, editor, importación y enlaces compartidos.
- Garaje 3D original con paredes claras, hormigón, luces de techo, ventanas, portón y tarima giratoria. Se muestran los cuatro modelos reales, incluido el RX-7, junto con las estadísticas y opciones existentes.
- Vista de dron del circuito real, con sus bordes, meta y entorno. Encuadre automático para los veinte trazados y pistas personalizadas; giro automático, pausa y control al arrastrar o con teclado.
- Los desafíos bloqueados se pueden inspeccionar, conservando el bloqueo de inicio. Volver desde el garaje mantiene el circuito seleccionado; el siguiente desafío vuelve a pasar por reconocimiento y garaje.
- Un solo visor de preparación, sin renderizar la carrera detrás del menú; calidad reducida para equipos sin WebGL. El render compatible respeta ahora la distancia de cámara y niebla de cada escena.
- 35 regresiones aprobadas, incluida equivalencia de física, contactos de suspensión, apoyo de ruedas y encuadre de los veinte circuitos. Inspección en navegador con render compatible; validación GPU y móvil pendiente.

# 0.3.3 — Trazados progresivos y bordes con relieve

- Se reemplazan las ondulaciones radiales por veinte circuitos originales con rectas, arcos tangentes, horquillas y sectores enlazados. Cinco etapas, de 720 a 2550 m y de 5 a 22 curvas.
- Cada trazado tiene una silueta propia, salida sobre una recta y muestreo uniforme de toda la vuelta. Se conserva el ancho de cada nivel y no se cambian colores ni elementos del escenario.
- Nombres, etapa y distancia visibles en la selección de circuitos y desafíos; se mantienen metas, desbloqueos y puntajes históricos.
- Piano redondeado continuo de 14 cm de alto sobre la franja naranja/blanca existente. Las bandas de geometría unidas evitan piezas separadas, solapes y huecos en curvas.
- Contacto independiente de las cuatro ruedas y respuesta vertical amortiguada de la carrocería. Los cruces rápidos se muestrean entre pasos; física horizontal, controles y derrape permanecen intactos.
- La altura se calcula en la simulación compartida: alternar 2D/3D no modifica la respuesta; pausa, reintento y reaparición mantienen un estado coherente.
- Regresión geométrica de los veinte circuitos y pistas importadas, progresión, radios, separación, suspensión y visualización del RX-7.

# 0.3.2 — RX-7 FD RedSuns

- El auto amarillo utiliza el GLB proporcionado, sus texturas originales y cuatro ruedas independientes.
- Pivotes centrados, orientación frontal y escala uniforme; dirección delantera y rodadura sobre los ejes correctos, incluida marcha atrás.
- Se conserva el balanceo de carrocería, los controles y todos los ajustes físicos del auto amarillo.
- Sprite 2D y garaje actualizados desde el mismo modelo. Carga asíncrona con sustituto temporal y aviso si el modelo no puede descargarse.
- El render compatible respeta orientación y transparencias recortadas de las texturas glTF.

# 0.3.1 — Curvas y bordes continuos

- Se eliminan los pliegues y triángulos solapados al dar ancho a curvas cerradas o puntos muy próximos.
- Asfalto, líneas, piano y escapatoria se triangulan como regiones contiguas sin superficies duplicadas.
- Los bordes naranjos y blancos forman una franja continua, con textura medida por distancia y cierre uniforme.
- Línea central por distancia, filtrado anisotrópico y mejor precisión de profundidad; se corrige también el cierre de la pista en 2D.
- El trazado, el muestreo físico y los controles permanecen idénticos. Regresión geométrica sobre las veinte pistas y trazados personalizados.

# 0.3.0 — Vista dual y experiencia de carrera

- Alternar 2D/3D con V, sin recrear el auto ni cambiar físicas, marcha, puntuación o tiempos.
- Cámaras de seguimiento, aérea y capó; zoom y movimiento reducido.
- Escena 3D con cuatro siluetas, ruedas orientables, humo, huellas, asfalto, bordes, meta, boxes, arbolado y montañas.
- Render WebGL local y modo compatible Canvas con profundidad; liberación de recursos al cambiar circuito.
- Nuevo menú, carrera rápida, garaje, configuración persistente, importación dedicada y selección visual de veinte pistas.
- Continuar al siguiente desafío, volver al origen correcto del garaje y ayuda que pausa la carrera.
- HUD más compacto, controles adaptables, opción de forzar controles táctiles y radio sin reproducción automática.
- Pruebas de equivalencia de simulación y de render real sin mutación de las físicas.

Ver README para el alcance de la validación y los límites del modo compatible.

---

# Cambios

## 0.2.1 — Texto de controles táctiles

- Los botones y el mando táctil no seleccionan texto al tocar, mantener pulsado o tocar repetidamente. Se incluye la regla específica de Safari/iOS para evitar el menú de texto.
- Los campos de códigos de pistas mantienen su selección y copia normales.

## 0.2.0 — Estabilidad y controles

- La simulación usa pasos de tiempo fijos; la puntuación depende del tiempo de derrape y ya no aumenta con el auto detenido.
- La caja automática respeta el tiempo de cambio y separa los umbrales de subida y bajada.
- Victoria, derrota y final de carrera detienen el cronómetro y los controles. Los reintentos reinician correctamente el estado y las vidas no bajan de cero.
- Las vueltas requieren avanzar por puntos de control en orden. Ir y volver sobre un tramo ya no acumula vueltas completas.
- El editor toma sus dimensiones al abrirse y valida el mismo trazado que genera; exige cerrar el circuito.
- Los enlaces compartidos se abren después de inicializar la selección de auto. El formato nuevo conserva el ancho y acepta los códigos anteriores.
- Time Trial conserva los récords visibles y el fantasma mantiene su reloj aunque se oculte.
- Menús adaptados a pantallas pequeñas, controles táctiles independientes por dedo y botones de freno, freno de mano y pausa.
- Al perder el foco se limpian los controles y se pausa la partida. Escribir en un campo no activa atajos del juego.
- Ajuste de escala para pantallas de alta densidad, vista previa del auto y respuesta al borde de la pista.
- Borrar tiempos y progreso se mueve al menú de pausa y requiere confirmación.
- Se añaden pruebas de regresión y documentación para ejecutar y desplegar el juego.

Se conservan los cuatro autos, las veinte pistas de Challenge, los datos guardados y los archivos de versiones anteriores.
