import { Router } from 'express';
import Appointment from '../models/Appointment';
import Client from '../models/Client';
import Service from '../models/Service';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const POPULATE = [{ path: 'client', select: 'firstName lastName email phone' }, { path: 'service', select: 'nome categoria durataMinuti prezzo' }];

// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD — appuntamenti nel range
router.get('/', async (req, res) => {
  const { from, to, stato } = req.query;
  const q: any = {};
  if (from || to) {
    q.data = {};
    if (from) q.data.$gte = new Date(`${from}T00:00:00`);
    if (to) q.data.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (stato) q.stato = stato;
  res.json(await Appointment.find(q).populate(POPULATE).sort({ data: 1 }));
});

// GET /api/appointments/today — agenda di oggi
router.get('/today', async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  res.json(await Appointment.find({ data: { $gte: start, $lte: end }, stato: { $ne: 'annullato' } }).populate(POPULATE).sort({ data: 1 }));
});

// POST /api/appointments — nuovo appuntamento interno (telefono/banco)
router.post('/', async (req, res) => {
  const { clientId, serviceId, data, ora, operatore, note, prezzo } = req.body || {};
  if (!clientId || !serviceId || !data || !ora) {
    return res.status(400).json({ message: 'Cliente, servizio, data e ora obbligatori' });
  }
  const service = await Service.findById(serviceId);
  const client = await Client.findById(clientId);
  if (!service || !client) return res.status(404).json({ message: 'Cliente o servizio non trovato' });
  const inizio = new Date(`${data}T${ora}:00`);
  const fine = new Date(inizio.getTime() + service.durataMinuti * 60000);
  // Controllo sovrapposizioni per lo stesso operatore (se specificato)
  if (operatore) {
    const conflitto = await Appointment.findOne({
      operatore,
      stato: { $nin: ['annullato', 'no_show'] },
      data: { $lt: fine },
      fine: { $gt: inizio },
    });
    if (conflitto) return res.status(409).json({ message: `Conflitto: ${operatore} è già impegnato in quella fascia` });
  }
  const app = await Appointment.create({
    client: clientId, service: serviceId, operatore, note,
    data: inizio, fine, origine: 'interno',
    prezzo: prezzo ?? service.prezzo,
  });
  res.status(201).json(await app.populate(POPULATE));
});

// PATCH /api/appointments/:id — sposta/modifica (data, ora, operatore, note, prezzo)
router.patch('/:id', async (req, res) => {
  const app = await Appointment.findById(req.params.id);
  if (!app) return res.status(404).json({ message: 'Appuntamento non trovato' });
  const { data, ora, operatore, note, prezzo, serviceId } = req.body || {};
  if (serviceId) {
    const s = await Service.findById(serviceId);
    if (!s) return res.status(404).json({ message: 'Servizio non trovato' });
    app.service = s._id as any;
    app.fine = new Date(app.data.getTime() + s.durataMinuti * 60000);
  }
  if (data && ora) {
    const inizio = new Date(`${data}T${ora}:00`);
    const durata = app.fine.getTime() - app.data.getTime();
    app.data = inizio;
    app.fine = new Date(inizio.getTime() + durata);
  }
  if (operatore !== undefined) app.operatore = operatore;
  if (note !== undefined) app.note = note;
  if (prezzo !== undefined) app.prezzo = prezzo;
  await app.save();
  res.json(await app.populate(POPULATE));
});

// PATCH /api/appointments/:id/stato — conferma/completa/annulla
router.patch('/:id/stato', async (req, res) => {
  const { stato } = req.body || {};
  if (!['prenotato', 'confermato', 'completato', 'annullato', 'no_show'].includes(stato)) {
    return res.status(400).json({ message: 'Stato non valido' });
  }
  const app = await Appointment.findByIdAndUpdate(req.params.id, { stato }, { new: true }).populate(POPULATE);
  if (!app) return res.status(404).json({ message: 'Appuntamento non trovato' });
  res.json(app);
});

router.delete('/:id', async (req, res) => {
  await Appointment.findByIdAndDelete(req.params.id);
  res.json({ message: 'Eliminato' });
});

export default router;
