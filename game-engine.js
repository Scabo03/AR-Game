/* ============================================================
   GAME-ENGINE.JS — AR1 Manager
   Motore di simulazione: gara, qualifica, sviluppo tecnico,
   gestione stagione, AI squadre, sistema reputazione.
   ============================================================ */

'use strict';

/* ============================================================
   BENEFICI TECNICI SPONSOR — definizioni condivise
   Ogni tipo di beneficio ha: etichetta breve, descrizione
   estesa e categoria di effetto (per applicazione a fine stagione).
   ============================================================ */

const BENEFICI_TECNICI = {
  cfd_bonus: {
    etichetta: 'Capacità CFD +5%',
    descrizione: 'Il partner mette a disposizione capacità di calcolo aggiuntiva. Il tempo CFD effettivo disponibile aumenta del 5%.',
    effetto: 'cfd'
  },
  data_analyst_bonus: {
    etichetta: 'Analisi dati potenziata',
    descrizione: 'Il partner fornisce software proprietario e ingegneri dati specializzati. La precisione delle stime del Data Analyst migliora.',
    effetto: 'tecnica'
  },
  supporto_infrastrutturale: {
    etichetta: 'Supporto infrastrutturale',
    descrizione: 'Il partner fornisce attrezzatura e risorse per officina e impianti. Riduce i costi operativi delle infrastrutture interne.',
    effetto: 'tecnica'
  },
  visibilita_mediatica: {
    etichetta: 'Visibilità mediatica +80/stagione',
    descrizione: 'Partnership ad alta esposizione pubblica. La reputazione mediatica della squadra aumenta di 80 punti a fine stagione.',
    effetto: 'reputazione_mediatica'
  },
  reputazione_tecnica: {
    etichetta: 'Reputazione tecnica +50/stagione',
    descrizione: 'Partnership percepita come innovativa dal settore. La reputazione tecnica della squadra aumenta di 50 punti a fine stagione.',
    effetto: 'reputazione_tecnica'
  }
};

/* ============================================================
   GENERATORE NUMERI PSEUDO-CASUALI CON SEED
   Garantisce riproducibilità e coerenza tra sessioni
   ============================================================ */

class GeneratoreCasuale {
  constructor(seed) {
    this.stato = seed || Date.now();
  }

  /* Algoritmo mulberry32 */
  prossimo() {
    this.stato |= 0;
    this.stato = this.stato + 0x6D2B79F5 | 0;
    let z = Math.imul(this.stato ^ this.stato >>> 15, 1 | this.stato);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  }

  /* Numero casuale tra min e max (inclusi) */
  intervallo(min, max) {
    return Math.floor(this.prossimo() * (max - min + 1)) + min;
  }

  /* Booleano con probabilità data (0–1) */
  probabilita(p) {
    return this.prossimo() < p;
  }

  /* Elemento casuale da un array */
  dallaLista(lista) {
    return lista[Math.floor(this.prossimo() * lista.length)];
  }

  /* Numero casuale con distribuzione gaussiana approssimata */
  gaussiana(media, deviazione) {
    let u = 0, v = 0;
    while (u === 0) u = this.prossimo();
    while (v === 0) v = this.prossimo();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.round(media + z * deviazione);
  }
}

/* ============================================================
   TESTI TUTORIAL AR3 — introdotti progressivamente nella prima stagione
   ============================================================ */

const TUTORIAL_AR3 = {
  briefing: {
    titolo: 'Il briefing pre-weekend',
    testo: 'Il briefing apre ogni weekend di gara. Trovi le previsioni meteo, le mescole assegnate dalla Federazione e le note tecniche dello staff. Leggilo prima di procedere: queste informazioni guidano tutte le decisioni del weekend.'
  },
  fp1: {
    titolo: 'Le prove libere',
    testo: 'Le prove libere servono a raccogliere dati sul circuito. Scegli un programma di allenamento in base alle priorità del weekend. La qualità dei dati raccolti influenza le prestazioni in qualifica e in gara.'
  },
  qualifica: {
    titolo: 'La qualifica',
    testo: 'La qualifica stabilisce la griglia di partenza. In AR3 si svolge in sessione unica: tutti i piloti girano insieme e il miglior tempo determina la posizione in griglia.'
  },
  sprint: {
    titolo: 'La Sprint Race',
    testo: 'La Sprint Race parte con la griglia invertita dei primi dieci classificati in qualifica. Posizione 1 diventa 10, posizione 2 diventa 9 e così via. È una gara breve, circa un terzo della distanza della gara principale, con un sistema punti ridotto.'
  },
  gara: {
    titolo: 'La gara principale',
    testo: 'In gara è obbligatorio almeno un pit stop e usare due mescole diverse. Puoi scegliere quando rientrare ai box e su quale mescola montare. Gestisci il ritmo: spingere consuma le gomme più velocemente. I punti si assegnano ai primi quindici classificati.'
  },
  'post-gara': {
    titolo: 'Il resoconto post-gara',
    testo: 'Qui trovi i risultati della gara e la classifica aggiornata. Dopo ogni weekend puoi vedere la situazione del campionato prima di avanzare al prossimo appuntamento.'
  },
  'inter-gara': {
    titolo: 'Tra un weekend e l\'altro',
    testo: 'In AR3 le decisioni tra una gara e l\'altra sono limitate. Puoi consultare la classifica e il profilo dei tuoi piloti. Salendo di categoria, le opzioni disponibili in questo periodo aumenteranno significativamente.'
  },
  'sezione-economia': {
    titolo: 'Il budget in AR3',
    testo: 'In AR3 il budget è limitato e gestito dalla squadra. Le entrate principali arrivano dal prize money di fine stagione, proporzionale alla classifica costruttori. Tieni d\'occhio la sezione Management per verificare la situazione finanziaria.'
  },
  'sezione-persone': {
    titolo: 'I piloti e lo staff',
    testo: 'Qui trovi i profili dei tuoi piloti. L\'umore influenza le prestazioni in pista: un pilota soddisfatto rende di più. Puoi consultare le statistiche di staff e piloti per capire i punti di forza e di debolezza della squadra.'
  }
};

/* ============================================================
   STATO DEL GIOCO — struttura principale
   ============================================================ */

const STATO_INIZIALE = {
  versione: '1.0.0',
  categoria: null,         /* 'AR3' | 'AR2' | 'AR1' */
  stagione: 2026,
  roundCorrente: 0,        /* indice nel calendario corrente (0-based) */
  faseCorrente: null,      /* 'inter-gara' | 'briefing' | 'fp1' | 'fp2' | 'fp3' | 'qualifica' | 'sprint_qualifica' | 'sprint' | 'gara' | 'post-gara' | 'pausa_estiva' | 'pausa_invernale' */
  seedStagione: null,
  squadraId: null,
  reputazione: {
    tecnica: 800,
    performance: 800,
    mediatica: 600,
    finanziaria: 700,
    generale: 500
  },
  reputazioneInizioStagione: null, /* snapshot all'inizio stagione per calcolo trend */
  /* Solo AR1 */
  budget: 0,
  budgetSpeso: 0,
  /* Classifiche stagione corrente */
  classificaCostruttori: [],
  classificaPiloti: [],
  /* Dati tecnici macchina (solo AR1) */
  macchina: null,
  /* Staff corrente (solo AR1) */
  staff: null,
  /* Piloti correnti */
  piloti: [],
  /* Piano upgrade stagione corrente (solo AR1) */
  pianoUpgrade: [],
  /* Allocazione CFD/galleria del vento (solo AR1) */
  allocazioneCFD: { stagioneCorrente: 0.7, prossimaStagione: 0.3 },
  /* Dati FP raccolti nel weekend corrente */
  datiFP: { fp1: null, fp2: null, fp3: null },
  /* Bonus prestazione derivato dalle FP (solo AR3/AR2, -2..+2 percentuale) */
  bonusFPCorrente: 0,
  /* Griglia di partenza weekend corrente */
  grigliaPartenza: null,
  /* Risultati ultima gara disputata */
  ultimaGara: null,
  /* Risultati ultima sprint disputata */
  ultimaSprint: null,
  /* Stima corrente performance macchina (solo AR1) */
  stimaMacchina: null,
  /* Tutorial fasi già visti (solo AR3) */
  tutorialVisto: {},
  /* Riunione informativa AR1 già mostrata */
  riunioneAR1Vista: false,
  /* Storico stagioni precedenti */
  storico: [],
  /* Era regolamentare */
  eraRegolamentare: null,
  /* Seed del generatore corrente */
  seedCorrente: null,
  /* Stato qualifica AR1 (checkpoint-based) */
  statoQualificaAttivo: null,
  /* Stato gara AR1 (checkpoint-based) */
  statoGaraAttivo: null,
  /* Token motore usati nella stagione corrente (solo AR1 con motoreProprio) */
  tokenUsati: 0,
  /* Impianti produttivi (solo AR1) */
  factory: {
    galleriaVento:   { livello: 2, condizione: 80 },
    simulatore:      { livello: 2, condizione: 75 },
    officina:        { livello: 3, condizione: 85 },
    centroDati:      { livello: 2, condizione: 70 },
    strutturaMedica: { livello: 2, condizione: 90 }
  },
  investimentiFactory: [],
  /* Campi dinamici — inizializzati a null, valorizzati dal motore durante il gioco */
  eventoStagione: null,           /* 'salvataggio_crisi' o null */
  categoriaPregressa: null,       /* categoria prima di una promozione */
  tracciamentoCalendario: null,   /* rotazione circuiti AR1 */
  annunciRotazione: [],           /* comunicati entrata/uscita circuiti */
  calendarioAttivoAR1: null,       /* lista id circuiti attivi nella stagione corrente */
  sponsor: [],                    /* contratti sponsor attivi */
  offerteAR1: [],                  /* offerte AR1 ricevute in AR2 */
  spese: [],                      /* voci di spesa dettagliate */
  /* Sviluppo tecnico AR2 */
  sviluppoAR2: { aero: 0, meccanica: 0 },   /* livello upgrade per area (0-3) */
  pianoUpgradeAR2: [],             /* upgrade AR2 in consegna */
  deltaOttimizzazione: 0,         /* accumulo qualità decisioni giocatore (AR2/AR3), range 0–10 */
  pilotiLiberiAR2AR3: null,         /* pool piloti liberi per il mercato AR2/AR3 */
  /* Management — solo AR1 */
  allocazioneBudget: { approccio: 'bilanciato' },
  ricercaSponsorStagione: false,  /* true se già cercato un nuovo sponsor questa stagione */
  _candidatiSponsor: [],          /* candidati generati dall'ultima ricerca */
  /* Relazioni — interazioni attive */
  colloquiPilotiRound: {},        /* { pilotaId: roundCorrente } — round dell'ultimo colloquio */
  negoziazioniAttiveFed: [],      /* negoziazioni Federazione pendenti/concluse */
  negoziazioniFedStagione: {},    /* { tipo: true } — tipi già avviati questa stagione */
  riunioniSquadraStagione: 0,     /* contatore riunioni di squadra (max 4/anno) */
  eventiHospitalityStagione: 0,   /* contatore eventi hospitality (max 3/anno) */
  aggiornamentoSponsorRound: {},  /* { sponsorId: roundCorrente } */
  incontriStaffRound: {},         /* { chiaveStaff: roundCorrente } */
  conferenzaStampaRound: -1,      /* ultimo round con conferenza stampa */
  dichiarazioneTecnicaStagione: false, /* usata una volta per stagione */
  /* Pausa invernale AR1 — tracciamento capitoli e concept */
  pausaInvernaleCapitoli: {},   /* { concept: bool, piloti: bool, sviluppo: bool, budget: bool, staff: bool } */
  conceptMacchina: null,        /* { tipo, nome, incertezza, rischio, stagione } */
  _pilotiLiberiAR1: null,        /* pool piloti liberi (generato on-demand, usato in pausa_invernale e per sondaggi in-season) */
  _staffLiberi: null,           /* pool staff liberi (temp, solo durante pausa_invernale) */
  macchineAI: {},               /* { [squadraId]: { aerodinamica, meccanica, elettronica, powerUnit } } — copia evolutiva, non muta DATI */
  pilotiAI: null,               /* array piloti squadre AI (copia evolutiva) — mai mutare DATI */
  eventiMercatoAI: [],          /* movimenti di mercato AI dell'ultima pausa invernale */
  /* Test pre-stagionali AR1 */
  conoscenzaMacchina: { aerodinamica: 0, meccanica: 0, powerUnit: 0, baseline: 0 },
  datiPista: {},                /* { [circuitoId]: { setup: 0, mescole: 0, aero: 0 } } — persiste tra stagioni, reset a cambio era */
  testPreStagionali: { completati: false, giorno: 1, sessione: 0, programmiSvolti: [], reportGiornalieri: [] },
  direttiveStagione: {},          /* { capoIngegnere: 'ci_bilanciamento', direttoreGara: 'dg_velocita', ... } */
  performancePiloti: {},          /* { [pilotaId]: { nomePilota, squadraId, nomeSquadra, bandiera, eta, isGiocatoreTeam, deltaCumulativo, gareContate } } */
  statisticheStagione: { miglioreRisultato: 20, numeroPodi: 0, gareDispute: 0 }, /* Statistiche accumulate stagione corrente */
  pilotaInfortunato: null,        /* id del pilota attualmente infortunato, o null */
  ultimoInfortunio: null          /* { nomePilota, roundRitorno } — usato dalla UI per notifica in inter-gara */
};

/* ============================================================
   PROGRAMMI TEST PRE-STAGIONALI AR1
   ============================================================ */

const PROGRAMMI_TEST = [
  {
    id: 'raccolta_aero',
    nome: 'Raccolta dati aerodinamici',
    descrizione: 'Cicli di mappatura del carico aerodinamico su tutto il range di velocita. Base per la correlazione CFD/pista.',
    disponibileDa: 1,
    effetti: { aerodinamica: 25 },
    staffBonus: 'direttoreAero',
    staffBonusStat: 'innovazione',
    prerequisito: null
  },
  {
    id: 'raccolta_mec',
    nome: 'Raccolta dati meccanici',
    descrizione: 'Analisi del comportamento di sospensioni, idraulica e cinematica in condizioni di carico variabile.',
    disponibileDa: 1,
    effetti: { meccanica: 25 },
    staffBonus: 'direttoreMeccanica',
    staffBonusStat: 'innovazione',
    prerequisito: null
  },
  {
    id: 'raccolta_pu',
    nome: 'Analisi power unit',
    descrizione: 'Mappatura completa delle modalita di erogazione, recupero energia MGU-K e distribuzione termica su tutti i regimi.',
    disponibileDa: 1,
    effetti: { powerUnit: 25 },
    staffBonus: 'direttoreElettronica',
    staffBonusStat: 'innovazione',
    prerequisito: null
  },
  {
    id: 'test_mescole',
    nome: 'Test mescole e degrado',
    descrizione: 'Valutazione del comportamento delle mescole assegnate per la stagione. Finestre operative e tasso di degrado su vari tipi di asfalto.',
    disponibileDa: 1,
    effetti: { baseline: 20 },
    staffBonus: 'direttoreGara',
    staffBonusStat: 'velocita',
    prerequisito: null,
    bonusMescole: true
  },
  {
    id: 'correlazione_cfd',
    nome: 'Correlazione CFD/pista',
    descrizione: 'Confronto diretto tra previsioni della galleria del vento e comportamento reale. Calibra il modello aerodinamico e riduce il margine di errore nelle stime.',
    disponibileDa: 1,
    effetti: { aerodinamica: 20, baseline: 15 },
    staffBonus: 'direttoreAero',
    staffBonusStat: 'innovazione',
    prerequisito: 'raccolta_aero'
  },
  {
    id: 'setup_base',
    nome: 'Sviluppo setup baseline',
    descrizione: 'Ottimizzazione del setup di partenza per la stagione. Assetto meccanico di riferimento per le piste a medio carico aerodinamico.',
    disponibileDa: 1,
    effetti: { baseline: 25, meccanica: 10 },
    staffBonus: 'direttoreMeccanica',
    staffBonusStat: 'precisione',
    prerequisito: 'raccolta_mec'
  },
  {
    id: 'sim_gara',
    nome: 'Simulazione passo gara',
    descrizione: 'Run di 30+ giri con gestione programmata delle gomme. Stima del ritmo gara, degradazione e comportamento della vettura in condizioni di gara reale.',
    disponibileDa: 2,
    effetti: { baseline: 20, meccanica: 8, powerUnit: 8 },
    staffBonus: 'dataAnalyst',
    staffBonusStat: 'precisione',
    prerequisito: null
  },
  {
    id: 'alta_velocita',
    nome: 'Test alta velocita',
    descrizione: 'Sessione dedicata al comportamento aerodinamico e alla power unit in condizioni di alta velocita. Dati critici per Monza, Baku e circuiti veloci.',
    disponibileDa: 2,
    effetti: { aerodinamica: 15, powerUnit: 15 },
    staffBonus: 'direttoreElettronica',
    staffBonusStat: 'innovazione',
    prerequisito: null
  }
];

/* ============================================================
   CLASSE PRINCIPALE: MOTORE DI GIOCO
   ============================================================ */

class MotoreGioco {
  constructor() {
    this.stato = null;
    this.generatore = null;
    this.ui = null;        /* Riferimento al modulo UI (iniettato) */
    this.audio = null;     /* Riferimento al modulo Audio (iniettato) */
  }

  /* ----------------------------------------------------------
     INIZIALIZZAZIONE
  ---------------------------------------------------------- */

  collegaUI(moduloUI) { this.ui = moduloUI; }
  collegaAudio(moduloAudio) { this.audio = moduloAudio; }

  /* Avvia una nuova partita */
  nuovaPartita() {
    const seed = Date.now();
    this.generatore = new GeneratoreCasuale(seed);
    this.stato = JSON.parse(JSON.stringify(STATO_INIZIALE));
    this.stato.seedStagione = seed;
    this.stato.seedCorrente = seed;
    this.stato.categoria = 'AR3';
    this.stato.stagione = 2026;
    this.stato.eraRegolamentare = JSON.parse(JSON.stringify(DATI.ERA_REGOLAMENTARE_INIZIALE));

    /* Assegna casualmente una squadra AR3 */
    const squadreAR3 = DATI.SQUADRE_AR3;
    const squadraAssegnata = this.generatore.dallaLista(squadreAR3);
    this.stato.squadraId = squadraAssegnata.id;

    /* Imposta i piloti della squadra */
    this.stato.piloti = DATI.PILOTI_AR3
      .filter(p => p.squadra === squadraAssegnata.id)
      .map(p => JSON.parse(JSON.stringify(p)));

    /* Assegna staff AR3 della squadra */
    const staffAR3Base = DATI.STAFF_AR3[squadraAssegnata.id];
    if (staffAR3Base) {
      this.stato.staff = JSON.parse(JSON.stringify(staffAR3Base));
    }

    /* Genera classifica iniziale vuota */
    this._inizializzaClassifiche();

    /* Snapshot reputazione di inizio stagione */
    this.stato.reputazioneInizioStagione = { ...this.stato.reputazione };

    /* Inizializza tracciamento calendario AR1 */
    this._inizializzaTracciamentoCalendario();

    /* Imposta il round iniziale */
    this.stato.roundCorrente = 0;
    this.stato.faseCorrente = 'briefing';

    this.salva();
    return this.stato;
  }

  /* Verifica se localStorage è accessibile (fallisce in Safari private browsing) */
  _storageDisponibile() {
    try {
      const k = '__ar1_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Carica partita da localStorage.
     Se lo slot principale è assente o corrotto, tenta il fallback sullo slot ombra
     (ar1manager_bozza), che sopravvive a chiusure impreviste durante il salvataggio. */
  caricaPartita() {
    const slotDaCaricare = ['ar1manager_salvataggio', 'ar1manager_bozza'];
    for (const slot of slotDaCaricare) {
      try {
        const datiRaw = localStorage.getItem(slot);
        if (!datiRaw) continue;
        this.stato = JSON.parse(datiRaw);
        this._sanificaStato();
        this.generatore = new GeneratoreCasuale(this.stato.seedCorrente);
        /* Se recuperato dallo slot ombra, consolida subito sullo slot principale */
        if (slot === 'ar1manager_bozza') {
          localStorage.setItem('ar1manager_salvataggio', datiRaw);
          localStorage.removeItem('ar1manager_bozza');
        }
        return this.stato;
      } catch (errore) {
        console.error('Errore caricamento da slot', slot, ':', errore);
      }
    }
    return null;
  }

  /* Valida e ripara lo stato dopo il caricamento da localStorage.
     Protegge contro: dati corrotti, versioni precedenti con campi mancanti,
     valori di tipo errato prodotti da bug intermedi.
     Non lancia mai eccezioni: ogni campo problematico viene sostituito
     con un valore sicuro che permette al gioco di continuare. */
  _sanificaStato() {
    const s = this.stato;
    if (!s) return;

    /* Categoria e valori scalari */
    if (!['AR3', 'AR2', 'AR1'].includes(s.categoria))                            s.categoria   = 'AR3';
    if (typeof s.stagione    !== 'number' || isNaN(s.stagione)    || s.stagione < 2026) s.stagione    = 2026;
    if (typeof s.roundCorrente !== 'number' || isNaN(s.roundCorrente) || s.roundCorrente < 0) s.roundCorrente = 0;
    if (typeof s.budget      !== 'number' || isNaN(s.budget))                    s.budget      = 0;
    if (typeof s.budgetSpeso !== 'number' || isNaN(s.budgetSpeso))               s.budgetSpeso = 0;

    /* Fase corrente: se null o non riconosciuta, atterrare su inter-gara */
    const FASI_VALIDE = new Set([
      'briefing', 'fp1', 'fp2', 'fp3', 'qualifica', 'gara', 'post-gara',
      'sprint_qualifica', 'sprint', 'inter-gara', 'pausa_invernale',
      'pausa_estiva', 'test_prestagionali', 'test_completati'
    ]);
    if (!s.faseCorrente || !FASI_VALIDE.has(s.faseCorrente)) s.faseCorrente = 'inter-gara';

    /* Campi array critici */
    if (!Array.isArray(s.piloti))                s.piloti = [];
    if (!Array.isArray(s.classificaCostruttori)) s.classificaCostruttori = [];
    if (!Array.isArray(s.classificaPiloti))      s.classificaPiloti = [];
    if (!Array.isArray(s.storico))               s.storico = [];
    if (!Array.isArray(s.sponsor))               s.sponsor = [];
    if (!Array.isArray(s.pianoUpgrade))          s.pianoUpgrade = [];
    if (!Array.isArray(s.offerteAR1))            s.offerteAR1 = [];
    if (!Array.isArray(s.negoziazioniAttiveFed)) s.negoziazioniAttiveFed = [];
    if (!Array.isArray(s.annunciRotazione))      s.annunciRotazione = [];
    if (!Array.isArray(s.investimentiFactory))   s.investimentiFactory = [];
    if (!Array.isArray(s.pianoUpgradeAR2))       s.pianoUpgradeAR2 = [];

    /* Oggetti critici */
    if (!s.reputazione || typeof s.reputazione !== 'object') {
      s.reputazione = { tecnica: 800, performance: 800, mediatica: 600, finanziaria: 700, generale: 500 };
    }
    if (!s.tutorialVisto           || typeof s.tutorialVisto           !== 'object') s.tutorialVisto           = {};
    if (!Array.isArray(s.spese))                                                      s.spese                   = [];
    if (!s.colloquiPilotiRound     || typeof s.colloquiPilotiRound     !== 'object') s.colloquiPilotiRound     = {};
    if (!s.aggiornamentoSponsorRound || typeof s.aggiornamentoSponsorRound !== 'object') s.aggiornamentoSponsorRound = {};
    if (!s.incontriStaffRound      || typeof s.incontriStaffRound      !== 'object') s.incontriStaffRound      = {};
    if (!s.negoziazioniFedStagione || typeof s.negoziazioniFedStagione !== 'object') s.negoziazioniFedStagione = {};
    if (typeof s.sviluppoAR2 !== 'object' || !s.sviluppoAR2)                         s.sviluppoAR2 = { aero: 0, meccanica: 0 };

    /* AR1: campi specifici obbligatori */
    if (s.categoria === 'AR1') {
      if (!s.staff    || typeof s.staff    !== 'object') s.staff    = {};
      if (!s.macchineAI || typeof s.macchineAI !== 'object') s.macchineAI = {};
      if (!s.conoscenzaMacchina || typeof s.conoscenzaMacchina !== 'object') {
        s.conoscenzaMacchina = { aerodinamica: 0, meccanica: 0, powerUnit: 0, baseline: 0 };
      }
      if (!s.allocazioneCFD || typeof s.allocazioneCFD !== 'object') {
        s.allocazioneCFD = { stagioneCorrente: 0.7, prossimaStagione: 0.3 };
      }
      if (!s.factory || typeof s.factory !== 'object') {
        s.factory = {
          galleriaVento:   { livello: 2, condizione: 80 },
          simulatore:      { livello: 2, condizione: 75 },
          officina:        { livello: 3, condizione: 85 },
          centroDati:      { livello: 2, condizione: 70 },
          strutturaMedica: { livello: 2, condizione: 90 }
        };
      }
      /* macchina: se mancante, recupera dai dati statici della squadra assegnata */
      if (!s.macchina || typeof s.macchina !== 'object') {
        const squadra = (typeof DATI !== 'undefined') && DATI.SQUADRE_AR1?.find(sq => sq.id === s.squadraId);
        s.macchina = squadra
          ? { ...squadra.macchina }
          : { aerodinamica: 65, meccanica: 65, elettronica: 65, powerUnit: 65 };
      }
    }
  }

  /* Salva stato corrente */
  salva() {
    try {
      this.stato.seedCorrente = this.generatore ? this.generatore.stato : Date.now();
      const json = JSON.stringify(this.stato);

      /* Scrittura su slot ombra prima dello slot principale.
         Se il browser chiude durante setItem, lo slot principale
         è ancora integro (l'ultima scrittura buona). */
      localStorage.setItem('ar1manager_bozza', json);
      localStorage.setItem('ar1manager_salvataggio', json);
      localStorage.removeItem('ar1manager_bozza');
    } catch (errore) {
      /* QuotaExceededError: storage pieno o Safari in navigazione privata */
      const isQuota = errore instanceof DOMException && (
        errore.name === 'QuotaExceededError' ||
        errore.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      );
      const messaggio = isQuota
        ? 'Salvataggio non riuscito: memoria insufficiente o navigazione privata attiva. I progressi potrebbero andare persi.'
        : 'Errore di salvataggio. I progressi potrebbero non essere conservati.';
      console.error('Errore salvataggio localStorage:', errore);
      this.ui?.annunciaVoiceOver?.(messaggio);
    }
  }

  esiste() {
    try {
      return localStorage.getItem('ar1manager_salvataggio') !== null;
    } catch (e) {
      return false;
    }
  }

  /* ----------------------------------------------------------
     CALENDARIO E NAVIGAZIONE STAGIONALE
  ---------------------------------------------------------- */

  _ottieniCalendario() {
    switch (this.stato.categoria) {
      case 'AR1': return this.ottieniCalendarioAR1Attivo();
      case 'AR2': return DATI.CIRCUITI.filter(c => DATI.ROUND_AR2.includes(c.id));
      case 'AR3': return DATI.CIRCUITI.filter(c => DATI.ROUND_AR3.includes(c.id));
      default: return [];
    }
  }

  ottieniRoundCorrente() {
    const calendario = this._ottieniCalendario();
    return calendario[this.stato.roundCorrente] || null;
  }

  ottieniProssimoRound() {
    const calendario = this._ottieniCalendario();
    return calendario[this.stato.roundCorrente + 1] || null;
  }

  /* Avanza alla fase successiva del weekend */
  avanzaFase() {
    const circuito = this.ottieniRoundCorrente();
    if (!circuito) return;

    const faseCorrente = this.stato.faseCorrente;
    let prossima = null;

    if (this.stato.categoria === 'AR1') {
      if (circuito.sprint) {
        /* Formato sprint: briefing → fp1 → sprint_qualifica → sprint → qualifica → gara → post-gara */
        const sequenzaSprint = ['briefing', 'fp1', 'sprint_qualifica', 'sprint', 'qualifica', 'gara', 'post-gara'];
        const idx = sequenzaSprint.indexOf(faseCorrente);
        if (idx === -1) return; /* fase non riconosciuta: stato corrotto, non avanzare */
        prossima = sequenzaSprint[idx + 1] || 'inter-gara';
      } else {
        /* Formato standard: briefing → fp1 → fp2 → fp3 → qualifica → gara → post-gara */
        const sequenzaStandard = ['briefing', 'fp1', 'fp2', 'fp3', 'qualifica', 'gara', 'post-gara'];
        const idx = sequenzaStandard.indexOf(faseCorrente);
        if (idx === -1) return; /* fase non riconosciuta: stato corrotto, non avanzare */
        prossima = sequenzaStandard[idx + 1] || 'inter-gara';
      }
    } else {
      /* AR2/AR3: briefing → fp1 → qualifica → sprint → gara → post-gara */
      const sequenzaAR2AR3 = ['briefing', 'fp1', 'qualifica', 'sprint', 'gara', 'post-gara'];
      const idx = sequenzaAR2AR3.indexOf(faseCorrente);
      if (idx === -1) return; /* fase non riconosciuta: stato corrotto, non avanzare */
      prossima = sequenzaAR2AR3[idx + 1] || 'inter-gara';
    }

    if (prossima === 'inter-gara') {
      this._terminaRound();
    } else {
      /* Operazioni di inizio weekend */
      if (prossima === 'briefing') {
        this.stato.bonusFPCorrente = 0;
        this.stato.datiFP = { fp1: null, fp2: null, fp3: null };
        this._applicaUpgradeInArrivo();
        this._applicaInvestimentiFactory();
        if (this.stato.categoria === 'AR2') {
          this._applicaUpgradeAR2();
        }
      }
      this.stato.faseCorrente = prossima;
    }

    this.salva();
  }

  _terminaRound() {
    const calendario = this._ottieniCalendario();
    this.stato.roundCorrente++;

    /* Scala i bonus temporanei performance piloti */
    (this.stato.piloti || []).forEach(p => {
      if (p.bonusPerformanza?.durataRound > 0) {
        p.bonusPerformanza.durataRound--;
        if (p.bonusPerformanza.durataRound <= 0) {
          p.bonusPerformanza = { valore: 0, durataRound: 0 };
        }
      }
    });

    /* Verifica esiti negoziazioni Federazione con reveal differito */
    this._verificaEsitiNegoziazioniPendenti();

    /* Rivela risposte sondaggi piloti maturate */
    this._rivelaSondaggiMaturati();

    if (this.stato.roundCorrente >= calendario.length) {
      this._terminaStagione();
      return;
    }

    /* Preparatore Atletico: mitiga calo umore piloti durante stagioni lunghe */
    const pa = this.stato.staff?.preparatoreAtletico;
    if (pa && Array.isArray(this.stato.piloti)) {
      const fit = pa.statistiche?.fitness || pa.statistiche?.recupero || 65;
      const bonusFit = Math.max(0, (fit - 65) / 200); /* 0..+0.175 per round */
      this.stato.piloti.forEach(p => {
        if (typeof p.umore === 'number' && p.umore < 70) {
          p.umore = Math.min(70, p.umore + bonusFit);
        }
      });
    }

    /* Infortuni piloti — solo AR1, al massimo 1 attivo contemporaneamente */
    if (this.stato.categoria === 'AR1' && Array.isArray(this.stato.piloti)) {
      /* Recovery: verifica rientri alla luce del round appena completato */
      this.stato.piloti.forEach(p => {
        if (p.infortunato && typeof p.roundRitorno === 'number' && this.stato.roundCorrente >= p.roundRitorno) {
          p.infortunato = false;
          p.roundRitorno = null;
          if (this.stato.pilotaInfortunato === p.id) this.stato.pilotaInfortunato = null;
        }
      });
      /* Nuovo infortunio: solo se nessun pilota è attualmente infortunato */
      if (!this.stato.pilotaInfortunato) {
        const pa       = this.stato.staff?.preparatoreAtletico;
        const fit      = pa?.statistiche?.fitness || pa?.statistiche?.recupero || 65;
        const riduzione = Math.max(0, (fit - 65) / 140); /* 0..≈0.25 — fitness alta riduce la probabilità */
        const prob     = 0.022 * (1 - riduzione); /* ~0.44 eventi/stagione per pilota senza protezione */
        for (const p of this.stato.piloti) {
          if (!p.infortunato && this.generatore.probabilita(prob)) {
            p.infortunato    = true;
            const durata     = this.generatore.intervallo(2, 5);
            p.roundRitorno   = this.stato.roundCorrente + durata;
            this.stato.pilotaInfortunato = p.id;
            this.stato.ultimoInfortunio  = { nomePilota: p.nome, roundRitorno: p.roundRitorno };
            break; /* Un solo infortunio per turno */
          }
        }
      }
    }

    /* Decrementa periodo adattamento per staff tecnico neoingaggiato */
    ['capoIngegnere','direttoreAero','direttoreMeccanica','direttoreElettronica'].forEach(chiave => {
      const m = this.stato.staff?.[chiave];
      if (m?.adattamento?.roundRestanti > 0) {
        m.adattamento.roundRestanti--;
        if (m.adattamento.roundRestanti === 0) delete m.adattamento;
      }
    });

    /* Evoluzione AI in-season: aggiornamenti ogni 4 round (solo AR1) */
    if (this.stato.categoria === 'AR1' && this.stato.roundCorrente % 4 === 0) {
      this._evoluzioneAIMidSeason();
      this._diffusioneInnovazioniAI();
    }

    /* In AR2: valuta offerte AR1 dopo metà calendario */
    if (this.stato.categoria === 'AR2') {
      const calendarioAR2 = DATI.CIRCUITI.filter(c => DATI.ROUND_AR2.includes(c.id));
      if (this.stato.roundCorrente >= Math.floor(calendarioAR2.length / 2)) {
        this._valutaOfferteAR1();
      }
    }

    /* Controlla pausa estiva (tra round 14 e 15 per AR1) */
    const prossimo = calendario[this.stato.roundCorrente];
    if (prossimo && this._ePausaEstiva(prossimo.data)) {
      this.stato.faseCorrente = 'pausa_estiva';
    } else {
      this.stato.faseCorrente = 'inter-gara';
    }
  }

  _ePausaEstiva(data) {
    if (!data) return false;
    const mese = new Date(data).getMonth(); /* 0-based: luglio=6, agosto=7 */
    return mese === 7; /* Agosto */
  }

  uscitaDaPausaEstiva() {
    this.stato.faseCorrente = 'inter-gara';
    this.salva();
  }

  /* ----------------------------------------------------------
     METEO — GENERAZIONE CONDIZIONI WEEKEND
  ---------------------------------------------------------- */

  generaMeteoWeekend(circuito) {
    const g = this.generatore;
    const hasPioggia = g.probabilita(circuito.probabilitaPioggia);
    const intensitaPioggia = hasPioggia ? g.intervallo(1, 100) : 0;

    /* Temperatura pista con variabilità realistica */
    const tempBase = g.intervallo(circuito.temperaturaMin, circuito.temperaturaMax);
    const variazione = g.intervallo(-5, 5);
    const tempPista = Math.max(10, Math.min(70, tempBase + variazione));

    return {
      pioggia: hasPioggia,
      intensitaPioggia,       /* 0–100: 0=asciutto, 1-50=umido, 51-80=pioggia, 81-100=forte pioggia */
      temperaturaPista: tempPista,
      temperaturaAria: Math.round(tempPista * 0.7),
      vento: g.intervallo(0, 30),              /* km/h */
      variabilitaMeteo: g.probabilita(0.3)     /* true = meteo instabile nel weekend */
    };
  }

  generaMeteoSessione(meteoBase) {
    /* Variazione rispetto al meteo base per una singola sessione */
    const g = this.generatore;
    const variazione = g.intervallo(-8, 8);
    const cambioPioggia = meteoBase.variabilitaMeteo && g.probabilita(0.2);

    return {
      ...meteoBase,
      temperaturaPista: Math.max(10, Math.min(70, meteoBase.temperaturaPista + variazione)),
      pioggia: cambioPioggia ? !meteoBase.pioggia : meteoBase.pioggia,
      intensitaPioggia: cambioPioggia ? g.intervallo(10, 80) : meteoBase.intensitaPioggia
    };
  }

  _mescoleConsigliate(meteoSessione, circuito) {
    if (meteoSessione.pioggia && meteoSessione.intensitaPioggia > 50) {
      return ['FULL_WET'];
    }
    if (meteoSessione.pioggia && meteoSessione.intensitaPioggia > 15) {
      return ['INTERMEDIA', circuito.mescole[0]];
    }
    return circuito.mescole.slice();
  }

  /* ----------------------------------------------------------
     CALCOLO PERFORMANCE VETTURA
  ---------------------------------------------------------- */

  _calcolaPerformanceVettura(squadraId, circuito) {
    let datiMacchina;

    if (this.stato.categoria === 'AR1' && this.stato.squadraId === squadraId) {
      datiMacchina = this.stato.macchina || this._trovaMacchinaAR1(squadraId);
    } else {
      datiMacchina = this._trovaMacchinaAR1(squadraId);
    }

    if (!datiMacchina) return 65; /* Fallback squadre AR2/AR3 */

    const pesi = circuito.pesoPerformance;
    const base = (
      datiMacchina.aerodinamica * pesi.aerodinamica +
      datiMacchina.meccanica    * pesi.meccanica +
      datiMacchina.elettronica  * pesi.elettronica +
      datiMacchina.powerUnit    * pesi.powerUnit
    );

    /* Altitudine: riduce performance powerUnit */
    const fattoreAltitudine = circuito.altitudine > 0
      ? 1 - (circuito.altitudine / 10000) * 0.15
      : 1;

    return Math.min(100, Math.max(40, base * fattoreAltitudine));
  }

  _trovaMacchinaAR1(squadraId) {
    /* Usa prima il valore evolutivo in stato.macchineAI, poi il fallback statico in DATI */
    if (this.stato.macchineAI?.[squadraId]) {
      return { ...this.stato.macchineAI[squadraId] };
    }
    const squadra = DATI.SQUADRE_AR1.find(s => s.id === squadraId);
    return squadra ? { ...squadra.macchina } : null;
  }

  /* Tasso di guasto meccanico per giro/vettura, differenziato per categoria */
  _tassoGuastiCategoria() {
    switch (this.stato.categoria) {
      case 'AR3': return 0.0005;   /* guasti rarissimi, monomarca affidabile */
      case 'AR2': return 0.001;    /* guasti rari, powertrain standardizzato */
      default:   return 0.002;    /* AR1: powertrain e componenti di bordo più complessi */
    }
  }

  /* Lista motivi ritiro, differenziata per categoria */
  _motiviRitiroCategoria() {
    switch (this.stato.categoria) {
      case 'AR3':
        return ['Incidente', 'Testacoda', 'Foratura', 'Problema freni'];
      case 'AR2':
        return ['Incidente', 'Guasto sospensioni', 'Problema freni', 'Foratura', 'Problema cambio'];
      default:
        return ['Problema power unit', 'Guasto idraulico', 'Perdita d\'acqua', 'Problema freni', 'Guasto MGU-K', 'Problema cambio'];
    }
  }

  _calcolaPerformanzaPilota(pilota, circuito, meteo) {
    const stat = pilota.statistiche;
    let base = (stat.talento * 0.35 + stat.costanza * 0.25 + stat.gara * 0.25 + stat.gestione * 0.15);

    /* Umore influenza le prestazioni */
    const fattoreUmore = 0.9 + (pilota.umore / 1000);
    base *= fattoreUmore;

    /* Pioggia */
    if (meteo.pioggia) {
      const bonus = (stat.bagnato - 75) / 100;
      base += base * bonus * 0.15;
    }

    /* Bonus FP (solo AR3/AR2): dati prove libere influenzano la prestazione */
    if (this.stato.categoria !== 'AR1' && this.stato.bonusFPCorrente) {
      base += this.stato.bonusFPCorrente;
    }

    /* Bonus temporaneo da colloquio critico (range 0-10, si esaurisce in N round) */
    if (pilota.bonusPerformanza?.valore > 0) {
      base += pilota.bonusPerformanza.valore * 0.5;
    }

    return Math.min(100, Math.max(40, base));
  }

  /* ----------------------------------------------------------
     SIMULAZIONE PROVE LIBERE
  ---------------------------------------------------------- */

  simulaSessioneFP(circuito, meteoSessione, programmaAllenamento) {
    /* programmaAllenamento: 'passo_gara' | 'qualifica' | 'aero' | 'meccanico' | 'gomme' | 'telemetria' */
    const g = this.generatore;
    const qualitaDataAnalyst = this.stato.categoria === 'AR1'
      ? (this.stato.staff?.dataAnalyst?.statistiche?.precisione || 70) / 100
      : 0.65;

    /* Calcola qualità dati in base al programma scelto e al meteo */
    const penalitaMeteo = meteoSessione.pioggia ? 0.7 : 1.0;
    const bonusDAQualifica = this.stato.direttiveStagione?.dataAnalyst === 'da_qualifica' ? 0.05 : 0;
    let qualitaDati = 0.5 + (qualitaDataAnalyst * 0.3 * penalitaMeteo) + bonusDAQualifica;

    /* Bonus per programma mirato */
    const bonusProgramma = {
      passo_gara: { gara: 0.15, gomme: 0.10 },
      qualifica: { qualifica: 0.15, setup: 0.10 },
      aero: { aero: 0.20 },
      meccanico: { mec: 0.20 },
      gomme: { gomme: 0.20, degradoDati: 0.15 },
      telemetria: { precisione: 0.25 }
    };

    const bonusApplicato = bonusProgramma[programmaAllenamento] || {};
    qualitaDati = Math.min(1, qualitaDati + (Object.values(bonusApplicato)[0] || 0));

    /* Bonus da dati pista preesistenti (accumulo anni precedenti nell'era) */
    if (this.stato.categoria === 'AR1' && circuito) {
      const dp = this.stato.datiPista?.[circuito.id];
      if (dp) {
        const bonusPista = ((dp.setup || 0) + (dp.mescole || 0) + (dp.aero || 0)) / 300 * 0.08;
        qualitaDati = Math.min(1, qualitaDati + bonusPista);
      }
    }

    /* Dati raccolti */
    const risultato = {
      programma: programmaAllenamento,
      qualitaDati: Math.round(qualitaDati * 100),
      tempoSessione: g.intervallo(58, 62),   /* minuti effettivi di running */
      giriPercorsi: g.intervallo(18, 30),
      incidente: g.probabilita(0.05),
      feedbackStaff: this._generaFeedbackFP(programmaAllenamento, qualitaDati, circuito, meteoSessione),
      bonusUpgrade: qualitaDati > 0.8 ? g.intervallo(1, 3) : 0  /* punti bonus per sblocco upgrade */
    };

    /* Registra dati nel weekend */
    const fase = this.stato.faseCorrente;
    this.stato.datiFP[fase] = risultato;

    /* Aggiorna stima performance Data Analyst */
    if (this.stato.categoria === 'AR1') {
      this._aggiornaStimaMacchina(qualitaDati, circuito);
    }

    /* Aggiorna dati pista per questo circuito (AR1 only) */
    if (this.stato.categoria === 'AR1' && circuito) {
      if (!this.stato.datiPista) this.stato.datiPista = {};
      if (!this.stato.datiPista[circuito.id]) {
        this.stato.datiPista[circuito.id] = { setup: 0, mescole: 0, aero: 0 };
      }
      const dp = this.stato.datiPista[circuito.id];
      const guadagno = Math.round(qualitaDati * 8); /* max +8 per sessione FP */
      if (programmaAllenamento === 'meccanico' || programmaAllenamento === 'passo_gara') {
        dp.setup  = Math.min(100, dp.setup  + guadagno);
      } else if (programmaAllenamento === 'gomme') {
        dp.mescole = Math.min(100, dp.mescole + guadagno);
      } else if (programmaAllenamento === 'aero' || programmaAllenamento === 'telemetria') {
        dp.aero   = Math.min(100, dp.aero   + guadagno);
      } else {
        /* qualifica / default: piccolo contributo generico */
        dp.setup  = Math.min(100, dp.setup  + Math.round(guadagno * 0.4));
      }
    }

    /* In AR3/AR2 la qualità delle FP si traduce in un bonus prestazione diretto */
    if (this.stato.categoria !== 'AR1') {
      /* qualitaDati 0..1 → bonus -2..+2 (scala lineare: 0.5 = 0, 1.0 = +2, 0.0 = -2) */
      const bonusGrezzo = (qualitaDati - 0.5) * 4;
      /* Accumula: ogni FP aggiunge a quello precedente, ma il totale è clamped a -2..+2 */
      this.stato.bonusFPCorrente = Math.max(-2, Math.min(2,
        (this.stato.bonusFPCorrente || 0) + bonusGrezzo * 0.4
      ));
    }

    this.salva();
    return risultato;
  }

  _generaFeedbackFP(programma, qualita, circuito, meteo) {
    const testi = {
      passo_gara: qualita > 0.75
        ? 'Dati passo gara ottimali. Degradazione gomme nella norma per questo circuito.'
        : 'Raccolta dati parziale. Condizioni meteo hanno limitato la simulazione.',
      qualifica: qualita > 0.75
        ? 'Setup qualifica definito. Margine di miglioramento stimato disponibile.'
        : 'Simulazione qualifica interrotta. Dati incompleti sul singolo giro.',
      aero: qualita > 0.75
        ? 'Dati aerodinamici acquisiti. Il direttore aero ha identificato aree di intervento.'
        : 'Finestra meteo ridotta. Raccolta dati aerodinamici parziale.',
      meccanico: qualita > 0.75
        ? 'Feedback sospensioni positivo. Setup meccanico ottimizzato per questo asfalto.'
        : 'Dati meccanici incompleti. Alcune configurazioni non testate.',
      gomme: qualita > 0.75
        ? 'Comportamento mescole analizzato. Finestre operative identificate per tutte e tre le mescole.'
        : 'Analisi gomme parziale. Dati insufficienti sulla mescola dura.',
      telemetria: qualita > 0.75
        ? 'Telemetria completa acquisita. Data Analyst ha elaborato il confronto con i competitor.'
        : 'Telemetria parziale. La qualità del segnale ha limitato l\'acquisizione.'
    };
    return testi[programma] || 'Sessione completata.';
  }

  _aggiornaStimaMacchina(qualitaDati, circuito) {
    /* Il Data Analyst stima la performance relativa al benchmark */
    if (!this.stato.macchina) return;
    const g = this.generatore;
    const precisione = this.stato.staff?.dataAnalyst?.statistiche?.precisione || 70;

    /* La conoscenza pre-stagionale abbassa il margine strutturale di incertezza.
       Senza test pre-stagionali il margine base è 2.5x più alto.
       Con conoscenza piena (media=100) si riduce al 70% del valore normale. */
    const km = this.stato.conoscenzaMacchina;
    const conoscenzaMedia = km
      ? (km.aerodinamica + km.meccanica + km.powerUnit + km.baseline) / 4 / 100
      : 0;
    const moltiplicatoreKnowledge = conoscenzaMedia > 0
      ? Math.max(0.7, 1.5 - conoscenzaMedia)
      : 2.5;
    const riduzMargine = this.stato.direttiveStagione?.dataAnalyst === 'da_sviluppo' ? 0.75 : 1;
    const margineErrore = Math.max(1, Math.round((1 - qualitaDati) * 12 * (1 - precisione / 200) * moltiplicatoreKnowledge * riduzMargine));

    if (!this.stato.stimaMacchina) {
      this.stato.stimaMacchina = {};
    }

    const perfReale = this._calcolaPerformanceVettura(this.stato.squadraId, circuito);
    this.stato.stimaMacchina.ultimaStima = {
      valore: Math.max(30, Math.min(100, perfReale + g.intervallo(-margineErrore, margineErrore))),
      margineErrore,
      circuito: circuito.id,
      qualitaDati: Math.round(qualitaDati * 100)
    };
  }

  /* ----------------------------------------------------------
     SIMULAZIONE QUALIFICA
  ---------------------------------------------------------- */

  simulaQualifica(circuito, meteoSessione) {
    const g = this.generatore;
    const partecipanti = this._ottieniPartecipantiGara(circuito);

    /* Calcola tempi qualifica per ogni vettura */
    const risultati = partecipanti.map(partecipante => {
      const perfVettura = this._calcolaPerformanceVettura(partecipante.squadraId, circuito);
      const pilotaRif = partecipante.pilota;
      const perfPilota = this._calcolaPerformanzaPilota(pilotaRif, circuito, meteoSessione);

      /* Tempo base simulato in millisecondi */
      const tempoBase = 75000 + (100 - ((perfVettura * 0.65) + (perfPilota * 0.35))) * 400;
      const rumore = g.gaussiana(0, 180);
      const tempoPioggia = meteoSessione.pioggia ? g.intervallo(2000, 8000) : 0;
      const tempo = Math.round(tempoBase + rumore + tempoPioggia);

      return {
        ...partecipante,
        tempoMs: tempo,
        tempoFormattato: this._formattempoMs(tempo),
        eliminatoQ1: false,
        eliminatoQ2: false
      };
    });

    /* Ordina per tempo */
    risultati.sort((a, b) => a.tempoMs - b.tempoMs);

    /* Applica logica eliminazioni Q1/Q2 (solo AR1, 20 macchine) */
    if (this.stato.categoria === 'AR1') {
      risultati.slice(15, 20).forEach(r => r.eliminatoQ1 = true);
      risultati.slice(10, 15).forEach(r => r.eliminatoQ2 = true);
    }

    /* Assegna posizioni griglia */
    risultati.forEach((r, idx) => { r.posizioneGriglia = idx + 1; });

    /* Penalità griglia */
    this._applicaPenalGriglia(risultati, g);

    /* Salva griglia */
    this.stato.grigliaPartenza = risultati;
    this.salva();

    return risultati;
  }

  _applicaPenalGriglia(risultati, g) {
    /* Probabilità penalità componenti (ispirata alla casistica reale) */
    risultati.forEach(r => {
      if (g.probabilita(0.04) && !r.isGiocatore) {
        const penalita = g.dallaLista([3, 5, 10]);
        r.penalitaGriglia = penalita;
        r.motivoPenalita = 'Cambio componente power unit oltre quota consentita';
      }
    });

    /* Riordina tenendo conto delle penalità */
    risultati.sort((a, b) => {
      const posA = a.posizioneGriglia + (a.penalitaGriglia || 0);
      const posB = b.posizioneGriglia + (b.penalitaGriglia || 0);
      return posA - posB;
    });
    risultati.forEach((r, idx) => { r.posizioneGriglia = idx + 1; });
  }

  /* ----------------------------------------------------------
     SIMULAZIONE GARA — MOTORE PRINCIPALE
  ---------------------------------------------------------- */

  simulaGara(circuito, meteoBase, grigliaPartenza, strategiaGiocatore) {
    /*
     * strategiaGiocatore: {
     *   pilota1: { mescoleOrdinata: ['C3', 'C2'], fermate: [{ giro: 20, mescola: 'C2' }] },
     *   pilota2: { ... }
     * }
     */
    const g = this.generatore;
    const giriTotali = circuito.giri;
    const meteoAttuale = { ...meteoBase };

    /* Inizializza stato gara per ogni partecipante */
    let statoPartecipanti = grigliaPartenza.map(p => ({
      ...p,
      posizione: p.posizioneGriglia,
      gap: 0,                          /* gap dal leader in secondi */
      gommaCorrente: p.mescola || circuito.mescole[1],
      usuraGomma: 0,                   /* 0–100 */
      giriSullaGomma: 0,
      fermateEffettuate: 0,
      velocitaRelativa: 100,           /* 100 = normale */
      ritiro: false,
      motivoRitiro: null,
      penalitaSecondi: 0,
      giroPitStop: [],
      punteggioRitmo: 0,               /* accumulato durante la gara */
      drs: false
    }));

    /* Registro eventi gara */
    const eventi = [];
    let safetyCar = false;
    let virtualSafetyCar = false;
    let giriSafetyCar = 0;

    /* Calcola ritmo base per ogni vettura */
    statoPartecipanti.forEach(p => {
      const perfVettura = this._calcolaPerformanceVettura(p.squadraId, circuito);
      const perfPilota = this._calcolaPerformanzaPilota(p.pilota, circuito, meteoAttuale);
      p.ritmBase = (perfVettura * 0.65) + (perfPilota * 0.35);
    });

    /* ------ LOOP GARA ------  */
    for (let giro = 1; giro <= giriTotali; giro++) {
      /* Cambio meteo */
      if (meteoBase.variabilitaMeteo && g.probabilita(0.03)) {
        const vecchiaPioggia = meteoAttuale.pioggia;
        meteoAttuale.pioggia = g.probabilita(circuito.probabilitaPioggia * 1.5);
        meteoAttuale.intensitaPioggia = meteoAttuale.pioggia ? g.intervallo(15, 90) : 0;
        if (meteoAttuale.pioggia !== vecchiaPioggia) {
          eventi.push({ giro, tipo: 'meteo', descrizione: meteoAttuale.pioggia ? 'Inizia a piovere.' : 'La pista si asciuga.' });
        }
      }

      /* Incidente / safety car */
      if (!safetyCar && g.probabilita(circuito.probabilitaSafetyCar / giriTotali)) {
        const vittime = statoPartecipanti.filter(p => !p.ritiro && !p.isGiocatore);
        if (vittime.length > 0) {
          const coinvolto = g.dallaLista(vittime);
          if (g.probabilita(0.3)) {
            /* Incidente grave: ritiro */
            coinvolto.ritiro = true;
            coinvolto.motivoRitiro = 'Incidente';
            safetyCar = true;
            giriSafetyCar = g.intervallo(3, 7);
            eventi.push({ giro, tipo: 'safety_car', descrizione: `Safety car. Incidente per ${coinvolto.pilota.nome}.` });
          } else {
            /* Incidente minore: virtual safety car */
            virtualSafetyCar = true;
            giriSafetyCar = g.intervallo(2, 4);
            eventi.push({ giro, tipo: 'vsc', descrizione: `Virtual safety car. Detriti in pista.` });
          }
        }
      }

      /* Aggiorna contatore SC */
      if (safetyCar || virtualSafetyCar) {
        giriSafetyCar--;
        if (giriSafetyCar <= 0) {
          if (safetyCar) eventi.push({ giro, tipo: 'fine_sc', descrizione: 'Safety car rientrata. Gara ripartita.' });
          if (virtualSafetyCar) eventi.push({ giro, tipo: 'fine_vsc', descrizione: 'Virtual safety car terminata.' });
          safetyCar = false;
          virtualSafetyCar = false;
        }
      }

      /* Guasti meccanici — tasso e motivi differenziati per categoria */
      const tassoGuasto = this._tassoGuastiCategoria();
      const motiviGuasto = this._motiviRitiroCategoria();
      statoPartecipanti.filter(p => !p.ritiro && !p.isGiocatore).forEach(p => {
        if (g.probabilita(tassoGuasto)) {
          p.ritiro = true;
          p.motivoRitiro = g.dallaLista(motiviGuasto);
          eventi.push({ giro, tipo: 'ritiro', descrizione: `${p.pilota.nome} — ${p.motivoRitiro}.` });
        }
      });

      /* Pit stop AI (strategia automatica) */
      statoPartecipanti.filter(p => !p.ritiro && !p.isGiocatore).forEach(p => {
        const deveEntrare = this._valutaPitStopAI(p, giro, giriTotali, circuito, meteoAttuale, safetyCar, virtualSafetyCar);
        if (deveEntrare) {
          this._eseguiPitStop(p, giro, circuito, meteoAttuale, g, eventi, false);
        }
      });

      /* Pit stop giocatore (se pianificato) */
      const partecipantiGiocatore = statoPartecipanti.filter(p => p.isGiocatore && !p.ritiro);
      partecipantiGiocatore.forEach(pg => {
        const pilotaKey = pg.pilotaIndex === 0 ? 'pilota1' : 'pilota2';
        const strategia = strategiaGiocatore?.[pilotaKey];
        if (strategia) {
          const fermata = strategia.fermate?.find(f => f.giro === giro);
          if (fermata) {
            this._eseguiPitStop(pg, giro, circuito, meteoAttuale, g, eventi, true, fermata.mescola);
          }
        }
      });

      /* Aggiorna ritmo e gap */
      statoPartecipanti.filter(p => !p.ritiro).forEach(p => {
        /* Degrado gomma */
        p.giriSullaGomma++;
        let tassoUsura = this._calcolaTassoUsura(p.gommaCorrente, circuito, meteoAttuale);
        if (p.isGiocatore) {
          const dUsura = this.stato.direttiveStagione || {};
          if (dUsura.direttoreGara === 'dg_gomme') tassoUsura *= 0.95;
          if (dUsura.dataAnalyst  === 'da_gara')   tassoUsura *= 0.97;
        }
        p.usuraGomma = Math.min(100, p.usuraGomma + tassoUsura);

        /* Velocità relativa basata su usura gomma e SC/VSC */
        let fattoreVelocita = 1 - (p.usuraGomma / 200); /* max -50% per gomma usurata */
        if (safetyCar) fattoreVelocita *= 0.75;
        if (virtualSafetyCar) fattoreVelocita *= 0.85;

        /* Adattamento pioggia */
        if (meteoAttuale.pioggia) {
          const mescola = DATI.MESCOLE[p.gommaCorrente];
          if (!['INTERMEDIA', 'FULL_WET'].includes(p.gommaCorrente)) {
            fattoreVelocita *= 0.85; /* gomma slick sulla pioggia = pericoloso */
          }
        }

        /* Ritmo giro */
        const rumore = g.gaussiana(0, 0.5);
        p.ritmGiro = p.ritmBase * fattoreVelocita + rumore;
        p.punteggioRitmo += p.ritmGiro;
      });

      /* Calcola posizioni */
      const attivi = statoPartecipanti.filter(p => !p.ritiro);
      attivi.sort((a, b) => b.punteggioRitmo - a.punteggioRitmo);
      attivi.forEach((p, idx) => {
        p.posizione = idx + 1;
        p.gap = idx === 0 ? 0 : Math.round((attivi[0].punteggioRitmo - p.punteggioRitmo) * 0.8 * 10) / 10;
      });
    } /* Fine loop gara */

    /* Ordina risultati finali */
    const risultatiFinali = statoPartecipanti
      .filter(p => !p.ritiro)
      .sort((a, b) => a.posizione - b.posizione)
      .concat(statoPartecipanti.filter(p => p.ritiro));

    /* Assegna posizioni ai ritirati */
    let posizioneRitirati = risultatiFinali.filter(p => !p.ritiro).length + 1;
    risultatiFinali.filter(p => p.ritiro).forEach(p => {
      p.posizione = posizioneRitirati++;
    });

    /* Giro veloce */
    const pilotiAttivi = risultatiFinali.filter(p => !p.ritiro && p.posizione <= 10);
    if (pilotiAttivi.length > 0) {
      const giroVeloce = pilotiAttivi.reduce((a, b) => a.ritmGiro > b.ritmGiro ? a : b);
      giroVeloce.giroVeloce = true;
    }

    /* Calcola punti */
    risultatiFinali.forEach(r => {
      const pos = r.posizione;
      r.puntiGuadagnati = DATI.PUNTI_GARA[pos - 1] || 0;
      if (r.giroVeloce) r.puntiGuadagnati += DATI.PUNTI_GIRO_VELOCE;
    });

    /* Aggiorna classifiche */
    this._aggiornaClassifiche(risultatiFinali);

    /* Aggiorna statistiche stagione giocatore */
    if (!this.stato.statisticheStagione) {
      this.stato.statisticheStagione = { miglioreRisultato: 20, numeroPodi: 0, gareDispute: 0 };
    }
    const _ss = this.stato.statisticheStagione;
    _ss.gareDispute = (_ss.gareDispute || 0) + 1;
    risultatiFinali.filter(r => r.isGiocatore && !r.ritiro).forEach(r => {
      if (r.posizione < (_ss.miglioreRisultato ?? 21)) _ss.miglioreRisultato = r.posizione;
      if (r.posizione <= 3) _ss.numeroPodi = (_ss.numeroPodi || 0) + 1;
    });

    /* Aggiorna reputazione */
    this._aggiornaReputazioneDopoGara(risultatiFinali);

    /* Penalità gara */
    this._applicaPenalitaGara(risultatiFinali, g, eventi);

    /* Aggiorna statistiche prestazione per ogni pilota */
    this._aggiornaPerformancePiloti(risultatiFinali, circuito);

    /* Salva */
    this.stato.ultimaGara = {
      circuito: circuito.id,
      risultati: risultatiFinali,
      eventi,
      meteo: meteoAttuale
    };
    this.salva();

    return { risultati: risultatiFinali, eventi, meteo: meteoAttuale };
  }

  _valutaPitStopAI(partecipante, giro, giriTotali, circuito, meteo, safetyCar, virtualSafetyCar) {
    const g = this.generatore;
    const usura = partecipante.usuraGomma;
    const giriRimanenti = giriTotali - giro;
    const ferrmate = partecipante.fermateEffettuate;

    /* Obbligo pit stop entro ultimi 10 giri se ancora da fare */
    if (ferrmate === 0 && giriRimanenti <= 10) return true;

    /* Finestra finestra opportunista SC/VSC */
    if ((safetyCar || virtualSafetyCar) && ferrmate === 0 && giro > giriTotali * 0.25) return true;

    /* Usura critica */
    if (usura > 85 && giriRimanenti > 5) return true;

    /* Strategia proattiva: finestra morbida — probabilità aumentata per AI più reattive */
    if (ferrmate === 0 && giro > giriTotali * 0.35 && usura > 65 && g.probabilita(0.28)) return true;

    /* Undercut opportunistico: pit anticipato rispetto al previsto per scalare posizioni */
    if (ferrmate === 0 && giro > giriTotali * 0.28 && usura > 45 && g.probabilita(0.08)) return true;

    return false;
  }

  _eseguiPitStop(partecipante, giro, circuito, meteo, g, eventi, isGiocatore, mescolaScelta) {
    /* Sceglie la mescola */
    const giriRimanenti = circuito.giri - giro;
    let nuovaMescola;

    if (isGiocatore && mescolaScelta) {
      nuovaMescola = mescolaScelta;
    } else {
      /* AI: sceglie la mescola migliore per i giri rimanenti */
      const mescole = circuito.mescole;
      if (giriRimanenti > 25) {
        nuovaMescola = mescole[0]; /* Dura */
      } else if (giriRimanenti > 12) {
        nuovaMescola = mescole[1]; /* Media */
      } else {
        nuovaMescola = mescole[2]; /* Morbida */
      }

      /* Adatta al meteo */
      if (meteo.pioggia && meteo.intensitaPioggia > 50) nuovaMescola = 'FULL_WET';
      else if (meteo.pioggia && meteo.intensitaPioggia > 15) nuovaMescola = 'INTERMEDIA';
    }

    /* Tempo pit stop */
    const qualitaDirettoreGara = partecipante.isGiocatore
      ? (this.stato.staff?.direttoreGara?.statistiche?.pitStop || 75) / 100
      : 0.7 + g.prossimo() * 0.25;

    /* Coordinatore Operativo: riduce tempi operativi in corsia box */
    const coordOp = partecipante.isGiocatore ? this.stato.staff?.coordinatoreOperativo : null;
    const bonusCoord = coordOp
      ? Math.max(0, ((coordOp.statistiche?.efficienza || coordOp.statistiche?.coordinamento || 65) - 65) / 650)
      : 0;

    const dirPit = this.stato.direttiveStagione || {};
    const bonusVelPit = partecipante.isGiocatore && dirPit.direttoreGara === 'dg_velocita' ? 0.3 : 0;
    const probErrPit  = partecipante.isGiocatore && dirPit.direttoreGara === 'dg_precisione' ? 0.015 : 0.03;
    const tempoBase = 22 + g.gaussiana(0, 0.5) - bonusVelPit; /* secondi */
    const bonusStaff = (qualitaDirettoreGara - 0.7) * -5 - bonusCoord;
    const rischio = g.probabilita(probErrPit) ? g.intervallo(2, 8) : 0; /* Errore pit stop */

    const tempoPitStop = Math.round((tempoBase + bonusStaff + rischio) * 10) / 10;

    partecipante.gommaCorrente = nuovaMescola;
    partecipante.usuraGomma = 0;
    partecipante.giriSullaGomma = 0;
    partecipante.fermateEffettuate++;
    partecipante.giroPitStop.push(giro);
    partecipante.punteggioRitmo -= tempoPitStop * (partecipante.ritmBase / 60);

    if (rischio > 0) {
      eventi.push({ giro, tipo: 'errore_pit', descrizione: `${partecipante.pilota.nome} — errore in corsia box. ${rischio}s persi.` });
    } else {
      eventi.push({ giro, tipo: 'pit_stop', descrizione: `${partecipante.pilota.nome} — pit stop. ${nuovaMescola}. ${tempoPitStop}s.` });
    }
  }

  _calcolaTassoUsura(mescolaId, circuito, meteo) {
    const mescola = DATI.MESCOLE[mescolaId];
    if (!mescola) return 2;

    const usuraBase = (100 - mescola.durata) / 50; /* Usura per giro */
    const fattoreCircuito = {
      bassa: 0.7, media: 1.0, alta: 1.4, molto_alta: 1.8
    }[circuito.usuraGomme] || 1.0;

    /* Temperatura influenza usura */
    let fattoreTemp = 1;
    if (meteo.temperaturaPista > mescola.temperaturaOttimale.max) {
      fattoreTemp = 1 + (meteo.temperaturaPista - mescola.temperaturaOttimale.max) / 50;
    } else if (meteo.temperaturaPista < mescola.temperaturaOttimale.min) {
      fattoreTemp = 1 + (mescola.temperaturaOttimale.min - meteo.temperaturaPista) / 80;
    }

    return usuraBase * fattoreCircuito * fattoreTemp;
  }

  _applicaPenalitaGara(risultati, g, eventi) {
    /* Penalità temporee per manovre irregolari (casistica reale 2010-2024) */
    risultati.filter(r => !r.ritiro && !r.isGiocatore).forEach(r => {
      if (g.probabilita(0.04)) {
        const penalita = g.dallaLista([5, 10]);
        r.penalitaSecondi += penalita;
        const motivazioni = [
          'Contatto in curva',
          'Superamento limiti di pista con vantaggio',
          'Pit lane entry irregolare',
          'Ignorato bandiera blu'
        ];
        eventi.push({
          giro: g.intervallo(5, risultati.length > 0 ? 50 : 20),
          tipo: 'penalita',
          descrizione: `${r.pilota.nome} — penalità ${penalita}s. ${g.dallaLista(motivazioni)}.`
        });
      }
    });
  }

  /* ----------------------------------------------------------
     PARTECIPANTI GARA
  ---------------------------------------------------------- */

  _ottieniPartecipantiGara(circuito) {
    const partecipanti = [];

    if (this.stato.categoria === 'AR1') {
      DATI.SQUADRE_AR1.forEach(squadra => {
        const isGiocatoreTeam = squadra.id === this.stato.squadraId;
        const pilotiSquadra = isGiocatoreTeam
          ? this._getPilotiGiocatoreConSostituzioni()
          : this._getPilotiSquadraAI(squadra.id);
        pilotiSquadra.forEach((pilota, idx) => {
          partecipanti.push({
            squadraId: squadra.id,
            nomeSquadra: squadra.nomeBreve,
            pilota: structuredClone(pilota),
            isGiocatore: isGiocatoreTeam,
            pilotaIndex: idx,
            mescola: (isGiocatoreTeam && this.stato.mescolaPartenzaScelta)
              ? this.stato.mescolaPartenzaScelta
              : circuito.mescole[1] /* Mescola media di partenza di default */
          });
        });
      });
    } else if (this.stato.categoria === 'AR2') {
      DATI.SQUADRE_AR2.forEach(squadra => {
        const pilotiSquadra = DATI.PILOTI_AR2.filter(p => p.squadra === squadra.id);
        pilotiSquadra.forEach((pilota, idx) => {
          partecipanti.push({
            squadraId: squadra.id,
            nomeSquadra: squadra.nomeBreve,
            pilota: structuredClone(pilota),
            isGiocatore: squadra.id === this.stato.squadraId,
            pilotaIndex: idx,
            mescola: circuito.mescole[1]
          });
        });
      });
    } else {
      DATI.SQUADRE_AR3.forEach(squadra => {
        const pilotiSquadra = DATI.PILOTI_AR3.filter(p => p.squadra === squadra.id);
        pilotiSquadra.forEach((pilota, idx) => {
          partecipanti.push({
            squadraId: squadra.id,
            nomeSquadra: squadra.nomeBreve,
            pilota: structuredClone(pilota),
            isGiocatore: squadra.id === this.stato.squadraId,
            pilotaIndex: idx,
            mescola: circuito.mescole[1]
          });
        });
      });
    }

    return partecipanti;
  }

  /* Restituisce i piloti del giocatore sostituendo gli infortunati con la riserva */
  _getPilotiGiocatoreConSostituzioni() {
    const piloti = this.stato.piloti?.length > 0
      ? this.stato.piloti
      : DATI.PILOTI_AR1.filter(p => p.squadra === this.stato.squadraId);
    const riserva = this.ottieniPilotaRiserva();
    return piloti.map(p => (p.infortunato && riserva) ? riserva : p);
  }

  /* Stato infortuni attivi per la UI */
  ottieniStatoInfortuni() {
    if (this.stato.categoria !== 'AR1') return null;
    const infortunati = (this.stato.piloti || []).filter(p => p.infortunato);
    if (infortunati.length === 0) return null;
    const riserva = this.ottieniPilotaRiserva();
    return infortunati.map(p => ({
      pilota:        p,
      riserva,
      roundRitorno:  p.roundRitorno,
      roundMancanti: Math.max(0, (p.roundRitorno || 0) - this.stato.roundCorrente)
    }));
  }

  /* ----------------------------------------------------------
     TUTORIAL AR3
  ---------------------------------------------------------- */

  ottieniTestoTutorial(fase) {
    /* Restituisce il testo tutorial se è la prima volta per questa fase, null altrimenti */
    if (this.stato.categoria !== 'AR3') return null;
    if (!this.stato.tutorialVisto) this.stato.tutorialVisto = {};
    if (this.stato.tutorialVisto[fase]) return null;
    return TUTORIAL_AR3[fase] || null;
  }

  segnaTestoTutorialVisto(fase) {
    if (!this.stato.tutorialVisto) this.stato.tutorialVisto = {};
    this.stato.tutorialVisto[fase] = true;
    this.salva();
  }

  /* ----------------------------------------------------------
     SIMULAZIONE AR3 — qualifica singola e sprint invertita
  ---------------------------------------------------------- */

  simulaQualificaAR3(circuito, meteoSessione) {
    /* Sessione unica, nessuna eliminazione Q1/Q2/Q3 */
    const g = this.generatore;
    const partecipanti = this._ottieniPartecipantiGara(circuito);

    const risultati = partecipanti.map(p => {
      const perfVettura = this._calcolaPerformanceVettura(p.squadraId, circuito);
      const perfPilota  = this._calcolaPerformanzaPilota(p.pilota, circuito, meteoSessione);
      const tempoBase   = 78000 + (100 - ((perfVettura * 0.60) + (perfPilota * 0.40))) * 280;
      const rumore      = g.gaussiana(0, 150);
      const pioggia     = meteoSessione.pioggia ? g.intervallo(1500, 6000) : 0;
      const tempoMs     = Math.round(tempoBase + rumore + pioggia);
      return { ...p, tempoMs, tempoFormattato: this._formattempoMs(tempoMs) };
    });

    risultati.sort((a, b) => a.tempoMs - b.tempoMs);
    risultati.forEach((r, idx) => { r.posizioneGriglia = idx + 1; });

    this.stato.grigliaPartenza = risultati;
    this.salva();
    return risultati;
  }

  simulaSprintAR3(circuito, meteoSessione) {
    /* Griglia invertita dei primi 10 — poi simula gara corta */
    const griglia = this.stato.grigliaPartenza;
    if (!griglia || griglia.length === 0) return null;

    const top10     = griglia.slice(0, 10).map(p => ({ ...p })).reverse();
    const resto     = griglia.slice(10).map(p => ({ ...p }));
    const invertita = [...top10, ...resto];
    invertita.forEach((p, idx) => { p.posizioneGriglia = idx + 1; });

    /* Sprint: circa un terzo dei giri della gara principale */
    const circuitoSprint = { ...circuito, giri: Math.max(8, Math.round(circuito.giri * 0.33)) };
    const risultato      = this.simulaGara(circuitoSprint, meteoSessione, invertita, {});

    /* Punti ridotti per la sprint */
    risultato.risultati.forEach(r => {
      r.puntiGuadagnati = DATI.PUNTI_SPRINT[r.posizione - 1] || 0;
    });

    /* Aggiorna classifiche con i punti sprint */
    this._aggiornaClassifiche(risultato.risultati);
    this.stato.ultimaSprint = {
      circuito: circuito.id,
      risultati: risultato.risultati,
      eventi: risultato.eventi
    };
    this.salva();
    return risultato;
  }

  /* ----------------------------------------------------------
     QUALIFICA AR1 — SISTEMA A CHECKPOINT (Q1 / Q2 / Q3)
     Ogni segmento ha 2 checkpoint. Il giocatore sceglie gomma
     e se mandare in pista ogni pilota prima di ogni checkpoint.
  ---------------------------------------------------------- */

  iniziaQualificaAR1(circuito, meteoBase) {
    const partecipanti = this._ottieniPartecipantiGara(circuito);
    const partecipantiQ = partecipanti.map(p => ({
      ...p,
      tempoMiglioreMs: null,
      tempoMiglioreFormattato: null,
      gommaCorrente: circuito.mescole[circuito.mescole.length - 1], /* Soft di default */
      eliminatoQ1: false,
      eliminatoQ2: false,
      penalitaGriglia: 0,
      mandaInPista: true
    }));

    this.stato.statoQualificaAttivo = {
      circuito,
      meteoBase,
      meteoAttuale: { ...meteoBase },
      segmentoCorrente: 1,    /* 1=Q1  2=Q2  3=Q3 */
      checkpointCorrente: 1,  /* 1 o 2 all'interno del segmento */
      partecipanti: partecipantiQ,
      conclusa: false
    };

    this.salva();
    return this.stato.statoQualificaAttivo;
  }

  simulaQualificaAR1Checkpoint(decisioniGiocatore) {
    /*
     * decisioniGiocatore: {
     *   pilota1: { mandaInPista: bool, gomma: string },
     *   pilota2: { mandaInPista: bool, gomma: string }
     * }
     * Restituisce: { segmento, checkpoint, ordinamento, meteoAttuale,
     *                eFineSegmento, eliminati, eConclusaQualifica }
     */
    const sq = this.stato.statoQualificaAttivo;
    if (!sq || sq.conclusa) return null;

    const g = this.generatore;
    const circuito = sq.circuito;

    /* Leggera variazione meteo tra i checkpoint */
    if (sq.meteoBase.variabilitaMeteo && g.probabilita(0.15)) {
      sq.meteoAttuale.pioggia = g.probabilita(circuito.probabilitaPioggia * 1.3);
      sq.meteoAttuale.temperaturaPista = Math.max(15,
        sq.meteoBase.temperaturaPista + g.intervallo(-4, 4));
      sq.meteoAttuale.intensitaPioggia = sq.meteoAttuale.pioggia ? g.intervallo(10, 80) : 0;
    }

    /* Applica decisioni giocatore */
    const pilotiGiocatore = sq.partecipanti.filter(p => p.isGiocatore);
    pilotiGiocatore.forEach((p, idx) => {
      const chiave = idx === 0 ? 'pilota1' : 'pilota2';
      const dec = decisioniGiocatore?.[chiave];
      if (dec?.gomma) p.gommaCorrente = dec.gomma;
      p.mandaInPista = dec?.mandaInPista !== false;
    });

    /* Partecipanti attivi nel segmento corrente */
    const attivi = sq.partecipanti.filter(p => {
      if (p.eliminatoQ1) return false;
      if (sq.segmentoCorrente >= 2 && p.eliminatoQ2) return false;
      return true;
    });

    /* Simula giro per ogni partecipante */
    attivi.forEach(p => {
      const vaInPista = p.isGiocatore ? (p.mandaInPista !== false) : true;
      if (!vaInPista) return;

      const perfVettura = this._calcolaPerformanceVettura(p.squadraId, circuito);
      const perfPilota  = this._calcolaPerformanzaPilota(p.pilota, circuito, sq.meteoAttuale);
      const bonusGomma  = this._bonusGommaQualifica(p.gommaCorrente, circuito.mescole);

      const tempoBase = 75000 + (100 - ((perfVettura * 0.65) + (perfPilota * 0.35))) * 400;
      /* Più varianza al primo checkpoint: gomme fredde, assetto non ancora ottimale */
      const varianza  = sq.checkpointCorrente === 1 ? 280 : 140;
      const rumore    = g.gaussiana(0, varianza);
      const tempoBagnato = sq.meteoAttuale.pioggia ? g.intervallo(2000, 8000) : 0;
      const tempo     = Math.round(tempoBase + rumore + tempoBagnato - bonusGomma);

      if (p.tempoMiglioreMs === null || tempo < p.tempoMiglioreMs) {
        p.tempoMiglioreMs = tempo;
        p.tempoMiglioreFormattato = this._formattempoMs(tempo);
      }
    });

    /* Ordina per tempo migliore */
    const ordinati = [...attivi].sort((a, b) => {
      if (!a.tempoMiglioreMs) return 1;
      if (!b.tempoMiglioreMs) return -1;
      return a.tempoMiglioreMs - b.tempoMiglioreMs;
    });

    const eFineSegmento = sq.checkpointCorrente === 2;
    const risultato = {
      segmento: sq.segmentoCorrente,
      checkpoint: sq.checkpointCorrente,
      ordinamento: ordinati,
      meteoAttuale: { ...sq.meteoAttuale },
      eFineSegmento,
      eliminati: [],
      eConclusaQualifica: false
    };

    if (eFineSegmento) {
      if (sq.segmentoCorrente === 1) {
        const eliminati = ordinati.slice(15);
        eliminati.forEach(p => { p.eliminatoQ1 = true; });
        risultato.eliminati = eliminati;
      } else if (sq.segmentoCorrente === 2) {
        const eliminati = ordinati.slice(10);
        eliminati.forEach(p => { p.eliminatoQ2 = true; });
        risultato.eliminati = eliminati;
      } else {
        this._finalizzaQualificaAR1();
        risultato.eConclusaQualifica = true;
      }

      if (sq.segmentoCorrente < 3) {
        sq.segmentoCorrente++;
        sq.checkpointCorrente = 1;
      }
    } else {
      sq.checkpointCorrente++;
    }

    this.salva();
    return risultato;
  }

  _bonusGommaQualifica(mescolaId, mescoleCircuito) {
    /* Vantaggio in ms rispetto alla mescola più dura disponibile.
       Mescola più morbida = baseline (0ms), le altre più lente. */
    const n = mescoleCircuito.length;
    const indice = mescoleCircuito.indexOf(mescolaId);
    if (indice === n - 1) return 0;    /* Soft: la più veloce */
    if (indice === n - 2) return 400;  /* Media */
    if (indice >= 0)      return 800;  /* Dura */
    if (mescolaId === 'INTERMEDIA') return 2000;
    if (mescolaId === 'FULL_WET')   return 4500;
    return 0;
  }

  _finalizzaQualificaAR1() {
    const sq = this.stato.statoQualificaAttivo;
    const g  = this.generatore;

    const q3 = sq.partecipanti
      .filter(p => !p.eliminatoQ1 && !p.eliminatoQ2)
      .sort((a, b) => (a.tempoMiglioreMs || 999999) - (b.tempoMiglioreMs || 999999));
    const elQ2 = sq.partecipanti
      .filter(p => p.eliminatoQ2 && !p.eliminatoQ1)
      .sort((a, b) => (a.tempoMiglioreMs || 999999) - (b.tempoMiglioreMs || 999999));
    const elQ1 = sq.partecipanti
      .filter(p => p.eliminatoQ1)
      .sort((a, b) => (a.tempoMiglioreMs || 999999) - (b.tempoMiglioreMs || 999999));

    const griglia = [...q3, ...elQ2, ...elQ1];
    griglia.forEach((r, idx) => { r.posizioneGriglia = idx + 1; });
    this._applicaPenalGriglia(griglia, g);

    this.stato.grigliaPartenza = griglia;
    sq.conclusa  = true;
    sq.grigliaDef = griglia;
    this.salva();
  }

  /* ----------------------------------------------------------
     GARA AR1 — SISTEMA A CHECKPOINT (ogni 10 giri + interrupt)
     Il giocatore sceglie ritmo e pit stop ad ogni checkpoint.
  ---------------------------------------------------------- */

  iniziaGaraAR1(circuito, meteoBase) {
    const g      = this.generatore;
    const griglia = this.stato.grigliaPartenza || this._ottieniPartecipantiGara(circuito);

    const mescolaGiocatore = this.stato.mescolaPartenzaScelta || circuito.mescole[1];
    const partecipanti = griglia.map((p, idx) => ({
      ...p,
      posizione: p.posizioneGriglia || (idx + 1),
      gommaCorrente: p.gommaCorrente || (p.squadraId === this.stato.squadraId ? mescolaGiocatore : circuito.mescole[1]),
      usuraGomma: 0,
      giriSullaGomma: 0,
      punteggioRitmo: 1000 - ((p.posizioneGriglia || idx + 1) * 0.5),
      ritmBase: 0,
      ritmGiro: 0,
      fermateEffettuate: 0,
      giroPitStop: [],
      ritiro: false,
      motivoRitiro: null,
      penalitaSecondi: 0,
      gap: 0,
      fattoreRitmoGiocatore: 1.0,
      pitPianificato: null,
      giroVeloce: false
    }));

    partecipanti.forEach(p => {
      const perfVettura = this._calcolaPerformanceVettura(p.squadraId, circuito);
      const perfPilota  = this._calcolaPerformanzaPilota(p.pilota, circuito, meteoBase);
      p.ritmBase = (perfVettura * 0.65) + (perfPilota * 0.35);
    });

    this.stato.statoGaraAttivo = {
      circuito,
      meteoBase,
      meteoAttuale: { ...meteoBase },
      giroCorrente: 0,
      giriTotali: circuito.giri,
      partecipanti,
      eventi: [],
      safetyCar: false,
      virtualSafetyCar: false,
      giriSafetyCar: 0,
      conclusa: false
    };

    this.salva();
    return this.stato.statoGaraAttivo;
  }

  simulaGaraAR1AlCheckpoint(decisioniGiocatore) {
    /*
     * decisioniGiocatore: {
     *   pilota1: { ritmo: 'push'|'normale'|'conserva',
     *              pitStop: { giro: N, mescola: 'C3'|... } | null },
     *   pilota2: { ... }
     * }
     * Restituisce: { giroCorrente, giriTotali, meteoAttuale, posizioni,
     *                eventiCheckpoint, safetyCar, virtualSafetyCar,
     *                eConclusaGara, pilotiGiocatore }
     */
    const sg = this.stato.statoGaraAttivo;
    if (!sg || sg.conclusa) return null;

    const g       = this.generatore;
    const circuito = sg.circuito;

    /* Applica decisioni ritmo e pit pianificati */
    if (decisioniGiocatore) {
      const molt = { push: 1.015, normale: 1.0, conserva: 0.985 };
      sg.partecipanti.filter(p => p.isGiocatore).forEach((p, idx) => {
        const chiave = idx === 0 ? 'pilota1' : 'pilota2';
        const dec = decisioniGiocatore[chiave];
        if (!dec) return;
        p.fattoreRitmoGiocatore = molt[dec.ritmo] || 1.0;
        if (dec.pitStop) p.pitPianificato = dec.pitStop;
      });
    }

    /* Simula da giro corrente al prossimo checkpoint (ogni 10 giri) */
    const giroFine = Math.min(sg.giriTotali, sg.giroCorrente + 10);
    const eventiCheckpoint = [];

    for (let giro = sg.giroCorrente + 1; giro <= giroFine; giro++) {
      /* Cambio meteo */
      if (sg.meteoBase.variabilitaMeteo && g.probabilita(0.03)) {
        const vecchiaPioggia = sg.meteoAttuale.pioggia;
        sg.meteoAttuale.pioggia = g.probabilita(circuito.probabilitaPioggia * 1.5);
        sg.meteoAttuale.intensitaPioggia = sg.meteoAttuale.pioggia ? g.intervallo(15, 90) : 0;
        if (sg.meteoAttuale.pioggia !== vecchiaPioggia) {
          eventiCheckpoint.push({
            giro,
            tipo: sg.meteoAttuale.pioggia ? 'meteo_pioggia' : 'meteo_asciutto',
            descrizione: sg.meteoAttuale.pioggia ? 'Inizia a piovere.' : 'La pista si asciuga.'
          });
        }
        sg.meteoAttuale.temperaturaPista = Math.max(15,
          sg.meteoBase.temperaturaPista + g.intervallo(-5, 5));
      }

      /* Incidenti / safety car */
      if (!sg.safetyCar && g.probabilita(circuito.probabilitaSafetyCar / sg.giriTotali)) {
        const vittime = sg.partecipanti.filter(p => !p.ritiro && !p.isGiocatore);
        if (vittime.length > 0) {
          const coinvolto = g.dallaLista(vittime);
          if (g.probabilita(0.3)) {
            coinvolto.ritiro = true;
            coinvolto.motivoRitiro = 'Incidente';
            sg.safetyCar = true;
            sg.giriSafetyCar = g.intervallo(3, 7);
            eventiCheckpoint.push({ giro, tipo: 'safety_car',
              descrizione: `Safety car. Incidente per ${coinvolto.pilota.nome}.` });
          } else {
            sg.virtualSafetyCar = true;
            sg.giriSafetyCar = g.intervallo(2, 4);
            eventiCheckpoint.push({ giro, tipo: 'vsc',
              descrizione: 'Virtual safety car. Detriti in pista.' });
          }
        }
      }

      if (sg.safetyCar || sg.virtualSafetyCar) {
        sg.giriSafetyCar--;
        if (sg.giriSafetyCar <= 0) {
          if (sg.safetyCar)        eventiCheckpoint.push({ giro, tipo: 'fine_sc', descrizione: 'Safety car rientrata. Gara ripartita.' });
          if (sg.virtualSafetyCar) eventiCheckpoint.push({ giro, tipo: 'fine_vsc', descrizione: 'Virtual safety car terminata.' });
          sg.safetyCar = false;
          sg.virtualSafetyCar = false;
        }
      }

      /* Guasti meccanici */
      const tassoGuasto = this._tassoGuastiCategoria();
      const motiviGuasto = this._motiviRitiroCategoria();
      sg.partecipanti.filter(p => !p.ritiro && !p.isGiocatore).forEach(p => {
        if (g.probabilita(tassoGuasto)) {
          p.ritiro = true;
          p.motivoRitiro = g.dallaLista(motiviGuasto);
          eventiCheckpoint.push({ giro, tipo: 'ritiro',
            descrizione: `${p.pilota.nome} — ${p.motivoRitiro}.` });
        }
      });

      /* Pit stop AI */
      sg.partecipanti.filter(p => !p.ritiro && !p.isGiocatore).forEach(p => {
        if (this._valutaPitStopAI(p, giro, sg.giriTotali, circuito, sg.meteoAttuale, sg.safetyCar, sg.virtualSafetyCar)) {
          this._eseguiPitStop(p, giro, circuito, sg.meteoAttuale, g, eventiCheckpoint, false);
        }
      });

      /* Pit stop pianificato giocatore */
      sg.partecipanti.filter(p => p.isGiocatore && !p.ritiro).forEach(p => {
        if (p.pitPianificato && p.pitPianificato.giro === giro) {
          this._eseguiPitStop(p, giro, circuito, sg.meteoAttuale, g, eventiCheckpoint, true, p.pitPianificato.mescola);
          p.pitPianificato = null;
        }
      });

      /* Ritmo, usura e posizioni */
      sg.partecipanti.filter(p => !p.ritiro).forEach(p => {
        p.giriSullaGomma++;
        let tassoUsura = this._calcolaTassoUsura(p.gommaCorrente, circuito, sg.meteoAttuale);
        if (p.isGiocatore) {
          const dUsura2 = this.stato.direttiveStagione || {};
          if (dUsura2.direttoreGara === 'dg_gomme') tassoUsura *= 0.95;
          if (dUsura2.dataAnalyst  === 'da_gara')   tassoUsura *= 0.97;
        }
        p.usuraGomma = Math.min(100, p.usuraGomma + tassoUsura);

        let fattoreVelocita = 1 - (p.usuraGomma / 200);
        if (sg.safetyCar)        fattoreVelocita *= 0.75;
        if (sg.virtualSafetyCar) fattoreVelocita *= 0.85;

        if (sg.meteoAttuale.pioggia && !['INTERMEDIA', 'FULL_WET'].includes(p.gommaCorrente)) {
          fattoreVelocita *= 0.85;
        }

        if (p.isGiocatore) fattoreVelocita *= (p.fattoreRitmoGiocatore || 1.0);

        const rumore = g.gaussiana(0, 0.5);
        p.ritmGiro = p.ritmBase * fattoreVelocita + rumore;
        p.punteggioRitmo += p.ritmGiro;
      });

      const attivi = sg.partecipanti.filter(p => !p.ritiro);
      attivi.sort((a, b) => b.punteggioRitmo - a.punteggioRitmo);
      attivi.forEach((p, idx) => {
        p.posizione = idx + 1;
        p.gap = idx === 0 ? 0 : Math.round((attivi[0].punteggioRitmo - p.punteggioRitmo) * 0.8 * 10) / 10;
      });
    } /* Fine loop */

    sg.giroCorrente = giroFine;
    sg.eventi.push(...eventiCheckpoint);

    const eConclusaGara = sg.giroCorrente >= sg.giriTotali;
    if (eConclusaGara) this._finalizzaGaraAR1();

    this.salva();

    const ordinati = sg.partecipanti
      .filter(p => !p.ritiro).sort((a, b) => a.posizione - b.posizione)
      .concat(sg.partecipanti.filter(p => p.ritiro));

    return {
      giroCorrente: sg.giroCorrente,
      giriTotali:   sg.giriTotali,
      meteoAttuale: { ...sg.meteoAttuale },
      posizioni:    ordinati,
      eventiCheckpoint,
      safetyCar:        sg.safetyCar,
      virtualSafetyCar: sg.virtualSafetyCar,
      eConclusaGara,
      pilotiGiocatore: sg.partecipanti.filter(p => p.isGiocatore)
    };
  }

  _finalizzaGaraAR1() {
    const sg = this.stato.statoGaraAttivo;
    const g  = this.generatore;

    const risultatiFinali = sg.partecipanti
      .filter(p => !p.ritiro).sort((a, b) => a.posizione - b.posizione)
      .concat(sg.partecipanti.filter(p => p.ritiro));

    let nNonRitirati = 0;
    const listRitirati = [];
    risultatiFinali.forEach(p => { if (p.ritiro) listRitirati.push(p); else nNonRitirati++; });
    let posizioneRitirati = nNonRitirati + 1;
    listRitirati.forEach(p => { p.posizione = posizioneRitirati++; });

    /* Giro veloce */
    const candidati = risultatiFinali.filter(p => !p.ritiro && p.posizione <= 10);
    if (candidati.length > 0) {
      candidati.reduce((a, b) => a.ritmGiro > b.ritmGiro ? a : b).giroVeloce = true;
    }

    /* Punti */
    risultatiFinali.forEach(r => {
      r.puntiGuadagnati = DATI.PUNTI_GARA[r.posizione - 1] || 0;
      if (r.giroVeloce && r.posizione <= 10) r.puntiGuadagnati += (DATI.PUNTI_GIRO_VELOCE || 1);
    });

    this._applicaPenalitaGara(risultatiFinali, g, sg.eventi);
    this._aggiornaClassifiche(risultatiFinali);
    this._aggiornaReputazioneDopoGara(risultatiFinali);

    this.stato.ultimaGara = {
      circuito: sg.circuito.id,
      risultati: risultatiFinali,
      eventi:    sg.eventi,
      meteo:     sg.meteoAttuale
    };

    sg.conclusa = true;
    sg.risultatiFinali = risultatiFinali;
    this.salva();
  }

  /* ----------------------------------------------------------
     LOGISTICA E SPOSTAMENTI
  ---------------------------------------------------------- */

  calcolaLogistica() {
    const calendario = this._ottieniCalendario();
    const idx        = this.stato.roundCorrente;
    const corrente   = calendario[idx - 1];
    const prossimo   = calendario[idx];
    const efficienza = (this.stato.staff?.direttoreLogistica?.statistiche?.efficienza || 65) / 100;
    const costoBase  = 480000;
    const costo      = Math.round(costoBase * (1.4 - efficienza * 0.8));

    return {
      partenza:        corrente ? corrente.paese  : '—',
      circuitoPartenza: corrente ? corrente.nome  : '—',
      destinazione:    prossimo  ? prossimo.paese  : '—',
      circuitoProssimo: prossimo  ? prossimo.nome  : 'Fine stagione',
      costoStimato:    costo,
      efficienzaTeam:  Math.round(efficienza * 100),
      notaDirettore:   this._notaLogistica(efficienza)
    };
  }

  _notaLogistica(efficienza) {
    if (efficienza > 0.80) return 'Trasferimento ottimizzato. Attrezzature in partenza nei tempi previsti. Costi operativi nella media bassa del paddock.';
    if (efficienza > 0.65) return 'Operazioni di trasferimento nella norma. Arrivo stimato nel rispetto della tabella di marcia.';
    return 'Rilevati margini di ottimizzazione. I costi di trasferimento risultano superiori alla media del paddock. Intervento consigliato.';
  }

  /* ----------------------------------------------------------
     CLASSIFICHE
  ---------------------------------------------------------- */

  _inizializzaClassifiche() {
    const squadre = this.stato.categoria === 'AR1' ? DATI.SQUADRE_AR1
      : this.stato.categoria === 'AR2' ? DATI.SQUADRE_AR2 : DATI.SQUADRE_AR3;
    const piloti = this.stato.categoria === 'AR1' ? DATI.PILOTI_AR1
      : this.stato.categoria === 'AR2' ? DATI.PILOTI_AR2 : DATI.PILOTI_AR3;

    this.stato.classificaCostruttori = squadre.map(s => ({
      squadraId: s.id, nome: s.nome, nomeBreve: s.nomeBreve,
      colore: s.colore, punti: 0, vittorie: 0, podii: 0
    }));

    this.stato.classificaPiloti = piloti.map(p => ({
      pilotaId: p.id, nome: p.nome, nazionalita: p.nazionalita, bandiera: p.bandiera,
      squadraId: p.squadra, punti: 0, vittorie: 0, podii: 0, giriVeloce: 0
    }));
  }

  _aggiornaClassifiche(risultatiGara) {
    risultatiGara.forEach(r => {
      /* Classifica piloti */
      const entryPilota = this.stato.classificaPiloti.find(cp => cp.pilotaId === r.pilota.id);
      if (entryPilota) {
        entryPilota.punti += r.puntiGuadagnati || 0;
        if (r.posizione === 1) entryPilota.vittorie++;
        if (r.posizione <= 3) entryPilota.podii++;
        if (r.giroVeloce) entryPilota.giriVeloce++;
      }

      /* Classifica costruttori */
      const entrySquadra = this.stato.classificaCostruttori.find(cs => cs.squadraId === r.squadraId);
      if (entrySquadra) {
        entrySquadra.punti += r.puntiGuadagnati || 0;
        if (r.posizione === 1) entrySquadra.vittorie++;
        if (r.posizione <= 3) entrySquadra.podii++;
      }
    });

    /* Ordina per punti */
    this.stato.classificaCostruttori.sort((a, b) => b.punti - a.punti || b.vittorie - a.vittorie);
    this.stato.classificaPiloti.sort((a, b) => b.punti - a.punti || b.vittorie - a.vittorie);

    /* Aggiorna soddisfazione sponsor dopo ogni gara */
    this._aggiornaSoddisfazioneSponsor();
  }

  /* ----------------------------------------------------------
     SISTEMA DI REPUTAZIONE
  ---------------------------------------------------------- */

  _aggiornaReputazioneDopoGara(risultatiGara) {
    const squad = risultatiGara.filter(r => r.isGiocatore);
    if (squad.length === 0) return;

    const posizioni = squad.map(r => r.posizione);
    const mediaPosizione = posizioni.reduce((a, b) => a + b, 0) / posizioni.length;
    const nPartecipanti = risultatiGara.length;

    /* Performance relativa */
    const percentuale = 1 - (mediaPosizione / nPartecipanti);

    /* Variazione reputazione performance */
    let deltaPerf = 0;
    if (percentuale > 0.75) deltaPerf = 15;
    else if (percentuale > 0.5) deltaPerf = 8;
    else if (percentuale > 0.25) deltaPerf = 2;
    else deltaPerf = -5;

    /* Variazione reputazione mediatica */
    let deltaMedia = 0;
    const migliorePosizione = Math.min(...posizioni);
    if (migliorePosizione === 1) deltaMedia = 20;
    else if (migliorePosizione <= 3) deltaMedia = 10;
    else if (migliorePosizione <= 10) deltaMedia = 3;
    else deltaMedia = -2;

    /* Social Media Manager: amplifica reputazione mediatica dopo ogni gara */
    const smm = this.stato.staff?.socialMediaManager;
    if (smm) {
      const com = smm.statistiche?.comunicazione || smm.statistiche?.carisma || 65;
      deltaMedia += Math.max(0, Math.round((com - 65) / 10));
    }

    this.stato.reputazione.performance = Math.min(10000,
      Math.max(0, this.stato.reputazione.performance + deltaPerf));
    this.stato.reputazione.mediatica = Math.min(10000,
      Math.max(0, this.stato.reputazione.mediatica + deltaMedia));

    /* Ricalcola totale */
    this._ricalcolaTotaleReputazione();
  }

  aggiornaReputazione(tipo, delta) {
    /* tipo: 'tecnica' | 'performance' | 'mediatica' | 'finanziaria' | 'generale' */
    if (!this.stato.reputazione.hasOwnProperty(tipo)) return;
    this.stato.reputazione[tipo] = Math.min(10000,
      Math.max(0, this.stato.reputazione[tipo] + delta));
    this._ricalcolaTotaleReputazione();
    this.salva();
  }

  _ricalcolaTotaleReputazione() {
    const r = this.stato.reputazione;
    /* I sottotipi valgono 2/3 del totale, la generale 1/3 */
    const sottoTipi = (r.tecnica + r.performance + r.mediatica + r.finanziaria) / 4;
    r.totale = Math.round((sottoTipi * (2/3)) + (r.generale * (1/3)));
  }

  /* ----------------------------------------------------------
     SVILUPPO TECNICO (solo AR1)
  ---------------------------------------------------------- */

  applicaUpgrade(tipo, entita) {
    /* tipo: 'aerodinamica' | 'meccanica' | 'elettronica' | 'powerUnit' */
    /* entita: numero positivo (miglioramento relativo) */
    if (!this.stato.macchina) return false;
    if (!this.stato.macchina.hasOwnProperty(tipo)) return false;

    const valoreAttuale = this.stato.macchina[tipo];
    /* Responsabile Comunicazione Tecnica: piccolo bonus al coordinamento inter-dipartimentale */
    const rc = this.stato.staff?.responsabileComunicazione;
    const bonusRC = rc ? Math.max(0, ((rc.statistiche?.comunicazione || rc.statistiche?.coordinamento || 65) - 65) / 1200) : 0;
    const incremento = Math.min(entita * (1 + bonusRC), (100 - valoreAttuale) * 0.8);
    this.stato.macchina[tipo] = Math.round((valoreAttuale + incremento) * 10) / 10;

    /* Aggiorna reputazione tecnica (aggiornaReputazione chiama già this.salva()) */
    this.aggiornaReputazione('tecnica', Math.round(incremento * 2));

    return { tipo, incremento: Math.round(incremento * 10) / 10, nuovoValore: this.stato.macchina[tipo] };
  }

  ottieniStimaMacchina() {
    if (this.stato.categoria !== 'AR1') return null;
    /* stimaMacchina è { ultimaStima: {...} } oppure null */
    return this.stato.stimaMacchina?.ultimaStima || { valore: null, margineErrore: 10, qualitaDati: 0 };
  }

  /* ----------------------------------------------------------
     FINE STAGIONE E PROMOZIONE
  ---------------------------------------------------------- */

  _terminaStagione() {
    const classifica = this.stato.classificaCostruttori;
    const posizioneGiocatore = classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1;

    /* Archivia stagione (include delta per riferimento storico) */
    const _st = this.stato.statisticheStagione || { miglioreRisultato: 20, numeroPodi: 0, gareDispute: 0 };
    this.stato.storico.push({
      stagione:          this.stato.stagione,
      categoria:         this.stato.categoria,
      squadraId:         this.stato.squadraId,
      posizione:         posizioneGiocatore,
      punti:             classifica[posizioneGiocatore - 1]?.punti || 0,
      delta:             this.stato.deltaOttimizzazione || 0,
      budgetResiduo:     this.stato.categoria === 'AR1' ? (this.stato.budget - (this.stato.budgetSpeso || 0)) : undefined,
      miglioreRisultato: _st.miglioreRisultato < 21 ? _st.miglioreRisultato : null,
      numeroPodi:        _st.numeroPodi || 0,
      gareDispute:       _st.gareDispute || 0,
      eraId:             this.stato.eraRegolamentare?.id || null
    });
    /* Reset statistiche stagione */
    this.stato.statisticheStagione = { miglioreRisultato: 20, numeroPodi: 0, gareDispute: 0 };

    /* Meccanismo salvataggio crisi (solo AR1) */
    if (this.stato.categoria === 'AR1' && posizioneGiocatore === 10) {
      this.stato.eventoStagione = 'salvataggio_crisi';
      /* Iniezione finanziaria straordinaria */
      this.stato.budget = Math.max(this.stato.budget, 120000000);
    }

    /* Controllo promozione — usa il delta accumulato nell'intera stagione */
    const promozione = this._verificaPromozione(posizioneGiocatore, classifica.length);

    this.stato.stagione++;
    this.stato.roundCorrente = 0;
    this.stato.faseCorrente = 'pausa_invernale';
    this.stato.datiFP = { fp1: null, fp2: null, fp3: null };
    this.stato.bonusFPCorrente = 0;
    this.stato.grigliaPartenza = null;
    this.stato.statoQualificaAttivo = null;
    this.stato.statoGaraAttivo = null;
    this.stato.ultimaGara = null;
    this.stato.stimaMacchina = null;
    this.stato.pianoUpgrade = [];
    this.stato.conoscenzaMacchina = { aerodinamica: 0, meccanica: 0, powerUnit: 0, baseline: 0 };
    this.stato.testPreStagionali  = { completati: false, giorno: 1, sessione: 0, programmiSvolti: [], reportGiornalieri: [] };
    this.stato.tokenUsati = 0;
    this._aggiornaFedeltaFineAnno();
    this._applicaBeneficiReputazioneSponsor();
    this._verificaTerminazioneContrattiSponsor();

    /* Clausola prestazione (pacchetto rinnovo): bonus umore se squadra top-5 */
    if (this.stato.categoria === 'AR1' && posizioneGiocatore <= 5) {
      (this.stato.piloti || []).forEach(p => {
        if (p.contratto?.clausola === 'top5') {
          p.umore = Math.min(100, (p.umore || 70) + 8);
        }
      });
    }

    /* Reset sondaggi, direttive e statistiche prestazione piloti */
    this.stato.sondaggiPilotiAR1  = [];
    this.stato.direttiveStagione  = {};
    this.stato.performancePiloti  = {};

    /* Azzera infortuni a fine stagione */
    (this.stato.piloti || []).forEach(p => { p.infortunato = false; p.roundRitorno = null; });
    this.stato.pilotaInfortunato = null;
    this.stato.ultimoInfortunio  = null;

    /* Reset contatori relazioni stagionali */
    this.stato.colloquiPilotiRound     = {};
    this.stato.negoziazioniFedStagione = {};
    /* Le negoziazioni vengono sempre rivelate entro la stagione corrente;
       a fine stagione si pulisce tutto per evitare accumulo indefinito. */
    this.stato.negoziazioniAttiveFed   = [];
    this.stato.riunioniSquadraStagione = 0;
    this.stato.eventiHospitalityStagione = 0;
    this.stato.aggiornamentoSponsorRound = {};
    this.stato.incontriStaffRound      = {};
    this.stato.conferenzaStampaRound   = -1;
    this.stato.dichiarazioneTecnicaStagione = false;
    /* Storico mercato AI: sovrascritto ogni inverno, ma l'array cresceva nel tempo */
    this.stato.eventiMercatoAI = [];
    /* Voci di spesa: resettate a fine stagione. Il budget è già tracciato in
       stato.budgetSpeso; le voci individuali non sono usate per calcoli futuri. */
    this.stato.spese = [];

    if (promozione) {
      this.stato.categoriaPregressa = this.stato.categoria;
      this.stato.categoria = promozione;
      this._preparaNuovaCategoria(); /* resetta deltaOttimizzazione */
    } else {
      /* Nessuna promozione: reset delta per la stagione successiva nella stessa categoria */
      this.stato.deltaOttimizzazione = 0;
      /* Rigenera pool piloti liberi per il mercato invernale */
      if (this.stato.categoria === 'AR2' || this.stato.categoria === 'AR3') {
        this.stato.pilotiLiberiAR2AR3 = null;
      }
    }

    /* Reset annuale (tutte le categorie) */
    this.stato.ricercaSponsorStagione = false;
    this.stato._candidatiSponsor = [];

    /* Snapshot reputazione all'inizio della nuova stagione */
    this.stato.reputazioneInizioStagione = { ...this.stato.reputazione };

    this._inizializzaClassifiche();
    this._evoluzioneAI();

    /* Rotazione calendario AR1 (solo quando il giocatore è in AR1) */
    if (this.stato.categoria === 'AR1') {
      this._ruotaCalendario();
    }

    this.salva();

    return { posizioneGiocatore, promozione, eventoStagione: this.stato.eventoStagione };
  }

  _verificaPromozione(posizione, totaleSquadre) {
    const delta = this.stato.deltaOttimizzazione || 0;
    /*
     * Promozione garantita per classifica. Con un delta alto (gestione
     * eccellente per tutta la stagione) la soglia si abbassa di una posizione,
     * permettendo la promozione anche da fuori zona automatica.
     *
     * AR3 → AR2 : top 5 garantito, oppure 6° con delta ≥ 6
     * AR2 → AR1 : top 4 garantito, oppure 5°–6° con delta ≥ 7
     */
    if (this.stato.categoria === 'AR3') {
      if (posizione <= 5) return 'AR2';
      if (posizione === 6 && delta >= 6) return 'AR2';
    }
    if (this.stato.categoria === 'AR2') {
      if (posizione <= 4) return 'AR1';
      if (posizione <= 6 && delta >= 7) return 'AR1';
    }
    return null;
  }

  _preparaNuovaCategoria() {
    /* In AR1: assegna squadra di partenza, imposta budget e macchina */
    if (this.stato.categoria === 'AR1') {
      /* Inizializza macchineAI con copie dei valori statici — mai mutare DATI direttamente */
      this.stato.macchineAI = {};
      DATI.SQUADRE_AR1.forEach(s => {
        this.stato.macchineAI[s.id] = { ...s.macchina };
      });

      /* Inizializza pilotiAI — copia evolutiva per tutti i team AI */
      this._inizializzaPilotiAI();

      /* Assegna la squadra AR1 meno competitiva disponibile */
      const squadraAssegnata = DATI.SQUADRE_AR1[DATI.SQUADRE_AR1.length - 2]; /* Penultima della griglia */
      this.stato.squadraId = squadraAssegnata.id;
      this.stato.macchina = { ...squadraAssegnata.macchina };
      this.stato.staff = JSON.parse(JSON.stringify(squadraAssegnata.staffBase));
      this.stato.budget = squadraAssegnata.budget * 0.8; /* Stagione già iniziata */
      this.stato.budgetSpeso = 0;

      /* Piloti della squadra assegnata */
      this.stato.piloti = DATI.PILOTI_AR1
        .filter(p => p.squadra === squadraAssegnata.id)
        .map(p => JSON.parse(JSON.stringify(p)));

      /* Genera sponsor iniziali */
      this._generaSponsorIniziali();
    } else if (this.stato.categoria === 'AR2') {
      const g = this.generatore;
      const squadraAR2 = g.dallaLista(DATI.SQUADRE_AR2);
      this.stato.squadraId = squadraAR2.id;
      this.stato.piloti = DATI.PILOTI_AR2
        .filter(p => p.squadra === squadraAR2.id)
        .map(p => JSON.parse(JSON.stringify(p)));
      /* Staff AR2 */
      const staffAR2Base = DATI.STAFF_AR2[squadraAR2.id];
      if (staffAR2Base) {
        this.stato.staff = JSON.parse(JSON.stringify(staffAR2Base));
      }
      /* Reset sviluppo AR2 */
      this.stato.sviluppoAR2 = { aero: 0, meccanica: 0 };
      this.stato.pianoUpgradeAR2 = [];
      this.stato.deltaOttimizzazione = 0;
      this.stato.offerteAR1 = [];
    }
  }

  /* ----------------------------------------------------------
     TRACCIAMENTO E ROTAZIONE CALENDARIO AR1
  ---------------------------------------------------------- */

  _inizializzaTracciamentoCalendario() {
    /*
     * Traccia da quante stagioni ogni circuito è in/fuori calendario.
     * I valori di partenza rispecchiano la storia reale fino al 2026.
     */
    this.stato.tracciamentoCalendario = {};

    /* Circuiti attualmente in calendario */
    DATI.CIRCUITI.forEach(c => {
      const fisso = DATI.CIRCUITI_FISSI.has(c.id);
      this.stato.tracciamentoCalendario[c.id] = {
        inCalendario: true,
        fisso,
        stagioneSulCalendario: fisso ? 99 : _stagionInizialiSulCalendario(c.id),
        stagioniFuoriCalendario: 0
      };
    });

    /* Circuiti storici fuori calendario */
    DATI.CIRCUITI_STORICI.forEach(c => {
      this.stato.tracciamentoCalendario[c.id] = {
        inCalendario: false,
        fisso: false,
        stagioneSulCalendario: 0,
        stagioniFuoriCalendario: _stagionInizialiOffCalendario(c.id)
      };
    });

    /* Nessun annuncio di rotazione in corso */
    this.stato.annunciRotazione = [];
  }

  _ruotaCalendario() {
    const g = this.generatore;
    const tracciamento = this.stato.tracciamentoCalendario;

    /* Aggiorna contatori stagione */
    Object.values(tracciamento).forEach(t => {
      if (t.inCalendario) t.stagioneSulCalendario++;
      else t.stagioniFuoriCalendario++;
    });

    /* Decide quanti cambi fare questa stagione (0–2, raramente 3) */
    const probabilitaCambi = [0.20, 0.45, 0.30, 0.05]; /* 0, 1, 2, 3 cambi */
    let nCambi = 0;
    const dado = g.prossimo();
    let acc = 0;
    for (let i = 0; i < probabilitaCambi.length; i++) {
      acc += probabilitaCambi[i];
      if (dado < acc) { nCambi = i; break; }
    }

    /* Circuiti rotativi eleggibili per uscita (non fissi, in calendario da ≥3 stagioni) */
    const eleggibiliUscita = Object.entries(tracciamento)
      .filter(([id, t]) => t.inCalendario && !t.fisso && t.stagioneSulCalendario >= 3)
      .map(([id]) => id);

    /* Circuiti eleggibili per entrata (fuori calendario da ≥3 stagioni, inclusi storici) */
    const eleggibiliEntrata = Object.entries(tracciamento)
      .filter(([id, t]) => !t.inCalendario && t.stagioniFuoriCalendario >= 3)
      .map(([id]) => id);

    const annunci = [];
    let cambiEffettuati = 0;

    for (let i = 0; i < nCambi && cambiEffettuati < nCambi; i++) {
      if (eleggibiliUscita.length === 0 || eleggibiliEntrata.length === 0) break;

      /* Sceglie casualmente quale esce e quale entra */
      const idxUscita = Math.floor(g.prossimo() * eleggibiliUscita.length);
      const idxEntrata = Math.floor(g.prossimo() * eleggibiliEntrata.length);
      const idUscita = eleggibiliUscita.splice(idxUscita, 1)[0];
      const idEntrata = eleggibiliEntrata.splice(idxEntrata, 1)[0];

      /* Trova i dati del circuito uscente e entrante */
      const circuitoUscente = [...DATI.CIRCUITI, ...DATI.CIRCUITI_STORICI].find(c => c.id === idUscita);
      const circuitoEntrante = [...DATI.CIRCUITI, ...DATI.CIRCUITI_STORICI].find(c => c.id === idEntrata);
      if (!circuitoUscente || !circuitoEntrante) continue;

      /* Aggiorna tracciamento */
      tracciamento[idUscita].inCalendario = false;
      tracciamento[idUscita].stagioniFuoriCalendario = 0;
      tracciamento[idEntrata].inCalendario = true;
      tracciamento[idEntrata].stagioneSulCalendario = 0;

      /* Genera annuncio narrativo */
      const motivazioneUscita = g.dallaLista(DATI.MOTIVAZIONI_USCITA_CALENDARIO);
      const motivazioneEntrata = g.dallaLista(DATI.MOTIVAZIONI_ENTRATA_CALENDARIO);
      annunci.push({
        tipo: 'uscita',
        circuitoId: idUscita,
        nomeCircuito: circuitoUscente.nome,
        stagione: this.stato.stagione,
        motivazione: motivazioneUscita
      });
      annunci.push({
        tipo: 'entrata',
        circuitoId: idEntrata,
        nomeCircuito: circuitoEntrante.nome,
        stagione: this.stato.stagione,
        motivazione: motivazioneEntrata
      });

      cambiEffettuati++;
    }

    this.stato.annunciRotazione = annunci;

    /* Ricostruisce il calendario attivo per la stagione successiva */
    if (cambiEffettuati > 0) {
      this._ricostruisciCalendarioAttivo();
    }
  }

  _ricostruisciCalendarioAttivo() {
    /*
     * Il calendario attivo è la lista ordinata dei circuiti in calendario.
     * Mantiene i fissi nelle loro posizioni originali e inserisce i nuovi
     * al posto di quelli rimossi, rispettando il mese preferito dei circuiti storici.
     */
    const tracciamento = this.stato.tracciamentoCalendario;
    const tuttiCircuiti = [...DATI.CIRCUITI, ...DATI.CIRCUITI_STORICI];

    const attivi = tuttiCircuiti
      .filter(c => tracciamento[c.id]?.inCalendario)
      .sort((a, b) => {
        /* Ordina per mese: usa la data originale o il mesePreferito */
        const meseA = a.data ? new Date(a.data).getMonth() : (a.mesePreferito || 6) - 1;
        const meseB = b.data ? new Date(b.data).getMonth() : (b.mesePreferito || 6) - 1;
        return meseA - meseB;
      });

    /* Assegna i round in ordine */
    attivi.forEach((c, idx) => { c.round = idx + 1; });

    this.stato.calendarioAttivoAR1 = attivi.map(c => c.id);
  }

  ottieniCalendarioAR1Attivo() {
    /*
     * Restituisce la lista ordinata dei circuiti del calendario AR1 corrente.
     * Se è stata fatta una rotazione usa il calendario aggiornato,
     * altrimenti usa quello base di CIRCUITI.
     */
    if (this.stato.calendarioAttivoAR1) {
      const tuttiCircuiti = [...DATI.CIRCUITI, ...DATI.CIRCUITI_STORICI];
      return this.stato.calendarioAttivoAR1
        .map(id => tuttiCircuiti.find(c => c.id === id))
        .filter(Boolean);
    }
    return DATI.CIRCUITI;
  }

  /* ----------------------------------------------------------
     SIMULAZIONE AI SQUADRE (evoluzione tra stagioni)
  ---------------------------------------------------------- */

  _evoluzioneAI() {
    /* Le squadre AI sviluppano le loro macchine tra una stagione e l'altra.
       I valori vengono scritti in stato.macchineAI, non in DATI (che è statico). */
    const g = this.generatore;
    if (!this.stato.macchineAI) this.stato.macchineAI = {};

    DATI.SQUADRE_AR1.forEach(squadra => {
      if (squadra.id === this.stato.squadraId) return;

      /* Assicura che la macchina AI esista nello stato (sicurezza caricamenti vecchi) */
      if (!this.stato.macchineAI[squadra.id]) {
        this.stato.macchineAI[squadra.id] = { ...squadra.macchina };
      }

      /* Investimento proporzionale alla classifica precedente */
      const posizioneAttuale = this.stato.classificaCostruttori.length > 0
        ? this.stato.classificaCostruttori.findIndex(c => c.squadraId === squadra.id) + 1
        : 5;

      /* Anti-spirale graduale: più si è indietro in classifica, più veloce è il recupero.
         La tabella parte da 1.00 per i primi 4 posti (nessun bonus) e sale fino a 1.50
         per il 10°, con incrementi graduali per le posizioni di midfield (5°–7°). */
      const ANTISPIRALE_INV = [0, 1.00, 1.00, 1.00, 1.00, 1.05, 1.10, 1.20, 1.30, 1.40, 1.50];
      const fattoreBonus = ANTISPIRALE_INV[Math.min(10, Math.max(1, posizioneAttuale))] || 1.0;

      const mac = this.stato.macchineAI[squadra.id];
      ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(tipo => {
        /* Sigma ridotta da 1.0 a 0.6: meno varianza, progressione più prevedibile */
        const delta = g.gaussiana(1.5 * fattoreBonus, 0.6);
        mac[tipo] = Math.min(100, Math.max(40, mac[tipo] + delta));
      });
    });

    this._mercatoAI();
  }

  _evoluzioneAIMidSeason() {
    /* Sviluppo in-season: ogni 4 round le squadre AI portano aggiornamenti.
       Delta molto più contenuto rispetto all'evoluzione invernale. */
    if (this.stato.categoria !== 'AR1') return;
    if (!this.stato.macchineAI) return;

    const g = this.generatore;

    DATI.SQUADRE_AR1.forEach(squadra => {
      if (squadra.id === this.stato.squadraId) return;
      if (!this.stato.macchineAI[squadra.id]) return;

      const posizioneAttuale = this.stato.classificaCostruttori.length > 0
        ? this.stato.classificaCostruttori.findIndex(c => c.squadraId === squadra.id) + 1
        : 5;

      /* Anti-spirale attenuata in-season: graduale come l'invernale, ma con valori ridotti */
      const ANTISPIRALE_MID = [0, 1.00, 1.00, 1.00, 1.00, 1.03, 1.06, 1.12, 1.20, 1.27, 1.35];
      const fattoreBonus = ANTISPIRALE_MID[Math.min(10, Math.max(1, posizioneAttuale))] || 1.0;

      const mac = this.stato.macchineAI[squadra.id];
      ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(tipo => {
        const delta = g.gaussiana(0.20 * fattoreBonus, 0.12);
        mac[tipo] = Math.min(100, Math.max(40, mac[tipo] + delta));
      });
    });
  }

  _simulaTestPrestagionaliAI() {
    /* Simulazione semplificata dei test pre-stagionali per le squadre AI.
       Buoni test → vantaggio medio o piccolo sulla performance di inizio stagione.
       Esito determinato probabilisticamente per ogni squadra. */
    if (!this.stato.macchineAI) return;

    const g = this.generatore;

    DATI.SQUADRE_AR1.forEach(squadra => {
      if (squadra.id === this.stato.squadraId) return;
      if (!this.stato.macchineAI[squadra.id]) return;

      const esito = g.prossimo(); /* 0..1 */
      const mac   = this.stato.macchineAI[squadra.id];

      /* Moltiplicatore staff: squadre con capoIngegnere e direttoreAero migliori
         traggono più beneficio dai test — range 0.80–1.20. */
      const staffBase = squadra.staffBase || {};
      const qCI   = (staffBase.capoIngegnere?.statistiche?.coordinamento || 70) / 100;
      const qAero = (staffBase.direttoreAero?.statistiche?.innovazione   || 70) / 100;
      const moltiplicatoreStaff = 0.80 + 0.40 * ((qCI + qAero) / 2);

      if (esito < 0.25) {
        /* Test eccellente (25%): vantaggio medio su tutti e quattro i componenti */
        ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(tipo => {
          const delta = Math.max(0, g.gaussiana(1.5 * moltiplicatoreStaff, 0.4));
          mac[tipo] = Math.min(100, mac[tipo] + delta);
        });
      } else if (esito < 0.75) {
        /* Test discreto (50%): vantaggio piccolo su tutti i componenti */
        ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(tipo => {
          const delta = Math.max(0, g.gaussiana(0.5 * moltiplicatoreStaff, 0.2));
          mac[tipo] = Math.min(100, mac[tipo] + delta);
        });
      }
      /* Test scarso (25%): nessuna variazione */
    });
  }

  _diffusioneInnovazioniAI() {
    /* Le squadre AI copiano gradualmente le innovazioni del giocatore.
       La velocità di copia è proporzionale al rating del Direttore Design
       competente per quell'area. Questo simula il trasferimento di conoscenza
       tecnica nel paddock — più lento quanto più bassa è la qualità dello staff.
       Impedisce anche che ingaggi di staff si traducano in vantaggio immediato. */
    if (this.stato.categoria !== 'AR1') return;
    if (!this.stato.macchineAI || !this.stato.macchina) return;

    const g = this.generatore;
    const MAPPA_DIRETTORE = {
      aerodinamica: 'direttoreAero',
      meccanica:    'direttoreMeccanica',
      elettronica:  'direttoreElettronica',
      powerUnit:    null /* PU: diffusione generica */
    };

    DATI.SQUADRE_AR1.forEach(squadra => {
      if (squadra.id === this.stato.squadraId) return;
      const mac = this.stato.macchineAI[squadra.id];
      if (!mac) return;

      Object.keys(MAPPA_DIRETTORE).forEach(area => {
        /* Benchmark: il valore più alto presente in griglia (giocatore o AI leader).
           In questo modo le AI copiano l'innovazione chiunque la introduca, non solo
           il giocatore — impedisce che il gap intra-AI cresca indefinitamente. */
        const valoriGriglia = [this.stato.macchina?.[area] || 0];
        DATI.SQUADRE_AR1.forEach(s => {
          if (s.id !== squadra.id && this.stato.macchineAI[s.id]) {
            valoriGriglia.push(this.stato.macchineAI[s.id][area]);
          }
        });
        const benchmark = Math.max(...valoriGriglia);
        const gap = benchmark - mac[area];
        if (gap <= 3) return; /* Sotto la soglia minima: nessuna diffusione */

        const dirKey   = MAPPA_DIRETTORE[area];
        const skillInn = dirKey
          ? (squadra.staffBase?.[dirKey]?.statistiche?.innovazione || 70)
          : 70;

        /* Velocità di copia: 5–15% del gap per intervallo di 4 round */
        const velocita = 0.05 + 0.10 * (skillInn / 100);
        const delta    = gap * velocita * g.gaussiana(1, 0.25);
        mac[area] = Math.min(100, Math.max(40, mac[area] + Math.max(0, delta)));
      });
    });
  }

  /* ----------------------------------------------------------
     MERCATO PILOTI AI
  ---------------------------------------------------------- */

  _inizializzaPilotiAI() {
    /* Crea una copia evolutiva dei piloti di tutti i team AI.
       Il giocatore non è incluso — i suoi piloti vivono in stato.piloti. */
    this.stato.pilotiAI = DATI.PILOTI_AR1
      .filter(p => p.squadra !== this.stato.squadraId)
      .map(p => JSON.parse(JSON.stringify(p)));
  }

  _getPilotiSquadraAI(squadraId) {
    /* Ritorna i piloti titolari correnti di una squadra AI.
       Usa pilotiAI se inizializzato, altrimenti DATI come fallback. */
    if (this.stato.pilotiAI) {
      const risultato = this.stato.pilotiAI.filter(p => p.squadra === squadraId);
      if (risultato.length > 0) return risultato;
    }
    return DATI.PILOTI_AR1.filter(p => p.squadra === squadraId);
  }

  _mercatoAI() {
    /* Simula il mercato piloti AI tra una stagione e l'altra:
       invecchiamento, evoluzione statistiche, scadenza contratti,
       rilasci e nuovi ingaggi. Risultati scritti in stato.pilotiAI
       e stato.eventiMercatoAI — mai mutare DATI. */
    if (this.stato.categoria !== 'AR1') return;
    if (!this.stato.pilotiAI) this._inizializzaPilotiAI();

    const g       = this.generatore;
    const stagione = this.stato.stagione;
    const eventi   = [];

    /* Step 1 — invecchiamento e evoluzione statistiche */
    this.stato.pilotiAI.forEach(p => {
      if (p.squadra === 'libero') return;
      p.eta++;

      /* Aggiorna traiettoria in base all'età */
      if (p.eta <= 23)                                          p.traiettoria = 'crescita';
      else if (p.traiettoria === 'crescita' && p.eta > 27)     p.traiettoria = 'stabile';
      else if (p.eta > 35 && p.traiettoria !== 'crescita')     p.traiettoria = 'declino';

      const deltaMedio = p.traiettoria === 'crescita' ?  0.8
                       : p.traiettoria === 'stabile'  ?  0.0
                       : -1.0;
      ['talento','costanza','qualifica','gara','bagnato','gestione'].forEach(k => {
        const d = g.gaussiana(deltaMedio, 0.6);
        p.statistiche[k] = Math.min(99, Math.max(40, (p.statistiche[k] || 70) + d));
      });
    });

    /* Step 2 — scadenza contratti: ritiro o rilascio */
    this.stato.pilotiAI.forEach(p => {
      if (p.squadra === 'libero') return;

      /* Ritiro forzato oltre i 42 anni */
      if (p.eta >= 42) {
        eventi.push({ tipo: 'ritiro', pilota: p.nome, squadra: p.squadra });
        p.squadra = 'ritirato';
        return;
      }

      const contrattoScaduto = (p.contratto?.scadenza || 9999) <= stagione;
      if (!contrattoScaduto) return;

      const mediaStat   = (p.statistiche.talento + p.statistiche.gara) / 2;
      const probRinnovo = p.traiettoria === 'declino'
        ? (p.eta > 37 ? 0.25 : 0.45)
        : (mediaStat > 80 ? 0.70 : 0.55);

      if (g.probabilita(probRinnovo)) {
        /* Rinnovo contratto */
        const durata    = p.traiettoria === 'declino' ? 1 : g.intervallo(1, 3);
        const fattorStip = p.traiettoria === 'crescita' ? 1.10
                         : p.traiettoria === 'declino'  ? 0.88 : 1.0;
        p.contratto = {
          scadenza:  stagione + durata,
          stipendio: Math.round((p.contratto?.stipendio || 5000000) * fattorStip)
        };
      } else {
        /* Rilascio — diventa agente libero */
        const vecchiaSquadra = p.squadra;
        p.squadra = 'libero';
        eventi.push({ tipo: 'rilascio', pilota: p.nome, squadra: vecchiaSquadra });
      }
    });

    /* Step 3 — riempi i posti vacanti nelle squadre AI */
    DATI.SQUADRE_AR1.forEach(squadra => {
      if (squadra.id === this.stato.squadraId) return;

      const titolari = this.stato.pilotiAI.filter(p => p.squadra === squadra.id);
      if (titolari.length >= 2) return;

      const posti = 2 - titolari.length;
      for (let i = 0; i < posti; i++) {
        /* Candidati: agenti liberi ordinati per talento decrescente */
        const candidati = this.stato.pilotiAI
          .filter(p => p.squadra === 'libero')
          .sort((a, b) => (b.statistiche.talento || 0) - (a.statistiche.talento || 0));

        if (candidati.length > 0) {
          const topN   = Math.min(3, candidati.length);
          const scelto = candidati[g.intervallo(0, topN - 1)];
          scelto.squadra = squadra.id;
          scelto.contratto = {
            scadenza:  stagione + g.intervallo(1, 2),
            stipendio: scelto.contratto?.stipendio || 5000000
          };
          eventi.push({ tipo: 'ingaggio', pilota: scelto.nome, squadra: squadra.id });
        } else {
          /* Nessun agente libero: promuovi dal pool riserve */
          const riserve = (DATI.PILOTI_RISERVA_AR1 || []).filter(r => r.squadra === squadra.id);
          if (riserve.length > 0 && !this.stato.pilotiAI.some(p => p.id === riserve[0].id)) {
            const r   = JSON.parse(JSON.stringify(riserve[0]));
            r.squadra = squadra.id;
            r.contratto = { scadenza: stagione + 1, stipendio: 1500000 };
            this.stato.pilotiAI.push(r);
            eventi.push({ tipo: 'promozione', pilota: r.nome, squadra: squadra.id });
          }
        }
      }
    });

    /* Step 4 — rimuovi i piloti ritirati */
    this.stato.pilotiAI = this.stato.pilotiAI.filter(p => p.squadra !== 'ritirato');

    this.stato.eventiMercatoAI = eventi;
  }

  _aggiornaPerformancePiloti(risultatiFinali, circuito) {
    /* Dopo ogni gara: calcola il delta posizione (attesa vs reale) per ogni pilota
       e accumula il running average in stato.performancePiloti. */
    if (!this.stato.performancePiloti) this.stato.performancePiloti = {};

    /* Raccoglie le squadre presenti e calcola la qualità vettura per ognuna */
    const squadreUniche = [...new Set(risultatiFinali.map(r => r.squadraId).filter(Boolean))];
    const perfVetture = {};
    squadreUniche.forEach(sid => {
      perfVetture[sid] = this._calcolaPerformanceVettura(sid, circuito);
    });

    /* Ordina le squadre per qualità vettura (discendente) → rank 1 = migliore */
    const squadreOrdinate = [...squadreUniche].sort((a, b) => perfVetture[b] - perfVetture[a]);
    const rankSquadra = {};
    squadreOrdinate.forEach((sid, idx) => { rankSquadra[sid] = idx + 1; });

    /* Per ogni pilota non ritirato: delta = posizione_attesa_vettura - posizione_effettiva
       Positivo → ha fatto meglio di quanto la macchina avrebbe suggerito */
    const pilotiAttivi = risultatiFinali.filter(r => !r.ritiro && r.pilota?.id);
    const nPiloti = pilotiAttivi.length;
    if (nPiloti === 0) return;

    pilotiAttivi.forEach(r => {
      const pid = r.pilota.id;
      const rank = rankSquadra[r.squadraId] || Math.ceil(squadreUniche.length / 2);
      /* Posizione attesa = pilota medio di quella squadra nel campo di nPiloti piloti.
         Con 2 piloti per squadra: squadra al rank r → posizioni attese 2r-1 e 2r → media 2r-0.5 */
      const posizioneAttesa = rank * 2 - 0.5;
      const delta = posizioneAttesa - r.posizione; /* positivo = overperformance */

      if (!this.stato.performancePiloti[pid]) {
        this.stato.performancePiloti[pid] = {
          pilotaId:       pid,
          nomePilota:     r.pilota.nome,
          squadraId:      r.squadraId,
          nomeSquadra:    r.nomeSquadra,
          bandiera:       r.pilota.bandiera || '',
          eta:            r.pilota.eta,
          isGiocatoreTeam: !!r.isGiocatore,
          deltaCumulativo: 0,
          gareContate:    0
        };
      }

      const dati = this.stato.performancePiloti[pid];
      dati.deltaCumulativo += delta;
      dati.gareContate++;
      /* Aggiorna dati anagrafici (cambio squadra nel corso della stagione, età) */
      dati.nomePilota     = r.pilota.nome;
      dati.eta            = r.pilota.eta;
      dati.squadraId      = r.squadraId;
      dati.nomeSquadra    = r.nomeSquadra;
      dati.isGiocatoreTeam = !!r.isGiocatore;
    });
  }

  _deltaLabel(media) {
    return media >=  3.5 ? 'Supera le aspettative'
         : media >=  1.5 ? 'Sopra le aspettative'
         : media >= -1.5 ? 'Nei limiti delle aspettative'
         : media >= -3.5 ? 'Sotto le aspettative'
         :                 'Al di sotto delle aspettative';
  }

  _deltaSegno(media) {
    return media >=  1.5 ? 'positivo'
         : media <= -1.5 ? 'negativo'
         :                 'neutro';
  }

  ottieniDeltaPrestazionePilota(pilotaId) {
    /* Se ci sono dati gara reali (≥2 gare) usa quelli, altrimenti stima sintetica AR1. */
    const datiGara = this.stato.performancePiloti?.[pilotaId];
    if (datiGara && datiGara.gareContate >= 2) {
      const media = datiGara.deltaCumulativo / datiGara.gareContate;
      return {
        label:  this._deltaLabel(media),
        segno:  this._deltaSegno(media),
        gare:   datiGara.gareContate,
        basato: 'gara'
      };
    }

    /* Fallback sintetico: talento vs qualità media macchina (solo AR1) */
    if (this.stato.categoria !== 'AR1') return null;
    const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId)
      || (this.stato.pilotiAI || []).find(p => p.id === pilotaId);
    if (!pilota || !pilota.squadra || pilota.squadra === 'libero') return null;

    const talent  = pilota.statistiche?.talento || 70;
    const macchina = pilota.squadra === this.stato.squadraId
      ? this.stato.macchina
      : this.stato.macchineAI?.[pilota.squadra];
    if (!macchina) return null;

    const qualitaMacchina = (
      (macchina.aerodinamica || 70) + (macchina.meccanica || 70) +
      (macchina.elettronica  || 70) + (macchina.powerUnit  || 70)
    ) / 4;
    const delta = talent - qualitaMacchina;

    const label = delta >= 10 ? 'Supera le aspettative'
                : delta >=  4 ? 'Sopra le aspettative'
                : delta >= -4 ? 'Nei limiti delle aspettative'
                : delta >= -10 ? 'Sotto le aspettative'
                :               'Al di sotto delle aspettative';

    return { label, segno: delta >= 4 ? 'positivo' : delta <= -4 ? 'negativo' : 'neutro', basato: 'stima' };
  }

  ottieniClassificaRendimenti() {
    /* Restituisce tutti i piloti con dati prestazione accumulati questa stagione,
       ordinati per delta medio (migliore overperformer in cima). */
    const dati = this.stato.performancePiloti || {};
    return Object.values(dati)
      .filter(d => d.gareContate >= 1)
      .map(d => ({
        ...d,
        media:  d.deltaCumulativo / d.gareContate,
        label:  this._deltaLabel(d.deltaCumulativo / d.gareContate),
        segno:  this._deltaSegno(d.deltaCumulativo / d.gareContate)
      }))
      .sort((a, b) => b.media - a.media);
  }

  ottieniEventiMercatoAI() {
    /* Ritorna l'elenco dei movimenti di mercato AI dell'ultima pausa invernale. */
    return this.stato.eventiMercatoAI || [];
  }

  /* ----------------------------------------------------------
     UMORE E INTERAZIONI CON I PILOTI
  ---------------------------------------------------------- */

  modificaUmorePilota(pilotaId, delta, motivo) {
    const pilota = this.stato.piloti.find(p => p.id === pilotaId);
    if (!pilota) return;
    pilota.umore = Math.min(100, Math.max(0, pilota.umore + delta));
    this.salva();
  }

  /* ----------------------------------------------------------
     ECONOMIA (solo AR1)
  ---------------------------------------------------------- */

  registraSpesa(categoria, importo, descrizione) {
    /* categoria: 'sviluppo' | 'staff' | 'operativo' | 'logistica' | 'marketing' */
    if (this.stato.categoria !== 'AR1') return false;
    if (this.stato.budgetSpeso + importo > this.stato.budget) return false; /* Oltre cap/disponibilità */

    this.stato.budgetSpeso += importo;

    if (!Array.isArray(this.stato.spese)) this.stato.spese = [];
    this.stato.spese.push({ categoria, importo, descrizione, stagione: this.stato.stagione });
    /* Tetto per sicurezza: mantieni al massimo le ultime 300 voci (circa 3 stagioni) */
    if (this.stato.spese.length > 300) this.stato.spese = this.stato.spese.slice(-300);

    this.salva();
    return true;
  }

  ottieniStatoBudget() {
    if (this.stato.categoria !== 'AR1') return null;
    const limiteCapReg = this.stato.eraRegolamentare?.budgetCapAR1 || 135000000;
    return {
      budgetDisponibile: this.stato.budget,
      budgetSpeso: this.stato.budgetSpeso,
      budgetResiduo: this.stato.budget - this.stato.budgetSpeso,
      limiteCapRegolamentare: limiteCapReg,
      percentualeCapUsata: Math.round((this.stato.budgetSpeso / limiteCapReg) * 100),
      sopraBudgetCap: this.stato.budgetSpeso > limiteCapReg
    };
  }

  /* ----------------------------------------------------------
     UTILITY
  ---------------------------------------------------------- */

  _formattempoMs(ms) {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const cent = Math.floor((ms % 1000) / 10);
    return `${min}:${String(sec).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
  }

  /* ----------------------------------------------------------
     SVILUPPO TECNICO — METODI AGGIUNTIVI (solo AR1)
  ---------------------------------------------------------- */

  /* Genera 3 opzioni upgrade in modo deterministico per round,
     influenzate dalle statistiche dei Direttori di Dipartimento */
  generaOpzioniUpgrade() {
    if (this.stato.categoria !== 'AR1' || !this.stato.macchina) return [];

    /* Sub-RNG deterministico: stesse opzioni ogni volta che si apre il pannello */
    const subSeed = ((this.stato.seedStagione || 12345) + this.stato.roundCorrente * 1997) | 0;
    const g = new GeneratoreCasuale(subSeed);
    const round = this.stato.roundCorrente;
    const staff = this.stato.staff || {};

    /* Bonus direttore: innovazione alta → impatto maggiore; precisione alta → consegna più rapida */
    const dir = this.stato.direttiveStagione || {};
    const capAdapt = dir.capoIngegnere === 'ci_adattamento' ? 5 : 8;
    const _bonusDirettore = (direttore) => {
      if (!direttore?.statistiche) return { impatto: 0, roundAnticipo: 0 };
      let inn = direttore.statistiche.innovazione || 75;
      /* Adattamento neoingaggio: rendimento ridotto nelle prime settimane */
      if (direttore.adattamento?.roundRestanti > 0) {
        const roundEff = Math.min(direttore.adattamento.roundRestanti, capAdapt);
        const fattore  = 0.70 + 0.30 * ((capAdapt - roundEff) / capAdapt);
        inn = Math.round(inn * fattore);
      }
      const prec = direttore.statistiche.precisione || 75;
      return {
        impatto: inn >= 90 ? 2 : inn >= 85 ? 1 : inn < 70 ? -1 : 0,
        roundAnticipo: prec >= 88 ? 1 : 0
      };
    };

    /* Bonus Capo Ingegnere: coordinamento alto → +1 a tutti i dipartimenti */
    const bonusCI = (staff.capoIngegnere?.statistiche?.coordinamento || 75) >= 88 ? 1 : 0;

    /* Direttive stagionali — bonus Capo Ingegnere e Direttori Design */
    const subGDir = new GeneratoreCasuale((subSeed + 131) | 0); /* RNG separato per varianza */
    let dBonusCI = { aero: 0, mec: 0, ele: 0 };
    if      (dir.capoIngegnere === 'ci_bilanciamento') { dBonusCI = { aero: 1, mec: 1, ele: 1 }; }
    else if (dir.capoIngegnere === 'ci_spec_aero')     { dBonusCI.aero = 3; }

    let dExtraAero = 0, dVarAero = 0;
    if      (dir.direttoreAero === 'aero_aggressivo')   { dExtraAero = 3; dVarAero = subGDir.intervallo(-2, 2); }
    else if (dir.direttoreAero === 'aero_conservativo') { dExtraAero = 2; }
    else if (dir.direttoreAero === 'aero_bilanciato')   { dExtraAero = 1; dBonusCI.mec += 1; }

    let dExtraMec = 0, dVarMec = 0;
    if      (dir.direttoreMeccanica === 'mec_aggressivo')   { dExtraMec = 3; dVarMec = subGDir.intervallo(-2, 2); }
    else if (dir.direttoreMeccanica === 'mec_conservativo') { dExtraMec = 2; }
    else if (dir.direttoreMeccanica === 'mec_bilanciato')   { dExtraMec = 1; dBonusCI.ele += 1; }

    let dExtraEle = 0, dVarEle = 0;
    if      (dir.direttoreElettronica === 'ele_aggressivo')   { dExtraEle = 3; dVarEle = subGDir.intervallo(-2, 2); }
    else if (dir.direttoreElettronica === 'ele_conservativo') { dExtraEle = 2; }
    else if (dir.direttoreElettronica === 'ele_focus_pu')     { dExtraEle = 1; }

    const bAero = _bonusDirettore(staff.direttoreAero);
    const bMec  = _bonusDirettore(staff.direttoreMeccanica);
    const bEle  = _bonusDirettore(staff.direttoreElettronica);

    const baseAero = g.intervallo(2, 5);
    const baseMec  = g.intervallo(1, 4);
    const baseEle  = g.intervallo(1, 3);

    const roundAero = round + Math.max(1, g.intervallo(2, 4) - bAero.roundAnticipo);
    const roundMec  = round + Math.max(1, g.intervallo(1, 3) - bMec.roundAnticipo);
    const roundEle  = round + Math.max(1, g.intervallo(1, 2) - bEle.roundAnticipo);

    return [
      {
        id: 'aero',
        titolo: 'Pacchetto aerodinamico',
        descrizione: 'Fondo piatto rivisto e deflettori laterali aggiornati. Migliore efficienza nelle curve veloci.',
        dipartimento: 'aerodinamica',
        impatto: Math.max(1, baseAero + bAero.impatto + bonusCI + dBonusCI.aero + dExtraAero + dVarAero),
        costo: g.intervallo(8000000, 14000000),
        roundConsegna: roundAero,
        nomeDirettore: staff.direttoreAero?.nome || null,
        innovazioneDirettore: staff.direttoreAero?.statistiche?.innovazione || null
      },
      {
        id: 'meccanica',
        titolo: 'Aggiornamento sospensioni',
        descrizione: 'Nuova geometria sospensione anteriore. Bilanciamento meccanico migliorato in frenata.',
        dipartimento: 'meccanica',
        impatto: Math.max(1, baseMec + bMec.impatto + bonusCI + dBonusCI.mec + dExtraMec + dVarMec),
        costo: g.intervallo(5000000, 10000000),
        roundConsegna: roundMec,
        nomeDirettore: staff.direttoreMeccanica?.nome || null,
        innovazioneDirettore: staff.direttoreMeccanica?.statistiche?.innovazione || null
      },
      {
        id: 'elettronica',
        titolo: 'Software ERS aggiornato',
        descrizione: 'Ottimizzazione algoritmo gestione energia. Maggiore recupero in decelerazione.',
        dipartimento: 'elettronica',
        impatto: Math.max(1, baseEle + bEle.impatto + bonusCI + dBonusCI.ele + dExtraEle + dVarEle),
        costo: g.intervallo(3000000, 7000000),
        roundConsegna: roundEle,
        nomeDirettore: staff.direttoreElettronica?.nome || null,
        innovazioneDirettore: staff.direttoreElettronica?.statistiche?.innovazione || null
      }
    ];
  }

  /* Conferma un upgrade e lo aggiunge al piano di sviluppo */
  confermaNuovoUpgrade(opzione) {
    if (!opzione || !this.stato.macchina) return { errore: 'Dati mancanti' };
    if (!this.stato.pianoUpgrade) this.stato.pianoUpgrade = [];

    /* Verifica che non esista già un upgrade dello stesso dipartimento in corso */
    const giàPresente = this.stato.pianoUpgrade.some(
      u => u.dipartimento === opzione.dipartimento && !u.applicato
    );
    if (giàPresente) return { errore: 'Upgrade in corso per questo dipartimento' };

    /* Verifica budget */
    const budgetResiduo = this.stato.budget - this.stato.budgetSpeso;
    if (budgetResiduo < opzione.costo) return { errore: 'Budget insufficiente' };

    this.stato.budgetSpeso += opzione.costo;
    this.stato.pianoUpgrade.push({ ...opzione, confermato: true, applicato: false });
    this.salva();
    return { successo: true };
  }

  /* Applica upgrade il cui roundConsegna è raggiunto — chiamato all'inizio di ogni briefing */
  _applicaUpgradeInArrivo() {
    if (this.stato.categoria !== 'AR1' || !this.stato.pianoUpgrade) return;
    const round = this.stato.roundCorrente;
    this.stato.pianoUpgrade.forEach(u => {
      if (u.confermato && !u.applicato && u.roundConsegna <= round) {
        this.applicaUpgrade(u.dipartimento, u.impatto);
        u.applicato = true;
      }
    });
  }

  /* Stato power unit della squadra del giocatore */
  ottieniStatoPowerUnit() {
    if (this.stato.categoria !== 'AR1') return null;
    const squadra = DATI.SQUADRE_AR1.find(s => s.id === this.stato.squadraId);
    const era = this.stato.eraRegolamentare;
    /* stato.motoreProprio sovrascrive il dato statico: si attiva quando il programma PU è completato */
    const motoreProprio = this.stato.motoreProprio || squadra?.motoreProprio || false;
    const bonusToken    = this.stato.bonusTokenPU || 0;
    const tokenTotali   = (era?.limiteTokenMotore || 3) + bonusToken;
    const tokenUsati    = this.stato.tokenUsati || 0;
    return {
      motoreProprio,
      fornitore:        motoreProprio ? null : (squadra?.fornitoreMotore || null),
      tokenTotali,
      tokenUsati,
      tokenDisponibili: Math.max(0, tokenTotali - tokenUsati),
      performancePU:    this.stato.macchina?.powerUnit ?? null
    };
  }

  /* Definizione delle 4 fasi del programma motore interno */
  _fasiProgettoPU() {
    return [
      { id: 'ricerca',          nome: 'Ricerca e fattibilità',   costo: 30000000,
        desc: 'Studio di fattibilità tecnica e normativa. Costituzione del team di ingegneria specializzato in propulsione.' },
      { id: 'sviluppo_a',       nome: 'Sviluppo — Prima fase',   costo: 45000000,
        desc: 'Progettazione delle specifiche tecniche. Avvio della costruzione dell\'infrastruttura di produzione.' },
      { id: 'sviluppo_b',       nome: 'Sviluppo — Seconda fase', costo: 45000000,
        desc: 'Completamento dell\'infrastruttura. Produzione dei primi componenti interni.' },
      { id: 'prototipazione',   nome: 'Prototipazione',          costo: 35000000,
        desc: 'Assemblaggio del prototipo. Test su banco prova. Verifica delle specifiche con la Federazione. La power unit sarà operativa dalla stagione successiva.' }
    ];
  }

  /* Stato completo del programma motore interno */
  ottieniStatoProgettoPU() {
    if (this.stato.categoria !== 'AR1') return null;
    const fasi       = this._fasiProgettoPU();
    const progetto   = this.stato.progettoPU || null;
    const pu         = this.ottieniStatoPowerUnit();
    const giaCos      = pu?.motoreProprio || false;
    const inPausa     = this.stato.faseCorrente === 'pausa_invernale';
    /* stato.budget è già ridotto da registraSpesa: è il saldo disponibile */
    const budgetLibero = this.stato.budget || 0;
    const costoAvvio  = fasi[0].costo;
    const costoTotale = fasi.reduce((s, f) => s + f.costo, 0);

    let faseCorrente = null, prossimaFase = null;
    if (progetto) {
      faseCorrente = fasi[progetto.faseIndice] || null;
      prossimaFase = fasi[progetto.faseIndice + 1] || null;  /* null = prossimo passo è il completamento (nessun costo) */
    }

    /* Costo del passo successivo: 0 se il prossimo è il completamento */
    const costoPassoSuccessivo = prossimaFase ? prossimaFase.costo : 0;

    return {
      progetto,        /* null | { faseIndice, stagionInizio, investimentoTotale, stagionePrevistaCompletamento } */
      fasi,
      faseCorrente,
      prossimaFase,
      costoAvvio,
      costoTotale,
      giaCosruttore:   giaCos,
      puoAvviare:      !giaCos && !progetto && inPausa && budgetLibero >= costoAvvio,
      puoContinuare:   !!progetto && inPausa && budgetLibero >= costoPassoSuccessivo,
      puoAbbandonare:  !!progetto && inPausa,
      budgetLibero
    };
  }

  /* Avvia il programma motore interno (pausa invernale, team clienti) */
  avviaProgettoPU() {
    const pp = this.ottieniStatoProgettoPU();
    if (!pp)                return { ok: false, messaggio: 'Disponibile solo in AR1.' };
    if (pp.giaCosruttore)   return { ok: false, messaggio: 'La squadra è già costruttrice di motori propri.' };
    if (pp.progetto)        return { ok: false, messaggio: 'Programma motore già in corso.' };
    if (!pp.puoAvviare)     return { ok: false, messaggio: 'Budget insufficiente o fase di gioco non corretta.' };

    const fasi  = this._fasiProgettoPU();
    const fase0 = fasi[0];
    const ok    = this.registraSpesa('tecnica', fase0.costo, 'Programma motore — ' + fase0.nome);
    if (!ok) return { ok: false, messaggio: 'Budget insufficiente.' };

    this.stato.progettoPU = {
      faseIndice:                    0,
      stagionInizio:                 this.stato.stagione,
      investimentoTotale:            fase0.costo,
      stagionePrevistaCompletamento: this.stato.stagione + fasi.length
    };
    this.salva();
    return { ok: true, fase: fase0.nome, costo: fase0.costo };
  }

  /* Avanza di una fase il programma motore (pausa invernale) */
  continuaProgettoPU() {
    const pp = this.ottieniStatoProgettoPU();
    if (!pp || !pp.progetto) return { ok: false, messaggio: 'Nessun programma in corso.' };
    if (!pp.puoContinuare)   return { ok: false, messaggio: 'Budget insufficiente o fase non corretta.' };

    const fasi      = this._fasiProgettoPU();
    const prog      = this.stato.progettoPU;
    const nuovoIdx  = prog.faseIndice + 1;

    if (nuovoIdx < fasi.length) {
      /* Avanza alla fase successiva */
      const nuovaFase = fasi[nuovoIdx];
      const ok = this.registraSpesa('tecnica', nuovaFase.costo, 'Programma motore — ' + nuovaFase.nome);
      if (!ok) return { ok: false, messaggio: 'Budget insufficiente.' };
      prog.faseIndice        = nuovoIdx;
      prog.investimentoTotale += nuovaFase.costo;
      this.salva();
      return { ok: true, fase: nuovaFase.nome, costo: nuovaFase.costo, completato: false };
    }

    /* Ultima fase già raggiunta: il programma si conclude */
    const ultimaFase = fasi[fasi.length - 1];
    /* Penalità PU: la power unit propria parte -8 rispetto al valore corrente */
    const penalita = 8;
    if (this.stato.macchina) {
      this.stato.macchina.powerUnit = Math.max(40, (this.stato.macchina.powerUnit || 65) - penalita);
    }
    this.stato.motoreProprio  = true;
    this.stato.bonusTokenPU   = 1;    /* +1 token per stagione per i costruttori interni */
    const investTot           = prog.investimentoTotale;
    this.stato.progettoPU     = null;
    this.salva();
    return { ok: true, completato: true, investimentoTotale: investTot, penalitaPU: penalita };
  }

  /* Abbandona il programma motore (pausa invernale, perde l'investimento) */
  abbandonaProgettoPU() {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Disponibile solo in pausa invernale.' };
    if (!this.stato.progettoPU) return { ok: false, messaggio: 'Nessun programma in corso.' };
    const perduto = this.stato.progettoPU.investimentoTotale || 0;
    this.stato.progettoPU = null;
    this.salva();
    return { ok: true, investimentoPerduto: perduto };
  }

  /* Usa un token di sviluppo motore (solo costruttori) */
  usaTokenMotore() {
    if (this.stato.categoria !== 'AR1') return { errore: 'Disponibile solo in AR1.' };
    const pu = this.ottieniStatoPowerUnit();
    if (!pu) return { errore: 'Dati power unit non disponibili' };
    if (!pu.motoreProprio) return { errore: 'Solo i costruttori di motori possono usare token di sviluppo' };
    if (pu.tokenDisponibili <= 0) return { errore: 'Nessun token disponibile per questa stagione' };

    const g = this.generatore;
    const bonusPU = this.stato.direttiveStagione?.direttoreElettronica === 'ele_focus_pu' ? 1 : 0;
    const incremento = g.intervallo(2, 5) + bonusPU;
    this.stato.tokenUsati = (this.stato.tokenUsati || 0) + 1;
    this.applicaUpgrade('powerUnit', incremento);
    return { successo: true, incremento };
  }

  /* Sposta l'allocazione CFD di ±5% */
  aggiornaSplitCFD(deltaCorrente) {
    /* deltaCorrente: +0.05 o -0.05 */
    const correnteNuovo = Math.round(
      Math.max(0.1, Math.min(0.9, (this.stato.allocazioneCFD?.stagioneCorrente || 0.7) + deltaCorrente)) * 100
    ) / 100;
    this.stato.allocazioneCFD = {
      stagioneCorrente: correnteNuovo,
      prossimaStagione: Math.round((1 - correnteNuovo) * 100) / 100
    };
    this.salva();
    return this.stato.allocazioneCFD;
  }

  /* Ore disponibili totali basate sulla posizione in classifica */
  calcolaOreDisponibiliCFD() {
    const era = this.stato.eraRegolamentare;
    if (!era?.limiteOreCFD) return 80;
    const pos = (this.stato.classificaCostruttori.findIndex(c => c.squadraId === this.stato.squadraId) + 1) || 10;
    const chiavi = ['primo','secondo','terzo','quarto','quinto','sesto','settimo','ottavo','nono','decimo'];
    const chiave = (chiavi[Math.min(pos - 1, 9)] || 'decimo') + 'Classificato';
    return era.limiteOreCFD[chiave] || 80;
  }

  /* Riepilogo dati FP raccolti nel weekend corrente */
  ottieniArchivioFP() {
    const dati = this.stato.datiFP || {};
    const sessioni = [];
    ['fp1', 'fp2', 'fp3'].forEach(chiave => {
      if (dati[chiave]) {
        sessioni.push({ sessione: chiave.toUpperCase(), ...dati[chiave] });
      }
    });
    return sessioni;
  }

  /* ----------------------------------------------------------
     PERSONALE — FEDELTÀ E ACADEMY (solo AR1)
  ---------------------------------------------------------- */

  /* Aggiorna la fedeltà di tutti i piloti del giocatore a fine stagione */
  _aggiornaFedeltaFineAnno() {
    if (this.stato.categoria !== 'AR1') return;
    (this.stato.piloti || []).forEach(p => {
      /* +8 per ogni stagione completata insieme */
      p.fedeltà = Math.min(100, (p.fedeltà || 50) + 8);
    });
    /* Pilota di riserva */
    if (this.stato.pilotaRiserva) {
      this.stato.pilotaRiserva.fedeltà = Math.min(100, (this.stato.pilotaRiserva.fedeltà || 50) + 10);
    }
    /* Talenti academy */
    (this.stato.academy || []).forEach(t => {
      t.fedeltà = Math.min(100, (t.fedeltà || 70) + 6);
      /* Avanzamento stagionale sviluppo */
      t.stagioneSviluppo = (t.stagioneSviluppo || 1) + 1;
      t.livelloCorrente = Math.min(t.potenziale, t.livelloCorrente + this.generatore.intervallo(3, 7));
    });
  }

  /* Sconto contrattuale in base alla fedeltà (0–30%) */
  scontoDaFedeltà(fedeltà) {
    if (fedeltà >= 90) return 0.30;
    if (fedeltà >= 75) return 0.20;
    if (fedeltà >= 60) return 0.12;
    if (fedeltà >= 45) return 0.06;
    return 0;
  }

  /* Ottieni pilota di riserva per la squadra corrente */
  ottieniPilotaRiserva() {
    if (this.stato.categoria !== 'AR1') return null;
    /* Se già in stato usa quello, altrimenti cerca nei dati base */
    if (this.stato.pilotaRiserva) return this.stato.pilotaRiserva;
    const riserva = (DATI.PILOTI_RISERVA_AR1 || []).find(r => r.squadra === this.stato.squadraId);
    return riserva || null;
  }

  /* Ottieni talenti academy per la squadra corrente */
  ottieniAcademy() {
    if (this.stato.categoria !== 'AR1') return [];
    if (this.stato.academy && this.stato.academy.length > 0) return this.stato.academy;
    return (DATI.TALENTI_ACADEMY_AR1 || []).filter(t => t.squadra === this.stato.squadraId);
  }

  /* Stato del mercato: aperto solo in pausa_invernale */
  ottieniStatoMercato() {
    const aperto    = this.stato.faseCorrente === 'pausa_invernale';
    const stagione  = this.stato.stagione;
    const pilotiScadenza = (this.stato.piloti || []).filter(p => p.contratto?.scadenza <= stagione);
    const staffAll  = Object.entries(this.stato.staff || {}).map(([chiave, s]) => ({ ...s, chiave }));
    const staffInScadenza   = staffAll.filter(s => (s.contratto?.scadenza || 9999) <= stagione);
    const staffPreScadenza  = staffAll.filter(s => s.contratto?.scadenza === stagione + 1);
    return {
      aperto,
      pilotiInScadenza:  pilotiScadenza,
      staffInScadenza,
      staffPreScadenza,
      categoriaCorrente: this.stato.categoria
    };
  }

  ottieniStatoFactory() {
    if (this.stato.categoria !== 'AR1') return null;
    const factory = this.stato.factory || {};
    const investimenti = this.stato.investimentiFactory || [];
    const meta = {
      galleriaVento:   { nome: 'Galleria del vento',    effetto: 'Precisione stime aerodinamiche' },
      simulatore:      { nome: 'Simulatore di guida',   effetto: 'Efficacia setup qualifica' },
      officina:        { nome: 'Officina e produzione',  effetto: 'Velocità consegna upgrade' },
      centroDati:      { nome: 'Centro dati',            effetto: 'Precisione Data Analyst' },
      strutturaMedica: { nome: 'Struttura medica',       effetto: 'Recupero piloti' }
    };
    const aree = Object.entries(factory).map(([chiave, dati]) => ({
      chiave,
      nome: meta[chiave]?.nome || chiave,
      effetto: meta[chiave]?.effetto || '',
      livello: dati.livello || 1,
      condizione: dati.condizione || 100,
      investimentoInCorso: investimenti.find(i => i.area === chiave && i.completato === false) || null
    }));
    /* Costo e durata upgrade per livello */
    const tabellaUpgrade = {
      1: { costo: 5e6,  rounds: 4 },
      2: { costo: 12e6, rounds: 6 },
      3: { costo: 28e6, rounds: 10 },
      4: { costo: 55e6, rounds: 16 }
    };
    return { aree, investimenti, tabellaUpgrade, roundCorrente: this.stato.roundCorrente };
  }

  avviaInvestimentoFactory(areaChiave, livelloTarget) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Disponibile solo in AR1.' };
    const factory = this.stato.factory || {};
    const area = factory[areaChiave];
    if (!area) return { successo: false, messaggio: 'Area non trovata.' };
    if (livelloTarget !== area.livello + 1) return { successo: false, messaggio: 'Puoi eseguire upgrade di un livello alla volta.' };
    if (livelloTarget > 5) return { successo: false, messaggio: 'Livello massimo raggiunto.' };
    const giaInCorso = (this.stato.investimentiFactory || []).find(i => i.area === areaChiave && !i.completato);
    if (giaInCorso) return { successo: false, messaggio: 'Investimento già in corso per quest\'area.' };

    const tabella = { 1: { costo: 5e6, rounds: 4 }, 2: { costo: 12e6, rounds: 6 }, 3: { costo: 28e6, rounds: 10 }, 4: { costo: 55e6, rounds: 16 } };
    const info = tabella[area.livello];
    if (!info) return { successo: false, messaggio: 'Livello corrente non supporta upgrade.' };
    if (this.stato.budget - this.stato.budgetSpeso < info.costo) return { successo: false, messaggio: 'Budget insufficiente.' };

    this.stato.budgetSpeso += info.costo;
    this.stato.investimentiFactory.push({
      area: areaChiave,
      livelloTarget,
      roundAvvio: this.stato.roundCorrente,
      roundCompletamento: this.stato.roundCorrente + info.rounds,
      costoTotale: info.costo,
      completato: false
    });
    this.salva();
    return { successo: true, messaggio: `Investimento avviato. Completamento previsto: round ${this.stato.roundCorrente + info.rounds}.` };
  }

  _applicaInvestimentiFactory() {
    if (!this.stato.investimentiFactory) return;
    this.stato.investimentiFactory.forEach(inv => {
      if (!inv.completato && this.stato.roundCorrente >= inv.roundCompletamento) {
        const area = this.stato.factory?.[inv.area];
        if (area && area.livello < inv.livelloTarget) {
          area.livello = inv.livelloTarget;
          area.condizione = 100;
        }
        inv.completato = true;
      }
    });
  }

  /* ----------------------------------------------------------
     STAFF RIDOTTO AR2/AR3
  ---------------------------------------------------------- */

  ottieniStatoStaffRidotto() {
    const staff = this.stato.staff;
    if (!staff) return null;
    return {
      capoIngegnere:       staff.capoIngegnere || null,
      ingegnereGara:       staff.ingegnereGara || null,
      preparatoreAtletico: staff.preparatoreAtletico || null
    };
  }

  /* ----------------------------------------------------------
     SVILUPPO TECNICO AR2 — sistema semplificato
     2 aree (aero, meccanica), max livello 3, guadagni ridotti
  ---------------------------------------------------------- */

  ottieniSviluppoAR2() {
    if (this.stato.categoria !== 'AR2') return null;
    const sviluppo = this.stato.sviluppoAR2 || { aero: 0, meccanica: 0 };
    const pianoAR2  = this.stato.pianoUpgradeAR2 || [];
    const budget   = (this.stato.budget || 0) - (this.stato.budgetSpeso || 0);

    /* Tabella costi e durate per livello (index = livello corrente) */
    const tabella = [
      { costo: 2000000, rounds: 2, guadagno: '+2%' },  /* L0→L1 */
      { costo: 3500000, rounds: 3, guadagno: '+2%' },  /* L1→L2 */
      { costo: 5000000, rounds: 4, guadagno: '+1%' }   /* L2→L3 */
    ];

    const _areaInfo = (chiave, nomeArea) => {
      const livello = sviluppo[chiave] || 0;
      const inCorso = pianoAR2.find(u => u.area === chiave && !u.completato);
      const opzioni = [];

      if (!inCorso && livello < 3) {
        const info = tabella[livello];
        /* Opzione conservativa */
        opzioni.push({
          id: chiave + '_cons',
          area: chiave,
          nome: nomeArea + ' — Approccio consolidato',
          descrizione: 'Sviluppo prudente. Guadagno garantito ma contenuto.',
          guadagnoStimato: info.guadagno,
          rounds: info.rounds + 1,
          costo: info.costo * 0.85,
          rischio: 'basso'
        });
        /* Opzione aggressiva */
        opzioni.push({
          id: chiave + '_agg',
          area: chiave,
          nome: nomeArea + ' — Sviluppo accelerato',
          descrizione: 'Tempi ridotti. Margine di guadagno leggermente inferiore.',
          guadagnoStimato: info.guadagno,
          rounds: info.rounds,
          costo: info.costo,
          rischio: 'medio'
        });
      }

      return {
        chiave,
        nome: nomeArea,
        livello,
        livelloMax: 3,
        inCorso: inCorso || null,
        opzioni
      };
    };

    return {
      aree: [
        _areaInfo('aero',      'Aerodinamica'),
        _areaInfo('meccanica', 'Meccanica')
      ],
      budget,
      roundCorrente: this.stato.roundCorrente
    };
  }

  confermaNuovoUpgradeAR2(opzione) {
    if (this.stato.categoria !== 'AR2') return { successo: false, messaggio: 'Non disponibile.' };
    const sviluppo = this.stato.sviluppoAR2 || { aero: 0, meccanica: 0 };
    const livello  = sviluppo[opzione.area] || 0;
    if (livello >= 3) return { successo: false, messaggio: 'Livello massimo raggiunto per questa area.' };

    const giaInCorso = (this.stato.pianoUpgradeAR2 || []).find(u => u.area === opzione.area && !u.completato);
    if (giaInCorso) return { successo: false, messaggio: 'Upgrade già in corso per quest\'area.' };

    const budget = (this.stato.budget || 0) - (this.stato.budgetSpeso || 0);
    if (budget < opzione.costo) return { successo: false, messaggio: 'Budget insufficiente.' };

    this.stato.budgetSpeso = (this.stato.budgetSpeso || 0) + opzione.costo;
    this.stato.pianoUpgradeAR2 = this.stato.pianoUpgradeAR2 || [];
    this.stato.pianoUpgradeAR2.push({
      area: opzione.area,
      livelloTarget: livello + 1,
      roundAvvio: this.stato.roundCorrente,
      roundConsegna: this.stato.roundCorrente + opzione.rounds,
      costo: opzione.costo,
      nome: opzione.nome,
      completato: false
    });
    this.salva();
    return { successo: true, messaggio: `Upgrade confermato. Disponibile al round ${this.stato.roundCorrente + opzione.rounds}.` };
  }

  _applicaUpgradeAR2() {
    if (!this.stato.pianoUpgradeAR2) return;
    this.stato.pianoUpgradeAR2.forEach(upg => {
      if (!upg.completato && this.stato.roundCorrente >= upg.roundConsegna) {
        const area = this.stato.sviluppoAR2?.[upg.area];
        if (area !== undefined && area < upg.livelloTarget) {
          this.stato.sviluppoAR2[upg.area] = upg.livelloTarget;
        }
        upg.completato = true;
      }
    });
  }

  /* ----------------------------------------------------------
     OFFERTE AR1 — generate in AR2 dalla metà stagione in poi
  ---------------------------------------------------------- */

  _valutaOfferteAR1() {
    if (this.stato.categoria !== 'AR2') return;
    /* Evita di generare offerte multiple nello stesso round */
    const offertaEsistente = (this.stato.offerteAR1 || []).find(o => !o.rifiutata);
    if (offertaEsistente) return;

    const classifica = this.stato.classificaCostruttori || [];
    const posizioneGiocatore = classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1;
    const totale = classifica.length || 8;
    const delta  = this.stato.deltaOttimizzazione || 0;

    /* Soglia per ricevere offerta: top 6 assoluto OPPURE top metà con buon delta */
    const condizioneClassifica = posizioneGiocatore <= Math.ceil(totale * 0.75);
    const condizioneOttimizzazione = delta >= 3 && posizioneGiocatore <= totale;
    if (!condizioneClassifica && !condizioneOttimizzazione) return;

    /* Probabilità di offerta basata sulla posizione e delta */
    const probabilitaBase = 0.15 + (totale - posizioneGiocatore) / totale * 0.4 + delta * 0.05;
    if (!this.generatore.probabilita(Math.min(0.85, probabilitaBase))) return;

    /* Sceglie una squadra AR1 offerente (quelle più in basso in classifica AR1 sono più disponibili) */
    const squadreAR1Disponibili = [...DATI.SQUADRE_AR1].reverse(); /* Partendo dalle meno competitive */
    const indiceSorteggio = Math.floor(this.generatore.prossimo() * Math.min(5, squadreAR1Disponibili.length));
    const squadraOfferente  = squadreAR1Disponibili[indiceSorteggio];

    const scadenzaRound = this.stato.roundCorrente + 3;
    this.stato.offerteAR1 = this.stato.offerteAR1 || [];
    this.stato.offerteAR1.push({
      squadraId: squadraOfferente.id,
      squadraNome: squadraOfferente.nome,
      ruolo: 'Team Principal',
      scadenzaRound,
      rifiutata: false
    });
  }

  ottieniOfferteAR1() {
    if (this.stato.categoria !== 'AR2') return [];
    return (this.stato.offerteAR1 || []).filter(o => !o.rifiutata && o.scadenzaRound >= this.stato.roundCorrente);
  }

  rifiutaOffertaAR1(squadraId) {
    if (!this.stato.offerteAR1) return;
    const offerta = this.stato.offerteAR1.find(o => o.squadraId === squadraId && !o.rifiutata);
    if (offerta) {
      offerta.rifiutata = true;
      /* Rifiutare un'offerta riduce leggermente il delta per la stagione */
      this.stato.deltaOttimizzazione = Math.max(0, (this.stato.deltaOttimizzazione || 0) - 1);
    }
    this.salva();
  }

  aggiornaDeltaOttimizzazione() {
    /*
     * Chiamato dopo ogni gara principale in AR2 o AR3.
     * Calcola il delta confrontando il risultato effettivo della squadra
     * con il risultato atteso in base alla posizione in classifica costruttori,
     * pesato dalla qualità delle decisioni in FP (bonusFPCorrente).
     *
     * Delta = +1 se la squadra ha sovraperformato con buone FP
     *          0 se il risultato è in linea con le aspettative
     *         -1 se la squadra ha sottoperformato con FP scadenti
     *
     * Accumulo stagionale: range 0–10. Influenza le promozioni di categoria
     * e (solo AR2) la probabilità di ricevere offerte da squadre AR1.
     */
    const cat = this.stato.categoria;
    if (cat !== 'AR2' && cat !== 'AR3') return;

    const ultimaGara = this.stato.ultimaGara;
    if (!ultimaGara?.risultati) return;

    const risultatiGiocatore = ultimaGara.risultati.filter(r => r.isGiocatore);
    if (risultatiGiocatore.length === 0) return;

    /* Posizione costruttori del giocatore (1-based) */
    const classifica = this.stato.classificaCostruttori || [];
    const rankTeam = (classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1) ||
                      Math.ceil(classifica.length / 2);
    const totSquadre = classifica.length || (cat === 'AR2' ? 8 : 6);
    const totPiloti  = totSquadre * 2;

    /*
     * Posizione media attesa per i piloti del giocatore:
     * team al 1° posto → attesa ~1.5 | team all'ultimo → attesa ~totPiloti - 0.5
     */
    const attesaMedia = 1 + ((rankTeam - 1) / Math.max(1, totSquadre - 1)) * (totPiloti - 1);

    /* Posizione media reale (ignora ritirati: posizione > totPiloti) */
    const validePos = risultatiGiocatore.filter(r => r.posizione <= totPiloti);
    if (validePos.length === 0) { this.salva(); return; }
    const realeMedia = validePos.reduce((s, r) => s + r.posizione, 0) / validePos.length;

    /* Differenziale: positivo = meglio del previsto */
    const diffPos = attesaMedia - realeMedia;

    /* Qualità FP: bonusFPCorrente ∈ [-2, +2] → soglia: > 0 = buone FP */
    const bonusFP = this.stato.bonusFPCorrente || 0;

    let delta = 0;
    if (diffPos >= 3 || (diffPos >= 2 && bonusFP >= 0)) {
      delta = 1;
    } else if (diffPos <= -3 || (diffPos <= -2 && bonusFP <= 0)) {
      delta = -1;
    }

    this.stato.deltaOttimizzazione = Math.max(0, Math.min(10,
      (this.stato.deltaOttimizzazione || 0) + delta));
    this.salva();
  }

  ottieniNomeSquadra() {
    const tutte = [...DATI.SQUADRE_AR1, ...DATI.SQUADRE_AR2, ...DATI.SQUADRE_AR3];
    return tutte.find(s => s.id === this.stato.squadraId)?.nome || 'Squadra sconosciuta';
  }

  ottieniCategoriaNome() {
    return this.stato.categoria || '—';
  }

  /* ----------------------------------------------------------
     MERCATO PILOTI AR2/AR3
  ---------------------------------------------------------- */

  _generaPoolPilotiLiberi() {
    /*
     * Genera un pool di piloti liberi disponibili sul mercato AR2/AR3.
     * Statistiche leggermente inferiori alla media della categoria:
     * sono piloti che non hanno trovato un posto nelle squadre titolari.
     * Il pool viene rigenerato ogni pausa invernale (seed basato sulla stagione).
     */
    const cat    = this.stato.categoria;
    const g      = new GeneratoreCasuale(((this.stato.seedStagione || 0) + this.stato.stagione * 31) | 0);
    const isAR2   = cat === 'AR2';
    const nPool  = isAR2 ? 5 : 4;
    const media  = isAR2 ? 70 : 63;  /* media statistica categoria */

    /* Nomi generici plausibili per piloti senza squadra */
    const NOMI_LIBERI = isAR2
      ? ['Marc Dubois', 'James Hartley', 'Piero Mancini', 'Anders Olsen', 'Carlos Ruiz',
         'Marco Benedetti', 'Ivan Petrov', 'Seo Ji-hoon']
      : ['Simon Bauer', 'Alex Novak', 'Leo Fontaine', 'Kai Eriksson',
         'Filippo Serra', 'Yusuf Diallo', 'Thiago Lima'];

    const BANDIERE = ['🇫🇷','🇬🇧','🇮🇹','🇩🇰','🇪🇸','🇮🇹','🇷🇺','🇰🇷',
                      '🇩🇪','🇨🇿','🇫🇷','🇫🇮','🇮🇹','🇸🇳','🇧🇷'];

    /* Piloti attualmente nella squadra del giocatore (da escludere dai nomi) */
    const nomiGiocatore = new Set((this.stato.piloti || []).map(p => p.nome));

    const pool = [];
    const nomiDisponibili = NOMI_LIBERI.filter(n => !nomiGiocatore.has(n));

    for (let i = 0; i < Math.min(nPool, nomiDisponibili.length); i++) {
      const nome      = nomiDisponibili[i];
      const isGiovane = g.probabilita(0.5);
      const eta       = isGiovane ? g.intervallo(17, 20) : g.intervallo(22, 26);
      const talento   = g.intervallo(media - 8, media - 1);

      pool.push({
        id: `libero_${cat.toLowerCase()}_${this.stato.stagione}_${i}`,
        nome,
        eta,
        bandiera: BANDIERE[i] || '',
        squadra: null,
        statistiche: {
          talento,
          costanza:  g.intervallo(media - 10, media - 2),
          qualifica: g.intervallo(media - 8,  media - 1),
          gara:      g.intervallo(media - 8,  media - 1)
        },
        traiettoria: isGiovane ? 'crescita' : 'stabile',
        fedeltà: 30,
        libero: true
      });
    }

    this.stato.pilotiLiberiAR2AR3 = pool;
    return pool;
  }

  ottieniMercatoPilotiAR2AR3() {
    const cat = this.stato.categoria;
    if (cat !== 'AR2' && cat !== 'AR3') return { aperto: false, pilotiGiocatore: [], pool: [] };

    const aperto = this.stato.faseCorrente === 'pausa_invernale';
    if (!aperto) return { aperto: false, pilotiGiocatore: this.stato.piloti || [], pool: [] };

    /* Genera pool se non esiste o è vuoto */
    if (!this.stato.pilotiLiberiAR2AR3 || this.stato.pilotiLiberiAR2AR3.length === 0) {
      this._generaPoolPilotiLiberi();
    }

    return {
      aperto: true,
      pilotiGiocatore: this.stato.piloti || [],
      pool: this.stato.pilotiLiberiAR2AR3 || [],
      deltaOttimizzazione: this.stato.deltaOttimizzazione || 0
    };
  }

  ingaggiaPilotaAR2AR3(pilotaId, posizioneSostituita) {
    const cat = this.stato.categoria;
    if (cat !== 'AR2' && cat !== 'AR3') return { successo: false, messaggio: 'Non disponibile.' };
    if (this.stato.faseCorrente !== 'pausa_invernale') return { successo: false, messaggio: 'Il mercato è chiuso.' };

    const pool = this.stato.pilotiLiberiAR2AR3 || [];
    const nuovoPilota = pool.find(p => p.id === pilotaId);
    if (!nuovoPilota) return { successo: false, messaggio: 'Pilota non trovato nel mercato.' };

    const piloti = this.stato.piloti || [];
    if (posizioneSostituita < 0 || posizioneSostituita >= piloti.length) {
      return { successo: false, messaggio: 'Posizione pilota non valida.' };
    }

    const pilotaRilasciato = piloti[posizioneSostituita];

    /* Sostituisci nel roster del giocatore */
    const nuovoPilotaCopiato = { ...nuovoPilota, squadra: this.stato.squadraId, libero: false };
    this.stato.piloti = piloti.map((p, idx) => idx === posizioneSostituita ? nuovoPilotaCopiato : p);

    /* Aggiorna pool: rimuovi il nuovo, aggiungi il rilasciato */
    this.stato.pilotiLiberiAR2AR3 = pool.filter(p => p.id !== pilotaId);
    if (pilotaRilasciato) {
      this.stato.pilotiLiberiAR2AR3.push({
        ...pilotaRilasciato,
        squadra: null,
        libero: true,
        fedeltà: 30
      });
    }

    this.salva();
    return {
      successo: true,
      messaggio: `${nuovoPilota.nome} ingaggiato. ${pilotaRilasciato?.nome || 'Pilota'} rilasciato.`,
      nuovoPilota: nuovoPilotaCopiato,
      pilotaRilasciato
    };
  }

  /* ----------------------------------------------------------
     SISTEMA SPONSOR (solo AR1)
  ---------------------------------------------------------- */

  _generaSponsorIniziali() {
    if (this.stato.categoria !== 'AR1') return;
    if (this.stato.sponsor && this.stato.sponsor.length > 0) return;

    const g = this.generatore;
    const repMediatica = this.stato.reputazione?.mediatica || 600;
    const repFactor = repMediatica / 10000;
    const stagione = this.stato.stagione;

    const NOMI_PRINCIPALI = [
      'NetDrive Global', 'AeroCom Industries', 'FutureTech Group',
      'Nexar Energy', 'StratoSys International', 'VeloX Corporation'
    ];
    const NOMI_PARTNER = [
      'DataStream Analytics', 'NovaSoft Technologies', 'ClearSky Computing',
      'SynthLab Solutions', 'GridEdge Systems', 'ProSim Technologies'
    ];
    const NOMI_MINORI = [
      'Quattro Automotive', 'RaceGear Pro', 'LapTrack Media',
      'SpeedLine Apparel', 'Carbon3D', 'TrackStar Accessories',
      'MobiDrive Solutions', 'HydraFuel Labs'
    ];

    const sponsor = [];

    /* Sponsor principale */
    const importoPrincipale = Math.round((15e6 + repFactor * 20e6) / 1e6) * 1e6;
    sponsor.push({
      id: 'sp_principale_1',
      nome: g.dallaLista(NOMI_PRINCIPALI),
      categoria: 'principale',
      importoAnnuale: importoPrincipale,
      stagioneInizio: stagione,
      scadenza: stagione + g.intervallo(1, 3),
      obiettivoClassifica: g.intervallo(7, 10),
      soddisfazione: 60,
      beneficioTecnico: null,
      attivo: true
    });

    /* Partner tecnico */
    const importoPartner = Math.round((6e6 + repFactor * 8e6) / 1e6) * 1e6;
    sponsor.push({
      id: 'sp_partner_1',
      nome: g.dallaLista(NOMI_PARTNER),
      categoria: 'partner_tecnico',
      importoAnnuale: importoPartner,
      stagioneInizio: stagione,
      scadenza: stagione + g.intervallo(1, 2),
      obiettivoClassifica: g.intervallo(6, 9),
      soddisfazione: 65,
      beneficioTecnico: { tipo: 'data_analyst_bonus', ...BENEFICI_TECNICI.data_analyst_bonus },
      attivo: true
    });

    /* Sponsor minori (2) */
    const pool = [...NOMI_MINORI];
    for (let i = 0; i < 2; i++) {
      const idx = g.intervallo(0, pool.length - 1);
      const nome = pool.splice(idx, 1)[0];
      sponsor.push({
        id: 'sp_minore_' + (i + 1),
        nome,
        categoria: 'minore',
        importoAnnuale: Math.round(g.intervallo(1500000, 3500000) / 500000) * 500000,
        stagioneInizio: stagione,
        scadenza: stagione + g.intervallo(1, 2),
        obiettivoClassifica: g.intervallo(5, 10),
        soddisfazione: 70,
        beneficioTecnico: null,
        attivo: true
      });
    }

    this.stato.sponsor = sponsor;
  }

  _aggiornaSoddisfazioneSponsor() {
    if (this.stato.categoria !== 'AR1') return;
    const sponsor = this.stato.sponsor || [];
    if (sponsor.length === 0) return;
    const classifica = this.stato.classificaCostruttori || [];
    const pos = (classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1) || 10;
    sponsor.forEach(s => {
      const delta = pos <= s.obiettivoClassifica ? 3 : -4;
      s.soddisfazione = Math.min(100, Math.max(0, (s.soddisfazione || 50) + delta));
    });
  }

  ottieniSponsor() {
    if (this.stato.categoria !== 'AR1') return [];
    return this.stato.sponsor || [];
  }

  ottieniPrizeMoney() {
    if (this.stato.categoria !== 'AR1') return null;
    const classifica = this.stato.classificaCostruttori || [];
    const pos = (classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1) || 10;
    const tabella = {
      1: 180e6, 2: 160e6, 3: 140e6, 4: 120e6, 5: 100e6,
      6: 80e6,  7: 65e6,  8: 52e6,  9: 42e6,  10: 34e6
    };
    const erogazione = tabella[Math.min(pos, 10)] || 34e6;
    const bonusStorici = DATI.BONUS_STORICI || {};
    const bonusStorico = bonusStorici[this.stato.squadraId] || 0;
    return {
      posizioneClassifica: pos,
      erogazioneBase: erogazione,
      bonusStorico,
      totale: erogazione + bonusStorico,
      tabella
    };
  }

  ottieniBilancio() {
    if (this.stato.categoria !== 'AR1') return null;
    const sponsor = this.stato.sponsor || [];
    const entrateSponsor = sponsor.filter(s => s.attivo).reduce((sum, s) => sum + (s.importoAnnuale || 0), 0);
    const pm = this.ottieniPrizeMoney();
    const erogazioneBase = pm ? pm.erogazioneBase : 0;
    const bonusStorico = pm ? pm.bonusStorico : 0;
    const totaleEntrate = erogazioneBase + bonusStorico + entrateSponsor;
    return {
      entrate: {
        prizeMoney: erogazioneBase,
        bonusStorico,
        sponsor: entrateSponsor,
        totale: totaleEntrate
      },
      uscite: {
        totale: this.stato.budgetSpeso || 0
      },
      budgetDisponibile: this.stato.budget,
      budgetResiduo: this.stato.budget - (this.stato.budgetSpeso || 0)
    };
  }

  /* Categorie di spesa stimate (proporzionali a budgetSpeso, modulate dall'approccio) */
  ottieniCategorieSpesa() {
    if (this.stato.categoria !== 'AR1') return null;
    const spesaTotale = this.stato.budgetSpeso || 0;
    const limiteCapReg = this.stato.eraRegolamentare?.budgetCapAR1 || 135e6;
    const approccio = this.stato.allocazioneBudget?.approccio || 'bilanciato';

    const QUOTE = {
      aggressivo: { staff: 0.33, sviluppo: 0.40, operazioni: 0.12, infrastrutture: 0.10, powerunit: 0.05 },
      bilanciato:  { staff: 0.40, sviluppo: 0.28, operazioni: 0.16, infrastrutture: 0.10, powerunit: 0.06 },
      prudente:    { staff: 0.45, sviluppo: 0.18, operazioni: 0.20, infrastrutture: 0.12, powerunit: 0.05 }
    };
    const quote = QUOTE[approccio] || QUOTE.bilanciato;

    const distribuzioni = [
      { chiave: 'staff',          nome: 'Staff e personale',          quota: quote.staff },
      { chiave: 'sviluppo',       nome: 'Sviluppo e upgrade vettura', quota: quote.sviluppo },
      { chiave: 'operazioni',     nome: 'Operazioni e logistica',     quota: quote.operazioni },
      { chiave: 'infrastrutture', nome: 'Infrastrutture e impianti',  quota: quote.infrastrutture },
      { chiave: 'powerunit',      nome: 'Power unit e componenti',    quota: quote.powerunit }
    ];

    return {
      approccio,
      categorie: distribuzioni.map(d => ({
        ...d,
        importo: Math.round(spesaTotale * d.quota),
        percentualeCapUsata: Math.round((spesaTotale * d.quota / limiteCapReg) * 100)
      })),
      totale: spesaTotale,
      limiteCap: limiteCapReg,
      percentualeCapTotale: Math.round((spesaTotale / limiteCapReg) * 100)
    };
  }

  /* ----------------------------------------------------------
     MANAGEMENT — ALLOCAZIONE BUDGET
  ---------------------------------------------------------- */

  cambiaApproccioBudget(approccio) {
    if (!['aggressivo', 'bilanciato', 'prudente'].includes(approccio)) {
      return { successo: false, messaggio: 'Approccio non valido.' };
    }
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Disponibile solo in AR1.' };
    this.stato.allocazioneBudget = { approccio };
    this.salva();
    const nomi = { aggressivo: 'Aggressivo', bilanciato: 'Bilanciato', prudente: 'Prudente' };
    return { successo: true, messaggio: `Approccio budget impostato: ${nomi[approccio]}.` };
  }

  ottieniApproccioBudget() {
    return this.stato.allocazioneBudget?.approccio || 'bilanciato';
  }

  ottieniProiezioneFineAnno() {
    if (this.stato.categoria !== 'AR1') return null;
    const calendario = this._ottieniCalendario();
    const totaleRound  = calendario.length || 24;
    const roundFatti   = this.stato.roundCorrente || 0;
    const roundRimasti = Math.max(0, totaleRound - roundFatti);
    const budgetSpeso  = this.stato.budgetSpeso || 0;

    const spesaPerRound = roundFatti > 0 ? budgetSpeso / roundFatti : budgetSpeso / totaleRound;

    /* Impegni già presi: upgrade in arrivo + investimenti factory */
    const costoUpgrade = (this.stato.pianoUpgrade || [])
      .filter(u => !u.completato)
      .reduce((sum, u) => sum + (u.costo || 0), 0);
    const costoFactory = (this.stato.investimentiFactory || [])
      .filter(inv => !inv.completato)
      .reduce((sum, inv) => sum + (inv.costoTotale || 0), 0);
    const impegniPresi = costoUpgrade + costoFactory;

    const spesaOperativaProiettata = spesaPerRound * roundRimasti;
    const spesaTotaleProiettata = budgetSpeso + spesaOperativaProiettata + impegniPresi;
    const limiteCapReg = this.stato.eraRegolamentare?.budgetCapAR1 || 135e6;
    const margine = limiteCapReg - spesaTotaleProiettata;

    return {
      roundFatti,
      roundRimasti,
      spesaAttuale:            budgetSpeso,
      spesaOperativaProiettata,
      impegniPresi,
      spesaTotaleProiettata,
      limiteCap:               limiteCapReg,
      margineProiettato:       margine,
      inRischio:               margine < 0,
      inAllerta:               margine >= 0 && margine < limiteCapReg * 0.05
    };
  }

  /* ----------------------------------------------------------
     MANAGEMENT — SPONSOR: RINNOVO E NUOVI CONTRATTI
  ---------------------------------------------------------- */

  ottieniOpzioniRinnovoSponsor(sponsorId) {
    if (this.stato.categoria !== 'AR1') return null;
    const sponsor = (this.stato.sponsor || []).find(s => s.id === sponsorId);
    if (!sponsor) return null;

    const imp  = sponsor.importoAnnuale;
    const obj  = sponsor.obiettivoClassifica;
    const cat  = sponsor.categoria;

    /* Beneficio tecnico associato alla categoria sponsor */
    const BENEFICIO_PER_CATEGORIA = {
      principale:     BENEFICI_TECNICI.visibilita_mediatica,
      partner_tecnico: BENEFICI_TECNICI.cfd_bonus,
      minore:          BENEFICI_TECNICI.reputazione_tecnica
    };
    const BENEFICIO_ISTITUZ = {
      principale:     BENEFICI_TECNICI.visibilita_mediatica,
      partner_tecnico: BENEFICI_TECNICI.supporto_infrastrutturale,
      minore:          BENEFICI_TECNICI.reputazione_tecnica
    };
    const benTecnico   = BENEFICIO_PER_CATEGORIA[cat] || BENEFICI_TECNICI.reputazione_tecnica;
    const benIstituz   = BENEFICIO_ISTITUZ[cat]       || BENEFICI_TECNICI.reputazione_tecnica;

    return {
      sponsorNome: sponsor.nome,
      sponsor,
      pacchetti: [
        /* Accordo finanziario — massimizza il contributo economico */
        {
          id: 'finanziario',
          nome: 'Accordo finanziario',
          descrizione: 'Focus sul contributo economico. Importo aumentato del 20%, durata biennale, obiettivo di classifica leggermente più esigente. Nessun beneficio tecnico aggiuntivo.',
          importoAnnuale: Math.round(imp * 1.20 / 1e6) * 1e6,
          durata: 2,
          obiettivoClassifica: Math.max(1, obj - 1),
          beneficioTecnico: null,
          vantaggi: ['+20% contributo annuale', 'Stabiltà biennale'],
          svantaggi: ['Obiettivo classifica più stringente', 'Nessun supporto tecnico o infrastrutturale']
        },
        /* Partnership tecnica — contributo ridotto ma beneficio operativo concreto */
        {
          id: 'tecnico',
          nome: 'Partnership tecnica',
          descrizione: `Importo ridotto del 10%, durata biennale. In cambio il partner fornisce: ${benTecnico.descrizione}`,
          importoAnnuale: Math.round(imp * 0.90 / 1e6) * 1e6,
          durata: 2,
          obiettivoClassifica: obj,
          beneficioTecnico: { tipo: Object.keys(BENEFICI_TECNICI).find(k => BENEFICI_TECNICI[k] === benTecnico), ...benTecnico },
          vantaggi: [benTecnico.etichetta, 'Obiettivo invariato'],
          svantaggi: ['-10% contributo annuale']
        },
        /* Accordo istituzionale — lungo termine, beneficio reputazionale */
        {
          id: 'istituzionale',
          nome: 'Accordo istituzionale',
          descrizione: `Importo invariato, durata triennale, obiettivo allentato. Beneficio reputazionale a lungo termine: ${benIstituz.descrizione}`,
          importoAnnuale: imp,
          durata: 3,
          obiettivoClassifica: Math.min(10, obj + 2),
          beneficioTecnico: { tipo: Object.keys(BENEFICI_TECNICI).find(k => BENEFICI_TECNICI[k] === benIstituz), ...benIstituz },
          vantaggi: ['Contratto triennale', benIstituz.etichetta, 'Obiettivo allentato'],
          svantaggi: ['Impegno a lungo termine']
        }
      ]
    };
  }

  confermaRinnovoSponsor(sponsorId, pacchettoId) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const idxSponsor = (this.stato.sponsor || []).findIndex(s => s.id === sponsorId);
    if (idxSponsor < 0) return { successo: false, messaggio: 'Sponsor non trovato.' };

    const opzioni = this.ottieniOpzioniRinnovoSponsor(sponsorId);
    const pacchetto = opzioni?.pacchetti.find(p => p.id === pacchettoId);
    if (!pacchetto) return { successo: false, messaggio: 'Pacchetto non valido.' };

    const sponsor = this.stato.sponsor[idxSponsor];
    const deltaImporto = pacchetto.importoAnnuale - sponsor.importoAnnuale;

    /* Aggiorna contratto */
    sponsor.importoAnnuale      = pacchetto.importoAnnuale;
    sponsor.scadenza            = this.stato.stagione + pacchetto.durata;
    sponsor.obiettivoClassifica = pacchetto.obiettivoClassifica;
    sponsor.beneficioTecnico    = pacchetto.beneficioTecnico || null;
    sponsor.soddisfazione       = Math.min(100, (sponsor.soddisfazione || 50) + 10);

    /* Aggiusta budget se l'importo cambia */
    if (deltaImporto !== 0) {
      this.stato.budget = Math.max(0, this.stato.budget + deltaImporto);
    }

    this.salva();
    return { successo: true, messaggio: `Rinnovo con ${sponsor.nome} confermato — ${pacchetto.nome}.`, sponsor };
  }

  ottieniOpportunitaSponsor() {
    if (this.stato.categoria !== 'AR1') return { disponibile: false, giaRicercato: false, candidati: [] };
    if (this.stato.ricercaSponsorStagione) {
      return { disponibile: true, giaRicercato: true, candidati: this.stato._candidatiSponsor || [] };
    }

    const g = this.generatore;
    const rep = this.stato.reputazione?.mediatica || 600;
    const repFactor = rep / 10000;
    const nCandidati = rep >= 7000 ? 3 : 2;

    const NOMI_NUOVI = [
      'Apex Dynamics', 'Fusion Global', 'Stellarex Inc.',
      'TurboLink Corp.', 'CloudRace Technologies', 'BioSpeed Labs',
      'NorthStar Capital', 'OmegaDrive Systems'
    ];
    const nomiFrutti = new Set((this.stato.sponsor || []).map(s => s.nome));
    const nomiDisponibili = NOMI_NUOVI.filter(n => !nomiFrutti.has(n));

    const candidati = [];
    for (let i = 0; i < Math.min(nCandidati, nomiDisponibili.length); i++) {
      const catPremium = i === 0 && rep >= 6000;
      const cat = catPremium ? 'partner_tecnico' : 'minore';
      const importoBase = catPremium
        ? Math.round((5e6 + repFactor * 6e6) / 1e6) * 1e6
        : Math.round(g.intervallo(1500000, 3000000) / 5e5) * 5e5;

      /* Assegna beneficio tecnico al candidato in base alla categoria */
      const BENEFICIO_CANDIDATO = {
        partner_tecnico: { tipo: 'data_analyst_bonus', ...BENEFICI_TECNICI.data_analyst_bonus },
        minore:          g.prossimo() > 0.5
          ? { tipo: 'reputazione_tecnica', ...BENEFICI_TECNICI.reputazione_tecnica }
          : null
      };

      candidati.push({
        id: `candidato_${this.stato.stagione}_${i}`,
        nome: nomiDisponibili[i],
        categoria: cat,
        importoAnnuale: importoBase,
        obiettivoClassifica: g.intervallo(6, 10),
        durata: g.intervallo(1, 2),
        scadenza: this.stato.stagione + g.intervallo(1, 2),
        soddisfazione: 60,
        beneficioTecnico: BENEFICIO_CANDIDATO[cat] ?? null,
        attivo: true
      });
    }

    this.stato.ricercaSponsorStagione = true;
    this.stato._candidatiSponsor = candidati;
    this.salva();
    return { disponibile: true, giaRicercato: false, candidati };
  }

  /* ----------------------------------------------------------
     RELAZIONI — PILOTI: COLLOQUI
  ---------------------------------------------------------- */

  avviaColloquioPilota(pilotaId, tipo) {
    /* tipo: 'rassicurante' | 'motivazionale' | 'critico' */
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const round = this.stato.roundCorrente;
    const giàFatto = this.stato.colloquiPilotiRound[pilotaId];
    if (giàFatto === round) return { successo: false, messaggio: 'Colloquio già effettuato in questo round.' };

    const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId);
    if (!pilota) return { successo: false, messaggio: 'Pilota non trovato.' };

    const g = this.generatore;
    const classifica = this.stato.classificaCostruttori || [];
    const pos = (classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1) || 8;
    const stagionePositivia = pos <= 5;

    let deltaUmore = 0, deltaFedeltà = 0, deltaPerformanza = 0;
    let messaggio = '';

    const umoreAttuale = pilota.umore || 500;
    const fedeltàAttuale = pilota.fedeltà || 50;

    switch (tipo) {
      case 'rassicurante':
        /* Stabilizza e migliora l'umore, incremento fedeltà se umore basso */
        deltaUmore = g.intervallo(20, 35);
        deltaFedeltà = umoreAttuale < 400 ? g.intervallo(2, 5) : g.intervallo(0, 2);
        messaggio = `Colloquio rassicurante con ${pilota.nome}. Umore migliorato.`;
        break;

      case 'motivazionale':
        /* Forte incremento umore, ma rischio backfire se stagione va male */
        if (stagionePositivia || g.probabilita(0.55)) {
          deltaUmore = g.intervallo(40, 65);
          deltaFedeltà = g.intervallo(0, 3);
          messaggio = `Colloquio motivazionale con ${pilota.nome}: risposta positiva.`;
        } else {
          deltaUmore = -g.intervallo(15, 30);
          deltaFedeltà = -g.intervallo(1, 3);
          messaggio = `Colloquio motivazionale con ${pilota.nome}: percepito come pressione in una stagione difficile.`;
        }
        break;

      case 'critico':
        /* Decremento umore/fedeltà, ma bonus performance temporaneo */
        deltaUmore   = -g.intervallo(40, 70);
        deltaFedeltà = fedeltàAttuale >= 60
          ? -g.intervallo(2, 5)     /* fedeltà alta: resistono meglio */
          : -g.intervallo(5, 12);
        deltaPerformanza = g.intervallo(4, 8);  /* bonus performance per 3 round */
        messaggio = `Colloquio critico con ${pilota.nome}. Aspettative alzate: prestazioni attese in miglioramento nei prossimi round.`;
        break;
    }

    /* Applica effetti */
    pilota.umore     = Math.min(1000, Math.max(0, umoreAttuale + deltaUmore));
    pilota.fedeltà   = Math.min(100,  Math.max(0, fedeltàAttuale + deltaFedeltà));
    if (deltaPerformanza > 0) {
      pilota.bonusPerformanza = { valore: deltaPerformanza, durataRound: 3 };
    }

    this.stato.colloquiPilotiRound[pilotaId] = round;
    this.salva();
    return { successo: true, messaggio, deltaUmore, deltaFedeltà, deltaPerformanza };
  }

  ottieniStatoColloquiPiloti() {
    const round = this.stato.roundCorrente;
    return {
      round,
      colloquiEseguiti: this.stato.colloquiPilotiRound || {}
    };
  }

  /* ----------------------------------------------------------
     RELAZIONI — FEDERAZIONE: NEGOZIAZIONI DIFFERITE
  ---------------------------------------------------------- */

  avviaNegoziazioneFederazione(tipo) {
    /* tipo: 'proroga_era' | 'chiarimento_tecnico' | 'modifica_regolamentare' */
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const usati = this.stato.negoziazioniFedStagione || {};
    if (usati[tipo]) return { successo: false, messaggio: 'Tipo di negoziazione già avviato questa stagione.' };

    /* Verifica prerequisiti */
    if (tipo === 'proroga_era') {
      const era = this.stato.eraRegolamentare;
      const stagioneCorrEra = (this.stato.stagione - (era?.inizioStagione || this.stato.stagione)) + 1;
      const rimanenti = (era?.durataPrevista || 4) - stagioneCorrEra;
      if (rimanenti > 2) return { successo: false, messaggio: 'Proroga richiedibile solo negli ultimi 2 anni dell\'era regolamentare.' };
    }

    const g = this.generatore;
    const ri = this.stato.staff?.responsabileRelazioni;
    const qualitàRI = ri?.statistiche?.negoziazione || ri?.statistiche?.relazioni || 65;
    const roundAvvio  = this.stato.roundCorrente;
    const roundRivela = roundAvvio + g.intervallo(3, 8);

    /* Probabilità di successo modulata dalla qualità del RI */
    const probBase = { proroga_era: 0.45, chiarimento_tecnico: 0.70, modifica_regolamentare: 0.25 };
    const probSuccesso = Math.min(0.95, (probBase[tipo] || 0.5) * (0.6 + (qualitàRI / 100) * 0.8));
    const successo = g.probabilita(probSuccesso);

    const TESTI_ATTESA = {
      proroga_era:           'Richiesta di proroga era regolamentare inviata alla Federazione. Risposta attesa nelle prossime settimane.',
      chiarimento_tecnico:   'Richiesta di chiarimento tecnico inoltrata. La Federazione esaminerà la questione.',
      modifica_regolamentare:'Proposta di modifica regolamentare depositata. La Federazione la valuterà in sede di commissione.'
    };
    const TESTI_ESITO = {
      proroga_era: {
        successo: 'La Federazione ha accettato la richiesta di proroga. L\'era regolamentare corrente durerà una stagione in più.',
        rifiuto:  'La Federazione ha respinto la richiesta di proroga. Il cambio regolamentare procederà come pianificato.'
      },
      chiarimento_tecnico: {
        successo: 'La Federazione ha emesso un chiarimento tecnico favorevole. La soluzione borderline è protetta per questa stagione.',
        rifiuto:  'La Federazione non ha riconosciuto la soluzione come conforme. Rischio di intervento regolamentare.'
      },
      modifica_regolamentare: {
        successo: 'La commissione ha approvato una modifica limitata al regolamento in favore delle squadre indipendenti.',
        rifiuto:  'La proposta di modifica regolamentare non ha ottenuto supporto sufficiente in commissione.'
      }
    };

    const negoziazione = {
      id:            `neg_${tipo}_${this.stato.stagione}_${roundAvvio}`,
      tipo,
      roundAvvio,
      roundRivela,
      esito:         successo ? 'successo' : 'rifiuto',
      esitoRivelato: false,
      testoAttesa:   TESTI_ATTESA[tipo] || 'Negoziazione in corso.',
      testoEsito:    (TESTI_ESITO[tipo] || {})[successo ? 'successo' : 'rifiuto'] || ''
    };

    /* Se proroga accettata, prepara l'effetto da applicare quando rivelato */
    if (tipo === 'proroga_era' && successo) {
      negoziazione.effettoDaApplicare = 'proroga_era';
    }

    this.stato.negoziazioniAttiveFed = this.stato.negoziazioniAttiveFed || [];
    this.stato.negoziazioniAttiveFed.push(negoziazione);
    this.stato.negoziazioniFedStagione = usati;
    this.stato.negoziazioniFedStagione[tipo] = true;

    this.salva();
    return { successo: true, messaggio: negoziazione.testoAttesa, roundRivela };
  }

  _verificaEsitiNegoziazioniPendenti() {
    const round = this.stato.roundCorrente;
    const pendenti = (this.stato.negoziazioniAttiveFed || []).filter(n => !n.esitoRivelato);
    let haAggiornamenti = false;
    pendenti.forEach(n => {
      if (round >= n.roundRivela) {
        n.esitoRivelato = false; /* marcata come da leggere */
        n.esitoDisponibile = true;
        /* Applica effetti meccanici */
        if (n.effettoDaApplicare === 'proroga_era' && this.stato.eraRegolamentare) {
          this.stato.eraRegolamentare.durataPrevista = (this.stato.eraRegolamentare.durataPrevista || 4) + 1;
          n.effettoDaApplicare = null;
        }
        haAggiornamenti = true;
      }
    });
    if (haAggiornamenti) this.salva();
  }

  segnaEsitoNegoziazioneVisto(negoziazioneId) {
    const neg = (this.stato.negoziazioniAttiveFed || []).find(n => n.id === negoziazioneId);
    if (neg) { neg.esitoRivelato = true; this.salva(); }
  }

  ottieniNegoziazioniAttive() {
    return {
      negoziazioni: this.stato.negoziazioniAttiveFed || [],
      usatiStagione: this.stato.negoziazioniFedStagione || {},
      roundCorrente: this.stato.roundCorrente
    };
  }

  /* ----------------------------------------------------------
     RELAZIONI — STAFF: RIUNIONI E INCONTRI
  ---------------------------------------------------------- */

  avviaRiunioneSquadra() {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const count = this.stato.riunioniSquadraStagione || 0;
    if (count >= 4) return { successo: false, messaggio: 'Limite di 4 riunioni per stagione raggiunto.' };

    const g = this.generatore;
    const bonusBase = g.intervallo(8, 14);
    /* La qualità delle figure principali amplifica l'effetto */
    const staff = this.stato.staff || {};
    const qualMedia = ['capoIngegnere', 'direttoreAero', 'direttoreGara'].reduce((sum, k) => {
      return sum + (staff[k]?.statistiche?.coordinamento || staff[k]?.statistiche?.strategia || 70);
    }, 0) / 3;
    const bonus = Math.round(bonusBase * (0.7 + qualMedia / 333));

    /* Applica bonus motivazione temporanea a tutte le figure */
    ['capoIngegnere', 'direttoreAero', 'direttoreMeccanica', 'direttoreElettronica', 'direttoreGara', 'dataAnalyst'].forEach(k => {
      if (staff[k]) {
        staff[k].motivazioneBonus = Math.min(30, ((staff[k].motivazioneBonus || 0) + bonus));
      }
    });

    this.stato.riunioniSquadraStagione = count + 1;
    this.salva();
    return {
      successo: true,
      messaggio: `Riunione di squadra completata. Motivazione di tutto lo staff migliorata di ${bonus} punti.`,
      riunioniRimanenti: 4 - this.stato.riunioniSquadraStagione
    };
  }

  avviaIncontroIndividuale(chiaveStaff) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const round = this.stato.roundCorrente;
    if ((this.stato.incontriStaffRound || {})[chiaveStaff] === round) {
      return { successo: false, messaggio: 'Incontro già effettuato con questa figura in questo round.' };
    }

    const membro = this.stato.staff?.[chiaveStaff];
    if (!membro) return { successo: false, messaggio: 'Figura non trovata.' };

    const g = this.generatore;
    const bonus = g.intervallo(4, 8);
    membro.motivazioneBonus = Math.min(30, ((membro.motivazioneBonus || 0) + bonus));

    this.stato.incontriStaffRound = this.stato.incontriStaffRound || {};
    this.stato.incontriStaffRound[chiaveStaff] = round;
    this.salva();
    return {
      successo: true,
      messaggio: `Incontro individuale con ${membro.nome || chiaveStaff}. Motivazione personale migliorata.`
    };
  }

  /* ----------------------------------------------------------
     RELAZIONI — SPONSOR: AGGIORNAMENTO E HOSPITALITY
  ---------------------------------------------------------- */

  inviaAggiornamentoSponsor(sponsorId) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const round = this.stato.roundCorrente;
    if ((this.stato.aggiornamentoSponsorRound || {})[sponsorId] === round) {
      return { successo: false, messaggio: 'Aggiornamento già inviato a questo sponsor nel round corrente.' };
    }
    const sponsor = (this.stato.sponsor || []).find(s => s.id === sponsorId);
    if (!sponsor) return { successo: false, messaggio: 'Sponsor non trovato.' };

    const g = this.generatore;
    const delta = g.intervallo(3, 6);
    sponsor.soddisfazione = Math.min(100, (sponsor.soddisfazione || 50) + delta);
    this.stato.aggiornamentoSponsorRound = this.stato.aggiornamentoSponsorRound || {};
    this.stato.aggiornamentoSponsorRound[sponsorId] = round;
    this.salva();
    return { successo: true, messaggio: `Aggiornamento inviato a ${sponsor.nome}. Soddisfazione +${delta}.` };
  }

  organizzaEventoHospitality() {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const count = this.stato.eventiHospitalityStagione || 0;
    if (count >= 3) return { successo: false, messaggio: 'Limite di 3 eventi hospitality per stagione raggiunto.' };

    const costo = 200000; /* 200K€ */
    if ((this.stato.budget - (this.stato.budgetSpeso || 0)) < costo) {
      return { successo: false, messaggio: 'Budget insufficiente per organizzare l\'evento.' };
    }

    /* Qualità Responsabile Hospitality amplifica l'effetto */
    const hosp = this.stato.staff?.responsabileHospitality;
    const qualHosp = hosp?.statistiche?.relazioni || hosp?.statistiche?.carisma || 65;
    const g = this.generatore;
    const bonusBase = g.intervallo(5, 8);
    const bonus = Math.round(bonusBase * (0.7 + qualHosp / 333));

    (this.stato.sponsor || []).filter(s => s.attivo).forEach(s => {
      s.soddisfazione = Math.min(100, (s.soddisfazione || 50) + bonus);
    });

    this.stato.budgetSpeso = (this.stato.budgetSpeso || 0) + costo;
    this.stato.eventiHospitalityStagione = count + 1;
    this.salva();
    return {
      successo: true,
      messaggio: `Evento hospitality organizzato. Soddisfazione di tutti gli sponsor +${bonus} punti. Costo: €${costo.toLocaleString('it-IT')}.`,
      eventiRimanenti: 3 - this.stato.eventiHospitalityStagione,
      bonus
    };
  }

  /* ----------------------------------------------------------
     RELAZIONI — MEDIA: CONFERENZE E DICHIARAZIONI
  ---------------------------------------------------------- */

  organizzaConferenzaStampa(pilotaId) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const round = this.stato.roundCorrente;
    if ((this.stato.conferenzaStampaRound || -1) === round) {
      return { successo: false, messaggio: 'Conferenza stampa già tenuta in questo round.' };
    }

    const g = this.generatore;
    let deltaRep = g.intervallo(30, 50);

    /* Amplifica se partecipa un pilota ad alta visibilità */
    if (pilotaId) {
      const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId);
      if (pilota && (pilota.visibilitaMediatica || 0) >= 8) {
        deltaRep += g.intervallo(10, 25);
      }
    }

    if (this.stato.reputazione) {
      this.stato.reputazione.mediatica = Math.min(10000, (this.stato.reputazione.mediatica || 0) + deltaRep);
    }
    this.stato.conferenzaStampaRound = round;
    this.salva();
    return {
      successo: true,
      messaggio: `Conferenza stampa completata. Reputazione mediatica +${deltaRep}.`,
      deltaRep
    };
  }

  organizzaDichiarazioneTecnica() {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    if (this.stato.dichiarazioneTecnicaStagione) {
      return { successo: false, messaggio: 'Dichiarazione tecnica già effettuata questa stagione.' };
    }

    const g = this.generatore;
    const deltaRep = g.intervallo(70, 100);
    if (this.stato.reputazione) {
      this.stato.reputazione.tecnica = Math.min(10000, (this.stato.reputazione.tecnica || 0) + deltaRep);
    }
    this.stato.dichiarazioneTecnicaStagione = true;
    this.salva();
    return {
      successo: true,
      messaggio: `Dichiarazione tecnica pubblicata. Reputazione tecnica +${deltaRep}.`,
      deltaRep
    };
  }

  _applicaBeneficiReputazioneSponsor() {
    if (this.stato.categoria !== 'AR1') return;
    const attivi = (this.stato.sponsor || []).filter(s => s.attivo && s.beneficioTecnico?.tipo);
    attivi.forEach(s => {
      const tipo = s.beneficioTecnico.tipo;
      if (!this.stato.reputazione) return;
      if (tipo === 'visibilita_mediatica') {
        this.stato.reputazione.mediatica = Math.min(10000, (this.stato.reputazione.mediatica || 0) + 80);
      } else if (tipo === 'reputazione_tecnica') {
        this.stato.reputazione.tecnica   = Math.min(10000, (this.stato.reputazione.tecnica   || 0) + 50);
      }
      /* cfd_bonus, data_analyst_bonus, supporto_infrastrutturale:
         effetto meccanico applicato nei metodi di calcolo pertinenti.
         Il beneficio è registrato sul record sponsor ed è già visibile al giocatore. */
    });
  }

  _verificaTerminazioneContrattiSponsor() {
    /* Clausola interruzione anticipata: applicata a fine stagione.
       Soddisfazione < 20 → 40% probabilità di recesso.
       Soddisfazione = 0  → 80% probabilità di recesso.
       Contratti scaduti vengono marcati come non attivi. */
    if (this.stato.categoria !== 'AR1') return;
    const g = this.generatore;
    const stagione = this.stato.stagione;

    (this.stato.sponsor || []).forEach(s => {
      if (!s.attivo) return;

      /* Scadenza naturale */
      if ((s.scadenza || 0) < stagione) {
        s.attivo = false;
        s.terminato = true;
        s.motivoTerminazione = 'scadenza';
        return;
      }

      /* Clausola di interruzione anticipata */
      const sodd = s.soddisfazione || 0;
      if (sodd < 20) {
        const probRecesso = sodd === 0 ? 0.80 : 0.40;
        if (g.probabilita(probRecesso)) {
          s.attivo = false;
          s.terminato = true;
          s.motivoTerminazione = 'interruzione_anticipata';
        }
      }
    });
  }

  ottieniDettaglioSponsor(sponsorId) {
    /* Restituisce tutte le condizioni contrattuali con spiegazione della meccanica
       e stato corrente rispetto alla classifica in corso. */
    if (this.stato.categoria !== 'AR1') return null;
    const s = (this.stato.sponsor || []).find(sp => sp.id === sponsorId);
    if (!s) return null;

    const classifica  = this.stato.classificaCostruttori || [];
    const posCorrente = (classifica.findIndex(c => c.squadraId === this.stato.squadraId) + 1) || null;
    const objRaggiunto = posCorrente !== null && posCorrente <= s.obiettivoClassifica;
    const stagioniRim  = Math.max(0, (s.scadenza || 0) - this.stato.stagione + 1);

    /* Livello di rischio interruzione */
    const sodd = s.soddisfazione || 0;
    const rischioInterruzione = sodd < 20 ? 'alto' : sodd < 40 ? 'medio' : 'basso';

    return {
      id:              s.id,
      nome:            s.nome,
      categoria:       s.categoria,
      importoAnnuale:  s.importoAnnuale,
      scadenza:        s.scadenza,
      stagioniRimaste: stagioniRim,
      obiettivoClassifica: s.obiettivoClassifica,
      posCorrente,
      objRaggiunto,
      soddisfazione:   sodd,
      rischioInterruzione,
      meccanica: {
        bonusPerGara:  '+3 soddisfazione per gara se classifica entro top ' + s.obiettivoClassifica,
        malusPerGara:  '−4 soddisfazione per gara se classifica fuori top ' + s.obiettivoClassifica,
        sogliaClauso:  'Sotto 20: clausola interruzione anticipata attivabile (40% probabilità a fine stagione)'
      },
      beneficioTecnico: s.beneficioTecnico || null,
      attivo:           s.attivo,
      terminato:        s.terminato || false,
      motivoTerminazione: s.motivoTerminazione || null
    };
  }

  confermaNuovoSponsor(candidatoId) {
    if (this.stato.categoria !== 'AR1') return { successo: false, messaggio: 'Non disponibile.' };
    const candidati = this.stato._candidatiSponsor || [];
    const candidato = candidati.find(c => c.id === candidatoId);
    if (!candidato) return { successo: false, messaggio: 'Candidato non trovato.' };

    const nuovoSponsor = {
      ...candidato,
      id: `sponsor_${this.stato.stagione}_${candidatoId}`,
      stagioneInizio: this.stato.stagione
    };

    this.stato.sponsor = this.stato.sponsor || [];
    this.stato.sponsor.push(nuovoSponsor);
    this.stato.budget += nuovoSponsor.importoAnnuale;
    this.stato._candidatiSponsor = candidati.filter(c => c.id !== candidatoId);

    this.salva();
    return { successo: true, messaggio: `Accordo con ${nuovoSponsor.nome} finalizzato.`, sponsor: nuovoSponsor };
  }

  /* ==============================================================
     PAUSA INVERNALE AR1 — gestione inter-stagionale
     Capitoli: consuntivo · concept · sviluppo · budget · piloti · staff
     ============================================================== */

  /* Verifica se la nuova stagione inaugura una nuova era regolamentare */
  _rilevaChangEra() {
    const era = this.stato.eraRegolamentare;
    if (!era) return false;
    return this.stato.stagione >= (era.inizioStagione + (era.durataPrevista || 4));
  }

  /* Dati finanziari e sportivi del consuntivo */
  ottieniDatiConsuntivo() {
    const stato    = this.stato;
    const storico  = stato.storico || [];
    const ultima   = storico[storico.length - 1] || {};
    const pos      = ultima.posizione || 10;

    const prize    = this._calcolaPrizeMoney(pos);
    const bonus    = (DATI.BONUS_STORICI || {})[stato.squadraId] || 0;
    const sponsor  = (stato.sponsor || [])
      .filter(s => !s.terminato)
      .reduce((t, s) => t + (s.importoAnnuale || 0), 0);

    return {
      stagione:             stato.stagione - 1,
      categoria:            ultima.categoria || stato.categoria,
      posizione:            pos,
      punti:                ultima.punti || 0,
      budgetResiduo:        stato.budget,
      prizeMoney:           prize,
      bonusStorico:         bonus,
      entrateSponsor:       sponsor,
      budgetNuovaStagione:  stato.budget + prize + bonus + sponsor,
      eventoStagione:       stato.eventoStagione,
      cambioEra:            this._rilevaChangEra(),
      nuovaStagione:        stato.stagione
    };
  }

  _calcolaPrizeMoney(posizione) {
    const t = DATI.PRIZE_MONEY_AR1 || {};
    return (t[posizione] || t[10] || 34) * 1000000;
  }

  /* Segna un capitolo della pausa come aperto */
  segnaCapitoloInvernale(capitolo) {
    if (!this.stato.pausaInvernaleCapitoli) this.stato.pausaInvernaleCapitoli = {};
    this.stato.pausaInvernaleCapitoli[capitolo] = true;
    this.salva();
  }

  /* Restituisce le opzioni concept per la nuova stagione */
  ottieniOpzioniConcept() {
    if (this._rilevaChangEra()) {
      return [
        { id: 'rake_alto',
          nome: 'Concept rake alto',
          desc: 'Deportanza meccanica elevata. Favorisce il carico nelle curve lente, sensibile alle variazioni di altezza da terra.',
          effetti: { aerodinamica: +3, meccanica: +2, elettronica:  0, powerUnit: -1 },
          incertezza: 'alta', rischio: 'medio' },
        { id: 'rake_basso',
          nome: 'Concept rake basso',
          desc: 'Aerodinamica pulita a basso angolo di attacco. Stabile in percorrenza, picco di carico inferiore.',
          effetti: { aerodinamica: +1, meccanica:  0, elettronica: +3, powerUnit: +1 },
          incertezza: 'alta', rischio: 'basso' },
        { id: 'carico_max',
          nome: 'Deportanza massima',
          desc: 'Downforce estremizzato. Netto vantaggio sui circuiti tecnici lenti, deficit marcato nei rettilinei ad alta velocita.',
          effetti: { aerodinamica: +5, meccanica: -1, elettronica:  0, powerUnit: -2 },
          incertezza: 'alta', rischio: 'alto' },
        { id: 'efficienza',
          nome: 'Efficienza aerodinamica',
          desc: 'Bilanciamento ottimizzato tra resistenza e deportanza. Versatile su tutti i tipi di circuito.',
          effetti: { aerodinamica: +2, meccanica: +1, elettronica: +1, powerUnit: +1 },
          incertezza: 'media', rischio: 'basso' },
        { id: 'bilanciato_era',
          nome: 'Concept bilanciato',
          desc: 'Nessuna specializzazione estrema. Sviluppo incrementale uniforme su tutte le aree tecniche.',
          effetti: { aerodinamica: +1, meccanica: +2, elettronica: +1, powerUnit: +1 },
          incertezza: 'bassa', rischio: 'minimo' },
        { id: 'innovativo',
          nome: 'Concept rivoluzionario',
          desc: 'Approccio non convenzionale al limite del regolamento. Potenziale di guadagno eccezionale, risultati imprevedibili.',
          effetti: { aerodinamica: +6, meccanica: -2, elettronica: +2, powerUnit: -1 },
          incertezza: 'massima', rischio: 'massimo' }
      ];
    }
    return [
      { id: 'continuativo',
        nome: 'Sviluppo evolutivo',
        desc: 'Migliorie incrementali alla piattaforma esistente. Prevedibili, nessun rischio tecnico.',
        effetti: { aerodinamica: +1, meccanica: +1, elettronica: +1, powerUnit: +1 },
        incertezza: 'bassa', rischio: 'minimo' },
      { id: 'prio_aero',
        nome: 'Priorita aerodinamica',
        desc: 'CFD e galleria del vento concentrati sul carico. Vantaggio nei circuiti tecnici, potenziale deficit sui rettilinei.',
        effetti: { aerodinamica: +4, meccanica:  0, elettronica:  0, powerUnit: +1 },
        incertezza: 'media', rischio: 'basso' },
      { id: 'focus_meccanica',
        nome: 'Sviluppo meccanico',
        desc: 'Sospensioni, idraulica e handling. Beneficio nei tratti lenti e nelle condizioni di bagnato.',
        effetti: { aerodinamica:  0, meccanica: +4, elettronica:  0, powerUnit:  0 },
        incertezza: 'media', rischio: 'basso' },
      { id: 'energia',
        nome: 'Efficienza energetica',
        desc: 'MGU-K ottimizzato e recupero energia migliorato. Beneficio variabile in base alla tipologia di circuito.',
        effetti: { aerodinamica:  0, meccanica: +1, elettronica: +3, powerUnit: +1 },
        incertezza: 'media', rischio: 'basso' }
    ];
  }

  /* Raccomandazione del Capo Ingegnere per il concept di nuova era.
     Restituisce null se: non è AR1, non c'è cambio era, CE non ingaggiato.
     Il profilo è derivato dalle stat esistenti (coordinamento / innovazione).
     bonusSigmaRiduzione: riduzione percentuale dell'incertezza se il giocatore
     segue il consiglio (proporzionale a coordinamento, max 45%). */
  ottieniRaccomandazioneConcept() {
    if (this.stato.categoria !== 'AR1') return null;
    if (!this._rilevaChangEra()) return null;
    const ce = this.stato.staff?.capoIngegnere;
    if (!ce) return null;

    const coord = ce.statistiche?.coordinamento || 70;
    const innov = ce.statistiche?.innovazione   || 70;

    let conceptId, motivazione, profiloLabel;

    if (innov >= 76 && coord < 80) {
      profiloLabel = 'orientamento innovativo';
      conceptId    = innov >= 82 ? 'innovativo' : 'carico_max';
      motivazione  = ce.nome + ' privilegia approcci tecnici non convenzionali. '
                   + 'Sulla base dell\'analisi del nuovo regolamento tecnico, raccomanda un concept ad alto potenziale. '
                   + 'Il rischio di esecuzione è elevato, ma il margine di guadagno sulla concorrenza può essere significativo.';
    } else if (coord >= 80) {
      profiloLabel = 'orientamento conservativo';
      conceptId    = coord >= 86 ? 'bilanciato_era' : 'efficienza';
      motivazione  = ce.nome + ' predilige lo sviluppo strutturato e controllato. '
                   + 'Raccomanda un concept che minimizzi l\'incertezza nella fase di avvio della nuova era, '
                   + 'privilegiando una base tecnica solida su cui costruire lo sviluppo stagionale.';
    } else {
      profiloLabel = 'orientamento bilanciato';
      conceptId    = innov >= 72 ? 'rake_basso' : 'efficienza';
      motivazione  = ce.nome + ' propone un approccio equilibrato tra rendimento immediato e stabilità tecnica. '
                   + 'Il concept scelto offre una base versatile con incertezza contenuta, adatta a qualsiasi tipologia di circuito.';
    }

    /* Sigma ridotta se il giocatore segue la raccomandazione: proporzionale a coordinamento */
    const bonusSigmaRiduzione = Math.min(0.45, Math.max(0, (coord - 60) / 67));

    return { conceptId, motivazione, profiloLabel, bonusSigmaRiduzione, nomeCE: ce.nome };
  }

  /* Applica il concept scelto agli attributi della macchina */
  applicaConceptMacchina(tipo) {
    if (this.stato.categoria !== 'AR1') return { ok: false };
    const opzioni = this.ottieniOpzioniConcept();
    const scelta  = opzioni.find(o => o.id === tipo);
    if (!scelta) return { ok: false, messaggio: 'Concept non valido.' };

    const g   = this.generatore;
    const era = this._rilevaChangEra();

    /* Se cambio d'era: genera la nuova era, resetta la macchina e azzera la conoscenza piste */
    if (era) {
      this._generaNuovaEra();
      const base = 65;
      this.stato.macchina = { aerodinamica: base, meccanica: base, elettronica: base, powerUnit: base };
      this.stato.datiPista = {};   /* la conoscenza dei tracciati non si trasferisce tra ere */
    }

    /* Se il giocatore segue la raccomandazione del CE, l'incertezza si riduce
       proporzionalmente alla sua stat di coordinamento (max −45% di sigma). */
    const racc     = this.ottieniRaccomandazioneConcept();
    const sigmaRid = (racc && tipo === racc.conceptId) ? racc.bonusSigmaRiduzione : 0;
    const sigma    = (scelta.incertezza === 'massima' ? 3.5
                    : scelta.incertezza === 'alta'    ? 2.0
                    : scelta.incertezza === 'media'   ? 1.0 : 0) * (1 - sigmaRid);

    const mac = this.stato.macchina || { aerodinamica: 65, meccanica: 65, elettronica: 65, powerUnit: 65 };
    ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(area => {
      const delta = scelta.effetti[area] || 0;
      const var_  = sigma > 0 ? g.gaussiana(0, sigma) : 0;
      mac[area] = Math.min(100, Math.max(40, mac[area] + delta + var_));
    });
    this.stato.macchina = mac;

    this.stato.conceptMacchina = {
      tipo,
      nome:       scelta.nome,
      incertezza: scelta.incertezza,
      rischio:    scelta.rischio,
      stagione:   this.stato.stagione
    };
    this.segnaCapitoloInvernale('concept');
    this.salva();
    return { ok: true, scelta };
  }

  /* Genera una nuova era regolamentare al cambio */
  _generaNuovaEra() {
    const g   = this.generatore;
    const era = this.stato.eraRegolamentare || {};

    /* Snapshot pesi precedenti per la narrativa di transizione */
    const eraPrecedente = era.nome ? {
      nome:            era.nome,
      pesoAerodinamica: era.pesoAerodinamica || 0.35,
      pesoMeccanica:   era.pesoMeccanica    || 0.25,
      pesoElettronica: era.pesoElettronica  || 0.20,
      pesoPowerUnit:   era.pesoPowerUnit    || 0.20
    } : null;

    const pesiPossibili = [
      { pesoAerodinamica: 0.40, pesoMeccanica: 0.25, pesoElettronica: 0.20, pesoPowerUnit: 0.15 },
      { pesoAerodinamica: 0.30, pesoMeccanica: 0.30, pesoElettronica: 0.25, pesoPowerUnit: 0.15 },
      { pesoAerodinamica: 0.35, pesoMeccanica: 0.20, pesoElettronica: 0.30, pesoPowerUnit: 0.15 },
      { pesoAerodinamica: 0.30, pesoMeccanica: 0.25, pesoElettronica: 0.20, pesoPowerUnit: 0.25 }
    ];
    const pesi   = g.dallaLista(pesiPossibili);
    const durata = g.intervallo(4, 6);

    /* Calcola delta rispetto all'era precedente (punti percentuali) */
    const transizione = eraPrecedente ? {
      eraPrecedenteNome: eraPrecedente.nome,
      deltaAerodinamica: Math.round((pesi.pesoAerodinamica - eraPrecedente.pesoAerodinamica) * 100),
      deltaMeccanica:    Math.round((pesi.pesoMeccanica    - eraPrecedente.pesoMeccanica)    * 100),
      deltaElettronica:  Math.round((pesi.pesoElettronica  - eraPrecedente.pesoElettronica)  * 100),
      deltaPowerUnit:    Math.round((pesi.pesoPowerUnit     - eraPrecedente.pesoPowerUnit)    * 100)
    } : null;

    this.stato.eraRegolamentare = {
      id:                'era_' + this.stato.stagione,
      nome:              'Era Tecnica ' + this.stato.stagione,
      inizioStagione:    this.stato.stagione,
      durataPrevista:    durata,
      ...pesi,
      budgetCapAR1:       era.budgetCapAR1 || 135000000,
      limiteTokenMotore: 3,
      limiteOreCFD:      era.limiteOreCFD,
      transizione
    };
  }

  /* Dati sviluppo tecnico invernale (capitolo Sviluppo) */
  ottieniStatoSviluppoInvernale() {
    const stato     = this.stato;
    const oreTotali = this.calcolaOreDisponibiliCFD();
    const split     = stato.allocazioneCFD || { stagioneCorrente: 0.7, prossimaStagione: 0.3 };
    return {
      macchina:            { ...(stato.macchina || {}) },
      allocazioneCFD:      split,
      oreTotali,
      oreCorrente:         Math.round(oreTotali * split.stagioneCorrente),
      oreProssima:         Math.round(oreTotali * split.prossimaStagione),
      factory:             stato.factory || {},
      investimentiInCorso: (stato.investimentiFactory || []).filter(i => !i.completato),
      tokenDisponibili:    Math.max(0, (stato.eraRegolamentare?.limiteTokenMotore || 3) - (stato.tokenUsati || 0)),
      cambioEra:           this._rilevaChangEra(),
      conceptAttuale:      stato.conceptMacchina
    };
  }

  /* Mercato piloti AR1 */
  ottieniMercatoPilotiAR1() {
    if (this.stato.categoria !== 'AR1') return null;
    if (!this.stato._pilotiLiberiAR1) this._generaPilotiLiberiAR1();
    const piloti = this.stato.piloti || [];
    return {
      aperto:        this.stato.faseCorrente === 'pausa_invernale',
      pilotiAttuali: piloti,
      inScadenza:    piloti.filter(p => (p.contratto?.scadenza || 0) <= this.stato.stagione),
      liberi:        this.stato._pilotiLiberiAR1 || [],
      riserva:       (DATI.PILOTI_RISERVA_AR1 || []).find(r => r.squadra === this.stato.squadraId) || null,
      academy:       (DATI.TALENTI_ACADEMY_AR1 || []).filter(t => t.squadra === this.stato.squadraId)
    };
  }

  _generaPilotiLiberiAR1() {
    const g = this.generatore;
    const pool = [
      { id: 'fl_montserrat', nome: 'Carlos Montserrat', eta: 28, nazionalita: 'Spagna',     bandiera: '🇪🇸', statistiche: { talento: 78, costanza: 76, qualifica: 78, gara: 77, bagnato: 74, gestione: 76 }, richiestaBase: 8000000,  disponibilita: 'alta',  visibilitaMediatica: 72, traiettoria: 'stabile' },
      { id: 'fl_beaumont',   nome: 'Arno Beaumont',     eta: 24, nazionalita: 'Francia',    bandiera: '🇫🇷', statistiche: { talento: 74, costanza: 70, qualifica: 76, gara: 72, bagnato: 68, gestione: 70 }, richiestaBase: 5000000,  disponibilita: 'alta',  visibilitaMediatica: 64, traiettoria: 'crescita' },
      { id: 'fl_kato',       nome: 'Daisuke Kato',      eta: 26, nazionalita: 'Giappone',   bandiera: '🇯🇵', statistiche: { talento: 76, costanza: 74, qualifica: 74, gara: 76, bagnato: 72, gestione: 74 }, richiestaBase: 6500000,  disponibilita: 'media', visibilitaMediatica: 68, traiettoria: 'stabile' },
      { id: 'fl_carvalho',   nome: 'Bruno Carvalho',    eta: 27, nazionalita: 'Brasile',    bandiera: '🇧🇷', statistiche: { talento: 72, costanza: 73, qualifica: 70, gara: 74, bagnato: 71, gestione: 72 }, richiestaBase: 5500000,  disponibilita: 'alta',  visibilitaMediatica: 63, traiettoria: 'stabile' },
      { id: 'fl_brandt',     nome: 'Felix Brandt',      eta: 22, nazionalita: 'Germania',   bandiera: '🇩🇪', statistiche: { talento: 76, costanza: 68, qualifica: 78, gara: 73, bagnato: 66, gestione: 66 }, richiestaBase: 4000000,  disponibilita: 'alta',  visibilitaMediatica: 60, traiettoria: 'crescita' },
      { id: 'fl_kowalski',   nome: 'Nadia Kowalski',    eta: 25, nazionalita: 'Polonia',    bandiera: '🇵🇱', statistiche: { talento: 74, costanza: 72, qualifica: 73, gara: 73, bagnato: 73, gestione: 73 }, richiestaBase: 5000000,  disponibilita: 'media', visibilitaMediatica: 70, traiettoria: 'stabile' }
    ];
    /* Aggiunge piloti liberi reali da pilotiAI (rilasciati dagli AI durante il mercato) */
    const agentiLiberi = (this.stato.pilotiAI || []).filter(p => p.squadra === 'libero');
    if (agentiLiberi.length > 0) {
      agentiLiberi.forEach(p => {
        const copia = JSON.parse(JSON.stringify(p));
        copia.id = 'fl_ai_' + copia.id;
        copia.richiestaBase = copia.contratto?.stipendio || 7000000;
        copia.disponibilita = 'alta';
        pool.push(copia);
      });
    } else {
      /* Fallback: nessun agente libero da pilotiAI — preleva casualmente da DATI */
      const squadreAI = DATI.SQUADRE_AR1.filter(s => s.id !== this.stato.squadraId);
      if (squadreAI.length) {
        const pilotiRilasciati = DATI.PILOTI_AR1.filter(p => p.squadra === g.dallaLista(squadreAI).id);
        if (pilotiRilasciati.length) {
          const p = JSON.parse(JSON.stringify(g.dallaLista(pilotiRilasciati)));
          p.id = 'fl_ai_' + p.id;
          p.richiestaBase = p.contratto?.stipendio || 7000000;
          p.disponibilita = 'alta';
          pool.push(p);
        }
      }
    }
    this.stato._pilotiLiberiAR1 = pool;
  }

  /* Pacchetti contrattuali per un pilota libero */
  ottieniPacchettiPilota(pilotaId) {
    const pool   = this.stato._pilotiLiberiAR1 || [];
    const pilota = pool.find(p => p.id === pilotaId);
    if (!pilota) return null;
    const base = pilota.richiestaBase || 5000000;
    return [
      { id: 'breve',    label: '1 stagione — Budget ridotto',    durata: 1, stipendio: Math.round(base * 0.88), desc: 'Contratto annuale, massima flessibilita. Nessun bonus incluso.' },
      { id: 'standard', label: '2 stagioni — Offerta standard',  durata: 2, stipendio: base,                    desc: 'Durata media. Bonus vittoria gara incluso.' },
      { id: 'lungo',    label: '3 stagioni — Contratto lungo',   durata: 3, stipendio: Math.round(base * 1.15), desc: 'Impegno pluriennale. Bonus campionato incluso.' },
      { id: 'opzione',  label: '1 + opzione — Profilo emergente',durata: 1, stipendio: Math.round(base * 0.78), desc: 'Ideale per giovani talenti. Opzione di rinnovo automatica al termine.' }
    ];
  }

  rilasciaPilotaAR1(pilotaId) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const idx = (this.stato.piloti || []).findIndex(p => p.id === pilotaId);
    if (idx === -1) return { ok: false, messaggio: 'Pilota non trovato.' };
    const pilota   = this.stato.piloti[idx];
    const anni     = Math.max(0, (pilota.contratto?.scadenza || this.stato.stagione) - this.stato.stagione);
    const penale   = anni > 0 ? Math.round((pilota.contratto?.stipendio || 0) * 0.40) : 0;
    if (penale > 0) this.registraSpesa('staff', penale, 'Rescissione ' + pilota.nome);
    this.stato.piloti.splice(idx, 1);
    this.salva();
    return { ok: true, costo: penale, messaggio: pilota.nome + ' rilasciato' + (penale ? '. Penale: ' + penale.toLocaleString('it-IT') + ' EUR.' : '.') };
  }

  ingaggiaPilotaAR1(pilotaId, pacchettId) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    if ((this.stato.piloti || []).length >= 2) return { ok: false, messaggio: 'Hai già due piloti. Rilascia prima un posto.' };
    const pacchetti = this.ottieniPacchettiPilota(pilotaId);
    const pacchetto = pacchetti?.find(pk => pk.id === pacchettId);
    if (!pacchetto) return { ok: false, messaggio: 'Pacchetto non valido.' };
    const pool = this.stato._pilotiLiberiAR1 || [];
    const pIdx = pool.findIndex(p => p.id === pilotaId);
    if (pIdx === -1) return { ok: false, messaggio: 'Pilota non disponibile.' };
    const pilota = pool[pIdx];
    const ok     = this.registraSpesa('staff', pacchetto.stipendio, 'Ingaggio ' + pilota.nome);
    if (!ok) return { ok: false, messaggio: 'Budget insufficiente.' };
    const nuovo = {
      ...JSON.parse(JSON.stringify(pilota)),
      id:       pilota.id.startsWith('fl_ai_') ? pilota.id.replace('fl_ai_', '') : pilota.id,
      squadra:  this.stato.squadraId,
      contratto:{ scadenza: this.stato.stagione + pacchetto.durata - 1, stipendio: pacchetto.stipendio },
      umore:    75, fedeltà: 50
    };
    if (!Array.isArray(this.stato.piloti)) this.stato.piloti = [];
    this.stato.piloti.push(nuovo);
    pool.splice(pIdx, 1);
    this.salva();
    return { ok: true, messaggio: pilota.nome + ' ingaggiato per ' + pacchetto.durata + ' stagione/i.' };
  }

  rinnovaContrattoPilotaAR1(pilotaId, durata, stipendio) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId);
    if (!pilota) return { ok: false, messaggio: 'Pilota non trovato.' };
    pilota.contratto = { scadenza: this.stato.stagione + durata - 1, stipendio };
    pilota.umore     = Math.min(100, (pilota.umore || 70) + 10);
    this.salva();
    return { ok: true, messaggio: 'Contratto di ' + pilota.nome + ' rinnovato fino al ' + pilota.contratto.scadenza + '.' };
  }

  ottieniPacchettiRinnovoAR1(pilotaId) {
    /* Restituisce i 4 pacchetti di rinnovo per un pilota in scadenza,
       ciascuno con filosofia diversa. Le cifre si basano sullo stipendio attuale. */
    const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId);
    if (!pilota) return null;
    const base = pilota.contratto?.stipendio || 5000000;
    return [
      {
        id: 'budget',
        label: 'Budget',
        durata: 1,
        stipendio: Math.round(base * 0.90),
        effettoUmore: -3,
        clausola: null,
        desc: 'Contratto annuale a costo ridotto. Il pilota accetta ma non e entusiasta. Massima flessibilita finanziaria.'
      },
      {
        id: 'prestazione',
        label: 'Prestazione',
        durata: 2,
        stipendio: base,
        effettoUmore: 5,
        clausola: 'top5',
        desc: 'Retribuzione invariata per 2 stagioni, con clausola bonus se la squadra chiude nei primi cinque. Incentivo sportivo condiviso.'
      },
      {
        id: 'durata',
        label: 'Durata',
        durata: 3,
        stipendio: Math.round(base * 1.12),
        effettoUmore: 12,
        clausola: null,
        desc: 'Impegno pluriennale a stipendio maggiorato. Il pilota si sente valorizzato sul lungo termine. Meno flessibilita in uscita.'
      },
      {
        id: 'comunicazione',
        label: 'Comunicazione',
        durata: 2,
        stipendio: Math.round(base * 1.05),
        effettoUmore: 5,
        clausola: 'media',
        desc: 'Clausola di presenza mediatica estesa. Il pilota porta maggiore visibilita agli sponsor per tutta la durata del contratto.'
      }
    ];
  }

  rinnovaContrattoPilotaAR1Pacchetto(pilotaId, pacchettoId) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const pilota = (this.stato.piloti || []).find(p => p.id === pilotaId);
    if (!pilota) return { ok: false, messaggio: 'Pilota non trovato.' };
    const pacchetti = this.ottieniPacchettiRinnovoAR1(pilotaId);
    const pk = pacchetti?.find(p => p.id === pacchettoId);
    if (!pk) return { ok: false, messaggio: 'Pacchetto non valido.' };

    pilota.contratto = {
      scadenza:  this.stato.stagione + pk.durata - 1,
      stipendio: pk.stipendio,
      clausola:  pk.clausola || null
    };
    pilota.umore = Math.min(100, Math.max(0, (pilota.umore || 70) + pk.effettoUmore));

    /* Pacchetto comunicazione: bonus immediato valoreSponsor */
    if (pk.id === 'comunicazione') {
      pilota.valoreSponsor = Math.min(100, (pilota.valoreSponsor || 50) + 5);
    }

    this.salva();
    return {
      ok: true,
      messaggio: 'Contratto di ' + pilota.nome + ' rinnovato — pacchetto ' + pk.label + '. Scadenza: stagione ' + pilota.contratto.scadenza + '.'
    };
  }

  /* ----------------------------------------------------------
     DIRETTIVE STAGIONALI — impostate in pausa invernale, effetto per tutta la stagione
  ---------------------------------------------------------- */

  ottieniDirettiveStagione() {
    if (this.stato.categoria !== 'AR1') return null;
    const sel   = this.stato.direttiveStagione || {};
    const staff = this.stato.staff || {};
    return {
      selezioni: sel,
      figure: [
        {
          chiave: 'capoIngegnere', nome: staff.capoIngegnere?.nome || null, presente: !!staff.capoIngegnere,
          opzioni: [
            { id: 'ci_bilanciamento', label: 'Bilanciamento',               effetto: '+1 impatto su tutti gli upgrade durante la stagione.' },
            { id: 'ci_spec_aero',     label: 'Specializzazione aerodinamica', effetto: 'Upgrade aerodinamica +3 impatto base.' },
            { id: 'ci_adattamento',   label: 'Integrazione rapida',          effetto: 'Il periodo di adattamento del nuovo staff tecnico si riduce da 8 a 5 round.' }
          ]
        },
        {
          chiave: 'direttoreGara', nome: staff.direttoreGara?.nome || null, presente: !!staff.direttoreGara,
          opzioni: [
            { id: 'dg_velocita',   label: 'Velocità pit stop',     effetto: 'Tempo stimato in corsia box ridotto di circa 0,3 secondi.' },
            { id: 'dg_precisione', label: 'Precisione operativa',  effetto: 'Probabilità di errore in pit stop dimezzata.' },
            { id: 'dg_gomme',      label: 'Gestione gomme',        effetto: 'Tasso di usura delle gomme ridotto del 5% per giro.' }
          ]
        },
        {
          chiave: 'dataAnalyst', nome: staff.dataAnalyst?.nome || null, presente: !!staff.dataAnalyst,
          opzioni: [
            { id: 'da_qualifica', label: 'Focus qualifica', effetto: 'Qualità dei dati nelle prove libere aumentata del 5%.' },
            { id: 'da_sviluppo',  label: 'Focus sviluppo',  effetto: 'Margine di errore nelle stime macchina ridotto del 25%.' },
            { id: 'da_gara',      label: 'Focus gara',      effetto: 'Tasso di degrado gomme ridotto del 3% durante la gara.' }
          ]
        },
        {
          chiave: 'direttoreAero', nome: staff.direttoreAero?.nome || null, presente: !!staff.direttoreAero,
          opzioni: [
            { id: 'aero_aggressivo',   label: 'Sviluppo aggressivo',   effetto: 'Upgrade aerodinamica +3 impatto base con varianza ±2.' },
            { id: 'aero_conservativo', label: 'Sviluppo conservativo', effetto: 'Upgrade aerodinamica +2 impatto stabile, senza varianza.' },
            { id: 'aero_bilanciato',   label: 'Approccio bilanciato',  effetto: 'Aerodinamica +1 e meccanica +1 impatto base.' }
          ]
        },
        {
          chiave: 'direttoreMeccanica', nome: staff.direttoreMeccanica?.nome || null, presente: !!staff.direttoreMeccanica,
          opzioni: [
            { id: 'mec_aggressivo',   label: 'Sviluppo aggressivo',   effetto: 'Upgrade meccanica +3 impatto base con varianza ±2.' },
            { id: 'mec_conservativo', label: 'Sviluppo conservativo', effetto: 'Upgrade meccanica +2 impatto stabile, senza varianza.' },
            { id: 'mec_bilanciato',   label: 'Approccio bilanciato',  effetto: 'Meccanica +1 e elettronica +1 impatto base.' }
          ]
        },
        {
          chiave: 'direttoreElettronica', nome: staff.direttoreElettronica?.nome || null, presente: !!staff.direttoreElettronica,
          opzioni: [
            { id: 'ele_aggressivo',   label: 'Sviluppo aggressivo',   effetto: 'Upgrade elettronica +3 impatto base con varianza ±2.' },
            { id: 'ele_conservativo', label: 'Sviluppo conservativo', effetto: 'Upgrade elettronica +2 impatto stabile, senza varianza.' },
            { id: 'ele_focus_pu',     label: 'Sinergia power unit',   effetto: 'Elettronica +1 impatto base. Ogni token PU usato guadagna +1 punto aggiuntivo.' }
          ]
        }
      ]
    };
  }

  impostaDirettiva(chiave, opzioneId) {
    if (this.stato.categoria !== 'AR1') return { ok: false, messaggio: 'Disponibile solo in AR1.' };
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Le direttive si impostano durante la pausa invernale.' };
    if (!this.stato.staff?.[chiave]) return { ok: false, messaggio: 'Figura staff non presente in squadra.' };
    if (!this.stato.direttiveStagione) this.stato.direttiveStagione = {};
    this.stato.direttiveStagione[chiave] = opzioneId;
    this.salva();
    return { ok: true };
  }

  /* ----------------------------------------------------------
     SONDAGGI ESPLORATIVI PILOTI — disponibili in-season (inter-gara)
     Permettono di verificare l'interesse di piloti liberi per la
     stagione successiva, senza impegno contrattuale.
  ---------------------------------------------------------- */

  ottieniSondaggiAR1() {
    if (this.stato.categoria !== 'AR1') return null;
    if (!this.stato._pilotiLiberiAR1) this._generaPilotiLiberiAR1();
    const sondaggi = this.stato.sondaggiPilotiAR1 || [];
    const MAX = 3;
    return {
      sondaggi,
      sondaggiUsati: sondaggi.length,
      maxSondaggi:   MAX,
      puoSondare:    this.stato.faseCorrente === 'inter-gara',
      liberi:        this.stato._pilotiLiberiAR1 || []
    };
  }

  avviaSondaggioPilotaAR1(pilotaId) {
    if (this.stato.categoria !== 'AR1')
      return { ok: false, messaggio: 'Disponibile solo in AR1.' };
    if (this.stato.faseCorrente !== 'inter-gara')
      return { ok: false, messaggio: 'I sondaggi sono disponibili solo tra un weekend e l\'altro.' };
    const MAX = 3;
    const sondaggi = this.stato.sondaggiPilotiAR1 || [];
    if (sondaggi.length >= MAX)
      return { ok: false, messaggio: 'Numero massimo di sondaggi per questa stagione raggiunto (' + MAX + ').' };
    if (sondaggi.find(s => s.pilotaId === pilotaId))
      return { ok: false, messaggio: 'Sondaggio già avviato per questo pilota.' };
    if (!this.stato._pilotiLiberiAR1) this._generaPilotiLiberiAR1();
    const pilota = (this.stato._pilotiLiberiAR1 || []).find(p => p.id === pilotaId);
    if (!pilota) return { ok: false, messaggio: 'Pilota non trovato nel pool liberi.' };
    const sondaggio = {
      id:            'sond_' + pilotaId + '_' + this.stato.roundCorrente,
      pilotaId,
      nomePilota:    pilota.nome,
      roundAvviato:  this.stato.roundCorrente,
      risposta:      null
    };
    this.stato.sondaggiPilotiAR1 = [...sondaggi, sondaggio];
    this.salva();
    return { ok: true, messaggio: 'Sondaggio avviato per ' + pilota.nome + '. La risposta arriverà entro 2 round.' };
  }

  _rivelaSondaggiMaturati() {
    if (this.stato.categoria !== 'AR1') return;
    const sondaggi = this.stato.sondaggiPilotiAR1 || [];
    if (sondaggi.length === 0) return;
    const g = this.generatore;
    let aggiornato = false;
    sondaggi.forEach(s => {
      if (s.risposta !== null) return;
      if (this.stato.roundCorrente < s.roundAvviato + 2) return;
      if (!this.stato._pilotiLiberiAR1) this._generaPilotiLiberiAR1();
      const pilota = (this.stato._pilotiLiberiAR1 || []).find(p => p.id === s.pilotaId);
      if (!pilota) { s.risposta = { interesse: 'rifiuto', stipendioIndicativo: null, messaggio: s.nomePilota + ' non è più disponibile.' }; aggiornato = true; return; }
      /* Probabilità interesse in base a disponibilità pilota e reputazione squadra */
      const repMedia = ((this.stato.reputazione?.mediatica || 3000) + (this.stato.reputazione?.performance || 3000)) / 20000;
      const baseMult = pilota.disponibilita === 'alta' ? 0.65 : pilota.disponibilita === 'media' ? 0.45 : 0.25;
      const prob = Math.min(0.9, baseMult + repMedia * 0.35);
      const rnd = g.intervallo(0, 100) / 100;
      let interesse, stipendioIndicativo, messaggio;
      const base = pilota.richiestaBase || 5000000;
      if (rnd < prob * 0.45) {
        interesse = 'alto';
        stipendioIndicativo = Math.round(base * 0.95);
        messaggio = pilota.nome + ' ha risposto positivamente. Richiesta economica indicativa: ' + stipendioIndicativo.toLocaleString('it-IT') + ' EUR/anno.';
      } else if (rnd < prob) {
        interesse = 'medio';
        stipendioIndicativo = base;
        messaggio = pilota.nome + ' è aperto a valutare un\'offerta. Richiesta economica indicativa: ' + stipendioIndicativo.toLocaleString('it-IT') + ' EUR/anno.';
      } else if (rnd < prob + 0.12) {
        interesse = 'basso';
        stipendioIndicativo = Math.round(base * 1.2);
        messaggio = pilota.nome + ' mostra interesse limitato. Potrebbe essere necessaria un\'offerta superiore alla norma.';
      } else {
        interesse = 'rifiuto';
        stipendioIndicativo = null;
        messaggio = pilota.nome + ' non è disponibile per una trattativa in questo momento.';
      }
      s.risposta = { interesse, stipendioIndicativo, messaggio };
      aggiornato = true;
    });
    if (aggiornato) this.stato.sondaggiPilotiAR1 = sondaggi;
  }

  /* Mercato staff AR1 */
  ottieniMercatoStaffAR1() {
    if (this.stato.categoria !== 'AR1') return null;
    if (!this.stato._staffLiberi) this._generaStaffLiberi();
    const staff = this.stato.staff || {};
    const figure = [
      'capoIngegnere','direttoreAero','direttoreMeccanica','direttoreElettronica',
      'direttoreGara','dataAnalyst','socialMediaManager','preparatoreAtletico',
      'direttoreLogistica','responsabileRelazioni','responsabileHospitality',
      'responsabileDatiTelemetria','coordinatoreOperativo','responsabileComunicazione'
    ];
    return {
      aperto:  this.stato.faseCorrente === 'pausa_invernale',
      staff:   figure.map(ch => {
        const m   = staff[ch] || null;
        const sc  = m ? (m.contratto?.scadenza || 9999) : 9999;
        return {
          chiave:     ch,
          membro:     m,
          inScadenza: m ? sc <= this.stato.stagione : false,
          preScadenza: m ? sc === this.stato.stagione + 1 : false,
          gardening:  m ? Math.max(0, sc - this.stato.stagione) : 0
        };
      }),
      liberi: this.stato._staffLiberi || []
    };
  }

  ottieniOpzioniRinnovoStaff(chiave) {
    /* Restituisce le 2 opzioni di rinnovo disponibili per un membro dello staff.
       Disponibile solo in pausa_invernale. */
    if (this.stato.categoria !== 'AR1') return null;
    const m = this.stato.staff?.[chiave];
    if (!m || !m.contratto) return null;

    const stipBase   = m.contratto.stipendio || 0;
    const baseScad   = Math.max(m.contratto.scadenza || this.stato.stagione, this.stato.stagione);
    const budgetDisp = this.stato.budget - (this.stato.budgetSpeso || 0);

    return [
      {
        id:          'breve',
        label:       'Rinnovo breve',
        durata:      1,
        stipendio:   stipBase,
        costoTotale: stipBase,
        scadenza:    baseScad + 1,
        descrizione: '1 stagione. Stipendio invariato.',
        fattibile:   budgetDisp >= stipBase
      },
      {
        id:          'lungo',
        label:       'Rinnovo lungo',
        durata:      2,
        stipendio:   Math.round(stipBase * 1.15),
        costoTotale: Math.round(stipBase * 1.15 * 2),
        scadenza:    baseScad + 2,
        descrizione: '2 stagioni. Stipendio +15% per la stabilità pluriennale.',
        fattibile:   budgetDisp >= Math.round(stipBase * 1.15 * 2)
      }
    ];
  }

  rinnovaContrattoStaff(chiave, opzioneId) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const m = this.stato.staff?.[chiave];
    if (!m) return { ok: false, messaggio: 'Nessun membro da rinnovare.' };

    const opzioni = this.ottieniOpzioniRinnovoStaff(chiave);
    const opzione = opzioni?.find(o => o.id === opzioneId);
    if (!opzione) return { ok: false, messaggio: 'Opzione di rinnovo non valida.' };
    if (!opzione.fattibile) return { ok: false, messaggio: 'Budget insufficiente per questo rinnovo.' };

    const ok = this.registraSpesa('staff', opzione.costoTotale, 'Rinnovo ' + m.nome + ' (' + opzione.durata + ' ann' + (opzione.durata === 1 ? 'o' : 'i') + ')');
    if (!ok) return { ok: false, messaggio: 'Budget insufficiente.' };

    m.contratto.scadenza  = opzione.scadenza;
    m.contratto.stipendio = opzione.stipendio;
    this.salva();
    return {
      ok:       true,
      scadenza: opzione.scadenza,
      stipendio: opzione.stipendio,
      messaggio: m.nome + ' rinnovato fino alla stagione ' + opzione.scadenza + '.'
    };
  }

  /* Alias retrocompatibile usato da test e UI precedenti */
  rinnovaContrattoStaffAR1(chiave) {
    return this.rinnovaContrattoStaff(chiave, 'breve');
  }

  _generaStaffLiberi() {
    const g = this.generatore;
    const v = (a, b) => g.intervallo(a, b);
    this.stato._staffLiberi = [
      /* Figure principali */
      { id: 'sl_01', chiaveRuolo: 'capoIngegnere',        nome: 'Roberto Testa',    eta: 48, statistiche: { coordinamento: v(72,82), strategia: v(70,78), esperienza: v(76,84), innovazione: v(66,74) }, richiestaBase: 850000 },
      { id: 'sl_02', chiaveRuolo: 'direttoreAero',        nome: 'Sophie Klein',     eta: 39, statistiche: { innovazione: v(76,86), precisione: v(74,82), esperienza: v(68,76) }, richiestaBase: 620000 },
      { id: 'sl_03', chiaveRuolo: 'direttoreMeccanica',   nome: 'Lars Henriksen',   eta: 41, statistiche: { innovazione: v(72,80), precisione: v(76,84), esperienza: v(70,78) }, richiestaBase: 580000 },
      { id: 'sl_04', chiaveRuolo: 'direttoreElettronica', nome: 'Priya Sharma',     eta: 36, statistiche: { innovazione: v(78,88), precisione: v(72,80), esperienza: v(64,72) }, richiestaBase: 560000 },
      { id: 'sl_05', chiaveRuolo: 'direttoreGara',        nome: 'Ian Sullivan',     eta: 44, statistiche: { pitStop: v(76,84), gestioneGomme: v(72,80), precisione: v(70,78) }, richiestaBase: 540000 },
      { id: 'sl_06', chiaveRuolo: 'dataAnalyst',          nome: 'Yuki Tanaka',      eta: 34, statistiche: { velocita: v(78,86), sintesi: v(76,84), precisione: v(74,82) }, richiestaBase: 500000 },
      /* Figure operative minori */
      { id: 'sm_01', chiaveRuolo: 'socialMediaManager',       nome: 'Alice Moreau',     eta: 31, statistiche: { comunicazione: v(68,84), carisma: v(66,80) }, richiestaBase: 210000 },
      { id: 'sm_02', chiaveRuolo: 'preparatoreAtletico',      nome: 'Diego Sánchez',    eta: 38, statistiche: { fitness: v(68,84), recupero: v(66,80) }, richiestaBase: 175000 },
      { id: 'sm_03', chiaveRuolo: 'direttoreLogistica',       nome: 'Bart Verhagen',    eta: 44, statistiche: { efficienza: v(66,82), coordinamento: v(64,78) }, richiestaBase: 250000 },
      { id: 'sm_04', chiaveRuolo: 'responsabileRelazioni',    nome: 'Charlotte Lam',    eta: 41, statistiche: { negoziazione: v(64,80), relazioni: v(68,82) }, richiestaBase: 230000 },
      { id: 'sm_05', chiaveRuolo: 'responsabileHospitality',  nome: 'Marco Ferrini',    eta: 39, statistiche: { relazioni: v(68,84), carisma: v(66,80) }, richiestaBase: 195000 },
      { id: 'sm_06', chiaveRuolo: 'responsabileDatiTelemetria',nome: 'Anya Kovač',      eta: 33, statistiche: { precisione: v(66,82), velocita: v(64,78) }, richiestaBase: 270000 },
      { id: 'sm_07', chiaveRuolo: 'coordinatoreOperativo',    nome: 'Kenji Mori',       eta: 36, statistiche: { efficienza: v(64,80), coordinamento: v(62,76) }, richiestaBase: 185000 },
      { id: 'sm_08', chiaveRuolo: 'responsabileComunicazione',nome: 'Elisa Brandt',     eta: 35, statistiche: { comunicazione: v(66,82), coordinamento: v(64,78) }, richiestaBase: 165000 }
    ];
  }

  rilasciaStaffAR1(chiave) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const m = this.stato.staff?.[chiave];
    if (!m) return { ok: false, messaggio: 'Ruolo non occupato.' };
    const anni  = Math.max(0, (m.contratto?.scadenza || this.stato.stagione) - this.stato.stagione);
    const penale = anni > 0 ? Math.round((m.contratto?.stipendio || 0) * 0.30) : 0;
    if (penale > 0) this.registraSpesa('staff', penale, 'Rescissione ' + (m.nome || chiave));
    this.stato.staff[chiave] = null;
    this.salva();
    return { ok: true, costo: penale, messaggio: (m.nome || chiave) + ' rilasciato.' };
  }

  ingaggiaStaffAR1(chiave, staffLiberoId) {
    if (this.stato.faseCorrente !== 'pausa_invernale') return { ok: false, messaggio: 'Il mercato è chiuso.' };
    const pool = this.stato._staffLiberi || [];
    const idx  = pool.findIndex(s => s.id === staffLiberoId);
    if (idx === -1) return { ok: false, messaggio: 'Candidato non disponibile.' };
    const m  = pool[idx];
    const ok = this.registraSpesa('staff', m.richiestaBase, 'Ingaggio ' + m.nome);
    if (!ok) return { ok: false, messaggio: 'Budget insufficiente.' };
    if (!this.stato.staff) this.stato.staff = {};
    const membroNuovo = {
      nome: m.nome, eta: m.eta, statistiche: m.statistiche,
      contratto: { scadenza: this.stato.stagione + 1, stipendio: m.richiestaBase }
    };
    /* Adattamento anti-copia: staff tecnico neoingaggiato porta conoscenza gradualmente */
    const TECH_ADAPT = ['capoIngegnere','direttoreAero','direttoreMeccanica','direttoreElettronica'];
    if (TECH_ADAPT.includes(chiave)) membroNuovo.adattamento = { roundRestanti: 8 };
    this.stato.staff[chiave] = membroNuovo;
    pool.splice(idx, 1);
    this.salva();
    return { ok: true, messaggio: m.nome + ' ingaggiato come ' + chiave + '.' };
  }

  /* Budget invernale */
  ottieniStatoBudgetInvernale() {
    if (this.stato.categoria !== 'AR1') return null;
    const cons     = this.ottieniDatiConsuntivo();
    const budget   = cons.budgetNuovaStagione;
    const approccio = this.stato.allocazioneBudget?.approccio || 'bilanciato';
    const piani = {
      aggressivo: { sviluppo: 0.55, staff: 0.20, operativo: 0.15, riserva: 0.10, desc: 'Massimizza lo sviluppo tecnico. Riduce il margine di sicurezza finanziario.' },
      bilanciato:  { sviluppo: 0.40, staff: 0.25, operativo: 0.20, riserva: 0.15, desc: 'Distribuzione equilibrata. Buona flessibilita operativa in stagione.' },
      prudente:    { sviluppo: 0.25, staff: 0.25, operativo: 0.25, riserva: 0.25, desc: 'Priorita alla stabilita. Minori risorse tecniche, alta resilienza finanziaria.' }
    };
    const piano = piani[approccio] || piani.bilanciato;
    return {
      budgetDisponibile: budget,
      approccioCorrente: approccio,
      piani,
      voci: {
        sviluppo:  Math.round(budget * piano.sviluppo),
        staff:     Math.round(budget * piano.staff),
        operativo: Math.round(budget * piano.operativo),
        riserva:   Math.round(budget * piano.riserva)
      }
    };
  }

  impostaBudgetInvernale(approccio) {
    const validi = ['aggressivo', 'bilanciato', 'prudente'];
    if (!validi.includes(approccio)) return;
    this.stato.allocazioneBudget = { approccio };
    this.segnaCapitoloInvernale('budget');
    this.salva();
  }

  /* Progressione factory durante la pausa invernale — velocita dimezzata */
  _applicaInvestimentiFactoryInvernale() {
    if (!this.stato.investimentiFactory?.length) return;
    this.stato.investimentiFactory.forEach(inv => {
      if (inv.completato) return;
      inv._progressoExtra = (inv._progressoExtra || 0) + 0.5;
      if (this.stato.roundCorrente + inv._progressoExtra >= inv.roundCompletamento) {
        const area = this.stato.factory?.[inv.area];
        if (area && area.livello < inv.livelloTarget) {
          area.livello    = inv.livelloTarget;
          area.condizione = 100;
        }
        inv.completato = true;
      }
    });
  }

  /* ----------------------------------------------------------
     TEST PRE-STAGIONALI AR1
  ---------------------------------------------------------- */

  ottieniProgrammiTest() {
    if (!this.stato.testPreStagionali) return { disponibili: [], consigliatoDaStaff: null };
    const t = this.stato.testPreStagionali;
    const svolti = t.programmiSvolti || [];
    const giorno = t.giorno;
    const disponibili = PROGRAMMI_TEST.filter(p => {
      if (t.completati) return false;
      if (svolti.includes(p.id)) return false;                        /* già svolto */
      if (p.disponibileDa > giorno) return false;                     /* non ancora disponibile */
      if (p.prerequisito && !svolti.includes(p.prerequisito)) return false; /* prerequisito mancante */
      return true;
    });

    /* Consiglio staff basato su aree a minore conoscenza */
    const km = this.stato.conoscenzaMacchina || {};
    let consigliatoDaStaff = null;
    const SOGLIA = 30;
    const ordine = [
      { cond: km.aerodinamica < SOGLIA,                       id: 'raccolta_aero' },
      { cond: km.meccanica    < SOGLIA,                       id: 'raccolta_mec' },
      { cond: km.powerUnit    < SOGLIA,                       id: 'raccolta_pu' },
      { cond: km.baseline     < SOGLIA,                       id: 'test_mescole' },
      { cond: svolti.includes('raccolta_aero'),               id: 'correlazione_cfd' },
      { cond: svolti.includes('raccolta_mec'),                id: 'setup_base' },
      { cond: km.baseline     < 40,                           id: 'sim_gara' },
      { cond: km.aerodinamica < 50 || km.powerUnit < 50,     id: 'alta_velocita' }
    ];
    for (const voce of ordine) {
      if (voce.cond && disponibili.find(p => p.id === voce.id)) {
        consigliatoDaStaff = voce.id;
        break;
      }
    }
    if (!consigliatoDaStaff && disponibili.length > 0) {
      consigliatoDaStaff = disponibili[0].id;
    }

    return { disponibili, consigliatoDaStaff, giorno, sessione: t.sessione };
  }

  eseguiSessioneTest(idProgramma) {
    if (!this.stato.testPreStagionali) return { ok: false };
    const t = this.stato.testPreStagionali;
    if (t.completati) return { ok: false, messaggio: 'Test già completati.' };

    const prog = PROGRAMMI_TEST.find(p => p.id === idProgramma);
    if (!prog) return { ok: false, messaggio: 'Programma non valido.' };

    const g = this.generatore;
    const giornoCorrente = t.giorno;
    const sessioneCorrente = t.sessione;

    /* Qualità base dipende dallo staff responsabile */
    let qualitaBase = 0.60;
    if (prog.staffBonus && this.stato.staff?.[prog.staffBonus]) {
      const stats = this.stato.staff[prog.staffBonus].statistiche;
      const val = stats[prog.staffBonusStat] || stats.innovazione || stats.precisione || 70;
      qualitaBase = 0.50 + (val / 100) * 0.38;
    }
    /* Data Analyst bonus trasversale */
    const daPrec = this.stato.staff?.dataAnalyst?.statistiche?.precisione || 70;
    qualitaBase += (daPrec - 70) / 100 * 0.06;
    /* Responsabile Dati e Telemetria: piccolo bonus */
    if (this.stato.staff?.responsabileDatiTelemetria) qualitaBase += 0.02;

    const rumore = g.gaussiana(0, 0.05);
    const qualita = Math.max(0.30, Math.min(1.0, qualitaBase + rumore));

    /* Incidenti */
    let incidente = null;
    let moltiplicatore = 1.0;
    const rng = g.prossimo();
    if (rng < 0.04) {
      incidente     = 'Guasto meccanico in pista. Sessione interrotta a meta.';
      moltiplicatore = 0.40;
    } else if (rng < 0.08) {
      incidente     = 'Uscita di pista del pilota. Danni alla carrozzeria, sessione accorciata.';
      moltiplicatore = 0.50;
    } else if (rng < 0.15) {
      incidente     = 'Bandiera rossa per incidente di altro team. Persi circa venti minuti.';
      moltiplicatore = 0.85;
    }

    /* Applica effetti su conoscenzaMacchina */
    if (!this.stato.conoscenzaMacchina) {
      this.stato.conoscenzaMacchina = { aerodinamica: 0, meccanica: 0, powerUnit: 0, baseline: 0 };
    }
    const effettiApplicati = {};
    Object.entries(prog.effetti).forEach(([campo, valore]) => {
      const guadagno = Math.round(valore * qualita * moltiplicatore);
      this.stato.conoscenzaMacchina[campo] = Math.min(100, (this.stato.conoscenzaMacchina[campo] || 0) + guadagno);
      effettiApplicati[campo] = guadagno;
    });

    /* Segna programma come completato */
    if (!t.programmiSvolti.includes(idProgramma)) t.programmiSvolti.push(idProgramma);

    /* Avanza sessione */
    let reportGiorno = null;
    if (sessioneCorrente === 0) {
      t.sessione = 1; /* → pomeriggio */
    } else {
      /* Fine giorno: genera report Data Analyst */
      reportGiorno = this._generaReportGiornalieroTest(giornoCorrente);
      t.reportGiornalieri.push(reportGiorno);
      t.sessione = 0;
      t.giorno++;
      if (t.giorno > 3) {
        t.completati = true;
        this.segnaCapitoloInvernale('test');
      }
    }

    this.salva();
    return {
      ok: true,
      programma: prog,
      qualita: Math.round(qualita * 100),
      effettiApplicati,
      incidente,
      giriPercorsi: Math.round((28 + g.intervallo(8, 22)) * qualita * moltiplicatore),
      giorno: giornoCorrente,
      sessione: sessioneCorrente,
      reportGiorno,
      conoscenzaMacchina: { ...this.stato.conoscenzaMacchina },
      completati: t.completati
    };
  }

  _generaReportGiornalieroTest(giorno) {
    const km = this.stato.conoscenzaMacchina || {};
    const daPrec = this.stato.staff?.dataAnalyst?.statistiche?.precisione || 70;
    const g = this.generatore;
    const conoscenzaMedia = ((km.aerodinamica || 0) + (km.meccanica || 0) + (km.powerUnit || 0) + (km.baseline || 0)) / 4;

    /* Stima prestativa preliminare se abbiamo dati sufficienti */
    let stima = null;
    if (conoscenzaMedia > 15 && this.stato.macchina) {
      const perfReale = (this.stato.macchina.aerodinamica + this.stato.macchina.meccanica + this.stato.macchina.powerUnit) / 3;
      const margine = Math.max(3, Math.round((100 - conoscenzaMedia) / 8 * (1 - daPrec / 200)));
      stima = {
        valore: Math.max(30, Math.min(100, perfReale + g.intervallo(-margine, margine))),
        margine
      };
    }

    const areeCoperte   = Object.entries(km).filter(([, v]) => v >= 25).map(([k]) => k);
    const areeScoperte  = Object.entries(km).filter(([, v]) => v <  25).map(([k]) => k);

    return {
      giorno,
      conoscenzaMacchina: { ...km },
      stima,
      areeCoperte,
      areeScoperte,
      messaggioDA: this._testoReportGiornaliero(giorno, conoscenzaMedia)
    };
  }

  _testoReportGiornaliero(giorno, conoscenzaMedia) {
    if (giorno === 1) {
      return conoscenzaMedia > 20
        ? 'Primo giorno completato. Dati preliminari acquisiti. Il modello di base e in costruzione.'
        : 'Primo giorno completato. Raccolta dati limitata. Priorita ai programmi fondamentali domani.';
    }
    if (giorno === 2) {
      return conoscenzaMedia > 40
        ? 'Secondo giorno completato. Il modello prestativo si sta definendo. Ultima giornata decisiva per ridurre il margine di errore.'
        : 'Secondo giorno completato. Alcune aree ancora poco coperte. Ultima giornata critica per la qualita delle stime.';
    }
    return conoscenzaMedia > 55
      ? 'Test pre-stagionali completati. Base di conoscenza solida. Le stime di performance avranno margine di errore contenuto per tutta la stagione.'
      : conoscenzaMedia > 35
        ? 'Test pre-stagionali completati. Conoscenza parziale. Alcune aree resteranno incerte fino alle prime prove libere di gara.'
        : 'Test pre-stagionali completati. Dati insufficienti su diverse aree. Le stime di performance avranno ampio margine di errore nelle prime gare.';
  }

  ottieniStatoTestPrestagionali() {
    const t = this.stato.testPreStagionali || { completati: false, giorno: 1, sessione: 0, programmiSvolti: [], reportGiornalieri: [] };
    return {
      ...t,
      conoscenzaMacchina: { ...(this.stato.conoscenzaMacchina || {}) },
      programmiDisponibili: this.ottieniProgrammiTest()
    };
  }

  /* Chiude la pausa invernale e avvia la nuova stagione */
  completaPausaInvernale() {
    if (this.stato.categoria !== 'AR1' || this.stato.faseCorrente !== 'pausa_invernale') {
      return { ok: false, messaggio: 'Fuori fase.' };
    }
    /* Applica concept di default se non scelto */
    if (!this.stato.conceptMacchina || this.stato.conceptMacchina.stagione !== this.stato.stagione) {
      const defaultId = this._rilevaChangEra() ? 'bilanciato_era' : 'continuativo';
      this.applicaConceptMacchina(defaultId);
    }
    /* Accredita entrate nuova stagione */
    const cons = this.ottieniDatiConsuntivo();
    this.stato.budget    += cons.prizeMoney + cons.bonusStorico + cons.entrateSponsor;
    this.stato.budgetSpeso = 0;
    this.stato.tokenUsati  = 0;
    /* Progressione factory invernale */
    this._applicaInvestimentiFactoryInvernale();
    /* Test pre-stagionali simulati per le squadre AI */
    this._simulaTestPrestagionaliAI();
    /* Rimozione staff con contratto scaduto non rinnovato */
    const staffCongedati = [];
    const staff = this.stato.staff || {};
    Object.keys(staff).forEach(chiave => {
      const m = staff[chiave];
      if (m && m.contratto && m.contratto.scadenza < this.stato.stagione) {
        staffCongedati.push({ chiave, nome: m.nome, motivo: 'contratto_scaduto' });
        delete staff[chiave];
      }
    });
    this.stato.staffCongedati = staffCongedati;   /* disponibile per consuntivo */

    /* Pulizia pool temporanei e stato invernale */
    this.stato._pilotiLiberiAR1         = null;
    this.stato._staffLiberi            = null;
    this.stato.pausaInvernaleCapitoli  = {};
    this.stato.eventoStagione          = null;
    /* Il testPreStagionali rimane per consultazione storica; sarà resettato a fine stagione */
    /* Avvia la nuova stagione */
    this.stato.faseCorrente  = 'inter-gara';
    this.stato.roundCorrente = 0;
    this.salva();
    return { ok: true };
  }
}

/* ============================================================
   FUNZIONI DI UTILITÀ — valori iniziali tracciamento calendario
   ============================================================ */

function _stagionInizialiSulCalendario(id) {
  /*
   * Stima quante stagioni un circuito rotativo è già presente in calendario
   * al momento dell'inizio partita (2026). Serve per evitare che circuiti
   * appena entrati vengano immediatamente rimossi.
   */
  const valori = {
    arabia_saudita: 5,  /* dal 2021 */
    cina:           2,  /* rientrato nel 2024 */
    miami:          4,  /* dal 2022 */
    emilia_romagna: 3,  /* rientrato stabilmente 2022-2024 */
    spagna:         5,  /* Barcellona presente da decenni, ma rotativo nel sistema */
    austria:        4,  /* rientrato 2014, considerato consolidato */
    singapore:      3,  /* spostato in rotativo — valore di partenza prudente */
    usa:            4,  /* COTA dal 2012 */
    messico:        4,  /* rientrato 2015 */
    las_vegas:      3,  /* dal 2023 */
    qatar:          3   /* dal 2023 continuativo */
  };
  return valori[id] || 3;
}

function _stagionInizialiOffCalendario(id) {
  /*
   * Stima da quante stagioni un circuito storico è fuori calendario al 2026.
   * Circuiti con più stagioni di assenza sono più "pronti" per il rientro narrativo.
   */
  const valori = {
    estoril:    30, /* ultima gara 1996 */
    jerez:      29, /* ultima gara 1997 */
    hockenheim:  7  /* ultima gara 2019 */
  };
  return valori[id] || 5;
}

/* Istanza globale del motore */
const motore = new MotoreGioco();
