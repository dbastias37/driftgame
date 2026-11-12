# Señales derribables · pre-alpha.26

Las señales de tránsito tienen un único frente impreso orientado hacia el conductor que avanza por el recorrido y un reverso gris separado. Se conservan las texturas originales. Las caras duplicadas y sus soportes se extraen antes de agrupar la geometría estática.

Se incluyen 53 señales en Summit, 44 en Rocky Pass, 70 en Redrock Ridge y 11 carteles de Glen Canyon Dam con sus 33 postes. Los indicadores y delineadores de Cerro Abajo y los delineadores de los circuitos planos usan el mismo comportamiento.

El impacto se detecta mediante barrido del volumen del vehículo y comprobación de altura. La señal recibe velocidad, giro, gravedad de vuelco y fricción; permanece en el suelo hasta reiniciar. Nunca se modifica la posición, velocidad, dirección, puntuación o combo del vehículo desde este sistema. Las barreras y rocas conservan sus colisiones. Se excluyen las caras exactas de señalización del contacto sólido y de la cámara, incluyendo las diferencias de redondeo entre el GLB y los datos de conducción.

Las repeticiones almacenan únicamente los cambios de señales golpeadas. Al retroceder antes del impacto, vuelven a mostrarse en pie sin alterar la partida pausada. En online las señales son efectos visuales locales: no intervienen en la simulación autoritativa del servidor.

Para actualizar los modelos importados, ejecutar `python scripts/build-road-signs.py` (numpy, scipy y Pillow) y revisar el catálogo `js/road-sign-data.js`. La extracción usa las regiones de textura originales y los triángulos asociados, no elimina obstáculos por tamaño. Las nuevas firmas de récord NFSIII.v3 / GTR2.v2 evitan mezclar tiempos de la versión con señales rígidas.

Validación: pruebas de impactos frontales, laterales, reversa, barridos rápidos, inmovilidad del vehículo/puntuación, altura, teletransporte, reposo, reinicio, paquetes online, orientación, reverso, separación de caras y búsqueda en repeticiones. La prueba de contacto usa geometría original y un control sin filtrar que rebota, frente al mismo recorrido corregido que conserva 40 m/s.
