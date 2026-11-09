import { Router } from 'express';
import CashMovement from '../models/CashMovement';
import CashClosure from '../models/CashClosure';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

export const METODI = ['contanti', 'pos', 'mypos', 'bonifico'];
export const REPARTI = ['parrucchiere', 'estetica', 'unghie', 'abbigliamento', 'altro'];

// GET /api/cash/movimenti?from=&to=&tipo=&metodo=&reparto=
router.get('/movimenti', async (req, res) => {
  const { from, to, tipo, metodo, reparto } = req.query;
  const q: any = {};
  if (from || to) {
    q.data = {};
    if (from) q.data.$gte = new Date(`${from}T00:00:00`);
    if (to) q.data.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (tipo) q.tipo = tipo;
  if (metodo) q.metodo = metodo;
  if (reparto) q.reparto = reparto;
  res.json(await CashMovement.find(q).sort({ data: -1 }).limit(500));
});

// POST /api/cash/movimenti — movimento manuale (entrata o uscita)
router.post('/movimenti', async (req, res) => {
  const { tipo, reparto, metodo, importoCent, nota, data } = req.body || {};
  if (!tipo || !importoCent || importoCent <= 0) {
    return res.status(400).json({ message: 'Tipo e importo obbligatori' });
  }
  const m = await CashMovement.create({
    tipo, reparto: reparto || 'altro', metodo: metodo || 'contanti',
    importoCent, nota, data: data ? new Date(`${data}T12:00:00`) : new Date(),
    collegamento: { tipo: 'manuale' },
  });
  res.status(201).json(m);
});

router.delete('/movimenti/:id', async (req, res) => {
  const m = await CashMovement.findById(req.params.id);
  if (!m) return res.status(404).json({ message: 'Movimento non trovato' });
  if (m.automatico) return res.status(400).json({ message: 'Movimento automatico: annullare il documento collegato' });
  await m.deleteOne();
  res.json({ message: 'Eliminato' });
});

// GET /api/cash/giornata/:giorno — atteso per metodo di un giorno (per la chiusura)
router.get('/giornata/:giorno', async (req, res) => {
  const giorno = req.params.giorno;
  const movs = await CashMovement.find({
    data: { $gte: new Date(`${giorno}T00:00:00`), $lte: new Date(`${giorno}T23:59:59.999`) },
  });
  const perMetodo = METODI.map(metodo => {
    const entrate = movs.filter(m => m.metodo === metodo && m.tipo === 'entrata').reduce((s, m) => s + m.importoCent, 0);
    const uscite = movs.filter(m => m.metodo === metodo && m.tipo === 'uscita').reduce((s, m) => s + m.importoCent, 0);
    return { metodo, attesoCent: entrate - uscite };
  });
  const chiusura = await CashClosure.findOne({ giorno });
  res.json({
    giorno,
    perMetodo,
    entrateCent: movs.filter(m => m.tipo === 'entrata').reduce((s, m) => s + m.importoCent, 0),
    usciteCent: movs.filter(m => m.tipo === 'uscita').reduce((s, m) => s + m.importoCent, 0),
    chiusura,
  });
});

// POST /api/cash/chiusura — chiusura di giornata con verificato per metodo
router.post('/chiusura', async (req, res) => {
  const { giorno, perMetodo, chiusaDa, note } = req.body || {};
  if (!giorno || !Array.isArray(perMetodo)) return res.status(400).json({ message: 'Giorno e verifiche per metodo obbligatori' });
  const exist = await CashClosure.findOne({ giorno });
  if (exist) return res.status(409).json({ message: 'Giornata già chiusa' });
  const verifiche = perMetodo.map((p: any) => ({
    metodo: p.metodo,
    attesoCent: p.attesoCent || 0,
    verificatoCent: p.verificatoCent || 0,
    differenzaCent: (p.verificatoCent || 0) - (p.attesoCent || 0),
  }));
  const movs = await CashMovement.find({
    data: { $gte: new Date(`${giorno}T00:00:00`), $lte: new Date(`${giorno}T23:59:59.999`) },
  });
  const c = await CashClosure.create({
    giorno,
    perMetodo: verifiche,
    entrateCent: movs.filter(m => m.tipo === 'entrata').reduce((s, m) => s + m.importoCent, 0),
    usciteCent: movs.filter(m => m.tipo === 'uscita').reduce((s, m) => s + m.importoCent, 0),
    chiusaDa, note,
  });
  res.status(201).json(c);
});

// GET /api/cash/chiusure — storico chiusure
router.get('/chiusure', async (_req, res) => {
  res.json(await CashClosure.find().sort({ giorno: -1 }).limit(120));
});

export default router;
