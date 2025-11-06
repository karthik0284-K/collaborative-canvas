export class Canvas {
  constructor(socket) {
    this.canvas = document.getElementById("board");
    this.ctx = this.canvas.getContext("2d");
    this.socket = socket;

    this.isDrawing = false;
    this.color = "#000000";
    this.lineWidth = 4;
    this.tool = "brush";

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.listenToEvents();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  listenToEvents() {
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseleave", () => this.stopDrawing());

    this.socket.on("stroke:start", (data) => this.remoteStart(data));
    this.socket.on("stroke:points", (data) => this.remoteDraw(data));
    this.socket.on("stroke:end", () => {});
    this.socket.on("canvas:clear", () => this.clearCanvas());
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

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }

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
}
