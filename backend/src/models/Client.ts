import mongoose from 'mongoose';

// Cartella cliente: si crea alla prima prenotazione o manualmente.
// Il cliente accede alla sua cartella via link magico (token) — l'invio email
// arriverà quando sarà configurata info@luxuryhairexperience.it.
const clientSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, default: '', trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, default: '', trim: true },
  birthDate: { type: Date },
  notes: { type: String, default: '' },
  tags: [{ type: String }],
  // Scheda tecnica salone (armocromia, preferenze, allergie)
  profilo: {
    stagione: { type: String, default: '' },
    palette: { type: String, default: '' },
    allergie: { type: String, default: '' },
    preferenze: { type: String, default: '' },
  },
  // Token di accesso alla cartella (link magico). Ruotato a ogni richiesta.
  accessToken: { type: String, default: '', index: true },
  accessTokenScade: { type: Date },
  consensoPrivacy: { type: Boolean, default: false },
  consensoPrivacyIl: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Client', clientSchema);
