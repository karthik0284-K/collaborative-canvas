# Real-Time Collaborative Drawing Canvas

A multi-user real-time drawing application built from scratch using **Vanilla JavaScript**, **HTML5 Canvas**, **Node.js**, and **WebSockets (Socket.io)** .

Multiple users can draw together on a shared canvas, see each other's live cursor movements, and use per-user undo/redo, all synchronized in real time across clients.

---

## Features

### Core Drawing

* Brush and Eraser tools
* Adjustable color and stroke width
* Smooth Bezier curve drawing for natural lines
* Local performance optimization (client-side prediction)

### Real-Time Collaboration

* Draw simultaneously across multiple users in the same room
* Live cursor indicators (one dot per user, smooth movement + name tooltip)
* Conflict-free drawing — overlapping strokes are managed independently
* Real-time user list dropdown
* Supports multiple isolated rooms

### Canvas Control

* Per-user Undo/Redo (only affects your strokes)
* Clear Canvas across all users
* Room persistence until last user leaves

### Multi-Room System

* Create or join rooms by name
* Prevent joining non-existent rooms
* “Draw Alone” mode for solo sketching
* Auto room creation via `/create-room`

### Performance

* Real-time drawing synchronization with micro-segment batching
* WebSocket event throttling for cursor updates
* Client-side replay from server state ensures canvas consistency
* GPU-accelerated cursor animations (CSS transforms)

---

## Tech Stack

| Component               | Technology                                   |
| ----------------------- | -------------------------------------------- |
| Frontend                | Vanilla JS + HTML5 Canvas + CSS              |
| Backend                 | Node.js + Express + Socket.io                |
| Real-time Communication | WebSockets                                   |
| Data Management         | In-memory DrawingState per room              |
| Persistence             | (Optional) Not implemented; live-memory only |

---

##  Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html              # Homepage + UI for room management and drawing
│   ├── style.css               # Minimal styles (inline in index.html)
│   ├── canvas.js               # Core drawing + sync logic (Vanilla JS)
│   ├── websocket.js            # WebSocket connection helper (Code part is been kept in index.html as there are bugs arising)
│   └── main.js (optional)      # Entry point if modularized (Code part is been kept in index.html as there are bugs arising)
├── server/
│   ├── server.js               # Express + Socket.io server setup
│   ├── rooms.js                # Room management (in-memory) (Code part is been kept in server.js as there are bugs arising)
│   └── drawing-state.js        # Drawing state management (strokes, undo/redo)
├── package.json
├── README.md                   # Documentation
└── ARCHITECTURE.md             # Design & protocol explanation
```

---

## Setup Instructions

### Step 3 - Clone and install dependencies

```bash
git clone https://github.com/yourusername/collaborative-canvas.git
cd collaborative-canvas
npm install
```

### Step 2 - Start the server

```bash
npm start
```

Your server will start on:

```
http://localhost:3000
```

### Step 3 - Open in browser

Open two or more tabs to simulate multiple users.

Example URLs:

```
http://localhost:3000             → Home page
http://localhost:3000?room=demo   → Join existing room directly
```

---

##  How to Test

### Single-user mode

* On the home page, click **“Draw Alone”**
* Test brush, eraser, undo, redo, and clear buttons.

### Multi-user mode

* In tab 1 , Create a room (e.g., `team1`)
* In tab 2 , Join the same room name (`team1`)
* Draw in both tabs — observe real-time sync.
* Move cursors — see live cursor indicators.
* Try Undo/Redo — only affects the user who performed it.
* Try Clear — affects all users in the room.

---

## Key Design Highlights

### State Synchronization

Each client maintains a local stroke history. Undo/Redo operations are managed per-user and broadcast through the server. Clients replay the canonical stroke list from the server after every global change.

### Event Serialization

Each brush movement emits tiny “micro-segment” events via Socket.io, minimizing latency and keeping strokes continuous across all clients.

### Conflict Resolution

Each user’s strokes are independent. Eraser and brush operations modify only relevant segments; overlapping strokes are layered.

### Cursor Tracking

Each user has exactly one cursor `<div>` element on every other client. Position updates are interpolated for smooth animation using `requestAnimationFrame`.

### Undo/Redo Strategy

Local undo pops only the current user’s last active stroke. The server ensures cross-user consistency by deactivating strokes per `userId` and rebroadcasting the updated state.

---

##  Scripts

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `npm start`             | Runs server on port 3000       |
| `npm install`           | Installs required dependencies |
| `node server/server.js` | Run manually if needed         |

---

##  Known Limitations

* Eraser can be used to erase the oponent drawing which should'nt be there
* Canvas state is not persisted after server restart.
* Large number of concurrent users (>100) may need message batching or canvas partitioning.
* All users are anonymous and color-coded randomly.
*

---

##  Time Spent

| Task                                    |          Time |
| --------------------------------------- | ------------: |
| Project Setup & Server                  |    ~1 hours |
| Canvas Drawing + Bezier Curves          |      ~5 hours |
| Real-time WebSocket Sync                |      ~3 hours |
| Undo/Redo + Replay Logic                |      ~4 hours |
| UI/UX + Room System + Cursor Indicators |      ~7 hours |
| Debugging & Testing                     |      ~5 hours |
| Documentation                           |       ~1 hour |
| **Total**                               | **~26 hours** |


