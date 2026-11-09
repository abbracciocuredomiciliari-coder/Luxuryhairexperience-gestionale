import { Router } from 'express';
import Operator from '../models/Operator';
import Appointment from '../models/Appointment';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/operators — pubblico (il sito mostra nomi/reparti disponibili, non dati sensibili)
router.get('/', async (_req, res) => {
  const ops = await Operator.find({ attivo: true }).sort({ ordine: 1, nome: 1 })
    .select('nome reparti');
  res.json(ops);
});

// ── Gestione interna ──
router.get('/all', requireAuth, async (_req, res) => {
  res.json(await Operator.find().sort({ ordine: 1, nome: 1 }));
});

router.post('/', requireAuth, async (req, res) => {
  const { nome, reparti, turni } = req.body || {};
  if (!nome) return res.status(400).json({ message: 'Nome obbligatorio' });
  const o = await Operator.create({ nome, reparti: reparti || [], turni });
  res.status(201).json(o);
});

router.put('/:id', requireAuth, async (req, res) => {
  const allowed = ['nome', 'reparti', 'attivo', 'ordine', 'turni'];
  const update: any = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const o = await Operator.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!o) return res.status(404).json({ message: 'Operatore non trovato' });
  res.json(o);
});

// POST /api/operators/:id/assenze — aggiungi/togli ferie (giorni YYYY-MM-DD)
router.post('/:id/assenze', requireAuth, async (req, res) => {
  const { giorni, rimuovi } = req.body || {};
  if (!Array.isArray(giorni)) return res.status(400).json({ message: 'Elenco giorni obbligatorio' });
  const o = await Operator.findById(req.params.id);
  if (!o) return res.status(404).json({ message: 'Operatore non trovato' });
  const set = new Set(o.assenze || []);
  if (rimuovi) giorni.forEach((g: string) => set.delete(g));
  else giorni.forEach((g: string) => set.add(g));
  o.assenze = [...set].sort();
  await o.save();
  res.json(o);
});

// Appuntamenti senza operatore assegnato (da distribuire manualmente)
router.get('/da-assegnare', requireAuth, async (_req, res) => {
  const apps = await Appointment.find({ operator: { $exists: false }, stato: { $nin: ['annullato', 'completato'] } })
    .populate('client', 'firstName lastName')
    .populate('service', 'nome durataMinuti')
    .sort({ data: 1 });
  res.json(apps);
});

export default router;
