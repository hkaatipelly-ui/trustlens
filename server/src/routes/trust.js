import { Router } from 'express';
import { evaluateTrust } from '../controllers/trustController.js';
import { validate } from '../middleware/validate.js';
import { evaluateSchema } from '../validation/action.js';

export { evaluateSchema } from '../validation/action.js';

export function createTrustRouter() {
  const router = Router();
  router.post('/evaluate', validate(evaluateSchema), evaluateTrust);
  return router;
}
