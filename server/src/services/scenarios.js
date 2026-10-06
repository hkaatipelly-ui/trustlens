import { SCENARIOS as CORE_SCENARIOS } from '../lib/demoData.js';
import { ApiError } from '../utils/ApiError.js';

export const SCENARIOS = CORE_SCENARIOS.map((scenario) => structuredClone(scenario));

export function getScenarios() {
  return SCENARIOS.map(({ key, title, subtitle, emoji, agentKey, task }) => ({
    key, title, subtitle, emoji, agentKey, task,
  }));
}

export function getScenario(key) {
  const scenario = SCENARIOS.find((candidate) => candidate.key === key);
  if (!scenario) throw new ApiError(404, 'SCENARIO_NOT_FOUND', 'The requested scenario does not exist.');
  return structuredClone(scenario);
}
