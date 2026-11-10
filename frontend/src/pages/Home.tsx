import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import SiteHeader from '../components/SiteHeader';

const euro = (v: number) => `€ ${v.toFixed(2)}`;
const euroCent = (c: number) => `€ ${(c / 100).toFixed(2)}`;

const REPARTI: Record<string, string> = {
  parrucchiere: 'Parrucchiere', estetica: 'Estetica', unghie: 'Unghie',
  abbigliamento: 'Abbigliamento', altro: 'Altri servizi',
};

export default function Home() {
  const [servizi, setServizi] = useState<any[]>([]);
  const [prodotti, setProdotti] = useState<any[]>([]);

  useEffect(() => { api.get('/public/services').then(r => setServizi(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { api.get('/public/shop').then(r => setProdotti(r.data || [])).catch(() => {}); }, []);

  const perReparto = servizi.reduce((acc: Record<string, any[]>, s: any) => {
    (acc[s.reparto] = acc[s.reparto] || []).push(s);
    return acc;
  }, {});
  const repartiOrdinati = Object.keys(REPARTI).filter(r => perReparto[r]?.length);

  return (
    <div className="site-shell">
      <SiteHeader attivo="home" />

      <div className="home-hero">
        <div className="home-hero-in">
          <div className="home-kicker">Salone · Estetica · Boutique</div>
          <h1>La tua esperienza di bellezza, su misura</h1>
          <p>Prenota online il tuo appuntamento, scopri i prodotti selezionati della nostra boutique e tieni sotto controllo i tuoi trattamenti dalla cartella personale.</p>
          <div className="home-cta">
            <Link to="/prenota" className="home-btn primary">Prenota un appuntamento</Link>
            <Link to="/shop" className="home-btn">Scopri la boutique</Link>
          </div>
        </div>
      </div>

      {/* Servizi reali dal listino */}
      <div className="site-wrap">
        <div className="home-sez-head">
          <h2>I nostri servizi</h2>
          <p>Prezzi e durate del listino ufficiale. Scegli il trattamento e prenota in pochi passi.</p>
        </div>
        {repartiOrdinati.map(rep => (
          <div key={rep} className="home-reparto">
            <h3>{REPARTI[rep]}</h3>
            <div className="servizi-grid">
              {perReparto[rep].map((s: any) => (
                <Link key={s._id} to={`/prenota?servizio=${s._id}`} className="servizio-card home-serv-link">
                  <strong>{s.nome}</strong>
                  {s.descrizione && <span className="small">{s.descrizione}</span>}
                  <span className="prezzo">{euro(s.prezzo)} <span className="small">· {s.durataMinuti}′</span></span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {!repartiOrdinati.length && <div className="empty"><b>Listino in aggiornamento</b>Torna presto a trovarci.</div>}
      </div>

      {/* Armocromia */}
      <div className="home-band">
        <div className="site-wrap home-band-in">
          <div>
            <h2>Consulenza di armocromia</h2>
            <p>Scopri la stagione cromatica e la palette che valorizza il tuo viso: la consulenza viene registrata nella tua cartella e riutilizzata ad ogni appuntamento.</p>
          </div>
          <Link to="/prenota" className="home-btn light">Prenota la consulenza</Link>
        </div>
      </div>

      {/* Boutique */}
      {prodotti.length > 0 && (
        <div className="site-wrap">
          <div className="home-sez-head">
            <h2>Boutique</h2>
            <p>Prodotti selezionati dal salone, ordinabili online con ritiro in negozio o consegna a domicilio.</p>
          </div>
          <div className="servizi-grid">
            {prodotti.slice(0, 4).map((p: any) => (
              <Link key={p._id} to="/shop" className="servizio-card shop-card home-serv-link">
                {p.immagine?.dati
                  ? <img className="shop-img" src={p.immagine.dati} alt={p.nome} />
                  : <div className="shop-img placeholder">✿</div>}
                <strong>{p.nome}</strong>
                {p.descrizione && <span className="small">{p.descrizione}</span>}
                <span className="prezzo">{euroCent(p.prezzoCent)}</span>
              </Link>
            ))}
          </div>
          <div className="tac mt"><Link to="/shop" className="home-btn">Vai allo shop →</Link></div>
        </div>
      )}

      {/* Cartella */}
      <div className="site-wrap">
        <div className="home-band" style={{ marginTop: 0 }}>
          <div className="home-band-in">
            <div>
              <h2>La tua cartella personale</h2>
              <p>Appuntamenti, storico trattamenti e i tuoi ordini in un unico posto. Accedi con la tua email.</p>
            </div>
            <Link to="/cartella" className="home-btn light">Apri la cartella</Link>
          </div>
        </div>
      </div>

      <footer className="home-footer">
        <div className="home-footer-in">
          <div className="logo">LUXURY HAIR EXPERIENCE</div>
          <div className="home-footer-links">
            <Link to="/prenota">Prenota</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/cartella">La mia cartella</Link>
            <a href="mailto:info@luxuryhairexperience.it">info@luxuryhairexperience.it</a>
          </div>
          <div className="small">© {new Date().getFullYear()} Luxury Hair Experience — Prenotazioni e ordini gestiti direttamente dal salone.</div>
        </div>
      </footer>
    </div>
  );
}
