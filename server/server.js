import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

io.on("connection", (socket) => {
  console.log(" A user connected:", socket.id);
  socket.on("stroke:start", (data) => {
    socket.broadcast.emit("stroke:start", data);
  });

  socket.on("stroke:points", (data) => {
    socket.broadcast.emit("stroke:points", data);
  });

  socket.on("stroke:end", (data) => {
    socket.broadcast.emit("stroke:end", data);
  });

  // When user clears the entire canvas
  socket.on("canvas:clear", () => {
    socket.broadcast.emit("canvas:clear");
  });

  // Disconnect event
  socket.on("disconnect", () => {
    console.log(" A user disconnected:", socket.id);
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
