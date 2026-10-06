import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  avatarColor: { type: String, default: '#14b8a6' },
  allowedTools: { type: [String], default: [] },
  allowedDataClasses: { type: [String], default: [] },
  baseline: {
    typicalTools: { type: [String], default: [] },
    typicalRecipients: { type: [String], default: [] },
    typicalDomains: { type: [String], default: [] },
    avgRecordsPerAction: { type: Number, min: 0, default: 1 },
    activeHours: {
      start: { type: Number, min: 0, max: 23, default: 9 },
      end: { type: Number, min: 1, max: 24, default: 19 },
    },
  },
}, { timestamps: true });

export const Agent = mongoose.model('Agent', agentSchema);
