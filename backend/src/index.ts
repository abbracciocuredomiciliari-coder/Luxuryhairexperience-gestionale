import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';
import appointmentRoutes from './routes/appointments';
import clientRoutes from './routes/clients';
import publicRoutes from './routes/public';
import operatorRoutes from './routes/operators';
import productRoutes from './routes/products';
import cashRoutes from './routes/cash';
import salesRoutes from './routes/sales';
import orderRoutes from './routes/orders';
import supplierRoutes from './routes/suppliers';
import consultationRoutes from './routes/consultations';
import commercialistaRoutes from './routes/commercialista';
import backupRoutes from './routes/backup';
import luxRoutes from './routes/lux';

const app = express();
const PORT = Number(process.env.PORT || 4100);

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Luxury Gestionale API' }));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/commercialista', commercialistaRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/lux', luxRoutes);

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API Luxury Gestionale su porta ${PORT}`)))
  .catch((err) => { console.error('Errore connessione MongoDB:', err.message); process.exit(1); });
