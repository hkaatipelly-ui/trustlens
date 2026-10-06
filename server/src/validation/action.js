import { z } from 'zod';

export const TOOL_NAMES = ['send_email', 'share_file', 'read_resource', 'post_message', 'http_request'];
export const agentKeySchema = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const resourceKeySchema = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/);
export const paramsSchema = z.strictObject({
  to: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  url: z.httpUrl().max(2048).optional(),
  channel: z.string().trim().min(1).max(100).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(100000).optional(),
  resourceKey: resourceKeySchema.optional(),
});
export const intentSchema = z.strictObject({
  aligned: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export function validateActionParams(action, context) {
  const issue = (path, message) => context.addIssue({ code: 'custom', path, message });
  if (action.resourceKey && action.params.resourceKey && action.resourceKey !== action.params.resourceKey) {
    issue(['resourceKey'], 'resourceKey must match params.resourceKey when both are supplied.');
  }
  const destination = {
    send_email: 'to', share_file: 'to', post_message: 'channel', http_request: 'url',
  }[action.tool];
  if (destination && !action.params[destination]) {
    issue(['params', destination], `${action.tool} requires params.${destination}.`);
  }
  for (const field of ['to', 'url', 'channel']) {
    if (action.params[field] && field !== destination) {
      issue(['params', field], `params.${field} is not a destination for ${action.tool}.`);
    }
  }
  if (action.tool === 'read_resource' && !(action.resourceKey || action.params.resourceKey)) {
    issue(['resourceKey'], 'read_resource requires a resourceKey.');
  }
}

export const proposedActionSchema = z.strictObject({
  tool: z.enum(TOOL_NAMES),
  params: paramsSchema,
  rationale: z.string().max(2000),
}).superRefine(validateActionParams);

export const evaluateSchema = z.strictObject({
  agentKey: agentKeySchema,
  tool: z.enum(TOOL_NAMES),
  params: paramsSchema,
  resourceKey: resourceKeySchema.optional(),
  intentAlignment: intentSchema.optional(),
}).superRefine(validateActionParams).transform((action) => ({
  ...action, resourceKey: action.resourceKey ?? action.params.resourceKey,
}));
