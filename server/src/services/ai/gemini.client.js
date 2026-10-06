import { GoogleGenAI } from '@google/genai';
import { GEMINI_FALLBACK_MODEL } from '../../config/env.js';
import { createVault } from '../../lib/detector.js';
import { ApiError } from '../../utils/ApiError.js';
import { protectValue } from '../../utils/privacy.js';

export const AI_TIMEOUT_MS = 12000;

export class AIUnavailableError extends ApiError {
  constructor(message = 'AI is unavailable. Configure GEMINI_API_KEY on the server and set DEMO_MODE=false, or run a demo scenario.') {
    super(503, 'AI_UNAVAILABLE', message);
    this.name = 'AIUnavailableError';
  }
}

function available(env) {
  return Boolean(env.GEMINI_API_KEY?.trim()) && env.DEMO_MODE !== 'true' && env.DEMO_MODE !== true;
}

export function createGeminiClient(env = process.env, { client, timeoutMs = AI_TIMEOUT_MS } = {}) {
  const primary = env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
  if (primary.startsWith('gemini-2.5')) throw new Error('Gemini 2.5 models are not allowed.');
  const models = [...new Set([primary, GEMINI_FALLBACK_MODEL])];
  let ai = client;

  async function generate({ system, prompt, schema }, json) {
    if (!available(env)) throw new AIUnavailableError();
    ai ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const vault = createVault();
    // Enforce privacy at the provider boundary as well as at each service boundary.
    const safe = protectValue({ system, prompt, ...(json ? { schema } : {}) }, vault);

    for (const model of models) {
      let timer;
      const controller = new AbortController();
      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents: safe.prompt,
            config: {
              systemInstruction: safe.system,
              temperature: 0.2,
              abortSignal: controller.signal,
              ...(json ? { responseMimeType: 'application/json', responseSchema: safe.schema } : {}),
            },
          }),
          new Promise((resolve, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error('AI call timed out.'));
            }, timeoutMs);
          }),
        ]);
        const text = res.text;
        if (typeof text !== 'string' || !text.trim()) throw new Error('Empty AI response.');
        return json ? JSON.parse(text) : text.trim();
      } catch {
        // Try the next allowed model. Upstream errors can contain private request data.
      } finally {
        clearTimeout(timer);
      }
    }
    throw new AIUnavailableError('Both Gemini models failed or timed out. Retry later, check server AI configuration, or run a demo scenario.');
  }

  return {
    isAvailable: () => available(env),
    generateJSON: (input) => generate(input, true),
    generateText: (input) => generate(input, false),
  };
}

export const isAvailable = () => available(process.env);
export const generateJSON = (input) => createGeminiClient().generateJSON(input);
export const generateText = (input) => createGeminiClient().generateText(input);
