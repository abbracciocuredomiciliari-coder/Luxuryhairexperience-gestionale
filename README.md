# Luxury Hair Experience — Gestionale

Gestionale completo per il salone, con **sito pubblico di prenotazione** collegato all'agenda reale multi-operatore, **cartella cliente** via link riservato, cassa, vendite, boutique, ordini, fornitori, armocromia e area commercialista.

Identità visiva: verde bosco `#173e32` / `#174c3c`, salvia `#e0edda`, sfondo `#f4f7f3`, font Inter — come la demo `luxury.html`.

## Struttura

```
backend/   Express + TypeScript + MongoDB (Mongoose), JWT, ruoli
frontend/  React + TypeScript + Vite (sito pubblico + area riservata)
```

## Avvio rapido

```bash
npm run install:all        # installa dipendenze di backend e frontend
cp backend/.env.example backend/.env   # configura MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD
npm run seed               # admin + 7 operatori + listino + boutique + fornitori
npm run dev:backend        # API su http://localhost:4100
npm run dev:frontend       # app su http://localhost:5173
```

## Accesso admin

- URL gestionale: `/gestionale/login`
- Email: **info@luxuryhairexperience.it**
- Password: quella impostata in `ADMIN_PASSWORD` nel `.env` al momento del seed (default `Luxury2026!` — cambiarla subito da `/api/auth/change-password`)

## Funzioni

| Area | Percorso | Cosa fa |
|---|---|---|
| Sito prenotazioni | `/` | Servizio → professionista (o primo disponibile) → data → fascia libera → dati → conferma |
| Cartella cliente | `/cartella?t=…` | Link magico: prossimi appuntamenti, storico, annulla futuri |
| Panoramica | `/gestionale` | KPI oggi/settimana, agenda del giorno |
| Agenda | `/gestionale/agenda` | Vista **giorno per operatore** o **settimana**, filtri reparto/operatore, nuovo appuntamento con fasce libere, conferma/completa/annulla/no-show |
| Clienti | `/gestionale/clienti` | Cartelle con profilo, note, link di accesso |
| Armocromia | `/gestionale/armocromia` | Consulenze: stagione, palette, operatrice, note |
| Listino | `/gestionale/servizi` | Servizi prenotabili con reparto, durata, prezzo |
| Cassa | `/gestionale/cassa` | Movimenti entrata/uscita per metodo (contanti/POS/MyPOS/bonifico) e reparto, **chiusura di giornata** atteso vs contato, storico |
| Vendite | `/gestionale/vendite` | Scontrino interno **NON FISCALE**: righe prodotti/servizi, scarico scorte automatico, incasso automatico in cassa, storno con ripristino, riferimento documento RT |
| Boutique | `/gestionale/boutique` | Catalogo, prezzi, giacenze, scorte minime, rettifiche |
| Ordini | `/gestionale/ordini` | Ordini multiriga con scarico scorte, preparazione/consegna/annullamento (ripristino scorte), incasso manuale anti-doppio |
| Fornitori | `/gestionale/fornitori` | Conti dare/avere, fatture ricevute con allegato (PDF/XML/JPG/PNG ≤1MB), pagamenti parziali → uscita cassa idempotente, duplicati per numero/anno bloccati |
| Commercialista | `/gestionale/commercialista` | Riepiloghi periodo, saldo per metodo/reparto, valore scorte, fatture con data documento ≠ data pagamento, controlli (allegati mancanti, vendite senza rif. fiscale), CSV, stampa, **backup JSON completo** |
| Operatori | `/gestionale/operatori` | Turni settimanali per operatore, pause, ferie/assenze, reparti abilitati, assegnazione appuntamenti scoperti |

## Regole operative

- **Multi-operatore**: 5 parrucchiere + estetista + onicotecnica (seed). Ogni operatore ha reparti abilitati e turni settimanali con pausa; ferie e assenze bloccano le giornate
- **Conflitti server**: un operatore non può essere impegnato in due appuntamenti sovrapposti — il controllo copre l'intero intervallo (anche in reparti diversi); le richieste attive riservano il tempo, l'annullamento lo libera
- **Disponibilità pubblica**: il sito mostra solo fasce libere, mai dati di altre clienti; il salone assegna o conferma dall'agenda
- **Vendite**: lo scarico scorte è atomico con guard sulla giacenza (niente giacenze negative né doppi scarichi); l'incasso in cassa è un movimento collegato — mai doppio. Storno = ripristino scorte + movimento compensativo interno
- **Fatture fornitori**: pagamenti parziali atomici, eccedenza rifiutata, duplicato per fornitore+numero+anno bloccato, allegati archiviati nel DB
- **Fiscale**: le vendite sono promemoria interni NON FISCALI — il documento fiscale si emette sul registratore telematico esterno e il riferimento si annota sulla vendita. Niente connessione RT né invio SDI finché non configurati

## Da collegare dopo (predisposto)

- **SMTP/email**: quando esiste `info@luxuryhairexperience.it` compilare `SMTP_*` nel `.env`; link cartella e conferme partiranno via email (endpoint già pronti)
- **Registratore telematico**: integrazione da fare con make/modello/protocollo reali — oggi solo campo riferimento manuale
- Dati legali azienda e P.IVA per intestazioni documenti

## Manutenzione

- `npm run seed` — idempotente, non duplica
- `npx tsx src/cleanup.ts` (in `backend/`) — rimuove i dati di collaudo (test/demo), da NON usare in produzione
- Backup/ripristino completo via `/api/backup` (admin), allegati inclusi
