
import * as THREE from 'three';
import { CONFIG, rand } from './config.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.phaseObjects = [];
    this.islands = [];
    this.decorations = [];

    this.createLighting();
    this.createGround();
    this.generateIslands();
    this.createSky();
    this.createLandmarks();
  }

  createLighting() {
    this.ambient = new THREE.HemisphereLight(0x9abaff, 0x101326, 1.5);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xb7d9ff, 2.2);
    this.sun.position.set(-30, 65, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -100;
    this.sun.shadow.camera.right = 100;
    this.sun.shadow.camera.top = 100;
    this.sun.shadow.camera.bottom = -100;
    this.scene.add(this.sun);

    this.pulseLight = new THREE.PointLight(
      CONFIG.colors.material,
      70,
      95,
      2
    );

    this.pulseLight.position.set(0, 20, 0);
    this.scene.add(this.pulseLight);
  }

  createGround() {
    const geometry = new THREE.CylinderGeometry(19, 25, 5, 9, 1);

    const material = new THREE.MeshStandardMaterial({
      color: 0x182541,
      roughness: .8,
      metalness: .3
    });

    const base = new THREE.Mesh(geometry, material);
    base.position.set(0, -2.5, 0);
    base.receiveShadow = true;
    base.castShadow = true;
    this.scene.add(base);

    this.addRings(
      new THREE.Vector3(0, .15, 0),
      19,
      CONFIG.colors.material
    );

    this.islands.push({
      x: 0,
      z: 0,
      radius: 18,
      y: 0,
      base: true
    });
  }

  addRings(position, radius, color) {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius + i * .8, .035, 6, 100),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: .48 - i * .1
        })
      );

      ring.rotation.x = Math.PI / 2;
      ring.position.copy(position);
      ring.position.y += .15 + i * .08;
      this.scene.add(ring);
    }
  }

  generateIslands() {
    for (let i = 0; i < CONFIG.islandCount; i++) {
      const angle =
        i / CONFIG.islandCount * Math.PI * 2 + rand(-.15, .15);

      const distance = rand(24, CONFIG.worldRadius);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = rand(-5, 13);
      const radius = rand(5, 10);
      const dimension = Math.random() > .48 ? 1 : 0;

      this.createIsland(x, y, z, radius, dimension);

      if (Math.random() > .3) {
        this.createTower(x, y, z, dimension);
      }

      if (Math.random() > .45) {
        this.createCrystalDecoration(x, y, z, dimension);
      }
    }
  }

  createIsland(x, y, z, radius, dimension) {
    const color = dimension ? 0x302044 : 0x1c3851;

    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * .72,
        radius,
        rand(2.2, 4.5),
        7,
        2
      ),
      new THREE.MeshStandardMaterial({
        color,
        roughness: .78,
        metalness: .22,
        flatShading: true
      })
    );

    mesh.position.set(x, y - 1.4, z);
    mesh.rotation.y = rand(0, Math.PI);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * .72, radius * .72, .28, 7),
      new THREE.MeshStandardMaterial({
        color: dimension ? 0x4b286b : 0x28506a,
        roughness: .85
      })
    );

    top.position.set(x, y + .1, z);
    top.rotation.y = mesh.rotation.y;
    top.receiveShadow = true;
    this.scene.add(top);

    const edge = new THREE.PointLight(
      dimension ? CONFIG.colors.echo : CONFIG.colors.material,
      5,
      18
    );

    edge.position.set(x, y + 1, z);
    this.scene.add(edge);

    this.phaseObjects.push(
      { object: mesh, dimension },
      { object: top, dimension },
      { object: edge, dimension }
    );

    this.islands.push({
      x,
      z,
      radius: radius * .7,
      y,
      dimension
    });
  }

  createTower(x, y, z, dimension) {
    const height = rand(5, 17);
    const width = rand(1.3, 3);
    const tower = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      new THREE.MeshStandardMaterial({
        color: dimension ? 0x49315d : 0x29465e,
        metalness: .45,
        roughness: .48
      })
    );

    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    tower.add(body);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.04, .16, width * 1.04),
      new THREE.MeshBasicMaterial({
        color: dimension ? CONFIG.colors.echo : CONFIG.colors.material
      })
    );

    stripe.position.y = height * .72;
    tower.add(stripe);

    tower.position.set(
      x + rand(-3, 3),
      y,
      z + rand(-3, 3)
    );

    this.scene.add(tower);
    this.phaseObjects.push({ object: tower, dimension });
  }

  createCrystalDecoration(x, y, z, dimension) {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(.5, 1.2), 0),
      new THREE.MeshStandardMaterial({
        color: dimension ? CONFIG.colors.echo : CONFIG.colors.material,
        emissive: dimension ? CONFIG.colors.echo : CONFIG.colors.material,
        emissiveIntensity: 1.4,
        metalness: .3,
        roughness: .2
      })
    );

    crystal.position.set(
      x + rand(-4, 4),
      y + rand(2, 6),
      z + rand(-4, 4)
    );

    crystal.rotation.set(
      rand(0, 3),
      rand(0, 3),
      rand(0, 3)
    );

    this.scene.add(crystal);

    this.decorations.push({
      mesh: crystal,
      baseY: crystal.position.y,
      phase: rand(0, 6)
    });

    this.phaseObjects.push({ object: crystal, dimension });
  }

  createLandmarks() {
    // A distant, oversized ring gives the skyline a recognizable focal point.
    const gate = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8, .45, 12, 80),
      new THREE.MeshStandardMaterial({
        color: CONFIG.colors.echo,
        emissive: CONFIG.colors.echo,
        emissiveIntensity: 1.1,
        metalness: .5
      })
    );

    ring.rotation.y = .25;
    gate.add(ring);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 48),
      new THREE.MeshBasicMaterial({
        color: 0x321b54,
        transparent: true,
        opacity: .52,
        side: THREE.DoubleSide
      })
    );

    gate.add(inner);
    gate.position.set(0, 25, -90);
    this.scene.add(gate);
    this.gate = gate;
  }

  createSky() {
    const stars = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < 1700; i++) {
      positions.push(
        rand(-240, 240),
        rand(25, 180),
        rand(-240, 240)
      );
    }

    stars.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    this.scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          color: 0xa9cfff,
          size: .55,
          transparent: true,
          opacity: .75
        })
      )
    );
  }

  setDimension(dimension) {
    for (const item of this.phaseObjects) {
      item.object.visible = item.dimension === dimension;
    }

    this.ambient.color.setHex(dimension ? 0x9a78c5 : 0x9abaff);
    this.scene.fog.color.setHex(dimension ? 0x1c102c : 0x080d20);

    this.pulseLight.color.setHex(
      dimension ? CONFIG.colors.echo : CONFIG.colors.material
    );
  }

  update(dt, elapsed) {
    for (const item of this.decorations) {
      item.mesh.rotation.y += dt * .5;
      item.mesh.position.y =
        item.baseY + Math.sin(elapsed * 1.3 + item.phase) * .45;
    }

    this.gate.rotation.y += dt * .08;
  }

  findNearestIsland(x, z) {
    let nearest = null;
    let best = Infinity;

    for (const island of this.islands) {
      const d = Math.hypot(island.x - x, island.z - z);

      if (d < best) {
        best = d;
        nearest = island;
      }
    }

    return nearest;
  }
}
