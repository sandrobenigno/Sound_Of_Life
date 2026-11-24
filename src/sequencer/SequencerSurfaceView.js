/**
 * SequencerSurfaceView.js
 * Interface do usuário (Rack de Pistas) da Musical Surface do Sequenciador Polar.
 * Renderiza um card para cada anel concêntrico do disco, permitindo escolher o timbre,
 * volume, mute, solo e definir qual pista fornece a referência de som para o teclado.
 */

export class SequencerSurfaceView {
  constructor(container, trackManager, soundEngine, palette = null) {
    this.container = container;
    this.trackManager = trackManager;
    this.soundEngine = soundEngine;
    this.palette = palette;

    this.trackManager.onChange(() => this.render());

    if (this.palette) {
      this.palette.onRingChange((ringIndex) => {
        this._updateActiveTargetHighlight(ringIndex);
      });
    }

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
          <span class="seq-surface-info">Clique em 🎧 para escolher qual som é tocado pelo teclado</span>
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
    const isActiveTarget = this.palette && this.palette.selectedRingIndex === track.ringIndex;

    card.className = `seq-track-card ${track.mute ? 'is-muted' : ''} ${track.solo ? 'is-solo' : ''} ${isActiveTarget ? 'is-active-target' : ''}`;
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

      <div class="seq-track-focus-col">
        <button type="button" class="btn-focus-track ${isActiveTarget ? 'active' : ''}" title="Definir este timbre para o teclado tocar ao vivo">
          🎧
        </button>
      </div>

      <div class="seq-track-info-col">
        <div class="seq-ring-header">
          <span class="seq-ring-tag">ANEL ${track.ringIndex + 1}</span>
          ${isActiveTarget ? '<span class="seq-target-badge">TECLADO</span>' : ''}
        </div>
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
    const btnFocus = card.querySelector('.btn-focus-track');

    // Ao clicar no botão de foco 🎧, torna este anel a referência do teclado
    btnFocus.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.palette) {
        this.palette.setSelectedRing(track.ringIndex);
      }
    });

    // Clicar no cabeçalho do card também seleciona o anel
    card.querySelector('.seq-track-info-col').addEventListener('click', () => {
      if (this.palette) {
        this.palette.setSelectedRing(track.ringIndex);
      }
    });

    nameInput.addEventListener('input', (e) => {
      track.name = e.target.value;
      if (this.palette) {
        this.palette._updateTrackDropdown();
      }
    });

    sourceSelect.addEventListener('change', (e) => {
      this.soundEngine.unlock();
      track.soundSource = e.target.value;

      // Atualiza também o dropdown na paleta se esta for a pista ativa
      if (this.palette) {
        this.palette._updateTrackDropdown();
      }

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

    btnMute.addEventListener('click', (e) => {
      e.stopPropagation();
      track.mute = !track.mute;
      card.classList.toggle('is-muted', track.mute);
      btnMute.classList.toggle('active', track.mute);
    });

    btnSolo.addEventListener('click', (e) => {
      e.stopPropagation();
      track.solo = !track.solo;
      card.classList.toggle('is-solo', track.solo);
      btnSolo.classList.toggle('active', track.solo);
    });
  }

  _updateActiveTargetHighlight(activeRingIndex) {
    const cards = this.container.querySelectorAll('.seq-track-card');
    cards.forEach((card, idx) => {
      const isTarget = idx === activeRingIndex;
      card.classList.toggle('is-active-target', isTarget);

      const btnFocus = card.querySelector('.btn-focus-track');
      if (btnFocus) btnFocus.classList.toggle('active', isTarget);

      const ringHeader = card.querySelector('.seq-ring-header');
      if (ringHeader) {
        let badge = ringHeader.querySelector('.seq-target-badge');
        if (isTarget) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'seq-target-badge';
            badge.textContent = 'TECLADO';
            ringHeader.appendChild(badge);
          }
        } else {
          if (badge) badge.remove();
        }
      }
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
