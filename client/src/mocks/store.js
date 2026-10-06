import { agents, fixture, resources, scenarios } from './fixtures.js';

export const MOCK_STORAGE_KEY = 'tl_mock_state_v1';
export const makeId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 24);
export const demoUser = { _id: '000000000000000000000004', name: 'Demo Admin', email: 'demo@trustlens.app', role: 'admin' };

export function addScenario(state, key, user = demoUser, date = new Date().toISOString()) {
  const { proposal, evaluation, status } = fixture(key);
  const scenario = scenarios.find((item) => item.key === key);
  const action = { _id: makeId(), user: user._id, agent: agents.find((item) => item.key === scenario.agentKey)._id, task: scenario.task.replace(/manager@acme\.in/g, '<EMAIL_1>').replace(/insights@vendor-insights\.in/g, '<EMAIL_13>'), tool: proposal.tool, params: proposal.params, privacy: evaluation.privacy, tokenizedPayload: evaluation.tokenizedPayload, evaluation: { score: evaluation.score, level: evaluation.level, hardBlock: evaluation.hardBlock, checks: evaluation.checks, explanation: evaluation.explanation }, status, scenarioKey: key, redacted: false, createdAt: date, updatedAt: date };
  state.actions.unshift(action);
  let outboxItem;
  if (status === 'executed') outboxItem = addReceipt(state, action, false, date, 'manager@acme.in');
  for (const [event, details] of [
    ['action.proposed', { source: 'scripted', tool: action.tool, ms: 48 }],
    ['privacy.scanned', { ...action.privacy, ms: 66 }],
    ['trust.evaluated', { score: evaluation.score, level: evaluation.level, hardBlock: evaluation.hardBlock, evaluationMs: 14 }],
    [status === 'pending_approval' ? 'action.queued' : `action.${status}`, { status, score: evaluation.score, hardBlock: evaluation.hardBlock }],
  ]) addAudit(state, scenario.agentKey, event, action._id, details, date);
  return { action, evaluation, status, ...(outboxItem ? { outboxItem } : {}), proposedAction: { ...proposal, source: 'scripted' }, source: 'scripted', intentAlignment: { aligned: key !== 'attack', confidence: key === 'attack' ? .97 : .9 }, outboxId: outboxItem?._id || null };
}

export function addAudit(state, actor, event, actionRef, details, date = new Date().toISOString()) {
  state.audit.unshift({ _id: makeId(), actor, event, actionRef, details, createdAt: date, updatedAt: date });
}

export function addReceipt(state, action, redacted, date = new Date().toISOString(), to = action.params.to || '') {
  const receipt = { _id: makeId(), action: action._id, tool: action.tool, to, subject: action.params.subject || '', bodyPreview: action.tokenizedPayload, attachmentName: resources.find((item) => item.key === action.params.resourceKey)?.name || '', redacted, createdAt: date, updatedAt: date };
  state.outbox.unshift(receipt);
  return receipt;
}

export function saveState(state) { localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state)); }
export function getState() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY));
    if (saved?.version === 1 && Array.isArray(saved.actions) && Array.isArray(saved.users)) return saved;
  } catch { /* A damaged demo cache is recreated from the fixtures. */ }
  const state = { version: 1, users: [demoUser], sessions: {}, actions: [], outbox: [], audit: [] };
  ['normal', 'normal', 'normal', 'attack', 'normal', 'normal', 'normal', 'permission', 'attack', 'grey', 'normal', 'normal'].forEach((key, index) => addScenario(state, key, demoUser, new Date(Date.now() - (12 - index) * 100 * 60000).toISOString()));
  saveState(state);
  return state;
}

export function populateAction(state, action) {
  const agent = agents.find((item) => item._id === action.agent);
  const decidedBy = state.users.find((item) => item._id === action.decidedBy);
  return { ...action, agent: { _id: agent._id, key: agent.key, name: agent.name, avatarColor: agent.avatarColor }, ...(decidedBy ? { decidedBy: { _id: decidedBy._id, name: decidedBy.name } } : {}) };
}

export function getStatistics(state) {
  const totals = { evaluated: state.actions.length, trusted: 0, suspicious: 0, unsafe: 0, blocked: 0 };
  let scores = 0; let piiItemsShielded = 0;
  for (const action of state.actions) {
    totals[action.evaluation.level.toLowerCase()]++;
    scores += action.evaluation.score;
    piiItemsShielded += Object.values(action.privacy.counts).reduce((sum, count) => sum + count, 0);
  }
  const round = (value) => Math.round(value * 100) / 100;
  const start = Date.now() - 24 * 3600000;
  const last24h = Array.from({ length: 24 }, (_, index) => ({ hour: new Date(start + index * 3600000).toISOString(), count: state.actions.filter((action) => { const date = new Date(action.createdAt).getTime(); return date >= start + index * 3600000 && date < start + (index + 1) * 3600000; }).length }));
  const byAgent = agents.map((agent) => { const actions = state.actions.filter((item) => item.agent === agent._id); return { agent: agent.name, count: actions.length, avgScore: actions.length ? round(actions.reduce((sum, item) => sum + item.evaluation.score, 0) / actions.length) : 0 }; });
  return { totals, avgScore: totals.evaluated ? round(scores / totals.evaluated) : 0, piiItemsShielded, byAgent: byAgent.filter((agent) => agent.count > 0), last24h };
}
