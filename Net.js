// Networking: connects to WebSocket server, exposes send helpers and event listeners
export const Net = {
  ws: null,
  playerId: null,
  roomId: null,
  listeners: new Map(), // type -> [fn]

  connect(url) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => console.log('Connected to server');
    this.ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      const { type, payload } = msg;
      if (type === 'hello') { this.playerId = payload.playerId; }
      const arr = this.listeners.get(type) || [];
      arr.forEach(fn => fn(payload));
    };
    this.ws.onclose = () => console.log('Disconnected');
  },

  on(type, fn) {
    const arr = this.listeners.get(type) || [];
    arr.push(fn);
    this.listeners.set(type, arr);
  },

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ type, payload }));
  },

  createRoom(name) { this.send('createRoom', { name }); },
  joinRoom(roomId, name) { this.send('joinRoom', { roomId, name }); },
  setReady(ready) { this.send('setReady', { ready }); },
  startGame() { this.send('startGame', {}); },
  move(position) { this.send('move', { position }); },
  attack(targetId) { this.send('attack', { targetId }); },
  task() { this.send('task', {}); },
  chat(message) { this.send('chat', { message }); }
};