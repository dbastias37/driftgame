# RX-7 FD RedSuns

Archivo original proporcionado por el usuario: `rx7_fd_redsuns_keisuke_takahashi.glb`.
Se conserva sin modificar como `rx7-fd-redsuns.glb` (161 960 bytes).

Metadatos incluidos en el GLB:
- Título: RX7 FD “RedSuns” Keisuke Takahashi.
- Autor: Pudim Abestado — https://sketchfab.com/pudimabestado
- Fuente: https://sketchfab.com/3d-models/rx7-fd-redsuns-keisuke-takahashi-b76c1a819fd34cd6b139dceb705d2e8e
- Licencia declarada por el archivo: SKETCHFAB Standard — https://sketchfab.com/licenses

La licencia del modelo es independiente de las licencias del código. La integración conserva las texturas incrustadas y los créditos; este repositorio no cambia ni concede licencias adicionales sobre el asset.

El adaptador `js/rx7-model.js` orienta el frente hacia +X, escala uniformemente a 4.45 m visuales y centra cuatro pivotes de rueda. La separación entre carrocería y ruedas conserva el balanceo original del juego. Las animaciones pregrabadas del archivo no se reproducen: no sustituyen controles, posición ni suspensión del juego.

La vista superior de `assets/cars/yellow.png` y la imagen de revisión en `docs/` se renderizaron desde este modelo. GLTFLoader y BufferGeometryUtils pertenecen a Three.js r170, bajo `vendor/THREE-LICENSE.txt`.


# Yugo Koral 55 — adaptación pixel low poly

Referencia geométrica suministrada: `yugo_koral_55.glb`, 18.043.124 bytes y 478.657 triángulos.
- Autor original: [3DDomino](https://sketchfab.com/3DDomino).
- Fuente: https://sketchfab.com/3d-models/yugo-koral-55-1e2dcf759a4f47f9b2832af5e3c9b85d
- Licencia declarada por el archivo: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Cambios: retopología manual de la carrocería siguiendo el modelo y las fotos, escala métrica, ruedas facetadas nuevas, atlas pixelado nuevo, UV, pivotes, sprite 2D y adaptación al juego. Se acredita a 3DDomino sin implicar su aprobación.

Resultado: `yugo-koral-55-pixel.glb` (84.904 bytes; 764 triángulos), con atlas incrustado y copia editable `yugo-pixel-atlas.png`. Cinco mallas, una textura y un material `KHR_materials_unlit`; filtro NEAREST en ambos ejes, como en las referencias del usuario. La adaptación del Yugo y su atlas se distribuyen con atribución bajo CC BY 4.0.

Referencia de estilo adicional, no incluida en la descarga del juego: `ae86_low_poly_fujiwara_tofu_shop_version_2.glb` de **Pudim Abestado**, https://sketchfab.com/3d-models/ae86-low-poly-fujiwara-tofu-shop-version-2-9ec1194ab2d1441bb8f8bae8d83fb204 (licencia declarada SKETCHFAB Standard). Se estudiaron su material sin iluminación, atlas de 512×512, paleta de vidrio, detalles en píxeles y complejidad de malla. No se redistribuye el AE86 ni se copian sus texturas; las licencias del AE86/RX-7 no se amplían.

Autoría reproducible (offline; Node y `@napi-rs/canvas`, sin dependencia adicional en el juego):

```sh
node tools/build-yugo.mjs
node tools/render-yugo.mjs
```

`YUGO_CANVAS_MODULE` puede apuntar al módulo Canvas ya instalado. El primer comando construye la malla y el atlas; el segundo produce el sprite con el renderer real del juego y admite un directorio de salida para vistas frontal, lateral y trasera. `tools/export-yugo-source.mjs <original.glb> <parts.json>` permite volver a medir la geometría de referencia; la malla de juego se retopologiza con paneles compartidos para evitar las grietas de la reducción automática de piezas CAD independientes.
