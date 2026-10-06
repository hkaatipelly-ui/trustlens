import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { ApiError } from '../utils/ApiError.js';

const newest = { createdAt: -1, _id: -1 };
const agentFields = 'name key avatarColor';

export function getActions({ status, limit }) {
  return Action.find(status ? { status } : {}).select('-__v')
    .populate('agent', agentFields).sort(newest).limit(limit).lean();
}

export async function getAction(id) {
  const action = await Action.findById(id).select('-__v')
    .populate('agent', agentFields).populate('decidedBy', 'name').lean();
  if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', 'The requested action does not exist.');
  return action;
}

export function getPendingApprovals({ limit }) {
  return getActions({ status: 'pending_approval', limit });
}

export function getOutbox({ limit }) {
  return OutboxItem.find().select('-__v').sort(newest).limit(limit).lean();
}

export function getAudit({ limit }) {
  return AuditLog.find().select('-__v').sort(newest).limit(limit).lean();
}
