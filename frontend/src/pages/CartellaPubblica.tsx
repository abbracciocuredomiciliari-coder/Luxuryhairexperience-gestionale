import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

const fmtData = (d: string) => new Date(d).toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const TAG: Record<string, { t: string; c: string }> = {
  prenotato: { t: 'In attesa di conferma', c: 'wait' },
  confermato: { t: 'Confermato', c: '' },
  completato: { t: 'Completato', c: '' },
  annullato: { t: 'Annullato', c: 'off' },
  no_show: { t: 'Mancato', c: 'off' },
};

export default function CartellaPubblica() {
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');

  const carica = () => api.get('/public/cartella', { params: { t } }).then(r => setData(r.data))
    .catch(e => setErr(e?.response?.data?.message || 'Link non valido'));
  useEffect(() => { carica(); }, [t]);

  const annulla = async (id: string) => {
    if (!confirm('Vuoi annullare questo appuntamento?')) return;
    await api.post('/public/cartella/annulla', { t, appointmentId: id });
    carica();
  };

  const futuri = (data?.appuntamenti || []).filter((a: any) => new Date(a.data) > new Date() && a.stato !== 'annullato');
  const passati = (data?.appuntamenti || []).filter((a: any) => !(new Date(a.data) > new Date() && a.stato !== 'annullato'));

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="logo">LUXURY HAIR EXPERIENCE</div>
        <nav className="site-nav">
          <Link to="/">Prenota</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/cartella" className="on">La mia cartella</Link>
          <Link to="/gestionale/login" style={{ fontSize: 11, color: '#a8c7b8' }}>Area riservata</Link>
        </nav>
      </header>
      <div className="site-wrap" style={{ maxWidth: 720 }}>
        {err && <div className="mPanel"><div className="err">{err}</div><p className="small mt">Richiedi un nuovo link di accesso dalla <Link to="/" style={{ color: 'var(--forest)', fontWeight: 700 }}>pagina prenotazioni</Link>.</p></div>}
        {data && (
          <div className="fade-in">
            <div className="mPanel tac">
              <div className="avatar" style={{ margin: '0 auto 10px', width: 52, height: 52, fontSize: 20 }}>{data.cliente.firstName.slice(0, 1)}</div>
              <h2>La mia cartella</h2>
              <p className="small">{data.cliente.firstName} {data.cliente.lastName} · {data.cliente.email}</p>
            </div>

            <div className="mPanel">
              <h3>Prossimi appuntamenti</h3>
              {futuri.length === 0 && <div className="empty"><b>Nessun appuntamento in programma</b><Link to="/" style={{ color: 'var(--forest)', fontWeight: 700 }}>Prenota ora →</Link></div>}
              {futuri.map((a: any) => (
                <div key={a._id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="grow">
                    <strong>{a.service?.nome}</strong><br />
                    <span className="small">{fmtData(a.data)}</span>
                  </div>
                  <span className={`tag ${TAG[a.stato]?.c || ''}`}>{TAG[a.stato]?.t || a.stato}</span>
                  <button className="btn danger sm" onClick={() => annulla(a._id)}>Annulla</button>
                </div>
              ))}
            </div>

            {!!data.ordini?.length && (
              <div className="mPanel">
                <h3>I miei ordini</h3>
                {data.ordini.map((o: any) => (
                  <div key={o._id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div className="grow">
                      <strong>Ordine n. {o.numero}</strong> <span className="small">— € {(o.totaleCent / 100).toFixed(2)} · {o.consegna === 'ritiro' ? 'ritiro in salone' : 'consegna domicilio'}</span><br />
                      <span className="small">{o.righe.map((r: any) => `${r.quantita}× ${r.descrizione}`).join(', ')}</span>
                    </div>
                    <span className={`tag ${o.stato === 'annullato' ? 'off' : o.stato === 'inserito' ? 'wait' : ''}`}>
                      {{ inserito: 'Ricevuto', preparazione: 'In preparazione', consegnato: 'Consegnato', annullato: 'Annullato' }[o.stato as string] || o.stato}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mPanel">
              <h3>Storico</h3>
              {passati.length === 0 && <div className="empty"><b>Nessuno storico</b></div>}
              {passati.map((a: any) => (
                <div key={a._id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: .75 }}>
                  <div className="grow"><strong>{a.service?.nome}</strong> <span className="small">— {fmtData(a.data)}</span></div>
                  <span className={`tag ${TAG[a.stato]?.c || ''}`}>{TAG[a.stato]?.t || a.stato}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
