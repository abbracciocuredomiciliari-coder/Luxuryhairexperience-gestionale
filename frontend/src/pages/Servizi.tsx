import { useEffect, useState } from 'react';
import api from '../api';

export default function Servizi() {
  const [servizi, setServizi] = useState<any[]>([]);
  const [form, setForm] = useState(false);
  const [nuovo, setNuovo] = useState({ nome: '', categoria: 'Capelli', durataMinuti: 60, prezzo: 0, descrizione: '' });
  const [err, setErr] = useState('');

  const carica = () => api.get('/services/all').then(r => setServizi(r.data || [])).catch(() => {});
  useEffect(() => { carica(); }, []);

  const crea = async () => {
    setErr('');
    try { await api.post('/services', nuovo); setForm(false); setNuovo({ nome: '', categoria: 'Capelli', durataMinuti: 60, prezzo: 0, descrizione: '' }); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };
  const toggle = async (s: any) => { await api.put(`/services/${s._id}`, { attivo: !s.attivo }); carica(); };

  const perCategoria = new Map<string, any[]>();
  servizi.forEach(s => { if (!perCategoria.has(s.categoria)) perCategoria.set(s.categoria, []); perCategoria.get(s.categoria)!.push(s); });

  return (
    <div className="fade-in">
      <div className="row between mb">
        <p className="small" style={{ margin: 0 }}>Il listino attivo è quello che le clienti vedono e prenotano dal sito.</p>
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Nuovo servizio</button>
      </div>

      {form && (
        <div className="mPanel">
          <h3>Nuovo servizio</h3>
          {err && <div className="err mb">{err}</div>}
          <div className="formgrid">
            <div className="field"><span>Nome *</span><input value={nuovo.nome} onChange={e => setNuovo({ ...nuovo, nome: e.target.value })} /></div>
            <div className="field"><span>Categoria</span><input value={nuovo.categoria} onChange={e => setNuovo({ ...nuovo, categoria: e.target.value })} /></div>
            <div className="field"><span>Durata (minuti) *</span><input type="number" min={15} step={15} value={nuovo.durataMinuti} onChange={e => setNuovo({ ...nuovo, durataMinuti: Number(e.target.value) })} /></div>
            <div className="field"><span>Prezzo €</span><input type="number" min={0} step={0.5} value={nuovo.prezzo} onChange={e => setNuovo({ ...nuovo, prezzo: Number(e.target.value) })} /></div>
            <div className="field wide"><span>Descrizione</span><input value={nuovo.descrizione} onChange={e => setNuovo({ ...nuovo, descrizione: e.target.value })} /></div>
          </div>
          <div className="mt"><button className="btn" onClick={crea} disabled={!nuovo.nome}>Aggiungi al listino</button></div>
        </div>
      )}

      {[...perCategoria.entries()].map(([cat, items]) => (
        <div className="mPanel" key={cat}>
          <h3>{cat} ({items.length})</h3>
          <div className="tablewrap"><table>
            <thead><tr><th>Servizio</th><th>Durata</th><th>Prezzo</th><th>Stato</th><th /></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s._id} style={{ opacity: s.attivo ? 1 : .45 }}>
                  <td><strong>{s.nome}</strong>{s.descrizione && <><br /><small>{s.descrizione}</small></>}</td>
                  <td>{s.durataMinuti}′</td>
                  <td>€ {Number(s.prezzo).toFixed(2)}</td>
                  <td><span className={`tag ${s.attivo ? '' : 'off'}`}>{s.attivo ? 'Prenotabile' : 'Disattivo'}</span></td>
                  <td><button className="btn alt sm" onClick={() => toggle(s)}>{s.attivo ? 'Disattiva' : 'Riattiva'}</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}
    </div>
  );
}
