import { Net } from './net.js';
import { Input } from './input.js';
import { Tasks } from './tasks.js';
import { clamp } from './utils.js';

export const Game = {
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  clock: null,
  audio: { ambient: null, monster: null },
  me: { id: null, role: 'survivor', health: 100, pos: new THREE.Vector3(), speed: 2.2 },
  players: new Map(), // id -> mesh
  map: { floor: null, walls: [] },
  lastState: null,

  init() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Lighting: eerie top-down ambient + flickering point lights
    const ambient = new THREE.AmbientLight(0x222222);
    this.scene.add(ambient);

    const flicker = new THREE.PointLight(0x882222, 0.8, 15);
    flicker.position.set(0, 5, 0);
    this.scene.add(flicker);

    // Fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x000000, 0.06);

    // Camera: top-down, angled
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 12, 10);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();

    // Map: floor + walls
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.map.floor = floor;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const walls = [
      { x: 0, z: -10, w: 20, h: 1 }, { x: 0, z: 10, w: 20, h: 1 },
      { x: -10, z: 0, w: 1, h: 20 }, { x: 10, z: 0, w: 1, h: 20 },
      // Obstacles
      { x: -3, z: -2, w: 6, h: 1 }, { x: 3, z: 2, w: 1, h: 6 }
    ];
    walls.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, 2, w.h);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, 1, w.z);
      this.scene.add(mesh);
      this.map.walls.push(mesh);
    });

    // Tasks
    Tasks.createZones(this.scene);

    // Placeholder audio
    this.audio.ambient = new Audio('audio/ambient.mp3');
    this.audio.ambient.loop = true; this.audio.ambient.volume = 0.3;
    this.audio.monster = new Audio('audio/monster.mp3');
    this.audio.monster.loop = true; this.audio.monster.volume = 0.2;

    // Resize handling
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    // Net state updates
    Net.on('gameStart', (p) => {
      // Create player meshes
      p.players.forEach(pl => this._addPlayer(pl));
      const me = p.players.find(pl => pl.id === Net.playerId);
      this.me.id = me.id;
      this.me.role = me.role;
      this.me.pos.set(me.position.x, 0, me.position.z);

      // Audio mood
      try { this.audio.ambient.play(); } catch {}
      if (this.me.role === 'monster') { try { this.audio.monster.play(); } catch {} }
    });

    Net.on('state', (p) => {
      this.lastState = p;
      p.players.forEach(pl => {
        const mesh = this.players.get(pl.id);
        if (!mesh) return;
        mesh.position.set(pl.position.x, 0, pl.position.z);
        mesh.children[0].scale.setScalar(clamp(pl.health / 100, 0.5, 1));
      });
    });

    // Mobile attack/task buttons
    const attackBtn = document.getElementById('attackBtn');
    const taskBtn = document.getElementById('taskBtn');
    attackBtn.onclick = () => this._attemptAttack();
    taskBtn.onclick = () => this._attemptTask();

    this._loop();
  },

  _addPlayer(pl) {
    // Capsule-like player
    const group = new THREE.Group();
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
    const isMonster = pl.role === 'monster';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isMonster ? 0x550000 : 0x334455,
      emissive: isMonster ? 0x220000 : 0x000000,
      roughness: 0.8, metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // Glow orb indicating health
    const glowGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({ color: isMonster ? 0xff4444 : 0x88ccff });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 0.9, 0);
    group.add(glow);

    group.position.set(pl.position.x, 0, pl.position.z);
    group.userData.role = pl.role;
    this.scene.add(group);
    this.players.set(pl.id, group);
  },

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = this.clock.getDelta();

    // Flicker light
    const t = performance.now() * 0.002;
    const light = this.scene.children.find(o => o.isPointLight);
    if (light) {
      light.intensity = 0.7 + Math.sin(t * 2.7) * 0.2 + Math.random() * 0.1;
    }

    // Movement
    const camAngle = 0; // fixed top-down orientation for simplicity
    const mv = Input.getMoveVector(camAngle);
    const desired = new THREE.Vector3(mv.x, 0, mv.z).multiplyScalar(this.me.speed * dt);
    const candidate = this.players.get(Net.playerId);
    if (candidate) {
      // simple collision: prevent moving into walls
      const newPos = candidate.position.clone().add(desired);
      const collides = this._collides(newPos);
      if (!collides) {
        candidate.position.copy(newPos);
        this.me.pos.copy(newPos);
        Net.move({ x: newPos.x, z: newPos.z });
      }
    }

    // Keyboard attack/task
    if (Input.isAttackPressed()) this._attemptAttack();
    if (Input.isTaskPressed()) this._attemptTask();

    // Camera follows player, top-down angle
    if (candidate) {
      const target = candidate.position.clone();
      this.camera.position.lerp(new THREE.Vector3(target.x, 12, target.z + 10), 0.1);
      this.camera.lookAt(target.x, 0, target.z);
    }

    this.renderer.render(this.scene, this.camera);
  },

  _collides(pos) {
    for (const w of this.map.walls) {
      const dx = Math.abs(pos.x - w.position.x) - w.geometry.parameters.width / 2;
      const dz = Math.abs(pos.z - w.position.z) - w.geometry.parameters.depth / 2;
      if (dx < 0.3 && dz < 0.3) return true; // simple AABB padding
    }
    return false;
  },

  _attemptAttack() {
    // Monster can attack nearest survivor in range
    const meMesh = this.players.get(Net.playerId);
    if (!meMesh || meMesh.userData.role !== 'monster') return;
    let bestId = null, bestDist = Infinity;
    for (const [id, p] of this.players.entries()) {
      if (id === Net.playerId) continue;
      if (p.userData.role !== 'survivor') continue;
      const d = p.position.distanceTo(meMesh.position);
      if (d < bestDist) { bestDist = d; bestId = id; }
    }
    if (bestId && bestDist < 1.6) {
      Net.attack(bestId);
      // visual cue: brief glow
      const orb = meMesh.children[1];
      orb.material.color.set(0xff8888);
      setTimeout(() => orb.material.color.set(0xff4444), 150);
    }
  },

  _attemptTask() {
    // Survivors: interact if near a task zone
    const meMesh = this.players.get(Net.playerId);
    if (!meMesh || meMesh.userData.role !== 'survivor') return;
    const { best, dist } = Tasks.nearestZone(meMesh.position);
    if (best && dist < 1.4) {
      Net.task();
      // feedback
      best.material.color.set(0x66ffaa);
      setTimeout(() => best.material.color.set(0x44ff88), 300);
    }
  }
};