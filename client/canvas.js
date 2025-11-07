export class Canvas {
  constructor(socket, roomName) {
    this.canvas = document.getElementById("board");
    this.ctx = this.canvas.getContext("2d");
    this.socket = socket;
    this.room = roomName;

    this.isDrawing = false;
    this.color = "#000000";
    this.lineWidth = 4;
    this.tool = "brush";
    this.cursors = {};

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.listenToEvents();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.replayAll();
  }

  listenToEvents() {
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => {
      this.draw(e);
      this.emitCursor(e);
    });
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseleave", () => this.stopDrawing());

    // socket events
    this.socket.on("stroke:start", (data) => this.remoteStart(data));
    this.socket.on("stroke:points", (data) => this.remoteDraw(data));
    this.socket.on("canvas:clear", () => this.clearCanvas());
    this.socket.on("cursor:update", (data) => this.updateCursor(data));
    this.socket.on("user:left", (id) => this.removeCursor(id));
    this.socket.on("stroke:undo", () => this.replayAll());
    this.socket.on("stroke:redo", () => this.replayAll());
  }

  emitCursor(e) {
    this.socket.emit("cursor:move", { x: e.clientX, y: e.clientY });
  }

  updateCursor({ id, x, y, color, name }) {
    let c = this.cursors[id];
    if (!c) {
      c = document.createElement("div");
      c.classList.add("cursor");
      c.style.backgroundColor = color;
      const tag = document.createElement("div");
      tag.classList.add("nameTag");
      tag.textContent = name || id.substring(0, 5);
      c.appendChild(tag);
      document.body.appendChild(c);
      this.cursors[id] = c;
    }
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
  }

  removeCursor(id) {
    const c = this.cursors[id];
    if (c) {
      c.remove();
      delete this.cursors[id];
    }
  }

  startDrawing(e) {
    this.isDrawing = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.socket.emit("stroke:start", {
      x: this.lastX,
      y: this.lastY,
      color: this.color,
      width: this.lineWidth,
      tool: this.tool,
    });
  }

  draw(e) {
    if (!this.isDrawing) return;
    const x = e.clientX;
    const y = e.clientY;
    this.drawLine(this.lastX, this.lastY, x, y, this.color, this.lineWidth, this.tool);
    this.socket.emit("stroke:points", {
      x1: this.lastX,
      y1: this.lastY,
      x2: x,
      y2: y,
      color: this.color,
      width: this.lineWidth,
      tool: this.tool,
    });
    this.lastX = x;
    this.lastY = y;
  }

  stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.socket.emit("stroke:end", {});
  }

  remoteStart(data) {
    this.lastX = data.x;
    this.lastY = data.y;
  }

  remoteDraw(data) {
    this.drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.width, data.tool);
  }

  drawLine(x1, y1, x2, y2, color, width, tool) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  clear() {
    this.clearCanvas();
    this.socket.emit("canvas:clear");
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  undo() {
    this.socket.emit("undo");
  }

  redo() {
    this.socket.emit("redo");
  }

  async replayAll() {
    const res = await fetch(`/state?room=${this.room}`);
    const strokes = await res.json();
    this.clearCanvas();
    strokes.forEach((s) => {
      for (let i = 1; i < s.points.length; i++) {
        this.drawLine(
          s.points[i - 1].x,
          s.points[i - 1].y,
          s.points[i].x,
          s.points[i].y,
          s.color,
          s.width,
          s.tool
        );
      }
    });
  }
}
