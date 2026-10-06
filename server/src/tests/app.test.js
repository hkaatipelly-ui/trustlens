import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';

let server;
let baseUrl;

before(async () => {
  const app = createApp({
    CLIENT_ORIGINS: ['http://localhost:5173', 'https://trustlens.example', 'https://trustlens-judging.vercel.app'],
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
});

test('health response has the standard envelope, timestamp, and security headers', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.error, null);
  assert.ok(Number.isFinite(Date.parse(body.data.time)));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('configured origins can access the API with credentials', async () => {
  for (const origin of ['http://localhost:5173', 'https://trustlens.example']) {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  }
});

test('CORS preflight allows authorization headers', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-headers'), 'authorization');
});

test('Vercel to Render-style API preflight allows JSON POST and Bearer authentication', async () => {
  const origin = 'https://trustlens-judging.vercel.app';
  const response = await fetch(`${baseUrl}/api/demo/reset`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  assert.equal(response.headers.get('access-control-allow-headers'), 'authorization,content-type');
  assert.match(response.headers.get('vary'), /Origin/);
});

test('API rate-limit headers are enabled while health stays outside the API limiter', async () => {
  const api = await fetch(`${baseUrl}/api/agents`);
  assert.equal(api.status, 401);
  assert.ok(api.headers.get('ratelimit'));
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.headers.get('ratelimit'), null);
});

test('unlisted origins receive a structured rejection', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://unlisted.example' },
  });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.data, null);
  assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('unknown endpoints return structured 404 errors', async () => {
  const response = await fetch(`${baseUrl}/missing`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('malformed JSON returns a structured 400 error', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
});

test('request bodies over 1 MB are rejected', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(1024 * 1024) }),
  });
  const body = await response.json();
  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
});
