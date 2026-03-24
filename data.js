/* ============================================================
   DATA.JS — AR1 Manager
   Tutti i dati statici del gioco: circuiti, squadre, piloti,
   mescole, calendari, ere regolamentari.
   ============================================================ */

'use strict';

/* ============================================================
   MESCOLE GOMME
   ============================================================ */

const MESCOLE = {
  C1: {
    id: 'C1', nome: 'C1 — Durissima', colore: '#FFFFFF',
    grip: 55, durata: 98, temperaturaOttimale: { min: 100, max: 130 },
    descrizione: 'Mescola più dura disponibile. Degrado minimo, grip limitato.'
  },
  C2: {
    id: 'C2', nome: 'C2 — Dura', colore: '#FFFFFF',
    grip: 63, durata: 90, temperaturaOttimale: { min: 90, max: 120 },
    descrizione: 'Mescola dura. Ottima per lunghi stint, basso degrado.'
  },
  C3: {
    id: 'C3', nome: 'C3 — Media', colore: '#FFD700',
    grip: 72, durata: 78, temperaturaOttimale: { min: 80, max: 110 },
    descrizione: 'Mescola media. Bilanciamento tra grip e durata.'
  },
  C4: {
    id: 'C4', nome: 'C4 — Morbida', colore: '#FF2222',
    grip: 82, durata: 62, temperaturaOttimale: { min: 70, max: 100 },
    descrizione: 'Mescola morbida. Grip elevato, degrado significativo.'
  },
  C5: {
    id: 'C5', nome: 'C5 — Supermorbida', colore: '#FF2222',
    grip: 90, durata: 48, temperaturaOttimale: { min: 60, max: 90 },
    descrizione: 'Mescola supermorbida. Grip massimo, durata limitata.'
  },
  C6: {
    id: 'C6', nome: 'C6 — Ultramorbida', colore: '#FF2222',
    grip: 97, durata: 32, temperaturaOttimale: { min: 55, max: 80 },
    descrizione: 'Mescola più morbida disponibile. Solo per qualifica o stint brevissimi.'
  },
  INTERMEDIA: {
    id: 'INTERMEDIA', nome: 'Intermedia', colore: '#00AA44',
    grip: 68, durata: 70, temperaturaOttimale: { min: 20, max: 50 },
    descrizione: 'Per piste umide ma non allagate. Efficace tra 0 e 50 mm/h di pioggia.'
  },
  FULL_WET: {
    id: 'FULL_WET', nome: 'Full Wet', colore: '#0055FF',
    grip: 55, durata: 80, temperaturaOttimale: { min: 10, max: 35 },
    descrizione: 'Per pioggia intensa. Indispensabile oltre 50 mm/h.'
  }
};

/* ============================================================
   CIRCUITI — CALENDARIO 2025 (usato come 2026 in-game)
   Ogni circuito include: dati tecnici, meteo storici,
   probabilità eventi, mescole storiche assegnate
   ============================================================ */

const CIRCUITI = [
  {
    id: 'australia',
    nome: 'Gran Premio d\'Australia',
    circuito: 'Albert Park',
    citta: 'Melbourne',
    paese: 'Australia',
    bandiera: '🇦🇺',
    round: 1,
    data: '2026-03-16',
    sprint: false,
    lunghezza: 5278,
    giri: 58,
    curveN: 16,
    caricoAero: 'medio',          /* basso | medio | alto | molto_alto */
    usuraGomme: 'media',          /* bassa | media | alta | molto_alta */
    probabilitaPioggia: 0.20,
    probabilitaSafetyCar: 0.45,
    probabilitaIncidenti: 0.35,
    temperaturaMin: 22, temperaturaMax: 42,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Lungo rettilineo principale con zone DRS',
      'Sezione tecnica nel settore centrale',
      'Tracciato cittadino semi-permanente'
    ],
    pesoPerformance: { aerodinamica: 0.30, meccanica: 0.30, elettronica: 0.20, powerUnit: 0.20 }
  },
  {
    id: 'cina',
    nome: 'Gran Premio di Cina',
    circuito: 'Shanghai International Circuit',
    citta: 'Shanghai',
    paese: 'Cina',
    bandiera: '🇨🇳',
    round: 2,
    data: '2026-03-23',
    sprint: true,
    lunghezza: 5451,
    giri: 56,
    curveN: 16,
    caricoAero: 'medio',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.30,
    probabilitaSafetyCar: 0.35,
    probabilitaIncidenti: 0.30,
    temperaturaMin: 18, temperaturaMax: 38,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Lungo rettilineo con hairpin al fondo',
      'Sezione a esse tecnica nel settore 2',
      'Alta usura gomme posteriori'
    ],
    pesoPerformance: { aerodinamica: 0.28, meccanica: 0.32, elettronica: 0.20, powerUnit: 0.20 }
  },
  {
    id: 'giappone',
    nome: 'Gran Premio del Giappone',
    circuito: 'Suzuka International Racing Course',
    citta: 'Suzuka',
    paese: 'Giappone',
    bandiera: '🇯🇵',
    round: 3,
    data: '2026-04-06',
    sprint: false,
    lunghezza: 5807,
    giri: 53,
    curveN: 18,
    caricoAero: 'alto',
    usuraGomme: 'media',
    probabilitaPioggia: 0.35,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 20, temperaturaMax: 38,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Curva 130R ad altissima velocità',
      'Sezione delle esse che premia l\'aerodinamica',
      'Chicane finale tecnica'
    ],
    pesoPerformance: { aerodinamica: 0.40, meccanica: 0.25, elettronica: 0.20, powerUnit: 0.15 }
  },
  {
    id: 'bahrain',
    nome: 'Gran Premio del Bahrain',
    circuito: 'Bahrain International Circuit',
    citta: 'Sakhir',
    paese: 'Bahrain',
    bandiera: '🇧🇭',
    round: 4,
    data: '2026-04-13',
    sprint: false,
    lunghezza: 5412,
    giri: 57,
    curveN: 15,
    caricoAero: 'medio',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.05,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.25,
    temperaturaMin: 35, temperaturaMax: 55,
    mescole: ['C1', 'C2', 'C3'],
    altitudine: 0,
    caratteristiche: [
      'Gara notturna con pista abrasiva',
      'Alta usura gomme posteriori',
      'Tre zone DRS principali'
    ],
    pesoPerformance: { aerodinamica: 0.25, meccanica: 0.30, elettronica: 0.25, powerUnit: 0.20 }
  },
  {
    id: 'arabia_saudita',
    nome: 'Gran Premio dell\'Arabia Saudita',
    circuito: 'Jeddah Corniche Circuit',
    citta: 'Jeddah',
    paese: 'Arabia Saudita',
    bandiera: '🇸🇦',
    round: 5,
    data: '2026-04-20',
    sprint: false,
    lunghezza: 6174,
    giri: 50,
    curveN: 27,
    caricoAero: 'basso',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.05,
    probabilitaSafetyCar: 0.55,
    probabilitaIncidenti: 0.50,
    temperaturaMin: 32, temperaturaMax: 52,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Circuito cittadino ad altissima velocità media',
      'Muri ravvicinati con alto rischio incidenti',
      'Poca visibilità nelle sezioni curve ravvicinate'
    ],
    pesoPerformance: { aerodinamica: 0.20, meccanica: 0.20, elettronica: 0.25, powerUnit: 0.35 }
  },
  {
    id: 'miami',
    nome: 'Gran Premio di Miami',
    circuito: 'Miami International Autodrome',
    citta: 'Miami',
    paese: 'USA',
    bandiera: '🇺🇸',
    round: 6,
    data: '2026-05-04',
    sprint: true,
    lunghezza: 5412,
    giri: 57,
    curveN: 19,
    caricoAero: 'medio',
    usuraGomme: 'media',
    probabilitaPioggia: 0.30,
    probabilitaSafetyCar: 0.40,
    probabilitaIncidenti: 0.35,
    temperaturaMin: 35, temperaturaMax: 55,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    caratteristiche: [
      'Tracciato semi-permanente attorno allo stadio',
      'Alta temperatura pista con effetto su degrado gomme',
      'Zona DRS lunga sul rettilineo principale'
    ],
    pesoPerformance: { aerodinamica: 0.28, meccanica: 0.30, elettronica: 0.22, powerUnit: 0.20 }
  },
  {
    id: 'emilia_romagna',
    nome: 'Gran Premio dell\'Emilia Romagna',
    circuito: 'Autodromo Enzo e Dino Ferrari',
    citta: 'Imola',
    paese: 'Italia',
    bandiera: '🇮🇹',
    round: 7,
    data: '2026-05-18',
    sprint: false,
    lunghezza: 4909,
    giri: 63,
    curveN: 19,
    caricoAero: 'alto',
    usuraGomme: 'media',
    probabilitaPioggia: 0.35,
    probabilitaSafetyCar: 0.40,
    probabilitaIncidenti: 0.35,
    temperaturaMin: 28, temperaturaMax: 48,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Poche zone di sorpasso, qualifica determinante',
      'Sezione Piratella impegnativa per sospensioni',
      'Variante Alta ad alta percorrenza'
    ],
    pesoPerformance: { aerodinamica: 0.35, meccanica: 0.30, elettronica: 0.20, powerUnit: 0.15 }
  },
  {
    id: 'monaco',
    nome: 'Gran Premio di Monaco',
    circuito: 'Circuit de Monaco',
    citta: 'Monaco',
    paese: 'Monaco',
    bandiera: '🇲🇨',
    round: 8,
    data: '2026-05-25',
    sprint: false,
    lunghezza: 3337,
    giri: 78,
    curveN: 19,
    caricoAero: 'molto_alto',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.25,
    probabilitaSafetyCar: 0.70,
    probabilitaIncidenti: 0.65,
    temperaturaMin: 25, temperaturaMax: 45,
    mescole: ['C4', 'C5', 'C6'],
    altitudine: 0,
    caratteristiche: [
      'Sorpassi quasi impossibili, qualifica essenziale',
      'Hairpin del Fairmont a bassa velocità',
      'Tunnel e sezione nuova del porto'
    ],
    pesoPerformance: { aerodinamica: 0.45, meccanica: 0.35, elettronica: 0.15, powerUnit: 0.05 }
  },
  {
    id: 'spagna',
    nome: 'Gran Premio di Spagna',
    circuito: 'Circuit de Barcelona-Catalunya',
    citta: 'Barcellona',
    paese: 'Spagna',
    bandiera: '🇪🇸',
    round: 9,
    data: '2026-06-01',
    sprint: false,
    lunghezza: 4675,
    giri: 66,
    curveN: 16,
    caricoAero: 'medio',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.15,
    probabilitaSafetyCar: 0.25,
    probabilitaIncidenti: 0.22,
    temperaturaMin: 35, temperaturaMax: 55,
    mescole: ['C1', 'C2', 'C3'],
    altitudine: 0,
    caratteristiche: [
      'Curva 3 ad alta percorrenza',
      'Lunga curva 9 Campsa che premia l\'aerodinamica',
      'Circuito benchmark per lo sviluppo tecnico'
    ],
    pesoPerformance: { aerodinamica: 0.38, meccanica: 0.28, elettronica: 0.20, powerUnit: 0.14 }
  },
  {
    id: 'canada',
    nome: 'Gran Premio del Canada',
    circuito: 'Circuit Gilles Villeneuve',
    citta: 'Montreal',
    paese: 'Canada',
    bandiera: '🇨🇦',
    round: 10,
    data: '2026-06-15',
    sprint: false,
    lunghezza: 4361,
    giri: 70,
    curveN: 14,
    caricoAero: 'basso',
    usuraGomme: 'media',
    probabilitaPioggia: 0.35,
    probabilitaSafetyCar: 0.50,
    probabilitaIncidenti: 0.42,
    temperaturaMin: 22, temperaturaMax: 40,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    caratteristiche: [
      'Muro dei Campioni alla curva finale',
      'Circuito stop-and-go con forti frenate',
      'Frequenti safety car storicamente'
    ],
    pesoPerformance: { aerodinamica: 0.18, meccanica: 0.28, elettronica: 0.24, powerUnit: 0.30 }
  },
  {
    id: 'austria',
    nome: 'Gran Premio d\'Austria',
    circuito: 'Red Bull Ring',
    citta: 'Spielberg',
    paese: 'Austria',
    bandiera: '🇦🇹',
    round: 11,
    data: '2026-06-29',
    sprint: true,
    lunghezza: 4318,
    giri: 71,
    curveN: 10,
    caricoAero: 'medio',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.30,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 28, temperaturaMax: 50,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 700,
    caratteristiche: [
      'Circuito breve con molta azione',
      'Alta usura gomme posteriori',
      'Curva 3 Remus ad alta percorrenza'
    ],
    pesoPerformance: { aerodinamica: 0.30, meccanica: 0.30, elettronica: 0.20, powerUnit: 0.20 }
  },
  {
    id: 'gran_bretagna',
    nome: 'Gran Premio di Gran Bretagna',
    circuito: 'Silverstone Circuit',
    citta: 'Silverstone',
    paese: 'Gran Bretagna',
    bandiera: '🇬🇧',
    round: 12,
    data: '2026-07-06',
    sprint: false,
    lunghezza: 5891,
    giri: 52,
    curveN: 18,
    caricoAero: 'medio_alto',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.40,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 20, temperaturaMax: 40,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Copse Corner ad altissima velocità',
      'Sezione Maggots-Becketts-Chapel impegnativa',
      'Pioggia frequente con cambio condizioni rapido'
    ],
    pesoPerformance: { aerodinamica: 0.38, meccanica: 0.28, elettronica: 0.20, powerUnit: 0.14 }
  },
  {
    id: 'belgio',
    nome: 'Gran Premio del Belgio',
    circuito: 'Circuit de Spa-Francorchamps',
    citta: 'Spa',
    paese: 'Belgio',
    bandiera: '🇧🇪',
    round: 13,
    data: '2026-07-27',
    sprint: true,
    lunghezza: 7004,
    giri: 44,
    curveN: 19,
    caricoAero: 'medio',
    usuraGomme: 'media',
    probabilitaPioggia: 0.60,
    probabilitaSafetyCar: 0.45,
    probabilitaIncidenti: 0.38,
    temperaturaMin: 18, temperaturaMax: 38,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 400,
    caratteristiche: [
      'Eau Rouge e Raidillon — sequenza iconica',
      'Pioggia notoriamente imprevedibile',
      'Lungo circuito che premia potenza del motore'
    ],
    pesoPerformance: { aerodinamica: 0.28, meccanica: 0.22, elettronica: 0.20, powerUnit: 0.30 }
  },
  {
    id: 'ungheria',
    nome: 'Gran Premio d\'Ungheria',
    circuito: 'Hungaroring',
    citta: 'Budapest',
    paese: 'Ungheria',
    bandiera: '🇭🇺',
    round: 14,
    data: '2026-08-03',
    sprint: false,
    lunghezza: 4381,
    giri: 70,
    curveN: 14,
    caricoAero: 'alto',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.25,
    probabilitaSafetyCar: 0.25,
    probabilitaIncidenti: 0.22,
    temperaturaMin: 38, temperaturaMax: 58,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Circuito lento e tortuoso, pochi sorpassi',
      'Temperature estreme che stressano le gomme',
      'Curva 4 lenta determinante per uscita sul rettilineo'
    ],
    pesoPerformance: { aerodinamica: 0.42, meccanica: 0.32, elettronica: 0.18, powerUnit: 0.08 }
  },
  {
    id: 'olanda',
    nome: 'Gran Premio d\'Olanda',
    circuito: 'Circuit Zandvoort',
    citta: 'Zandvoort',
    paese: 'Olanda',
    bandiera: '🇳🇱',
    round: 15,
    data: '2026-08-31',
    sprint: false,
    lunghezza: 4259,
    giri: 72,
    curveN: 14,
    caricoAero: 'alto',
    usuraGomme: 'media',
    probabilitaPioggia: 0.40,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 20, temperaturaMax: 40,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    caratteristiche: [
      'Parabolica finale con banking inclinato',
      'Circuito veloce con pochi punti di sorpasso',
      'Vento costante che influenza il bilanciamento'
    ],
    pesoPerformance: { aerodinamica: 0.40, meccanica: 0.28, elettronica: 0.18, powerUnit: 0.14 }
  },
  {
    id: 'italia',
    nome: 'Gran Premio d\'Italia',
    circuito: 'Autodromo Nazionale Monza',
    citta: 'Monza',
    paese: 'Italia',
    bandiera: '🇮🇹',
    round: 16,
    data: '2026-09-07',
    sprint: false,
    lunghezza: 5793,
    giri: 53,
    curveN: 11,
    caricoAero: 'basso',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.30,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.25,
    temperaturaMin: 28, temperaturaMax: 48,
    mescole: ['C4', 'C5', 'C6'],
    altitudine: 0,
    caratteristiche: [
      'Tempio della velocità — rettilneo principale 1,2 km',
      'Basso carico aero per massimizzare la velocità di punta',
      'Parabolica finale ad alta velocità'
    ],
    pesoPerformance: { aerodinamica: 0.12, meccanica: 0.18, elettronica: 0.20, powerUnit: 0.50 }
  },
  {
    id: 'azerbaigian',
    nome: 'Gran Premio dell\'Azerbaigian',
    circuito: 'Baku City Circuit',
    citta: 'Baku',
    paese: 'Azerbaigian',
    bandiera: '🇦🇿',
    round: 17,
    data: '2026-09-21',
    sprint: false,
    lunghezza: 6003,
    giri: 51,
    curveN: 20,
    caricoAero: 'basso',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.10,
    probabilitaSafetyCar: 0.60,
    probabilitaIncidenti: 0.55,
    temperaturaMin: 30, temperaturaMax: 50,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    caratteristiche: [
      'Lungo rettilineo principale con velocità di punta massima',
      'Sezione del castello stretta e tecnica',
      'Frequenti safety car e forature'
    ],
    pesoPerformance: { aerodinamica: 0.15, meccanica: 0.20, elettronica: 0.25, powerUnit: 0.40 }
  },
  {
    id: 'singapore',
    nome: 'Gran Premio di Singapore',
    circuito: 'Marina Bay Street Circuit',
    citta: 'Singapore',
    paese: 'Singapore',
    bandiera: '🇸🇬',
    round: 18,
    data: '2026-10-05',
    sprint: false,
    lunghezza: 4940,
    giri: 62,
    curveN: 23,
    caricoAero: 'molto_alto',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.45,
    probabilitaSafetyCar: 0.65,
    probabilitaIncidenti: 0.58,
    temperaturaMin: 32, temperaturaMax: 48,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    caratteristiche: [
      'Gara notturna con umidità tropicale',
      'Circuito strettissimo e fisicamente intenso',
      'Più alta probabilità di safety car in calendario'
    ],
    pesoPerformance: { aerodinamica: 0.45, meccanica: 0.35, elettronica: 0.15, powerUnit: 0.05 }
  },
  {
    id: 'usa',
    nome: 'Gran Premio degli Stati Uniti',
    circuito: 'Circuit of the Americas',
    citta: 'Austin',
    paese: 'USA',
    bandiera: '🇺🇸',
    round: 19,
    data: '2026-10-19',
    sprint: true,
    lunghezza: 5513,
    giri: 56,
    curveN: 20,
    caricoAero: 'medio_alto',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.30,
    probabilitaSafetyCar: 0.35,
    probabilitaIncidenti: 0.30,
    temperaturaMin: 25, temperaturaMax: 45,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 215,
    caratteristiche: [
      'Curva 1 in salita iconica',
      'Sezione centrale ispirata a classici europei',
      'Ampia variabilità meteo in ottobre'
    ],
    pesoPerformance: { aerodinamica: 0.35, meccanica: 0.28, elettronica: 0.22, powerUnit: 0.15 }
  },
  {
    id: 'messico',
    nome: 'Gran Premio del Messico',
    circuito: 'Autodromo Hermanos Rodriguez',
    citta: 'Città del Messico',
    paese: 'Messico',
    bandiera: '🇲🇽',
    round: 20,
    data: '2026-10-26',
    sprint: false,
    lunghezza: 4304,
    giri: 71,
    curveN: 17,
    caricoAero: 'basso',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.20,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 22, temperaturaMax: 38,
    mescole: ['C4', 'C5', 'C6'],
    altitudine: 2285,
    caratteristiche: [
      'Alta quota: motori perdono potenza, ali più caricate',
      'Stadio Foro Sol attorno all\'ultima chicane',
      'Aria rarefatta altera i calcoli di carburante'
    ],
    pesoPerformance: { aerodinamica: 0.22, meccanica: 0.25, elettronica: 0.28, powerUnit: 0.25 }
  },
  {
    id: 'brasile',
    nome: 'Gran Premio del Brasile',
    circuito: 'Autodromo Jose Carlos Pace',
    citta: 'São Paulo',
    paese: 'Brasile',
    bandiera: '🇧🇷',
    round: 21,
    data: '2026-11-09',
    sprint: true,
    lunghezza: 4309,
    giri: 71,
    curveN: 15,
    caricoAero: 'medio',
    usuraGomme: 'media',
    probabilitaPioggia: 0.55,
    probabilitaSafetyCar: 0.45,
    probabilitaIncidenti: 0.40,
    temperaturaMin: 25, temperaturaMax: 45,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 800,
    caratteristiche: [
      'Pioggia frequente e improvvisa — classico brasiliano',
      'Curva 1 in discesa impegnativa',
      'Rettilineo principale lungo con frequenti sorpassi'
    ],
    pesoPerformance: { aerodinamica: 0.30, meccanica: 0.28, elettronica: 0.22, powerUnit: 0.20 }
  },
  {
    id: 'las_vegas',
    nome: 'Gran Premio di Las Vegas',
    circuito: 'Las Vegas Strip Circuit',
    citta: 'Las Vegas',
    paese: 'USA',
    bandiera: '🇺🇸',
    round: 22,
    data: '2026-11-22',
    sprint: false,
    lunghezza: 6201,
    giri: 50,
    curveN: 17,
    caricoAero: 'basso',
    usuraGomme: 'media',
    probabilitaPioggia: 0.05,
    probabilitaSafetyCar: 0.40,
    probabilitaIncidenti: 0.38,
    temperaturaMin: 8, temperaturaMax: 25,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 600,
    caratteristiche: [
      'Gara notturna con temperature basse — gestione gomme critica',
      'Lungo rettilineo sulla Strip con massima velocità di punta',
      'Traffico cover di safety car nel traffico cittadino'
    ],
    pesoPerformance: { aerodinamica: 0.18, meccanica: 0.22, elettronica: 0.25, powerUnit: 0.35 }
  },
  {
    id: 'qatar',
    nome: 'Gran Premio del Qatar',
    circuito: 'Losail International Circuit',
    citta: 'Lusail',
    paese: 'Qatar',
    bandiera: '🇶🇦',
    round: 23,
    data: '2026-11-30',
    sprint: true,
    lunghezza: 5380,
    giri: 57,
    curveN: 16,
    caricoAero: 'medio',
    usuraGomme: 'molto_alta',
    probabilitaPioggia: 0.05,
    probabilitaSafetyCar: 0.25,
    probabilitaIncidenti: 0.22,
    temperaturaMin: 30, temperaturaMax: 50,
    mescole: ['C1', 'C2', 'C3'],
    altitudine: 0,
    caratteristiche: [
      'Usura gomme tra le più alte dell\'anno',
      'Gara serale con calo progressivo temperatura',
      'Sezione rapida finale ad alta percorrenza'
    ],
    pesoPerformance: { aerodinamica: 0.32, meccanica: 0.30, elettronica: 0.22, powerUnit: 0.16 }
  },
  {
    id: 'abu_dhabi',
    nome: 'Gran Premio di Abu Dhabi',
    circuito: 'Yas Marina Circuit',
    citta: 'Abu Dhabi',
    paese: 'Emirati Arabi Uniti',
    bandiera: '🇦🇪',
    round: 24,
    data: '2026-12-07',
    sprint: false,
    lunghezza: 5281,
    giri: 58,
    curveN: 16,
    caricoAero: 'medio',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.02,
    probabilitaSafetyCar: 0.25,
    probabilitaIncidenti: 0.22,
    temperaturaMin: 28, temperaturaMax: 45,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    caratteristiche: [
      'Ultima gara della stagione — alta tensione',
      'Circuito rinnovato con sezione rapida nel settore 3',
      'Gara al crepuscolo che diventa notturna'
    ],
    pesoPerformance: { aerodinamica: 0.28, meccanica: 0.28, elettronica: 0.24, powerUnit: 0.20 }
  }
];

/* ============================================================
   SQUADRE AR1
   ============================================================ */

const SQUADRE_AR1 = [
  {
    id: 'officine_primato',
    nome: 'Officine Primato',
    nomeBreve: 'Primato',
    colore: '#DC143C',
    paese: 'Italia',
    motoreProprio: true,
    fornitoreMotore: null,
    annoFondazione: 1950,
    budget: 480000000,
    reputazioneTecnica: 9200,
    reputazionePerformance: 9500,
    reputazioneMediatica: 9000,
    reputazioneFinanziaria: 8800,
    /* Statistiche interne macchina (0–100, non visibili al giocatore) */
    macchina: { aerodinamica: 84, meccanica: 82, elettronica: 80, powerUnit: 87 },
    staffBase: {
      capoIngegnere: { nome: 'Roberto Martinelli', statistiche: { coordinamento: 85, strategia: 82, esperienza: 90 } },
      direttoreAero: { nome: 'Giulio Ferretti', statistiche: { innovazione: 88, precisione: 84 } },
      direttoreMeccanica: { nome: 'Marco Bianchi', statistiche: { innovazione: 80, precisione: 86 } },
      direttoreElettronica: { nome: 'Luca Esposito', statistiche: { innovazione: 82, precisione: 80 } },
      direttoreGara: { nome: 'Antonio Ricci', statistiche: { pitStop: 88, strategia: 85, gestioneGomme: 84 } },
      dataAnalyst: { nome: 'Elena Galli', statistiche: { precisione: 86, velocita: 82, sintesi: 85 } }
    }
  },
  {
    id: 'rhein_motorsport',
    nome: 'Rhein Motorsport',
    nomeBreve: 'Rhein',
    colore: '#00D2BE',
    paese: 'Germania',
    motoreProprio: true,
    fornitoreMotore: null,
    annoFondazione: 1954,
    budget: 510000000,
    reputazioneTecnica: 9400,
    reputazionePerformance: 9200,
    reputazioneMediatica: 9300,
    reputazioneFinanziaria: 9500,
    macchina: { aerodinamica: 86, meccanica: 84, elettronica: 88, powerUnit: 84 },
    staffBase: {
      capoIngegnere: { nome: 'Klaus Hoffmann', statistiche: { coordinamento: 90, strategia: 88, esperienza: 92 } },
      direttoreAero: { nome: 'Thomas Weiss', statistiche: { innovazione: 90, precisione: 88 } },
      direttoreMeccanica: { nome: 'Stefan Braun', statistiche: { innovazione: 84, precisione: 88 } },
      direttoreElettronica: { nome: 'Anna Fischer', statistiche: { innovazione: 92, precisione: 88 } },
      direttoreGara: { nome: 'Hans Müller', statistiche: { pitStop: 90, strategia: 88, gestioneGomme: 86 } },
      dataAnalyst: { nome: 'Sophie Richter', statistiche: { precisione: 90, velocita: 86, sintesi: 88 } }
    }
  },
  {
    id: 'vortex_racing',
    nome: 'Vortex Racing',
    nomeBreve: 'Vortex',
    colore: '#1E41FF',
    paese: 'Austria',
    motoreProprio: true,
    fornitoreMotore: null,
    annoFondazione: 2005,
    budget: 490000000,
    reputazioneTecnica: 9500,
    reputazionePerformance: 9600,
    reputazioneMediatica: 8800,
    reputazioneFinanziaria: 9200,
    macchina: { aerodinamica: 90, meccanica: 86, elettronica: 84, powerUnit: 86 },
    staffBase: {
      capoIngegnere: { nome: 'Adrian Bergmann', statistiche: { coordinamento: 92, strategia: 90, esperienza: 94 } },
      direttoreAero: { nome: 'Franz Huber', statistiche: { innovazione: 94, precisione: 90 } },
      direttoreMeccanica: { nome: 'Georg Gruber', statistiche: { innovazione: 86, precisione: 84 } },
      direttoreElettronica: { nome: 'Markus Wagner', statistiche: { innovazione: 84, precisione: 82 } },
      direttoreGara: { nome: 'Josef Maier', statistiche: { pitStop: 92, strategia: 90, gestioneGomme: 88 } },
      dataAnalyst: { nome: 'Christina Koch', statistiche: { precisione: 88, velocita: 84, sintesi: 86 } }
    }
  },
  {
    id: 'meridian_racing',
    nome: 'Meridian Racing',
    nomeBreve: 'Meridian',
    colore: '#FF8700',
    paese: 'Gran Bretagna',
    motoreProprio: false,
    fornitoreMotore: 'Rhein Motorsport',
    annoFondazione: 1966,
    budget: 420000000,
    reputazioneTecnica: 8800,
    reputazionePerformance: 9000,
    reputazioneMediatica: 8600,
    reputazioneFinanziaria: 8400,
    macchina: { aerodinamica: 88, meccanica: 84, elettronica: 82, powerUnit: 84 },
    staffBase: {
      capoIngegnere: { nome: 'James Thornton', statistiche: { coordinamento: 86, strategia: 88, esperienza: 88 } },
      direttoreAero: { nome: 'Peter Hawkins', statistiche: { innovazione: 90, precisione: 86 } },
      direttoreMeccanica: { nome: 'Simon Cole', statistiche: { innovazione: 84, precisione: 82 } },
      direttoreElettronica: { nome: 'Richard Blake', statistiche: { innovazione: 80, precisione: 82 } },
      direttoreGara: { nome: 'Andrew Bell', statistiche: { pitStop: 88, strategia: 86, gestioneGomme: 84 } },
      dataAnalyst: { nome: 'Sarah Mitchell', statistiche: { precisione: 84, velocita: 80, sintesi: 82 } }
    }
  },
  {
    id: 'cavendish_gp',
    nome: 'Cavendish Grand Prix',
    nomeBreve: 'Cavendish',
    colore: '#006F62',
    paese: 'Gran Bretagna',
    motoreProprio: false,
    fornitoreMotore: 'Rhein Motorsport',
    annoFondazione: 2009,
    budget: 380000000,
    reputazioneTecnica: 8000,
    reputazionePerformance: 7800,
    reputazioneMediatica: 7600,
    reputazioneFinanziaria: 8200,
    macchina: { aerodinamica: 78, meccanica: 80, elettronica: 76, powerUnit: 84 },
    staffBase: {
      capoIngegnere: { nome: 'Michael Stone', statistiche: { coordinamento: 80, strategia: 82, esperienza: 84 } },
      direttoreAero: { nome: 'Tom Spencer', statistiche: { innovazione: 80, precisione: 78 } },
      direttoreMeccanica: { nome: 'David Archer', statistiche: { innovazione: 78, precisione: 80 } },
      direttoreElettronica: { nome: 'Claire Hughes', statistiche: { innovazione: 76, precisione: 78 } },
      direttoreGara: { nome: 'Ian Fletcher', statistiche: { pitStop: 80, strategia: 78, gestioneGomme: 76 } },
      dataAnalyst: { nome: 'Laura Davies', statistiche: { precisione: 78, velocita: 76, sintesi: 80 } }
    }
  },
  {
    id: 'mistral_racing',
    nome: 'Mistral Racing',
    nomeBreve: 'Mistral',
    colore: '#0090FF',
    paese: 'Francia',
    motoreProprio: true,
    fornitoreMotore: null,
    annoFondazione: 1977,
    budget: 360000000,
    reputazioneTecnica: 7600,
    reputazionePerformance: 7400,
    reputazioneMediatica: 7800,
    reputazioneFinanziaria: 7200,
    macchina: { aerodinamica: 76, meccanica: 74, elettronica: 76, powerUnit: 78 },
    staffBase: {
      capoIngegnere: { nome: 'Sébastien Blanc', statistiche: { coordinamento: 76, strategia: 78, esperienza: 80 } },
      direttoreAero: { nome: 'Julien Petit', statistiche: { innovazione: 78, precisione: 76 } },
      direttoreMeccanica: { nome: 'Christophe Martin', statistiche: { innovazione: 74, precisione: 76 } },
      direttoreElettronica: { nome: 'François Dupont', statistiche: { innovazione: 76, precisione: 74 } },
      direttoreGara: { nome: 'Nicolas Bernard', statistiche: { pitStop: 76, strategia: 78, gestioneGomme: 74 } },
      dataAnalyst: { nome: 'Amélie Rousseau', statistiche: { precisione: 76, velocita: 74, sintesi: 78 } }
    }
  },
  {
    id: 'tasman_gp',
    nome: 'Tasman Grand Prix',
    nomeBreve: 'Tasman',
    colore: '#005AFF',
    paese: 'Gran Bretagna',
    motoreProprio: false,
    fornitoreMotore: 'Rhein Motorsport',
    annoFondazione: 1958,
    budget: 140000000,
    reputazioneTecnica: 5800,
    reputazionePerformance: 5600,
    reputazioneMediatica: 6000,
    reputazioneFinanziaria: 4800,
    macchina: { aerodinamica: 64, meccanica: 66, elettronica: 60, powerUnit: 84 },
    staffBase: {
      capoIngegnere: { nome: 'Robert Cross', statistiche: { coordinamento: 64, strategia: 66, esperienza: 70 } },
      direttoreAero: { nome: 'Daniel Wright', statistiche: { innovazione: 66, precisione: 64 } },
      direttoreMeccanica: { nome: 'Mark Turner', statistiche: { innovazione: 64, precisione: 66 } },
      direttoreElettronica: { nome: 'Paul Green', statistiche: { innovazione: 60, precisione: 62 } },
      direttoreGara: { nome: 'Alan Webb', statistiche: { pitStop: 68, strategia: 66, gestioneGomme: 64 } },
      dataAnalyst: { nome: 'Helen Price', statistiche: { precisione: 64, velocita: 62, sintesi: 66 } }
    }
  },
  {
    id: 'adriatico_racing',
    nome: 'Adriatico Racing',
    nomeBreve: 'Adriatico',
    colore: '#6692FF',
    paese: 'Italia',
    motoreProprio: false,
    fornitoreMotore: 'Vortex Racing',
    annoFondazione: 2006,
    budget: 160000000,
    reputazioneTecnica: 6200,
    reputazionePerformance: 6000,
    reputazioneMediatica: 6200,
    reputazioneFinanziaria: 5400,
    macchina: { aerodinamica: 70, meccanica: 68, elettronica: 66, powerUnit: 86 },
    staffBase: {
      capoIngegnere: { nome: 'Davide Conti', statistiche: { coordinamento: 70, strategia: 68, esperienza: 72 } },
      direttoreAero: { nome: 'Matteo Russo', statistiche: { innovazione: 70, precisione: 68 } },
      direttoreMeccanica: { nome: 'Andrea Costa', statistiche: { innovazione: 68, precisione: 70 } },
      direttoreElettronica: { nome: 'Simone Moretti', statistiche: { innovazione: 66, precisione: 68 } },
      direttoreGara: { nome: 'Fabio Mancini', statistiche: { pitStop: 72, strategia: 70, gestioneGomme: 68 } },
      dataAnalyst: { nome: 'Valentina Ferraro', statistiche: { precisione: 68, velocita: 66, sintesi: 70 } }
    }
  },
  {
    id: 'frontier_motorsport',
    nome: 'Frontier Motorsport',
    nomeBreve: 'Frontier',
    colore: '#FFFFFF',
    paese: 'USA',
    motoreProprio: false,
    fornitoreMotore: 'Officine Primato',
    annoFondazione: 2016,
    budget: 200000000,
    reputazioneTecnica: 6400,
    reputazionePerformance: 6200,
    reputazioneMediatica: 6400,
    reputazioneFinanziaria: 6000,
    macchina: { aerodinamica: 68, meccanica: 70, elettronica: 66, powerUnit: 87 },
    staffBase: {
      capoIngegnere: { nome: 'Gene Whitfield', statistiche: { coordinamento: 68, strategia: 72, esperienza: 74 } },
      direttoreAero: { nome: 'Chuck Bradley', statistiche: { innovazione: 70, precisione: 68 } },
      direttoreMeccanica: { nome: 'Bill Harmon', statistiche: { innovazione: 68, precisione: 70 } },
      direttoreElettronica: { nome: 'Gary Morton', statistiche: { innovazione: 64, precisione: 66 } },
      direttoreGara: { nome: 'Dave Kimball', statistiche: { pitStop: 74, strategia: 72, gestioneGomme: 68 } },
      dataAnalyst: { nome: 'Susan Ortega', statistiche: { precisione: 70, velocita: 68, sintesi: 72 } }
    }
  },
  {
    id: 'aare_racing',
    nome: 'Aare Racing',
    nomeBreve: 'Aare',
    colore: '#52E252',
    paese: 'Svizzera',
    motoreProprio: false,
    fornitoreMotore: 'Rhein Motorsport',
    annoFondazione: 1970,
    budget: 280000000,
    reputazioneTecnica: 7000,
    reputazionePerformance: 6800,
    reputazioneMediatica: 7000,
    reputazioneFinanziaria: 7200,
    macchina: { aerodinamica: 72, meccanica: 70, elettronica: 74, powerUnit: 84 },
    staffBase: {
      capoIngegnere: { nome: 'Tobias Keller', statistiche: { coordinamento: 74, strategia: 72, esperienza: 78 } },
      direttoreAero: { nome: 'Reto Brunner', statistiche: { innovazione: 74, precisione: 72 } },
      direttoreMeccanica: { nome: 'Urs Zimmermann', statistiche: { innovazione: 70, precisione: 72 } },
      direttoreElettronica: { nome: 'Petra Meier', statistiche: { innovazione: 74, precisione: 72 } },
      direttoreGara: { nome: 'Hans-Peter Frey', statistiche: { pitStop: 76, strategia: 74, gestioneGomme: 72 } },
      dataAnalyst: { nome: 'Claudia Steiner', statistiche: { precisione: 74, velocita: 72, sintesi: 76 } }
    }
  }
];

/* ============================================================
   PILOTI AR1
   ============================================================ */

const PILOTI_AR1 = [
  /* Scuderia Corsa */
  {
    id: 'lacroix', nome: 'Marc Lacroix', eta: 26,
    squadra: 'officine_primato', numero: 16,
    nazionalita: 'Monaco', bandiera: '🇲🇨',
    statistiche: { talento: 90, costanza: 85, qualifica: 92, gara: 88, bagnato: 86, gestione: 84 },
    contratto: { scadenza: 2027, stipendio: 22000000 },
    umore: 80, visibilitaMediatica: 88, valoreSponsor: 90,
    traiettoria: 'stabile',  /* crescita | stabile | declino */
    fedeltà: 50
  },
  {
    id: 'vidal', nome: 'Carlos Vidal', eta: 30,
    squadra: 'officine_primato', numero: 55,
    nazionalita: 'Spagna', bandiera: '🇪🇸',
    statistiche: { talento: 87, costanza: 88, qualifica: 85, gara: 90, bagnato: 84, gestione: 88 },
    contratto: { scadenza: 2026, stipendio: 18000000 },
    umore: 75, visibilitaMediatica: 84, valoreSponsor: 85,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  /* Frecce d'Argento */
  {
    id: 'whitmore', nome: 'James Whitmore', eta: 38,
    squadra: 'rhein_motorsport', numero: 44,
    nazionalita: 'Gran Bretagna', bandiera: '🇬🇧',
    statistiche: { talento: 95, costanza: 92, qualifica: 92, gara: 95, bagnato: 94, gestione: 90 },
    contratto: { scadenza: 2026, stipendio: 48000000 },
    umore: 82, visibilitaMediatica: 98, valoreSponsor: 98,
    traiettoria: 'declino',
    fedeltà: 50
  },
  {
    id: 'rutherford', nome: 'Harry Rutherford', eta: 27,
    squadra: 'rhein_motorsport', numero: 63,
    nazionalita: 'Gran Bretagna', bandiera: '🇬🇧',
    statistiche: { talento: 86, costanza: 84, qualifica: 88, gara: 84, bagnato: 80, gestione: 82 },
    contratto: { scadenza: 2027, stipendio: 14000000 },
    umore: 78, visibilitaMediatica: 80, valoreSponsor: 78,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  /* Toro Celeste */
  {
    id: 'van_den_berg', nome: 'Lars van den Berg', eta: 28,
    squadra: 'vortex_racing', numero: 1,
    nazionalita: 'Olanda', bandiera: '🇳🇱',
    statistiche: { talento: 98, costanza: 95, qualifica: 97, gara: 98, bagnato: 92, gestione: 90 },
    contratto: { scadenza: 2028, stipendio: 55000000 },
    umore: 88, visibilitaMediatica: 96, valoreSponsor: 95,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  {
    id: 'herrera', nome: 'Miguel Herrera', eta: 35,
    squadra: 'vortex_racing', numero: 11,
    nazionalita: 'Messico', bandiera: '🇲🇽',
    statistiche: { talento: 85, costanza: 86, qualifica: 82, gara: 86, bagnato: 78, gestione: 88 },
    contratto: { scadenza: 2026, stipendio: 12000000 },
    umore: 72, visibilitaMediatica: 86, valoreSponsor: 88,
    traiettoria: 'declino',
    fedeltà: 50
  },
  /* Papaya Works */
  {
    id: 'norwood', nome: 'Danny Norwood', eta: 25,
    squadra: 'meridian_racing', numero: 4,
    nazionalita: 'Gran Bretagna', bandiera: '🇬🇧',
    statistiche: { talento: 88, costanza: 82, qualifica: 90, gara: 86, bagnato: 82, gestione: 80 },
    contratto: { scadenza: 2027, stipendio: 16000000 },
    umore: 85, visibilitaMediatica: 82, valoreSponsor: 82,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  {
    id: 'pierson', nome: 'Ryan Pierson', eta: 24,
    squadra: 'meridian_racing', numero: 81,
    nazionalita: 'Australia', bandiera: '🇦🇺',
    statistiche: { talento: 84, costanza: 80, qualifica: 84, gara: 84, bagnato: 78, gestione: 78 },
    contratto: { scadenza: 2027, stipendio: 8000000 },
    umore: 82, visibilitaMediatica: 76, valoreSponsor: 76,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  /* Smeraldo Racing */
  {
    id: 'alcantara', nome: 'Fernando Alcántara', eta: 43,
    squadra: 'cavendish_gp', numero: 14,
    nazionalita: 'Spagna', bandiera: '🇪🇸',
    statistiche: { talento: 90, costanza: 88, qualifica: 86, gara: 92, bagnato: 90, gestione: 94 },
    contratto: { scadenza: 2026, stipendio: 25000000 },
    umore: 76, visibilitaMediatica: 90, valoreSponsor: 88,
    traiettoria: 'declino',
    fedeltà: 50
  },
  {
    id: 'stanhope', nome: 'Brett Stanhope', eta: 26,
    squadra: 'cavendish_gp', numero: 18,
    nazionalita: 'Canada', bandiera: '🇨🇦',
    statistiche: { talento: 72, costanza: 70, qualifica: 70, gara: 72, bagnato: 66, gestione: 68 },
    contratto: { scadenza: 2027, stipendio: 4000000 },
    umore: 65, visibilitaMediatica: 62, valoreSponsor: 75,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  /* Étoile Bleue */
  {
    id: 'garnier', nome: 'Pierre Garnier', eta: 29,
    squadra: 'mistral_racing', numero: 10,
    nazionalita: 'Francia', bandiera: '🇫🇷',
    statistiche: { talento: 82, costanza: 78, qualifica: 84, gara: 80, bagnato: 80, gestione: 76 },
    contratto: { scadenza: 2027, stipendio: 9000000 },
    umore: 74, visibilitaMediatica: 74, valoreSponsor: 72,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  {
    id: 'aumont', nome: 'Étienne Aumont', eta: 25,
    squadra: 'mistral_racing', numero: 31,
    nazionalita: 'Francia', bandiera: '🇫🇷',
    statistiche: { talento: 78, costanza: 74, qualifica: 80, gara: 76, bagnato: 72, gestione: 72 },
    contratto: { scadenza: 2026, stipendio: 5000000 },
    umore: 70, visibilitaMediatica: 68, valoreSponsor: 66,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  /* Albion Grand Prix */
  {
    id: 'thaicharoen', nome: 'Alex Thaicharoen', eta: 29,
    squadra: 'tasman_gp', numero: 23,
    nazionalita: 'Thailandia', bandiera: '🇹🇭',
    statistiche: { talento: 80, costanza: 78, qualifica: 78, gara: 80, bagnato: 76, gestione: 78 },
    contratto: { scadenza: 2027, stipendio: 7000000 },
    umore: 72, visibilitaMediatica: 72, valoreSponsor: 70,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  {
    id: 'garrett', nome: 'Tyler Garrett', eta: 23,
    squadra: 'tasman_gp', numero: 2,
    nazionalita: 'USA', bandiera: '🇺🇸',
    statistiche: { talento: 66, costanza: 62, qualifica: 64, gara: 66, bagnato: 58, gestione: 62 },
    contratto: { scadenza: 2026, stipendio: 2500000 },
    umore: 60, visibilitaMediatica: 58, valoreSponsor: 60,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  /* Toro Giovane */
  {
    id: 'nakamura', nome: 'Kenji Nakamura', eta: 21,
    squadra: 'adriatico_racing', numero: 22,
    nazionalita: 'Giappone', bandiera: '🇯🇵',
    statistiche: { talento: 78, costanza: 70, qualifica: 80, gara: 74, bagnato: 70, gestione: 68 },
    contratto: { scadenza: 2027, stipendio: 3000000 },
    umore: 80, visibilitaMediatica: 68, valoreSponsor: 72,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  {
    id: 'caldwell', nome: 'Liam Caldwell', eta: 22,
    squadra: 'adriatico_racing', numero: 30,
    nazionalita: 'Nuova Zelanda', bandiera: '🇳🇿',
    statistiche: { talento: 74, costanza: 68, qualifica: 76, gara: 72, bagnato: 68, gestione: 66 },
    contratto: { scadenza: 2026, stipendio: 2000000 },
    umore: 78, visibilitaMediatica: 62, valoreSponsor: 60,
    traiettoria: 'crescita',
    fedeltà: 50
  },
  /* Stelle Americane */
  {
    id: 'hillmann', nome: 'Klaus Hillmann', eta: 37,
    squadra: 'frontier_motorsport', numero: 27,
    nazionalita: 'Germania', bandiera: '🇩🇪',
    statistiche: { talento: 80, costanza: 82, qualifica: 76, gara: 82, bagnato: 74, gestione: 82 },
    contratto: { scadenza: 2026, stipendio: 8000000 },
    umore: 72, visibilitaMediatica: 70, valoreSponsor: 68,
    traiettoria: 'declino',
    fedeltà: 50
  },
  {
    id: 'madsen', nome: 'Erik Madsen', eta: 32,
    squadra: 'frontier_motorsport', numero: 20,
    nazionalita: 'Danimarca', bandiera: '🇩🇰',
    statistiche: { talento: 76, costanza: 74, qualifica: 74, gara: 76, bagnato: 72, gestione: 76 },
    contratto: { scadenza: 2027, stipendio: 5500000 },
    umore: 68, visibilitaMediatica: 65, valoreSponsor: 62,
    traiettoria: 'stabile',
    fedeltà: 50
  },
  /* Orso Bianco */
  {
    id: 'leinonen', nome: 'Mikko Leinonen', eta: 35,
    squadra: 'aare_racing', numero: 77,
    nazionalita: 'Finlandia', bandiera: '🇫🇮',
    statistiche: { talento: 82, costanza: 84, qualifica: 78, gara: 84, bagnato: 82, gestione: 86 },
    contratto: { scadenza: 2026, stipendio: 7000000 },
    umore: 70, visibilitaMediatica: 68, valoreSponsor: 65,
    traiettoria: 'declino',
    fedeltà: 50
  },
  {
    id: 'chen', nome: 'Chen Guangwei', eta: 27,
    squadra: 'aare_racing', numero: 24,
    nazionalita: 'Cina', bandiera: '🇨🇳',
    statistiche: { talento: 72, costanza: 70, qualifica: 72, gara: 70, bagnato: 66, gestione: 72 },
    contratto: { scadenza: 2027, stipendio: 4500000 },
    umore: 66, visibilitaMediatica: 70, valoreSponsor: 74,
    traiettoria: 'stabile',
    fedeltà: 50
  }
];

/* ============================================================
   PILOTA DI RISERVA AR1 — uno per ogni squadra
   ============================================================ */
const PILOTI_RISERVA_AR1 = [
  { id: 'riserva_primato',   nome: 'Luca Sabatini',     eta: 22, squadra: 'officine_primato',   nazionalita: 'Italia',        bandiera: '🇮🇹', statistiche: { talento: 72, costanza: 68, qualifica: 74, gara: 70, bagnato: 66, gestione: 65 }, contratto: { scadenza: 2027, stipendio: 800000 },  umore: 75, fedeltà: 60, dallaAcademy: true  },
  { id: 'riserva_rhein',     nome: 'Pascal Hartmann',   eta: 23, squadra: 'rhein_motorsport',   nazionalita: 'Germania',      bandiera: '🇩🇪', statistiche: { talento: 74, costanza: 70, qualifica: 72, gara: 72, bagnato: 68, gestione: 67 }, contratto: { scadenza: 2027, stipendio: 900000 },  umore: 72, fedeltà: 55, dallaAcademy: true  },
  { id: 'riserva_vortex',    nome: 'Finn Haugen',       eta: 21, squadra: 'vortex_racing',      nazionalita: 'Norvegia',      bandiera: '🇳🇴', statistiche: { talento: 76, costanza: 72, qualifica: 76, gara: 74, bagnato: 70, gestione: 68 }, contratto: { scadenza: 2027, stipendio: 1000000 }, umore: 80, fedeltà: 65, dallaAcademy: true  },
  { id: 'riserva_meridian',  nome: 'Oliver Prescott',   eta: 22, squadra: 'meridian_racing',   nazionalita: 'Gran Bretagna', bandiera: '🇬🇧', statistiche: { talento: 70, costanza: 66, qualifica: 70, gara: 68, bagnato: 64, gestione: 63 }, contratto: { scadenza: 2027, stipendio: 750000 },  umore: 70, fedeltà: 50, dallaAcademy: false },
  { id: 'riserva_cavendish', nome: 'Ryan Fogarty',      eta: 24, squadra: 'cavendish_gp',      nazionalita: 'Irlanda',       bandiera: '🇮🇪', statistiche: { talento: 68, costanza: 64, qualifica: 68, gara: 66, bagnato: 62, gestione: 62 }, contratto: { scadenza: 2026, stipendio: 700000 },  umore: 65, fedeltà: 45, dallaAcademy: false },
  { id: 'riserva_mistral',   nome: 'Hugo Lefèvre',      eta: 21, squadra: 'mistral_racing',    nazionalita: 'Francia',       bandiera: '🇫🇷', statistiche: { talento: 70, costanza: 67, qualifica: 71, gara: 69, bagnato: 65, gestione: 64 }, contratto: { scadenza: 2027, stipendio: 750000 },  umore: 72, fedeltà: 58, dallaAcademy: true  },
  { id: 'riserva_tasman',    nome: 'Marco Lindgren',    eta: 23, squadra: 'tasman_gp',         nazionalita: 'Svezia',        bandiera: '🇸🇪', statistiche: { talento: 66, costanza: 63, qualifica: 66, gara: 65, bagnato: 60, gestione: 61 }, contratto: { scadenza: 2027, stipendio: 650000 },  umore: 68, fedeltà: 42, dallaAcademy: false },
  { id: 'riserva_adriatico', nome: 'Yuto Maruyama',     eta: 22, squadra: 'adriatico_racing',   nazionalita: 'Giappone',      bandiera: '🇯🇵', statistiche: { talento: 74, costanza: 68, qualifica: 73, gara: 71, bagnato: 69, gestione: 66 }, contratto: { scadenza: 2027, stipendio: 850000 },  umore: 74, fedeltà: 60, dallaAcademy: true  },
  { id: 'riserva_frontier',  nome: 'Matías Soria',      eta: 23, squadra: 'frontier_motorsport', nazionalita: 'Argentina',     bandiera: '🇦🇷', statistiche: { talento: 68, costanza: 65, qualifica: 68, gara: 66, bagnato: 63, gestione: 62 }, contratto: { scadenza: 2026, stipendio: 700000 },  umore: 66, fedeltà: 44, dallaAcademy: false },
  { id: 'riserva_aare',      nome: 'Jan Sutter',        eta: 21, squadra: 'aare_racing',        nazionalita: 'Svizzera',      bandiera: '🇨🇭', statistiche: { talento: 72, costanza: 66, qualifica: 72, gara: 70, bagnato: 67, gestione: 65 }, contratto: { scadenza: 2027, stipendio: 780000 },  umore: 71, fedeltà: 52, dallaAcademy: true  }
];

/* ============================================================
   ACADEMY AR1 — giovani talenti in sviluppo (2-3 per squadra top)
   ============================================================ */
const TALENTI_ACADEMY_AR1 = [
  { id: 'ac_sabatini2',  nome: 'Nicolò Abate',       eta: 18, squadra: 'officine_primato',  nazionalita: 'Italia',      bandiera: '🇮🇹', potenziale: 82, livelloCorrente: 58, stagioneSviluppo: 1, categoriaAttuale: 'AR3', fedeltà: 80 },
  { id: 'ac_rhein1',     nome: 'Max Bremer',          eta: 19, squadra: 'rhein_motorsport',  nazionalita: 'Germania',    bandiera: '🇩🇪', potenziale: 85, livelloCorrente: 65, stagioneSviluppo: 2, categoriaAttuale: 'AR2', fedeltà: 85 },
  { id: 'ac_vortex1',    nome: 'Sander Olsen',        eta: 18, squadra: 'vortex_racing',     nazionalita: 'Danimarca',   bandiera: '🇩🇰', potenziale: 88, livelloCorrente: 62, stagioneSviluppo: 1, categoriaAttuale: 'AR3', fedeltà: 82 },
  { id: 'ac_meridian1',  nome: 'Connor Walsh',        eta: 20, squadra: 'meridian_racing',  nazionalita: 'Irlanda',     bandiera: '🇮🇪', potenziale: 80, livelloCorrente: 68, stagioneSviluppo: 3, categoriaAttuale: 'AR2', fedeltà: 75 },
  { id: 'ac_mistral1',   nome: 'Théo Bonnet',         eta: 19, squadra: 'mistral_racing',   nazionalita: 'Francia',     bandiera: '🇫🇷', potenziale: 78, livelloCorrente: 60, stagioneSviluppo: 2, categoriaAttuale: 'AR3', fedeltà: 72 },
  { id: 'ac_aare1',      nome: 'Yannick Vogt',        eta: 18, squadra: 'aare_racing',       nazionalita: 'Svizzera',    bandiera: '🇨🇭', potenziale: 76, livelloCorrente: 55, stagioneSviluppo: 1, categoriaAttuale: 'AR3', fedeltà: 70 }
];

/* ============================================================
   SQUADRE AR2
   ============================================================ */

const SQUADRE_AR2 = [
  { id: 'pronto_ar2', nome: 'Pronto Racing', nomeBreve: 'Pronto', colore: '#FF0000' },
  { id: 'delta_ar2', nome: 'Delta Racing', nomeBreve: 'Delta', colore: '#002FA7' },
  { id: 'technica_ar2', nome: 'Technica GP', nomeBreve: 'Technica', colore: '#FFFF00' },
  { id: 'arte_ar2', nome: 'Arte Grand Prix', nomeBreve: 'Arte', colore: '#FFFFFF' },
  { id: 'metro_ar2', nome: 'Metro Motorsport', nomeBreve: 'Metro', colore: '#FF6600' },
  { id: 'campo_ar2', nome: 'Campo Racing', nomeBreve: 'Campo', colore: '#0000FF' },
  { id: 'tridente_ar2', nome: 'Tridente Motorsport', nomeBreve: 'Tridente', colore: '#FF2200' },
  { id: 'fiandre_ar2', nome: 'Fiandre Racing', nomeBreve: 'Fiandre', colore: '#FFD700' }
];

/* ============================================================
   PILOTI AR2 (generati con lo stesso stile di nomenclatura)
   ============================================================ */

const PILOTI_AR2 = [
  { id: 'ar2_01', nome: 'Romain Leconte',      eta: 20, nazionalita: 'Francia',       bandiera: '🇫🇷', squadra: 'pronto_ar2',   statistiche: { talento: 78, costanza: 72, qualifica: 80, gara: 76 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_02', nome: 'Sebastiaan van Dijk',  eta: 21, nazionalita: 'Olanda',        bandiera: '🇳🇱', squadra: 'pronto_ar2',   statistiche: { talento: 76, costanza: 74, qualifica: 76, gara: 76 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_03', nome: 'Oliver Pemberton',     eta: 19, nazionalita: 'Gran Bretagna', bandiera: '🇬🇧', squadra: 'delta_ar2',    statistiche: { talento: 80, costanza: 70, qualifica: 82, gara: 76 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_04', nome: 'Rafael Sousa',         eta: 22, nazionalita: 'Brasile',       bandiera: '🇧🇷', squadra: 'delta_ar2',    statistiche: { talento: 74, costanza: 76, qualifica: 72, gara: 76 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_05', nome: 'Takuya Shimizu',       eta: 20, nazionalita: 'Giappone',      bandiera: '🇯🇵', squadra: 'technica_ar2', statistiche: { talento: 76, costanza: 72, qualifica: 78, gara: 74 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_06', nome: 'Lukas Brenner',        eta: 21, nazionalita: 'Germania',      bandiera: '🇩🇪', squadra: 'technica_ar2', statistiche: { talento: 72, costanza: 74, qualifica: 70, gara: 74 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_07', nome: 'Antoine Mercier',      eta: 23, nazionalita: 'Francia',       bandiera: '🇫🇷', squadra: 'arte_ar2',     statistiche: { talento: 70, costanza: 72, qualifica: 70, gara: 72 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_08', nome: 'Connor Walsh',         eta: 20, nazionalita: 'Irlanda',       bandiera: '🇮🇪', squadra: 'arte_ar2',     statistiche: { talento: 74, costanza: 68, qualifica: 76, gara: 70 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_09', nome: 'Alejandro Fuentes',    eta: 22, nazionalita: 'Spagna',        bandiera: '🇪🇸', squadra: 'metro_ar2',    statistiche: { talento: 72, costanza: 70, qualifica: 72, gara: 72 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_10', nome: 'William Hartley',      eta: 19, nazionalita: 'Nuova Zelanda', bandiera: '🇳🇿', squadra: 'metro_ar2',    statistiche: { talento: 76, costanza: 66, qualifica: 78, gara: 72 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_11', nome: 'Diego Guerrero',       eta: 21, nazionalita: 'Messico',       bandiera: '🇲🇽', squadra: 'campo_ar2',    statistiche: { talento: 70, costanza: 68, qualifica: 68, gara: 70 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_12', nome: 'Mikael Saarinen',      eta: 22, nazionalita: 'Finlandia',     bandiera: '🇫🇮', squadra: 'campo_ar2',    statistiche: { talento: 68, costanza: 72, qualifica: 66, gara: 70 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_13', nome: 'Lorenzo Ferri',        eta: 20, nazionalita: 'Italia',        bandiera: '🇮🇹', squadra: 'tridente_ar2', statistiche: { talento: 74, costanza: 68, qualifica: 74, gara: 72 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar2_14', nome: 'Nils Andersen',        eta: 21, nazionalita: 'Danimarca',     bandiera: '🇩🇰', squadra: 'tridente_ar2', statistiche: { talento: 70, costanza: 70, qualifica: 68, gara: 70 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_15', nome: 'Pieter Vermeersch',    eta: 23, nazionalita: 'Belgio',        bandiera: '🇧🇪', squadra: 'fiandre_ar2',  statistiche: { talento: 68, costanza: 72, qualifica: 66, gara: 70 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar2_16', nome: 'Arjun Mehta',          eta: 22, nazionalita: 'India',         bandiera: '🇮🇳', squadra: 'fiandre_ar2',  statistiche: { talento: 66, costanza: 68, qualifica: 66, gara: 66 }, traiettoria: 'stabile',  fedeltà: 50 }
];

/* ============================================================
   SQUADRE AR3
   ============================================================ */

const SQUADRE_AR3 = [
  { id: 'pronto_ar3',   nome: 'Pronto Racing AR3',       nomeBreve: 'Pronto',   colore: '#FF0000' },
  { id: 'technica_ar3', nome: 'Technica AR3',             nomeBreve: 'Technica', colore: '#FFFF00' },
  { id: 'arte_ar3',     nome: 'Arte Grand Prix AR3',      nomeBreve: 'Arte',     colore: '#FFFFFF' },
  { id: 'tridente_ar3', nome: 'Tridente AR3',             nomeBreve: 'Tridente', colore: '#FF2200' },
  { id: 'campo_ar3',    nome: 'Campo Racing AR3',         nomeBreve: 'Campo',    colore: '#0000FF' },
  { id: 'fiandre_ar3',  nome: 'Fiandre Racing AR3',       nomeBreve: 'Fiandre',  colore: '#FFD700' }
];

/* ============================================================
   PILOTI AR3
   ============================================================ */

const PILOTI_AR3 = [
  { id: 'ar3_01', nome: 'Victor Pellegrini', eta: 18, nazionalita: 'Italia',        bandiera: '🇮🇹', squadra: 'pronto_ar3',   statistiche: { talento: 72, costanza: 64, qualifica: 74, gara: 70 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_02', nome: 'Noah Schumacher',   eta: 17, nazionalita: 'Germania',      bandiera: '🇩🇪', squadra: 'pronto_ar3',   statistiche: { talento: 70, costanza: 62, qualifica: 72, gara: 68 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_03', nome: 'James Cooper',      eta: 19, nazionalita: 'Gran Bretagna', bandiera: '🇬🇧', squadra: 'technica_ar3', statistiche: { talento: 68, costanza: 66, qualifica: 68, gara: 68 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar3_04', nome: 'Emilio Vásquez',    eta: 18, nazionalita: 'Argentina',     bandiera: '🇦🇷', squadra: 'technica_ar3', statistiche: { talento: 66, costanza: 64, qualifica: 66, gara: 66 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_05', nome: 'Finn Larsson',      eta: 17, nazionalita: 'Svezia',        bandiera: '🇸🇪', squadra: 'arte_ar3',     statistiche: { talento: 70, costanza: 60, qualifica: 72, gara: 66 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_06', nome: 'Kofi Mensah',       eta: 19, nazionalita: 'Ghana',         bandiera: '🇬🇭', squadra: 'arte_ar3',     statistiche: { talento: 64, costanza: 62, qualifica: 62, gara: 64 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_07', nome: 'Tomás Cardoso',     eta: 18, nazionalita: 'Portogallo',    bandiera: '🇵🇹', squadra: 'tridente_ar3', statistiche: { talento: 66, costanza: 64, qualifica: 64, gara: 66 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar3_08', nome: 'Hiroshi Yamamoto',  eta: 17, nazionalita: 'Giappone',      bandiera: '🇯🇵', squadra: 'tridente_ar3', statistiche: { talento: 68, costanza: 60, qualifica: 70, gara: 64 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_09', nome: 'Max Berglund',      eta: 19, nazionalita: 'Norvegia',      bandiera: '🇳🇴', squadra: 'campo_ar3',    statistiche: { talento: 62, costanza: 64, qualifica: 60, gara: 64 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar3_10', nome: 'Dario Conti',       eta: 18, nazionalita: 'Svizzera',      bandiera: '🇨🇭', squadra: 'campo_ar3',    statistiche: { talento: 60, costanza: 62, qualifica: 58, gara: 62 }, traiettoria: 'stabile',  fedeltà: 50 },
  { id: 'ar3_11', nome: 'Baptiste Renaud',   eta: 17, nazionalita: 'Francia',       bandiera: '🇫🇷', squadra: 'fiandre_ar3',  statistiche: { talento: 66, costanza: 60, qualifica: 66, gara: 64 }, traiettoria: 'crescita', fedeltà: 50 },
  { id: 'ar3_12', nome: 'Sven Hoekstra',     eta: 19, nazionalita: 'Olanda',        bandiera: '🇳🇱', squadra: 'fiandre_ar3',  statistiche: { talento: 64, costanza: 62, qualifica: 64, gara: 62 }, traiettoria: 'stabile',  fedeltà: 50 }
];

/* ============================================================
   STAFF BASE — AR2
   Ogni squadra: capoIngegnere, ingegnereGara, preparatoreAtletico
   ============================================================ */

const STAFF_AR2 = {
  pronto_ar2: {
    capoIngegnere:      { nome: 'Étienne Moreau',   statistiche: { coordinamento: 74, esperienza: 72 } },
    ingegnereGara:      { nome: 'Stefan Weidmann',  statistiche: { strategia: 72, reattivita: 70 } },
    preparatoreAtletico:{ nome: 'Carlos Pinto',     statistiche: { fitness: 68 } }
  },
  delta_ar2: {
    capoIngegnere:      { nome: 'Andrew Robson',    statistiche: { coordinamento: 76, esperienza: 74 } },
    ingegnereGara:      { nome: 'Marco Vitali',     statistiche: { strategia: 74, reattivita: 72 } },
    preparatoreAtletico:{ nome: 'Kenji Watanabe',   statistiche: { fitness: 70 } }
  },
  technica_ar2: {
    capoIngegnere:      { nome: 'Lars Svensson',    statistiche: { coordinamento: 72, esperienza: 70 } },
    ingegnereGara:      { nome: 'Fabio Esposito',   statistiche: { strategia: 70, reattivita: 74 } },
    preparatoreAtletico:{ nome: 'David Clarke',     statistiche: { fitness: 66 } }
  },
  arte_ar2: {
    capoIngegnere:      { nome: 'Jürgen Braun',     statistiche: { coordinamento: 70, esperienza: 72 } },
    ingegnereGara:      { nome: 'Nicolas Laurent',  statistiche: { strategia: 68, reattivita: 70 } },
    preparatoreAtletico:{ nome: 'Antonio Silva',    statistiche: { fitness: 64 } }
  },
  metro_ar2: {
    capoIngegnere:      { nome: 'Patrick O\'Neill', statistiche: { coordinamento: 74, esperienza: 68 } },
    ingegnereGara:      { nome: 'Renzo Bianchi',    statistiche: { strategia: 72, reattivita: 68 } },
    preparatoreAtletico:{ nome: 'Hans Mueller',     statistiche: { fitness: 66 } }
  },
  campo_ar2: {
    capoIngegnere:      { nome: 'Ivan Novak',       statistiche: { coordinamento: 68, esperienza: 70 } },
    ingegnereGara:      { nome: 'Paul Hartmann',    statistiche: { strategia: 66, reattivita: 68 } },
    preparatoreAtletico:{ nome: 'Marco Russo',      statistiche: { fitness: 62 } }
  },
  tridente_ar2: {
    capoIngegnere:      { nome: 'Giovanni Ferrara', statistiche: { coordinamento: 72, esperienza: 74 } },
    ingegnereGara:      { nome: 'Lukas Fischer',    statistiche: { strategia: 70, reattivita: 72 } },
    preparatoreAtletico:{ nome: 'Pierre Dubois',    statistiche: { fitness: 68 } }
  },
  fiandre_ar2: {
    capoIngegnere:      { nome: 'Pieter De Smet',   statistiche: { coordinamento: 70, esperienza: 68 } },
    ingegnereGara:      { nome: 'Thomas Berger',    statistiche: { strategia: 68, reattivita: 66 } },
    preparatoreAtletico:{ nome: 'Sam Williams',     statistiche: { fitness: 64 } }
  }
};

/* ============================================================
   STAFF BASE — AR3
   Ogni squadra: capoIngegnere, ingegnereGara, preparatoreAtletico
   ============================================================ */

const STAFF_AR3 = {
  pronto_ar3: {
    capoIngegnere:      { nome: 'Michel Dupont',    statistiche: { coordinamento: 68, esperienza: 66 } },
    ingegnereGara:      { nome: 'James Fletcher',   statistiche: { strategia: 66, reattivita: 64 } },
    preparatoreAtletico:{ nome: 'Riccardo Conti',   statistiche: { fitness: 60 } }
  },
  technica_ar3: {
    capoIngegnere:      { nome: 'Heinrich Wolf',    statistiche: { coordinamento: 66, esperienza: 64 } },
    ingegnereGara:      { nome: 'Luca Ferretti',    statistiche: { strategia: 64, reattivita: 66 } },
    preparatoreAtletico:{ nome: 'Álvaro Ruiz',      statistiche: { fitness: 58 } }
  },
  arte_ar3: {
    capoIngegnere:      { nome: 'François Martin',  statistiche: { coordinamento: 70, esperienza: 66 } },
    ingegnereGara:      { nome: 'Ben Ashworth',     statistiche: { strategia: 66, reattivita: 62 } },
    preparatoreAtletico:{ nome: 'Tomás Pereira',    statistiche: { fitness: 60 } }
  },
  tridente_ar3: {
    capoIngegnere:      { nome: 'Roberto Greco',    statistiche: { coordinamento: 64, esperienza: 66 } },
    ingegnereGara:      { nome: 'Sven Larsen',      statistiche: { strategia: 62, reattivita: 64 } },
    preparatoreAtletico:{ nome: 'Chris Harper',     statistiche: { fitness: 58 } }
  },
  campo_ar3: {
    capoIngegnere:      { nome: 'Erik Johansen',    statistiche: { coordinamento: 62, esperienza: 64 } },
    ingegnereGara:      { nome: 'Marco Gentile',    statistiche: { strategia: 60, reattivita: 62 } },
    preparatoreAtletico:{ nome: 'Nils Berg',        statistiche: { fitness: 56 } }
  },
  fiandre_ar3: {
    capoIngegnere:      { nome: 'Dirk Claes',       statistiche: { coordinamento: 66, esperienza: 62 } },
    ingegnereGara:      { nome: 'Anthony Walsh',    statistiche: { strategia: 64, reattivita: 60 } },
    preparatoreAtletico:{ nome: 'Jan Kowalski',     statistiche: { fitness: 58 } }
  }
};

/* ============================================================
   CALENDARIO AR2 (stagione 2026 — circuiti condivisi con AR1)
   La AR2 corre in supporto all'AR1 — stessa lista, round selezionati
   ============================================================ */

const ROUND_AR2 = [
  'bahrain', 'arabia_saudita', 'miami', 'emilia_romagna', 'monaco',
  'spagna', 'austria', 'gran_bretagna', 'ungheria', 'italia',
  'singapore', 'usa', 'messico', 'brasile', 'abu_dhabi'
];

/* ============================================================
   CALENDARIO AR3 (stagione 2026 — subset circuiti AR1)
   ============================================================ */

const ROUND_AR3 = [
  'bahrain', 'australia', 'emilia_romagna', 'monaco',
  'spagna', 'gran_bretagna', 'belgio', 'olanda',
  'italia', 'singapore', 'usa', 'abu_dhabi'
];

/* ============================================================
   CONFIGURAZIONE ERA REGOLAMENTARE INIZIALE
   ============================================================ */

const ERA_REGOLAMENTARE_INIZIALE = {
  id: 'era_2026',
  nome: 'Era Tecnica 2026',
  inizioStagione: 2026,
  durataPrevista: 4,
  pesoAerodinamica: 0.35,
  pesoMeccanica: 0.28,
  pesoElettronica: 0.22,
  pesoPowerUnit: 0.15,
  budgetCapAR1: 135000000,
  limiteTokenMotore: 3,
  limiteOreCFD: {
    /* Ore di tunnel del vento disponibili inversamente proporzionali alla classifica */
    primoClassificato: 25,
    secondoClassificato: 35,
    terzoClassificato: 48,
    quartoClassificato: 62,
    quintoClassificato: 75,
    sestoClassificato: 85,
    settimoClassificato: 95,
    ottavoClassificato: 104,
    nonoClassificato: 112,
    decimoClassificato: 120
  }
};

/* ============================================================
   TABELLA PREMI AR1 (prize money in base alla classifica costruttori)
   Valori in milioni di euro
   ============================================================ */

const PRIZE_MONEY_AR1 = {
  1: 180, 2: 160, 3: 140, 4: 120, 5: 100,
  6: 80,  7: 65,  8: 52,  9: 42,  10: 34
};

/* ============================================================
   EROGAZIONI SPECIALI FEDERAZIONE (bonus storici per squadre fondatrici)
   ============================================================ */

const BONUS_STORICI = {
  officine_primato: 35000000,
  rhein_motorsport: 32000000,
  vortex_racing: 25000000,
  meridian_racing: 28000000,
  tasman_gp: 22000000
};

/* ============================================================
   PUNTI CAMPIONATO
   ============================================================ */

const PUNTI_GARA = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0];
const PUNTI_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const PUNTI_GIRO_VELOCE = 1; /* Solo se pilota nella top 10 */

/* ============================================================
   CIRCUITI FISSI — mai toccati dalla rotazione stagionale
   ============================================================ */

const CIRCUITI_FISSI = new Set([
  'australia',      /* Melbourne */
  'bahrain',        /* Sakhir */
  'monaco',         /* Monte Carlo */
  'canada',         /* Montreal */
  'gran_bretagna',  /* Silverstone */
  'belgio',         /* Spa-Francorchamps */
  'ungheria',       /* Hungaroring */
  'olanda',         /* Zandvoort */
  'italia',         /* Monza */
  'azerbaigian',    /* Baku */
  'giappone',       /* Suzuka */
  'brasile',        /* Interlagos */
  'abu_dhabi'       /* Yas Marina */
]);

/* ============================================================
   CIRCUITI STORICI — fuori calendario, eleggibili per rientro
   Requisito: almeno 5 Gran Premi ospitati nella storia dell'AR1
   ============================================================ */

const CIRCUITI_STORICI = [
  {
    id: 'estoril',
    nome: 'Gran Premio del Portogallo',
    circuito: 'Autodromo do Estoril',
    citta: 'Estoril',
    paese: 'Portogallo',
    bandiera: '🇵🇹',
    sprint: false,
    lunghezza: 4350,
    giri: 71,
    curveN: 13,
    caricoAero: 'medio_alto',
    usuraGomme: 'media',
    probabilitaPioggia: 0.20,
    probabilitaSafetyCar: 0.30,
    probabilitaIncidenti: 0.28,
    temperaturaMin: 22, temperaturaMax: 40,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    mesePreferito: 4, /* Aprile — posizione storica in calendario */
    caratteristiche: [
      'Ultima curva cieca ad alta velocità',
      'Sezione collinare tecnica nel settore centrale',
      'Rettilineo principale lungo con zona di sorpasso'
    ],
    pesoPerformance: { aerodinamica: 0.35, meccanica: 0.30, elettronica: 0.20, powerUnit: 0.15 },
    storicoGP: 13 /* Gran Premi ospitati: 1984–1996 */
  },
  {
    id: 'jerez',
    nome: 'Gran Premio d\'Europa',
    circuito: 'Circuito de Jerez',
    citta: 'Jerez de la Frontera',
    paese: 'Spagna',
    bandiera: '🇪🇸',
    sprint: false,
    lunghezza: 4428,
    giri: 69,
    curveN: 13,
    caricoAero: 'alto',
    usuraGomme: 'alta',
    probabilitaPioggia: 0.10,
    probabilitaSafetyCar: 0.25,
    probabilitaIncidenti: 0.22,
    temperaturaMin: 28, temperaturaMax: 50,
    mescole: ['C2', 'C3', 'C4'],
    altitudine: 0,
    mesePreferito: 5, /* Maggio */
    caratteristiche: [
      'Curva Expo ad alta percorrenza nel settore finale',
      'Alta temperatura pista con degrado gomme pronunciato',
      'Circuito tecnico che premia bilanciamento aerodinamico'
    ],
    pesoPerformance: { aerodinamica: 0.40, meccanica: 0.30, elettronica: 0.18, powerUnit: 0.12 },
    storicoGP: 6 /* 1986, 1988, 1990, 1994, 1997 + edizioni europee */
  },
  {
    id: 'hockenheim',
    nome: 'Gran Premio di Germania',
    circuito: 'Hockenheimring Baden-Württemberg',
    citta: 'Hockenheim',
    paese: 'Germania',
    bandiera: '🇩🇪',
    sprint: false,
    lunghezza: 4574,
    giri: 67,
    curveN: 17,
    caricoAero: 'basso',
    usuraGomme: 'bassa',
    probabilitaPioggia: 0.35,
    probabilitaSafetyCar: 0.35,
    probabilitaIncidenti: 0.30,
    temperaturaMin: 22, temperaturaMax: 42,
    mescole: ['C3', 'C4', 'C5'],
    altitudine: 0,
    mesePreferito: 7, /* Luglio — storica finestra estiva tedesca */
    caratteristiche: [
      'Lungo rettilineo principale che premia la potenza del motore',
      'Stadtstadion hairpin lento al fondo del rettilineo',
      'Sezione finale tecnica con sequenza di curve ravvicinate'
    ],
    pesoPerformance: { aerodinamica: 0.18, meccanica: 0.22, elettronica: 0.22, powerUnit: 0.38 },
    storicoGP: 35 /* 1970–2019, alternando con Nürburgring */
  }
];

/* ============================================================
   MOTIVAZIONI NARRATIVE — rotazione calendario
   Usate dalla Federazione per annunciare i cambiamenti
   ============================================================ */

const MOTIVAZIONI_USCITA_CALENDARIO = [
  'Il contratto pluriennale con il promotore locale è scaduto. Le trattative per il rinnovo non hanno prodotto un accordo.',
  'La Federazione ha deciso di non rinnovare l\'accordo commerciale per ragioni di bilanciamento geografico del calendario.',
  'Il circuito è oggetto di lavori di ammodernamento che renderanno l\'impianto non disponibile per almeno una stagione.',
  'Ragioni di sicurezza legate all\'omologazione hanno portato la Federazione a sospendere temporaneamente l\'appuntamento.',
  'La mancanza di accordo sul prize money con le autorità locali ha portato alla sospensione del Gran Premio.',
  'Il promotore ha rinunciato alla licenza per difficoltà organizzative. La Federazione valuterà il rientro nelle stagioni successive.'
];

const MOTIVAZIONI_ENTRATA_CALENDARIO = [
  'La Federazione ha siglato un nuovo accordo commerciale pluriennale con il promotore locale.',
  'I lavori di ammodernamento del circuito sono stati completati. L\'impianto ha ottenuto la nuova omologazione FIA.',
  'Dopo un periodo di assenza, il Gran Premio torna in calendario grazie a un accordo di lungo termine.',
  'La Federazione ha accolto la candidatura del promotore locale, che garantisce standard organizzativi e di sicurezza elevati.',
  'Un nuovo investimento infrastrutturale ha permesso al circuito di soddisfare tutti i requisiti per l\'omologazione.',
  'Il sostegno delle autorità locali ha reso possibile un accordo che riporta questo appuntamento storico in calendario.'
];

/* ============================================================
   TESTI E MESSAGGI DI SISTEMA
   ============================================================ */

const MESSAGGI = {
  nuovaPartita: 'Benvenuto. Stai per assumere il ruolo di Amministratore Delegato e Team Principal.',
  inizioAR3: 'Sei stato assegnato a una squadra di AR3. Qui inizia la tua carriera.',
  promozionAR2: 'Stagione conclusa. Le tue prestazioni ti aprono le porte della AR2.',
  promozionAR1: 'AR1. Hai raggiunto il vertice del motorsport mondiale.',
  pausaEstiva: 'Pausa estiva in corso. Il team è in vacanza. Il gioco riprende il {data}.',
  salvataggioAutomatico: 'Partita salvata.',
  erroreCaricamento: 'Impossibile caricare la partita salvata. Il file potrebbe essere danneggiato.',
  nessunSalvataggio: 'Nessuna partita trovata. Avvia una nuova partita per cominciare.',
  budgetCapViolazione: 'Attenzione: il budget corrente supera il limite regolamentare.',
  salvataggioCrisi: 'La Federazione ha erogato un finanziamento straordinario. La stagione prossima si riparte.'
};

/* Esportazione globale di tutti i dati */
const DATI = {
  MESCOLE,
  CIRCUITI,
  CIRCUITI_FISSI,
  CIRCUITI_STORICI,
  MOTIVAZIONI_USCITA_CALENDARIO,
  MOTIVAZIONI_ENTRATA_CALENDARIO,
  SQUADRE_AR1,
  PILOTI_AR1,
  PILOTI_RISERVA_AR1,
  TALENTI_ACADEMY_AR1,
  SQUADRE_AR2,
  PILOTI_AR2,
  SQUADRE_AR3,
  PILOTI_AR3,
  ROUND_AR2,
  ROUND_AR3,
  STAFF_AR2,
  STAFF_AR3,
  ERA_REGOLAMENTARE_INIZIALE,
  PRIZE_MONEY_AR1,
  BONUS_STORICI,
  PUNTI_GARA,
  PUNTI_SPRINT,
  PUNTI_GIRO_VELOCE,
  MESSAGGI
};
