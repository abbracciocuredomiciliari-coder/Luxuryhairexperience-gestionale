import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  clientId?: string;
}

// Token interni (admin/staff)
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Token mancante' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type === 'client') return res.status(403).json({ message: 'Accesso riservato allo staff' });
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Token non valido' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Solo admin' });
  next();
}

// Ruoli ammessi: admin accede sempre; gli altri solo se nella lista.
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole === 'admin' || roles.includes(req.userRole || '')) return next();
    return res.status(403).json({ message: 'Ruolo non autorizzato' });
  };
}

// Token clienti (link magico cartella) — solo accesso alla propria cartella
export function requireClient(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Link di accesso mancante' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== 'client') return res.status(403).json({ message: 'Token non valido' });
    req.clientId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Link scaduto o non valido' });
  }
}

export const signUser = (id: string, role: string) =>
  jwt.sign({ sub: id, role }, JWT_SECRET, { expiresIn: '12h' });

export const signClient = (clientId: string) =>
  jwt.sign({ sub: clientId, type: 'client' }, JWT_SECRET, { expiresIn: '30d' });
