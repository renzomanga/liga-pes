// Utilidades compartidas por las funciones de /api (Vercel no publica archivos que empiezan con "_").
import { Redis } from '@upstash/redis';

// La integración de Upstash en Vercel crea KV_REST_API_URL / KV_REST_API_TOKEN.
// Si la conectás desde Upstash directo, usa UPSTASH_REDIS_REST_URL / _TOKEN. Aceptamos ambas.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

export const K = {
  players: 'pes:players',
  games: 'pes:games',
  settings: 'pes:settings',
  matches: 'pes:matches', // hash: id -> partido
};

export const DEFAULT_GAMES = [
  { id: 'pes2011', name: 'PES 2011', active: true },
  { id: 'pes6', name: 'PES 6', active: true },
];

export const DEFAULT_SETTINGS = { leagueName: 'Liga PES' };

export function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
}

export function ensureDb(res) {
  if (redis) return true;
  send(res, 500, {
    error: 'No hay base de datos conectada. En Vercel, agregá Upstash for Redis desde Storage y volvé a desplegar.',
    code: 'NO_DB',
  });
  return false;
}

export function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

// kind: 'match' (cargar / editar / borrar partidos) o 'admin' (ajustes)
export function authorized(req, kind) {
  const appPin = process.env.APP_PIN || '';
  const adminPin = process.env.ADMIN_PIN || '';
  const pin = String(req.headers['x-pin'] || '');
  const aPin = String(req.headers['x-admin-pin'] || '');
  if (kind === 'admin') {
    const need = adminPin || appPin;
    return !need || aPin === need || (!adminPin && pin === appPin);
  }
  return !appPin || pin === appPin || (adminPin && aPin === adminPin);
}

// Datos del partido que se leen de la captura de PES (uno por lado). null = no se sabe.
export const STAT_FIELDS = ['shots', 'onTarget', 'penalties', 'freeKicks', 'corners', 'fouls', 'offsides', 'yellow', 'red', 'possession'];

function cleanStatSide(s) {
  const out = {};
  let any = false;
  for (const f of STAT_FIELDS) {
    const v = s && typeof s === 'object' ? s[f] : null;
    const n = v === null || v === undefined || v === '' ? NaN : Number(v);
    if (!Number.isFinite(n)) { out[f] = null; continue; }
    out[f] = Math.max(0, Math.min(f === 'possession' ? 100 : 999, Math.round(n)));
    any = true;
  }
  return any ? out : null;
}

// Devuelve {home, away} con números enteros o null, o null si no hay ningún dato.
export function cleanStats(st) {
  if (!st || typeof st !== 'object') return null;
  const home = cleanStatSide(st.home);
  const away = cleanStatSide(st.away);
  if (!home && !away) return null;
  const empty = Object.fromEntries(STAT_FIELDS.map((f) => [f, null]));
  return { home: home || empty, away: away || { ...empty } };
}

export function authInfo() {
  return {
    pin: Boolean(process.env.APP_PIN),
    admin: Boolean(process.env.ADMIN_PIN || process.env.APP_PIN),
  };
}
