# ARCHITECTURE.md

**Project:** Real-Time Collaborative Drawing Canvas

---

## Overview

This system allows multiple users to draw together in real time on a shared HTML5 canvas.
The architecture is based on a client-server model using WebSockets (Socket.io) for real-time communication.

Each user’s drawing actions are immediately broadcast to all connected clients in the same room, ensuring consistent and synchronized canvas states.

---

## System Components

| Layer          | Description                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Frontend**   | HTML5 Canvas for drawing, Vanilla JS for event handling, Socket.io client for communication.          |
| **Backend**    | Node.js with Express for static file serving and Socket.io for bidirectional real-time communication. |
| **Data Store** | In-memory JavaScript objects (one per room) maintaining stroke history and user states.               |
| **Protocol**   | Custom event-based protocol using Socket.io messages for drawing synchronization.                     |

---

## Data Flow Diagram

```
            ┌─────────────────────────────┐
            │         User A (Client)     │
            │  Draws on Canvas            │
            └────────────┬────────────────┘
                         │ stroke events
                         ▼
                ┌───────────────────┐
                │  WebSocket Server │
                │  (Node.js + IO)   │
                └───────┬───────────┘
                        │ broadcasts to all clients in room
                        ▼
    ┌───────────────────────────┬───────────────────────────┐
    │        User B (Client)    │        User C (Client)    │
    │  Receives events + renders│  Receives events + renders│
    └───────────────────────────┴───────────────────────────┘
```

---

## State Management

Each room maintains its own drawing state using the `DrawingState` class:

```js
class DrawingState {
  constructor() {
    this.strokes = []; // list of stroke objects
    this.users = {};   // active users { id, name, color }
  }

  addStroke(stroke) { this.strokes.push(stroke); }

  undo(userId) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i].userId === userId && this.strokes[i].active) {
        this.strokes[i].active = false;
        return this.strokes[i].id;
      }
    }
    return null;
  }

  redo(userId) {
    for (const s of this.strokes) {
      if (s.userId === userId && !s.active) {
        s.active = true;
        return s.id;
      }
    }
    return null;
  }

  getActiveStrokes() {
    return this.strokes.filter(s => s.active);
  }
}
```

Each stroke = `{ id, color, width, tool, points[], userId, active }`

`active = false` means the stroke is undone.

The server always holds the authoritative state.

---

## WebSocket Protocol

| Event                     | Direction            | Description                                      |
| ------------------------- | -------------------- | ------------------------------------------------ |
| stroke:start              | Client → Server      | Begin new stroke with {x, y, color, width, tool} |
| stroke:points             | Client → Server      | Stream drawing points as user moves mouse        |
| stroke:erase              | Client → Server      | Erase overlapping pixels near {x, y}             |
| canvas:clear              | Client → Server      | Clears all strokes in the room                   |
| undo / redo               | Client → Server      | Undo/redo last stroke for that user              |
| cursor:move               | Client → Server      | Update current cursor position {x, y}            |
| cursor:update             | Server → All clients | Broadcasts all cursor movements                  |
| stroke:start              | Server → All clients | Notifies others a user began drawing             |
| stroke:points             | Server → All clients | Stream continuous points for smooth lines        |
| stroke:erase              | Server → All clients | Broadcast erasing action                         |
| stroke:undo / stroke:redo | Server → All clients | Notify clients to sync state                     |
| user:list                 | Server → All clients | List of users in current room                    |
| user:left                 | Server → All clients | Remove cursor + user from active list            |

---

## Undo / Redo Synchronization

### Local Behavior

Each client keeps its own local undo stack for instant responsiveness.

When user presses Undo:

* Client emits "undo" event.
* Server deactivates the last active stroke from that user (`active=false`).

### Global Synchronization

After server updates its authoritative state:

* Server emits "stroke:undo" or "stroke:redo" to all clients in the room.
* Each client fetches updated stroke list via:

```bash
GET /state?room=<roomName>
```

Clients clear their canvas and redraw based on canonical state from server.

This guarantees perfect synchronization across all users.

---

## Conflict Resolution

| Scenario                         | Resolution                                                     |
| -------------------------------- | -------------------------------------------------------------- |
| Two users draw overlapping lines | Both are drawn independently (no overwriting).                 |
| User A erases near User B’s line | Server marks only nearby stroke segments as inactive.          |
| User A undoes while User B draws | Undo affects only A’s strokes; B’s continue unaffected.        |
| User leaves room                 | Their cursor and identity are removed from the UI immediately. |

---

## Cursor Movement Logic

Each user’s cursor is represented by one `<div>` with a unique color and name tag.
Client updates position only, not DOM creation — preventing duplication.

Smooth motion is achieved using interpolation:

```js
// runs in animation loop
cursor.x += (cursor.tx - cursor.x) * 0.3;
cursor.y += (cursor.ty - cursor.y) * 0.3;
cursor.el.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
```

This creates a fluid cursor animation without flicker, even on high-latency networks.

---

## Performance Decisions

| Challenge                       | Optimization                                      |
| ------------------------------- | ------------------------------------------------- |
| High-frequency mouse events     | Cursor updates throttled to requestAnimationFrame |
| Redrawing all strokes on resize | History replayed from in-memory stroke list       |
| Large user count                | Each room isolated, reduces broadcast overhead    |
| Erasing conflicts               | Only strokes near erase point are affected        |
| Undo/Redo lag                   | Clients render instantly, then resync with server |

---

## Data Serialization

Each drawing segment is serialized into minimal JSON for transmission:

```json
{
  "x1": 120,
  "y1": 200,
  "x2": 130,
  "y2": 210,
  "color": "#000000",
  "width": 4,
  "tool": "brush"
}
```

This reduces packet size while maintaining smoothness for Bezier interpolation.

---

## Server Scalability

Each Socket.io room maps to a canvas session.

Room’s `DrawingState` object maintains its strokes independently.

Easily scalable horizontally using Redis adapter for socket clustering (future scope).

Optional persistence can store `DrawingState` snapshots in MongoDB for permanent rooms.

---

## Security & Error Handling

* Basic validation for room existence before join (`/check-room`).
* Auto room creation on first join.
* Disconnection events clean up users and cursors.
* Invalid or malformed packets ignored server-side.

---

## Design Rationale

| Decision                              | Reason                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| Vanilla JS + Canvas API               | Demonstrates raw API proficiency and event handling mastery. |
| Socket.io instead of native WebSocket | Simplifies room management and automatic reconnection.       |
| In-memory state                       | Fastest for real-time drawing without external DB latency.   |
| Client prediction                     | Instant feedback for local strokes before server broadcast.  |
| Authoritative replay after undo/redo  | Guarantees global consistency.                               |

---

## Example Workflow (Draw + Undo)

Scenario: User A draws a stroke and undoes it.

```
User A (client) → stroke:start {x,y,...}
User A (client) → stroke:points {...}
Server → broadcast stroke:start + stroke:points to all users
User A (client) → undo
Server → mark A’s last stroke inactive
Server → emit stroke:undo
All clients → fetch /state?room=...
All clients → redrawCanvas()
Result: All users’ canvases now match perfectly.
```

---

## Summary

The system achieves:

* Real-time collaboration
* Per-user undo/redo
* Smooth Bezier curves
* Live cursor movement
* Multi-room scalability
* Conflict-free drawing

Designed for clarity, performance, and reliability without using any frontend frameworks.

Built by Kusuma Karthik — demonstrating expertise in WebSockets, distributed state synchronization, and HTML5 Canvas programming.
