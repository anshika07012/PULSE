import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: { type: Number, required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    doctor: { type: String, required: true },
    reason: { type: String, trim: true, maxlength: 200 },
    priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
    status: {
      type: String,
      enum: ['waiting', 'in-consultation', 'completed', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    consultMinutes: { type: Number, default: 10 },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('QueueToken', tokenSchema);
