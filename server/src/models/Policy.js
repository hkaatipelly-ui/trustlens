import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['hard_block', 'penalty'], required: true },
  penalty: { type: Number, min: 0, max: 100, default: 0 },
  rule: { type: mongoose.Schema.Types.Mixed, required: true },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

export const Policy = mongoose.model('Policy', policySchema);
