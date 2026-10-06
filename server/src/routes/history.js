import { Router } from 'express';
import { actionDetail, approvalDecision, listActions, listAudit, listOutbox, listPending, stats } from '../controllers/historyController.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  actionIdParamsSchema, actionListQuerySchema, approvalBodySchema,
  emptyQuerySchema, idParamsSchema, listQuerySchema,
} from '../validation/history.js';

export function createHistoryRouter() {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/actions', validate(actionListQuerySchema, 'query'), listActions);
  router.get('/actions/:id', validate(idParamsSchema, 'params'), validate(emptyQuerySchema, 'query'), actionDetail);
  router.get('/approvals/pending', validate(listQuerySchema, 'query'), listPending);
  router.post('/approvals/:actionId', requireRole('admin', 'approver'), validate(actionIdParamsSchema, 'params'),
    validate(emptyQuerySchema, 'query'), validate(approvalBodySchema), approvalDecision);
  router.get('/outbox', validate(listQuerySchema, 'query'), listOutbox);
  router.get('/audit', validate(listQuerySchema, 'query'), listAudit);
  router.get('/stats', validate(emptyQuerySchema, 'query'), stats);
  return router;
}
