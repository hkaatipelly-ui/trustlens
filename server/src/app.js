import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/requestLogger.js';
import { ApiError } from './utils/ApiError.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';
import { sendSuccess } from './utils/response.js';
import { createApiRateLimiter } from './middleware/rateLimit.js';

export function createApp(config, dependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Render places exactly one reverse proxy in front of the Node service.
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.CLIENT_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, { status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api', createApiRateLimiter(), createApiRouter(config, dependencies));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
