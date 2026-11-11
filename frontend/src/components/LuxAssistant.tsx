import { useEffect, useRef, useState } from 'react';
import api from '../api';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTED = [
  'Come inserisco un nuovo appuntamento?',
  'Dove vedo le vendite di oggi?',
  'Scrivimi un messaggio promozionale per le clienti',
  'Come aggiungo un prodotto in boutique?',
];

export default function LuxAssistant() {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.get('/lux/status').then(r => setOn(!!r.data?.attiva)).catch(() => setOn(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [msgs, open]);

  if (!on) return null;

  const send = async (t?: string) => {
    const q = (t ?? text).trim();
    if (!q || busy) return;
    setText('');
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const r = await api.post('/lux/chat', { messages: next });
      setMsgs([...next, { role: 'assistant', content: r.data?.text || '…' }]);
    } catch (e: any) {
      setMsgs([...next, { role: 'assistant', content: e?.response?.data?.message || 'Il servizio AI non risponde, riprova tra poco.' }]);
    }
    setBusy(false);
  };

  return (
    <>
      <button className="lux-fab" onClick={() => setOpen(o => !o)} aria-label="Apri assistente LUX" aria-expanded={open}>
        ✦ LUX
      </button>
      {open && (
        <div className="lux-panel" role="dialog" aria-label="Assistente LUX">
          <div className="lux-head">
            <div><b>LUX</b><small>Assistente del gestionale</small></div>
            <button onClick={() => setOpen(false)} aria-label="Chiudi assistente">✕</button>
          </div>
          <div className="lux-msgs" ref={scrollRef}>
            {!msgs.length && (
              <div className="lux-welcome">
                <p>Ciao, sono <b>LUX</b> ✦ Chiedimi aiuto sul gestionale: agenda, listino, cassa, boutique, o bozze di messaggi per le clienti.</p>
                {SUGGESTED.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`lux-msg ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="lux-msg assistant lux-busy">LUX sta scrivendo…</div>}
          </div>
          <form className="lux-form" onSubmit={e => { e.preventDefault(); send(); }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi qui la tua domanda…" maxLength={500} />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Invia">➤</button>
          </form>
        </div>
      )}
    </>
  );
}
