import { useState } from 'react';
import { Link } from 'react-router-dom';

type Stagione = {
  id: string; label: string; sottotitolo: string; metallo: string;
  descrizione: string; evita: string; colori: { nome: string; hex: string }[];
};

const STAGIONI: Stagione[] = [
  {
    id: 'primavera', label: 'Primavera', sottotitolo: 'Calda · chiara · brillante',
    metallo: 'Oro giallo e rame',
    descrizione: 'Colori vivi e luminosi che accendono l\'incarnato dorato. Via libera a coralli, verdi freschi e neutri caldi.',
    evita: 'Nero puro, grigi freddi, toni polvere spenti',
    colori: [
      { nome: 'Corallo', hex: '#f2664c' }, { nome: 'Pesca', hex: '#ffb08a' },
      { nome: 'Albicocca', hex: '#f4a261' }, { nome: 'Verde prato', hex: '#8fbf5f' },
      { nome: 'Turchese chiaro', hex: '#5cc8c0' }, { nome: 'Giallo caldo', hex: '#f4d35e' },
      { nome: 'Camel', hex: '#c1915c' }, { nome: 'Avorio', hex: '#f5eedd' },
    ],
  },
  {
    id: 'estate', label: 'Estate', sottotitolo: 'Fredda · chiara · delicata',
    metallo: 'Argento e oro rosa chiaro',
    descrizione: 'Sfumature polverose e fresche che esaltano l\'incarnato rosato. Rosa, azzurri e grigi perla sono i tuoi alleati.',
    evita: 'Arancio, nero a contatto col viso, colori troppo saturi',
    colori: [
      { nome: 'Rosa cipria', hex: '#e8b4b8' }, { nome: 'Lavanda', hex: '#b8a9c9' },
      { nome: 'Azzurro polvere', hex: '#9bb7d4' }, { nome: 'Grigio perla', hex: '#b7b8bc' },
      { nome: 'Jeans chiaro', hex: '#7a9cc6' }, { nome: 'Malva', hex: '#a05c7b' },
      { nome: 'Verde salvia', hex: '#a9bca2' }, { nome: 'Bianco latte', hex: '#f3f0ea' },
    ],
  },
  {
    id: 'autunno', label: 'Autunno', sottotitolo: 'Calda · scura · intensa',
    metallo: 'Oro, bronzo e ottone',
    descrizione: 'Toni di terra profondi che scaldano l\'incarnato ambrato. Ruggine, oliva e bordeaux ti valorizzano.',
    evita: 'Rosa freddo, grigi ghiaccio, pastelli freddi',
    colori: [
      { nome: 'Ruggine', hex: '#b7410e' }, { nome: 'Terracotta', hex: '#c4714b' },
      { nome: 'Senape', hex: '#d4a017' }, { nome: 'Verde oliva', hex: '#6b7c3f' },
      { nome: 'Cioccolato', hex: '#5c3a21' }, { nome: 'Bordeaux', hex: '#7a2e3d' },
      { nome: 'Teal scuro', hex: '#2d6a6a' }, { nome: 'Beige caldo', hex: '#d9c29a' },
    ],
  },
  {
    id: 'inverno', label: 'Inverno', sottotitolo: 'Fredda · scura · contrastata',
    metallo: 'Argento e platino',
    descrizione: 'Contrasti netti e colori pieni che fanno risaltare l\'incarnato freddo. Nero, bianco ottico e gioielli freddi.',
    evita: 'Beige, arancio, toni caldi e impolverati',
    colori: [
      { nome: 'Nero', hex: '#1a1a1a' }, { nome: 'Bianco ottico', hex: '#ffffff' },
      { nome: 'Rosso rubino', hex: '#a4133c' }, { nome: 'Blu royal', hex: '#2f3fbf' },
      { nome: 'Fucsia', hex: '#c9184a' }, { nome: 'Smeraldo', hex: '#146b52' },
      { nome: 'Antracite', hex: '#3d4451' }, { nome: 'Viola', hex: '#5a189a' },
    ],
  },
];

export default function ArmoProva() {
  const [stagione, setStagione] = useState<Stagione>(STAGIONI[0]);
  const [drape, setDrape] = useState<{ nome: string; hex: string }>(STAGIONI[0].colori[0]);

  const scegliStagione = (s: Stagione) => { setStagione(s); setDrape(s.colori[0]); };

  return (
    <section className="section armo-prova" id="prova-palette">
      <div className="section-head">
        <div>
          <p className="eyebrow">SPERIMENTA DAL SITO</p>
          <h2>Prova i colori<br /><em>addosso.</em></h2>
        </div>
        <p className="section-description">Esplora le quattro stagioni e poi prova davvero capelli e vestiti sulla tua foto.</p>
      </div>

      <div className="armo-grid">
        {/* Esplora stagioni */}
        <div className="armo-panel">
          <div className="armo-tabs" role="tablist" aria-label="Stagioni armocromatiche">
            {STAGIONI.map(s => (
              <button key={s.id} role="tab" aria-selected={stagione.id === s.id}
                className={stagione.id === s.id ? 'on' : ''}
                onClick={() => scegliStagione(s)}>{s.label}</button>
            ))}
          </div>
          <div className="armo-stagione">
            <h3>{stagione.label} <span className="armo-sub">{stagione.sottotitolo}</span></h3>
            <div className="armo-palette">
              {stagione.colori.map(c => (
                <button key={c.nome} className={`armo-sw ${drape.nome === c.nome ? 'sel' : ''}`}
                  style={{ background: c.hex }}
                  title={c.nome} aria-label={`Colore ${c.nome}`}
                  onClick={() => setDrape(c)} />
              ))}
            </div>
            <p className="armo-desc">{stagione.descrizione}</p>
            <div className="armo-meta">
              <span><b>Metalli:</b> {stagione.metallo}</span>
              <span><b>Da evitare:</b> {stagione.evita}</span>
            </div>
          </div>
        </div>

        {/* Invito alla prova vera su /prova-colori */}
        <div className="armo-panel armo-cta-panel">
          <span className="armo-upload-icon">✦</span>
          <h3>Cambia davvero<br />capelli e vestito</h3>
          <p>
            Scatta un selfie o carica una foto: riconosciamo capelli e vestito e li ricoloriamo
            davvero — con <b>{drape.nome.toLowerCase()}</b> della stagione {stagione.label} o con la
            tinta che preferisci. Puoi anche dipingere la zona col pennello.
          </p>
          <p className="armo-cta-privacy">La foto resta sul tuo dispositivo: niente invii, niente registrazioni.</p>
          <Link className="armo-btn" to="/prova-colori">Prova i tuoi colori <span>→</span></Link>
        </div>
      </div>

      <p className="armo-note">
        Indicazione dimostrativa: gli schermi mostrano i colori in modo diverso dalla luce naturale.
        La stagione si firma in salone, con i drappi veri e la consulente che ti segue.
      </p>
    </section>
  );
}
