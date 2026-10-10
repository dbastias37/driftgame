# Cambios

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
