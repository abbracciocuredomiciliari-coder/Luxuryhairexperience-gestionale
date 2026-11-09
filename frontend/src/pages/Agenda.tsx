import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const REPARTI = ['parrucchiere', 'estetica', 'unghie', 'altro'];
const TAG: Record<string, { t: string; c: string }> = {
  prenotato: { t: 'Da confermare', c: 'wait' },
  confermato: { t: 'Confermato', c: '' },
  completato: { t: 'Completato', c: 'done' },
  annullato: { t: 'Annullato', c: 'off' },
  no_show: { t: 'No show', c: 'off' },
};

export default function Agenda() {
  const [vista, setVista] = useState<'giorno' | 'settimana'>('giorno');
  const [giorno, setGiorno] = useState(dstr(new Date()));
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; });
  const [fReparto, setFReparto] = useState('');
  const [fOperatore, setFOperatore] = useState('');

  const [appuntamenti, setAppuntamenti] = useState<any[]>([]);
  const [operatori, setOperatori] = useState<any[]>([]);
  const [servizi, setServizi] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [form, setForm] = useState(false);
  const [nuovo, setNuovo] = useState({ clientId: '', serviceId: '', operatorId: '', data: dstr(new Date()), ora: '', note: '' });
  const [cercaCli, setCercaCli] = useState('');
  const [slots, setSlots] = useState<{ ora: string; libera: boolean }[]>([]);
  const [err, setErr] = useState('');

  const giorni = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const from = vista === 'giorno' ? giorno : dstr(giorni[0]);
  const to = vista === 'giorno' ? giorno : dstr(giorni[6]);

  const carica = () => {
    const params: any = { from, to };
    if (fReparto) params.reparto = fReparto;
    if (fOperatore) params.operatore = fOperatore;
    api.get('/appointments', { params }).then(r => setAppuntamenti(r.data || [])).catch(() => {});
  };
  useEffect(carica, [from, to, fReparto, fOperatore]);
  useEffect(() => {
    api.get('/operators/all').then(r => setOperatori(r.data || [])).catch(() => {});
    api.get('/services/all').then(r => setServizi(r.data || [])).catch(() => {});
    api.get('/clients').then(r => setClienti(r.data || [])).catch(() => {});
  }, []);

  // Disponibilità operatore nel form
  useEffect(() => {
    setSlots([]);
    if (!nuovo.serviceId || !nuovo.data || !nuovo.operatorId) return;
    api.get('/public/slots', { params: { serviceId: nuovo.serviceId, data: nuovo.data, operatorId: nuovo.operatorId } })
      .then(r => setSlots(r.data.slots || [])).catch(() => {});
  }, [nuovo.serviceId, nuovo.data, nuovo.operatorId]);

  const servizioScelto = servizi.find(s => s._id === nuovo.serviceId);
  const opsReparto = operatori.filter(o => o.attivo && (!servizioScelto || o.reparti?.includes(servizioScelto.reparto)));
  const clientiFiltrati = clienti.filter(c => !cercaCli || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(cercaCli.toLowerCase()));
  const delGiorno = (g: Date | string) => appuntamenti.filter(a => dstr(new Date(a.data)) === (typeof g === 'string' ? g : dstr(g)));

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
  const sposta = (n: number) => {
    if (vista === 'giorno') { const d = new Date(giorno + 'T12:00:00'); d.setDate(d.getDate() + n); setGiorno(dstr(d)); }
    else { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d); }
  };

  const opsVista = operatori.filter(o => o.attivo && (!fReparto || o.reparti?.includes(fReparto)) && (!fOperatore || o._id === fOperatore));
  const senzaOp = delGiorno(giorno).filter(a => !a.operator);

  return (
    <div className="fade-in">
      <div className="row between mb wrap">
        <div className="row wrap">
          <div className="seg">
            <button className={vista === 'giorno' ? 'on' : ''} onClick={() => setVista('giorno')}>Giorno</button>
            <button className={vista === 'settimana' ? 'on' : ''} onClick={() => setVista('settimana')}>Settimana</button>
          </div>
          <button className="btn alt sm" onClick={() => sposta(-1)}>‹</button>
          <strong>
            {vista === 'giorno'
              ? new Date(giorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
              : `${giorni[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} — ${giorni[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`}
          </strong>
          <button className="btn alt sm" onClick={() => sposta(1)}>›</button>
          {vista === 'giorno' && <input type="date" value={giorno} onChange={e => setGiorno(e.target.value)} className="datepick" />}
        </div>
        <div className="row wrap">
          <select value={fReparto} onChange={e => { setFReparto(e.target.value); setFOperatore(''); }}>
            <option value="">Tutti i reparti</option>
            {REPARTI.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fOperatore} onChange={e => setFOperatore(e.target.value)}>
            <option value="">Tutti gli operatori</option>
            {operatori.filter(o => o.attivo && (!fReparto || o.reparti?.includes(fReparto))).map(o => <option key={o._id} value={o._id}>{o.nome}</option>)}
          </select>
          <button className="btn" onClick={() => setForm(v => !v)}>＋ Appuntamento</button>
        </div>
      </div>

      {form && (
        <div className="mPanel">
          <h3>Nuovo appuntamento</h3>
          {err && <div className="err mb">{err}</div>}
          <div className="formgrid">
            <div className="field wide">
              <span>Cliente</span>
              <input placeholder="Cerca nome o email…" value={cercaCli} onChange={e => setCercaCli(e.target.value)} />
              <select required value={nuovo.clientId} onChange={e => setNuovo({ ...nuovo, clientId: e.target.value })} size={4} style={{ height: 'auto' }}>
                {clientiFiltrati.slice(0, 30).map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} — {c.email}</option>)}
              </select>
            </div>
            <div className="field"><span>Servizio</span>
              <select value={nuovo.serviceId} onChange={e => setNuovo({ ...nuovo, serviceId: e.target.value, operatorId: '', ora: '' })}>
                <option value="">— scegli —</option>
                {servizi.filter(s => s.attivo).map(s => <option key={s._id} value={s._id}>{s.nome} ({s.reparto} · {s.durataMinuti}′)</option>)}
              </select>
            </div>
            <div className="field"><span>Operatore</span>
              <select value={nuovo.operatorId} onChange={e => setNuovo({ ...nuovo, operatorId: e.target.value, ora: '' })}>
                <option value="">— da assegnare —</option>
                {opsReparto.map(o => <option key={o._id} value={o._id}>{o.nome}</option>)}
              </select>
            </div>
            <div className="field"><span>Data</span>
              <input type="date" value={nuovo.data} onChange={e => setNuovo({ ...nuovo, data: e.target.value, ora: '' })} />
            </div>
            <div className="field"><span>Ora inizio</span>
              <input type="time" value={nuovo.ora} onChange={e => setNuovo({ ...nuovo, ora: e.target.value })} list="slot-op" />
            </div>
            <div className="field wide"><span>Note</span>
              <input value={nuovo.note} onChange={e => setNuovo({ ...nuovo, note: e.target.value })} />
            </div>
          </div>
          {slots.length > 0 && (
            <div className="slotrow mt">
              {slots.map(s => (
                <button key={s.ora} disabled={!s.libera} className={`slotchip ${nuovo.ora === s.ora ? 'on' : ''} ${s.libera ? '' : 'off'}`}
                  onClick={() => setNuovo({ ...nuovo, ora: s.ora })}>{s.ora}</button>
              ))}
            </div>
          )}
          <div className="mt"><button className="btn" onClick={crea} disabled={!nuovo.clientId || !nuovo.serviceId || !nuovo.data || !nuovo.ora}>Registra in agenda</button></div>
        </div>
      )}

      {/* Vista GIORNO: una colonna per operatore */}
      {vista === 'giorno' && (
        <div className="cal-ops">
          {opsVista.map(o => (
            <div key={o._id} className="cal-ocol">
              <div className="opname">{o.nome}<small>{(o.reparti || []).join(' · ')}</small></div>
              {delGiorno(giorno).filter(a => a.operator?._id === o._id || a.operator === o._id).map(a => (
                <div key={a._id} className={`appt ${TAG[a.stato]?.c || ''}`} onClick={() => setSel(a)}>
                  <b>{fmtOra(a.data)}–{fmtOra(a.fine)}</b>
                  {a.client?.firstName} {a.client?.lastName}
                  <small>{a.service?.nome}</small>
                </div>
              ))}
            </div>
          ))}
          <div className="cal-ocol">
            <div className="opname">Da assegnare<small>senza operatore</small></div>
            {senzaOp.map(a => (
              <div key={a._id} className={`appt ${TAG[a.stato]?.c || ''}`} onClick={() => setSel(a)}>
                <b>{fmtOra(a.data)}</b>
                {a.client?.firstName} {a.client?.lastName}
                <small>{a.service?.nome}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista SETTIMANA */}
      {vista === 'settimana' && (
        <div className="cal-week">
          {giorni.map(g => (
            <div key={dstr(g)} className={`cal-day ${dstr(g) === dstr(new Date()) ? 'oggi' : ''}`}>
              <div className="giorno">{g.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
              <div className="numero">{g.getDate()}</div>
              {delGiorno(g).map(a => (
                <div key={a._id} className={`appt ${TAG[a.stato]?.c || ''}`} onClick={() => setSel(a)}>
                  <b>{fmtOra(a.data)} {a.operator?.nome || '?'}</b>
                  {a.client?.firstName}
                  <small>{a.service?.nome}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {sel && (
        <div className="mPanel">
          <div className="row between">
            <h3>{fmtOra(sel.data)} · {sel.client?.firstName} {sel.client?.lastName}</h3>
            <button className="btn alt sm" onClick={() => setSel(null)}>✕ Chiudi</button>
          </div>
          <p className="small">
            {sel.service?.nome} · {fmtOra(sel.data)}–{fmtOra(sel.fine)} · € {Number(sel.prezzo ?? sel.service?.prezzo).toFixed(2)}
            <br />Operatore: {sel.operator?.nome || 'da assegnare'} · reparto {sel.reparto} · origine {sel.origine}
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
