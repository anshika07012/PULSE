import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor'], required: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true }, // doctors only
    licenseId: { type: String, trim: true }, // doctors only
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    department: this.department,
    licenseId: this.licenseId,
  };
};

export default mongoose.model('User', userSchema);
