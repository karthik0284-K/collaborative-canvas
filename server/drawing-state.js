export class DrawingState {
  constructor() {
    this.strokes = [];
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
  }

  undo(userId) {
    // undo only last active stroke by this user
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
    // redo the first inactive stroke of this user
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
