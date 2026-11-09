import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Clienti() {
  const nav = useNavigate();
  const [clienti, setClienti] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(false);
  const [nuovo, setNuovo] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '', consensoPrivacy: false });
  const [err, setErr] = useState('');

  const carica = () => api.get('/clients', { params: { q } }).then(r => setClienti(r.data || [])).catch(() => {});
  useEffect(() => { carica(); }, []);
  useEffect(() => { const t = setTimeout(carica, 300); return () => clearTimeout(t); }, [q]);

  const crea = async () => {
    setErr('');
    try {
      const res = await api.post('/clients', nuovo);
      nav(`/gestionale/clienti/${res.data._id}`);
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore creazione'); }
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <input placeholder="Cerca nome, email, telefono…" value={q} onChange={e => setQ(e.target.value)}
          style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '10px 12px', minWidth: 260, background: 'white' }} />
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Nuova cartella</button>
      </div>

      {form && (
        <div className="mPanel">
          <h3>Nuova cartella cliente</h3>
          {err && <div className="err mb">{err}</div>}
          <div className="formgrid">
            <div className="field"><span>Nome *</span><input value={nuovo.firstName} onChange={e => setNuovo({ ...nuovo, firstName: e.target.value })} /></div>
            <div className="field"><span>Cognome</span><input value={nuovo.lastName} onChange={e => setNuovo({ ...nuovo, lastName: e.target.value })} /></div>
            <div className="field"><span>Email *</span><input type="email" value={nuovo.email} onChange={e => setNuovo({ ...nuovo, email: e.target.value })} /></div>
            <div className="field"><span>Telefono</span><input value={nuovo.phone} onChange={e => setNuovo({ ...nuovo, phone: e.target.value })} /></div>
            <div className="field wide"><span>Note</span><input value={nuovo.notes} onChange={e => setNuovo({ ...nuovo, notes: e.target.value })} /></div>
            <div className="field wide">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <input type="checkbox" checked={nuovo.consensoPrivacy} onChange={e => setNuovo({ ...nuovo, consensoPrivacy: e.target.checked })} />
                Consenso privacy registrato
              </label>
            </div>
          </div>
          <div className="mt"><button className="btn" onClick={crea} disabled={!nuovo.firstName || !nuovo.email}>Crea cartella</button></div>
        </div>
      )}

      <div className="mPanel">
        <h3>Cartelle clienti ({clienti.length})</h3>
        <div className="tablewrap"><table>
          <thead><tr><th>Cliente</th><th>Email</th><th>Telefono</th><th>Da</th><th /></tr></thead>
          <tbody>
            {clienti.map(c => (
              <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => nav(`/gestionale/clienti/${c._id}`)}>
                <td><strong>{c.firstName} {c.lastName}</strong></td>
                <td>{c.email}</td><td>{c.phone || '—'}</td>
                <td>{new Date(c.createdAt).toLocaleDateString('it-IT')}</td>
                <td><span className="tag">Apri →</span></td>
              </tr>
            ))}
            {clienti.length === 0 && <tr><td colSpan={5}><div className="empty"><b>Nessuna cartella</b>Le clienti che prenotano dal sito compaiono qui automaticamente.</div></td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
