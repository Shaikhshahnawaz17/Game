import { mobileCheck, clamp } from './utils.js';

export const Input = {
  keys: new Set(),
  isMobile: mobileCheck(),
  joystickActive: false,
  joystick: { dx: 0, dy: 0 },
  els: {},

  init() {
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    this.els.touchControls = document.getElementById('touchControls');
    this.els.joystick = document.getElementById('joystick');
    this.els.stick = document.getElementById('stick');
    this.els.attackBtn = document.getElementById('attackBtn');
    this.els.taskBtn = document.getElementById('taskBtn');

    if (this.isMobile) {
      this.els.touchControls.classList.remove('hidden');
      let origin = null;

      const onStart = (ev) => {
        this.joystickActive = true;
        const t = ev.touches ? ev.touches[0] : ev;
        const rect = this.els.joystick.getBoundingClientRect();
        origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this._updateStick(t.clientX, t.clientY, origin);
      };
      const onMove = (ev) => {
        if (!this.joystickActive) return;
        const t = ev.touches ? ev.touches[0] : ev;
        this._updateStick(t.clientX, t.clientY, origin);
      };
      const onEnd = () => {
        this.joystickActive = false;
        this.joystick.dx = 0; this.joystick.dy = 0;
        this.els.stick.style.left = '36px';
        this.els.stick.style.top = '36px';
      };

      this.els.joystick.addEventListener('touchstart', onStart);
      this.els.joystick.addEventListener('touchmove', onMove);
      this.els.joystick.addEventListener('touchend', onEnd);

      // Buttons are wired in game.js
    }
  },

  _updateStick(cx, cy, origin) {
    const dx = cx - origin.x;
    const dy = cy - origin.y;
    const max = 40;
    const ndx = clamp(dx, -max, max);
    const ndy = clamp(dy, -max, max);
    this.els.stick.style.left = (36 + ndx) + 'px';
    this.els.stick.style.top = (36 + ndy) + 'px';
    this.joystick.dx = ndx / max;
    this.joystick.dy = ndy / max;
  },

  // Returns movement vector in local X/Z (top-down: X for strafe, Z for forward)
  getMoveVector(cameraAngle = 0) {
    if (this.isMobile) {
      // Map joystick to world-aligned movement rotated by cameraAngle
      const x = this.joystick.dx;
      const y = -this.joystick.dy;
      const cos = Math.cos(cameraAngle), sin = Math.sin(cameraAngle);
      return { x: x * cos - y * sin, z: x * sin + y * cos };
    }

    let x = 0, z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  },

  isAttackPressed() { return this.keys.has(' ') || false; }, // space bar
  isTaskPressed() { return this.keys.has('e') || false; } // E key
};