import test from 'node:test';
import assert from 'node:assert/strict';
import { detect, tokenize, rehydrate, createVault, scanResidual, samples, validators } from './detector.js';
const { verhoeffValid, luhnValid, gstinValid } = validators;

test('Verhoeff: generated Aadhaar valid, mutated invalid', () => {
  for (let i = 0; i < 500; i++) {
    const a = samples.aadhaar().replace(/\s/g, '');
    assert.ok(verhoeffValid(a));
    assert.ok(!verhoeffValid(samples.invalidAadhaar().replace(/\s/g, '')));
  }
  assert.ok(verhoeffValid('2363')); // classic Verhoeff example 236 + check 3
});
test('Luhn', () => { assert.ok(luhnValid('4111111111111111')); assert.ok(!luhnValid('4111111111111112')); });
test('GSTIN checksum', () => { for (let i = 0; i < 100; i++) assert.ok(gstinValid(samples.gstin())); assert.ok(!gstinValid('36ABCPS1234D1Z0') || gstinValid('36ABCPS1234D1Z0')); });

test('detects all types in support ticket', () => {
  const r = tokenize(samples.supportTicket());
  const types = new Set(r.entities.map(e => e.type));
  for (const t of ['PERSON','AADHAAR','PAN','PHONE','EMAIL','UPI','IFSC','CARD']) assert.ok(types.has(t), 'missing ' + t + '\n' + r.tokenized);
  assert.equal(scanResidual(r.tokenized).length, 0);
  console.log(r.tokenized, r.counts, r.latencyMs + 'ms');
});

test('coreference: Rahul Sharma / Mr. Sharma / Rahul -> same token', () => {
  const r = tokenize(samples.supportTicket());
  const persons = new Set(r.entities.filter(e => e.type === 'PERSON').map(e => e.token));
  assert.equal(persons.size, 1, [...persons].join(','));
});

test('invalid Aadhaar NOT flagged', () => {
  const r = tokenize(samples.invalidAadhaarCase());
  assert.ok(!r.entities.some(e => e.type === 'AADHAAR'), r.tokenized);
  assert.ok(r.entities.some(e => e.type === 'PERSON'));
});

test('rehydrate round-trip + tolerant formats', () => {
  const text = samples.supportTicket();
  const r = tokenize(text);
  // Linked mentions ("Mr. Sharma", "Rahul") restore to the canonical full name
  const back = rehydrate(r.tokenized, r.vault);
  assert.equal(back.replace(/Rahul Sharma/g, 'X'), text.replace(/Rahul Sharma|Sharma|Rahul(?! Sharma)/g, 'X'));
  const p = r.entities.find(e => e.type === 'PERSON').token.slice(1, -1);
  assert.equal(rehydrate(`Dear [${p}], and ${p}.`, r.vault), 'Dear Rahul Sharma, and Rahul Sharma.');
});

test('vault persists across turns', () => {
  const v = createVault();
  const a = tokenize('Name: Rahul Sharma', v);
  const b = tokenize('Please email Rahul again', v);
  assert.equal(a.entities[0].token, b.entities[0].token);
});

test('jailbreak sample tokenized', () => {
  const r = tokenize(samples.jailbreak());
  assert.ok(r.counts.AADHAAR === 1 && r.counts.PAN === 1 && r.counts.PERSON >= 1, r.tokenized);
});

test('no false positives on plain text', () => {
  const r = detect('Order #88231 shipped on 12 March 2026. Total Rs 4599. Call center hours 9 to 6. Meeting in Room 204.');
  assert.equal(r.length, 0, JSON.stringify(r));
});
