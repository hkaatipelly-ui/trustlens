import { Router } from 'express';
import { z } from 'zod';
import { createAuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8, 'Password must contain at least 8 characters').refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Password must be at most 72 UTF-8 bytes',
);

const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email,
  password,
});
const loginSchema = z.strictObject({ email, password });

export function createAuthRouter(config) {
  const router = Router();
  const controller = createAuthController(config);
  const authLimiter = createAuthRateLimiter();

  router.post('/register', authLimiter, validate(registerSchema), controller.register);
  router.post('/login', authLimiter, validate(loginSchema), controller.login);
  router.get('/me', authenticate(config), controller.me);

  return router;
}
