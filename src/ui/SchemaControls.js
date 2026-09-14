/**
 * SchemaControls.js
 * Painel de gerenciamento de esquemas (Salvar Arquivo, Carregar Arquivo, Reset de Fábrica e Carregador SF2).
 */

import { SchemaManager } from '../surface/SchemaManager.js';

export class SchemaControls {
  constructor(container, trackManager, solCore, soundEngine) {
    this.container = container;
    this.trackManager = trackManager;
    this.solCore = solCore;
    this.soundEngine = soundEngine;

    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <div class="schema-controls-panel">
        <div class="schema-title">
          <span>💾 ESQUEMAS & PRESETS</span>
        </div>
        <div class="schema-buttons">
          <button id="btnSaveSchema" class="btn btn-sm btn-secondary" title="Salvar configuração atual em um arquivo .sol.json">
            ⬇️ Salvar Arquivo
          </button>
          <button id="btnLoadSchema" class="btn btn-sm btn-secondary" title="Carregar esquema de um arquivo .sol.json">
            ⬆️ Carregar Arquivo
          </button>
          <input type="file" id="fileSchemaInput" accept=".json,.sol.json" style="display: none;">
          
          <button id="btnResetFactory" class="btn btn-sm btn-outline" title="Restaurar esquema padrão original de fábrica">
            🔄 Restaurar Fábrica
          </button>

          <label class="btn btn-sm btn-sf2" title="Carregar arquivo de SoundFont (.sf2) do seu computador">
            📂 Carregar .SF2
            <input type="file" id="fileSf2Input" accept=".sf2" style="display: none;">
          </label>
        </div>
        <div id="schemaStatusMessage" class="schema-msg"></div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnSave = this.container.querySelector('#btnSaveSchema');
    const btnLoad = this.container.querySelector('#btnLoadSchema');
    const fileInput = this.container.querySelector('#fileSchemaInput');
    const btnResetFactory = this.container.querySelector('#btnResetFactory');
    const fileSf2 = this.container.querySelector('#fileSf2Input');
    const msgEl = this.container.querySelector('#schemaStatusMessage');

    let msgTimer = null;
    const showMsg = (text, type = 'success', duration = 4000) => {
      if (msgTimer) clearTimeout(msgTimer);
      msgEl.textContent = text;
      let className = 'schema-msg msg-success';
      if (type === 'error' || type === true) className = 'schema-msg msg-error';
      else if (type === 'warning') className = 'schema-msg msg-warning';
      msgEl.className = className;
      msgTimer = setTimeout(() => {
        msgEl.textContent = '';
      }, duration);
    };

    const btnToggle = document.getElementById('btnMenuToggle');
    const drawerEl = document.getElementById('schemaDrawer');

    if (btnToggle && drawerEl) {
      btnToggle.addEventListener('click', () => {
        const isOpen = drawerEl.classList.toggle('open');
        btnToggle.classList.toggle('active', isOpen);
      });
    }

    btnSave.addEventListener('click', () => {
      const defaultName = `sol_schema_${new Date().toISOString().slice(0, 10)}.sol.json`;
      SchemaManager.exportToFile(this.trackManager, this.solCore, this.soundEngine, defaultName);
      showMsg('Esquema salvo e download iniciado com sucesso!');
    });

    btnLoad.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const schema = await SchemaManager.importFromFile(file, this.trackManager, this.solCore, this.soundEngine);
          const missingSf = SchemaManager.getMissingSoundFonts(schema, this.soundEngine);
          if (missingSf.length > 0) {
            showMsg(`⚠️ Esquema carregado! Carregue o SoundFont "${missingSf.join(', ')}" para ativar os timbres.`, 'warning', 8000);
          } else {
            showMsg(`Esquema "${file.name}" carregado com sucesso!`);
          }
        } catch (err) {
          showMsg(`Erro ao carregar: ${err.message}`, 'error');
        }
      }
      fileInput.value = '';
    });

    btnResetFactory.addEventListener('click', () => {
      if (confirm('Deseja realmente restaurar o esquema de fábrica original?')) {
        SchemaManager.resetToFactory(this.trackManager, this.solCore, this.soundEngine);
        showMsg('Esquema padrão de fábrica restaurado!');
      }
    });

    fileSf2.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && this.soundEngine.sf2Player) {
        try {
          const entry = await this.soundEngine.sf2Player.loadSoundFontFile(file);
          this.trackManager.notifyChange();
          showMsg(`✅ SoundFont "${file.name}" carregado! Timbres vinculados com sucesso!`, 'success', 5000);
        } catch (err) {
          showMsg(`Erro no SF2: ${err.message}`, 'error');
        }
      }
      fileSf2.value = '';
    });
  }
}
