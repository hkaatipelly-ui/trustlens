import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const withDefault = (schema) => z.preprocess(emptyToUndefined, schema);

function isOrigin(value) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/'
    );
  } catch {
    return false;
  }
}

const envSchema = z.object({
  PORT: withDefault(z.coerce.number().int().min(1).max(65535).default(5000)),
  MONGODB_URI: z.string().trim().regex(/^mongodb(?:\+srv)?:\/\/\S+$/, {
    message: 'Must be a MongoDB connection string',
  }),
  JWT_SECRET: z.string().min(32, 'Must contain at least 32 characters'),
  JWT_EXPIRES_IN: withDefault(
    z.string().trim().regex(/^\d+(?:ms|s|m|h|d|w|y)$/, 'Use a duration such as 7d').default('7d'),
  ),
  CLIENT_URL: z.string().trim().min(1).refine(
    (value) => value.split(',').every((origin) => isOrigin(origin.trim())),
    'Use comma-separated http(s) origins without paths',
  ),
  GEMINI_API_KEY: withDefault(z.string().trim().min(1).optional()),
  GEMINI_MODEL: withDefault(
    z.string().trim().startsWith('gemini-').refine(
      (model) => !model.startsWith('gemini-2.5'),
      'Gemini 2.5 models are not allowed',
    ).default('gemini-3.6-flash'),
  ),
  DEMO_MODE: withDefault(z.enum(['true', 'false']).default('false')),
  NODE_ENV: withDefault(
    z.enum(['development', 'test', 'production']).default('development'),
  ),
});

export function parseEnv(values) {
  const result = envSchema.safeParse(values);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid server environment:\n${issues.join('\n')}`);
  }

  return {
    ...result.data,
    CLIENT_ORIGINS: result.data.CLIENT_URL.split(',').map(
      (origin) => new URL(origin.trim()).origin,
    ),
  };
}

export function loadEnv() {
  dotenv.config({
    path: fileURLToPath(new URL('../../.env', import.meta.url)),
    quiet: true,
  });

  return parseEnv(process.env);
}
