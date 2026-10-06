import mongoose from 'mongoose';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { buildPayload } from '../lib/demoData.js';
import { createVault, tokenize } from '../lib/detector.js';
import { protectValue } from '../utils/privacy.js';
import { decideStatus } from './decision.service.js';
import { createExecutionReceipt } from './outbox.service.js';

export async function persistRun({ user, agent, task, proposal, resource, evaluation, intentAlignment, scenarioKey, timeline, evaluationMs }) {
  const status = decideStatus(evaluation);
  const vault = createVault();
  // Start with the exact engine payload so stored tokens stay consistent across
  // task, params, check reasons, and explanation. No vault is persisted.
  tokenize(buildPayload(proposal, resource), vault);
  const safe = protectValue({ task, proposal, intentAlignment, evaluation }, vault);

  await Promise.all([Action, AuditLog, OutboxItem].map((model) => model.init()));
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [action] = await Action.create([{
        user: user._id,
        agent: agent._id,
        task: safe.task,
        tool: proposal.tool,
        params: safe.proposal.params,
        tokenizedPayload: safe.evaluation.tokenizedPayload,
        privacy: safe.evaluation.privacy,
        evaluation: {
          score: evaluation.score,
          level: evaluation.level,
          hardBlock: evaluation.hardBlock,
          checks: safe.evaluation.checks,
          explanation: safe.evaluation.explanation,
        },
        status,
        ...(scenarioKey ? { scenarioKey } : {}),
      }], { session });

      let outboxItem;
      if (status === 'executed') {
        outboxItem = await createExecutionReceipt({ action, params: proposal.params, attachmentName: resource?.name || '', session });
      }
      const terminalEvent = status === 'pending_approval' ? 'action.queued' : `action.${status}`;
      const details = [
        ['action.proposed', { source: proposal.source, tool: proposal.tool, ms: timeline.find((item) => item.stage === 'propose').ms }],
        ['privacy.scanned', { counts: evaluation.privacy.counts, entityTypes: evaluation.privacy.entityTypes, ms: timeline.find((item) => item.stage === 'privacy').ms }],
        ['trust.evaluated', { score: evaluation.score, level: evaluation.level, hardBlock: evaluation.hardBlock, evaluationMs }],
        [terminalEvent, { status, score: evaluation.score, hardBlock: evaluation.hardBlock }],
      ];
      await AuditLog.insertMany(details.map(([event, eventDetails]) => ({
        actor: agent.key,
        event,
        actionRef: action._id,
        details: eventDetails,
      })), { session });

      return {
        action: action.toObject(),
        evaluation: safe.evaluation,
        status,
        ...(outboxItem ? { outboxItem: outboxItem.toObject() } : {}),
        proposedAction: safe.proposal,
        source: proposal.source,
        intentAlignment: safe.intentAlignment,
        outboxId: outboxItem?.id || null,
      };
    });
  } finally {
    await session.endSession();
  }
}
