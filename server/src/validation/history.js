import { z } from 'zod';
import { ACTION_STATUSES } from '../models/Action.js';

const emptyToUndefined = (value) => value === '' ? undefined : value;
const limit = z.preprocess(emptyToUndefined,
  z.string().regex(/^[1-9]\d*$/, 'limit must be a positive integer').transform(Number)
    .pipe(z.number().int().max(200)).default(50));

export const listQuerySchema = z.strictObject({ limit });
export const actionListQuerySchema = z.strictObject({
  limit,
  status: z.preprocess(emptyToUndefined, z.enum(ACTION_STATUSES).optional()),
});
export const emptyQuerySchema = z.strictObject({});
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Use a valid MongoDB ObjectId').toLowerCase();
export const actionIdParamsSchema = z.strictObject({ actionId: objectId });
export const idParamsSchema = z.strictObject({ id: objectId });
export const approvalBodySchema = z.strictObject({ decision: z.enum(['approve', 'deny', 'redact']) });
