import { useEffect, useState } from 'react';
import api from '../api';

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function PrenotaPage() {
  const [step, setStep] = useState(1);
  const [servizi, setServizi] = useState<any[]>([]);
  const [servizio, setServizio] = useState<any | null>(null);
  const [data, setData] = useState(dstr(new Date(Date.now() + 86400000)));
  const [slots, setSlots] = useState<{ ora: string; libera: boolean }[]>([]);
  const [chiuso, setChiuso] = useState(false);
  const [ora, setOra] = useState('');
  const [dati, setDati] = useState({ firstName: '', lastName: '', email: '', phone: '', note: '', consensoPrivacy: false });
  const [esito, setEsito] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Accesso cartella via email
  const [accessoEmail, setAccessoEmail] = useState('');
  const [accessoMsg, setAccessoMsg] = useState('');
  const [accessoLink, setAccessoLink] = useState('');

  useEffect(() => { api.get('/public/services').then(r => setServizi(r.data || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!servizio) return;
    setSlots([]); setOra('');
    api.get('/public/slots', { params: { serviceId: servizio._id, data } })
      .then(r => { setSlots(r.data.slots || []); setChiuso(!!r.data.chiuso); })
      .catch(() => setSlots([]));
  }, [servizio, data]);

  const prenota = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/public/prenota', { serviceId: servizio._id, data, ora, ...dati });
      setEsito(res.data); setStep(4);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Prenotazione non riuscita, riprova');
    } finally { setBusy(false); }
  };

  const richiediAccesso = async () => {
    setAccessoMsg(''); setAccessoLink('');
    try {
      const res = await api.post('/public/accesso-cartella', { email: accessoEmail });
      setAccessoMsg(res.data.message);
      if (res.data.linkCollaudo) setAccessoLink(res.data.linkCollaudo);
    } catch { setAccessoMsg('Servizio momentaneamente non disponibile.'); }
  };

  const STEPS = ['Servizio', 'Data e ora', 'I tuoi dati', 'Conferma'];

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="logo">LUXURY HAIR EXPERIENCE</div>
        <a href="/gestionale/login" style={{ fontSize: 11, color: '#a8c7b8' }}>Area riservata</a>
      </header>

      <div className="site-hero">
        <h1>Prenota il tuo appuntamento</h1>
        <p>Scegli il servizio, il giorno e l'orario: la prenotazione entra direttamente nell'agenda del salone. Con la tua email accedi anche alla tua cartella personale.</p>
        <div className="step-pills">
          {STEPS.map((s, i) => <span key={s} className={`pill ${step > i + 1 || step === i + 1 ? 'done' : ''}`}>{i + 1} · {s}</span>)}
        </div>
      </div>

      <div className="site-wrap" style={{ maxWidth: 860 }}>
        {step === 1 && (
          <div className="fade-in">
            <div className="servizi-grid">
              {servizi.map(s => (
                <div key={s._id} className={`servizio-card ${servizio?._id === s._id ? 'sel' : ''}`}
                  onClick={() => { setServizio(s); setStep(2); }}>
                  <small>{s.categoria}</small>
                  <strong>{s.nome}</strong>
                  {s.descrizione && <p className="small" style={{ margin: '6px 0 0' }}>{s.descrizione}</p>}
                  <div className="prezzo">€ {Number(s.prezzo).toFixed(2)} <small style={{ fontWeight: 400, color: 'var(--muted)' }}>· {s.durataMinuti} min</small></div>
                </div>
              ))}
              {servizi.length === 0 && <div className="empty"><b>Listino in preparazione</b>Torna presto a trovarci.</div>}
            </div>
          </div>
        )}

        {step === 2 && servizio && (
          <div className="mPanel fade-in">
            <h3>{servizio.nome} · {servizio.durataMinuti} minuti · € {Number(servizio.prezzo).toFixed(2)}</h3>
            <div className="formgrid" style={{ gridTemplateColumns: '220px 1fr' }}>
              <div className="field"><span>Giorno</span>
                <input type="date" min={dstr(new Date())} value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div className="field"><span>Orario disponibile</span>
                {chiuso && <div className="empty"><b>Salone chiuso in questo giorno</b>Scegli un'altra data.</div>}
                {!chiuso && (
                  <div className="slot-grid">
                    {slots.map(s => (
                      <button key={s.ora} className={`slot ${ora === s.ora ? 'sel' : ''}`} disabled={!s.libera} onClick={() => setOra(s.ora)}>{s.ora}</button>
                    ))}
                    {slots.length === 0 && <div className="empty"><b>Nessuna fascia libera</b>Prova un altro giorno.</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="row mt">
              <button className="btn alt" onClick={() => setStep(1)}>← Indietro</button>
              <button className="btn" disabled={!ora} onClick={() => setStep(3)}>Continua →</button>
            </div>
          </div>
        )}

        {step === 3 && servizio && (
          <div className="mPanel fade-in">
            <h3>{servizio.nome} — {new Date(`${data}T12:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {ora}</h3>
            {err && <div className="err mb">{err}</div>}
            <div className="formgrid">
              <div className="field"><span>Nome *</span><input value={dati.firstName} onChange={e => setDati({ ...dati, firstName: e.target.value })} /></div>
              <div className="field"><span>Cognome</span><input value={dati.lastName} onChange={e => setDati({ ...dati, lastName: e.target.value })} /></div>
              <div className="field"><span>Email * (per conferma e accesso alla tua cartella)</span><input type="email" value={dati.email} onChange={e => setDati({ ...dati, email: e.target.value })} /></div>
              <div className="field"><span>Telefono</span><input value={dati.phone} onChange={e => setDati({ ...dati, phone: e.target.value })} /></div>
              <div className="field wide"><span>Note per il salone</span><input value={dati.note} onChange={e => setDati({ ...dati, note: e.target.value })} placeholder="Allergie, preferenze, richieste particolari…" /></div>
              <div className="field wide">
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                  <input type="checkbox" checked={dati.consensoPrivacy} onChange={e => setDati({ ...dati, consensoPrivacy: e.target.checked })} />
                  Acconsento al trattamento dei miei dati per la gestione della prenotazione e della mia cartella cliente.
                </label>
              </div>
            </div>
            <div className="row mt">
              <button className="btn alt" onClick={() => setStep(2)}>← Indietro</button>
              <button className="btn" disabled={busy || !dati.firstName || !dati.email || !dati.consensoPrivacy} onClick={prenota}>
                {busy ? 'Registrazione…' : 'Conferma prenotazione'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && esito && (
          <div className="confirm-box fade-in">
            <h2>✅ Prenotazione registrata</h2>
            <p><strong>{esito.prenotazione.servizio}</strong><br />
              {new Date(esito.prenotazione.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {new Date(esito.prenotazione.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="small">Il salone confermerà l'appuntamento. Con questo link accedi alla tua cartella e puoi seguire o annullare la prenotazione:</p>
            <a className="btn" href={esito.linkCartella} style={{ display: 'inline-block', marginTop: 8 }}>Apri la mia cartella →</a>
          </div>
        )}

        <div className="mPanel">
          <h3>Hai già una cartella? Entra con la tua email</h3>
          <div className="row">
            <input type="email" placeholder="la-tua@email.it" value={accessoEmail} onChange={e => setAccessoEmail(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '10px 12px', flex: 1, minWidth: 220 }} />
            <button className="btn" onClick={richiediAccesso} disabled={!accessoEmail}>Inviami il link di accesso</button>
          </div>
          {accessoMsg && <p className="small mt">{accessoMsg}</p>}
          {accessoLink && <p className="small"><a href={accessoLink} style={{ color: 'var(--forest)', fontWeight: 700 }}>→ Apri la cartella (link di collaudo)</a></p>}
        </div>
      </div>
    </div>
  );
}
