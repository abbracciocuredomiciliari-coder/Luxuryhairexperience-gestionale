import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

/* ── Motore colore (dal pacchetto sorgente): ricolorazione con maschera alfa
   e luminosità dell'originale. Simulazione, non una tintura reale. ── */
function hexRgb(v: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error('Colore non valido');
  return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}
function recolor(source: Uint8ClampedArray, mask: Uint8ClampedArray, color: string, intensity: number) {
  const rgb = hexRgb(color), alpha = Math.max(0, Math.min(1, intensity));
  const out = new Uint8ClampedArray(source);
  const base = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  for (let i = 0; i < out.length; i += 4) {
    const a = (mask[i + 3] / 255) * alpha;
    if (!a) continue;
    const lum = 0.2126 * source[i] + 0.7152 * source[i + 1] + 0.0722 * source[i + 2];
    for (let c = 0; c < 3; c++) {
      const tint = Math.min(255, rgb[c] * (0.3 + 0.7 * lum / Math.max(30, base)));
      out[i + c] = source[i + c] * (1 - a) + tint * a;
    }
  }
  return out;
}

type Zona = 'hair' | 'clothes';
const ZONA_CLASSE: Record<Zona, number> = { hair: 1, clothes: 4 }; // classi MediaPipe

const PALETTE: [string, string][] = [
  ['Castano', '#53372b'], ['Cioccolato', '#6f4334'], ['Rame', '#b46b3c'], ['Biondo miele', '#c7a568'],
  ['Borgogna', '#722e44'], ['Nero morbido', '#242328'], ['Rosso caldo', '#b84d40'], ['Rosa freddo', '#b56485'],
  ['Blu profondo', '#314b78'], ['Verde salvia', '#889879'], ['Avorio', '#ece3cf'], ['Viola', '#745586'],
];
const TEAL = '#39e0b1';

let segPromise: Promise<ImageSegmenter> | null = null;
function getSegmenter() {
  if (!segPromise) {
    segPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/assets/vision-wasm');
      const opts = (delegate?: 'GPU') => ({
        baseOptions: { modelAssetPath: '/assets/selfie_multiclass_256x256.tflite', delegate },
        runningMode: 'IMAGE' as const, outputCategoryMask: true, outputConfidenceMasks: false,
      });
      try { return await ImageSegmenter.createFromOptions(vision, opts('GPU')); }
      catch { return ImageSegmenter.createFromOptions(vision, opts()); }
    })();
    segPromise.catch(() => { segPromise = null; });
  }
  return segPromise;
}

export default function ProvaColori() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const masksRef = useRef<Partial<Record<Zona, HTMLCanvasElement>>>({});
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const beforeRef = useRef(false);
  const maskViewRef = useRef(false);
  const decodeRef = useRef(0);
  const segRef = useRef<ImageSegmenter | null>(null);

  const [caricata, setCaricata] = useState(false);
  const [target, setTarget] = useState<Zona>('hair');
  const [color, setColor] = useState('#b46b3c');
  const [colorName, setColorName] = useState('Rame');
  const [intensity, setIntensity] = useState(85);
  const [brushSize, setBrushSize] = useState(60);
  const [brushMode, setBrushMode] = useState<'paint' | 'erase'>('paint');
  const [status, setStatus] = useState('Carica una foto dalla galleria o scatta un selfie.');
  const [aiBusy, setAiBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);

  const newMask = (w: number, h: number) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };

  // ── render: base → ricolorazione sulla zona corrente (o vista maschera/originale) ──
  const render = () => {
    const canvas = canvasRef.current, base = baseRef.current;
    if (!canvas || !base || !base.width) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    if (beforeRef.current) return;
    const mc = masksRef.current[target];
    if (!mc) return;
    if (maskViewRef.current) {
      ctx.save(); ctx.globalAlpha = 0.45; ctx.drawImage(mc, 0, 0); ctx.restore(); return;
    }
    const bc = base.getContext('2d', { willReadFrequently: true })!;
    const image = bc.getImageData(0, 0, base.width, base.height);
    const mask = mc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, base.width, base.height);
    ctx.putImageData(new ImageData(recolor(image.data, mask.data, color, intensity / 100), base.width, base.height), 0, 0);
  };
  useEffect(render, [color, intensity, target, caricata]);

  // ── caricamento foto (galleria o fotocamera) — tutto locale ──
  const load = async (file?: File) => {
    const version = ++decodeRef.current;
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setStatus('Scegli una foto fino a 12 MB.'); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setStatus('Usa una foto JPG, PNG o WebP.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      if (version !== decodeRef.current) return;
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const w = Math.max(1, Math.round(image.naturalWidth * scale));
      const h = Math.max(1, Math.round(image.naturalHeight * scale));
      const base = newMask(w, h);
      base.getContext('2d')!.drawImage(image, 0, 0, w, h);
      baseRef.current = base;
      masksRef.current = { hair: newMask(w, h), clothes: newMask(w, h) };
      beforeRef.current = false; maskViewRef.current = false;
      const canvas = canvasRef.current!;
      canvas.width = w; canvas.height = h;
      setCaricata(true); render();
      setStatus('Foto pronta. Premi "Rileva" oppure dipingi la zona con il pennello.');
    } catch {
      if (version === decodeRef.current) setStatus('Impossibile leggere la foto. Prova a salvarla in JPG.');
    } finally { URL.revokeObjectURL(url); }
  };

  // ── pennello / gomma sulla maschera della zona corrente ──
  const point = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!, r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const base = baseRef.current, mc = masksRef.current[target];
    if (!base || !mc) return;
    const m = mc.getContext('2d')!;
    const size = brushSize * base.width / 600;
    m.globalCompositeOperation = brushMode === 'erase' ? 'destination-out' : 'source-over';
    m.strokeStyle = TEAL; m.fillStyle = TEAL;
    m.lineWidth = size; m.lineCap = 'round';
    m.beginPath(); m.moveTo(a.x, a.y); m.lineTo(b.x, b.y); m.stroke();
    m.beginPath(); m.arc(b.x, b.y, size / 2, 0, Math.PI * 2); m.fill();
    render();
  };
  const onDown = (e: React.PointerEvent) => {
    if (!caricata || beforeRef.current || maskViewRef.current) return;
    e.preventDefault();
    drawingRef.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const p = point(e); lastRef.current = p; stroke(p, p);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = point(e); stroke(lastRef.current!, p); lastRef.current = p;
  };
  const stop = () => { drawingRef.current = false; lastRef.current = null; };

  // ── rilevamento automatico MediaPipe (locale, nessun invio) ──
  const rileva = async (zona: Zona) => {
    const base = baseRef.current;
    if (!base?.width || aiBusy) return;
    setAiBusy(true);
    setStatus(`Riconosco ${zona === 'hair' ? 'i capelli' : 'il vestito'} sul dispositivo…`);
    try {
      if (!segRef.current) segRef.current = await getSegmenter();
      const res = segRef.current.segment(base);
      const mask = res.categoryMask;
      if (!mask) throw new Error('no mask');
      const mw = mask.width, mh = mask.height, m = mask.getAsUint8Array();
      const cls = ZONA_CLASSE[zona];
      // maschera alfa nella dimensione della foto, poi bordi ammorbiditi
      const raw = newMask(base.width, base.height);
      const rctx = raw.getContext('2d')!;
      const md = rctx.createImageData(raw.width, raw.height);
      let found = 0;
      for (let y = 0; y < raw.height; y++) {
        const my = Math.min(mh - 1, Math.round(y * mh / raw.height)) * mw;
        for (let x = 0; x < raw.width; x++) {
          if (m[my + Math.min(mw - 1, Math.round(x * mw / raw.width))] !== cls) continue;
          const i = (y * raw.width + x) * 4;
          md.data[i] = 57; md.data[i + 1] = 224; md.data[i + 2] = 177; md.data[i + 3] = 255;
          found++;
        }
      }
      if (found < raw.width * raw.height * 0.005) throw new Error('empty');
      rctx.putImageData(md, 0, 0);
      const mc = newMask(raw.width, raw.height);
      const mctx = mc.getContext('2d')!;
      mctx.filter = 'blur(2px)';
      mctx.drawImage(raw, 0, 0);
      masksRef.current[zona] = mc;
      setTarget(zona); render();
      setStatus('Zona rilevata. Ritocca i bordi con pennello o gomma.');
    } catch {
      setStatus('Non ho trovato la zona in questa foto: selezionala con il pennello.');
    } finally { setAiBusy(false); }
  };

  const hold = (which: 'before' | 'mask') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (which === 'before') beforeRef.current = true; else maskViewRef.current = true;
      render();
    },
    onPointerUp: () => { beforeRef.current = false; maskViewRef.current = false; render(); },
    onPointerCancel: () => { beforeRef.current = false; maskViewRef.current = false; render(); },
    onLostPointerCapture: () => { beforeRef.current = false; maskViewRef.current = false; render(); },
  });

  const ruota = () => {
    const base = baseRef.current;
    if (!base?.width) return;
    const old = newMask(base.width, base.height);
    old.getContext('2d')!.drawImage(base, 0, 0);
    base.width = old.height; base.height = old.width;
    const bc = base.getContext('2d')!;
    bc.translate(base.width, 0); bc.rotate(Math.PI / 2); bc.drawImage(old, 0, 0); bc.setTransform(1, 0, 0, 1, 0, 0);
    const canvas = canvasRef.current!;
    canvas.width = base.width; canvas.height = base.height;
    masksRef.current = { hair: newMask(base.width, base.height), clothes: newMask(base.width, base.height) };
    render();
    setStatus('Foto ruotata. Le selezioni sono state azzerate.');
  };

  const elimina = () => {
    decodeRef.current++;
    drawingRef.current = false; beforeRef.current = false; maskViewRef.current = false;
    baseRef.current = null; masksRef.current = {};
    const canvas = canvasRef.current!; canvas.width = 0; canvas.height = 0;
    setCaricata(false);
    setStatus('Foto eliminata dalla prova. L\'originale non è stato toccato.');
  };

  const scarica = () => {
    const base = baseRef.current, canvas = canvasRef.current;
    if (!base?.width || !canvas) return;
    beforeRef.current = false; maskViewRef.current = false; render();
    const out = newMask(base.width * 2, base.height + 80);
    const c = out.getContext('2d')!;
    c.fillStyle = '#f4f0e8'; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(base, 0, 0); c.drawImage(canvas, base.width, 0);
    c.fillStyle = '#292a24';
    c.font = `${Math.max(16, Math.round(base.width / 30))}px sans-serif`;
    c.fillText('Prima', 20, base.height + 30);
    c.fillText('Anteprima Luxury', base.width + 20, base.height + 30);
    c.font = '14px sans-serif';
    c.fillText('Simulazione colore. Il risultato reale può variare.', 20, base.height + 60);
    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'Luxury-confronto-colori.jpg'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="lx">
      <SiteHeader attivo="prova-colori" />
      <main className="pv-page">
        <div className="section-head">
          <div>
            <p className="eyebrow">ARMOCROMIA INTERATTIVA</p>
            <h2>Prova i tuoi <em>colori.</em></h2>
          </div>
          <p className="section-description">
            Carica la foto → rileva o dipingi la zona → scegli i colori → confronta il risultato.
            Tutto avviene sul tuo dispositivo: la foto non viene mai inviata.
          </p>
        </div>

        {!caricata ? (
          <div className="armo-panel pv-upload-box">
            <span className="armo-upload-icon">✦</span>
            <b>Aggiungi la tua foto</b>
            <small>Selfie in luce naturale, senza filtri, capelli scoperti.<br />Elaborata nel browser: nessun invio, nessun salvataggio.</small>
            <div className="armo-upload-btns">
              <button className="armo-btn" onClick={() => selfieRef.current?.click()}>
                <span className="armo-btn-ico">◉</span> Scatta un selfie
              </button>
              <button className="armo-btn ghost" onClick={() => uploadRef.current?.click()}>
                <span className="armo-btn-ico">▤</span> Carica da galleria
              </button>
            </div>
          </div>
        ) : (
          <div className="pv-workspace">
            <div className="pv-toolbar">
              <button className="armo-ai-btn" disabled={aiBusy} onClick={() => rileva('hair')}>✦ Rileva capelli</button>
              <button className="armo-ai-btn" disabled={aiBusy} onClick={() => rileva('clothes')}>✦ Rileva vestito</button>
              <span className="pv-sep" />
              <button className="armo-ai-btn" onClick={ruota}>Ruota</button>
              <button className="armo-ai-btn" onClick={elimina}>Elimina foto</button>
              <button className="armo-ai-btn pv-download" onClick={scarica}>Scarica confronto ↓</button>
            </div>

            <div className="pv-main">
              <div className="pv-canvas-wrap">
                <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove}
                  onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
                  aria-label="Foto su cui dipingere la selezione" />
              </div>

              <div className="pv-controls">
                <div className="pv-group">
                  <span className="pv-label">ZONA</span>
                  <div className="pv-row">
                    <button className={`armo-ai-btn ${target === 'hair' ? 'on' : ''}`} onClick={() => setTarget('hair')}>Capelli</button>
                    <button className={`armo-ai-btn ${target === 'clothes' ? 'on' : ''}`} onClick={() => setTarget('clothes')}>Vestito</button>
                  </div>
                </div>
                <div className="pv-group">
                  <span className="pv-label">PENNELLO</span>
                  <div className="pv-row">
                    <button className={`armo-ai-btn ${brushMode === 'paint' ? 'on' : ''}`} onClick={() => setBrushMode('paint')}>Colora</button>
                    <button className={`armo-ai-btn ${brushMode === 'erase' ? 'on' : ''}`} onClick={() => setBrushMode('erase')}>Gomma</button>
                    <button className="armo-ai-btn" onClick={() => { masksRef.current[target] = newMask(baseRef.current!.width, baseRef.current!.height); render(); setStatus('Selezione cancellata.'); }}>Pulisci zona</button>
                  </div>
                  <label className="pv-slider">Misura
                    <input type="range" min={10} max={140} value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
                  </label>
                </div>
                <div className="pv-group">
                  <span className="pv-label">COLORE — {colorName}</span>
                  <div className="pv-swatches">
                    {PALETTE.map(([nome, hex]) => (
                      <button key={hex} className={`armo-sw ${color === hex ? 'sel' : ''}`} style={{ background: hex }}
                        title={nome} aria-label={nome} aria-pressed={color === hex}
                        onClick={() => { setColor(hex); setColorName(nome); }} />
                    ))}
                    <label className="pv-custom" title="Colore personalizzato">
                      <input type="color" value={color} onChange={e => { setColor(e.target.value); setColorName('Colore personalizzato'); }} />
                    </label>
                  </div>
                  <label className="pv-slider">Intensità {intensity}%
                    <input type="range" min={10} max={100} value={intensity} onChange={e => setIntensity(+e.target.value)} />
                  </label>
                </div>
                <div className="pv-row pv-hold">
                  <button className="armo-ai-btn" {...hold('mask')}>Mostra zona</button>
                  <button className="armo-ai-btn" {...hold('before')}>Tieni premuto: prima</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
          onChange={e => { load(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={selfieRef} type="file" accept="image/*" capture="user" hidden
          onChange={e => { load(e.target.files?.[0]); e.target.value = ''; }} />

        <p className="pv-status" role="status">{aiBusy ? 'Elaborazione in corso sul dispositivo…' : status}</p>
        <p className="armo-note">
          Un'anteprima per ispirarti: la prova colore non equivale al risultato di una tintura né a una consulenza
          cromatica completa. La stagione e il colore giusto si firmano in salone, con i drappi veri.
        </p>
        <Link className="armo-btn" to="/prenota" style={{ alignSelf: 'flex-start' }}>Prenota la consulenza in salone →</Link>
      </main>
    </div>
  );
}
