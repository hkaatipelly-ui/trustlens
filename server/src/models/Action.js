import mongoose from 'mongoose';

export const ACTION_STATUSES = ['executed', 'pending_approval', 'blocked', 'denied', 'approved', 'redacted_sent'];

const checkSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  passed: { type: Boolean, required: true },
  penalty: { type: Number, min: 0, default: 0 },
  reason: { type: String, default: '' },
  severity: { type: String, enum: ['pass', 'low', 'medium', 'high', 'critical'], required: true },
  hardBlock: { type: Boolean, default: false },
}, { _id: false });

// The run persistence service tokenizes task/params as well as payloads before persistence.
// Raw resource content belongs only in Resource; no rawPayload field is accepted here.
const actionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  task: { type: String, required: true },
  tool: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  tokenizedPayload: { type: String, default: '' },
  privacy: {
    counts: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    entityTypes: { type: [String], default: [] },
  },
  evaluation: {
    score: { type: Number, min: 0, max: 100, required: true },
    level: { type: String, enum: ['TRUSTED', 'SUSPICIOUS', 'UNSAFE', 'BLOCKED'], required: true },
    hardBlock: { type: Boolean, default: false },
    checks: { type: [checkSchema], default: [] },
    explanation: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ACTION_STATUSES,
    required: true,
  },
  scenarioKey: String,
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  redacted: { type: Boolean, default: false },
}, { timestamps: true, strict: 'throw' });

actionSchema.index({ status: 1, createdAt: -1 });

export const Action = mongoose.model('Action', actionSchema);
