import { redis, K, send, ensureDb, readBody, authorized } from './_lib.js';

const ID = /^[a-z0-9_-]{2,40}$/i;
const COLOR = /^#[0-9a-f]{6}$/i;

function cleanList(list, label, max, errs, withColor) {
  if (!Array.isArray(list)) {
    errs.push(`La lista de ${label}s no es válida`);
    return [];
  }
  const ids = new Set();
  const names = new Set();
  const out = [];
  list.forEach((x, i) => {
    const id = String(x?.id || '');
    const name = String(x?.name || '').trim().slice(0, max);
    if (!ID.test(id)) return errs.push(`El ${label} ${i + 1} tiene un id inválido`);
    if (!name) return errs.push(`Falta el nombre del ${label} ${i + 1}`);
    const key = name.toLowerCase();
    if (ids.has(id) || names.has(key)) return errs.push(`Hay un ${label} repetido: ${name}`);
    ids.add(id);
    names.add(key);
    const item = { id, name, active: x.active !== false };
    if (withColor) item.color = COLOR.test(x.color || '') ? x.color : '#888888';
    out.push(item);
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') return send(res, 405, { error: 'Método no permitido' });
  if (!ensureDb(res)) return;
  if (!authorized(req, 'admin')) return send(res, 401, { error: 'PIN de admin incorrecto', needPin: 'admin' });

  try {
    const body = readBody(req);
    const errs = [];
    const players = cleanList(body.players, 'jugador', 24, errs, true);
    const games = cleanList(body.games, 'juego', 30, errs, false);
    if (!games.length && !errs.length) errs.push('Tiene que haber al menos un juego');
    const leagueName = String(body.settings?.leagueName || '').trim().slice(0, 40) || 'Liga PES';
    if (errs.length) return send(res, 400, { error: errs.join('. ') });

    // No se puede quitar a alguien (o un juego) que ya tiene partidos: hay que archivarlo.
    const matches = Object.values((await redis.hgetall(K.matches)) || {});
    const pIds = new Set(players.map((p) => p.id));
    const gIds = new Set(games.map((g) => g.id));
    if (matches.some((m) => [...m.home.players, ...m.away.players].some((id) => !pIds.has(id)))) {
      return send(res, 400, { error: 'No se puede quitar a un jugador que ya tiene partidos. Desmarcalo como activo.' });
    }
    if (matches.some((m) => !gIds.has(m.gameId))) {
      return send(res, 400, { error: 'No se puede quitar un juego que ya tiene partidos. Desmarcalo como activo.' });
    }

    const settings = { leagueName };
    await Promise.all([redis.set(K.players, players), redis.set(K.games, games), redis.set(K.settings, settings)]);
    send(res, 200, { players, games, settings });
  } catch (e) {
    send(res, 500, { error: 'No se pudieron guardar los ajustes: ' + e.message });
  }
}
