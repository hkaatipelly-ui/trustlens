import mongoose from 'mongoose';
import { Action } from '../models/Action.js';
import { AuditLog } from '../models/AuditLog.js';
import { OutboxItem } from '../models/OutboxItem.js';
import { initializeSeedModels, seedDatabase } from '../seed/seedDatabase.js';

export async function resetDemo() {
  // Initialize outside the transaction; Atlas requires a replica set for transactions.
  await initializeSeedModels();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      // Operations on a transaction's session must run sequentially.
      const outbox = await OutboxItem.deleteMany({}, { session });
      const audit = await AuditLog.deleteMany({}, { session });
      const actions = await Action.deleteMany({}, { session });
      const seeded = await seedDatabase({ session });
      return {
        cleared: { actions: actions.deletedCount, outbox: outbox.deletedCount, audit: audit.deletedCount },
        seeded,
        resetAt: new Date().toISOString(),
      };
    });
  } finally {
    await session.endSession();
  }
}
