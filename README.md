# Drift Racer 0.2

Juego de drift en Canvas y JavaScript, sin compilación ni servidor de aplicación. Incluye cuatro autos, veinte desafíos, editor de pistas y Time Trial con fantasma local.

[Jugar en Render](https://driftgame.onrender.com)

## Ejecutar

Desde la raíz del repositorio, con Python 3:

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. El punto de entrada es `index.html`; los archivos `index_*` son versiones anteriores y no reciben estos cambios.

## Controles

| Acción | Teclado |
| --- | --- |
| Acelerar / frenar | W / S o flechas arriba / abajo |
| Girar | A / D o flechas izquierda / derecha |
| Freno de mano | Espacio |
| Subir / bajar marcha manual | Shift / Control |
| Pausar / reanudar | Esc |
| Volver al centro de la pista, gastando una vida | R durante la carrera |
| Reintentar después de terminar | R |
| Mostrar / ocultar fantasma | G |
| Ayuda | H |

En dispositivos táctiles aparecen dirección, acelerador, freno, freno de mano y, con transmisión manual, botones de cambio. También hay botones visibles de pausa y ayuda.

## Pistas y progreso

Los tiempos, fantasmas y desafíos desbloqueados se guardan en `localStorage` del navegador y del dominio actual. La versión 0.2 conserva las claves existentes. Borrar datos del sitio elimina ese progreso.

Las pistas compartidas nuevas usan `TRK2` e incluyen su ancho. Los códigos anteriores `TRK` siguen siendo compatibles. Para crear una pista, dibujar un trazado cerrado y suficientemente largo; el editor muestra cuándo puede utilizarse.

## Pruebas

Requieren Node.js 20 o superior:

```sh
npm ci
npx playwright install chromium
npm test
```

Para usar un Chromium ya instalado: `CHROMIUM_EXECUTABLE=/ruta/a/chromium npm test`. La suite incluye arranque, puntuación, cambios, estados finales, vueltas, editor, enlaces compartidos, persistencia, multitáctil, diseño móvil y una prueba con el bucle de animación real. Las pruebas bloquean las emisoras y fuentes externas para no depender de su disponibilidad.

## Render

Se sirve como sitio estático: directorio público raíz (`.`), sin paso de compilación. `package.json` solo configura las pruebas; no es necesario ejecutar npm para jugar. Mantener el servicio y dominio existentes para conservar el almacenamiento del navegador.

## Límites actuales

La radio depende de servicios externos y de la política de reproducción del navegador. Las pruebas móviles son emuladas: conviene comprobar sensaciones de conducción y rendimiento en teléfonos físicos. Esta versión conserva el equilibrio de autos y metas de desafíos; su ajuste requiere partidas completas.

Ver [CHANGELOG.md](CHANGELOG.md) para los cambios de la versión.
