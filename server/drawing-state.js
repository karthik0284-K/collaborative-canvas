export class DrawingState {
  constructor() {
    this.strokes = [];
    this.users = {};
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
  }

  undo(userId) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const s = this.strokes[i];
      if (s.active && s.userId === userId) {
        s.active = false;
        return s.id;
      }
    }
    return null;
  }

  redo(userId) {
    for (let i = 0; i < this.strokes.length; i++) {
      const s = this.strokes[i];
      if (!s.active && s.userId === userId) {
        s.active = true;
        return s.id;
      }
    }
    return null;
  }

  getActiveStrokes() {
    return this.strokes.filter((s) => s.active);
  }
}
