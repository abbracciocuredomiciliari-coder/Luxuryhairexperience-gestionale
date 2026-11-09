# Luxury Hair Experience — Gestionale

Gestionale completo per il salone, con **sito pubblico di prenotazione** collegato all'agenda reale e **cartella cliente** accessibile via link riservato.

Identità visiva: verde bosco `#173e32` / `#174c3c`, salvia `#e0edda`, sfondo `#f4f7f3`, font Inter — come la demo `luxury.html`.

## Struttura

```
backend/   Express + TypeScript + MongoDB (Mongoose), JWT
frontend/  React + TypeScript + Vite (sito pubblico + area riservata)
```

## Avvio rapido

```bash
npm run install:all        # installa dipendenze di backend e frontend
cp backend/.env.example backend/.env   # configura MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD
npm run seed               # crea admin + listino servizi base
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
| Sito prenotazioni | `/` | Cliente sceglie servizio → data → fascia libera → dati → conferma |
| Cartella cliente | `/cartella?t=…` | Accesso via link magico: prossimi appuntamenti, storico, annulla |
| Accesso via email | `/` (box in fondo) | Richiede link alla propria cartella (SMTP da collegare) |
| Panoramica | `/gestionale` | KPI oggi/settimana, agenda del giorno |
| Agenda | `/gestionale/agenda` | Calendario settimanale vero, nuovo appuntamento, conferma/annulla |
| Clienti | `/gestionale/clienti` | Cartelle clienti con profilo armocromia, note, link di accesso |
| Listino | `/gestionale/servizi` | Servizi prenotabili, durata, prezzo, attivo/disattivo |

## Regole operative

- Le fasce libere tengono conto di orari apertura (09–19), pausa (13–14), domenica chiusa e appuntamenti già occupati — niente doppie prenotazioni
- Le prenotazioni dal sito entrano come **«Da confermare»**: il salone conferma dall'agenda
- Il cliente annulla da solo solo appuntamenti **futuri** dalla sua cartella

## Da collegare dopo (predisposto)

- **SMTP/email**: quando esiste `info@luxuryhairexperience.it` compilare `SMTP_*` nel `.env`; i link cartella e le conferme verranno inviati via email (endpoint già pronti, `TODO` nel codice)
- Orari di apertura per operatore e sedie multiple (oggi: unica agenda unificata)
- Notifiche promemoria appuntamenti
