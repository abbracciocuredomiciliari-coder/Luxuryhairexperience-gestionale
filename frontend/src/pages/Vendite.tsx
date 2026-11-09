import { useEffect, useState } from 'react';
import api from '../api';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
const METODI = ['contanti', 'pos', 'mypos', 'bonifico'];

export default function Vendite() {
  const [vendite, setVendite] = useState<any[]>([]);
  const [prodotti, setProdotti] = useState<any[]>([]);
  const [servizi, setServizi] = useState<any[]>([]);
  const [form, setForm] = useState(false);
  const [righe, setRighe] = useState<any[]>([]);
  const [metodo, setMetodo] = useState('contanti');
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');

  const carica = () => api.get('/sales').then(r => setVendite(r.data || []));
  useEffect(() => {
    carica();
    api.get('/products', { params: { attivi: '1' } }).then(r => setProdotti(r.data || []));
    api.get('/services/all').then(r => setServizi((r.data || []).filter((s: any) => s.attivo)));
  }, []);

  const aggiungi = (tipo: 'prodotto' | 'servizio', item: any) => {
    const desc = item.nome;
    const prezzoCent = tipo === 'prodotto' ? item.prezzoCent : Math.round(item.prezzo * 100);
    const reparto = tipo === 'prodotto' ? 'abbigliamento' : item.reparto;
    setRighe([...righe, { tipo, rifId: item._id, descrizione: desc, reparto, quantita: 1, prezzoCent }]);
  };
  const totale = righe.reduce((s, r) => s + r.prezzoCent * r.quantita, 0);

  const conferma = async () => {
    setErr('');
    try {
      await api.post('/sales', { righe, metodo, note: nota });
      setRighe([]); setNota(''); setForm(false); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore vendita'); }
  };

  const storna = async (v: any) => {
    const motivo = window.prompt(`Motivo storno vendita n. ${v.numero}:`);
    if (motivo === null) return;
    try { await api.post(`/sales/${v._id}/storno`, { motivo }); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore storno'); }
  };

  const rifFiscale = async (v: any) => {
    const numero = window.prompt('Numero documento fiscale (RT) emesso:');
    if (numero === null) return;
    await api.patch(`/sales/${v._id}/fiscale`, { numero, data: new Date().toISOString().slice(0, 10), stato: 'emesso' });
    carica();
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <h3>Vendite e promemoria interni</h3>
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Nuova vendita</button>
      </div>
      <p className="muted small">I promemoria sono documenti interni <b>NON FISCALI</b>: il documento fiscale va emesso sul registratore telematico e il riferimento va annotato sulla vendita.</p>
      {err && <div className="err mb">{err}</div>}

      {form && (
        <div className="mPanel">
          <h3>Nuova vendita</h3>
          <div className="vendita-grid">
            <div>
              <h4>Prodotti boutique</h4>
              <div className="picklist">
                {prodotti.map(p => (
                  <button key={p._id} className="pick" onClick={() => aggiungi('prodotto', p)} disabled={p.giacenza <= 0}>
                    {p.nome} <small>{euro(p.prezzoCent)} · disp. {p.giacenza}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4>Servizi</h4>
              <div className="picklist">
                {servizi.map(s => (
                  <button key={s._id} className="pick" onClick={() => aggiungi('servizio', s)}>
                    {s.nome} <small>€ {Number(s.prezzo).toFixed(2)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {righe.length > 0 && (
            <>
              <table className="tbl mt">
                <thead><tr><th>Voce</th><th>Reparto</th><th className="r">Qtà</th><th className="r">Prezzo</th><th className="r">Totale</th><th /></tr></thead>
                <tbody>{righe.map((r, i) => (
                  <tr key={i}><td>{r.descrizione}</td><td>{r.reparto}</td>
                    <td className="r"><input type="number" min={1} style={{ width: 60, textAlign: 'right' }} value={r.quantita}
                      onChange={e => { const q = Math.max(1, Number(e.target.value)); setRighe(righe.map((x, j) => j === i ? { ...x, quantita: q } : x)); }} /></td>
                    <td className="r">{euro(r.prezzoCent)}</td><td className="r">{euro(r.prezzoCent * r.quantita)}</td>
                    <td><button className="linkbtn" onClick={() => setRighe(righe.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="row between mt wrap">
                <div className="row">
                  <select value={metodo} onChange={e => setMetodo(e.target.value)}>{METODI.map(m => <option key={m}>{m}</option>)}</select>
                  <input placeholder="Nota" value={nota} onChange={e => setNota(e.target.value)} />
                </div>
                <div className="row"><b>Totale {euro(totale)}</b>
                  <button className="btn" onClick={conferma}>Incassa e registra</button></div>
              </div>
            </>
          )}
        </div>
      )}

      <table className="tbl">
        <thead><tr><th>N.</th><th>Data</th><th>Voci</th><th>Metodo</th><th>Rif. fiscale</th><th className="r">Totale</th><th /></tr></thead>
        <tbody>
          {vendite.map(v => (
            <tr key={v._id} className={v.stornata ? 'stornata' : ''}>
              <td>{v.numero}</td>
              <td>{new Date(v.createdAt).toLocaleDateString('it-IT')} {new Date(v.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>{v.righe.map((r: any) => `${r.quantita}× ${r.descrizione}`).join(', ')}</td>
              <td>{v.metodo}</td>
              <td>{v.stornata ? <span className="tag off">stornata</span>
                : v.rifFiscale?.numero ? <span className="tag">RT {v.rifFiscale.numero}</span>
                : <button className="linkbtn" onClick={() => rifFiscale(v)}>annota RT</button>}</td>
              <td className="r">{euro(v.totaleCent)}</td>
              <td>{!v.stornata && <button className="linkbtn neg" onClick={() => storna(v)}>storno</button>}</td>
            </tr>
          ))}
          {!vendite.length && <tr><td colSpan={7} className="muted">Nessuna vendita registrata.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
