import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const TAG: Record<string, { t: string; c: string }> = {
  prenotato: { t: 'Da confermare', c: 'wait' },
  confermato: { t: 'Confermato', c: '' },
  completato: { t: 'Completato', c: '' },
  annullato: { t: 'Annullato', c: 'off' },
  no_show: { t: 'No show', c: 'off' },
};

export default function Agenda() {
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; });
  const [appuntamenti, setAppuntamenti] = useState<any[]>([]);
  const [servizi, setServizi] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [form, setForm] = useState(false);
  const [nuovo, setNuovo] = useState({ clientId: '', serviceId: '', data: dstr(new Date()), ora: '', operatore: '', note: '' });
  const [cercaCli, setCercaCli] = useState('');
  const [err, setErr] = useState('');

  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const from = dstr(giorni[0]), to = dstr(giorni[6]);

  const carica = () => {
    api.get('/appointments', { params: { from, to } }).then(r => setAppuntamenti(r.data || [])).catch(() => {});
  };
  useEffect(carica, [from, to]);
  useEffect(() => {
    api.get('/services/all').then(r => setServizi(r.data || [])).catch(() => {});
    api.get('/clients').then(r => setClienti(r.data || [])).catch(() => {});
  }, []);

  const sposta = (n: number) => { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d); };
  const delGiorno = (g: Date) => appuntamenti.filter(a => dstr(new Date(a.data)) === dstr(g));
  const clientiFiltrati = clienti.filter(c =>
    !cercaCli || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(cercaCli.toLowerCase()));

  const crea = async () => {
    setErr('');
    try {
      await api.post('/appointments', nuovo);
      setForm(false); setNuovo({ ...nuovo, ora: '', note: '' }); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore creazione'); }
  };

  const setStato = async (a: any, stato: string) => {
    try { await api.patch(`/appointments/${a._id}/stato`, { stato }); setSel(null); carica(); } catch { /* noop */ }
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <div className="row">
          <button className="btn alt sm" onClick={() => sposta(-1)}>‹</button>
          <strong>{giorni[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} — {giorni[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</strong>
          <button className="btn alt sm" onClick={() => sposta(1)}>›</button>
          <button className="btn alt sm" onClick={() => setWeekStart(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })}>Oggi</button>
        </div>
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Nuovo appuntamento</button>
      </div>

      {form && (
        <div className="mPanel">
          <h3>Nuovo appuntamento</h3>
          {err && <div className="err mb">{err}</div>}
          <div className="formgrid">
            <div className="field wide">
              <span>Cliente (cerca nella cartella)</span>
              <input placeholder="Cerca nome o email…" value={cercaCli} onChange={e => setCercaCli(e.target.value)} />
              <select required value={nuovo.clientId} onChange={e => setNuovo({ ...nuovo, clientId: e.target.value })} size={4} style={{ height: 'auto' }}>
                {clientiFiltrati.slice(0, 30).map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} — {c.email}</option>)}
              </select>
              {clientiFiltrati.length === 0 && <small>Crea prima la cartella in Clienti.</small>}
            </div>
            <div className="field"><span>Servizio</span>
              <select value={nuovo.serviceId} onChange={e => setNuovo({ ...nuovo, serviceId: e.target.value })}>
                <option value="">— scegli —</option>
                {servizi.filter(s => s.attivo).map(s => <option key={s._id} value={s._id}>{s.nome} ({s.durataMinuti}′)</option>)}
              </select>
            </div>
            <div className="field"><span>Operatore / sedia</span>
              <input value={nuovo.operatore} onChange={e => setNuovo({ ...nuovo, operatore: e.target.value })} placeholder="es. Anna, Poltrona 1" />
            </div>
            <div className="field"><span>Data</span>
              <input type="date" value={nuovo.data} onChange={e => setNuovo({ ...nuovo, data: e.target.value })} />
            </div>
            <div className="field"><span>Ora inizio</span>
              <input type="time" value={nuovo.ora} onChange={e => setNuovo({ ...nuovo, ora: e.target.value })} />
            </div>
            <div className="field wide"><span>Note</span>
              <input value={nuovo.note} onChange={e => setNuovo({ ...nuovo, note: e.target.value })} />
            </div>
          </div>
          <div className="mt"><button className="btn" onClick={crea} disabled={!nuovo.clientId || !nuovo.serviceId || !nuovo.data || !nuovo.ora}>Registra in agenda</button></div>
        </div>
      )}

      <div className="cal-week">
        {giorni.map(g => (
          <div key={dstr(g)} className={`cal-day ${dstr(g) === dstr(new Date()) ? 'oggi' : ''}`}>
            <div className="giorno">{g.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
            <div className="numero">{g.getDate()}</div>
            {delGiorno(g).map(a => (
              <div key={a._id} className={`appt ${TAG[a.stato]?.c || ''}`} onClick={() => setSel(a)}>
                <b>{fmtOra(a.data)} {a.client?.firstName}</b>
                {a.service?.nome}
              </div>
            ))}
          </div>
        ))}
      </div>

      {sel && (
        <div className="mPanel">
          <div className="row between">
            <h3>{fmtOra(sel.data)} · {sel.client?.firstName} {sel.client?.lastName}</h3>
            <button className="btn alt sm" onClick={() => setSel(null)}>✕ Chiudi</button>
          </div>
          <p className="small">
            {sel.service?.nome} · {sel.service?.durataMinuti}′ · € {Number(sel.prezzo ?? sel.service?.prezzo).toFixed(2)}
            {sel.operatore && <> · {sel.operatore}</>} · origine {sel.origine}
            {sel.note && <><br />Note: {sel.note}</>}
          </p>
          <div className="row">
            <span className={`tag ${TAG[sel.stato]?.c || ''}`}>{TAG[sel.stato]?.t || sel.stato}</span>
            {sel.stato === 'prenotato' && <button className="btn sm" onClick={() => setStato(sel, 'confermato')}>Conferma</button>}
            {(sel.stato === 'prenotato' || sel.stato === 'confermato') && <>
              <button className="btn alt sm" onClick={() => setStato(sel, 'completato')}>Completato</button>
              <button className="btn alt sm" onClick={() => setStato(sel, 'no_show')}>No show</button>
              <button className="btn danger sm" onClick={() => setStato(sel, 'annullato')}>Annulla</button>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
