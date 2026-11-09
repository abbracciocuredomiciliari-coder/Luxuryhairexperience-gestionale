import mongoose from 'mongoose';

// Chiusura di giornata: per ogni metodo, importo atteso (calcolato dai movimenti)
// vs importo verificato (contato) e differenza. Non è un bilancio.
const chiusuraMetodoSchema = new mongoose.Schema({
  metodo: { type: String, required: true },
  attesoCent: { type: Number, default: 0 },
  verificatoCent: { type: Number, default: 0 },
  differenzaCent: { type: Number, default: 0 },
}, { _id: false });

const cashClosureSchema = new mongoose.Schema({
  giorno: { type: String, required: true, unique: true },   // YYYY-MM-DD
  perMetodo: { type: [chiusuraMetodoSchema], default: [] },
  entrateCent: { type: Number, default: 0 },
  usciteCent: { type: Number, default: 0 },
  chiusaDa: { type: String, default: '' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('CashClosure', cashClosureSchema);
