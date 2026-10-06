import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { Agent } from '../models/Agent.js';
import { Policy } from '../models/Policy.js';
import { Resource } from '../models/Resource.js';
import { seedDatabase } from '../seed/seedDatabase.js';
import { scanResidual, validators } from '../lib/detector.js';
import { SCENARIOS } from '../lib/demoData.js';
import { Action } from '../models/Action.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { buildContext } from '../services/trust.service.js';

const execFileAsync = promisify(execFile);
const config = {
  JWT_SECRET: 'integration-test-only-secret-of-at-least-32-characters',
  JWT_EXPIRES_IN: '7d',
  CLIENT_URL: 'http://localhost:5173',
  CLIENT_ORIGINS: ['http://localhost:5173'],
  NODE_ENV: 'test',
};
let database;
let server;
let baseUrl;
let demoToken;

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function closeServer(instance) {
  await new Promise((resolve, reject) => {
    instance.close((error) => error ? reject(error) : resolve());
    instance.closeIdleConnections();
  });
}

before(async () => {
  database = await MongoMemoryServer.create({ instance: { dbName: 'trustlens_integration' } });
  config.MONGODB_URI = database.getUri();
  await connectDatabase(config.MONGODB_URI);
  await seedDatabase();
  server = createApp(config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 120000 });

after(async () => {
  if (server) await closeServer(server);
  await disconnectDatabase();
  await database?.stop();
});

test('the seed CLI is idempotent and leaves the existing demo account intact', async () => {
  const original = await User.findOne({ email: 'demo@trustlens.app' }).select('+passwordHash');
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  for (let run = 0; run < 2; run += 1) {
    const { stdout } = await execFileAsync(process.execPath, ['src/seed/seed.js'], {
      cwd,
      env: { ...process.env, ...config, NODE_OPTIONS: '', GEMINI_API_KEY: '' },
    });
    assert.match(stdout, /Seed complete: 3 agents, 4 policies, 5 resources/);
  }
  assert.equal(await Agent.countDocuments(), 3);
  assert.equal(await Policy.countDocuments(), 4);
  assert.equal(await Resource.countDocuments(), 5);
  assert.equal(await User.countDocuments({ email: 'demo@trustlens.app' }), 1);
  const demo = await User.findOne({ email: 'demo@trustlens.app' }).select('+passwordHash');
  assert.equal(demo.id, original.id);
  assert.equal(demo.passwordHash, original.passwordHash);
  assert.equal(await bcrypt.compare('Demo@1234', demo.passwordHash), true);
  const master = await Resource.findOne({ key: 'customer_master' }).select('+content');
  assert.equal(master.content.split('\n').length, 41);
  assert.equal(master.recordCount, 40);
  for (const row of master.content.split('\n').slice(1)) {
    assert.equal(validators.verhoeffValid(row.split(',')[1].replace(/\s/g, '')), true);
  }
});

test('registration normalizes email, hashes at cost 10, and never returns the password', async () => {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { name: '  Test Admin  ', email: '  TEST@EXAMPLE.COM  ', password: 'Test@1234' },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.error, null);
  assert.equal(result.body.data.user.email, 'test@example.com');
  assert.equal(result.body.data.user.name, 'Test Admin');
  assert.equal(result.body.data.user.role, 'admin');
  assert.equal(result.body.data.user.passwordHash, undefined);
  assert.equal(result.body.data.user.password, undefined);
  const stored = await User.findOne({ email: 'test@example.com' }).select('+passwordHash');
  assert.notEqual(stored.passwordHash, 'Test@1234');
  assert.equal(bcrypt.getRounds(stored.passwordHash), 10);
  assert.equal(await bcrypt.compare('Test@1234', stored.passwordHash), true);
  const me = await request('/api/auth/me', { token: result.body.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user._id, stored.id);
});

test('duplicate registration and invalid bodies produce structured client errors', async () => {
  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test Admin', email: 'TEST@example.com', password: 'Test@1234' },
  });
  assert.equal(duplicate.status, 409);
  for (const body of [
    { name: 'Test', email: 'valid@example.com', password: 'short' },
    { name: 'Test', email: 'not-an-email', password: 'Test@1234' },
    { name: 'Test', email: 'valid@example.com', password: 'é'.repeat(37) },
    { name: 'Test', email: 'valid@example.com', password: 'Test@1234', role: 'approver' },
  ]) {
    const result = await request('/api/auth/register', { method: 'POST', body });
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.data, null);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('simultaneous registrations cannot create duplicate users', async () => {
  const body = { name: 'Concurrent Test', email: 'concurrent@example.com', password: 'Test@1234' };
  const results = await Promise.all([
    request('/api/auth/register', { method: 'POST', body }),
    request('/api/auth/register', { method: 'POST', body }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: body.email }), 1);
});

test('demo login issues a usable JWT; wrong credentials are rejected', async () => {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'DEMO@trustlens.app', password: 'Demo@1234' },
  });
  assert.equal(result.status, 200);
  demoToken = result.body.data.token;
  assert.equal(typeof demoToken, 'string');
  assert.equal(result.body.data.user.passwordHash, undefined);
  const me = await request('/api/auth/me', { token: demoToken });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, 'demo@trustlens.app');
  for (const email of ['demo@trustlens.app', 'missing@example.com']) {
    const wrong = await request('/api/auth/login', {
      method: 'POST', body: { email, password: 'Incorrect@1234' },
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
  }
});

test('protected routes reject missing, expired, forged, and invalid-subject tokens', async () => {
  for (const path of ['/api/auth/me', '/api/agents', '/api/policies', '/api/resources', '/api/scenarios']) {
    const result = await request(path);
    assert.equal(result.status, 401);
    assert.equal(result.body.error.code, 'UNAUTHORIZED');
  }
  const user = await User.findOne({ email: 'demo@trustlens.app' });
  const options = { subject: user.id, issuer: 'trustlens', algorithm: 'HS256' };
  const tokens = [
    'broken-token',
    jwt.sign({}, config.JWT_SECRET, { ...options, expiresIn: -1 }),
    jwt.sign({}, 'different-test-key', options),
    jwt.sign({}, config.JWT_SECRET, { ...options, algorithm: 'HS384' }),
    jwt.sign({}, config.JWT_SECRET, { ...options, subject: 'invalid-id' }),
    jwt.sign({}, config.JWT_SECRET, { ...options, subject: '000000000000000000000000' }),
  ];
  for (const token of tokens) {
    const result = await request('/api/auth/me', { token });
    assert.equal(result.status, 401);
    assert.equal(result.body.error.code, 'INVALID_TOKEN');
  }
});

test('catalog endpoints return seeded data and resources expose metadata only', async () => {
  const agents = await request('/api/agents', { token: demoToken });
  assert.equal(agents.status, 200);
  assert.equal(agents.body.data.length, 3);
  assert.deepEqual(agents.body.data.map((agent) => agent.key).sort(), [
    'hr-assistant', 'sales-assistant', 'support-agent',
  ]);
  const policies = await request('/api/policies', { token: demoToken });
  assert.equal(policies.status, 200);
  assert.equal(policies.body.data.length, 4);
  const resources = await request('/api/resources?fields=content', { token: demoToken });
  assert.equal(resources.status, 200);
  assert.equal(resources.body.data.length, 5);
  for (const resource of resources.body.data) {
    assert.deepEqual(Object.keys(resource).sort(), ['dataClass', 'key', 'name', 'recordCount']);
  }
  assert.equal(resources.body.data.find((resource) => resource.key === 'customer_master').recordCount, 40);
});

test('scenarios are served from code with only the six public metadata fields', async () => {
  const result = await request('/api/scenarios', { token: demoToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 4);
  assert.deepEqual(result.body.data.map((scenario) => scenario.key), SCENARIOS.map((scenario) => scenario.key));
  for (const scenario of result.body.data) {
    assert.deepEqual(Object.keys(scenario).sort(), ['agentKey', 'emoji', 'key', 'subtitle', 'task', 'title']);
  }
});

test('customer master to personal email is hard-blocked with tokenized data and no execution', async () => {
  const body = {
    agentKey: 'sales-assistant', tool: 'send_email',
    params: { to: 'backup.team@protonmail.com' }, resourceKey: 'customer_master',
  };
  const unauthorized = await request('/api/trust/evaluate', { method: 'POST', body });
  assert.equal(unauthorized.status, 401);
  const result = await request('/api/trust/evaluate', { method: 'POST', body, token: demoToken });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  const evaluation = result.body.data;
  assert.equal(evaluation.level, 'BLOCKED');
  assert.equal(evaluation.hardBlock, true);
  assert.equal(evaluation.privacy.counts.AADHAAR, 40);
  assert.equal(evaluation.privacy.counts.PAN, 40);
  assert.deepEqual(Object.keys(evaluation.privacy).sort(), ['counts', 'entityTypes']);
  assert.equal(evaluation.checks.find((check) => check.id === 'permission').hardBlock, true);
  const policy = evaluation.checks.find((check) => check.id === 'policy');
  assert.equal(policy.hardBlock, true);
  assert.match(policy.reason, /Aadhaar numbers must never leave acme\.in/);
  assert.match(policy.reason, /No company data to personal email/);
  assert.match(evaluation.checks.find((check) => check.id === 'recipient').reason, /personal email/);
  assert.match(evaluation.tokenizedPayload, /<AADHAAR_1>/);
  assert.equal(scanResidual(evaluation.tokenizedPayload).length, 0);
  assert.equal(evaluation.vault, undefined);
  assert.equal(evaluation.entities, undefined);
  assert.equal(evaluation.rawPayload, undefined);
  assert.equal(await Action.countDocuments(), 0);
  assert.equal(await OutboxItem.countDocuments(), 0);
});

test('all four scripted scenarios retain engine levels through the HTTP API, including high-score blocks', async () => {
  for (const scenario of SCENARIOS) {
    const result = await request('/api/trust/evaluate', {
      method: 'POST', token: demoToken,
      body: {
        agentKey: scenario.agentKey,
        tool: scenario.scriptedAction.tool,
        params: scenario.scriptedAction.params,
        intentAlignment: scenario.intent,
      },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.level, scenario.expected);
    assert.equal(scanResidual(result.body.data.tokenizedPayload).length, 0);
    if (scenario.key === 'permission') {
      assert.ok(result.body.data.score >= 75);
      assert.equal(result.body.data.hardBlock, true);
    }
    if (scenario.key === 'attack') {
      assert.match(result.body.data.checks.find((check) => check.id === 'intent').reason, /possible prompt injection/);
    }
  }
});

test('trust context reads current database permissions and enabled policies', async () => {
  const body = {
    agentKey: 'sales-assistant', tool: 'send_email',
    params: { to: 'backup.team@protonmail.com' }, resourceKey: 'q3_summary',
  };
  const before = await request('/api/trust/evaluate', { method: 'POST', token: demoToken, body });
  await Policy.updateOne({ key: 'no_personal_email' }, { enabled: false });
  try {
    const context = await buildContext();
    assert.equal(context.agents.length, 3);
    assert.equal(context.policies.length, 3);
    assert.deepEqual(context.org.internalDomains, ['acme.in']);
    const after = await request('/api/trust/evaluate', { method: 'POST', token: demoToken, body });
    assert.equal(after.status, 200);
    assert.equal(after.body.data.score - before.body.data.score, 20);
    assert.doesNotMatch(after.body.data.checks.find((check) => check.id === 'policy').reason, /No company data to personal email/);
    await Agent.updateOne({ key: 'sales-assistant' }, { $pull: { allowedTools: 'send_email' } });
    const revoked = await request('/api/trust/evaluate', { method: 'POST', token: demoToken, body });
    assert.equal(revoked.body.data.hardBlock, true);
    assert.equal(revoked.body.data.checks.find((check) => check.id === 'permission').hardBlock, true);
  } finally {
    await Policy.updateOne({ key: 'no_personal_email' }, { enabled: true });
    await Agent.updateOne({ key: 'sales-assistant' }, { $addToSet: { allowedTools: 'send_email' } });
  }
});

test('trust requests validate tool-specific params, resource keys, and intent, and return explicit lookup errors', async () => {
  const valid = {
    agentKey: 'sales-assistant', tool: 'send_email', params: { to: 'manager@acme.in' },
  };
  for (const body of [
    { ...valid, tool: 'real_email' },
    { ...valid, params: {} },
    { ...valid, params: { to: 42 } },
    { ...valid, params: { to: 'not-an-email' } },
    { ...valid, params: { to: 'manager@acme.in', channel: '#general' } },
    { ...valid, intentAlignment: { aligned: false, confidence: 1.1 } },
    { ...valid, intentAlignment: { aligned: 'true' } },
    { ...valid, resourceKey: 'q3_summary', params: { to: 'manager@acme.in', resourceKey: 'customer_master' } },
    { ...valid, score: 100 },
    { ...valid, tool: 'read_resource', params: {} },
  ]) {
    const result = await request('/api/trust/evaluate', { method: 'POST', token: demoToken, body });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
  for (const [body, code] of [
    [{ ...valid, agentKey: 'missing-agent' }, 'AGENT_NOT_FOUND'],
    [{ ...valid, resourceKey: 'missing_resource' }, 'RESOURCE_NOT_FOUND'],
  ]) {
    const result = await request('/api/trust/evaluate', { method: 'POST', token: demoToken, body });
    assert.equal(result.status, 404);
    assert.equal(result.body.error.code, code);
  }
});

test('authentication rate limits share a 20-attempt budget and leave /me accessible', async () => {
  const limitedServer = createApp(config).listen(0, '127.0.0.1');
  await new Promise((resolve) => limitedServer.once('listening', resolve));
  const url = `http://127.0.0.1:${limitedServer.address().port}`;
  try {
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const path = attempt % 2 === 0 ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${url}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      assert.equal(response.status, attempt < 20 ? 400 : 429);
      if (attempt === 20) {
        assert.equal((await response.json()).error.code, 'RATE_LIMITED');
        assert.ok(response.headers.get('retry-after'));
      }
    }
    const me = await fetch(`${url}/api/auth/me`, { headers: { Authorization: `Bearer ${demoToken}` } });
    assert.equal(me.status, 200);
  } finally {
    await closeServer(limitedServer);
  }
});
