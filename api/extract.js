// Lee una captura de la pantalla "Datos del partido" de PES con Gemini y devuelve los números.
// No guarda nada: el partido (con sus datos) se guarda después desde /api/matches.
import { send, readBody, authorized, cleanStats, STAT_FIELDS } from './_lib.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_BASE64 = 4_000_000; // Vercel corta los pedidos de más de 4,5 MB

const side = {
  type: 'OBJECT',
  properties: Object.fromEntries(STAT_FIELDS.map((f) => [f, { type: 'INTEGER', nullable: true }])),
  required: STAT_FIELDS,
};
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    isMatchStats: { type: 'BOOLEAN' },
    homeTeam: { type: 'STRING', nullable: true },
    awayTeam: { type: 'STRING', nullable: true },
    home: side,
    away: side,
  },
  required: ['isMatchStats', 'homeTeam', 'awayTeam', 'home', 'away'],
};

const PROMPT = `Esta imagen es una captura o una foto de la pantalla "Datos del partido" de Pro Evolution Soccer (PES), al terminar un partido.
Arriba están los dos equipos: el de la IZQUIERDA (J1) es "home" y el de la DERECHA (J2) es "away". En la tabla, la columna de números de la izquierda es de home y la de la derecha, de away.
Cómo pasar cada fila a los campos:
- "Disparos (a puerta)", con formato "11(5)": shots = 11, onTarget = 5.
- "Penaltis": penalties.
- "Tiros libres": freeKicks.
- "Tiros de esquina": corners.
- "Faltas (fueras de lugar)", con formato "3(1)": fouls = 3, offsides = 1.
- La fila con el ícono de tarjeta amarilla: yellow. La fila con el ícono de tarjeta roja: red.
- "Posesión del balón": possession, en porcentaje y sin el signo %.
La pantalla puede estar en otro idioma (por ejemplo Shots (on target), Penalties, Free Kicks, Corner Kicks, Fouls (offsides), Possession) o en otro orden: guiate por el significado.
Si un número no se ve o no se puede leer con seguridad, devolvé null. No inventes números.
homeTeam y awayTeam: los nombres de los equipos como aparecen arriba.
isMatchStats: false si la imagen no es una pantalla de estadísticas de un partido.`;

// "REAL MADRID C.F." -> "Real Madrid C.F."; "FC BARCELONA" -> "FC Barcelona"
function teamName(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!t || t !== t.toUpperCase()) return t;
  const low = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);
  return t.split(' ').map((w) => {
    const l = w.toLowerCase();
    if (low.has(l)) return l;
    if (w.length <= 3 || w.includes('.')) return w;
    return w.charAt(0) + l.slice(1);
  }).join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!authorized(req, 'match')) return send(res, 401, { error: 'PIN incorrecto', needPin: 'match' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return send(res, 500, {
      error: 'Falta configurar GEMINI_API_KEY en Vercel para leer capturas. Mientras tanto, podés cargar los datos a mano.',
      code: 'NO_AI',
    });
  }

  const { image, mime } = readBody(req);
  if (typeof image !== 'string' || !image) return send(res, 400, { error: 'Falta la imagen' });
  if (image.length > MAX_BASE64) return send(res, 413, { error: 'La imagen es muy pesada' });
  const type = /^image\/(jpeg|png|webp|heic|heif)$/.test(String(mime)) ? mime : 'image/jpeg';

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: type, data: image } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 502, { error: `Gemini respondió con un error (${r.status}): ${data.error?.message || 'sin detalle'}` });

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    let out;
    try { out = JSON.parse(text); } catch { return send(res, 502, { error: 'El modelo no devolvió datos que se puedan leer. Probá de nuevo.' }); }
    if (!out.isMatchStats) return send(res, 422, { error: 'No parece la pantalla "Datos del partido". Probá con otra captura o cargá los datos a mano.' });

    const stats = cleanStats(out);
    if (!stats) return send(res, 422, { error: 'No se pudo leer ningún número de la captura. Probá con una foto más nítida.' });
    send(res, 200, { stats, teams: { home: teamName(out.homeTeam), away: teamName(out.awayTeam) }, model: MODEL });
  } catch (e) {
    send(res, 502, { error: 'No se pudo leer la captura: ' + e.message });
  }
}
