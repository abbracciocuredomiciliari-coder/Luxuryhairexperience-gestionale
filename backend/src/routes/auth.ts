import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { requireAuth, signUser, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login — accesso staff/admin
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email e password obbligatorie' });
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !user.active) return res.status(401).json({ message: 'Credenziali non valide' });
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Credenziali non valide' });
  res.json({
    token: signUser(String(user._id), user.role),
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select('-passwordHash');
  if (!user) return res.status(404).json({ message: 'Utente non trovato' });
  res.json(user);
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ message: 'La nuova password deve avere almeno 8 caratteri' });
  }
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'Utente non trovato' });
  const ok = await bcrypt.compare(String(oldPassword || ''), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Password attuale errata' });
  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ message: 'Password aggiornata' });
});

// GET /api/auth/users — elenco utenti (admin)
router.get('/users', requireAuth, async (req: AuthRequest, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Solo admin' });
  res.json(await User.find().select('-passwordHash').sort({ name: 1 }));
});

// POST /api/auth/users — crea utente staff (admin)
router.post('/users', requireAuth, async (req: AuthRequest, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Solo admin' });
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Nome, email e password obbligatori' });
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Email già registrata' });
  const user = await User.create({
    name, email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(String(password), 10),
    role: role === 'admin' ? 'admin' : 'staff',
  });
  res.status(201).json({ id: String(user._id), name: user.name, email: user.email, role: user.role });
});

export default router;
