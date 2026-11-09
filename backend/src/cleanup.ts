import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import CashMovement from './models/CashMovement';
import Client from './models/Client';
import Appointment from './models/Appointment';
import Sale from './models/Sale';
import Order from './models/Order';
import SupplierInvoice from './models/SupplierInvoice';

// Script manuale di pulizia dati di collaudo (TEST/pre-production).
// Uso: npx tsx src/cleanup.ts
async function clean() {
  await connectDB();
  // Movimenti automatici orfani (senza documento collegato)
  const orfani = await CashMovement.deleteMany({ automatico: true, 'collegamento.rifId': { $exists: false } });
  console.log('Movimenti orfani eliminati:', orfani.deletedCount);
  // Clienti e appuntamenti di test
  const testClients = await Client.find({ email: /@(lux|test)\.it$/ });
  const ids = testClients.map(c => c._id);
  const apps = await Appointment.deleteMany({ client: { $in: ids } });
  const cls = await Client.deleteMany({ _id: { $in: ids } });
  console.log('Appuntamenti test eliminati:', apps.deletedCount, '| clienti test:', cls.deletedCount);
  // Vendite/ordini di test (numero piccolo = seed collaudo)
  const sales = await Sale.deleteMany({});
  const orders = await Order.deleteMany({});
  console.log('Vendite test:', sales.deletedCount, '| ordini test:', orders.deletedCount);
  // Fatture fornitore di test
  const fatt = await SupplierInvoice.deleteMany({ numero: /^(FT|VER)-/ });
  console.log('Fatture test:', fatt.deletedCount);
  // Movimenti di cassa residui di test
  const movs = await CashMovement.deleteMany({ nota: /Vendita n\.|Storno vendita|Pagamento fattura/ });
  console.log('Movimenti cassa test:', movs.deletedCount);
  await mongoose.disconnect();
}
clean().catch(e => { console.error(e); process.exit(1); });
