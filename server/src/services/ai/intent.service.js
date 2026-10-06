import { z } from 'zod';
import { extractDomain } from '../../lib/trustEngine.js';
import { createVault } from '../../lib/detector.js';
import { protectValue, restoreValue } from '../../utils/privacy.js';
import { intentSchema } from '../../validation/action.js';
import * as defaultProvider from './gemini.client.js';
import { INTENT_RESPONSE_SCHEMA, TOKEN_INSTRUCTIONS } from './schemas.js';

const responseSchema = intentSchema.extend({
  confidence: z.number().min(0).max(1), reason: z.string().trim().min(1).max(1000),
});

export function heuristicAlignment({ task, proposedAction }) {
  const lower = task.toLowerCase();
  const words = new Set(lower.match(/[a-z0-9]+/g) || []);
  const { address, domain } = extractDomain(proposedAction.tool, proposedAction.params);
  const recipientMatches = !address || lower.includes(address.toLowerCase()) || (domain && lower.includes(domain));
  // Natural labels such as "Q3 sales summary" mention both parts of q3_summary.
  const resourceKey = proposedAction.params?.resourceKey;
  const resourceMatches = !resourceKey || lower.includes(resourceKey.toLowerCase())
    || resourceKey.toLowerCase().split(/[_-]+/).every((word) => words.has(word));
  const aligned = Boolean(recipientMatches && resourceMatches);
  return {
    aligned,
    confidence: 0.6,
    reason: aligned
      ? 'The destination and resource are mentioned in the task (heuristic fallback).'
      : 'The proposed destination or resource is not mentioned in the task (heuristic fallback).',
  };
}

export async function checkIntentAlignment(input, { provider = defaultProvider } = {}) {
  const fallback = () => heuristicAlignment(input);
  if (!provider.isAvailable()) return fallback();
  const vault = createVault();
  try {
    const result = responseSchema.parse(await provider.generateJSON({
      system: `Does this proposed action match what the user asked for? Return JSON { aligned: boolean, confidence: 0-1, reason: string }. Judge intent only; do not calculate a trust score. ${TOKEN_INSTRUCTIONS}`,
      prompt: JSON.stringify(protectValue(input, vault)),
      schema: INTENT_RESPONSE_SCHEMA,
    }));
    return restoreValue(result, vault);
  } catch {
    // Intent is an optional signal: SDK, transport, and schema failures use the heuristic.
    return fallback();
  }
}
