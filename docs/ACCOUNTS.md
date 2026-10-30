# Cuentas de Drift Racer: implementación y activación

La rama integra acceso obligatorio por Google o correo, perfil de piloto y guardado en servidor. **Todavía requiere configurar y probar los servicios reales antes de producción.** No desplegar estos archivos sobre el sitio estático actual sin preparar el servidor de cuentas.

## Alcance

Cada cuenta tiene UUID, correo verificado, nombre, fecha de alta y vínculo opcional con Google. Guarda 20 etapas/60 objetivos, desbloqueos, victorias, créditos, inventario y configuración de los seis autos, siete logros derivados e historial de premios y compras. También sincroniza récords de desafíos y descensos, tiempos y fantasmas de contrarreloj. Los fantasmas se reducen a 1500 muestras; cada cuenta admite hasta 200 registros de 200 KB.

Las compras son con **créditos del juego**. No hay pagos con dinero real, tarjetas ni pasarela de pago. Las preferencias gráficas siguen siendo propias del dispositivo.

El guardado anónimo antiguo se conserva en el navegador. No se asigna automáticamente a una cuenta, porque puede estar manipulado o pertenecer a otra persona en un equipo compartido. Las cuentas nuevas comienzan en cero; definir expresamente cualquier migración antes del lanzamiento.

## Despliegue en Render

- Node **24**, build `npm ci --omit=dev --ignore-scripts`, start `npm start`, health `/health`. El proceso escucha en `$PORT` y `0.0.0.0`.
- Un servicio web entrega HTML/assets, API y WebSocket desde **el mismo origen**. El sitio estático actual y el servidor online separado no se unen automáticamente. Identificar el dominio final y preparar la transición sin borrar los servicios anteriores antes de validar el reemplazo.
- Una sola instancia, con disco persistente montado en `/var/data`. Configurar `ACCOUNT_DB=/var/data/drift.sqlite`. Los discos de Render requieren un servicio pagado; este cambio no creó ni contrató ninguno.
- Configurar `NODE_ENV=production` y `APP_ORIGIN=https://DOMINIO-FINAL`, sin ruta ni barra final. El proceso rechaza la ausencia de DB/origen en producción. El disco debe existir antes del primer despliegue: el filesystem efímero de Render no conserva estos datos entre reinicios.
- La base se inicializa automáticamente con claves foráneas, WAL y transacciones. No compartir este archivo entre réplicas ni usar almacenamiento de red. Para escalar horizontalmente, migrar cuentas a PostgreSQL y definir enrutamiento/estado compartido de salas.
- Las variables de `.env.example` son una referencia, no credenciales funcionales. Introducir los valores sensibles exclusivamente como secretos en Render; nunca en JS público, commits, capturas o chat.

## Google

Crear en Google Cloud un cliente OAuth de aplicación web y configurar la pantalla de consentimiento. Registrar exactamente:

```
https://DOMINIO-FINAL/api/auth/google/callback
```

Configurar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. En modo de prueba de Google sólo pueden entrar los usuarios de prueba autorizados; preparar la publicación del consentimiento para la audiencia final. El botón se deshabilita cuando no hay credenciales.

Authorization Code con PKCE S256, cookie HttpOnly que vincula el estado al navegador y nonce de un solo uso. El servidor valida firma RSA del ID token con claves de Google, emisor, destinatario, azp, caducidad, iat, nonce, sub y correo verificado. No conserva access/refresh tokens de Google. La identidad permanente es `sub`.

No hay vinculación silenciosa por correo: si ya existe la cuenta, ingresar primero con contraseña y usar **Vincular Google** con el mismo correo. Recuperar contraseña permite establecer una clave en una cuenta creada con Google, demostrando control del buzón.

## Correo y sesiones

Verificar el dominio remitente y sus registros DNS en Resend. Configurar `RESEND_API_KEY` y `MAIL_FROM`, por ejemplo `Drift Racer <cuentas@tu-dominio.cl>`.

El registro crea una cuenta pendiente. El enlace de verificación abre una ventana donde el propietario establece la contraseña definitiva, evitando adoptar una clave de alguien que hubiera registrado ese correo antes. No inicia sesión automáticamente ni consume el token por una visita GET. Enlaces de verificación/recuperación: un solo uso, 30 minutos. Contraseñas: 12–128 caracteres, scrypt con sal aleatoria. Recuperar contraseña revoca todas las sesiones y enlaces pendientes.

Las sesiones duran 30 días y usan cookies HttpOnly, Secure en HTTPS, SameSite=Lax y prefijo `__Host-`. No se guardan tokens de sesión en localStorage. Hay cierre individual y cierre de todas las sesiones, restricciones de origen, encabezado obligatorio para POST, límites de cuerpo, rate limits y concurrencia acotada de scrypt.

## Consistencia y límites

- Se carga el perfil confirmado antes de habilitar una partida. No hay modo invitado ni escritura arbitraria del monedero desde el cliente.
- Compra, inventario, descuento e historial se aplican en una transacción. El servidor calcula el precio. UUID de operación y nivel esperado impiden doble cobro por reintentos. Equipar no puede superar lo comprado.
- Cada inicio recibe un ID vinculado a cuenta, modo y etapa; cancela otras carreras individuales abiertas de esa cuenta. Finalizar es idempotente.
- Resultados pendientes quedan en una cola local por cuenta/carrera y se reintentan al recargar, recuperar conexión o pulsar Sincronizar. La interfaz distingue guardado pendiente de confirmado. Una carrera vencida (2 horas) o inválida no entrega premio.
- Los récords usan revisiones y conservan el mejor resultado ante conflicto. Su cola local está separada por cuenta.
- Un encabezado con el ID de cuenta esperado impide que una pestaña antigua modifique otra cuenta después de un cambio de cookie.
- WebSocket exige sesión y origen válidos. Nombre/identidad vienen del perfil. La misma cuenta no ocupa dos plazas en una sala. Sesiones vencidas o revocadas se desconectan en el siguiente heartbeat, máximo 15 segundos.
- Los premios online los entrega el servidor de carreras con recibos permanentes; no existe un endpoint público para reclamarlos.
- **La campaña individual todavía se simula en el navegador.** El servidor comprueba etapa, tiempo, límites y duplicación y calcula el premio; puntaje y vuelta limpia aún son declarados por el cliente. Esto no es un sistema antitrampas competitivo. Antes de dinero real, premios de valor o rankings competitivos, validar la conducción con replay/simulación en servidor.
- No se confía en `X-Forwarded-For`. Detrás de un proxy compartido, el límite de IP puede agrupar usuarios; revisar el contrato de proxy y las métricas antes de ampliar tráfico.

## Respaldo y restauración

Crear previamente el directorio de destino y generar una copia consistente con la API de backup de SQLite:

```
ACCOUNT_DB=/var/data/drift.sqlite npm run backup:accounts -- /var/data/backups/drift-2026-10-30.sqlite
```

Copiar los respaldos fuera del servicio, cifrados y con acceso restringido; definir retención. El script no configura ni ejecuta una programación. No publicar copias en assets. Copiar sólo el archivo principal de una base activa ignorando WAL no garantiza consistencia.

Para restaurar, detener el servicio, conservar una copia del estado actual, sustituir la base por el backup consistente y retirar los WAL/SHM de la base anterior mientras está detenida. Arrancar y verificar perfil, saldo, inventario e historial. Ensayar la recuperación; los snapshots del proveedor no sustituyen esa prueba.

## Verificación

`npm run test:core` incluye regresión de conducción/3D, HTTP con SQLite real y pruebas del cliente en VM: aislamiento, verificación, recuperación, caducidad, revocación, CSRF, sesiones falsas, saldos, compras repetidas/simultáneas, resultados duplicados, revisiones, colas y backup/restauración. JWT se prueba con claves RSA locales; Google y correo usan respuestas controladas.

Ingreso, registro y recuperación se inspeccionaron en el navegador de previsualización. No dispone de WebGL por hardware; se usa el fallback existente. No se verificaron credenciales reales de Google, entregabilidad real, acceso completo mediante navegador ni persistencia de producción en Render.

Antes de activar:

1. Registro y correo reales, confirmación, acceso, reenvío, enlace vencido, recuperación y revocación de otras sesiones.
2. Google en el dominio final: éxito, cancelación, regreso, acceso repetido y vínculo con una cuenta existente.
3. Completar misión, comprar pieza, cambiar de equipo y comprobar saldo, inventario, objetivos y récords.
4. Interrumpir red al guardar; reconectar y comprobar que premios y compras sólo se aplican una vez.
5. Carrera online con dos cuentas, resultado y premio al ganador.
6. Reinicio/redeploy con disco; ensayo de restauración; revisión de logs sin secretos.

Referencias oficiales: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [discos de Render](https://render.com/docs/disks), [Resend](https://resend.com/docs/api-reference/emails/send-email), [SQLite en Node 24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
