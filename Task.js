// Simple "task" interaction zones for survivors
export const Tasks = {
  zones: [],

  createZones(scene) {
    // Create 3 glowing pillars survivors must interact with
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0x44ff88 });
    const positions = [
      new THREE.Vector3(-4, 0.6, -4),
      new THREE.Vector3(4, 0.6, -3),
      new THREE.Vector3(-2, 0.6, 3)
    ];
    positions.forEach(pos => {
      const mesh = new THREE.Mesh(pillarGeo, pillarMat);
      mesh.position.copy(pos);
      mesh.name = 'TaskZone';
      scene.add(mesh);
      this.zones.push(mesh);
    });
  },

  nearestZone(pos) {
    let best = null, dist = Infinity;
    this.zones.forEach(z => {
      const d = z.position.distanceTo(pos);
      if (d < dist) { dist = d; best = z; }
    });
    return { best, dist };
  }
};