/**
 * SynthGraphModel.js
 * Modelo de dados do Grafo Modular de Síntese Sonora.
 * Gerencia nós, portas (inlets/outlets), cabos de conexão e serialização JSON.
 */

export const NODE_TYPES = {
  oscillator: {
    name: 'Oscilador (VCO)',
    category: 'source',
    color: '#00e5ff',
    badge: 'FONTE',
    defaultParams: { waveform: 'sawtooth', octave: 0, detune: 0, ratio: 1.0, gain: 0.8 },
    inlets: [
      { id: 'pitch_cv', name: 'Pitch CV', title: 'Pitch CV In (Afinação da Nota 1V/Oct / Vibrato)', type: 'cv' },
      { id: 'fm_in', name: 'FM In', title: 'Modulação em Frequência (FM)', type: 'audio' }
    ],
    outlets: [
      { id: 'audio_out', name: 'Out', title: 'Áudio Out (Forma de onda)', type: 'audio' },
      { id: 'pitch_cv_out', name: 'Pitch CV', title: 'Pitch CV Out (CV da nota tocada para filtros e osciladores)', type: 'cv' }
    ]
  },
  noise: {
    name: 'Gerador de Ruído',
    category: 'source',
    color: '#38bdf8',
    badge: 'RUÍDO',
    defaultParams: { noiseType: 'white', gain: 0.8 },
    inlets: [],
    outlets: [
      { id: 'audio_out', name: 'Out', title: 'Áudio Out (Ruído Branco/Rosa)', type: 'audio' }
    ]
  },
  filter: {
    name: 'Filtro (VCF)',
    category: 'filter',
    color: '#a855f7',
    badge: 'TIMBRE',
    defaultParams: { filterType: 'lowpass', cutoff: 1800, resonance: 3.0, envAmount: 3500, keyTrack: 0 },
    inlets: [
      { id: 'audio_in', name: 'In', title: 'Áudio In (Sinal a ser filtrado)', type: 'audio' },
      { id: 'cutoff_cv', name: 'Cutoff CV', title: 'Cutoff / Pitch CV (Modulação de corte ou rastreio de nota)', type: 'cv' }
    ],
    outlets: [
      { id: 'audio_out', name: 'Out', title: 'Áudio Out (Sinal filtrado)', type: 'audio' }
    ]
  },
  envelope: {
    name: 'Envelope ADSR',
    category: 'modulator',
    color: '#ffb703',
    badge: 'DINÂMICA',
    defaultParams: { attack: 0.005, decay: 0.25, sustain: 0.2, release: 0.2 },
    inlets: [
      { id: 'gate_in', name: 'Gate In', title: 'Gate In (Disparo da tecla)', type: 'cv' }
    ],
    outlets: [
      { id: 'cv_out', name: 'Env Out', title: 'Envelope CV Out', type: 'cv' }
    ]
  },
  lfo: {
    name: 'Oscilador LFO',
    category: 'modulator',
    color: '#fb8500',
    badge: 'MODULADOR',
    defaultParams: { waveform: 'sine', frequency: 5.0, depth: 30 },
    inlets: [],
    outlets: [
      { id: 'cv_out', name: 'LFO Out', title: 'LFO CV Out', type: 'cv' }
    ]
  },
  vca: {
    name: 'Amplificador (VCA)',
    category: 'processor',
    color: '#06d6a0',
    badge: 'VOLUME / AM',
    defaultParams: { gain: 0.8, depth: 500 },
    inlets: [
      { id: 'audio_in', name: 'In', title: 'Áudio In', type: 'audio' },
      { id: 'gain_cv', name: 'Gain CV', title: 'Gain CV (Controle de amplitude)', type: 'cv' },
      { id: 'mod_cv', name: 'Mod CV', title: 'Tremolo / AM CV', type: 'cv' }
    ],
    outlets: [
      { id: 'audio_out', name: 'Out', title: 'Áudio Out', type: 'audio' }
    ]
  },
  mixer: {
    name: 'Mixer 4-Canais',
    category: 'processor',
    color: '#10b981',
    badge: 'MIXAGEM',
    defaultParams: { ch1: 0.7, ch2: 0.7, ch3: 0.5, ch4: 0.5 },
    inlets: [
      { id: 'in_1', name: 'Ch 1', title: 'Canal 1 Áudio', type: 'audio' },
      { id: 'in_2', name: 'Ch 2', title: 'Canal 2 Áudio', type: 'audio' },
      { id: 'in_3', name: 'Ch 3', title: 'Canal 3 Áudio', type: 'audio' },
      { id: 'in_4', name: 'Ch 4', title: 'Canal 4 Áudio', type: 'audio' }
    ],
    outlets: [
      { id: 'audio_out', name: 'Out', title: 'Mix Out', type: 'audio' }
    ]
  },
  master: {
    name: 'Saída Master',
    category: 'output',
    color: '#ff007f',
    badge: 'DESTINO',
    defaultParams: { volume: 0.85 },
    inlets: [
      { id: 'audio_in', name: 'In', title: 'Áudio In (Saída final para os alto-falantes)', type: 'audio' }
    ],
    outlets: []
  }
};

export class SynthGraphModel {
  constructor() {
    this.nodes = new Map();   // id -> { id, type, x, y, params }
    this.cables = [];         // [ { id, fromNode, fromPort, toNode, toPort } ]
    this.name = 'Meu Timbre Modular';
    this.category = 'Lead';
    this.author = 'Professor / Aluno';

    this.listeners = new Set();
  }

  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  notify(changeType = 'update', payload = null) {
    for (const cb of this.listeners) {
      try { cb({ type: changeType, payload, graph: this }); } catch (e) {
        console.error('[SynthGraphModel] Erro no listener:', e);
      }
    }
  }

  addNode(type, x = 100, y = 100, customParams = null) {
    const def = NODE_TYPES[type];
    if (!def) throw new Error(`Tipo de nó desconhecido: ${type}`);

    const id = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const node = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      params: { ...def.defaultParams, ...(customParams || {}) }
    };

    this.nodes.set(id, node);
    this.notify('node_add', node);
    return node;
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.nodes.get(nodeId);

    // Remove todos os cabos ligados a este nó
    this.cables = this.cables.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
    this.nodes.delete(nodeId);

    this.notify('node_remove', { nodeId, node });
  }

  setNodePosition(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.x = Math.round(x);
    node.y = Math.round(y);
    this.notify('node_move', node);
  }

  setNodeParam(nodeId, paramKey, value) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.params[paramKey] = value;
    this.notify('param_change', { nodeId, paramKey, value });
  }

  connect(fromNodeId, fromPortId, toNodeId, toPortId) {
    if (fromNodeId === toNodeId) return null; // Evita loop no próprio nó

    const source = this.nodes.get(fromNodeId);
    const target = this.nodes.get(toNodeId);
    if (!source || !target) return null;

    // Se o inlet de destino já tiver um cabo conectado, desconecta o anterior (substituição limpa)
    const existing = this.cables.find(c => c.toNode === toNodeId && c.toPort === toPortId);
    if (existing) {
      this.disconnect(existing.id);
    }

    const cableId = `cable_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const cable = {
      id: cableId,
      fromNode: fromNodeId,
      fromPort: fromPortId,
      toNode: toNodeId,
      toPort: toPortId
    };

    this.cables.push(cable);
    this.notify('cable_add', cable);
    return cable;
  }

  disconnect(cableId) {
    const idx = this.cables.findIndex(c => c.id === cableId);
    if (idx !== -1) {
      const removed = this.cables.splice(idx, 1)[0];
      this.notify('cable_remove', removed);
      return removed;
    }
    return null;
  }

  disconnectCablesAtPort(nodeId, portId, direction = null) {
    const toRemove = this.cables.filter(c => {
      if (direction === 'in') return c.toNode === nodeId && c.toPort === portId;
      if (direction === 'out') return c.fromNode === nodeId && c.fromPort === portId;
      return (c.fromNode === nodeId && c.fromPort === portId) || (c.toNode === nodeId && c.toPort === portId);
    });
    for (const cable of toRemove) {
      this.disconnect(cable.id);
    }
    return toRemove.length;
  }

  clear() {
    this.nodes.clear();
    this.cables = [];
    this.notify('clear');
  }

  toJSON() {
    const nodesArray = [];
    for (const node of this.nodes.values()) {
      nodesArray.push({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        params: { ...node.params }
      });
    }

    return {
      format: 'solsynth_patch',
      version: '1.0',
      name: this.name,
      category: this.category,
      author: this.author,
      dateExported: new Date().toISOString(),
      nodes: nodesArray,
      cables: [...this.cables]
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.clear();

    this.name = data.name || 'Timbre Importado';
    this.category = data.category || 'Lead';
    this.author = data.author || 'Desconhecido';

    if (Array.isArray(data.nodes)) {
      for (const n of data.nodes) {
        if (NODE_TYPES[n.type]) {
          this.nodes.set(n.id, {
            id: n.id,
            type: n.type,
            x: n.x !== undefined ? n.x : 100,
            y: n.y !== undefined ? n.y : 100,
            params: { ...NODE_TYPES[n.type].defaultParams, ...(n.params || {}) }
          });
        }
      }
    }

    if (Array.isArray(data.cables)) {
      for (const c of data.cables) {
        if (this.nodes.has(c.fromNode) && this.nodes.has(c.toNode)) {
          this.cables.push({
            id: c.id || `cable_${Date.now()}_${Math.random()}`,
            fromNode: c.fromNode,
            fromPort: c.fromPort,
            toNode: c.toNode,
            toPort: c.toPort
          });
        }
      }
    }

    this.notify('load');
  }
}
