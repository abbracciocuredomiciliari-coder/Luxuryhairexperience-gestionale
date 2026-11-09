import { Router } from 'express';
import Appointment from '../models/Appointment';
import Client from '../models/Client';
import Service from '../models/Service';
import Operator from '../models/Operator';
import { requireAuth } from '../middleware/auth';
import { operatoreOccupato } from '../utils/agenda';

const router = Router();
router.use(requireAuth);

const POPULATE = [
  { path: 'client', select: 'firstName lastName email phone' },
  { path: 'service', select: 'nome categoria reparto durataMinuti prezzo' },
  { path: 'operator', select: 'nome reparti' },
];

// GET /api/appointments?from=&to=&stato=&operatore=&reparto=
router.get('/', async (req, res) => {
  const { from, to, stato, operatore, reparto } = req.query;
  const q: any = {};
  if (from || to) {
    q.data = {};
    if (from) q.data.$gte = new Date(`${from}T00:00:00`);
    if (to) q.data.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (stato) q.stato = stato;
  if (operatore) q.operator = operatore;
  if (reparto) q.reparto = reparto;
  res.json(await Appointment.find(q).populate(POPULATE).sort({ data: 1 }));
});

router.get('/today', async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  res.json(await Appointment.find({ data: { $gte: start, $lte: end }, stato: { $ne: 'annullato' } }).populate(POPULATE).sort({ data: 1 }));
});

// POST /api/appointments — nuovo appuntamento interno.
// Se è indicato operator, controllo conflitto sull'intero intervallo.
router.post('/', async (req, res) => {
  const { clientId, serviceId, data, ora, operatorId, reparto, note, prezzo } = req.body || {};
  if (!clientId || !serviceId || !data || !ora) {
    return res.status(400).json({ message: 'Cliente, servizio, data e ora obbligatori' });
  }
  const service = await Service.findById(serviceId);
  const client = await Client.findById(clientId);
  if (!service || !client) return res.status(404).json({ message: 'Cliente o servizio non trovato' });
  const inizio = new Date(`${data}T${ora}:00`);
  const fine = new Date(inizio.getTime() + service.durataMinuti * 60000);

  let operatorDoc = null;
  if (operatorId) {
    operatorDoc = await Operator.findById(operatorId);
    if (!operatorDoc) return res.status(404).json({ message: 'Operatore non trovato' });
    const conflitto = await operatoreOccupato(operatorId, inizio, fine);
    if (conflitto) {
      return res.status(409).json({ message: `${operatorDoc.nome} è già impegnato in quella fascia` });
    }
  }
  const app = await Appointment.create({
    client: clientId, service: serviceId,
    operator: operatorId || undefined,
    reparto: reparto || service.reparto,
    operatore: operatorDoc ? '' : (req.body.operatore || ''),
    note, data: inizio, fine, origine: 'interno',
    prezzo: prezzo ?? service.prezzo,
  });
  res.status(201).json(await app.populate(POPULATE));
});

// PATCH /api/appointments/:id — sposta/modifica (ricontrolla i conflitti se cambia l'operatore o l'orario)
router.patch('/:id', async (req, res) => {
  const app = await Appointment.findById(req.params.id);
  if (!app) return res.status(404).json({ message: 'Appuntamento non trovato' });
  const { data, ora, operatorId, reparto, note, prezzo, serviceId } = req.body || {};

  if (serviceId) {
    const s = await Service.findById(serviceId);
    if (!s) return res.status(404).json({ message: 'Servizio non trovato' });
    app.service = s._id as any;
  }
  // Ricalcolo inizio/fine se data/ora cambiano
  let nuovoInizio = app.data;
  if (data && ora) nuovoInizio = new Date(`${data}T${ora}:00`);
  const durata = serviceId
    ? (await Service.findById(serviceId))!.durataMinuti * 60000
    : app.fine.getTime() - app.data.getTime();
  const nuovaFine = new Date(nuovoInizio.getTime() + durata);

  const nuovoOp = operatorId !== undefined ? (operatorId || undefined) : app.operator;
  if (nuovoOp) {
    const conflitto = await operatoreOccupato(nuovoOp, nuovoInizio, nuovaFine, app._id);
    if (conflitto) return res.status(409).json({ message: 'Operatore già impegnato nella nuova fascia' });
  }
  app.data = nuovoInizio;
  app.fine = nuovaFine;
  app.operator = nuovoOp as any;
  if (reparto) app.reparto = reparto;
  if (note !== undefined) app.note = note;
  if (prezzo !== undefined) app.prezzo = prezzo;
  await app.save();
  res.json(await app.populate(POPULATE));
});

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
