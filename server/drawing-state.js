export class DrawingState {
  constructor() {
    this.strokes = [];
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
  }

  undo() {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i].active) {
        this.strokes[i].active = false;
        return this.strokes[i].id;
      }
    }
    return null;
  }

  redo() {
    for (let i = 0; i < this.strokes.length; i++) {
      if (!this.strokes[i].active) {
        this.strokes[i].active = true;
        return this.strokes[i].id;
      }
    }
    return null;
  }

  getActiveStrokes() {
    return this.strokes.filter((s) => s.active);
  }
}
