# CLAUDE.md — Briefing di Progetto: Gestionale AR1

## ISTRUZIONI PER CLAUDE CODE

Questo file è il briefing completo del progetto. Leggilo interamente prima di scrivere qualsiasi riga di codice. Ogni sezione contiene decisioni già prese dal committente. Non reinterpretare, non semplificare, non proporre alternative salvo esplicita richiesta. In caso di dubbio su un dettaglio non coperto da questo documento, scegli sempre la soluzione più coerente con lo spirito generale del progetto.

---

## 1. IDENTITÀ DEL PROGETTO

### Natura del gioco
Gestionale sportivo a lungo termine, senza fine predefinita, ambientato nel mondo del motorsport di alto livello. Il giocatore interpreta il ruolo di Amministratore Delegato e Team Principal di una scuderia. Non è il proprietario: gestisce, non possiede. Il nome, i colori e l'identità della squadra sono fissi e non modificabili dal giocatore.

### Piattaforma e tecnologia
- Applicazione web progressiva (PWA) sviluppata in HTML, CSS e JavaScript puro
- Compatibile con Safari su iPhone e aggiungibile alla schermata home come app
- Nessuna dipendenza da App Store, certificati Apple o strumenti macOS
- Sviluppabile interamente da Windows tramite WSL e Claude Code
- Tutti i dati di gioco persistono tramite localStorage con salvataggio automatico continuo

### Lingua
Italiano. La terminologia tecnica della AR1 rimane in inglese dove naturale e consolidata (pit stop, safety car, DRS, CFD, parc fermé, ecc.). La sintassi di tutti i testi è ottimizzata per l'ascolto tramite sintesi vocale: frasi brevi, struttura prevedibile, nessuna ambiguità, nessun elemento puramente visivo che veicoli informazioni essenziali.
Lingua dell'interfaccia di sistema: tutti i messaggi di errore, dialoghi, conferme e avvisi tecnici generati dall'applicazione sono in italiano, senza eccezioni.

---

## 2. ACCESSIBILITÀ — PRIORITÀ ASSOLUTA

### VoiceOver
La compatibilità con VoiceOver di Apple è la priorità assoluta del progetto, superiore a qualsiasi altra considerazione tecnica o estetica. Il giocatore è un utente esperto e quotidiano di VoiceOver.

Requisiti tecnici obbligatori:
- Ogni elemento interattivo deve avere un attributo `aria-label` descrittivo e completo
- La struttura HTML deve essere semanticamente corretta: uso appropriato di `<nav>`, `<main>`, `<section>`, `<button>`, `<h1>`–`<h3>`, `<ul>`, `<li>`
- L'ordine di lettura del DOM deve corrispondere all'ordine logico dell'interfaccia
- Nessuna informazione veicolata esclusivamente tramite colore o icona senza etichetta testuale associata
- Tutti i campi numerici modificabili usano pulsanti + e − discreti, mai slider o elementi di trascinamento
- I messaggi di stato, gli eventi e le notifiche in-app usano `aria-live` con politica `polite` per essere annunciati da VoiceOver senza interrompere la lettura corrente
- Le schermate di dialogo e i menu contestuali gestiscono correttamente il focus trap
- Nessun timeout automatico, nessuna animazione che interferisca con la lettura, nessun elemento che scompaia prima di poter essere letto

### Interfaccia visiva
- Sfondo: nero `#000000` in tutta l'applicazione
- Testo principale: bianco `#FFFFFF`
- Contrasto minimo: WCAG AAA (rapporto 7:1) per tutto il testo
- Palette cromatica ristretta a sei colori tematici (vedi sezione Interfaccia)
- Nessun gradiente morbido, nessun grigio ambiguo, nessuna sfumatura a basso contrasto
- Dimensione minima del testo: 16px per il corpo, 20px per le intestazioni di sezione

---

## 3. STRUTTURA DELL'INTERFACCIA

### Schermata iniziale
Due sole opzioni:
- Nuova partita — avvia il flusso di inizio gioco
- Continua partita — carica l'unico salvataggio automatico esistente

### Menu principale di gioco
Il menu si adatta alla categoria corrente del giocatore.

In AR3 e AR2: menu semplificato con sole voci pertinenti alla categoria (Operazioni, Persone, Economia ridotta, Panorama).

In AR1: menu completo con sei voci principali, sempre visibili al primo livello:

1. Operazioni — simbolo ⏱ — colore Arancione acceso #FF6600
2. Persone — simbolo 👤 — colore Azzurro brillante #00AAFF
3. Tecnica — simbolo ⚙️ — colore Verde elettrico #00FF66
4. Economia — simbolo 📊 — colore Giallo #FFD700
5. Relazioni — simbolo 🤝 — colore Rosso vivo #FF2222
6. Panorama — simbolo 🏆 — colore Bianco brillante #FFFFFF

Ogni sezione applica il proprio colore tematico a: intestazioni, bordi degli elementi attivi, etichette delle sottosezioni, indicatori di stato. Lo sfondo rimane sempre nero.

### Struttura gerarchica delle sezioni (AR1)

OPERAZIONI
- Prossimo evento (briefing, sessione corrente o prossima gara)
- Calendario stagionale completo
- Storico risultati stagione corrente
- Strategia gomme weekend corrente
- Allocazione CFD e galleria del vento (stagione corrente / prossima stagione)

PERSONE
- Piloti (schede individuali con parametri, contratto, umore, conversazioni)
- Pilota di riserva
- Academy (giovani talenti in sviluppo)
- Staff tecnico (schede individuali per ogni figura chiave)
- Mercato (trattative in corso, offerte ricevute, negoziazioni attive)

TECNICA
- Stato attuale della macchina (report percentuale vs benchmark)
- Piano upgrade stagione corrente
- Progetto macchina stagione successiva
- Power unit (fornitore, stato contrattuale, token sviluppo disponibili)
- Componenti acquistate da terzi (cambio e parti consentite)
- Archivio dati (dati raccolti nelle FP, analisi Data Analyst)

ECONOMIA
- Budget corrente e proiezioni
- Budget cap (voci di spesa, stato rispetto al limite, proiezioni fine stagione)
- Sponsor (contratti attivi, performance vs aspettative, rinnovi)
- Prize money (storico e proiezioni basate su classifica)
- Erogazioni Federazione (basate su classifica stagione precedente)
- Bilancio stagionale consuntivo

RELAZIONI
- Federazione (regolamento vigente, negoziazioni attive, era regolamentare)
- Sponsor (gestione rapporti, Responsabile Hospitality)
- Piloti (conversazioni, gestione rapporti)
- Staff (gestione rapporti chiave)
- Social media e reputazione mediatica

PANORAMA
- Classifica costruttori (categoria corrente, stagione in corso)
- Classifica piloti (categoria corrente, stagione in corso, tutti i piloti)
- Reputazione squadra (dettaglio per sottotipo)
- Confronto competitivo (posizionamento relativo della squadra)
- Storico stagioni precedenti
- Era regolamentare corrente e prossima

---

## 4. SISTEMA DI SALVATAGGIO

- Salvataggio automatico continuo dopo ogni azione significativa
- Un solo slot di salvataggio, nessun rollback possibile
- Nessun salvataggio manuale
- Nessuna schermata di conferma salvataggio — invisibile e silenzioso
- Al lancio dell'app, se esiste un salvataggio, si offre "Continua partita"

---

## 5. PROGRESSIONE DI CARRIERA

### Struttura delle categorie
Il gioco comprende tre categorie: AR3, AR2, AR1. Il giocatore inizia sempre in AR3, assegnato casualmente a una delle squadre esistenti. Non può scegliere la squadra, non può modificarne nome o colori.

### Soglie di promozione
Le soglie per essere promossi alla categoria superiore sono basse e raggiungibili. L'obiettivo è che il giocatore arrivi in AR1 senza che le categorie inferiori diventino un ostacolo. La promozione avviene a fine stagione se il giocatore soddisfa le condizioni minime (indicativamente: top 5 costruttori in AR3 per la promozione in AR2, top 4 in AR2 per la promozione in AR1).

### Cosa si porta da una categoria all'altra
Solo la reputazione personale del giocatore (non quella della squadra). Nessun trasferimento di staff, piloti o risorse economiche. In AR1 il giocatore viene assegnato a una squadra AR1 con il proprio staff già presente.

### AR3 come tutorial
Le prime gare di AR3 fungono da tutorial integrato nel gioco reale. Le meccaniche vengono introdotte progressivamente durante le prime sessioni di gioco effettivo. Nessun tutorial separato.

---

## 6. STRUTTURA DELLE CATEGORIE

### AR3 e AR2

Staff per squadra:
- 2 piloti (nessun pilota di riserva, nessun infortunio)
- 1 Capo Ingegnere (con statistiche proprie)
- Meccanici (anonimi, senza parametri individuali)
- 1 Ingegnere di Gara (con statistiche proprie, supervisiona pit stop)
- Operatori pit stop (anonimi, senza parametri individuali)
- 1 Preparatore Atletico (con pochi parametri, costo contenuto)

Calendario: circa 12 gare per stagione
Formato weekend: FP1 singola + Qualifica singola + Sprint (top 10 invertita) + Gara
Durata sessioni: inferiore a quella AR1, tutto più snello e rapido
Complessità: nessun budget cap articolato, sviluppo tecnico semplificato, focus principale su scouting e ingaggio talenti

### AR1

Staff completo (vedi sezione dedicata)
Calendario: identico al calendario AR1 reale dell'anno in corso
Formato weekend standard: FP1 + FP2 + FP3 + Qualifica + Gara
Formato weekend sprint (dove storicamente presente): Qualifiche Sprint + Sprint Race + Qualifiche Gara + Gara
Durata massima sessioni: FP pochi minuti ciascuna, Qualifica 5 minuti, Gara 10 minuti

---

## 7. STRUTTURA TEMPORALE DELLA STAGIONE AR1

### Scansione annuale completa

Pre-stagione (febbraio):
- Test pre-stagionali (giocabili o simulabili)
- Riunioni con lo staff
- Decisioni sul concept della macchina per la stagione
- Finalizzazione contratti e mercato invernale

Stagione di gara (marzo – novembre/dicembre):
- Weekend di gara secondo calendario reale
- Tra un weekend e l'altro: attività finanziarie, sponsor, Federazione, trattative piloti per stagione successiva
- Piccole decisioni praticabili in sessioni molto brevi

Pausa estiva (agosto):
- Silenzio totale. Nessun evento, nessuna interazione, nessuna decisione disponibile
- Il gioco mostra un messaggio di pausa e riprende automaticamente alla data di fine pausa

Post-stagione e pausa invernale (dicembre – gennaio):
- Mercato piloti e staff
- Decisioni di sviluppo macchina per la stagione successiva
- Allocazione budget
- Negoziazioni regolamentari con la Federazione
- Pianificazione operativa

### Weekend di gara — struttura dettagliata

Briefing pre-FP1:
- Previsione meteorologica del weekend (con margine di incertezza realistico)
- Temperatura pista attesa (range realistici per circuito e periodo stagionale, variabile tra sessioni)
- Mescole assegnate dalla Federazione per il weekend (3 slick da C1–C6, ispirate alle scelte reali degli ultimi 10 anni)
- Informazioni su grip e performance delle mescole da parte dello staff tecnico
- Scelta di allocazione delle FP (almeno 5–6 opzioni): simulazione passo gara, simulazione qualifica, raccolta dati aerodinamici, ottimizzazione setup meccanico, test mescole, raccolta dati telemetrici per Data Analyst
- Consiglio dello staff tecnico in base a meteo e temperatura

Prove libere (FP1, FP2, FP3):
- Il giocatore sceglie il programma prima dell'inizio
- Lo staff tecnico fornisce feedback sui dati raccolti
- Sistema di reward per la qualità dei dati ottenuti
- Ogni sessione è giocabile o simulabile automaticamente

Qualifiche:
- Durata massima 5 minuti di gioco
- Box meteo sempre visibile con aggiornamenti in tempo reale e temperatura pista
- Decisioni discrete una alla volta

Gara:
- Durata massima 10 minuti di gioco
- Dati sempre visibili: posizione dei due piloti, gap avanti e dietro, stato gomme, giri completati/totali, temperatura pista, situazione meteo
- Decisioni proattive disponibili: gestione ritmo (push/conserva), richiesta pit stop con scelta mescola
- Decisioni reattive proposte dal sistema: safety car, virtual safety car, bandiere, pioggia, incidenti, guasti
- Probabilità imprevisti legate alla storia reale del circuito (più incidenti a Monaco, più pioggia a Spa, ecc.)
- Sistema sanzionatorio piloti ispirato alla casistica reale AR1 2010–2024 (ignorare tutto dal 2025 in poi)
- Box meteo sempre visibile durante la gara

Post-gara:
- Evento media e stampa (breve, giocabile o simulabile)
- Resoconto risultati

---

## 8. STAFF AR1 — FIGURE E RUOLI

Ogni figura con statistiche proprie ha parametri individuali che influenzano specifiche aree di performance. I parametri non sono mai mostrati come numeri assoluti al giocatore, ma emergono attraverso effetti osservabili, percentuali e consigli dello staff.

### Figure principali con statistiche proprie

Capo Ingegnere
Coordina i tre Direttori Design. Determinante nei cambi d'era regolamentare (decide il concept della macchina). Nel tempo ordinario ottimizza il bilanciamento tra i tre dipartimenti. Un buon coordinamento massimizza le skill dei Direttori Design e produce una macchina più bilanciata.

Direttore Design Aerodinamico
Responsabile del dipartimento aerodinamica. Statistiche proprie che influenzano la performance aerodinamica della vettura. Staff anonimo.

Direttore Design Meccanico
Responsabile di sospensioni, idraulica, cockpit. Statistiche proprie. Staff anonimo.

Direttore Design Elettronica
Responsabile di software, MGU-K, MGU-H e sistemi elettronici. Statistiche proprie. Staff anonimo.

Direttore di Gara
Supervisiona l'esecuzione dei pit stop, la gestione delle gomme e delle coperte termiche. Influenza velocità e precisione dei pit stop e il rischio di errori durante le operazioni in corsia box. Gli operatori pit stop sono anonimi.

Data Analyst Senior
Figura cruciale. Elabora i dati raccolti nelle prove libere, produce stime percentuali sulla performance della macchina rispetto al benchmark. In sinergia con i Direttori Design, fornisce stime per dipartimento. Alimenta le previsioni di sviluppo e la pianificazione degli upgrade. La precisione delle stime dipende dalla qualità di questa figura.

Social Media Manager
Influenza esclusivamente la reputazione mediatica della squadra.

Staff Preparazione Atletica
Gestisce la salute dei piloti. Gli infortuni sono eventi rarissimi. In caso di infortunio, gestisce recupero e riabilitazione.

Direttore Logistica
Gestisce gli spostamenti mondiali della squadra, delle vetture e del personale. Influenza i costi operativi e l'efficienza delle trasferte.

Responsabile Relazioni Istituzionali
Gestisce i rapporti con la Federazione. Influenza marginalmente l'esito delle negoziazioni regolamentari.

Responsabile Hospitality e Brand Experience
Influenza esclusivamente le relazioni con gli sponsor. Non influenza la reputazione mediatica.

Responsabile Dati e Telemetria (figura minore)
Supporta il Data Analyst nell'elaborazione della telemetria. Piccolo bonus sulla qualità dei dati raccolti in FP.

Coordinatore Operativo (figura minore)
Gestisce la logistica interna del team durante i weekend di gara. Piccola influenza sull'efficienza operativa.

Responsabile Comunicazione Tecnica (figura minore)
Gestisce la comunicazione tecnica interna tra i dipartimenti. Piccola influenza sul coordinamento staff.

### Piloti

Ogni pilota ha parametri individuali multipli:
- Talento (capacità di guida pura)
- Età (influenza traiettoria di crescita o declino)
- Visibilità mediatica (attrattività per sponsor e pubblico)
- Valore sponsor (quanto il pilota porta economicamente agli sponsor)
- Umore (influenzato dalle interazioni con il giocatore e dai risultati)
- Rapporto col compagno di squadra (influenza dinamiche interne)
- Disponibilità a rinnovare (influenzata da umore, risultati, offerte esterne)

Le richieste contrattuali (salario, condizioni, clausole) variano nel tempo in base a: prestazioni individuali al netto della macchina, età, offerte da altre squadre, umore accumulato.

Pilota di riserva: figura contrattualizzata con status e stipendio inferiori. Può subentrare durante la stagione in caso di infortunio. Fa parte del sistema academy.

Academy: sottosistema per l'inserimento graduale di giovani talenti. Primo step dopo la promozione da AR2 o AR3. Gestita come i piloti ma con parametri e costi ridotti.

### Contratti e mercato

- Il mercato piloti e staff è aperto solo durante la pausa invernale
- Durante la stagione: solo sostituzione con pilota di riserva in caso di infortunio
- I contratti staff includono clausole di non concorrenza con periodi di gardening leave (variabili per ruolo e importanza)
- La diffusione di innovazioni tecniche tra squadre avviene nel tempo, con velocità proporzionale al rating dei Direttori Design della squadra che tenta di copiarle

---

## 9. SISTEMA DI REPUTAZIONE

Punteggio massimo: 10.000 punti

Composizione:
- I sottotipi di reputazione valgono complessivamente i due terzi del totale (circa 6.667 punti distribuiti tra le voci)
- La reputazione generale vale il terzo rimanente (circa 3.333 punti)
- Il totale è la somma aritmetica di tutte le componenti

Sottotipi:
- Reputazione Tecnica — influenza l'attrattività verso staff e ingegneri di qualità
- Reputazione di Performance — influenza l'attrattività verso piloti di talento
- Reputazione Mediatica — influenza l'attrattività verso sponsor importanti
- Reputazione Finanziaria — influenza l'accesso a condizioni contrattuali favorevoli

Ogni sottotipo usa numeri a quattro cifre per garantire moltissime sfumature possibili. I valori non sono mai mostrati come formule ma come risultati osservabili e percentuali.

---

## 10. SISTEMA ECONOMICO E BUDGET CAP

### Fonti di entrata
- Prize money dalla Federazione (basato su classifica costruttori stagione precedente)
- Erogazioni speciali Federazione (bonus storici per team fondatori, meccanismi di bilanciamento competitivo)
- Contratti sponsor
- Vendita di componenti tecniche ad altri team (se consentito dal regolamento)

### Budget cap semplificato
Poche voci di bilancio chiave (5–7 categorie di spesa). Il giocatore sceglie tra approcci aggressivi o prudenti nell'allocazione. Le sanzioni per violazione del budget cap si ispirano alla realtà: ammonizioni, detrazioni punti costruttori, limitazioni allo sviluppo, esclusioni temporanee.

### Classifiche e limiti CFD/galleria del vento
- Il posizionamento nella stagione precedente determina le erogazioni Federazione
- Determina anche i limiti di tempo per CFD e galleria del vento (inversamente proporzionali alla classifica)
- Il giocatore sceglie esplicitamente come allocare il tempo disponibile: macchina corrente vs progetto stagione successiva
- Token di sviluppo motore: meccanismo reale, con token aggiuntivi per power unit significativamente sotto benchmark

### Sponsor
Almeno tre categorie:
1. Sponsor principale — grande apporto economico, condizioni esigenti, visibilità massima
2. Partner tecnico — apporto economico medio, contributo di personale e know-how (es. partner informatico che fornisce risorse per il Data Analyst)
3. Sponsor minore — apporto economico limitato, condizioni flessibili, pazienza maggiore

Ogni sponsor ha condizioni specifiche e soglie di interruzione del rapporto. Le clausole tengono conto delle aspettative realistiche sulla squadra al momento della firma.

### Negoziazioni contrattuali (piloti, staff, sponsor)
Sistema a pacchetti: almeno 4 pacchetti per ogni negoziazione, ciascuno con focus diverso e bilanciamento proprio di vantaggi e svantaggi. All'aumentare di risultati e reputazione, i pacchetti disponibili migliorano. Tutti i valori numerici si modificano con pulsanti + e −.

---

## 11. SISTEMA DI SVILUPPO TECNICO

### Performance della macchina
I valori assoluti di performance non sono mai visibili al giocatore. Il sistema interno usa numeri precisi per ogni componente (aerodinamica, meccanica, elettronica, power unit) ma li nasconde completamente.

Cosa vede il giocatore:
- Tramite Data Analyst: stima percentuale della performance generale rispetto al benchmark
- Tramite Data Analyst + Direttori Design: stima per dipartimento rispetto al benchmark
- Dopo ogni upgrade: riscontro direzionale (avvicinamento o allontanamento dal benchmark, con percentuale)
- La precisione delle stime dipende dalla qualità dello staff coinvolto

### Upgrade durante la stagione
Nella sezione Tecnica esiste un ramo dedicato alla pianificazione upgrade:
- I dati delle FP alimentano le opzioni disponibili
- Per ogni decisione di upgrade sono sempre presenti almeno 2–3 opzioni con filosofie diverse
- Lo staff tecnico illustra pro e contro di ciascuna opzione
- I limiti CFD/galleria del vento si applicano e vanno rispettati

### Power unit
- Team costruttori di motori propri vs team clienti
- Possibilità di avviare produzione interna (percorso ispirato ai casi Red Bull Powertrains e Audi, con investimento progressivo e timeline pluriennale)
- Differenziali di competitività tra motore proprio e acquistato
- Mercato componenti: cambio e parti limitate acquistabili da altre squadre
- Token sviluppo motore: meccanismo reale, token aggiuntivi per PU sotto benchmark

### Innovazioni tecniche
Le innovazioni si ispirano alla storia reale della AR1. Escluse le invenzioni più esotiche (no vettura a sei ruote, no fan car). Alcune soluzioni storicamente bannate possono essere sviluppate grazie alla maggiore permissività della Federazione fittizia. La velocità di copia tra squadre dipende dal rating dei Direttori Design.

---

## 12. ERE REGOLAMENTARI

### Struttura
- Minimo 4 stagioni per era regolamentare
- Possibilità di prolungare la durata attraverso negoziazioni con la Federazione
- Le transizioni non copiano necessariamente la storia reale della AR1 ma devono avere conseguenze tecniche concrete
- Le conseguenze di ogni cambio d'era sono esplicitate nella sezione Regolamenti di Panorama

### Effetti dei cambi d'era
- Ogni cambio regolamentare rimescola significativamente le gerarchie (potenzialmente)
- Il Capo Ingegnere è la figura cruciale: decide il concept della macchina per la nuova era
- Le squadre AI reagiscono autonomamente ai cambi d'era con variabilità realistica

### Meccanismi regolamentari reali da includere
- Limiti CFD e galleria del vento inversamente proporzionali alla classifica
- Token sviluppo power unit
- Budget cap con categorie di spesa e sanzioni
- Obbligo uso due mescole diverse in gara
- Parc fermé
- Peso minimo vettura
- Sistema penalità ispirato a casistica 2010–2024

---

## 13. PNEUMATICI

- Fornitore unico (nome fittizio ispirato a Pirelli)
- Mescole slick: da C1 (durissima) a C6 (morbidissima)
- Bagnato: Intermedie e Full Wet
- La Federazione sceglie 3 mescole slick per ogni circuito, ispirandosi alle scelte reali degli ultimi 10 anni
- Obbligo di almeno un pit stop in gara
- Obbligo di usare almeno due mescole diverse in gara
- Il degrado gomme è rappresentato come percentuale di usura
- Il briefing pre-FP1 include informazioni su grip e performance delle tre mescole assegnate
- La temperatura pista influenza concretamente il comportamento delle gomme

---

## 14. CIRCUITI E CALENDARIO

### Circuiti disponibili
- Tutti i circuiti del calendario AR1 reale dell'anno in corso
- Circuiti storici non più in calendario (es. vecchio Hockenheim, Magny-Cours, Imola, A1 Ring, ecc.)
- I circuiti storici possono rientrare in calendario nelle ere successive tramite meccanismi narrativi

### Dettagli per ogni circuito
- Nome, paese, bandiera
- Caratteristiche tecniche: lunghezza, numero di curve, tipo di asfalto, livello di carico aerodinamico richiesto, usura gomme tipica
- Range di temperatura pista realistici per periodo stagionale e area geografica
- Probabilità meteo storiche (Spa alta probabilità pioggia, Monaco bassa, ecc.)
- Probabilità imprevisti storiche (Monaco alta probabilità incidenti, Monza bassa, ecc.)
- Mescole assegnate storicamente

### Weekend sprint
Inseriti solo nei circuiti storicamente confermati per la sprint nella AR1 reale. Nessuna sprint race inventata in circuiti che non le hanno mai ospitate. Formato sprint 2026: Qualifiche Sprint + Sprint Race + Qualifiche Gara + Gara.

---

## 15. SQUADRE E PILOTI

### Nomenclatura
I team e i piloti usano nomi fittizi ma chiaramente ispirati alla realtà. Il giocatore deve riconoscere immediatamente i riferimenti senza che i nomi siano identici. Esempi di approccio: "Scuderia Rossa" per Ferrari, "Frecce d'Argento" per Mercedes. I piloti hanno nomi plausibili di nazionalità corrispondente al pilota reale a cui si ispirano.

### Struttura della griglia AR1
- Sempre 10 squadre, sempre 20 vetture
- Nessuna squadra sparisce mai dal gioco
- Possibili cambi di nome, sponsor principale o proprietà (stile Sauber/Audi) ma il numero rimane fisso
- Le squadre AI hanno meccanismi discreti anti-spirale invisibili al giocatore

### Gestione squadre AI
Le squadre AI non sono sfondi. Hanno una simulazione gestionale autonoma e attiva: assumono staff, sviluppano la macchina, prendono decisioni strategiche, negoziano sponsor. La loro gestione ha ampia variabilità. Seguono le stesse regole del giocatore inclusi budget cap, limiti CFD/galleria del vento e token motore.

---

## 16. FEDERAZIONE E REGOLAMENTI

### Interazioni con la Federazione
Semplici ma significative. Il Responsabile Relazioni Istituzionali gestisce questi rapporti. Le interazioni includono:
- Negoziazioni sui futuri regolamenti (scambi e concessioni reciproche)
- Possibilità di prolungare la durata di un'era regolamentare
- Richiesta di chiarimenti su interpretazioni tecniche

Escluso: reclami contro concorrenti, segnalazioni di violazioni, qualsiasi dinamica di gioco sporco.

### Permissività tecnica
La Federazione fittizia è leggermente più permissiva rispetto alla realtà sulle innovazioni tecniche. Questo non cambia i regolamenti fondamentali ma riduce la frequenza di interventi restrittivi su soluzioni borderline.

---

## 17. MECCANISMO DI SALVATAGGIO DALLA CRISI

Se la squadra del giocatore chiude ultima nel campionato costruttori AR1 a fine stagione, la Federazione eroga un finanziamento straordinario che permette di ripartire dalla stagione successiva. Questo meccanismo è esclusivo per la squadra del giocatore. Non si applica alle squadre AI. Il salvataggio arriva come evento narrativo a fine stagione, non è annunciato in anticipo.

---

## 18. SISTEMA SONORO

- Effetti sonori brevi (meno di 2 secondi ciascuno)
- Volume basso, non invasivo
- Nessun rombo di motori termici
- Suoni elettronici, digitali, meccanici e idraulici
- Il "bip" iconico del team radio AR1 è incluso come elemento riconoscibile
- Almeno 5–6 tipi di suono distinti per tipo di interazione
- Nessun problema con la sovrapposizione con VoiceOver — i due livelli audio coesistono
- Tipi di suono da includere: conferma decisione, errore/avviso, evento imprevisto, inizio sessione, fine sessione, notifica staff, navigazione menu

---

## 19. RITMO E BILANCIAMENTO DEL GIOCO

### Filosofia generale
- Gioco continuo senza fine predefinita, pensato per sessioni di lungo periodo
- Ritmo lento e disteso — non una tempesta continua di eventi
- Varietà e variabilità distribuite nel tempo
- Il gioco premia strategie diverse dalla maggioranza senza penalizzare chi si discosta
- Piccolo margine di tolleranza permanente: le scelte subottimali non sono mai immediatamente fatali
- Nessun evento a scadenza, nessuna notifica push, nessuna pressione temporale esterna
- Il mondo si muove solo quando il giocatore apre l'app

### Sessioni brevi
Anche senza un evento in corso, il giocatore può svolgere in pochi minuti: piccole decisioni finanziarie, interazioni con sponsor, semplici negoziazioni con la Federazione, lettura di report.

### Trasparenza delle variabili
I numeri definiti (salari, costi, ricavi, gap, giri, percentuali) sono sempre espliciti. Le dinamiche complesse (qualità staff, umore, competitività tecnica) emergono attraverso effetti osservabili e percentuali, senza mai esporre le formule sottostanti. La verosimiglianza è prioritaria rispetto all'artificiosità.

---

## 20. TONO E STILE COMUNICATIVO

- Asciutto e professionale, come un briefing tecnico sportivo
- Nessuna personalità individuale nei personaggi (nessuna battuta, nessuna sfumatura emotiva)
- Comunicazioni funzionali e dirette
- Sintassi ottimizzata per VoiceOver: frasi brevi, struttura prevedibile, nessuna ambiguità
- Terminologia tecnica AR1 in inglese dove consolidata
- Nessuna retorica motivazionale, nessun tono da videogioco arcade

---

## 21. NOTE TECNICHE PER LO SVILUPPO

- Framework: vanilla HTML/CSS/JavaScript (nessun framework esterno a meno che strettamente necessario)
- Persistenza dati: localStorage
- Nessuna dipendenza da server esterni o API (il gioco funziona completamente offline)
- La logica di simulazione (gare, sviluppo, AI squadre) è interamente client-side
- Il generatore di eventi casuali usa seed controllati per garantire coerenza e riproducibilità
- Tutti gli elementi interattivi hanno dimensione minima di touch target 44x44px (requisito Apple per accessibilità)
- Nessun elemento con timeout automatico
- Nessuna animazione CSS che interferisca con la lettura di VoiceOver (usare prefers-reduced-motion)
- Testare ogni schermata con VoiceOver attivo prima di considerarla completata
- Struttura a file multipli consigliata: index.html, style.css, game-engine.js, ui.js, data.js, audio.js
- Il file data.js contiene tutti i dati statici: circuiti, squadre, piloti, mescole, calendari storici
- Includere sempre manifest.json e service-worker.js tra i file del progetto.
- Piattaforma di pubblicazione: GitHub Pages. Il progetto deve essere strutturato fin dall'inizio per essere compatibile con la pubblicazione su GitHub Pages senza configurazioni aggiuntive.
