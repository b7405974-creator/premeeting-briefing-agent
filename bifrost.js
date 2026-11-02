import { fetchRetry } from './http.js';
// All LLM traffic goes through the Bifrost gateway (routing, fallbacks, budgets, logs).
export async function chat(messages, { model = process.env.BIFROST_MODEL || 'openai/gpt-4o-mini' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (process.env.BIFROST_VIRTUAL_KEY) headers['x-bf-vk'] = process.env.BIFROST_VIRTUAL_KEY; // governance: budget + rate limits
  const fallbacks = (process.env.BIFROST_FALLBACKS || '').split(',').map(s => s.trim()).filter(Boolean);
  const r = await fetchRetry(`${process.env.BIFROST_URL || 'http://localhost:8080'}/v1/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 1800, ...(fallbacks.length && { fallbacks }) }),
  }, { timeout: 60000 });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Bifrost ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return { text: j.choices?.[0]?.message?.content || '', model: j.model || model, provider: j.extra_fields?.provider || null, usage: j.usage || {} };
}
