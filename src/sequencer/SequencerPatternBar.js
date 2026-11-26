/**
 * SequencerPatternBar.js
 * Barra de navegação e controle dos 10 slots de patterns (1 a 9 e 0).
 * Disposição em escada (staircase) contornando a curvatura do disco polar.
 * Suporta troca quantizada no compasso com feedback visual de fila (queued),
 * LEDs luminosos de conteúdo gravado e menu rápido de duplicação/limpeza.
 */

export class SequencerPatternBar {
  constructor(container, core) {
    this.container = container;
    this.core = core;

    this.element = document.createElement('div');
    this.element.className = 'seq-pattern-slots-bar';
    this.container.appendChild(this.element);

    this._render();
    this._bindEvents();

    if (this.core) {
      this.core.onPatternChange(() => this._updateState());
      this.core.onChange(() => this._updateContentDots());
    }
    this._updateState();
  }

  _render() {
    this.element.innerHTML = `
      <!-- Cluster em Escada no Canto Superior Esquerdo -->
      <div class="pattern-staircase-cluster" role="tablist" aria-label="Patterns do Sequenciador">
        <!-- Linha 1: 1, 2, 3, 4 -->
        <div class="pattern-staircase-row">
          <button type="button" class="btn-pattern-tab is-active" data-index="0" data-label="1" title="Pattern 1 (Atalho: 1)">
            <span class="pattern-num">1</span>
            <span class="pattern-dot" title="LED de conteúdo"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="1" data-label="2" title="Pattern 2 (Atalho: 2)">
            <span class="pattern-num">2</span>
            <span class="pattern-dot"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="2" data-label="3" title="Pattern 3 (Atalho: 3)">
            <span class="pattern-num">3</span>
            <span class="pattern-dot"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="3" data-label="4" title="Pattern 4 (Atalho: 4)">
            <span class="pattern-num">4</span>
            <span class="pattern-dot"></span>
          </button>
        </div>

        <!-- Linha 2: 5, 6, 7 -->
        <div class="pattern-staircase-row">
          <button type="button" class="btn-pattern-tab" data-index="4" data-label="5" title="Pattern 5 (Atalho: 5)">
            <span class="pattern-num">5</span>
            <span class="pattern-dot"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="5" data-label="6" title="Pattern 6 (Atalho: 6)">
            <span class="pattern-num">6</span>
            <span class="pattern-dot"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="6" data-label="7" title="Pattern 7 (Atalho: 7)">
            <span class="pattern-num">7</span>
            <span class="pattern-dot"></span>
          </button>
        </div>

        <!-- Linha 3: 8, 9 -->
        <div class="pattern-staircase-row">
          <button type="button" class="btn-pattern-tab" data-index="7" data-label="8" title="Pattern 8 (Atalho: 8)">
            <span class="pattern-num">8</span>
            <span class="pattern-dot"></span>
          </button>
          <button type="button" class="btn-pattern-tab" data-index="8" data-label="9" title="Pattern 9 (Atalho: 9)">
            <span class="pattern-num">9</span>
            <span class="pattern-dot"></span>
          </button>
        </div>

        <!-- Linha 4: 0 (Pattern 10) -->
        <div class="pattern-staircase-row">
          <button type="button" class="btn-pattern-tab" data-index="9" data-label="0" title="Pattern 10 (Atalho: 0)">
            <span class="pattern-num">0</span>
            <span class="pattern-dot"></span>
          </button>
        </div>
      </div>

      <!-- Ações no Canto Superior Direito -->
      <div class="pattern-actions-group">
        <div class="pattern-copy-dropdown-wrapper">
          <button type="button" class="btn-pattern-action" id="btnOpenCopyMenu" title="Copiar o padrão ativo para outro slot">
            <span>📋</span> <span class="action-text">Copiar</span>
          </button>
          <div class="pattern-copy-menu" id="patternCopyMenu" style="display: none;">
            <div class="copy-menu-title">Copiar Padrão Atual para:</div>
            <div class="copy-menu-grid">
              <button type="button" class="btn-copy-target" data-target="0">1</button>
              <button type="button" class="btn-copy-target" data-target="1">2</button>
              <button type="button" class="btn-copy-target" data-target="2">3</button>
              <button type="button" class="btn-copy-target" data-target="3">4</button>
              <button type="button" class="btn-copy-target" data-target="4">5</button>
              <button type="button" class="btn-copy-target" data-target="5">6</button>
              <button type="button" class="btn-copy-target" data-target="6">7</button>
              <button type="button" class="btn-copy-target" data-target="7">8</button>
              <button type="button" class="btn-copy-target" data-target="8">9</button>
              <button type="button" class="btn-copy-target" data-target="9">0</button>
            </div>
          </div>
        </div>

        <button type="button" class="btn-pattern-action" id="btnClearCurrentPattern" title="Limpar todas as notas do padrão ativo">
          <span>🗑️</span>
        </button>
      </div>
    `;
  }

  _bindEvents() {
    // Clique nos botões de tabs 1 a 0
    this.element.querySelectorAll('.btn-pattern-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.core.selectPattern(idx);
      });
    });

    // Menu de Cópia
    const btnOpenCopy = this.element.querySelector('#btnOpenCopyMenu');
    const copyMenu = this.element.querySelector('#patternCopyMenu');

    btnOpenCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = copyMenu.style.display !== 'none';
      copyMenu.style.display = isVisible ? 'none' : 'block';
      this._updateCopyTargetButtons();
    });

    document.addEventListener('click', () => {
      copyMenu.style.display = 'none';
    });

    this.element.querySelectorAll('.btn-copy-target').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = parseInt(btn.dataset.target, 10);
        const fromIdx = this.core.activePatternIndex;
        if (targetIdx !== fromIdx) {
          this.core.copyPattern(fromIdx, targetIdx);
          copyMenu.style.display = 'none';
        }
      });
    });

    // Limpar Pattern Atual
    const btnClear = this.element.querySelector('#btnClearCurrentPattern');
    btnClear.addEventListener('click', () => {
      const curIdx = this.core.activePatternIndex;
      const label = curIdx === 9 ? '0 (10)' : `${curIdx + 1}`;
      if (confirm(`Deseja limpar todas as notas do Pattern ${label}?`)) {
        this.core.clearPattern(curIdx);
      }
    });
  }

  _updateCopyTargetButtons() {
    const curIdx = this.core.activePatternIndex;
    this.element.querySelectorAll('.btn-copy-target').forEach(btn => {
      const targetIdx = parseInt(btn.dataset.target, 10);
      const isCurrent = targetIdx === curIdx;
      btn.disabled = isCurrent;
      btn.classList.toggle('is-current', isCurrent);
      const label = targetIdx === 9 ? '0' : `${targetIdx + 1}`;
      btn.title = isCurrent ? `Padrão ${label} já é o atual` : `Copiar para Pattern ${label}`;
    });
  }

  _updateState() {
    const activeIdx = this.core.activePatternIndex;
    const queuedIdx = this.core.queuedPatternIndex;

    this.element.querySelectorAll('.btn-pattern-tab').forEach(btn => {
      const idx = parseInt(btn.dataset.index, 10);
      const label = btn.dataset.label;
      const isActive = idx === activeIdx;
      const isQueued = idx === queuedIdx;

      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('is-queued', isQueued);

      if (isQueued) {
        btn.setAttribute('title', `Pattern ${label} entrará na virada do compasso!`);
      } else {
        btn.setAttribute('title', `Pattern ${label} (Atalho: ${label})`);
      }
    });

    this._updateContentDots();
  }

  _updateContentDots() {
    this.element.querySelectorAll('.btn-pattern-tab').forEach(btn => {
      const idx = parseInt(btn.dataset.index, 10);
      const hasContent = this.core.hasPatternContent(idx);
      btn.classList.toggle('has-content', hasContent);
    });
  }
}
