import { Router } from 'express';
import { listAgents, listPolicies, listResources } from '../controllers/catalogController.js';
import { authenticate } from '../middleware/auth.js';
import { createAuthRouter } from './auth.js';
import { listScenarios } from '../controllers/scenariosController.js';
import { createTrustRouter } from './trust.js';
import { createGeminiClient } from '../services/ai/gemini.client.js';
import { createRunRouter } from './runs.js';
import { createHistoryRouter } from './history.js';
import { createDemoRouter } from './demo.js';

export function createApiRouter(config, { aiProvider } = {}) {
  const router = Router();
  router.use('/auth', createAuthRouter(config));
  router.use(authenticate(config));
  router.get('/agents', listAgents);
  router.get('/policies', listPolicies);
  router.get('/resources', listResources);
  router.get('/scenarios', listScenarios);
  router.use('/trust', createTrustRouter());
  router.use(createRunRouter(aiProvider ?? createGeminiClient(config)));
  router.use(createHistoryRouter());
  router.use('/demo', createDemoRouter());
  return router;
}
