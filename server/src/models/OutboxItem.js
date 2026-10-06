import mongoose from 'mongoose';

const outboxItemSchema = new mongoose.Schema({
  action: { type: mongoose.Schema.Types.ObjectId, ref: 'Action', required: true, unique: true },
  tool: { type: String, required: true },
  to: { type: String, default: '' },
  subject: { type: String, default: '' },
  bodyPreview: { type: String, default: '' },
  attachmentName: { type: String, default: '' },
  redacted: { type: Boolean, default: false },
}, { timestamps: true });

export const OutboxItem = mongoose.model('OutboxItem', outboxItemSchema);
