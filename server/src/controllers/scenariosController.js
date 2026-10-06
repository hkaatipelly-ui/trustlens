import { getScenarios } from '../services/scenarios.js';
import { sendSuccess } from '../utils/response.js';

export function listScenarios(req, res) {
  return sendSuccess(res, getScenarios());
}
