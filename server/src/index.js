import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { loadEnv } from './config/env.js';
import { User } from './models/User.js';

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal}: shutting down TrustLens`);

  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeIdleConnections();
      });
    }
    await disconnectDatabase();
    clearTimeout(timeout);
  } catch {
    console.error('Unable to shut down cleanly.');
    process.exitCode = 1;
  }
}

async function start() {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  await User.init();

  const app = createApp(env);
  await new Promise((resolve, reject) => {
    server = app.listen(env.PORT, '0.0.0.0', resolve);
    server.once('error', reject);
  });

  console.info(`TrustLens API listening on port ${env.PORT}`);
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch(async (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? 'The API port is already in use. Set a different PORT in server/.env.'
      : error.message,
  );
  await disconnectDatabase();
  process.exitCode = 1;
});
