import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import User from './models/User';
import Service from './models/Service';

// Seed iniziale: admin info@luxuryhairexperience.it + listino servizi base.
// Uso: npm run seed   (sicuro da rilanciare: non duplica)
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

  const servizi = [
    { nome: 'Taglio donna', categoria: 'Capelli', durataMinuti: 60, prezzo: 45 },
    { nome: 'Taglio uomo', categoria: 'Capelli', durataMinuti: 30, prezzo: 25 },
    { nome: 'Piega', categoria: 'Capelli', durataMinuti: 45, prezzo: 30 },
    { nome: 'Colore', categoria: 'Colore', durataMinuti: 120, prezzo: 80 },
    { nome: 'Colpi di sole / balayage', categoria: 'Colore', durataMinuti: 180, prezzo: 140 },
    { nome: 'Consulenza armocromia', categoria: 'Consulenze', durataMinuti: 90, prezzo: 95 },
    { nome: 'Trattamento ricostruzione', categoria: 'Trattamenti', durataMinuti: 75, prezzo: 60 },
    { nome: 'Sposa / evento (prova + acconciatura)', categoria: 'Eventi', durataMinuti: 150, prezzo: 180 },
  ];
  for (const [i, s] of servizi.entries()) {
    const exists = await Service.findOne({ nome: s.nome });
    if (!exists) await Service.create({ ...s, ordine: i });
  }
  console.log(`Servizi nel listino: ${await Service.countDocuments()}`);

  await mongoose.disconnect();
  console.log('Seed completato');
}

seed().catch((e) => { console.error(e); process.exit(1); });
