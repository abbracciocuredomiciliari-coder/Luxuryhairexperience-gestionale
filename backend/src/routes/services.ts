import { Router } from 'express';
import Service from '../models/Service';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/services — pubblico (il sito prenotazioni mostra il listino attivo)
router.get('/', async (_req, res) => {
  res.json(await Service.find({ attivo: true }).sort({ ordine: 1, nome: 1 }));
});

// GET /api/services/all — tutti, inclusi disattivati (staff)
router.get('/all', requireAuth, async (_req, res) => {
  res.json(await Service.find().sort({ ordine: 1, nome: 1 }));
});

router.post('/', requireAuth, async (req, res) => {
  const { nome, categoria, durataMinuti, prezzo, descrizione } = req.body || {};
  if (!nome || !durataMinuti) return res.status(400).json({ message: 'Nome e durata obbligatori' });
  const s = await Service.create({ nome, categoria, durataMinuti, prezzo, descrizione });
  res.status(201).json(s);
});

router.put('/:id', requireAuth, async (req, res) => {
  const s = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!s) return res.status(404).json({ message: 'Servizio non trovato' });
  res.json(s);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: 'Eliminato' });
});

export default router;
