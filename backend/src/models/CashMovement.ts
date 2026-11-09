import mongoose from 'mongoose';

// Movimento di cassa interno: entrata/uscita per metodo e reparto.
// I movimenti generati da vendite/ordini/fatture sono 'automatico' e portano
// il collegamento univoco (idempotenza: mai due incassi per lo stesso documento).
const cashMovementSchema = new mongoose.Schema({
  data: { type: Date, required: true, default: Date.now },
  tipo: { type: String, enum: ['entrata', 'uscita'], required: true },
  reparto: { type: String, default: 'altro' },       // parrucchiere|estetica|unghie|abbigliamento|altro
  metodo: { type: String, default: 'contanti' },     // contanti|pos|mypos|bonifico
  importoCent: { type: Number, required: true },
  nota: { type: String, default: '' },
  automatico: { type: Boolean, default: false },
  collegamento: {
    tipo: { type: String, enum: ['sale', 'order', 'supplier_invoice', 'supplier_payment', 'storno', 'manuale'], default: 'manuale' },
    rifId: { type: mongoose.Schema.Types.ObjectId },
  },
  createdAt: { type: Date, default: Date.now },
});

cashMovementSchema.index({ 'collegamento.tipo': 1, 'collegamento.rifId': 1 });
export default mongoose.model('CashMovement', cashMovementSchema);
