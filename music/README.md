# Música de DR1FT

Coloca aquí archivos MP3 reales: `track-001.mp3`, `track-002.mp3`, `track-003.mp3`… Usa minúsculas, sin espacios ni tildes. El orden de la lista es el orden de reproducción.

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
