import { Router } from 'express';
import crypto from 'crypto';
import Client from '../models/Client';
import Service from '../models/Service';
import Appointment from '../models/Appointment';
import Operator from '../models/Operator';
import Product from '../models/Product';
import Order from '../models/Order';
import { slotOperatore, operatoriReparto, operatoreOccupato } from '../utils/agenda';

const router = Router();

// GET /api/public/services — listino attivo per il sito
router.get('/services', async (_req, res) => {
  res.json(await Service.find({ attivo: true }).sort({ ordine: 1, nome: 1 }));
});

// GET /api/public/operatori?reparto= — nomi operatori del reparto (solo nome, niente dati interni)
router.get('/operatori', async (req, res) => {
  const ops = await operatoriReparto(req.query.reparto as string);
  res.json(ops.map(o => ({ _id: o._id, nome: o.nome, reparti: o.reparti })));
});

// GET /api/public/slots?serviceId=&data=&operatorId=
// Se operatorId: fasce di quell'operatore. Altrimenti: fasce libere su ALMENO
// un operatore del reparto del servizio (restituisce anche chi è libero).
router.get('/slots', async (req, res) => {
  const { serviceId, data, operatorId } = req.query as any;
  const service = await Service.findById(serviceId);
  if (!service || !data) return res.status(400).json({ message: 'Servizio e data obbligatori' });
  const giorno = new Date(`${data}T12:00:00`);
  if (isNaN(giorno.getTime())) return res.status(400).json({ message: 'Data non valida' });

  let ops: any[];
  if (operatorId) {
    const o = await Operator.findById(operatorId);
    ops = o && o.attivo ? [o] : [];
  } else {
    ops = await operatoriReparto(service.reparto);
  }
  if (!ops.length) return res.json({ data, slots: [], operatori: [] });

  const perOperatore: Record<string, { ora: string; libera: boolean }[]> = {};
  for (const o of ops) perOperatore[String(o._id)] = await slotOperatore(o, data, service.durataMinuti);

  // Unione delle fasce: libera se almeno un operatore è libero
  const orari = new Set<string>();
  Object.values(perOperatore).forEach(list => list.forEach(s => orari.add(s.ora)));
  const slots = [...orari].sort().map(ora => ({
    ora,
    libera: ops.some(o => perOperatore[String(o._id)]?.find(s => s.ora === ora)?.libera),
    operatori: ops.filter(o => perOperatore[String(o._id)]?.find(s => s.ora === ora)?.libera).map(o => String(o._id)),
  }));
  res.json({ data, durata: service.durataMinuti, slots });
});

// POST /api/public/prenota — prenotazione dal sito.
// Se non è scelto l'operatore, assegna il primo libero del reparto.
router.post('/prenota', async (req, res) => {
  const { serviceId, data, ora, operatorId, firstName, lastName, email, phone, note, consensoPrivacy } = req.body || {};
  if (!serviceId || !data || !ora || !firstName || !email) {
    return res.status(400).json({ message: 'Servizio, data, ora, nome ed email obbligatori' });
  }
  if (!consensoPrivacy) return res.status(400).json({ message: 'Serve il consenso privacy per prenotare' });
  const service = await Service.findById(serviceId);
  if (!service || !service.attivo) return res.status(404).json({ message: 'Servizio non disponibile' });

  const inizio = new Date(`${data}T${ora}:00`);
  if (inizio <= new Date()) return res.status(400).json({ message: 'La fascia scelta è nel passato' });
  const fine = new Date(inizio.getTime() + service.durataMinuti * 60000);

  // Scelta operatore: richiesto oppure primo libero del reparto
  let operatore: any = null;
  if (operatorId) {
    operatore = await Operator.findById(operatorId);
    if (!operatore) return res.status(404).json({ message: 'Operatore non trovato' });
    if (await operatoreOccupato(operatore._id, inizio, fine)) {
      return res.status(409).json({ message: `${operatore.nome} è già impegnato in quella fascia` });
    }
  } else {
    const ops = await operatoriReparto(service.reparto);
    for (const o of ops) {
      if (!(await operatoreOccupato(o._id, inizio, fine))) { operatore = o; break; }
    }
    if (!operatore) return res.status(409).json({ message: 'La fascia è appena stata occupata: scegline un\'altra' });
  }

  const mail = String(email).toLowerCase().trim();
  let client = await Client.findOne({ email: mail });
  if (!client) {
    client = await Client.create({
      firstName, lastName: lastName || '', email: mail, phone: phone || '',
      consensoPrivacy: true, consensoPrivacyIl: new Date(),
    });
  } else {
    if (phone && !client.phone) client.phone = phone;
    if (!client.consensoPrivacy) { client.consensoPrivacy = true; client.consensoPrivacyIl = new Date(); }
    await client.save();
  }

  const app = await Appointment.create({
    client: client._id, service: service._id, operator: operatore._id,
    reparto: service.reparto, data: inizio, fine, origine: 'sito',
    note: note || '', prezzo: service.prezzo,
  });

  if (!client.accessToken || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    client.accessToken = crypto.randomBytes(24).toString('hex');
    client.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await client.save();
  }
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.status(201).json({
    prenotazione: {
      id: String(app._id),
      servizio: service.nome,
      operatore: operatore.nome,
      data: inizio,
      fine,
      prezzo: app.prezzo,
      stato: app.stato,
    },
    linkCartella: `${base}/cartella?t=${client.accessToken}`,
    messaggio: 'Prenotazione registrata. Ti invieremo conferma e promemoria via email.',
  });
});

// GET /api/public/cartella?t=token — cartella cliente via link magico
router.get('/cartella', async (req, res) => {
  const t = String(req.query.t || '');
  if (!t) return res.status(401).json({ message: 'Link non valido' });
  const client = await Client.findOne({ accessToken: t });
  if (!client || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    return res.status(401).json({ message: 'Link scaduto: richiedine uno nuovo' });
  }
  const appuntamenti = await Appointment.find({ client: client._id })
    .populate('service', 'nome categoria durataMinuti prezzo')
    .populate('operator', 'nome')
    .sort({ data: -1 });
  const ordini = await Order.find({ client: client._id }).sort({ createdAt: -1 }).limit(50);
  res.json({
    cliente: { firstName: client.firstName, lastName: client.lastName, email: client.email },
    appuntamenti,
    ordini,
  });
});

// POST /api/public/cartella/annulla — annulla appuntamento futuro (libera la fascia)
router.post('/cartella/annulla', async (req, res) => {
  const { t, appointmentId } = req.body || {};
  const client = await Client.findOne({ accessToken: t || '' });
  if (!client || !client.accessTokenScade || client.accessTokenScade < new Date()) {
    return res.status(401).json({ message: 'Link scaduto' });
  }
  const app = await Appointment.findOne({ _id: appointmentId, client: client._id });
  if (!app) return res.status(404).json({ message: 'Appuntamento non trovato' });
  if (app.data < new Date()) return res.status(400).json({ message: 'Non puoi annullare un appuntamento passato' });
  app.stato = 'annullato';
  await app.save();
  res.json({ message: 'Appuntamento annullato' });
});

// ── Shop online ──────────────────────────────────────────────────

// GET /api/public/shop — articoli vendibili online (solo dati vetrina)
router.get('/shop', async (_req, res) => {
  const prodotti = await Product.find({ attivo: true, vendibileOnline: true })
    .select('nome categoria descrizione prezzoCent giacenza immagine')
    .sort({ categoria: 1, nome: 1 });
  res.json(prodotti.map(p => ({
    _id: p._id, nome: p.nome, categoria: p.categoria, descrizione: p.descrizione,
    prezzoCent: p.prezzoCent, disponibile: p.giacenza > 0,
    immagine: p.immagine?.dati ? `data:${p.immagine.tipo};base64,${p.immagine.dati}` : '',
  })));
});

// POST /api/public/shop/ordine — ordine online: scarico scorte atomico,
// nessun pagamento online (ritiro/consegna, pagamento alla consegna o in negozio)
router.post('/shop/ordine', async (req, res) => {
  const { righe, firstName, lastName, email, phone, consegna, indirizzo, note } = req.body || {};
  if (!Array.isArray(righe) || !righe.length) return res.status(400).json({ message: 'Carrello vuoto' });
  if (!firstName || !email) return res.status(400).json({ message: 'Nome ed email obbligatori' });

  // Scarico scorte atomico riga per riga; solo articoli vendibili online
  const scaricate: any[] = [];
  const righeOk: any[] = [];
  try {
    for (const r of righe) {
      const p = await Product.findOneAndUpdate(
        { _id: r.productId, attivo: true, vendibileOnline: true, giacenza: { $gte: r.quantita } },
        { $inc: { giacenza: -r.quantita } }, { new: true },
      );
      if (!p) {
        const esiste = await Product.findById(r.productId);
        throw Object.assign(new Error(
          !esiste ? 'Articolo non disponibile'
            : esiste.giacenza < r.quantita ? `Disponibilità esaurita: ${esiste.nome} (rimasti ${esiste.giacenza})`
            : `${esiste.nome} non è vendibile online`), { status: 409 });
      }
      scaricate.push({ productId: p._id, quantita: r.quantita });
      righeOk.push({ product: p._id, descrizione: p.nome, quantita: r.quantita, prezzoCent: p.prezzoCent });
    }
    const mail = String(email).toLowerCase().trim();
    const client = await Client.findOne({ email: mail })
      || await Client.create({ firstName, lastName: lastName || '', email: mail, phone: phone || '', consensoPrivacy: true, consensoPrivacyIl: new Date() });

    const ultimo = await Order.findOne().sort({ numero: -1 });
    const order = await Order.create({
      numero: (ultimo?.numero || 0) + 1,
      client: client._id,
      clienteLibero: `${firstName} ${lastName || ''}`.trim(),
      email: mail, telefono: phone || '',
      origine: 'sito',
      consegna: consegna === 'domicilio' ? 'domicilio' : 'ritiro',
      indirizzo: consegna === 'domicilio' ? (indirizzo || '') : '',
      righe: righeOk,
      totaleCent: righeOk.reduce((s, r) => s + r.prezzoCent * r.quantita, 0),
      note: note || '',
    });
    res.status(201).json({
      ordine: {
        numero: order.numero,
        totaleCent: order.totaleCent,
        consegna: order.consegna,
        stato: order.stato,
      },
      messaggio: order.consegna === 'ritiro'
        ? 'Ordine registrato. Ti avvisiamo quando è pronto per il ritiro in salone.'
        : 'Ordine registrato. Ti contatteremo per concordare la consegna.',
    });
  } catch (e: any) {
    for (const s of scaricate) {
      await Product.findByIdAndUpdate(s.productId, { $inc: { giacenza: s.quantita } }).catch(() => {});
    }
    res.status(e.status || 500).json({ message: e.message });
  }
});

// GET /api/public/shop/ordine/:numero?email= — stato ordine pubblico (solo con email verificata)
router.get('/shop/ordine/:numero', async (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  const order = await Order.findOne({ numero: Number(req.params.numero), email });
  if (!order) return res.status(404).json({ message: 'Ordine non trovato. Controlla numero ed email.' });
  res.json({
    numero: order.numero, stato: order.stato, consegna: order.consegna,
    totaleCent: order.totaleCent, pagato: order.pagato,
    righe: order.righe.map(r => ({ descrizione: r.descrizione, quantita: r.quantita, prezzoCent: r.prezzoCent })),
    createdAt: order.createdAt,
  });
});

// POST /api/public/accesso-cartella — richiesta link per email (SMTP da collegare)
router.post('/accesso-cartella', async (req, res) => {
  const mail = String(req.body?.email || '').toLowerCase().trim();
  if (!mail) return res.status(400).json({ message: 'Inserisci la tua email' });
  const client = await Client.findOne({ email: mail });
  if (!client) return res.json({ message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.' });
  client.accessToken = crypto.randomBytes(24).toString('hex');
  client.accessTokenScade = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await client.save();
  // TODO: quando SMTP configurato → inviare il link via email invece di restituirlo
  const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  res.json({
    message: 'Se l\'email corrisponde a una cartella, riceverai il link di accesso.',
    linkCollaudo: `${base}/cartella?t=${client.accessToken}`,
  });
});

// ── Prova AI armocromia (Gemini Image) ──────────────────────────────────────
// POST /api/public/prova-ai { image: dataURL, prompt } → { image: dataURL }
// La foto transita solo in memoria: mai salvata su disco o DB.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const aiTentativi = new Map<string, { n: number; reset: number }>();
const AI_LIMITE_ORA = 12; // prove per IP all'ora (costo ~€0,035/immagine)

router.post('/prova-ai', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ message: 'Prova AI non configurata (manca GEMINI_API_KEY)' });

  const ip = req.ip || 'anon';
  const now = Date.now();
  const rec = aiTentativi.get(ip) || { n: 0, reset: now + 3600_000 };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + 3600_000; }
  if (rec.n >= AI_LIMITE_ORA) return res.status(429).json({ message: 'Limite di prove raggiunto, riprova più tardi' });

  const { image, prompt } = req.body || {};
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(image || ''));
  const testo = String(prompt || '').slice(0, 500);
  if (!m || !testo) return res.status(400).json({ message: 'Immagine e istruzione obbligatorie' });
  if (m[2].length > 6_000_000) return res.status(413).json({ message: 'Immagine troppo grande' });

  rec.n++; aiTentativi.set(ip, rec);
  try {
    const r = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `${testo}. Mantieni identico il volto, lo sfondo e l'inquadratura: modifica solo quanto richiesto, risultato fotorealistico.` },
          { inline_data: { mime_type: `image/${m[1]}`, data: m[2] } },
        ] }],
      }),
    });
    const data: any = await r.json();
    if (!r.ok) return res.status(502).json({ message: data?.error?.message || 'Errore del servizio AI' });
    const part = (data?.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData || p.inline_data);
    const out = part?.inlineData || part?.inline_data;
    if (!out?.data) return res.status(502).json({ message: 'Il servizio AI non ha restituito un\'immagine' });
    res.json({ image: `data:${out.mimeType || out.mime_type || 'image/png'};base64,${out.data}` });
  } catch {
    res.status(502).json({ message: 'Servizio AI non raggiungibile' });
  }
});

export default router;
