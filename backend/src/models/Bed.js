import mongoose from 'mongoose';

const bedSchema = new mongoose.Schema(
  {
    ward: { type: String, required: true, index: true },
    wardType: { type: String, required: true }, // ICU | General | Emergency | Surgical | Maternity | Pediatrics
    floor: { type: Number, required: true, index: true },
    label: { type: String, required: true },
    status: { type: String, enum: ['available', 'occupied', 'cleaning'], default: 'available' },
    patientName: String,
    since: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Bed', bedSchema);
