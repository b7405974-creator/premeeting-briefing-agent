import { research } from './research.js';
import { sampleSources, sampleRaw } from './demo.js';

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

function offlineBrief(sources) {
  const developments = sources.slice(0, 6).map(source => {
    const text = `${source.title} ${source.content}`;
    const lower = text.toLowerCase();
    const category = lower.includes('launch') || lower.includes('announce')
      ? 'launch'
      : lower.includes('hire') || lower.includes('appoint') || lower.includes('joins')
        ? 'hire'
        : lower.includes('fund') || lower.includes('raises') || lower.includes('acquisition')
          ? 'funding'
          : lower.includes('partner') || lower.includes('agreement')
            ? 'partnership'
            : 'news';
    return {
      claim: source.title || source.content.slice(0, 180),
      category,
      date: source.date ? source.date.slice(0, 10) : null,
      sources: [source.id],
    };
  });
  const brief = verify({
    summary: sources.length
      ? `Found ${sources.length} recent source${sources.length === 1 ? '' : 's'} in the requested window. Review the cited headlines and source text before the meeting.`
      : 'No recent sources were found in the requested window.',
    developments,
    open_questions: [
      'Which of these reported developments is most relevant to the meeting?',
      'What changed after the publication dates shown in the sources?',
    ],
    conversation_starters: developments.slice(0, 3).map(d => ({
      text: `Ask about: ${d.claim}`,
      basis: d.sources,
    })),
    gaps: ['LLM synthesis is disabled; this brief uses source headlines and snippets directly.'],
  }, sources);
  return brief;
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
  const brief = offlineBrief(r.sources);
  if (r.errors.length) brief.gaps.push(`${r.errors.length} search request(s) failed, so coverage may be incomplete.`);
  return { subject, kind, meeting, window: r.window, sources: r.sources.map(({ id, url, title, date, dated }) => ({ id, url, title, date, dated })), brief,
    meta: { queries: r.queries, rawResults: r.rawCount, sources: r.sources.length, tavilyMs: t1 - t0, llmMs: 0, llm: null } };
}
