import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, classifyDomain, lookalikeOf, DEFAULT_ORG } from './trustEngine.js';
import { AGENTS, POLICIES, SCENARIOS, buildResources, buildPayload } from './demoData.js';

const NOON = new Date('2026-10-06T12:00:00');
const resources = buildResources();
const R = Object.fromEntries(resources.map((r) => [r.key, r]));
const A = Object.fromEntries(AGENTS.map((a) => [a.key, a]));

function runScenario(s, now = NOON) {
  const res = s.scriptedAction.params.resourceKey ? R[s.scriptedAction.params.resourceKey] : null;
  return evaluate({ agent: A[s.agentKey], tool: s.scriptedAction.tool, params: s.scriptedAction.params, payloadText: buildPayload(s.scriptedAction, res), resource: res, policies: POLICIES, intent: s.intent, now });
}

for (const s of SCENARIOS) {
  test(`scenario ${s.key} → ${s.expected}`, () => {
    for (let i = 0; i < 20; i++) { // random synthetic data each run
      const r = runScenario(s);
      assert.equal(r.level, s.expected, JSON.stringify({ score: r.score, checks: r.checks.map((c) => [c.id, c.penalty, c.reason]) }, null, 1));
    }
    const r = runScenario(s);
    console.log(`\n[${s.key}] score=${r.score} level=${r.level}`);
    for (const c of r.checks) console.log(`  ${c.passed ? '✓' : '✗'} ${c.name.padEnd(18)} -${String(c.penalty).padEnd(3)} ${c.reason}`);
  });
}

test('grey scenario lands mid-band (not on the edge)', () => {
  const r = runScenario(SCENARIOS[1]);
  assert.ok(r.score >= 45 && r.score <= 70, 'score ' + r.score);
});

test('attack payload is tokenized (no raw Aadhaar leaves)', () => {
  const r = runScenario(SCENARIOS[2]);
  assert.ok(r.privacy.counts.AADHAAR === 40, JSON.stringify(r.privacy.counts));
  assert.ok(!/\b[2-9]\d{3} \d{4} \d{4}\b/.test(r.tokenizedPayload));
});

test('normal scenario at 11pm gets off-hours penalty but still evaluates', () => {
  const r = runScenario(SCENARIOS[0], new Date('2026-10-06T23:00:00'));
  assert.ok(r.checks.find((c) => c.id === 'policy').penalty === 5);
});

test('domain classification + look-alikes', () => {
  assert.equal(classifyDomain('acme.in', DEFAULT_ORG), 'internal');
  assert.equal(classifyDomain('proton.me', DEFAULT_ORG), 'personal');
  assert.equal(classifyDomain('pastebin.com', DEFAULT_ORG), 'blocked');
  assert.equal(classifyDomain('random-startup.io', DEFAULT_ORG), 'unknown');
  assert.equal(lookalikeOf('acrne.in', ['acme.in']), 'acme.in');
  assert.equal(lookalikeOf('acme-helpdesk.co', ['acme.in']), 'acme.in');
  assert.equal(lookalikeOf('acme.in', ['acme.in']), null);
  assert.equal(lookalikeOf('google.com', ['acme.in']), null);
});

test('look-alike recipient is heavily penalised', () => {
  const r = evaluate({ agent: A['sales-assistant'], tool: 'send_email', params: { to: 'ceo@acrne.in', subject: 'Q3' }, payloadText: R.q3_summary.content, resource: R.q3_summary, policies: POLICIES, now: NOON });
  assert.ok(r.level === 'UNSAFE' || r.level === 'SUSPICIOUS');
  assert.ok(r.checks.find((c) => c.id === 'destination').reason.includes('looks like acme.in'));
});
