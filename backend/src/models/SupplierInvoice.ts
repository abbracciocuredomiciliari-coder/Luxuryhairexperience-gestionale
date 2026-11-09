import mongoose from 'mongoose';

// Fattura fornitore: numero + anno + date documento/scadenza + imponibile/IVA,
// allegato, pagamenti anche parziali collegati alla cassa (idempotenti).
// Controllo duplicati per fornitore+numero+anno (indice univoco).
const supplierInvoiceSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  numero: { type: String, required: true },
  anno: { type: Number },                              // anno fattura (per deduplicazione)
  ragioneSociale: { type: String, default: '' },
  piva: { type: String, default: '' },
  dataDocumento: { type: Date, required: true },       // data fattura
  scadenza: { type: Date },
  imponibileCent: { type: Number, required: true, default: 0 },
  ivaCent: { type: Number, required: true, default: 0 },
  totaleCent: { type: Number, required: true, default: 0 },
  pagatoCent: { type: Number, default: 0 },
  allegato: {
    nome: { type: String, default: '' },
    tipo: { type: String, default: '' },               // mime
    dati: { type: String, default: '' },               // base64, max ~1MB
  },
  stato: { type: String, enum: ['aperta', 'parziale', 'pagata'], default: 'aperta' },
  pagamenti: [{
    data: { type: Date, required: true },
    importoCent: { type: Number, required: true },
    metodo: { type: String, default: 'bonifico' },
    cashMovement: { type: mongoose.Schema.Types.ObjectId, ref: 'CashMovement' },
  }],
  dataPrimoPagamento: { type: Date },                  // data documento ≠ data pagamento
  dataSaldo: { type: Date },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

supplierInvoiceSchema.index({ supplier: 1, numero: 1, anno: 1 }, { unique: true, sparse: true });
export default mongoose.model('SupplierInvoice', supplierInvoiceSchema);
