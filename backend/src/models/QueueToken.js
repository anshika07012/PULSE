import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: { type: Number, required: true },
    sessionKey: { type: String, required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    doctor: { type: String, required: true },
    reason: { type: String, trim: true, maxlength: 200 },
    priority: { type: String, enum: ['normal', 'urgent', 'emergency'], default: 'normal' },
    emergency: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['waiting', 'in-consultation', 'completed', 'cancelled', 'skipped'],
      default: 'waiting',
      index: true,
    },
    consultMinutes: { type: Number, default: 10 },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);
tokenSchema.index({ department: 1, sessionKey: 1, tokenNumber: 1 }, { unique: true });
export default mongoose.model('QueueToken', tokenSchema);
