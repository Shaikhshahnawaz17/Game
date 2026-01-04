import { Net } from './net.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Game } from './game.js';

window.addEventListener('load', () => {
  // Connect to local server
  const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'ws://localhost:8080'
    : `wss://${location.hostname}/ws`; // adjust for production

  Net.connect(wsUrl);
  UI.init();
  Input.init();
  Game.init();
});