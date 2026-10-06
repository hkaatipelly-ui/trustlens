import mongoose from 'mongoose';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { Resource } from '../models/Resource.js';
import { THRESHOLDS } from '../lib/trustEngine.js';
import { ApiError } from '../utils/ApiError.js';
import { createExecutionReceipt } from './outbox.service.js';

const statuses = { approve: 'approved', deny: 'denied', redact: 'redacted_sent' };

export async function decideApproval({ actionId, decision, user }) {
  await Promise.all([Action, AuditLog, OutboxItem].map((model) => model.init()));
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const original = await Action.findById(actionId).session(session);
      if (!original) throw new ApiError(404, 'ACTION_NOT_FOUND', 'The requested action does not exist.');
      if (original.status !== 'pending_approval') {
        throw new ApiError(409, 'ACTION_NOT_PENDING', 'Only pending approval actions can be decided.');
      }
      if (original.evaluation.hardBlock || original.evaluation.score < THRESHOLDS.suspicious) {
        throw new ApiError(409, 'ACTION_NOT_ELIGIBLE', 'Unsafe or hard-blocked actions cannot be approved.');
      }

      const action = await Action.findOneAndUpdate({ _id: actionId, status: 'pending_approval' }, {
        $set: {
          status: statuses[decision], decidedBy: user._id, decidedAt: new Date(), redacted: decision === 'redact',
        },
      }, { new: true, runValidators: true, session });
      if (!action) throw new ApiError(409, 'ACTION_NOT_PENDING', 'This action has already been decided.');

      let outboxItem;
      if (decision !== 'deny') {
        const resource = action.params.resourceKey
          ? await Resource.findOne({ key: action.params.resourceKey }).select('name').session(session).lean()
          : null;
        // The approved original is the immutable, tokenized Action snapshot.
        // No vault or regenerated resource content is used for either send path.
        outboxItem = await createExecutionReceipt({
          action, attachmentName: resource?.name || '', redacted: decision === 'redact', session,
        });
      }
      await AuditLog.create([{
        actor: 'user', event: `approval.${decision}`, actionRef: action._id,
        details: { decidedBy: user._id.toString(), decision, status: action.status, redacted: action.redacted },
      }], { session });
      return {
        action: action.toObject(), status: action.status,
        ...(outboxItem ? { outboxItem: outboxItem.toObject() } : {}),
      };
    });
  } finally {
    await session.endSession();
  }
}
