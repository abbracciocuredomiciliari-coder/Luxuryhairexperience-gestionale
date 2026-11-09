import { useEffect, useState } from 'react';
import api from '../api';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;

export default function Boutique() {
  const [prodotti, setProdotti] = useState<any[]>([]);
  const [form, setForm] = useState(false);
  const [nuovo, setNuovo] = useState({ nome: '', categoria: '', descrizione: '', prezzo: '', giacenza: '0', giacenzaMinima: '0', vendibileOnline: false });
  const [foto, setFoto] = useState<File | null>(null);
  const [rett, setRett] = useState<any | null>(null);
  const [delta, setDelta] = useState('');
  const [err, setErr] = useState('');

  const carica = () => api.get('/products').then(r => setProdotti(r.data || []));
  useEffect(() => { carica(); }, []);

  const fileB64 = (f: File) => new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = ko;
    r.readAsDataURL(f);
  });

  const crea = async () => {
    setErr('');
    try {
      let immagine;
      if (foto) {
        if (foto.size > 300 * 1024) return setErr('Foto troppo grande (max 300 KB)');
        immagine = { nome: foto.name, tipo: foto.type, dati: await fileB64(foto) };
      }
      await api.post('/products', {
        nome: nuovo.nome, categoria: nuovo.categoria || 'Boutique', descrizione: nuovo.descrizione,
        prezzoCent: Math.round(parseFloat(nuovo.prezzo) * 100),
        giacenza: Number(nuovo.giacenza), giacenzaMinima: Number(nuovo.giacenzaMinima),
        vendibileOnline: nuovo.vendibileOnline, immagine,
      });
      setForm(false); setNuovo({ nome: '', categoria: '', descrizione: '', prezzo: '', giacenza: '0', giacenzaMinima: '0', vendibileOnline: false });
      setFoto(null); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  const rettifica = async () => {
    try {
      await api.post(`/products/${rett._id}/rettifica`, { delta: Number(delta), nota: 'rettifica manuale' });
      setRett(null); setDelta(''); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  const toggleAttivo = async (p: any) => {
    await api.put(`/products/${p._id}`, { attivo: !p.attivo }); carica();
  };
  const toggleOnline = async (p: any) => {
    await api.put(`/products/${p._id}`, { vendibileOnline: !p.vendibileOnline }); carica();
  };

  const valore = prodotti.reduce((s, p) => s + p.giacenza * p.prezzoCent, 0);

  return (
    <div className="fade-in">
      <div className="row between mb wrap">
        <h3>Boutique — catalogo e giacenze</h3>
        <div className="row"><span className="muted small">Valore scorte a prezzo vendita: <b>{euro(valore)}</b></span>
          <button className="btn" onClick={() => setForm(v => !v)}>＋ Articolo</button></div>
      </div>
      {err && <div className="err mb">{err}</div>}

      {form && (
        <div className="mPanel">
          <h3>Nuovo articolo</h3>
          <div className="formgrid">
            <div className="field"><span>Nome</span><input value={nuovo.nome} onChange={e => setNuovo({ ...nuovo, nome: e.target.value })} /></div>
            <div className="field"><span>Categoria</span><input value={nuovo.categoria} onChange={e => setNuovo({ ...nuovo, categoria: e.target.value })} placeholder="Abbigliamento, Haircare…" /></div>
            <div className="field"><span>Prezzo €</span><input type="number" step="0.01" value={nuovo.prezzo} onChange={e => setNuovo({ ...nuovo, prezzo: e.target.value })} /></div>
            <div className="field"><span>Giacenza</span><input type="number" value={nuovo.giacenza} onChange={e => setNuovo({ ...nuovo, giacenza: e.target.value })} /></div>
            <div className="field"><span>Scorta minima</span><input type="number" value={nuovo.giacenzaMinima} onChange={e => setNuovo({ ...nuovo, giacenzaMinima: e.target.value })} /></div>
            <div className="field"><span>Foto vetrina (max 300 KB)</span><input type="file" accept="image/*" onChange={e => setFoto(e.target.files?.[0] || null)} /></div>
            <div className="field wide"><span>Descrizione (visibile nello shop)</span><input value={nuovo.descrizione} onChange={e => setNuovo({ ...nuovo, descrizione: e.target.value })} /></div>
            <div className="field">
              <label className="checkrow"><input type="checkbox" checked={nuovo.vendibileOnline} onChange={e => setNuovo({ ...nuovo, vendibileOnline: e.target.checked })} /> Vendibile online nello shop</label>
            </div>
          </div>
          <button className="btn" onClick={crea} disabled={!nuovo.nome || !nuovo.prezzo}>Salva articolo</button>
        </div>
      )}

      {rett && (
        <div className="mPanel">
          <div className="row between"><h3>Rettifica giacenza — {rett.nome}</h3>
            <button className="btn alt sm" onClick={() => setRett(null)}>✕</button></div>
          <div className="row">
            <input type="number" style={{ width: 110 }} placeholder="± quantità" value={delta} onChange={e => setDelta(e.target.value)} />
            <button className="btn sm" onClick={rettifica} disabled={!delta || Number(delta) === 0}>Applica ({rett.giacenza} → {rett.giacenza + Number(delta || 0)})</button>
          </div>
        </div>
      )}

      <table className="tbl">
        <thead><tr><th>Articolo</th><th>Categoria</th><th className="r">Prezzo</th><th className="r">Giacenza</th><th className="r">Min.</th><th>Shop</th><th>Stato</th><th /></tr></thead>
        <tbody>
          {prodotti.map(p => (
            <tr key={p._id} className={!p.attivo ? 'stornata' : ''}>
              <td>{p.nome}{p.immagine?.dati && ' 🖼'}</td><td>{p.categoria}</td><td className="r">{euro(p.prezzoCent)}</td>
              <td className={`r ${p.giacenzaMinima > 0 && p.giacenza <= p.giacenzaMinima ? 'neg' : ''}`}>{p.giacenza}</td>
              <td className="r">{p.giacenzaMinima || '—'}</td>
              <td><button className="linkbtn" onClick={() => toggleOnline(p)}>{p.vendibileOnline ? <span className="tag">online</span> : 'off'}</button></td>
              <td>{p.giacenzaMinima > 0 && p.giacenza <= p.giacenzaMinima ? <span className="tag wait">sotto scorta</span>
                : p.attivo ? <span className="tag">attivo</span> : <span className="tag off">disattivo</span>}</td>
              <td className="r nowrap">
                <button className="linkbtn" onClick={() => setRett(p)}>rettifica</button>
                <button className="linkbtn" onClick={() => toggleAttivo(p)}>{p.attivo ? 'disattiva' : 'attiva'}</button>
              </td>
            </tr>
          ))}
          {!prodotti.length && <tr><td colSpan={7} className="muted">Nessun articolo in boutique.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
