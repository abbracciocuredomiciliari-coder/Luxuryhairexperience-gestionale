import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Clienti from './pages/Clienti';
import CartellaCliente from './pages/CartellaCliente';
import Servizi from './pages/Servizi';
import PrenotaPage from './pages/PrenotaPage';
import CartellaPubblica from './pages/CartellaPubblica';

const NAV = [
  { to: '/gestionale', label: 'Panoramica', icon: '◈' },
  { to: '/gestionale/agenda', label: 'Agenda', icon: '◷' },
  { to: '/gestionale/clienti', label: 'Clienti', icon: '✦' },
  { to: '/gestionale/servizi', label: 'Listino', icon: '◆' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/gestionale/login" replace />;
  return (
    <div className="management">
      <aside className="sidebar">
        <div className="brandmark">LH</div>
        <div className="logo">LUXURY<span>HAIR EXPERIENCE</span></div>
        <div className="studio">Gestione salone</div>
        <nav className="links">
          {NAV.map(n => (
            <Link key={n.to} to={n.to}>
              <button className={`navbtn ${loc.pathname === n.to ? 'active' : ''}`}>
                <span className="navicon">{n.icon}</span>{n.label}
              </button>
            </Link>
          ))}
        </nav>
        <div className="sidefoot">
          <span className="online" />{user.name}
          <small>{user.role === 'admin' ? 'Amministratore' : 'Staff'}</small>
          <small><button onClick={logout}>Esci</button></small>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <div>
            <div className="crumb">Luxury Hair Experience <span>›</span> Gestione</div>
            <h1>{NAV.find(n => n.to === loc.pathname)?.label || 'Gestione'}</h1>
          </div>
          <div className="topright">
            <span>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          </div>
        </div>
        <div className="workspaceintro">
          <span className="pill">Salone</span>
          <span>Area riservata — clienti, agenda e listino in tempo reale.</span>
        </div>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Sito pubblico: prenotazioni + cartella cliente */}
      <Route path="/" element={<PrenotaPage />} />
      <Route path="/prenota" element={<PrenotaPage />} />
      <Route path="/cartella" element={<CartellaPubblica />} />

      {/* Gestionale riservato */}
      <Route path="/gestionale/login" element={<Login />} />
      <Route path="/gestionale" element={<Shell><Dashboard /></Shell>} />
      <Route path="/gestionale/agenda" element={<Shell><Agenda /></Shell>} />
      <Route path="/gestionale/clienti" element={<Shell><Clienti /></Shell>} />
      <Route path="/gestionale/clienti/:id" element={<Shell><CartellaCliente /></Shell>} />
      <Route path="/gestionale/servizi" element={<Shell><Servizi /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
