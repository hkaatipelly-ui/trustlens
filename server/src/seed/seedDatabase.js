import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Agent } from '../models/Agent.js';
import { Policy } from '../models/Policy.js';
import { Resource } from '../models/Resource.js';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { AGENTS, POLICIES, buildResources } from '../lib/demoData.js';

export const DEMO_EMAIL = 'demo@trustlens.app';
export const DEMO_PASSWORD = 'Demo@1234';

export async function initializeSeedModels() {
  await Promise.all([User, Agent, Policy, Resource, Action, AuditLog, OutboxItem].map((model) => model.init()));
}

export async function seedDatabase({ session } = {}) {
  const resources = buildResources();
  const options = session ? { session } : {};
  // Build unique indexes before upserting the demo account or accepting registrations.
  if (!session) await initializeSeedModels();

  const existingAgents = await Agent.find().select('key').setOptions(options).lean();
  const agentIds = new Map(existingAgents.map((agent) => [agent.key, agent._id]));
  await Agent.deleteMany({}, options);
  await Agent.insertMany(AGENTS.map((agent) => ({
    ...agent, ...(agentIds.has(agent.key) ? { _id: agentIds.get(agent.key) } : {}),
  })), options);
  await Policy.deleteMany({}, options);
  await Policy.insertMany(POLICIES, options);
  await Resource.deleteMany({}, options);
  await Resource.insertMany(resources, options);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.updateOne({ email: DEMO_EMAIL }, {
    $setOnInsert: { name: 'Demo Admin', email: DEMO_EMAIL, passwordHash, role: 'admin' },
  }, { ...options, upsert: true, runValidators: true });

  return { agents: AGENTS.length, policies: POLICIES.length, resources: resources.length, demoEmail: DEMO_EMAIL };
}
