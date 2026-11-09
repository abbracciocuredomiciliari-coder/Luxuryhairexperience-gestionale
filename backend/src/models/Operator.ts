import mongoose from 'mongoose';

// Operatore del salone: parrucchiere, estetista, onicotecnica, ecc.
// Ognuno ha reparti abilitati, turni settimanali e ferie/assenze.
const turnoSchema = new mongoose.Schema({
  attivo: { type: Boolean, default: false },
  inizio: { type: String, default: '09:00' },
  fine: { type: String, default: '19:00' },
  pausaInizio: { type: String, default: '13:00' },
  pausaFine: { type: String, default: '14:00' },
}, { _id: false });

const operatorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  // Reparti su cui può lavorare (un operatore non può essere in due reparti alla stessa ora)
  reparti: [{ type: String, enum: ['parrucchiere', 'estetica', 'unghie', 'altro'] }],
  attivo: { type: Boolean, default: true },
  ordine: { type: Number, default: 0 },
  // Turni settimanali: indice 0 = domenica … 6 = sabato
  turni: { type: [turnoSchema], default: undefined },
  // Ferie e assenze (giorni interi, YYYY-MM-DD)
  assenze: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Operator', operatorSchema);
