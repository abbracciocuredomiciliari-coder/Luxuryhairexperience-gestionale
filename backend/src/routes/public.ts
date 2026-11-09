import { Router } from 'express';
import crypto from 'crypto';
import Client from '../models/Client';
import Service from '../models/Service';
import Appointment from '../models/Appointment';

const router = Router();

// ── Orari di apertura (configurabili; in futuro per-operatore/giorno) ──
const ORARI = { apertura: '09:00', chiusura: '19:00', pausaInizio: '13:00', pausaFine: '14:00', passoMinuti: 30 };
// Giorni chiusi: 0 = domenica
const GIORNI_CHIUSI = [0];

const toMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// GET /api/public/services — listino attivo per il sito
router.get('/services', async (_req, res) => {
  res.json(await Service.find({ attivo: true }).sort({ ordine: 1, nome: 1 }));
});

// GET /api/public/slots?serviceId=&data=YYYY-MM-DD — fasce libere sul calendario vero
router.get('/slots', async (req, res) => {
  const { serviceId, data } = req.query;
  const service = await Service.findById(serviceId);
  if (!service || !data) return res.status(400).json({ message: 'Servizio e data obbligatori' });
  const giorno = new Date(`${data}T12:00:00`);
  if (isNaN(giorno.getTime())) return res.status(400).json({ message: 'Data non valida' });
  if (GIORNI_CHIUSI.includes(giorno.getDay())) return res.json({ data, slots: [], chiuso: true });

  // Appuntamenti già occupati quel giorno
  const start = new Date(`${data}T00:00:00`);
  const end = new Date(`${data}T23:59:59.999`);
  const occupati = await Appointment.find({ data: { $gte: start, $lte: end }, stato: { $nin: ['annullato', 'no_show'] } });

  const durata = service.durataMinuti;
  const apertura = toMin(ORARI.apertura), chiusura = toMin(ORARI.chiusura);
  const pausaA = toMin(ORARI.pausaInizio), pausaB = toMin(ORARI.pausaFine);
  const oggi = new Date();
  const slots: { ora: string; libera: boolean }[] = [];

  for (let m = apertura; m + durata <= chiusura; m += ORARI.passoMinuti) {
    const inizio = new Date(`${data}T${toHHMM(m)}:00`);
    const fine = new Date(inizio.getTime() + durata * 60000);
    // Nel passato → non prenotabile
    if (inizio <= oggi) continue;
    // Sborda nella pausa → non prenotabile
    if (m < pausaB && m + durata > pausaA) continue;
    // Sovrapposizione con appuntamenti esistenti
    const conflitto = occupati.some(a => a.data < fine && a.fine > inizio);
    slots.push({ ora: toHHMM(m), libera: !conflitto });
  }
  res.json({ data, durata, slots });
});

// POST /api/public/prenota — prenotazione dal sito: crea/trova cliente + appuntamento
router.post('/prenota', async (req, res) => {
  const { serviceId, data, ora, firstName, lastName, email, phone, note, consensoPrivacy } = req.body || {};
  if (!serviceId || !data || !ora || !firstName || !email) {
    return res.status(400).json({ message: 'Servizio, data, ora, nome ed email obbligatori' });
  }
  if (!consensoPrivacy) return res.status(400).json({ message: 'Serve il consenso privacy per prenotare' });
  const service = await Service.findById(serviceId);
  if (!service || !service.attivo) return res.status(404).json({ message: 'Servizio non disponibile' });

  const inizio = new Date(`${data}T${ora}:00`);
  if (inizio <= new Date()) return res.status(400).json({ message: 'La fascia scelta è nel passato' });
  const fine = new Date(inizio.getTime() + service.durataMinuti * 60000);

  // Verifica concorrente: la fascia deve essere ancora libera
  const conflitto = await Appointment.findOne({
    stato: { $nin: ['annullato', 'no_show'] },
    data: { $lt: fine }, fine: { $gt: inizio },
  });
  if (conflitto) return res.status(409).json({ message: 'La fascia è appena stata occupata: scegline un\'altra' });

  // Trova o crea la cartella cliente (chiave: email)
  const mail = String(email).toLowerCase().trim();
  let client = await Client.findOne({ email: mail });
  if (!client) {
    client = await Client.create({
      firstName, lastName: lastName || '', email: mail, phone: phone || '',
      consensoPrivacy: true, consensoPrivacyIl: new Date(),
    });
  } else {
    if (phone && !client.phone) client.phone = phone;
    if (!client.consensoPrivacy) { client.consensoPrivacy = true; client.consensoPrivacyIl = new Date(); }
    await client.save();
  }

  const app = await Appointment.create({
    client: client._id, service: service._id,
    data: inizio, fine, origine: 'sito', note: note || '', prezzo: service.prezzo,
  });

  // Link magico della cartella (in futuro inviato via email)
  if (!client.accessToken || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    client.accessToken = crypto.randomBytes(24).toString('hex');
    client.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await client.save();
  }
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.status(201).json({
    prenotazione: {
      id: String(app._id),
      servizio: service.nome,
      data: inizio,
      fine,
      prezzo: app.prezzo,
      stato: app.stato,
    },
    linkCartella: `${base}/cartella?t=${client.accessToken}`,
    messaggio: 'Prenotazione registrata. Ti invieremo conferma e promemoria via email.',
  });
});

// GET /api/public/cartella?t=token — cartella cliente via link magico
router.get('/cartella', async (req, res) => {
  const t = String(req.query.t || '');
  if (!t) return res.status(401).json({ message: 'Link non valido' });
  const client = await Client.findOne({ accessToken: t });
  if (!client || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    return res.status(401).json({ message: 'Link scaduto: richiedine uno nuovo' });
  }
  const appuntamenti = await Appointment.find({ client: client._id })
    .populate('service', 'nome categoria durataMinuti prezzo')
    .sort({ data: -1 });
  res.json({
    cliente: { firstName: client.firstName, lastName: client.lastName, email: client.email },
    appuntamenti,
  });
});

// POST /api/public/cartella/annulla — il cliente annulla un suo appuntamento futuro
router.post('/cartella/annulla', async (req, res) => {
  const { t, appointmentId } = req.body || {};
  const client = await Client.findOne({ accessToken: t || '' });
  if (!client || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    return res.status(401).json({ message: 'Link scaduto' });
  }
  const app = await Appointment.findOne({ _id: appointmentId, client: client._id });
  if (!app) return res.status(404).json({ message: 'Appuntamento non trovato' });
  if (app.data < new Date()) return res.status(400).json({ message: 'Non puoi annullare un appuntamento passato' });
  app.stato = 'annullato';
  await app.save();
  res.json({ message: 'Appuntamento annullato' });
});

// POST /api/public/accesso-cartella — richiesta link per email (da collegare a SMTP)
router.post('/accesso-cartella', async (req, res) => {
  const { email } = req.body || {};
  const mail = String(email || '').toLowerCase().trim();
  if (!mail) return res.status(400).json({ message: 'Inserisci la tua email' });
  const client = await Client.findOne({ email: mail });
  // Risposta uniforme: non rivela se l'email esiste
  if (!client) return res.json({ message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.' });
  client.accessToken = crypto.randomBytes(24).toString('hex');
  client.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await client.save();
  // TODO: quando SMTP configurato → inviare il link via email invece di restituirlo
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.json({
    message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.',
    // In attesa di SMTP restituiamo il link (solo per collaudo — rimuovere in produzione con email attiva)
    linkCollaudo: `${base}/cartella?t=${client.accessToken}`,
  });
});

export default router;
