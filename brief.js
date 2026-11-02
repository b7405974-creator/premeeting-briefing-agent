import { research } from './research.js';
import { chat } from './bifrost.js';
import { sampleSources, sampleRaw } from './demo.js';

const SYSTEM = `You are a meeting-prep analyst. Use ONLY the numbered sources provided.
Never invent hires, launches, numbers, dates, titles or personal details. If a fact is not in a source, leave it out.
Every item in "developments" must cite source ids. Be concise: max 6 developments, 4 open questions, 3 starters.
If sources are thin, ambiguous (several people/companies share the name), or off-topic, say so in "gaps".
Reply with JSON only, no markdown fences:
{"summary":"2 sentences","developments":[{"claim":"one factual sentence","category":"news|launch|hire|funding|partnership|other","date":"YYYY-MM-DD or null","sources":["S1"]}],
"open_questions":["..."],"conversation_starters":[{"text":"...","basis":["S1"]}],"gaps":["..."]}`;

const STOP = new Set(['The', 'This', 'That', 'They', 'Its', 'New', 'Inc', 'Ltd', 'Corp', 'Company']);

export function verify(raw, sources) {
  const byId = new Map(sources.map(s => [s.id, s]));
  const valid = a => (Array.isArray(a) ? a : []).filter(i => byId.has(i));
  let dropped = 0;
  const developments = (raw.developments || []).map(d => {
    const ids = valid(d.sources);
    if (!d.claim || !ids.length) { dropped++; return null; }
    const text = ids.map(i => byId.get(i).title + ' ' + byId.get(i).content).join(' ').toLowerCase();
    // grounding check: numbers and proper nouns in the claim must appear in the cited text
    const tokens = (d.claim.replace(/^\S+\s/, '').match(/\$?\d[\d,.]*[a-zA-Z%]*|\b[A-Z][a-zA-Z]{2,}\b/g) || []).filter(t => !STOP.has(t));
    const unmatched = tokens.filter(t => !text.includes(t.toLowerCase().replace(/^\$/, '').replace(/[.,]$/, '')));
    return { ...d, sources: ids, verified: unmatched.length === 0, unmatched: unmatched.slice(0, 4) };
  }).filter(Boolean);
  const starters = (raw.conversation_starters || []).filter(s => s?.text).map(s => ({ text: s.text, basis: valid(s.basis) }));
  const gaps = [...(raw.gaps || [])];
  if (dropped) gaps.push(`${dropped} model-generated claim(s) were removed because they cited no valid source.`);
  const unv = developments.filter(d => !d.verified).length;
  if (unv) gaps.push(`${unv} claim(s) contain names or numbers not found in the cited text. Check them before relying on them.`);
  const undated = sources.filter(s => !s.dated).length;
  if (undated) gaps.push(`${undated} of ${sources.length} sources have no publication date, so recency is unconfirmed.`);
  for (const [cat, label] of [['hire', 'hires or leadership changes'], ['launch', 'product launches']])
    if (!developments.some(d => d.category === cat)) gaps.push(`No ${label} found in the window. None may have happened, or none were indexed.`);
  return { summary: raw.summary || '', developments, open_questions: raw.open_questions || [], conversation_starters: starters, gaps, dropped };
}

export function parseJSON(text) {
  const m = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Model did not return JSON');
  return JSON.parse(m[0]);
}

export function demoBrief({ meeting }) {
  const sources = sampleSources(), end = Date.now();
  return { demo: true, subject: 'Northwind Robotics (fictional sample)', kind: 'company', meeting, window: { start: end - 30 * 864e5, end },
    sources: sources.map(({ id, url, title, date, dated }) => ({ id, url, title, date, dated })), brief: verify(sampleRaw, sources),
    meta: { queries: 0, rawResults: 0, sources: sources.length, tavilyMs: 0, llm: null } };
}

export async function makeBrief({ subject, kind = 'company', context = '', meeting, demo }) {
  if (demo || process.env.DEMO === '1') return demoBrief({ meeting });
  if (!subject?.trim()) throw new Error('Enter a company or person.');
  const t0 = Date.now();
  const meetingMs = meeting ? Date.parse(meeting) : NaN;
  const end = Math.min(Date.now(), isNaN(meetingMs) ? Date.now() : meetingMs);
  const r = await research({ subject: subject.trim(), kind, context: context.trim(), end });
  const t1 = Date.now();
  if (!r.sources.length) {
    return { subject, kind, meeting, window: r.window, sources: [], meta: { queries: r.queries, tavilyMs: t1 - t0, llm: null },
      brief: { summary: 'No sources found in the last 30 days.', developments: [], open_questions: [], conversation_starters: [],
        gaps: ['Tavily returned nothing in the window. Add context (company, role) or try the full name.', ...r.errors] } };
  }
  const src = r.sources.map(s => `[${s.id}] (${s.date || 'undated'}) ${s.title}\n${s.content}`).join('\n\n');
  const user = `Subject: ${subject} (${kind})${context ? `\nContext: ${context}` : ''}\nMeeting: ${meeting || 'unspecified'}\nWindow: last 30 days\n\nSOURCES:\n${src}`;
  const msgs = [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
  let out = await chat(msgs), parsed;
  try { parsed = parseJSON(out.text); } catch { // one repair attempt if the model returned malformed JSON
    out = await chat([...msgs, { role: 'assistant', content: out.text }, { role: 'user', content: 'That was not valid JSON. Return only the JSON object.' }]);
    parsed = parseJSON(out.text);
  }
  const brief = verify(parsed, r.sources);
  if (r.errors.length) brief.gaps.push(`${r.errors.length} search request(s) failed, so coverage may be incomplete.`);
  return { subject, kind, meeting, window: r.window, sources: r.sources.map(({ id, url, title, date, dated }) => ({ id, url, title, date, dated })), brief,
    meta: { queries: r.queries, rawResults: r.rawCount, sources: r.sources.length, tavilyMs: t1 - t0, llmMs: Date.now() - t1, llm: { model: out.model, provider: out.provider, usage: out.usage } } };
}
