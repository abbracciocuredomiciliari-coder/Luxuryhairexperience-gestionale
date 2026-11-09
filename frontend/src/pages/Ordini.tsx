import { useEffect, useState } from 'react';
import api from '../api';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
const STATI: Record<string, { t: string; c: string }> = {
  inserito: { t: 'Inserito', c: 'wait' },
  preparazione: { t: 'In preparazione', c: 'wait' },
  consegnato: { t: 'Consegnato', c: '' },
  annullato: { t: 'Annullato', c: 'off' },
};

export default function Ordini() {
  const [ordini, setOrdini] = useState<any[]>([]);
  const [prodotti, setProdotti] = useState<any[]>([]);
  const [form, setForm] = useState(false);
  const [cliente, setCliente] = useState('');
  const [righe, setRighe] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const carica = () => api.get('/orders').then(r => setOrdini(r.data || []));
  useEffect(() => {
    carica();
    api.get('/products', { params: { attivi: '1' } }).then(r => setProdotti(r.data || []));
  }, []);

  const aggiungi = (p: any) => setRighe([...righe, { product: p._id, descrizione: p.nome, quantita: 1, prezzoCent: p.prezzoCent }]);
  const totale = righe.reduce((s, r) => s + r.prezzoCent * r.quantita, 0);

  const crea = async () => {
    setErr('');
    try {
      await api.post('/orders', { clienteLibero: cliente, righe });
      setForm(false); setRighe([]); setCliente(''); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore ordine'); }
  };

  const setStato = async (o: any, stato: string) => {
    try { await api.patch(`/orders/${o._id}/stato`, { stato }); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };
  const segnaPagato = async (o: any) => {
    try { await api.patch(`/orders/${o._id}/pagato`); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  return (
    <div className="fade-in">
      <div className="row between mb">
        <h3>Ordini clienti</h3>
        <button className="btn" onClick={() => setForm(v => !v)}>＋ Nuovo ordine</button>
      </div>
      <p className="muted small">L'ordine scarica le scorte subito ma <b>non crea incasso automatico</b>: registra la vendita/incasso quando il pagamento avviene davvero, poi segna "incassato".</p>
      {err && <div className="err mb">{err}</div>}

      {form && (
        <div className="mPanel">
          <h3>Nuovo ordine</h3>
          <div className="field"><span>Cliente (nome libero o cartella)</span>
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome cliente" /></div>
          <div className="picklist mt">
            {prodotti.map(p => (
              <button key={p._id} className="pick" onClick={() => aggiungi(p)} disabled={p.giacenza <= 0}>
                {p.nome} <small>{euro(p.prezzoCent)} · disp. {p.giacenza}</small>
              </button>
            ))}
          </div>
          {righe.length > 0 && (
            <>
              <table className="tbl mt">
                <thead><tr><th>Articolo</th><th className="r">Qtà</th><th className="r">Prezzo</th><th className="r">Totale</th><th /></tr></thead>
                <tbody>{righe.map((r, i) => (
                  <tr key={i}><td>{r.descrizione}</td>
                    <td className="r"><input type="number" min={1} style={{ width: 60, textAlign: 'right' }} value={r.quantita}
                      onChange={e => { const q = Math.max(1, Number(e.target.value)); setRighe(righe.map((x, j) => j === i ? { ...x, quantita: q } : x)); }} /></td>
                    <td className="r">{euro(r.prezzoCent)}</td><td className="r">{euro(r.prezzoCent * r.quantita)}</td>
                    <td><button className="linkbtn" onClick={() => setRighe(righe.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="row between mt"><b>Totale {euro(totale)}</b>
                <button className="btn" onClick={crea}>Registra ordine (scarica scorte)</button></div>
            </>
          )}
        </div>
      )}

      <table className="tbl">
        <thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Articoli</th><th className="r">Totale</th><th>Stato</th><th>Incasso</th><th /></tr></thead>
        <tbody>
          {ordini.map(o => (
            <tr key={o._id} className={o.stato === 'annullato' ? 'stornata' : ''}>
              <td>{o.numero}</td>
              <td>{new Date(o.createdAt).toLocaleDateString('it-IT')}</td>
              <td>{o.client ? `${o.client.firstName} ${o.client.lastName}` : o.clienteLibero || '—'}</td>
              <td>{o.righe.map((r: any) => `${r.quantita}× ${r.descrizione}`).join(', ')}</td>
              <td className="r">{euro(o.totaleCent)}</td>
              <td><span className={`tag ${STATI[o.stato]?.c || ''}`}>{STATI[o.stato]?.t || o.stato}</span></td>
              <td>{o.pagato ? <span className="tag">incassato</span>
                : o.stato !== 'annullato' && <button className="linkbtn" onClick={() => segnaPagato(o)}>segna incassato</button>}</td>
              <td className="nowrap">
                {o.stato === 'inserito' && <button className="linkbtn" onClick={() => setStato(o, 'preparazione')}>prepara</button>}
                {o.stato === 'preparazione' && <button className="linkbtn" onClick={() => setStato(o, 'consegnato')}>consegna</button>}
                {(o.stato === 'inserito' || o.stato === 'preparazione') && <button className="linkbtn neg" onClick={() => setStato(o, 'annullato')}>annulla</button>}
              </td>
            </tr>
          ))}
          {!ordini.length && <tr><td colSpan={8} className="muted">Nessun ordine.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
