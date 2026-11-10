import { useEffect, useState } from 'react';
import api from '../api';
import SiteHeader from '../components/SiteHeader';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;

export default function Shop() {
  const [prodotti, setProdotti] = useState<any[]>([]);
  const [carrello, setCarrello] = useState<{ productId: string; nome: string; prezzoCent: number; quantita: number }[]>([]);
  const [step, setStep] = useState<'vetrina' | 'checkout' | 'fatto'>('vetrina');
  const [dati, setDati] = useState({ firstName: '', lastName: '', email: '', phone: '', consegna: 'ritiro', indirizzo: '', note: '' });
  const [esito, setEsito] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [trk, setTrk] = useState({ numero: '', email: '' });
  const [trkRes, setTrkRes] = useState<any | null>(null);
  const [trkErr, setTrkErr] = useState('');

  useEffect(() => { api.get('/public/shop').then(r => setProdotti(r.data || [])).catch(() => {}); }, []);

  const aggiungi = (p: any) => {
    const ex = carrello.find(c => c.productId === p._id);
    setCarrello(ex
      ? carrello.map(c => c.productId === p._id ? { ...c, quantita: c.quantita + 1 } : c)
      : [...carrello, { productId: p._id, nome: p.nome, prezzoCent: p.prezzoCent, quantita: 1 }]);
  };
  const setQty = (id: string, q: number) =>
    setCarrello(q <= 0 ? carrello.filter(c => c.productId !== id) : carrello.map(c => c.productId === id ? { ...c, quantita: q } : c));
  const totale = carrello.reduce((s, c) => s + c.prezzoCent * c.quantita, 0);
  const nArticoli = carrello.reduce((s, c) => s + c.quantita, 0);

  const ordina = async () => {
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/public/shop/ordine', {
        righe: carrello.map(c => ({ productId: c.productId, quantita: c.quantita })),
        ...dati,
      });
      setEsito(res.data); setStep('fatto'); setCarrello([]);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Ordine non riuscito, riprova');
    } finally { setBusy(false); }
  };

  const traccia = async () => {
    setTrkErr(''); setTrkRes(null);
    try {
      const r = await api.get(`/public/shop/ordine/${trk.numero}`, { params: { email: trk.email } });
      setTrkRes(r.data);
    } catch (e: any) { setTrkErr(e?.response?.data?.message || 'Ordine non trovato'); }
  };

  const STATO: Record<string, string> = { inserito: 'Ricevuto', preparazione: 'In preparazione', consegnato: 'Consegnato', annullato: 'Annullato' };

  return (
    <div className="site-shell">
      <SiteHeader attivo="shop" />

      <div className="site-hero">
        <h1>Boutique Luxury</h1>
        <p>Prodotti selezionati dal salone, ordinabili online. Ritiro gratuito in negozio o consegna a domicilio concordata.</p>
      </div>

      <div className="site-wrap" style={{ maxWidth: 960 }}>
        {step === 'vetrina' && (
          <>
            {nArticoli > 0 && (
              <div className="carrello-bar">
                <span>🛍 {nArticoli} articol{nArticoli === 1 ? 'o' : 'i'} · {euro(totale)}</span>
                <button className="btn sm" onClick={() => setStep('checkout')}>Vai al carrello →</button>
              </div>
            )}
            <div className="servizi-grid">
              {prodotti.map(p => (
                <div key={p._id} className="servizio-card shop-card">
                  {p.immagine
                    ? <img src={p.immagine} alt={p.nome} className="shop-img" />
                    : <div className="shop-img placeholder">✿</div>}
                  <small>{p.categoria}</small>
                  <strong>{p.nome}</strong>
                  {p.descrizione && <p className="small" style={{ margin: '6px 0 0' }}>{p.descrizione}</p>}
                  <div className="row between mt">
                    <div className="prezzo">{euro(p.prezzoCent)}</div>
                    <button className="btn sm" disabled={!p.disponibile} onClick={() => aggiungi(p)}>
                      {p.disponibile ? '＋ Aggiungi' : 'Esaurito'}
                    </button>
                  </div>
                </div>
              ))}
              {prodotti.length === 0 && <div className="empty"><b>Vetrina in preparazione</b>Gli articoli vendibili online appariranno qui — attivali da Boutique → "vendibile online".</div>}
            </div>

            <div className="mPanel">
              <h3>Hai già ordinato? Controlla lo stato</h3>
              <div className="row">
                <input type="number" placeholder="N. ordine" value={trk.numero} onChange={e => setTrk({ ...trk, numero: e.target.value })} style={{ width: 110 }} />
                <input type="email" placeholder="la-tua@email.it" value={trk.email} onChange={e => setTrk({ ...trk, email: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn alt" onClick={traccia} disabled={!trk.numero || !trk.email}>Verifica</button>
              </div>
              {trkErr && <p className="err mt">{trkErr}</p>}
              {trkRes && (
                <div className="mt">
                  <span className={`tag ${trkRes.stato === 'annullato' ? 'off' : trkRes.stato === 'inserito' ? 'wait' : ''}`}>
                    Ordine n. {trkRes.numero} — {STATO[trkRes.stato] || trkRes.stato}
                  </span>
                  <p className="small mt">{trkRes.righe.map((r: any) => `${r.quantita}× ${r.descrizione}`).join(', ')} · {euro(trkRes.totaleCent)} · {trkRes.consegna === 'ritiro' ? 'ritiro in salone' : 'consegna domicilio'}{trkRes.pagato ? ' · pagato' : ''}</p>
                </div>
              )}
            </div>
          </>
        )}

        {step === 'checkout' && (
          <div className="mPanel fade-in">
            <h3>Il tuo ordine</h3>
            {err && <div className="err mb">{err}</div>}
            <table className="tbl">
              <tbody>{carrello.map(c => (
                <tr key={c.productId}>
                  <td>{c.nome}</td>
                  <td className="r">
                    <button className="linkbtn" onClick={() => setQty(c.productId, c.quantita - 1)}>−</button>
                    {c.quantita}
                    <button className="linkbtn" onClick={() => setQty(c.productId, c.quantita + 1)}>＋</button>
                  </td>
                  <td className="r">{euro(c.prezzoCent * c.quantita)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={2}><b>Totale</b></td><td className="r"><b>{euro(totale)}</b></td></tr></tfoot>
            </table>

            <div className="formgrid mt">
              <div className="field"><span>Nome *</span><input value={dati.firstName} onChange={e => setDati({ ...dati, firstName: e.target.value })} /></div>
              <div className="field"><span>Cognome</span><input value={dati.lastName} onChange={e => setDati({ ...dati, lastName: e.target.value })} /></div>
              <div className="field"><span>Email *</span><input type="email" value={dati.email} onChange={e => setDati({ ...dati, email: e.target.value })} /></div>
              <div className="field"><span>Telefono</span><input value={dati.phone} onChange={e => setDati({ ...dati, phone: e.target.value })} /></div>
              <div className="field"><span>Consegna</span>
                <select value={dati.consegna} onChange={e => setDati({ ...dati, consegna: e.target.value })}>
                  <option value="ritiro">Ritiro in salone (gratuito)</option>
                  <option value="domicilio">Consegna a domicilio (da concordare)</option>
                </select>
              </div>
              {dati.consegna === 'domicilio' && (
                <div className="field"><span>Indirizzo</span><input value={dati.indirizzo} onChange={e => setDati({ ...dati, indirizzo: e.target.value })} /></div>
              )}
              <div className="field wide"><span>Note</span><input value={dati.note} onChange={e => setDati({ ...dati, note: e.target.value })} /></div>
            </div>
            <p className="small muted mt">Pagamento al ritiro o alla consegna — il salone conferma l'ordine e ti contatta.</p>
            <div className="row mt">
              <button className="btn alt" onClick={() => setStep('vetrina')}>← Continua gli acquisti</button>
              <button className="btn" disabled={busy || !dati.firstName || !dati.email || !carrello.length} onClick={ordina}>
                {busy ? 'Invio…' : `Conferma ordine ${euro(totale)}`}
              </button>
            </div>
          </div>
        )}

        {step === 'fatto' && esito && (
          <div className="confirm-box fade-in">
            <h2>✅ Ordine n. {esito.ordine.numero} registrato</h2>
            <p><strong>{euro(esito.ordine.totaleCent)}</strong> · {esito.ordine.consegna === 'ritiro' ? 'ritiro in salone' : 'consegna a domicilio'}</p>
            <p className="small">{esito.messaggio}<br />Annota il numero d'ordine: ti servirà per verificarne lo stato insieme alla tua email.</p>
            <div className="row mt" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => { setStep('vetrina'); setEsito(null); }}>Torna alla vetrina</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
