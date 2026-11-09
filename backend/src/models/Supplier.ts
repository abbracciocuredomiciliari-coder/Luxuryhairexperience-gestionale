import mongoose from 'mongoose';

// Conto fornitore: addebiti e pagamenti, saldo aggiornato.
// Non è contabilità fiscale.
const supplierSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  piva: { type: String, default: '' },
  email: { type: String, default: '' },
  telefono: { type: String, default: '' },
  contatti: { type: String, default: '' },
  attivo: { type: Boolean, default: true },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Supplier', supplierSchema);
