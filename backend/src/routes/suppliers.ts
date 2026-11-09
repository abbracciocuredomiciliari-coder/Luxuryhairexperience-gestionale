import { Router } from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier';
import SupplierInvoice from '../models/SupplierInvoice';
import CashMovement from '../models/CashMovement';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ---------- Fornitori ----------
router.get('/', async (_req, res) => {
  const fornitori = await Supplier.find().sort({ nome: 1 });
  // Saldo aggiornato dai movimenti
  const agg = await SupplierInvoice.aggregate([
    { $group: { _id: '$supplier', dovutoCent: { $sum: '$totaleCent' }, pagatoCent: { $sum: '$pagatoCent' } } },
  ]);
  const map = new Map(agg.map(a => [String(a._id), a]));
  res.json(fornitori.map(f => ({
    ...f.toObject(),
    dovutoCent: map.get(String(f._id))?.dovutoCent || 0,
    pagatoCent: map.get(String(f._id))?.pagatoCent || 0,
    saldoCent: (map.get(String(f._id))?.dovutoCent || 0) - (map.get(String(f._id))?.pagatoCent || 0),
  })));
});

router.post('/', async (req, res) => {
  const { nome, piva, email, telefono, contatti, note } = req.body || {};
  if (!nome) return res.status(400).json({ message: 'Nome obbligatorio' });
  res.status(201).json(await Supplier.create({ nome, piva, email, telefono, contatti, note }));
});

router.put('/:id', async (req, res) => {
  const allowed = ['nome', 'piva', 'email', 'telefono', 'contatti', 'note', 'attivo'];
  const update: any = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const s = await Supplier.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!s) return res.status(404).json({ message: 'Fornitore non trovato' });
  res.json(s);
});

// GET /api/suppliers/:id/movimenti — storico fatture+pagamenti del fornitore
router.get('/:id/movimenti', async (req, res) => {
  const fatture = await SupplierInvoice.find({ supplier: req.params.id }).sort({ dataDocumento: -1 });
  const ids = fatture.map(f => f._id);
  const movs = await CashMovement.find({ 'collegamento.tipo': 'supplier_payment', 'collegamento.rifId': { $in: ids } }).sort({ data: -1 });
  res.json({ fatture, pagamenti: movs });
});

// ---------- Fatture fornitori ----------
router.get('/fatture', async (req, res) => {
  const q: any = {};
  if (req.query.stato) q.stato = req.query.stato;
  if (req.query.supplier) q.supplier = req.query.supplier;
  res.json(await SupplierInvoice.find(q).populate('supplier', 'nome').sort({ dataDocumento: -1 }).limit(300));
});

// POST /api/suppliers/fatture — con allegato base64 (PDF/XML/JPG/PNG max 1MB) + check duplicati
router.post('/fatture', async (req, res) => {
  const { supplier, numero, anno, dataDocumento, scadenza, imponibileCent, ivaCent, allegato } = req.body || {};
  if (!supplier || !numero || !dataDocumento) return res.status(400).json({ message: 'Fornitore, numero e data obbligatori' });
  const totaleCent = (imponibileCent || 0) + (ivaCent || 0);

  // Controllo duplicato per fornitore/numero/anno
  const dup = await SupplierInvoice.findOne({ supplier, numero, anno: anno || null });
  if (dup) return res.status(409).json({ message: `Fattura ${numero} del fornitore già registrata` });

  // Validazione allegato
  let docAllegato;
  if (allegato?.dati) {
    const ok = ['application/pdf', 'image/jpeg', 'image/png', 'application/xml', 'text/xml'];
    if (!ok.includes(allegato.tipo)) return res.status(400).json({ message: 'Formato allegato non ammesso (PDF, XML, JPG, PNG)' });
    const size = Buffer.from(allegato.dati, 'base64').length;
    if (size > 1024 * 1024) return res.status(400).json({ message: 'Allegato troppo grande (max 1 MB)' });
    docAllegato = allegato;
  }
  const f = await SupplierInvoice.create({
    supplier, numero, anno, dataDocumento: new Date(dataDocumento),
    scadenza: scadenza ? new Date(scadenza) : undefined,
    imponibileCent: imponibileCent || 0, ivaCent: ivaCent || 0, totaleCent,
    allegato: docAllegato,
  });
  res.status(201).json(f);
});

// GET /api/suppliers/fatture/:id/allegato — scarica l'allegato
router.get('/fatture/:id/allegato', async (req, res) => {
  const f = await SupplierInvoice.findById(req.params.id);
  if (!f?.allegato?.dati) return res.status(404).json({ message: 'Allegato non presente' });
  res.setHeader('Content-Type', f.allegato.tipo);
  res.setHeader('Content-Disposition', `attachment; filename="${f.allegato.nome || 'allegato'}"`);
  res.send(Buffer.from(f.allegato.dati, 'base64'));
});

// POST /api/suppliers/fatture/:id/pagamento — pagamento parziale/totale.
// Il residuo si aggiorna atomicamente con guard $expr: due richieste
// contemporanee non possono superare il totale. L'uscita cassa è collegata
// al movimento registrato in f.pagamenti (idempotenza lato applicazione).
router.post('/fatture/:id/pagamento', async (req, res) => {
  const { importoCent, metodo, data } = req.body || {};
  if (!importoCent || importoCent <= 0) return res.status(400).json({ message: 'Importo obbligatorio' });
  try {
    const dataPag = data ? new Date(`${data}T12:00:00`) : new Date();
    const mov = await CashMovement.create({
      tipo: 'uscita', reparto: 'altro', metodo: metodo || 'bonifico',
      importoCent, nota: '',   // nota impostata dopo con il numero fattura
      data: dataPag, automatico: true,
      collegamento: { tipo: 'supplier_payment' },
    });
    // Aggiornamento atomico: solo se il residuo copre l'importo.
    // Qualsiasi fallimento → il movimento cassa viene cancellato (mai orfani).
    let f;
    try {
      f = await SupplierInvoice.findOneAndUpdate(
      {
        _id: req.params.id,
        stato: { $ne: 'pagata' },
        $expr: { $gte: [{ $subtract: ['$totaleCent', '$pagatoCent'] }, importoCent] },
      },
      [
        {
          $set: {
            pagatoCent: { $add: ['$pagatoCent', importoCent] },
            stato: { $cond: [{ $gte: [{ $add: ['$pagatoCent', importoCent] }, '$totaleCent'] }, 'pagata', 'parziale'] },
            dataPrimoPagamento: { $ifNull: ['$dataPrimoPagamento', dataPag] },
            dataSaldo: { $cond: [{ $gte: [{ $add: ['$pagatoCent', importoCent] }, '$totaleCent'] }, dataPag, '$dataSaldo'] },
            pagamenti: { $concatArrays: ['$pagamenti', [{ data: dataPag, importoCent, metodo: metodo || 'bonifico', cashMovement: mov._id }]] },
          },
        },
      ],
      { new: true },
    );
    } catch (e) {
      await mov.deleteOne().catch(() => {});
      throw e;
    }
    if (!f) {
      await mov.deleteOne();
      const esiste = await SupplierInvoice.findById(req.params.id);
      if (!esiste) return res.status(404).json({ message: 'Fattura non trovata' });
      const residuo = esiste.totaleCent - esiste.pagatoCent;
      return res.status(400).json({
        message: residuo <= 0 ? 'Fattura già pagata' : `L'importo supera il residuo (${(residuo / 100).toFixed(2)} €)`,
      });
    }
    mov.nota = `Pagamento fattura ${f.numero}`;
    mov.collegamento!.rifId = f._id;
    await mov.save();
    res.json(f);
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message });
  }
});

export default router;
