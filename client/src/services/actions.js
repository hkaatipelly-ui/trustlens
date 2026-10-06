import { notifyDataChanged, request } from './request.js';

export const getActions = (params = {}, options = {}) => request('GET', '/api/actions', { ...options, params });
export const getAction = (id, options) => request('GET', `/api/actions/${encodeURIComponent(id)}`, options);
export const evaluate = (proposal, options = {}) => request('POST', '/api/trust/evaluate', { ...options, data: proposal });

async function mutate(url, data) {
  const result = await request('POST', url, { data });
  notifyDataChanged();
  return result;
}

export const runAgent = (body) => mutate('/api/agent/run', body);
export const runScenario = (key) => mutate(`/api/scenarios/${encodeURIComponent(key)}/run`, {});
export const runTask = (agentKey, body) => mutate(`/api/agents/${encodeURIComponent(agentKey)}/run`, body);
