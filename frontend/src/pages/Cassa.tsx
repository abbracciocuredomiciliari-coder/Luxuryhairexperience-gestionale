import { useEffect, useState } from 'react';
import api from '../api';

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
const METODI = ['contanti', 'pos', 'mypos', 'bonifico'];
const REPARTI = ['parrucchiere', 'estetica', 'unghie', 'abbigliamento', 'altro'];

export default function Cassa() {
  const [tab, setTab] = useState<'movimenti' | 'chiusura' | 'storico'>('movimenti');
  const [giorno, setGiorno] = useState(dstr(new Date()));
  const [movs, setMovs] = useState<any[]>([]);
  const [giornata, setGiornata] = useState<any>(null);
  const [chiusure, setChiusure] = useState<any[]>([]);
  const [verificato, setVerificato] = useState<Record<string, string>>({});
  const [nuovo, setNuovo] = useState({ tipo: 'entrata', reparto: 'parrucchiere', metodo: 'contanti', importo: '', nota: '' });
  const [msg, setMsg] = useState('');

  const carica = () => {
    api.get('/cash/movimenti', { params: { from: giorno, to: giorno } }).then(r => setMovs(r.data || []));
    api.get(`/cash/giornata/${giorno}`).then(r => setGiornata(r.data));
    api.get('/cash/chiusure').then(r => setChiusure(r.data || []));
  };
  useEffect(carica, [giorno]);

  const salva = async () => {
    setMsg('');
    try {
      await api.post('/cash/movimenti', { ...nuovo, importoCent: Math.round(parseFloat(nuovo.importo) * 100), data: giorno });
      setNuovo({ ...nuovo, importo: '', nota: '' }); carica();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Errore'); }
  };

  const chiudi = async () => {
    setMsg('');
    try {
      await api.post('/cash/chiusura', {
        giorno,
        perMetodo: (giornata?.perMetodo || []).map((p: any) => ({
          metodo: p.metodo, attesoCent: p.attesoCent,
          verificatoCent: Math.round(parseFloat(verificato[p.metodo] || '0') * 100),
        })),
      });
      setVerificato({}); carica();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Errore chiusura'); }
  };

  return (
    <div className="fade-in">
      <div className="row between mb wrap">
        <div className="seg">
          <button className={tab === 'movimenti' ? 'on' : ''} onClick={() => setTab('movimenti')}>Movimenti</button>
          <button className={tab === 'chiusura' ? 'on' : ''} onClick={() => setTab('chiusura')}>Chiusura giornata</button>
          <button className={tab === 'storico' ? 'on' : ''} onClick={() => setTab('storico')}>Storico chiusure</button>
        </div>
        <input type="date" value={giorno} onChange={e => setGiorno(e.target.value)} className="datepick" />
      </div>
      {msg && <div className="err mb">{msg}</div>}

      {giornata && (
        <div className="kpis">
          <div className="kpi"><span>Entrate</span><b>{euro(giornata.entrateCent)}</b></div>
          <div className="kpi"><span>Uscite</span><b>{euro(giornata.usciteCent)}</b></div>
          <div className="kpi"><span>Saldo giorno</span><b>{euro(giornata.entrateCent - giornata.usciteCent)}</b></div>
          {giornata.chiusura && <div className="kpi ok"><span>Giornata</span><b>Chiusa ✓</b></div>}
        </div>
      )}

      {tab === 'movimenti' && (
        <>
          {!giornata?.chiusura && (
            <div className="mPanel">
              <h3>Registra movimento</h3>
              <div className="formgrid">
                <div className="field"><span>Tipo</span>
                  <select value={nuovo.tipo} onChange={e => setNuovo({ ...nuovo, tipo: e.target.value })}>
                    <option value="entrata">Entrata</option><option value="uscita">Uscita</option>
                  </select>
                </div>
                <div className="field"><span>Reparto</span>
                  <select value={nuovo.reparto} onChange={e => setNuovo({ ...nuovo, reparto: e.target.value })}>
                    {REPARTI.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="field"><span>Metodo</span>
                  <select value={nuovo.metodo} onChange={e => setNuovo({ ...nuovo, metodo: e.target.value })}>
                    {METODI.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field"><span>Importo €</span>
                  <input type="number" step="0.01" min="0" value={nuovo.importo} onChange={e => setNuovo({ ...nuovo, importo: e.target.value })} />
                </div>
                <div className="field wide"><span>Nota</span>
                  <input value={nuovo.nota} onChange={e => setNuovo({ ...nuovo, nota: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={salva} disabled={!nuovo.importo || parseFloat(nuovo.importo) <= 0}>Registra</button>
            </div>
          )}
          <table className="tbl">
            <thead><tr><th>Ora</th><th>Tipo</th><th>Reparto</th><th>Metodo</th><th>Nota</th><th className="r">Importo</th></tr></thead>
            <tbody>
              {movs.map(m => (
                <tr key={m._id}>
                  <td>{new Date(m.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><span className={`tag ${m.tipo === 'uscita' ? 'off' : ''}`}>{m.tipo}</span>{m.automatico && <small> auto</small>}</td>
                  <td>{m.reparto}</td><td>{m.metodo}</td><td>{m.nota}</td>
                  <td className={`r ${m.tipo === 'uscita' ? 'neg' : ''}`}>{m.tipo === 'uscita' ? '−' : ''}{euro(m.importoCent)}</td>
                </tr>
              ))}
              {!movs.length && <tr><td colSpan={6} className="muted">Nessun movimento in questa giornata.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {tab === 'chiusura' && (
        <div className="mPanel">
          <h3>Chiusura di giornata — {new Date(giorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          {giornata?.chiusura ? (
            <>
              <p className="muted">Giornata già chiusa{giornata.chiusura.chiusaDa ? ` da ${giornata.chiusura.chiusaDa}` : ''}.</p>
              <table className="tbl">
                <thead><tr><th>Metodo</th><th className="r">Atteso</th><th className="r">Verificato</th><th className="r">Differenza</th></tr></thead>
                <tbody>{giornata.chiusura.perMetodo.map((p: any) => (
                  <tr key={p.metodo}><td>{p.metodo}</td><td className="r">{euro(p.attesoCent)}</td><td className="r">{euro(p.verificatoCent)}</td>
                    <td className={`r ${p.differenzaCent !== 0 ? 'neg' : ''}`}>{p.differenzaCent ? euro(p.differenzaCent) : '—'}</td></tr>
                ))}</tbody>
              </table>
            </>
          ) : (
            <>
              <p className="muted">Conta gli importi reali per metodo e confronta con l'atteso calcolato dai movimenti.</p>
              <table className="tbl">
                <thead><tr><th>Metodo</th><th className="r">Atteso</th><th className="r">Verificato €</th></tr></thead>
                <tbody>{(giornata?.perMetodo || []).map((p: any) => (
                  <tr key={p.metodo}><td>{p.metodo}</td><td className="r">{euro(p.attesoCent)}</td>
                    <td className="r"><input type="number" step="0.01" min="0" style={{ width: 110, textAlign: 'right' }}
                      value={verificato[p.metodo] || ''} onChange={e => setVerificato({ ...verificato, [p.metodo]: e.target.value })} /></td></tr>
                ))}</tbody>
              </table>
              <button className="btn mt" onClick={chiudi}>Chiudi giornata</button>
            </>
          )}
        </div>
      )}

      {tab === 'storico' && (
        <table className="tbl">
          <thead><tr><th>Giorno</th><th className="r">Entrate</th><th className="r">Uscite</th><th>Differenze</th></tr></thead>
          <tbody>
            {chiusure.map(c => (
              <tr key={c._id}><td>{c.giorno}</td><td className="r">{euro(c.entrateCent)}</td><td className="r">{euro(c.usciteCent)}</td>
                <td>{c.perMetodo.filter((p: any) => p.differenzaCent !== 0).map((p: any) => `${p.metodo}: ${euro(p.differenzaCent)}`).join(' · ') || '—'}</td></tr>
            ))}
            {!chiusure.length && <tr><td colSpan={4} className="muted">Nessuna chiusura registrata.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
