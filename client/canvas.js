export class Canvas {
  constructor(socket, roomName) {
    this.canvas = document.getElementById("board");
    this.ctx = this.canvas.getContext("2d");
    this.socket = socket;
    this.room = roomName;

    this.tempCanvas = document.createElement("canvas");
    this.tempCtx = this.tempCanvas.getContext("2d");

    this.isDrawing = false;
    this.color = "#000000";
    this.lineWidth = 4;
    this.tool = "brush";
    this.cursors = {}; 
    this.points = [];

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.listenToEvents();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.tempCanvas.width = this.canvas.width;
    this.tempCanvas.height = this.canvas.height;
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

    // --- SOCKET EVENTS ---
    this.socket.on("stroke:start", (data) => this.remoteStart(data));
    this.socket.on("stroke:points", (data) => this.remoteDraw(data));
    this.socket.on("stroke:erase", (data) => this.remoteErase(data));
    this.socket.on("canvas:clear", () => this.clearCanvas());
    this.socket.on("stroke:undo", () => this.replayAll());
    this.socket.on("stroke:redo", () => this.replayAll());

    // Cursor updates
    this.socket.on("cursor:update", (data) => this.updateCursor(data));
    this.socket.on("user:left", (id) => this.removeCursor(id));
  }

  // === Cursor handling ===
  emitCursor(e) {
    this.socket.emit("cursor:move", { x: e.clientX, y: e.clientY });
  }

  updateCursor({ id, x, y, color, name }) {
    let c = this.cursors[id];
    if (!c) {
      // create new dot for this user
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
    // move existing cursor smoothly
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

  // === Drawing ===
  startDrawing(e) {
    this.isDrawing = true;
    this.points = [];
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.points.push({ x: this.lastX, y: this.lastY });

    if (this.tool === "eraser") {
      this.socket.emit("stroke:erase", { x: this.lastX, y: this.lastY });
    } else {
      this.socket.emit("stroke:start", {
        x: this.lastX,
        y: this.lastY,
        color: this.color,
        width: this.lineWidth,
        tool: this.tool,
      });
    }
  }

  draw(e) {
    if (!this.isDrawing) return;
    const x = e.clientX;
    const y = e.clientY;
    this.points.push({ x, y });

    if (this.tool === "eraser") {
      this.eraseLine(this.lastX, this.lastY, x, y);
      this.socket.emit("stroke:erase", { x, y });
    } else {
      this.drawSmooth(this.tempCtx, this.points, this.color, this.lineWidth);
      this.socket.emit("stroke:points", {
        x1: this.lastX,
        y1: this.lastY,
        x2: x,
        y2: y,
        color: this.color,
        width: this.lineWidth,
        tool: this.tool,
      });
    }

    this.lastX = x;
    this.lastY = y;
    this.commitTempToMain();
  }

  stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.points = [];
    this.socket.emit("stroke:end", {});
  }

  drawSmooth(ctx, points, color, width) {
    if (points.length < 3) {
      const b = points[0];
      ctx.beginPath();
      ctx.arc(b.x, b.y, width / 2, 0, Math.PI * 2, true);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
      return;
    }

    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 2; i++) {
      const cpx = (points[i].x + points[i + 1].x) / 2;
      const cpy = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, cpx, cpy);
    }
    const last = points.length - 1;
    ctx.quadraticCurveTo(points[last - 1].x, points[last - 1].y, points[last].x, points[last].y);
    ctx.stroke();
  }

  eraseLine(x1, y1, x2, y2) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = "round";
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  commitTempToMain() {
    this.ctx.drawImage(this.tempCanvas, 0, 0);
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
  }

  remoteStart(data) {
    this.lastX = data.x;
    this.lastY = data.y;
  }

  remoteDraw(data) {
    this.drawLine(this.ctx, data.x1, data.y1, data.x2, data.y2, data.color, data.width);
  }

  drawLine(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  remoteErase(data) {
    this.eraseLine(data.x - 5, data.y - 5, data.x + 5, data.y + 5);
  }

  async replayAll() {
    const res = await fetch(`/state?room=${this.room}`);
    const strokes = await res.json();
    this.clearCanvas();
    strokes
      .sort((a, b) => a.layer - b.layer)
      .forEach((s) => this.drawSmooth(this.ctx, s.points, s.color, s.width));
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
  }

  undo() {
    this.socket.emit("undo");
  }

  redo() {
    this.socket.emit("redo");
  }

  clear() {
    this.clearCanvas();
    this.socket.emit("canvas:clear");
  }
}