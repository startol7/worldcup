const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const RANKING_FILE = path.join(DATA_DIR, 'rankings.json');
const TEAM_COUNT = 16;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const limits = new Map();

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RANKING_FILE)) fs.writeFileSync(RANKING_FILE, '[]\n', 'utf8');
}

function readRankings() {
  ensureDataFile();
  try {
    const rows = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function writeRankings(rows) {
  ensureDataFile();
  const tmp = `${RANKING_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, RANKING_FILE);
}

function normalizeRow(row) {
  return {
    name: cleanName(row.name),
    champions: Number(row.champions || 0),
    countries: Array.isArray(row.countries)
      ? row.countries.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < TEAM_COUNT)
      : [],
    lastAt: row.lastAt || (row.last_at ? Date.parse(row.last_at) : 0)
  };
}

function sorted(rows) {
  return rows.map(normalizeRow).sort((a, b) =>
    (b.countries || []).length - (a.countries || []).length ||
    (b.champions || 0) - (a.champions || 0) ||
    (b.lastAt || 0) - (a.lastAt || 0) ||
    String(a.name).localeCompare(String(b.name), 'ja')
  );
}

function cleanName(name) {
  return String(name || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 10) || 'プレイヤー';
}

async function supabaseFetch(pathname, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || data?.error || `Supabase request failed: ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function getRankings() {
  if (!HAS_SUPABASE) return sorted(readRankings()).slice(0, 100);
  const rows = await supabaseFetch('/rest/v1/rankings?select=name,champions,countries,last_at&limit=1000');
  return sorted(Array.isArray(rows) ? rows : []).slice(0, 100);
}

async function registerRankingChampion(name, teamIndex) {
  if (!HAS_SUPABASE) {
    const rows = readRankings();
    let player = rows.find(row => row.name === name);
    if (!player) {
      player = { name, champions: 0, countries: [], lastAt: 0 };
      rows.push(player);
    }
    player.champions = (player.champions || 0) + 1;
    player.countries = Array.from(new Set([...(player.countries || []), teamIndex])).sort((a, b) => a - b);
    player.lastAt = Date.now();
    writeRankings(rows);
    return { player: normalizeRow(player), rankings: sorted(rows).slice(0, 100) };
  }

  const result = await supabaseFetch('/rest/v1/rpc/register_champion', {
    method: 'POST',
    body: JSON.stringify({ p_name: name, p_team_index: teamIndex })
  });
  const player = normalizeRow(Array.isArray(result) ? result[0] : result);
  return { player, rankings: await getRankings() };
}

function rateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const rec = limits.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 60_000; }
  rec.count += 1;
  limits.set(ip, rec);
  return rec.count <= 40;
}

function json(res, status, body) {
  const out = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(out)
  });
  res.end(out);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 4096) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) return json(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' :
      ext === '.css' ? 'text/css; charset=utf-8' :
      ext === '.js' ? 'text/javascript; charset=utf-8' :
      ext === '.json' ? 'application/json; charset=utf-8' :
      'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, storage: HAS_SUPABASE ? 'supabase' : 'file' });
  }

  if (req.method === 'GET' && url.pathname === '/api/rankings') {
    try {
      return json(res, 200, { rankings: await getRankings(), storage: HAS_SUPABASE ? 'supabase' : 'file' });
    } catch (err) {
      return json(res, 502, { error: 'ranking storage unavailable' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/rankings/champion') {
    if (!rateLimit(req)) return json(res, 429, { error: 'too many requests' });
    try {
      const body = JSON.parse(await readBody(req) || '{}');
      const name = cleanName(body.name);
      const teamIndex = Number(body.teamIndex);
      if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex >= TEAM_COUNT) {
        return json(res, 400, { error: 'invalid teamIndex' });
      }

      const result = await registerRankingChampion(name, teamIndex);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: 'bad request' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
  serveStatic(req, res, url.pathname);
}

if (!HAS_SUPABASE) ensureDataFile();
http.createServer((req, res) => {
  handle(req, res).catch(() => json(res, 500, { error: 'server error' }));
}).listen(PORT, () => {
  console.log(`WORLD CUP KNOCKOUT server listening on :${PORT}`);
});
