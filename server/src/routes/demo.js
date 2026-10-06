import { Router } from 'express';
import { z } from 'zod';
import { reset } from '../controllers/demoController.js';
import { requireRole } from '../middleware/auth.js';
import { createResetRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export function createDemoRouter() {
  const router = Router();
  router.post('/reset', requireRole('admin'), createResetRateLimiter(), validate(z.strictObject({}).default({})), reset);
  return router;
}
