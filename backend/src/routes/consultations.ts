import { Router } from 'express';
import Consultation from '../models/Consultation';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const q: any = {};
  if (req.query.client) q.client = req.query.client;
  if (req.query.stagione) q.stagione = req.query.stagione;
  res.json(await Consultation.find(q).populate('client', 'firstName lastName').sort({ data: -1 }).limit(200));
});

router.post('/', async (req, res) => {
  const { clientId, stagione, palette, operatrice, note } = req.body || {};
  if (!clientId || !stagione) return res.status(400).json({ message: 'Cliente e stagione obbligatori' });
  res.status(201).json(await Consultation.create({ client: clientId, stagione, palette: palette || [], operatrice, note }));
});

router.put('/:id', async (req, res) => {
  const allowed = ['stagione', 'palette', 'operatrice', 'note'];
  const update: any = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const c = await Consultation.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!c) return res.status(404).json({ message: 'Consulenza non trovata' });
  res.json(c);
});

router.delete('/:id', async (req, res) => {
  await Consultation.findByIdAndDelete(req.params.id);
  res.json({ message: 'Eliminata' });
});

export default router;
