/**
 * CircularList.js
 * Estrutura de dados para lista circular com múltiplos modos de avanço do cursor
 * (Sequencial, Reverso, Randômico, Pêndulo/Ping-Pong, Direto).
 */

export class CircularList {
  constructor(items = [], mode = 'sequential_forward') {
    this.items = Array.isArray(items) ? [...items] : [];
    this.cursor = 0;
    this.direction = 1; // 1 para frente, -1 para trás (usado no modo pendulum)
    this.mode = mode;
  }

  setItems(items) {
    this.items = Array.isArray(items) ? [...items] : [];
    if (this.cursor >= this.items.length) {
      this.cursor = 0;
    }
  }

  getItems() {
    return [...this.items];
  }

  get length() {
    return this.items.length;
  }

  current() {
    if (this.items.length === 0) return null;
    return this.items[this.cursor % this.items.length];
  }

  reset() {
    this.cursor = 0;
    this.direction = 1;
  }

  /**
   * Obtém a nota/item atual e avança o cursor de acordo com o modo de avanço
   */
  next(customMode = null, directIndex = null) {
    if (this.items.length === 0) return null;
    const mode = customMode || this.mode;
    const len = this.items.length;

    if (len === 1) return this.items[0];

    // Modo direto: indexado pelo valor fornecido (ex: fatia do radar)
    if (mode === 'direct' && directIndex !== null) {
      this.cursor = Math.floor(Math.abs(directIndex)) % len;
      return this.items[this.cursor];
    }

    const item = this.items[this.cursor % len];

    switch (mode) {
      case 'sequential_forward':
      case 'seq_fwd':
        this.cursor = (this.cursor + 1) % len;
        break;

      case 'sequential_backward':
      case 'seq_bwd':
        this.cursor = (this.cursor - 1 + len) % len;
        break;

      case 'random':
        this.cursor = Math.floor(Math.random() * len);
        break;

      case 'pendulum':
      case 'ping_pong':
        if (this.cursor >= len - 1) {
          this.direction = -1;
        } else if (this.cursor <= 0) {
          this.direction = 1;
        }
        this.cursor = Math.max(0, Math.min(len - 1, this.cursor + this.direction));
        break;

      default:
        this.cursor = (this.cursor + 1) % len;
    }

    return item;
  }
}
