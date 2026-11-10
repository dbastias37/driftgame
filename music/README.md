# Banda sonora: 22 temas

La lista `playlist.json` registra `001.mp3` a `022.mp3`, con títulos y artistas. La reproducción comienza al entrar al menú tras pulsar Jugar ahora. Seleccionar pista, entrar al garaje y salir a carrera cambian a la siguiente canción con 200 ms de bajada y 260 ms de subida, coordinados con el negro visual. La pausa musical manual se respeta. Ajustes y pausa de carrera no cambian la canción.

La barra se oculta tras 4 segundos sin interacción. N cambia de tema y la muestra; M pausa/reanuda; B o el botón ♫ muestran los controles. El aviso de título y artista dura 5 segundos.

# Música de DR1FT

Coloca aquí archivos MP3 reales: `001.mp3`, `002.mp3`, `003.mp3`… Usa minúsculas, sin espacios ni tildes. El orden de la lista es el orden de reproducción.

Después de agregar archivos, ejecuta desde la raíz del repositorio:

```sh
npm run music:scan
```

Publica tanto los MP3 como `music/playlist.json`. El escáner conserva los títulos y artistas ya registrados. En GitHub también puedes editar el archivo directamente:

```json
{
  "tracks": [
    { "file": "track-001.mp3", "title": "", "artist": "" },
    { "file": "track-002.mp3", "title": "", "artist": "" }
  ]
}
```

Sin título aparece `track-001`; sin artista, `Artista por definir`. Más adelante solo cambia `title` y `artist`, sin renombrar el MP3. Copiar un archivo sin incluirlo en la lista no lo incorpora al reproductor: el sitio estático no enumera carpetas.

## Controles

- **M:** reproducir / pausar música.
- **N:** siguiente canción.
- Botones del reproductor: anterior, reproducir/pausar y siguiente.
- **Ajustes → Música:** volumen, tema actual y **Probar sin audio**.

La música requiere una acción del jugador para empezar. Después avanza al terminar cada canción y vuelve al comienzo de la lista. Cambiar de menú o pausar la carrera no reinicia la música; M controla la pausa musical independientemente. El volumen se guarda en este navegador.

La prueba silenciosa usa tres títulos ficticios, no carga MP3 ni emisoras y no produce sonido. Cambia automáticamente cada 12 segundos mientras está reproduciendo; también admite pausa y cambio manual. El aviso se retira a los cinco segundos. **Salir de prueba** vuelve a los MP3 reales sin iniciarlos automáticamente. La prueba no se activa sola al volver a cargar el juego.
