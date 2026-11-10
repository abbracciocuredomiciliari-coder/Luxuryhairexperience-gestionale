import { useEffect, useRef, useState } from 'react';
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

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
  const [drape, setDrape] = useState<{ nome: string; hex: string; stagione?: string }>(
    { ...STAGIONI[0].colori[0], stagione: STAGIONI[0].label });
  const [cam, setCam] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [risultato, setRisultato] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const scegliStagione = (s: Stagione) => { setStagione(s); setDrape({ ...s.colori[0], stagione: s.label }); };

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

  // ── Recoloring sul dispositivo (MediaPipe SelfieSegmenter) ──
  // La foto non esce mai dal dispositivo: niente server, niente API a pagamento.
  // Classi del modello: 0 sfondo · 1 capelli · 2 pelle corpo · 3 viso · 4 vestiti · 5 altro
  const AI_CAPELLI = [
    { nome: 'Rame', hex: '#a34d21' },
    { nome: 'Biondo miele', hex: '#c9984f' },
    { nome: 'Castano cioccolato', hex: '#4a2e1c' },
    { nome: 'Nero corvino', hex: '#17130f' },
    { nome: 'Rosa pastello', hex: '#e8a7b8' },
  ];

  const segRef = useRef<ImageSegmenter | null>(null);
  const getSegmenter = async () => {
    if (!segRef.current) {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/assets/vision-wasm');
      try {
        segRef.current = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/assets/selfie_multiclass_256x256.tflite', delegate: 'GPU' },
          runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
        });
      } catch {
        segRef.current = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/assets/selfie_multiclass_256x256.tflite' },
          runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
        });
      }
    }
    return segRef.current;
  };

  const hexToHsl = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };

  const provaColore = async (classe: 1 | 4, hex: string) => {
    if (!foto || aiBusy) return;
    setAiBusy(true); setAiErr(''); setRisultato('');
    try {
      const seg = await getSegmenter();
      const img = await new Promise<HTMLImageElement>((ok, ko) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = foto;
      });
      const res = seg.segment(img);
      const mask = res.categoryMask; if (!mask) throw new Error('no mask');
      const mw = mask.width, mh = mask.height;
      const m = mask.getAsUint8Array();

      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const d = id.data;
      const [th, ts, tl] = hexToHsl(hex);
      // per capelli scuri → tinte chiare serve alzare un po' anche la luminosità
      const liftL = Math.max(0, tl - 0.25) * 0.5;

      for (let y = 0; y < c.height; y++) {
        const my = Math.min(mh - 1, Math.round(y * mh / c.height)) * mw;
        for (let x = 0; x < c.width; x++) {
          if (m[my + Math.min(mw - 1, Math.round(x * mw / c.width))] !== classe) continue;
          const i = (y * c.width + x) * 4;
          const mx = Math.max(d[i], d[i + 1], d[i + 2]) / 255, mn = Math.min(d[i], d[i + 1], d[i + 2]) / 255;
          const [r, g, b] = hslToRgb(th, ts, Math.min(1, (mx + mn) / 2 + liftL));
          d[i] = r; d[i + 1] = g; d[i + 2] = b;
        }
      }
      ctx.putImageData(id, 0, 0);
      setRisultato(c.toDataURL('image/jpeg', 0.88));
    } catch {
      setAiErr('Recoloring non riuscito su questa foto: prova un selfie più nitido e frontale.');
    } finally { setAiBusy(false); }
  };

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
                  onClick={() => setDrape({ ...c, stagione: stagione.label })} />
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
            <div className="armo-drape-wrap" style={{ background: drape.hex }}>
              <div className="armo-face">
                <img src={risultato || foto} alt="La tua foto per il test colori" />
                {risultato && (
                  <div className="armo-ai-toggle">
                    <button className="armo-change" onClick={() => setRisultato('')}>← Originale</button>
                    <span className="armo-ai-badge">✦ Ricolorata</span>
                  </div>
                )}
                <div className="armo-change-row">
                  <button className="armo-change" onClick={apriCam}>Rifai la foto</button>
                  <button className="armo-change" onClick={() => { setFoto(''); setRisultato(''); }}>Cambia foto</button>
                </div>
              </div>
              {/* colletto di drappi: tutti i colori della stagione attaccati al mento */}
              <div className="armo-collar" role="group" aria-label="Tessuti sotto il viso">
                {stagione.colori.map(c => (
                  <button key={c.nome}
                    className={`armo-collar-sw ${c.nome === drape.nome ? 'sel' : ''}`}
                    style={{ background: c.hex }} title={c.nome}
                    aria-label={`Drappo ${c.nome}`}
                    onClick={() => setDrape({ ...c, stagione: stagione.label })} />
                ))}
              </div>
              <span className="armo-drape-name">{drape.nome} · {drape.stagione}</span>
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

          {/* Recoloring capelli e abito — tutto sul dispositivo */}
          {foto && (
            <div className="armo-ai">
              <span className="armo-all-label">✦ Cambia davvero capelli e abito sulla tua foto — la foto resta sul dispositivo</span>
              <div className="armo-ai-row">
                <span className="armo-ai-cat">CAPELLI</span>
                {AI_CAPELLI.map(c => (
                  <button key={c.nome} className="armo-ai-btn" disabled={aiBusy}
                    onClick={() => provaColore(1, c.hex)}>
                    <i className="armo-ai-dot" style={{ background: c.hex }} />{c.nome}
                  </button>
                ))}
              </div>
              <div className="armo-ai-row">
                <span className="armo-ai-cat">ABITO</span>
                <button className="armo-ai-btn" disabled={aiBusy} onClick={() => provaColore(4, drape.hex)}>
                  <i className="armo-ai-dot" style={{ background: drape.hex }} />Indossa {drape.nome.toLowerCase()}
                </button>
                <button className="armo-ai-btn" disabled={aiBusy} onClick={() => provaColore(4, '#f5f2ec')}>
                  <i className="armo-ai-dot" style={{ background: '#f5f2ec' }} />Indossa bianco
                </button>
                <button className="armo-ai-btn" disabled={aiBusy} onClick={() => provaColore(4, '#17130f')}>
                  <i className="armo-ai-dot" style={{ background: '#17130f' }} />Indossa nero
                </button>
              </div>
              {aiBusy && <p className="armo-ai-status">Analizzo e ricoloro la foto sul tuo dispositivo… il primo avvio scarica il modello.</p>}
              {aiErr && <p className="armo-err">{aiErr}</p>}
            </div>
          )}
        </div>
      </div>

      <p className="armo-note">
        Indicazione dimostrativa: gli schermi mostrano i colori in modo diverso dalla luce naturale.
        La stagione si firma in salone, con i drappi veri e la consulente che ti segue.
      </p>
    </section>
  );
}
