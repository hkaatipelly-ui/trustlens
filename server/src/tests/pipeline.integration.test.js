import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { Resource } from '../models/Resource.js';
import { User } from '../models/User.js';
import { seedDatabase } from '../seed/seedDatabase.js';
import { detect } from '../lib/detector.js';
import { decideStatus } from '../services/decision.service.js';
import { getStats } from '../services/stats.service.js';

const config = {
  JWT_SECRET: 'pipeline-test-only-secret-with-more-than-32-characters', JWT_EXPIRES_IN: '7d',
  CLIENT_ORIGINS: ['http://localhost:5173'], NODE_ENV: 'test', GEMINI_API_KEY: '', DEMO_MODE: 'true',
};
const stages = ['propose', 'privacy', 'permission', 'sensitivity', 'recipient', 'destination', 'behavior', 'policy', 'intent', 'decision'];
const servers = [];
const scenarios = new Map();
let database;
let baseUrl;
let token;
let approver;
let approverToken;
let viewerToken;

async function openApp(aiProvider) {
  const server = createApp(config, { aiProvider }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function request(path, { method = 'GET', body, auth = token, url = baseUrl } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function scenario(key = 'grey') {
  const result = await request('/api/agent/run', { method: 'POST', body: { scenarioKey: key } });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data;
}

function sign(user) {
  return jwt.sign({}, config.JWT_SECRET, { subject: user.id, issuer: 'trustlens', algorithm: 'HS256', expiresIn: '1h' });
}

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDatabase(database.getUri('trustlens_pipeline_test'));
  await seedDatabase();
  baseUrl = await openApp();
  token = sign(await User.findOne({ email: 'demo@trustlens.app' }));
  approver = await User.create({ name: 'Reviewer', email: 'reviewer@example.com', passwordHash: 'test-only-not-used-for-login', role: 'approver' });
  approverToken = sign(approver);
  viewerToken = sign(await User.create({ name: 'Viewer', email: 'viewer@example.com', passwordHash: 'test-only-not-used-for-login', role: 'viewer' }));
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

test('decision boundaries use code, with hard blocks overriding high scores', () => {
  for (const [score, status] of [[0, 'blocked'], [39, 'blocked'], [40, 'pending_approval'], [74, 'pending_approval'], [75, 'executed'], [100, 'executed']]) {
    assert.equal(decideStatus({ score, hardBlock: false }), status);
  }
  assert.equal(decideStatus({ score: 100, hardBlock: true }), 'blocked');
});

test('empty stats return zeros and a complete 24-hour series', async () => {
  const result = await request('/api/stats');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.totals, { evaluated: 0, trusted: 0, suspicious: 0, unsafe: 0, blocked: 0 });
  assert.equal(result.body.data.avgScore, 0);
  assert.equal(result.body.data.piiItemsShielded, 0);
  assert.deepEqual(result.body.data.byAgent, []);
  assert.equal(result.body.data.last24h.length, 24);
  assert.ok(result.body.data.last24h.every((item) => item.count === 0));
});

test('unified run returns the four required outcomes, monotonic timeline, and four audit stages', async () => {
  for (const [key, status] of [['normal', 'executed'], ['grey', 'pending_approval'], ['attack', 'blocked'], ['permission', 'blocked']]) {
    const data = await scenario(key);
    scenarios.set(key, data);
    assert.equal(data.status, status);
    assert.equal(data.action.status, status);
    assert.equal(data.evaluation.score, data.action.evaluation.score);
    assert.equal(data.evaluation.level, data.action.evaluation.level);
    assert.deepEqual(data.timeline.map((item) => item.stage), stages);
    data.timeline.forEach((item, index) => {
      assert.ok(item.label);
      assert.ok(Number.isFinite(item.ms) && item.ms >= 0);
      if (index) assert.ok(item.ms >= data.timeline[index - 1].ms);
    });
    if (key === 'normal') assert.ok(data.evaluation.score >= 75);
    if (key === 'grey') assert.ok(data.evaluation.score >= 40 && data.evaluation.score < 75);
    if (key === 'attack' || key === 'permission') assert.equal(data.evaluation.hardBlock, true);
    assert.equal(Boolean(data.outboxItem), status === 'executed');
    const logs = await AuditLog.find({ actionRef: data.action._id }).sort({ _id: 1 }).lean();
    assert.deepEqual(logs.map((log) => log.event), [
      'action.proposed', 'privacy.scanned', 'trust.evaluated',
      status === 'pending_approval' ? 'action.queued' : `action.${status}`,
    ]);
    assert.ok(Number.isFinite(logs[2].details.evaluationMs));
    assert.equal(detect(JSON.stringify({ task: data.action.task, params: data.action.params, evaluation: data.evaluation })).length, 0);
  }
});

test('history, pending queue, outbox, and audit lists are newest-first and bounded', async () => {
  const all = await request('/api/actions?limit=2');
  assert.equal(all.status, 200);
  assert.equal(all.body.data.length, 2);
  assert.equal(all.body.data[0]._id, scenarios.get('permission').action._id);
  assert.equal(all.body.data[0].agent.name, 'HR Assistant');
  const pending = await request('/api/approvals/pending');
  assert.equal(pending.body.data.length, 1);
  assert.equal(pending.body.data[0]._id, scenarios.get('grey').action._id);
  const filtered = await request('/api/actions?status=blocked');
  assert.equal(filtered.body.data.length, 2);
  const outbox = await request('/api/outbox');
  assert.equal(outbox.body.data.length, 1);
  const audit = await request('/api/audit?limit=3');
  assert.equal(audit.body.data.length, 3);
  assert.equal(audit.body.data[0].event, 'action.blocked');
  const detail = await request(`/api/actions/${scenarios.get('grey').action._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.agent.name, 'Sales Assistant');
});

test('stats count evaluation levels, shielded entities, agent aggregates, and recent hourly activity', async () => {
  const result = await request('/api/stats');
  const data = result.body.data;
  assert.deepEqual(data.totals, { evaluated: 4, trusted: 1, suspicious: 1, unsafe: 0, blocked: 2 });
  const evaluated = [...scenarios.values()].map((item) => item.evaluation);
  assert.equal(data.avgScore, Number((evaluated.reduce((sum, item) => sum + item.score, 0) / 4).toFixed(2)));
  const shielded = evaluated.reduce((sum, item) => sum + Object.values(item.privacy.counts).reduce((total, count) => total + count, 0), 0);
  assert.equal(data.piiItemsShielded, shielded);
  assert.equal(data.byAgent.find((row) => row.agent === 'Sales Assistant').count, 2);
  assert.equal(data.last24h.length, 24);
  assert.equal(data.last24h.reduce((sum, row) => sum + row.count, 0), 4);
});

test('Redact & Send uses the queued snapshot, preserves checks, records the approver, and sends only tokens', async () => {
  const queued = scenarios.get('grey');
  const resource = await Resource.findOne({ key: 'customer_feedback' }).select('+content').lean();
  await Resource.updateOne({ _id: resource._id }, { content: 'Content changed after review.' });
  try {
    const result = await request(`/api/approvals/${queued.action._id}`, { method: 'POST', auth: approverToken, body: { decision: 'redact' } });
    assert.equal(result.status, 200);
    const data = result.body.data;
    assert.equal(data.status, 'redacted_sent');
    assert.equal(data.action.redacted, true);
    assert.equal(data.action.decidedBy, approver.id);
    assert.ok(Number.isFinite(Date.parse(data.action.decidedAt)));
    assert.equal(data.action.evaluation.score, queued.evaluation.score);
    assert.deepEqual(data.action.evaluation.checks, queued.action.evaluation.checks);
    assert.equal(data.outboxItem.redacted, true);
    assert.equal(data.outboxItem.bodyPreview, queued.action.tokenizedPayload);
    assert.match(data.outboxItem.bodyPreview, /<PHONE_1>/);
    assert.equal(detect(data.outboxItem.bodyPreview).length, 0);
    assert.equal(await OutboxItem.countDocuments({ action: queued.action._id }), 1);
    assert.equal(await AuditLog.countDocuments({ actionRef: queued.action._id, event: 'approval.redact' }), 1);
    const detail = await request(`/api/actions/${queued.action._id}`);
    assert.equal(detail.body.data.decidedBy.name, 'Reviewer');
  } finally {
    await Resource.updateOne({ _id: resource._id }, { content: resource.content });
  }
});

test('approve and deny finalize pending actions, with receipts only for approve', async () => {
  for (const [decision, status] of [['approve', 'approved'], ['deny', 'denied']]) {
    const queued = await scenario();
    const result = await request(`/api/approvals/${queued.action._id}`, { method: 'POST', body: { decision } });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, status);
    assert.equal(result.body.data.action.redacted, false);
    if (decision === 'approve') {
      assert.equal(result.body.data.outboxItem.redacted, false);
      assert.equal(result.body.data.outboxItem.bodyPreview, queued.action.tokenizedPayload);
    } else {
      assert.equal(result.body.data.outboxItem, undefined);
      assert.equal(await OutboxItem.countDocuments({ action: queued.action._id }), 0);
    }
    assert.equal(await AuditLog.countDocuments({ actionRef: queued.action._id, event: `approval.${decision}` }), 1);
    assert.equal((await request(`/api/approvals/${queued.action._id}`, { method: 'POST', body: { decision: 'approve' } })).status, 409);
  }
});

test('concurrent approval decisions commit once, with one receipt and one approval audit', async () => {
  const queued = await scenario();
  const results = await Promise.all(['approve', 'redact'].map((decision) => request(`/api/approvals/${queued.action._id}`, {
    method: 'POST', body: { decision },
  })));
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 409]);
  const winner = results.find((item) => item.status === 200).body.data;
  assert.equal(await OutboxItem.countDocuments({ action: queued.action._id }), 1);
  assert.equal(await AuditLog.countDocuments({ actionRef: queued.action._id, event: /^approval\./ }), 1);
  assert.equal((await Action.findById(queued.action._id)).status, winner.status);
});

test('receipt failure rolls back an approval so it remains pending without a decision record', async (context) => {
  const queued = await scenario();
  context.mock.method(OutboxItem, 'create', async () => { throw new Error('receipt failure'); });
  const result = await request(`/api/approvals/${queued.action._id}`, { method: 'POST', body: { decision: 'redact' } });
  assert.equal(result.status, 500);
  const stored = await Action.findById(queued.action._id);
  assert.equal(stored.status, 'pending_approval');
  assert.equal(stored.decidedBy, undefined);
  assert.equal(stored.decidedAt, undefined);
  assert.equal(await OutboxItem.countDocuments({ action: stored._id }), 0);
  assert.equal(await AuditLog.countDocuments({ actionRef: stored._id, event: /^approval\./ }), 0);
});

test('all new endpoints require auth; viewer approval, decided actions, and hard-block overrides are rejected', async () => {
  for (const [path, method, body] of [
    ['/api/agent/run', 'POST', { scenarioKey: 'normal' }], ['/api/actions', 'GET'],
    [`/api/actions/${scenarios.get('normal').action._id}`, 'GET'], ['/api/approvals/pending', 'GET'],
    [`/api/approvals/${scenarios.get('normal').action._id}`, 'POST', { decision: 'approve' }],
    ['/api/outbox', 'GET'], ['/api/audit', 'GET'], ['/api/stats', 'GET'],
  ]) {
    const result = await request(path, { method, body, auth: null });
    assert.equal(result.status, 401);
  }
  const queued = await scenario();
  assert.equal((await request(`/api/approvals/${queued.action._id}`, { method: 'POST', auth: viewerToken, body: { decision: 'approve' } })).status, 403);
  assert.equal((await Action.findById(queued.action._id)).status, 'pending_approval');
  assert.equal((await request('/api/actions', { auth: viewerToken })).status, 200);
  for (const key of ['normal', 'attack', 'permission']) {
    assert.equal((await request(`/api/approvals/${scenarios.get(key).action._id}`, { method: 'POST', body: { decision: 'approve' } })).status, 409);
  }
  const blockedId = scenarios.get('permission').action._id;
  await Action.updateOne({ _id: blockedId }, { status: 'pending_approval' });
  try {
    const result = await request(`/api/approvals/${blockedId}`, { method: 'POST', body: { decision: 'approve' } });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, 'ACTION_NOT_ELIGIBLE');
  } finally {
    await Action.updateOne({ _id: blockedId }, { status: 'blocked' });
  }
});

test('Zod rejects ambiguous runs, invalid IDs, decisions, filters, query arrays, and Mongo-style injection', async () => {
  for (const body of [{}, { scenarioKey: 'normal', agentKey: 'sales-assistant' }, { scenarioKey: 'normal', score: 100 }, { agentKey: 'sales-assistant' }]) {
    assert.equal((await request('/api/agent/run', { method: 'POST', body })).status, 400);
  }
  for (const path of ['/api/actions/not-an-id', '/api/actions?status=bogus', '/api/actions?limit=0', '/api/actions?limit=201', '/api/actions?limit=2&limit=3', '/api/actions?status[$ne]=blocked', '/api/stats?secret=1']) {
    const result = await request(path);
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(result.body.data, null);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.ok(result.body.error.message);
  }
  assert.equal((await request('/api/actions/000000000000000000000000')).status, 404);
  assert.equal((await request('/api/approvals/000000000000000000000000', { method: 'POST', body: { decision: 'approve' } })).status, 404);
  assert.equal((await request(`/api/approvals/${scenarios.get('grey').action._id}`, { method: 'POST', body: { decision: 'send' } })).status, 400);
  assert.equal((await request('/api/actions?status=&limit=')).status, 200);
});

test('unified free-text run still uses the provider and unsafe scores block without a hard flag', async () => {
  const provider = {
    isAvailable: () => true,
    async generateJSON(input) {
      if (input.schema.properties.tool) {
        const task = JSON.parse(input.prompt).task;
        return { tool: 'send_email', params: { to: task.match(/<EMAIL_\d+>/)[0], resourceKey: 'q3_summary' }, rationale: 'Requested summary email.' };
      }
      return { aligned: true, confidence: 0.9, reason: 'Matches the request.' };
    },
    async generateText(input) {
      return `Score ${JSON.parse(input.prompt).evaluation.score}/100. The computed checks block this personal-mail destination.`;
    },
  };
  const result = await request('/api/agent/run', {
    method: 'POST', url: await openApp(provider),
    body: { agentKey: 'sales-assistant', task: 'Email the Q3 summary to outside@gmail.com' },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.source, 'llm');
  assert.equal(result.body.data.status, 'blocked');
  assert.equal(result.body.data.evaluation.level, 'UNSAFE');
  assert.equal(result.body.data.evaluation.hardBlock, false);
  assert.ok(result.body.data.evaluation.score < 40);
  assert.equal(result.body.data.outboxItem, undefined);
  const stats = (await request('/api/stats')).body.data;
  assert.equal(stats.totals.unsafe, 1);
  assert.equal(stats.totals.blocked, 2);
});

test('rolling hourly stats include the lower boundary, exclude older/future data, and zero-fill gaps', async () => {
  const now = new Date();
  const hour = 3600000;
  const selected = [...scenarios.values()].map((item) => item.action._id);
  const original = await Action.find({ _id: { $in: selected } }).select('createdAt').lean();
  const times = [new Date(now.getTime() - 24 * hour), new Date(now.getTime() - 24 * hour - 1), new Date(now.getTime() - 1), new Date(now.getTime() + hour)];
  for (let index = 0; index < selected.length; index += 1) {
    await Action.collection.updateOne({ _id: original.find((item) => item._id.toString() === selected[index])._id }, { $set: { createdAt: times[index] } });
  }
  try {
    const data = await getStats(now);
    assert.equal(data.last24h.length, 24);
    assert.equal(data.last24h[0].count, 1);
    assert.equal(data.last24h[0].hour, times[0].toISOString());
    assert.equal(data.last24h.reduce((sum, row) => sum + row.count, 0), data.totals.evaluated - 2);
  } finally {
    for (const item of original) await Action.collection.updateOne({ _id: item._id }, { $set: { createdAt: item.createdAt } });
  }
});

test('reseed preserves agent references in saved history and leaves pending payload snapshots intact', async () => {
  const before = await Action.findById(scenarios.get('grey').action._id).lean();
  await seedDatabase();
  const detail = await request(`/api/actions/${before._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.agent.name, 'Sales Assistant');
  assert.equal(detail.body.data.tokenizedPayload, before.tokenizedPayload);
});
