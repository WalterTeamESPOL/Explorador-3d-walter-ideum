const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env.local')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

const PORT = Number(process.env.PORT || 3080);
const KEY = process.env.GROQ_API_KEY;
const BASE = `http://localhost:${PORT}`;
const PROD = process.env.NODE_ENV === 'production';
// En un hosting se escucha en todas las interfaces; en tu PC solo en local.
const HOST = process.env.HOST || (PROD ? '0.0.0.0' : '127.0.0.1');
// Dominios públicos permitidos, separados por coma. Ej: walter.onrender.com
const EXTRA_HOSTS = (process.env.ALLOWED_HOSTS || '')
  .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
const LOCAL_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
const hostAllowed = h => LOCAL_HOSTS.includes(h) || EXTRA_HOSTS.includes(String(h || '').toLowerCase());
const originAllowed = (origin, h) => origin === `http://${h}` || origin === `https://${h}`;

// Cuántos proxies hay delante (hosting/túnel) para leer la IP real del visitante.
const HOPS = Number(process.env.TRUST_PROXY_HOPS ?? (PROD ? 1 : 0));
const CHAT_PER_MIN = Number(process.env.CHAT_PER_MIN || 15);
const VOICE_PER_MIN = Number(process.env.VOICE_PER_MIN || 10);
const MAX_INFLIGHT = Number(process.env.MAX_INFLIGHT || 30);
const SYSTEM = `Eres Walter, un robot social de ESPOL, Ecuador, de 1,30 metros.
Fuiste creado por el Dr. Dennys Paillacho junto a estudiantes y profesionales de CIDIS y FIEC.
En esta experiencia eres un asistente virtual en una mesa interactiva.
Responde en español, con tono amable y natural, normalmente en 2 a 4 frases breves.
Puedes explicar robótica y responder preguntas generales. Si no sabes algo, dilo.
No inventes datos del proyecto ni afirmes controlar hardware o consultar internet.
Usa texto sencillo para hablar, sin Markdown. No repitas tu presentación en cada respuesta.`;

const hits = new Map();
let inflight = 0;

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '')
    .split(',').map(v => v.trim()).filter(Boolean);
  if (HOPS > 0 && xff.length) return xff[Math.max(0, xff.length - HOPS)];
  return req.socket.remoteAddress || 'desconocida';
}

// Evita que una sola persona (o un abuso) agote el cupo de todos.
function rateLimit(req, kind, max) {
  const now = Date.now(), key = `${kind}:${clientIp(req)}`;
  const recent = (hits.get(key) || []).filter(t => now - t < 60000);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw fail(429, 'Demasiadas preguntas seguidas. Espera un momento e inténtalo de nuevo.');
  }
  recent.push(now);
  hits.set(key, recent);
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (!list.some(t => now - t < 60000)) hits.delete(key);
}, 60000).unref();

const fail = (status, message) => Object.assign(new Error(message), {status});

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store'
  });
  res.end(JSON.stringify(body));
}

async function body(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw fail(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function groq(endpoint, payload, signal, isJson = false) {
  if (inflight >= MAX_INFLIGHT) {
    throw fail(503, 'Walter está atendiendo a muchas personas. Inténtalo de nuevo en unos segundos.');
  }
  inflight++;
  try { return await groqRaw(endpoint, payload, signal, isJson); }
  finally { inflight--; }
}

async function groqRaw(endpoint, payload, signal, isJson = false) {
  if (!KEY || KEY === 'PEGA_AQUI_TU_CLAVE') {
    throw fail(503, 'Configura GROQ_API_KEY en .env.local y reinicia el servidor.');
  }
  const response = await fetch(`https://api.groq.com/openai/v1/${endpoint}`, {
    method:'POST',
    signal,
    headers:{
      Authorization:`Bearer ${KEY}`,
      ...(isJson ? {'Content-Type':'application/json'} : {})
    },
    body:isJson ? JSON.stringify(payload) : payload
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      const retry = response.headers.get('retry-after');
      throw fail(429, retry
        ? `Cupo temporal agotado. Reintenta en ${retry} segundos.`
        : 'Cupo de Groq agotado. Revisa Limits antes de reintentar.');
    }
    if (response.status === 401 || response.status === 403) {
      throw fail(502, 'Groq rechazó el acceso. Revisa la clave y los permisos del modelo.');
    }
    throw fail(502, `Groq no pudo procesar la solicitud (${response.status}).`);
  }
  return data;
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host;
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'text/plain'});
    return res.end('ok');
  }
  if (!hostAllowed(host)) {
    return json(res, 403, {error:'Host no permitido. Agrega este dominio a ALLOWED_HOSTS.'});
  }
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(45000)
  ]);

  try {
    const url = new URL(req.url, BASE);

    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') throw fail(405, 'Usa POST.');
      if (!originAllowed(req.headers.origin, host)) {
        throw fail(403, 'Origen no permitido.');
      }

      if (url.pathname === '/api/chat') {
        rateLimit(req, 'chat', CHAT_PER_MIN);
        let data;
        try {
          data = JSON.parse((await body(req, 32000)).toString());
        } catch (e) {
          if (e.status) throw e;
          throw fail(400, 'JSON inválido.');
        }

        const messages = data?.messages;
        if (!Array.isArray(messages) || !messages.length || messages.length > 7 ||
          messages.some(m => !m || !['user','assistant'].includes(m.role) ||
            typeof m.content !== 'string' || !m.content.trim() || m.content.length > 2000) ||
          messages.at(-1).role !== 'user') {
          throw fail(400, 'Pregunta o historial inválido.');
        }

        const result = await groq('chat/completions', {
          model:'openai/gpt-oss-20b',
          messages:[{role:'system', content:SYSTEM}, ...messages],
          reasoning_effort:'low',
          include_reasoning:false,
          max_completion_tokens:1024
        }, signal, true);

        const answer = result.choices?.[0]?.message?.content?.trim();
        if (!answer) {
          throw fail(502, 'No llegó una respuesta. Intenta con una pregunta más breve.');
        }
        return json(res, 200, {answer});
      }

      if (url.pathname === '/api/transcribe') {
        rateLimit(req, 'voice', VOICE_PER_MIN);
        const type = (req.headers['content-type'] || '').split(';')[0];
        const formats = {
          'audio/webm':'webm',
          'audio/mp4':'mp4',
          'audio/ogg':'ogg',
          'audio/wav':'wav'
        };
        if (!formats[type]) throw fail(415, 'Formato de audio no compatible.');

        const audio = await body(req, 5 * 1024 * 1024);
        if (audio.length < 100) throw fail(400, 'No se recibió audio.');

        const form = new FormData();
        form.append('file', new Blob([audio], {type}), `pregunta.${formats[type]}`);
        form.append('model', 'whisper-large-v3-turbo');
        form.append('language', 'es');

        const result = await groq('audio/transcriptions', form, signal);
        return json(res, 200, {text:result.text?.trim() || ''});
      }

      throw fail(404, 'Ruta no encontrada.');
    }

    if (!['GET','HEAD'].includes(req.method)) {
      throw fail(405, 'Método no permitido.');
    }

    const name = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const allowed = [
      'index.html',
      'styles.css',
      'walter/walter-chat.css',
      'walter/walter-chat.js'
    ];
    if (!allowed.includes(name) && !/^(js|vendor)\/[a-zA-Z0-9_-]+(?:\.min)?\.js$/.test(name)) {
      throw fail(404, 'Archivo no encontrado.');
    }

    const file = await fs.readFile(path.join(ROOT, name));
    const type = {
      '.html':'text/html',
      '.css':'text/css',
      '.js':'text/javascript'
    }[path.extname(name)];

    res.writeHead(200, {
      'Content-Type':`${type}; charset=utf-8`,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch (e) {
    if (res.destroyed) return;
    const timeout = signal.aborted;
    json(res, timeout ? 504 : e.status || (e.code === 'ENOENT' ? 404 : 500), {
      error:timeout
        ? 'La conexión tardó demasiado. Vuelve a intentarlo.'
        : e.status
          ? e.message
          : e.code === 'ENOENT'
            ? 'Archivo no encontrado.'
            : 'No se pudo completar la solicitud. Comprueba la conexión.'
    });
  }
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE'
    ? `El puerto ${PORT} está ocupado. Cierra la otra instancia o cambia PORT en .env.local.`
    : e.message);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Walter listo en el puerto ${PORT} (${HOST}). Local: ${BASE}`);
});