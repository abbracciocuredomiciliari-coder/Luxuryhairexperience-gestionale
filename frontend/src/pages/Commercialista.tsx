import { useEffect, useState } from 'react';
import api from '../api';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
const dstr = (d: any) => d ? new Date(d).toISOString().slice(0, 10) : '—';
const dstrMese = () => {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
};

export default function Commercialista() {
  const [periodo, setPeriodo] = useState(dstrMese());
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');

  const carica = () => {
    setErr('');
    api.get('/commercialista/riepilogo', { params: periodo })
      .then(r => setD(r.data))
      .catch(e => setErr(e?.response?.data?.message || 'Errore caricamento'));
  };
  useEffect(carica, [periodo.from, periodo.to]);

  const scarica = (tipo: string) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('lux_token');
    fetch(`${base}/commercialista/csv?tipo=${tipo}&from=${periodo.from}&to=${periodo.to}`, { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `luxury-${tipo}-${periodo.from}_${periodo.to}.csv`;
        a.click();
      });
    if (tipo === 'backup') {
      fetch(`${base}/backup`, { headers: { authorization: `Bearer ${token}` } })
        .then(r => r.blob()).then(b => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = `luxury-backup-${periodo.to}.json`;
          a.click();
        });
    }
  };
  const stampa = () => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('lux_token');
    fetch(`${base}/commercialista/stampa?from=${periodo.from}&to=${periodo.to}`, { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.text()).then(html => { const w = window.open('', '_blank'); w?.document.write(html); w?.document.close(); });
  };

  return (
    <div className="fade-in">
      <div className="row between mb wrap">
        <h3>Commercialista — riepiloghi e export</h3>
        <div className="row">
          <input type="date" value={periodo.from} onChange={e => setPeriodo({ ...periodo, from: e.target.value })} />
          <input type="date" value={periodo.to} onChange={e => setPeriodo({ ...periodo, to: e.target.value })} />
        </div>
      </div>
      {err && <div className="err mb">{err}</div>}

      {d && (
        <>
          <div className="kpis">
            <div className="kpi"><span>Entrate</span><b>{euro(d.entrateCent)}</b></div>
            <div className="kpi"><span>Uscite</span><b>{euro(d.usciteCent)}</b></div>
            <div className="kpi"><span>Saldo</span><b>{euro(d.saldoCent)}</b></div>
            <div className="kpi"><span>Valore scorte</span><b>{euro(d.valoreScorteCent)}</b></div>
          </div>

          <div className="row wrap mb">
            <button className="btn sm" onClick={() => scarica('movimenti')}>CSV movimenti</button>
            <button className="btn sm" onClick={() => scarica('fatture')}>CSV fatture</button>
            <button className="btn sm" onClick={() => scarica('vendite')}>CSV vendite</button>
            <button className="btn alt sm" onClick={stampa}>Stampa riepilogo</button>
            <button className="btn alt sm" onClick={() => scarica('backup')}>Backup JSON completo</button>
          </div>

          <div className="mPanel">
            <h3>Controlli</h3>
            <div className="row wrap">
              <span className={`tag ${d.controlli.fattureSenzaAllegato ? 'wait' : ''}`}>{d.controlli.fattureSenzaAllegato} fatture senza allegato</span>
              <span className={`tag ${d.controlli.fattureNonPagate ? 'wait' : ''}`}>{d.controlli.fattureNonPagate} fatture non pagate</span>
              <span className={`tag ${d.controlli.venditeSenzaRifFiscale ? 'wait' : ''}`}>{d.controlli.venditeSenzaRifFiscale} vendite senza riferimento fiscale</span>
            </div>
            <p className="muted small mt">{d.nota}</p>
          </div>

          <div className="grid2">
            <div className="mPanel">
              <h3>Saldo per metodo</h3>
              <table className="tbl"><tbody>
                {Object.entries(d.perMetodo || {}).map(([m, v]: any) => <tr key={m}><td>{m}</td><td className="r">{euro(v)}</td></tr>)}
              </tbody></table>
            </div>
            <div className="mPanel">
              <h3>Entrate per reparto</h3>
              <table className="tbl"><tbody>
                {Object.entries(d.perReparto || {}).map(([r, v]: any) => <tr key={r}><td>{r}</td><td className="r">{euro(v)}</td></tr>)}
                {!Object.keys(d.perReparto || {}).length && <tr><td className="muted">—</td></tr>}
              </tbody></table>
            </div>
          </div>

          <h3 className="mt">Fatture fornitori nel periodo (data documento ≠ data pagamento)</h3>
          <table className="tbl">
            <thead><tr><th>Fornitore</th><th>N./Anno</th><th>Data doc.</th><th>1° pagam.</th><th>Saldata il</th><th className="r">Totale</th><th className="r">Residuo</th><th>Stato</th><th>Allegato</th></tr></thead>
            <tbody>
              {d.fatture.map((f: any) => (
                <tr key={f._id}>
                  <td>{f.fornitore}</td><td>{f.numero}{f.anno ? `/${f.anno}` : ''}</td>
                  <td>{dstr(f.dataDocumento)}</td><td>{dstr(f.dataPrimoPagamento)}</td><td>{dstr(f.dataSaldo)}</td>
                  <td className="r">{euro(f.totaleCent)}</td><td className="r">{euro(f.residuoCent)}</td>
                  <td><span className={`tag ${f.stato === 'pagata' ? '' : 'wait'}`}>{f.stato}</span></td>
                  <td>{f.allegato ? '✓' : <span className="tag off">manca</span>}</td>
                </tr>
              ))}
              {!d.fatture.length && <tr><td colSpan={9} className="muted">Nessuna fattura nel periodo.</td></tr>}
            </tbody>
          </table>

          {!!d.prodottiSottoScorta?.length && (
            <div className="mPanel">
              <h3>Articoli sotto scorta</h3>
              <table className="tbl"><tbody>
                {d.prodottiSottoScorta.map((p: any) => <tr key={p.nome}><td>{p.nome}</td><td className="r neg">{p.giacenza} (min {p.minima})</td></tr>)}
              </tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
