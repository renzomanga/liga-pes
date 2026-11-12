# Liga PES

App para cargar los partidos de PES entre amigos y ver estadísticas: tabla, rachas, mano a mano, cruces 1 vs 1 e historial. Funciona en PC y celular, y los datos se comparten entre todos los que abren el link.

## Qué hay adentro

- `index.html`: toda la interfaz (sin build, HTML + JS).
- `api/state.js`: devuelve jugadores, juegos, ajustes y partidos.
- `api/matches.js`: crea, edita y borra partidos.
- `api/config.js`: guarda jugadores, juegos y nombre de la liga.
- `api/extract.js`: lee con Gemini la captura de la pantalla "Datos del partido" del PES y devuelve los números (no guarda nada).
- Base de datos: Upstash Redis (plan gratis, se conecta desde Vercel).

## Subirlo a Vercel

1. Creá un repo en GitHub y subí esta carpeta tal cual.
2. En Vercel: **Add New → Project**, importá el repo. Framework: **Other**. Sin build command. Deploy.
3. En el proyecto: **Storage → Create Database → Upstash for Redis** (o desde el Marketplace), plan gratis, y conectalo al proyecto en todos los entornos. Dejá el prefijo de variables por defecto.
4. **Deployments → Redeploy** para que tome las variables.
5. Abrí la app, andá a **Ajustes**, cargá los jugadores (nombre y color) y guardá.

Alternativa por consola: `npm i -g vercel`, `vercel` dentro de la carpeta, y después el paso 3.

## PIN (opcional, recomendado si el link circula)

En **Settings → Environment Variables** podés agregar:

- `APP_PIN`: lo piden para cargar, editar o borrar partidos. Se lo pasás a los chicos.
- `ADMIN_PIN`: lo pide para cambiar jugadores, juegos y nombre de la liga. Si no lo ponés, usa `APP_PIN`.

Cada dispositivo lo pide una vez y lo recuerda. Ver estadísticas no requiere PIN.

## Datos del partido y pestaña Stats

Al cargar un partido se puede subir una captura o foto de la pantalla "Datos del partido" del PES (disparos, al arco, penales, tiros libres, córners, faltas, offsides, tarjetas y posesión). Un modelo de Gemini la lee y completa los números, que se pueden corregir antes de guardar. La columna izquierda de la pantalla (J1) se carga como local; si quedó al revés, está el botón "Invertir columnas". La imagen no se guarda: solo los números, dentro del partido.

Para que funcione, en **Settings → Environment Variables** de Vercel:

- `GEMINI_API_KEY` (obligatoria): la clave de Google AI Studio. Queda solo en el servidor; el navegador nunca la ve.
- `GEMINI_MODEL` (opcional): el modelo a usar. Por defecto, `gemini-2.5-flash`.

Sin la clave, igual se pueden cargar los datos a mano. Leer una captura pide el mismo PIN que cargar partidos, para que nadie gaste la clave desde afuera.

Con esos datos, la pestaña **Stats** arma fichas tipo cromo (ataque, puntería, posesión, defensa, arquero y garra, de 1 a 99), apodos automáticos (El Carnicero, Bilardista, Pólvora mojada, Pecho frío…), premios, gráficos de dispersión, el tarjetero y los récords. Los apodos y premios se calculan con reglas en `index.html` (funciones `playerBadges` y `awards`), así que se pueden ajustar o agregar.

## Cómo cuenta

- Ganar 3 puntos, empatar 1.
- Como no todos juegan la misma cantidad de partidos, la tabla se ordena por puntos por partido (también se puede por % de victorias, puntos totales o diferencia de gol). Al ordenar por promedio, quien jugó menos de un tercio de los partidos del que más jugó va aparte, abajo, hasta que juegue más. Esa proporción se cambia en la constante `MIN_SHARE` de `index.html`.
- Si un empate se define por penales, el que gana la tanda suma 2 y el que pierde 1. Se cambia en la constante `PTS` al principio del script de `index.html`.
- El primer juego de la lista en Ajustes es el que aparece elegido al cargar. El orden se cambia con las flechas.
- En partidos de a dos (2 vs 1, 2 vs 2), el resultado y los goles del lado cuentan para cada jugador de ese lado. Con el filtro de modalidad se ven solo los 1 vs 1.
- Jugadores o juegos con partidos no se borran: se desmarcan como activos y sus estadísticas quedan.

## Probar en local

```
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

## Datos en Redis

- `pes:players`, `pes:games`, `pes:settings`: JSON.
- `pes:matches`: hash `id → partido`. Cada partido se guarda por separado, así dos personas pueden cargar al mismo tiempo sin pisarse. Si se cargaron los datos de la captura, van en `stats: {home, away}`.

Desde Ajustes se puede descargar un respaldo JSON con todo.
