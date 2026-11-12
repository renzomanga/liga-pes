import { randomUUID } from 'node:crypto';
import { redis, K, DEFAULT_GAMES, send, ensureDb, readBody, authorized } from './_lib.js';

async function validate(body) {
  const [players, games] = await Promise.all([redis.get(K.players), redis.get(K.games)]);
  const pIds = new Set((players || []).map((p) => p.id));
  const gIds = new Set((games || DEFAULT_GAMES).map((g) => g.id));
  const errs = [];

  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
  if (!date) errs.push('La fecha no es válida');
  if (!gIds.has(body.gameId)) errs.push('Elegí un juego');

  const side = (s, label) => {
    const ps = Array.isArray(s?.players) ? [...new Set(s.players.map(String))] : [];
    if (!ps.length) errs.push(`Falta elegir quién jugó de ${label}`);
    if (ps.some((id) => !pIds.has(id))) errs.push(`Hay un jugador desconocido de ${label}`);
    const goals = Number(s?.goals);
    if (!Number.isInteger(goals) || goals < 0 || goals > 99) errs.push(`Los goles de ${label} tienen que ser entre 0 y 99`);
    return { players: ps, goals, team: String(s?.team || '').trim().slice(0, 40) };
  };
  const home = side(body.home, 'local');
  const away = side(body.away, 'visitante');
  if (home.players.some((id) => away.players.includes(id))) errs.push('Un jugador no puede estar en los dos lados');

  // Penales: solo si terminó empatado en goles, y la tanda tiene que tener ganador.
  let penalties = null;
  const pen = body.penalties;
  if (pen && typeof pen === 'object') {
    const ph = Number(pen.home);
    const pa = Number(pen.away);
    if (home.goals !== away.goals) errs.push('Solo puede haber penales si el partido terminó empatado');
    else if (![ph, pa].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) errs.push('Los penales tienen que ser números entre 0 y 99');
    else if (ph === pa) errs.push('En los penales tiene que haber un ganador');
    else penalties = { home: ph, away: pa };
  }

  return {
    errs,
    data: { date, gameId: body.gameId, home, away, penalties, note: String(body.note || '').trim().slice(0, 140) },
  };
}

export default async function handler(req, res) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return send(res, 405, { error: 'Método no permitido' });
  if (!ensureDb(res)) return;
  if (!authorized(req, 'match')) return send(res, 401, { error: 'PIN incorrecto', needPin: 'match' });

  try {
    const id = String(req.query?.id || '');

    if (req.method === 'DELETE') {
      if (!id) return send(res, 400, { error: 'Falta el id del partido' });
      const n = await redis.hdel(K.matches, id);
      if (!n) return send(res, 404, { error: 'Ese partido ya no existe' });
      return send(res, 200, { ok: true });
    }

    const { errs, data } = await validate(readBody(req));
    if (errs.length) return send(res, 400, { error: errs.join('. ') });

    if (req.method === 'POST') {
      const match = { id: randomUUID(), ...data, createdAt: Date.now() };
      await redis.hset(K.matches, { [match.id]: match });
      return send(res, 201, { match });
    }

    // PUT = editar
    if (!id) return send(res, 400, { error: 'Falta el id del partido' });
    const prev = await redis.hget(K.matches, id);
    if (!prev) return send(res, 404, { error: 'Ese partido ya no existe' });
    const match = { ...prev, ...data, id, updatedAt: Date.now() };
    await redis.hset(K.matches, { [id]: match });
    return send(res, 200, { match });
  } catch (e) {
    send(res, 500, { error: 'No se pudo guardar: ' + e.message });
  }
}
