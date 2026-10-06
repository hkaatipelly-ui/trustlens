import { ServiceError } from '../services/request.js';
import { validateAuth } from '../lib/authValidation.js';
import { PLAYGROUND_EXAMPLES } from '../lib/examples.js';
import { agents, policies, resources, scenarios, fixture, timeline } from './fixtures.js';
import { addAudit, addReceipt, addScenario, getState, getStatistics, makeId, populateAction, saveState } from './store.js';

function fail(status, code, message) { throw new ServiceError(message, status, code); }
async function passwordDigest(password) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function publicUser(user) { const { passwordHash, ...safe } = user; return safe; }
function canonical(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])));
  return JSON.stringify(value);
}
function latency(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 200);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function mockRequest(method, url, { data, params = {}, signal } = {}) {
  await latency(signal);
  let state = getState();
  const ok = (result) => ({ success: true, data: structuredClone(result), error: null });
  if (method === 'GET' && url === '/health') return ok({ status: 'ok', time: new Date().toISOString() });
  if (method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(url)) {
    const registering = url.endsWith('register');
    if (Object.keys(validateAuth({ name: '', ...data }, registering)).length) fail(400, 'VALIDATION_ERROR', 'Check the form fields and try again.');
    const email = data.email.trim().toLowerCase();
    const digest = await passwordDigest(data.password);
    // Reload after crypto yields so parallel requests cannot overwrite each other.
    state = getState();
    let user = state.users.find((item) => item.email === email);
    if (registering) {
      if (user) fail(409, 'EMAIL_EXISTS', 'This email is already registered. Sign in instead.');
      user = { _id: makeId(), name: data.name.trim(), email, role: 'admin', passwordHash: digest };
      state.users.push(user);
    } else if (!user || (user.email === 'demo@trustlens.app' ? data.password !== 'Demo@1234' : user.passwordHash !== digest)) fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = `tl_mock_${crypto.randomUUID()}`;
    state.sessions[token] = { userId: user._id, expiresAt: Date.now() + 7 * 86400000 };
    saveState(state);
    return ok({ user: publicUser(user), token });
  }

  const session = state.sessions[localStorage.getItem('tl_token')];
  const user = session && session.expiresAt > Date.now() ? state.users.find((item) => item._id === session.userId) : null;
  if (!user) {
    localStorage.removeItem('tl_token');
    window.dispatchEvent(new Event('tl:session-expired'));
    fail(401, 'UNAUTHORIZED', 'Your demo session has expired. Please sign in again.');
  }
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));
  if (method === 'GET') {
    if (url === '/api/auth/me') return ok({ user: publicUser(user) });
    if (url === '/api/agents') return ok(agents);
    if (url === '/api/policies') return ok(policies);
    if (url === '/api/resources') return ok(resources);
    if (url === '/api/scenarios') return ok(scenarios);
    if (url === '/api/stats') return ok(getStatistics(state));
    if (url === '/api/outbox') return ok(state.outbox.slice(0, limit));
    if (url === '/api/audit') return ok(state.audit.slice(0, limit));
    if (url === '/api/actions' || url === '/api/approvals/pending') {
      const status = url.includes('pending') ? 'pending_approval' : params.status;
      return ok(state.actions.filter((item) => !status || item.status === status).slice(0, limit).map((item) => populateAction(state, item)));
    }
    if (url.startsWith('/api/actions/')) {
      const action = state.actions.find((item) => item._id === url.split('/').pop());
      if (!action) fail(404, 'ACTION_NOT_FOUND', 'The action was not found.');
      return ok(populateAction(state, action));
    }
  }
  if (method === 'POST' && url === '/api/trust/evaluate') {
    const example = PLAYGROUND_EXAMPLES.find((item) => canonical(item.proposal) === canonical(data));
    if (!example) fail(501, 'MOCK_SAMPLE_ONLY', 'Mock mode supports the four sample proposals. Choose a sample, or set VITE_USE_MOCKS=false for arbitrary API evaluations.');
    return ok(fixture(example.key).evaluation);
  }
  if (method === 'POST' && url === '/api/demo/reset') {
    if (user.role !== 'admin') fail(403, 'FORBIDDEN', 'Only admins can reset the demo.');
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length) fail(400, 'VALIDATION_ERROR', 'Demo reset accepts an empty JSON object.');
    const cleared = { actions: state.actions.length, outbox: state.outbox.length, audit: state.audit.length };
    state.actions = []; state.outbox = []; state.audit = [];
    saveState(state);
    return ok({ cleared, seeded: { agents: agents.length, policies: policies.length, resources: resources.length, demoEmail: 'demo@trustlens.app' }, resetAt: new Date().toISOString() });
  }
  if (method === 'POST' && (url === '/api/agent/run' || /^\/api\/scenarios\/[^/]+\/run$/.test(url))) {
    const key = data?.scenarioKey || (url.startsWith('/api/scenarios/') ? url.split('/')[3] : null);
    if (!key) fail(503, 'AI_UNAVAILABLE', 'Free-text proposals require the live API and a server-side Gemini key. Run a scripted scenario in mock mode.');
    if (!scenarios.some((item) => item.key === key)) fail(404, 'SCENARIO_NOT_FOUND', 'The scenario does not exist.');
    const result = addScenario(state, key, user);
    saveState(state);
    return ok({ ...result, timeline });
  }
  if (method === 'POST' && /^\/api\/agents\/[^/]+\/run$/.test(url)) fail(503, 'AI_UNAVAILABLE', 'Free-text proposals require the live API and a server-side Gemini key.');
  if (method === 'POST' && url.startsWith('/api/approvals/')) {
    if (!['admin', 'approver'].includes(user.role)) fail(403, 'FORBIDDEN', 'Your role cannot review actions.');
    const action = state.actions.find((item) => item._id === url.split('/').pop());
    if (!action) fail(404, 'ACTION_NOT_FOUND', 'The action was not found.');
    if (action.status !== 'pending_approval' || action.evaluation.hardBlock || action.evaluation.score < 40) fail(409, 'ACTION_NOT_PENDING', 'This action is no longer eligible for review.');
    if (!['approve', 'deny', 'redact'].includes(data?.decision)) fail(400, 'INVALID_DECISION', 'Choose approve, deny, or redact.');
    action.status = { approve: 'approved', deny: 'denied', redact: 'redacted_sent' }[data.decision];
    action.redacted = data.decision === 'redact';
    action.decidedBy = user._id;
    action.decidedAt = action.updatedAt = new Date().toISOString();
    const outboxItem = data.decision === 'deny' ? null : addReceipt(state, action, action.redacted);
    addAudit(state, user.email, `approval.${data.decision}`, action._id, { status: action.status, redacted: action.redacted });
    saveState(state);
    return ok({ action, status: action.status, ...(outboxItem ? { outboxItem } : {}) });
  }
  fail(404, 'NOT_FOUND', 'This mock endpoint was not found.');
}
