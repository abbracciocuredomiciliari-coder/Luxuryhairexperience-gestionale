import mongoose from 'mongoose';

// Appuntamento su calendario vero: data + orario inizio/fine calcolati
// dalla durata del servizio. Stato: prenotato → confermato → completato / annullato.
const appointmentSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },  // assegnazione reale
  reparto: { type: String, enum: ['parrucchiere', 'estetica', 'unghie', 'altro'], default: 'parrucchiere' },
  operatore: { type: String, default: '' },         // nome libero se senza operatore schedulato
  data: { type: Date, required: true },             // data/ora di inizio
  fine: { type: Date, required: true },             // data/ora di fine calcolata
  stato: {
    type: String,
    enum: ['prenotato', 'confermato', 'completato', 'annullato', 'no_show'],
    default: 'prenotato',
  },
  note: { type: String, default: '' },
  origine: { type: String, enum: ['sito', 'telefono', 'interno'], default: 'interno' },
  prezzo: { type: Number, default: 0 },             // prezzo pattuito (può differire dal listino)
  promemoriaInviato: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

appointmentSchema.index({ data: 1 });
export default mongoose.model('Appointment', appointmentSchema);
