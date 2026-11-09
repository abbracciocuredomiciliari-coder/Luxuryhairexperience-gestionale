import mongoose from 'mongoose';

// Consulenza armocromia collegata alla cartella cliente.
const consultationSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  data: { type: Date, default: Date.now },
  stagione: { type: String, required: true },          // Inverno freddo, Primavera calda…
  palette: [{ type: String }],                         // colori consigliati
  operatrice: { type: String, default: '' },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Consultation', consultationSchema);
