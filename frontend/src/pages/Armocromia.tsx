import { useEffect, useState } from 'react';
import api from '../api';

const STAGIONI = ['Inverno freddo', 'Inverno brillante', 'Inverno assoluto', 'Estate fredda', 'Estate soft', 'Estate chiara', 'Primavera calda', 'Primavera chiara', 'Primavera brillante', 'Autunno caldo', 'Autunno soft', 'Autunno profondo'];

export default function Armocromia() {
  const [consulenze, setConsulenze] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [form, setForm] = useState(false);
  const [cerca, setCerca] = useState('');
  const [nuova, setNuova] = useState({ clientId: '', stagione: '', palette: '', operatrice: '', note: '' });
  const [err, setErr] = useState('');

  const carica = () => api.get('/consultations').then(r => setConsulenze(r.data || []));
  useEffect(() => {
    carica();
    api.get('/clients').then(r => setClienti(r.data || []));
  }, []);

  const filtrati = clienti.filter(c => !cerca || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(cerca.toLowerCase()));

  const crea = async () => {
    setErr('');
    try {
      await api.post('/consultations', {
        clientId: nuova.clientId, stagione: nuova.stagione,
        palette: nuova.palette.split(',').map(s => s.trim()).filter(Boolean),
        operatrice: nuova.operatrice, note: nuova.note,
      });
      setForm(false); setNuova({ clientId: '', stagione: '', palette: '', operatrice: '', note: '' }); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <h3>Consulenze armocromia</h3>
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Consulenza</button>
      </div>
      {err && <div className="err mb">{err}</div>}

      {form && (
        <div className="mPanel">
          <h3>Nuova consulenza</h3>
          <div className="formgrid">
            <div className="field wide"><span>Cliente</span>
              <input placeholder="Cerca…" value={cerca} onChange={e => setCerca(e.target.value)} />
              <select value={nuova.clientId} onChange={e => setNuova({ ...nuova, clientId: e.target.value })} size={4} style={{ height: 'auto' }}>
                {filtrati.slice(0, 30).map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div className="field"><span>Stagione</span>
              <select value={nuova.stagione} onChange={e => setNuova({ ...nuova, stagione: e.target.value })}>
                <option value="">— scegli —</option>
                {STAGIONI.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><span>Operatrice</span><input value={nuova.operatrice} onChange={e => setNuova({ ...nuova, operatrice: e.target.value })} /></div>
            <div className="field wide"><span>Palette colori (separati da virgola)</span>
              <input value={nuova.palette} onChange={e => setNuova({ ...nuova, palette: e.target.value })} placeholder="es. blu notte, grigio perla, bordeaux" /></div>
            <div className="field wide"><span>Note</span>
              <textarea value={nuova.note} onChange={e => setNuova({ ...nuova, note: e.target.value })} rows={2} /></div>
          </div>
          <button className="btn" onClick={crea} disabled={!nuova.clientId || !nuova.stagione}>Salva consulenza</button>
        </div>
      )}

      <table className="tbl">
        <thead><tr><th>Data</th><th>Cliente</th><th>Stagione</th><th>Palette</th><th>Operatrice</th><th>Note</th></tr></thead>
        <tbody>
          {consulenze.map(c => (
            <tr key={c._id}>
              <td>{new Date(c.data).toLocaleDateString('it-IT')}</td>
              <td>{c.client?.firstName} {c.client?.lastName}</td>
              <td><span className="tag">{c.stagione}</span></td>
              <td>{(c.palette || []).map((p: string) => <span key={p} className="tag alt" style={{ marginRight: 4 }}>{p}</span>)}</td>
              <td>{c.operatrice}</td>
              <td className="muted">{c.note}</td>
            </tr>
          ))}
          {!consulenze.length && <tr><td colSpan={6} className="muted">Nessuna consulenza registrata.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
