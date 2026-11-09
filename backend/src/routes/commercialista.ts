import { Router } from 'express';
import CashMovement from '../models/CashMovement';
import Sale from '../models/Sale';
import Product from '../models/Product';
import SupplierInvoice from '../models/SupplierInvoice';
import CashClosure from '../models/CashClosure';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
// Commercialista = report per il contabile: accessibile a admin e commercialista
router.use(requireAuth, requireRole('admin', 'commercialista'));

const periodo = (req: any) => {
  const { from, to } = req.query;
  const q: any = {};
  if (from) q.$gte = new Date(`${from}T00:00:00`);
  if (to) q.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(q).length ? q : null;
};

// GET /api/commercialista/riepilogo?from=&to= — entrate, uscite, saldo,
// scorte a prezzo di vendita, fatture fornitori (data documento vs data pagamento)
router.get('/riepilogo', async (req, res) => {
  const dataQ = periodo(req) || {};
  const movs = await CashMovement.find(Object.keys(dataQ).length ? { data: dataQ } : {});
  const entrateCent = movs.filter(m => m.tipo === 'entrata').reduce((s, m) => s + m.importoCent, 0);
  const usciteCent = movs.filter(m => m.tipo === 'uscita').reduce((s, m) => s + m.importoCent, 0);
  const perMetodo: Record<string, number> = {};
  movs.forEach(m => { perMetodo[m.metodo] = (perMetodo[m.metodo] || 0) + (m.tipo === 'entrata' ? m.importoCent : -m.importoCent); });
  const perReparto: Record<string, number> = {};
  movs.filter(m => m.tipo === 'entrata').forEach(m => { perReparto[m.reparto] = (perReparto[m.reparto] || 0) + m.importoCent; });

  const prodotti = await Product.find({ attivo: true });
  const valoreScorteCent = prodotti.reduce((s, p) => s + p.giacenza * p.prezzoCent, 0);
  const sotto = prodotti.filter(p => p.giacenzaMinima > 0 && p.giacenza <= p.giacenzaMinima)
    .map(p => ({ nome: p.nome, giacenza: p.giacenza, minima: p.giacenzaMinima }));

  // Fatture fornitori con data documento e data pagamento separate
  const fattureQ: any = Object.keys(dataQ).length ? { dataDocumento: dataQ } : {};
  const fatture = await SupplierInvoice.find(fattureQ).populate('supplier', 'nome').sort({ dataDocumento: 1 });
  const fattureMancanti = fatture.filter(f => !f.allegato?.dati).length;
  const fattureNonPagate = fatture.filter(f => f.stato !== 'pagata');

  // Vendite senza riferimento fiscale (promemoria interni ≠ documenti fiscali)
  const salesQ: any = Object.keys(dataQ).length ? { createdAt: dataQ, stornata: false } : { stornata: false };
  const vendite = await Sale.find(salesQ);
  const venditeSenzaRif = vendite.filter(v => !v.rifFiscale?.numero).length;

  const chiusure = await CashClosure.find(Object.keys(dataQ).length ? { giorno: dataQ } : {}).sort({ giorno: -1 });

  res.json({
    periodo: req.query,
    entrateCent, usciteCent, saldoCent: entrateCent - usciteCent,
    perMetodo, perReparto,
    valoreScorteCent, prodottiSottoScorta: sotto,
    fatture: fatture.map(f => ({
      _id: f._id, numero: f.numero, anno: f.anno,
      fornitore: (f.supplier as any)?.nome,
      dataDocumento: f.dataDocumento, scadenza: f.scadenza,
      dataPrimoPagamento: f.dataPrimoPagamento, dataSaldo: f.dataSaldo,
      imponibileCent: f.imponibileCent, ivaCent: f.ivaCent, totaleCent: f.totaleCent,
      pagatoCent: f.pagatoCent, residuoCent: f.totaleCent - f.pagatoCent,
      stato: f.stato, allegato: !!f.allegato?.dati,
    })),
    controlli: {
      fattureSenzaAllegato: fattureMancanti,
      fattureNonPagate: fattureNonPagate.length,
      venditeSenzaRifFiscale: venditeSenzaRif,
    },
    chiusure,
    nota: 'I movimenti di cassa sono interni e NON sostituiscono i documenti fiscali emessi dal registratore telematico.',
  });
});

// GET /api/commercialista/csv?tipo=movimenti|fatture|vendite&from=&to=
router.get('/csv', async (req, res) => {
  const { tipo } = req.query;
  const dataQ = periodo(req) || {};
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = '', nome = `luxury-${tipo || 'export'}.csv`;

  if (tipo === 'movimenti') {
    const movs = await CashMovement.find(Object.keys(dataQ).length ? { data: dataQ } : {}).sort({ data: 1 });
    csv = ['data;tipo;reparto;metodo;importo;nota']
      .concat(movs.map(m => [m.data.toISOString().slice(0, 10), m.tipo, m.reparto, m.metodo, (m.importoCent / 100).toFixed(2), esc(m.nota)].join(';')))
      .join('\n');
  } else if (tipo === 'fatture') {
    const fatture = await SupplierInvoice.find(Object.keys(dataQ).length ? { dataDocumento: dataQ } : {}).populate('supplier', 'nome').sort({ dataDocumento: 1 });
    csv = ['fornitore;numero;anno;data_documento;scadenza;imponibile;iva;totale;pagato;residuo;stato;data_primo_pagamento;data_saldo']
      .concat(fatture.map(f => [esc((f.supplier as any)?.nome), esc(f.numero), f.anno || '',
        f.dataDocumento?.toISOString().slice(0, 10), f.scadenza?.toISOString().slice(0, 10) || '',
        (f.imponibileCent / 100).toFixed(2), (f.ivaCent / 100).toFixed(2), (f.totaleCent / 100).toFixed(2),
        (f.pagatoCent / 100).toFixed(2), ((f.totaleCent - f.pagatoCent) / 100).toFixed(2), f.stato,
        f.dataPrimoPagamento?.toISOString().slice(0, 10) || '', f.dataSaldo?.toISOString().slice(0, 10) || ''].join(';')))
      .join('\n');
  } else if (tipo === 'vendite') {
    const vendite = await Sale.find(Object.keys(dataQ).length ? { createdAt: dataQ } : {}).populate('client', 'firstName lastName').sort({ numero: 1 });
    csv = ['numero;data;totale;metodo;rif_fiscale_numero;rif_fiscale_data;stornata;note']
      .concat(vendite.map(v => [v.numero, v.createdAt.toISOString().slice(0, 10),
        (v.totaleCent / 100).toFixed(2), v.metodo, esc(v.rifFiscale?.numero || ''), v.rifFiscale?.data || '',
        v.stornata ? 'si' : 'no', esc(v.note || '')].join(';')))
      .join('\n');
  } else {
    return res.status(400).json({ message: 'Tipo non valido: movimenti, fatture o vendite' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.send('﻿' + csv);
});

// GET /api/commercialista/stampa?from=&to= — riepilogo HTML stampabile
router.get('/stampa', async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const r = await fetch(`${base}/api/commercialista/riepilogo?from=${req.query.from || ''}&to=${req.query.to || ''}`, {
    headers: { authorization: req.headers.authorization || '' },
  });
  const d: any = await r.json();
  const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Riepilogo commercialista</title>
<style>body{font-family:Georgia,serif;margin:40px;color:#222}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:16px 0}
td,th{border:1px solid #bbb;padding:6px 8px;font-size:13px;text-align:left}th{background:#f0f0f0}.note{color:#666;font-size:12px;margin-top:24px}</style></head>
<body><h1>Luxury Hair Experience — Riepilogo periodo ${req.query.from || ''} → ${req.query.to || ''}</h1>
<table><tr><th></th><th>Importo</th></tr><tr><td>Entrate</td><td>${euro(d.entrateCent)}</td></tr>
<tr><td>Uscite</td><td>${euro(d.usciteCent)}</td></tr><tr><td><b>Saldo</b></td><td><b>${euro(d.saldoCent)}</b></td></tr>
<tr><td>Valore scorte (prezzo vendita)</td><td>${euro(d.valoreScorteCent)}</td></tr></table>
<h2>Per metodo</h2><table><tr><th>Metodo</th><th>Saldo</th></tr>
${Object.entries(d.perMetodo || {}).map(([m, v]: any) => `<tr><td>${m}</td><td>${euro(v)}</td></tr>`).join('')}</table>
<h2>Fatture fornitori</h2><table><tr><th>Fornitore</th><th>N.</th><th>Data doc.</th><th>Totale</th><th>Residuo</th><th>Stato</th></tr>
${(d.fatture || []).map((f: any) => `<tr><td>${f.fornitore || ''}</td><td>${f.numero}</td><td>${(f.dataDocumento || '').slice(0, 10)}</td><td>${euro(f.totaleCent)}</td><td>${euro(f.residuoCent)}</td><td>${f.stato}</td></tr>`).join('')}</table>
<p class="note">Controlli: ${d.controlli?.fattureSenzaAllegato || 0} fatture senza allegato · ${d.controlli?.fattureNonPagate || 0} non pagate · ${d.controlli?.venditeSenzaRifFiscale || 0} vendite senza riferimento fiscale.<br>
${d.nota || ''}<br>Generato il ${new Date().toLocaleString('it-IT')}</p></body></html>`);
});

export default router;
