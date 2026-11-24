/**
 * SequencerSurfaceView.js
 * Interface do usuário (Rack de Pistas) da Musical Surface do Sequenciador Polar.
 * Renderiza um card para cada anel concêntrico do disco, permitindo escolher o timbre,
 * volume, mute e solo.
 */

export class SequencerSurfaceView {
  constructor(container, trackManager, soundEngine) {
    this.container = container;
    this.trackManager = trackManager;
    this.soundEngine = soundEngine;

    this.trackManager.onChange(() => this.render());
    this.render();
    this._startBlinkLoop();
  }

  render() {
    this.container.innerHTML = `
      <div class="seq-surface-panel">
        <div class="seq-surface-header">
          <div class="seq-surface-title">
            <h3>🎛️ RACK DE TIMBRES (SURFACE)</h3>
            <span class="seq-surface-badge">${this.trackManager.tracks.length} ANÉIS</span>
          </div>
          <span class="seq-surface-info">Cada pista corresponde a um anel concêntrico do disco</span>
        </div>

        <div class="seq-tracks-list" id="seqTracksList"></div>
      </div>
    `;

    const listEl = this.container.querySelector('#seqTracksList');
    const availableSources = this.soundEngine.getAvailableSoundSources();

    this.trackManager.tracks.forEach((track) => {
      const row = this._createTrackCard(track, availableSources);
      listEl.appendChild(row);
    });
  }

  _createTrackCard(track, sources) {
    const card = document.createElement('div');
    card.className = `seq-track-card ${track.mute ? 'is-muted' : ''} ${track.solo ? 'is-solo' : ''}`;
    card.id = `seq-track-${track.ringIndex}`;

    // Opções de timbres (Synths e SF2s)
    let sourceOptions = '';
    sources.forEach(src => {
      const isSel = src.id === track.soundSource;
      sourceOptions += `<option value="${src.id}" ${isSel ? 'selected' : ''}>${src.name}</option>`;
    });

    card.innerHTML = `
      <div class="seq-track-led-col">
        <div class="seq-track-led" id="seq-led-${track.ringIndex}" title="Disparo do anel"></div>
        <span class="seq-track-note" id="seq-note-${track.ringIndex}">--</span>
      </div>

      <div class="seq-track-info-col">
        <div class="seq-ring-tag">ANEL ${track.ringIndex + 1}</div>
        <input type="text" class="seq-track-name-input" value="${track.name}" title="Nome da voz / instrumento">
      </div>

      <div class="seq-track-source-col">
        <label class="seq-col-label">TIMBRE / INSTRUMENTO</label>
        <select class="input-select seq-source-select">
          ${sourceOptions}
        </select>
      </div>

      <div class="seq-track-vol-col">
        <label class="seq-col-label">VOL: <span class="seq-vol-val">${Math.round(track.gain * 100)}%</span></label>
        <input type="range" class="seq-vol-slider" min="0" max="1.2" step="0.05" value="${track.gain}">
      </div>

      <div class="seq-track-mix-col">
        <button type="button" class="btn-toggle btn-mute ${track.mute ? 'active' : ''}">M</button>
        <button type="button" class="btn-toggle btn-solo ${track.solo ? 'active' : ''}">S</button>
      </div>
    `;

    this._bindCardEvents(card, track);
    return card;
  }

  _bindCardEvents(card, track) {
    const nameInput = card.querySelector('.seq-track-name-input');
    const sourceSelect = card.querySelector('.seq-source-select');
    const volSlider = card.querySelector('.seq-vol-slider');
    const volVal = card.querySelector('.seq-vol-val');
    const btnMute = card.querySelector('.btn-mute');
    const btnSolo = card.querySelector('.btn-solo');

    nameInput.addEventListener('input', (e) => {
      track.name = e.target.value;
    });

    sourceSelect.addEventListener('change', (e) => {
      this.soundEngine.unlock();
      track.soundSource = e.target.value;
      // Pequeno preview auditivo do novo instrumento selecionado
      this.soundEngine.playNote({
        note: 'C3',
        velocity: 90,
        duration: 250,
        soundSource: track.soundSource,
        gain: track.gain
      });
    });

    volSlider.addEventListener('input', (e) => {
      track.gain = parseFloat(e.target.value);
      volVal.textContent = `${Math.round(track.gain * 100)}%`;
    });

    btnMute.addEventListener('click', () => {
      track.mute = !track.mute;
      card.classList.toggle('is-muted', track.mute);
      btnMute.classList.toggle('active', track.mute);
    });

    btnSolo.addEventListener('click', () => {
      track.solo = !track.solo;
      card.classList.toggle('is-solo', track.solo);
      btnSolo.classList.toggle('active', track.solo);
    });
  }

  _startBlinkLoop() {
    const updateLeds = () => {
      const now = Date.now();
      for (const track of this.trackManager.tracks) {
        const led = document.getElementById(`seq-led-${track.ringIndex}`);
        const noteDisp = document.getElementById(`seq-note-${track.ringIndex}`);

        if (led && noteDisp) {
          const isFiring = (now - track.lastTriggerTime) < 140;
          led.classList.toggle('active', isFiring);
          noteDisp.classList.toggle('active', isFiring);
          if (isFiring) {
            noteDisp.textContent = track.lastTriggerNote || '--';
          }
        }
      }
      requestAnimationFrame(updateLeds);
    };

    requestAnimationFrame(updateLeds);
  }
}
