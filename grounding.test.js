import test from 'node:test';
import assert from 'node:assert/strict';
import { verify, parseJSON } from '../lib/brief.js';
import { filterWindow } from '../lib/research.js';

const sources = [{ id: 'S1', title: 'Acme raises $40M Series B', content: 'Acme announced a $40M round led by Northwind.', dated: true },
                 { id: 'S2', title: 'Acme blog', content: 'General update.', dated: false }];

test('drops claims with no valid citation', () => {
  const b = verify({ developments: [{ claim: 'Acme hired a new CFO', sources: [] }, { claim: 'Acme hired a CFO', sources: ['S9'] }] }, sources);
  assert.equal(b.developments.length, 0); assert.equal(b.dropped, 2);
});
test('flags numbers and names absent from the cited text', () => {
  const b = verify({ developments: [{ claim: 'Acme raised $90M led by Contoso', category: 'funding', sources: ['S1'] }] }, sources);
  assert.equal(b.developments[0].verified, false);
  assert.ok(b.developments[0].unmatched.length > 0);
});
test('accepts grounded claims and reports gaps', () => {
  const b = verify({ developments: [{ claim: 'Acme raised $40M led by Northwind', category: 'funding', sources: ['S1'] }] }, sources);
  assert.equal(b.developments[0].verified, true);
  assert.ok(b.gaps.some(g => g.includes('no publication date')));
  assert.ok(b.gaps.some(g => g.includes('hires')));
});
test('window filter drops old and duplicate results, keeps undated', () => {
  const now = Date.parse('2026-11-02'), day = 864e5;
  const r = filterWindow([
    { url: 'https://a.com/x', date: new Date(now - 5 * day).toISOString() },
    { url: 'https://a.com/x/', date: new Date(now - 5 * day).toISOString() },
    { url: 'https://b.com/old', date: new Date(now - 90 * day).toISOString() },
    { url: 'https://c.com/u', date: null }], now - 30 * day, now);
  assert.deepEqual(r.map(x => x.url), ['https://a.com/x', 'https://c.com/u']);
});
test('parses fenced JSON', () => assert.equal(parseJSON('```json\n{"a":1}\n```').a, 1));
