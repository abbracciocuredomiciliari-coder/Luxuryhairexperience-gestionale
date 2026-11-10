import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../lx.css';

// Configurazione media del sito (dal pacchetto sorgente, ruolo gallery/hero).
// Le didascalie e l'ordine corrispondono a cms-default.json.
const MEDIA = [
  { id: 'v129870', kind: 'video', url: '/assets/luxury-129870.mp4', poster: '/assets/luxury-129870.jpg', caption: 'Riflessi che conquistano.', role: 'gallery' },
  { id: 'p129870_1', kind: 'image', url: '/assets/luxury-129870-foto-1.jpg', caption: 'Riflessi che conquistano.', role: 'gallery' },
  { id: 'p129870_2', kind: 'image', url: '/assets/luxury-129870-foto-2.jpg', caption: 'Riflessi che conquistano.', role: 'gallery' },
  { id: 'v129874', kind: 'video', url: '/assets/luxury-129874.mp4', poster: '/assets/luxury-129874.jpg', caption: 'Luce ai tuoi capelli.', role: 'gallery' },
  { id: 'p129874_1', kind: 'image', url: '/assets/luxury-129874-foto-1.jpg', caption: 'Luce ai tuoi capelli.', role: 'gallery' },
  { id: 'p129874_2', kind: 'image', url: '/assets/luxury-129874-foto-2.jpg', caption: 'Luce ai tuoi capelli.', role: 'gallery' },
  { id: 'v129876', kind: 'video', url: '/assets/luxury-129876.mp4', poster: '/assets/luxury-129876.jpg', caption: 'Il taglio che ti racconta.', role: 'gallery' },
  { id: 'p129876_1', kind: 'image', url: '/assets/luxury-129876-foto-1.jpg', caption: 'Il taglio che ti racconta.', role: 'gallery' },
  { id: 'p129876_2', kind: 'image', url: '/assets/luxury-129876-foto-2.jpg', caption: 'Il taglio che ti racconta.', role: 'gallery' },
  { id: 'v129878', kind: 'video', url: '/assets/luxury-129878.mp4', poster: '/assets/luxury-129878.jpg', caption: 'Onde di luce.', role: 'gallery' },
  { id: 'p129878_1', kind: 'image', url: '/assets/luxury-129878-foto-1.jpg', caption: 'Onde di luce.', role: 'gallery' },
  { id: 'p129878_2', kind: 'image', url: '/assets/luxury-129878-foto-2.jpg', caption: 'Onde di luce.', role: 'gallery' },
] as const;

const euroCent = (c: number) => `€ ${(c / 100).toFixed(2)}`;

// Foto di copertina per gli articoli senza immagine caricata (asset del sito)
const fotoArticolo = (p: any) => {
  if (p.immagine?.dati) return p.immagine.dati;
  const n = `${p.nome} ${p.categoria}`.toLowerCase();
  if (/borsa|crossbody|bag/.test(n)) return '/assets/bag.jpg';
  if (/camicia|shirt/.test(n)) return '/assets/shirt.jpg';
  if (/abito|dress/.test(n)) return '/assets/dress.jpg';
  if (/blazer|giacca/.test(n)) return '/assets/blazer.jpg';
  if (/sciarpa|foulard/.test(n)) return '/assets/fashion.jpg';
  if (/gioiell|accessor/.test(n)) return '/assets/jewelry.jpg';
  if (/hair|capell|shampoo|maschera|olio|body|crema|unghie|smalto/.test(n)) return '/assets/luxury-129878-foto-2.jpg';
  return '/assets/fashion.jpg';
};

// ── Galleria lavori (port di gallery.js): un lavoro alla volta, precedente/successivo,
// contatore, tastiera, swipe, niente autoplay, video fermato a ogni cambio/chiusura ──
function GalleryModal({ kind, onClose }: { kind: 'video' | 'image'; onClose: () => void }) {
  const items = MEDIA.filter(m => m.role === 'gallery' && m.kind === kind);
  const [at, setAt] = useState(0);
  const startX = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const stopVideo = () => {
    stageRef.current?.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); (v as any).load?.(); });
  };
  const next = (n: number) => { if (items.length) { stopVideo(); setAt(a => (a + n + items.length) % items.length); } };

  // Alla chiusura ferma eventuali video in riproduzione
  useEffect(() => () => stopVideo(), []);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') { e.preventDefault(); next(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(1); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [items.length]);

  const m = items[at];
  return (
    <div className="work-viewer-wrap" role="dialog" aria-modal="true" aria-labelledby="viewerTitle"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div className="work-viewer" style={{ position: 'relative' }}>
        <div className="viewer-head">
          <h2 id="viewerTitle">{kind === 'video' ? 'I nostri lavori · Video' : 'I nostri lavori · Foto'}</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi galleria">Chiudi ×</button>
        </div>
        <div className="viewer-stage" ref={stageRef}
          onTouchStart={e => { startX.current = e.changedTouches[0].clientX; }}
          onTouchEnd={e => {
            if ((e.target as HTMLElement).closest('video')) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            if (Math.abs(dx) > 60) next(dx < 0 ? 1 : -1);
          }}>
          {!m && <p>Nuovi lavori in arrivo.</p>}
          {m?.kind === 'video' && <video key={m.id} src={m.url} poster={(m as any).poster} controls playsInline preload="metadata" />}
          {m?.kind === 'image' && <img key={m.id} src={m.url} alt={m.caption || 'Lavoro Luxury'} />}
        </div>
        <p className="viewer-caption">{m?.caption || ''}</p>
        <div className="viewer-controls">
          <button type="button" onClick={() => next(-1)} disabled={items.length < 2} aria-label="Lavoro precedente">← Precedente</button>
          <span className="viewer-count" aria-live="polite">{items.length ? `${at + 1} / ${items.length}` : '0 / 0'}</span>
          <button type="button" onClick={() => next(1)} disabled={items.length < 2} aria-label="Lavoro successivo">Successivo →</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [prodotti, setProdotti] = useState<any[]>([]);
  const [filtro, setFiltro] = useState('Tutti');
  const [gallery, setGallery] = useState<null | 'video' | 'image'>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => { api.get('/public/shop').then(r => setProdotti(r.data || [])).catch(() => {}); }, []);

  const categorie = ['Tutti', ...Array.from(new Set(prodotti.map(p => p.categoria).filter(Boolean)))];
  const visibili = (filtro === 'Tutti' ? prodotti : prodotti.filter(p => p.categoria === filtro)).slice(0, 8);

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { setVideoOn(true); } else { setVideoOn(false); }
  };

  // il pulsante play/pausa sincronizza tutti i pannelli del triptych
  useEffect(() => {
    document.querySelectorAll<HTMLVideoElement>('.hero-videos video').forEach(v => {
      if (videoOn) v.play().catch(() => {}); else v.pause();
    });
  }, [videoOn]);

  return (
    <div className="lx">
      <a className="skip" href="#main">Vai al contenuto</a>
      <div className="topline"><span>ROMA · VIA APPIA NUOVA 287</span><Link to="/gestionale/login" className="app-entry">AREA RISERVATA →</Link></div>

      <header className="header">
        <a href="#home" className="brand" aria-label="Luxury Hair Experience home">
          <span className="brand-main">LUXURY<span className="brand-star">✦</span></span>
          <span className="brand-sub">HAIR EXPERIENCE</span>
        </a>
        <nav aria-label="Menu principale" className={navOpen ? 'open' : ''} onClick={() => setNavOpen(false)}>
          <a href="#capelli">Il salone</a>
          <a href="#lavori">I nostri lavori</a>
          <a href="#armocromia">Armocromia</a>
          <Link to="/shop">La boutique</Link>
          <Link to="/cartella">La mia cartella</Link>
          <a href="#contatti">Dove siamo</a>
        </nav>
        <div className="header-actions">
          <Link className="button small-button" to="/prenota">Prenota <span>→</span></Link>
          <button className="menu-toggle" aria-label="Apri menu" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>☰</button>
        </div>
      </header>

      <main id="main">
        {/* HERO con video */}
        <section className="hero" id="home" aria-label="Benvenuti in Luxury Hair Experience">
          <img className="hero-poster" src="/assets/luxury-129878-foto-2.jpg" alt="Capelli luminosi e curati" />
          {/* video verticale 9:16 → triptych: 3 pannelli affiancati a piena altezza, nessun taglio */}
          <div className="hero-videos">
            {[0, 1, 2].map(i => (
              <video key={i} ref={i === 0 ? videoRef : undefined} autoPlay muted loop playsInline preload="metadata" poster="/assets/luxury-129870-foto-2.jpg" aria-label={i === 0 ? 'Lavorazioni Luxury Hair Experience senza inquadrature dei visi' : undefined} aria-hidden={i > 0 || undefined}>
                <source src="/assets/luxury-montaggio.mp4" type="video/mp4" />
              </video>
            ))}
          </div>
          <div className="hero-shade"></div>
          <div className="hero-copy">
            <p className="eyebrow light">LUXURY HAIR EXPERIENCE · ROMA</p>
            <h1>La bellezza,<br />a modo <em>tuo.</em></h1>
            <p>Capelli, colori, personalità.<br />Il tuo prossimo capitolo comincia qui.</p>
            <div className="hero-buttons">
              <Link className="button gold" to="/prenota">Prenota la tua esperienza <span>→</span></Link>
              <a className="text-link" href="#lavori">Guarda i nostri lavori <span>↓</span></a>
            </div>
          </div>
          <div className="hero-photo"><img src="/assets/luxury-129878-foto-2.jpg" alt="Onde e riflessi realizzati da Luxury" /><span>La tua luce. Il tuo stile.</span></div>
          <span className="hero-side-note">HAIR ATELIER / ROMA</span>
          <div className="hero-bottom">
            <span>IL TUO STILE. LA TUA FIRMA.</span>
            <div><span className="video-credit">Luxury in movimento</span><button id="videoToggle" onClick={toggleVideo} aria-label={videoOn ? 'Metti in pausa il video' : 'Riavvia il video'}>{videoOn ? '||' : '▶'}</button></div>
          </div>
        </section>

        <div className="ribbon" aria-label="Le nostre attività"><span>HAIR ATELIER</span><i>✦</i><span>ARMOCROMIA</span><i>✦</i><span>FASHION BOUTIQUE</span><i>✦</i><span>VIA APPIA NUOVA 287 · ROMA</span></div>

        {/* SERVIZI */}
        <section className="section intro" id="capelli">
          <div className="section-head">
            <div><p className="eyebrow">01 / HAIR ATELIER</p><h2>Capelli che<br />parlano di <em>te.</em></h2></div>
            <p className="section-description">Il tuo taglio. Il tuo colore. La tua personalità.</p>
          </div>
          <div className="services">
            <Link className="service" to="/prenota"><div className="image-wrap"><img src="/assets/luxury-129876-foto-1.jpg" loading="lazy" alt="Styling e cura dei capelli" /><span className="round-arrow">→</span></div><div className="service-title"><h3>Taglio & styling</h3><span>01</span></div><p>Forme e movimento, per esprimere chi sei.</p></Link>
            <Link className="service" to="/prenota"><div className="image-wrap"><img src="/assets/luxury-129870-foto-2.jpg" loading="lazy" alt="Riflessi e sfumature su capelli lunghi" /><span className="round-arrow">→</span></div><div className="service-title"><h3>Colore & luce</h3><span>02</span></div><p>Riflessi e sfumature che accendono il tuo look.</p></Link>
            <Link className="service" to="/prenota"><div className="image-wrap"><img src="/assets/luxury-129878-foto-2.jpg" loading="lazy" alt="Onde e styling realizzati da Luxury" /><span className="round-arrow">→</span></div><div className="service-title"><h3>Onde & movimento</h3><span>03</span></div><p>La piega che cambia la giornata.</p></Link>
          </div>
        </section>

        {/* LAVORI — due accessi alle gallerie */}
        <section className="signature-section" id="lavori">
          <div className="section-head">
            <div><p className="eyebrow">IL LAVORO VERO. LO STILE LUXURY.</p><h2>Guarda.<br /><em>Lasciati ispirare.</em></h2></div>
            <p>Foto e video dei nostri lavori.</p>
          </div>
          <div className="work-doors">
            <button className="work-door" onClick={() => setGallery('video')}>
              <img src="/assets/luxury-129870.jpg" alt="Dettaglio di un lavoro Luxury" loading="lazy" />
              <span><b>Guarda i video</b><small>Apri e scorri i nostri lavori →</small></span>
            </button>
            <button className="work-door" onClick={() => setGallery('image')}>
              <img src="/assets/luxury-129874-foto-1.jpg" alt="Colore realizzato da Luxury" loading="lazy" />
              <span><b>Guarda le foto</b><small>Apri e scorri i nostri lavori →</small></span>
            </button>
          </div>
          <div className="signature-bottom"><span>IL TUO PROSSIMO LOOK COMINCIA QUI.</span><Link to="/prenota">Prenota →</Link></div>
        </section>

        {/* RECENSIONI */}
        <section id="recensioni" className="reviews-section">
          <p className="eyebrow">LA TUA ESPERIENZA CONTA</p>
          <h2>La parola a voi.</h2>
          <p id="reviewEmpty">Scopri le esperienze di chi ha scelto Luxury.</p>
          <p id="reviewSetup" className="small">Il collegamento alle recensioni sarà disponibile a breve.</p>
        </section>

        {/* ARMOCROMIA */}
        <section className="color-section" id="armocromia">
          <div className="color-visual">
            <img src="/assets/luxury-129870-foto-2.jpg" loading="lazy" alt="Riflessi e sfumature realizzati da Luxury" />
            <div className="palette-card"><span>LA TUA PALETTE. LA TUA PERSONALITÀ.</span>
              <div className="swatches"><i style={{ ['--swatch' as any]: '#883c39' }}></i><i style={{ ['--swatch' as any]: '#c38d70' }}></i><i style={{ ['--swatch' as any]: '#d9bba2' }}></i><i style={{ ['--swatch' as any]: '#686956' }}></i><i style={{ ['--swatch' as any]: '#323f48' }}></i></div>
            </div>
          </div>
          <div className="color-copy">
            <p className="eyebrow">IL COLORE È PERSONALE</p>
            <h2>Il colore che<br />ti <em>accende.</em></h2>
            <p>La tua palette. La tua luce.</p>
            <p>Dai capelli al guardaroba.<br />Trova la tua armonia.</p>
            <div className="color-steps"><span>01 <b>Scopri la tua palette</b></span><span>02 <b>Immagina il tuo look</b></span><span>03 <b>Lasciati ispirare in boutique</b></span></div>
            <Link className="button" to="/prenota">Scopri i tuoi colori <span>→</span></Link>
          </div>
        </section>

        {/* BOUTIQUE — catalogo reale */}
        <section className="section boutique" id="boutique">
          <div className="section-head">
            <div><p className="eyebrow">LUXURY WARDROBE</p><h2>Indossa la tua<br /><em>personalità.</em></h2></div>
            <p className="section-description">Capi, borse e accessori. Il tocco finale sei tu.</p>
          </div>
          <div className="shop-bar">
            <div className="filters" role="group" aria-label="Filtra il catalogo">
              {categorie.map(c => <button key={c} className={filtro === c ? 'active' : ''} onClick={() => setFiltro(c)}>{c}</button>)}
            </div>
            <Link className="text-link" to="/shop">Vai allo shop →</Link>
          </div>
          <div className="products">
            {visibili.map((p: any) => (
              <Link key={p._id} to="/shop" className="product">
                <img src={fotoArticolo(p)} alt={p.nome} loading="lazy" />
                <div className="details"><strong>{p.nome}</strong><span className="small">{euroCent(p.prezzoCent)}</span></div>
              </Link>
            ))}
            {!visibili.length && <p className="notice">Catalogo in aggiornamento.</p>}
          </div>
          <p style={{ marginTop: 30 }}><Link className="button" to="/shop">Esplora tutti gli articoli →</Link></p>
        </section>

        {/* PRENOTA */}
        <section className="booking-section" id="prenota">
          <div className="booking-intro">
            <p className="eyebrow">IL PROSSIMO PASSO È TUO</p>
            <h2>Il tuo momento.<br /><em>Adesso.</em></h2>
            <p>Scegli l'esperienza che vuoi vivere e prenota in pochi passi: servizio, giorno, orario. La richiesta entra direttamente nell'agenda del salone.</p>
            <div className="booking-address"><span>VIENI A TROVARCI</span><p>Via Appia Nuova 287<br />Roma</p></div>
          </div>
          <div className="booking-card">
            <div className="form-heading"><h3>La tua esperienza Luxury</h3></div>
            <p className="form-note">Prenotazione online reale: scegli il trattamento dal listino del salone, vedi le fasce libere e conferma. Riceverai il riepilogo e potrai seguire la richiesta dalla tua cartella.</p>
            <div className="color-steps" style={{ margin: '18px 0' }}><span>01 <b>Scegli il servizio</b></span><span>02 <b>Giorno e orario liberi</b></span><span>03 <b>I tuoi dati, fatto</b></span></div>
            <Link className="button" to="/prenota" style={{ width: '100%', justifyContent: 'space-between' }}>Prenota il tuo appuntamento <span>→</span></Link>
            <p className="notice" role="status">Il salone confermerà l'appuntamento. Con la tua email accedi alla cartella personale.</p>
          </div>
        </section>

        {/* CONTATTI */}
        <section className="visit section" id="contatti">
          <div><p className="eyebrow">NEL CUORE DI ROMA</p><h2>Ci vediamo<br />da <em>Luxury.</em></h2></div>
          <div className="visit-info">
            <p>Via Appia Nuova 287, Roma</p>
            <p className="muted">Un luogo dove capelli, colori e moda si incontrano.</p>
            <a className="text-link" href="https://www.google.com/maps/search/?api=1&query=Via+Appia+Nuova+287+Roma" target="_blank" rel="noopener">Come raggiungerci <span>→</span></a>
          </div>
          <div className="visit-mark" aria-hidden="true">L<span>✦</span></div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#home"><span className="brand-main">LUXURY<span className="brand-star">✦</span></span><span className="brand-sub">HAIR EXPERIENCE</span></a>
        <div className="footer-line"><p>Il tuo stile. La tua firma.</p><a href="#home">Torna su ↑</a></div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Luxury Hair Experience · Roma</span>
          <Link to="/gestionale/login">Area riservata</Link>
        </div>
      </footer>

      <div className="mobilebar"><a href="#capelli">Salone</a><a href="#lavori">I nostri lavori</a><Link to="/prenota">Prenota →</Link></div>

      {gallery && <GalleryModal kind={gallery} onClose={() => setGallery(null)} />}
    </div>
  );
}
