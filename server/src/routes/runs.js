import { Router } from 'express';
import { z } from 'zod';
import { createRunController } from '../controllers/runController.js';
import { validate } from '../middleware/validate.js';
import { agentKeySchema, resourceKeySchema } from '../validation/action.js';
import { createRunRateLimiter } from '../middleware/rateLimit.js';

const scenarioBody = z.strictObject({}).default({});
const taskBody = z.strictObject({
  task: z.string().trim().min(1).max(20000),
  contextDocumentKey: resourceKeySchema.optional(),
});
const unifiedBody = z.strictObject({
  scenarioKey: agentKeySchema.optional(),
  agentKey: agentKeySchema.optional(),
  task: z.string().trim().min(1).max(20000).optional(),
}).superRefine((body, context) => {
  if (body.scenarioKey) {
    if (body.agentKey || body.task) context.addIssue({ code: 'custom', path: ['scenarioKey'], message: 'Choose a scenario or an agent/task pair, not both.' });
  } else {
    for (const key of ['agentKey', 'task']) {
      if (!body[key]) context.addIssue({ code: 'custom', path: [key], message: `${key} is required for a free-text run.` });
    }
  }
});

export function createRunRouter(provider) {
  const router = Router();
  const controller = createRunController(provider);
  const runLimiter = createRunRateLimiter();
  router.post('/agent/run', runLimiter, validate(unifiedBody), controller.unified);
  router.post('/scenarios/:key/run', runLimiter, validate(scenarioBody), controller.scenario);
  router.post('/agents/:agentKey/run', runLimiter, validate(taskBody), controller.task);
  return router;
}
