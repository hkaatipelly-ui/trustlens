import assert from 'node:assert/strict';
import test from 'node:test';
import { createGeminiClient, AIUnavailableError } from '../services/ai/gemini.client.js';
import { proposeAction } from '../services/ai/agent.service.js';
import { checkIntentAlignment, heuristicAlignment } from '../services/ai/intent.service.js';
import { explainDecision } from '../services/ai/explain.service.js';
import { AGENTS, SCENARIOS } from '../lib/demoData.js';
import { detect, samples } from '../lib/detector.js';

const env = { GEMINI_API_KEY: 'test-only-not-a-real-key', GEMINI_MODEL: 'gemini-3.6-flash', DEMO_MODE: 'false' };
const unavailable = { isAvailable: () => false };
const schema = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } } };

test('JSON provider protects all request content and falls back in the required model order', async () => {
  const calls = [];
  const client = { models: { async generateContent(request) {
    calls.push(request);
    if (calls.length === 1) throw new Error('upstream failure');
    return { text: '{"ok":true}' };
  } } };
  const provider = createGeminiClient(env, { client });
  const result = await provider.generateJSON({
    system: 'Help Rahul Sharma.',
    prompt: `${samples.supportTicket()} GSTIN ${samples.gstin()}`,
    schema: { ...schema, description: 'Reply to priya@example.com' },
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map((call) => call.model), ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  for (const call of calls) {
    assert.equal(call.config.temperature, 0.2);
    assert.equal(call.config.responseMimeType, 'application/json');
    assert.ok(call.config.responseSchema);
    assert.equal(detect(call.contents).length, 0);
    assert.equal(detect(call.config.systemInstruction).length, 0);
    assert.equal(detect(JSON.stringify(call.config.responseSchema)).length, 0);
  }
});

test('text generation uses the configured model without JSON mode', async () => {
  let request;
  const provider = createGeminiClient({ ...env, GEMINI_MODEL: 'gemini-3.5-flash-lite' }, {
    client: { models: { async generateContent(input) { request = input; return { text: '  Plain explanation.  ' }; } } },
  });
  assert.equal(await provider.generateText({ system: 'Explain', prompt: 'Hello Rahul Sharma' }), 'Plain explanation.');
  assert.equal(request.model, 'gemini-3.5-flash-lite');
  assert.equal(request.config.responseMimeType, undefined);
  assert.equal(request.config.responseSchema, undefined);
  assert.equal(detect(request.contents).length, 0);
  assert.throws(() => createGeminiClient({ ...env, GEMINI_MODEL: 'gemini-2.5-flash' }), /not allowed/);
});

test('missing keys and demo mode disable every SDK call', async () => {
  const client = { models: { generateContent() { assert.fail('disabled provider called the SDK'); } } };
  for (const config of [{}, { ...env, GEMINI_API_KEY: ' ' }, { ...env, DEMO_MODE: 'true' }, { ...env, DEMO_MODE: true }]) {
    const provider = createGeminiClient(config, { client });
    assert.equal(provider.isAvailable(), false);
    await assert.rejects(provider.generateJSON({ system: '', prompt: '', schema }), AIUnavailableError);
  }
});

test('per-call timeout aborts the first model and tries the fallback; exhausted models throw a typed error', async () => {
  const calls = [];
  const provider = createGeminiClient(env, { timeoutMs: 5, client: { models: { generateContent(request) {
    calls.push(request);
    return calls.length === 1 ? new Promise(() => {}) : Promise.resolve({ text: '{"ok":true}' });
  } } } });
  assert.deepEqual(await provider.generateJSON({ system: 'Test', prompt: 'Test', schema }), { ok: true });
  assert.equal(calls[0].config.abortSignal.aborted, true);
  assert.equal(calls.length, 2);
  const exhausted = createGeminiClient(env, { timeoutMs: 5, client: { models: { generateContent() { return new Promise(() => {}); } } } });
  await assert.rejects(exhausted.generateText({ system: 'Test', prompt: 'Test' }), (error) => {
    assert.ok(error instanceof AIUnavailableError);
    assert.equal(error.status, 503);
    assert.equal(error.code, 'AI_UNAVAILABLE');
    return true;
  });
});

test('malformed JSON and empty SDK responses are model failures', async () => {
  let calls = 0;
  const provider = createGeminiClient(env, { client: { models: { async generateContent() {
    calls += 1;
    return { text: calls === 1 ? '{invalid' : '' };
  } } } });
  await assert.rejects(provider.generateJSON({ system: 'Test', prompt: 'Test', schema }), AIUnavailableError);
  assert.equal(calls, 2);
});

test('proposal protects agent names, resource names, task, and document; restores only in server memory', async () => {
  let captured;
  const provider = {
    isAvailable: () => true,
    async generateJSON(input) {
      captured = input;
      const task = JSON.parse(input.prompt).task;
      return {
        tool: 'send_email', params: { to: task.match(/<EMAIL_\d+>/)[0], resourceKey: 'q3_summary' },
        rationale: 'Matches the requested summary email.',
      };
    },
  };
  const result = await proposeAction({
    agent: { ...AGENTS[0], name: 'Rahul Sharma' },
    task: 'Email the Q3 summary to priya@example.com',
    resourceSummaries: [{ key: 'q3_summary', name: 'Priya Nair summary', dataClass: 'internal' }],
    contextDocument: { name: 'Rahul Sharma ticket', content: samples.supportTicket(), dataClass: 'internal' },
  }, { provider });
  assert.equal(detect(captured.system).length, 0);
  assert.equal(detect(captured.prompt).length, 0);
  assert.match(captured.prompt, /<AADHAAR_1>/);
  assert.equal(result.params.to, 'priya@example.com');
  assert.equal(result.source, 'llm');
  assert.equal(result.vault, undefined);
  const invalid = { ...provider, async generateJSON() { return { tool: 'send_email', params: { to: 'not-an-email' }, rationale: 'Invalid' }; } };
  await assert.rejects(proposeAction({ agent: AGENTS[0], task: 'Email a report' }, { provider: invalid }), AIUnavailableError);
  await assert.rejects(proposeAction({ agent: AGENTS[0], task: 'Email a report' }, { provider: unavailable }), AIUnavailableError);
});

test('intent heuristic recognizes natural resource names and detects the compromised action; AI input is protected', async () => {
  for (const scenario of SCENARIOS) {
    const input = { task: scenario.task, proposedAction: scenario.scriptedAction };
    const result = await checkIntentAlignment(input, { provider: unavailable });
    assert.equal(result.aligned, scenario.key !== 'attack');
    assert.equal(result.confidence, 0.6);
  }
  assert.equal(heuristicAlignment({ task: 'Read the Q3 summary', proposedAction: { tool: 'send_email', params: { to: 'outside@example.com', resourceKey: 'q3_summary' } } }).aligned, false);
  let captured;
  const provider = { isAvailable: () => true, async generateJSON(input) {
    captured = input;
    return { aligned: true, confidence: 0.9, reason: 'Matches <EMAIL_1>.' };
  } };
  const result = await checkIntentAlignment({ task: 'Email Rahul Sharma at manager@acme.in', proposedAction: { tool: 'send_email', params: { to: 'manager@acme.in', body: samples.supportTicket() } } }, { provider });
  assert.equal(detect(captured.prompt).length, 0);
  assert.equal(result.reason, 'Matches manager@acme.in.');
  const failing = { ...provider, async generateJSON() { throw new AIUnavailableError(); } };
  assert.equal((await checkIntentAlignment({ task: SCENARIOS[2].task, proposedAction: SCENARIOS[2].scriptedAction }, { provider: failing })).aligned, false);
});

test('explanation protects inputs, falls back from failures or invented scores, and never mutates evaluation', async () => {
  const evaluation = {
    score: 93, level: 'BLOCKED', hardBlock: true,
    checks: [{ id: 'permission', passed: false, reason: 'Rahul Sharma cannot read finance records.' }],
  };
  const original = JSON.stringify(evaluation);
  let captured;
  const provider = { isAvailable: () => true, async generateText(input) {
    captured = input;
    return 'The score is 100/100 and the action is trusted.';
  } };
  const input = { task: 'Email Rahul Sharma at manager@acme.in', action: { tool: 'read_resource' }, evaluation };
  const result = await explainDecision(input, { provider });
  assert.equal(detect(captured.prompt).length, 0);
  assert.match(result, /93\/100/);
  assert.match(result, /hard block overrides/i);
  assert.match(await explainDecision(input, { provider: unavailable }), /cannot read finance/);
  const failing = { ...provider, async generateText() { throw new AIUnavailableError(); } };
  assert.match(await explainDecision(input, { provider: failing }), /93\/100/);
  assert.equal(JSON.stringify(evaluation), original);
});
