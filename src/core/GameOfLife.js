/**
 * GameOfLife.js
 * Motor do autômato celular Conway's Game of Life para grade toroidal (72 colunas x 24 linhas).
 * Completamente agnóstico de áudio ou música.
 */

export class GameOfLife {
  constructor(cols = 72, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.board = this._createEmptyBoard();
    this.nextBoard = this._createEmptyBoard();
  }

  _createEmptyBoard() {
    const b = new Array(this.cols);
    for (let x = 0; x < this.cols; x++) {
      b[x] = new Uint8Array(this.rows);
    }
    return b;
  }

  init(randomize = true, probability = 0.3) {
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const val = randomize && Math.random() < probability ? 1 : 0;
        this.board[x][y] = val;
        this.nextBoard[x][y] = val;
      }
    }
  }

  clear() {
    this.init(false);
  }

  randomize(probability = 0.3) {
    this.init(true, probability);
  }

  getCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.board[col][row];
  }

  setCell(col, row, state) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.board[col][row] = state ? 1 : 0;
      this.nextBoard[col][row] = this.board[col][row];
    }
  }

  toggleCell(col, row) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.board[col][row] = this.board[col][row] === 1 ? 0 : 1;
      this.nextBoard[col][row] = this.board[col][row];
      return this.board[col][row];
    }
    return 0;
  }

  getColumn(col) {
    const c = (col % this.cols + this.cols) % this.cols;
    const result = new Array(this.rows);
    for (let y = 0; y < this.rows; y++) {
      result[y] = this.board[c][y] === 1;
    }
    return result;
  }

  step() {
    const { cols, rows, board, nextBoard } = this;

    for (let x = 0; x < cols; x++) {
      const left = (x + cols - 1) % cols;
      const right = (x + 1) % cols;

      for (let y = 0; y < rows; y++) {
        const up = (y + rows - 1) % rows;
        const down = (y + 1) % rows;

        // 8 vizinhos com wrap-around toroidal
        const nb =
          board[left][up] +
          board[x][up] +
          board[right][up] +
          board[left][y] +
          board[right][y] +
          board[left][down] +
          board[x][down] +
          board[right][down];

        const current = board[x][y];
        if (current === 1 && (nb < 2 || nb > 3)) {
          nextBoard[x][y] = 0; // Morte por solidão ou superpopulação
        } else if (current === 0 && nb === 3) {
          nextBoard[x][y] = 1; // Reprodução / nascimento
        } else {
          nextBoard[x][y] = current; // Sobrevivência
        }
      }
    }

    // Troca de buffers
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        board[x][y] = nextBoard[x][y];
      }
    }
  }

  exportState() {
    const data = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (this.board[x][y] === 1) {
          data.push([x, y]);
        }
      }
    }
    return { cols: this.cols, rows: this.rows, activeCells: data };
  }

  importState(state) {
    this.clear();
    if (state && Array.isArray(state.activeCells)) {
      for (const [x, y] of state.activeCells) {
        this.setCell(x, y, 1);
      }
    }
  }
}
