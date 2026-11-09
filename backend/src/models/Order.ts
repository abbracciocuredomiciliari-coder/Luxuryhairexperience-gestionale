import mongoose from 'mongoose';

// Ordine cliente: righe prodotto, scarico scorte all'inserimento,
// ripristino all'annullamento. L'incasso NON è automatico: registrare una
// vendita (o movimento manuale) quando il pagamento avviene.
const orderSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clienteLibero: { type: String, default: '' },       // nome se senza cartella
  righe: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    descrizione: { type: String, required: true },
    quantita: { type: Number, required: true },
    prezzoCent: { type: Number, required: true },
  }],
  totaleCent: { type: Number, required: true },
  stato: { type: String, enum: ['inserito', 'preparazione', 'consegnato', 'annullato'], default: 'inserito' },
  pagato: { type: Boolean, default: false },          // segna quando registrato l'incasso
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

orderSchema.index({ numero: 1 }, { unique: true });
export default mongoose.model('Order', orderSchema);
