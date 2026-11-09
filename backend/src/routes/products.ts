import { Router } from 'express';
import Product from '../models/Product';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const solo = req.query.attivi === '1' ? { attivo: true } : {};
  res.json(await Product.find(solo).sort({ categoria: 1, nome: 1 }));
});

router.post('/', async (req, res) => {
  const { nome, categoria, prezzoCent, giacenza, giacenzaMinima, note } = req.body || {};
  if (!nome) return res.status(400).json({ message: 'Nome obbligatorio' });
  const p = await Product.create({ nome, categoria, prezzoCent, giacenza, giacenzaMinima, note });
  res.status(201).json(p);
});

router.put('/:id', async (req, res) => {
  const allowed = ['nome', 'categoria', 'prezzoCent', 'giacenzaMinima', 'attivo', 'note'];
  const update: any = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const p = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!p) return res.status(404).json({ message: 'Articolo non trovato' });
  res.json(p);
});

// Rettifica giacenza: delta positivo/negativo con motivo nel log
router.post('/:id/rettifica', async (req, res) => {
  const { delta, nota } = req.body || {};
  if (typeof delta !== 'number' || delta === 0) return res.status(400).json({ message: 'Delta obbligatorio' });
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Articolo non trovato' });
  p.giacenza = Math.max(0, p.giacenza + delta);
  await p.save();
  console.log(`[scorte] ${p.nome}: ${delta > 0 ? '+' : ''}${delta} → ${p.giacenza}${nota ? ` (${nota})` : ''}`);
  res.json(p);
});

router.delete('/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Eliminato' });
});

export default router;
