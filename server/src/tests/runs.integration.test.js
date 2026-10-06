import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from '../seed/seedDatabase.js';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { createGeminiClient, AIUnavailableError } from '../services/ai/gemini.client.js';
import { detect, samples } from '../lib/detector.js';

const config = {
  JWT_SECRET: 'run-integration-test-only-secret-at-least-32-characters', JWT_EXPIRES_IN: '7d',
  CLIENT_ORIGINS: ['http://localhost:5173'], NODE_ENV: 'test',
  GEMINI_API_KEY: '', GEMINI_MODEL: 'gemini-3.6-flash', DEMO_MODE: 'false',
};
const servers = [];
let database;
let baseUrl;
let token;

async function openApp(aiProvider) {
  const server = createApp(config, aiProvider ? { aiProvider } : {}).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function request(url, path, body = {}, authenticated = true) {
  const response = await fetch(`${url}${path}`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDatabase(database.getUri('trustlens_runs_test'));
  await seedDatabase();
  baseUrl = await openApp();
  const login = await request(baseUrl, '/api/auth/login', { email: 'demo@trustlens.app', password: 'Demo@1234' }, false);
  assert.equal(login.status, 200);
  token = login.body.data.token;
}, { timeout: 120000 });

after(async () => {
  for (const server of servers) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
    });
  }
  await disconnectDatabase();
  await database?.stop();
});

test('all four scenarios complete without a key: execute, queue, or block with template explanations', async () => {
  for (const [key, status, level] of [
    ['normal', 'executed', 'TRUSTED'], ['grey', 'pending_approval', 'SUSPICIOUS'],
    ['attack', 'blocked', 'BLOCKED'], ['permission', 'blocked', 'BLOCKED'],
  ]) {
    const result = await request(baseUrl, `/api/scenarios/${key}/run`);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const data = result.body.data;
    assert.equal(data.source, 'scripted');
    assert.equal(data.action.status, status);
    assert.equal(data.action.evaluation.level, level);
    assert.equal(data.intentAlignment.confidence, 0.6);
    assert.ok(data.action.evaluation.explanation);
    assert.equal(Boolean(data.outboxId), status === 'executed');
    const privateFields = {
      task: data.action.task, params: data.action.params, payload: data.action.tokenizedPayload,
      checks: data.action.evaluation.checks, explanation: data.action.evaluation.explanation,
    };
    assert.equal(detect(JSON.stringify(privateFields)).length, 0);
    if (key === 'attack') {
      assert.equal(data.action.evaluation.hardBlock, true);
      assert.equal(data.action.privacy.counts.AADHAAR, 40);
      assert.equal(data.intentAlignment.aligned, false);
    }
    if (key === 'permission') {
      assert.ok(data.action.evaluation.score >= 75);
      assert.equal(data.action.evaluation.hardBlock, true);
    }
  }
  assert.equal(await Action.countDocuments(), 4);
  assert.equal(await AuditLog.countDocuments(), 16);
  assert.equal(await OutboxItem.countDocuments(), 1);
  assert.equal((await OutboxItem.findOne()).to, 'manager@acme.in');
});

test('available AI can assess intent and explain but never substitutes the scripted action', async () => {
  const calls = [];
  const provider = {
    isAvailable: () => true,
    async generateJSON(input) {
      calls.push('intent');
      assert.ok(input.schema.properties.aligned, 'scenario unexpectedly asked AI to propose an action');
      return { aligned: true, confidence: 0.9, reason: 'The recipient and summary match.' };
    },
    async generateText(input) {
      calls.push('explain');
      const score = JSON.parse(input.prompt).evaluation.score;
      return `The computed score is ${score}/100. The checks allow this internal summary email.`;
    },
  };
  const url = await openApp(provider);
  const result = await request(url, '/api/scenarios/normal/run');
  assert.equal(result.status, 201);
  assert.equal(result.body.data.source, 'scripted');
  assert.equal(result.body.data.proposedAction.tool, 'send_email');
  assert.deepEqual(calls, ['intent', 'explain']);
});

test('free-text uses the SDK-backed provider, validates restored JSON, and keeps private data out of SDK requests and Action', async () => {
  const calls = [];
  const provider = createGeminiClient({ ...config, GEMINI_API_KEY: 'fake-key-for-mocked-sdk-only' }, {
    client: { models: { async generateContent(input) {
      calls.push(input);
      if (input.config.responseSchema?.properties.tool) {
        const task = JSON.parse(input.contents).task;
        return { text: JSON.stringify({
          tool: 'send_email', params: { to: task.match(/<EMAIL_\d+>/)[0], subject: 'Q3 Sales Summary', body: 'Report attached.', resourceKey: 'q3_summary' },
          rationale: 'User requested an internal summary email.',
        }) };
      }
      if (input.config.responseSchema?.properties.aligned) {
        return { text: JSON.stringify({ aligned: true, confidence: 0.9, reason: 'The action matches <EMAIL_1> and the Q3 summary.' }) };
      }
      const score = JSON.parse(input.contents).evaluation.score;
      return { text: `The score is ${score}/100. The checks permit the requested internal summary email.` };
    } } },
  });
  const url = await openApp(provider);
  const aadhaar = samples.aadhaar();
  const result = await request(url, '/api/agents/sales-assistant/run', {
    task: `Send the Q3 sales summary to manager@acme.in. Rahul Sharma's Aadhaar ${aadhaar} is private context.`,
    contextDocumentKey: 'inbound_email_injection',
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.source, 'llm');
  assert.equal(result.body.data.action.status, 'executed');
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(detect(call.contents).length, 0);
    assert.equal(detect(call.config.systemInstruction).length, 0);
    assert.ok(!call.contents.includes(aadhaar));
    assert.ok(!call.contents.includes('manager@acme.in'));
  }
  const stored = await Action.findById(result.body.data.action._id).lean();
  assert.ok(!JSON.stringify(stored).includes(aadhaar));
  assert.ok(!JSON.stringify(stored).includes('Rahul Sharma'));
  assert.ok(!JSON.stringify(stored).includes('manager@acme.in'));
  assert.match(stored.task, /<AADHAAR_1>/);
  const outbox = await OutboxItem.findById(result.body.data.outboxId);
  assert.equal(outbox.to, 'manager@acme.in');
});

test('missing AI fails free-text helpfully without writes, and demo mode works even with a configured key', async () => {
  const before = await Action.countDocuments();
  const missing = await request(baseUrl, '/api/agents/sales-assistant/run', { task: 'Email the Q3 summary to manager@acme.in' });
  assert.equal(missing.status, 503);
  assert.equal(missing.body.error.code, 'AI_UNAVAILABLE');
  assert.match(missing.body.error.message, /GEMINI_API_KEY/);
  assert.equal(await Action.countDocuments(), before);
  const disabled = createGeminiClient({ ...config, GEMINI_API_KEY: 'not-a-real-key', DEMO_MODE: 'true' }, {
    client: { models: { generateContent() { assert.fail('demo mode contacted SDK'); } } },
  });
  const url = await openApp(disabled);
  const scenario = await request(url, '/api/scenarios/attack/run');
  assert.equal(scenario.status, 201);
  assert.equal(scenario.body.data.action.evaluation.hardBlock, true);
});

test('provider failure keeps scenarios working through heuristic and explanation fallbacks', async () => {
  const failing = {
    isAvailable: () => true,
    async generateJSON() { throw new AIUnavailableError(); },
    async generateText() { throw new AIUnavailableError(); },
  };
  const result = await request(await openApp(failing), '/api/scenarios/grey/run');
  assert.equal(result.status, 201);
  assert.equal(result.body.data.action.status, 'pending_approval');
  assert.equal(result.body.data.intentAlignment.confidence, 0.6);
  assert.match(result.body.data.action.evaluation.explanation, /requires human approval/);
  assert.equal(result.body.data.outboxId, null);
});

test('all scripted scenarios survive unexpected provider transport or SDK errors', async () => {
  const failing = {
    isAvailable: () => true,
    async generateJSON() { throw new Error('SDK transport failure'); },
    async generateText() { throw new TypeError('SDK response failure'); },
  };
  const url = await openApp(failing);
  for (const [key, status] of [['normal', 'executed'], ['grey', 'pending_approval'], ['attack', 'blocked'], ['permission', 'blocked']]) {
    const result = await request(url, `/api/scenarios/${key}/run`);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.status, status);
    assert.equal(result.body.data.source, 'scripted');
    assert.equal(result.body.data.intentAlignment.confidence, .6);
    assert.ok(result.body.data.evaluation.explanation);
  }
});

test('run endpoints enforce auth, strict bodies, lookups, and context permissions', async () => {
  assert.equal((await request(baseUrl, '/api/scenarios/normal/run', {}, false)).status, 401);
  assert.equal((await request(baseUrl, '/api/scenarios/unknown/run')).status, 404);
  assert.equal((await request(baseUrl, '/api/scenarios/normal/run', { scriptedAction: { tool: 'http_request' } })).status, 400);
  assert.equal((await request(baseUrl, '/api/agents/sales-assistant/run', { task: '' })).status, 400);
  assert.equal((await request(baseUrl, '/api/agents/missing-agent/run', { task: 'Read a report' })).status, 404);
  const never = { isAvailable: () => true, async generateJSON() { assert.fail('forbidden context reached AI'); } };
  const result = await request(await openApp(never), '/api/agents/sales-assistant/run', { task: 'Read a report', contextDocumentKey: 'customer_master' });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, 'CONTEXT_NOT_ALLOWED');
});

test('execution receipt failure rolls back the action and audit writes atomically', async (context) => {
  const before = await Promise.all([Action.countDocuments(), AuditLog.countDocuments(), OutboxItem.countDocuments()]);
  context.mock.method(OutboxItem, 'create', async () => { throw new Error('simulated receipt write failure'); });
  const result = await request(baseUrl, '/api/scenarios/normal/run');
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, 'INTERNAL_ERROR');
  const after = await Promise.all([Action.countDocuments(), AuditLog.countDocuments(), OutboxItem.countDocuments()]);
  assert.deepEqual(after, before);
});
