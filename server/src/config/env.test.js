import assert from 'node:assert/strict';
import test from 'node:test';
import { GEMINI_FALLBACK_MODEL, parseEnv } from './env.js';

const requiredValues = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/trustlens_test',
  JWT_SECRET: 'test-only-secret-at-least-32-characters',
  CLIENT_URL: 'http://localhost:5173',
};

test('empty example values use defaults and do not require a Gemini key', () => {
  const config = parseEnv({
    ...requiredValues,
    PORT: '',
    JWT_EXPIRES_IN: '',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: '',
    DEMO_MODE: '',
    NODE_ENV: '',
  });

  assert.equal(config.PORT, 5000);
  assert.equal(config.JWT_EXPIRES_IN, '7d');
  assert.equal(config.GEMINI_MODEL, 'gemini-3.6-flash');
  assert.equal(config.GEMINI_API_KEY, undefined);
  assert.equal(config.DEMO_MODE, 'false');
  assert.equal(GEMINI_FALLBACK_MODEL, 'gemini-3.5-flash-lite');
});

test('comma-separated client origins are trimmed and normalized', () => {
  const config = parseEnv({
    ...requiredValues,
    CLIENT_URL: 'http://localhost:5173, https://trustlens.example/',
  });
  assert.deepEqual(config.CLIENT_ORIGINS, [
    'http://localhost:5173', 'https://trustlens.example',
  ]);
});

test('invalid secrets, ports, Mongo URIs, durations, and origins are rejected', () => {
  for (const invalid of [
    { JWT_SECRET: 'short' },
    { PORT: '70000' },
    { MONGODB_URI: 'https://example.com' },
    { JWT_EXPIRES_IN: 'forever' },
    { CLIENT_URL: 'https://example.com/app' },
    { CLIENT_URL: 'https://example.com,' },
    { CLIENT_URL: '*' },
    { DEMO_MODE: 'yes' },
  ]) {
    assert.throws(() => parseEnv({ ...requiredValues, ...invalid }), /Invalid server environment/);
  }
});

test('Gemini 2.5 models are rejected', () => {
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-pro']) {
    assert.throws(
      () => parseEnv({ ...requiredValues, GEMINI_MODEL: model }),
      /Gemini 2\.5 models are not allowed/,
    );
  }
});
