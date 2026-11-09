import { Router } from 'express';
import crypto from 'crypto';
import Client from '../models/Client';
import Appointment from '../models/Appointment';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/clients?q= — ricerca cartelle clienti
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const filter: any = q
    ? { $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ] }
    : {};
  res.json(await Client.find(filter).select('-accessToken').sort({ createdAt: -1 }).limit(200));
});

// GET /api/clients/:id — cartella completa + storico appuntamenti
router.get('/:id', async (req, res) => {
  const client = await Client.findById(req.params.id).select('-accessToken');
  if (!client) return res.status(404).json({ message: 'Cliente non trovato' });
  const appuntamenti = await Appointment.find({ client: client._id })
    .populate('service', 'nome categoria durataMinuti prezzo')
    .sort({ data: -1 });
  res.json({ client, appuntamenti });
});

// POST /api/clients — nuova cartella manuale
router.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, notes, consensoPrivacy } = req.body || {};
  if (!firstName || !email) return res.status(400).json({ message: 'Nome ed email obbligatori' });
  const exists = await Client.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Esiste già una cartella con questa email', clientId: exists._id });
  const c = await Client.create({
    firstName, lastName, email: String(email).toLowerCase(), phone, notes,
    consensoPrivacy: !!consensoPrivacy, consensoPrivacyIl: consensoPrivacy ? new Date() : undefined,
  });
  res.status(201).json(c);
});

// PATCH /api/clients/:id — aggiorna anagrafica/profilo/note
router.patch('/:id', async (req, res) => {
  const allowed = ['firstName', 'lastName', 'phone', 'birthDate', 'notes', 'tags', 'profilo', 'consensoPrivacy'];
  const update: any = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  if (update.consensoPrivacy === true) update.consensoPrivacyIl = new Date();
  const c = await Client.findByIdAndUpdate(req.params.id, update, { new: true }).select('-accessToken');
  if (!c) return res.status(404).json({ message: 'Cliente non trovato' });
  res.json(c);
});

// POST /api/clients/:id/link-accesso — genera/rigenera il link magico della cartella.
// Quando sarà configurato SMTP, lo stesso token verrà inviato via email.
router.post('/:id/link-accesso', async (req, res) => {
  const c = await Client.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Cliente non trovato' });
  c.accessToken = crypto.randomBytes(24).toString('hex');
  c.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await c.save();
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.json({ link: `${base}/cartella?t=${c.accessToken}`, scade: c.accessTokenScade });
});

router.delete('/:id', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ message: 'Eliminata' });
});

export default router;
