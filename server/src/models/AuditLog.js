import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actor: { type: String, required: true },
  event: { type: String, required: true },
  actionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Action' },
  details: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
