import mongoose from 'mongoose';

// Listino servizi prenotabili (il cliente li sceglie dal sito).
const serviceSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  categoria: { type: String, default: 'Capelli' },
  reparto: { type: String, enum: ['parrucchiere', 'estetica', 'unghie', 'abbigliamento', 'altro'], default: 'parrucchiere' },
  durataMinuti: { type: Number, required: true, default: 60 },
  prezzo: { type: Number, required: true, default: 0 },
  descrizione: { type: String, default: '' },
  attivo: { type: Boolean, default: true },
  ordine: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Service', serviceSchema);
