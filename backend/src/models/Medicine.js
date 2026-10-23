import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0, default: 20 },
    unit: { type: String, default: 'strips' },
    price: { type: Number, required: true, min: 0 },
    expiry: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

medicineSchema.virtual('status').get(function () {
  if (this.stock === 0) return 'out';
  if (this.stock <= this.minStock) return 'low';
  return 'in';
});

export default mongoose.model('Medicine', medicineSchema);
