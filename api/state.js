import { redis, K, DEFAULT_GAMES, DEFAULT_SETTINGS, send, ensureDb, authInfo } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  if (!ensureDb(res)) return;
  try {
    let [players, games, settings, hash] = await Promise.all([
      redis.get(K.players),
      redis.get(K.games),
      redis.get(K.settings),
      redis.hgetall(K.matches),
    ]);
    if (!games) {
      games = DEFAULT_GAMES;
      await redis.set(K.games, games);
    }
    const matches = Object.values(hash || {}).sort(
      (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)
    );
    send(res, 200, {
      players: players || [],
      games,
      settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
      matches,
      auth: authInfo(),
    });
  } catch (e) {
    send(res, 500, { error: 'No se pudo leer la base: ' + e.message });
  }
}
