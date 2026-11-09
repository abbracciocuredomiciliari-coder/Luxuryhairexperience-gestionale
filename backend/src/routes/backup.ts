import { Router } from 'express';
import Client from '../models/Client';
import Service from '../models/Service';
import Operator from '../models/Operator';
import Appointment from '../models/Appointment';
import Product from '../models/Product';
import Sale from '../models/Sale';
import CashMovement from '../models/CashMovement';
import CashClosure from '../models/CashClosure';
import Order from '../models/Order';
import Supplier from '../models/Supplier';
import SupplierInvoice from '../models/SupplierInvoice';
import Consultation from '../models/Consultation';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
// Backup/ripristino riservato all'amministratore
router.use(requireAuth, requireRole('admin'));

const COLLECTIONS: [string, any][] = [
  ['clients', Client], ['services', Service], ['operators', Operator],
  ['appointments', Appointment], ['products', Product], ['sales', Sale],
  ['cashMovements', CashMovement], ['cashClosures', CashClosure],
  ['orders', Order], ['suppliers', Supplier], ['supplierInvoices', SupplierInvoice],
  ['consultations', Consultation],
];

// GET /api/backup — export JSON completo (allegati inclusi in base64)
router.get('/', async (_req, res) => {
  const dump: any = { formato: 'luxury-backup', versione: 1, generato: new Date().toISOString(), dati: {} };
  for (const [nome, Model] of COLLECTIONS) {
    dump.dati[nome] = await Model.find().lean();
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="luxury-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(dump);
});

// POST /api/backup/restore — ripristina il dump (sostituisce i dati esistenti!)
router.post('/restore', async (req, res) => {
  const dump = req.body;
  if (dump?.formato !== 'luxury-backup' || !dump.dati) {
    return res.status(400).json({ message: 'File di backup non valido' });
  }
  const risultati: Record<string, number> = {};
  for (const [nome, Model] of COLLECTIONS) {
    const docs = dump.dati[nome];
    if (!Array.isArray(docs)) continue;
    await Model.deleteMany({});
    if (docs.length) await Model.insertMany(docs, { ordered: false }).catch(() => {});
    risultati[nome] = docs.length;
  }
  res.json({ message: 'Ripristino completato', risultati });
});

export default router;
