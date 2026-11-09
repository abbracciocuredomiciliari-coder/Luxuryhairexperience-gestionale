import mongoose from 'mongoose';

// Utenti interni: titolare/admin e staff del salone.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'reception', 'operator', 'commercialista'], default: 'reception' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);
