import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { AGENTS, buildResources } from '../src/lib/demoData.js';
import { proposeAction } from '../src/services/ai/agent.service.js';
import { createGeminiClient, AIUnavailableError } from '../src/services/ai/gemini.client.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

try {
  const action = await proposeAction({
    agent: AGENTS[0],
    task: 'Send the Q3 sales summary to my manager at manager@acme.in',
    resourceSummaries: buildResources().map(({ key, name, dataClass }) => ({ key, name, dataClass })),
  }, { provider: createGeminiClient(process.env) });
  console.info(`Gemini proposal verified: source=${action.source}, tool=${action.tool}.`);
} catch (error) {
  console.error(error instanceof AIUnavailableError ? error.message : 'Unable to verify Gemini. Check server AI configuration.');
  process.exitCode = 1;
}
