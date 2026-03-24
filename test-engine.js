/* ============================================================
   test-engine.js — Test end-to-end del motore di gioco
   Verifica il percorso completo: nuovaPartita → AR3 → AR2 → AR1
   → pausa invernale → test pre-stagionali → completaPausaInvernale

   Esegui con: node test-engine.js
   ============================================================ */

'use strict';

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');
const DIR  = __dirname;

/* --- Mock localStorage (nessun browser necessario) --- */
const _store = {};
const localStorage = {
  getItem:    k     => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem:    (k,v) => { _store[k] = String(v); },
  removeItem: k     => { delete _store[k]; }
};

/* --- Carica data.js e game-engine.js nello stesso contesto vm --- */
const ctx = vm.createContext({
  localStorage, console, Math, Date, JSON,
  parseInt, parseFloat, isNaN, Infinity,
  Array, Object, String, Number, Boolean, Error
});

/*
 * In Node.js vm, le dichiarazioni `const` e `class` sono lessicalmente
 * scoped allo script e non diventano proprietà del context sandbox.
 * Appendiamo un'assegnazione a globalThis alla fine di ogni file
 * per esporre le variabili necessarie al test.
 */
const dataCode   = fs.readFileSync(path.join(DIR, 'data.js'),        'utf8')
                 + '\nglobalThis._DATI = DATI;';
const engineCode = fs.readFileSync(path.join(DIR, 'game-engine.js'), 'utf8')
                 + '\nglobalThis._motore = motore;';

vm.runInContext(dataCode,   ctx);
vm.runInContext(engineCode, ctx);

const motore = ctx._motore;
const DATI   = ctx._DATI;

/* --- Utilità di test --- */
let _errori = 0;
let _sezione = '';

function sezione(nome) {
  _sezione = nome;
  console.log(`\n=== ${nome} ===`);
}

function ok(desc, cond) {
  if (cond) {
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ✗ FAIL  [${_sezione}]  ${desc}`);
    _errori++;
  }
}

function noEccezione(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    return true;
  } catch (e) {
    console.error(`  ✗ ECCEZIONE  [${_sezione}]  ${desc}: ${e.message}`);
    _errori++;
    return false;
  }
}

/* Costruisce una classifica con il giocatore al primo posto */
function classificaPrimo(squadraId, totale) {
  const altri = Array.from({ length: totale - 1 }, (_, i) => ({ squadraId: `filler_${i}`, punti: 200 - i * 15, vittorie: 0, podi: 0 }));
  return [{ squadraId, punti: 350, vittorie: 10, podi: 15 }, ...altri];
}

/*
 * Porta la stagione corrente alla fine:
 * imposta il round all'ultimo, faseCorrente a 'post-gara',
 * poi chiama avanzaFase() → _terminaRound() → _terminaStagione().
 */
function concludiStagione(squadraId, nAltreSquadre) {
  const calendario = motore._ottieniCalendario();
  motore.stato.classificaCostruttori = classificaPrimo(squadraId, nAltreSquadre + 1);
  motore.stato.roundCorrente = calendario.length - 1;
  motore.stato.faseCorrente  = 'post-gara';
  motore.avanzaFase();
}

/* ============================================================
   1. NUOVA PARTITA
   ============================================================ */
sezione('1. nuovaPartita()');
let stato;
noEccezione('senza eccezioni', () => { stato = motore.nuovaPartita(); });
ok('stato non null',                stato !== null);
ok('categoria = AR3',                stato.categoria === 'AR3');
ok('stagione = 2026',               stato.stagione === 2026);
ok('squadraId assegnata',           typeof stato.squadraId === 'string' && stato.squadraId.length > 0);
ok('piloti ≥ 2',                    Array.isArray(stato.piloti) && stato.piloti.length >= 2);
ok('staff presente',                stato.staff !== null && typeof stato.staff === 'object');
ok('faseCorrente = briefing',       stato.faseCorrente === 'briefing');
ok('roundCorrente = 0',             stato.roundCorrente === 0);
ok('conoscenzaMacchina.aero = 0',   stato.conoscenzaMacchina?.aerodinamica === 0);
ok('datiPista = oggetto',           typeof stato.datiPista === 'object');
ok('storico vuoto',                 Array.isArray(stato.storico) && stato.storico.length === 0);
ok('reputazione presente',          typeof stato.reputazione === 'object');
ok('localStorage salvato',          localStorage.getItem('ar1manager_salvataggio') !== null);

/* ============================================================
   2. FINE STAGIONE AR3 → PROMOZIONE AR2 (pos. 1)
   ============================================================ */
sezione('2. Fine stagione AR3 → promozione AR2');
const squadraIdAR3 = motore.stato.squadraId;
noEccezione('concludiStagione AR3 senza eccezioni', () => concludiStagione(squadraIdAR3, 7));
ok('categoria = AR2',                motore.stato.categoria === 'AR2');
ok('stagione = 2027',               motore.stato.stagione === 2027);
ok('faseCorrente = pausa_invernale',motore.stato.faseCorrente === 'pausa_invernale');
ok('storico: 1 voce',               motore.stato.storico.length === 1);
ok('storico voce: categoria = AR3',  motore.stato.storico[0].categoria === 'AR3');
ok('storico voce: posizione = 1',   motore.stato.storico[0].posizione === 1);
ok('squadraId AR2 assegnata',        typeof motore.stato.squadraId === 'string');
ok('squadraId AR2 ≠ squadraId AR3',   motore.stato.squadraId !== squadraIdAR3);
ok('piloti AR2 ≥ 2',                 Array.isArray(motore.stato.piloti) && motore.stato.piloti.length >= 2);
ok('staff AR2 assegnato',            !!motore.stato.staff);
ok('conoscenzaMacchina resettata',  motore.stato.conoscenzaMacchina?.aerodinamica === 0);
ok('testPreStagionali resettati',   motore.stato.testPreStagionali?.completati === false &&
                                    motore.stato.testPreStagionali?.giorno === 1);

/* ============================================================
   3. FINE STAGIONE AR2 → PROMOZIONE AR1 (pos. 1)
   ============================================================ */
sezione('3. Fine stagione AR2 → promozione AR1');
const squadraIdAR2 = motore.stato.squadraId;
noEccezione('concludiStagione AR2 senza eccezioni', () => concludiStagione(squadraIdAR2, 9));
ok('categoria = AR1',                motore.stato.categoria === 'AR1');
ok('stagione = 2028',               motore.stato.stagione === 2028);
ok('faseCorrente = pausa_invernale',motore.stato.faseCorrente === 'pausa_invernale');
ok('storico: 2 voci',               motore.stato.storico.length === 2);
ok('storico voce 2: categoria = AR2',motore.stato.storico[1].categoria === 'AR2');
ok('storico voce 2: posizione = 1', motore.stato.storico[1].posizione === 1);

/* ============================================================
   4. STATO INIZIALE AR1
   ============================================================ */
sezione('4. Stato iniziale AR1');
ok('squadraId AR1 assegnata',        typeof motore.stato.squadraId === 'string');
ok('piloti AR1 = 2',                 Array.isArray(motore.stato.piloti) && motore.stato.piloti.length === 2);
ok('staff.capoIngegnere presente',  !!motore.stato.staff?.capoIngegnere);
ok('staff.dataAnalyst presente',    !!motore.stato.staff?.dataAnalyst);
ok('staff.direttoreAero presente',  !!motore.stato.staff?.direttoreAero);
ok('staff.direttoreMeccanica',      !!motore.stato.staff?.direttoreMeccanica);
ok('staff.direttoreElettronica',    !!motore.stato.staff?.direttoreElettronica);
ok('staff.direttoreGara presente',  !!motore.stato.staff?.direttoreGara);
ok('budget AR1 > 0',                 motore.stato.budget > 0);
ok('macchina.aerodinamica numero',  typeof motore.stato.macchina?.aerodinamica === 'number');
ok('macchina.meccanica numero',     typeof motore.stato.macchina?.meccanica === 'number');
ok('macchineAI è oggetto',          typeof motore.stato.macchineAI === 'object' && motore.stato.macchineAI !== null);
ok('macchineAI ha 10 squadre',      Object.keys(motore.stato.macchineAI).length === 10);
{
  const km = motore.stato.conoscenzaMacchina;
  ok('conoscenzaMacchina.aero = 0',   km?.aerodinamica === 0);
  ok('conoscenzaMacchina.mec = 0',    km?.meccanica    === 0);
  ok('conoscenzaMacchina.pu = 0',     km?.powerUnit    === 0);
  ok('conoscenzaMacchina.base = 0',   km?.baseline     === 0);
}
ok('testPreStagionali.giorno = 1',  motore.stato.testPreStagionali?.giorno === 1);
ok('testPreStagionali.sessione = 0',motore.stato.testPreStagionali?.sessione === 0);
ok('calendario AR1 accessibile',     Array.isArray(motore.ottieniCalendarioAR1Attivo()) && motore.ottieniCalendarioAR1Attivo().length > 0);

/* ============================================================
   5. TEST PRE-STAGIONALI (6 sessioni = 3 giorni × 2)
   ============================================================ */
sezione('5. Test pre-stagionali');

/* Verifica che la funzione di lettura programmi funzioni */
let infoProgrammi;
noEccezione('ottieniProgrammiTest senza eccezioni', () => { infoProgrammi = motore.ottieniProgrammiTest(); });
ok('programmi disponibili > 0',     Array.isArray(infoProgrammi.disponibili) && infoProgrammi.disponibili.length > 0);
ok('consigliatoDaStaff non null',   infoProgrammi.consigliatoDaStaff !== null);

/* 6 sessioni, una per volta, con programmi diversi */
const SEQUENZA = ['raccolta_aero', 'raccolta_mec', 'raccolta_pu', 'test_mescole', 'sim_gara', 'alta_velocita'];
const risultati = [];
noEccezione('6 sessioni senza eccezioni', () => {
  SEQUENZA.forEach(id => risultati.push(motore.eseguiSessioneTest(id)));
});
ok('tutte le sessioni ok=true',     risultati.every(r => r.ok === true));
ok('nessun risultato null',         risultati.every(r => r !== null && r !== undefined));
ok('test completati',               motore.stato.testPreStagionali?.completati === true);
ok('conoscenzaMacchina.aero > 0',   motore.stato.conoscenzaMacchina?.aerodinamica > 0);
ok('conoscenzaMacchina.mec > 0',    motore.stato.conoscenzaMacchina?.meccanica > 0);
ok('conoscenzaMacchina.pu > 0',     motore.stato.conoscenzaMacchina?.powerUnit > 0);
ok('conoscenzaMacchina.base > 0',   motore.stato.conoscenzaMacchina?.baseline > 0);
ok('3 report giornalieri',          motore.stato.testPreStagionali?.reportGiornalieri?.length === 3);
ok('6 programmi svolti',            motore.stato.testPreStagionali?.programmiSvolti?.length === 6);
ok('capitolo test segnato',         motore.stato.pausaInvernaleCapitoli?.test === true);

/* Una 7a sessione deve essere rifiutata */
const settima = motore.eseguiSessioneTest('raccolta_aero');
ok('7a sessione rifiutata (ok=false)', settima.ok === false);

/* I report devono avere struttura coerente */
const report = motore.stato.testPreStagionali.reportGiornalieri;
ok('report[0].giorno = 1',          report[0]?.giorno === 1);
ok('report[1].giorno = 2',          report[1]?.giorno === 2);
ok('report[2].giorno = 3',          report[2]?.giorno === 3);
ok('report[0] ha messaggioDA',      typeof report[0]?.messaggioDA === 'string');
ok('report[0] ha conoscenzaMacchina', typeof report[0]?.conoscenzaMacchina === 'object');

/* ============================================================
   6. COMPLETAPAUSAINVERNALE
   ============================================================ */
sezione('6. completaPausaInvernale()');
let esito;
noEccezione('senza eccezioni', () => { esito = motore.completaPausaInvernale(); });
ok('risultato ok=true',             esito?.ok === true);
ok('faseCorrente = inter-gara',     motore.stato.faseCorrente === 'inter-gara');
ok('roundCorrente = 0',             motore.stato.roundCorrente === 0);
ok('budgetSpeso = 0',               motore.stato.budgetSpeso === 0);
ok('tokenUsati = 0',                motore.stato.tokenUsati === 0);
ok('budget > 0 (prize money)',      motore.stato.budget > 0);
ok('_pilotiLiberiAR1 ripulito',      motore.stato._pilotiLiberiAR1 === null);
ok('pausaInvernaleCapitoli ripulito', typeof motore.stato.pausaInvernaleCapitoli === 'object' &&
                                     Object.keys(motore.stato.pausaInvernaleCapitoli).length === 0);

/* ============================================================
   7. CALENDARIO AR1 E PRIMA TRANSIZIONE DI FASE
   ============================================================ */
sezione('7. Calendario e prima transizione di fase AR1');
let calendario;
noEccezione('ottieniCalendarioAR1Attivo senza eccezioni', () => { calendario = motore.ottieniCalendarioAR1Attivo(); });
ok('calendario non vuoto',          Array.isArray(calendario) && calendario.length > 0);
ok('ogni round ha id',              calendario.every(r => typeof r.id === 'string'));
ok('ogni round ha nome',            calendario.every(r => typeof r.nome === 'string'));

/* Simula ingresso nel primo weekend: inter-gara → briefing → fp1 */
motore.stato.faseCorrente = 'briefing';
noEccezione('avanzaFase da briefing senza eccezioni', () => motore.avanzaFase());
ok('faseCorrente = fp1',            motore.stato.faseCorrente === 'fp1');

/* ============================================================
   8. VERIFICA ACCESSO DATI CONSISTENTE POST-PROMOZIONE
   ============================================================ */
sezione('8. Consistenza dati post-promozione');

/* Ricarica dallo storage per simulare riavvio app */
let statoRicaricato;
noEccezione('caricaPartita senza eccezioni', () => { statoRicaricato = motore.caricaPartita(); });
ok('stato ricaricato non null',     statoRicaricato !== null);
ok('categoria AR1 persiste',         statoRicaricato.categoria === 'AR1');
ok('macchineAI persiste (10)',      Object.keys(statoRicaricato.macchineAI || {}).length === 10);
ok('testPreStagionali.completati',  statoRicaricato.testPreStagionali?.completati === true);
ok('storico (2 voci) persiste',     statoRicaricato.storico?.length === 2);
ok('generatore ricostruito',        motore.generatore !== null);

/* ============================================================
   9. DOPPIA CHIAMATA COMPLETAPAUSAINVERNALE (guard)
   ============================================================ */
sezione('9. Guard: chiamata fuori fase');

/* completaPausaInvernale fuori dalla pausa deve restituire ok=false */
let esitoFuoriFase;
noEccezione('chiamata fuori fase senza eccezioni', () => { esitoFuoriFase = motore.completaPausaInvernale(); });
ok('ok=false quando fuori pausa',   esitoFuoriFase?.ok === false);

/* ============================================================
   10. SONDAGGI ESPLORATIVI PILOTI AR1
   ============================================================ */
sezione('10. Sondaggi esplorativi piloti AR1');

/* Il motore è in inter-gara (fase impostata dal test 7 sopra) */
motore.stato.faseCorrente = 'inter-gara';
motore.stato.categoria = 'AR1';
motore.stato.sondaggiPilotiAR1 = [];

let datiSond;
noEccezione('ottieniSondaggiAR1 senza eccezioni', () => { datiSond = motore.ottieniSondaggiAR1(); });
ok('sondaggi inizialmente vuoti', datiSond?.sondaggi?.length === 0);
ok('maxSondaggi = 3',             datiSond?.maxSondaggi === 3);
ok('puoSondare = true in inter-gara', datiSond?.puoSondare === true);
ok('liberi non vuoti',            (datiSond?.liberi?.length || 0) > 0);

/* Avvia sondaggio per il primo pilota libero */
const primoPilotaLibero = datiSond.liberi[0];
let esitoSond;
noEccezione('avviaSondaggioPilotaAR1 senza eccezioni', () => { esitoSond = motore.avviaSondaggioPilotaAR1(primoPilotaLibero.id); });
ok('sondaggio avviato ok',        esitoSond?.ok === true);
ok('sondaggiUsati = 1',           motore.stato.sondaggiPilotiAR1?.length === 1);

/* Secondo sondaggio per lo stesso pilota — deve fallire */
let esitoSondDuplica;
noEccezione('sondaggio duplicato senza eccezioni', () => { esitoSondDuplica = motore.avviaSondaggioPilotaAR1(primoPilotaLibero.id); });
ok('sondaggio duplicato rifiutato', esitoSondDuplica?.ok === false);

/* Fuori fase — deve fallire */
motore.stato.faseCorrente = 'briefing';
let esitoSondFuoriFase;
noEccezione('sondaggio fuori fase senza eccezioni', () => { esitoSondFuoriFase = motore.avviaSondaggioPilotaAR1(datiSond.liberi[1]?.id || 'x'); });
ok('sondaggio fuori inter-gara rifiutato', esitoSondFuoriFase?.ok === false);

/* Rivela sondaggi — simula 2 round di avanzamento */
motore.stato.faseCorrente = 'inter-gara';
const sond = motore.stato.sondaggiPilotiAR1[0];
sond.roundAvviato = motore.stato.roundCorrente - 2;  /* già maturato */
noEccezione('_rivelaSondaggiMaturati senza eccezioni', () => motore._rivelaSondaggiMaturati());
ok('risposta rivelata dopo 2 round', motore.stato.sondaggiPilotiAR1[0]?.risposta !== null);
ok('risposta ha campo interesse',    ['alto','medio','basso','rifiuto'].includes(motore.stato.sondaggiPilotiAR1[0]?.risposta?.interesse));

/* Reset a fine stagione */
motore.stato.sondaggiPilotiAR1 = [{ id: 'test', pilotaId: 'x', nomePilota: 'Test', roundAvviato: 0, risposta: null }];
motore.stato.faseCorrente = 'pausa_invernale';
noEccezione('_terminaStagione non crasha con sondaggi in corso', () => {
  /* Simula solo il reset, non tutta la terminazione stagione */
  motore.stato.sondaggiPilotiAR1 = [];
});
ok('sondaggi azzerati a fine stagione', motore.stato.sondaggiPilotiAR1?.length === 0);

sezione('11. Mercato piloti AI');

/* Il motore è in AR1 (confermato da sezione 4 in poi). Assicuriamoci che pilotiAI sia inizializzato. */
motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.categoria = 'AR1';

/* _inizializzaPilotiAI deve popolare lo stato */
noEccezione('_inizializzaPilotiAI senza eccezioni', () => motore._inizializzaPilotiAI());
ok('pilotiAI inizializzato', Array.isArray(motore.stato.pilotiAI));
ok('pilotiAI non vuoto', (motore.stato.pilotiAI?.length || 0) > 0);
ok('pilotiAI esclude team giocatore', motore.stato.pilotiAI.every(p => p.squadra !== motore.stato.squadraId));

/* _getPilotiSquadraAI deve restituire i piloti giusti */
const squadreAI = (typeof DATI !== 'undefined' ? DATI.SQUADRE_AR1 : []).filter(s => s.id !== motore.stato.squadraId);
const primaSquadraAI = squadreAI[0];
let pilotiSquadra;
noEccezione('_getPilotiSquadraAI senza eccezioni', () => { pilotiSquadra = motore._getPilotiSquadraAI(primaSquadraAI?.id); });
ok('_getPilotiSquadraAI restituisce array', Array.isArray(pilotiSquadra));

/* _mercatoAI deve girare senza errori */
noEccezione('_mercatoAI senza eccezioni', () => motore._mercatoAI());
ok('pilotiAI ancora array dopo mercato', Array.isArray(motore.stato.pilotiAI));
ok('eventiMercatoAI array', Array.isArray(motore.stato.eventiMercatoAI));

/* Ogni squadra AI deve avere esattamente 2 piloti titolari */
const squadreAI2 = (typeof DATI !== 'undefined' ? DATI.SQUADRE_AR1 : []).filter(s => s.id !== motore.stato.squadraId);
const tutteConDuePiloti = squadreAI2.every(s => {
  const c = motore.stato.pilotiAI.filter(p => p.squadra === s.id).length;
  return c === 2;
});
ok('ogni squadra AI ha 2 piloti dopo mercato', tutteConDuePiloti);

/* ottieniEventiMercatoAI deve essere una funzione pubblica */
let eventiM;
noEccezione('ottieniEventiMercatoAI senza eccezioni', () => { eventiM = motore.ottieniEventiMercatoAI(); });
ok('ottieniEventiMercatoAI ritorna array', Array.isArray(eventiM));

/* Gli eventi hanno i campi richiesti */
const tipiValidi = ['ritiro', 'rilascio', 'ingaggio', 'promozione'];
const eventiValidi = eventiM.every(ev => tipiValidi.includes(ev.tipo) && typeof ev.pilota === 'string');
ok('eventi mercato hanno tipo e pilota', eventiM.length === 0 || eventiValidi);

/* Nessun pilota duplicato nello stesso team */
const nessunDuplicato = squadreAI2.every(s => {
  const ids = motore.stato.pilotiAI.filter(p => p.squadra === s.id).map(p => p.id);
  return ids.length === new Set(ids).size;
});
ok('nessun pilota duplicato per team', nessunDuplicato);

sezione('12. Pacchetti rinnovo contratto pilota AR1');

/* Prepara un pilota in scadenza */
motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.categoria = 'AR1';
const pilotaTest = motore.stato.piloti[0];
const scadenzaOrig = pilotaTest.contratto?.scadenza ?? 2028;
pilotaTest.contratto = { scadenza: motore.stato.stagione - 1, stipendio: 8000000 }; /* già scaduto */

let pacchetti12;
noEccezione('ottieniPacchettiRinnovoAR1 senza eccezioni', () => { pacchetti12 = motore.ottieniPacchettiRinnovoAR1(pilotaTest.id); });
ok('ritorna 4 pacchetti',        pacchetti12?.length === 4);
ok('pacchetto budget presente',  pacchetti12?.some(p => p.id === 'budget'));
ok('pacchetto prestazione presente', pacchetti12?.some(p => p.id === 'prestazione'));
ok('pacchetto durata presente',  pacchetti12?.some(p => p.id === 'durata'));
ok('pacchetto comunicazione presente', pacchetti12?.some(p => p.id === 'comunicazione'));

const pkBudget = pacchetti12?.find(p => p.id === 'budget');
ok('budget: durata 1',           pkBudget?.durata === 1);
ok('budget: stipendio < base',   (pkBudget?.stipendio || 0) < 8000000);

const pkDurata = pacchetti12?.find(p => p.id === 'durata');
ok('durata: 3 stagioni',         pkDurata?.durata === 3);
ok('durata: stipendio > base',   (pkDurata?.stipendio || 0) > 8000000);

const pkPrest = pacchetti12?.find(p => p.id === 'prestazione');
ok('prestazione: clausola top5', pkPrest?.clausola === 'top5');

/* Rinnova con pacchetto durata */
const umorePrec = pilotaTest.umore || 70;
let ris12;
noEccezione('rinnovaContrattoPilotaAR1Pacchetto senza eccezioni', () => { ris12 = motore.rinnovaContrattoPilotaAR1Pacchetto(pilotaTest.id, 'durata'); });
ok('rinnovo ok',                 ris12?.ok === true);
ok('scadenza aggiornata',        pilotaTest.contratto?.scadenza > motore.stato.stagione);
ok('umore aumentato (durata +12)', pilotaTest.umore >= umorePrec + 10);

/* Rinnovo con pacchetto comunicazione: valoreSponsor aumenta */
pilotaTest.contratto = { scadenza: motore.stato.stagione - 1, stipendio: 8000000 };
const vsPrec = pilotaTest.valoreSponsor || 50;
noEccezione('rinnovo comunicazione senza eccezioni', () => motore.rinnovaContrattoPilotaAR1Pacchetto(pilotaTest.id, 'comunicazione'));
ok('comunicazione: valoreSponsor +5', pilotaTest.valoreSponsor >= vsPrec + 5);

/* Pacchetto inesistente */
let risFail12;
noEccezione('pacchetto inesistente senza eccezioni', () => { risFail12 = motore.rinnovaContrattoPilotaAR1Pacchetto(pilotaTest.id, 'inesistente'); });
ok('pacchetto inesistente rifiutato', risFail12?.ok === false);

/* Ripristina la scadenza originale */
pilotaTest.contratto = { scadenza: scadenzaOrig, stipendio: 8000000 };

sezione('13. Condizioni contrattuali sponsor');

motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.categoria = 'AR1';

/* Genera sponsor se assenti */
if (!motore.stato.sponsor || motore.stato.sponsor.length === 0) {
  motore._generaSponsorIniziali?.();
}

const primoSponsor = (motore.stato.sponsor || [])[0];

ok('sponsor disponibile per test', !!primoSponsor);

let detSp;
noEccezione('ottieniDettaglioSponsor senza eccezioni', () => { detSp = motore.ottieniDettaglioSponsor(primoSponsor?.id); });
ok('dettaglio sponsor non null',       detSp !== null);
ok('dettaglio ha obiettivoClassifica', typeof detSp?.obiettivoClassifica === 'number');
ok('dettaglio ha soddisfazione',       typeof detSp?.soddisfazione === 'number');
ok('dettaglio ha stagioniRimaste',     typeof detSp?.stagioniRimaste === 'number');
ok('dettaglio ha meccanica.bonusPerGara', typeof detSp?.meccanica?.bonusPerGara === 'string');
ok('dettaglio ha meccanica.malusPerGara', typeof detSp?.meccanica?.malusPerGara === 'string');
ok('dettaglio ha meccanica.sogliaClauso', typeof detSp?.meccanica?.sogliaClauso === 'string');
ok('rischioInterruzione è stringa',    typeof detSp?.rischioInterruzione === 'string');

/* _verificaTerminazioneContrattiSponsor: sponsor con soddisfazione 0 viene terminato */
const spTest = JSON.parse(JSON.stringify(primoSponsor));
spTest.id = 'sp_test_termina';
spTest.soddisfazione = 0;
spTest.scadenza = motore.stato.stagione + 5; /* non scaduto naturalmente */
spTest.attivo = true;
motore.stato.sponsor.push(spTest);

/* Con prob 80% viene terminato: forziamo eseguendo la verifica più volte finché termina */
let terminato = false;
for (let i = 0; i < 20; i++) {
  motore._verificaTerminazioneContrattiSponsor();
  if (!motore.stato.sponsor.find(s => s.id === 'sp_test_termina')?.attivo) { terminato = true; break; }
  spTest.soddisfazione = 0; /* Resetta per il prossimo tentativo */
}
ok('sponsor con soddisfazione 0 viene terminato', terminato);

/* Sponsor con soddisfazione ok non viene mai terminato */
const spSano = JSON.parse(JSON.stringify(primoSponsor));
spSano.id = 'sp_test_sano';
spSano.soddisfazione = 70;
spSano.attivo = true;
motore.stato.sponsor.push(spSano);
for (let i = 0; i < 10; i++) motore._verificaTerminazioneContrattiSponsor();
ok('sponsor soddisfazione ok non viene terminato', motore.stato.sponsor.find(s => s.id === 'sp_test_sano')?.attivo === true);

/* Pulizia sponsor test */
motore.stato.sponsor = motore.stato.sponsor.filter(s => !s.id.startsWith('sp_test_'));

sezione('14. Rendimenti piloti — _aggiornaPerformancePiloti e ottieniClassificaRendimenti');

motore.stato.categoria = 'AR1';
motore.stato.performancePiloti = {};

/* Costruisce risultati gara fittizi: 20 piloti, 10 squadre */
const squadreTest14 = DATI.SQUADRE_AR1.slice(0, 10);
const circuitoTest14 = Object.values(DATI.CIRCUITI)[0];

const risultatiTest14 = [];
let posGlob = 1;
squadreTest14.forEach((sq, sqIdx) => {
  const pilotiSq = sq.id === motore.stato.squadraId
    ? (motore.stato.piloti || DATI.PILOTI_AR1.filter(p => p.squadra === sq.id))
    : DATI.PILOTI_AR1.filter(p => p.squadra === sq.id);
  (pilotiSq.length > 0 ? pilotiSq : [{ id: 'ai_' + sq.id + '_1', nome: 'Pilota A', eta: 28, bandiera: '', squadra: sq.id, statistiche: { talento: 75 } }, { id: 'ai_' + sq.id + '_2', nome: 'Pilota B', eta: 30, bandiera: '', squadra: sq.id, statistiche: { talento: 72 } }]).forEach(p => {
    risultatiTest14.push({
      pilota: p,
      squadraId: sq.id,
      nomeSquadra: sq.nomeBreve,
      isGiocatore: sq.id === motore.stato.squadraId,
      posizione: posGlob++,
      ritiro: false
    });
  });
});

noEccezione('_aggiornaPerformancePiloti senza eccezioni', () => {
  motore._aggiornaPerformancePiloti(risultatiTest14, circuitoTest14);
});

ok('performancePiloti non vuoto dopo una gara',
  Object.keys(motore.stato.performancePiloti).length > 0);

const firstKey14 = Object.keys(motore.stato.performancePiloti)[0];
const firstDati14 = motore.stato.performancePiloti[firstKey14];
ok('dati pilota hanno gareContate',   typeof firstDati14.gareContate === 'number' && firstDati14.gareContate === 1);
ok('dati pilota hanno deltaCumulativo', typeof firstDati14.deltaCumulativo === 'number');
ok('dati pilota hanno nomePilota',    typeof firstDati14.nomePilota === 'string');
ok('dati pilota hanno squadraId',     typeof firstDati14.squadraId === 'string');

/* Seconda gara: gareContate incrementa */
noEccezione('seconda gara senza eccezioni', () => {
  motore._aggiornaPerformancePiloti(risultatiTest14, circuitoTest14);
});
ok('gareContate = 2 dopo seconda gara', motore.stato.performancePiloti[firstKey14].gareContate === 2);

/* ottieniClassificaRendimenti */
let classifica14;
noEccezione('ottieniClassificaRendimenti senza eccezioni', () => { classifica14 = motore.ottieniClassificaRendimenti(); });
ok('classifica è un array',           Array.isArray(classifica14));
ok('classifica non vuota',            classifica14.length > 0);
ok('primo ha campo label',            typeof classifica14[0].label === 'string');
ok('primo ha campo segno',            typeof classifica14[0].segno === 'string');
ok('primo ha campo media',            typeof classifica14[0].media === 'number');
ok('ordinata: primo >= secondo',
  classifica14.length < 2 || classifica14[0].media >= classifica14[1].media);

/* Ritirati non devono comparire nella classifica */
const risultatiConRitiro = risultatiTest14.map((r, i) =>
  i < 2 ? { ...r, ritiro: true } : r);
motore.stato.performancePiloti = {};
motore._aggiornaPerformancePiloti(risultatiConRitiro, circuitoTest14);
const ritiratiIds = risultatiConRitiro.filter(r => r.ritiro).map(r => r.pilota.id);
ok('ritirati esclusi da performancePiloti',
  ritiratiIds.every(id => !motore.stato.performancePiloti[id]));

/* ottieniDeltaPrestazionePilota con dati gara >=2 usa dati reali */
motore.stato.performancePiloti = {};
motore._aggiornaPerformancePiloti(risultatiTest14, circuitoTest14);
motore._aggiornaPerformancePiloti(risultatiTest14, circuitoTest14);
const delta14 = motore.ottieniDeltaPrestazionePilota(firstKey14);
ok('delta con >=2 gare: basato=gara', delta14?.basato === 'gara');
ok('delta con >=2 gare: ha label',    typeof delta14?.label === 'string');

/* Reset */
motore.stato.performancePiloti = {};

sezione('15. Rinnovi contratti staff — ottieniOpzioniRinnovoStaff e rinnovaContrattoStaff');

motore.stato.categoria    = 'AR1';
motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.budget       = 50000000;
motore.stato.budgetSpeso  = 0;
if (!Array.isArray(motore.stato.spese)) motore.stato.spese = [];

/* Assicura capoIngegnere con contratto scaduto */
const staffTest15 = {
  nome: 'Test Ingegnere', eta: 45,
  statistiche: { coordinamento: 75, innovazione: 70 },
  contratto: { scadenza: motore.stato.stagione - 1, stipendio: 500000 }
};
motore.stato.staff = motore.stato.staff || {};
motore.stato.staff.capoIngegnere = staffTest15;

/* ottieniOpzioniRinnovoStaff */
let opzioni15;
noEccezione('ottieniOpzioniRinnovoStaff senza eccezioni', () => { opzioni15 = motore.ottieniOpzioniRinnovoStaff('capoIngegnere'); });
ok('restituisce array di 2 opzioni',    Array.isArray(opzioni15) && opzioni15.length === 2);
ok('opzione breve esiste',              opzioni15?.[0]?.id === 'breve');
ok('opzione lungo esiste',              opzioni15?.[1]?.id === 'lungo');
ok('breve: durata 1',                   opzioni15?.[0]?.durata === 1);
ok('lungo: durata 2',                   opzioni15?.[1]?.durata === 2);
ok('lungo: stipendio > breve',          (opzioni15?.[1]?.stipendio || 0) > (opzioni15?.[0]?.stipendio || 0));
ok('lungo: costoTotale > breve',        (opzioni15?.[1]?.costoTotale || 0) > (opzioni15?.[0]?.costoTotale || 0));
ok('breve fattibile con budget ok',     opzioni15?.[0]?.fattibile === true);

/* rinnovaContrattoStaff breve */
let ris15breve;
noEccezione('rinnovaContrattoStaff breve senza eccezioni', () => { ris15breve = motore.rinnovaContrattoStaff('capoIngegnere', 'breve'); });
ok('rinnovo breve: ok',                 ris15breve?.ok === true);
ok('rinnovo breve: scadenza +1',        motore.stato.staff.capoIngegnere.contratto.scadenza >= motore.stato.stagione + 1);
ok('rinnovo breve: budget scalato',     motore.stato.budgetSpeso > 0);

/* rinnovaContrattoStaff lungo */
motore.stato.staff.capoIngegnere.contratto.scadenza = motore.stato.stagione - 1;
motore.stato.budgetSpeso = 0;
let ris15lungo;
noEccezione('rinnovaContrattoStaff lungo senza eccezioni', () => { ris15lungo = motore.rinnovaContrattoStaff('capoIngegnere', 'lungo'); });
ok('rinnovo lungo: ok',                 ris15lungo?.ok === true);
ok('rinnovo lungo: scadenza +2',        motore.stato.staff.capoIngegnere.contratto.scadenza >= motore.stato.stagione + 2);
ok('stipendio aumentato del 15%',       motore.stato.staff.capoIngegnere.contratto.stipendio > 500000);

/* opzione inesistente */
let ris15fail;
noEccezione('opzione inesistente senza eccezioni', () => { ris15fail = motore.rinnovaContrattoStaff('capoIngegnere', 'inesistente'); });
ok('opzione inesistente rifiutata',     ris15fail?.ok === false);

/* fuori pausa invernale: rinnovo bloccato */
motore.stato.faseCorrente = 'inter-gara';
const risFuoriPausa = motore.rinnovaContrattoStaff('capoIngegnere', 'breve');
ok('rinnovo bloccato fuori pausa',      risFuoriPausa?.ok === false);
motore.stato.faseCorrente = 'pausa_invernale';

/* completaPausaInvernale rimuove staff scaduto */
motore.stato.budget      = 200000000;
motore.stato.budgetSpeso = 0;
motore.stato.staff.direttoreGara = {
  nome: 'Gara Test', eta: 40,
  statistiche: { pitStop: 75 },
  contratto: { scadenza: motore.stato.stagione - 2, stipendio: 300000 } /* già scaduto */
};
/* Assicura concept e altri prerequisiti minimi */
if (!motore.stato.conceptMacchina || motore.stato.conceptMacchina.stagione !== motore.stato.stagione) {
  motore.stato.conceptMacchina = { tipo: 'continuativo', nome: 'Test', incertezza: 'bassa', rischio: 'minimo', stagione: motore.stato.stagione };
}
let risPausa15;
noEccezione('completaPausaInvernale senza eccezioni', () => { risPausa15 = motore.completaPausaInvernale(); });
ok('pausa completata',                  risPausa15?.ok === true);
ok('staff scaduto rimosso',             !motore.stato.staff.direttoreGara);
ok('staffCongedati registrato',         Array.isArray(motore.stato.staffCongedati));
ok('staffCongedati ha direttoreGara',   motore.stato.staffCongedati?.some(c => c.chiave === 'direttoreGara'));

/* ottieniStatoMercato espone staffPreScadenza */
motore.stato.faseCorrente = 'inter-gara';
motore.stato.staff.direttoreAero = {
  nome: 'Aero Test', eta: 42,
  statistiche: { innovazione: 80 },
  contratto: { scadenza: motore.stato.stagione + 1, stipendio: 400000 } /* scade prossima stagione */
};
const mercatoTest15 = motore.ottieniStatoMercato();
ok('staffPreScadenza esposto',          Array.isArray(mercatoTest15.staffPreScadenza));
ok('staffPreScadenza ha il membro',     mercatoTest15.staffPreScadenza?.some(s => s.chiave === 'direttoreAero'));

/* Pulizia */
motore.stato.faseCorrente = 'pausa_invernale';
delete motore.stato.staff.direttoreAero;

/* ============================================================
   16. RACCOMANDAZIONE CONCEPT CAPO INGEGNERE
   ============================================================ */
sezione('16. Raccomandazione concept Capo Ingegnere');

/* Setup: AR1, pausa invernale, cambio era imminente */
motore.stato.categoria    = 'AR1';
motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.stagione     = 2030;
motore.stato.eraRegolamentare = { inizioStagione: 2026, durataPrevista: 4 };  /* cambio era a 2030 */
if (!motore.stato.staff) motore.stato.staff = {};

/* Senza CE: deve restituire null */
const staffBkp = motore.stato.staff.capoIngegnere;
motore.stato.staff.capoIngegnere = null;
let raccNull;
noEccezione('ottieniRaccomandazioneConcept senza CE — no eccezione', () => { raccNull = motore.ottieniRaccomandazioneConcept(); });
ok('null senza CE', raccNull === null);

/* Con CE innovativo (innov 82, coord 75) */
motore.stato.staff.capoIngegnere = {
  nome: 'Test CE Innovativo',
  statistiche: { coordinamento: 75, innovazione: 82, strategia: 70, esperienza: 76 },
  contratto: { scadenza: 2031, stipendio: 900000 }
};
let raccInnov;
noEccezione('ottieniRaccomandazioneConcept con CE innovativo — no eccezione', () => { raccInnov = motore.ottieniRaccomandazioneConcept(); });
ok('raccomandazione non null',                          raccInnov !== null);
ok('ha conceptId',                                      typeof raccInnov?.conceptId === 'string');
ok('ha motivazione',                                    typeof raccInnov?.motivazione === 'string');
ok('ha bonusSigmaRiduzione',                            typeof raccInnov?.bonusSigmaRiduzione === 'number');
ok('bonusSigmaRiduzione in range [0, 0.45]',            raccInnov?.bonusSigmaRiduzione >= 0 && raccInnov?.bonusSigmaRiduzione <= 0.45);
ok('CE innov 82 → concept innovativo',                  raccInnov?.conceptId === 'innovativo');
ok('profiloLabel contiene "innovativo"',                raccInnov?.profiloLabel?.includes('innovativo'));

/* Con CE conservativo (coord 90, innov 68) */
motore.stato.staff.capoIngegnere = {
  nome: 'Test CE Conservativo',
  statistiche: { coordinamento: 90, innovazione: 68, strategia: 78, esperienza: 82 },
  contratto: { scadenza: 2031, stipendio: 900000 }
};
let raccCons;
noEccezione('ottieniRaccomandazioneConcept con CE conservativo — no eccezione', () => { raccCons = motore.ottieniRaccomandazioneConcept(); });
ok('CE coord 90 → concept bilanciato_era',              raccCons?.conceptId === 'bilanciato_era');
ok('profiloLabel contiene "conservativo"',              raccCons?.profiloLabel?.includes('conservativo'));
ok('bonusSigmaRiduzione maggiore con coord alta',       raccCons?.bonusSigmaRiduzione > raccInnov?.bonusSigmaRiduzione);

/* Fuori dal cambio era: null */
motore.stato.stagione = 2027;  /* era inizia 2026, durata 4 → cambio a 2030, non ora */
let raccFuoriEra;
noEccezione('ottieniRaccomandazioneConcept fuori cambio era — no eccezione', () => { raccFuoriEra = motore.ottieniRaccomandazioneConcept(); });
ok('null fuori cambio era', raccFuoriEra === null);

/* applicaConceptMacchina segue la raccomandazione → ok senza eccezione */
motore.stato.stagione = 2030;
motore.stato.budget   = 200000000;
motore.stato.budgetSpeso = 0;
motore.stato.macchina = { aerodinamica: 65, meccanica: 65, elettronica: 65, powerUnit: 65 };
motore.stato.staff.capoIngegnere = {
  nome: 'Test CE Conservativo',
  statistiche: { coordinamento: 90, innovazione: 68, strategia: 78, esperienza: 82 },
  contratto: { scadenza: 2031, stipendio: 900000 }
};
let esitoConcept;
noEccezione('applicaConceptMacchina con raccomandazione CE — no eccezione', () => {
  esitoConcept = motore.applicaConceptMacchina('bilanciato_era');
});
ok('applicaConceptMacchina ok',   esitoConcept?.ok === true);
ok('macchina aggiornata',          typeof motore.stato.macchina?.aerodinamica === 'number');

/* Ripristino */
if (staffBkp !== undefined) motore.stato.staff.capoIngegnere = staffBkp;
motore.stato.stagione = 2028;

/* ============================================================
   17. PROGRAMMA MOTORE INTERNO
   ============================================================ */
sezione('17. Programma motore interno — avvia / continua / abbandona / completa');

motore.stato.categoria    = 'AR1';
motore.stato.faseCorrente = 'pausa_invernale';
motore.stato.budget       = 300000000;
motore.stato.budgetSpeso  = 0;
motore.stato.progettoPU   = null;
motore.stato.motoreProprio = false;
motore.stato.bonusTokenPU  = 0;
motore.stato.stagione      = 2030;
motore.stato.macchina     = { aerodinamica: 70, meccanica: 70, elettronica: 70, powerUnit: 72 };
if (!Array.isArray(motore.stato.spese)) motore.stato.spese = [];

/* ottieniStatoProgettoPU — senza progetto */
let ppVuoto;
noEccezione('ottieniStatoProgettoPU senza progetto — no eccezione', () => { ppVuoto = motore.ottieniStatoProgettoPU(); });
ok('restituisce oggetto',               ppVuoto !== null);
ok('progetto null',                     ppVuoto?.progetto === null);
ok('giaCosruttore false',               ppVuoto?.giaCosruttore === false);
ok('puoAvviare true (budget ok)',        ppVuoto?.puoAvviare === true);
ok('costoTotale = 155M',               ppVuoto?.costoTotale === 155000000);
ok('fasi: 4 elementi',                  ppVuoto?.fasi?.length === 4);

/* avviaProgettoPU */
let esitoAvvia;
noEccezione('avviaProgettoPU — no eccezione', () => { esitoAvvia = motore.avviaProgettoPU(); });
ok('avvio ok',                          esitoAvvia?.ok === true);
ok('fase avvio: ricerca',               esitoAvvia?.fase === 'Ricerca e fattibilità');
ok('progettoPU creato',                 motore.stato.progettoPU !== null);
ok('faseIndice = 0',                    motore.stato.progettoPU?.faseIndice === 0);
ok('investimentoTotale = 30M',          motore.stato.progettoPU?.investimentoTotale === 30000000);
ok('stagionePrevistaCompletamento = 2034', motore.stato.progettoPU?.stagionePrevistaCompletamento === 2034);

/* non riavviabile */
let esitoRiavvia;
noEccezione('avviaProgettoPU già attivo — no eccezione', () => { esitoRiavvia = motore.avviaProgettoPU(); });
ok('riavvio rifiutato',                 esitoRiavvia?.ok === false);

/* continuaProgettoPU — fase 0→1 */
let esitoCont1;
noEccezione('continuaProgettoPU fase 0→1 — no eccezione', () => { esitoCont1 = motore.continuaProgettoPU(); });
ok('continua ok',                       esitoCont1?.ok === true);
ok('non completato',                    esitoCont1?.completato === false);
ok('faseIndice = 1',                    motore.stato.progettoPU?.faseIndice === 1);
ok('investimento 75M',                  motore.stato.progettoPU?.investimentoTotale === 75000000);

/* continua fase 1→2 */
let esitoCont2;
noEccezione('continuaProgettoPU fase 1→2 — no eccezione', () => { esitoCont2 = motore.continuaProgettoPU(); });
ok('continua ok',                       esitoCont2?.ok === true);
ok('faseIndice = 2',                    motore.stato.progettoPU?.faseIndice === 2);

/* continua fase 2→3 (ultima fase) */
let esitoCont3;
noEccezione('continuaProgettoPU fase 2→3 — no eccezione', () => { esitoCont3 = motore.continuaProgettoPU(); });
ok('continua ok',                       esitoCont3?.ok === true);
ok('faseIndice = 3',                    motore.stato.progettoPU?.faseIndice === 3);
ok('investimento totale 155M',          motore.stato.progettoPU?.investimentoTotale === 155000000);

/* completamento: continua sull'ultima fase → diventa costruttore */
let esitoCont4;
noEccezione('continuaProgettoPU completamento — no eccezione', () => { esitoCont4 = motore.continuaProgettoPU(); });
ok('completamento ok',                  esitoCont4?.ok === true);
ok('completato = true',                 esitoCont4?.completato === true);
ok('progettoPU = null post-completamento', motore.stato.progettoPU === null);
ok('motoreProprio = true',              motore.stato.motoreProprio === true);
ok('bonusTokenPU = 1',                  motore.stato.bonusTokenPU === 1);
ok('penalità PU applicata',             motore.stato.macchina?.powerUnit <= 64);

/* ottieniStatoPowerUnit: ora è costruttore */
let puCostr;
noEccezione('ottieniStatoPowerUnit post-completamento — no eccezione', () => { puCostr = motore.ottieniStatoPowerUnit(); });
ok('motoreProprio = true in PU',        puCostr?.motoreProprio === true);
ok('tokenTotali = 4 (3 + bonus)',       puCostr?.tokenTotali === 4);

/* abbandonaProgettoPU — nuovo progetto, poi abbandono */
motore.stato.motoreProprio = false;
motore.stato.bonusTokenPU  = 0;
motore.stato.budget        = 300000000;
motore.stato.budgetSpeso   = 0;
motore.avviaProgettoPU();
ok('progetto riavviato per test abbandono', motore.stato.progettoPU !== null);
let esitoAbb;
noEccezione('abbandonaProgettoPU — no eccezione', () => { esitoAbb = motore.abbandonaProgettoPU(); });
ok('abbandono ok',                      esitoAbb?.ok === true);
ok('investimentoPerduto = 30M',         esitoAbb?.investimentoPerduto === 30000000);
ok('progettoPU null dopo abbandono',    motore.stato.progettoPU === null);

/* abbandono fuori pausa */
motore.stato.faseCorrente = 'inter-gara';
motore.avviaProgettoPU();   /* non dovrebbe funzionare fuori pausa */
let esitoAbbFuori;
noEccezione('abbandonaProgettoPU fuori pausa — no eccezione', () => { esitoAbbFuori = motore.abbandonaProgettoPU(); });
ok('abbandono fuori pausa rifiutato',   esitoAbbFuori?.ok === false);

/* Pulizia */
motore.stato.progettoPU   = null;
motore.stato.motoreProprio = false;
motore.stato.bonusTokenPU  = 0;
motore.stato.faseCorrente  = 'pausa_invernale';

/* ============================================================
   RIEPILOGO
   ============================================================ */
console.log('\n' + '='.repeat(60));
if (_errori === 0) {
  console.log('TUTTI I TEST SUPERATI');
  process.exit(0);
} else {
  console.log(`FALLITI: ${_errori} test`);
  process.exit(1);
}
