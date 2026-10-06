import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  dataClass: { type: String, required: true },
  content: { type: String, required: true, select: false },
  recordCount: { type: Number, min: 0, default: 0 },
  mimeType: { type: String, default: 'text/plain' },
}, { timestamps: true });

export const Resource = mongoose.model('Resource', resourceSchema);
