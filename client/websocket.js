export function connectToRoom(roomName) {
  return io({ query: { room: roomName } });
}
