// Tavily research layer: parallel multi-angle search, date-window filtering, dedupe.
import { fetchRetry } from './http.js';
const TAVILY = 'https://api.tavily.com/search';

export function buildQueries(name, kind, context = '') {
  const q = `"${name}"${context ? ' ' + context : ''}`;
  return kind === 'person'
    ? [`${q} news`, `${q} new role joins appointed`, `${q} announces launches`, `${q} interview talk podcast`]
    : [`${q} news`, `${q} announces launch product`, `${q} hires appoints joins leadership`, `${q} partnership funding acquisition`];
}

async function tavily(query, topic, days) {
  const body = { query, topic, max_results: 6, search_depth: 'advanced', include_answer: false };
  if (topic === 'news') body.days = days; else body.time_range = 'month';
  const r = await fetchRetry(TAVILY, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Tavily ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return (j.results || []).map(x => ({ url: x.url, title: x.title || '', content: x.content || '', date: x.published_date || null, score: x.score || 0, query }));
}

export function filterWindow(results, start, end) {
  const seen = new Set(), out = [];
  for (const r of results) {
    const key = r.url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    const t = r.date ? Date.parse(r.date) : NaN;
    if (!isNaN(t) && (t < start || t > end)) continue; // dated and outside window -> drop
    seen.add(key);
    out.push({ ...r, dated: !isNaN(t) });
  }
  return out;
}

export async function research({ subject, kind, context, windowDays = 30, end = Date.now() }) {
  if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not set');
  const start = end - windowDays * 864e5;
  const qs = buildQueries(subject, kind, context);
  const jobs = [...qs.map(q => tavily(q, 'news', windowDays)), tavily(qs[0], 'general', windowDays)];
  const settled = await Promise.allSettled(jobs);
  const errors = settled.filter(s => s.status === 'rejected').map(s => s.reason.message);
  const all = settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
  const sources = filterWindow(all, start, end).sort((a, b) => b.score - a.score).slice(0, 14)
    .map((s, i) => ({ ...s, id: `S${i + 1}`, content: s.content.slice(0, 700) }));
  return { sources, errors, queries: qs.length + 1, rawCount: all.length, window: { start, end } };
}
