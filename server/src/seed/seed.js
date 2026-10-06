import { loadEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from './seedDatabase.js';

async function seed() {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);

  const result = await seedDatabase();
  console.info(`Seed complete: ${result.agents} agents, ${result.policies} policies, ${result.resources} resources.`);
  console.info(`Demo account ready: ${result.demoEmail}`);
}

try {
  await seed();
} catch (error) {
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
