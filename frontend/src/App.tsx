import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Clienti from './pages/Clienti';
import CartellaCliente from './pages/CartellaCliente';
import Servizi from './pages/Servizi';
import Cassa from './pages/Cassa';
import Vendite from './pages/Vendite';
import Boutique from './pages/Boutique';
import Ordini from './pages/Ordini';
import Fornitori from './pages/Fornitori';
import Armocromia from './pages/Armocromia';
import Commercialista from './pages/Commercialista';
import Operatori from './pages/Operatori';
import PrenotaPage from './pages/PrenotaPage';
import CartellaPubblica from './pages/CartellaPubblica';
import Shop from './pages/Shop';
import Home from './pages/Home';
import ProvaColori from './pages/ProvaColori';

const NAV: { sez?: string; to?: string; label?: string; icon?: string; soloAdmin?: boolean }[] = [
  { sez: 'Salone' },
  { to: '/gestionale', label: 'Panoramica', icon: '◈' },
  { to: '/gestionale/agenda', label: 'Agenda', icon: '◷' },
  { to: '/gestionale/clienti', label: 'Clienti', icon: '✦' },
  { to: '/gestionale/armocromia', label: 'Armocromia', icon: '❖' },
  { to: '/gestionale/servizi', label: 'Listino', icon: '◆' },
  { sez: 'Cassa e negozio' },
  { to: '/gestionale/cassa', label: 'Cassa', icon: '▤' },
  { to: '/gestionale/vendite', label: 'Vendite', icon: '◍' },
  { to: '/gestionale/boutique', label: 'Boutique', icon: '✿' },
  { to: '/gestionale/ordini', label: 'Ordini', icon: '☰' },
  { sez: 'Amministrazione' },
  { to: '/gestionale/fornitori', label: 'Fornitori', icon: '⬡' },
  { to: '/gestionale/commercialista', label: 'Commercialista', icon: '◬', soloAdmin: true },
  { to: '/gestionale/operatori', label: 'Operatori', icon: '✎' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/gestionale/login" replace />;
  const isAdmin = user.role === 'admin';
  const titolo = NAV.find(n => n.to === loc.pathname)?.label
    || (loc.pathname.startsWith('/gestionale/clienti/') ? 'Cartella cliente' : 'Gestione');
  return (
    <div className="management">
      <aside className="sidebar">
        <div className="brandmark">LH</div>
        <div className="logo">LUXURY<span>HAIR EXPERIENCE</span></div>
        <div className="studio">Gestione salone</div>
        <nav className="links">
          {NAV.map((n, i) => {
            if (n.sez) return <div key={`s${i}`} className="navsez">{n.sez}</div>;
            if (n.soloAdmin && !isAdmin) return null;
            return (
              <Link key={n.to} to={n.to!}>
                <button className={`navbtn ${loc.pathname === n.to ? 'active' : ''}`}>
                  <span className="navicon">{n.icon}</span>{n.label}
                </button>
              </Link>
            );
          })}
        </nav>
        <div className="sidefoot">
          <span className="online" />{user.name}
          <small>{user.role === 'admin' ? 'Amministratore' : user.role}</small>
          <small><button onClick={logout}>Esci</button></small>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <div>
            <div className="crumb">Luxury Hair Experience <span>›</span> Gestione</div>
            <h1>{titolo}</h1>
          </div>
          <div className="topright">
            <span>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Sito pubblico: vetrina, prenotazioni, shop, cartella cliente */}
      <Route path="/" element={<Home />} />
      <Route path="/prenota" element={<PrenotaPage />} />
      <Route path="/prova-colori" element={<ProvaColori />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/cartella" element={<CartellaPubblica />} />

      {/* Gestionale riservato */}
      <Route path="/gestionale/login" element={<Login />} />
      <Route path="/gestionale" element={<Shell><Dashboard /></Shell>} />
      <Route path="/gestionale/agenda" element={<Shell><Agenda /></Shell>} />
      <Route path="/gestionale/clienti" element={<Shell><Clienti /></Shell>} />
      <Route path="/gestionale/clienti/:id" element={<Shell><CartellaCliente /></Shell>} />
      <Route path="/gestionale/armocromia" element={<Shell><Armocromia /></Shell>} />
      <Route path="/gestionale/servizi" element={<Shell><Servizi /></Shell>} />
      <Route path="/gestionale/cassa" element={<Shell><Cassa /></Shell>} />
      <Route path="/gestionale/vendite" element={<Shell><Vendite /></Shell>} />
      <Route path="/gestionale/boutique" element={<Shell><Boutique /></Shell>} />
      <Route path="/gestionale/ordini" element={<Shell><Ordini /></Shell>} />
      <Route path="/gestionale/fornitori" element={<Shell><Fornitori /></Shell>} />
      <Route path="/gestionale/commercialista" element={<Shell><Commercialista /></Shell>} />
      <Route path="/gestionale/operatori" element={<Shell><Operatori /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
