import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const fmtOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const TAG: Record<string, { t: string; c: string }> = {
  prenotato: { t: 'Da confermare', c: 'wait' },
  confermato: { t: 'Confermato', c: '' },
  completato: { t: 'Completato', c: '' },
  annullato: { t: 'Annullato', c: 'off' },
  no_show: { t: 'No show', c: 'off' },
};

export default function Dashboard() {
  const [oggi, setOggi] = useState<any[]>([]);
  const [clienti, setClienti] = useState(0);
  const [settimana, setSettimana] = useState(0);
  const [daConfermare, setDaConfermare] = useState(0);
  const [ordiniAperti, setOrdiniAperti] = useState(0);
  const [scorte, setScorte] = useState(0);

  useEffect(() => {
    api.get('/appointments/today').then(r => setOggi(r.data || [])).catch(() => {});
    api.get('/clients').then(r => setClienti((r.data || []).length)).catch(() => {});
    api.get('/orders', { params: { stato: 'inserito' } }).then(r => setOrdiniAperti((r.data || []).length)).catch(() => {});
    api.get('/products', { params: { attivi: '1' } }).then(r =>
      setScorte((r.data || []).filter((p: any) => p.giacenzaMinima > 0 && p.giacenza <= p.giacenzaMinima).length)).catch(() => {});
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    api.get('/appointments', { params: { from, to } }).then(r => {
      const futuri = (r.data || []).filter((a: any) => a.stato !== 'annullato' && a.stato !== 'completato');
      setSettimana(futuri.length);
      setDaConfermare(futuri.filter((a: any) => a.stato === 'prenotato').length);
    }).catch(() => {});
  }, []);

  return (
    <div className="fade-in">
      <div className="dashgrid">
        <div className="stat"><span className="small">APPUNTAMENTI OGGI</span><strong>{oggi.length}</strong></div>
        <div className="stat"><span className="small">PROSSIMI 7 GIORNI</span><strong>{settimana}</strong></div>
        <div className="stat"><span className="small">DA CONFERMARE</span><strong>{daConfermare}</strong></div>
        <div className="stat"><span className="small">ORDINI DA GESTIRE</span><strong>{ordiniAperti}</strong></div>
        <div className="stat"><span className="small">CARTELLE CLIENTI</span><strong>{clienti}</strong></div>
        <div className="stat"><span className="small">SOTTO SCORTA</span><strong>{scorte}</strong></div>
      </div>

      <div className="twocol">
        <div className="mPanel">
          <h3>Agenda di oggi</h3>
          {oggi.length === 0 && <div className="empty"><b>Nessun appuntamento oggi</b>Le prenotazioni dal sito appariranno qui in tempo reale.</div>}
          {oggi.map(a => (
            <div key={a._id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <strong style={{ minWidth: 48 }}>{fmtOra(a.data)}</strong>
              <span className="grow"><strong>{a.client?.firstName} {a.client?.lastName}</strong> — {a.service?.nome}</span>
              <span className={`tag ${TAG[a.stato]?.c || ''}`}>{TAG[a.stato]?.t || a.stato}</span>
            </div>
          ))}
          <div className="mt"><Link to="/gestionale/agenda"><button className="btn alt">Apri l'agenda completa →</button></Link></div>
        </div>
        <div className="mPanel">
          <h3>Azioni rapide</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <Link to="/gestionale/agenda"><button className="btn" style={{ width: '100%' }}>＋ Nuovo appuntamento</button></Link>
            <Link to="/gestionale/clienti"><button className="btn alt" style={{ width: '100%' }}>✦ Nuova cartella cliente</button></Link>
            <Link to="/gestionale/ordini"><button className="btn alt" style={{ width: '100%' }}>☰ Gestisci ordini shop</button></Link>
            <Link to="/gestionale/cassa"><button className="btn alt" style={{ width: '100%' }}>▤ Apri cassa</button></Link>
            <a href="/" target="_blank" rel="noreferrer"><button className="btn alt" style={{ width: '100%' }}>◈ Vedi il sito prenotazioni</button></a>
            <a href="/shop" target="_blank" rel="noreferrer"><button className="btn alt" style={{ width: '100%' }}>✿ Vedi lo shop online</button></a>
          </div>
          <p className="small mt">Le prenotazioni fatte dai clienti sul sito entrano direttamente in agenda con stato «da confermare».</p>
        </div>
      </div>
    </div>
  );
}
