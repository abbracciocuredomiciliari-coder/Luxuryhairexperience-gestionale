import mongoose from 'mongoose';

// Articolo boutique: catalogo, prezzo vendita e giacenza.
// Prezzi in centesimi per importi esatti.
const productSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  categoria: { type: String, default: 'Boutique' },
  descrizione: { type: String, default: '' },
  prezzoCent: { type: Number, required: true, default: 0 },
  giacenza: { type: Number, default: 0 },
  giacenzaMinima: { type: Number, default: 0 },
  attivo: { type: Boolean, default: true },
  // Vendita online sul sito pubblico (/shop)
  vendibileOnline: { type: Boolean, default: false },
  immagine: {
    nome: { type: String, default: '' },
    tipo: { type: String, default: '' },
    dati: { type: String, default: '' },      // base64, max ~300KB
  },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Product', productSchema);
