import { useEffect, useRef, useState } from 'react';

type Stagione = {
  id: string; label: string; sottotitolo: string; metallo: string;
  descrizione: string; evita: string; colori: { nome: string; hex: string }[];
};

const STAGIONI: Stagione[] = [
  {
    id: 'primavera', label: 'Primavera', sottotitolo: 'Calda · chiara · brillante',
    metallo: 'Oro giallo e rame',
    descrizione: 'Colori vivi e luminosi che accendono l\'incarnato dorato. Via libera a coralli, verdi freschi e neutri caldi.',
    evita: 'Nero puro, grigi freddi, toni polvere spenti',
    colori: [
      { nome: 'Corallo', hex: '#f2664c' }, { nome: 'Pesca', hex: '#ffb08a' },
      { nome: 'Albicocca', hex: '#f4a261' }, { nome: 'Verde prato', hex: '#8fbf5f' },
      { nome: 'Turchese chiaro', hex: '#5cc8c0' }, { nome: 'Giallo caldo', hex: '#f4d35e' },
      { nome: 'Camel', hex: '#c1915c' }, { nome: 'Avorio', hex: '#f5eedd' },
    ],
  },
  {
    id: 'estate', label: 'Estate', sottotitolo: 'Fredda · chiara · delicata',
    metallo: 'Argento e oro rosa chiaro',
    descrizione: 'Sfumature polverose e fresche che esaltano l\'incarnato rosato. Rosa, azzurri e grigi perla sono i tuoi alleati.',
    evita: 'Arancio, nero a contatto col viso, colori troppo saturi',
    colori: [
      { nome: 'Rosa cipria', hex: '#e8b4b8' }, { nome: 'Lavanda', hex: '#b8a9c9' },
      { nome: 'Azzurro polvere', hex: '#9bb7d4' }, { nome: 'Grigio perla', hex: '#b7b8bc' },
      { nome: 'Jeans chiaro', hex: '#7a9cc6' }, { nome: 'Malva', hex: '#a05c7b' },
      { nome: 'Verde salvia', hex: '#a9bca2' }, { nome: 'Bianco latte', hex: '#f3f0ea' },
    ],
  },
  {
    id: 'autunno', label: 'Autunno', sottotitolo: 'Calda · scura · intensa',
    metallo: 'Oro, bronzo e ottone',
    descrizione: 'Toni di terra profondi che scaldano l\'incarnato ambrato. Ruggine, oliva e bordeaux ti valorizzano.',
    evita: 'Rosa freddo, grigi ghiaccio, pastelli freddi',
    colori: [
      { nome: 'Ruggine', hex: '#b7410e' }, { nome: 'Terracotta', hex: '#c4714b' },
      { nome: 'Senape', hex: '#d4a017' }, { nome: 'Verde oliva', hex: '#6b7c3f' },
      { nome: 'Cioccolato', hex: '#5c3a21' }, { nome: 'Bordeaux', hex: '#7a2e3d' },
      { nome: 'Teal scuro', hex: '#2d6a6a' }, { nome: 'Beige caldo', hex: '#d9c29a' },
    ],
  },
  {
    id: 'inverno', label: 'Inverno', sottotitolo: 'Fredda · scura · contrastata',
    metallo: 'Argento e platino',
    descrizione: 'Contrasti netti e colori pieni che fanno risaltare l\'incarnato freddo. Nero, bianco ottico e gioielli freddi.',
    evita: 'Beige, arancio, toni caldi e impolverati',
    colori: [
      { nome: 'Nero', hex: '#1a1a1a' }, { nome: 'Bianco ottico', hex: '#ffffff' },
      { nome: 'Rosso rubino', hex: '#a4133c' }, { nome: 'Blu royal', hex: '#2f3fbf' },
      { nome: 'Fucsia', hex: '#c9184a' }, { nome: 'Smeraldo', hex: '#146b52' },
      { nome: 'Antracite', hex: '#3d4451' }, { nome: 'Viola', hex: '#5a189a' },
    ],
  },
];

export default function ArmoProva() {
  const [stagione, setStagione] = useState<Stagione>(STAGIONI[0]);
  const [foto, setFoto] = useState<string>('');
  const [drape, setDrape] = useState(STAGIONI[0].colori[0]);
  const [cam, setCam] = useState(false);
  const [camErr, setCamErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const scegliStagione = (s: Stagione) => { setStagione(s); setDrape(s.colori[0]); };

  const caricaFoto = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    const rd = new FileReader();
    rd.onload = () => setFoto(String(rd.result));
    rd.readAsDataURL(f);
  };

  // ── Fotocamera: selfie dal vivo (resta sul dispositivo) ──
  const chiudiCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCam(false);
  };
  useEffect(() => () => chiudiCam(), []);

  const apriCam = async () => {
    setCamErr('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr('La fotocamera non è disponibile su questo browser. Carica una foto dalla galleria.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCam(true);
      // il video element compare al render successivo
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      }, 50);
    } catch {
      setCamErr('Fotocamera non autorizzata. Consenti l\'accesso oppure carica una foto dalla galleria.');
    }
  };

  const scatta = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width, 0); ctx.scale(-1, 1); // selfie specchiato come l'anteprima
    ctx.drawImage(v, 0, 0);
    setFoto(c.toDataURL('image/jpeg', 0.9));
    chiudiCam();
  };

  const tuttiIColori = STAGIONI.flatMap(s => s.colori.map(c => ({ ...c, stagione: s.label })));

  return (
    <section className="section armo-prova" id="prova-palette">
      <div className="section-head">
        <div>
          <p className="eyebrow">SPERIMENTA DAL SITO</p>
          <h2>Prova i colori<br /><em>addosso.</em></h2>
        </div>
        <p className="section-description">Esplora le quattro stagioni e accosta i tessuti alla tua foto, come nel test con i drappi in salone.</p>
      </div>

      <div className="armo-grid">
        {/* Esplora stagioni */}
        <div className="armo-panel">
          <div className="armo-tabs" role="tablist" aria-label="Stagioni armocromatiche">
            {STAGIONI.map(s => (
              <button key={s.id} role="tab" aria-selected={stagione.id === s.id}
                className={stagione.id === s.id ? 'on' : ''}
                onClick={() => scegliStagione(s)}>{s.label}</button>
            ))}
          </div>
          <div className="armo-stagione">
            <h3>{stagione.label} <span className="armo-sub">{stagione.sottotitolo}</span></h3>
            <div className="armo-palette">
              {stagione.colori.map(c => (
                <button key={c.nome} className="armo-sw" style={{ background: c.hex }}
                  title={`${c.nome} — provalo sulla foto`} aria-label={`Colore ${c.nome}`}
                  onClick={() => setDrape(c)} />
              ))}
            </div>
            <p className="armo-desc">{stagione.descrizione}</p>
            <div className="armo-meta">
              <span><b>Metalli:</b> {stagione.metallo}</span>
              <span><b>Da evitare:</b> {stagione.evita}</span>
            </div>
          </div>
        </div>

        {/* Prova tessuti sulla foto */}
        <div className="armo-panel armo-foto">
          {!foto ? (
            <div className="armo-upload-box">
              <span className="armo-upload-icon">✦</span>
              <b>Aggiungi la tua foto</b>
              <small>Selfie in luce naturale, senza filtri.<br />La foto resta sul tuo dispositivo, non viene inviata.</small>
              <div className="armo-upload-btns">
                <button className="armo-btn" onClick={apriCam}>
                  <span className="armo-btn-ico">◉</span> Apri fotocamera
                </button>
                <button className="armo-btn ghost" onClick={() => fileRef.current?.click()}>
                  <span className="armo-btn-ico">▤</span> Carica da galleria
                </button>
              </div>
              {camErr && <p className="armo-err">{camErr}</p>}
            </div>
          ) : (
            <div className="armo-drape-wrap">
              <div className="armo-face">
                <img src={foto} alt="La tua foto per il test colori" />
                <div className="armo-change-row">
                  <button className="armo-change" onClick={apriCam}>Rifai la foto</button>
                  <button className="armo-change" onClick={() => { setFoto(''); }}>Cambia foto</button>
                </div>
              </div>
              <div className="armo-drape" style={{ background: drape.hex }}>
                <span>{drape.nome}</span>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => caricaFoto(e.target.files?.[0])} />

          {/* Fotocamera live */}
          {cam && (
            <div className="armo-cam" role="dialog" aria-label="Fotocamera">
              <video ref={videoRef} playsInline muted autoPlay className="armo-cam-video" />
              <div className="armo-cam-btns">
                <button className="armo-btn" onClick={scatta}>◉ Scatta</button>
                <button className="armo-btn ghost" onClick={chiudiCam}>Annulla</button>
              </div>
              <small>Inquadra il viso in luce naturale, capelli scoperti.</small>
            </div>
          )}
          <div className="armo-all">
            <span className="armo-all-label">Tocca un tessuto per accostarlo{!foto ? ' — carica prima la foto' : ''}</span>
            <div className="armo-strip">
              {tuttiIColori.map(c => (
                <button key={c.stagione + c.nome}
                  className={`armo-sw ${drape.nome === c.nome ? 'sel' : ''}`}
                  style={{ background: c.hex }}
                  title={`${c.nome} · ${c.stagione}`} aria-label={`Tessuto ${c.nome}, ${c.stagione}`}
                  onClick={() => { setDrape(c); if (!foto) fileRef.current?.click(); }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="armo-note">
        Indicazione dimostrativa: gli schermi mostrano i colori in modo diverso dalla luce naturale.
        La stagione si firma in salone, con i drappi veri e la consulente che ti segue.
      </p>
    </section>
  );
}
