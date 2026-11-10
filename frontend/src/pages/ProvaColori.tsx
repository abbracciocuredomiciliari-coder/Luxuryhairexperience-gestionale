import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import api from '../api';
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
// palette armocromatiche per stagione (come i drappi della consulenza)
const STAGIONI: { id: string; label: string; colori: [string, string][] }[] = [
  { id: 'primavera', label: 'Primavera', colori: [
    ['Corallo', '#f2664c'], ['Pesca', '#ffb08a'], ['Albicocca', '#f4a261'], ['Verde prato', '#8fbf5f'],
    ['Turchese chiaro', '#5cc8c0'], ['Giallo caldo', '#f4d35e'], ['Camel', '#c1915c'], ['Avorio', '#f5eedd'],
  ]},
  { id: 'estate', label: 'Estate', colori: [
    ['Rosa cipria', '#e8b4b8'], ['Lavanda', '#b8a9c9'], ['Azzurro polvere', '#9bb7d4'], ['Grigio perla', '#b7b8bc'],
    ['Jeans chiaro', '#7a9cc6'], ['Malva', '#a05c7b'], ['Verde salvia', '#a9bca2'], ['Bianco latte', '#f3f0ea'],
  ]},
  { id: 'autunno', label: 'Autunno', colori: [
    ['Ruggine', '#b7410e'], ['Terracotta', '#c4714b'], ['Senape', '#d4a017'], ['Verde oliva', '#6b7c3f'],
    ['Cioccolato', '#5c3a21'], ['Bordeaux', '#7a2e3d'], ['Teal scuro', '#2d6a6a'], ['Beige caldo', '#d9c29a'],
  ]},
  { id: 'inverno', label: 'Inverno', colori: [
    ['Nero', '#1a1a1a'], ['Bianco ottico', '#ffffff'], ['Rosso rubino', '#a4133c'], ['Blu royal', '#2f3fbf'],
    ['Fucsia', '#c9184a'], ['Smeraldo', '#146b52'], ['Antracite', '#3d4451'], ['Viola', '#5a189a'],
  ]},
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
  const [aiGenOn, setAiGenOn] = useState(false);
  const [aiGenBusy, setAiGenBusy] = useState(false);
  const [consensoAi, setConsensoAi] = useState(false);
  const [prodotti, setProdotti] = useState<{ _id: string; nome: string; immagine?: string; categoria?: string }[]>([]);
  const [capo, setCapo] = useState('');
  const [copertura, setCopertura] = useState(55);        // quanto della chioma prende la sfumatura
  const [stileId, setStileId] = useState<string | null>(null);
  const [paletteGruppo, setPaletteGruppo] = useState<string>('tutti');
  const stileBaseRef = useRef<HTMLCanvasElement | null>(null); // maschera capelli piena prima dello stile
  const cursorRef = useRef<HTMLDivElement | null>(null);       // anello anteprima pennello
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);

  // foto demo incluse nel sito: per provare subito senza caricare nulla
  const DEMO = [
    { nome: 'Chioma lunga', src: '/assets/luxury-129870-foto-2.jpg', nota: 'capelli + top' },
    { nome: 'Look in città', src: '/assets/dress.jpg', nota: 'vestito intero' },
    { nome: 'Biondo mosso', src: '/assets/luxury-129878-foto-2.jpg', nota: 'capelli' },
  ];
  const caricaDemo = async (src: string, nome: string) => {
    setStatus(`Carico la foto demo "${nome}"…`);
    try {
      const blob = await (await fetch(src)).blob();
      await load(new File([blob], 'demo.jpg', { type: blob.type || 'image/jpeg' }));
    } catch { setStatus('Foto demo non disponibile.'); }
  };

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

  // ── AI generativa (extra): attiva solo se il server è configurato ──
  useEffect(() => {
    api.get('/public/prova-ai-status').then(r => setAiGenOn(!!r.data?.attiva)).catch(() => {});
    api.get('/public/shop').then(r => setProdotti(r.data || [])).catch(() => {});
  }, []);

  const TAGLI = [
    { nome: 'Bob lungo', prompt: 'Cambia il taglio di capelli della persona in un long bob (lob) liscio e curato' },
    { nome: 'Lunghi scalati', prompt: 'Cambia il taglio di capelli della persona in capelli lunghi scalati con movimento' },
    { nome: 'Frangetta', prompt: 'Aggiungi una frangetta piena e curata ai capelli della persona' },
    { nome: 'Pixie', prompt: 'Cambia il taglio di capelli della persona in un pixie cut corto elegante' },
    { nome: 'Raccolto', prompt: 'Cambia l\'acconciatura della persona in un raccolto elegante da sera' },
  ];

  const ridimensionaCanvas = (c: HTMLCanvasElement, max = 1024): string => {
    const k = Math.min(1, max / Math.max(c.width, c.height));
    if (k >= 1) return c.toDataURL('image/jpeg', 0.88);
    const o = document.createElement('canvas');
    o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
    o.getContext('2d')!.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/jpeg', 0.88);
  };

  const provaGen = async (prompt: string, immagineIn?: string) => {
    const base = baseRef.current;
    if (!base?.width || !consensoAi || aiGenBusy) return;
    setAiGenBusy(true);
    setStatus('Il servizio AI sta elaborando la foto… 10-40 secondi.');
    try {
      const { data } = await api.post('/public/prova-ai', {
        image: immagineIn || ridimensionaCanvas(base),
        prompt,
      });
      if (!data?.image) throw new Error('empty');
      const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = data.image; });
      resetStile();
      // il risultato diventa la nuova foto di lavoro: maschere azzerate
      const w = Math.min(1200, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      base.width = w; base.height = h;
      base.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const canvas = canvasRef.current!;
      canvas.width = w; canvas.height = h;
      masksRef.current = { hair: newMask(w, h), clothes: newMask(w, h) };
      beforeRef.current = false; maskViewRef.current = false;
      render();
      setStatus('Fatto! Puoi applicare un altro effetto o ricolorare la nuova foto.');
    } catch (e: any) {
      setStatus(e?.response?.data?.message || 'Prova AI non riuscita, riprova tra poco.');
    } finally { setAiGenBusy(false); }
  };

  const imgEl = (src: string): Promise<HTMLImageElement | null> => new Promise(ok => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
  });

  // Il modello gratuito accetta UNA sola immagine: compongo foto + capo
  // in un unico pannello così il servizio vede il capo da far indossare.
  const indossaCapo = async () => {
    const p = prodotti.find(x => x._id === capo);
    const base = baseRef.current;
    if (!p || !base?.width || !consensoAi || aiGenBusy) return;
    let composita: string | undefined;
    if (p.immagine) {
      const ref = await imgEl(p.immagine);
      if (ref) {
        const wRef = Math.max(120, Math.round(ref.naturalWidth * base.height / ref.naturalHeight));
        const c = newMask(base.width + wRef + 16, base.height);
        const x = c.getContext('2d')!;
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(base, 0, 0);
        x.drawImage(ref, base.width + 8, 0, wRef, base.height);
        composita = ridimensionaCanvas(c);
      }
    }
    provaGen(
      composita
        ? `L'immagine mostra una persona a sinistra e un capo d'abbigliamento (${p.nome}) su fondo bianco a destra. Fai indossare alla persona esattamente quel capo al posto del suo indumento, mantenendo identici viso, capelli, posa e sfondo. Nel risultato mostra SOLO la persona a tutta scena: elimina completamente il pannello del capo sulla destra.`
        : `Cambia l'indumento della persona in: ${p.nome}${p.categoria ? ` (${p.categoria})` : ''}, realistico`,
      composita,
    );
  };

  // ── caricamento foto (galleria o fotocamera) — tutto locale ──
  const load = async (file?: File) => {
    const version = ++decodeRef.current;
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setStatus('Scegli una foto fino a 12 MB.'); return; }
    if (file.type && !file.type.startsWith('image/')) { setStatus('Il file scelto non è una foto.'); return; }
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
      resetStile();
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
    // anello anteprima: il diametro mostra la misura reale del pennello
    const cv = canvasRef.current, cur = cursorRef.current;
    if (cv && cur) {
      const r = cv.getBoundingClientRect();
      const d = Math.max(6, brushSize * r.width / 600);
      cur.style.display = 'block';
      cur.style.width = cur.style.height = `${d}px`;
      cur.style.left = `${e.clientX - r.left - d / 2}px`;
      cur.style.top = `${e.clientY - r.top - d / 2}px`;
    }
    if (!drawingRef.current) return;
    const p = point(e); stroke(lastRef.current!, p); lastRef.current = p;
  };
  const nascondiCursore = () => { if (cursorRef.current) cursorRef.current.style.display = 'none'; };
  const stop = () => { drawingRef.current = false; lastRef.current = null; };

  // ── rilevamento automatico MediaPipe (locale, nessun invio) ──
  // rileva la zona e scrive la maschera; ritorna true se trovata
  const detect = async (zona: Zona): Promise<boolean> => {
    const base = baseRef.current;
    if (!base?.width) return false;
    if (!segRef.current) segRef.current = await getSegmenter();
    const res = segRef.current.segment(base);
    const mask = res.categoryMask;
    if (!mask) return false;
    const mw = mask.width, mh = mask.height, m = mask.getAsUint8Array();
    const cls = ZONA_CLASSE[zona];
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
    if (found < raw.width * raw.height * 0.005) return false;
    rctx.putImageData(md, 0, 0);
    const mc = newMask(raw.width, raw.height);
    const mctx = mc.getContext('2d')!;
    mctx.filter = 'blur(2px)';
    mctx.drawImage(raw, 0, 0);
    masksRef.current[zona] = mc;
    return true;
  };

  const rileva = async (zona: Zona) => {
    if (!baseRef.current?.width || aiBusy) return;
    setAiBusy(true);
    setStatus(`Riconosco ${zona === 'hair' ? 'i capelli' : 'il vestito'} sul dispositivo…`);
    try {
      if (await detect(zona)) {
        if (zona === 'hair') resetStile();
        setTarget(zona); render();
        setStatus('Zona rilevata. Ritocca i bordi con pennello o gomma.');
      } else {
        setStatus('Non ho trovato la zona in questa foto: selezionala con il pennello.');
      }
    } catch {
      setStatus('Non ho trovato la zona in questa foto: selezionala con il pennello.');
    } finally { setAiBusy(false); }
  };

  // ── Stili colore sui capelli: schiariture, colpi di sole, balayage ──
  // La sfumatura si rigenera dalla maschera piena: lo slider "copertura" decide
  // quanta chioma viene tinta e il colore/intensità scelti la tingono.
  const STILI: { id: string; label: string }[] = [
    { id: 'schiaritura', label: 'Schiaritura' },
    { id: 'balayage', label: 'Balayage' },
    { id: 'colpi', label: 'Colpi di sole' },
    { id: 'riflessi', label: 'Riflessi' },
  ];

  const maskHaContenuto = (zona: Zona): boolean => {
    const mc = masksRef.current[zona];
    if (!mc) return false;
    const d = mc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, mc.width, mc.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true;
    return false;
  };

  const resetStile = () => { stileBaseRef.current = null; setStileId(null); };

  // rigenera la maschera capelli: base piena × pattern dello stile, graduato da `cop` (0-100)
  const rigeneraSfumatura = (id: string, cop: number) => {
    const piena = stileBaseRef.current;
    if (!piena) return;
    const mc = newMask(piena.width, piena.height);
    const mctx = mc.getContext('2d', { willReadFrequently: true })!;
    mctx.drawImage(piena, 0, 0);
    if (id === 'schiaritura') { masksRef.current.hair = mc; render(); return; }
    const idata = mctx.getImageData(0, 0, mc.width, mc.height);
    const d = idata.data, w = mc.width, h = mc.height;
    if (id === 'balayage' || id === 'riflessi') {
      // gradiente radice→punte: `cop` = % di chioma colorata a partire dalle punte
      let yMin = h, yMax = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) { if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
      }
      const span = Math.max(1, yMax - yMin);
      const est = cop / 100 * (id === 'riflessi' ? 1.15 : 1); // riflessi sale più in alto
      const t0 = Math.max(0, 1 - est);
      const rampa = Math.max(0.08, est * 0.9);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3;
        if (!d[i]) continue;
        const t = (y - yMin) / span;
        const k = Math.max(0, Math.min(1, (t - t0) / rampa));
        d[i] = Math.round(d[i] * (k * k * (3 - 2 * k)));
      }
    } else if (id === 'colpi') {
      // ciocche ondulate: `cop` = densità delle mechès
      const soglia = 1 - Math.min(0.95, cop / 100 * 1.15);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3;
        if (!d[i]) continue;
        const onda = Math.sin(x * 0.045 + Math.sin(y * 0.012) * 4 + y * 0.004);
        const k = Math.max(0, Math.min(1, (onda - soglia) / Math.max(0.08, 1 - soglia) * 1.4));
        d[i] = Math.round(d[i] * k);
      }
    }
    mctx.putImageData(idata, 0, 0);
    masksRef.current.hair = mc;
    render();
  };

  const applicaStile = async (stile: typeof STILI[number]) => {
    if (!baseRef.current?.width || aiBusy) return;
    setAiBusy(true);
    setStatus(`Applico ${stile.label.toLowerCase()}…`);
    try {
      if (!maskHaContenuto('hair') && !(await detect('hair'))) {
        setStatus('Non ho trovato i capelli: dipingi la zona col pennello e riprova.');
        return;
      }
      if (stileId === null || !stileBaseRef.current) {
        // prima applicazione: salvo la maschera piena come base rigenerabile
        const piena = masksRef.current.hair!;
        const copia = newMask(piena.width, piena.height);
        copia.getContext('2d')!.drawImage(piena, 0, 0);
        stileBaseRef.current = copia;
      }
      rigeneraSfumatura(stile.id, copertura);
      setStileId(stile.id); setTarget('hair');
      setStatus(`${stile.label} applicato — gradua la copertura, scegli il colore e l'intensità.`);
    } catch {
      setStatus('Non ho trovato i capelli: dipingi la zona col pennello e riprova.');
    } finally { setAiBusy(false); }
  };

  const cambiaCopertura = (v: number) => {
    setCopertura(v);
    if (stileId && stileId !== 'schiaritura') rigeneraSfumatura(stileId, v);
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
    resetStile();
    render();
    setStatus('Foto ruotata. Le selezioni sono state azzerate.');
  };

  const elimina = () => {
    decodeRef.current++;
    drawingRef.current = false; beforeRef.current = false; maskViewRef.current = false;
    baseRef.current = null; masksRef.current = {};
    resetStile();
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

        <div className="armo-panel pv-upload-box" hidden={caricata}>
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
          <div className="pv-demos">
            <span className="pv-label">OPPURE PROVA SUBITO CON UNA FOTO DEMO</span>
            <div className="pv-demo-row">
              {DEMO.map(d => (
                <button key={d.src} className="pv-demo" onClick={() => caricaDemo(d.src, d.nome)}>
                  <img src={d.src} alt={`Foto demo ${d.nome}`} loading="lazy" />
                  <span>{d.nome}<small>{d.nota}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pv-workspace" hidden={!caricata}>
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
                  onPointerLeave={nascondiCursore}
                  aria-label="Foto su cui dipingere la selezione" />
                <div ref={cursorRef} className="pv-brush-cursor" aria-hidden="true" />
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
                    <button className="armo-ai-btn" onClick={() => { masksRef.current[target] = newMask(baseRef.current!.width, baseRef.current!.height); if (target === 'hair') resetStile(); render(); setStatus('Selezione cancellata.'); }}>Pulisci zona</button>
                  </div>
                  <label className="pv-slider">Misura
                    <input type="range" min={10} max={140} value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
                  </label>
                </div>
                <div className="pv-group">
                  <span className="pv-label">STILI CAPELLI</span>
                  <div className="pv-row">
                    {STILI.map(s => (
                      <button key={s.id} className={`armo-ai-btn ${stileId === s.id ? 'on' : ''}`} disabled={aiBusy}
                        onClick={() => applicaStile(s)}>{s.label}</button>
                    ))}
                  </div>
                  {stileId && stileId !== 'schiaritura' && (
                    <label className="pv-slider">Copertura sfumatura {copertura}%
                      <input type="range" min={10} max={100} value={copertura}
                        onChange={e => cambiaCopertura(+e.target.value)} />
                    </label>
                  )}
                  <small className="pv-hint">
                    La sfumatura usa il colore che scegli sotto: gradua la copertura (quanta chioma si tinge),
                    il colore e l'intensità.
                  </small>
                </div>
                <div className="pv-group">
                  <span className="pv-label">COLORE — {colorName}</span>
                  <select className="pv-select" value={paletteGruppo} onChange={e => setPaletteGruppo(e.target.value)}
                    aria-label="Palette di colori">
                    <option value="tutti">Tutti i colori</option>
                    {STAGIONI.map(s => <option key={s.id} value={s.id}>Armocromia: {s.label}</option>)}
                  </select>
                  <div className="pv-swatches">
                    {(paletteGruppo === 'tutti' ? PALETTE : STAGIONI.find(s => s.id === paletteGruppo)!.colori)
                      .map(([nome, hex]) => (
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

                {/* AI generativa extra — tagli e capi boutique (foto inviata al servizio) */}
                {aiGenOn && (
                  <div className="pv-group pv-gen">
                    <span className="pv-label">✦ PROVA AI — TAGLI E CAPO BOUTIQUE</span>
                    <label className="pv-consent">
                      <input type="checkbox" checked={consensoAi} onChange={e => setConsensoAi(e.target.checked)} />
                      <span>Acconsento: per queste prove la foto viene inviata una volta al servizio AI configurato e non viene salvata.</span>
                    </label>
                    <div className="pv-row">
                      {TAGLI.map(t => (
                        <button key={t.nome} className="armo-ai-btn" disabled={!consensoAi || aiGenBusy}
                          onClick={() => provaGen(t.prompt)}>{t.nome}</button>
                      ))}
                    </div>
                    {!!prodotti.length && (
                      <div className="pv-row pv-shop-row">
                        <select className="pv-select" value={capo} onChange={e => setCapo(e.target.value)}
                          aria-label="Capo della boutique da indossare">
                          <option value="">Scegli un capo della boutique…</option>
                          {prodotti.map(p => <option key={p._id} value={p._id}>{p.nome}</option>)}
                        </select>
                        <button className="armo-ai-btn" disabled={!consensoAi || aiGenBusy || !capo}
                          onClick={indossaCapo}>Indossalo</button>
                      </div>
                    )}
                    {aiGenBusy && <small className="pv-hint">Elaborazione in corso…</small>}
                  </div>
                )}
              </div>
            </div>
          </div>

        <input ref={uploadRef} type="file" accept="image/*" hidden
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
