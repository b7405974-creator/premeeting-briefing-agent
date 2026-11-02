import test from 'node:test';
import assert from 'node:assert/strict';
import { demoBrief } from '../lib/brief.js';

test('sample brief shows safeguards: 1 removed, 1 flagged, all others cited and verified', () => {
  const r = demoBrief({}), b = r.brief;
  assert.equal(b.dropped, 1);
  assert.equal(b.developments.length, 5);
  assert.equal(b.developments.filter(d => !d.verified).length, 1);
  assert.ok(b.developments.every(d => d.sources.length));
  assert.ok(r.sources.every(s => s.dated === false || Date.parse(s.date) > r.window.start));
});
