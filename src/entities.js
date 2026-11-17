import * as THREE from 'three';
import { CONFIG, rand } from './config.js';

function glowingMaterial(color, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: .35,
    roughness: .22
  });
}

export class Core {
  constructor(scene, position, id, dimension = 0) {
    this.id = id;
    this.dimension = dimension;
    this.collected = false;
    this.baseY = position.y;
    this.phase = rand(0, 6);
    this.group = new THREE.Group();

    const gem = new THREE.Mesh(
      new THREE.IcosahedronGeometry(.85, 1),
      glowingMaterial(dimension ? CONFIG.colors.echo : CONFIG.colors.material, 2)
    );

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    this.group.add(gem, inner);
    this.group.position.copy(position);
    this.group.add(new THREE.PointLight(
      dimension ? CONFIG.colors.echo : CONFIG.colors.material,
      16,
      10
    ));

    scene.add(this.group);
    this.gem = gem;
  }

  update(dt, elapsed, playerPosition, activeDimension) {
    if (this.collected) return false;

    this.group.visible = this.dimension === activeDimension;
    if (!this.group.visible) return false;

    this.gem.rotation.x += dt * .8;
    this.gem.rotation.y += dt * 1.4;
    this.group.position.y = this.baseY + Math.sin(elapsed * 2 + this.phase) * .35;

    return this.group.position.distanceTo(playerPosition) < 2.3;
  }

  remove(scene) {
    this.collected = true;
    scene.remove(this.group);
  }
}

export class Sentinel {
  constructor(scene, position, id) {
    this.id = id;
    this.health = 65;
    this.maxHealth = 65;
    this.speed = rand(2.4, 3.5);
    this.attackCooldown = rand(.3, 1);
    this.wanderAngle = rand(0, Math.PI * 2);
    this.wanderTimer = rand(1, 4);
    this.dead = false;
    this.group = new THREE.Group();

    const shell = new THREE.Mesh(
      new THREE.DodecahedronGeometry(.9, 1),
      new THREE.MeshStandardMaterial({
        color: 0x3b243f,
        emissive: 0x5d153d,
        emissiveIntensity: 1.2,
        metalness: .6,
        roughness: .3
      })
    );

    shell.scale.set(1, 1.25, .8);
    shell.position.y = 1.15;
    shell.castShadow = true;
    this.group.add(shell);
    this.shell = shell;

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd9e4 })
    );

    eye.position.set(0, 1.35, .72);
    this.group.add(eye);
    this.group.add(new THREE.PointLight(CONFIG.colors.enemy, 5, 7));

    this.group.position.copy(position);
    scene.add(this.group);
  }

  update(dt, playerPosition, slowed) {
    if (this.dead) return null;

    this.attackCooldown -= dt;

    const toPlayer = new THREE.Vector3().subVectors(
      playerPosition,
      this.group.position
    );

    const distance = toPlayer.length();

    if (distance < 34 && distance > 1.7) {
      toPlayer.y = 0;
      toPlayer.normalize();

      this.group.position.addScaledVector(
        toPlayer,
        this.speed * (slowed ? .22 : 1) * dt
      );

      this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    } else if (distance >= 34) {
      this.wanderTimer -= dt;

      if (this.wanderTimer <= 0) {
        this.wanderAngle += rand(-1.8, 1.8);
        this.wanderTimer = rand(1.5, 3.5);
      }

      this.group.position.x += Math.sin(this.wanderAngle) * dt * .7;
      this.group.position.z += Math.cos(this.wanderAngle) * dt * .7;
    }

    this.shell.rotation.y += dt * (slowed ? .3 : 1.1);
    this.group.position.y += Math.sin(performance.now() * .003 + this.id) * dt * .3;

    if (distance < 2.2 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.25;
      return 11;
    }

    return null;
  }

  damage(amount, scene) {
    this.health -= amount;
    this.shell.material.emissiveIntensity = 3.2;

    setTimeout(() => {
      if (!this.dead) this.shell.material.emissiveIntensity = 1.2;
    }, 90);

    if (this.health <= 0) {
      this.dead = true;
      scene.remove(this.group);
      return true;
    }

    return false;
  }
}

export class Pulse {
  constructor(scene, origin, direction) {
    this.life = 1.2;
    this.speed = 48;
    this.damage = 38;

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xb7fbff })
    );

    this.mesh.position.copy(origin);
    this.mesh.add(new THREE.PointLight(CONFIG.colors.material, 5, 5));
    this.direction = direction.clone().normalize();

    scene.add(this.mesh);
  }

  update(dt, scene, enemies) {
    this.life -= dt;
    this.mesh.position.addScaledVector(this.direction, this.speed * dt);

    for (const enemy of enemies) {
      if (!enemy.dead && enemy.group.position.distanceTo(this.mesh.position) < 1.65) {
        const killed = enemy.damage(this.damage, scene);
        scene.remove(this.mesh);
        this.life = 0;
        return { hit: true, killed };
      }
    }

    if (this.life <= 0) scene.remove(this.mesh);
    return null;
  }
}

export class FloatingText {
  constructor(scene, text, position, color = '#8cf7ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText(text, 256, 72);

    const texture = new THREE.CanvasTexture(canvas);

    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );

    this.sprite.scale.set(5, 1.25, 1);
    this.sprite.position.copy(position);
    scene.add(this.sprite);
    this.life = 1.2;
  }

  update(dt, scene) {
    this.life -= dt;
    this.sprite.position.y += dt * .7;
    this.sprite.material.opacity = Math.max(0, this.life / 1.2);

    if (this.life <= 0) scene.remove(this.sprite);
  }
}
