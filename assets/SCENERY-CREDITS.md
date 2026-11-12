# Recursos de esta entrega

## Árboles

Procedencia: `trees-low-poly.zip` proporcionado por el usuario, `source/trees.fbx`.
Dos árboles: `tree4` (3.519 triángulos cerca / 563 lejos) y `tree6` (1.862 / 297).
Texturas `1234.png` y `bark03.png`, copiadas sin retoque como `tree-leaves.png` y `tree-bark.png`. Conversión de geometría a metros, Y vertical, conservando UV y normales. El ZIP de origen no contiene una atribución adicional.

## Summit

Procedencia: `nfs_iii_hot_pursuit_-_summit.glb` proporcionado por el usuario.
Archivo original, sin recomprimir ni modificar geometría, atlas o UV.
Metadatos incrustados: **amogusstrikesback2**, licencia declarada **CC BY 4.0**.
[Fuente indicada en el modelo](https://sketchfab.com/3d-models/nfs-iii-hot-pursuit-summit-8c7f99b6b86a44cebfc52b9beacc6c1d).
El visor utiliza el atlas con material sin iluminación adicional y recorte alfa; agrupa las mallas estáticas por cercanía. La versión prealpha.19 añade la pista jugable: conducción, rivales, contacto de neumáticos, barreras, vueltas y cámaras propios de DR1FT. El trazado y la superficie de apoyo se derivan del modelo suministrado; la malla visual, UV y atlas se conservan. `scripts/build-summit-route.py` documenta el proceso reproducible. No se certifica un porcentaje de fidelidad al juego original.

## White Mountain

Se abrió `STATICout.fbx` del ZIP aportado como referencia de escenario/estructuras. No se incluye ese archivo pesado ni se presenta como un nuevo circuito jugable.

## NFS III Especial — Rocky Pass y Redrock Ridge

Procedencia: `nfs-iii-hot-pursuit-rocky-pass.zip` y `nfs-iii-hot-pursuit-redrock-ridge.zip`, aportados por el usuario. FBX: `track04.fbx` y `redrock.fbx`; atlas: `Atlas_00005.png` y `Atlas_00004.png`. Los paquetes no incluyen un texto de atribución/licencia adicional.

Conversión con Blender 4.3.2 a GLB, conservando geometría, escala, atlas y UV; el material usa el atlas original. La ruta se recupera siguiendo las aristas compartidas del asfalto. El piso de conducción se deriva de las caras conectadas y se consulta por triángulos, incluyendo los distintos niveles del puente de Redrock Ridge. La física, las carreras, rivales, cámaras y saltos son propios de DR1FT. Herramientas: `scripts/import-nfs-fbx.py` y `scripts/build-nfs-special.py`.
