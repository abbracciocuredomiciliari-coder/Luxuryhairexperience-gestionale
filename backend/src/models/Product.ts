import mongoose from 'mongoose';

// Articolo boutique: catalogo, prezzo vendita e giacenza.
// Prezzi in centesimi per importi esatti.
const productSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  categoria: { type: String, default: 'Boutique' },
  prezzoCent: { type: Number, required: true, default: 0 },
  giacenza: { type: Number, default: 0 },
  giacenzaMinima: { type: Number, default: 0 },
  attivo: { type: Boolean, default: true },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Product', productSchema);
