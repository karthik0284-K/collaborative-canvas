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
const rooms = new Map();

/*  Serve static frontend files from /client */
app.use(express.static(path.join(__dirname, "..", "client")));

/*  Serve index.html for all GET requests (for Render/Vercel/SPA routing) */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

/* Create a new room */
app.get("/create-room", (req, res) => {
  const room = req.query.room;
  if (!room) return res.status(400).json({ success: false, message: "Missing room name" });

  if (!rooms.has(room)) {
    rooms.set(room, new DrawingState());
    console.log(`🆕 Room created: ${room}`);
  }

  res.json({ success: true });
});

/*  Check if room exists */
app.get("/check-room", (req, res) => {
  const room = req.query.room;
  res.json({ exists: rooms.has(room) });
});

/* Get drawing state */
app.get("/state", (req, res) => {
  const room = req.query.room || "default";
  const state = rooms.get(room);
  if (!state) return res.json([]);
  res.json(state.getActiveStrokes());
});

/*  WebSocket Connections */
io.on("connection", (socket) => {
  const roomName = socket.handshake.query.room || "default";

  // Auto-create room if not present
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new DrawingState());
    console.log(`⚙️ Auto-created room ${roomName}`);
  }

  const state = rooms.get(roomName);
  socket.join(roomName);

  const user = {
    id: socket.id,
    name: `User-${Math.floor(Math.random() * 1000)}`,
    color: randomColor(),
  };

  state.users[user.id] = user;
  console.log(` ${user.name} joined ${roomName}`);

  io.to(roomName).emit("user:list", Object.values(state.users));

  /*  Cursor events */
  socket.on("cursor:move", (data) => {
    socket.to(roomName).emit("cursor:update", {
      id: socket.id,
      x: data.x,
      y: data.y,
      color: user.color,
      name: user.name,
    });
  });

  /*  Drawing events */
  socket.on("stroke:start", (data) => {
    const layer = Date.now();
    const stroke = {
      id: `${layer}-${socket.id}`,
      color: data.color,
      width: data.width,
      tool: data.tool,
      points: [{ x: data.x, y: data.y }],
      userId: socket.id,
      layer,
      active: true,
    };
    state.addStroke(stroke);
    socket.to(roomName).emit("stroke:start", { ...data, layer });
  });

  socket.on("stroke:points", (data) => {
    const stroke = state.strokes[state.strokes.length - 1];
    if (stroke && stroke.active) stroke.points.push({ x: data.x2, y: data.y2 });
    socket.to(roomName).emit("stroke:points", data);
  });

  socket.on("stroke:erase", (data) => {
    state.strokes.forEach((s) => {
      if (s.active && s.tool !== "eraser") {
        const overlap = s.points.some(
          (p) => Math.abs(p.x - data.x) < 5 && Math.abs(p.y - data.y) < 5
        );
        if (overlap) s.active = false;
      }
    });
    io.to(roomName).emit("stroke:erase", data);
  });

  socket.on("canvas:clear", () => {
    state.strokes = [];
    io.to(roomName).emit("canvas:clear");
  });

  socket.on("undo", () => {
    const undoneId = state.undo(socket.id);
    if (undoneId) io.to(roomName).emit("stroke:undo", { id: undoneId });
  });

  socket.on("redo", () => {
    const redoneId = state.redo(socket.id);
    if (redoneId) io.to(roomName).emit("stroke:redo", { id: redoneId });
  });

  socket.on("disconnect", () => {
    delete state.users[socket.id];
    io.to(roomName).emit("user:list", Object.values(state.users));
    socket.to(roomName).emit("user:left", socket.id);
  });
});

function randomColor() {
  const colors = ["#e74c3c", "#27ae60", "#2980b9", "#8e44ad", "#f39c12", "#1abc9c"];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
