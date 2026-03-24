/* ============================================================
   AUDIO.JS — AR1 Manager
   Sistema audio: effetti sonori sintetici brevi, non invasivi,
   compatibili con VoiceOver. Nessun rombo di motori termici.
   ============================================================ */

'use strict';

class SistemaAudio {
  constructor() {
    this.contesto = null;
    this.abilitato = true;
    this.volume = 0.3;   /* Volume basso di default */
    this._inizializzato = false;
  }

  /* Inizializzazione lazy (richiede interazione utente per l'API Web Audio) */
  _inizializza() {
    if (this._inizializzato) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.contesto = new Ctx();
      this._inizializzato = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  attiva() {
    this._inizializza();
    if (this.contesto && this.contesto.state === 'suspended') {
      this.contesto.resume();
    }
  }

  disabilita() { this.abilitato = false; }
  abilita()    { this.abilitato = true;  }
  setVolume(v) { this.volume = Math.min(1, Math.max(0, v)); }

  /* ----------------------------------------------------------
     GENERATORE DI SUONI BASE
  ---------------------------------------------------------- */

  _riproduci(frequenza, durata, tipo, inviluppo) {
    if (!this.abilitato || !this._inizializza()) return;
    const ctx = this.contesto;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(frequenza, ctx.currentTime);
    osc.connect(gainNode);

    /* Inviluppo volume */
    const adsr = inviluppo || { attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.1 };
    const volumePicco = this.volume;
    const t = ctx.currentTime;

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(volumePicco, t + adsr.attack);
    gainNode.gain.linearRampToValueAtTime(volumePicco * adsr.sustain, t + adsr.attack + adsr.decay);
    gainNode.gain.setValueAtTime(volumePicco * adsr.sustain, t + durata - adsr.release);
    gainNode.gain.linearRampToValueAtTime(0, t + durata);

    osc.start(t);
    osc.stop(t + durata);
  }

  _riproduciSequenza(note) {
    /* note: [{ freq, durata, tipo, ritardo }] */
    note.forEach(nota => {
      setTimeout(() => {
        this._riproduci(nota.freq, nota.durata, nota.tipo || 'sine');
      }, (nota.ritardo || 0) * 1000);
    });
  }

  /* ----------------------------------------------------------
     EFFETTI SONORI PER TIPO DI INTERAZIONE
  ---------------------------------------------------------- */

  /* Conferma decisione — tono breve, positivo */
  conferma() {
    this._riproduciSequenza([
      { freq: 880, durata: 0.08, tipo: 'sine', ritardo: 0 },
      { freq: 1100, durata: 0.12, tipo: 'sine', ritardo: 0.09 }
    ]);
  }

  /* Errore / avviso — tono basso, due impulsi */
  errore() {
    this._riproduciSequenza([
      { freq: 220, durata: 0.15, tipo: 'square', ritardo: 0 },
      { freq: 180, durata: 0.15, tipo: 'square', ritardo: 0.18 }
    ]);
  }

  /* Evento imprevisto — tre note discendenti elettroniche */
  eventoImprevisto() {
    this._riproduciSequenza([
      { freq: 660, durata: 0.1, tipo: 'sawtooth', ritardo: 0 },
      { freq: 550, durata: 0.1, tipo: 'sawtooth', ritardo: 0.12 },
      { freq: 440, durata: 0.15, tipo: 'sawtooth', ritardo: 0.24 }
    ]);
  }

  /* Inizio sessione — bip iconico team radio AR1 */
  inizioSessione() {
    this._riproduciSequenza([
      { freq: 1200, durata: 0.06, tipo: 'square', ritardo: 0 },
      { freq: 1200, durata: 0.06, tipo: 'square', ritardo: 0.10 },
      { freq: 1200, durata: 0.12, tipo: 'square', ritardo: 0.20 }
    ]);
  }

  /* Fine sessione — doppio tono discendente */
  fineSessione() {
    this._riproduciSequenza([
      { freq: 880, durata: 0.12, tipo: 'sine', ritardo: 0 },
      { freq: 660, durata: 0.18, tipo: 'sine', ritardo: 0.14 }
    ]);
  }

  /* Notifica staff — tono medio neutro */
  notificaStaff() {
    this._riproduci(740, 0.15, 'triangle', { attack: 0.01, decay: 0.03, sustain: 0.7, release: 0.08 });
  }

  /* Navigazione menu — click digitale leggero */
  navigazione() {
    this._riproduci(1400, 0.04, 'square', { attack: 0.005, decay: 0.01, sustain: 0.3, release: 0.02 });
  }

  /* Safety car — segnale urgente */
  safetyCar() {
    this._riproduciSequenza([
      { freq: 440, durata: 0.08, tipo: 'square', ritardo: 0 },
      { freq: 660, durata: 0.08, tipo: 'square', ritardo: 0.10 },
      { freq: 440, durata: 0.08, tipo: 'square', ritardo: 0.20 },
      { freq: 660, durata: 0.12, tipo: 'square', ritardo: 0.30 }
    ]);
  }

  /* Pit stop — suono meccanico idraulico */
  pitStop() {
    this._riproduciSequenza([
      { freq: 80, durata: 0.2, tipo: 'sawtooth', ritardo: 0 },
      { freq: 120, durata: 0.1, tipo: 'sawtooth', ritardo: 0.15 },
      { freq: 80, durata: 0.15, tipo: 'sawtooth', ritardo: 0.30 }
    ]);
  }

  /* Promozione di categoria — fanfara breve */
  promozione() {
    this._riproduciSequenza([
      { freq: 523, durata: 0.12, tipo: 'sine', ritardo: 0 },
      { freq: 659, durata: 0.12, tipo: 'sine', ritardo: 0.14 },
      { freq: 784, durata: 0.12, tipo: 'sine', ritardo: 0.28 },
      { freq: 1047, durata: 0.25, tipo: 'sine', ritardo: 0.42 }
    ]);
  }

  /* Vittoria / podio */
  vittoria() {
    this._riproduciSequenza([
      { freq: 784, durata: 0.12, tipo: 'sine', ritardo: 0 },
      { freq: 988, durata: 0.12, tipo: 'sine', ritardo: 0.14 },
      { freq: 1175, durata: 0.20, tipo: 'sine', ritardo: 0.28 },
      { freq: 1568, durata: 0.30, tipo: 'sine', ritardo: 0.50 }
    ]);
  }
}

const audio = new SistemaAudio();
