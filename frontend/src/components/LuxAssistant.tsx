import { useEffect, useRef, useState } from 'react';
import api from '../api';

type Msg = { role: 'user' | 'assistant'; content: string; photo?: string };

const SUGGESTED_STAFF = [
  'Come inserisco un nuovo appuntamento?',
  'Dove vedo le vendite di oggi?',
  'Scrivimi un messaggio promozionale per le clienti',
  'Come aggiungo un prodotto in boutique?',
];

const SUGGESTED_PUB = [
  'Quali servizi fate?',
  'Vorrei prenotare un appuntamento',
  'Consigli per il mio look 📷',
  'Che prodotti vendete in boutique?',
];

declare global {
  interface Window { LUX?: any; LUXPhoto?: any; }
}

function loadScript(src: string, module = false) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement('script');
  s.src = src;
  if (module) s.type = 'module';
  document.body.appendChild(s);
}

export default function LuxAssistant({ pubblica = false }: { pubblica?: boolean }) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(() => {
    try { return localStorage.getItem('lux-voice') !== '0'; } catch { return true; }
  });
  const [listening, setListening] = useState(false);
  const [micConsent, setMicConsent] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceRef = useRef(voice);
  const sendRef = useRef<(t?: string) => void>(() => {});

  const endpoint = pubblica ? '/lux/public-chat' : '/lux/chat';
  const suggested = pubblica ? SUGGESTED_PUB : SUGGESTED_STAFF;

  useEffect(() => {
    api.get('/lux/status').then(r => setOn(!!r.data?.attiva)).catch(() => setOn(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [msgs, open]);

  const setState = (t: string) => {
    const el = document.getElementById('luxState');
    if (el) el.innerHTML = `<span class="online-dot"></span> ${t}`;
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.body.classList.remove('speaking');
    setState(pubblica ? 'La tua beauty concierge' : 'Assistente del gestionale');
  };

  const speak = (t: string) => {
    if (!voiceRef.current || !('speechSynthesis' in window) || listening) return;
    stopSpeech();
    const u = new SpeechSynthesisUtterance(t.replace(/✦/g, '').slice(0, 600));
    u.lang = 'it-IT';
    const v = speechSynthesis.getVoices().filter(x => x.lang.startsWith('it'));
    if (v.length) u.voice = v.find(x => /elsa|alice|federica|female/i.test(x.name)) || v[0];
    u.rate = .96; u.pitch = 1.05;
    u.onstart = () => { document.body.classList.add('speaking'); setState('Ti sto parlando…'); };
    u.onend = u.onerror = () => { document.body.classList.remove('speaking'); setState(pubblica ? 'La tua beauty concierge' : 'Assistente del gestionale'); };
    speechSynthesis.speak(u);
  };

  const openPhoto = () => {
    if (window.LUXPhoto) window.LUXPhoto.open();
    else setMsgs(m => [...m, { role: 'assistant', content: 'Il percorso foto non è ancora pronto, ricarica la pagina e riprova.' }]);
  };

  const send = async (t?: string) => {
    const q = (t ?? text).trim();
    if (!q || busy) return;
    // Richiesta look/foto → si apre il percorso foto (come nella demo)
    if (pubblica && /foto|selfie|look/i.test(q) && !/senza foto|dimmi|racconta|spiega/i.test(q)) { setText(''); openPhoto(); return; }
    stopSpeech();
    setText('');
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const r = await api.post(endpoint, { messages: next.map(m => ({ role: m.role, content: m.content })) });
      const reply = r.data?.text || '…';
      setMsgs([...next, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch (e: any) {
      setMsgs([...next, { role: 'assistant', content: e?.response?.data?.message || 'Il servizio non risponde, riprova tra poco.' }]);
    }
    setBusy(false);
  };
  sendRef.current = send;

  const startMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVStatus('Il microfono vocale non è supportato qui. Scrivi la tua domanda.'); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    stopSpeech();
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = 'it-IT'; rec.continuous = false; rec.interimResults = false;
    rec.onstart = () => { setListening(true); document.body.classList.add('listening'); setVStatus('Ti ascolto… premi il microfono per fermare.'); setState('Ti ascolto…'); };
    rec.onresult = (e: any) => { setListening(false); sendRef.current(e.results[0][0].transcript); };
    rec.onerror = (e: any) => setVStatus(e.error === 'not-allowed' ? 'Microfono non autorizzato. Puoi continuare scrivendo.' : e.error === 'no-speech' ? 'Non ho sentito parole. Riprova o scrivi.' : 'Riconoscimento vocale non disponibile. Puoi usare la chat.');
    rec.onend = () => { setListening(false); document.body.classList.remove('listening'); setState(pubblica ? 'La tua beauty concierge' : 'Assistente del gestionale'); };
    try { rec.start(); } catch { setVStatus('Non riesco ad avviare il microfono. Prova a scrivere.'); }
  };

  const setVStatus = (t: string) => { const el = document.getElementById('voiceStatus'); if (el) el.textContent = t; };

  const micClick = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    if (!micConsent) { (document.getElementById('micDialog') as HTMLDialogElement)?.showModal(); return; }
    startMic();
  };

  const openChat = () => {
    setOpen(true);
    document.body.classList.add('lux-chat-open');
    document.getElementById('mascotOpen')?.setAttribute('aria-expanded', 'true');
    speak(pubblica ? 'Piacere, sono Lux, la tua beauty concierge. Dimmi pure.' : 'Ciao, sono Lux. Dimmi cosa ti serve nel gestionale.');
  };
  const closeChat = () => {
    setOpen(false);
    document.body.classList.remove('lux-chat-open');
    document.getElementById('mascotOpen')?.setAttribute('aria-expanded', 'false');
    stopSpeech();
    recognitionRef.current?.abort();
  };

  // Gestionale: mascotte 3D ferma in basso a destra (senza girovagare)
  useEffect(() => {
    if (pubblica || !on) return;
    loadScript('/lux/lux-3d.js', true);
  }, [on, pubblica]);

  // Gestionale: Esc o tocco fuori chiudono il pannello
  useEffect(() => {
    if (pubblica || !open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { setOpen(false); stopSpeech(); }
    };
    const outside = (e: Event) => {
      const t = e.target as HTMLElement;
      if (document.querySelector('dialog[open]')) return;
      if (!t.closest('.lux-panel') && !t.closest('#luxMascot')) { setOpen(false); stopSpeech(); }
    };
    document.addEventListener('keydown', h);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', h); document.removeEventListener('pointerdown', outside, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pubblica]);

  // Pubblico: bridge window.LUX + script mascotte/foto (caricati una sola volta)
  useEffect(() => {
    if (!pubblica || !on) return;
    window.LUX = {
      show: openChat,
      send: (t: string) => sendRef.current(t),
      addPhoto(url: string, info: any) {
        setMsgs(m => [...m.filter(x => !x.photo), { role: 'user', content: 'La mia foto per il percorso look', photo: url }]);
        openChat();
        const palette = (info?.palette || []).join(', ');
        sendRef.current(`Ho caricato una foto (resta sul mio dispositivo, colori prevalenti: ${palette || 'n.d.'}). Occasione: uso quotidiano. Suggeriscimi un look: capelli, abbinamento e colori che si armonizzano.`);
      },
      removePhoto() {
        setMsgs(m => m.filter(x => !x.photo));
      },
    };
    loadScript('/lux/lux-route.js');
    loadScript('/lux/lux-wander.js');
    loadScript('/lux/photo.js');
    loadScript('/lux/lux-3d.js', true);
    return () => {
      stopSpeech();
      recognitionRef.current?.abort();
      window.LUXPhoto?.stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, pubblica]);

  // Esc o tocco fuori chiudono la chat (pubblico)
  useEffect(() => {
    if (!pubblica || !open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeChat();
    };
    const outside = (e: Event) => {
      const t = e.target as HTMLElement;
      if (document.querySelector('dialog[open]')) return;
      if (!t.closest('#assistant') && !t.closest('#luxMascot')) closeChat();
    };
    document.addEventListener('keydown', h);
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('keydown', h); document.removeEventListener('pointerdown', outside, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pubblica]);

  if (!on) return null;

  const toggleVoice = () => {
    if (!('speechSynthesis' in window)) { setVStatus('La voce non è disponibile in questo browser.'); return; }
    const nv = !voice;
    setVoice(nv); voiceRef.current = nv;
    try { localStorage.setItem('lux-voice', nv ? '1' : '0'); } catch { /* noop */ }
    if (nv) { setVStatus('Voce attiva.'); speak(pubblica ? 'Piacere, sono Lux. Sono qui per accompagnarti nella tua esperienza Luxury.' : 'Ciao, sono LUX, la tua assistente del gestionale.'); }
    else { stopSpeech(); setVStatus('Voce sospesa.'); }
  };

  /* ── Variante gestionale: pannello chat staff ── */
  if (!pubblica) {
    return (
      <>
        <div id="luxMascot">
          <button id="mascotOpen" onClick={openChat} aria-label="Apri la chat con LUX" aria-expanded={open} title="Tocca LUX per parlare">
            <canvas id="lux3d" aria-hidden="true"></canvas>
            <span id="lux3dFallback" aria-hidden="true">✦</span>
          </button>
          <button id="luxGreeting" className="lux-greeting" type="button" hidden={open} onClick={openChat}>Sono LUX</button>
        </div>
        {open && (
          <div className="lux-panel" role="dialog" aria-label="Assistente LUX">
            <div className="lux-head">
              <div><b>LUX</b><small>Assistente del gestionale</small></div>
              <button className="icon-button" onClick={toggleVoice} aria-pressed={voice} aria-label="Attiva risposte vocali" title="Voce">♪</button>
              <button onClick={() => setOpen(false)} aria-label="Chiudi assistente">✕</button>
            </div>
            <div className="lux-msgs" ref={scrollRef}>
              {!msgs.length && (
                <div className="lux-welcome">
                  <p>Ciao, sono <b>LUX</b> ✦ Chiedimi aiuto sul gestionale: agenda, listino, cassa, boutique, o bozze di messaggi per le clienti.</p>
                  {suggested.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`lux-msg ${m.role === 'assistant' ? 'lux' : m.role}`}>{m.content}</div>
              ))}
              {busy && <div className="lux-msg lux lux-busy">LUX sta scrivendo…</div>}
            </div>
            <form className="lux-form" onSubmit={e => { e.preventDefault(); send(); }}>
              <button type="button" className="icon-button" onClick={micClick} aria-label="Parla con LUX">♩</button>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi qui la tua domanda…" maxLength={500} />
              <button type="submit" disabled={busy || !text.trim()} aria-label="Invia">➤</button>
            </form>
            <div className="voice-status" id="voiceStatus" aria-live="polite"></div>
          </div>
        )}
        <dialog id="micDialog" className="lux-dialog small-dialog">
          <button className="dialog-close" onClick={e => (e.target as HTMLElement).closest('dialog')?.close()} aria-label="Chiudi">×</button>
          <h2>Parliamone a voce.</h2>
          <p>Il microfono si attiva soltanto quando lo scegli tu. Il browser può inviare l'audio al proprio servizio di riconoscimento vocale. L'audio non viene registrato.</p>
          <button className="primary" onClick={() => { setMicConsent(true); (document.getElementById('micDialog') as HTMLDialogElement)?.close(); startMic(); }}>Attiva il microfono</button>
        </dialog>
      </>
    );
  }

  /* ── Variante pubblica: mascotte 3D + chat concierge completa ── */
  return (
    <>
      <div id="luxMascot">
        <button id="mascotOpen" onClick={openChat} aria-label="Apri la chat con LUX" aria-expanded="false" aria-controls="assistant" title="Tocca LUX per parlare">
          <canvas id="lux3d" aria-hidden="true"></canvas>
          <span id="lux3dFallback" aria-hidden="true">✦</span>
        </button>
        <button id="luxGreeting" className="lux-greeting" type="button" hidden={open} onClick={openChat}>Sono LUX</button>
      </div>

      <aside id="assistant" className="assistant" aria-label="Chat con LUX" hidden={!open}>
        <header className="chat-header">
          <div className="chat-mini-avatar"><span className="lux-mini-star" aria-hidden="true">✦</span></div>
          <div><h2>LUX <span>✦</span></h2><p id="luxState"><span className="online-dot"></span> La tua beauty concierge</p></div>
          <button id="voiceToggle" className="icon-button" onClick={toggleVoice} aria-pressed={voice} aria-label={voice ? 'Disattiva risposte vocali' : 'Attiva risposte vocali'} title="Attiva risposte vocali">♪</button>
          <button id="closeChat" className="icon-button" onClick={closeChat} aria-label="Chiudi assistente">×</button>
        </header>
        <div id="chatMessages" className="chat-messages lux-msgs" role="log" aria-live="polite" ref={scrollRef}>
          {!msgs.length && (
            <div className="lux-welcome">
              <p>Piacere, sono <b>LUX</b> ✦ la tua beauty concierge. Ti aiuto a scegliere un servizio, esplorare un look o prenotare il tuo momento Luxury.</p>
              <button className="lux-photo-cta" onClick={openPhoto}>📷 Il mio look da una foto — scatta o carica</button>
              {suggested.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`lux-msg ${m.role === 'assistant' ? 'lux' : m.role}`}>
              {m.photo && <img className="lux-msg-photo" src={m.photo} alt="La tua foto per i consigli di look" />}
              {m.content.replace(/\*\*/g, '')}
            </div>
          ))}
          {busy && <div className="lux-msg lux lux-busy">LUX sta scrivendo…</div>}
        </div>
        <form id="chatForm" className="lux-form" onSubmit={e => { e.preventDefault(); send(); }}>
          <button type="button" id="photoButton" className="icon-button" aria-label="Carica o scatta una foto" onClick={() => window.LUXPhoto?.open()}>＋</button>
          <input id="chatInput" value={text} onChange={e => setText(e.target.value)} maxLength={500} autoComplete="off" placeholder="Scrivi o parla con LUX…" />
          <button type="button" id="micButton" className="icon-button" onClick={micClick} aria-label="Parla con LUX al microfono">♩</button>
          <button className="send-button" aria-label="Invia messaggio" disabled={busy || !text.trim()}>↑</button>
        </form>
        <div className="voice-status" id="voiceStatus" aria-live="polite"></div>
        <button type="button" id="motionToggle" className="movement-toggle" aria-pressed="false">Ferma gli spostamenti di LUX</button>
      </aside>

      <dialog id="photoDialog" className="lux-dialog photo-dialog">
        <div className="dialog-top">
          <div><p className="eyebrow">LUX · IL TUO STILE</p><h2>Partiamo da te.</h2></div>
          <button className="dialog-close" onClick={e => (e.target as HTMLElement).closest('dialog')?.close()} aria-label="Chiudi foto">×</button>
        </div>
        <p>Una foto, un'occasione, nuove idee per il tuo look.</p>
        <div className="photo-stage">
          <div id="photoEmpty"><span>✦</span><p>La tua ispirazione<br />comincia qui.</p></div>
          <video id="camera" playsInline muted hidden></video>
          <img id="photoPreview" alt="La tua foto per il percorso look" hidden />
        </div>
        <div className="photo-controls">
          <button id="startCamera" className="primary">Apri fotocamera</button>
          <label className="outline upload-label">Carica una foto<input id="photoUpload" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <button id="takePhoto" className="primary" hidden>Scatta la foto</button>
          <button id="usePhoto" className="primary" hidden>Trova il mio look →</button>
          <button id="deletePhoto" className="text-button" hidden>Elimina foto</button>
        </div>
        <p id="cameraStatus" role="status"></p>
        <div className="photo-palette" id="photoPalette"></div>
        <p className="privacy-note">La foto resta nel browser: ne estraiamo solo i colori prevalenti per i consigli di LUX. Non viene pubblicata né conservata.</p>
      </dialog>

      <dialog id="micDialog" className="lux-dialog small-dialog">
        <button className="dialog-close" onClick={e => (e.target as HTMLElement).closest('dialog')?.close()} aria-label="Chiudi informazioni microfono">×</button>
        <h2>Parliamone a voce.</h2>
        <p>Il microfono si attiva soltanto quando lo scegli tu. Il browser può inviare l'audio al proprio servizio di riconoscimento vocale.</p>
        <p>Puoi sempre scrivere nella chat. L'audio non viene registrato dal sito.</p>
        <button id="allowMic" className="primary" onClick={() => { setMicConsent(true); (document.getElementById('micDialog') as HTMLDialogElement)?.close(); startMic(); }}>Attiva il microfono</button>
      </dialog>
    </>
  );
}
