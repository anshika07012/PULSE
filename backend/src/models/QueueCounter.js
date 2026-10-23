import mongoose from 'mongoose';

const queueCounterSchema = new mongoose.Schema(
  {
    department: { type: String, required: true },
    sessionKey: { type: String, required: true },
    lastTokenNumber: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

queueCounterSchema.index({ department: 1, sessionKey: 1 }, { unique: true });

export default mongoose.model('QueueCounter', queueCounterSchema);
