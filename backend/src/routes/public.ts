import { Router } from 'express';
import crypto from 'crypto';
import Client from '../models/Client';
import Service from '../models/Service';
import Appointment from '../models/Appointment';
import Operator from '../models/Operator';
import { slotOperatore, operatoriReparto, operatoreOccupato } from '../utils/agenda';

const router = Router();

// GET /api/public/services — listino attivo per il sito
router.get('/services', async (_req, res) => {
  res.json(await Service.find({ attivo: true }).sort({ ordine: 1, nome: 1 }));
});

// GET /api/public/operatori?reparto= — nomi operatori del reparto (solo nome, niente dati interni)
router.get('/operatori', async (req, res) => {
  const ops = await operatoriReparto(req.query.reparto as string);
  res.json(ops.map(o => ({ _id: o._id, nome: o.nome, reparti: o.reparti })));
});

// GET /api/public/slots?serviceId=&data=&operatorId=
// Se operatorId: fasce di quell'operatore. Altrimenti: fasce libere su ALMENO
// un operatore del reparto del servizio (restituisce anche chi è libero).
router.get('/slots', async (req, res) => {
  const { serviceId, data, operatorId } = req.query as any;
  const service = await Service.findById(serviceId);
  if (!service || !data) return res.status(400).json({ message: 'Servizio e data obbligatori' });
  const giorno = new Date(`${data}T12:00:00`);
  if (isNaN(giorno.getTime())) return res.status(400).json({ message: 'Data non valida' });

  let ops: any[];
  if (operatorId) {
    const o = await Operator.findById(operatorId);
    ops = o && o.attivo ? [o] : [];
  } else {
    ops = await operatoriReparto(service.reparto);
  }
  if (!ops.length) return res.json({ data, slots: [], operatori: [] });

  const perOperatore: Record<string, { ora: string; libera: boolean }[]> = {};
  for (const o of ops) perOperatore[String(o._id)] = await slotOperatore(o, data, service.durataMinuti);

  // Unione delle fasce: libera se almeno un operatore è libero
  const orari = new Set<string>();
  Object.values(perOperatore).forEach(list => list.forEach(s => orari.add(s.ora)));
  const slots = [...orari].sort().map(ora => ({
    ora,
    libera: ops.some(o => perOperatore[String(o._id)]?.find(s => s.ora === ora)?.libera),
    operatori: ops.filter(o => perOperatore[String(o._id)]?.find(s => s.ora === ora)?.libera).map(o => String(o._id)),
  }));
  res.json({ data, durata: service.durataMinuti, slots });
});

// POST /api/public/prenota — prenotazione dal sito.
// Se non è scelto l'operatore, assegna il primo libero del reparto.
router.post('/prenota', async (req, res) => {
  const { serviceId, data, ora, operatorId, firstName, lastName, email, phone, note, consensoPrivacy } = req.body || {};
  if (!serviceId || !data || !ora || !firstName || !email) {
    return res.status(400).json({ message: 'Servizio, data, ora, nome ed email obbligatori' });
  }
  if (!consensoPrivacy) return res.status(400).json({ message: 'Serve il consenso privacy per prenotare' });
  const service = await Service.findById(serviceId);
  if (!service || !service.attivo) return res.status(404).json({ message: 'Servizio non disponibile' });

  const inizio = new Date(`${data}T${ora}:00`);
  if (inizio <= new Date()) return res.status(400).json({ message: 'La fascia scelta è nel passato' });
  const fine = new Date(inizio.getTime() + service.durataMinuti * 60000);

  // Scelta operatore: richiesto oppure primo libero del reparto
  let operatore: any = null;
  if (operatorId) {
    operatore = await Operator.findById(operatorId);
    if (!operatore) return res.status(404).json({ message: 'Operatore non trovato' });
    if (await operatoreOccupato(operatore._id, inizio, fine)) {
      return res.status(409).json({ message: `${operatore.nome} è già impegnato in quella fascia` });
    }
  } else {
    const ops = await operatoriReparto(service.reparto);
    for (const o of ops) {
      if (!(await operatoreOccupato(o._id, inizio, fine))) { operatore = o; break; }
    }
    if (!operatore) return res.status(409).json({ message: 'La fascia è appena stata occupata: scegline un\'altra' });
  }

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
    client: client._id, service: service._id, operator: operatore._id,
    reparto: service.reparto, data: inizio, fine, origine: 'sito',
    note: note || '', prezzo: service.prezzo,
  });

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
      operatore: operatore.nome,
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
    .populate('operator', 'nome')
    .sort({ data: -1 });
  res.json({
    cliente: { firstName: client.firstName, lastName: client.lastName, email: client.email },
    appuntamenti,
  });
});

// POST /api/public/cartella/annulla — annulla appuntamento futuro (libera la fascia)
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

// POST /api/public/accesso-cartella — richiesta link per email (SMTP da collegare)
router.post('/accesso-cartella', async (req, res) => {
  const mail = String(req.body?.email || '').toLowerCase().trim();
  if (!mail) return res.status(400).json({ message: 'Inserisci la tua email' });
  const client = await Client.findOne({ email: mail });
  if (!client) return res.json({ message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.' });
  client.accessToken = crypto.randomBytes(24).toString('hex');
  client.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await client.save();
  // TODO: quando SMTP configurato → inviare il link via email invece di restituirlo
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.json({
    message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.',
    linkCollaudo: `${base}/cartella?t=${client.accessToken}`,
  });
});

export default router;
