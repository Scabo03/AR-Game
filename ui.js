/* ============================================================
   UI.JS — AR1 Manager
   Gestione interfaccia utente: rendering sezioni, navigazione,
   focus management, annunci VoiceOver, interazioni con il motore.
   ============================================================ */

'use strict';

/* ============================================================
   POLYFILL — replaceChildren (Safari < 14 / iOS < 14)
   replaceChildren() non è disponibile su Safari 13 e precedenti.
   Il polyfill riproduce il comportamento standard:
   chiamata senza argomenti = rimuove tutti i figli.
   ============================================================ */
if (typeof Element !== 'undefined' && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function (...nuoviNodi) {
    while (this.firstChild) this.removeChild(this.firstChild);
    nuoviNodi.forEach(n => {
      this.appendChild(typeof n === 'string' ? document.createTextNode(n) : n);
    });
  };
}

/* ============================================================
   UTILITY DI ACCESSO AL DOM
   ============================================================ */

function el(id) { return document.getElementById(id); }
function crea(tag, attributi, testo) {
  const nodo = document.createElement(tag);
  if (attributi) Object.entries(attributi).forEach(([k, v]) => nodo.setAttribute(k, v));
  if (testo !== undefined) nodo.textContent = testo;
  return nodo;
}

/* Annuncio per VoiceOver tramite aria-live */
function annunciaVoiceOver(messaggio) {
  const regione = el('regione-notifiche');
  if (!regione) return;
  regione.textContent = '';
  /* Piccola pausa per forzare il re-trigger dell'aria-live */
  requestAnimationFrame(() => { regione.textContent = messaggio; });
}

/* Formatta una cifra monetaria in milioni */
function formatMoneta(importo) {
  if (Math.abs(importo) >= 1000000) {
    return (importo / 1000000).toFixed(1) + ' M€';
  }
  return importo.toLocaleString('it-IT') + ' €';
}

/* ============================================================
   HELPER ETICHETTE QUALITATIVE
   Nessun valore numerico interno viene mostrato direttamente al giocatore.
   Le funzioni qui sotto traducono i valori in etichette semantiche.
   ============================================================ */

function _statoUmore(v) {
  return v >= 80 ? 'Eccellente' : v >= 65 ? 'Buono' : v >= 50 ? 'Sufficiente' : v >= 35 ? 'Basso' : 'Critico';
}
function _statoFedelta(v) {
  return v >= 80 ? 'Alta' : v >= 60 ? 'Media' : v >= 40 ? 'Bassa' : 'Molto bassa';
}
function _statoSoddisfazione(v) {
  return v >= 75 ? 'Ottima' : v >= 55 ? 'Buona' : v >= 35 ? 'Sufficiente' : v >= 20 ? 'A rischio' : 'Critica';
}
function _statoStat(v) {
  /* Statistiche piloti e staff (talento, qualifica, gara, ecc.) */
  return v >= 90 ? 'Eccellente' : v >= 82 ? 'Ottimo' : v >= 74 ? 'Buono' : v >= 65 ? 'Sufficiente' : 'Debole';
}
function _statoVisibilita(v) {
  /* visibilitaMediatica e valoreSponsor */
  return v >= 80 ? 'Alta' : v >= 60 ? 'Media' : v >= 40 ? 'Limitata' : 'Bassa';
}
function _statoReputazione(v) {
  /* Sottotipi reputazione, scala 0–10.000 */
  return v >= 7500 ? 'Eccellente' : v >= 5500 ? 'Buona' : v >= 3500 ? 'Nella norma' : v >= 1500 ? 'Limitata' : 'Bassa';
}
/* Formatta data ISO in italiano */
function formatData(dataISO) {
  if (!dataISO) return '—';
  const d = new Date(dataISO);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ============================================================
   STATO UI
   ============================================================ */

let sezioneAttiva = null;
let ultimoFocusAperturaOverlay = null;

/* Mirror dei nomi programma test (usato nel render del report pre-stagionale) */
const PROGRAMMI_TEST_UI = [
  { id: 'raccolta_aero',    nome: 'Raccolta dati aerodinamici' },
  { id: 'raccolta_mec',     nome: 'Raccolta dati meccanici' },
  { id: 'raccolta_pu',      nome: 'Analisi power unit' },
  { id: 'test_mescole',     nome: 'Test mescole e degrado' },
  { id: 'correlazione_cfd', nome: 'Correlazione CFD/pista' },
  { id: 'setup_base',       nome: 'Sviluppo setup baseline' },
  { id: 'sim_gara',         nome: 'Simulazione passo gara' },
  { id: 'alta_velocita',    nome: 'Test alta velocita' }
];

/* ============================================================
   INIZIALIZZAZIONE
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  motore.collegaUI({ annunciaVoiceOver, aggiornaStatusBar });
  motore.collegaAudio(audio);

  /* Safari iOS richiede una user gesture prima di poter creare/riprendere
     un AudioContext. L'attivazione è differita al primo click/touch. */
  document.addEventListener('click', () => { audio.attiva(); }, { once: true, passive: true });
  document.addEventListener('touchstart', () => { audio.attiva(); }, { once: true, passive: true });

  /* Controlla se esiste un salvataggio */
  if (motore.esiste()) {
    el('btn-continua').disabled = false;
  }

  /* Binding pulsanti schermata iniziale */
  el('btn-nuova-partita').addEventListener('click', () => {
    audio.conferma();
    avviaNuovaPartita();
  });

  el('btn-continua').addEventListener('click', () => {
    audio.conferma();
    caricaPartita();
  });

  /* Binding voci menu di gioco */
  document.querySelectorAll('.voce-menu').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.navigazione();
      apriSezione(btn.dataset.sezione);
    });
  });

  /* Binding azioni sessione */
  el('btn-simula-sessione').addEventListener('click', () => {
    audio.conferma();
    simulaSessioneCorrente();
  });

  el('btn-avanza-fase').addEventListener('click', () => {
    audio.navigazione();
    const fase = motore.stato.faseCorrente;
    if (['fp1','fp2','fp3','qualifica','sprint_qualifica','gara','sprint'].includes(fase)) {
      simulaSessioneAuto();
    } else {
      avanzaFase();
    }
  });

  /* Binding dialogo conferma */
  el('btn-conferma-si').addEventListener('click', () => _chiudiDialogo(true));
  el('btn-conferma-no').addEventListener('click', () => _chiudiDialogo(false));

  /* Focus trap e Escape nei pannelli overlay */
  document.addEventListener('keydown', gestisciTastoOverlay);
});

/* ============================================================
   AVVIO E CARICAMENTO PARTITA
   ============================================================ */

function avviaNuovaPartita() {
  const stato = motore.nuovaPartita();
  mostraIntroNuovaPartita(stato);
  audio.inizioSessione();
}

function caricaPartita() {
  const stato = motore.caricaPartita();
  if (!stato) {
    annunciaVoiceOver(DATI.MESSAGGI.erroreCaricamento);
    audio.errore();
    return;
  }
  mostraSchermataDiGioco(stato);
  annunciaVoiceOver('Partita caricata. ' + motore.ottieniNomeSquadra() + ', stagione ' + stato.stagione + '.');
}

/* ============================================================
   LAYOUT SCHERMATA DI GIOCO
   ============================================================ */

function mostraSchermataDiGioco(stato) {
  /* Nascondi schermata iniziale */
  const scInit = el('schermata-iniziale');
  scInit.classList.remove('attiva');
  scInit.setAttribute('aria-hidden', 'true');

  /* Mostra schermata di gioco */
  const scGioco = el('schermata-gioco');
  scGioco.classList.add('attiva');
  scGioco.removeAttribute('aria-hidden');

  /* Adatta menu alla categoria */
  adattaMenuCategoria(stato.categoria);

  /* Aggiorna status bar */
  aggiornaStatusBar(stato);

  /* Riunione informativa AR1 al primo ingresso in AR1 */
  if (stato.categoria === 'AR1' && !stato.riunioneAR1Vista) {
    mostraRiunioneInformativaAR1();
    return;
  }

  /* Router centralizzato: decide la schermata in base a faseCorrente */
  _routerPrincipale();
}

function adattaMenuCategoria(categoria) {
  /* In AR2/AR3: nascondi Tecnica e Relazioni. Economia rimane (versione ridotta). */
  const voceTecnica   = document.getElementById('voce-tecnica-nav');
  const voceRelazioni = document.getElementById('voce-relazioni-nav');
  const nonEAR1 = categoria !== 'AR1';

  if (voceTecnica)   { voceTecnica.style.display   = nonEAR1 ? 'none' : ''; voceTecnica.toggleAttribute('hidden', nonEAR1);   }
  if (voceRelazioni) { voceRelazioni.style.display = nonEAR1 ? 'none' : ''; voceRelazioni.toggleAttribute('hidden', nonEAR1); }

  /* Pannello sviluppo AR2 dentro Operazioni: visibile solo in AR2 */
  const pannelloSviluppoAR2 = document.getElementById('pannello-sviluppo-ar2');
  if (pannelloSviluppoAR2) pannelloSviluppoAR2.classList.toggle('nascosta', categoria !== 'AR2');
}

function aggiornaStatusBar(stato) {
  const s = stato || motore.stato;
  if (!s) return;

  const calendario = motore._ottieniCalendario();
  const roundAttuale = calendario[s.roundCorrente];

  const elCategoria = el('status-categoria');
  const elSquadra = el('status-squadra');
  const elStagione = el('status-stagione');
  const elRound = el('status-round');

  if (elCategoria) {
    elCategoria.textContent = s.categoria || '—';
    elCategoria.setAttribute('aria-label', 'Categoria: ' + (s.categoria || '—'));
  }
  if (elSquadra) {
    const nomeSquadra = motore.ottieniNomeSquadra();
    elSquadra.textContent = nomeSquadra;
    elSquadra.setAttribute('aria-label', 'Squadra: ' + nomeSquadra);
  }
  if (elStagione) {
    elStagione.textContent = 'Stagione ' + (s.stagione || '—');
    elStagione.setAttribute('aria-label', 'Stagione: ' + (s.stagione || '—'));
  }
  if (elRound) {
    const testoRound = roundAttuale
      ? 'Round ' + (s.roundCorrente + 1) + ' — ' + roundAttuale.nome
      : 'Fuori stagione';
    elRound.textContent = testoRound;
    elRound.setAttribute('aria-label', testoRound);
  }
}


/* ============================================================
   NAVIGAZIONE TRA SEZIONI
   ============================================================ */

function apriSezione(nomeSezione) {
  /* Aggiorna stato voce attiva */
  document.querySelectorAll('.voce-menu').forEach(btn => {
    const isAttiva = btn.dataset.sezione === nomeSezione;
    btn.classList.toggle('attiva', isAttiva);
    btn.setAttribute('aria-current', isAttiva ? 'true' : 'false');
  });

  /* Nascondi tutte le sezioni */
  document.querySelectorAll('.sezione-gioco').forEach(s => {
    s.classList.remove('attiva');
    s.setAttribute('aria-hidden', 'true');
  });

  /* Mostra la sezione richiesta */
  const target = el('sezione-' + nomeSezione);
  if (!target) return;
  target.classList.remove('nascosta'); /* difensivo: rimuove eventuale residuo */
  target.classList.add('attiva');
  target.removeAttribute('aria-hidden');

  sezioneAttiva = nomeSezione;

  /* Renderizza il contenuto */
  switch (nomeSezione) {
    case 'operazioni':  renderOperazioni();  break;
    case 'persone':     renderPersone();     break;
    case 'tecnica':     renderTecnica();     break;
    case 'economia':    renderManagement();  break;
    case 'relazioni':   renderRelazioni();   break;
    case 'panorama':    renderPanoramica();  break;
  }

  /* Sposta il focus all'intestazione della sezione.
     iOS Safari può ignorare focus() su elementi non-input: l'annuncio VoiceOver
     via aria-live garantisce che il cambio sezione sia sempre comunicato. */
  const titolo = target.querySelector('.titolo-sezione');
  if (titolo) {
    titolo.setAttribute('tabindex', '-1');
    titolo.focus();
    /* Fallback per iOS: annuncia il titolo indipendentemente dal focus */
    annunciaVoiceOver(titolo.textContent.trim());
  }

  /* Tutorial AR3: prima apertura di sezioni economia e persone */
  const _mapTutorialSezione = { economia: 'sezione-economia', persone: 'sezione-persone' };
  const _chiaveTutorial = _mapTutorialSezione[nomeSezione];
  if (_chiaveTutorial && motore.stato) {
    const _testo = motore.ottieniTestoTutorial(_chiaveTutorial);
    if (_testo) mostraTutorial(_testo, _chiaveTutorial);
  }
}

/* ============================================================
   RENDER SEZIONE: OPERAZIONI
   ============================================================ */

function renderOperazioni() {
  const stato = motore.stato;

  /* Difensivo: se il router ci manda qui con una fase che non è di weekend,
     re-instrada senza mostrare nulla di sbagliato. */
  const FASI_WEEKEND = new Set(['briefing','fp1','fp2','fp3','qualifica','sprint_qualifica','sprint','gara']);
  if (!FASI_WEEKEND.has(stato.faseCorrente)) {
    _routerPrincipale();
    return;
  }

  const calendario = motore._ottieniCalendario();
  const roundCorrente = calendario[stato.roundCorrente];

  /* Pannelli aggiuntivi AR1: storico, strategia gomme, logistica */
  if (stato.categoria === 'AR1') {
    mostraStoricoRisultati();
    mostraStrategiaGomme(roundCorrente);
    mostraLogistica();
    /* Mostra pannello logistica e storico */
    const pannelloStorico = el('pannello-storico-risultati');
    if (pannelloStorico) pannelloStorico.classList.remove('nascosta');
    const pannelloLog = el('pannello-logistica');
    if (pannelloLog) pannelloLog.classList.remove('nascosta');
  } else {
    /* Nascondi pannelli solo AR1 */
    const pannelloStorico = el('pannello-storico-risultati');
    if (pannelloStorico) pannelloStorico.classList.add('nascosta');
    const pannelloLog = el('pannello-logistica');
    if (pannelloLog) pannelloLog.classList.add('nascosta');

    /* In AR2: mostra e popola il pannello sviluppo tecnico */
    if (stato.categoria === 'AR2') {
      const pannelloSviluppoAR2 = el('pannello-sviluppo-ar2');
      if (pannelloSviluppoAR2) {
        pannelloSviluppoAR2.classList.remove('nascosta');
        _renderSviluppoAR2();
      }
    }
  }

  /* Pannello prossimo evento */
  const contenutoProssimo = el('contenuto-prossimo-evento');
  if (contenutoProssimo) {
    contenutoProssimo.replaceChildren();
    if (!roundCorrente) {
      contenutoProssimo.appendChild(crea('p', {}, 'Stagione conclusa. In attesa della nuova stagione.'));
    } else {
      const card = crea('div', { class: 'card' });
      const intestazione = crea('div', { class: 'card-intestazione' });
      intestazione.appendChild(crea('h3', {}, roundCorrente.nome));
      const data = crea('span', { class: 'card-etichetta' }, formatData(roundCorrente.data));
      intestazione.appendChild(data);
      card.appendChild(intestazione);

      /* Badge sprint */
      if (roundCorrente.sprint) {
        const badge = crea('span', { class: 'badge-sprint', 'aria-label': 'Weekend sprint' }, 'SPRINT');
        card.appendChild(badge);
      }

      /* Pulsanti azione — PRIMA del contenuto (regola accessibilità).
         All'inizio del weekend (briefing) offri la scelta Gioca/Salta una volta sola.
         A weekend già avviato mostra solo Accedi alla fase corrente. */
      if (stato.faseCorrente === 'briefing') {
        const gruppoAzioni = crea('div', { class: 'gruppo-azioni margine-sopra' });

        const btnGioca = crea('button', {
          class: 'btn-azione',
          'aria-label': 'Gioca il weekend: partecipa attivamente a tutte le sessioni'
        }, 'Gioca il weekend');
        btnGioca.addEventListener('click', () => {
          audio.inizioSessione();
          apriPannelloSessione();
        });
        gruppoAzioni.appendChild(btnGioca);

        const btnSalta = crea('button', {
          class: 'btn-azione btn-secondario',
          'aria-label': 'Salta il weekend: tutto verrà eseguito in automatico, il gioco passerà direttamente all\'inter-gara'
        }, 'Salta il weekend');
        btnSalta.addEventListener('click', () => {
          audio.navigazione();
          saltaInteroWeekend();
        });
        gruppoAzioni.appendChild(btnSalta);

        card.appendChild(gruppoAzioni);
      } else {
        const btnAccedi = crea('button', {
          class: 'btn-azione margine-sopra',
          'aria-label': 'Accedi alla fase ' + _nomeFase(stato.faseCorrente)
        }, 'Accedi → ' + _nomeFase(stato.faseCorrente));
        btnAccedi.addEventListener('click', () => {
          audio.inizioSessione();
          apriPannelloSessione();
        });
        card.appendChild(btnAccedi);
      }

      /* Dati circuito */
      const dl = crea('dl', { class: 'lista-dati margine-sopra' });
      const vociCircuito = [
        ['Circuito', roundCorrente.circuito],
        ['Paese', roundCorrente.paese],
        ['Lunghezza', (roundCorrente.lunghezza / 1000).toFixed(3) + ' km'],
        ['Giri', roundCorrente.giri],
        ['Carico aero', roundCorrente.caricoAero],
        ['Usura gomme', roundCorrente.usuraGomme]
      ];
      vociCircuito.forEach(([chiave, valore]) => {
        dl.appendChild(crea('dt', {}, chiave));
        dl.appendChild(crea('dd', {}, String(valore)));
      });
      card.appendChild(dl);

      /* Mescole del weekend */
      const titoloMescole = crea('p', { class: 'margine-sopra', style: 'color: var(--testo-secondario); font-size: var(--dim-piccolo);' }, 'Mescole assegnate:');
      card.appendChild(titoloMescole);
      const gruppoMescole = crea('div', { style: 'display: flex; gap: 8px; margin-top: 4px;' });
      roundCorrente.mescole.forEach(m => {
        const mescola = DATI.MESCOLE[m];
        const badge = crea('span', {
          class: `badge-mescola mescola-${m}`,
          'aria-label': mescola ? mescola.nome : m
        }, m);
        gruppoMescole.appendChild(badge);
      });
      card.appendChild(gruppoMescole);

      /* Fase corrente */
      const faseLabel = crea('p', {
        class: 'margine-sopra',
        style: 'color: var(--colore-operazioni); font-weight: 600;'
      }, 'Fase corrente: ' + _nomeFase(stato.faseCorrente));
      card.appendChild(faseLabel);

      contenutoProssimo.appendChild(card);
    }
  }

  /* Pannello calendario */
  const contenutoCalendario = el('contenuto-calendario');
  if (contenutoCalendario) {
    contenutoCalendario.replaceChildren();
    const lista = crea('ul', { class: 'lista-classifica', 'aria-label': 'Calendario stagionale completo' });
    calendario.forEach((circuito, idx) => {
      const li = crea('li', {});
      const card = crea('div', {
        class: 'scheda-circuito' +
          (idx === stato.roundCorrente ? ' round-corrente' : '') +
          (idx < stato.roundCorrente ? ' round-completato' : ''),
        'aria-label': `Round ${circuito.round}: ${circuito.nome}, ${formatData(circuito.data)}${circuito.sprint ? ', weekend sprint' : ''}`
      });

      const intestazione = crea('div', { class: 'intestazione-circuito' });
      const nomeGara = crea('span', { class: 'nome-circuito' }, circuito.nome);
      intestazione.appendChild(nomeGara);
      if (circuito.sprint) {
        /* aria-hidden: l'informazione è già annunciata dall'aria-label della card */
        intestazione.appendChild(crea('span', { class: 'badge-sprint', 'aria-hidden': 'true' }, 'SPRINT'));
      }
      card.appendChild(intestazione);
      card.appendChild(crea('span', { class: 'data-circuito' }, formatData(circuito.data)));

      li.appendChild(card);
      lista.appendChild(li);
    });
    contenutoCalendario.appendChild(lista);
  }
}

function _nomeFase(fase) {
  const nomi = {
    'briefing': 'Briefing pre-weekend',
    'fp1': 'Prove Libere 1',
    'fp2': 'Prove Libere 2',
    'fp3': 'Prove Libere 3',
    'qualifica': 'Qualifiche',
    'sprint_qualifica': 'Qualifiche Sprint',
    'sprint': 'Sprint Race',
    'gara': 'Gara',
    'post-gara': 'Conferenza stampa post-gara',
    'inter-gara': 'Tra un weekend e l\'altro',
    'pausa_estiva': 'Pausa estiva',
    'pausa_invernale': 'Pausa invernale'
  };
  return nomi[fase] || fase || '—';
}

/* ============================================================
   RENDER SEZIONE: PERSONE
   ============================================================ */

/* ============================================================
   NAVIGAZIONE SOTTOSEZIONI PERSONALE
   ============================================================ */

function _apriPannelloPersonale(nomePannello) {
  document.querySelectorAll('.btn-sub-personale').forEach(btn => {
    const isAttivo = btn.dataset.pannelloPersonale === nomePannello;
    btn.classList.toggle('attivo', isAttivo);
    btn.setAttribute('aria-pressed', isAttivo ? 'true' : 'false');
  });

  ['piloti', 'staff', 'academy', 'mercato'].forEach(id => {
    const pannello = el('pannello-' + id);
    if (!pannello) return;
    pannello.classList.toggle('nascosta', id !== nomePannello);
  });

  switch (nomePannello) {
    case 'piloti':  _renderPannelloPiloti();  break;
    case 'staff':   _renderPannelloStaff();   break;
    case 'academy': _renderPannelloAcademy(); break;
    case 'mercato': _renderPannelloMercato(); break;
  }
}

function renderPersone() {
  const stato = motore.stato;

  /* Binding sub-nav (una volta sola) */
  const nav = el('nav-sub-personale');
  if (nav && !nav.dataset.bound) {
    nav.dataset.bound = '1';
    nav.querySelectorAll('.btn-sub-personale').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.navigazione();
        _apriPannelloPersonale(btn.dataset.pannelloPersonale);
      });
    });
  }

  /* Mostra/nascondi schede non applicabili */
  const btnAcademy = nav?.querySelector('[data-pannello-personale="academy"]');
  if (btnAcademy) btnAcademy.style.display = stato.categoria === 'AR1' ? '' : 'none';

  /* Renderizza il pannello correntemente attivo */
  const pannelloAttivo = nav?.querySelector('.btn-sub-personale.attivo')?.dataset?.pannelloPersonale || 'piloti';
  _apriPannelloPersonale(pannelloAttivo);
}

/* ----------------------------------------------------------
   PANNELLO 1 — PILOTI
---------------------------------------------------------- */

function _renderPannelloPiloti() {
  const stato = motore.stato;
  const contenuto = el('contenuto-piloti');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const piloti = stato.piloti || [];
  if (piloti.length === 0) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessun pilota disponibile.'));
    return;
  }

  piloti.forEach(pilota => {
    const scheda = crea('div', {
      class: 'scheda-pilota',
      role: 'article',
      'aria-label': `${pilota.nome}, ${pilota.nazionalita}, età ${pilota.eta}`
    });

    /* Intestazione */
    const intestazione = crea('div', { class: 'intestazione-pilota' });
    intestazione.appendChild(crea('span', { class: 'nome-pilota' }, pilota.nome));
    const destra = crea('div', { class: 'intestazione-pilota-destra' });
    if (pilota.numero) {
      destra.appendChild(crea('span', { class: 'numero-pilota', 'aria-label': 'Numero ' + pilota.numero }, '#' + pilota.numero));
    }
    if (pilota.traiettoria) {
      const badge = { crescita: '↑', stabile: '→', declino: '↓' }[pilota.traiettoria] || '';
      const classe = { crescita: 'badge-crescita', stabile: 'badge-stabile', declino: 'badge-declino' }[pilota.traiettoria] || '';
      destra.appendChild(crea('span', {
        class: 'badge-traiettoria ' + classe,
        'aria-label': 'Traiettoria: ' + pilota.traiettoria
      }, badge + ' ' + pilota.traiettoria));
    }
    intestazione.appendChild(destra);
    scheda.appendChild(intestazione);

    /* Info base */
    scheda.appendChild(crea('p', { class: 'nazionalita-pilota' },
      (pilota.nazionalita || '—') + ' · Età ' + (pilota.eta || '—')
    ));

    /* Badge infortunio */
    if (pilota.infortunato) {
      const riserva = motore.ottieniPilotaRiserva();
      const mancanti = Math.max(0, (pilota.roundRitorno || 0) - stato.roundCorrente);
      const testoRientro = mancanti > 0
        ? `Rientra tra ${mancanti} round (round ${pilota.roundRitorno})`
        : 'Recupero in corso';
      const avviso = crea('div', {
        class: 'card-avviso margine-sopra',
        role: 'alert',
        'aria-label': `${pilota.nome} è infortunato. ${testoRientro}.${riserva ? ' In sostituzione: ' + riserva.nome + '.' : ''}`
      });
      avviso.appendChild(crea('p', { class: 'testo-avviso' }, 'Infortunato — ' + testoRientro));
      if (riserva) {
        avviso.appendChild(crea('p', {}, 'In sostituzione: ' + riserva.nome));
      }
      scheda.appendChild(avviso);
    }

    /* Contratto */
    if (pilota.contratto) {
      const fedeltà = pilota.fedeltà || 50;
      const sconto = motore.scontoDaFedeltà(fedeltà);
      const stipendioBase = pilota.contratto.stipendio;
      const dl = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Dati contratto ' + pilota.nome });
      [
        ['Scadenza contratto', pilota.contratto.scadenza],
        ['Stipendio corrente', formatMoneta(stipendioBase) + '/anno'],
        ['Fedeltà alla squadra', _statoFedelta(fedeltà) + (sconto > 0 ? ' — sconto rinnovo stimato: −' + Math.round(sconto * 100) + '%' : '')],
      ].forEach(([k, v]) => {
        dl.appendChild(crea('dt', {}, k));
        dl.appendChild(crea('dd', {}, String(v)));
      });
      scheda.appendChild(dl);

      /* Barra fedeltà */
      const rigaFed = crea('div', { class: 'riga-performance margine-sopra' });
      rigaFed.appendChild(crea('span', { class: 'etichetta-performance' }, 'Fedeltà'));
      const statoFedP = _statoFedelta(fedeltà);
      const barraFed = crea('div', { class: 'barra-performance barra-fedeltà', role: 'progressbar', 'aria-valuenow': fedeltà, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Fedeltà: ' + statoFedP });
      const riempFed = crea('div', { class: 'riempimento-fedeltà' });
      riempFed.style.width = fedeltà + '%';
      barraFed.appendChild(riempFed);
      rigaFed.appendChild(barraFed);
      rigaFed.appendChild(crea('span', { class: 'valore-performance' }, statoFedP));
      scheda.appendChild(rigaFed);
    }

    /* Umore */
    const umore = pilota.umore || 50;
    const statoUmoreP = _statoUmore(umore);
    const rigaUmore = crea('div', { class: 'riga-performance margine-sopra' });
    rigaUmore.appendChild(crea('span', { class: 'etichetta-performance' }, 'Umore'));
    const barraUmore = crea('div', { class: 'barra-performance', role: 'progressbar', 'aria-valuenow': umore, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Umore: ' + statoUmoreP });
    const riempUmore = crea('div', { class: 'riempimento-umore' });
    riempUmore.style.width = umore + '%';
    barraUmore.appendChild(riempUmore);
    rigaUmore.appendChild(barraUmore);
    rigaUmore.appendChild(crea('span', { class: 'valore-performance' }, statoUmoreP));
    scheda.appendChild(rigaUmore);

    /* Statistiche AR1 (qualitative) */
    if (stato.categoria === 'AR1' && pilota.statistiche) {
      const cardStat = crea('div', { class: 'card-stat-pilota margine-sopra' });
      const stat = pilota.statistiche;
      [
        ['Talento', stat.talento],
        ['Qualifica', stat.qualifica],
        ['Gara', stat.gara],
        ['Bagnato', stat.bagnato],
        ['Gestione gomme', stat.gestione]
      ].forEach(([nome, val]) => {
        const cat = _statoStat(val);
        const riga = crea('div', { class: 'riga-stat-pilota' });
        riga.appendChild(crea('span', { class: 'nome-stat-pilota' }, nome));
        riga.appendChild(crea('span', { class: 'valore-stat-pilota stat-' + cat.toLowerCase(), 'aria-label': nome + ': ' + cat }, cat));
        cardStat.appendChild(riga);
      });
      /* Talent delta — rendimento rispetto alla macchina */
      const delta = motore.ottieniDeltaPrestazionePilota?.(pilota.id);
      if (delta) {
        const rigaDelta = crea('div', { class: 'riga-stat-pilota margine-sopra' });
        rigaDelta.appendChild(crea('span', { class: 'nome-stat-pilota' }, 'Rendimento vs vettura'));
        rigaDelta.appendChild(crea('span', {
          class: 'valore-stat-pilota stat-' + (delta.segno === 'positivo' ? 'buono' : delta.segno === 'negativo' ? 'debole' : 'sufficiente'),
          'aria-label': 'Rendimento rispetto alla vettura: ' + delta.label
        }, delta.label));
        cardStat.appendChild(rigaDelta);
      }
      scheda.appendChild(cardStat);

      /* Visibilità mediatica e valore sponsor */
      if (pilota.visibilitaMediatica || pilota.valoreSponsor) {
        const dl2 = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Dati marketing ' + pilota.nome });
        [
          ['Visibilità mediatica', _statoVisibilita(pilota.visibilitaMediatica || 0)],
          ['Valore sponsor', _statoVisibilita(pilota.valoreSponsor || 0)]
        ].forEach(([k, v]) => {
          dl2.appendChild(crea('dt', {}, k));
          dl2.appendChild(crea('dd', {}, String(v)));
        });
        scheda.appendChild(dl2);
      }
    }

    contenuto.appendChild(scheda);
  });
}

/* ----------------------------------------------------------
   PANNELLO 2 — STAFF
---------------------------------------------------------- */

function _renderPannelloStaff() {
  const stato = motore.stato;
  const contenuto = el('contenuto-staff');
  if (!contenuto) return;
  contenuto.replaceChildren();

  if (stato.categoria === 'AR1') {
    _renderStaffAR1(contenuto, stato.staff || {});
  } else {
    _renderStaffRidotto(contenuto, stato);
  }
}

function _renderStaffAR1(contenuto, staff) {
  /* Figure principali */
  const figurePrincipali = [
    { key: 'capoIngegnere',       titolo: 'Capo Ingegnere',               ruoloDesc: 'Coordina i tre Direttori Design. Determinante nei cambi d\'era regolamentare.' },
    { key: 'direttoreAero',       titolo: 'Dir. Design Aerodinamico',     ruoloDesc: 'Responsabile del dipartimento aerodinamica.' },
    { key: 'direttoreMeccanica',  titolo: 'Dir. Design Meccanico',        ruoloDesc: 'Responsabile di sospensioni, idraulica e cockpit.' },
    { key: 'direttoreElettronica',titolo: 'Dir. Design Elettronica',      ruoloDesc: 'Responsabile software, MGU-K, MGU-H e sistemi elettronici.' },
    { key: 'direttoreGara',       titolo: 'Direttore di Gara',            ruoloDesc: 'Supervisiona pit stop, gestione gomme e coperte termiche.' },
    { key: 'dataAnalyst',         titolo: 'Data Analyst Senior',          ruoloDesc: 'Elabora i dati FP e produce stime di performance.' }
  ];

  const nomiStat = {
    coordinamento: 'Coordinamento', strategia: 'Visione strategica', esperienza: 'Esperienza',
    innovazione: 'Innovazione', precisione: 'Precisione',
    pitStop: 'Gestione pit stop', gestioneGomme: 'Gestione gomme',
    velocita: 'Velocità analisi', sintesi: 'Sintesi dati',
    comunicazione: 'Comunicazione', carisma: 'Carisma',
    fitness: 'Preparazione fisica', recupero: 'Gestione recupero',
    efficienza: 'Efficienza operativa', negoziazione: 'Negoziazione', relazioni: 'Relazioni'
  };

  const titoloP = crea('p', { class: 'card-etichetta' }, 'Figure principali');
  contenuto.appendChild(titoloP);

  figurePrincipali.forEach(({ key, titolo, ruoloDesc }) => {
    const membro = staff[key];
    if (!membro) return;

    const card = crea('div', {
      class: 'scheda-staff',
      role: 'article',
      'aria-label': `${titolo}: ${membro.nome}`
    });

    const intestazione = crea('div', { class: 'intestazione-staff' });
    intestazione.appendChild(crea('span', { class: 'nome-staff' }, membro.nome));
    intestazione.appendChild(crea('span', { class: 'ruolo-staff' }, titolo));
    card.appendChild(intestazione);

    card.appendChild(crea('p', { class: 'descrizione-ruolo-staff' }, ruoloDesc));

    if (membro.statistiche) {
      const dl = crea('dl', { class: 'lista-stat-staff' });
      Object.entries(membro.statistiche).forEach(([k, v]) => {
        const nome = nomiStat[k] || k;
        const cat = v >= 90 ? 'Eccellente' : v >= 82 ? 'Ottimo' : v >= 74 ? 'Buono' : v >= 64 ? 'Sufficiente' : 'Debole';
        dl.appendChild(crea('dt', {}, nome));
        dl.appendChild(crea('dd', {
          class: 'stat-staff stat-' + cat.toLowerCase(),
          'aria-label': nome + ': ' + cat
        }, cat));
      });
      card.appendChild(dl);
    }

    if (membro.contratto) {
      const stagione = motore.stato.stagione;
      const scad     = membro.contratto.scadenza;
      const scadoOra = scad <= stagione;
      const scadePross = scad === stagione + 1;
      const classeContr = scadoOra ? 'testo-avviso' : scadePross ? 'testo-attenzione' : 'card-etichetta';
      const testoContr  = scadoOra
        ? `Contratto scaduto · Rinnova nella pausa invernale`
        : scadePross
          ? `Contratto fino al ${scad} · Scade a fine stagione · ${formatMoneta(membro.contratto.stipendio)}/anno`
          : `Contratto fino al ${scad} · ${formatMoneta(membro.contratto.stipendio)}/anno`;
      card.appendChild(crea('p', { class: classeContr, role: scadoOra ? 'alert' : undefined }, testoContr));
    }

    contenuto.appendChild(card);
  });

  /* Figure minori */
  const figureMinori = [
    { key: 'direttoreLogistica',          titolo: 'Direttore Logistica' },
    { key: 'responsabileHospitality',     titolo: 'Responsabile Hospitality' },
    { key: 'responsabileRelazioni',       titolo: 'Resp. Relazioni Istituzionali' },
    { key: 'socialMediaManager',          titolo: 'Social Media Manager' },
    { key: 'preparatoreAtletico',         titolo: 'Preparatore Atletico' },
    { key: 'responsabileDatiTelemetria',  titolo: 'Responsabile Dati e Telemetria' },
    { key: 'coordinatoreOperativo',       titolo: 'Coordinatore Operativo' },
    { key: 'responsabileComunicazione',   titolo: 'Resp. Comunicazione Tecnica' }
  ];

  const minoriPresenti = figureMinori.filter(f => staff[f.key]);
  if (minoriPresenti.length > 0) {
    const titoloM = crea('p', { class: 'card-etichetta margine-sopra' }, 'Figure operative');
    contenuto.appendChild(titoloM);

    minoriPresenti.forEach(({ key, titolo }) => {
      const membro = staff[key];
      const riga = crea('div', { class: 'riga-staff-minore', role: 'listitem', 'aria-label': titolo + ': ' + membro.nome });
      riga.appendChild(crea('span', { class: 'nome-staff-minore' }, membro.nome));
      riga.appendChild(crea('span', { class: 'ruolo-staff-minore' }, titolo));
      /* Dettaglio speciale per Direttore Logistica: mostra risparmio atteso */
      if (key === 'direttoreLogistica') {
        const eff      = membro.statistiche?.efficienza || 65;
        const costoBase = 480000;
        const costoEff  = Math.round(costoBase * (1.4 - (eff / 100) * 0.8));
        const costoMedio = Math.round(costoBase * (1.4 - 0.65 * 0.8));
        const risparmio  = costoMedio - costoEff;
        const note = `Efficienza ${eff}% · Costo stimato ${formatMoneta(costoEff)}/trasferta` +
          (risparmio > 0 ? ` · Risparmio vs media: −${formatMoneta(risparmio)}` : '');
        riga.appendChild(crea('span', { class: 'nota-staff-minore' }, note));
      }
      contenuto.appendChild(riga);
    });
  }
}

function _renderStaffRidotto(contenuto, stato) {
  /* AR3/AR2: poche figure chiave */
  const voci = [
    { label: 'Capo Ingegnere', valore: stato.staff?.capoIngegnere?.nome || '—' },
    { label: 'Ingegnere di Gara', valore: stato.staff?.direttoreGara?.nome || '—' },
    { label: 'Preparatore Atletico', valore: stato.staff?.preparatoreAtletico?.nome || '—' }
  ];
  const card = crea('div', { class: 'card' });
  const dl = crea('dl', { class: 'lista-dati' });
  voci.forEach(({ label, valore }) => {
    dl.appendChild(crea('dt', {}, label));
    dl.appendChild(crea('dd', {}, valore));
  });
  card.appendChild(dl);
  contenuto.appendChild(card);
}

/* ----------------------------------------------------------
   PANNELLO 3 — ACADEMY (solo AR1)
---------------------------------------------------------- */

function _renderPannelloAcademy() {
  const stato = motore.stato;
  const contenuto = el('contenuto-academy');
  if (!contenuto) return;
  contenuto.replaceChildren();

  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Academy disponibile solo in AR1.'));
    return;
  }

  /* Pilota di riserva */
  const riserva = motore.ottieniPilotaRiserva();
  const cardRiserva = crea('div', { class: 'card' });
  cardRiserva.appendChild(crea('p', { class: 'card-etichetta' }, 'Pilota di riserva'));

  if (riserva) {
    const intestazione = crea('div', { class: 'intestazione-pilota' });
    intestazione.appendChild(crea('span', { class: 'nome-pilota' }, riserva.nome));
    if (riserva.dallaAcademy) {
      intestazione.appendChild(crea('span', { class: 'badge-academy', 'aria-label': 'Proveniente dall\'academy' }, 'Academy'));
    }
    cardRiserva.appendChild(intestazione);

    cardRiserva.appendChild(crea('p', { class: 'nazionalita-pilota' },
      (riserva.nazionalita || '—') + ' · Età ' + (riserva.eta || '—')
    ));

    if (riserva.contratto) {
      cardRiserva.appendChild(crea('p', { class: 'card-etichetta' },
        `Contratto: scadenza ${riserva.contratto.scadenza} · ${formatMoneta(riserva.contratto.stipendio)}/anno`
      ));
    }

    /* Fedeltà */
    const fedeltà = riserva.fedeltà || 50;
    const sconto = motore.scontoDaFedeltà(fedeltà);
    const rigaFed = crea('div', { class: 'riga-performance margine-sopra' });
    rigaFed.appendChild(crea('span', { class: 'etichetta-performance' }, 'Fedeltà'));
    const statoFedR = _statoFedelta(fedeltà);
    const barraFed = crea('div', { class: 'barra-performance barra-fedeltà', role: 'progressbar', 'aria-valuenow': fedeltà, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Fedeltà: ' + statoFedR });
    const riempFed = crea('div', { class: 'riempimento-fedeltà' });
    riempFed.style.width = fedeltà + '%';
    barraFed.appendChild(riempFed);
    rigaFed.appendChild(barraFed);
    rigaFed.appendChild(crea('span', { class: 'valore-performance' }, statoFedR));
    cardRiserva.appendChild(rigaFed);

    if (sconto > 0) {
      cardRiserva.appendChild(crea('p', { class: 'nota-tecnica' },
        `Fedeltà alta: sconto stimato del ${Math.round(sconto * 100)}% sulle richieste contrattuali future.`
      ));
    }
  } else {
    cardRiserva.appendChild(crea('p', {}, 'Nessun pilota di riserva contrattualizzato.'));
  }
  contenuto.appendChild(cardRiserva);

  /* Talenti Academy */
  const talenti = motore.ottieniAcademy();
  const cardAcademy = crea('div', { class: 'card margine-sopra' });
  cardAcademy.appendChild(crea('p', { class: 'card-etichetta' }, 'Giovani talenti in sviluppo'));

  if (talenti.length === 0) {
    cardAcademy.appendChild(crea('p', {}, 'Nessun talento academy registrato.'));
  } else {
    talenti.forEach(t => {
      const scheda = crea('div', { class: 'scheda-talento-academy', role: 'article', 'aria-label': t.nome + ', ' + t.nazionalita + ', età ' + t.eta });

      const intestazione = crea('div', { class: 'intestazione-pilota' });
      intestazione.appendChild(crea('span', { class: 'nome-pilota' }, t.nome));
      const badgeCat = crea('span', { class: 'badge-categoria-academy', 'aria-label': 'Categoria attuale: ' + t.categoriaAttuale }, t.categoriaAttuale);
      intestazione.appendChild(badgeCat);
      scheda.appendChild(intestazione);

      scheda.appendChild(crea('p', { class: 'nazionalita-pilota' },
        (t.nazionalita || '—') + ' · Età ' + t.eta
      ));

      const dl = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Dati sviluppo ' + t.nome });
      [
        ['Livello attuale', _statoStat(t.livelloCorrente)],
        ['Potenziale stimato', _statoStat(t.potenziale)],
        ['Stagioni in sviluppo', t.stagioneSviluppo],
        ['Fedeltà alla squadra', _statoFedelta(t.fedeltà)]
      ].forEach(([k, v]) => {
        dl.appendChild(crea('dt', {}, k));
        dl.appendChild(crea('dd', {}, String(v)));
      });
      scheda.appendChild(dl);

      /* Barra potenziale vs livello corrente */
      const rigaPot = crea('div', { class: 'riga-performance margine-sopra' });
      rigaPot.appendChild(crea('span', { class: 'etichetta-performance' }, 'Sviluppo'));
      const livelloLabel = _statoStat(t.livelloCorrente);
      const potenzialeLabel = _statoStat(t.potenziale);
      const barraPot = crea('div', { class: 'barra-performance', role: 'progressbar', 'aria-valuenow': t.livelloCorrente, 'aria-valuemin': '0', 'aria-valuemax': t.potenziale, 'aria-label': `Sviluppo: ${livelloLabel} verso potenziale ${potenzialeLabel}` });
      const riempPot = crea('div', { class: 'riempimento-performance' });
      riempPot.style.width = Math.round((t.livelloCorrente / t.potenziale) * 100) + '%';
      barraPot.appendChild(riempPot);
      rigaPot.appendChild(barraPot);
      rigaPot.appendChild(crea('span', { class: 'valore-performance' }, livelloLabel + ' → ' + potenzialeLabel));
      scheda.appendChild(rigaPot);

      cardAcademy.appendChild(scheda);
    });
  }
  contenuto.appendChild(cardAcademy);

  /* Nota fedeltà promossi */
  contenuto.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    'I piloti promossi dalla tua academy in AR1 partono con fedeltà elevata (80+) e richiedono contratti più favorevoli rispetto ai piloti acquisiti dal mercato.'
  ));
}

/* ----------------------------------------------------------
   PANNELLO 4 — MERCATO
---------------------------------------------------------- */

function _renderPannelloMercato() {
  const stato = motore.stato;
  const contenuto = el('contenuto-mercato');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const mercato = motore.ottieniStatoMercato();

  /* Box stato mercato */
  const boxStato = crea('div', { class: mercato.aperto ? 'box-risorse' : 'box-mercato-chiuso', role: 'region', 'aria-label': 'Stato mercato' });
  boxStato.appendChild(crea('p', { class: mercato.aperto ? 'box-risorse-titolo' : 'card-etichetta' },
    mercato.aperto ? 'Mercato aperto — Pausa invernale' : 'Mercato chiuso'
  ));
  boxStato.appendChild(crea('p', {},
    mercato.aperto
      ? 'Il mercato è attivo. Puoi avviare o concludere trattative per piloti e staff.'
      : 'Il mercato apre durante la pausa invernale. In stagione sono disponibili solo i dati di contratto.'
  ));
  contenuto.appendChild(boxStato);

  /* Contratti in scadenza (urgenti: scadono questa stagione o già scaduti) */
  const inScadenza = [...(mercato.pilotiInScadenza || []), ...(mercato.staffInScadenza || [])];
  if (inScadenza.length > 0) {
    const cardScadenza = crea('div', { class: 'card margine-sopra', role: 'alert' });
    cardScadenza.appendChild(crea('p', { class: 'card-etichetta' }, 'Contratti in scadenza — da rinnovare nella pausa invernale'));
    inScadenza.forEach(p => {
      const riga = crea('div', { class: 'riga-contratto-scadenza' });
      riga.appendChild(crea('span', { class: 'nome-staff' }, p.nome));
      riga.appendChild(crea('span', { class: 'testo-avviso' }, 'Scade stagione ' + (p.contratto?.scadenza || stato.stagione)));
      cardScadenza.appendChild(riga);
    });
    contenuto.appendChild(cardScadenza);
  }

  /* Contratti in pre-scadenza (scadono la prossima stagione) */
  const preScadenza = mercato.staffPreScadenza || [];
  if (preScadenza.length > 0) {
    const cardPre = crea('div', { class: 'card margine-sopra' });
    cardPre.appendChild(crea('p', { class: 'card-etichetta' }, 'Contratti in scadenza — stagione ' + (stato.stagione + 1)));
    preScadenza.forEach(p => {
      const riga = crea('div', { class: 'riga-contratto-scadenza' });
      riga.appendChild(crea('span', { class: 'nome-staff' }, p.nome));
      riga.appendChild(crea('span', { class: 'testo-attenzione' }, 'Scade stagione ' + (p.contratto?.scadenza)));
      cardPre.appendChild(riga);
    });
    contenuto.appendChild(cardPre);
  }

  /* ── SEZIONE AR2/AR3: delta ottimizzazione + mercato piloti ── */
  if (stato.categoria === 'AR2' || stato.categoria === 'AR3') {
    /* Indicatore delta ottimizzazione */
    const delta = stato.deltaOttimizzazione || 0;
    const cardDelta = crea('div', { class: 'card margine-sopra',
      'aria-label': `Indice di ottimizzazione: ${delta} su 10` });
    cardDelta.appendChild(crea('h3', {}, 'Indice di ottimizzazione'));
    cardDelta.appendChild(crea('p', { class: 'nota-tecnica' },
      'Misura la qualità delle decisioni strategiche durante la stagione. Influenza le promozioni di categoria' +
      (stato.categoria === 'AR2' ? ' e le offerte da squadre AR1.' : '.')));
    const rigaDelta = crea('div', { class: 'riga-performance margine-sopra' });
    const colDelta = delta >= 7 ? 'var(--colore-tecnica)' : delta >= 4 ? 'var(--colore-economia)' : 'var(--colore-operazioni)';
    rigaDelta.appendChild(crea('span', { class: 'etichetta-performance' },
      delta >= 7 ? 'Eccellente' : delta >= 4 ? 'Buono' : delta >= 2 ? 'Nella norma' : 'Da migliorare'));
    const barraDelta = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': delta, 'aria-valuemin': '0', 'aria-valuemax': '10',
      'aria-label': `Indice ottimizzazione: ${delta} su 10` });
    const riempDelta = crea('div', { class: 'riempimento-performance' });
    riempDelta.style.width = (delta * 10) + '%';
    riempDelta.style.backgroundColor = colDelta;
    barraDelta.appendChild(riempDelta);
    rigaDelta.appendChild(barraDelta);
    rigaDelta.appendChild(crea('span', { class: 'valore-performance' }, delta + ' / 10'));
    cardDelta.appendChild(rigaDelta);
    /* Soglia promozione con delta */
    const sogliaDelta = stato.categoria === 'AR3' ? 6 : 7;
    const testoDelta = delta >= sogliaDelta
      ? `Indice sufficiente per la promozione anche dalla posizione limite.`
      : `Servono ${sogliaDelta - delta} punti aggiuntivi per la promozione con indice alto.`;
    cardDelta.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, testoDelta));
    contenuto.appendChild(cardDelta);

    /* Mercato piloti (solo pausa invernale) */
    const mercatoPiloti = motore.ottieniMercatoPilotiAR2AR3 ? motore.ottieniMercatoPilotiAR2AR3() : null;
    if (mercatoPiloti?.aperto) {
      _renderMercatoPilotiAR2AR3(contenuto, mercatoPiloti, stato);
    }

    /* Sezione offerte AR1 (solo AR2) */
    if (stato.categoria === 'AR2') {
      const offerte = motore.ottieniOfferteAR1 ? motore.ottieniOfferteAR1() : (stato.offerteAR1 || []);
      const cardOfferte = crea('div', { class: 'card margine-sopra' });
      cardOfferte.appendChild(crea('h3', {}, 'Proposte da squadre AR1'));
      if (offerte.length > 0) {
        cardOfferte.appendChild(crea('p', {}, 'Hai ricevuto contatti da squadre di AR1 interessate al tuo profilo.'));
        offerte.forEach(offerta => {
          const cardOff = crea('div', { class: 'scheda-pilota margine-sopra' });
          const intest = crea('div', { class: 'intestazione-pilota' });
          intest.appendChild(crea('span', { class: 'nome-pilota' }, offerta.squadraNome || offerta.nomeSquadra || ''));
          intest.appendChild(crea('span', { class: 'nazionalita-pilota' }, offerta.ruolo || 'Team Principal'));
          cardOff.appendChild(intest);
          const roundRim = Math.max(0, (offerta.scadenzaRound || 0) - (stato.roundCorrente || 0));
          cardOff.appendChild(crea('p', { class: 'nota-tecnica' },
            `Offerta valida per ${roundRim} round. Accettare implica la promozione a fine stagione se le condizioni sono soddisfatte.`));
          const btnRifiuta = crea('button', {
            class: 'btn-secondario margine-sopra',
            'aria-label': `Rifiuta offerta di ${offerta.squadraNome || 'squadra AR1'}`
          }, 'Rifiuta offerta');
          btnRifiuta.addEventListener('click', () => {
            motore.rifiutaOffertaAR1?.(offerta.squadraId);
            annunciaVoiceOver(`Offerta di ${offerta.squadraNome || 'squadra AR1'} rifiutata.`);
            _renderPannelloMercato();
          });
          cardOff.appendChild(btnRifiuta);
          cardOfferte.appendChild(cardOff);
        });
      } else {
        cardOfferte.appendChild(crea('p', {}, 'Nessuna proposta ricevuta al momento.'));
      }
      contenuto.appendChild(cardOfferte);
    }
    return;
  }

  /* ── AR1: riepilogo contratti attivi + sondaggi in-season ── */
  if (stato.categoria === 'AR1') {
    const cardRiepilogo = crea('div', { class: 'card margine-sopra' });
    cardRiepilogo.appendChild(crea('p', { class: 'card-etichetta' }, 'Contratti attivi'));
    (stato.piloti || []).forEach(p => {
      if (!p.contratto) return;
      const riga = crea('div', { class: 'riga-contratto-scadenza' });
      riga.appendChild(crea('span', { class: 'nome-staff' }, p.nome));
      riga.appendChild(crea('span', { class: 'card-etichetta' }, `Scadenza ${p.contratto.scadenza} · ${formatMoneta(p.contratto.stipendio)}/anno`));
      cardRiepilogo.appendChild(riga);
    });
    contenuto.appendChild(cardRiepilogo);

    /* Sondaggi esplorativi (solo inter-gara, non in pausa invernale) */
    if (!mercato.aperto && motore.ottieniSondaggiAR1) {
      _renderSondaggiPilotiAR1(contenuto);
    }
  }
}

/* ----------------------------------------------------------
   Sondaggi esplorativi piloti AR1 — disponibili in inter-gara
---------------------------------------------------------- */
function _renderSondaggiPilotiAR1(contenuto) {
  const dati = motore.ottieniSondaggiAR1();
  if (!dati) return;

  const card = crea('div', { class: 'card margine-sopra', role: 'region', 'aria-label': 'Sondaggi esplorativi piloti' });
  card.appendChild(crea('h3', {}, 'Sondaggi esplorativi'));
  card.appendChild(crea('p', { class: 'nota-tecnica' },
    'Durante la stagione puoi contattare piloti liberi per verificare il loro interesse per la stagione successiva. ' +
    'Nessun contratto viene firmato. Massimo ' + dati.maxSondaggi + ' sondaggi per stagione.'));

  /* Contatore sondaggi usati */
  const rigaContatore = crea('div', { class: 'riga-performance margine-sopra' });
  rigaContatore.appendChild(crea('span', { class: 'etichetta-performance' }, 'Sondaggi avviati'));
  rigaContatore.appendChild(crea('span', { class: 'valore-performance', 'aria-label': `${dati.sondaggiUsati} su ${dati.maxSondaggi} sondaggi utilizzati` },
    dati.sondaggiUsati + ' / ' + dati.maxSondaggi));
  card.appendChild(rigaContatore);

  /* Risposte ai sondaggi già avviati */
  if (dati.sondaggi.length > 0) {
    card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Sondaggi in corso'));
    dati.sondaggi.forEach(s => {
      const rigaS = crea('div', { class: 'card margine-sopra' });
      const intestS = crea('div', { class: 'card-intestazione' });
      intestS.appendChild(crea('span', { class: 'nome-staff' }, s.nomePilota));
      if (s.risposta) {
        const coloreInt = { alto: 'var(--colore-tecnica)', medio: 'var(--colore-economia)', basso: 'var(--colore-operazioni)', rifiuto: 'var(--colore-relazioni)' }[s.risposta.interesse] || 'inherit';
        const labelInt = { alto: 'Molto interessato', medio: 'Disponibile', basso: 'Interesse limitato', rifiuto: 'Non disponibile' }[s.risposta.interesse] || s.risposta.interesse;
        intestS.appendChild(crea('span', { class: 'badge-livello-infrastrutture', style: `background-color:${coloreInt}; color:#000`, 'aria-label': 'Risposta: ' + labelInt }, labelInt));
      } else {
        intestS.appendChild(crea('span', { class: 'card-etichetta' }, 'In attesa'));
      }
      rigaS.appendChild(intestS);
      if (s.risposta) {
        rigaS.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, s.risposta.messaggio));
        if (s.risposta.stipendioIndicativo) {
          rigaS.appendChild(crea('p', { class: 'nota-tecnica' },
            'Nelle trattative invernali potrai proporre un contratto a partire da questa cifra indicativa.'));
        }
      } else {
        rigaS.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Risposta attesa entro ' + Math.max(0, s.roundAvviato + 2 - (motore.stato.roundCorrente || 0)) + ' round.'));
      }
      card.appendChild(rigaS);
    });
  }

  /* Pool piloti liberi — solo se ci sono sondaggi ancora disponibili */
  if (dati.puoSondare && dati.sondaggiUsati < dati.maxSondaggi && dati.liberi.length > 0) {
    card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Piloti liberi — avvia sondaggio'));
    dati.liberi.forEach(p => {
      const giaSondato = dati.sondaggi.some(s => s.pilotaId === p.id);
      if (giaSondato) return;

      const talLabel = _statoStat(p.statistiche?.talento || 0);
      const cardP = crea('div', { class: 'card margine-sopra',
        'aria-label': `${p.nome}, ${p.eta} anni, talento ${talLabel}` });
      const intestP = crea('div', { class: 'card-intestazione' });
      intestP.appendChild(crea('span', { class: 'nome-staff' }, p.nome));
      intestP.appendChild(crea('span', { class: 'card-etichetta' }, p.eta + ' anni'));
      cardP.appendChild(intestP);

      const dlP = crea('dl', { class: 'lista-dati', 'aria-label': 'Statistiche ' + p.nome });
      [['Talento', _statoStat(p.statistiche?.talento || 0)],
       ['Qualifica', _statoStat(p.statistiche?.qualifica || 0)],
       ['Gara', _statoStat(p.statistiche?.gara || 0)]
      ].forEach(([k, v]) => { dlP.appendChild(crea('dt', {}, k)); dlP.appendChild(crea('dd', {}, v)); });
      cardP.appendChild(dlP);

      const btnSond = crea('button', {
        class: 'btn-azione margine-sopra',
        'aria-label': `Avvia sondaggio per ${p.nome}`
      }, 'Avvia sondaggio');
      btnSond.addEventListener('click', () => {
        const ris = motore.avviaSondaggioPilotaAR1(p.id);
        annunciaVoiceOver(ris.messaggio);
        if (ris.ok) {
          audio.conferma();
          _renderPannelloMercato();
        }
      });
      cardP.appendChild(btnSond);
      card.appendChild(cardP);
    });
  } else if (!dati.puoSondare) {
    card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
      'I sondaggi sono disponibili solo tra un weekend e l\'altro.'));
  }

  contenuto.appendChild(card);
}

/* Sotto-render del mercato piloti AR2/AR3 */
function _renderMercatoPilotiAR2AR3(contenuto, mercatoPiloti, stato) {
  const cardTitolo = crea('div', { class: 'card margine-sopra' });
  cardTitolo.appendChild(crea('h3', {}, 'Mercato piloti — Pausa invernale'));
  cardTitolo.appendChild(crea('p', {}, 'Puoi sostituire uno dei tuoi piloti con un pilota libero. L\'operazione è irreversibile per questa stagione.'));
  contenuto.appendChild(cardTitolo);

  /* Piloti correnti del giocatore */
  const cardRoster = crea('div', { class: 'card margine-sopra' });
  cardRoster.appendChild(crea('h3', {}, 'Rosa attuale'));
  mercatoPiloti.pilotiGiocatore.forEach((p, idx) => {
    const riga = crea('div', { class: 'riga-performance margine-sopra' });
    const nomeLabel = (p.nome || '—');
    riga.appendChild(crea('span', { class: 'etichetta-performance' }, nomeLabel));
    const tal = p.statistiche?.talento || 0;
    const talLabel2 = _statoStat(tal);
    const barraTal = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': tal, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': `${p.nome}, talento: ${talLabel2}` });
    const riempTal = crea('div', { class: 'riempimento-performance' });
    riempTal.style.width = tal + '%';
    riempTal.style.backgroundColor = 'var(--colore-persone)';
    barraTal.appendChild(riempTal);
    riga.appendChild(barraTal);
    riga.appendChild(crea('span', { class: 'valore-performance' }, talLabel2));
    cardRoster.appendChild(riga);
  });
  contenuto.appendChild(cardRoster);

  /* Pool piloti liberi */
  const pool = mercatoPiloti.pool || [];
  if (pool.length === 0) {
    const cardVuota = crea('div', { class: 'card margine-sopra' });
    cardVuota.appendChild(crea('p', {}, 'Nessun pilota disponibile sul mercato in questo momento.'));
    contenuto.appendChild(cardVuota);
    return;
  }

  const cardPool = crea('div', { class: 'card margine-sopra' });
  cardPool.appendChild(crea('h3', {}, 'Piloti disponibili'));

  pool.forEach(p => {
    const poolTalLabel = _statoStat(p.statistiche?.talento || 0);
    const cardP = crea('div', { class: 'scheda-pilota margine-sopra',
      'aria-label': `${p.nome}, ${p.eta} anni, talento ${poolTalLabel}` });
    const intestazione = crea('div', { class: 'intestazione-pilota' });
    intestazione.appendChild(crea('span', { class: 'nome-pilota' }, p.nome));
    intestazione.appendChild(crea('span', { class: 'nazionalita-pilota' },
      p.eta + ' anni · ' + (p.traiettoria === 'crescita' ? 'In crescita' : 'Esperto')));
    cardP.appendChild(intestazione);

    /* Stats rapide */
    const dl = crea('dl', { class: 'lista-dati', 'aria-label': 'Statistiche ' + p.nome });
    [['Talento', _statoStat(p.statistiche?.talento || 0)],
     ['Qualifica', _statoStat(p.statistiche?.qualifica || 0)],
     ['Gara', _statoStat(p.statistiche?.gara || 0)]
    ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
    cardP.appendChild(dl);

    /* Pulsanti ingaggio: uno per ogni pilota da sostituire */
    const gruppoBtn = crea('div', { class: 'gruppo-azioni margine-sopra' });
    mercatoPiloti.pilotiGiocatore.forEach((pCorrente, idx) => {
      const btnIngaggia = crea('button', {
        class: 'btn-secondario',
        'aria-label': `Ingaggia ${p.nome} al posto di ${pCorrente.nome}`
      }, `Al posto di ${pCorrente.nome}`);
      btnIngaggia.addEventListener('click', () => {
        const ris = motore.ingaggiaPilotaAR2AR3(p.id, idx);
        if (ris.successo) {
          annunciaVoiceOver(ris.messaggio);
          audio.conferma();
          _renderPannelloMercato();
        } else {
          annunciaVoiceOver('Operazione non riuscita: ' + ris.messaggio);
        }
      });
      gruppoBtn.appendChild(btnIngaggia);
    });
    cardP.appendChild(gruppoBtn);
    cardPool.appendChild(cardP);
  });

  contenuto.appendChild(cardPool);
}


/* ============================================================
   RENDER SVILUPPO AR2 (pannello dentro Operazioni)
   ============================================================ */

function _renderSviluppoAR2() {
  const contenuto = el('contenuto-sviluppo-ar2');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const dati = motore.ottieniSviluppoAR2();
  if (!dati) return;

  /* Budget disponibile */
  const cardBudget = crea('div', { class: 'box-risorse' });
  cardBudget.appendChild(crea('p', { class: 'box-risorse-titolo' }, 'Risorse disponibili'));
  const dlBudget = crea('dl', { class: 'box-risorse-dati', 'aria-label': 'Risorse disponibili' });
  dlBudget.appendChild(crea('dt', {}, 'Budget libero'));
  dlBudget.appendChild(crea('dd', {}, formatMoneta(dati.budget)));
  cardBudget.appendChild(dlBudget);
  cardBudget.appendChild(crea('p', { class: 'box-risorse-nota' }, 'Gli upgrade migliorano la competitività della vettura. Guadagni compresi tra +1% e +2% per livello. Livello massimo: 3.'));
  contenuto.appendChild(cardBudget);

  /* Una card per area */
  dati.aree.forEach(area => {
    const card = crea('div', { class: 'card margine-sopra', 'aria-label': `${area.nome}, livello ${area.livello} su ${area.livelloMax}` });

    /* Intestazione */
    const intest = crea('div', { class: 'opzione-intestazione' });
    intest.appendChild(crea('span', { class: 'titolo-opzione-upgrade' }, area.nome));
    intest.appendChild(crea('span', { class: 'badge-dipartimento' }, `L${area.livello} / ${area.livelloMax}`));
    card.appendChild(intest);

    if (area.inCorso) {
      const roundRim = Math.max(0, area.inCorso.roundConsegna - dati.roundCorrente);
      card.appendChild(crea('p', { class: 'nota-tecnica' }, `Upgrade in corso: ${area.inCorso.nome}. Consegna in ${roundRim} round.`));
    } else if (area.livello >= area.livelloMax) {
      card.appendChild(crea('p', { class: 'testo-positivo' }, 'Livello massimo raggiunto.'));
    } else {
      card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Scegli un pacchetto di sviluppo:'));

      area.opzioni.forEach(opzione => {
        const cardOp = crea('div', { class: 'card-opzione-upgrade margine-sopra' });

        const intestOp = crea('div', { class: 'opzione-intestazione' });
        intestOp.appendChild(crea('span', { class: 'titolo-opzione-upgrade' }, opzione.nome));
        const badgeRischio = crea('span', { class: 'badge-dipartimento' }, opzione.rischio === 'basso' ? 'Prudente' : 'Accelerato');
        intestOp.appendChild(badgeRischio);
        cardOp.appendChild(intestOp);

        cardOp.appendChild(crea('p', { class: 'descrizione-opzione-upgrade' }, opzione.descrizione));

        const dl = crea('dl', { class: 'dati-opzione-upgrade' });
        [
          ['Guadagno stimato', opzione.guadagnoStimato],
          ['Costo',            formatMoneta(opzione.costo)],
          ['Durata',           opzione.rounds + ' round']
        ].forEach(([k, v]) => {
          dl.appendChild(crea('dt', {}, k));
          dl.appendChild(crea('dd', {}, v));
        });
        cardOp.appendChild(dl);

        const btnConferma = crea('button', {
          class: 'btn-principale margine-sopra',
          'aria-label': `Conferma upgrade ${opzione.nome}: ${formatMoneta(opzione.costo)}, ${opzione.rounds} round`
        }, 'Conferma');
        btnConferma.addEventListener('click', () => {
          const ris = motore.confermaNuovoUpgradeAR2(opzione);
          annunciaVoiceOver(ris.messaggio);
          if (ris.successo) _renderSviluppoAR2();
        });
        cardOp.appendChild(btnConferma);
        card.appendChild(cardOp);
      });
    }

    contenuto.appendChild(card);
  });

  /* Upgrade in consegna */
  const inCorsoTutti = (motore.stato.pianoUpgradeAR2 || []).filter(u => !u.completato);
  if (inCorsoTutti.length > 0) {
    const cardInCorso = crea('div', { class: 'card margine-sopra' });
    cardInCorso.appendChild(crea('p', { class: 'card-etichetta' }, 'Upgrade in consegna'));
    inCorsoTutti.forEach(u => {
      const roundRim = Math.max(0, u.roundConsegna - dati.roundCorrente);
      cardInCorso.appendChild(crea('p', {}, `${u.nome} — ${roundRim} round al completamento`));
    });
    contenuto.appendChild(cardInCorso);
  }
}

/* ============================================================
   RENDER SEZIONE: TECNICA (solo AR1)
   ============================================================ */

/* ============================================================
   NAVIGAZIONE SOTTOSEZIONI TECNICA
   ============================================================ */

function _apriPannelloTecnica(nomePannello) {
  /* Aggiorna bottoni sub-nav */
  document.querySelectorAll('.btn-sub-tecnica').forEach(btn => {
    const isAttivo = btn.dataset.pannelloTecnica === nomePannello;
    btn.classList.toggle('attivo', isAttivo);
    btn.setAttribute('aria-pressed', isAttivo ? 'true' : 'false');
  });

  /* Mostra/nascondi pannelli */
  ['macchina', 'upgrade', 'sviluppo', 'power-unit', 'archivio', 'infrastrutture'].forEach(id => {
    const pannello = el('pannello-' + id);
    if (!pannello) return;
    if (id === nomePannello) {
      pannello.classList.remove('nascosta');
    } else {
      pannello.classList.add('nascosta');
    }
  });

  /* Renderizza il pannello attivo */
  switch (nomePannello) {
    case 'macchina':    _renderPannelloMacchina();    break;
    case 'upgrade':     _renderPannelloUpgrade();     break;
    case 'sviluppo':    _renderPannelloSviluppo();    break;
    case 'power-unit':  _renderPannelloPowerUnit();   break;
    case 'archivio':    _renderPannelloArchivio();    break;
    case 'infrastrutture': _renderPannelloInfrastrutture(); break;
  }
}

function renderTecnica() {
  const stato = motore.stato;

  /* Binding sub-nav (una volta sola se non già fatto) */
  const nav = el('nav-sub-tecnica');
  if (nav && !nav.dataset.bound) {
    nav.dataset.bound = '1';
    nav.querySelectorAll('.btn-sub-tecnica').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.navigazione();
        _apriPannelloTecnica(btn.dataset.pannelloTecnica);
      });
    });
  }

  if (stato.categoria !== 'AR1') {
    el('contenuto-macchina').innerHTML = '<p class="card-etichetta">Sezione disponibile solo in AR1.</p>';
    /* Nascondi sub-nav nelle categorie inferiori */
    if (nav) nav.style.display = 'none';
    return;
  }

  if (nav) nav.style.display = '';

  /* Renderizza il pannello correntemente attivo (default: macchina) */
  const pannelloAttivo = nav?.querySelector('.btn-sub-tecnica.attivo')?.dataset?.pannelloTecnica || 'macchina';
  _apriPannelloTecnica(pannelloAttivo);
}

/* ----------------------------------------------------------
   PANNELLO 1 — MACCHINA
---------------------------------------------------------- */

function _renderPannelloMacchina() {
  const stato = motore.stato;
  const contenuto = el('contenuto-macchina');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const staff = stato.staff || {};

  /* Stima performance globale */
  const stima = motore.ottieniStimaMacchina();
  const cardStima = crea('div', { class: 'card' });
  cardStima.appendChild(crea('p', { class: 'card-etichetta' }, 'Performance stimata — Data Analyst'));

  if (stima && stima.valore) {
    cardStima.appendChild(crea('p', {
      class: 'card-valore',
      'aria-label': `Performance stimata: ${stima.valore}% del benchmark`
    }, stima.valore + '% del benchmark'));
    cardStima.appendChild(crea('p', { class: 'card-etichetta' },
      `Margine di errore: ±${stima.margineErrore}% · Qualità dati: ${stima.qualitaDati}%`
    ));
    if (staff.dataAnalyst) {
      cardStima.appendChild(crea('p', { class: 'nota-tecnica' },
        `${staff.dataAnalyst.nome} — precisione ${staff.dataAnalyst.statistiche?.precisione ?? '—'} · velocità analisi ${staff.dataAnalyst.statistiche?.velocita ?? '—'}`
      ));
    }
  } else {
    cardStima.appendChild(crea('p', { class: 'testo-avviso' },
      'Nessuna stima disponibile. Completa le Prove Libere per raccogliere dati.'
    ));
  }
  contenuto.appendChild(cardStima);

  /* Performance per dipartimento con direttore responsabile */
  if (stato.macchina) {
    const cardAree = crea('div', { class: 'card margine-sopra' });
    cardAree.appendChild(crea('p', { class: 'card-etichetta' }, 'Dipartimenti — performance relativa al benchmark'));

    /* Coordinamento Capo Ingegnere */
    if (staff.capoIngegnere) {
      const ci = staff.capoIngegnere;
      const rigaCI = crea('div', { class: 'riga-direttore-coordinatore' });
      rigaCI.appendChild(crea('span', { class: 'nome-direttore' }, ci.nome));
      rigaCI.appendChild(crea('span', { class: 'ruolo-direttore' }, 'Capo Ingegnere'));
      const statsCI = crea('span', { class: 'stats-direttore' },
        `Coordinamento ${ci.statistiche?.coordinamento ?? '—'} · Strategia ${ci.statistiche?.strategia ?? '—'} · Esperienza ${ci.statistiche?.esperienza ?? '—'}`
      );
      rigaCI.appendChild(statsCI);
      cardAree.appendChild(rigaCI);
    }

    const aree = [
      { chiave: 'aerodinamica', nome: 'Aerodinamica', staffKey: 'direttoreAero',       ruolo: 'Dir. Design Aerodinamico' },
      { chiave: 'meccanica',    nome: 'Meccanica',    staffKey: 'direttoreMeccanica',   ruolo: 'Dir. Design Meccanico' },
      { chiave: 'elettronica',  nome: 'Elettronica',  staffKey: 'direttoreElettronica', ruolo: 'Dir. Design Elettronica' },
      { chiave: 'powerUnit',    nome: 'Power Unit',   staffKey: null,                    ruolo: null }
    ];

    aree.forEach(({ chiave, nome, staffKey, ruolo }) => {
      const val = stato.macchina[chiave];
      const wrapper = crea('div', { class: 'wrapper-dipartimento' });

      const rigaPerf = crea('div', { class: 'riga-performance' });
      rigaPerf.appendChild(crea('span', { class: 'etichetta-performance' }, nome));
      const barra = crea('div', {
        class: 'barra-performance',
        role: 'progressbar',
        'aria-valuenow': val,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-label': `${nome}: ${val}%`
      });
      const riempimento = crea('div', { class: 'riempimento-performance' });
      riempimento.style.width = val + '%';
      barra.appendChild(riempimento);
      rigaPerf.appendChild(barra);
      rigaPerf.appendChild(crea('span', { class: 'valore-performance' }, val + '%'));
      wrapper.appendChild(rigaPerf);

      /* Direttore responsabile del dipartimento */
      if (staffKey && staff[staffKey]) {
        const dir = staff[staffKey];
        const rigaDir = crea('div', { class: 'riga-direttore-dipartimento' });
        rigaDir.appendChild(crea('span', { class: 'nome-direttore-piccolo' }, dir.nome));
        rigaDir.appendChild(crea('span', { class: 'ruolo-direttore-piccolo' }, ruolo));
        rigaDir.appendChild(crea('span', { class: 'stats-direttore-piccolo' },
          `Inn. ${dir.statistiche?.innovazione ?? '—'} · Prec. ${dir.statistiche?.precisione ?? '—'}`
        ));
        wrapper.appendChild(rigaDir);
      }

      cardAree.appendChild(wrapper);
    });

    contenuto.appendChild(cardAree);
  }
}

/* ----------------------------------------------------------
   PANNELLO 2 — UPGRADE
---------------------------------------------------------- */

function _renderPannelloUpgrade() {
  const stato = motore.stato;
  const contenuto = el('contenuto-upgrade');
  if (!contenuto) return;
  contenuto.replaceChildren();

  /* ── BOX RISORSE ─────────────────────────────────── */
  const budgetResiduo = stato.budget - stato.budgetSpeso;
  const era = stato.eraRegolamentare;
  const limiteCapReg = era?.budgetCapAR1 || 135000000;
  const percCapUsata = Math.round((stato.budgetSpeso / limiteCapReg) * 100);
  const costoInCorso = (stato.pianoUpgrade || [])
    .filter(u => !u.applicato)
    .reduce((acc, u) => acc + (u.costo || 0), 0);

  const boxRisorse = crea('div', {
    class: 'box-risorse',
    role: 'region',
    'aria-label': 'Risorse disponibili per lo sviluppo'
  });
  boxRisorse.appendChild(crea('p', { class: 'box-risorse-titolo' }, 'Risorse sviluppo'));
  const dlRis = crea('dl', { class: 'box-risorse-dati' });
  [
    ['Budget disponibile',    formatMoneta(budgetResiduo)],
    ['Budget cap stagione',   formatMoneta(limiteCapReg)],
    ['Utilizzo budget cap',   percCapUsata + '%'],
    ['Impegnato in upgrade',  costoInCorso > 0 ? formatMoneta(costoInCorso) : '—']
  ].forEach(([k, v]) => {
    dlRis.appendChild(crea('dt', {}, k));
    dlRis.appendChild(crea('dd', {}, v));
  });
  boxRisorse.appendChild(dlRis);

  /* Ruolo Capo Ingegnere */
  const ci = stato.staff?.capoIngegnere;
  if (ci) {
    boxRisorse.appendChild(crea('p', { class: 'box-risorse-nota' },
      `${ci.nome} (Capo Ingegnere) — coordinamento ${ci.statistiche?.coordinamento ?? '—'}: ${
        (ci.statistiche?.coordinamento ?? 0) >= 88
          ? 'bonus coordinamento attivo su tutti i dipartimenti'
          : 'coordinamento nella norma'
      }`
    ));
  }
  contenuto.appendChild(boxRisorse);

  /* ── PIANO UPGRADE IN CORSO ─────────────────────── */
  const piano = (stato.pianoUpgrade || []).filter(u => !u.applicato);
  const cardPiano = crea('div', { class: 'card' });
  cardPiano.appendChild(crea('p', { class: 'card-etichetta' }, 'Upgrade in sviluppo'));

  if (piano.length === 0) {
    cardPiano.appendChild(crea('p', {}, 'Nessun upgrade confermato in questo momento.'));
  } else {
    piano.forEach(u => {
      const riga = crea('div', { class: 'riga-upgrade-in-corso' });
      const titolo = crea('span', { class: 'nome-upgrade-in-corso' }, u.titolo);
      const consegna = crea('span', { class: 'consegna-upgrade' }, `Consegna: Round ${u.roundConsegna}`);
      const badge = crea('span', { class: 'badge-dipartimento badge-' + u.dipartimento }, _nomeDipartimento(u.dipartimento));
      riga.appendChild(titolo);
      riga.appendChild(badge);
      riga.appendChild(consegna);
      cardPiano.appendChild(riga);
    });
  }
  contenuto.appendChild(cardPiano);

  /* Opzioni nuovi upgrade */
  const opzioni = motore.generaOpzioniUpgrade();
  const cardOpzioni = crea('div', { class: 'card margine-sopra' });
  cardOpzioni.appendChild(crea('p', { class: 'card-etichetta' }, 'Nuove proposte di sviluppo — Round ' + (stato.roundCorrente + 1)));

  opzioni.forEach(op => {
    const giàInCorso = piano.some(u => u.dipartimento === op.dipartimento);
    const haBudget = budgetResiduo >= op.costo;
    const disabilitato = giàInCorso || !haBudget;

    const card = crea('div', { class: 'card-opzione-upgrade' + (disabilitato ? ' opzione-disabilitata' : '') });

    const intestazione = crea('div', { class: 'opzione-intestazione' });
    intestazione.appendChild(crea('span', { class: 'titolo-opzione-upgrade' }, op.titolo));
    intestazione.appendChild(crea('span', { class: 'badge-dipartimento badge-' + op.dipartimento }, _nomeDipartimento(op.dipartimento)));
    card.appendChild(intestazione);

    card.appendChild(crea('p', { class: 'descrizione-opzione-upgrade' }, op.descrizione));

    /* Direttore responsabile */
    if (op.nomeDirettore) {
      const rigaDir = crea('p', { class: 'riga-responsabile-upgrade' },
        `Responsabile: ${op.nomeDirettore}` +
        (op.innovazioneDirettore ? ` — Innovazione ${op.innovazioneDirettore}` : '')
      );
      card.appendChild(rigaDir);
    }

    const dl = crea('dl', { class: 'dati-opzione-upgrade' });
    [
      ['Impatto stimato', '+' + op.impatto + ' punti performance'],
      ['Costo', formatMoneta(op.costo)],
      ['Consegna prevista', 'Round ' + op.roundConsegna]
    ].forEach(([k, v]) => {
      dl.appendChild(crea('dt', {}, k));
      dl.appendChild(crea('dd', {}, v));
    });
    card.appendChild(dl);

    if (giàInCorso) {
      card.appendChild(crea('p', { class: 'avviso-upgrade' }, 'Upgrade già in corso per questo dipartimento.'));
    } else if (!haBudget) {
      card.appendChild(crea('p', { class: 'avviso-upgrade' }, 'Budget insufficiente.'));
    } else {
      const btn = crea('button', {
        class: 'btn-azione btn-upgrade margine-sopra',
        'aria-label': `Conferma upgrade: ${op.titolo} — costo ${formatMoneta(op.costo)}`
      }, 'Conferma upgrade');
      btn.addEventListener('click', () => {
        const esito = motore.confermaNuovoUpgrade(op);
        if (esito.successo) {
          audio.conferma();
          annunciaVoiceOver('Upgrade confermato: ' + op.titolo + '. Consegna al round ' + op.roundConsegna + '.');
          _renderPannelloUpgrade();
        } else {
          audio.errore();
          annunciaVoiceOver('Errore: ' + esito.errore);
        }
      });
      card.appendChild(btn);
    }

    cardOpzioni.appendChild(card);
  });

  contenuto.appendChild(cardOpzioni);

  /* Upgrade già applicati questa stagione */
  const applicati = (stato.pianoUpgrade || []).filter(u => u.applicato);
  if (applicati.length > 0) {
    const cardApplicati = crea('div', { class: 'card margine-sopra' });
    cardApplicati.appendChild(crea('p', { class: 'card-etichetta' }, 'Upgrade applicati questa stagione'));
    applicati.forEach(u => {
      const riga = crea('div', { class: 'riga-upgrade-applicato' });
      riga.appendChild(crea('span', {}, u.titolo));
      riga.appendChild(crea('span', { class: 'card-etichetta' }, `+${u.impatto} — Round ${u.roundConsegna}`));
      cardApplicati.appendChild(riga);
    });
    contenuto.appendChild(cardApplicati);
  }
}

function _nomeDipartimento(chiave) {
  const nomi = { aerodinamica: 'Aero', meccanica: 'Mec', elettronica: 'Ele', powerUnit: 'PU' };
  return nomi[chiave] || chiave;
}

/* ----------------------------------------------------------
   PANNELLO 3 — SVILUPPO E CFD
---------------------------------------------------------- */

function _renderPannelloSviluppo() {
  const stato = motore.stato;
  const contenuto = el('contenuto-sviluppo');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const staff = stato.staff || {};

  const oreTotali = motore.calcolaOreDisponibiliCFD();
  const split = stato.allocazioneCFD || { stagioneCorrente: 0.7, prossimaStagione: 0.3 };
  const oreCorrente = Math.round(oreTotali * split.stagioneCorrente);
  const oreProssima = Math.round(oreTotali * split.prossimaStagione);
  const posizione = (stato.classificaCostruttori.findIndex(c => c.squadraId === stato.squadraId) + 1) || 10;

  /* ── BOX RISORSE CFD ─────────────────────────────── */
  const boxCFD = crea('div', {
    class: 'box-risorse',
    role: 'region',
    'aria-label': 'Riepilogo risorse CFD e galleria del vento'
  });
  boxCFD.appendChild(crea('p', { class: 'box-risorse-titolo' }, 'CFD e galleria del vento — risorse stagione corrente'));

  const dlCFD = crea('dl', { class: 'box-risorse-dati' });
  [
    ['Posizione in classifica',  posizione + '°'],
    ['Monte ore totale',         oreTotali + ' ore / settimana'],
    ['Macchina corrente',        oreCorrente + ' ore  (' + Math.round(split.stagioneCorrente * 100) + '%)'],
    ['Prossima stagione',        oreProssima + ' ore  (' + Math.round(split.prossimaStagione * 100) + '%)']
  ].forEach(([k, v]) => {
    dlCFD.appendChild(crea('dt', {}, k));
    dlCFD.appendChild(crea('dd', {}, v));
  });
  boxCFD.appendChild(dlCFD);

  const era = stato.eraRegolamentare;
  if (era) {
    boxCFD.appendChild(crea('p', { class: 'box-risorse-nota' },
      `Era ${era.nome}: le ore sono inversamente proporzionali alla posizione in classifica. Il primo classificato dispone di ${era.limiteOreCFD?.primoClassificato ?? '—'} ore, il decimo di ${era.limiteOreCFD?.decimoClassificato ?? '—'} ore.`
    ));
  }
  contenuto.appendChild(boxCFD);

  /* ── CONTROLLI ALLOCAZIONE ───────────────────────── */
  const cardCFD = crea('div', { class: 'card' });
  cardCFD.appendChild(crea('p', { class: 'card-etichetta' }, 'Modifica allocazione'));

  const gruppoSplit = crea('div', { class: 'controllo-split-cfd', 'aria-label': 'Allocazione ore CFD' });

  const etichettaCorrente = crea('p', { class: 'etichetta-split' },
    `Macchina corrente: ${Math.round(split.stagioneCorrente * 100)}% — ${oreCorrente} ore / settimana`
  );
  const etichettaProssima = crea('p', { class: 'etichetta-split' },
    `Prossima stagione: ${Math.round(split.prossimaStagione * 100)}% — ${oreProssima} ore / settimana`
  );

  const gruppoBtn = crea('div', { class: 'gruppo-btn-split' });

  const btnMeno = crea('button', {
    class: 'btn-split',
    'aria-label': 'Sposta 5% delle ore verso la prossima stagione'
  }, '− 5% corrente');
  btnMeno.disabled = split.stagioneCorrente <= 0.1;
  btnMeno.addEventListener('click', () => {
    motore.aggiornaSplitCFD(-0.05);
    audio.navigazione();
    _renderPannelloSviluppo();
  });

  const btnPiu = crea('button', {
    class: 'btn-split',
    'aria-label': 'Sposta 5% delle ore verso la macchina corrente'
  }, '+ 5% corrente');
  btnPiu.disabled = split.stagioneCorrente >= 0.9;
  btnPiu.addEventListener('click', () => {
    motore.aggiornaSplitCFD(+0.05);
    audio.navigazione();
    _renderPannelloSviluppo();
  });

  gruppoBtn.appendChild(btnMeno);
  gruppoBtn.appendChild(btnPiu);
  gruppoSplit.appendChild(etichettaCorrente);
  gruppoSplit.appendChild(etichettaProssima);
  gruppoSplit.appendChild(gruppoBtn);
  cardCFD.appendChild(gruppoSplit);
  contenuto.appendChild(cardCFD);

  /* ── STAFF TECNICO COINVOLTO ─────────────────────── */
  const cardStaff = crea('div', { class: 'card margine-sopra' });
  cardStaff.appendChild(crea('p', { class: 'card-etichetta' }, 'Staff responsabile dello sviluppo'));

  const figureStaff = [
    { key: 'capoIngegnere',       ruolo: 'Capo Ingegnere',            dettaglio: s => `Coord. ${s.coordinamento ?? '—'} · Strategia ${s.strategia ?? '—'} · Esp. ${s.esperienza ?? '—'}` },
    { key: 'direttoreAero',       ruolo: 'Dir. Design Aerodinamico',  dettaglio: s => `Innovazione ${s.innovazione ?? '—'} · Precisione ${s.precisione ?? '—'}` },
    { key: 'direttoreMeccanica',  ruolo: 'Dir. Design Meccanico',     dettaglio: s => `Innovazione ${s.innovazione ?? '—'} · Precisione ${s.precisione ?? '—'}` },
    { key: 'direttoreElettronica',ruolo: 'Dir. Design Elettronica',   dettaglio: s => `Innovazione ${s.innovazione ?? '—'} · Precisione ${s.precisione ?? '—'}` }
  ];

  figureStaff.forEach(({ key, ruolo, dettaglio }) => {
    const membro = staff[key];
    if (!membro) return;
    const riga = crea('div', { class: 'riga-staff-sviluppo' });
    const left = crea('div', {});
    left.appendChild(crea('span', { class: 'nome-direttore' }, membro.nome));
    left.appendChild(crea('span', { class: 'ruolo-direttore' }, ruolo));
    riga.appendChild(left);
    riga.appendChild(crea('span', { class: 'stats-direttore' }, dettaglio(membro.statistiche || {})));
    cardStaff.appendChild(riga);
  });

  contenuto.appendChild(cardStaff);

  /* ── CONCEPT PROSSIMA STAGIONE ───────────────────── */
  const cardConcept = crea('div', { class: 'card margine-sopra' });
  cardConcept.appendChild(crea('p', { class: 'card-etichetta' }, 'Progetto macchina — stagione successiva'));
  cardConcept.appendChild(crea('p', {},
    'Il Capo Ingegnere definirà il concept della prossima stagione durante la pausa invernale. Le ore CFD allocate alla prossima stagione determinano la qualità del progetto di base.'
  ));
  contenuto.appendChild(cardConcept);
}

/* ----------------------------------------------------------
   PANNELLO 4 — POWER UNIT
---------------------------------------------------------- */

function _renderPannelloPowerUnit() {
  const contenuto = el('contenuto-power-unit');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;

  const pu = motore.ottieniStatoPowerUnit();
  if (!pu) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Dati Power Unit non disponibili.'));
    return;
  }

  /* ── BOX RISORSE TOKEN ───────────────────────────── */
  const boxToken = crea('div', {
    class: 'box-risorse',
    role: 'region',
    'aria-label': 'Token di sviluppo motore disponibili'
  });
  boxToken.appendChild(crea('p', { class: 'box-risorse-titolo' }, 'Token di sviluppo motore'));

  if (pu.motoreProprio) {
    /* Visualizzazione simbolica */
    const contenitoreToken = crea('div', {
      class: 'contenitore-token',
      'aria-label': `${pu.tokenDisponibili} token disponibili su ${pu.tokenTotali}`
    });
    for (let i = 0; i < pu.tokenTotali; i++) {
      const token = crea('span', {
        class: 'badge-token ' + (i < pu.tokenUsati ? 'token-usato' : 'token-disponibile'),
        'aria-hidden': 'true'
      }, i < pu.tokenUsati ? '●' : '○');
      contenitoreToken.appendChild(token);
    }
    boxToken.appendChild(contenitoreToken);

    const dlTok = crea('dl', { class: 'box-risorse-dati' });
    [
      ['Token stagione', pu.tokenTotali + ' totali'],
      ['Utilizzati',     pu.tokenUsati],
      ['Disponibili',    pu.tokenDisponibili]
    ].forEach(([k, v]) => {
      dlTok.appendChild(crea('dt', {}, k));
      dlTok.appendChild(crea('dd', {}, String(v)));
    });
    boxToken.appendChild(dlTok);

    if (pu.tokenDisponibili > 0) {
      const btnToken = crea('button', {
        class: 'btn-azione',
        'aria-label': `Usa un token di sviluppo — migliora la Power Unit`
      }, 'Usa token sviluppo');
      btnToken.addEventListener('click', () => {
        const esito = motore.usaTokenMotore();
        if (esito.successo) {
          audio.conferma();
          annunciaVoiceOver(`Token utilizzato. Power Unit migliorata di ${esito.incremento} punti.`);
          _renderPannelloPowerUnit();
        } else {
          audio.errore();
          annunciaVoiceOver('Errore: ' + esito.errore);
        }
      });
      boxToken.appendChild(btnToken);
      boxToken.appendChild(crea('p', { class: 'box-risorse-nota' },
        'Ogni token migliora la prestazione della Power Unit. I token non utilizzati si azzerano a fine stagione.'
      ));
    } else {
      boxToken.appendChild(crea('p', { class: 'testo-avviso' },
        'Tutti i token della stagione sono stati utilizzati.'
      ));
    }
  } else {
    boxToken.appendChild(crea('p', { class: 'box-risorse-nota' },
      'I token di sviluppo sono disponibili solo per i costruttori di motori propri. Questa squadra acquista la power unit da un fornitore esterno.'
    ));
  }

  contenuto.appendChild(boxToken);

  /* ── SCHEDA FORNITORE ────────────────────────────── */
  const cardFornitore = crea('div', { class: 'card' });
  cardFornitore.appendChild(crea('p', { class: 'card-etichetta' }, 'Fornitore Power Unit'));

  if (pu.motoreProprio) {
    cardFornitore.appendChild(crea('p', { class: 'card-valore' }, 'Motore proprio'));
    cardFornitore.appendChild(crea('p', { class: 'card-etichetta' },
      'La squadra progetta e produce internamente la propria power unit.'
    ));
  } else {
    cardFornitore.appendChild(crea('p', { class: 'card-valore' }, pu.fornitore || 'Cliente'));
    cardFornitore.appendChild(crea('p', { class: 'card-etichetta' },
      'Power unit fornita da ' + (pu.fornitore || 'un costruttore esterno') + '.'
    ));
  }

  /* Performance PU */
  if (pu.performancePU !== null) {
    const rigaPerf = crea('div', { class: 'riga-performance margine-sopra' });
    rigaPerf.appendChild(crea('span', { class: 'etichetta-performance' }, 'Prestazione PU'));
    const barra = crea('div', {
      class: 'barra-performance',
      role: 'progressbar',
      'aria-valuenow': pu.performancePU,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `Power Unit: ${pu.performancePU}%`
    });
    const riempimento = crea('div', { class: 'riempimento-performance' });
    riempimento.style.width = pu.performancePU + '%';
    barra.appendChild(riempimento);
    rigaPerf.appendChild(barra);
    rigaPerf.appendChild(crea('span', { class: 'valore-performance' }, pu.performancePU + '%'));
    cardFornitore.appendChild(rigaPerf);
  }

  /* Direttore Elettronica — influenza il software della PU */
  const dirEle = stato.staff?.direttoreElettronica;
  if (dirEle) {
    cardFornitore.appendChild(crea('p', { class: 'nota-tecnica' },
      `${dirEle.nome} (Dir. Design Elettronica) — innovazione ${dirEle.statistiche?.innovazione ?? '—'} · precisione ${dirEle.statistiche?.precisione ?? '—'}. Influenza il software di gestione ERS e MGU.`
    ));
  }

  contenuto.appendChild(cardFornitore);

  /* ── PROGRAMMA MOTORE INTERNO ────────────────────────── */
  const pp = motore.ottieniStatoProgettoPU?.();
  if (pp && !pp.giaCosruttore) {
    const cardProg = crea('div', { class: 'card margine-sopra', role: 'region', 'aria-label': 'Programma motore interno' });
    cardProg.appendChild(crea('h3', {}, 'Programma motore interno'));

    if (pp.progetto) {
      const faseLabel = pp.faseCorrente?.nome || '—';
      const annoAvvio = pp.progetto.stagionInizio;
      const annoStima = pp.progetto.stagionePrevistaCompletamento;
      cardProg.appendChild(crea('p', { class: 'card-etichetta' }, 'Fase corrente: ' + faseLabel));
      cardProg.appendChild(crea('p', {}, 'Avviato nella stagione ' + annoAvvio + '. Completamento previsto: stagione ' + annoStima + '.'));
      cardProg.appendChild(crea('p', { class: 'nota-tecnica' }, pp.faseCorrente?.desc || ''));

      const dlInv = crea('dl', { 'aria-label': 'Investimento programma motore', class: 'margine-sopra' });
      dlInv.appendChild(crea('dt', {}, 'Investimento totale'));
      dlInv.appendChild(crea('dd', {}, formatMoneta(pp.progetto.investimentoTotale)));
      dlInv.appendChild(crea('dt', {}, 'Investimento residuo stimato'));
      dlInv.appendChild(crea('dd', {}, formatMoneta(pp.costoTotale - pp.progetto.investimentoTotale)));
      cardProg.appendChild(dlInv);

      if (pp.prossimaFase) {
        cardProg.appendChild(crea('p', { class: 'card-etichetta margine-sopra' },
          'Prossima fase: ' + pp.prossimaFase.nome + ' (' + formatMoneta(pp.prossimaFase.costo) + ') — confermabile nella pausa invernale.'));
      } else {
        cardProg.appendChild(crea('p', { class: 'card-etichetta margine-sopra' },
          'Fase finale raggiunta. Il completamento è confermabile nella prossima pausa invernale.'));
      }
    } else {
      cardProg.appendChild(crea('p', {}, 'Nessun programma attivo. Il percorso di sviluppo motore interno è avviabile durante la pausa invernale.'));
      cardProg.appendChild(crea('p', { class: 'nota-tecnica' },
        'Investimento totale stimato: ' + formatMoneta(pp.costoTotale) + ' su 4 stagioni. La power unit interna sarà operativa dalla quinta stagione, con una penalità iniziale di prestazione e un token di sviluppo aggiuntivo per stagione.'));
    }
    contenuto.appendChild(cardProg);
  }
}

/* ----------------------------------------------------------
   PANNELLO 5 — ARCHIVIO DATI FP
---------------------------------------------------------- */

function _renderPannelloArchivio() {
  const contenuto = el('contenuto-archivio');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const sessioni = motore.ottieniArchivioFP();

  if (sessioni.length === 0) {
    const card = crea('div', { class: 'card' });
    card.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessun dato raccolto nel weekend corrente.'));
    card.appendChild(crea('p', {}, 'I dati delle prove libere vengono registrati qui dopo ogni sessione. Completa le FP per ottenere stime di performance e input per gli upgrade.'));
    contenuto.appendChild(card);
    return;
  }

  /* Qualità complessiva */
  const qualitaMedia = Math.round(sessioni.reduce((acc, s) => acc + (s.qualitaDati || 0), 0) / sessioni.length);
  const cardRiepilogo = crea('div', { class: 'card' });
  cardRiepilogo.appendChild(crea('p', { class: 'card-etichetta' }, 'Qualità complessiva raccolta dati'));
  cardRiepilogo.appendChild(crea('p', {
    class: 'card-valore',
    'aria-label': `Qualità media dati FP: ${qualitaMedia}%`
  }, qualitaMedia + '%'));
  contenuto.appendChild(cardRiepilogo);

  /* Dettaglio per sessione */
  sessioni.forEach(s => {
    const card = crea('div', { class: 'card margine-sopra' });

    const intestazione = crea('div', { class: 'opzione-intestazione' });
    intestazione.appendChild(crea('span', { class: 'titolo-opzione-upgrade' }, s.sessione));
    intestazione.appendChild(crea('span', { class: 'badge-dipartimento' }, s.qualitaDati + '% qualità'));
    card.appendChild(intestazione);

    const dl = crea('dl', { class: 'dati-opzione-upgrade' });
    [
      ['Programma', _nomeProgrammaFP(s.programma)],
      ['Giri percorsi', s.giriPercorsi || '—'],
      ['Durata', (s.tempoSessione || '—') + ' min']
    ].forEach(([k, v]) => {
      dl.appendChild(crea('dt', {}, k));
      dl.appendChild(crea('dd', {}, String(v)));
    });
    card.appendChild(dl);

    if (s.feedbackStaff) {
      card.appendChild(crea('p', { class: 'nota-tecnica' }, s.feedbackStaff));
    }

    if (s.incidente) {
      card.appendChild(crea('p', { class: 'testo-avviso' }, 'Sessione interrotta da un incidente in pista.'));
    }

    if (s.bonusUpgrade > 0) {
      card.appendChild(crea('p', { class: 'testo-positivo' }, `+${s.bonusUpgrade} punti bonus disponibili per sviluppo upgrade.`));
    }

    contenuto.appendChild(card);
  });

  /* Nota Data Analyst */
  const da = motore.stato.staff?.dataAnalyst;
  if (da) {
    const nota = crea('p', {
      class: 'nota-tecnica margine-sopra',
      role: 'note'
    }, `${da.nome}: i dati raccolti alimentano le stime di performance e le opzioni di sviluppo upgrade.`);
    contenuto.appendChild(nota);
  }
}

function _nomeProgrammaFP(chiave) {
  const nomi = {
    passo_gara: 'Passo gara',
    qualifica: 'Simulazione qualifica',
    aero: 'Raccolta dati aerodinamici',
    meccanico: 'Setup meccanico',
    gomme: 'Test mescole',
    telemetria: 'Telemetria avanzata'
  };
  return nomi[chiave] || chiave;
}

function _renderPannelloInfrastrutture() {
  const contenuto = el('contenuto-infrastrutture');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const stato = motore.stato;
  if (stato.categoria !== 'AR1') {
    const card = crea('div', { class: 'card' });
    card.appendChild(crea('p', { class: 'card-etichetta' }, 'Sezione disponibile solo in AR1.'));
    contenuto.appendChild(card);
    return;
  }

  const dati = motore.ottieniStatoFactory();
  if (!dati) return;

  /* Intestazione riepilogativa */
  const cardIntro = crea('div', { class: 'card' });
  cardIntro.appendChild(crea('p', { class: 'card-etichetta' }, 'Impianti e infrastrutture produttive'));
  cardIntro.appendChild(crea('p', {}, 'Gli impianti influenzano le prestazioni in pista, la velocità di sviluppo e la precisione delle analisi. Più aree possono essere aggiornate contemporaneamente. Gli upgrade richiedono investimenti pluriennali e occupano risorse produttive.'));
  contenuto.appendChild(cardIntro);

  /* Investimenti in corso (se presenti) */
  const inCorso = dati.investimenti.filter(i => !i.completato);
  if (inCorso.length > 0) {
    const cardInv = crea('div', { class: 'box-risorse margine-sopra', 'aria-label': 'Investimenti in corso' });
    cardInv.appendChild(crea('p', { class: 'box-risorse-titolo' }, 'Investimenti in corso'));
    const dl = crea('dl', { class: 'box-risorse-dati' });
    inCorso.forEach(inv => {
      const nomeArea = dati.aree.find(a => a.chiave === inv.area)?.nome || inv.area;
      const roundRimanenti = Math.max(0, inv.roundCompletamento - dati.roundCorrente);
      dl.appendChild(crea('dt', {}, nomeArea + ' → L' + inv.livelloTarget));
      dl.appendChild(crea('dd', {}, roundRimanenti === 0 ? 'Completamento imminente' : roundRimanenti + ' round rimanenti'));
    });
    cardInv.appendChild(dl);
    contenuto.appendChild(cardInv);
  }

  /* Schede per ogni area */
  dati.aree.forEach(area => {
    const scheda = crea('div', { class: 'scheda-infrastruttura margine-sopra', 'aria-label': `${area.nome}, livello ${area.livello} su 5, condizione ${area.condizione}%` });

    /* Intestazione area */
    const intestazione = crea('div', { class: 'intestazione-infrastruttura' });
    const nomeEl = crea('span', { class: 'nome-infrastruttura' }, area.nome);
    /* aria-hidden: la scheda parent ha già aria-label con "livello X su 5" */
    const livelloBadge = crea('span', {
      class: `badge-livello-infrastrutture badge-livello-infrastrutture-${area.livello}`,
      'aria-hidden': 'true'
    }, _simboliLivelloInfrastrutture(area.livello));
    intestazione.appendChild(nomeEl);
    intestazione.appendChild(livelloBadge);
    scheda.appendChild(intestazione);

    /* Effetto */
    scheda.appendChild(crea('p', { class: 'effetto-infrastruttura' }, area.effetto));

    /* Barra condizione */
    scheda.appendChild(crea('p', { class: 'card-etichetta' }, `Condizione: ${area.condizione}%`));
    const barra = crea('div', { class: 'barra-performance', role: 'progressbar', 'aria-valuenow': area.condizione, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': `Condizione impianto: ${area.condizione}%` });
    const riempimento = crea('div', { class: 'riempimento-infrastrutture' });
    riempimento.style.width = area.condizione + '%';
    barra.appendChild(riempimento);
    scheda.appendChild(barra);

    /* Stato investimento o pulsante upgrade */
    if (area.investimentoInCorso) {
      const roundRimanenti = Math.max(0, area.investimentoInCorso.roundCompletamento - dati.roundCorrente);
      const notaInv = crea('p', { class: 'nota-tecnica margine-sopra' }, `Upgrade a livello ${area.investimentoInCorso.livelloTarget} in corso — ${roundRimanenti} round al completamento.`);
      scheda.appendChild(notaInv);
    } else if (area.livello < 5) {
      const livelloProssimo = area.livello + 1;
      const infoUpgrade = dati.tabellaUpgrade[area.livello];
      if (infoUpgrade) {
        const rigaUpgrade = crea('div', { class: 'riga-upgrade-infrastruttura margine-sopra' });
        const info = crea('span', { class: 'info-upgrade-infrastruttura' }, `Upgrade → L${livelloProssimo}: ${formatMoneta(infoUpgrade.costo)}, ${infoUpgrade.rounds} round`);
        const btnUpgrade = crea('button', {
          class: 'btn-secondario btn-upgrade-infrastruttura',
          'aria-label': `Avvia upgrade ${area.nome} al livello ${livelloProssimo}: costo ${formatMoneta(infoUpgrade.costo)}, durata ${infoUpgrade.rounds} round`
        }, 'Avvia upgrade');
        btnUpgrade.addEventListener('click', () => {
          const ris = motore.avviaInvestimentoFactory(area.chiave, livelloProssimo);
          annunciaVoiceOver(ris.messaggio);
          if (ris.successo) _renderPannelloInfrastrutture();
        });
        rigaUpgrade.appendChild(info);
        rigaUpgrade.appendChild(btnUpgrade);
        scheda.appendChild(rigaUpgrade);
      }
    } else {
      scheda.appendChild(crea('p', { class: 'testo-positivo margine-sopra' }, 'Livello massimo raggiunto.'));
    }

    contenuto.appendChild(scheda);
  });
}

function _simboliLivelloInfrastrutture(livello) {
  return '●'.repeat(livello) + '○'.repeat(5 - livello);
}

/* ============================================================
   RENDER SEZIONE: ECONOMIA (solo AR1)
   ============================================================ */

function renderManagement() {
  const nav = document.getElementById('nav-sub-economia');
  if (!nav) return;

  if (!nav.dataset.bound) {
    nav.dataset.bound = '1';
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-pannello-economia]');
      if (!btn) return;
      nav.querySelectorAll('[data-pannello-economia]').forEach(b => {
        b.classList.toggle('attivo', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      _apriPannelloManagement(btn.dataset.pannelloEconomia);
    });
  }

  const pannelloAttivo = nav.querySelector('[data-pannello-economia].attivo')?.dataset.pannelloEconomia || 'budget';
  _apriPannelloManagement(pannelloAttivo);
}

function _apriPannelloManagement(nome) {
  ['budget', 'budget-cap', 'sponsor', 'prize-money', 'bilancio'].forEach(id => {
    const p = document.getElementById('pannello-eco-' + id);
    if (p) p.classList.toggle('nascosta', id !== nome);
  });
  switch (nome) {
    case 'budget':      _renderPannelloEcoBudget();     break;
    case 'budget-cap':  _renderPannelloEcoBudgetCap();  break;
    case 'sponsor':     _renderPannelloEcoSponsor();    break;
    case 'prize-money': _renderPannelloEcoPrizeMoney(); break;
    case 'bilancio':    _renderPannelloEcoBilancio();   break;
  }
}

function _renderPannelloEcoBudget() {
  const contenuto = document.getElementById('contenuto-eco-budget');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.'));
    return;
  }
  const info = motore.ottieniStatoBudget ? motore.ottieniStatoBudget() : null;
  if (!info) { contenuto.appendChild(crea('p', {}, 'Dati non disponibili.')); return; }

  /* Riepilogo budget */
  const cardBudget = crea('div', { class: 'card' });
  cardBudget.appendChild(crea('h3', {}, 'Situazione finanziaria'));
  const dl = crea('dl', { class: 'lista-dati margine-sopra' });
  [['Budget stagionale totale', formatMoneta(info.budgetDisponibile)],
   ['Budget speso (sotto budget cap)', formatMoneta(info.budgetSpeso)],
   ['Residuo disponibile', formatMoneta(info.budgetResiduo)]
  ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
  cardBudget.appendChild(dl);
  if (info.sopraBudgetCap) {
    cardBudget.appendChild(crea('p', { class: 'testo-avviso margine-sopra', role: 'alert' }, 'Attenzione: spesa oltre il limite del budget cap regolamentare.'));
  }
  contenuto.appendChild(cardBudget);

  /* Barra utilizzo budget cap */
  const cardBarra = crea('div', { class: 'card margine-sopra' });
  cardBarra.appendChild(crea('h3', {}, 'Utilizzo budget cap'));
  const percCap = Math.min(100, info.percentualeCapUsata);
  const coloreBarra = percCap >= 95 ? '#FF2222' : percCap >= 80 ? '#FFD700' : 'var(--colore-economia)';
  const barraWrap = crea('div', { class: 'riga-performance' });
  barraWrap.appendChild(crea('span', { class: 'etichetta-performance' }, `Limite: ${formatMoneta(info.limiteCapRegolamentare)}`));
  const statoCap = percCap >= 95 ? 'oltre il limite' : percCap >= 80 ? 'a rischio' : 'nella norma';
  const barra = crea('div', { class: 'barra-performance', role: 'progressbar',
    'aria-valuenow': percCap, 'aria-valuemin': '0', 'aria-valuemax': '100',
    'aria-label': 'Budget cap utilizzato: ' + percCap + '% — ' + statoCap });
  const riemp = crea('div', { class: 'riempimento-performance' });
  riemp.style.width = percCap + '%';
  riemp.style.backgroundColor = coloreBarra;
  barra.appendChild(riemp);
  barraWrap.appendChild(barra);
  barraWrap.appendChild(crea('span', { class: 'valore-performance' }, percCap + '% — ' + statoCap));
  cardBarra.appendChild(barraWrap);
  contenuto.appendChild(cardBarra);

  /* Approccio di allocazione budget */
  const approccioCorrente = motore.ottieniApproccioBudget ? motore.ottieniApproccioBudget() : 'bilanciato';
  const APPROCCI = [
    {
      id: 'aggressivo',
      nome: 'Aggressivo',
      descrizione: 'Priorità assoluta allo sviluppo tecnico. Più risorse per aerodinamica e nuove soluzioni. Meno margine per costi operativi imprevisti.',
    },
    {
      id: 'bilanciato',
      nome: 'Bilanciato',
      descrizione: 'Distribuzione equilibrata tra staff, sviluppo tecnico e operazioni. Approccio standard, riduce il rischio di carenze in un singolo settore.',
    },
    {
      id: 'prudente',
      nome: 'Prudente',
      descrizione: 'Priorità alla stabilità operativa e allo staff. Sviluppo tecnico ridotto. Indicato per stagioni con rischio budget cap o obiettivi di consolidamento.',
    },
  ];
  const cardApproccio = crea('div', { class: 'card margine-sopra' });
  cardApproccio.appendChild(crea('h3', {}, 'Approccio di allocazione budget'));
  cardApproccio.appendChild(crea('p', { class: 'nota-tecnica' }, 'Determina come vengono distribuite le risorse tra le categorie di spesa per la stagione in corso.'));
  const gruppoBtn = crea('div', { class: 'gruppo-azioni margine-sopra', role: 'group', 'aria-label': 'Seleziona approccio budget' });
  APPROCCI.forEach(a => {
    const isAttivo = a.id === approccioCorrente;
    const btn = crea('button', {
      class: 'btn-azione' + (isAttivo ? ' attivo' : ''),
      'aria-pressed': isAttivo ? 'true' : 'false',
      'aria-label': `Approccio ${a.nome}${isAttivo ? ', selezionato' : ''}: ${a.descrizione}`,
    }, a.nome);
    btn.addEventListener('click', () => {
      if (motore.cambiaApproccioBudget) {
        motore.cambiaApproccioBudget(a.id);
        annunciaVoiceOver(`Approccio budget cambiato: ${a.nome}.`);
        _renderPannelloEcoBudget();
      }
    });
    gruppoBtn.appendChild(btn);
  });
  cardApproccio.appendChild(gruppoBtn);
  /* Descrizione approccio selezionato */
  const apprSel = APPROCCI.find(a => a.id === approccioCorrente);
  if (apprSel) {
    cardApproccio.appendChild(crea('p', { class: 'nota-tecnica margine-sopra', 'aria-live': 'polite' }, apprSel.descrizione));
  }
  contenuto.appendChild(cardApproccio);
}

function _renderPannelloEcoBudgetCap() {
  const contenuto = document.getElementById('contenuto-eco-budget-cap');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') { contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.')); return; }
  const categorie = motore.ottieniCategorieSpesa ? motore.ottieniCategorieSpesa() : null;
  if (!categorie) { contenuto.appendChild(crea('p', {}, 'Dati non disponibili.')); return; }

  /* Limite e totale */
  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h3', {}, 'Budget cap regolamentare'));
  const dl = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Riepilogo budget cap' });
  [['Limite regolamentare', formatMoneta(categorie.limiteCap)],
   ['Totale spese soggette a cap', formatMoneta(categorie.totale)],
   ['Utilizzo complessivo', categorie.percentualeCapTotale + '%']
  ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
  card.appendChild(dl);
  contenuto.appendChild(card);

  /* Categorie di spesa */
  const cardCat = crea('div', { class: 'card margine-sopra' });
  cardCat.appendChild(crea('h3', {}, 'Voci di spesa stimate'));
  categorie.categorie.forEach(c => {
    const riga = crea('div', { class: 'riga-performance' });
    riga.appendChild(crea('span', { class: 'etichetta-performance' }, c.nome));
    const barra = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': c.percentualeCapUsata, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': `${c.nome}: ${formatMoneta(c.importo)}` });
    const riemp = crea('div', { class: 'riempimento-performance' });
    riemp.style.width = c.percentualeCapUsata + '%';
    riemp.style.backgroundColor = 'var(--colore-economia)';
    barra.appendChild(riemp);
    riga.appendChild(barra);
    riga.appendChild(crea('span', { class: 'valore-performance' }, formatMoneta(c.importo)));
    cardCat.appendChild(riga);
  });
  contenuto.appendChild(cardCat);

  /* Proiezione fine stagione */
  const proiezione = motore.ottieniProiezioneFineAnno ? motore.ottieniProiezioneFineAnno() : null;
  if (proiezione) {
    const cardProj = crea('div', { class: 'card margine-sopra' });
    cardProj.appendChild(crea('h3', {}, 'Proiezione fine stagione'));
    const dlProj = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Proiezione fine stagione budget cap' });
    const percProj = proiezione.percentualeProiettata;
    const coloreProj = percProj > 100 ? '#FF2222' : percProj > 95 ? '#FFD700' : 'var(--colore-tecnica)';
    const statoPercLabel = percProj > 100 ? ' — Oltre il limite' : percProj > 95 ? ' — A rischio' : ' — Nella norma';
    [['Spesa proiettata a fine stagione', formatMoneta(proiezione.spesaProiettata)],
     ['Margine residuo stimato', formatMoneta(proiezione.margineResiduo)],
     ['Percentuale cap stimata', percProj + '%' + statoPercLabel]
    ].forEach(([k, v]) => {
      dlProj.appendChild(crea('dt', {}, k));
      const dd = crea('dd', {}, v);
      if (k === 'Percentuale cap stimata') dd.style.color = coloreProj;
      dlProj.appendChild(dd);
    });
    cardProj.appendChild(dlProj);
    if (proiezione.aRischio) {
      cardProj.appendChild(crea('p', { class: 'testo-avviso margine-sopra', role: 'alert' },
        'La proiezione indica un rischio concreto di superamento del limite. Rivedere l\'approccio budget o ridurre le spese pianificate.'));
    }
    contenuto.appendChild(cardProj);
  }

  /* Sanzioni */
  const perc = categorie.percentualeCapTotale;
  if (perc > 100) {
    const cardSanzione = crea('div', { class: 'card margine-sopra' });
    cardSanzione.appendChild(crea('h3', { role: 'alert' }, 'Avviso: limite superato'));
    cardSanzione.appendChild(crea('p', {}, `Spese superiori del ${perc - 100}% rispetto al limite. Rischio sanzioni: ammonizione formale, possibile detrazione punti costruttori.`));
    contenuto.appendChild(cardSanzione);
  } else if (perc > 95) {
    const cardWarn = crea('div', { class: 'card margine-sopra' });
    cardWarn.appendChild(crea('p', { class: 'testo-avviso', role: 'alert' }, 'Margine residuo inferiore al 5%. Prestare attenzione a nuove spese.'));
    contenuto.appendChild(cardWarn);
  }
}

function _renderPannelloEcoSponsor() {
  const contenuto = document.getElementById('contenuto-eco-sponsor');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.'));
    return;
  }
  const sponsor = motore.ottieniSponsor ? motore.ottieniSponsor() : [];
  if (sponsor.length === 0) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessun contratto sponsor attivo.'));
    return;
  }
  const CATEGORIE_NOME = {
    principale: 'Sponsor principale',
    partner_tecnico: 'Partner tecnico',
    minore: 'Sponsor minore'
  };
  const stagCorrente = stato.stagione || 1;

  sponsor.forEach(s => {
    const scaduto        = s.scadenza <= stagCorrente;
    const scadenzaProx   = s.scadenza === stagCorrente + 1;
    const scadenzaLontana = s.scadenza > stagCorrente + 1;
    const sodd = s.soddisfazione || 50;
    const coloreSodd = sodd >= 70 ? 'var(--colore-tecnica)' : sodd >= 45 ? 'var(--colore-economia)' : '#FF2222';

    /* Costruisce aria-label completo per la card */
    const dettaglioLabel = motore.ottieniDettaglioSponsor?.(s.id);
    let labelCard = s.nome + ', ' + (CATEGORIE_NOME[s.categoria] || s.categoria);
    labelCard += '. Contributo annuale: ' + formatMoneta(s.importoAnnuale);
    labelCard += '. Scadenza stagione ' + s.scadenza;
    labelCard += '. Obiettivo classifica: top ' + s.obiettivoClassifica;
    if (dettaglioLabel?.posCorrente !== null && dettaglioLabel?.posCorrente !== undefined)
      labelCard += ', ' + (dettaglioLabel.objRaggiunto ? 'raggiunto' : 'non raggiunto');
    if (s.beneficioTecnico) labelCard += '. Beneficio attivo: ' + s.beneficioTecnico.etichetta;
    labelCard += '. Soddisfazione: ' + _statoSoddisfazione(sodd);

    const card = crea('section', { class: 'card margine-sopra', 'aria-label': labelCard });

    /* Intestazione */
    const intestazione = crea('div', { class: 'card-intestazione' });
    intestazione.appendChild(crea('span', { class: 'nome-staff' }, s.nome));
    intestazione.appendChild(crea('span', { class: 'badge-livello-infrastrutture' },
      CATEGORIE_NOME[s.categoria] || s.categoria));
    card.appendChild(intestazione);

    /* Dati contratto — da ottieniDettaglioSponsor se disponibile */
    const dettaglio = motore.ottieniDettaglioSponsor?.(s.id);
    const posCorr   = dettaglio?.posCorrente;
    const objRagg   = dettaglio?.objRaggiunto;
    const stagioniR = dettaglio?.stagioniRimaste ?? Math.max(0, s.scadenza - stagCorrente + 1);

    const dl = crea('dl', { class: 'lista-dati', 'aria-label': 'Condizioni contrattuali ' + s.nome });

    /* Contributo */
    dl.appendChild(crea('dt', {}, 'Contributo annuale'));
    dl.appendChild(crea('dd', {}, formatMoneta(s.importoAnnuale)));

    /* Scadenza */
    dl.appendChild(crea('dt', {}, 'Scadenza contratto'));
    dl.appendChild(crea('dd', {}, 'Stagione ' + s.scadenza + (stagioniR > 0 ? ' — ' + stagioniR + (stagioniR === 1 ? ' stagione rimanente' : ' stagioni rimanenti') : '')));

    /* Obiettivo classifica con status corrente */
    dl.appendChild(crea('dt', {}, 'Obiettivo classifica'));
    const objTesto = 'Top ' + s.obiettivoClassifica
      + (posCorr !== null ? (objRagg ? ' — raggiunto (posizione ' + posCorr + ')' : ' — non raggiunto (posizione ' + posCorr + ')') : '');
    dl.appendChild(crea('dd', {
      class: posCorr !== null ? (objRagg ? 'testo-positivo' : 'testo-avviso') : ''
    }, objTesto));

    /* Meccanica soddisfazione */
    if (dettaglio?.meccanica) {
      dl.appendChild(crea('dt', {}, 'Effetto per gara'));
      dl.appendChild(crea('dd', { class: 'nota-tecnica' },
        dettaglio.meccanica.bonusPerGara + '. ' + dettaglio.meccanica.malusPerGara + '.'));
    }

    card.appendChild(dl);

    /* Beneficio tecnico attivo */
    if (s.beneficioTecnico) {
      const dlBen = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Beneficio tecnico ' + s.nome });
      dlBen.appendChild(crea('dt', {}, 'Beneficio attivo'));
      dlBen.appendChild(crea('dd', { class: 'nota-tecnica' }, s.beneficioTecnico.etichetta));
      dlBen.appendChild(crea('dt', {}, 'Dettaglio'));
      dlBen.appendChild(crea('dd', { class: 'nota-tecnica' }, s.beneficioTecnico.descrizione));
      card.appendChild(dlBen);
    }

    /* Barra soddisfazione */
    const rigaSodd = crea('div', { class: 'riga-performance margine-sopra' });
    rigaSodd.appendChild(crea('span', { class: 'etichetta-performance' }, 'Soddisfazione'));
    const soddTestoStato = _statoSoddisfazione(sodd);
    const barraSodd = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': sodd, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': 'Soddisfazione ' + s.nome + ': ' + soddTestoStato });
    const riempSodd = crea('div', { class: 'riempimento-performance' });
    riempSodd.style.width = sodd + '%';
    riempSodd.style.backgroundColor = coloreSodd;
    barraSodd.appendChild(riempSodd);
    rigaSodd.appendChild(barraSodd);
    rigaSodd.appendChild(crea('span', { class: 'valore-performance' }, soddTestoStato));
    card.appendChild(rigaSodd);

    /* Clausola interruzione anticipata */
    if (dettaglio?.meccanica && !scaduto) {
      const rischioClass = sodd < 20 ? 'testo-avviso' : 'nota-tecnica';
      const rischioTesto = sodd < 20
        ? 'Clausola interruzione anticipata attiva: soddisfazione critica. Rischio di recesso a fine stagione.'
        : dettaglio.meccanica.sogliaClauso;
      card.appendChild(crea('p', { class: rischioClass + ' margine-sopra', role: sodd < 20 ? 'alert' : undefined }, rischioTesto));
    }

    /* Stato contratto + pulsante negoziazione — sempre visibile */
    if (scaduto) {
      card.appendChild(crea('p', { class: 'testo-avviso margine-sopra', role: 'alert' }, 'Contratto scaduto.'));
    } else if (scadenzaProx) {
      card.appendChild(crea('p', { class: 'testo-avviso margine-sopra' }, 'Contratto in scadenza a fine stagione corrente.'));
    }

    const labelBtn = scaduto || scadenzaProx
      ? `Rinnova contratto con ${s.nome}`
      : `Rinegozia contratto con ${s.nome}`;
    const testoBtn = scaduto || scadenzaProx ? 'Rinnova contratto' : 'Rinegozia contratto';
    const btnRinnovo = crea('button', {
      class: 'btn-azione margine-sopra',
      'aria-label': labelBtn,
    }, testoBtn);
    btnRinnovo.addEventListener('click', () => _apriNegoziazioneSponsor(s.id));
    card.appendChild(btnRinnovo);

    contenuto.appendChild(card);
  });

  /* Totale annuale */
  const totale = sponsor.reduce((sum, s) => sum + (s.importoAnnuale || 0), 0);
  const cardTot = crea('div', { class: 'card margine-sopra' });
  cardTot.appendChild(crea('p', { class: 'card-etichetta', 'aria-label': `Totale entrate sponsor annue: ${formatMoneta(totale)}` },
    'Totale entrate sponsor annue: ' + formatMoneta(totale)));
  contenuto.appendChild(cardTot);

  /* Ricerca nuovi sponsor — sempre visibile */
  const risOpp = stato.ricercaSponsorStagione;
  const cardRicerca = crea('div', { class: 'card margine-sopra' });
  cardRicerca.appendChild(crea('h3', {}, 'Ricerca nuovi sponsor'));
  if (risOpp) {
    cardRicerca.appendChild(crea('p', { class: 'nota-tecnica' }, 'Ricerca completata per questa stagione. Proposte ricevute:'));
    const candidati = stato._candidatiSponsor || [];
    if (candidati.length > 0) {
      _renderCandidatiSponsor(cardRicerca, candidati);
    } else {
      cardRicerca.appendChild(crea('p', { class: 'nota-tecnica' }, 'Nessuna proposta in attesa.'));
    }
  } else {
    cardRicerca.appendChild(crea('p', { class: 'nota-tecnica' }, 'Una ricerca per stagione. Avviala per ricevere proposte da potenziali nuovi sponsor.'));
    const btnCerca = crea('button', {
      class: 'btn-azione',
      'aria-label': 'Avvia ricerca nuovi sponsor',
    }, 'Cerca nuovo sponsor');
    btnCerca.addEventListener('click', () => {
      if (motore.ottieniOpportunitaSponsor) {
        const ris = motore.ottieniOpportunitaSponsor();
        const n = (ris.candidati || []).length;
        annunciaVoiceOver(`Ricerca completata. ${n > 0 ? n + ' propost' + (n === 1 ? 'a ricevuta' : 'e ricevute') : 'Nessuna proposta disponibile al momento'}.`);
        _renderPannelloEcoSponsor();
      }
    });
    cardRicerca.appendChild(btnCerca);
  }
  contenuto.appendChild(cardRicerca);
}

function _apriNegoziazioneSponsor(sponsorId) {
  const opzioni = motore.ottieniOpzioniRinnovoSponsor ? motore.ottieniOpzioniRinnovoSponsor(sponsorId) : null;
  if (!opzioni) return;
  const contenuto = document.getElementById('contenuto-eco-sponsor');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const sponsorNome = opzioni.sponsorNome || opzioni.sponsor?.nome || 'Sponsor';

  const intestazioneCard = crea('div', { class: 'card' });
  intestazioneCard.appendChild(crea('h3', {}, `Negoziazione: ${sponsorNome}`));
  intestazioneCard.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    'Tre accordi disponibili. Ogni accordo differisce per struttura economica, durata e benefici alla partnership.'));
  contenuto.appendChild(intestazioneCard);

  opzioni.pacchetti.forEach(p => {
    /* aria-label completo per VoiceOver, include tutte le info senza richiedere navigazione */
    let labelCard = `${p.nome}. ${p.descrizione}`;
    labelCard += ` Contributo annuale: ${formatMoneta(p.importoAnnuale)}.`;
    labelCard += ` Durata: ${p.durata} ${p.durata === 1 ? 'stagione' : 'stagioni'}.`;
    labelCard += ` Obiettivo classifica: top ${p.obiettivoClassifica}.`;
    if (p.beneficioTecnico) labelCard += ` Beneficio: ${p.beneficioTecnico.etichetta}.`;

    const cardP = crea('section', { class: 'card margine-sopra', 'aria-label': labelCard });
    cardP.appendChild(crea('h3', {}, p.nome));
    cardP.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, p.descrizione));

    /* Termini economici e contrattuali */
    const dlTermini = crea('dl', { class: 'lista-dati margine-sopra' });
    [['Contributo annuale', formatMoneta(p.importoAnnuale)],
     ['Durata', p.durata + (p.durata === 1 ? ' stagione' : ' stagioni')],
     ['Valore totale contratto', formatMoneta(p.importoAnnuale * p.durata)],
     ['Obiettivo classifica richiesto', 'Top ' + p.obiettivoClassifica]
    ].forEach(([k, v]) => { dlTermini.appendChild(crea('dt', {}, k)); dlTermini.appendChild(crea('dd', {}, v)); });
    cardP.appendChild(dlTermini);

    /* Beneficio tecnico o infrastrutturale */
    if (p.beneficioTecnico) {
      const dlBen = crea('dl', { class: 'lista-dati margine-sopra' });
      dlBen.appendChild(crea('dt', {}, 'Beneficio incluso'));
      dlBen.appendChild(crea('dd', {}, p.beneficioTecnico.etichetta));
      dlBen.appendChild(crea('dt', {}, 'Descrizione beneficio'));
      dlBen.appendChild(crea('dd', { class: 'nota-tecnica' }, p.beneficioTecnico.descrizione));
      cardP.appendChild(dlBen);
    } else {
      const dlBen = crea('dl', { class: 'lista-dati margine-sopra' });
      dlBen.appendChild(crea('dt', {}, 'Beneficio incluso'));
      dlBen.appendChild(crea('dd', { class: 'nota-tecnica' }, 'Nessuno — accordo puramente finanziario.'));
      cardP.appendChild(dlBen);
    }

    /* Vantaggi e svantaggi */
    if (p.vantaggi?.length) {
      const dlVS = crea('dl', { class: 'lista-dati margine-sopra' });
      dlVS.appendChild(crea('dt', {}, 'Vantaggi'));
      const ddVantaggi = crea('dd', {});
      const ulV = crea('ul', { class: 'lista-semplice' });
      p.vantaggi.forEach(v => ulV.appendChild(crea('li', {}, v)));
      ddVantaggi.appendChild(ulV);
      dlVS.appendChild(ddVantaggi);
      if (p.svantaggi?.length) {
        dlVS.appendChild(crea('dt', {}, 'Svantaggi'));
        const ddSvantaggi = crea('dd', {});
        const ulS = crea('ul', { class: 'lista-semplice' });
        p.svantaggi.forEach(v => ulS.appendChild(crea('li', {}, v)));
        ddSvantaggi.appendChild(ulS);
        dlVS.appendChild(ddSvantaggi);
      }
      cardP.appendChild(dlVS);
    }

    const btnConferma = crea('button', {
      class: 'btn-azione margine-sopra',
      'aria-label': `Firma accordo "${p.nome}" con ${sponsorNome}`,
    }, 'Firma accordo');
    btnConferma.addEventListener('click', () => {
      if (motore.confermaRinnovoSponsor) {
        motore.confermaRinnovoSponsor(sponsorId, p.id);
        annunciaVoiceOver(`Accordo "${p.nome}" firmato con ${sponsorNome}.`);
        _renderPannelloEcoSponsor();
      }
    });
    cardP.appendChild(btnConferma);
    contenuto.appendChild(cardP);
  });

  /* Pulsante annulla */
  const cardAnnulla = crea('div', { class: 'card margine-sopra' });
  const btnAnnulla = crea('button', {
    class: 'btn-azione',
    'aria-label': `Annulla negoziazione con ${sponsorNome} e torna alla lista sponsor`,
  }, 'Annulla negoziazione');
  btnAnnulla.addEventListener('click', () => _renderPannelloEcoSponsor());
  cardAnnulla.appendChild(btnAnnulla);
  contenuto.appendChild(cardAnnulla);
}

function _renderCandidatiSponsor(contenitorePadre, candidati) {
  if (!candidati || candidati.length === 0) return;
  const CATEGORIE_NOME = { principale: 'Sponsor principale', partner_tecnico: 'Partner tecnico', minore: 'Sponsor minore' };
  candidati.forEach(c => {
    let labelCard = `${c.nome}, ${CATEGORIE_NOME[c.categoria] || c.categoria}`;
    labelCard += `. Contributo annuale: ${formatMoneta(c.importoAnnuale)}`;
    labelCard += `. Durata: ${c.durata || 1} ${(c.durata || 1) === 1 ? 'stagione' : 'stagioni'}`;
    labelCard += `. Obiettivo classifica: top ${c.obiettivoClassifica}`;
    if (c.beneficioTecnico) labelCard += `. Beneficio incluso: ${c.beneficioTecnico.etichetta}`;

    const cardC = crea('section', { class: 'card margine-sopra', 'aria-label': labelCard });
    cardC.appendChild(crea('h3', {}, c.nome));

    const dl = crea('dl', { class: 'lista-dati' });
    [['Categoria', CATEGORIE_NOME[c.categoria] || c.categoria],
     ['Contributo annuale', formatMoneta(c.importoAnnuale)],
     ['Durata proposta', (c.durata || 1) + ((c.durata || 1) === 1 ? ' stagione' : ' stagioni')],
     ['Obiettivo classifica', 'Top ' + c.obiettivoClassifica]
    ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
    cardC.appendChild(dl);

    /* Beneficio tecnico del candidato */
    if (c.beneficioTecnico) {
      const dlBen = crea('dl', { class: 'lista-dati margine-sopra' });
      dlBen.appendChild(crea('dt', {}, 'Beneficio incluso'));
      dlBen.appendChild(crea('dd', {}, c.beneficioTecnico.etichetta));
      dlBen.appendChild(crea('dt', {}, 'Descrizione'));
      dlBen.appendChild(crea('dd', { class: 'nota-tecnica' }, c.beneficioTecnico.descrizione));
      cardC.appendChild(dlBen);
    }

    const btnFirma = crea('button', {
      class: 'btn-azione margine-sopra',
      'aria-label': `Firma contratto con ${c.nome}`,
    }, 'Firma contratto');
    btnFirma.addEventListener('click', () => {
      if (motore.confermaNuovoSponsor) {
        motore.confermaNuovoSponsor(c.id);
        annunciaVoiceOver(`Contratto firmato con ${c.nome}.`);
        _renderPannelloEcoSponsor();
      }
    });
    cardC.appendChild(btnFirma);
    contenitorePadre.appendChild(cardC);
  });
}

function _renderPannelloEcoPrizeMoney() {
  const contenuto = document.getElementById('contenuto-eco-prize-money');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.'));
    return;
  }
  const pm = motore.ottieniPrizeMoney ? motore.ottieniPrizeMoney() : null;
  if (!pm) { contenuto.appendChild(crea('p', {}, 'Dati non disponibili.')); return; }

  /* Erogazione corrente */
  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h3', {}, 'Erogazioni Federazione'));
  const dl = crea('dl', { class: 'lista-dati margine-sopra' });
  [['Posizione di riferimento', pm.posizioneClassifica + '°'],
   ['Prize money base', formatMoneta(pm.erogazioneBase)],
   ...(pm.bonusStorico > 0 ? [['Bonus storico fondatori', formatMoneta(pm.bonusStorico)]] : []),
   ['Totale erogazioni', formatMoneta(pm.totale)]
  ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
  card.appendChild(dl);
  contenuto.appendChild(card);

  /* Proiezione basata su classifica attuale */
  const classifica = stato.classificaCostruttori || [];
  const squadraId = stato.squadraId;
  const posAttualeCostr = classifica.findIndex(s => s.squadraId === squadraId) + 1;
  if (posAttualeCostr > 0 && pm.tabella) {
    const importoSeMantenesse = pm.tabella[posAttualeCostr] || 0;
    const cardProj = crea('div', { class: 'card margine-sopra' });
    cardProj.appendChild(crea('h3', {}, 'Proiezione prize money stagione in corso'));
    const dlProj = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Proiezione prize money' });
    const delta = importoSeMantenesse - pm.totale;
    const colDelta = delta > 0 ? 'var(--colore-tecnica)' : delta < 0 ? '#FF2222' : 'inherit';
    [['Posizione attuale in classifica', posAttualeCostr + '°'],
     ['Erogazione stimata (se confermata)', formatMoneta(importoSeMantenesse)],
    ].forEach(([k, v]) => { dlProj.appendChild(crea('dt', {}, k)); dlProj.appendChild(crea('dd', {}, v)); });
    dlProj.appendChild(crea('dt', {}, 'Variazione rispetto alla stagione precedente'));
    const ddDelta = crea('dd', { style: `color:${colDelta}` }, (delta >= 0 ? '+' : '') + formatMoneta(delta));
    dlProj.appendChild(ddDelta);
    cardProj.appendChild(dlProj);
    contenuto.appendChild(cardProj);
  }

  /* Tabella prize money completa */
  const cardTabella = crea('div', { class: 'card margine-sopra' });
  cardTabella.appendChild(crea('h3', {}, 'Tabella erogazioni per posizione'));
  const lista = crea('ol', { class: 'lista-classifica', 'aria-label': 'Tabella prize money' });
  Object.entries(pm.tabella).forEach(([pos, importo]) => {
    const isRif = Number(pos) === pm.posizioneClassifica;
    const isAttuale = Number(pos) === posAttualeCostr;
    const li = crea('li', {
      class: 'riga-classifica' + (isRif ? ' giocatore-highlight' : isAttuale ? ' giocatore-highlight' : ''),
      'aria-label': `${pos}° posto: ${formatMoneta(importo)}${isRif ? ' — posizione di riferimento (stagione precedente)' : ''}${isAttuale && !isRif ? ' — posizione attuale' : ''}`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (Number(pos) <= 3 ? ' podio' : '') }, pos + '°'));
    li.appendChild(crea('span', { class: 'nome-classifica' }, ''));
    li.appendChild(crea('span', { class: 'punti-classifica' }, formatMoneta(importo)));
    lista.appendChild(li);
  });
  cardTabella.appendChild(lista);
  contenuto.appendChild(cardTabella);
}

function _renderPannelloEcoBilancio() {
  const contenuto = document.getElementById('contenuto-eco-bilancio');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.'));
    return;
  }
  const bilancio = motore.ottieniBilancio ? motore.ottieniBilancio() : null;
  if (!bilancio) { contenuto.appendChild(crea('p', {}, 'Dati non disponibili.')); return; }

  /* Entrate */
  const cardEntrate = crea('div', { class: 'card' });
  cardEntrate.appendChild(crea('h3', {}, 'Entrate stagionali'));
  const dlEnt = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Entrate stagionali' });
  [['Prize money Federazione', formatMoneta(bilancio.entrate.prizeMoney)],
   ...(bilancio.entrate.bonusStorico > 0 ? [['Bonus storico fondatori', formatMoneta(bilancio.entrate.bonusStorico)]] : []),
   ['Contratti sponsor', formatMoneta(bilancio.entrate.sponsor)],
   ['Totale entrate stimate', formatMoneta(bilancio.entrate.totale)]
  ].forEach(([k, v]) => { dlEnt.appendChild(crea('dt', {}, k)); dlEnt.appendChild(crea('dd', {}, v)); });
  cardEntrate.appendChild(dlEnt);
  contenuto.appendChild(cardEntrate);

  /* Uscite */
  const cardUscite = crea('div', { class: 'card margine-sopra' });
  cardUscite.appendChild(crea('h3', {}, 'Uscite stagionali'));
  const dlUsc = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Uscite stagionali' });
  [['Spese soggette a budget cap', formatMoneta(bilancio.uscite.totale)]
  ].forEach(([k, v]) => { dlUsc.appendChild(crea('dt', {}, k)); dlUsc.appendChild(crea('dd', {}, v)); });
  cardUscite.appendChild(dlUsc);
  contenuto.appendChild(cardUscite);

  /* Saldo */
  const saldo = bilancio.budgetResiduo;
  const cardSaldo = crea('div', { class: 'card margine-sopra' });
  const dlSaldo = crea('dl', { class: 'lista-dati', 'aria-label': 'Saldo stagionale' });
  dlSaldo.appendChild(crea('dt', {}, 'Budget residuo'));
  dlSaldo.appendChild(crea('dd', { style: saldo < 0 ? 'color:#FF2222' : 'color:var(--colore-tecnica)' }, formatMoneta(saldo)));
  cardSaldo.appendChild(dlSaldo);
  contenuto.appendChild(cardSaldo);

  /* Confronto storico con stagioni AR1 precedenti */
  const storicoAR1 = (stato.storico || []).filter(s => s.categoria === 'AR1');
  if (storicoAR1.length > 0) {
    const cardStorico = crea('div', { class: 'card margine-sopra' });
    cardStorico.appendChild(crea('h3', {}, 'Confronto stagioni precedenti'));
    const lista = crea('ul', { class: 'lista-classifica', 'aria-label': 'Storico bilancio stagioni AR1' });
    storicoAR1.slice().reverse().slice(0, 5).forEach(s => {
      const hasBudget = s.budgetResiduo !== undefined;
      const posFin = s.posizioneFinale || s.posizione || '?';
      const li = crea('li', { class: 'riga-classifica',
        'aria-label': `Stagione ${s.stagione}: posizione ${posFin}°${hasBudget ? `, budget residuo ${formatMoneta(s.budgetResiduo)}` : ''}` });
      li.appendChild(crea('span', { class: 'posizione-classifica' }, `Stag. ${s.stagione}`));
      li.appendChild(crea('span', { class: 'nome-classifica' }, `${posFin}° posto`));
      if (hasBudget) {
        const colS = s.budgetResiduo < 0 ? '#FF2222' : 'var(--colore-tecnica)';
        li.appendChild(crea('span', { class: 'punti-classifica', style: `color:${colS}` }, formatMoneta(s.budgetResiduo)));
      }
      lista.appendChild(li);
    });
    cardStorico.appendChild(lista);
    if (storicoAR1.length > 5) {
      cardStorico.appendChild(crea('p', { class: 'nota-tecnica' }, `Visualizzate le ultime 5 stagioni su ${storicoAR1.length} totali.`));
    }
    contenuto.appendChild(cardStorico);
  }
}

/* ============================================================
   RENDER SEZIONE: RELAZIONI (solo AR1)
   ============================================================ */

function renderRelazioni() {
  const nav = document.getElementById('nav-sub-relazioni');
  if (!nav) return;

  if (!nav.dataset.bound) {
    nav.dataset.bound = '1';
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-pannello-relazioni]');
      if (!btn) return;
      nav.querySelectorAll('[data-pannello-relazioni]').forEach(b => {
        b.classList.toggle('attivo', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      _apriPannelloRelazioni(btn.dataset.pannelloRelazioni);
    });
  }

  const pannelloAttivo = nav.querySelector('[data-pannello-relazioni].attivo')?.dataset.pannelloRelazioni || 'federazione';
  _apriPannelloRelazioni(pannelloAttivo);
}

function _apriPannelloRelazioni(nome) {
  ['federazione', 'sponsor-rel', 'piloti-rel', 'staff-rel', 'media'].forEach(id => {
    const p = document.getElementById('pannello-rel-' + id);
    if (p) p.classList.toggle('nascosta', id !== nome);
  });
  switch (nome) {
    case 'federazione': _renderPannelloRelFederazione(); break;
    case 'sponsor-rel': _renderPannelloRelSponsor();     break;
    case 'piloti-rel':  _renderPannelloRelPiloti();      break;
    case 'staff-rel':   _renderPannelloRelStaff();       break;
    case 'media':       _renderPannelloRelMedia();       break;
  }
}

function _renderPannelloRelFederazione() {
  const contenuto = document.getElementById('contenuto-rel-federazione');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') { contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.')); return; }
  const era = stato.eraRegolamentare;
  if (!era) { contenuto.appendChild(crea('p', {}, 'Nessun dato era regolamentare.')); return; }

  /* Era regolamentare */
  const cardEra = crea('div', { class: 'card' });
  cardEra.appendChild(crea('h3', {}, 'Era regolamentare corrente'));
  const dl = crea('dl', { class: 'lista-dati margine-sopra' });
  const stagioneCorrReg = stato.stagione - era.inizioStagione + 1;
  [['Nome', era.nome],
   ['Stagione corrente', `${stagioneCorrReg}ª di ${era.durataPrevista}`],
   ['Budget cap regolamentare', formatMoneta(era.budgetCapAR1)],
   ['Token sviluppo motore', `${era.limiteTokenMotore} per stagione`]
  ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
  cardEra.appendChild(dl);
  contenuto.appendChild(cardEra);

  /* Negoziazioni disponibili */
  const infoNeg = motore.ottieniNegoziazioniAttive ? motore.ottieniNegoziazioniAttive() : { negoziazioni: [], usatiStagione: {} };
  const usati = infoNeg.usatiStagione || {};
  const rimanentiEra = (era.durataPrevista || 4) - stagioneCorrReg;

  const TIPI_NEG = [
    {
      id: 'proroga_era',
      nome: 'Proroga era regolamentare',
      descrizione: 'Richiedi alla Federazione di estendere l\'era corrente di una stagione. Disponibile solo negli ultimi 2 anni dell\'era.',
      disponibile: !usati.proroga_era && rimanentiEra <= 2
    },
    {
      id: 'chiarimento_tecnico',
      nome: 'Chiarimento tecnico',
      descrizione: 'Richiedi un chiarimento formale su una soluzione tecnica borderline. Protegge la soluzione per la stagione in corso.',
      disponibile: !usati.chiarimento_tecnico
    },
    {
      id: 'modifica_regolamentare',
      nome: 'Proposta di modifica regolamentare',
      descrizione: 'Presenta una proposta formale alla commissione regolamentare. Bassa probabilità di successo, ma possibile impatto su soglie future.',
      disponibile: !usati.modifica_regolamentare
    }
  ];

  const cardNeg = crea('div', { class: 'card margine-sopra' });
  cardNeg.appendChild(crea('h3', {}, 'Negoziazioni con la Federazione'));
  cardNeg.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Una negoziazione per tipo per stagione. L\'esito viene comunicato a distanza di settimane.'));

  TIPI_NEG.forEach(t => {
    const cardT = crea('div', { class: 'card margine-sopra', 'aria-label': `${t.nome}: ${t.disponibile ? 'disponibile' : (usati[t.id] ? 'già avviata questa stagione' : 'prerequisiti non soddisfatti')}` });
    cardT.appendChild(crea('h3', {}, t.nome));
    cardT.appendChild(crea('p', { class: 'nota-tecnica' }, t.descrizione));
    if (usati[t.id]) {
      cardT.appendChild(crea('p', { class: 'testo-avviso' }, 'Già avviata questa stagione.'));
    } else if (!t.disponibile) {
      cardT.appendChild(crea('p', { class: 'nota-tecnica' }, 'Prerequisiti non soddisfatti.'));
    } else {
      const btn = crea('button', {
        class: 'btn-azione margine-sopra',
        'aria-label': `Avvia: ${t.nome}`
      }, 'Avvia negoziazione');
      btn.addEventListener('click', () => {
        const ris = motore.avviaNegoziazioneFederazione(t.id);
        annunciaVoiceOver(ris.messaggio);
        _renderPannelloRelFederazione();
      });
      cardT.appendChild(btn);
    }
    cardNeg.appendChild(cardT);
  });
  contenuto.appendChild(cardNeg);

  /* Negoziazioni in corso / con esito disponibile */
  const attive = infoNeg.negoziazioni.filter(n => !n.esitoRivelato);
  if (attive.length > 0) {
    const cardAttive = crea('div', { class: 'card margine-sopra' });
    cardAttive.appendChild(crea('h3', {}, 'Negoziazioni in corso'));
    attive.forEach(n => {
      const haPendente = n.esitoDisponibile && !n.esitoRivelato;
      const cardN = crea('div', { class: 'card margine-sopra',
        'aria-label': `${n.nome || n.tipo}: ${haPendente ? 'esito disponibile' : 'in attesa di risposta'}` });
      cardN.appendChild(crea('h3', {}, _nomeTipoNeg(n.tipo)));
      if (haPendente) {
        cardN.appendChild(crea('p', { class: 'testo-avviso', role: 'alert', 'aria-live': 'polite' }, 'Esito disponibile: ' + n.testoEsito));
        const btnVisto = crea('button', { class: 'btn-azione margine-sopra', 'aria-label': 'Conferma presa visione' }, 'Presa visione');
        btnVisto.addEventListener('click', () => {
          motore.segnaEsitoNegoziazioneVisto(n.id);
          annunciaVoiceOver('Esito registrato.');
          _renderPannelloRelFederazione();
        });
        cardN.appendChild(btnVisto);
      } else {
        cardN.appendChild(crea('p', { class: 'nota-tecnica' }, n.testoAttesa));
        cardN.appendChild(crea('p', { class: 'nota-tecnica' }, `Avviata al round ${n.roundAvvio + 1}. Esito atteso entro il round ${n.roundRivela + 1}.`));
      }
      cardAttive.appendChild(cardN);
    });
    contenuto.appendChild(cardAttive);
  }
}

function _nomeTipoNeg(tipo) {
  return { proroga_era: 'Proroga era regolamentare', chiarimento_tecnico: 'Chiarimento tecnico', modifica_regolamentare: 'Proposta di modifica' }[tipo] || tipo;
}

function _renderPannelloRelSponsor() {
  const contenuto = document.getElementById('contenuto-rel-sponsor');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') { contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.')); return; }
  const sponsor = motore.ottieniSponsor ? motore.ottieniSponsor() : [];
  const round = stato.roundCorrente;
  const aggiornatiRound = stato.aggiornamentoSponsorRound || {};
  const eventiCount = stato.eventiHospitalityStagione || 0;

  /* Evento Hospitality */
  const staffHosp = stato.staff?.responsabileHospitality;
  const cardHosp = crea('div', { class: 'card' });
  cardHosp.appendChild(crea('h3', {}, 'Evento Hospitality'));
  if (staffHosp) {
    const dlH = crea('dl', { class: 'lista-dati margine-sopra' });
    dlH.appendChild(crea('dt', {}, 'Responsabile'));
    dlH.appendChild(crea('dd', {}, staffHosp.nome || '—'));
    cardHosp.appendChild(dlH);
  } else {
    cardHosp.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Nessun Responsabile Hospitality assegnato. L\'efficacia dell\'evento sarà ridotta.'));
  }
  cardHosp.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    `Organizzati questa stagione: ${eventiCount} di 3. Costo per evento: €200.000. Incremento soddisfazione per tutti gli sponsor attivi.`));
  if (eventiCount < 3) {
    const btnHosp = crea('button', {
      class: 'btn-azione margine-sopra',
      'aria-label': `Organizza evento hospitality (${3 - eventiCount} eventi rimanenti, costo 200.000 euro)`
    }, `Organizza evento (${3 - eventiCount} rimanenti)`);
    btnHosp.addEventListener('click', () => {
      const ris = motore.organizzaEventoHospitality();
      annunciaVoiceOver(ris.messaggio || ris.errore || '');
      _renderPannelloRelSponsor();
    });
    cardHosp.appendChild(btnHosp);
  } else {
    cardHosp.appendChild(crea('p', { class: 'nota-tecnica' }, 'Limite stagionale raggiunto.'));
  }
  contenuto.appendChild(cardHosp);

  if (sponsor.length === 0) {
    contenuto.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Nessun contratto sponsor attivo.'));
    return;
  }

  /* Card per ogni sponsor con stato relazione e pulsante aggiornamento */
  sponsor.forEach(s => {
    const sodd = s.soddisfazione || 50;
    const statoRel = sodd >= 75 ? 'Ottimo' : sodd >= 55 ? 'Buono' : sodd >= 35 ? 'In difficoltà' : 'Critico';
    const coloreSodd = sodd >= 75 ? 'var(--colore-tecnica)' : sodd >= 55 ? 'var(--colore-economia)' : sodd >= 35 ? 'var(--colore-operazioni)' : '#FF2222';
    const aggiornatoQuestoRound = aggiornatiRound[s.id] === round;

    const card = crea('section', { class: 'card margine-sopra',
      'aria-label': `${s.nome}: rapporto ${statoRel}` });
    const intestazione = crea('div', { class: 'card-intestazione' });
    intestazione.appendChild(crea('span', { class: 'nome-staff' }, s.nome));
    intestazione.appendChild(crea('span', { class: 'badge-livello-infrastrutture', style: `background-color:${coloreSodd}; color:#000` }, statoRel));
    card.appendChild(intestazione);

    const detRel    = motore.ottieniDettaglioSponsor?.(s.id);
    const posRelCorr = detRel?.posCorrente;
    const objRelRagg = detRel?.objRaggiunto;
    const stagRimRel = detRel?.stagioniRimaste ?? Math.max(0, s.scadenza - (stato.stagione || 1) + 1);

    const dl = crea('dl', { class: 'lista-dati', 'aria-label': 'Condizioni contrattuali ' + s.nome });

    dl.appendChild(crea('dt', {}, 'Obiettivo classifica'));
    const objRelTesto = 'Top ' + s.obiettivoClassifica + ' costruttori'
      + (posRelCorr !== null && posRelCorr !== undefined
        ? (objRelRagg ? ' — raggiunto (posizione ' + posRelCorr + ')' : ' — non raggiunto (posizione ' + posRelCorr + ')')
        : '');
    dl.appendChild(crea('dd', {
      class: posRelCorr != null ? (objRelRagg ? 'testo-positivo' : 'testo-avviso') : ''
    }, objRelTesto));

    dl.appendChild(crea('dt', {}, 'Scadenza contratto'));
    dl.appendChild(crea('dd', {}, 'Stagione ' + s.scadenza + (stagRimRel > 0 ? ' — ' + stagRimRel + (stagRimRel === 1 ? ' stagione rimanente' : ' stagioni rimanenti') : '')));

    if (detRel?.meccanica) {
      dl.appendChild(crea('dt', {}, 'Effetto soddisfazione'));
      dl.appendChild(crea('dd', { class: 'nota-tecnica' }, detRel.meccanica.bonusPerGara + '. ' + detRel.meccanica.malusPerGara + '.'));
    }

    card.appendChild(dl);

    const riga = crea('div', { class: 'riga-performance margine-sopra' });
    riga.appendChild(crea('span', { class: 'etichetta-performance' }, 'Soddisfazione'));
    const barra = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': sodd, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': 'Soddisfazione ' + s.nome + ': ' + statoRel });
    const riemp = crea('div', { class: 'riempimento-performance' });
    riemp.style.width = sodd + '%';
    riemp.style.backgroundColor = coloreSodd;
    barra.appendChild(riemp);
    riga.appendChild(barra);
    riga.appendChild(crea('span', { class: 'valore-performance' }, statoRel));
    card.appendChild(riga);

    /* Avviso clausola interruzione anticipata */
    if (sodd < 20) {
      card.appendChild(crea('p', { class: 'testo-avviso margine-sopra', role: 'alert' },
        'Soddisfazione critica. Rischio di recesso anticipato del contratto a fine stagione.'));
    } else if (detRel?.meccanica) {
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, detRel.meccanica.sogliaClauso));
    }

    if (aggiornatoQuestoRound) {
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Aggiornamento già inviato in questo round.'));
    } else {
      const btnAgg = crea('button', {
        class: 'btn-azione margine-sopra',
        'aria-label': `Invia aggiornamento a ${s.nome} (disponibile una volta per round)`
      }, 'Invia aggiornamento');
      btnAgg.addEventListener('click', () => {
        const ris = motore.inviaAggiornamentoSponsor(s.id);
        annunciaVoiceOver(ris.messaggio);
        _renderPannelloRelSponsor();
      });
      card.appendChild(btnAgg);
    }
    contenuto.appendChild(card);
  });
}

function _renderPannelloRelPiloti() {
  const contenuto = document.getElementById('contenuto-rel-piloti');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') { contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.')); return; }
  const piloti = stato.piloti || [];
  if (piloti.length === 0) {
    contenuto.appendChild(crea('p', {}, 'Nessun pilota assegnato.'));
    return;
  }
  const round = stato.roundCorrente;
  const colloquiRound = stato.colloquiPilotiRound || {};

  contenuto.appendChild(crea('p', { class: 'nota-tecnica' }, 'Un colloquio per pilota per round. Il tipo di conversazione incide su umore, fedeltà e rendimento in gara.'));

  piloti.forEach(p => {
    const umore    = p.umore    || 500;
    const fedeltà  = p.fedeltà  || 50;
    const umorePerc = Math.round(umore / 10);
    const statoUmore = umore >= 750 ? 'Positivo' : umore >= 450 ? 'Neutro' : 'Negativo';
    const coloreUmore = umore >= 750 ? 'var(--colore-tecnica)' : umore >= 450 ? 'var(--colore-economia)' : '#FF2222';
    const colloquioFatto = colloquiRound[p.id] === round;

    /* Disponibilità al rinnovo: deriva da umore + fedeltà + stagioni rimanenti */
    const scadenza = p.contratto?.scadenza || stato.stagione + 1;
    const stagRimanenti = scadenza - stato.stagione;
    const dispRinnovo = fedeltà >= 70 && umore >= 600 ? 'Alta' :
                        fedeltà >= 50 && umore >= 450 ? 'Nella norma' :
                        fedeltà >= 30 || umore >= 350 ? 'Incerta' : 'Bassa';
    const coloreDisp = { Alta: 'var(--colore-tecnica)', 'Nella norma': 'var(--colore-economia)', Incerta: 'var(--colore-operazioni)', Bassa: '#FF2222' }[dispRinnovo];

    /* Bonus performance attivo da colloquio critico */
    const bonusAttivo = (p.bonusPerformanza?.valore || 0) > 0;

    let labelCard = `${p.nome}: umore ${statoUmore} (${umorePerc}%), fedeltà ${fedeltà}%, disponibilità rinnovo ${dispRinnovo}`;
    if (bonusAttivo) labelCard += `. Bonus performance attivo: ${p.bonusPerformanza.durataRound} round rimanenti`;

    const card = crea('section', { class: 'card margine-sopra', 'aria-label': labelCard });
    const intestazione = crea('div', { class: 'card-intestazione' });
    intestazione.appendChild(crea('span', { class: 'nome-staff' }, (p.nome || '—')));
    intestazione.appendChild(crea('span', { class: 'badge-livello-infrastrutture', style: `background-color:${coloreUmore}; color:#000` }, statoUmore));
    card.appendChild(intestazione);

    /* Dati contratto e disponibilità */
    const dl = crea('dl', { class: 'lista-dati' });
    [['Contratto', `Scade stagione ${scadenza}`],
     ['Disponibilità al rinnovo', dispRinnovo]
    ].forEach(([k, v]) => {
      dl.appendChild(crea('dt', {}, k));
      const dd = crea('dd', {}, v);
      if (k === 'Disponibilità al rinnovo') dd.style.color = coloreDisp;
      dl.appendChild(dd);
    });
    if (bonusAttivo) {
      dl.appendChild(crea('dt', {}, 'Bonus performance (colloquio critico)'));
      dl.appendChild(crea('dd', { style: 'color:var(--colore-tecnica)' }, `Attivo — ${p.bonusPerformanza.durataRound} round rimanenti`));
    }
    card.appendChild(dl);

    /* Barre umore e fedeltà */
    [{ label: 'Umore', valore: umorePerc, colore: coloreUmore },
     { label: 'Fedeltà', valore: fedeltà, colore: 'var(--colore-persone)' }
    ].forEach(({ label, valore, colore }) => {
      const statoVal = label === 'Umore'
        ? (valore >= 75 ? 'buono' : valore >= 50 ? 'sufficiente' : 'basso')
        : (valore >= 80 ? 'alta' : valore >= 55 ? 'media' : 'bassa');
      const riga = crea('div', { class: 'riga-performance' });
      riga.appendChild(crea('span', { class: 'etichetta-performance' }, label));
      const barra = crea('div', { class: 'barra-performance', role: 'progressbar',
        'aria-valuenow': valore, 'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-label': label + ' ' + p.nome + ': ' + valore + '% — ' + statoVal });
      const riemp = crea('div', { class: 'riempimento-performance' });
      riemp.style.width = valore + '%';
      riemp.style.backgroundColor = colore;
      barra.appendChild(riemp);
      riga.appendChild(barra);
      riga.appendChild(crea('span', { class: 'valore-performance' }, valore + '% — ' + statoVal));
      card.appendChild(riga);
    });

    /* Pulsanti colloquio */
    if (colloquioFatto) {
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Colloquio già effettuato in questo round.'));
    } else {
      const gruppoColloqui = crea('div', { class: 'gruppo-azioni margine-sopra', role: 'group',
        'aria-label': `Tipo colloquio con ${p.nome}` });

      const COLLOQUI = [
        {
          id: 'rassicurante',
          etichetta: 'Rassicurante',
          aria: `Colloquio rassicurante con ${p.nome}: stabilizza e migliora l'umore, piccolo incremento fedeltà se umore basso`
        },
        {
          id: 'motivazionale',
          etichetta: 'Motivazionale',
          aria: `Colloquio motivazionale con ${p.nome}: forte incremento umore, ma rischio backfire se la stagione è difficile`
        },
        {
          id: 'critico',
          etichetta: 'Critico',
          aria: `Colloquio critico con ${p.nome}: peggiora umore e fedeltà, ma genera bonus prestazioni per 3 round`
        }
      ];

      COLLOQUI.forEach(c => {
        const btn = crea('button', { class: 'btn-azione', 'aria-label': c.aria }, c.etichetta);
        btn.addEventListener('click', () => {
          const ris = motore.avviaColloquioPilota(p.id, c.id);
          annunciaVoiceOver(ris.messaggio);
          _renderPannelloRelPiloti();
        });
        gruppoColloqui.appendChild(btn);
      });
      card.appendChild(gruppoColloqui);
    }
    contenuto.appendChild(card);
  });
}

function _renderPannelloRelStaff() {
  const contenuto = document.getElementById('contenuto-rel-staff');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (stato.categoria !== 'AR1') { contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.')); return; }
  const staff = stato.staff || {};
  const round = stato.roundCorrente;
  const incontriRound = stato.incontriStaffRound || {};
  const riunioniCount = stato.riunioniSquadraStagione || 0;

  /* Riunione di squadra */
  const cardRiunione = crea('div', { class: 'card' });
  cardRiunione.appendChild(crea('h3', {}, 'Riunione di squadra'));
  cardRiunione.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    `Riunioni effettuate: ${riunioniCount} di 4. Incremento motivazione per tutto lo staff.`));
  if (riunioniCount < 4) {
    const btnRiunione = crea('button', {
      class: 'btn-azione margine-sopra',
      'aria-label': `Convoca riunione di squadra (${4 - riunioniCount} disponibili)`
    }, `Convoca riunione (${4 - riunioniCount} rimanenti)`);
    btnRiunione.addEventListener('click', () => {
      const ris = motore.avviaRiunioneSquadra();
      annunciaVoiceOver(ris.messaggio);
      _renderPannelloRelStaff();
    });
    cardRiunione.appendChild(btnRiunione);
  } else {
    cardRiunione.appendChild(crea('p', { class: 'nota-tecnica' }, 'Limite stagionale raggiunto.'));
  }
  contenuto.appendChild(cardRiunione);

  /* Figure principali */
  const FIGURE = [
    { chiave: 'capoIngegnere',        nome: 'Capo Ingegnere',              statKey: 'coordinamento' },
    { chiave: 'direttoreAero',        nome: 'Direttore Design Aero',       statKey: 'innovazione' },
    { chiave: 'direttoreMeccanica',   nome: 'Direttore Design Meccanico',  statKey: 'innovazione' },
    { chiave: 'direttoreElettronica', nome: 'Direttore Design Elettronica',statKey: 'innovazione' },
    { chiave: 'direttoreGara',        nome: 'Direttore di Gara',           statKey: 'strategia'   },
    { chiave: 'dataAnalyst',          nome: 'Data Analyst Senior',         statKey: 'precisione'  }
  ];

  const classifica = stato.classificaCostruttori || [];
  const pos = (classifica.findIndex(c => c.squadraId === stato.squadraId) + 1) || 8;

  FIGURE.forEach(({ chiave, nome, statKey }) => {
    const membro = staff[chiave];
    if (!membro) return;
    const statValore = membro.statistiche?.[statKey] || 70;
    const bonusMotiv = membro.motivazioneBonus || 0;
    const baseSodd = 50 + (statValore - 70) * 0.5 - (pos - 5) * 2 + bonusMotiv;
    const motivazione = Math.min(100, Math.max(20, Math.round(baseSodd)));
    const coloreM = motivazione >= 70 ? 'var(--colore-tecnica)' : motivazione >= 45 ? 'var(--colore-economia)' : '#FF2222';
    const statoM = motivazione >= 70 ? 'Soddisfatto' : motivazione >= 45 ? 'Neutro' : 'In difficoltà';
    const incontroFatto = incontriRound[chiave] === round;

    const card = crea('section', { class: 'card margine-sopra',
      'aria-label': `${membro.nome || nome}, ${nome}: motivazione ${statoM} (${motivazione}%)` });
    const intestazione = crea('div', { class: 'card-intestazione' });
    intestazione.appendChild(crea('span', { class: 'nome-staff' }, membro.nome || nome));
    intestazione.appendChild(crea('span', { class: 'ruolo-staff' }, nome));
    card.appendChild(intestazione);

    const dl = crea('dl', { class: 'lista-dati' });
    if (membro.contratto?.scadenza) {
      dl.appendChild(crea('dt', {}, 'Contratto'));
      dl.appendChild(crea('dd', {}, `Scade stagione ${membro.contratto.scadenza}`));
    }
    if (bonusMotiv > 0) {
      dl.appendChild(crea('dt', {}, 'Bonus motivazione attivo'));
      dl.appendChild(crea('dd', { style: 'color:var(--colore-tecnica)' }, `+${bonusMotiv} punti`));
    }
    card.appendChild(dl);

    const riga = crea('div', { class: 'riga-performance' });
    riga.appendChild(crea('span', { class: 'etichetta-performance' }, 'Motivazione stimata'));
    const barra = crea('div', { class: 'barra-performance', role: 'progressbar',
      'aria-valuenow': motivazione, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': 'Motivazione ' + (membro.nome || nome) + ': ' + statoM });
    const riemp = crea('div', { class: 'riempimento-performance' });
    riemp.style.width = motivazione + '%';
    riemp.style.backgroundColor = coloreM;
    barra.appendChild(riemp);
    riga.appendChild(barra);
    riga.appendChild(crea('span', { class: 'valore-performance' }, statoM));
    card.appendChild(riga);

    if (incontroFatto) {
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, 'Incontro già effettuato in questo round.'));
    } else {
      const btnIncontro = crea('button', {
        class: 'btn-azione margine-sopra',
        'aria-label': `Incontro individuale con ${membro.nome || nome} (una volta per round)`
      }, 'Incontro individuale');
      btnIncontro.addEventListener('click', () => {
        const ris = motore.avviaIncontroIndividuale(chiave);
        annunciaVoiceOver(ris.messaggio);
        _renderPannelloRelStaff();
      });
      card.appendChild(btnIncontro);
    }
    contenuto.appendChild(card);
  });
}

function _renderPannelloRelMedia() {
  const contenuto = document.getElementById('contenuto-rel-media');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  const round = stato.roundCorrente;

  /* Reputazione mediatica */
  const repMediatica = stato.reputazione?.mediatica || 0;
  const repTecnica   = stato.reputazione?.tecnica   || 0;
  const percM = Math.round((repMediatica / 10000) * 100);
  const livelloMedia = repMediatica >= 7500 ? 'Alta visibilità' : repMediatica >= 5000 ? 'Presenza mediatica' : repMediatica >= 2500 ? 'Visibilità limitata' : 'Presenza ridotta';

  const cardRep = crea('div', { class: 'card' });
  cardRep.appendChild(crea('h3', {}, 'Reputazione mediatica'));
  const rigaM = crea('div', { class: 'riga-performance margine-sopra' });
  rigaM.appendChild(crea('span', { class: 'etichetta-performance' }, livelloMedia));
  const barraM = crea('div', { class: 'barra-performance', role: 'progressbar',
    'aria-valuenow': repMediatica, 'aria-valuemin': '0', 'aria-valuemax': '10000',
    'aria-label': `Reputazione mediatica: ${livelloMedia}` });
  const riempM = crea('div', { class: 'riempimento-performance' });
  riempM.style.width = percM + '%';
  riempM.style.backgroundColor = 'var(--colore-economia)';
  barraM.appendChild(riempM);
  rigaM.appendChild(barraM);
  rigaM.appendChild(crea('span', { class: 'valore-performance' }, livelloMedia));
  cardRep.appendChild(rigaM);
  contenuto.appendChild(cardRep);

  /* Conferenza stampa */
  const conferenzaFatta = stato.conferenzaStampaRound === round;
  const pilotiAlta = (stato.piloti || []).filter(p => (p.visibilitaMediatica || 0) >= 8);
  const cardConf = crea('div', { class: 'card margine-sopra' });
  cardConf.appendChild(crea('h3', {}, 'Conferenza stampa'));
  cardConf.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    'Una per round. Incremento reputazione mediatica +30–50. Amplificata se partecipa un pilota ad alta visibilità (+10–25 extra).'));
  if (conferenzaFatta) {
    cardConf.appendChild(crea('p', { class: 'nota-tecnica' }, 'Già tenuta in questo round.'));
  } else if (pilotiAlta.length > 0) {
    /* Selezione pilota */
    cardConf.appendChild(crea('p', { class: 'nota-tecnica' }, 'Pilota da includere (opzionale — amplifica l\'effetto):'));
    const gruppoConf = crea('div', { class: 'gruppo-azioni', role: 'group', 'aria-label': 'Seleziona pilota per la conferenza stampa' });
    const btnSenzaPilota = crea('button', { class: 'btn-azione', 'aria-label': 'Conferenza stampa senza pilota specifico' }, 'Solo staff');
    btnSenzaPilota.addEventListener('click', () => {
      const ris = motore.organizzaConferenzaStampa(null);
      annunciaVoiceOver(ris.messaggio);
      _renderPannelloRelMedia();
    });
    gruppoConf.appendChild(btnSenzaPilota);
    pilotiAlta.forEach(p => {
      const btn = crea('button', { class: 'btn-azione', 'aria-label': `Conferenza stampa con ${p.nome}` }, p.nome);
      btn.addEventListener('click', () => {
        const ris = motore.organizzaConferenzaStampa(p.id);
        annunciaVoiceOver(ris.messaggio);
        _renderPannelloRelMedia();
      });
      gruppoConf.appendChild(btn);
    });
    cardConf.appendChild(gruppoConf);
  } else {
    const btnConf = crea('button', { class: 'btn-azione margine-sopra', 'aria-label': 'Organizza conferenza stampa' }, 'Organizza conferenza stampa');
    btnConf.addEventListener('click', () => {
      const ris = motore.organizzaConferenzaStampa(null);
      annunciaVoiceOver(ris.messaggio);
      _renderPannelloRelMedia();
    });
    cardConf.appendChild(btnConf);
  }
  contenuto.appendChild(cardConf);

  /* Dichiarazione tecnica */
  const dichiarazioneFatta = stato.dichiarazioneTecnicaStagione;
  const cardDich = crea('div', { class: 'card margine-sopra' });
  cardDich.appendChild(crea('h3', {}, 'Dichiarazione tecnica'));
  cardDich.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    'Una per stagione. Posizionamento come squadra tecnicamente avanzata: reputazione tecnica +70–100.'));
  const dlRepTec = crea('dl', { class: 'lista-dati margine-sopra' });
  dlRepTec.appendChild(crea('dt', {}, 'Reputazione tecnica corrente'));
  dlRepTec.appendChild(crea('dd', {}, _statoReputazione(repTecnica)));
  cardDich.appendChild(dlRepTec);
  if (dichiarazioneFatta) {
    cardDich.appendChild(crea('p', { class: 'nota-tecnica' }, 'Già effettuata questa stagione.'));
  } else {
    const btnDich = crea('button', { class: 'btn-azione margine-sopra', 'aria-label': 'Pubblica dichiarazione tecnica (una per stagione)' }, 'Pubblica dichiarazione tecnica');
    btnDich.addEventListener('click', () => {
      const ris = motore.organizzaDichiarazioneTecnica();
      annunciaVoiceOver(ris.messaggio);
      _renderPannelloRelMedia();
    });
    cardDich.appendChild(btnDich);
  }
  contenuto.appendChild(cardDich);

  /* Social Media Manager */
  if (stato.categoria === 'AR1') {
    const smm = stato.staff?.socialMediaManager;
    const cardSMM = crea('div', { class: 'card margine-sopra' });
    cardSMM.appendChild(crea('h3', {}, 'Social Media Manager'));
    if (smm) {
      const dl = crea('dl', { class: 'lista-dati margine-sopra' });
      dl.appendChild(crea('dt', {}, 'Responsabile')); dl.appendChild(crea('dd', {}, smm.nome || '—'));
      if (smm.contratto?.scadenza) {
        dl.appendChild(crea('dt', {}, 'Contratto')); dl.appendChild(crea('dd', {}, `Scade stagione ${smm.contratto.scadenza}`));
      }
      cardSMM.appendChild(dl);
    } else {
      cardSMM.appendChild(crea('p', { class: 'nota-tecnica' }, 'Posizione non coperta.'));
    }
    contenuto.appendChild(cardSMM);
  }

  /* Piloti con alta visibilità */
  if (pilotiAlta.length > 0) {
    const cardPiloti = crea('div', { class: 'card margine-sopra' });
    cardPiloti.appendChild(crea('h3', {}, 'Piloti con alta visibilità mediatica'));
    pilotiAlta.forEach(p => {
      const dl = crea('dl', { class: 'lista-dati' });
      dl.appendChild(crea('dt', {}, (p.nome || '—')));
      dl.appendChild(crea('dd', { 'aria-label': `Visibilità ${p.nome}: ${_statoVisibilita(p.visibilitaMediatica * 10)}` },
        _statoVisibilita(p.visibilitaMediatica * 10)));
      cardPiloti.appendChild(dl);
    });
    contenuto.appendChild(cardPiloti);
  }
}

/* ============================================================
   RENDER SEZIONE: PANORAMA
   ============================================================ */

function renderPanoramica() {
  const nav = document.getElementById('nav-sub-panorama');
  if (!nav) return;

  if (!nav.dataset.bound) {
    nav.dataset.bound = '1';
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-pannello-panorama]');
      if (!btn) return;
      nav.querySelectorAll('[data-pannello-panorama]').forEach(b => {
        b.classList.toggle('attivo', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      _apriPannelloPanoramica(btn.dataset.pannelloPanorama);
    });
  }

  const pannelloAttivo = nav.querySelector('[data-pannello-panorama].attivo')?.dataset.pannelloPanorama || 'costruttori';
  _apriPannelloPanoramica(pannelloAttivo);
}

function _apriPannelloPanoramica(nome) {
  ['costruttori', 'piloti', 'reputazione', 'storico', 'era-regolamentare', 'rendimenti'].forEach(id => {
    const p = document.getElementById('pannello-pan-' + id);
    if (p) p.classList.toggle('nascosta', id !== nome);
  });
  switch (nome) {
    case 'costruttori':       _renderPannelloPanCostruttori();      break;
    case 'piloti':            _renderPannelloPanPiloti();           break;
    case 'reputazione':       _renderPannelloPanReputazione();      break;
    case 'storico':           _renderPannelloPanStorico();          break;
    case 'era-regolamentare': _renderPannelloPanEraRegolamentare(); break;
    case 'rendimenti':        _renderPannelloPanRendimenti();       break;
  }
}

function _renderPannelloPanCostruttori() {
  const contenuto = document.getElementById('contenuto-pan-costruttori');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;

  /* Contesto round */
  const totaleRound = motore._ottieniCalendario()?.length || 0;
  const roundCompletati = stato.roundCorrente || 0;
  const testoRound = roundCompletati === 0
    ? 'Stagione non ancora iniziata.'
    : `Dopo il round ${roundCompletati} su ${totaleRound}.`;
  contenuto.appendChild(crea('p', { class: 'card-etichetta', 'aria-label': testoRound }, testoRound));

  if (!stato.classificaCostruttori || stato.classificaCostruttori.length === 0) {
    contenuto.appendChild(crea('p', {}, 'Classifica non ancora disponibile.'));
    return;
  }
  const classifica = [...stato.classificaCostruttori].sort((a, b) => b.punti - a.punti);
  const idxGiocatore = classifica.findIndex(s => s.squadraId === stato.squadraId);
  const lista = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica costruttori' });
  classifica.forEach((squadra, idx) => {
    const isGiocatore = squadra.squadraId === stato.squadraId;
    const li = crea('li', {
      class: 'riga-classifica' + (isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}° posto: ${squadra.nomeBreve || squadra.nome}, ${squadra.punti} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, squadra.nomeBreve || squadra.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, String(squadra.punti)));
    lista.appendChild(li);
  });
  contenuto.appendChild(lista);

  /* Confronto competitivo */
  if (idxGiocatore >= 0) {
    const giocatore = classifica[idxGiocatore];
    const leader = classifica[0];
    const davanti = idxGiocatore > 0 ? classifica[idxGiocatore - 1] : null;
    const dietro = idxGiocatore < classifica.length - 1 ? classifica[idxGiocatore + 1] : null;

    const cardGap = crea('div', { class: 'card margine-sopra' });
    cardGap.appendChild(crea('h3', {}, 'Confronto competitivo'));
    const dl = crea('dl', { class: 'lista-dati margine-sopra' });
    if (idxGiocatore > 0) {
      dl.appendChild(crea('dt', {}, 'Gap dal leader'));
      dl.appendChild(crea('dd', {}, `−${leader.punti - giocatore.punti} pt (${leader.nomeBreve || leader.nome})`));
    } else {
      dl.appendChild(crea('dt', {}, 'Posizione'));
      dl.appendChild(crea('dd', {}, 'Leader del campionato'));
    }
    if (davanti) {
      dl.appendChild(crea('dt', {}, 'Gap dalla posizione precedente'));
      dl.appendChild(crea('dd', {}, `−${davanti.punti - giocatore.punti} pt (${davanti.nomeBreve || davanti.nome})`));
    }
    if (dietro) {
      dl.appendChild(crea('dt', {}, 'Vantaggio sulla posizione successiva'));
      dl.appendChild(crea('dd', {}, `+${giocatore.punti - dietro.punti} pt (${dietro.nomeBreve || dietro.nome})`));
    }
    cardGap.appendChild(dl);
    contenuto.appendChild(cardGap);
  }
}

function _renderPannelloPanPiloti() {
  const contenuto = document.getElementById('contenuto-pan-piloti');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  if (!stato.classificaPiloti || stato.classificaPiloti.length === 0) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Classifica non ancora disponibile.'));
    return;
  }

  /* Mappa posizione ultima gara per pilota */
  const posizioneUltimaGara = {};
  if (stato.ultimaGara?.risultati) {
    stato.ultimaGara.risultati.forEach(r => {
      if (r.pilota?.id) posizioneUltimaGara[r.pilota.id] = r.posizione;
    });
  }

  const classifica = [...stato.classificaPiloti].sort((a, b) => b.punti - a.punti);
  const idPilotiGiocatore = new Set((stato.piloti || []).map(p => p.id));

  /* Card confronto intra-squadra */
  const pilotiSquadra = classifica.filter(p => idPilotiGiocatore.has(p.pilotaId));
  if (pilotiSquadra.length >= 1) {
    const cardSquadra = crea('section', {
      class: 'card margine-sopra',
      'aria-label': 'Confronto piloti della tua squadra'
    });
    cardSquadra.appendChild(crea('h3', {}, 'La tua squadra'));
    const dl = crea('dl', { class: 'lista-dati margine-sopra' });
    pilotiSquadra.forEach(p => {
      const posInClassifica = classifica.indexOf(p) + 1;
      const posUltGara = posizioneUltimaGara[p.pilotaId];
      let testo = `${p.punti} pt — ${posInClassifica}° in classifica`;
      if (posUltGara !== undefined) testo += ` — ultima gara: ${posUltGara}°`;
      dl.appendChild(crea('dt', {}, p.nome || p.pilotaId));
      dl.appendChild(crea('dd', {}, testo));
    });
    cardSquadra.appendChild(dl);
    contenuto.appendChild(cardSquadra);
  }

  /* Classifica completa */
  const lista = crea('ol', { class: 'lista-classifica margine-sopra', 'aria-label': 'Classifica piloti completa' });
  classifica.slice(0, 20).forEach((pilota, idx) => {
    const isGiocatore = idPilotiGiocatore.has(pilota.pilotaId);
    const punti = pilota.punti || 0;

    /* Se punti 0, mostra posizione ultima gara se disponibile */
    let etichettaPunti = String(punti);
    if (punti === 0 && posizioneUltimaGara[pilota.pilotaId] !== undefined) {
      etichettaPunti = `0 pt (ult. gara: ${posizioneUltimaGara[pilota.pilotaId]}°)`;
    }

    const li = crea('li', {
      class: 'riga-classifica' + (isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}° posto: ${pilota.nome || pilota.pilotaId}, ${etichettaPunti}`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, (pilota.nome || pilota.pilotaId)));
    li.appendChild(crea('span', { class: 'punti-classifica' }, etichettaPunti));
    lista.appendChild(li);
  });
  contenuto.appendChild(lista);
}

/* Descrizione testuale del contributo di ciascun tipo di reputazione */
function _descrizioneInfluenzaReputazione(chiave) {
  switch (chiave) {
    case 'tecnica':     return 'Influenza l\'attrattività verso ingegneri e staff tecnico di alta qualità.';
    case 'performance': return 'Influenza l\'attrattività verso piloti di talento in fase di mercato.';
    case 'mediatica':   return 'Influenza la capacità di attrarre sponsor importanti e partner di primo piano.';
    case 'finanziaria': return 'Influenza l\'accesso a condizioni contrattuali favorevoli con partner e fornitori.';
    case 'generale':    return 'Componente trasversale. Contribuisce al valore totale della reputazione.';
    default:            return '';
  }
}

function _renderPannelloPanReputazione() {
  const contenuto = document.getElementById('contenuto-pan-reputazione');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  const rep = stato.reputazione || {};
  const repInizio = stato.reputazioneInizioStagione || {};

  const vociRep = [
    { chiave: 'tecnica',     nome: 'Reputazione Tecnica' },
    { chiave: 'performance', nome: 'Reputazione di Performance' },
    { chiave: 'mediatica',   nome: 'Reputazione Mediatica' },
    { chiave: 'finanziaria', nome: 'Reputazione Finanziaria' },
    { chiave: 'generale',    nome: 'Reputazione Generale' }
  ];

  vociRep.forEach(({ chiave, nome }) => {
    const valore = rep[chiave] || 0;
    const valoreInizio = repInizio[chiave] || 0;
    const delta = valore - valoreInizio;
    const segno = delta > 0 ? '+' : '';
    const testoTrend = valoreInizio > 0
      ? `${segno}${delta} rispetto a inizio stagione`
      : 'Nessun dato di confronto disponibile.';
    const descrizione = _descrizioneInfluenzaReputazione(chiave);

    const livRep = _statoReputazione(valore);
    const card = crea('section', {
      class: 'card margine-sopra',
      'aria-label': `${nome}: ${livRep}. ${testoTrend}.`
    });
    card.appendChild(crea('h3', {}, nome));
    const dl = crea('dl', { class: 'lista-dati margine-sopra' });
    dl.appendChild(crea('dt', {}, 'Valore attuale'));
    dl.appendChild(crea('dd', {}, livRep));
    dl.appendChild(crea('dt', {}, 'Variazione stagione'));
    dl.appendChild(crea('dd', {}, testoTrend));
    dl.appendChild(crea('dt', {}, 'Influenza'));
    dl.appendChild(crea('dd', {}, descrizione));
    card.appendChild(dl);
    contenuto.appendChild(card);
  });

  /* Totale */
  const totale = rep.totale || 0;
  const totaleInizio = Object.keys(repInizio).length > 0
    ? Object.values(repInizio).reduce((s, v) => s + (v || 0), 0)
    : null;
  const livTot = _statoReputazione(totale);
  const cardTotale = crea('section', {
    class: 'card margine-sopra',
    'aria-label': `Reputazione totale: ${livTot}`
  });
  cardTotale.appendChild(crea('h3', {}, 'Totale reputazione'));
  const dlTot = crea('dl', { class: 'lista-dati margine-sopra' });
  dlTot.appendChild(crea('dt', {}, 'Punteggio totale'));
  dlTot.appendChild(crea('dd', {}, livTot));
  if (totaleInizio !== null) {
    const deltaT = totale - totaleInizio;
    const segnoT = deltaT >= 0 ? '+' : '';
    dlTot.appendChild(crea('dt', {}, 'Variazione da inizio stagione'));
    dlTot.appendChild(crea('dd', {}, `${segnoT}${deltaT}`));
  }
  cardTotale.appendChild(dlTot);
  contenuto.appendChild(cardTotale);
}

function _renderPannelloPanStorico() {
  const contenuto = document.getElementById('contenuto-pan-storico');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  const storico = stato.storico || [];
  if (storico.length === 0) {
    const card = crea('div', { class: 'card' });
    card.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessuna stagione completata.'));
    card.appendChild(crea('p', {}, 'Lo storico delle stagioni precedenti apparirà qui al termine di ogni stagione.'));
    contenuto.appendChild(card);
    return;
  }

  /* Raggruppa per categoria */
  const perCategoria = { AR1: [], AR2: [], AR3: [] };
  storico.forEach(s => { (perCategoria[s.categoria] || []).push(s); });

  ['AR1', 'AR2', 'AR3'].forEach(cat => {
    const voci = perCategoria[cat];
    if (!voci || voci.length === 0) return;
    const isCategoriaCorrente = stato.categoria === cat;
    const card = crea('div', { class: 'card margine-sopra' });
    const titoloTesto = (cat === 'AR1' ? 'AR1' : cat === 'AR2' ? 'AR2' : 'AR3') +
      (isCategoriaCorrente ? ' — categoria attuale' : '');
    card.appendChild(crea('h3', {}, titoloTesto));

    /* Lista stagioni (dalla più recente) */
    const lista = crea('ul', { class: 'lista-classifica', 'aria-label': `Storico stagioni ${cat}` });
    const vociFiltrate = [...voci].reverse();
    vociFiltrate.forEach((s, i) => {
      const allSquadre = [...(DATI.SQUADRE_AR1 || []), ...(DATI.SQUADRE_AR2 || []), ...(DATI.SQUADRE_AR3 || [])];
      const squadra = allSquadre.find(sq => sq.id === s.squadraId);
      const nomeSquadra = squadra?.nomeBreve || squadra?.nome || s.squadraId || '—';

      /* Calcola trend rispetto alla stagione precedente nella stessa categoria */
      const precedente = vociFiltrate[i + 1]; /* reversed: [i+1] è la stagione prima */
      let freccia = '';
      let testoTrend = '';
      if (precedente) {
        const diff = precedente.posizione - s.posizione; /* positivo = miglioramento */
        if (diff > 0)       { freccia = '↑'; testoTrend = `migliorato di ${diff} posizioni`; }
        else if (diff < 0)  { freccia = '↓'; testoTrend = `peggiorato di ${Math.abs(diff)} posizioni`; }
        else                { freccia = '='; testoTrend = 'stessa posizione dell\'anno precedente'; }
      }

      /* Testo delta ottimizzazione */
      const testoDelta = s.delta !== undefined ? ` — delta ${s.delta}` : '';

      /* Dati aggiuntivi stagione (disponibili nelle stagioni recenti) */
      const migliore = s.miglioreRisultato != null ? s.miglioreRisultato + '°' : '—';
      const podi     = s.numeroPodi != null ? s.numeroPodi : null;
      const testoPodi = podi != null ? `, ${podi} pod${podi === 1 ? 'io' : 'i'}` : '';
      const testoMigliore = s.miglioreRisultato != null ? `, miglior risultato ${migliore}` : '';

      const ariaLabel = `Stagione ${s.stagione}: ${nomeSquadra}, ${s.posizione}° posto, ${s.punti} punti${testoMigliore}${testoPodi}${testoDelta}${testoTrend ? '. Trend: ' + testoTrend : ''}`;
      const li = crea('li', { class: 'riga-classifica riga-classifica--dettaglio', 'aria-label': ariaLabel });
      /* Prima riga: anno + squadra + trend */
      const rigaPrincipale = crea('div', { class: 'riga-storico-principale' });
      rigaPrincipale.appendChild(crea('span', { class: 'posizione-classifica' }, String(s.stagione)));
      rigaPrincipale.appendChild(crea('span', { class: 'nome-classifica' }, nomeSquadra + ' — ' + s.posizione + '°' + (freccia ? ' ' + freccia : '')));
      rigaPrincipale.appendChild(crea('span', { class: 'punti-classifica' }, s.punti + ' pt'));
      li.appendChild(rigaPrincipale);
      /* Seconda riga: dettagli aggiuntivi */
      const dettagli = [];
      if (s.miglioreRisultato != null) dettagli.push('Miglior gara: ' + migliore);
      if (podi != null) dettagli.push('Podi: ' + podi);
      if (s.gareDispute) dettagli.push('Gare: ' + s.gareDispute);
      if (s.eraId) dettagli.push('Era: ' + s.eraId.replace('era_', ''));
      if (dettagli.length > 0) {
        li.appendChild(crea('p', { class: 'dettaglio-storico', 'aria-hidden': 'true' }, dettagli.join(' · ')));
      }
      lista.appendChild(li);
    });
    card.appendChild(lista);
    contenuto.appendChild(card);
  });
}

/* Genera testo narrativo sulle conseguenze del cambio d'era rispetto alla precedente */
function _descrizioneCambioEra(transizione) {
  if (!transizione) return null;
  const { eraPrecedenteNome, deltaAerodinamica, deltaMeccanica, deltaElettronica, deltaPowerUnit } = transizione;
  const deltas = [
    { nome: 'aerodinamica', delta: deltaAerodinamica },
    { nome: 'meccanica',    delta: deltaMeccanica },
    { nome: 'elettronica',  delta: deltaElettronica },
    { nome: 'power unit',   delta: deltaPowerUnit }
  ].filter(d => d.delta !== 0);

  if (deltas.length === 0) {
    return `I pesi tecnici rimangono invariati rispetto all'${eraPrecedenteNome}. Il cambio regolamentare ha modificato altri aspetti del pacchetto tecnico senza ridistribuire le priorità tra le aree.`;
  }

  /* Separa aumenti e cali */
  const aumenti = deltas.filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta);
  const cali    = deltas.filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta);

  const frammenti = [];
  if (aumenti.length > 0) {
    const nomiAum = aumenti.map(d => `${d.nome} (+${d.delta} pp)`).join(', ');
    frammenti.push(`Rispetto all'${eraPrecedenteNome}, il peso di ${nomiAum} è aumentato`);
  }
  if (cali.length > 0) {
    const nomiCalo = cali.map(d => `${d.nome} (${d.delta} pp)`).join(', ');
    frammenti.push(`${cali.length === 1 ? 'mentre' : 'e'} quello di ${nomiCalo} si è ridotto`);
  }

  /* Frase sulle implicazioni competitive */
  const dominante = aumenti[0]?.nome;
  const implicazione = {
    aerodinamica: 'Le squadre che hanno investito maggiormente in galleria del vento e simulatori CFD partono avvantaggiate.',
    meccanica:    'Le squadre con la migliore comprensione del bilanciamento meccanico hanno ora un vantaggio strutturale.',
    elettronica:  'I team con i sistemi di recupero energetico e software di controllo più avanzati beneficiano del cambio.',
    'power unit': 'La scelta del fornitore di motori diventa più rilevante. I costruttori di power unit proprie hanno margine per ampliare il vantaggio.'
  }[dominante] || 'La redistribuzione delle priorità richiede a tutte le squadre una revisione del concept tecnico.';

  return frammenti.join(', ') + '. ' + implicazione;
}

/* Genera una descrizione testuale plausibile per un'era regolamentare */
function _descrizioneEra(era) {
  if (!era) return 'Nessuna era regolamentare attiva.';
  const pesi = {
    aerodinamica: era.pesoAerodinamica || 0,
    meccanica: era.pesoMeccanica || 0,
    elettronica: era.pesoElettronica || 0,
    powerUnit: era.pesoPowerUnit || 0
  };
  const dominante = Object.entries(pesi).sort((a, b) => b[1] - a[1])[0][0];
  const cap = era.budgetCapAR1 ? Math.round(era.budgetCapAR1 / 1000000) : null;
  const capTesto = cap ? ` Il budget cap è fissato a ${cap} milioni di euro.` : '';

  switch (dominante) {
    case 'aerodinamica':
      return `Un'era dominata dall'aerodinamica. Le squadre competono principalmente sulla capacità di generare carico aerodinamico ed efficienza. Le soluzioni di fondo e le derive sono elementi chiave. Il vantaggio tecnico si costruisce in galleria del vento e nei simulatori CFD.${capTesto}`;
    case 'meccanica':
      return `Un'era in cui la meccanica fa la differenza. Le geometrie delle sospensioni, la gestione del trasferimento di carico e le soluzioni idrauliche determinano il ritmo sul giro. Le squadre con la migliore comprensione del bilanciamento meccanico hanno un vantaggio strutturale.${capTesto}`;
    case 'elettronica':
      return `Un'era ad alto contenuto elettronico. I sistemi di recupero dell'energia e il software di controllo della trazione e della frenata sono i principali fattori di differenziazione. Le squadre con i migliori ingegneri di sistema raccolgono i frutti maggiori.${capTesto}`;
    case 'powerUnit':
      return `Un'era in cui il motore torna protagonista. Il differenziale di potenza tra le power unit si amplifica, e la scelta del fornitore di motori ha un impatto diretto sulla competitività. I team costruttori di motori propri hanno un vantaggio potenzialmente decisivo.${capTesto}`;
    default:
      return `Un'era di regolamenti equilibrati. Nessuna singola area tecnica domina il campo; la competizione si gioca su tutti i fronti contemporaneamente. Le squadre più versatili e meglio organizzate tendono a emergere.${capTesto}`;
  }
}

function _renderPannelloPanEraRegolamentare() {
  const contenuto = document.getElementById('contenuto-pan-era-regolamentare');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;
  const era = stato.eraRegolamentare;

  if (!era) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessuna era regolamentare disponibile.'));
    return;
  }

  /* Card dettagli era */
  const cardEra = crea('section', {
    class: 'card',
    'aria-label': `Era regolamentare: ${era.nome}`
  });
  cardEra.appendChild(crea('h3', {}, era.nome));
  const dlEra = crea('dl', { class: 'lista-dati margine-sopra' });
  dlEra.appendChild(crea('dt', {}, 'Stagione di inizio'));
  dlEra.appendChild(crea('dd', {}, String(era.inizioStagione)));
  dlEra.appendChild(crea('dt', {}, 'Durata prevista'));
  dlEra.appendChild(crea('dd', {}, `${era.durataPrevista} stagioni`));
  dlEra.appendChild(crea('dt', {}, 'Stagione attuale'));
  dlEra.appendChild(crea('dd', {}, String(stato.stagione)));
  const stagioneCorrentiEra = stato.stagione - era.inizioStagione + 1;
  dlEra.appendChild(crea('dt', {}, 'Anno nell\'era corrente'));
  dlEra.appendChild(crea('dd', {}, `${stagioneCorrentiEra}° di ${era.durataPrevista}`));
  cardEra.appendChild(dlEra);
  contenuto.appendChild(cardEra);

  /* Card descrizione */
  const cardDesc = crea('section', {
    class: 'card margine-sopra',
    'aria-label': 'Caratteristiche dell\'era regolamentare'
  });
  cardDesc.appendChild(crea('h3', {}, 'Caratteristiche tecniche'));
  cardDesc.appendChild(crea('p', {}, _descrizioneEra(era)));
  contenuto.appendChild(cardDesc);

  /* Card transizione (solo se l'era è frutto di un cambio, non la prima era) */
  if (era.transizione) {
    const testoTransizione = _descrizioneCambioEra(era.transizione);
    if (testoTransizione) {
      const cardTrans = crea('section', {
        class: 'card margine-sopra card-avviso',
        'aria-label': 'Conseguenze del cambio d\'era regolamentare'
      });
      cardTrans.appendChild(crea('h3', {}, 'Conseguenze del cambio d\'era'));
      cardTrans.appendChild(crea('p', { class: 'card-etichetta' }, 'Era precedente: ' + era.transizione.eraPrecedenteNome));
      cardTrans.appendChild(crea('p', {}, testoTransizione));
      contenuto.appendChild(cardTrans);
    }
  }

  /* Card pesi tecnici */
  const cardPesi = crea('section', {
    class: 'card margine-sopra',
    'aria-label': 'Priorità tecniche del regolamento vigente'
  });
  cardPesi.appendChild(crea('h3', {}, 'Priorità tecniche'));
  const dlPesi = crea('dl', { class: 'lista-dati margine-sopra' });
  const areePesi = [
    { chiave: 'pesoAerodinamica', nome: 'Aerodinamica' },
    { chiave: 'pesoMeccanica',    nome: 'Meccanica' },
    { chiave: 'pesoElettronica',  nome: 'Elettronica' },
    { chiave: 'pesoPowerUnit',    nome: 'Power Unit' }
  ];
  areePesi.forEach(({ chiave, nome }) => {
    const perc = Math.round((era[chiave] || 0) * 100);
    dlPesi.appendChild(crea('dt', {}, nome));
    dlPesi.appendChild(crea('dd', {}, `${perc}% del differenziale competitivo`));
  });
  cardPesi.appendChild(dlPesi);
  contenuto.appendChild(cardPesi);

  /* Card regole economiche */
  if (stato.categoria === 'AR1') {
    const cardReg = crea('section', {
      class: 'card margine-sopra',
      'aria-label': 'Regole economiche e limiti tecnici'
    });
    cardReg.appendChild(crea('h3', {}, 'Regole economiche e limiti'));
    const dlReg = crea('dl', { class: 'lista-dati margine-sopra' });
    if (era.budgetCapAR1) {
      dlReg.appendChild(crea('dt', {}, 'Budget cap'));
      dlReg.appendChild(crea('dd', {}, `${(era.budgetCapAR1 / 1000000).toFixed(0)} milioni di euro`));
    }
    if (era.limiteTokenMotore !== undefined) {
      dlReg.appendChild(crea('dt', {}, 'Token sviluppo motore'));
      dlReg.appendChild(crea('dd', {}, `${era.limiteTokenMotore} token per stagione`));
    }

    /* Limite CFD per posizione attuale */
    if (era.limiteOreCFD) {
      const classifica = (stato.classificaCostruttori || []).sort((a, b) => b.punti - a.punti);
      const posizioneAttuale = classifica.findIndex(s => s.squadraId === stato.squadraId) + 1;
      const chiavePosizioni = [
        'primoClassificato', 'secondoClassificato', 'terzoClassificato', 'quartoClassificato',
        'quintoClassificato', 'sestoClassificato', 'settimoClassificato', 'ottavoClassificato',
        'nonoClassificato', 'decimoClassificato'
      ];
      const chiavePos = chiavePosizioni[Math.min(posizioneAttuale - 1, 9)];
      const oreDisponibili = era.limiteOreCFD[chiavePos];
      if (oreDisponibili !== undefined) {
        dlReg.appendChild(crea('dt', {}, 'Limite CFD (posizione attuale)'));
        dlReg.appendChild(crea('dd', {}, `${oreDisponibili} ore/settimana`));
      }

      /* Tabella completa limiti CFD */
      dlReg.appendChild(crea('dt', {}, 'Limiti CFD per posizione'));
      const listaOre = crea('ul', { class: 'lista-semplice' });
      chiavePosizioni.forEach((ch, i) => {
        if (era.limiteOreCFD[ch] !== undefined) {
          const isPos = (i + 1) === posizioneAttuale;
          const testo = `${i + 1}° classificato: ${era.limiteOreCFD[ch]} ore/sett.${isPos ? ' — posizione attuale' : ''}`;
          listaOre.appendChild(crea('li', {}, testo));
        }
      });
      const ddOre = crea('dd', {});
      ddOre.appendChild(listaOre);
      dlReg.appendChild(ddOre);
    }
    cardReg.appendChild(dlReg);
    contenuto.appendChild(cardReg);
  }

  /* Card negoziazioni Federazione attive (sola lettura) */
  const negoziazioni = (stato.negoziazioniAttiveFed || []).filter(n => !n.esitoRivelato);
  if (negoziazioni.length > 0) {
    const cardNeg = crea('section', {
      class: 'card margine-sopra',
      'aria-label': 'Negoziazioni regolamentari in corso con la Federazione'
    });
    cardNeg.appendChild(crea('h3', {}, 'Negoziazioni regolamentari in corso'));
    const lista = crea('ul', { class: 'lista-semplice' });
    negoziazioni.forEach(n => {
      const testo = `${_nomeTipoNeg(n.tipo)} — avviata al round ${n.roundAvvio}. Esito atteso nelle prossime gare.`;
      lista.appendChild(crea('li', {}, testo));
    });
    cardNeg.appendChild(lista);
    contenuto.appendChild(cardNeg);
  }
}

/* ============================================================
   RENDER SEZIONE: PANORAMA — RENDIMENTI PILOTI
   ============================================================ */

function _renderPannelloPanRendimenti() {
  const contenuto = document.getElementById('contenuto-pan-rendimenti');
  if (!contenuto) return;
  contenuto.replaceChildren();
  const stato = motore.stato;

  const classifica = motore.ottieniClassificaRendimenti ? motore.ottieniClassificaRendimenti() : [];

  /* Nota metodologica */
  const cardNota = crea('div', { class: 'card' });
  cardNota.appendChild(crea('p', { class: 'nota-tecnica' },
    'Il rendimento misura quanto ogni pilota supera o delude le aspettative generate dalla ' +
    'qualità della vettura che guida. Un valore positivo indica che il pilota ottiene ' +
    'risultati migliori di quelli che la macchina suggerirebbe. Dati accumulati su tutta la stagione corrente.'));

  if (classifica.length === 0) {
    cardNota.appendChild(crea('p', { class: 'card-etichetta margine-sopra' },
      'Nessun dato disponibile. I rendimenti saranno calcolati dopo la prima gara stagionale.'));
    contenuto.appendChild(cardNota);
    return;
  }

  cardNota.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
    classifica.length + ' piloti — stagione ' + stato.stagione + ' · ' +
    classifica[0].gareContate + ' gare elaborate'));
  contenuto.appendChild(cardNota);

  /* Tabella rendimenti */
  const cardTabella = crea('div', { class: 'card margine-sopra', role: 'region', 'aria-label': 'Classifica rendimenti piloti' });
  cardTabella.appendChild(crea('h3', {}, 'Classifica rendimenti — stagione ' + stato.stagione));

  classifica.forEach((d, idx) => {
    const posizione = idx + 1;
    const classeCard = d.isGiocatoreTeam ? 'scheda-pilota scheda-pilota-giocatore margine-sopra' : 'scheda-pilota margine-sopra';
    const ariaLabel = `${posizione}° — ${d.nomePilota}, ${d.nomeSquadra}: ${d.label}${d.isGiocatoreTeam ? ' — tua squadra' : ''}`;

    const riga = crea('div', { class: classeCard, role: 'article', 'aria-label': ariaLabel });

    /* Intestazione: posizione + nome */
    const intestazione = crea('div', { class: 'intestazione-pilota' });
    const nomeSpan = crea('span', { class: 'nome-pilota' },
      posizione + '. ' + d.nomePilota);
    intestazione.appendChild(nomeSpan);
    if (d.isGiocatoreTeam) {
      intestazione.appendChild(crea('span', { class: 'badge-academy', 'aria-hidden': 'true' }, '★'));
    }
    riga.appendChild(intestazione);

    /* Squadra + età */
    riga.appendChild(crea('p', { class: 'nazionalita-pilota' },
      d.nomeSquadra + ' · ' + d.eta + ' anni · ' + d.gareContate + (d.gareContate === 1 ? ' gara' : ' gare')));

    /* Label rendimento */
    const classeLabel = 'valore-stat-pilota stat-' + (
      d.segno === 'positivo' ? 'buono' :
      d.segno === 'negativo' ? 'debole' : 'sufficiente'
    );
    const spanLabel = crea('span', { class: classeLabel, 'aria-hidden': 'true' }, d.label);
    riga.appendChild(spanLabel);

    cardTabella.appendChild(riga);
  });

  contenuto.appendChild(cardTabella);

  /* Legenda */
  const cardLegenda = crea('div', { class: 'card margine-sopra' });
  cardLegenda.appendChild(crea('h3', {}, 'Legenda'));
  const listaLeg = crea('ul', { class: 'lista-semplice' });
  [
    ['Supera le aspettative', 'Il pilota finisce sistematicamente in posizioni migliori di quelle che la vettura suggerirebbe.'],
    ['Sopra le aspettative', 'Rendimento leggermente superiore al potenziale della macchina.'],
    ['Nei limiti delle aspettative', 'Il pilota estrae circa tutto il potenziale disponibile.'],
    ['Sotto le aspettative', 'Rendimento inferiore a quello atteso dalla vettura.'],
    ['Al di sotto delle aspettative', 'Rendimento sensibilmente peggiore del potenziale della macchina.']
  ].forEach(([titolo, desc]) => {
    listaLeg.appendChild(crea('li', {}, titolo + ': ' + desc));
  });
  cardLegenda.appendChild(listaLeg);
  contenuto.appendChild(cardLegenda);
}

/* ============================================================
   PANNELLO SESSIONE (Briefing, FP, Qualifica, Gara)
   ============================================================ */

function apriPannelloSessione() {
  const pannello = el('pannello-sessione');
  const stato = motore.stato;
  const circuito = motore.ottieniRoundCorrente();
  if (!pannello || !circuito) return;

  ultimoFocusAperturaOverlay = document.activeElement;

  /* Imposta intestazione */
  el('titolo-sessione').textContent = _nomeFase(stato.faseCorrente) + ' — ' + circuito.nome;
  el('descrizione-sessione').textContent = circuito.circuito + ', ' + circuito.paese;

  /* Genera e mostra meteo */
  const meteoWeekend = motore.generaMeteoWeekend(circuito);
  renderMeteo(meteoWeekend, circuito, true);

  /* Imposta contenuto decisioni in base alla fase */
  renderDecisioniSessione(stato.faseCorrente, circuito, meteoWeekend);

  /* Pulsanti azioni sessione.
     Regole non negoziabili:
     - Nessun pulsante può portare le parole Simula, Salta, Automatico o equivalenti.
     - In FP entrambi i pulsanti fissi sono nascosti: l'azione è selezionare un programma.
     - Per qualifica/gara AR1 interattiva: solo btn-simula-sessione ("Partecipa").
     - Per tutte le altre sessioni a esecuzione diretta: solo btn-avanza-fase con label specifica.
     - Per briefing: solo btn-avanza-fase = "Prosegui". */
  const fase        = stato.faseCorrente;
  const isFP        = ['fp1', 'fp2', 'fp3'].includes(fase);
  const isBriefing  = fase === 'briefing';
  const isInterattiva = (stato.categoria === 'AR1' && (fase === 'qualifica' || fase === 'gara')) ||
                        (stato.categoria === 'AR2' && (fase === 'qualifica' || fase === 'gara')) ||
                        (stato.categoria === 'AR3' && fase === 'gara');

  const btnPartecipa = el('btn-simula-sessione');
  const btnAvanza    = el('btn-avanza-fase');

  if (isFP) {
    /* FP: nessun pulsante fisso — il giocatore deve scegliere un programma */
    btnPartecipa.style.display = 'none';
    btnAvanza.style.display    = 'none';
  } else if (isBriefing) {
    btnPartecipa.style.display = 'none';
    btnAvanza.style.display    = '';
    btnAvanza.textContent      = 'Prosegui';
    btnAvanza.setAttribute('aria-label', 'Prosegui alla prima sessione del weekend');
  } else if (isInterattiva) {
    /* Modalità interattiva a checkpoint (AR1 qualifica/gara, AR2 qualifica/gara, AR3 gara) */
    btnPartecipa.style.display = '';
    btnPartecipa.textContent   = 'Partecipa';
    btnPartecipa.setAttribute('aria-label',
      fase === 'qualifica' ? 'Partecipa alle qualifiche con le decisioni ai checkpoint'
                           : 'Partecipa alla gara con le decisioni ai checkpoint');
    btnAvanza.style.display    = 'none';
  } else {
    /* Tutte le altre sessioni: esecuzione diretta (non-AR1 qualifica/gara/sprint) */
    btnPartecipa.style.display = 'none';
    btnAvanza.style.display    = '';
    if (fase === 'qualifica' || fase === 'sprint_qualifica') {
      btnAvanza.textContent = 'Avvia qualifica';
      btnAvanza.setAttribute('aria-label', 'Avvia la sessione di qualifica');
    } else if (fase === 'gara') {
      btnAvanza.textContent = 'Avvia gara';
      btnAvanza.setAttribute('aria-label', 'Avvia la gara');
    } else if (fase === 'sprint') {
      btnAvanza.textContent = 'Avvia sprint';
      btnAvanza.setAttribute('aria-label', 'Avvia la sprint race');
    } else {
      btnAvanza.textContent = 'Avanza';
      btnAvanza.setAttribute('aria-label', 'Avanza alla fase successiva');
    }
  }

  /* Mostra pannello */
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');

  /* Sposta focus al titolo */
  el('titolo-sessione').setAttribute('tabindex', '-1');
  el('titolo-sessione').focus();

  annunciaVoiceOver(_nomeFase(stato.faseCorrente) + ' — ' + circuito.nome + (isFP ? '. Scegli il programma di lavoro.' : '.'));

  /* Mostra tutorial se necessario (AR3, prima occorrenza per questa fase) */
  const testoTutorial = motore.ottieniTestoTutorial(stato.faseCorrente);
  if (testoTutorial) {
    mostraTutorial(testoTutorial, stato.faseCorrente);
  }
}

function chiudiPannelloSessione() {
  const pannello = el('pannello-sessione');
  if (!pannello) return;
  pannello.classList.add('nascosta');
  pannello.setAttribute('aria-hidden', 'true');
  if (ultimoFocusAperturaOverlay) {
    ultimoFocusAperturaOverlay.focus();
    ultimoFocusAperturaOverlay = null;
  }
}

function renderMeteo(meteo, circuito, annuncia = false) {
  const dl = el('dati-meteo');
  if (!dl) return;
  dl.replaceChildren();

  const voci = [
    ['Temperatura pista', meteo.temperaturaPista + '°C'],
    ['Temperatura aria', meteo.temperaturaAria + '°C'],
    ['Condizioni', meteo.pioggia ? `Pioggia (intensità ${meteo.intensitaPioggia}%)` : 'Asciutto'],
    ['Vento', meteo.vento + ' km/h'],
    ['Stabilità meteo', meteo.variabilitaMeteo ? 'Instabile — possibili cambiamenti' : 'Stabile']
  ];

  voci.forEach(([k, v]) => {
    dl.appendChild(crea('dt', {}, k));
    dl.appendChild(crea('dd', {}, v));
  });

  if (annuncia) {
    const condStr = meteo.pioggia ? `Pioggia ${meteo.intensitaPioggia}%` : 'Asciutto';
    annunciaVoiceOver(`Meteo: ${condStr}. Temperatura pista ${meteo.temperaturaPista}°C. Vento ${meteo.vento || 0} km/h${meteo.variabilitaMeteo ? ', condizioni instabili' : ''}.`);
  }
}

function renderDecisioniSessione(fase, circuito, meteo) {
  const contenuto = el('contenuto-decisioni');
  if (!contenuto) return;
  contenuto.replaceChildren();

  if (fase === 'briefing') {
    _renderDecisioniBriefing(contenuto, circuito, meteo);
  } else if (['fp1', 'fp2', 'fp3'].includes(fase)) {
    _renderDecisioniFP(contenuto, circuito, meteo, fase);
  } else if (fase === 'qualifica' || fase === 'sprint_qualifica') {
    _renderDecisioniQualifica(contenuto, circuito, meteo);
  } else if (fase === 'gara' || fase === 'sprint') {
    _renderDecisioniGara(contenuto, circuito, meteo);
  } else if (fase === 'post-gara') {
    _renderPostGara(contenuto);
  }
}

function _renderDecisioniBriefing(contenuto, circuito, meteo) {
  const mescoleConsigliate = motore._mescoleConsigliate(meteo, circuito);

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Briefing pre-weekend'));
  card.appendChild(crea('p', { class: 'card-etichetta' }, 'Il tuo staff ha preparato le seguenti informazioni per il weekend.'));

  /* Consiglio mescole */
  const p = crea('p', { class: 'margine-sopra' }, 'Mescole consigliate dallo staff: ');
  mescoleConsigliate.forEach(m => {
    const mescola = DATI.MESCOLE[m];
    const badge = crea('span', {
      class: `badge-mescola mescola-${m}`,
      style: 'margin-left: 6px;',
      'aria-label': mescola ? mescola.nome : m
    }, m);
    p.appendChild(badge);
  });
  card.appendChild(p);

  /* Caratteristiche circuito */
  if (circuito.caratteristiche && circuito.caratteristiche.length > 0) {
    card.appendChild(crea('p', { class: 'margine-sopra', style: 'color: var(--testo-secondario)' }, 'Note circuito:'));
    const ul = crea('ul', { style: 'margin-top: 4px; padding-left: 20px;' });
    circuito.caratteristiche.forEach(c => ul.appendChild(crea('li', {}, c)));
    card.appendChild(ul);
  }

  contenuto.appendChild(card);
}

function _renderDecisioniFP(contenuto, circuito, meteo, fase) {
  const programmi = [
    { id: 'passo_gara', nome: 'Simulazione passo gara', descrizione: 'Raccoglie dati sul comportamento delle gomme in condizioni di gara.' },
    { id: 'qualifica', nome: 'Simulazione qualifica', descrizione: 'Affina il setup per il singolo giro veloce.' },
    { id: 'aero', nome: 'Raccolta dati aerodinamici', descrizione: 'Dati per il Direttore Design Aerodinamico.' },
    { id: 'meccanico', nome: 'Ottimizzazione setup meccanico', descrizione: 'Sospensioni e bilanciamento per questo asfalto.' },
    { id: 'gomme', nome: 'Test mescole', descrizione: 'Analisi del comportamento delle tre mescole assegnate.' },
    { id: 'telemetria', nome: 'Raccolta dati telemetrici', descrizione: 'Alimenta l\'analisi del Data Analyst per gli upgrade.' }
  ];

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Scegli il programma di allenamento'));

  const lista = crea('ul', { role: 'list', style: 'list-style: none;' });
  programmi.forEach(prog => {
    const li = crea('li', { style: 'margin-bottom: 8px;' });
    const btn = crea('button', {
      class: 'btn-azione btn-secondario',
      style: 'width: 100%; text-align: left; padding: 12px;',
      'aria-label': `${prog.nome}: ${prog.descrizione}`
    });
    btn.appendChild(crea('span', { style: 'display: block; font-weight: 700;' }, prog.nome));
    btn.appendChild(crea('span', { style: 'display: block; font-size: var(--dim-piccolo); color: var(--testo-secondario); font-weight: 400; margin-top: 4px;' }, prog.descrizione));
    btn.addEventListener('click', () => {
      audio.conferma();
      eseguiSessioneFP(prog.id, circuito, meteo, fase);
    });
    li.appendChild(btn);
    lista.appendChild(li);
  });
  card.appendChild(lista);
  contenuto.appendChild(card);
}

function _renderDecisioniQualifica(contenuto, circuito, meteo) {
  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Qualifiche'));
  card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Il tuo staff ha ottimizzato il setup sul singolo giro. Premi il pulsante in alto per avviare la sessione.'));
  contenuto.appendChild(card);
}

function _renderDecisioniGara(contenuto, circuito, meteo) {
  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Strategia gara'));
  card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Definisci la strategia di pit stop per i tuoi piloti prima di avviare la gara. Potrai reagire agli eventi durante la simulazione.'));

  /* Selezione mescola partenza */
  const mescoleDisponibili = circuito.mescole;
  const defaultMescola = mescoleDisponibili[1] || mescoleDisponibili[0];
  if (!motore.stato.mescolaPartenzaScelta) {
    motore.stato.mescolaPartenzaScelta = defaultMescola;
  }
  const btnsMescola = [];
  mescoleDisponibili.forEach((m) => {
    const mescola = DATI.MESCOLE[m];
    const isSelezionata = m === motore.stato.mescolaPartenzaScelta;
    const labelBase = `Parti con mescola ${mescola ? mescola.nome : m}`;
    const btn = crea('button', {
      class: `btn-azione btn-secondario${isSelezionata ? ' selezionato' : ''}`,
      style: 'margin: 4px;',
      'aria-label': labelBase + (isSelezionata ? ', selezionata' : ''),
      'aria-pressed': isSelezionata ? 'true' : 'false'
    }, mescola ? mescola.nome.split(' — ')[1] : m);
    btn.addEventListener('click', () => {
      audio.navigazione();
      motore.stato.mescolaPartenzaScelta = m;
      btnsMescola.forEach(b => {
        b.btn.classList.remove('selezionato');
        b.btn.setAttribute('aria-pressed', 'false');
        b.btn.setAttribute('aria-label', b.labelBase);
      });
      btn.classList.add('selezionato');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', labelBase + ', selezionata');
      annunciaVoiceOver('Mescola di partenza selezionata: ' + (mescola ? mescola.nome : m));
    });
    btnsMescola.push({ btn, labelBase });
    card.appendChild(btn);
  });

  contenuto.appendChild(card);
}

function _renderPostGara(contenuto) {
  const stato = motore.stato;
  const ultimaGara = stato.ultimaGara;

  if (!ultimaGara) {
    contenuto.appendChild(crea('p', {}, 'Nessun dato gara disponibile.'));
    return;
  }

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Risultati gara'));

  const risultatiGiocatore = ultimaGara.risultati.filter(r => r.isGiocatore);
  if (risultatiGiocatore.length > 0) {
    risultatiGiocatore.forEach(r => {
      const p = crea('p', {
        'aria-label': `${r.pilota.nome}: ${r.posizione}° posto, ${r.puntiGuadagnati} punti`
      }, `${r.pilota.nome}: ${r.posizione}° posto · ${r.puntiGuadagnati} punti`);
      card.appendChild(p);
    });
  }

  /* Classifica top 5 */
  card.appendChild(crea('h4', { class: 'margine-sopra' }, 'Classifica finale'));
  const top10 = ultimaGara.risultati.slice(0, 10);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica top 10' });
  top10.forEach((r, idx) => {
    const li = crea('li', {
      class: 'riga-classifica' + (r.isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota.nome} — ${r.puntiGuadagnati} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, String(r.puntiGuadagnati)));
    ol.appendChild(li);
  });
  card.appendChild(ol);
  contenuto.appendChild(card);
  /* btn-avanza-fase in cima al pannello è già impostato a "Prosegui" dal chiamante */
}

/* ============================================================
   ESECUZIONE SESSIONI
   ============================================================ */

function eseguiSessioneFP(programma, circuito, meteo, fase) {
  const meteoSessione = motore.generaMeteoSessione(meteo);
  const risultato = motore.simulaSessioneFP(circuito, meteoSessione, programma);

  const contenuto = el('contenuto-decisioni');
  contenuto.replaceChildren();

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Risultato sessione'));
  card.appendChild(crea('p', {
    'aria-label': `Qualità dati raccolta: ${risultato.qualitaDati}%`,
    style: 'font-size: var(--dim-sezione); font-weight: 700;'
  }, `Qualità dati: ${risultato.qualitaDati}%`));
  card.appendChild(crea('p', { class: 'margine-sopra' }, risultato.feedbackStaff));

  if (risultato.incidente) {
    card.appendChild(crea('p', {
      class: 'messaggio-stato messaggio-avviso margine-sopra',
      role: 'alert'
    }, 'Incidente minore durante la sessione. Nessuna conseguenza grave.'));
    audio.eventoImprevisto();
  }

  contenuto.appendChild(card);

  /* Aggiorna btn-avanza-fase (già sopra al contenuto nel DOM) ad "Avanza" */
  _aggiornaBtnAvanzaFase('Avanza', 'Chiudi la sessione e avanza alla fase successiva', () => {
    audio.fineSessione();
    chiudiPannelloSessione();
    motore.avanzaFase();
    _routerPrincipale();
  });

  annunciaVoiceOver(`Sessione completata. Qualità dati: ${risultato.qualitaDati}%. ${risultato.feedbackStaff}`);
  audio.notificaStaff();
  audio.fineSessione();
}

function simulaSessioneCorrente() {
  const stato = motore.stato;
  const circuito = motore.ottieniRoundCorrente();
  if (!circuito) return;

  const meteo = motore.generaMeteoWeekend(circuito);
  const fase  = stato.faseCorrente;
  const isAR3  = stato.categoria === 'AR3';

  if (['fp1', 'fp2', 'fp3'].includes(fase)) {
    eseguiSessioneFP('passo_gara', circuito, meteo, fase);
    return;
  }

  if (fase === 'qualifica' || fase === 'sprint_qualifica') {
    if (stato.categoria === 'AR1' && fase === 'qualifica') {
      /* AR1: modalità interattiva a checkpoint — chiude pannello-sessione e apre pannello dedicato */
      chiudiPannelloSessione();
      avviaQualificaAR1(circuito, meteo);
      return;
    }
    if (stato.categoria === 'AR2' && fase === 'qualifica') {
      chiudiPannelloSessione();
      avviaQualificaAR2Checkpoint(circuito, meteo);
      return;
    }
    const meteoQ = motore.generaMeteoSessione(meteo);
    const griglia = isAR3
      ? motore.simulaQualificaAR3(circuito, meteoQ)
      : motore.simulaQualifica(circuito, meteoQ);
    mostraRisultatiQualifica(griglia, circuito);
    return;
  }

  if (fase === 'sprint') {
    const meteoS = motore.generaMeteoSessione(meteo);
    const risultato = isAR3
      ? motore.simulaSprintAR3(circuito, meteoS)
      : motore.simulaGara({ ...circuito, giri: Math.round(circuito.giri * 0.33) }, meteoS, stato.grigliaPartenza, {});
    if (risultato) {
      /* NON avanzare il motore qui: l'avanzamento avviene nel callback di mostraRisultatiSprint */
      mostraRisultatiSprint(risultato, circuito);
    }
    return;
  }

  if (fase === 'gara') {
    if (stato.categoria === 'AR1') {
      /* AR1: modalità interattiva a checkpoint */
      chiudiPannelloSessione();
      avviaGaraAR1(circuito, meteo);
      return;
    }
    if (stato.categoria === 'AR2') {
      chiudiPannelloSessione();
      avviaGaraAR2Checkpoint(circuito, meteo);
      return;
    }
    if (stato.categoria === 'AR3') {
      chiudiPannelloSessione();
      avviaGaraAR3Checkpoint(circuito, meteo);
      return;
    }
    /* Fallback: simulazione diretta (non dovrebbe essere raggiunto) */
    const griglia = stato.grigliaPartenza || (isAR3
      ? motore.simulaQualificaAR3(circuito, meteo)
      : motore.simulaQualifica(circuito, meteo));
    motore.simulaGara(circuito, meteo, griglia, {});
    motore.aggiornaDeltaOttimizzazione();
    /* faseCorrente è ancora 'gara'; l'avanzamento avviene nel callback del pulsante */
    el('titolo-sessione').textContent = 'Post-gara — ' + circuito.nome;
    renderDecisioniSessione('post-gara', circuito, meteo);
    el('btn-simula-sessione').style.display = 'none';
    _aggiornaBtnAvanzaFase('Prosegui', 'Chiudi il resoconto e prosegui', () => {
      chiudiPannelloSessione();
      motore.avanzaFase();   /* gara → post-gara */
      _routerPrincipale();   /* post-gara auto-attraversato → inter-gara */
    });
    annunciaVoiceOver('Gara terminata. Consulta i risultati nel resoconto.');
    audio.fineSessione();
    return;
  }

  /* Fasi non simulabili: avanza direttamente */
  avanzaFase();
}

function simulaSessioneAuto() {
  const stato = motore.stato;
  const circuito = motore.ottieniRoundCorrente();
  if (!circuito) return;

  const meteo   = motore.generaMeteoWeekend(circuito);
  const fase    = stato.faseCorrente;
  const isAR3   = stato.categoria === 'AR3';

  if (['fp1', 'fp2', 'fp3'].includes(fase)) {
    eseguiSessioneFP('passo_gara', circuito, meteo, fase);
    return;
  }

  if (fase === 'qualifica' || fase === 'sprint_qualifica') {
    const meteoQ = motore.generaMeteoSessione(meteo);
    const griglia = isAR3
      ? motore.simulaQualificaAR3(circuito, meteoQ)
      : motore.simulaQualifica(circuito, meteoQ);
    mostraRisultatiQualifica(griglia, circuito);
    return;
  }

  if (fase === 'sprint') {
    const meteoS = motore.generaMeteoSessione(meteo);
    const risultato = isAR3
      ? motore.simulaSprintAR3(circuito, meteoS)
      : motore.simulaGara({ ...circuito, giri: Math.round(circuito.giri * 0.33) }, meteoS, stato.grigliaPartenza, {});
    if (risultato) {
      /* NON avanzare il motore qui: l'avanzamento avviene nel callback di mostraRisultatiSprint */
      mostraRisultatiSprint(risultato, circuito);
    }
    return;
  }

  if (fase === 'gara') {
    if (stato.categoria === 'AR1') {
      /* AR1 auto: avvia e loop checkpoint con decisioni default */
      const meteoGara = motore.generaMeteoSessione(meteo);
      motore.iniziaGaraAR1(circuito, meteoGara);
      const deciDefault = { pilota1: { ritmo: 'normale', pitStop: null }, pilota2: { ritmo: 'normale', pitStop: null } };
      let ris;
      let n = 0;
      do {
        ris = motore.simulaGaraAR1AlCheckpoint(deciDefault);
        deciDefault.pilota1.pitStop = null;
        deciDefault.pilota2.pitStop = null;
        n++;
      } while (ris && !ris.eConclusaGara && n < 60);
      motore.aggiornaDeltaOttimizzazione();
      /* faseCorrente è ancora 'gara'; l'avanzamento avviene nel callback del pulsante */
      el('titolo-sessione').textContent = 'Post-gara — ' + circuito.nome;
      renderDecisioniSessione('post-gara', circuito, meteoGara);
      const pannello = el('pannello-sessione');
      pannello.classList.remove('nascosta');
      pannello.removeAttribute('aria-hidden');
      el('titolo-sessione').setAttribute('tabindex', '-1');
      el('titolo-sessione').focus();
      el('btn-simula-sessione').style.display = 'none';
      _aggiornaBtnAvanzaFase('Prosegui', 'Chiudi il resoconto e prosegui', () => {
        chiudiPannelloSessione();
        motore.avanzaFase();   /* gara → post-gara */
        _routerPrincipale();   /* post-gara auto-attraversato → inter-gara */
      });
      annunciaVoiceOver('Gara completata. Consulta i risultati.');
      audio.fineSessione();
      return;
    }
    /* AR2/AR3 auto */
    const griglia = stato.grigliaPartenza || (isAR3
      ? motore.simulaQualificaAR3(circuito, meteo)
      : motore.simulaQualifica(circuito, meteo));
    motore.simulaGara(circuito, meteo, griglia, {});
    motore.aggiornaDeltaOttimizzazione();
    /* faseCorrente è ancora 'gara'; l'avanzamento avviene nel callback del pulsante */
    el('titolo-sessione').textContent = 'Post-gara — ' + circuito.nome;
    renderDecisioniSessione('post-gara', circuito, meteo);
    el('btn-simula-sessione').style.display = 'none';
    _aggiornaBtnAvanzaFase('Prosegui', 'Chiudi il resoconto e prosegui', () => {
      chiudiPannelloSessione();
      motore.avanzaFase();   /* gara → post-gara */
      _routerPrincipale();   /* post-gara auto-attraversato → inter-gara */
    });
    annunciaVoiceOver('Gara terminata. Consulta i risultati nel resoconto.');
    audio.fineSessione();
    return;
  }

  avanzaFase();
}

function mostraRisultatiQualifica(griglia, circuito) {
  const contenuto = el('contenuto-decisioni');
  contenuto.replaceChildren();

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Griglia di partenza'));

  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Griglia di partenza qualifica' });
  griglia.slice(0, 20).forEach((r, idx) => {
    const li = crea('li', {
      class: 'riga-classifica' + (r.isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota.nome} — ${r.tempoFormattato}`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, r.tempoFormattato));
    ol.appendChild(li);
  });
  card.appendChild(ol);
  contenuto.appendChild(card);

  /* Aggiorna btn-avanza-fase (sopra al contenuto nel DOM) ad "Avanza" */
  _aggiornaBtnAvanzaFase('Avanza', 'Chiudi le qualifiche e avanza alla fase successiva', () => {
    audio.fineSessione();
    chiudiPannelloSessione();
    motore.avanzaFase();
    _routerPrincipale();
  });

  annunciaVoiceOver('Qualifiche completate. ' + griglia[0]?.pilota?.nome + ' partirà dalla pole position.');
}

/* ============================================================
   HELPER — aggiorna btn-avanza-fase sostituendolo con clone fresco
   (evita accumulo di event listener dopo più sessioni nello stesso weekend)
   Se callback è omesso, il click usa il binding originale (avanzaFase per
   fasi non-sessione, simulaSessioneAuto per fasi sessione).
   ============================================================ */
function _aggiornaBtnAvanzaFase(testo, ariaLabel, callback) {
  const vecchio = el('btn-avanza-fase');
  if (!vecchio) return;
  const nuovo = vecchio.cloneNode(false);
  nuovo.textContent = testo;
  nuovo.setAttribute('aria-label', ariaLabel);
  nuovo.style.display = '';
  if (callback) {
    nuovo.addEventListener('click', () => { audio.navigazione(); callback(); });
  } else {
    /* Binding di default: avanza senza simulare (usato per Prosegui post-gara) */
    nuovo.addEventListener('click', () => { audio.navigazione(); avanzaFase(); });
  }
  vecchio.parentNode.replaceChild(nuovo, vecchio);
}

/* ============================================================
   SALTA INTERO WEEKEND
   Scelta offerta una sola volta, prima del briefing.
   Simula tutto il weekend silenziosamente e porta direttamente
   all'inter-gara senza mostrare nessuna sessione al giocatore.
   ============================================================ */
function saltaInteroWeekend() {
  mostraDialogo(
    'Salta il weekend',
    'Il weekend verrà eseguito automaticamente. Passerai direttamente all\'inter-gara.',
    _eseguiSaltaWeekend
  );
}

function _eseguiSaltaWeekend() {
  const circuito = motore.ottieniRoundCorrente();
  if (!circuito) return;

  const meteo  = motore.generaMeteoWeekend(circuito);
  const isAR3  = motore.stato.categoria === 'AR3';
  const isAR1  = motore.stato.categoria === 'AR1';

  /* Avanza oltre il briefing */
  motore.avanzaFase();

  /* Simula tutte le fasi rimanenti fino a inter-gara */
  let iter = 0;
  while (!['inter-gara', 'pausa_invernale', 'pausa_estiva'].includes(motore.stato.faseCorrente) && iter < 25) {
    const fase = motore.stato.faseCorrente;
    iter++;

    if (['fp1', 'fp2', 'fp3'].includes(fase)) {
      const ms = motore.generaMeteoSessione(meteo);
      motore.simulaSessioneFP(circuito, ms, 'passo_gara');
      motore.avanzaFase();

    } else if (fase === 'qualifica' || fase === 'sprint_qualifica') {
      const mq = motore.generaMeteoSessione(meteo);
      if (isAR3) motore.simulaQualificaAR3(circuito, mq);
      else       motore.simulaQualifica(circuito, mq);
      motore.avanzaFase();

    } else if (fase === 'sprint') {
      const ms2 = motore.generaMeteoSessione(meteo);
      const giriS = Math.round(circuito.giri * 0.33);
      const griglia = motore.stato.grigliaPartenza;
      if (isAR3) motore.simulaSprintAR3(circuito, ms2);
      else       motore.simulaGara({ ...circuito, giri: giriS }, ms2, griglia, {});
      motore.avanzaFase();

    } else if (fase === 'gara') {
      if (isAR1) {
        const mg = motore.generaMeteoSessione(meteo);
        motore.iniziaGaraAR1(circuito, mg);
        const dec = { pilota1: { ritmo: 'normale', pitStop: null }, pilota2: { ritmo: 'normale', pitStop: null } };
        let ris; let n = 0;
        do {
          ris = motore.simulaGaraAR1AlCheckpoint(dec);
          dec.pilota1.pitStop = null;
          dec.pilota2.pitStop = null;
          n++;
        } while (ris && !ris.eConclusaGara && n < 60);
        motore.aggiornaDeltaOttimizzazione();
      } else {
        const mg2 = motore.generaMeteoSessione(meteo);
        const gr = motore.stato.grigliaPartenza || (isAR3
          ? motore.simulaQualificaAR3(circuito, mg2)
          : motore.simulaQualifica(circuito, mg2));
        motore.simulaGara(circuito, mg2, gr, {});
        motore.aggiornaDeltaOttimizzazione();
      }
      motore.avanzaFase();

    } else {
      /* post-gara o altre fasi: avanza direttamente */
      motore.avanzaFase();
    }
  }

  audio.fineSessione();
  _routerPrincipale();
}

function avanzaFase() {
  chiudiPannelloSessione();
  motore.avanzaFase();
  _routerPrincipale();
}

/* ============================================================
   ROUTER CENTRALIZZATO
   Unico punto di decisione per la navigazione.
   Chiamato dopo OGNI transizione di stato del motore.
   Legge faseCorrente e decide cosa mostrare senza logica
   di routing dispersa in funzioni diverse.

   Mappa completa dei valori di faseCorrente:
   - 'briefing' | 'fp1' | 'fp2' | 'fp3' | 'qualifica' | 'sprint_qualifica'
     | 'sprint' | 'gara'  → fasi del weekend: mostra operazioni
   - 'post-gara'           → non interattiva: auto-avanza a inter-gara
   - 'pausa_estiva'        → non interattiva: auto-avanza a inter-gara
   - 'inter-gara'          → mostra overlay inter-gara (AR1 o AR2/AR3)
   - 'pausa_invernale'     → mostra schermata fine stagione (poi pausa invernale AR1)
   ============================================================ */
function _routerPrincipale() {
  const stato = motore.stato;
  const fase  = stato.faseCorrente;

  aggiornaStatusBar(stato);

  /* Fasi non interattive: auto-attraversamento senza input utente */
  if (fase === 'pausa_estiva') {
    motore.uscitaDaPausaEstiva();       /* → inter-gara */
    _routerPrincipale();
    return;
  }
  if (fase === 'post-gara') {
    motore.avanzaFase();               /* → inter-gara via _terminaRound() */
    _routerPrincipale();
    return;
  }

  /* Overlay inter-gara */
  if (fase === 'inter-gara') {
    if (stato.categoria === 'AR1') {
      mostraIntergaraAR1();
    } else {
      mostraIntergaraAR3();            /* usato per AR2 e AR3 */
    }
    return;
  }

  /* Fine stagione → pausa invernale (AR1) o nuova stagione (AR2/AR3) */
  if (fase === 'pausa_invernale') {
    mostraFineStagione();
    return;
  }

  /* Tutte le fasi del weekend: briefing, fp1, fp2, fp3, qualifica,
     sprint_qualifica, sprint, gara → mostra sezione operazioni */
  chiudiPannelloSessione();
  apriSezione('operazioni');
}

/* ============================================================
   DIALOGO DI CONFERMA
   ============================================================ */

let _callbackConferma = null;

function mostraDialogo(titolo, testo, callbackSi) {
  _callbackConferma = callbackSi;
  el('titolo-dialogo').textContent = titolo;
  el('testo-dialogo').textContent = testo;

  ultimoFocusAperturaOverlay = document.activeElement;
  el('dialogo-conferma').classList.remove('nascosta');
  el('dialogo-conferma').removeAttribute('aria-hidden');
  el('btn-conferma-si').setAttribute('aria-label', 'Conferma: ' + titolo);
  el('btn-conferma-no').setAttribute('aria-label', 'Annulla: ' + titolo);
  el('btn-conferma-si').focus();

  annunciaVoiceOver(titolo + '. ' + testo);
}

function _chiudiDialogo(confermato) {
  el('dialogo-conferma').classList.add('nascosta');
  el('dialogo-conferma').setAttribute('aria-hidden', 'true');
  if (ultimoFocusAperturaOverlay) {
    ultimoFocusAperturaOverlay.focus();
    ultimoFocusAperturaOverlay = null;
  }
  if (confermato && _callbackConferma) {
    _callbackConferma();
  }
  _callbackConferma = null;
}

/* ============================================================
   FOCUS TRAP + ESCAPE (overlay aperti)
   ============================================================ */

/**
 * Restituisce l'overlay visibile attivo con la priorità più alta.
 * Usa querySelectorAll e prende l'ULTIMO nel DOM: se due overlay sono
 * sovrapposti (es. dialogo-conferma su pannello-gara-ar1), il dialogo —
 * che compare per ultimo nel DOM — risulta quello corretto.
 * Include anche tutorial-overlay (classe diversa da pannello-overlay).
 */
function _overlayAttivoCorrente() {
  const tutti = [
    ...document.querySelectorAll('.pannello-overlay:not(.nascosta)'),
    ...document.querySelectorAll('.tutorial-overlay:not(.nascosta)')
  ];
  if (tutti.length === 0) return null;
  /* Ordina per posizione nel DOM e prende l'ultimo */
  tutti.sort((a, b) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1
  );
  return tutti[tutti.length - 1];
}

/** Selettore elementi interattivi standard per focus trap */
const _SELETTORE_INTERATTIVI =
  'button:not([disabled]):not(.nascosta), [href]:not(.nascosta), ' +
  'input:not([disabled]):not(.nascosta), select:not([disabled]):not(.nascosta), ' +
  'textarea:not([disabled]):not(.nascosta), [tabindex]:not([tabindex="-1"]):not(.nascosta)';

function gestisciTastoOverlay(evento) {
  const overlay = _overlayAttivoCorrente();
  if (!overlay) return;

  /* ── Escape ───────────────────────────────────────────────── */
  if (evento.key === 'Escape') {
    const id = overlay.id;
    if (id === 'dialogo-conferma') {
      evento.preventDefault();
      _chiudiDialogo(false);
    } else if (id === 'tutorial-overlay') {
      evento.preventDefault();
      /* Simula il click sul pulsante "Capito" */
      const btn = el('btn-chiudi-tutorial');
      if (btn && !btn.classList.contains('nascosta')) btn.click();
    }
    /* Gli altri overlay non sono chiudibili con Escape (workflow obbligatorio) */
    return;
  }

  /* ── Tab / Shift+Tab ──────────────────────────────────────── */
  if (evento.key !== 'Tab') return;

  const elementi = [...overlay.querySelectorAll(_SELETTORE_INTERATTIVI)];
  if (elementi.length === 0) return;

  const primo = elementi[0];
  const ultimo = elementi[elementi.length - 1];
  const attivo = document.activeElement;

  /* Se il focus è uscito dall'overlay (es. click fuori), riportalo dentro */
  if (!overlay.contains(attivo)) {
    evento.preventDefault();
    (evento.shiftKey ? ultimo : primo).focus();
    return;
  }

  if (evento.shiftKey) {
    if (attivo === primo) {
      evento.preventDefault();
      ultimo.focus();
    }
  } else {
    if (attivo === ultimo) {
      evento.preventDefault();
      primo.focus();
    }
  }
}

/* ============================================================
   REGISTRAZIONE SERVICE WORKER
   ============================================================ */

/* ============================================================
   INTRO NUOVA PARTITA
   ============================================================ */

function mostraIntroNuovaPartita(stato) {
  const pannello = el('schermata-intro');
  if (!pannello) return;

  const squadra   = [...DATI.SQUADRE_AR3].find(s => s.id === stato.squadraId);
  const piloti    = stato.piloti || [];
  const calendario = motore._ottieniCalendario();
  const primoRound = calendario[0];

  /* Titolo */
  el('titolo-intro').textContent = squadra ? squadra.nome : 'La tua squadra';

  /* Contenuto */
  const contenuto = el('contenuto-intro');
  contenuto.replaceChildren();

  /* Categoria e stagione */
  const cardCategoria = crea('div', { class: 'scheda-intro-squadra' });
  cardCategoria.appendChild(crea('h3', {}, 'Incarico'));
  cardCategoria.appendChild(crea('p', {}, 'Team Principal · AR3 · Stagione ' + stato.stagione));
  if (primoRound) {
    cardCategoria.appendChild(crea('p', {
      class: 'dettaglio',
      'aria-label': 'Primo appuntamento: ' + primoRound.nome + ', ' + formatData(primoRound.data)
    }, 'Primo appuntamento: ' + primoRound.nome + ' — ' + formatData(primoRound.data)));
  }
  contenuto.appendChild(cardCategoria);

  /* Piloti */
  const cardPiloti = crea('div', { class: 'scheda-intro-squadra' });
  cardPiloti.appendChild(crea('h3', {}, 'I tuoi piloti'));
  piloti.forEach(p => {
    const rigaPilota = crea('p', {
      'aria-label': p.nome + ', ' + p.nazionalita + ', ' + p.eta + ' anni'
    }, p.nome);
    const dettaglio = crea('span', { class: 'dettaglio' }, p.nazionalita + ' · ' + p.eta + ' anni');
    cardPiloti.appendChild(rigaPilota);
    cardPiloti.appendChild(dettaglio);
  });
  contenuto.appendChild(cardPiloti);

  /* Mostra pannello */
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-intro').setAttribute('tabindex', '-1');
  el('titolo-intro').focus();

  annunciaVoiceOver('Incarico ricevuto. Sei il nuovo Team Principal di ' + (squadra ? squadra.nome : 'una squadra di ' + (stato.categoria || 'AR3')) + '. Stagione ' + stato.stagione + '.');

  /* Binding pulsante Inizia */
  const btnIniziaOld = el('btn-inizia-stagione');
  const btnIniziaNew = btnIniziaOld.cloneNode(true);
  btnIniziaOld.parentNode.replaceChild(btnIniziaNew, btnIniziaOld);
  btnIniziaNew.addEventListener('click', () => {
    audio.conferma();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    mostraSchermataDiGioco(stato);
  });
}

/* ============================================================
   TUTORIAL
   ============================================================ */

function mostraTutorial(testoObj, fase) {
  const overlay = el('tutorial-overlay');
  if (!overlay) return;

  el('titolo-tutorial').textContent = testoObj.titolo;
  el('testo-tutorial').textContent  = testoObj.testo;

  /* Salva il focus corrente per ripristinarlo alla chiusura */
  const focusPrecedente = document.activeElement;

  overlay.classList.remove('nascosta');
  overlay.removeAttribute('aria-hidden');

  const btnOld = el('btn-chiudi-tutorial');
  const btnNew = btnOld.cloneNode(true);
  btnOld.parentNode.replaceChild(btnNew, btnOld);
  btnNew.focus();

  annunciaVoiceOver('Nuova meccanica: ' + testoObj.titolo + '. ' + testoObj.testo);

  btnNew.addEventListener('click', () => {
    audio.conferma();
    overlay.classList.add('nascosta');
    overlay.setAttribute('aria-hidden', 'true');
    motore.segnaTestoTutorialVisto(fase);
    /* Ripristina il focus all'elemento che aveva il focus prima del tutorial */
    if (focusPrecedente && typeof focusPrecedente.focus === 'function') {
      focusPrecedente.focus();
    }
  });
}

/* ============================================================
   INTER-GARA AR3
   ============================================================ */

function mostraIntergaraAR3() {
  const pannello = el('pannello-intergara-ar3');
  if (!pannello) return;

  const stato     = motore.stato;
  const calendario = motore._ottieniCalendario();
  const prossimo  = calendario[stato.roundCorrente];

  /* Titolo */
  el('titolo-intergara').textContent = 'Tra i round ' + stato.roundCorrente + ' e ' + (stato.roundCorrente + 1);
  el('sottotitolo-intergara').textContent = prossimo
    ? 'Prossimo appuntamento: ' + prossimo.nome + ' — ' + formatData(prossimo.data)
    : 'Fine stagione imminente.';

  /* Classifica costruttori */
  const listaCostruttori = el('lista-intergara-costruttori');
  listaCostruttori.replaceChildren();
  const classifica = [...stato.classificaCostruttori].sort((a, b) => b.punti - a.punti);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica costruttori AR3' });
  classifica.forEach((sq, idx) => {
    const isGiocatore = sq.squadraId === stato.squadraId;
    const li = crea('li', {
      class: 'riga-classifica' + (isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${sq.nome}, ${sq.punti} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, sq.nomeBreve || sq.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, String(sq.punti)));
    ol.appendChild(li);
  });
  listaCostruttori.appendChild(ol);

  /* Piloti */
  const listaPiloti = el('lista-intergara-piloti');
  listaPiloti.replaceChildren();
  (stato.piloti || []).forEach(p => {
    const card = crea('div', {
      class: 'card',
      role: 'article',
      'aria-label': p.nome + ', umore ' + _statoUmore(p.umore)
    });
    const intestazione = crea('div', { class: 'card-intestazione' });
    intestazione.appendChild(crea('span', { class: 'nome-pilota', style: 'font-size: var(--dim-corpo)' },
      p.nome));
    intestazione.appendChild(crea('span', { class: 'card-etichetta' }, p.nazionalita + ' · ' + p.eta + ' anni'));
    card.appendChild(intestazione);

    /* Umore */
    const contenitoreUmore = crea('div', { class: 'indicatore-umore' });
    const statoUm = _statoUmore(p.umore);
    contenitoreUmore.appendChild(crea('span', { 'aria-label': 'Umore: ' + statoUm }, 'Umore'));
    const barra = crea('div', { class: 'barra-umore', role: 'progressbar',
      'aria-valuenow': p.umore, 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-label': 'Umore: ' + statoUm });
    const riempimento = crea('div', { class: 'riempimento-umore' });
    riempimento.style.width = p.umore + '%';
    barra.appendChild(riempimento);
    contenitoreUmore.appendChild(barra);
    contenitoreUmore.appendChild(crea('span', {}, statoUm));
    card.appendChild(contenitoreUmore);
    listaPiloti.appendChild(card);
  });

  /* Mostra pannello */
  ultimoFocusAperturaOverlay = document.activeElement;
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');

  el('titolo-intergara').setAttribute('tabindex', '-1');
  el('titolo-intergara').focus();

  annunciaVoiceOver('Inter-gara. ' + (prossimo ? 'Prossimo round: ' + prossimo.nome + '.' : ''));

  /* Tutorial inter-gara (prima volta) */
  const testoTutorial = motore.ottieniTestoTutorial('inter-gara');
  if (testoTutorial) mostraTutorial(testoTutorial, 'inter-gara');

  /* Binding pulsante Avanza */
  const btnOld = el('btn-avanza-intergara');
  const btnNew = btnOld.cloneNode(true);
  btnOld.parentNode.replaceChild(btnNew, btnOld);
  btnNew.addEventListener('click', () => {
    audio.conferma();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    motore.iniziaNuovoRound();   /* applica upgrade, reset FP, faseCorrente → briefing */
    _routerPrincipale();
  });
}

/* ============================================================
   FINE STAGIONE
   ============================================================ */

function mostraFineStagione() {
  const pannello = el('pannello-fine-stagione');
  if (!pannello) return;

  const stato     = motore.stato;
  const storico   = stato.storico || [];
  const ultimaStagione = storico[storico.length - 1];
  const promozione = ultimaStagione?.categoriaPromozione || null;
  const posizione  = ultimaStagione?.posizione || '—';
  const categoria  = ultimaStagione?.categoria || stato.categoriaPregressa || stato.categoria;

  el('titolo-fine-stagione').textContent = 'Stagione ' + (stato.stagione - 1) + ' — Fine';

  const contenuto = el('contenuto-fine-stagione');
  contenuto.replaceChildren();

  /* Posizione finale */
  const cardRisultato = crea('div', { class: 'card' });
  cardRisultato.appendChild(crea('h3', {}, 'Risultato finale'));
  cardRisultato.appendChild(crea('p', {
    class: 'card-valore',
    'aria-label': posizione + '° posto nel campionato costruttori di ' + categoria
  }, posizione + '° posto — ' + categoria));
  contenuto.appendChild(cardRisultato);

  /* Promozione o permanenza */
  const cardEsito = crea('div', { class: 'card margine-sopra' });
  if (stato.categoria !== (ultimaStagione?.categoria)) {
    /* Promozione avvenuta */
    cardEsito.appendChild(crea('h3', {}, 'Promozione'));
    cardEsito.appendChild(crea('p', {
      class: 'messaggio-stato messaggio-successo',
      role: 'status',
      'aria-live': 'polite'
    }, 'Hai soddisfatto i requisiti per la promozione in ' + stato.categoria + '. La prossima stagione inizia in una nuova categoria.'));
    audio.promozione();
  } else {
    /* Permanenza */
    cardEsito.appendChild(crea('h3', {}, 'Prossima stagione'));
    cardEsito.appendChild(crea('p', {}, 'La squadra riparte dalla ' + categoria + ' per la stagione ' + stato.stagione + '.'));
  }
  contenuto.appendChild(cardEsito);

  /* Classifica finale */
  const cardClassifica = crea('div', { class: 'card margine-sopra' });
  cardClassifica.appendChild(crea('h3', {}, 'Classifica finale costruttori'));
  const ol = crea('ol', { class: 'lista-classifica' });
  [...(stato.classificaCostruttori || [])]
    .sort((a, b) => b.punti - a.punti)
    .forEach((sq, idx) => {
      const isGiocatore = sq.squadraId === stato.squadraId;
      const li = crea('li', {
        class: 'riga-classifica' + (isGiocatore ? ' giocatore-highlight' : ''),
        'aria-label': `${idx + 1}°: ${sq.nome}, ${sq.punti} punti`
      });
      li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
      li.appendChild(crea('span', { class: 'nome-classifica' }, sq.nomeBreve || sq.nome));
      li.appendChild(crea('span', { class: 'punti-classifica' }, String(sq.punti)));
      ol.appendChild(li);
    });
  cardClassifica.appendChild(ol);
  contenuto.appendChild(cardClassifica);

  /* Mostra pannello */
  ultimoFocusAperturaOverlay = document.activeElement;
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  el('titolo-fine-stagione').setAttribute('tabindex', '-1');
  el('titolo-fine-stagione').focus();

  annunciaVoiceOver('Fine stagione ' + (stato.stagione - 1) + '. Posizione: ' + posizione + '° posto.');

  /* Binding pulsante Continua */
  const btnOld = el('btn-continua-fine-stagione');
  const btnNew = btnOld.cloneNode(true);
  btnOld.parentNode.replaceChild(btnNew, btnOld);
  btnNew.addEventListener('click', () => {
    audio.conferma();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    if (motore.stato.categoria === 'AR1') {
      mostraPausaInvernale();
    } else {
      /* AR2/AR3: nessuna pausa invernale, avvia subito la nuova stagione */
      motore.avviaNuovaStagioneAR2AR3();   /* pausa_invernale → inter-gara */
      adattaMenuCategoria(motore.stato.categoria);
      _routerPrincipale();
    }
  });
}

/* ============================================================
   RISULTATI SPRINT
   ============================================================ */

function mostraRisultatiSprint(risultato, circuito) {
  const contenuto = el('contenuto-decisioni');
  if (!contenuto) return;
  contenuto.replaceChildren();

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Risultati Sprint Race'));

  const top10 = risultato.risultati.slice(0, 10);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica Sprint Race' });
  top10.forEach((r, idx) => {
    const li = crea('li', {
      class: 'riga-classifica' + (r.isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota.nome} — ${r.puntiGuadagnati} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, '+' + r.puntiGuadagnati));
    ol.appendChild(li);
  });
  card.appendChild(ol);
  contenuto.appendChild(card);

  /* Aggiorna btn-avanza-fase (sopra al contenuto nel DOM) ad "Avanza".
     L'avanzamento sprint → fase successiva avviene qui (non nel simulatore). */
  _aggiornaBtnAvanzaFase('Avanza', 'Chiudi la sprint e avanza alla fase successiva', () => {
    audio.navigazione();
    chiudiPannelloSessione();
    motore.avanzaFase();   /* sprint → qualifica (AR1 sprint) o gara (AR2/AR3 sprint) */
    _routerPrincipale();
  });

  annunciaVoiceOver('Sprint Race terminata. ' + (risultato.risultati[0]?.pilota?.nome || '') + ' vince la sprint.');
  audio.fineSessione();
}

/* ============================================================
   WIDGET METEO — riquadro fisso durante qualifica e gara AR1
   ============================================================ */

function mostraWidgetMeteo(meteo, modalita) {
  /* modalita: 'gara' | 'qualifica' | undefined */
  const widget = el('widget-meteo');
  if (!widget) return;
  widget.classList.toggle('widget-meteo--gara', modalita === 'gara');
  aggiornaWidgetMeteo(meteo);
  widget.classList.remove('nascosta');
}

function aggiornaWidgetMeteo(meteo) {
  const temp  = el('widget-temp');
  const cond  = el('widget-cond');
  const vento = el('widget-vento');
  if (!temp || !cond) return;
  temp.textContent = 'Pista: ' + meteo.temperaturaPista + '°C · Aria: ' + meteo.temperaturaAria + '°C';
  if (meteo.pioggia) {
    cond.textContent = 'Pioggia ' + meteo.intensitaPioggia + '%';
    cond.style.color = 'var(--colore-persone)';
  } else {
    cond.textContent = 'Asciutto';
    cond.style.color = 'var(--testo-secondario)';
  }
  if (vento) {
    const stabTesto = meteo.variabilitaMeteo ? ' · instabile' : '';
    vento.textContent = 'Vento ' + (meteo.vento || 0) + ' km/h' + stabTesto;
    vento.style.color = meteo.variabilitaMeteo ? 'var(--colore-operazioni)' : 'var(--testo-secondario)';
  }
  /* Aggiorna aria-label del widget con dati completi */
  const widget = el('widget-meteo');
  if (widget) {
    const condStr = meteo.pioggia ? `Pioggia ${meteo.intensitaPioggia}%` : 'Asciutto';
    widget.setAttribute('aria-label',
      `Meteo pista: ${condStr}. Temperatura ${meteo.temperaturaPista}°C. Vento ${meteo.vento || 0} km/h${meteo.variabilitaMeteo ? ', condizioni instabili' : ''}.`
    );
  }
}

function nascondiWidgetMeteo() {
  const widget = el('widget-meteo');
  if (widget) {
    widget.classList.add('nascosta');
    widget.classList.remove('widget-meteo--gara');
  }
}

/* ============================================================
   RIUNIONE INFORMATIVA AR1 — multi-schermata pre-stagionale
   ============================================================ */

const _SLIDES_RIUNIONE_AR1 = [
  {
    titolo: 'Benvenuto in AR1',
    contenuto: [
      'Hai accettato la proposta della squadra. La stagione sta per iniziare.',
      'Questa riunione ti introduce alle meccaniche principali della AR1. Puoi tornare a queste informazioni nella sezione Operazioni in qualsiasi momento.'
    ]
  },
  {
    titolo: 'La macchina',
    contenuto: [
      'La tua vettura è valutata su quattro aree: aerodinamica, meccanica, elettronica e power unit. Il Data Analyst fornisce stime percentuali rispetto al benchmark di riferimento, con un margine di incertezza proporzionale alla qualità dei dati raccolti nelle prove libere.',
      'Gli upgrade vengono pianificati nella sezione Tecnica. Il bilanciamento tra le aree è coordinato dal Capo Ingegnere.'
    ]
  },
  {
    titolo: 'Le prove libere',
    contenuto: [
      'FP1, FP2 e FP3 permettono di raccogliere dati sul circuito. Per ogni sessione scegli un programma: passo gara, qualifica, aerodinamica, meccanica, gomme o telemetria.',
      'I dati raccolti alimentano le stime del Data Analyst e influenzano la qualità delle informazioni disponibili in qualifica e gara.'
    ]
  },
  {
    titolo: 'Le qualifiche',
    contenuto: [
      'Le qualifiche si suddividono in Q1, Q2 e Q3. Ogni segmento ha due checkpoint. Al primo checkpoint le gomme sono ancora fredde e i tempi meno stabili. Al secondo checkpoint i piloti cercano il giro definitivo.',
      'Puoi scegliere la mescola per ogni pilota e decidere se mandarlo in pista a ogni checkpoint. In condizioni miste è sempre disponibile la scelta tra gomme da asciutto e da bagnato.'
    ]
  },
  {
    titolo: 'La gara',
    contenuto: [
      'La gara procede per checkpoint ogni dieci giri circa. A ogni checkpoint puoi impostare il ritmo dei tuoi piloti (push / normale / conserva) e pianificare una sosta con scelta della mescola.',
      'Gli eventi imprevisti — safety car, pioggia, guasti — interrompono il flusso e richiedono una reazione immediata. Il widget meteo in alto a destra rimane sempre visibile durante qualifica e gara.'
    ]
  },
  {
    titolo: 'I tuoi piloti e lo staff',
    contenuto: [
      'I piloti hanno statistiche proprie che influenzano qualifica, gara e bagnato. Il loro umore varia in base ai risultati e alle interazioni.',
      'Lo staff tecnico — dal Capo Ingegnere al Data Analyst — influenza ogni aspetto della competizione. Gestisci i rapporti nella sezione Personale.'
    ]
  }
];

let _slideRiunioneCorrente = 0;

function mostraRiunioneInformativaAR1() {
  const pannello = el('pannello-riunione-ar1');
  if (!pannello) return;

  _slideRiunioneCorrente = 0;
  _renderSlideRiunione();

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-riunione-ar1').setAttribute('tabindex', '-1');
  el('titolo-riunione-ar1').focus();

  /* Binding pulsante Avanti */
  const btnAvanti = el('btn-avanza-riunione');
  const btnAvantiFresh = btnAvanti.cloneNode(true);
  btnAvanti.parentNode.replaceChild(btnAvantiFresh, btnAvanti);
  btnAvantiFresh.addEventListener('click', () => {
    audio.navigazione();
    _slideRiunioneCorrente++;
    if (_slideRiunioneCorrente >= _SLIDES_RIUNIONE_AR1.length) {
      _chiudiRiunioneAR1();
    } else {
      _renderSlideRiunione();
    }
  });

  /* Binding pulsante Fine riunione */
  const btnFine = el('btn-fine-riunione');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.conferma();
    _chiudiRiunioneAR1();
  });
}

function _renderSlideRiunione() {
  const slide = _SLIDES_RIUNIONE_AR1[_slideRiunioneCorrente];
  if (!slide) return;

  const totale = _SLIDES_RIUNIONE_AR1.length;
  el('titolo-riunione-ar1').textContent = slide.titolo;

  const contenuto = el('contenuto-riunione-ar1');
  contenuto.replaceChildren();

  const contatore = crea('p', { class: 'contatore-slide',
    'aria-label': `Schermata ${_slideRiunioneCorrente + 1} di ${totale}` },
    `${_slideRiunioneCorrente + 1} / ${totale}`);
  contenuto.appendChild(contatore);

  const div = crea('div', { class: 'slide-riunione-ar1' });
  slide.contenuto.forEach(testo => {
    div.appendChild(crea('p', {}, testo));
  });
  contenuto.appendChild(div);

  /* Mostra/nascondi pulsanti in base alla posizione */
  const isUltima = _slideRiunioneCorrente === totale - 1;
  el('btn-avanza-riunione').classList.toggle('nascosta', isUltima);
  el('btn-fine-riunione').classList.toggle('nascosta', !isUltima);

  annunciaVoiceOver(slide.titolo + '. ' + slide.contenuto[0]);
}

function _chiudiRiunioneAR1() {
  const pannello = el('pannello-riunione-ar1');
  pannello.classList.add('nascosta');
  pannello.setAttribute('aria-hidden', 'true');
  motore.stato.riunioneAR1Vista = true;
  motore.salva();
  _routerPrincipale();
}

/* ============================================================
   INTER-GARA AR1
   ============================================================ */

function mostraIntergaraAR1() {
  const pannello = el('pannello-intergara-ar1');
  if (!pannello) return;

  const stato    = motore.stato;
  const calendario = motore._ottieniCalendario();
  const prossimo = calendario[stato.roundCorrente];
  const passato  = calendario[stato.roundCorrente - 1];

  el('titolo-intergara-ar1').textContent =
    passato ? ('Dopo ' + passato.nome) : ('Inizio stagione ' + stato.stagione);
  el('sottotitolo-intergara-ar1').textContent = prossimo
    ? 'Prossimo appuntamento: ' + prossimo.nome + ' — ' + formatData(prossimo.data)
    : 'Fine stagione. Ultimi risultati della stagione.';

  const contenuto = el('contenuto-intergara-ar1');
  contenuto.replaceChildren();

  /* Notifica infortuni */
  const infortuni = motore.ottieniStatoInfortuni?.();
  if (infortuni && infortuni.length > 0) {
    infortuni.forEach(({ pilota, riserva, roundMancanti }) => {
      const card = crea('div', {
        class: 'card card-avviso margine-sopra',
        role: 'alert',
        'aria-label': `Infortunio: ${pilota.nome} è fuori gioco per ${roundMancanti} round.`
      });
      card.appendChild(crea('p', { class: 'card-etichetta testo-avviso' }, 'Infortunio comunicato dallo staff medico'));
      card.appendChild(crea('p', {}, `${pilota.nome} è fuori per i prossimi ${roundMancanti} round.`));
      if (riserva) {
        card.appendChild(crea('p', {}, `${riserva.nome} gareggerà in sua sostituzione.`));
      }
      contenuto.appendChild(card);
    });
  }

  /* Classifica costruttori (top 5 + giocatore se fuori) */
  const cardClass = crea('div', { class: 'card' });
  cardClass.appendChild(crea('h3', {}, 'Classifica costruttori'));
  const classifica = [...stato.classificaCostruttori].sort((a, b) => b.punti - a.punti);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica costruttori AR1' });

  const top5 = classifica.slice(0, 5);
  const posGiocatore = classifica.findIndex(s => s.squadraId === stato.squadraId);
  const giocatoreInTop5 = posGiocatore < 5;

  top5.forEach((sq, idx) => {
    const isGiocatore = sq.squadraId === stato.squadraId;
    const li = crea('li', {
      class: 'riga-classifica' + (isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${sq.nome}, ${sq.punti} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, sq.nomeBreve || sq.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, String(sq.punti) + ' pt'));
    ol.appendChild(li);
  });

  if (!giocatoreInTop5 && posGiocatore >= 0) {
    ol.appendChild(crea('li', { class: 'riga-classifica', style: 'opacity:0.5; font-size:12px;', 'aria-hidden': 'true' }, '…'));
    const sq = classifica[posGiocatore];
    const li = crea('li', {
      class: 'riga-classifica giocatore-highlight',
      'aria-label': `${posGiocatore + 1}°: ${sq.nome}, ${sq.punti} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' }, String(posGiocatore + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, sq.nomeBreve || sq.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, String(sq.punti) + ' pt'));
    ol.appendChild(li);
  }

  cardClass.appendChild(ol);
  contenuto.appendChild(cardClass);

  /* Ultimo risultato */
  if (stato.ultimaGara) {
    const ug = stato.ultimaGara;
    const cardRis = crea('div', { class: 'card margine-sopra' });
    cardRis.appendChild(crea('h3', {}, 'Ultima gara'));
    const pilotiGiocatore = (ug.risultati || []).filter(r => r.isGiocatore);
    pilotiGiocatore.forEach(r => {
      const p = crea('p', { 'aria-label': `${r.pilota.nome}: ${r.posizione}° posto, ${r.puntiGuadagnati} punti` });
      p.textContent = `${r.pilota.nome} — ${r.posizione}° posto (+${r.puntiGuadagnati} pt)`;
      cardRis.appendChild(p);
    });
    contenuto.appendChild(cardRis);
  }

  /* Logistica */
  if (stato.categoria === 'AR1' && stato.roundCorrente > 0) {
    const logistica = motore.calcolaLogistica();
    if (logistica) {
      const dl = motore.stato.staff?.direttoreLogistica;
      const cardLog = crea('div', { class: 'card margine-sopra', 'aria-label': `Logistica: spostamento da ${logistica.partenza} a ${logistica.destinazione}` });
      cardLog.appendChild(crea('h3', {}, 'Spostamento in corso'));
      cardLog.appendChild(crea('p', {}, `${logistica.partenza} → ${logistica.destinazione}`));
      const dlLog = crea('dl', { class: 'lista-dati margine-sopra', 'aria-label': 'Dettagli logistica' });
      dlLog.appendChild(crea('dt', {}, 'Costo stimato trasferimento'));
      dlLog.appendChild(crea('dd', {}, formatMoneta(logistica.costoStimato)));
      if (dl) {
        const effPerc = Math.round(logistica.efficienzaTeam);
        const costoBase   = 480000;
        const costoMedio  = Math.round(costoBase * (1.4 - 0.65 * 0.8)); /* 65% = nessun direttore */
        const risparmio   = costoMedio - logistica.costoStimato;
        dlLog.appendChild(crea('dt', {}, 'Direttore Logistica'));
        dlLog.appendChild(crea('dd', {}, dl.nome + ' — efficienza ' + effPerc + '%'));
        if (risparmio > 0) {
          dlLog.appendChild(crea('dt', {}, 'Risparmio vs media paddock'));
          dlLog.appendChild(crea('dd', { class: 'testo-successo' }, '−' + formatMoneta(risparmio)));
        }
      }
      cardLog.appendChild(dlLog);
      cardLog.appendChild(crea('p', { class: 'nota-direttore margine-sopra' }, logistica.notaDirettore));
      contenuto.appendChild(cardLog);
    }
  }

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-intergara-ar1').setAttribute('tabindex', '-1');
  el('titolo-intergara-ar1').focus();

  const _infortAnnuncio = motore.ottieniStatoInfortuni?.();
  const _infortTesto = _infortAnnuncio?.length > 0
    ? ' Attenzione: ' + _infortAnnuncio.map(i => i.pilota.nome + ' è infortunato').join('. ') + '.'
    : '';
  annunciaVoiceOver('Inter-gara. ' + (prossimo ? 'Prossimo round: ' + prossimo.nome + '.' : 'Fine stagione.') + _infortTesto);

  /* Binding pulsante Avanza */
  const btnOld = el('btn-avanza-intergara-ar1');
  const btnNew = btnOld.cloneNode(true);
  btnOld.parentNode.replaceChild(btnNew, btnOld);
  btnNew.addEventListener('click', () => {
    audio.conferma();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    motore.iniziaNuovoRound();   /* applica upgrade, reset FP, faseCorrente → briefing */
    _routerPrincipale();
  });
}

/* ============================================================
   QUALIFICA AR1 — interfaccia Q1/Q2/Q3 a checkpoint
   ============================================================ */

/* Stato locale delle decisioni qualifica (reset a ogni apertura) */
let _decisioniQualificaAR1 = { pilota1: {}, pilota2: {} };
let _bonusQualificaAR1Acc  = 0;   /* accumulato su Q1+Q2+Q3, azzerato ad ogni nuova qualifica */

function avviaQualificaAR1(circuito, meteo) {
  const pannello = el('pannello-qualifica-ar1');
  if (!pannello) return;

  const meteoSessione = motore.generaMeteoSessione(meteo);
  motore.iniziaQualificaAR1(circuito, meteoSessione);

  el('titolo-qualifica-ar1').textContent = 'Qualifiche — ' + circuito.nome;
  el('desc-qualifica-ar1').textContent   = circuito.circuito + ', ' + circuito.paese;

  mostraWidgetMeteo(meteoSessione);

  _bonusQualificaAR1Acc = 0;
  _decisioniQualificaAR1 = {
    pilota1: { mandaInPista: true, gomma: circuito.mescole[circuito.mescole.length - 1], timing: 'tardi', settori: 'bilanciato' },
    pilota2: { mandaInPista: true, gomma: circuito.mescole[circuito.mescole.length - 1], timing: 'tardi', settori: 'bilanciato' }
  };

  _renderFaseQualificaAR1();

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-qualifica-ar1').setAttribute('tabindex', '-1');
  el('titolo-qualifica-ar1').focus();

  audio.inizioSessione();

  /* Binding checkpoint */
  const btnCP = el('btn-checkpoint-qualifica');
  const btnCPFresh = btnCP.cloneNode(true);
  btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
  btnCPFresh.addEventListener('click', () => {
    audio.conferma();
    _bonusQualificaAR1Acc += _calcolaBonusCheckpointDecisioni(_decisioniQualificaAR1,
      { tipo: 'qualifica_ar1', circuito, meteo: motore.stato.statoQualificaAttivo?.meteoAttuale });
    const risultato = motore.simulaQualificaAR1Checkpoint(_decisioniQualificaAR1);
    if (!risultato) return;
    aggiornaWidgetMeteo(risultato.meteoAttuale);
    if (risultato.eConclusaQualifica) {
      _mostraGrigliaFinaleQualifica();
    } else {
      _renderRisultatoCheckpointQ(risultato, circuito);
    }
  });

  /* Binding chiudi (nascosto inizialmente) */
  const btnFine = el('btn-fine-qualifica');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.fineSessione();
    nascondiWidgetMeteo();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    motore.avanzaFase();   /* qualifica → gara */
    _routerPrincipale();
  });
}

function _renderFaseQualificaAR1() {
  const sq = motore.stato.statoQualificaAttivo;
  if (!sq) return;

  const nomeSegmento = ['Q1', 'Q2', 'Q3'][sq.segmentoCorrente - 1];
  el('segmento-qualifica-ar1').textContent = nomeSegmento + ' — Checkpoint 1 / 1';

  const contenuto = el('contenuto-qualifica-ar1');
  contenuto.replaceChildren();

  /* Pannello decisioni per ogni pilota del giocatore */
  const stato = motore.stato;
  (stato.piloti || []).forEach((pilota, idx) => {
    const chiave  = idx === 0 ? 'pilota1' : 'pilota2';
    const dec     = _decisioniQualificaAR1[chiave];
    const circuito = motore.ottieniRoundCorrente();

    const pannelloPilota = crea('div', { class: 'pannello-pilota-qualifica',
      'aria-label': `Decisioni per ${pilota.nome}` });
    pannelloPilota.appendChild(crea('h4', {}, pilota.nome));

    /* Scelta gomma */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario);' }, 'Mescola:'));
    const gruppoGomme = crea('div', { class: 'gruppo-decisione-qualifica' });
    const mescolaDisp = [...(circuito?.mescole || []), 'INTERMEDIA', 'FULL_WET'];
    mescolaDisp.forEach(m => {
      const mescola = DATI.MESCOLE[m];
      const btn = crea('button', {
        class: 'btn-gomma' + (dec.gomma === m ? ' selezionato' : ''),
        'aria-label': (mescola ? mescola.nome : m) + (dec.gomma === m ? ', selezionata' : ''),
        'aria-pressed': dec.gomma === m ? 'true' : 'false'
      }, m);
      btn.addEventListener('click', () => {
        _decisioniQualificaAR1[chiave].gomma = m;
        _renderFaseQualificaAR1();
      });
      gruppoGomme.appendChild(btn);
    });
    pannelloPilota.appendChild(gruppoGomme);

    /* Manda in pista o rimani ai box */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-s)' }, 'Azione:'));
    const gruppoAzione = crea('div', { class: 'gruppo-decisione-qualifica' });
    [{ v: true, label: 'In pista' }, { v: false, label: 'Ai box' }].forEach(({ v, label }) => {
      const btn = crea('button', {
        class: 'btn-decisione' + (dec.mandaInPista === v ? ' selezionato' : ''),
        'aria-label': label + (dec.mandaInPista === v ? ', selezionato' : ''),
        'aria-pressed': dec.mandaInPista === v ? 'true' : 'false'
      }, label);
      btn.addEventListener('click', () => {
        _decisioniQualificaAR1[chiave].mandaInPista = v;
        _renderFaseQualificaAR1();
      });
      gruppoAzione.appendChild(btn);
    });
    pannelloPilota.appendChild(gruppoAzione);

    /* Timing giro veloce */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-s)' }, 'Timing giro:'));
    const gruppoTiming = crea('div', { class: 'gruppo-decisione-qualifica' });
    [{ v: 'presto', label: 'Presto' }, { v: 'centrale', label: 'Centrale' }, { v: 'tardi', label: 'Tardi' }].forEach(({ v, label }) => {
      const btn = crea('button', {
        class: 'btn-decisione' + (dec.timing === v ? ' selezionato' : ''),
        'aria-label': label + (dec.timing === v ? ', selezionato' : ''),
        'aria-pressed': dec.timing === v ? 'true' : 'false'
      }, label);
      btn.addEventListener('click', () => { _decisioniQualificaAR1[chiave].timing = v; _renderFaseQualificaAR1(); });
      gruppoTiming.appendChild(btn);
    });
    pannelloPilota.appendChild(gruppoTiming);

    /* Strategia settori */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-s)' }, 'Settori:'));
    const gruppoSettori = crea('div', { class: 'gruppo-decisione-qualifica' });
    [{ v: 'bilanciato', label: 'Bilanciato' }, { v: 'trazione', label: 'Trazione' }, { v: 'alta_velocita', label: 'Alta vel.' }].forEach(({ v, label }) => {
      const btn = crea('button', {
        class: 'btn-decisione' + (dec.settori === v ? ' selezionato' : ''),
        'aria-label': label + (dec.settori === v ? ', selezionato' : ''),
        'aria-pressed': dec.settori === v ? 'true' : 'false'
      }, label);
      btn.addEventListener('click', () => { _decisioniQualificaAR1[chiave].settori = v; _renderFaseQualificaAR1(); });
      gruppoSettori.appendChild(btn);
    });
    pannelloPilota.appendChild(gruppoSettori);

    contenuto.appendChild(pannelloPilota);
  });

  annunciaVoiceOver((['Q1', 'Q2', 'Q3'][sq.segmentoCorrente - 1]) + ', checkpoint 1. Scegli mescola, azione, timing e settori per ogni pilota, poi avanza.');
}

function _renderRisultatoCheckpointQ(risultato, circuito) {
  const nomeSegmento = ['Q1', 'Q2', 'Q3'][risultato.segmento - 1];
  const sq = motore.stato.statoQualificaAttivo;

  if (risultato.eFineSegmento && risultato.segmento < 3) {
    /* Fine segmento: mostra eliminati e poi transita al segmento successivo */
    const contenuto = el('contenuto-qualifica-ar1');
    contenuto.replaceChildren();

    const card = crea('div', { class: 'card' });
    card.appendChild(crea('h4', {}, nomeSegmento + ' concluso'));

    if (risultato.eliminati.length > 0) {
      card.appendChild(crea('p', { style: 'color:var(--colore-relazioni); margin-bottom:var(--spazio-s);' },
        'Eliminati:'));
      risultato.eliminati.forEach(e => {
        const isGiocatore = e.isGiocatore;
        const p = crea('p', {
          style: 'font-size:var(--dim-piccolo);' + (isGiocatore ? 'color:var(--colore-relazioni); font-weight:700;' : ''),
          'aria-label': e.pilota.nome + ' — eliminato in ' + nomeSegmento + (e.tempoMiglioreFormattato ? ': ' + e.tempoMiglioreFormattato : '')
        }, e.pilota.nome + (e.tempoMiglioreFormattato ? ' — ' + e.tempoMiglioreFormattato : ' — nessun tempo'));
        card.appendChild(p);
      });
    }

    contenuto.appendChild(card);

    /* Prepara decisioni per il segmento successivo e re-render */
    _decisioniQualificaAR1 = {
      pilota1: { mandaInPista: true, gomma: circuito.mescole[circuito.mescole.length - 1], timing: 'tardi', settori: 'bilanciato' },
      pilota2: { mandaInPista: true, gomma: circuito.mescole[circuito.mescole.length - 1], timing: 'tardi', settori: 'bilanciato' }
    };

    /* Aspetta un click per procedere al segmento successivo */
    const btnCP = el('btn-checkpoint-qualifica');
    btnCP.textContent = 'Inizia ' + ['Q1', 'Q2', 'Q3'][sq.segmentoCorrente - 1] + ' →';
    btnCP.removeAttribute('disabled');

    const btnCPFresh = btnCP.cloneNode(true);
    btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
    btnCPFresh.addEventListener('click', () => {
      audio.conferma();
      btnCPFresh.textContent = 'Avanza checkpoint →';
      _renderFaseQualificaAR1();
      /* Re-bind l'handler originale */
      const nuovoBtnCP = el('btn-checkpoint-qualifica');
      const nuovoBtnFresh = nuovoBtnCP.cloneNode(true);
      nuovoBtnCP.parentNode.replaceChild(nuovoBtnFresh, nuovoBtnCP);
      nuovoBtnFresh.addEventListener('click', () => {
        audio.conferma();
        _bonusQualificaAR1Acc += _calcolaBonusCheckpointDecisioni(_decisioniQualificaAR1,
          { tipo: 'qualifica_ar1', circuito, meteo: motore.stato.statoQualificaAttivo?.meteoAttuale });
        const ris = motore.simulaQualificaAR1Checkpoint(_decisioniQualificaAR1);
        if (!ris) return;
        aggiornaWidgetMeteo(ris.meteoAttuale);
        if (ris.eConclusaQualifica) {
          _mostraGrigliaFinaleQualifica();
        } else {
          _renderRisultatoCheckpointQ(ris, circuito);
        }
      });
    });

    annunciaVoiceOver(nomeSegmento + ' terminato. ' + risultato.eliminati.length + ' piloti eliminati.');
    return;
  }

  /* Checkpoint intermedio: prima le decisioni, poi la classifica corrente sotto */
  const nomeCP = ['Q1', 'Q2', 'Q3'][risultato.segmento - 1] + ' — CP' + risultato.checkpoint;
  el('segmento-qualifica-ar1').textContent = nomeCP;

  /* _renderFaseQualificaAR1 pulisce e riempie contenuto-qualifica-ar1 con le decisioni */
  _renderFaseQualificaAR1();

  /* Aggiunge la classifica aggiornata sotto le decisioni */
  const contenuto = el('contenuto-qualifica-ar1');
  const titoloClass = crea('p', {
    style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-m);'
  }, 'Classifica aggiornata:');
  contenuto.appendChild(titoloClass);
  _appendClassificaQualifica(contenuto, risultato.ordinamento, []);
}

function _mostraGrigliaFinaleQualifica() {
  const griglia = motore.stato.grigliaPartenza || [];
  const contenuto = el('contenuto-qualifica-ar1');
  contenuto.replaceChildren();

  el('segmento-qualifica-ar1').textContent = 'Griglia di partenza definitiva';

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Qualifiche concluse'));
  _appendClassificaQualifica(card, griglia, []);
  contenuto.appendChild(card);

  /* Applica bonus checkpoint AR1 accumulato su Q1+Q2+Q3 */
  if (_bonusQualificaAR1Acc !== 0) {
    motore.stato.bonusFPCorrente = (motore.stato.bonusFPCorrente || 0) + _bonusQualificaAR1Acc;
    _bonusQualificaAR1Acc = 0;
  }

  el('btn-checkpoint-qualifica').classList.add('nascosta');
  el('btn-fine-qualifica').classList.remove('nascosta');

  const polePilota = griglia[0]?.pilota?.nome || '—';
  annunciaVoiceOver('Qualifiche terminate. ' + polePilota + ' in pole position.');
  audio.fineSessione();
}

function _appendClassificaQualifica(contenitore, lista, eliminati) {
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica qualifica' });
  lista.forEach((r, idx) => {
    const isElim = eliminati.some(e => e.pilota?.id === r.pilota?.id);
    const li = crea('li', {
      class: 'riga-qualifica' +
        (r.isGiocatore ? ' giocatore-highlight' : '') +
        (isElim ? ' eliminato' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota.nome}${r.tempoMiglioreFormattato ? ' — ' + r.tempoMiglioreFormattato : ''}`
    });
    li.appendChild(crea('span', { class: 'pos-qualifica' }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-qualifica' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'tempo-qualifica' }, r.tempoMiglioreFormattato || '—'));
    ol.appendChild(li);
  });
  contenitore.appendChild(ol);
}

/* ============================================================
   CHECKPOINT AR2/AR3 — helper comune bonus decisioni
   ============================================================ */

function _calcolaBonusCheckpointDecisioni(decisioni, { tipo, circuito, meteo }) {
  let bonus = 0;
  const usuraTipo  = circuito?.usuraGomme || 'media';
  const usuraAlta  = ['alta', 'molto_alta'].includes(usuraTipo);
  const usuraBassa = ['bassa', 'molto_bassa'].includes(usuraTipo);
  const pioggia    = meteo?.pioggia || false;
  const carico     = circuito?.caricoAero || 'medio';
  const mescole    = circuito?.mescole || [];

  if (tipo === 'qualifica_ar1') {
    /* Timing: tardi = track evolution, presto = meno grip */
    const p1 = decisioni.pilota1 || {};
    const p2 = decisioni.pilota2 || {};
    [p1, p2].forEach(d => {
      if (d.timing === 'tardi')   bonus += 0.15;
      else if (d.timing === 'presto') bonus -= 0.1;
      /* Settori: trazione su circuiti lenti, alta velocità su circuiti veloci */
      if (d.settori === 'trazione'    && ['alto', 'molto_alto'].includes(carico)) bonus += 0.1;
      if (d.settori === 'alta_velocita' && ['basso', 'molto_basso'].includes(carico)) bonus += 0.1;
    });
  }

  if (tipo === 'qualifica_ar2') {
    const softestM = mescole.length > 0 ? mescole[mescole.length - 1] : null;
    if (pioggia) {
      if (decisioni.mescola === 'INTERMEDIA' || decisioni.mescola === 'FULL_WET') bonus += 0.5;
    } else if (softestM && decisioni.mescola === softestM) {
      bonus += 0.3;
    }
    if (decisioni.timing === 'tardi')  bonus += 0.4;
    else if (decisioni.timing === 'presto') bonus -= 0.2;
  }

  if (tipo === 'gara_ar3') {
    if (decisioni.ritmo === 'push' && usuraBassa && !pioggia) bonus += 0.6;
    else if (decisioni.ritmo === 'push' && usuraAlta)  bonus -= 0.4;
    else if (decisioni.ritmo === 'push' && pioggia)    bonus -= 0.5;
    else if (decisioni.ritmo === 'conserva' && usuraAlta) bonus += 0.3;
    else if (decisioni.ritmo === 'conserva' && usuraBassa) bonus -= 0.3;
    if (decisioni.gestioneGomme === 'cautelosa' && usuraAlta)  bonus += 0.4;
    else if (decisioni.gestioneGomme === 'aggressiva' && usuraBassa) bonus += 0.3;
    else if (decisioni.gestioneGomme === 'aggressiva' && usuraAlta)  bonus -= 0.5;
    else if (decisioni.gestioneGomme === 'cautelosa'  && usuraBassa) bonus -= 0.2;
  }

  if (tipo === 'gara_ar2_cp1') {
    if (decisioni.ritmo === 'push' && usuraBassa)  bonus += 0.4;
    else if (decisioni.ritmo === 'push' && usuraAlta) bonus -= 0.3;
    else if (decisioni.ritmo === 'conserva' && usuraAlta) bonus += 0.3;
    if (decisioni.sostaQuando === 'presto' && usuraAlta)  bonus += 0.4;
    else if (decisioni.sostaQuando === 'tardi' && usuraBassa) bonus += 0.3;
    else if (decisioni.sostaQuando === 'presto' && usuraBassa) bonus -= 0.2;
  }

  if (tipo === 'gara_ar2_cp2') {
    if (decisioni.ritmo === 'push')    bonus += 0.2;
    else if (decisioni.ritmo === 'conserva') bonus -= 0.2;
    const softestM = mescole.length > 0 ? mescole[mescole.length - 1] : null;
    if (softestM && decisioni.mescolaFinale === softestM) bonus += 0.3;
  }

  return Math.max(-2, Math.min(2, bonus));
}

/* ============================================================
   QUALIFICA AR2 — 1 checkpoint (mescola + timing)
   ============================================================ */

function avviaQualificaAR2Checkpoint(circuito, meteo) {
  const pannello = el('pannello-qualifica-ar1');
  if (!pannello) return;

  const meteoQ = motore.generaMeteoSessione(meteo);
  const softestM = circuito.mescole[circuito.mescole.length - 1];
  const decisioni = { mescola: softestM, timing: 'tardi' };

  el('titolo-qualifica-ar1').textContent = 'Qualifiche — ' + circuito.nome;
  el('desc-qualifica-ar1').textContent   = circuito.circuito + ', ' + circuito.paese;
  mostraWidgetMeteo(meteoQ);
  el('segmento-qualifica-ar1').textContent = 'Checkpoint 1 / 1 — Strategia giro veloce';

  _renderDecisioniQualificaAR2(decisioni, circuito, meteoQ);

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-qualifica-ar1').setAttribute('tabindex', '-1');
  el('titolo-qualifica-ar1').focus();
  audio.inizioSessione();

  /* Binding checkpoint */
  const btnCP = el('btn-checkpoint-qualifica');
  btnCP.textContent = 'Conferma strategia →';
  btnCP.classList.remove('nascosta');
  const btnCPFresh = btnCP.cloneNode(true);
  btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
  btnCPFresh.addEventListener('click', () => {
    audio.conferma();
    const bonus = _calcolaBonusCheckpointDecisioni(decisioni, { tipo: 'qualifica_ar2', circuito, meteo: meteoQ });
    motore.stato.bonusFPCorrente = (motore.stato.bonusFPCorrente || 0) + bonus;
    /* Simula qualifica e mappa tempi per la visualizzazione */
    const griglia = motore.simulaQualifica(circuito, meteoQ);
    griglia.forEach(r => { if (!r.tempoMiglioreFormattato) r.tempoMiglioreFormattato = r.tempoFormattato; });
    el('segmento-qualifica-ar1').textContent = 'Griglia di partenza definitiva';
    const contenuto = el('contenuto-qualifica-ar1');
    contenuto.replaceChildren();
    const card = crea('div', { class: 'card' });
    card.appendChild(crea('h4', {}, 'Qualifiche concluse'));
    _appendClassificaQualifica(card, griglia, []);
    contenuto.appendChild(card);
    btnCPFresh.classList.add('nascosta');
    el('btn-fine-qualifica').classList.remove('nascosta');
    const polePilota = griglia[0]?.pilota?.nome || '—';
    annunciaVoiceOver('Qualifiche terminate. ' + polePilota + ' partirà dalla pole.');
    audio.fineSessione();
  });

  /* Binding chiudi */
  const btnFine = el('btn-fine-qualifica');
  btnFine.classList.add('nascosta');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.fineSessione();
    nascondiWidgetMeteo();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    motore.avanzaFase();   /* qualifica → sprint o gara */
    _routerPrincipale();
  });

  annunciaVoiceOver('Qualifiche AR2 — ' + circuito.nome + '. Scegli la strategia per il giro veloce.');
}

function _renderDecisioniQualificaAR2(decisioni, circuito, meteo) {
  const contenuto = el('contenuto-qualifica-ar1');
  contenuto.replaceChildren();

  /* Contesto */
  const cardCtx = crea('div', { class: 'card' });
  cardCtx.appendChild(crea('h4', {}, 'Condizioni'));
  const dlCtx = crea('dl', { class: 'lista-dati', 'aria-label': 'Condizioni sessione' });
  [['Meteo', meteo.pioggia ? 'Pioggia' : 'Asciutto'], ['Temperatura pista', meteo.temperaturaPista + '°C']].forEach(([k, v]) => {
    dlCtx.appendChild(crea('dt', {}, k)); dlCtx.appendChild(crea('dd', {}, v));
  });
  cardCtx.appendChild(dlCtx);
  contenuto.appendChild(cardCtx);

  /* Mescola */
  const cardM = crea('div', { class: 'card margine-sopra' });
  cardM.appendChild(crea('h4', {}, 'Mescola per il giro veloce'));
  const gruppoM = crea('div', { class: 'gruppo-decisione-qualifica' });
  const mescolaDisp = [...(circuito?.mescole || []), 'INTERMEDIA', 'FULL_WET'];
  mescolaDisp.forEach(m => {
    const mescola = DATI.MESCOLE[m];
    const btn = crea('button', {
      class: 'btn-gomma' + (decisioni.mescola === m ? ' selezionato' : ''),
      'aria-label': (mescola ? mescola.nome : m) + (decisioni.mescola === m ? ', selezionata' : ''),
      'aria-pressed': decisioni.mescola === m ? 'true' : 'false'
    }, m);
    btn.addEventListener('click', () => { decisioni.mescola = m; _renderDecisioniQualificaAR2(decisioni, circuito, meteo); });
    gruppoM.appendChild(btn);
  });
  cardM.appendChild(gruppoM);
  contenuto.appendChild(cardM);

  /* Timing */
  const cardT = crea('div', { class: 'card margine-sopra' });
  cardT.appendChild(crea('h4', {}, 'Timing del giro veloce'));
  const gruppoT = crea('div', { class: 'gruppo-decisione-qualifica' });
  [{ v: 'presto', label: 'Inizio sessione' }, { v: 'centrale', label: 'A metà' }, { v: 'tardi', label: 'Fine sessione' }].forEach(({ v, label }) => {
    const btn = crea('button', {
      class: 'btn-decisione' + (decisioni.timing === v ? ' selezionato' : ''),
      'aria-label': label + (decisioni.timing === v ? ', selezionato' : ''),
      'aria-pressed': decisioni.timing === v ? 'true' : 'false'
    }, label);
    btn.addEventListener('click', () => { decisioni.timing = v; _renderDecisioniQualificaAR2(decisioni, circuito, meteo); });
    gruppoT.appendChild(btn);
  });
  cardT.appendChild(gruppoT);
  contenuto.appendChild(cardT);
}

/* ============================================================
   GARA AR3 — 1 checkpoint (ritmo + gestione gomme)
   ============================================================ */

function avviaGaraAR3Checkpoint(circuito, meteo) {
  const pannello = el('pannello-gara-ar1');
  if (!pannello) return;

  const meteoGara  = motore.generaMeteoSessione(meteo);
  const decisioni  = { ritmo: 'normale', gestioneGomme: 'standard' };

  el('titolo-gara-ar1').textContent = 'Gara — ' + circuito.nome;
  el('desc-gara-ar1').textContent   = circuito.circuito + ', ' + circuito.paese;
  mostraWidgetMeteo(meteoGara, 'gara');
  el('stato-gara-ar1').replaceChildren();
  el('eventi-gara-ar1').replaceChildren();

  _renderDecisioniGaraAR3(decisioni, circuito, meteoGara);

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-gara-ar1').setAttribute('tabindex', '-1');
  el('titolo-gara-ar1').focus();
  audio.inizioSessione();

  /* Binding checkpoint */
  const btnCP = el('btn-checkpoint-gara');
  btnCP.textContent = 'Conferma strategia →';
  btnCP.classList.remove('nascosta');
  const btnCPFresh = btnCP.cloneNode(true);
  btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
  btnCPFresh.addEventListener('click', () => {
    audio.conferma();
    const bonus = _calcolaBonusCheckpointDecisioni(decisioni, { tipo: 'gara_ar3', circuito, meteo: meteoGara });
    motore.stato.bonusFPCorrente = (motore.stato.bonusFPCorrente || 0) + bonus;
    const griglia = motore.stato.grigliaPartenza || motore.simulaQualificaAR3(circuito, meteoGara);
    motore.simulaGara(circuito, meteoGara, griglia, {});
    motore.aggiornaDeltaOttimizzazione();
    _mostraFineGaraCheckpointAR23(circuito, meteoGara, pannello);
  });

  /* Binding fine gara */
  const btnFine = el('btn-fine-gara');
  btnFine.classList.add('nascosta');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.fineSessione();
    nascondiWidgetMeteo();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    apriPannelloSessionePostGara(circuito, meteoGara);
  });

  annunciaVoiceOver('Gara AR3 — ' + circuito.nome + '. Scegli ritmo e gestione pneumatici, poi conferma.');
}

function _renderDecisioniGaraAR3(decisioni, circuito, meteo) {
  const contenuto = el('contenuto-gara-ar1');
  contenuto.replaceChildren();

  /* Contesto circuito */
  const cardCtx = crea('div', { class: 'card' });
  cardCtx.appendChild(crea('h4', {}, 'Condizioni di gara'));
  const dl = crea('dl', { class: 'lista-dati', 'aria-label': 'Condizioni gara' });
  [['Usura gomme', circuito.usuraGomme || 'media'], ['Meteo', meteo.pioggia ? 'Pioggia' : 'Asciutto'], ['Temperatura pista', meteo.temperaturaPista + '°C']].forEach(([k, v]) => {
    dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, String(v)));
  });
  cardCtx.appendChild(dl);
  contenuto.appendChild(cardCtx);

  /* Ritmo */
  const cardR = crea('div', { class: 'card margine-sopra' });
  cardR.appendChild(crea('h4', {}, 'Ritmo di gara'));
  const gruppoR = crea('div', { class: 'gruppo-decisione-qualifica' });
  [{ v: 'push', label: 'Aggressivo' }, { v: 'normale', label: 'Bilanciato' }, { v: 'conserva', label: 'Conservativo' }].forEach(({ v, label }) => {
    const btn = crea('button', {
      class: 'btn-decisione' + (decisioni.ritmo === v ? ' selezionato' : ''),
      'aria-label': label + (decisioni.ritmo === v ? ', selezionato' : ''),
      'aria-pressed': decisioni.ritmo === v ? 'true' : 'false'
    }, label);
    btn.addEventListener('click', () => { decisioni.ritmo = v; _renderDecisioniGaraAR3(decisioni, circuito, meteo); });
    gruppoR.appendChild(btn);
  });
  cardR.appendChild(gruppoR);
  contenuto.appendChild(cardR);

  /* Gestione gomme */
  const cardG = crea('div', { class: 'card margine-sopra' });
  cardG.appendChild(crea('h4', {}, 'Gestione pneumatici'));
  const gruppoG = crea('div', { class: 'gruppo-decisione-qualifica' });
  [{ v: 'aggressiva', label: 'Aggressiva' }, { v: 'standard', label: 'Standard' }, { v: 'cautelosa', label: 'Cautelosa' }].forEach(({ v, label }) => {
    const btn = crea('button', {
      class: 'btn-decisione' + (decisioni.gestioneGomme === v ? ' selezionato' : ''),
      'aria-label': label + (decisioni.gestioneGomme === v ? ', selezionato' : ''),
      'aria-pressed': decisioni.gestioneGomme === v ? 'true' : 'false'
    }, label);
    btn.addEventListener('click', () => { decisioni.gestioneGomme = v; _renderDecisioniGaraAR3(decisioni, circuito, meteo); });
    gruppoG.appendChild(btn);
  });
  cardG.appendChild(gruppoG);
  contenuto.appendChild(cardG);
}

/* ============================================================
   GARA AR2 — 2 checkpoint (primo stint + secondo stint)
   ============================================================ */

function avviaGaraAR2Checkpoint(circuito, meteo) {
  const pannello = el('pannello-gara-ar1');
  if (!pannello) return;

  const meteoGara = motore.generaMeteoSessione(meteo);
  const softestM  = circuito.mescole[circuito.mescole.length - 1];
  const cp1       = { ritmo: 'normale', sostaQuando: 'standard' };
  const cp2       = { ritmo: 'push', mescolaFinale: softestM };
  let   faseCP    = 1;

  el('titolo-gara-ar1').textContent = 'Gara — ' + circuito.nome;
  el('desc-gara-ar1').textContent   = circuito.circuito + ', ' + circuito.paese;
  mostraWidgetMeteo(meteoGara, 'gara');
  el('stato-gara-ar1').replaceChildren();
  el('eventi-gara-ar1').replaceChildren();

  _renderDecisioniGaraAR2(cp1, null, circuito, meteoGara, 1);

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-gara-ar1').setAttribute('tabindex', '-1');
  el('titolo-gara-ar1').focus();
  audio.inizioSessione();

  function rebindCheckpoint() {
    const btnCP = el('btn-checkpoint-gara');
    const btnCPFresh = btnCP.cloneNode(true);
    btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
    btnCPFresh.addEventListener('click', () => {
      audio.conferma();
      if (faseCP === 1) {
        /* Avanza a CP2 */
        motore.stato.bonusFPCorrente = (motore.stato.bonusFPCorrente || 0) +
          _calcolaBonusCheckpointDecisioni(cp1, { tipo: 'gara_ar2_cp1', circuito, meteo: meteoGara });
        faseCP = 2;
        btnCPFresh.textContent = 'Conferma secondo stint →';
        _renderDecisioniGaraAR2(cp2, cp1, circuito, meteoGara, 2);
        rebindCheckpoint();
      } else {
        /* Conferma finale: applica bonus CP2, simula, mostra risultati */
        motore.stato.bonusFPCorrente = (motore.stato.bonusFPCorrente || 0) +
          _calcolaBonusCheckpointDecisioni(cp2, { tipo: 'gara_ar2_cp2', circuito, meteo: meteoGara });
        const griglia = motore.stato.grigliaPartenza || motore.simulaQualifica(circuito, meteoGara);
        motore.simulaGara(circuito, meteoGara, griglia, {});
        motore.aggiornaDeltaOttimizzazione();
        _mostraFineGaraCheckpointAR23(circuito, meteoGara, pannello);
      }
    });
    if (faseCP === 1) btnCPFresh.textContent = 'Conferma primo stint →';
  }

  const btnCP = el('btn-checkpoint-gara');
  btnCP.textContent = 'Conferma primo stint →';
  btnCP.classList.remove('nascosta');
  rebindCheckpoint();

  /* Binding fine gara */
  const btnFine = el('btn-fine-gara');
  btnFine.classList.add('nascosta');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.fineSessione();
    nascondiWidgetMeteo();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    apriPannelloSessionePostGara(circuito, meteoGara);
  });

  annunciaVoiceOver('Gara AR2 — ' + circuito.nome + '. Checkpoint 1 di 2: strategia primo stint.');
}

function _renderDecisioniGaraAR2(decisioni, cp1, circuito, meteo, numCP) {
  const contenuto = el('contenuto-gara-ar1');
  contenuto.replaceChildren();

  el('titolo-gara-ar1').textContent = 'Gara — ' + circuito.nome + ' (Checkpoint ' + numCP + ' / 2)';

  /* Contesto */
  const cardCtx = crea('div', { class: 'card' });
  cardCtx.appendChild(crea('h4', {}, numCP === 1 ? 'Primo stint' : 'Secondo stint'));
  const dl = crea('dl', { class: 'lista-dati', 'aria-label': 'Condizioni gara' });
  const voci = [['Usura gomme', circuito.usuraGomme || 'media'], ['Meteo', meteo.pioggia ? 'Pioggia' : 'Asciutto']];
  if (numCP === 2 && cp1) voci.push(['Sosta pianificata', cp1.sostaQuando]);
  voci.forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, String(v))); });
  cardCtx.appendChild(dl);
  contenuto.appendChild(cardCtx);

  /* Ritmo */
  const cardR = crea('div', { class: 'card margine-sopra' });
  cardR.appendChild(crea('h4', {}, numCP === 1 ? 'Ritmo primo stint' : 'Ritmo secondo stint'));
  const gruppoR = crea('div', { class: 'gruppo-decisione-qualifica' });
  [{ v: 'push', label: 'Aggressivo' }, { v: 'normale', label: 'Bilanciato' }, { v: 'conserva', label: 'Conservativo' }].forEach(({ v, label }) => {
    const btn = crea('button', {
      class: 'btn-decisione' + (decisioni.ritmo === v ? ' selezionato' : ''),
      'aria-label': label + (decisioni.ritmo === v ? ', selezionato' : ''),
      'aria-pressed': decisioni.ritmo === v ? 'true' : 'false'
    }, label);
    btn.addEventListener('click', () => { decisioni.ritmo = v; _renderDecisioniGaraAR2(decisioni, cp1, circuito, meteo, numCP); });
    gruppoR.appendChild(btn);
  });
  cardR.appendChild(gruppoR);
  contenuto.appendChild(cardR);

  /* CP1: quando sostare | CP2: mescola finale */
  if (numCP === 1) {
    const cardS = crea('div', { class: 'card margine-sopra' });
    cardS.appendChild(crea('h4', {}, 'Strategia sosta'));
    const gruppoS = crea('div', { class: 'gruppo-decisione-qualifica' });
    [{ v: 'presto', label: 'Presto (giro 10-15)' }, { v: 'standard', label: 'Metà gara' }, { v: 'tardi', label: 'Tardi (giro 35+)' }].forEach(({ v, label }) => {
      const btn = crea('button', {
        class: 'btn-decisione' + (decisioni.sostaQuando === v ? ' selezionato' : ''),
        'aria-label': label + (decisioni.sostaQuando === v ? ', selezionato' : ''),
        'aria-pressed': decisioni.sostaQuando === v ? 'true' : 'false'
      }, label);
      btn.addEventListener('click', () => { decisioni.sostaQuando = v; _renderDecisioniGaraAR2(decisioni, cp1, circuito, meteo, numCP); });
      gruppoS.appendChild(btn);
    });
    cardS.appendChild(gruppoS);
    contenuto.appendChild(cardS);
  } else {
    const cardM = crea('div', { class: 'card margine-sopra' });
    cardM.appendChild(crea('h4', {}, 'Mescola secondo stint'));
    const gruppoM = crea('div', { class: 'gruppo-decisione-qualifica' });
    const mescolaDisp = [...(circuito?.mescole || []), 'INTERMEDIA', 'FULL_WET'];
    mescolaDisp.forEach(m => {
      const mescola = DATI.MESCOLE[m];
      const btn = crea('button', {
        class: 'btn-gomma' + (decisioni.mescolaFinale === m ? ' selezionato' : ''),
        'aria-label': (mescola ? mescola.nome : m) + (decisioni.mescolaFinale === m ? ', selezionata' : ''),
        'aria-pressed': decisioni.mescolaFinale === m ? 'true' : 'false'
      }, m);
      btn.addEventListener('click', () => { decisioni.mescolaFinale = m; _renderDecisioniGaraAR2(decisioni, cp1, circuito, meteo, numCP); });
      gruppoM.appendChild(btn);
    });
    cardM.appendChild(gruppoM);
    contenuto.appendChild(cardM);
  }
}

/* ============================================================
   HELPER COMUNE — mostra classifica finale gara AR2/AR3
   ============================================================ */

function _mostraFineGaraCheckpointAR23(circuito, meteo, pannello) {
  const risultati = motore.stato.ultimaGara?.risultati || [];

  el('titolo-gara-ar1').textContent = 'Classifica finale — ' + circuito.nome;
  el('stato-gara-ar1').replaceChildren();
  el('eventi-gara-ar1').replaceChildren();

  const contenuto = el('contenuto-gara-ar1');
  contenuto.replaceChildren();

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Classifica gara'));
  const top10 = risultati.slice(0, 10);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica gara finale' });
  top10.forEach((r, idx) => {
    const li = crea('li', {
      class: 'riga-classifica' + (r.isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota?.nome || '—'} — ${r.puntiGuadagnati || 0} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, r.pilota?.nome || '—'));
    li.appendChild(crea('span', { class: 'punti-classifica' }, '+' + (r.puntiGuadagnati || 0)));
    ol.appendChild(li);
  });
  card.appendChild(ol);
  contenuto.appendChild(card);

  el('btn-checkpoint-gara').classList.add('nascosta');
  el('btn-fine-gara').classList.remove('nascosta');

  const vincitore = risultati[0]?.pilota?.nome || '—';
  annunciaVoiceOver('Gara terminata. ' + vincitore + ' vince.');
  audio.fineSessione();
  if (risultati.some(r => r.isGiocatore && r.posizione === 1)) audio.vittoria();
}

/* ============================================================
   GARA AR1 — interfaccia a checkpoint
   ============================================================ */

let _decisioniGaraAR1 = { pilota1: {}, pilota2: {} };

function avviaGaraAR1(circuito, meteo) {
  const pannello = el('pannello-gara-ar1');
  if (!pannello) return;

  const meteoGara = motore.generaMeteoSessione(meteo);
  motore.iniziaGaraAR1(circuito, meteoGara);

  el('titolo-gara-ar1').textContent = 'Gara — ' + circuito.nome;
  el('desc-gara-ar1').textContent   = circuito.circuito + ', ' + circuito.paese;

  mostraWidgetMeteo(meteoGara, 'gara');

  _decisioniGaraAR1 = {
    pilota1: { ritmo: 'normale', pitStop: null },
    pilota2: { ritmo: 'normale', pitStop: null }
  };

  /* Pulisce la scelta mescola dopo che il motore l'ha applicata all'avvio */
  motore.stato.mescolaPartenzaScelta = null;

  _renderCheckpointGaraAR1(null, circuito);

  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  ultimoFocusAperturaOverlay = document.activeElement;
  el('titolo-gara-ar1').setAttribute('tabindex', '-1');
  el('titolo-gara-ar1').focus();

  audio.inizioSessione();

  /* Binding checkpoint */
  const btnCP = el('btn-checkpoint-gara');
  const btnCPFresh = btnCP.cloneNode(true);
  btnCP.parentNode.replaceChild(btnCPFresh, btnCP);
  btnCPFresh.addEventListener('click', () => {
    audio.conferma();
    const risultato = motore.simulaGaraAR1AlCheckpoint(_decisioniGaraAR1);
    if (!risultato) return;
    aggiornaWidgetMeteo(risultato.meteoAttuale);
    if (risultato.safetyCar) audio.safetyCar();
    _appendEventiGara(risultato.eventiCheckpoint);
    _aggiornaStatoGara(risultato);

    if (risultato.eConclusaGara) {
      _mostraFineGaraAR1();
    } else {
      /* Reset pit stop pianificato dopo ogni checkpoint */
      _decisioniGaraAR1.pilota1.pitStop = null;
      _decisioniGaraAR1.pilota2.pitStop = null;
      _renderCheckpointGaraAR1(risultato, circuito);
    }
  });

  /* Binding fine gara */
  const btnFine = el('btn-fine-gara');
  const btnFineFresh = btnFine.cloneNode(true);
  btnFine.parentNode.replaceChild(btnFineFresh, btnFine);
  btnFineFresh.addEventListener('click', () => {
    audio.fineSessione();
    nascondiWidgetMeteo();
    pannello.classList.add('nascosta');
    pannello.setAttribute('aria-hidden', 'true');
    /* NON avanzare il motore qui: l'avanzamento gara→post-gara avviene nel callback di apriPannelloSessionePostGara */
    apriPannelloSessionePostGara(circuito, meteoGara);
  });
}

function _aggiornaStatoGara(risultato) {
  const sg = motore.stato.statoGaraAttivo;
  const div = el('stato-gara-ar1');
  div.replaceChildren();

  const voci = [
    ['Giro', `${risultato.giroCorrente} / ${risultato.giriTotali}`],
    ['SC / VSC', risultato.safetyCar ? 'SAFETY CAR' : risultato.virtualSafetyCar ? 'VSC' : 'No',
      risultato.safetyCar || risultato.virtualSafetyCar ? 'warning' : ''],
    ['Pista', risultato.meteoAttuale.temperaturaPista + '°C'],
    ['Meteo', risultato.meteoAttuale.pioggia ? `Pioggia ${risultato.meteoAttuale.intensitaPioggia}%` : 'Asciutto']
  ];

  voci.forEach(([label, val, cls]) => {
    const riga = crea('div', { class: 'riga-stato-gara' });
    riga.appendChild(crea('span', { class: 'etichetta-stato' }, label));
    riga.appendChild(crea('span', { class: 'valore-stato' + (cls ? ' ' + cls : '') }, val));
    div.appendChild(riga);
  });

  /* Posizioni top 6 + giocatore */
  const top6 = risultato.posizioni.slice(0, 6);
  const ulPos = crea('ul', { class: 'lista-classifica', style: 'margin-top:var(--spazio-s)', 'aria-label': 'Posizioni in gara' });
  top6.forEach(r => {
    const li = crea('li', {
      class: 'riga-posizione-gara' + (r.isGiocatore ? ' giocatore-highlight' : '') + (r.ritiro ? ' ritirato' : ''),
      'aria-label': `${r.posizione}°: ${r.pilota.nome}, gap ${r.gap}s, gomma ${r.gommaCorrente}, usura ${Math.round(r.usuraGomma)}%`
    });
    li.appendChild(crea('span', { class: 'pos-gara' }, String(r.posizione)));
    li.appendChild(crea('span', { class: 'nome-pilota-gara' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'gomma-gara', style: 'color:var(--colore-economia)' }, r.gommaCorrente || ''));
    li.appendChild(crea('span', { class: 'usura-gara', style: r.usuraGomma > 75 ? 'color:var(--colore-relazioni)' : '' },
      Math.round(r.usuraGomma) + '%'));
    li.appendChild(crea('span', { class: 'gap-gara' }, r.posizione === 1 ? 'leader' : '+' + r.gap + 's'));
    ulPos.appendChild(li);
  });
  div.appendChild(ulPos);
}

function _appendEventiGara(eventi) {
  const log = el('eventi-gara-ar1');
  eventi.forEach(ev => {
    const div = crea('div', { class: 'evento-gara ' + (ev.tipo || ''),
      'aria-label': `Giro ${ev.giro}: ${ev.descrizione}` });
    div.appendChild(crea('span', { class: 'giro-evento', 'aria-hidden': 'true' }, 'G' + ev.giro));
    div.appendChild(document.createTextNode(ev.descrizione));
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    if (ev.tipo === 'pit_stop') audio.pitStop();
  });
}

function _renderCheckpointGaraAR1(risultato, circuito) {
  const contenuto = el('contenuto-gara-ar1');
  contenuto.replaceChildren();

  const sg = motore.stato.statoGaraAttivo;
  const stato = motore.stato;

  /* Pannello decisioni per ogni pilota */
  (stato.piloti || []).forEach((pilota, idx) => {
    const chiave  = idx === 0 ? 'pilota1' : 'pilota2';
    const dec     = _decisioniGaraAR1[chiave];

    /* Trova partecipante corrispondente per dati live */
    const partecipante = sg?.partecipanti?.find(p => p.isGiocatore && p.pilotaIndex === idx);

    const pannelloPilota = crea('div', { class: 'pannello-pilota-gara',
      'aria-label': `Decisioni per ${pilota.nome}` });
    pannelloPilota.appendChild(crea('h4', {}, pilota.nome));

    /* Dati live pilota */
    if (partecipante) {
      const dati = [
        `Pos: ${partecipante.posizione || '—'}`,
        `Gap: ${partecipante.posizione === 1 ? 'leader' : '+' + (partecipante.gap || 0) + 's'}`,
        `Gomma: ${partecipante.gommaCorrente} — Usura: ${Math.round(partecipante.usuraGomma || 0)}%`,
        `Soste: ${partecipante.fermateEffettuate || 0}`
      ].join('  ·  ');
      pannelloPilota.appendChild(crea('p', { class: 'dati-pilota-gara', 'aria-label': dati }, dati));
    }

    /* Scelta ritmo */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-s)' }, 'Ritmo:'));
    const gruppoRitmo = crea('div', { class: 'gruppo-decisione-qualifica' });
    [{ v: 'push', label: 'Push' }, { v: 'normale', label: 'Normale' }, { v: 'conserva', label: 'Conserva' }].forEach(({ v, label }) => {
      const btn = crea('button', {
        class: 'btn-decisione' + (dec.ritmo === v ? ' selezionato' : ''),
        'aria-label': label + (dec.ritmo === v ? ', selezionato' : ''),
        'aria-pressed': dec.ritmo === v ? 'true' : 'false'
      }, label);
      btn.addEventListener('click', () => {
        _decisioniGaraAR1[chiave].ritmo = v;
        _renderCheckpointGaraAR1(risultato, circuito);
      });
      gruppoRitmo.appendChild(btn);
    });
    pannelloPilota.appendChild(gruppoRitmo);

    /* Pit stop */
    pannelloPilota.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario); margin-top:var(--spazio-s)' }, 'Sosta:'));
    const gruppoSosta = crea('div', { class: 'gruppo-decisione-qualifica', style: 'flex-wrap:wrap;' });

    /* Bottone nessuna sosta */
    const btnNoSosta = crea('button', {
      class: 'btn-decisione' + (!dec.pitStop ? ' selezionato' : ''),
      'aria-label': 'Nessuna sosta pianificata' + (!dec.pitStop ? ', selezionato' : ''),
      'aria-pressed': !dec.pitStop ? 'true' : 'false'
    }, 'Nessuna sosta');
    btnNoSosta.addEventListener('click', () => {
      _decisioniGaraAR1[chiave].pitStop = null;
      _renderCheckpointGaraAR1(risultato, circuito);
    });
    gruppoSosta.appendChild(btnNoSosta);

    /* Soste per ogni mescola disponibile nel checkpoint successivo */
    const prossimoCPGiro = (sg?.giroCorrente || 0) + 5; /* Giro centrale del prossimo checkpoint */
    const mescolaDisp = [...(circuito?.mescole || []), 'INTERMEDIA', 'FULL_WET'];
    mescolaDisp.forEach(m => {
      const mescola = DATI.MESCOLE[m];
      const isSelezionato = dec.pitStop?.mescola === m;
      const btn = crea('button', {
        class: 'btn-gomma' + (isSelezionato ? ' selezionato' : ''),
        'aria-label': 'Sosta con ' + (mescola ? mescola.nome : m) + (isSelezionato ? ', selezionata' : ''),
        'aria-pressed': isSelezionato ? 'true' : 'false'
      }, 'Sosta ' + m);
      btn.addEventListener('click', () => {
        _decisioniGaraAR1[chiave].pitStop = { giro: prossimoCPGiro, mescola: m };
        _renderCheckpointGaraAR1(risultato, circuito);
      });
      gruppoSosta.appendChild(btn);
    });

    pannelloPilota.appendChild(gruppoSosta);
    contenuto.appendChild(pannelloPilota);
  });
}

function _mostraFineGaraAR1() {
  const sg = motore.stato.statoGaraAttivo;
  const risultati = sg?.risultatiFinali || [];

  const contenuto = el('contenuto-gara-ar1');
  contenuto.replaceChildren();

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Classifica finale'));

  const top10 = risultati.slice(0, 10);
  const ol = crea('ol', { class: 'lista-classifica', 'aria-label': 'Classifica gara finale' });
  top10.forEach((r, idx) => {
    const li = crea('li', {
      class: 'riga-classifica' + (r.isGiocatore ? ' giocatore-highlight' : ''),
      'aria-label': `${idx + 1}°: ${r.pilota.nome} — ${r.puntiGuadagnati} punti`
    });
    li.appendChild(crea('span', { class: 'posizione-classifica' + (idx < 3 ? ' podio' : '') }, String(idx + 1)));
    li.appendChild(crea('span', { class: 'nome-classifica' }, r.pilota.nome));
    li.appendChild(crea('span', { class: 'punti-classifica' }, '+' + (r.puntiGuadagnati || 0)));
    if (r.giroVeloce) li.appendChild(crea('span', { class: 'badge-sprint', style: 'font-size:11px;margin-left:4px;', 'aria-label': 'Giro veloce' }, 'GV'));
    ol.appendChild(li);
  });
  card.appendChild(ol);
  contenuto.appendChild(card);

  el('btn-checkpoint-gara').classList.add('nascosta');
  el('btn-fine-gara').classList.remove('nascosta');

  const vincitore = risultati[0]?.pilota?.nome || '—';
  annunciaVoiceOver('Gara terminata. ' + vincitore + ' vince.');
  audio.fineSessione();
  if (risultati.some(r => r.isGiocatore && r.posizione === 1)) audio.vittoria();
}

function apriPannelloSessionePostGara(circuito, meteo) {
  /* Riusa pannello-sessione per mostrare il resoconto post-gara */
  el('titolo-sessione').textContent = 'Conferenza stampa — ' + circuito.nome;
  el('descrizione-sessione').textContent = 'Resoconto e risultati finali del Gran Premio.';
  renderMeteo(meteo, circuito);

  const contenuto = el('contenuto-decisioni');
  contenuto.replaceChildren();
  _renderPostGara(contenuto);

  const pannello = el('pannello-sessione');
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');
  el('titolo-sessione').setAttribute('tabindex', '-1');
  el('titolo-sessione').focus();

  el('btn-simula-sessione').style.display = 'none';
  _aggiornaBtnAvanzaFase('Prosegui', 'Chiudi il resoconto e prosegui', () => {
    chiudiPannelloSessione();
    motore.avanzaFase();   /* gara → post-gara */
    _routerPrincipale();   /* post-gara auto-attraversato → inter-gara */
  });

  annunciaVoiceOver('Conferenza stampa post-gara. Consulta i risultati.');
}

/* ============================================================
   STORICO RISULTATI, STRATEGIA GOMME, LOGISTICA
   (pannelli sub-sezione Operazioni AR1)
   ============================================================ */

function mostraStoricoRisultati() {
  const stato = motore.stato;
  const contenuto = el('contenuto-storico-risultati');
  if (!contenuto) return;
  contenuto.replaceChildren();

  /* Ultime gare della stagione corrente */
  const ultimaGara = stato.ultimaGara;
  if (!ultimaGara || !ultimaGara.risultati) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessuna gara disputata in questa stagione.'));
    return;
  }

  const card = crea('div', { class: 'card' });
  const circuito = DATI.CIRCUITI.find(c => c.id === ultimaGara.circuito);
  card.appendChild(crea('h4', {}, 'Ultima gara' + (circuito ? ' — ' + circuito.nome : '')));

  const pilotiGiocatore = ultimaGara.risultati.filter(r => r.isGiocatore);
  pilotiGiocatore.forEach(r => {
    const p = crea('p', {
      'aria-label': `${r.pilota.nome}: ${r.posizione}° posto — ${r.puntiGuadagnati} punti`
    }, `${r.pilota.nome} — ${r.posizione}° posto — +${r.puntiGuadagnati} pt` + (r.giroVeloce ? ' (giro veloce)' : ''));
    p.style.fontWeight = '600';
    card.appendChild(p);
  });

  /* Ultimi 3 eventi rilevanti */
  const eventiRilevanti = (ultimaGara.eventi || [])
    .filter(e => ['safety_car', 'ritiro', 'pit_stop', 'meteo_pioggia'].includes(e.tipo))
    .slice(-5);
  if (eventiRilevanti.length > 0) {
    card.appendChild(crea('p', { class: 'card-etichetta', style: 'margin-top:var(--spazio-m)' }, 'Momenti chiave:'));
    eventiRilevanti.forEach(ev => {
      card.appendChild(crea('p', { style: 'font-size:var(--dim-piccolo); color:var(--testo-secondario)' },
        `G${ev.giro} — ${ev.descrizione}`));
    });
  }

  contenuto.appendChild(card);
}

function mostraStrategiaGomme(circuito) {
  const stato = motore.stato;
  const contenuto = el('contenuto-strategia-gomme');
  if (!contenuto) return;
  contenuto.replaceChildren();

  if (!circuito) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Nessun weekend attivo.'));
    return;
  }

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h4', {}, 'Mescole disponibili — ' + circuito.nome));

  const mescole = circuito.mescole || [];
  const dl = crea('dl', { class: 'lista-dati' });
  mescole.forEach(m => {
    const mescola = DATI.MESCOLE[m];
    if (!mescola) return;
    dl.appendChild(crea('dt', {}, mescola.nome + ' (' + m + ')'));
    dl.appendChild(crea('dd', {}, `Grip: ${mescola.grip} — Durata: ${mescola.durata} — T ottimale: ${mescola.temperaturaOttimale.min}–${mescola.temperaturaOttimale.max}°C`));
  });
  card.appendChild(dl);

  /* Indicazione obbligo due mescole */
  const nota = crea('p', {
    class: 'nota-direttore',
    style: 'margin-top:var(--spazio-m)',
    role: 'note',
    'aria-label': 'Regolamento gomme: obbligo di utilizzare almeno due mescole diverse in gara.'
  }, 'Regolamento: in gara è obbligatorio l\'utilizzo di almeno due mescole differenti. Almeno una sosta prevista.');
  card.appendChild(nota);

  contenuto.appendChild(card);
}

function mostraLogistica() {
  const stato = motore.stato;
  const contenuto = el('contenuto-logistica');
  if (!contenuto) return;
  contenuto.replaceChildren();

  if (stato.categoria !== 'AR1') {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Logistica dettagliata disponibile in AR1.'));
    return;
  }

  const log = motore.calcolaLogistica();
  if (!log) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Dati logistici non disponibili.'));
    return;
  }

  const card = crea('div', { class: 'scheda-logistica' });

  const dl = crea('dl', { 'aria-label': 'Dettagli logistici spostamento' });
  [
    ['Partenza', log.circuitoPartenza + ' — ' + log.partenza],
    ['Destinazione', log.circuitoProssimo + ' — ' + log.destinazione],
    ['Costo stimato', formatMoneta(log.costoStimato)],
    ['Efficienza team', log.efficienzaTeam + '%']
  ].forEach(([k, v]) => {
    dl.appendChild(crea('dt', {}, k));
    dl.appendChild(crea('dd', {}, v));
  });
  card.appendChild(dl);

  const nota = crea('p', {
    class: 'nota-direttore',
    role: 'note',
    'aria-label': 'Nota del Direttore Logistica: ' + log.notaDirettore
  }, log.notaDirettore);
  card.appendChild(nota);

  contenuto.appendChild(card);
}

/* ============================================================
   PAUSA INVERNALE AR1 — hub di gestione inter-stagionale
   ============================================================ */

let _capitoloAttivoInvernale = 'consuntivo';

function mostraPausaInvernale() {
  const pannello = el('pannello-pausa-invernale');
  if (!pannello) return;

  /* Reset stato view test: evita che risultati di sessioni precedenti appaiano in una nuova pausa */
  _viewTest      = 'selezione';
  _risultatoTest = null;

  const stato = motore.stato;
  const cons  = motore.ottieniDatiConsuntivo?.() || {};

  el('titolo-pausa-invernale').textContent =
    'Pausa invernale — Stagione ' + cons.nuovaStagione + (cons.cambioEra ? ' · Cambio era regolamentare' : '');

  ultimoFocusAperturaOverlay = document.activeElement;
  pannello.classList.remove('nascosta');
  pannello.removeAttribute('aria-hidden');

  const titoloPI = el('titolo-pausa-invernale');
  titoloPI.setAttribute('tabindex', '-1');
  titoloPI.focus();

  /* Avviso contratti staff in scadenza */
  const mercatoPausa = motore.ottieniStatoMercato();
  const inScadenzaPI = mercatoPausa.staffInScadenza || [];
  if (inScadenzaPI.length > 0) {
    const nomi = inScadenzaPI.map(s => s.nome).join(', ');
    setTimeout(() => annunciaVoiceOver(
      'Attenzione: ' + inScadenzaPI.length + (inScadenzaPI.length === 1 ? ' contratto staff in scadenza: ' : ' contratti staff in scadenza: ') +
      nomi + '. Vai al capitolo Staff per rinnovare.'
    ), 800);
  }

  /* Binding capitoli */
  ['consuntivo', 'concept', 'sviluppo', 'budget', 'piloti', 'staff', 'test', 'riunioni'].forEach(cap => {
    const btn = el('cap-btn-' + cap);
    if (!btn) return;
    const btnFresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(btnFresh, btn);
    btnFresh.addEventListener('click', () => {
      audio.navigazione();
      _apriCapitoloPausa(cap);
    });
  });

  /* Binding pulsante Avvia stagione */
  const btnAvvia = el('btn-avvia-stagione');
  const btnAvviaFresh = btnAvvia.cloneNode(true);
  btnAvvia.parentNode.replaceChild(btnAvviaFresh, btnAvvia);
  btnAvviaFresh.addEventListener('click', () => {
    mostraDialogo(
      'Avvia stagione ' + stato.stagione,
      'Confermando, tutte le scelte invernali verranno finalizzate e la nuova stagione avrà inizio.',
      () => {
        const ris = motore.completaPausaInvernale();
        if (!ris.ok) { annunciaVoiceOver('Errore: ' + (ris.messaggio || 'impossibile avviare.')); return; }
        pannello.classList.add('nascosta');
        pannello.setAttribute('aria-hidden', 'true');
        audio.inizioSessione();
        adattaMenuCategoria(motore.stato.categoria);
        annunciaVoiceOver('Stagione ' + motore.stato.stagione + ' avviata.');
        _routerPrincipale();   /* completaPausaInvernale imposta inter-gara → mostraIntergaraAR1 */
      }
    );
  });

  _apriCapitoloPausa('consuntivo');
}

function _apriCapitoloPausa(capitolo) {
  _capitoloAttivoInvernale = capitolo;

  /* Segna capitolo come visitato nel motore */
  motore.segnaCapitoloInvernale?.(capitolo);

  /* Conta contratti staff critici per badge nav */
  const mercatoStaff = motore.ottieniMercatoStaffAR1?.();
  const nContrattiCritici = mercatoStaff
    ? mercatoStaff.staff.filter(s => s.inScadenza || s.preScadenza).length
    : 0;

  /* Aggiorna stato pulsanti navigazione */
  ['consuntivo', 'concept', 'sviluppo', 'budget', 'piloti', 'staff', 'test', 'riunioni'].forEach(cap => {
    const btn = el('cap-btn-' + cap);
    if (!btn) return;
    const attivo = cap === capitolo;
    btn.classList.toggle('selezionato', attivo);
    btn.setAttribute('aria-pressed', attivo ? 'true' : 'false');

    /* Indicatore visita */
    const visitato = motore.stato.pausaInvernaleCapitoli?.[cap];
    const obbl = cap === 'concept' || cap === 'piloti';
    const nomeVisivo = cap === 'test' ? 'Test' : cap === 'riunioni' ? 'Riunioni' : cap.charAt(0).toUpperCase() + cap.slice(1);
    let labelBase = nomeVisivo + (obbl ? ' ★' : '');
    if (cap === 'staff' && nContrattiCritici > 0) labelBase += ' !';
    btn.textContent = visitato ? labelBase + ' ✓' : labelBase;

    /* aria-label descrittivo per staff con contratti critici */
    if (cap === 'staff' && nContrattiCritici > 0) {
      btn.setAttribute('aria-label', 'Capitolo Staff — ' + nContrattiCritici + ' contratt' + (nContrattiCritici === 1 ? 'o' : 'i') + ' in scadenza');
    } else {
      btn.removeAttribute('aria-label');
    }
  });

  const contenuto = el('contenuto-pausa-invernale');
  contenuto.replaceChildren();

  switch (capitolo) {
    case 'consuntivo': _renderCapitoloConsuntivo(contenuto); break;
    case 'concept':    _renderCapitoloConcept(contenuto);    break;
    case 'sviluppo':   _renderCapitoloSviluppo(contenuto);   break;
    case 'budget':     _renderCapitoloBudget(contenuto);      break;
    case 'piloti':     _renderCapitoloPiloti(contenuto);      break;
    case 'staff':      _renderCapitoloStaff(contenuto);       break;
    case 'test':       _renderCapitoloTest(contenuto);        break;
    case 'riunioni':   _renderCapitoloRiunioni(contenuto);    break;
  }

  _verificaAvviaStagione();
  el('contenuto-pausa-invernale').scrollTop = 0;
}

function _verificaAvviaStagione() {
  const cap    = motore.stato.pausaInvernaleCapitoli || {};
  const pronto = cap.concept && cap.piloti;
  const btn    = el('btn-avvia-stagione');
  const nota   = el('nota-avvia-stagione');
  if (!btn) return;
  btn.disabled = !pronto;
  btn.setAttribute('aria-disabled', pronto ? 'false' : 'true');
  btn.setAttribute('aria-label', pronto
    ? 'Avvia stagione ' + motore.stato.stagione
    : 'Avvia stagione — completa prima i capitoli obbligatori');
  if (nota) {
    nota.textContent = pronto
      ? 'Pronto. Tutte le scelte obbligatorie sono state effettuate.'
      : 'I capitoli con ★ sono obbligatori per avviare la stagione.';
  }
}

/* ----- Capitolo 1: Consuntivo ----- */
function _renderCapitoloConsuntivo(contenuto) {
  const cons = motore.ottieniDatiConsuntivo?.();
  if (!cons) return;

  const cardRis = crea('div', { class: 'card' });
  cardRis.appendChild(crea('h3', {}, 'Stagione ' + cons.stagione + ' — Consuntivo'));
  const dlRis = crea('dl', { 'aria-label': 'Risultato sportivo' });
  [
    ['Posizione finale',     cons.posizione + '° nel campionato costruttori'],
    ['Punti totalizzati',    cons.punti + ' punti']
  ].forEach(([k, v]) => { dlRis.appendChild(crea('dt', {}, k)); dlRis.appendChild(crea('dd', {}, v)); });
  cardRis.appendChild(dlRis);
  contenuto.appendChild(cardRis);

  const cardBudget = crea('div', { class: 'card margine-sopra' });
  cardBudget.appendChild(crea('h3', {}, 'Situazione finanziaria'));
  const dlB = crea('dl', { 'aria-label': 'Dati finanziari' });
  [
    ['Budget residuo',          formatMoneta(cons.budgetResiduo)],
    ['Prize money in arrivo',   formatMoneta(cons.prizeMoney)],
    ['Bonus storici Federazione', formatMoneta(cons.bonusStorico)],
    ['Entrate sponsor stagione', formatMoneta(cons.entrateSponsor)],
    ['Budget disponibile ' + cons.nuovaStagione, formatMoneta(cons.budgetNuovaStagione)]
  ].forEach(([k, v]) => { dlB.appendChild(crea('dt', {}, k)); dlB.appendChild(crea('dd', { class: 'valore-stat' }, v)); });
  cardBudget.appendChild(dlB);
  contenuto.appendChild(cardBudget);

  if (cons.eventoStagione === 'salvataggio_crisi') {
    const cardCrisi = crea('div', { class: 'card margine-sopra', role: 'alert' });
    cardCrisi.appendChild(crea('h3', { class: 'testo-avviso' }, 'Intervento straordinario Federazione'));
    cardCrisi.appendChild(crea('p', {}, 'La squadra ha concluso ultima nel campionato costruttori. La Federazione ha erogato un finanziamento straordinario che garantisce la continuita operativa per la stagione ' + cons.nuovaStagione + '.'));
    contenuto.appendChild(cardCrisi);
  }

  if (cons.cambioEra) {
    const cardEra = crea('div', { class: 'card margine-sopra', role: 'note' });
    cardEra.appendChild(crea('h3', { class: 'testo-highlight' }, 'Cambio era regolamentare'));
    cardEra.appendChild(crea('p', {}, 'La stagione ' + cons.nuovaStagione + ' inaugura una nuova era regolamentare. Il Capo Ingegnere deve definire il concept della nuova vettura nel capitolo dedicato. Le gerarchie competitive sono rimescolate.'));
    contenuto.appendChild(cardEra);
  }

  /* Movimenti di mercato piloti AI */
  const eventi = motore.ottieniEventiMercatoAI?.() || [];
  if (eventi.length > 0) {
    const cardMercato = crea('div', { class: 'card margine-sopra' });
    cardMercato.appendChild(crea('h3', {}, 'Movimenti di mercato piloti'));
    const lista = crea('ul', { 'aria-label': 'Movimenti piloti squadre avversarie' });
    const nomiSquadre = {};
    (DATI.SQUADRE_AR1 || []).forEach(s => { nomiSquadre[s.id] = s.nomeBreve || s.id; });
    eventi.forEach(ev => {
      const nomeSquadra = nomiSquadre[ev.squadra] || ev.squadra;
      let testo = '';
      if (ev.tipo === 'ritiro')    testo = ev.pilota + ' si ritira dalle competizioni.';
      if (ev.tipo === 'rilascio')  testo = ev.pilota + ' lascia ' + nomeSquadra + '. Agente libero.';
      if (ev.tipo === 'ingaggio')  testo = ev.pilota + ' ingaggiato da ' + nomeSquadra + '.';
      if (ev.tipo === 'promozione') testo = ev.pilota + ' promosso titolare in ' + nomeSquadra + '.';
      if (testo) lista.appendChild(crea('li', {}, testo));
    });
    cardMercato.appendChild(lista);
    contenuto.appendChild(cardMercato);
  }

  /* Staff congedato per contratto scaduto */
  const congedati = motore.stato.staffCongedati || [];
  if (congedati.length > 0) {
    const nomiRuoliCong = {
      capoIngegnere: 'Capo Ingegnere', direttoreAero: 'Dir. Design Aerodinamico',
      direttoreMeccanica: 'Dir. Design Meccanico', direttoreElettronica: 'Dir. Design Elettronica',
      direttoreGara: 'Direttore di Gara', dataAnalyst: 'Data Analyst Senior',
      socialMediaManager: 'Social Media Manager', preparatoreAtletico: 'Preparatore Atletico',
      direttoreLogistica: 'Direttore Logistica', responsabileRelazioni: 'Responsabile Relazioni',
      responsabileHospitality: 'Responsabile Hospitality',
      responsabileDatiTelemetria: 'Resp. Dati e Telemetria',
      coordinatoreOperativo: 'Coordinatore Operativo',
      responsabileComunicazione: 'Resp. Comunicazione Tecnica'
    };
    const cardCong = crea('div', { class: 'card margine-sopra', role: 'alert' });
    cardCong.appendChild(crea('h3', {}, 'Staff uscente — contratti non rinnovati'));
    const listaCong = crea('ul', { 'aria-label': 'Membri dello staff con contratto non rinnovato' });
    congedati.forEach(c => {
      listaCong.appendChild(crea('li', {},
        (c.nome || c.chiave) + (nomiRuoliCong[c.chiave] ? ' — ' + nomiRuoliCong[c.chiave] : '') +
        '. Il ruolo è ora vacante. Ingaggia un sostituto nel capitolo Staff.'
      ));
    });
    cardCong.appendChild(listaCong);
    contenuto.appendChild(cardCong);
  }
}

/* ----- Capitolo 2: Concept macchina ----- */
function _renderCapitoloConcept(contenuto) {
  const stato   = motore.stato;
  const cambio  = motore._rilevaChangEra?.() || false;
  const opzioni = motore.ottieniOpzioniConcept?.() || [];
  const sceltaAtt = stato.conceptMacchina?.stagione === stato.stagione ? stato.conceptMacchina?.tipo : null;
  const racc    = cambio ? (motore.ottieniRaccomandazioneConcept?.() || null) : null;

  const intro = crea('div', { class: 'card' });
  intro.appendChild(crea('h3', {}, cambio ? 'Concept vettura — Nuova era regolamentare' : 'Concept vettura — Stagione ' + stato.stagione));
  intro.appendChild(crea('p', {}, cambio
    ? 'Cambio d\'era: la vettura parte da zero. La scelta del concept determina l\'orientamento tecnico per l\'intera era. La variabilità dei risultati è più alta del normale nelle prime stagioni.'
    : 'La vettura della stagione scorsa è la base di partenza. La scelta del concept orienta lo sviluppo invernale e le priorità di allocazione CFD per la stagione entrante.'));
  contenuto.appendChild(intro);

  /* Briefing del Capo Ingegnere — solo al cambio era, solo se CE presente */
  if (cambio && racc) {
    const cardCE = crea('div', {
      class: 'card margine-sopra',
      'aria-label': 'Briefing del Capo Ingegnere ' + racc.nomeCE
    });
    const hCE = crea('h3', {}, 'Briefing del Capo Ingegnere');
    cardCE.appendChild(hCE);
    cardCE.appendChild(crea('p', { class: 'card-etichetta' }, racc.nomeCE + ' — ' + racc.profiloLabel));
    cardCE.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' }, racc.motivazione));
    const notaBonus = crea('p', { class: 'nota-tecnica margine-sopra' });
    notaBonus.textContent = 'Seguire questa raccomandazione riduce l\'incertezza di esecuzione del concept scelto.';
    cardCE.appendChild(notaBonus);
    contenuto.appendChild(cardCE);
  } else if (cambio && !racc) {
    const cardNoCE = crea('div', { class: 'card margine-sopra', role: 'note' });
    cardNoCE.appendChild(crea('p', { class: 'nota-tecnica' }, 'Nessun Capo Ingegnere in organico. Nessuna raccomandazione disponibile per il cambio era.'));
    contenuto.appendChild(cardNoCE);
  }

  const _etichettaRischio = (r) => ({ minimo: 'Rischio minimo', basso: 'Rischio basso', medio: 'Rischio medio', alto: 'Rischio alto', massimo: 'Rischio massimo' }[r] || r);
  const _etichettaIncertezza = (i) => ({ bassa: 'Incertezza bassa', media: 'Incertezza media', alta: 'Incertezza alta', massima: 'Incertezza massima' }[i] || i);

  opzioni.forEach(op => {
    const selezionata    = op.id === sceltaAtt;
    const raccomandata   = racc && op.id === racc.conceptId;
    const card = crea('div', {
      class: 'card margine-sopra scheda-concept' + (selezionata ? ' giocatore-highlight' : ''),
      'aria-label': op.nome + (selezionata ? ', selezionato' : '') + (raccomandata ? ', raccomandato dal Capo Ingegnere' : '')
    });

    const intestazione = crea('div', { class: 'intestazione-pilota' });
    intestazione.appendChild(crea('span', { class: 'nome-pilota' }, op.nome));
    intestazione.appendChild(crea('span', { class: 'nazionalita-pilota' }, _etichettaRischio(op.rischio)));
    card.appendChild(intestazione);
    if (raccomandata) {
      card.appendChild(crea('p', {
        class: 'badge-stato badge-verde margine-sopra',
        'aria-label': 'Raccomandato dal Capo Ingegnere'
      }, 'Raccomandato dal Capo Ingegnere'));
    }
    card.appendChild(crea('p', { class: 'nota-tecnica' }, op.desc));
    card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, _etichettaIncertezza(op.incertezza)));

    /* Effetti tecnici */
    const dlEff = crea('dl', { 'aria-label': 'Effetti tecnici del concept', class: 'margine-sopra' });
    ['aerodinamica', 'meccanica', 'elettronica', 'powerUnit'].forEach(area => {
      const val = op.effetti[area] || 0;
      if (val === 0) return;
      const label = { aerodinamica: 'Aerodinamica', meccanica: 'Meccanica', elettronica: 'Elettronica', powerUnit: 'Power Unit' }[area];
      dlEff.appendChild(crea('dt', {}, label));
      dlEff.appendChild(crea('dd', {
        class: val > 0 ? 'testo-positivo' : 'testo-avviso',
        'aria-label': label + ': ' + (val > 0 ? '+' : '') + val
      }, (val > 0 ? '+' : '') + val));
    });
    card.appendChild(dlEff);

    const btnScegli = crea('button', {
      class: 'btn-azione margine-sopra' + (selezionata ? ' btn-selezionato' : ' btn-secondario'),
      'aria-label': (selezionata ? 'Concept selezionato: ' : 'Seleziona concept: ') + op.nome,
      'aria-pressed': selezionata ? 'true' : 'false'
    }, selezionata ? 'Selezionato' : 'Seleziona');

    btnScegli.addEventListener('click', () => {
      audio.conferma();
      const ris = motore.applicaConceptMacchina(op.id);
      if (ris?.ok) {
        annunciaVoiceOver('Concept selezionato: ' + op.nome + '.');
        _apriCapitoloPausa('concept');
      }
    });
    card.appendChild(btnScegli);
    contenuto.appendChild(card);
  });
}

/* ----- Capitolo 3: Sviluppo e CFD ----- */
function _renderCapitoloSviluppo(contenuto) {
  const dev = motore.ottieniStatoSviluppoInvernale?.();
  if (!dev) return;

  /* Stato attuale macchina */
  const cardMac = crea('div', { class: 'card' });
  cardMac.appendChild(crea('h3', {}, 'Macchina — Valori correnti' + (dev.cambioEra ? ' (post-reset era)' : '')));
  if (dev.cambioEra) {
    cardMac.appendChild(crea('p', { class: 'nota-tecnica' }, 'Cambio d\'era: i valori sono stati reimpostati al livello di partenza. Il concept scelto ha gia applicato le prime correzioni.'));
  }
  const dlMac = crea('dl', { 'aria-label': 'Valori macchina correnti' });
  [
    ['Aerodinamica', Math.round(dev.macchina.aerodinamica || 0) + ' / 100'],
    ['Meccanica',    Math.round(dev.macchina.meccanica || 0) + ' / 100'],
    ['Elettronica',  Math.round(dev.macchina.elettronica || 0) + ' / 100'],
    ['Power Unit',   Math.round(dev.macchina.powerUnit || 0) + ' / 100']
  ].forEach(([k, v]) => { dlMac.appendChild(crea('dt', {}, k)); dlMac.appendChild(crea('dd', { class: 'valore-stat' }, v)); });
  cardMac.appendChild(dlMac);
  if (dev.conceptAttuale) {
    cardMac.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Concept applicato: ' + dev.conceptAttuale.nome));
  }
  contenuto.appendChild(cardMac);

  /* Allocazione CFD */
  const cardCFD = crea('div', { class: 'card margine-sopra' });
  cardCFD.appendChild(crea('h3', {}, 'Allocazione CFD e galleria del vento'));
  cardCFD.appendChild(crea('p', {}, 'Ore totali disponibili: ' + dev.oreTotali + ' ore / settimana.'));
  const dlCFD = crea('dl', { 'aria-label': 'Allocazione ore CFD' });
  [
    ['Macchina stagione corrente', dev.oreCorrente + ' ore  (' + Math.round(dev.allocazioneCFD.stagioneCorrente * 100) + '%)'],
    ['Progetto prossima stagione', dev.oreProssima + ' ore  (' + Math.round(dev.allocazioneCFD.prossimaStagione * 100) + '%)']
  ].forEach(([k, v]) => { dlCFD.appendChild(crea('dt', {}, k)); dlCFD.appendChild(crea('dd', {}, v)); });
  cardCFD.appendChild(dlCFD);

  const grpBtn = crea('div', { class: 'gruppo-decisione-qualifica margine-sopra' });
  [['− 10% corrente', -0.1], ['+ 10% corrente', +0.1]].forEach(([label, delta]) => {
    const btn = crea('button', {
      class: 'btn-decisione',
      'aria-label': label
    }, label);
    btn.addEventListener('click', () => {
      const split = motore.stato.allocazioneCFD || { stagioneCorrente: 0.7, prossimaStagione: 0.3 };
      const nuovo = Math.round(Math.max(0.1, Math.min(0.9, split.stagioneCorrente + delta)) * 100) / 100;
      motore.stato.allocazioneCFD = { stagioneCorrente: nuovo, prossimaStagione: Math.round((1 - nuovo) * 100) / 100 };
      motore.segnaCapitoloInvernale('sviluppo');
      motore.salva();
      audio.navigazione();
      _apriCapitoloPausa('sviluppo');
    });
    grpBtn.appendChild(btn);
  });
  cardCFD.appendChild(grpBtn);
  contenuto.appendChild(cardCFD);

  /* Token motore */
  if (dev.tokenDisponibili > 0) {
    const cardToken = crea('div', { class: 'card margine-sopra' });
    cardToken.appendChild(crea('h3', {}, 'Token sviluppo motore'));
    cardToken.appendChild(crea('p', {}, 'Token disponibili: ' + dev.tokenDisponibili + '. I token vengono allocati automaticamente dal Direttore Design Elettronica durante la stagione.'));
    contenuto.appendChild(cardToken);
  }

  /* Investimenti factory in corso */
  if (dev.investimentiInCorso.length > 0) {
    const cardFact = crea('div', { class: 'card margine-sopra' });
    cardFact.appendChild(crea('h3', {}, 'Lavori infrastrutturali in corso'));
    cardFact.appendChild(crea('p', { class: 'nota-tecnica' }, 'Durante la pausa invernale gli impianti sono maggiormente utilizzati. I lavori procedono al 50% della velocita normale.'));
    dev.investimentiInCorso.forEach(inv => {
      cardFact.appendChild(crea('p', {}, inv.area + ' — completamento stimato al round ' + inv.roundCompletamento));
    });
    contenuto.appendChild(cardFact);
  }

  /* ── PROGRAMMA MOTORE INTERNO ────────────────────────── */
  const pp = motore.ottieniStatoProgettoPU?.();
  if (pp && !pp.giaCosruttore) {
    const cardPU = crea('div', { class: 'card margine-sopra', role: 'region', 'aria-label': 'Programma motore interno' });
    cardPU.appendChild(crea('h3', {}, 'Programma motore interno'));

    if (!pp.progetto) {
      /* Nessun programma attivo: proposta di avvio */
      cardPU.appendChild(crea('p', {}, 'La squadra acquista la power unit da un fornitore esterno. È possibile avviare un programma pluriennale di sviluppo motore interno.'));
      const dlCosti = crea('dl', { 'aria-label': 'Costi programma motore', class: 'margine-sopra' });
      pp.fasi.forEach(f => {
        dlCosti.appendChild(crea('dt', {}, f.nome));
        dlCosti.appendChild(crea('dd', {}, formatMoneta(f.costo)));
      });
      dlCosti.appendChild(crea('dt', {}, 'Totale'));
      dlCosti.appendChild(crea('dd', { class: 'valore-stat' }, formatMoneta(pp.costoTotale) + ' su 4 stagioni'));
      cardPU.appendChild(dlCosti);
      cardPU.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
        'Al completamento: la squadra diventa costruttrice. La power unit parte con una penalità di prestazione iniziale, ma guadagna un token di sviluppo aggiuntivo per stagione.'));

      if (pp.puoAvviare) {
        const btnAvvia = crea('button', {
          class: 'btn-azione margine-sopra',
          'aria-label': 'Avvia programma motore interno — costo prima fase ' + formatMoneta(pp.costoAvvio)
        }, 'Avvia programma — ' + formatMoneta(pp.costoAvvio));
        btnAvvia.addEventListener('click', () => {
          const ris = motore.avviaProgettoPU();
          if (ris?.ok) {
            audio.conferma();
            annunciaVoiceOver('Programma motore avviato. Fase: ' + ris.fase + '. Investimento: ' + formatMoneta(ris.costo) + '.');
            motore.segnaCapitoloInvernale('sviluppo');
            _apriCapitoloPausa('sviluppo');
          } else {
            audio.errore();
            annunciaVoiceOver(ris?.messaggio || 'Impossibile avviare il programma.');
          }
        });
        cardPU.appendChild(btnAvvia);
      } else {
        cardPU.appendChild(crea('p', { class: 'testo-avviso margine-sopra' },
          'Budget insufficiente per avviare il programma. Prima fase: ' + formatMoneta(pp.costoAvvio) + '.'));
      }

    } else {
      /* Programma in corso */
      const prog     = pp.progetto;
      const faseLabel = pp.faseCorrente?.nome || '—';
      cardPU.appendChild(crea('p', { class: 'card-etichetta' }, 'Fase corrente: ' + faseLabel));
      cardPU.appendChild(crea('p', { class: 'nota-tecnica' }, pp.faseCorrente?.desc || ''));

      const dlProg = crea('dl', { 'aria-label': 'Stato programma motore', class: 'margine-sopra' });
      [
        ['Avviato nella stagione',       prog.stagionInizio],
        ['Investimento effettuato',      formatMoneta(prog.investimentoTotale)],
        ['Completamento previsto',       'Stagione ' + prog.stagionePrevistaCompletamento]
      ].forEach(([k, v]) => {
        dlProg.appendChild(crea('dt', {}, k));
        dlProg.appendChild(crea('dd', {}, String(v)));
      });
      cardPU.appendChild(dlProg);

      /* Pulsante continua / completa */
      const grpBtn = crea('div', { class: 'gruppo-decisione-qualifica margine-sopra' });

      const labelContinua = pp.prossimaFase
        ? ('Continua programma — ' + pp.prossimaFase.nome + ' (' + formatMoneta(pp.prossimaFase.costo) + ')')
        : 'Completa prototipazione — diventa costruttore';

      const btnContinua = crea('button', {
        class: pp.puoContinuare ? 'btn-decisione' : 'btn-decisione btn-disabilitato',
        'aria-label': labelContinua,
        disabled: !pp.puoContinuare || null
      }, labelContinua);

      btnContinua.addEventListener('click', () => {
        if (!pp.puoContinuare) return;
        const ris = motore.continuaProgettoPU();
        if (ris?.ok) {
          audio.conferma();
          if (ris.completato) {
            annunciaVoiceOver('Programma motore completato. La squadra è ora costruttrice di motori propri.');
          } else {
            annunciaVoiceOver('Programma avanzato. Fase: ' + ris.fase + '.');
          }
          motore.segnaCapitoloInvernale('sviluppo');
          _apriCapitoloPausa('sviluppo');
        } else {
          audio.errore();
          annunciaVoiceOver(ris?.messaggio || 'Impossibile procedere.');
        }
      });
      grpBtn.appendChild(btnContinua);

      const btnAbbandona = crea('button', {
        class: 'btn-decisione',
        'aria-label': 'Abbandona il programma motore — investimento perduto: ' + formatMoneta(prog.investimentoTotale)
      }, 'Abbandona programma');
      btnAbbandona.addEventListener('click', () => {
        const perduto = formatMoneta(prog.investimentoTotale);
        mostraDialogoConferma(
          'Abbandono programma motore',
          'L\'investimento di ' + perduto + ' non sarà recuperato. Il programma sarà annullato definitivamente.',
          () => {
            const ris = motore.abbandonaProgettoPU();
            if (ris?.ok) {
              audio.errore();
              annunciaVoiceOver('Programma motore abbandonato. Investimento perduto: ' + formatMoneta(ris.investimentoPerduto) + '.');
              _apriCapitoloPausa('sviluppo');
            }
          }
        );
      });
      grpBtn.appendChild(btnAbbandona);
      cardPU.appendChild(grpBtn);

      if (!pp.puoContinuare) {
        cardPU.appendChild(crea('p', { class: 'testo-avviso margine-sopra' },
          'Budget insufficiente per la prossima fase.'));
      }
    }
    contenuto.appendChild(cardPU);
  }
}

/* ----- Capitolo 4: Budget ----- */
function _renderCapitoloBudget(contenuto) {
  const bud = motore.ottieniStatoBudgetInvernale?.();
  if (!bud) return;

  const cardRie = crea('div', { class: 'card' });
  cardRie.appendChild(crea('h3', {}, 'Budget stagione ' + motore.stato.stagione));
  cardRie.appendChild(crea('p', { class: 'card-valore', 'aria-label': 'Budget totale disponibile: ' + formatMoneta(bud.budgetDisponibile) },
    formatMoneta(bud.budgetDisponibile)));
  contenuto.appendChild(cardRie);

  /* Selezione approccio */
  const cardApp = crea('div', { class: 'card margine-sopra' });
  cardApp.appendChild(crea('h3', {}, 'Approccio di allocazione'));

  Object.entries(bud.piani).forEach(([chiave, piano]) => {
    const attivo = chiave === bud.approccioCorrente;
    const card = crea('div', {
      class: 'card margine-sopra' + (attivo ? ' giocatore-highlight' : ''),
      'aria-label': chiave + (attivo ? ', selezionato' : '')
    });
    card.appendChild(crea('p', { class: 'nome-pilota' }, chiave.charAt(0).toUpperCase() + chiave.slice(1)));
    card.appendChild(crea('p', { class: 'nota-tecnica' }, piano.desc));

    const dlVoci = crea('dl', { 'aria-label': 'Voci di spesa per approccio ' + chiave });
    const voci = bud.voci; // recalculate for each piano
    const pVoci = {
      sviluppo:  Math.round(bud.budgetDisponibile * piano.sviluppo),
      staff:     Math.round(bud.budgetDisponibile * piano.staff),
      operativo: Math.round(bud.budgetDisponibile * piano.operativo),
      riserva:   Math.round(bud.budgetDisponibile * piano.riserva)
    };
    [
      ['Sviluppo tecnico',    pVoci.sviluppo,  Math.round(piano.sviluppo * 100)],
      ['Staff e piloti',      pVoci.staff,     Math.round(piano.staff * 100)],
      ['Operativo e trasferte', pVoci.operativo, Math.round(piano.operativo * 100)],
      ['Riserva',             pVoci.riserva,   Math.round(piano.riserva * 100)]
    ].forEach(([label, val, pct]) => {
      dlVoci.appendChild(crea('dt', {}, label));
      dlVoci.appendChild(crea('dd', {}, formatMoneta(val) + '  (' + pct + '%)'));
    });
    card.appendChild(dlVoci);

    if (!attivo) {
      const btnSel = crea('button', {
        class: 'btn-azione btn-secondario margine-sopra',
        'aria-label': 'Seleziona approccio ' + chiave
      }, 'Seleziona');
      btnSel.addEventListener('click', () => {
        audio.conferma();
        motore.impostaBudgetInvernale(chiave);
        annunciaVoiceOver('Approccio ' + chiave + ' selezionato.');
        _apriCapitoloPausa('budget');
      });
      card.appendChild(btnSel);
    } else {
      card.appendChild(crea('p', { class: 'card-etichetta margine-sopra' }, 'Approccio corrente'));
    }
    cardApp.appendChild(card);
  });
  contenuto.appendChild(cardApp);
}

/* ----- Capitolo 5: Mercato piloti ----- */
function _renderCapitoloPiloti(contenuto) {
  const mercato = motore.ottieniMercatoPilotiAR1?.();
  if (!mercato) return;

  /* Piloti attuali */
  const cardAtt = crea('div', { class: 'card' });
  cardAtt.appendChild(crea('h3', {}, 'Piloti in squadra'));
  if (mercato.pilotiAttuali.length === 0) {
    cardAtt.appendChild(crea('p', { class: 'testo-avviso' }, 'Nessun pilota contrattualizzato. Ingaggia almeno un pilota prima di avviare la stagione.'));
  }
  mercato.pilotiAttuali.forEach(p => {
    const inSc = mercato.inScadenza.find(s => s.id === p.id);
    const card = crea('div', { class: 'scheda-pilota margine-sopra' + (inSc ? ' bordo-avviso' : ''), 'aria-label': p.nome });
    const intest = crea('div', { class: 'intestazione-pilota' });
    intest.appendChild(crea('span', { class: 'nome-pilota' }, p.nome));
    intest.appendChild(crea('span', { class: 'eta-pilota' }, p.eta + ' anni'));
    card.appendChild(intest);
    const dl = crea('dl', { 'aria-label': 'Dettagli contratto ' + p.nome });
    [
      ['Scadenza contratto', p.contratto?.scadenza ? 'Stagione ' + p.contratto.scadenza : 'Nessun contratto'],
      ['Stipendio annuo',    p.contratto?.stipendio ? formatMoneta(p.contratto.stipendio) : '—'],
      ['Umore',              (p.umore || 0) + ' / 100']
    ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, v)); });
    if (inSc) dl.appendChild(crea('dd', { class: 'testo-avviso', role: 'note' }, '⚠ Contratto in scadenza'));
    card.appendChild(dl);

    if (inSc) {
      /* Rinnovo con pacchetti strutturati */
      const pksRinnovo = motore.ottieniPacchettiRinnovoAR1?.(p.id) || [];
      if (pksRinnovo.length > 0) {
        const titoloPk = crea('p', { class: 'card-etichetta margine-sopra' }, 'Scegli un pacchetto di rinnovo:');
        card.appendChild(titoloPk);
        pksRinnovo.forEach(pk => {
          const durLabel   = pk.durata === 1 ? '1 stagione' : pk.durata + ' stagioni';
          const umoreLabel = pk.effettoUmore >= 0 ? '+' + pk.effettoUmore + ' umore' : pk.effettoUmore + ' umore';
          const clausLabel = pk.clausola === 'top5'  ? ' · Bonus umore se top 5'
                           : pk.clausola === 'media' ? ' · Bonus visibilita sponsor'
                           : '';
          const btn = crea('button', {
            class: 'btn-decisione margine-sopra',
            'aria-label': 'Pacchetto ' + pk.label + ': ' + durLabel + ', ' + formatMoneta(pk.stipendio) + ' anno. ' + pk.desc
          }, pk.label + ' — ' + durLabel + ' — ' + formatMoneta(pk.stipendio));
          const descEl = crea('p', { class: 'nota-tecnica' }, pk.desc + ' (' + umoreLabel + clausLabel + ')');
          btn.addEventListener('click', () => {
            mostraDialogo(
              'Rinnova ' + p.nome + ' — ' + pk.label,
              pk.desc + '\n\nStipendio: ' + formatMoneta(pk.stipendio) + ' / anno. Durata: ' + durLabel + '.',
              () => {
                const ris = motore.rinnovaContrattoPilotaAR1Pacchetto(p.id, pk.id);
                annunciaVoiceOver(ris.messaggio);
                if (ris.ok) { audio.conferma(); _apriCapitoloPausa('piloti'); }
                else annunciaVoiceOver('Errore: ' + ris.messaggio);
              }
            );
          });
          card.appendChild(btn);
          card.appendChild(descEl);
        });
      }
    }

    const btnRilascia = crea('button', {
      class: 'btn-secondario margine-sopra',
      'aria-label': 'Rilascia pilota ' + p.nome
    }, 'Rilascia');
    btnRilascia.addEventListener('click', () => {
      mostraDialogo('Rilascia ' + p.nome, 'Sei sicuro di voler rilasciare ' + p.nome + '? L\'operazione non e reversibile.', () => {
        const ris = motore.rilasciaPilotaAR1(p.id);
        annunciaVoiceOver(ris.messaggio);
        if (ris.ok) { audio.conferma(); _apriCapitoloPausa('piloti'); }
      });
    });
    card.appendChild(btnRilascia);
    cardAtt.appendChild(card);
  });
  contenuto.appendChild(cardAtt);

  /* Piloti liberi sul mercato */
  if (mercato.liberi.length > 0) {
    const cardLib = crea('div', { class: 'card margine-sopra' });
    cardLib.appendChild(crea('h3', {}, 'Piloti disponibili sul mercato'));
    mercato.liberi.forEach(p => {
      const card = crea('div', { class: 'scheda-pilota margine-sopra', 'aria-label': p.nome });
      const intest = crea('div', { class: 'intestazione-pilota' });
      intest.appendChild(crea('span', { class: 'nome-pilota' }, p.nome));
      intest.appendChild(crea('span', { class: 'eta-pilota' }, p.eta + ' anni'));
      card.appendChild(intest);
      const dl = crea('dl', { 'aria-label': 'Statistiche ' + p.nome });
      const st = p.statistiche || {};
      [
        ['Talento',     (st.talento || 0)],
        ['Qualifica',   (st.qualifica || 0)],
        ['Gara',        (st.gara || 0)],
        ['Richiesta',   formatMoneta(p.richiestaBase || 0) + ' / anno']
      ].forEach(([k, v]) => { dl.appendChild(crea('dt', {}, k)); dl.appendChild(crea('dd', {}, String(v))); });
      card.appendChild(dl);

      /* Pacchetti di ingaggio */
      const packs = motore.ottieniPacchettiPilota?.(p.id) || [];
      if (packs.length > 0 && (motore.stato.piloti || []).length < 2) {
        const grpPack = crea('div', { class: 'gruppo-decisione-qualifica margine-sopra', style: 'flex-wrap:wrap;' });
        packs.forEach(pk => {
          const btn = crea('button', {
            class: 'btn-decisione',
            style: 'margin: 4px;',
            'aria-label': pk.label + ' — ' + pk.desc
          }, pk.label.split(' — ')[0]);
          btn.addEventListener('click', () => {
            mostraDialogo('Ingaggia ' + p.nome, pk.label + '. ' + pk.desc + ' Stipendio: ' + formatMoneta(pk.stipendio) + '.', () => {
              const ris = motore.ingaggiaPilotaAR1(p.id, pk.id);
              annunciaVoiceOver(ris.messaggio);
              if (ris.ok) { audio.conferma(); _apriCapitoloPausa('piloti'); }
              else annunciaVoiceOver('Errore: ' + ris.messaggio);
            });
          });
          grpPack.appendChild(btn);
        });
        card.appendChild(grpPack);
      }
      cardLib.appendChild(card);
    });
    contenuto.appendChild(cardLib);
  }

  /* Riserva e Academy */
  if (mercato.riserva) {
    const cardRis = crea('div', { class: 'card margine-sopra' });
    cardRis.appendChild(crea('h3', {}, 'Pilota di riserva'));
    cardRis.appendChild(crea('p', {}, mercato.riserva.nome + ' — ' + (mercato.riserva.nazionalita || '') + ', ' + mercato.riserva.eta + ' anni'));
    cardRis.appendChild(crea('p', { class: 'nota-tecnica' }, 'Il pilota di riserva rimane disponibile per sostituzioni in stagione.'));
    contenuto.appendChild(cardRis);
  }

  if (mercato.academy.length > 0) {
    const cardAca = crea('div', { class: 'card margine-sopra' });
    cardAca.appendChild(crea('h3', {}, 'Academy'));
    mercato.academy.forEach(t => {
      cardAca.appendChild(crea('p', {}, t.nome + ' — ' + t.categoriaAttuale + ' · Potenziale: ' + t.potenziale + ' · Anno sviluppo: ' + t.stagioneSviluppo));
    });
    contenuto.appendChild(cardAca);
  }
}

/* ----- Capitolo 6: Mercato staff ----- */
function _renderCapitoloStaff(contenuto) {
  const mercato = motore.ottieniMercatoStaffAR1?.();
  if (!mercato) return;

  const nomiRuoli = {
    capoIngegnere:              'Capo Ingegnere',
    direttoreAero:              'Dir. Design Aerodinamico',
    direttoreMeccanica:         'Dir. Design Meccanico',
    direttoreElettronica:       'Dir. Design Elettronica',
    direttoreGara:              'Direttore di Gara',
    dataAnalyst:                'Data Analyst Senior',
    socialMediaManager:         'Social Media Manager',
    preparatoreAtletico:        'Preparatore Atletico',
    direttoreLogistica:         'Direttore Logistica',
    responsabileRelazioni:      'Responsabile Relazioni',
    responsabileHospitality:    'Responsabile Hospitality',
    responsabileDatiTelemetria: 'Resp. Dati e Telemetria',
    coordinatoreOperativo:      'Coordinatore Operativo',
    responsabileComunicazione:  'Resp. Comunicazione Tecnica'
  };

  /* Staff attuale */
  const cardAtt = crea('div', { class: 'card' });
  cardAtt.appendChild(crea('h3', {}, 'Staff attuale'));
  mercato.staff.forEach(({ chiave, membro, inScadenza, preScadenza, gardening }) => {
    const classeRiga = 'riga-contratto-scadenza' +
      (inScadenza ? ' bordo-avviso' : preScadenza ? ' bordo-attenzione' : '');
    const labelRiga = (nomiRuoli[chiave] || chiave) +
      (membro ? ': ' + membro.nome + (inScadenza ? ', contratto scaduto' : preScadenza ? ', contratto in scadenza' : '') : ': vacante');
    const riga = crea('div', { class: classeRiga, 'aria-label': labelRiga });

    riga.appendChild(crea('span', { class: 'nome-staff' }, nomiRuoli[chiave] || chiave));

    if (membro) {
      let testoContratto, classeContratto;
      if (inScadenza) {
        testoContratto = membro.nome + ' — contratto scaduto';
        classeContratto = 'testo-avviso';
      } else if (preScadenza) {
        testoContratto = membro.nome + ' · scade a fine stagione ' + (membro.contratto?.scadenza || '?');
        classeContratto = 'testo-attenzione';
      } else {
        testoContratto = membro.nome + ' · scad. ' + (membro.contratto?.scadenza || '?');
        classeContratto = 'card-etichetta';
      }
      riga.appendChild(crea('span', { class: classeContratto }, testoContratto));

      if (inScadenza || preScadenza) {
        /* Opzioni di rinnovo */
        const opzioni = motore.ottieniOpzioniRinnovoStaff?.(chiave) || [];
        const gruppoRinnovo = crea('div', { class: 'gruppo-azioni margine-sopra', role: 'group', 'aria-label': 'Opzioni rinnovo ' + membro.nome });
        opzioni.forEach(opt => {
          const btn = crea('button', {
            class: 'btn-secondario' + (opt.fattibile ? '' : ' disabilitato'),
            'aria-label': opt.label + ' per ' + membro.nome + ': ' + opt.descrizione + ' — costo totale ' + formatMoneta(opt.costoTotale),
            disabled: !opt.fattibile || undefined
          }, opt.label);
          if (!opt.fattibile) btn.setAttribute('disabled', '');
          btn.addEventListener('click', () => {
            mostraDialogo(
              opt.label + ' — ' + membro.nome,
              opt.descrizione + '\nCosto totale: ' + formatMoneta(opt.costoTotale) + '. Scadenza: stagione ' + opt.scadenza + '.',
              () => {
                const ris = motore.rinnovaContrattoStaff(chiave, opt.id);
                annunciaVoiceOver(ris.messaggio);
                if (ris.ok) { audio.conferma(); _apriCapitoloPausa('staff'); }
                else annunciaVoiceOver('Errore: ' + ris.messaggio);
              }
            );
          });
          gruppoRinnovo.appendChild(btn);
        });
        riga.appendChild(gruppoRinnovo);
      }

      if (inScadenza) {
        /* Pulsante Rilascia (solo se già scaduto) */
        const btnRilascia = crea('button', {
          class: 'btn-azione btn-secondario',
          'aria-label': 'Rilascia ' + membro.nome + ' senza rinnovo'
        }, 'Rilascia');
        btnRilascia.addEventListener('click', () => {
          mostraDialogo('Rilascia ' + membro.nome, 'Confermi la rescissione del contratto di ' + membro.nome + '? Il ruolo resterà vacante.', () => {
            const ris = motore.rilasciaStaffAR1(chiave);
            annunciaVoiceOver(ris.messaggio);
            if (ris.ok) { audio.conferma(); _apriCapitoloPausa('staff'); }
          });
        });
        riga.appendChild(btnRilascia);
      }
    } else {
      riga.appendChild(crea('span', { class: 'testo-avviso' }, 'Vacante'));
    }
    cardAtt.appendChild(riga);
  });
  contenuto.appendChild(cardAtt);

  /* Candidati disponibili */
  if (mercato.liberi.length > 0) {
    const cardLib = crea('div', { class: 'card margine-sopra' });
    cardLib.appendChild(crea('h3', {}, 'Candidati disponibili'));
    mercato.liberi.forEach(cand => {
      const ruoloNome = nomiRuoli[cand.chiaveRuolo] || cand.chiaveRuolo;
      const card = crea('div', { class: 'scheda-pilota margine-sopra', 'aria-label': cand.nome + ', ' + ruoloNome });
      const intest = crea('div', { class: 'intestazione-pilota' });
      intest.appendChild(crea('span', { class: 'nome-pilota' }, cand.nome));
      intest.appendChild(crea('span', { class: 'nazionalita-pilota' }, ruoloNome));
      card.appendChild(intest);
      const dl = crea('dl', { 'aria-label': 'Statistiche ' + cand.nome });
      const stat = cand.statistiche || {};
      Object.entries(stat).forEach(([k, v]) => {
        dl.appendChild(crea('dt', {}, k));
        dl.appendChild(crea('dd', {}, String(v)));
      });
      dl.appendChild(crea('dt', {}, 'Richiesta'));
      dl.appendChild(crea('dd', {}, formatMoneta(cand.richiestaBase) + ' / anno'));
      card.appendChild(dl);

      /* Mostra il ruolo vacante corrispondente */
      const ruoloVacante = mercato.staff.find(s => s.chiave === cand.chiaveRuolo && (!s.membro || s.inScadenza));
      if (ruoloVacante) {
        const btnIngaggia = crea('button', {
          class: 'btn-azione margine-sopra',
          'aria-label': 'Ingaggia ' + cand.nome + ' come ' + ruoloNome
        }, 'Ingaggia');
        btnIngaggia.addEventListener('click', () => {
          mostraDialogo('Ingaggia ' + cand.nome, ruoloNome + ' — ' + formatMoneta(cand.richiestaBase) + ' / anno. Contratto di 2 stagioni.', () => {
            const ris = motore.ingaggiaStaffAR1(cand.chiaveRuolo, cand.id);
            annunciaVoiceOver(ris.messaggio);
            if (ris.ok) { audio.conferma(); _apriCapitoloPausa('staff'); }
            else annunciaVoiceOver('Errore: ' + ris.messaggio);
          });
        });
        card.appendChild(btnIngaggia);
      }
      cardLib.appendChild(card);
    });
    contenuto.appendChild(cardLib);
  }
}

/* ============================================================
   TEST PRE-STAGIONALI AR1 — Capitolo pausa invernale
   ============================================================ */

/* Stato view test (locale, non persistito) */
let _viewTest    = 'selezione';   /* 'selezione' | 'risultato' */
let _risultatoTest = null;

function _renderCapitoloTest(contenuto) {
  const stato = motore.ottieniStatoTestPrestagionali?.();
  if (!stato) return;

  const km  = stato.conoscenzaMacchina || {};
  const nomi = { aerodinamica: 'Aerodinamica', meccanica: 'Meccanica', powerUnit: 'Power unit', baseline: 'Setup / correlazione' };

  /* ----- Card stato conoscenza macchina ----- */
  const cardKM = crea('div', { class: 'card' });
  cardKM.appendChild(crea('h3', {}, 'Conoscenza vettura'));
  const dlKM = crea('dl', { 'aria-label': 'Livello conoscenza per area' });
  Object.entries(nomi).forEach(([k, etichetta]) => {
    const v = km[k] || 0;
    const livello = v >= 60 ? 'elevata' : v >= 35 ? 'parziale' : v > 0 ? 'iniziale' : 'nessuna';
    dlKM.appendChild(crea('dt', {}, etichetta));
    dlKM.appendChild(crea('dd', {}, v + ' / 100 — ' + livello));
  });
  cardKM.appendChild(dlKM);

  /* Nota dati pista preesistenti */
  const nPiste = Object.keys(motore.stato.datiPista || {}).length;
  if (nPiste > 0) {
    cardKM.appendChild(crea('p', { class: 'card-etichetta' },
      'Dati pista disponibili da stagioni precedenti: ' + nPiste + ' circuiti nell\'era corrente.'));
  }
  contenuto.appendChild(cardKM);

  /* ----- Se test completati: mostra report finale ----- */
  if (stato.completati) {
    _renderReportFinalTest(contenuto, stato);
    return;
  }

  /* ----- Titolo sessione corrente ----- */
  const nomiSessione = ['Mattina', 'Pomeriggio'];
  const cardSess = crea('div', { class: 'card' });
  cardSess.appendChild(crea('h3', {},
    'Giorno ' + stato.giorno + ' di 3 — Sessione ' + nomiSessione[stato.sessione]));

  /* Programmi già svolti */
  if (stato.programmiSvolti && stato.programmiSvolti.length > 0) {
    const dlSvolti = crea('dl', { 'aria-label': 'Programmi completati' });
    dlSvolti.appendChild(crea('dt', {}, 'Programmi svolti'));
    const elencoProg = stato.programmiSvolti.map(id => {
      const p = (PROGRAMMI_TEST_UI || []).find(x => x.id === id);
      return p ? p.nome : id;
    }).join(', ');
    dlSvolti.appendChild(crea('dd', {}, elencoProg || '—'));
    cardSess.appendChild(dlSvolti);
  }
  contenuto.appendChild(cardSess);

  /* ----- Vista risultato o vista selezione ----- */
  if (_viewTest === 'risultato' && _risultatoTest) {
    _renderRisultatoSessioneTest(contenuto, _risultatoTest);
    return;
  }

  /* ----- Selezione programma ----- */
  const info = stato.programmiDisponibili || { disponibili: [], consigliatoDaStaff: null };
  if (!info.disponibili || info.disponibili.length === 0) {
    contenuto.appendChild(crea('p', {}, 'Nessun programma disponibile per questa sessione.'));
    return;
  }

  const cardProgr = crea('div', { class: 'card' });
  cardProgr.appendChild(crea('h3', {}, 'Scegli il programma per questa sessione'));
  if (info.consigliatoDaStaff) {
    const p = info.disponibili.find(x => x.id === info.consigliatoDaStaff);
    if (p) {
      cardProgr.appendChild(crea('p', { class: 'card-etichetta' },
        'Staff consiglia: ' + p.nome + '.'));
    }
  }
  contenuto.appendChild(cardProgr);

  info.disponibili.forEach(prog => {
    const card = crea('div', { class: 'card' + (prog.id === info.consigliatoDaStaff ? ' giocatore-highlight' : '') });
    card.appendChild(crea('h3', {}, prog.nome));
    card.appendChild(crea('p', {}, prog.descrizione));

    /* Effetti previsti */
    const dlEff = crea('dl', { 'aria-label': 'Effetti attesi' });
    Object.entries(prog.effetti).forEach(([k, v]) => {
      dlEff.appendChild(crea('dt', {}, nomi[k] || k));
      dlEff.appendChild(crea('dd', {}, '+' + v + ' (qualità dipendente dallo staff)'));
    });
    card.appendChild(dlEff);

    /* Staff responsabile */
    if (prog.staffBonus) {
      const s = motore.stato.staff?.[prog.staffBonus];
      const nomeStaff = s?.nome || prog.staffBonus;
      const statVal   = s?.statistiche?.[prog.staffBonusStat];
      const statLabel = statVal != null ? _statoStat(statVal) : '—';
      card.appendChild(crea('p', { class: 'card-etichetta' },
        'Responsabile: ' + nomeStaff + ' (' + prog.staffBonusStat + ': ' + statLabel + ')'));
    }

    const btnEsegui = crea('button', {
      class: 'btn-azione',
      'aria-label': 'Esegui programma: ' + prog.nome
    }, 'Esegui');
    btnEsegui.addEventListener('click', () => {
      const ris = motore.eseguiSessioneTest?.(prog.id);
      if (!ris || !ris.ok) {
        annunciaVoiceOver('Errore nell\'esecuzione del programma.');
        return;
      }
      audio.inizioSessione();
      _risultatoTest = ris;
      _viewTest = 'risultato';
      _apriCapitoloPausa('test');
    });
    card.appendChild(btnEsegui);
    contenuto.appendChild(card);
  });
}

function _renderRisultatoSessioneTest(contenuto, ris) {
  const nomi = { aerodinamica: 'Aerodinamica', meccanica: 'Meccanica', powerUnit: 'Power unit', baseline: 'Setup / correlazione' };
  const nomiSessione = ['Mattina', 'Pomeriggio'];

  const card = crea('div', { class: 'card' });
  card.appendChild(crea('h3', {},
    'Risultato — Giorno ' + ris.giorno + ', ' + nomiSessione[ris.sessione]));
  card.appendChild(crea('p', {}, ris.programma.nome + '. Qualità dati: ' + ris.qualita + '%.'));

  if (ris.incidente) {
    card.appendChild(crea('p', { class: 'card-valore', style: 'color: var(--colore-operazioni)' },
      '⚠ ' + ris.incidente));
  }

  card.appendChild(crea('p', {}, 'Giri percorsi: ' + ris.giriPercorsi + '.'));

  /* Guadagni per area */
  const dlGuadagni = crea('dl', { 'aria-label': 'Conoscenza acquisita' });
  Object.entries(ris.effettiApplicati).forEach(([k, v]) => {
    dlGuadagni.appendChild(crea('dt', {}, nomi[k] || k));
    dlGuadagni.appendChild(crea('dd', {},
      '+' + v + ' → totale: ' + (ris.conoscenzaMacchina[k] || 0)));
  });
  card.appendChild(dlGuadagni);
  contenuto.appendChild(card);

  /* Report giornaliero (fine giornata) */
  if (ris.reportGiorno) {
    const cardDA = crea('div', { class: 'card' });
    cardDA.appendChild(crea('h3', {}, 'Report Data Analyst — Giorno ' + ris.giorno));
    cardDA.appendChild(crea('p', {}, ris.reportGiorno.messaggioDA));
    if (ris.reportGiorno.stima) {
      const s = ris.reportGiorno.stima;
      cardDA.appendChild(crea('p', {},
        'Stima prestativa: ' + s.valore + '% del benchmark (margine ±' + s.margine + '%).'));
    }
    if (ris.reportGiorno.areeScoperte && ris.reportGiorno.areeScoperte.length > 0) {
      cardDA.appendChild(crea('p', { class: 'card-etichetta' },
        'Aree ancora poco coperte: ' + ris.reportGiorno.areeScoperte.map(k => nomi[k] || k).join(', ') + '.'));
    }
    contenuto.appendChild(cardDA);
  }

  /* Pulsante continua o fine test */
  const btnContinua = crea('button', {
    class: 'btn-azione',
    'aria-label': ris.completati ? 'Visualizza report finale' : 'Continua ai test'
  }, ris.completati ? 'Vedi report finale' : 'Continua');
  btnContinua.addEventListener('click', () => {
    audio.conferma();
    _viewTest = 'selezione';
    _risultatoTest = null;
    _apriCapitoloPausa('test');
  });
  contenuto.appendChild(btnContinua);
}

function _renderReportFinalTest(contenuto, stato) {
  const nomi = { aerodinamica: 'Aerodinamica', meccanica: 'Meccanica', powerUnit: 'Power unit', baseline: 'Setup / correlazione' };
  const km = stato.conoscenzaMacchina || {};
  const conoscenzaMedia = Math.round(((km.aerodinamica || 0) + (km.meccanica || 0) + (km.powerUnit || 0) + (km.baseline || 0)) / 4);

  /* Report finale Data Analyst */
  const ultimoReport = (stato.reportGiornalieri || []).find(r => r.giorno === 3);
  const cardFin = crea('div', { class: 'card' });
  cardFin.appendChild(crea('h3', {}, 'Report finale — Test pre-stagionali completati'));

  if (ultimoReport?.messaggioDA) {
    cardFin.appendChild(crea('p', {}, ultimoReport.messaggioDA));
  }

  const dlFin = crea('dl', { 'aria-label': 'Conoscenza vettura acquisita' });
  Object.entries(nomi).forEach(([k, etichetta]) => {
    const v = km[k] || 0;
    dlFin.appendChild(crea('dt', {}, etichetta));
    dlFin.appendChild(crea('dd', {}, v + ' / 100'));
  });
  dlFin.appendChild(crea('dt', {}, 'Media complessiva'));
  dlFin.appendChild(crea('dd', {}, conoscenzaMedia + ' / 100'));
  cardFin.appendChild(dlFin);

  if (ultimoReport?.stima) {
    const s = ultimoReport.stima;
    cardFin.appendChild(crea('p', {},
      'Stima performance vettura: ' + s.valore + '% del benchmark, margine di errore ±' + s.margine + '%.'));
    cardFin.appendChild(crea('p', { class: 'card-etichetta' },
      'La precisione delle stime migliorera durante le prove libere nei singoli weekend di gara.'));
  }

  contenuto.appendChild(cardFin);

  /* Programmi svolti */
  if (stato.programmiSvolti && stato.programmiSvolti.length > 0) {
    const cardProg = crea('div', { class: 'card' });
    cardProg.appendChild(crea('h3', {}, 'Programmi eseguiti (' + stato.programmiSvolti.length + ' di 6 sessioni)'));
    const ul = crea('ul', { 'aria-label': 'Programmi test completati' });
    stato.programmiSvolti.forEach(id => {
      const p = PROGRAMMI_TEST_UI.find(x => x.id === id);
      ul.appendChild(crea('li', {}, p ? p.nome : id));
    });
    cardProg.appendChild(ul);
    contenuto.appendChild(cardProg);
  }

  /* Nota dati pista */
  const nPiste = Object.keys(motore.stato.datiPista || {}).length;
  if (nPiste > 0) {
    const cardPista = crea('div', { class: 'card' });
    cardPista.appendChild(crea('h3', {}, 'Dati pista stagioni precedenti'));
    cardPista.appendChild(crea('p', {},
      'Informazioni su ' + nPiste + ' circuiti accumulate nelle stagioni precedenti della stessa era. ' +
      'Le prove libere di quegli appuntamenti partiranno da una base di dati gia disponibile.'));
    contenuto.appendChild(cardPista);
  }
}

/* ----- Capitolo 8: Riunioni pre-stagionali ----- */
function _renderCapitoloRiunioni(contenuto) {
  const dati = motore.ottieniDirettiveStagione?.();
  if (!dati) {
    contenuto.appendChild(crea('p', { class: 'card-etichetta' }, 'Disponibile in AR1.'));
    return;
  }

  contenuto.appendChild(crea('h3', {}, 'Riunioni pre-stagionali'));
  contenuto.appendChild(crea('p', { class: 'nota-tecnica' },
    'Incontra le figure chiave dello staff prima dell\'inizio della stagione. ' +
    'Per ogni riunione scegli un orientamento strategico che rimarrà attivo per tutta la stagione. ' +
    'Le riunioni sono opzionali e modificabili fino all\'avvio della stagione.'));

  const nSelezionate = Object.keys(dati.selezioni).length;
  const nPresenti    = dati.figure.filter(f => f.presente).length;
  contenuto.appendChild(crea('p', { class: 'nota-tecnica margine-sopra',
    'aria-live': 'polite',
    'aria-label': `Direttive impostate: ${nSelezionate} su ${nPresenti} figure disponibili.`
  }, `Direttive impostate: ${nSelezionate} / ${nPresenti}`));

  dati.figure.forEach(figura => {
    const selezionata = dati.selezioni[figura.chiave] || null;

    const card = crea('section', { class: 'card margine-sopra',
      'aria-label': figura.nome
        ? `Riunione con ${figura.nome}${selezionata ? ' — direttiva impostata' : ''}`
        : `${figura.chiave} — figura non presente`
    });

    /* Intestazione */
    const intest = crea('div', { class: 'card-intestazione' });
    intest.appendChild(crea('span', { class: 'nome-staff' }, figura.nome || '(figura non presente)'));
    if (!figura.presente) {
      intest.appendChild(crea('span', { class: 'badge-dipartimento' }, 'Non disponibile'));
      card.appendChild(intest);
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
        'Questa figura non è in squadra. Nessuna direttiva applicabile.'));
      contenuto.appendChild(card);
      return;
    }
    if (selezionata) {
      const opzSel = figura.opzioni.find(o => o.id === selezionata);
      intest.appendChild(crea('span', {
        class: 'badge-livello-infrastrutture',
        style: 'background-color:var(--colore-tecnica); color:#000',
        'aria-label': 'Direttiva attiva: ' + (opzSel?.label || selezionata)
      }, opzSel?.label || selezionata));
    }
    card.appendChild(intest);

    /* Opzioni */
    const gruppoOpt = crea('div', { class: 'gruppo-azioni margine-sopra',
      role: 'group', 'aria-label': `Scegli direttiva per ${figura.nome}` });

    figura.opzioni.forEach(opzione => {
      const isSelezionata = selezionata === opzione.id;
      const btn = crea('button', {
        class: 'btn-azione' + (isSelezionata ? ' attivo' : ''),
        'aria-pressed': isSelezionata ? 'true' : 'false',
        'aria-label': `${opzione.label}: ${opzione.effetto}${isSelezionata ? ' — selezionata' : ''}`
      }, opzione.label);
      btn.addEventListener('click', () => {
        const ris = motore.impostaDirettiva(figura.chiave, opzione.id);
        if (ris.ok) {
          audio.conferma();
          annunciaVoiceOver(`Direttiva "${opzione.label}" impostata per ${figura.nome}.`);
          contenuto.replaceChildren();
          _renderCapitoloRiunioni(contenuto);
        } else {
          annunciaVoiceOver('Errore: ' + ris.messaggio);
        }
      });
      gruppoOpt.appendChild(btn);
    });
    card.appendChild(gruppoOpt);

    /* Descrizione opzione selezionata */
    if (selezionata) {
      const opzSel = figura.opzioni.find(o => o.id === selezionata);
      if (opzSel) {
        card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra', 'aria-live': 'polite' },
          opzSel.effetto));
      }
    } else {
      card.appendChild(crea('p', { class: 'nota-tecnica margine-sopra' },
        'Nessuna direttiva impostata — comportamento standard per la stagione.'));
    }

    contenuto.appendChild(card);
  });
}

/* ============================================================
   SERVICE WORKER
   ============================================================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* Service worker non registrato: il gioco funziona comunque */
    });
  });
}
