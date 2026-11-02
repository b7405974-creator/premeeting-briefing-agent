import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { makeBrief } from './brief.js';

const hits = new Map(), cache = new Map();
const limited = ip => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 6e4); a.push(now); hits.set(ip, a); return a.length > 10; };
const page = await readFile(new URL('./index.html', import.meta.url));
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, page, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/health') {
      const b = await fetch((process.env.BIFROST_URL || 'http://localhost:8080') + '/health').then(r => r.ok, () => false);
      return send(res, 200, { tavily: !!process.env.TAVILY_API_KEY, bifrost: b, demo: process.env.DEMO === '1', model: process.env.BIFROST_MODEL || 'openai/gpt-4o-mini' });
    }
    if (req.method === 'POST' && req.url === '/api/brief') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 1e5) throw new Error('Request too large'); }
      if (limited(req.socket.remoteAddress)) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
      const input = JSON.parse(raw || '{}'), key = JSON.stringify([input.subject, input.kind, input.context, input.meeting, input.demo]);
      const hit = cache.get(key); // 10 minute cache protects Tavily and Bifrost budgets
      if (hit && Date.now() - hit.t < 6e5) return send(res, 200, { ...hit.v, cached: true });
      const v = await makeBrief(input); cache.set(key, { t: Date.now(), v });
      return send(res, 200, v);
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(process.env.PORT || 3000, () => console.log(`Briefing agent on :${process.env.PORT || 3000}`));
