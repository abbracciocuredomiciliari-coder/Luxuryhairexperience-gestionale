import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import User from './models/User';
import Service from './models/Service';
import Operator from './models/Operator';
import Product from './models/Product';
import Supplier from './models/Supplier';

// Seed iniziale: admin info@luxuryhairexperience.it + listino, operatori,
// prodotti boutique e fornitori dimostrativi.
// Uso: npm run seed   (sicuro da rilanciare: non duplica)
// Turno tipo: lun-sab 9-19 con pausa 13-14, domenica chiuso. turni[0]=dom…[6]=sab.
const TURNO_DEFAULT = [
  { attivo: false, inizio: '09:00', fine: '19:00' },                                   // domenica
  ...Array(6).fill({ attivo: true, inizio: '09:00', fine: '19:00', pausaInizio: '13:00', pausaFine: '14:00' }),
];

async function seed() {
  await connectDB();

  const adminEmail = 'info@luxuryhairexperience.it';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const password = process.env.ADMIN_PASSWORD || 'Luxury2026!';
    admin = await User.create({
      name: 'Titolare Luxury',
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
    });
    console.log(`Admin creato: ${adminEmail} (password da .env ADMIN_PASSWORD)`);
  } else {
    console.log('Admin già presente');
  }

  // ── Operatori: 5 parrucchieri + estetista + onicotecnica ──
  const operatori = [
    { nome: 'Chiara', reparti: ['parrucchiere'] },
    { nome: 'Elisa', reparti: ['parrucchiere'] },
    { nome: 'Martina', reparti: ['parrucchiere'] },
    { nome: 'Sara', reparti: ['parrucchiere'] },
    { nome: 'Valentina', reparti: ['parrucchiere'] },
    { nome: 'Federica', reparti: ['estetica'] },
    { nome: 'Giulia', reparti: ['unghie', 'estetica'] },
  ];
  for (const [i, o] of operatori.entries()) {
    const exists = await Operator.findOne({ nome: o.nome });
    if (!exists) await Operator.create({ ...o, turni: TURNO_DEFAULT, ordine: i });
  }
  console.log(`Operatori: ${await Operator.countDocuments()}`);

  // ── Servizi con reparto (è il reparto a decidere chi può erogarli) ──
  const servizi = [
    { nome: 'Taglio donna', categoria: 'Capelli', reparto: 'parrucchiere', durataMinuti: 60, prezzo: 45 },
    { nome: 'Taglio uomo', categoria: 'Capelli', reparto: 'parrucchiere', durataMinuti: 30, prezzo: 25 },
    { nome: 'Piega', categoria: 'Capelli', reparto: 'parrucchiere', durataMinuti: 45, prezzo: 30 },
    { nome: 'Colore', categoria: 'Colore', reparto: 'parrucchiere', durataMinuti: 120, prezzo: 80 },
    { nome: 'Colpi di sole / balayage', categoria: 'Colore', reparto: 'parrucchiere', durataMinuti: 180, prezzo: 140 },
    { nome: 'Trattamento ricostruzione', categoria: 'Trattamenti', reparto: 'parrucchiere', durataMinuti: 75, prezzo: 60 },
    { nome: 'Sposa / evento (prova + acconciatura)', categoria: 'Eventi', reparto: 'parrucchiere', durataMinuti: 150, prezzo: 180 },
    { nome: 'Consulenza armocromia', categoria: 'Consulenze', reparto: 'estetica', durataMinuti: 90, prezzo: 95 },
    { nome: 'Pulizia viso', categoria: 'Estetica', reparto: 'estetica', durataMinuti: 60, prezzo: 55 },
    { nome: 'Massaggio rilassante 50\'', categoria: 'Estetica', reparto: 'estetica', durataMinuti: 50, prezzo: 60 },
    { nome: 'Manicure', categoria: 'Unghie', reparto: 'unghie', durataMinuti: 45, prezzo: 30 },
    { nome: 'Semipermanente', categoria: 'Unghie', reparto: 'unghie', durataMinuti: 60, prezzo: 40 },
  ];
  for (const [i, s] of servizi.entries()) {
    const exists = await Service.findOne({ nome: s.nome });
    if (!exists) await Service.create({ ...s, ordine: i });
  }
  console.log(`Servizi nel listino: ${await Service.countDocuments()}`);

  // ── Prodotti boutique dimostrativi ──
  const prodotti = [
    { nome: 'Shampoo ristrutturante 250ml', categoria: 'Haircare', prezzoCent: 2400, giacenza: 12, giacenzaMinima: 3, vendibileOnline: true, descrizione: 'Deterge e ripara i capelli trattati' },
    { nome: 'Maschera nutriente 200ml', categoria: 'Haircare', prezzoCent: 2900, giacenza: 8, giacenzaMinima: 3, vendibileOnline: true, descrizione: 'Nutrimento profondo per capelli secchi' },
    { nome: 'Olio per capelli 50ml', categoria: 'Haircare', prezzoCent: 3200, giacenza: 6, giacenzaMinima: 2, vendibileOnline: true, descrizione: 'Lucentezza setosa, effetto anticrespo' },
    { nome: 'Crema corpo setificante', categoria: 'Bodycare', prezzoCent: 2700, giacenza: 10, giacenzaMinima: 3, vendibileOnline: true },
    { nome: 'Smalto nude', categoria: 'Unghie', prezzoCent: 1200, giacenza: 15, giacenzaMinima: 5, vendibileOnline: true },
    { nome: 'Borsa shopper Luxury', categoria: 'Accessori', prezzoCent: 1900, giacenza: 20, giacenzaMinima: 5, vendibileOnline: true, descrizione: 'Shopper in cotone con logo ricamato' },
    { nome: 'Camicia seta salvia', categoria: 'Abbigliamento', prezzoCent: 8900, giacenza: 4, giacenzaMinima: 1, vendibileOnline: true, descrizione: 'Camicia in seta color salvia, taglio morbido' },
    { nome: 'Sciarpa cashmere', categoria: 'Abbigliamento', prezzoCent: 6500, giacenza: 6, giacenzaMinima: 1, vendibileOnline: true, descrizione: 'Sciarpa in cashmere tinta naturale' },
  ];
  for (const p of prodotti) {
    const exists = await Product.findOne({ nome: p.nome });
    if (!exists) await Product.create(p);
    else if (p.vendibileOnline !== undefined || p.descrizione !== undefined) {
      await Product.findByIdAndUpdate(exists._id, { vendibileOnline: p.vendibileOnline, descrizione: p.descrizione });
    }
  }
  console.log(`Prodotti boutique: ${await Product.countDocuments()}`);

  // ── Fornitori dimostrativi (come nel demo: Orietta, Remo, Remo Stendevari) ──
  const fornitori = [
    { nome: 'Orietta', contatti: 'fornitrice storica' },
    { nome: 'Remo', contatti: '' },
    { nome: 'Remo Stendevari', contatti: '' },
  ];
  for (const f of fornitori) {
    const exists = await Supplier.findOne({ nome: f.nome });
    if (!exists) await Supplier.create(f);
  }
  console.log(`Fornitori: ${await Supplier.countDocuments()}`);

  await mongoose.disconnect();
  console.log('Seed completato');
}

seed().catch((e) => { console.error(e); process.exit(1); });
