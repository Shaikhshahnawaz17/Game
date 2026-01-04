// Room management: tracks rooms, players, roles, game state
import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> room object
  }

  createRoom(hostId, hostName) {
    const id = uuidv4().slice(0, 6);
    const room = {
      id,
      players: new Map(), // playerId -> { id, name, ws, role, ready, health, tasksCompleted }
      hostId,
      status: 'lobby', // 'lobby' | 'in-game' | 'ended'
      createdAt: Date.now()
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId, playerId, playerName, ws) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.status !== 'lobby') return { error: 'Game already started' };
    room.players.set(playerId, {
      id: playerId,
      name: playerName || `Player-${playerId.slice(0, 4)}`,
      ws,
      role: 'survivor',
      ready: false,
      health: 100,
      tasksCompleted: 0,
      position: { x: Math.random() * 8 - 4, z: Math.random() * 8 - 4 }
    });
    return { room };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players.delete(playerId);
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
    } else if (room.hostId === playerId) {
      // reassign host
      const first = [...room.players.values()][0];
      room.hostId = first.id;
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  setReady(roomId, playerId, ready) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const p = room.players.get(playerId);
    if (p) p.ready = ready;
  }

  canStart(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.players.size < 2) return false;
    for (const p of room.players.values()) {
      if (!p.ready) return false;
    }
    return true;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (!this.canStart(roomId)) return { error: 'All players must be ready and at least 2 players required' };

    // Randomly pick a monster
    const playersArr = [...room.players.values()];
    const monsterIndex = Math.floor(Math.random() * playersArr.length);
    playersArr.forEach((p, idx) => {
      p.role = idx === monsterIndex ? 'monster' : 'survivor';
      p.health = 100;
      p.tasksCompleted = 0;
      p.position = { x: Math.random() * 10 - 5, z: Math.random() * 10 - 5 };
    });

    room.status = 'in-game';
    room.game = {
      startedAt: Date.now(),
      objectives: 3, // survivors need 3 tasks
      survivorsEscaped: 0,
      survivorsEliminated: 0
    };

    return { room };
  }

  broadcast(roomId, type, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const msg = JSON.stringify({ type, payload });
    for (const p of room.players.values()) {
      try { p.ws.send(msg); } catch {}
    }
  }

  playerAction(roomId, playerId, action) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'in-game') return;
    const player = room.players.get(playerId);
    if (!player) return;

    // Update position if provided
    if (action.type === 'move' && action.position) {
      player.position = action.position;
    }

    // Monster attack
    if (action.type === 'attack' && player.role === 'monster' && action.targetId) {
      const target = room.players.get(action.targetId);
      if (target && target.role === 'survivor') {
        target.health = Math.max(0, target.health - 34);
        if (target.health === 0) {
          room.game.survivorsEliminated++;
        }
        this.broadcast(roomId, 'hit', {
          attackerId: playerId,
          targetId: target.id,
          targetHealth: target.health
        });
      }
    }

    // Survivor task progress
    if (action.type === 'task' && player.role === 'survivor') {
      player.tasksCompleted = Math.min(room.game.objectives, player.tasksCompleted + 1);
      this.broadcast(roomId, 'taskUpdate', {
        playerId: player.id,
        tasksCompleted: player.tasksCompleted
      });
    }

    // Check end conditions
    const survivors = [...room.players.values()].filter(p => p.role === 'survivor');
    const allTasksMet = survivors.every(s => s.tasksCompleted >= room.game.objectives);
    const allSurvivorsDown = survivors.every(s => s.health <= 0);

    if (allTasksMet) {
      room.status = 'ended';
      this.broadcast(roomId, 'gameEnd', { result: 'survivorsEscaped' });
    } else if (allSurvivorsDown) {
      room.status = 'ended';
      this.broadcast(roomId, 'gameEnd', { result: 'monsterWon' });
    } else {
      // State tick update
      this.broadcast(roomId, 'state', {
        players: [...room.players.values()].map(p => ({
          id: p.id, name: p.name, role: p.role, health: p.health,
          tasksCompleted: p.tasksCompleted, position: p.position
        })),
        status: room.status
      });
    }
  }
}