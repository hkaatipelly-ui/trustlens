import { runAgent, runScenario, runTask } from '../services/run.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { agentKeySchema } from '../validation/action.js';

export function createRunController(provider) {
  function respond(res, { metrics, ...data }) {
    res.locals.evaluationMs = metrics.evaluationMs;
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, data, 201);
  }
  return {
    unified: asyncHandler(async (req, res) => {
      return respond(res, await runAgent({ ...req.body, user: req.user }, { provider }));
    }),
    scenario: asyncHandler(async (req, res) => {
      const key = agentKeySchema.parse(req.params.key);
      const result = await runScenario({ key, user: req.user }, { provider });
      return respond(res, result);
    }),
    task: asyncHandler(async (req, res) => {
      const agentKey = agentKeySchema.parse(req.params.agentKey);
      const result = await runTask({ ...req.body, agentKey, user: req.user }, { provider });
      return respond(res, result);
    }),
  };
}
