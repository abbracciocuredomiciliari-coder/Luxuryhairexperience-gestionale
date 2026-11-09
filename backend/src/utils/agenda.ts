import Appointment from '../models/Appointment';
import Operator from '../models/Operator';

export const toMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
export const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Conflitto intervallo per OPERATORE: un operatore non può essere in due
// reparti o due sedi alla stessa ora. Controlla l'intero intervallo.
// Anche le richieste attive (prenotato/confermato) riservano il tempo.
export async function operatoreOccupato(operatorId: any, inizio: Date, fine: Date, escludiId?: any) {
  const q: any = {
    operator: operatorId,
    stato: { $nin: ['annullato', 'no_show'] },
    data: { $lt: fine },
    fine: { $gt: inizio },
  };
  if (escludiId) q._id = { $ne: escludiId };
  return Appointment.findOne(q);
}

// Turno dell'operatore per un giorno specifico.
// turni[0]=domenica … turni[6]=sabato. Se turni assente → orario salone.
export function turnoDel(operator: any, data: Date) {
  const dow = data.getDay();
  const t = operator.turni?.[dow];
  const ds = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  if ((operator.assenze || []).includes(ds)) return null;
  if (!t) {
    return dow === 0 ? null : { inizio: '09:00', fine: '19:00', pausaInizio: '13:00', pausaFine: '14:00' };
  }
  return t.attivo ? t : null;
}

// Fasce libere di UN operatore per un giorno e una durata.
export async function slotOperatore(operator: any, dataStr: string, durata: number, passo = 30) {
  const giorno = new Date(`${dataStr}T12:00:00`);
  const turno = turnoDel(operator, giorno);
  if (!turno) return [];
  const occupati = await Appointment.find({
    operator: operator._id,
    stato: { $nin: ['annullato', 'no_show'] },
    data: { $gte: new Date(`${dataStr}T00:00:00`), $lte: new Date(`${dataStr}T23:59:59.999`) },
  });
  const apertura = toMin(turno.inizio), chiusura = toMin(turno.fine);
  const pA = turno.pausaInizio ? toMin(turno.pausaInizio) : -1;
  const pB = turno.pausaFine ? toMin(turno.pausaFine) : -1;
  const oggi = new Date();
  const out: { ora: string; libera: boolean }[] = [];
  for (let m = apertura; m + durata <= chiusura; m += passo) {
    const inizio = new Date(`${dataStr}T${toHHMM(m)}:00`);
    const fine = new Date(inizio.getTime() + durata * 60000);
    if (inizio <= oggi) continue;
    if (pA >= 0 && m < pB && m + durata > pA) continue;
    const conflitto = occupati.some(a => a.data < fine && a.fine > inizio);
    out.push({ ora: toHHMM(m), libera: !conflitto });
  }
  return out;
}

// Per il sito: operatori attivi su un reparto (o tutti)
export async function operatoriReparto(reparto?: string) {
  const q: any = { attivo: true };
  if (reparto) q.reparti = reparto;
  return Operator.find(q).sort({ ordine: 1, nome: 1 });
}
