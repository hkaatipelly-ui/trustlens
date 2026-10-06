import { notifyDataChanged, request } from './request.js';

export const getPending = (options) => request('GET', '/api/approvals/pending', options);
export const getOutbox = (options) => request('GET', '/api/outbox', options);
export const getAudit = (params = {}, options = {}) => request('GET', '/api/audit', { ...options, params });
export const getStats = (options) => request('GET', '/api/stats', options);
export async function resetDemo() {
  const result = await request('POST', '/api/demo/reset', { data: {} });
  notifyDataChanged();
  return result;
}
export async function decideApproval(id, decision) {
  const result = await request('POST', `/api/approvals/${encodeURIComponent(id)}`, { data: { decision } });
  notifyDataChanged();
  return result;
}
