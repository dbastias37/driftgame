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
