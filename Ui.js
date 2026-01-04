import { Net } from './net.js';
import { formatRoom } from './utils.js';

export const UI = {
  els: {},
  state: {
    name: '',
    room: null,
    role: null,
    health: 100,
    objectives: 3,
    tasksCompleted: 0
  },

  init() {
    this.els.playerName = document.getElementById('playerName');
    this.els.createRoomBtn = document.getElementById('createRoomBtn');
    this.els.joinRoomBtn = document.getElementById('joinRoomBtn');
    this.els.roomIdInput = document.getElementById('roomIdInput');
    this.els.lobby = document.getElementById('lobby');
    this.els.lobbyInfo = document.getElementById('lobbyInfo');
    this.els.playersList = document.getElementById('playersList');
    this.els.readyBtn = document.getElementById('readyBtn');
    this.els.startBtn = document.getElementById('startBtn');
    this.els.hud = document.getElementById('hud');
    this.els.role = document.getElementById('role');
    this.els.health = document.getElementById('health');
    this.els.objective = document.getElementById('objective');
    this.els.roomIdDisplay = document.getElementById('roomIdDisplay');

    this.els.chatBox = document.getElementById('chatBox');
    this.els.chatMessages = document.getElementById('chatMessages');
    this.els.chatInput = document.getElementById('chatInput');
    this.els.chatSend = document.getElementById('chatSend');

    this.els.createRoomBtn.onclick = () => {
      this.state.name = this.els.playerName.value || 'Unknown';
      Net.createRoom(this.state.name);
    };

    this.els.joinRoomBtn.onclick = () => {
      this.state.name = this.els.playerName.value || 'Unknown';
      const roomId = this.els.roomIdInput.value.trim();
      if (roomId) Net.joinRoom(roomId, this.state.name);
    };

    this.els.readyBtn.onclick = () => Net.setReady(true);
    this.els.startBtn.onclick = () => Net.startGame();

    this.els.chatSend.onclick = () => {
      const text = this.els.chatInput.value.trim();
      if (!text) return;
      Net.chat(text);
      this.els.chatInput.value = '';
    };

    Net.on('roomJoined', (p) => {
      this.els.lobby.classList.remove('hidden');
      this.state.roomId = p.roomId;
    });

    Net.on('lobbyUpdate', (p) => {
      this.state.room = p;
      this.els.lobbyInfo.textContent = formatRoom(p);
      this.els.playersList.innerHTML = p.players.map(pl =>
        `<div>${pl.name} ${pl.ready ? '✅' : '⏳'} ${pl.id === p.hostId ? '(Host)' : ''}</div>`).join('');
    });

    Net.on('chat', ({ name, message }) => {
      const node = document.createElement('div');
      node.className = 'msg';
      node.innerHTML = `<span class="name">${name}</span>: ${message}`;
      this.els.chatMessages.appendChild(node);
      this.els.chatMessages.scrollTop = this.els.chatMessages.scrollHeight;
    });

    Net.on('gameStart', (p) => {
      const me = p.players.find(pl => pl.id === Net.playerId);
      this.state.role = me.role;
      this.state.objectives = p.objectives;
      this.state.tasksCompleted = 0;
      this.els.hud.classList.remove('hidden');
      this.els.role.textContent = `Role: ${this.state.role.toUpperCase()}`;
      this.els.objective.textContent = `Objective: ${this.state.role === 'survivor'
        ? `Complete ${p.objectives} tasks to escape`
        : 'Hunt survivors'}`;
      this.els.roomIdDisplay.textContent = `Room ID: ${this.state.roomId}`;
      // Hide lobby
      this.els.lobby.classList.add('hidden');
    });

    Net.on('state', (p) => {
      const me = p.players.find(pl => pl.id === Net.playerId);
      if (me) {
        this.state.health = me.health;
        this.state.tasksCompleted = me.tasksCompleted;
        this.els.health.textContent = `Health: ${Math.round(me.health)}`;
        this.els.objective.textContent = this.state.role === 'survivor'
          ? `Tasks: ${me.tasksCompleted}/${this.state.objectives}`
          : `Eliminate survivors`;
      }
    });

    Net.on('hit', ({ targetId, targetHealth }) => {
      if (targetId === Net.playerId) {
        this.state.health = targetHealth;
        this.els.health.textContent = `Health: ${Math.round(targetHealth)}`;
      }
    });

    Net.on('taskUpdate', ({ playerId, tasksCompleted }) => {
      if (playerId === Net.playerId) {
        this.state.tasksCompleted = tasksCompleted;
        this.els.objective.textContent = `Tasks: ${tasksCompleted}/${this.state.objectives}`;
      }
    });

    Net.on('gameEnd', ({ result }) => {
      const text = result === 'survivorsEscaped' ? 'Survivors escaped!' : 'Monster won!';
      alert(`Game Over: ${text}`);
      location.reload();
    });
  }
};