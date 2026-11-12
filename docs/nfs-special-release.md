# NFS III Especial — 1.0.0-prealpha.21

Summit, Rocky Pass y Redrock Ridge se seleccionan juntos desde **Menú principal → NFS III Especial**. También aparecen en Carrera rápida y Contrarreloj. Cada mapa conserva su paisaje y atlas suministrados, los cinco autos, rivales, elección de cuatro/cinco vueltas y récords independientes.

| Mapa | Longitud | Recurso visual |
| --- | ---: | --- |
| Summit | 10,30 km | `assets/bonus/summit.glb` |
| Rocky Pass | 8,86 km | `assets/bonus/rocky-pass.glb` |
| Redrock Ridge | 8,76 km | `assets/bonus/redrock-ridge.glb` |

## Superficie y conducción

El contacto usa los triángulos de piso conectados con la carretera del modelo. El ancho disponible incluye las superficies laterales transitables: desaparece el límite artificial de la franja central. Se conservan los límites exteriores del escenario y el control de la huella completa del vehículo.

Los cambios de rasante pueden hacer despegar el auto según su velocidad y la curvatura del terreno. En vuelo se conserva el impulso horizontal, actúan la gravedad y la resistencia aerodinámica, y las cuatro ruedas acompañan al chasis. Acelerar, frenar o girar no genera fuerza de neumáticos sin contacto. El aterrizaje recupera el apoyo; pausa, recuperación, repeticiones y fantasmas conservan o reinician el estado correspondiente.

En Redrock Ridge, el puente y la carretera inferior usan la altura de referencia del auto para identificar su nivel. Tampoco chocan autos que circulan a alturas separadas. La recuperación del jugador y de los rivales conserva ese nivel, incluso junto al cruce.

Se mantienen las correcciones de carrocería en alturas negativas, arranque en pendiente y nieve dinámica. Los modelos se cargan bajo demanda; una carga tardía no sustituye una pista ya seleccionada.

## Validación

- `npm run test:core`: **248/248 pruebas aprobadas**. Incluye superficie lateral, modelos/atlas, distintos niveles del puente, recuperación, arranque en pendiente, saltos a 30/60/120 Hz, pausa, repetición y fantasmas.
- Se conserva el informe de vueltas automáticas de la integración en [nfs-special-validation.json](nfs-special-validation.json): los cinco autos completaron los tres mapas con tráfico y colisiones activadas, sin muestras fuera del piso ni saltos de posición en el trazado. Se regenera con `npm run validate:nfs`.
- Navegador disponible: entrada a NFS III Especial, selección y carga de los tres paisajes, paso al garaje, cuenta atrás y aceleración en Redrock Ridge revisados con el renderizador compatible.
- La suite completa `npm test` incluye diez pruebas Playwright que no pudieron arrancar aquí porque no está instalado su ejecutable Chromium. La revisión del navegador compatible no sustituye esa suite. Rendimiento WebGL y controles en teléfonos físicos pendientes de medir.

## Ejecución y reconstrucción

Para jugar: `npm ci` y `npm run preview`, o `INICIAR_WINDOWS.bat`. Para el servidor multijugador existente: `npm start`. Python y Blender no se requieren al jugar.

Para reconstruir los recursos de Rocky Pass y Redrock Ridge, prepara carpetas `rocky/` y `redrock/`, cada una con su FBX y atlas PNG originales. Ejecuta `blender --background --python scripts/import-nfs-fbx.py -- /ruta/nfs-source/rocky` y el equivalente para `redrock`. Copia los GLB generados a los nombres de la tabla y ejecuta `python scripts/build-nfs-special.py /ruta/nfs-source` con NumPy/SciPy. El script reutiliza el GLB y los datos de ruta originales de Summit.

Procedencia y atribuciones: [SCENERY-CREDITS.md](../assets/SCENERY-CREDITS.md).
