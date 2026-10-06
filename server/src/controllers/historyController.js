import { getAction, getActions, getAudit, getOutbox, getPendingApprovals } from '../services/history.service.js';
import { decideApproval } from '../services/approval.service.js';
import { getStats } from '../services/stats.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const listActions = asyncHandler(async (req, res) => sendSuccess(res, await getActions(req.validated.query)));
export const actionDetail = asyncHandler(async (req, res) => sendSuccess(res, await getAction(req.validated.params.id)));
export const listPending = asyncHandler(async (req, res) => sendSuccess(res, await getPendingApprovals(req.validated.query)));
export const listOutbox = asyncHandler(async (req, res) => sendSuccess(res, await getOutbox(req.validated.query)));
export const listAudit = asyncHandler(async (req, res) => sendSuccess(res, await getAudit(req.validated.query)));
export const stats = asyncHandler(async (req, res) => sendSuccess(res, await getStats()));
export const approvalDecision = asyncHandler(async (req, res) => {
  const result = await decideApproval({
    actionId: req.validated.params.actionId, decision: req.body.decision, user: req.user,
  });
  return sendSuccess(res, result);
});
