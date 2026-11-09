import { useEffect, useState } from 'react';
import api from '../api';

const REPARTI = ['parrucchiere', 'estetica', 'unghie', 'altro'];
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export default function Operatori() {
  const [operatori, setOperatori] = useState<any[]>([]);
  const [daAssegnare, setDaAssegnare] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [nuovo, setNuovo] = useState({ nome: '', reparti: [] as string[] });
  const [ferie, setFerie] = useState('');
  const [err, setErr] = useState('');

  const carica = () => {
    api.get('/operators/all').then(r => setOperatori(r.data || []));
    api.get('/operators/da-assegnare').then(r => setDaAssegnare(r.data || []));
  };
  useEffect(() => { carica(); }, []);

  const crea = async () => {
    setErr('');
    try {
      await api.post('/operators', nuovo);
      setNuovo({ nome: '', reparti: [] }); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  const salva = async (o: any) => {
    await api.put(`/operators/${o._id}`, o); setEdit(null); carica();
  };
  const toggleAttivo = async (o: any) => {
    await api.put(`/operators/${o._id}`, { attivo: !o.attivo }); carica();
  };
  const addFerie = async (o: any) => {
    if (!ferie) return;
    await api.post(`/operators/${o._id}/assenze`, { giorni: [ferie] });
    setFerie(''); carica();
  };
  const delFerie = async (o: any, g: string) => {
    await api.post(`/operators/${o._id}/assenze`, { giorni: [g], rimuovi: true });
    carica();
  };
  const assegna = async (appId: string, operatorId: string) => {
    try { await api.patch(`/appointments/${appId}`, { operatorId }); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore assegnazione'); }
  };

  const setTurno = (o: any, i: number, campo: string, val: any) => {
    const turni = [...(o.turni || Array(7).fill({ attivo: false, inizio: '09:00', fine: '19:00', pausaInizio: '13:00', pausaFine: '14:00' }))];
    turni[i] = { ...turni[i], [campo]: val };
    setEdit({ ...o, turni });
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <h3>Operatori, turni e ferie</h3>
      </div>
      {err && <div className="err mb">{err}</div>}

      {!!daAssegnare.length && (
        <div className="mPanel">
          <h3>Appuntamenti senza operatore ({daAssegnare.length})</h3>
          <table className="tbl">
            <thead><tr><th>Data</th><th>Cliente</th><th>Servizio</th><th>Assegna a</th></tr></thead>
            <tbody>{daAssegnare.map(a => (
              <tr key={a._id}>
                <td>{new Date(a.data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{a.client?.firstName} {a.client?.lastName}</td>
                <td>{a.service?.nome}</td>
                <td><select value="" onChange={e => e.target.value && assegna(a._id, e.target.value)}>
                  <option value="">— scegli —</option>
                  {operatori.filter(o => o.attivo).map(o => <option key={o._id} value={o._id}>{o.nome}</option>)}
                </select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="mPanel">
        <h3>Aggiungi operatore</h3>
        <div className="row wrap">
          <input placeholder="Nome" value={nuovo.nome} onChange={e => setNuovo({ ...nuovo, nome: e.target.value })} />
          {REPARTI.map(r => (
            <label key={r} className="checkrow">
              <input type="checkbox" checked={nuovo.reparti.includes(r)}
                onChange={e => setNuovo({ ...nuovo, reparti: e.target.checked ? [...nuovo.reparti, r] : nuovo.reparti.filter(x => x !== r) })} />
              {r}
            </label>
          ))}
          <button className="btn sm" onClick={crea} disabled={!nuovo.nome}>Aggiungi</button>
        </div>
      </div>

      {operatori.map(o => (
        <div key={o._id} className="mPanel">
          <div className="row between wrap">
            <h3>{o.nome} {!o.attivo && <span className="tag off">disattivo</span>}</h3>
            <div className="row">
              <button className="btn alt sm" onClick={() => setEdit(edit?._id === o._id ? null : JSON.parse(JSON.stringify(o)))}>
                {edit?._id === o._id ? 'Chiudi' : 'Turni e reparti'}
              </button>
              <button className="linkbtn" onClick={() => toggleAttivo(o)}>{o.attivo ? 'disattiva' : 'attiva'}</button>
            </div>
          </div>
          <div className="row wrap">
            {(o.reparti || []).map((r: string) => <span key={r} className="tag alt">{r}</span>)}
          </div>

          {edit?._id === o._id && (
            <>
              <h4 className="mt">Reparti abilitati</h4>
              <div className="row wrap">
                {REPARTI.map(r => (
                  <label key={r} className="checkrow">
                    <input type="checkbox" checked={(edit.reparti || []).includes(r)}
                      onChange={e => setEdit({ ...edit, reparti: e.target.checked ? [...(edit.reparti || []), r] : (edit.reparti || []).filter((x: string) => x !== r) })} />
                    {r}
                  </label>
                ))}
              </div>
              <h4 className="mt">Turni settimanali</h4>
              <table className="tbl">
                <thead><tr><th>Giorno</th><th>Attivo</th><th>Inizio</th><th>Fine</th><th>Pausa</th></tr></thead>
                <tbody>{GIORNI.map((g, i) => {
                  const t = (edit.turni || [])[i] || { attivo: false, inizio: '09:00', fine: '19:00', pausaInizio: '13:00', pausaFine: '14:00' };
                  return (
                    <tr key={g}>
                      <td>{g}</td>
                      <td><input type="checkbox" checked={t.attivo} onChange={e => setTurno(edit, i, 'attivo', e.target.checked)} /></td>
                      <td><input type="time" value={t.inizio} disabled={!t.attivo} onChange={e => setTurno(edit, i, 'inizio', e.target.value)} /></td>
                      <td><input type="time" value={t.fine} disabled={!t.attivo} onChange={e => setTurno(edit, i, 'fine', e.target.value)} /></td>
                      <td>
                        <input type="time" value={t.pausaInizio || ''} disabled={!t.attivo} style={{ width: 80 }} onChange={e => setTurno(edit, i, 'pausaInizio', e.target.value)} />
                        <input type="time" value={t.pausaFine || ''} disabled={!t.attivo} style={{ width: 80, marginLeft: 6 }} onChange={e => setTurno(edit, i, 'pausaFine', e.target.value)} />
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
              <button className="btn sm mt" onClick={() => salva(edit)}>Salva turni e reparti</button>
            </>
          )}

          <h4 className="mt">Ferie / assenze</h4>
          <div className="row wrap">
            <input type="date" value={ferie} onChange={e => setFerie(e.target.value)} />
            <button className="btn alt sm" onClick={() => addFerie(o)} disabled={!ferie}>Aggiungi giorno</button>
            {(o.assenze || []).map((g: string) => (
              <span key={g} className="tag alt">{g} <button className="linkbtn" onClick={() => delFerie(o, g)}>✕</button></span>
            ))}
            {!o.assenze?.length && <span className="muted small">Nessuna assenza programmata.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
