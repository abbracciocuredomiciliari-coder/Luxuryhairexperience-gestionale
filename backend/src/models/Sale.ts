import mongoose from 'mongoose';

// Vendita: righe di prodotti o servizi (anche da appuntamento).
// L'incasso collegato è un CashMovement automatico — non registrare due volte.
// Il documento fiscale (RT) resta separato: qui solo riferimento e stato emissione.
const rigaSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['servizio', 'prodotto', 'appuntamento'], required: true },
  rifId: { type: mongoose.Schema.Types.ObjectId },   // Service | Product | Appointment
  descrizione: { type: String, required: true },
  reparto: { type: String, default: 'altro' },
  quantita: { type: Number, required: true, default: 1 },
  prezzoCent: { type: Number, required: true, default: 0 },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  numero: { type: Number, required: true },          // progressivo interno
  righe: { type: [rigaSchema], required: true },
  totaleCent: { type: Number, required: true },
  metodo: { type: String, default: 'contanti' },     // contanti | pos | mypos | bonifico
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  cashMovement: { type: mongoose.Schema.Types.ObjectId, ref: 'CashMovement' },
  // Documento fiscale emesso su registratore telematico esterno
  rifFiscale: {
    numero: { type: String, default: '' },
    data: { type: String, default: '' },
    matricola: { type: String, default: '' },
    stato: { type: String, enum: ['non_emesso', 'emesso', 'errore'], default: 'non_emesso' },
  },
  stornata: { type: Boolean, default: false },
  stornataIl: { type: Date },
  motivoStorno: { type: String, default: '' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

saleSchema.index({ numero: 1 }, { unique: true });
export default mongoose.model('Sale', saleSchema);
