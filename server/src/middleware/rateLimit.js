import { rateLimit } from 'express-rate-limit';
import { sendError } from '../utils/response.js';

export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      return sendError(res, 429, 'RATE_LIMITED', 'Too many authentication attempts. Try again in 15 minutes.');
    },
  });
}

function createLimiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      return sendError(res, 429, 'RATE_LIMITED', message);
    },
  });
}

export const createApiRateLimiter = () => createLimiter(1000, 'Too many API requests. Retry after the indicated interval.');
export const createRunRateLimiter = () => createLimiter(60, 'Too many agent runs. Retry after the indicated interval.');
export const createResetRateLimiter = () => createLimiter(10, 'Too many demo resets. Retry after the indicated interval.');
