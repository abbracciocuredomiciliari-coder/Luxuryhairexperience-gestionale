import { Link } from 'react-router-dom';

const VOCI: { to: string; label: string; key: string }[] = [
  { to: '/', label: 'Home', key: 'home' },
  { to: '/prova-colori', label: 'Prova colori', key: 'prova-colori' },
  { to: '/prenota', label: 'Prenota', key: 'prenota' },
  { to: '/shop', label: 'Shop', key: 'shop' },
  { to: '/cartella', label: 'La mia cartella', key: 'cartella' },
];

export default function SiteHeader({ attivo }: { attivo: string }) {
  return (
    <header className="site-header">
      <Link to="/" className="logo" style={{ textDecoration: 'none' }}>LUXURY HAIR EXPERIENCE</Link>
      <nav className="site-nav">
        {VOCI.map(v => <Link key={v.key} to={v.to} className={v.key === attivo ? 'on' : ''}>{v.label}</Link>)}
        <Link to="/gestionale/login" style={{ fontSize: 11, color: '#a8c7b8' }}>Area riservata</Link>
      </nav>
    </header>
  );
}
