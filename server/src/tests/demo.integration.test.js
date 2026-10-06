import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Action } from '../models/Action.js';
import { Agent } from '../models/Agent.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { Policy } from '../models/Policy.js';
import { Resource } from '../models/Resource.js';
import { User } from '../models/User.js';
import { seedDatabase } from '../seed/seedDatabase.js';

const config = {
  JWT_SECRET: 'demo-reset-test-only-secret-at-least-32-characters', JWT_EXPIRES_IN: '7d',
  CLIENT_ORIGINS: ['https://trustlens-judging.vercel.app'], NODE_ENV: 'test', DEMO_MODE: 'true',
};
let database, server, baseUrl, token, viewerToken, approverToken;

function sign(user) {
  return jwt.sign({}, config.JWT_SECRET, { subject: user.id, issuer: 'trustlens', algorithm: 'HS256', expiresIn: '1h' });
}
async function request(path, { body = {}, auth = token, method = 'POST' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function counts() {
  return Promise.all([Action, OutboxItem, AuditLog].map((model) => model.countDocuments()));
}

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(database.getUri('trustlens_reset_test'));
  await seedDatabase();
  token = sign(await User.findOne({ email: 'demo@trustlens.app' }));
  viewerToken = sign(await User.create({ name: 'Viewer', email: 'viewer@reset.test', passwordHash: 'test-unused-password-hash', role: 'viewer' }));
  approverToken = sign(await User.create({ name: 'Approver', email: 'approver@reset.test', passwordHash: 'test-unused-password-hash', role: 'approver' }));
  server = createApp(config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (const scenarioKey of ['normal', 'grey', 'attack', 'permission']) {
    assert.equal((await request('/api/agent/run', { body: { scenarioKey } })).status, 201);
  }
}, { timeout: 120000 });

after(async () => {
  if (server) await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
  await disconnectDatabase();
  await database?.stop();
});

test('demo reset requires authentication and an admin, including for an approver', async () => {
  const before = await counts();
  assert.equal((await request('/api/demo/reset', { auth: null })).status, 401);
  for (const auth of [viewerToken, approverToken]) assert.equal((await request('/api/demo/reset', { auth })).status, 403);
  assert.deepEqual(await counts(), before);
});

test('demo reset validates its empty body and rejects unknown fields without deleting history', async () => {
  const before = await counts();
  const result = await request('/api/demo/reset', { body: { force: true } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(await counts(), before);
});

test('failed reseeding atomically rolls back history deletion and catalog changes', async (context) => {
  const before = await counts();
  const agents = await Agent.find().sort({ key: 1 }).lean();
  const resources = await Resource.find().select('+content').sort({ key: 1 }).lean();
  context.mock.method(Resource, 'insertMany', async () => { throw new Error('Injected reseed failure'); });
  const result = await request('/api/demo/reset');
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, 'INTERNAL_ERROR');
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await Agent.find().sort({ key: 1 }).lean(), agents);
  assert.deepEqual(await Resource.find().select('+content').sort({ key: 1 }).lean(), resources);
});

test('admin reset clears history, restores seeded catalogs, preserves users/agent IDs, and keeps the session valid', async () => {
  const agents = await Agent.find().sort({ key: 1 }).lean();
  await Policy.updateMany({}, { enabled: false });
  const result = await request('/api/demo/reset');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.error, null);
  assert.deepEqual(result.body.data.cleared, { actions: 4, outbox: 1, audit: 16 });
  assert.deepEqual(await counts(), [0, 0, 0]);
  assert.deepEqual(result.body.data.seeded, { agents: 3, policies: 4, resources: 5, demoEmail: 'demo@trustlens.app' });
  assert.ok(Number.isFinite(Date.parse(result.body.data.resetAt)));
  assert.equal(await Agent.countDocuments(), 3);
  assert.equal(await Policy.countDocuments({ enabled: true }), 4);
  assert.equal(await Resource.countDocuments(), 5);
  assert.equal(await User.countDocuments(), 3);
  assert.deepEqual((await Agent.find().sort({ key: 1 }).lean()).map((agent) => String(agent._id)), agents.map((agent) => String(agent._id)));
  assert.equal((await request('/api/auth/me', { method: 'GET' })).status, 200);
  const stats = await request('/api/stats', { method: 'GET' });
  assert.equal(stats.body.data.totals.evaluated, 0);
  assert.equal(stats.body.data.last24h.length, 24);
  const login = await request('/api/auth/login', { auth: null, body: { email: 'demo@trustlens.app', password: 'Demo@1234' } });
  assert.equal(login.status, 200);
});

test('demo reset is repeatable, rate-limited, and followed by a working scenario', async () => {
  const again = await request('/api/demo/reset');
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.data.cleared, { actions: 0, outbox: 0, audit: 0 });
  assert.ok(again.headers.get('ratelimit'));
  const run = await request('/api/agent/run', { body: { scenarioKey: 'normal' } });
  assert.equal(run.status, 201);
  assert.equal(run.body.data.status, 'executed');
  // The invalid-body and failed-transaction attempts also consume reset rate budget.
  for (let attempt = 0; attempt < 6; attempt++) assert.equal((await request('/api/demo/reset')).status, 200);
  const limited = await request('/api/demo/reset');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(limited.headers.get('retry-after'));
  assert.equal((await request('/health', { method: 'GET', auth: null })).status, 200);
});
