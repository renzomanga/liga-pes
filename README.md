# Liga PES

App para cargar los partidos de PES entre amigos y ver estadísticas: tabla, rachas, mano a mano, cruces 1 vs 1 e historial. Funciona en PC y celular, y los datos se comparten entre todos los que abren el link.

## Qué hay adentro

- `index.html`: toda la interfaz (sin build, HTML + JS).
- `api/state.js`: devuelve jugadores, juegos, ajustes y partidos.
- `api/matches.js`: crea, edita y borra partidos.
- `api/config.js`: guarda jugadores, juegos y nombre de la liga.
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

## Cómo cuenta

- Ganar 3 puntos, empatar 1.
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
- `pes:matches`: hash `id → partido`. Cada partido se guarda por separado, así dos personas pueden cargar al mismo tiempo sin pisarse.

Desde Ajustes se puede descargar un respaldo JSON con todo.
