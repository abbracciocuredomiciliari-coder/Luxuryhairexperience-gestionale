import { Router } from 'express';
import Sale from '../models/Sale';
import Product from '../models/Product';
import CashMovement from '../models/CashMovement';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/sales?from=&to=
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  const q: any = {};
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) q.createdAt.$lte = new Date(`${to}T23:59:59.999`);
  }
  res.json(await Sale.find(q).populate('client', 'firstName lastName').sort({ numero: -1 }).limit(300));
});

// Scarico scorte atomico: ogni riga usa findOneAndUpdate con guard sulla
// giacenza (mai sotto zero, mai doppio scarico). In caso di errore si
// compensano le righe già scaricate.
async function scaricaRighe(righe: any[]) {
  const scaricate: any[] = [];
  try {
    for (const r of righe) {
      if (r.tipo !== 'prodotto' || !r.rifId) continue;
      const p = await Product.findOneAndUpdate(
        { _id: r.rifId, giacenza: { $gte: r.quantita } },
        { $inc: { giacenza: -r.quantita } },
        { new: true },
      );
      if (!p) {
        const esiste = await Product.findById(r.rifId);
        throw Object.assign(new Error(
          esiste ? `Scorte insufficienti: ${esiste.nome} (disponibili ${esiste.giacenza})` : 'Articolo non trovato',
        ), { status: 409 });
      }
      scaricate.push(r);
    }
  } catch (e) {
    for (const r of scaricate) {
      await Product.findByIdAndUpdate(r.rifId, { $inc: { giacenza: r.quantita } }).catch(() => {});
    }
    throw e;
  }
}

// POST /api/sales — vendita: scarico scorte + incasso automatico in cassa.
router.post('/', async (req, res) => {
  const { righe, metodo, clientId, note } = req.body || {};
  if (!Array.isArray(righe) || !righe.length) return res.status(400).json({ message: 'Righe vendita obbligatorie' });
  try {
    await scaricaRighe(righe);
    const totaleCent = righe.reduce((s: number, r: any) => s + r.prezzoCent * r.quantita, 0);
    const reparto = righe.find((r: any) => r.reparto)?.reparto || 'altro';

    // Progressivo con retry su collisione dell'indice univoco
    let sale: any = null, lastErr: any = null;
    for (let tent = 0; tent < 3 && !sale; tent++) {
      const ultima = await Sale.findOne().sort({ numero: -1 });
      const numero = (ultima?.numero || 0) + 1;
      const mov = await CashMovement.create({
        tipo: 'entrata', reparto, metodo: metodo || 'contanti',
        importoCent: totaleCent, nota: `Vendita n. ${numero}`,
        automatico: true, collegamento: { tipo: 'sale' },
      });
      try {
        sale = await Sale.create({
          numero, righe, totaleCent, metodo: metodo || 'contanti',
          client: clientId || undefined, note: note || '', cashMovement: mov._id,
        });
        mov.collegamento!.rifId = sale._id;
        await mov.save();
      } catch (e: any) {
        await mov.deleteOne().catch(() => {});
        if (e?.code !== 11000) throw e;
        lastErr = e;
      }
    }
    if (!sale) throw lastErr || new Error('Errore creazione vendita');
    res.status(201).json(sale);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

// POST /api/sales/:id/storno — storno interno: ripristina scorte e crea
// movimento compensativo in cassa. NON annulla documenti fiscali emessi.
// Idempotente: il flag stornata si imposta atomicamente una sola volta.
router.post('/:id/storno', async (req, res) => {
  const { motivo } = req.body || {};
  try {
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, stornata: false },
      { $set: { stornata: true, stornataIl: new Date(), motivoStorno: motivo || '' } },
      { new: true },
    );
    if (!sale) {
      const esiste = await Sale.findById(req.params.id);
      return res.status(esiste ? 409 : 404).json({ message: esiste ? 'Vendita già stornata' : 'Vendita non trovata' });
    }
    // Ripristino scorte
    for (const r of sale.righe) {
      if (r.tipo === 'prodotto' && r.rifId) {
        await Product.findByIdAndUpdate(r.rifId, { $inc: { giacenza: r.quantita } });
      }
    }
    // Compensazione cassa (indice univoco su collegamento → mai doppia)
    const esiste = await CashMovement.findOne({ 'collegamento.tipo': 'storno', 'collegamento.rifId': sale._id });
    if (!esiste) {
      await CashMovement.create({
        tipo: 'uscita', reparto: sale.righe[0]?.reparto || 'altro', metodo: sale.metodo,
        importoCent: sale.totaleCent,
        nota: `Storno vendita n. ${sale.numero}${motivo ? `: ${motivo}` : ''}`,
        automatico: true, collegamento: { tipo: 'storno', rifId: sale._id },
      });
    }
    res.json(sale);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

// PATCH /api/sales/:id/fiscale — associa riferimento documento RT emesso esternamente
router.patch('/:id/fiscale', async (req, res) => {
  const { numero, data, matricola, stato } = req.body || {};
  const sale = await Sale.findById(req.params.id);
  if (!sale) return res.status(404).json({ message: 'Vendita non trovata' });
  sale.rifFiscale = { numero: numero || '', data: data || '', matricola: matricola || '', stato: stato || 'emesso' };
  await sale.save();
  res.json(sale);
});

export default router;
