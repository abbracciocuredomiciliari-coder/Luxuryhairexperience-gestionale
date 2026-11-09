import { useEffect, useState } from 'react';
import api from '../api';

const euro = (c: number) => `€ ${(c / 100).toFixed(2)}`;
const dstr = (d: any) => d ? new Date(d).toLocaleDateString('it-IT') : '—';
const METODI = ['bonifico', 'contanti', 'pos', 'mypos'];

export default function Fornitori() {
  const [tab, setTab] = useState<'conti' | 'fatture'>('conti');
  const [fornitori, setFornitori] = useState<any[]>([]);
  const [fatture, setFatture] = useState<any[]>([]);
  const [formF, setFormF] = useState(false);
  const [formI, setFormI] = useState(false);
  const [pag, setPag] = useState<any | null>(null);
  const [nuovoF, setNuovoF] = useState({ nome: '', piva: '', email: '', telefono: '' });
  const [nuovaI, setNuovaI] = useState({ supplier: '', numero: '', anno: '', dataDocumento: '', scadenza: '', imponibile: '', iva: '' });
  const [allegato, setAllegato] = useState<File | null>(null);
  const [pagamento, setPagamento] = useState({ importo: '', metodo: 'bonifico', data: '' });
  const [err, setErr] = useState('');

  const carica = () => {
    api.get('/suppliers').then(r => setFornitori(r.data || []));
    api.get('/suppliers/fatture').then(r => setFatture(r.data || []));
  };
  useEffect(() => { carica(); }, []);

  const creaFornitore = async () => {
    setErr('');
    try { await api.post('/suppliers', nuovoF); setFormF(false); setNuovoF({ nome: '', piva: '', email: '', telefono: '' }); carica(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Errore'); }
  };

  const fileBase64 = (f: File) => new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = ko;
    r.readAsDataURL(f);
  });

  const creaFattura = async () => {
    setErr('');
    try {
      let doc;
      if (allegato) {
        if (allegato.size > 1024 * 1024) return setErr('Allegato troppo grande (max 1 MB)');
        doc = { nome: allegato.name, tipo: allegato.type, dati: await fileBase64(allegato) };
      }
      await api.post('/suppliers/fatture', {
        supplier: nuovaI.supplier, numero: nuovaI.numero, anno: nuovaI.anno ? Number(nuovaI.anno) : undefined,
        dataDocumento: nuovaI.dataDocumento, scadenza: nuovaI.scadenza || undefined,
        imponibileCent: Math.round(parseFloat(nuovaI.imponibile) * 100),
        ivaCent: Math.round(parseFloat(nuovaI.iva || '0') * 100),
        allegato: doc,
      });
      setFormI(false); setNuovaI({ supplier: '', numero: '', anno: '', dataDocumento: '', scadenza: '', imponibile: '', iva: '' });
      setAllegato(null); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore fattura'); }
  };

  const paga = async () => {
    setErr('');
    try {
      await api.post(`/suppliers/fatture/${pag._id}/pagamento`, {
        importoCent: Math.round(parseFloat(pagamento.importo) * 100),
        metodo: pagamento.metodo, data: pagamento.data || undefined,
      });
      setPag(null); setPagamento({ importo: '', metodo: 'bonifico', data: '' }); carica();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore pagamento'); }
  };

  const scaricaAllegato = async (f: any) => {
    const r = await api.get(`/suppliers/fatture/${f._id}/allegato`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    window.open(url, '_blank');
  };

  return (
    <div className="fade-in">
      <div className="row between mb wrap">
        <div className="seg">
          <button className={tab === 'conti' ? 'on' : ''} onClick={() => setTab('conti')}>Conti fornitori</button>
          <button className={tab === 'fatture' ? 'on' : ''} onClick={() => setTab('fatture')}>Fatture ricevute</button>
        </div>
        <div className="row">
          {tab === 'conti' && <button className="btn" onClick={() => setFormF(v => !v)}>＋ Fornitore</button>}
          {tab === 'fatture' && <button className="btn" onClick={() => setFormI(v => !v)}>＋ Fattura</button>}
        </div>
      </div>
      {err && <div className="err mb">{err}</div>}

      {formF && (
        <div className="mPanel">
          <h3>Nuovo fornitore</h3>
          <div className="formgrid">
            <div className="field"><span>Nome</span><input value={nuovoF.nome} onChange={e => setNuovoF({ ...nuovoF, nome: e.target.value })} /></div>
            <div className="field"><span>P.IVA</span><input value={nuovoF.piva} onChange={e => setNuovoF({ ...nuovoF, piva: e.target.value })} /></div>
            <div className="field"><span>Email</span><input value={nuovoF.email} onChange={e => setNuovoF({ ...nuovoF, email: e.target.value })} /></div>
            <div className="field"><span>Telefono</span><input value={nuovoF.telefono} onChange={e => setNuovoF({ ...nuovoF, telefono: e.target.value })} /></div>
          </div>
          <button className="btn" onClick={creaFornitore} disabled={!nuovoF.nome}>Salva</button>
        </div>
      )}

      {formI && (
        <div className="mPanel">
          <h3>Nuova fattura fornitore</h3>
          <div className="formgrid">
            <div className="field"><span>Fornitore</span>
              <select value={nuovaI.supplier} onChange={e => setNuovaI({ ...nuovaI, supplier: e.target.value })}>
                <option value="">— scegli —</option>
                {fornitori.map(f => <option key={f._id} value={f._id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="field"><span>Numero fattura</span><input value={nuovaI.numero} onChange={e => setNuovaI({ ...nuovaI, numero: e.target.value })} /></div>
            <div className="field"><span>Anno</span><input type="number" value={nuovaI.anno} onChange={e => setNuovaI({ ...nuovaI, anno: e.target.value })} placeholder={String(new Date().getFullYear())} /></div>
            <div className="field"><span>Data documento</span><input type="date" value={nuovaI.dataDocumento} onChange={e => setNuovaI({ ...nuovaI, dataDocumento: e.target.value })} /></div>
            <div className="field"><span>Scadenza</span><input type="date" value={nuovaI.scadenza} onChange={e => setNuovaI({ ...nuovaI, scadenza: e.target.value })} /></div>
            <div className="field"><span>Imponibile €</span><input type="number" step="0.01" value={nuovaI.imponibile} onChange={e => setNuovaI({ ...nuovaI, imponibile: e.target.value })} /></div>
            <div className="field"><span>IVA €</span><input type="number" step="0.01" value={nuovaI.iva} onChange={e => setNuovaI({ ...nuovaI, iva: e.target.value })} /></div>
            <div className="field wide"><span>Allegato (PDF, XML, JPG, PNG — max 1 MB)</span>
              <input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" onChange={e => setAllegato(e.target.files?.[0] || null)} /></div>
          </div>
          <button className="btn" onClick={creaFattura} disabled={!nuovaI.supplier || !nuovaI.numero || !nuovaI.dataDocumento || !nuovaI.imponibile}>Registra fattura</button>
        </div>
      )}

      {pag && (
        <div className="mPanel">
          <div className="row between"><h3>Pagamento fattura {pag.numero} — residuo {euro(pag.totaleCent - pag.pagatoCent)}</h3>
            <button className="btn alt sm" onClick={() => setPag(null)}>✕</button></div>
          <div className="formgrid">
            <div className="field"><span>Importo €</span><input type="number" step="0.01" value={pagamento.importo} onChange={e => setPagamento({ ...pagamento, importo: e.target.value })} /></div>
            <div className="field"><span>Metodo</span>
              <select value={pagamento.metodo} onChange={e => setPagamento({ ...pagamento, metodo: e.target.value })}>{METODI.map(m => <option key={m}>{m}</option>)}</select>
            </div>
            <div className="field"><span>Data pagamento</span><input type="date" value={pagamento.data} onChange={e => setPagamento({ ...pagamento, data: e.target.value })} /></div>
          </div>
          <button className="btn" onClick={paga} disabled={!pagamento.importo || parseFloat(pagamento.importo) <= 0}>Registra pagamento (uscita cassa)</button>
        </div>
      )}

      {tab === 'conti' && (
        <table className="tbl">
          <thead><tr><th>Fornitore</th><th>Contatti</th><th className="r">Fatturato</th><th className="r">Pagato</th><th className="r">Saldo</th></tr></thead>
          <tbody>
            {fornitori.map(f => (
              <tr key={f._id}>
                <td><b>{f.nome}</b>{f.piva && <small> · P.IVA {f.piva}</small>}</td>
                <td>{f.email} {f.telefono} {f.contatti}</td>
                <td className="r">{euro(f.dovutoCent)}</td>
                <td className="r">{euro(f.pagatoCent)}</td>
                <td className={`r ${f.saldoCent > 0 ? 'neg' : ''}`}><b>{euro(f.saldoCent)}</b></td>
              </tr>
            ))}
            {!fornitori.length && <tr><td colSpan={5} className="muted">Nessun fornitore registrato.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'fatture' && (
        <table className="tbl">
          <thead><tr><th>Fornitore</th><th>N./Anno</th><th>Data doc.</th><th>Scadenza</th><th className="r">Totale</th><th className="r">Residuo</th><th>Stato</th><th>Allegato</th><th /></tr></thead>
          <tbody>
            {fatture.map(f => (
              <tr key={f._id}>
                <td>{f.supplier?.nome}</td>
                <td>{f.numero}{f.anno ? `/${f.anno}` : ''}</td>
                <td>{dstr(f.dataDocumento)}</td>
                <td>{dstr(f.scadenza)}</td>
                <td className="r">{euro(f.totaleCent)}</td>
                <td className={`r ${f.totaleCent - f.pagatoCent > 0 ? 'neg' : ''}`}>{euro(f.totaleCent - f.pagatoCent)}</td>
                <td><span className={`tag ${f.stato === 'pagata' ? '' : 'wait'}`}>{f.stato}</span></td>
                <td>{f.allegato?.dati ? <button className="linkbtn" onClick={() => scaricaAllegato(f)}>apri</button> : <span className="tag off">manca</span>}</td>
                <td>{f.stato !== 'pagata' && <button className="linkbtn" onClick={() => { setPag(f); setPagamento({ ...pagamento, importo: ((f.totaleCent - f.pagatoCent) / 100).toFixed(2) }); }}>paga</button>}</td>
              </tr>
            ))}
            {!fatture.length && <tr><td colSpan={9} className="muted">Nessuna fattura registrata.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
