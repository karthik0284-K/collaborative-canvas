import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { DrawingState } from "./drawing-state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const state = new DrawingState(); // holds all strokes

app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// expose current active strokes for replay
app.get("/state", (req, res) => {
  res.json(state.getActiveStrokes());
});

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  const user = {
    id: socket.id,
    name: `User-${Math.floor(Math.random() * 1000)}`,
    color: randomColor(),
  };

  // --- Cursor handling ---
  socket.on("cursor:move", (data) => {
    socket.broadcast.emit("cursor:update", {
      id: socket.id,
      x: data.x,
      y: data.y,
      color: user.color,
      name: user.name,
    });
  });

  // --- Drawing events ---
  socket.on("stroke:start", (data) => {
    const stroke = {
      id: Date.now() + "-" + socket.id,
      color: data.color,
      width: data.width,
      tool: data.tool,
      points: [{ x: data.x, y: data.y }],
      userId: socket.id,
      active: true,
    };
    state.addStroke(stroke);
    socket.broadcast.emit("stroke:start", data);
  });

  socket.on("stroke:points", (data) => {
    const stroke = state.strokes[state.strokes.length - 1];
    if (stroke && stroke.active) {
      stroke.points.push({ x: data.x2, y: data.y2 });
    }
    socket.broadcast.emit("stroke:points", data);
  });

  socket.on("stroke:end", (data) => {
    socket.broadcast.emit("stroke:end", data);
  });

  socket.on("canvas:clear", () => {
    state.strokes = [];
    io.emit("canvas:clear");
  });

  // --- Per-user undo/redo ---
  socket.on("undo", () => {
    const undoneId = state.undo(socket.id);
    if (undoneId) io.emit("stroke:undo", { id: undoneId });
  });

  socket.on("redo", () => {
    const redoneId = state.redo(socket.id);
    if (redoneId) io.emit("stroke:redo", { id: redoneId });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    socket.broadcast.emit("user:left", socket.id);
  });
});

function randomColor() {
  const colors = ["#e74c3c", "#27ae60", "#2980b9", "#8e44ad", "#f39c12", "#1abc9c"];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
