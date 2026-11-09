import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';
import appointmentRoutes from './routes/appointments';
import clientRoutes from './routes/clients';
import publicRoutes from './routes/public';

const app = express();
const PORT = Number(process.env.PORT || 4100);

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Luxury Gestionale API' }));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/public', publicRoutes);

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API Luxury Gestionale su porta ${PORT}`)))
  .catch((err) => { console.error('Errore connessione MongoDB:', err.message); process.exit(1); });
