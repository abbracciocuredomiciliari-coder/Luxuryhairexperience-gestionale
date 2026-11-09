import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

const fmtData = (d: string) => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const TAG: Record<string, { t: string; c: string }> = {
  prenotato: { t: 'Da confermare', c: 'wait' },
  confermato: { t: 'Confermato', c: '' },
  completato: { t: 'Completato', c: '' },
  annullato: { t: 'Annullato', c: 'off' },
  no_show: { t: 'No show', c: 'off' },
};

export default function CartellaCliente() {
  const { id } = useParams();
  const [data, setData] = useState<{ client: any; appuntamenti: any[] } | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [link, setLink] = useState('');

  const carica = () => api.get(`/clients/${id}`).then(r => { setData(r.data); setEdit(r.data.client); }).catch(() => {});
  useEffect(() => { carica(); }, [id]);

  const salva = async () => {
    await api.patch(`/clients/${id}`, edit);
    carica();
  };

  const generaLink = async () => {
    const res = await api.post(`/clients/${id}/link-accesso`);
    setLink(res.data.link);
  };

  if (!data || !edit) return <div className="empty"><b>Caricamento…</b></div>;
  const c = data.client;

  return (
    <div className="fade-in">
      <div className="row between mb">
        <div>
          <h2 style={{ border: 'none', padding: 0, margin: 0 }}>{c.firstName} {c.lastName}</h2>
          <span className="small">{c.email} {c.phone && `· ${c.phone}`} · cliente dal {new Date(c.createdAt).toLocaleDateString('it-IT')}</span>
        </div>
        <Link to="/gestionale/clienti"><button className="btn alt sm">← Tutti i clienti</button></Link>
      </div>

      <div className="twocol">
        <div className="mPanel">
          <h3>Profilo e note</h3>
          <div className="formgrid">
            <div className="field"><span>Nome</span><input value={edit.firstName || ''} onChange={e => setEdit({ ...edit, firstName: e.target.value })} /></div>
            <div className="field"><span>Cognome</span><input value={edit.lastName || ''} onChange={e => setEdit({ ...edit, lastName: e.target.value })} /></div>
            <div className="field"><span>Telefono</span><input value={edit.phone || ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
            <div className="field"><span>Data di nascita</span><input type="date" value={edit.birthDate ? String(edit.birthDate).slice(0, 10) : ''} onChange={e => setEdit({ ...edit, birthDate: e.target.value })} /></div>
            <div className="field"><span>Stagione armocromia</span><input value={edit.profilo?.stagione || ''} onChange={e => setEdit({ ...edit, profilo: { ...edit.profilo, stagione: e.target.value } })} placeholder="es. Inverno freddo" /></div>
            <div className="field"><span>Palette consigliata</span><input value={edit.profilo?.palette || ''} onChange={e => setEdit({ ...edit, profilo: { ...edit.profilo, palette: e.target.value } })} /></div>
            <div className="field"><span>Allergie / avvertenze</span><input value={edit.profilo?.allergie || ''} onChange={e => setEdit({ ...edit, profilo: { ...edit.profilo, allergie: e.target.value } })} /></div>
            <div className="field"><span>Preferenze</span><input value={edit.profilo?.preferenze || ''} onChange={e => setEdit({ ...edit, profilo: { ...edit.profilo, preferenze: e.target.value } })} /></div>
            <div className="field wide"><span>Note interne</span><textarea rows={3} value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
          </div>
          <div className="mt"><button className="btn" onClick={salva}>Salva modifiche</button></div>
        </div>

        <div>
          <div className="mPanel">
            <h3>Accesso cliente alla cartella</h3>
            <p className="small">La cliente entra nella sua cartella dal sito con un link riservato (in futuro inviato via email).</p>
            <button className="btn alt" onClick={generaLink}>Genera link di accesso</button>
            {link && (
              <div className="mt">
                <code style={{ display: 'block', fontSize: 11, background: '#f4f7f1', border: '1px solid var(--line)', borderRadius: 6, padding: 8, wordBreak: 'break-all' }}>{link}</code>
                <button className="btn sm mt" onClick={() => { navigator.clipboard?.writeText(link); alert('Link copiato'); }}>📋 Copia link</button>
              </div>
            )}
          </div>
          <div className="mPanel">
            <h3>Privacy</h3>
            <p className="small">{c.consensoPrivacy ? `✅ Consenso registrato il ${c.consensoPrivacyIl ? new Date(c.consensoPrivacyIl).toLocaleDateString('it-IT') : '—'}` : '⚠️ Consenso non registrato'}</p>
          </div>
        </div>
      </div>

      <div className="mPanel">
        <h3>Storico appuntamenti ({data.appuntamenti.length})</h3>
        <div className="tablewrap"><table>
          <thead><tr><th>Data</th><th>Servizio</th><th>Operatore</th><th>Prezzo</th><th>Stato</th><th>Origine</th></tr></thead>
          <tbody>
            {data.appuntamenti.map(a => (
              <tr key={a._id}>
                <td><strong>{fmtData(a.data)}</strong></td>
                <td>{a.service?.nome}</td><td>{a.operatore || '—'}</td>
                <td>€ {Number(a.prezzo ?? a.service?.prezzo ?? 0).toFixed(2)}</td>
                <td><span className={`tag ${TAG[a.stato]?.c || ''}`}>{TAG[a.stato]?.t || a.stato}</span></td>
                <td>{a.origine}</td>
              </tr>
            ))}
            {data.appuntamenti.length === 0 && <tr><td colSpan={6}><div className="empty"><b>Nessun appuntamento</b></div></td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
