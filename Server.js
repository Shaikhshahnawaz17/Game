// Simple WebSocket server for lobby, rooms, and real-time game
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { RoomManager } from './rooms.js';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const rooms = new RoomManager();

const clients = new Map(); // playerId -> { ws, roomId, name }

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const playerId = uuidv4();
  clients.set(playerId, { ws, roomId: null, name: null });

  ws.send(JSON.stringify({ type: 'hello', payload: { playerId } }));

  ws.on('message', (message) => {
    let msg;
    try { msg = JSON.parse(message.toString()); } catch { return; }

    const { type, payload } = msg;
    const client = clients.get(playerId);
    if (!client) return;

    if (type === 'createRoom') {
      const { name } = payload;
      client.name = name;
      const room = rooms.createRoom(playerId, name);
      rooms.joinRoom(room.id, playerId, name, ws);
      client.roomId = room.id;
      ws.send(JSON.stringify({ type: 'roomJoined', payload: { roomId: room.id } }));
      rooms.broadcast(room.id, 'lobbyUpdate', lobbyState(room.id));
    }

    if (type === 'joinRoom') {
      const { roomId, name } = payload;
      client.name = name;
      const res = rooms.joinRoom(roomId, playerId, name, ws);
      if (res.error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: res.error } }));
      } else {
        client.roomId = roomId;
        ws.send(JSON.stringify({ type: 'roomJoined', payload: { roomId } }));
        rooms.broadcast(roomId, 'lobbyUpdate', lobbyState(roomId));
      }
    }

    if (type === 'setReady') {
      const { ready } = payload;
      if (!client.roomId) return;
      rooms.setReady(client.roomId, playerId, ready);
      rooms.broadcast(client.roomId, 'lobbyUpdate', lobbyState(client.roomId));
    }

    if (type === 'startGame') {
      if (!client.roomId) return;
      const room = rooms.getRoom(client.roomId);
      if (!room || room.hostId !== playerId) return;
      const res = rooms.startGame(client.roomId);
      if (res.error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: res.error } }));
      } else {
        rooms.broadcast(client.roomId, 'gameStart', {
          players: [...room.players.values()].map(p => ({
            id: p.id, name: p.name, role: p.role, position: p.position
          })),
          objectives: room.game.objectives
        });
      }
    }

    if (type === 'move') {
      if (!client.roomId) return;
      rooms.playerAction(client.roomId, playerId, { type: 'move', position: payload.position });
    }

    if (type === 'attack') {
      if (!client.roomId) return;
      rooms.playerAction(client.roomId, playerId, { type: 'attack', targetId: payload.targetId });
    }

    if (type === 'task') {
      if (!client.roomId) return;
      rooms.playerAction(client.roomId, playerId, { type: 'task' });
    }

    if (type === 'chat') {
      if (!client.roomId) return;
      const room = rooms.getRoom(client.roomId);
      if (!room) return;
      rooms.broadcast(client.roomId, 'chat', { playerId, name: client.name, message: payload.message });
    }
  });

  ws.on('close', () => {
    const client = clients.get(playerId);
    if (client && client.roomId) {
      rooms.leaveRoom(client.roomId, playerId);
      rooms.broadcast(client.roomId, 'lobbyUpdate', lobbyState(client.roomId));
    }
    clients.delete(playerId);
  });
});

function lobbyState(roomId) {
  const room = rooms.getRoom(roomId);
  if (!room) return {};
  return {
    roomId,
    hostId: room.hostId,
    status: room.status,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, ready: p.ready
    }))
  };
}