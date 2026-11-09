import { Router } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const q: any = {};
  if (req.query.stato) q.stato = req.query.stato;
  res.json(await Order.find(q).populate('client', 'firstName lastName').sort({ numero: -1 }).limit(200));
});

// POST /api/orders — ordine multiriga con scarico scorte atomico + compensazione.
// NOTA: non crea incasso automatico — il pagamento si registra quando avviene.
router.post('/', async (req, res) => {
  const { righe, clientId, clienteLibero, note } = req.body || {};
  if (!Array.isArray(righe) || !righe.length) return res.status(400).json({ message: 'Righe obbligatorie' });
  const scaricate: any[] = [];
  try {
    for (const r of righe) {
      if (!r.product) continue;
      const p = await Product.findOneAndUpdate(
        { _id: r.product, giacenza: { $gte: r.quantita } },
        { $inc: { giacenza: -r.quantita } }, { new: true },
      );
      if (!p) {
        const esiste = await Product.findById(r.product);
        throw Object.assign(new Error(esiste ? `Scorte insufficienti: ${esiste.nome}` : 'Articolo non trovato'), { status: 409 });
      }
      scaricate.push(r);
    }
    const ultimo = await Order.findOne().sort({ numero: -1 });
    const order = await Order.create({
      numero: (ultimo?.numero || 0) + 1,
      client: clientId || undefined,
      clienteLibero: clienteLibero || '',
      righe, totaleCent: righe.reduce((s: number, r: any) => s + r.prezzoCent * r.quantita, 0),
      note: note || '',
    });
    res.status(201).json(order);
  } catch (e: any) {
    for (const r of scaricate) {
      await Product.findByIdAndUpdate(r.product, { $inc: { giacenza: r.quantita } }).catch(() => {});
    }
    res.status(e.status || 500).json({ message: e.message });
  }
});

// PATCH /api/orders/:id/stato — inserito→preparazione→consegnato / annullato
router.patch('/:id/stato', async (req, res) => {
  const { stato } = req.body || {};
  if (!['inserito', 'preparazione', 'consegnato', 'annullato'].includes(stato)) {
    return res.status(400).json({ message: 'Stato non valido' });
  }
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Ordine non trovato' });
  if (order.stato === 'annullato') return res.status(409).json({ message: 'Ordine già annullato' });
  if (stato === 'annullato') {
    for (const r of order.righe) {
      if (r.product) await Product.findByIdAndUpdate(r.product, { $inc: { giacenza: r.quantita } });
    }
  }
  order.stato = stato;
  await order.save();
  res.json(order);
});

// PATCH /api/orders/:id/pagato — segna incasso registrato (anti doppio incasso)
router.patch('/:id/pagato', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, pagato: false },
    { $set: { pagato: true } }, { new: true },
  );
  if (!order) {
    const esiste = await Order.findById(req.params.id);
    return res.status(esiste ? 409 : 404).json({ message: esiste ? 'Incasso già registrato' : 'Ordine non trovato' });
  }
  res.json(order);
});

export default router;
