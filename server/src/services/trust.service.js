import { ORG_CONFIG } from '../config/domains.js';
import { buildPayload } from '../lib/demoData.js';
import * as trustEngine from '../lib/trustEngine.js';
import { Agent } from '../models/Agent.js';
import { Policy } from '../models/Policy.js';
import { Resource } from '../models/Resource.js';
import { ApiError } from '../utils/ApiError.js';

export async function buildContext() {
  const [agents, policies] = await Promise.all([
    Agent.find().lean(),
    Policy.find({ enabled: true }).lean(),
  ]);
  return { agents, policies, org: structuredClone(ORG_CONFIG) };
}

export async function evaluateAction({ agent, tool, params = {}, resource = null, intentAlignment = null }, { resourceSnapshot } = {}) {
  const { agents, policies, org } = await buildContext();
  const agentKey = typeof agent === 'string' ? agent : agent?.key;
  const currentAgent = agents.find((candidate) => candidate.key === agentKey);
  if (!currentAgent) {
    throw new ApiError(404, 'AGENT_NOT_FOUND', 'The requested agent does not exist.');
  }

  // Resolve either a key or a Resource object's key against the database.
  // Only this server-side lookup includes content; catalog responses never do.
  const resourceKey = (typeof resource === 'string' ? resource : resource?.key) ?? params.resourceKey;
  const currentResource = resourceSnapshot !== undefined ? resourceSnapshot : resourceKey
    ? await Resource.findOne({ key: resourceKey }).select('+content').lean()
    : null;
  if (resourceKey && !currentResource) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'The requested resource does not exist.');
  }
  if (currentResource && currentResource.key !== resourceKey) {
    throw new Error('The resource snapshot does not match the proposed action.');
  }

  return evaluatePreparedAction({
    agent: currentAgent, tool, params, resource: currentResource, intentAlignment,
  }, { policies, org });
}

// Internal runners pass freshly loaded database documents. The public evaluator
// still resolves keys itself; both paths call the same unchanged scoring engine.
export function evaluatePreparedAction({ agent, tool, params, resource, intentAlignment }, { policies, org }) {
  const result = trustEngine.evaluate({
    agent,
    tool,
    params,
    payloadText: buildPayload({ tool, params }, resource),
    resource,
    policies,
    org,
    intent: intentAlignment,
  });

  // Preserve the computed score and hard-block override; do not rescore in the wrapper.
  return {
    score: result.score,
    level: result.level,
    hardBlock: result.hardBlock,
    checks: result.checks,
    privacy: { counts: result.privacy.counts, entityTypes: result.privacy.entityTypes },
    tokenizedPayload: result.tokenizedPayload,
  };
}
