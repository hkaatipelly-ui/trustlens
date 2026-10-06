import { request } from './request.js';

export const getHealth = (options) => request('GET', '/health', options);
export const getAgents = (options) => request('GET', '/api/agents', options);
export const getPolicies = (options) => request('GET', '/api/policies', options);
export const getResources = (options) => request('GET', '/api/resources', options);
export const getScenarios = (options) => request('GET', '/api/scenarios', options);
