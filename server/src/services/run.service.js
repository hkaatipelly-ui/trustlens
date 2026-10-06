import { Agent } from '../models/Agent.js';
import { performance } from 'node:perf_hooks';
import { Resource } from '../models/Resource.js';
import { buildPayload } from '../lib/demoData.js';
import { tokenize } from '../lib/detector.js';
import { ApiError } from '../utils/ApiError.js';
import { proposedActionSchema } from '../validation/action.js';
import { proposeAction } from './ai/agent.service.js';
import { checkIntentAlignment } from './ai/intent.service.js';
import { explainDecision } from './ai/explain.service.js';
import { AIUnavailableError } from './ai/gemini.client.js';
import { getScenario } from './scenarios.js';
import { evaluateAction } from './trust.service.js';
import { persistRun } from './actionPersistence.service.js';
import { CHECK_STAGES, createTimeline } from '../utils/timeline.js';

async function loadAgent(key) {
  const agent = await Agent.findOne({ key }).lean();
  if (!agent) throw new ApiError(404, 'AGENT_NOT_FOUND', 'The requested agent does not exist.');
  return agent;
}

async function loadResource(key) {
  if (!key) return null;
  const resource = await Resource.findOne({ key }).select('+content').lean();
  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'The requested resource does not exist.');
  return resource;
}

async function finishRun({ user, agentKey, task, proposal, scenarioKey, provider, timeline }) {
  const { source, ...action } = proposal;
  const validated = { ...proposedActionSchema.parse(action), source };
  timeline.mark('propose', 'Action proposed');
  const resource = await loadResource(validated.params.resourceKey);
  tokenize(buildPayload(validated, resource));
  timeline.mark('privacy', 'Payload scanned and tokenized');
  const intentAlignment = await checkIntentAlignment({ task, proposedAction: validated }, { provider });
  const started = performance.now();
  const evaluation = await evaluateAction({
    agent: agentKey, tool: validated.tool, params: validated.params, resource, intentAlignment,
  }, { resourceSnapshot: resource });
  const evaluationMs = Number((performance.now() - started).toFixed(2));
  for (const [stage, label] of CHECK_STAGES) timeline.mark(stage, label);
  evaluation.explanation = await explainDecision({ task, action: validated, evaluation }, { provider });
  const agent = await loadAgent(agentKey);
  const result = await persistRun({
    user, agent, task, proposal: validated, resource, evaluation, intentAlignment,
    scenarioKey, timeline: timeline.entries, evaluationMs,
  });
  timeline.mark('decision', result.status === 'executed' ? 'Simulated tool executed'
    : result.status === 'pending_approval' ? 'Queued for human approval' : 'Action blocked');
  return { ...result, timeline: timeline.entries, metrics: { evaluationMs, totalMs: timeline.elapsed() } };
}

export async function runScenario({ key, user }, { provider } = {}) {
  const timeline = createTimeline();
  const scenario = getScenario(key);
  await loadAgent(scenario.agentKey);
  if (scenario.contextDocumentKey) await loadResource(scenario.contextDocumentKey);
  // A scenario always uses the script, including the compromised agent in attack.
  // Gemini may assess intent/explain, but it cannot replace the scripted proposal.
  return finishRun({
    user,
    agentKey: scenario.agentKey,
    task: scenario.task,
    proposal: { ...scenario.scriptedAction, source: 'scripted' },
    scenarioKey: scenario.key,
    provider,
    timeline,
  });
}

export async function runTask({ agentKey, task, contextDocumentKey, user }, { provider } = {}) {
  const timeline = createTimeline();
  const agent = await loadAgent(agentKey);
  if (provider && !provider.isAvailable()) throw new AIUnavailableError();
  const [resourceSummaries, contextDocument] = await Promise.all([
    Resource.find().select('key name dataClass recordCount -_id').lean(),
    loadResource(contextDocumentKey),
  ]);
  if (contextDocument && !agent.allowedDataClasses.includes(contextDocument.dataClass)) {
    throw new ApiError(403, 'CONTEXT_NOT_ALLOWED', 'The agent cannot access this context document.');
  }
  const proposal = await proposeAction({ agent, task, resourceSummaries, contextDocument }, { provider });
  return finishRun({ user, agentKey, task, proposal, provider, timeline });
}

export function runAgent({ scenarioKey, agentKey, task, user }, options) {
  return scenarioKey ? runScenario({ key: scenarioKey, user }, options) : runTask({ agentKey, task, user }, options);
}
