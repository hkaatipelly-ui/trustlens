import { createVault } from '../../lib/detector.js';
import { protectValue, restoreValue } from '../../utils/privacy.js';
import { proposedActionSchema } from '../../validation/action.js';
import * as defaultProvider from './gemini.client.js';
import { AIUnavailableError } from './gemini.client.js';
import { ACTION_RESPONSE_SCHEMA, TOKEN_INSTRUCTIONS } from './schemas.js';

export async function proposeAction({ agent, task, resourceSummaries = [], contextDocument = null }, { provider = defaultProvider } = {}) {
  if (!provider.isAvailable()) throw new AIUnavailableError();
  const vault = createVault();
  const safe = protectValue({
    agent: { name: agent.name, allowedTools: agent.allowedTools },
    resources: resourceSummaries.map(({ key, name, dataClass }) => ({ key, name, dataClass })),
    task,
    contextDocument: typeof contextDocument === 'string' ? contextDocument : contextDocument ? {
      key: contextDocument.key,
      name: contextDocument.name,
      dataClass: contextDocument.dataClass,
      content: contextDocument.content,
    } : null,
  }, vault);
  const system = `You are ${safe.agent.name}, an AI agent at Acme. You can use tools: ${safe.agent.allowedTools.join(', ')}. Available resources: ${JSON.stringify(safe.resources)}. Respond ONLY with JSON: { tool, params: { to?, subject?, body?, resourceKey?, url?, channel? }, rationale }. Propose one action; do not execute it. Use only the listed resource keys. ${TOKEN_INSTRUCTIONS}`;
  const output = await provider.generateJSON({
    system,
    prompt: JSON.stringify({ task: safe.task, contextDocument: safe.contextDocument }),
    schema: ACTION_RESPONSE_SCHEMA,
  });
  // Destinations must be restored in server memory so the deterministic engine can
  // classify domains. The vault is never returned, sent to Gemini, or persisted.
  const result = proposedActionSchema.safeParse(restoreValue(output, vault));
  if (!result.success || (result.data.params.resourceKey && !resourceSummaries.some((resource) => resource.key === result.data.params.resourceKey))) {
    throw new AIUnavailableError('Gemini did not produce a valid action using the available resources. Try a more specific task or run a demo scenario.');
  }
  return { ...result.data, source: 'llm' };
}
