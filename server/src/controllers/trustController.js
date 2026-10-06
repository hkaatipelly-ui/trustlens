import { evaluateAction } from '../services/trust.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { performance } from 'node:perf_hooks';

export const evaluateTrust = asyncHandler(async (req, res) => {
  const { agentKey, tool, params, resourceKey, intentAlignment } = req.body;
  const started = performance.now();
  const evaluation = await evaluateAction({
    agent: agentKey,
    tool,
    params,
    resource: resourceKey,
    intentAlignment,
  });
  res.locals.evaluationMs = Number((performance.now() - started).toFixed(2));
  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, evaluation);
});
