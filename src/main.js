import * as THREE from 'three';
import { CONFIG, clamp, rand } from './config.js';
import { World } from './world.js';
import { Core, Sentinel, Pulse, FloatingText } from './entities.js';

const $ = id => document.getElementById(id);
const boot = $('boot'), hud = $('hud'), pauseScreen = $('pause'), ending = $('ending');
const toast = $('toast'), damageFlash = $('damage-flash');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.id = 'game-canvas';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d20);
scene.fog = new THREE.FogExp2(0x080d20, .0035);

const camera = new THREE.PerspectiveCamera(
  78,
  innerWidth / innerHeight,
  .1,
  450
);

camera.rotation.order = 'YXZ';

const clock = new THREE.Clock();
const world = new World(scene);

const state = {
  started: false,
  paused: false,
  ended: false,
  health: 100,
  energy: 100,
  cores: 0,
  kills: 0,
  dimension: 0,
  slow: false,
  slowTimer: 0,
  dashCooldown: 0,
  pulseCooldown: 0,
  invulnerable: 0,
  elapsed: 0,
  spawnTimer: 3,
  objective: 'Locate the seven Chrono Cores.',
  velocity: new THREE.Vector3(),
  grounded: false
};

const keys = new Set();

const player = {
  position: new THREE.Vector3(0, 2.1, 0),
  yaw: 0,
  pitch: 0,
  radius: .42,
  height: 1.75,
  forward: new THREE.Vector3(),
  right: new THREE.Vector3()
};

const cores = [];
const enemies = [];
const pulses = [];
const floaters = [];
const particles = [];

let toastTimer = 0;
let mouseLocked = false;

function randomCoreLocations() {
  const candidates = world.islands.filter(i => !i.base);
  const chosen = [];

  while (chosen.length < CONFIG.coresRequired && candidates.length) {
    const index = Math.floor(Math.random() * candidates.length);
    const island = candidates.splice(index, 1)[0];
    chosen.push(island);
  }

  chosen.forEach((island, i) => {
    cores.push(
      new Core(
        scene,
        new THREE.Vector3(island.x, island.y + 2.1, island.z),
        i + 1,
        island.dimension ?? 0
      )
    );
  });
}

randomCoreLocations();

function makeEnemy() {
  const islands = world.islands.filter(
    i => Math.hypot(
      i.x - player.position.x,
      i.z - player.position.z
    ) > 20
  );

  const island = islands[Math.floor(Math.random() * islands.length)];
  if (!island) return;

  enemies.push(
    new Sentinel(
      scene,
      new THREE.Vector3(island.x, island.y + .4, island.z),
      enemies.length + state.kills + 1
    )
  );
}

function notify(message, duration = 2.5) {
  toast.textContent = message;
  toast.style.opacity = '1';
  toastTimer = duration;
}

function updateHUD() {
  $('health-fill').style.width =
    `${clamp(state.health, 0, 100)}%`;

  $('energy-fill').style.width =
    `${clamp(state.energy, 0, 100)}%`;

  $('energy-number').textContent = Math.floor(state.energy);
  $('core-count').textContent =
    `${state.cores} / ${CONFIG.coresRequired}`;

  $('enemy-count').textContent = state.kills;

  $('dimension-name').textContent =
    state.dimension ? 'ECHO' : 'MATERIAL';

  $('dimension-name').style.color =
    state.dimension ? '#c17aff' : '#63f5ff';

  $('objective').textContent = state.objective;

  $('ability-state').textContent =
    `${state.dimension ? 'ECHO' : 'MATERIAL'} REALITY　·　` +
    `${state.slow ? 'TIME DISTORTION ACTIVE' : 'F SLOW TIME'}　·　E PULSE`;
}

function makeBurst(position, color, count = 12) {
  const geometry = new THREE.SphereGeometry(.055, 5, 5);

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true
      })
    );

    mesh.position.copy(position);

    const velocity = new THREE.Vector3(
      rand(-1, 1),
      rand(-.2, 1.4),
      rand(-1, 1)
    ).multiplyScalar(rand(2, 6));

    scene.add(mesh);

    particles.push({
      mesh,
      velocity,
      life: rand(.35, .9),
      maxLife: .9
    });
  }
}

function playerDamage(amount) {
  if (state.invulnerable > 0 || state.ended) return;

  state.health = Math.max(0, state.health - amount);
  state.invulnerable = .75;

  damageFlash.style.background = 'rgba(255,35,75,.25)';

  setTimeout(() => {
    damageFlash.style.background = 'rgba(255,35,75,0)';
  }, 110);

  notify('INTEGRITY COMPROMISED');

  if (state.health <= 0) finish(false);
}

function updatePlayer(dt) {
  const forwardInput =
    (keys.has('KeyW') ? 1 : 0) -
    (keys.has('KeyS') ? 1 : 0);

  const sideInput =
    (keys.has('KeyD') ? 1 : 0) -
    (keys.has('KeyA') ? 1 : 0);

  const direction = new THREE.Vector3();

  player.forward.set(
    -Math.sin(player.yaw),
    0,
    -Math.cos(player.yaw)
  );

  player.right.set(
    Math.cos(player.yaw),
    0,
    -Math.sin(player.yaw)
  );

  direction
    .addScaledVector(player.forward, forwardInput)
    .addScaledVector(player.right, sideInput);

  if (direction.lengthSq() > 0) direction.normalize();

  const speed =
    CONFIG.player.speed *
    (keys.has('ShiftLeft') && state.dashCooldown <= 0 ? 2.8 : 1);

  if (
    keys.has('ShiftLeft') &&
    direction.lengthSq() > 0 &&
    state.dashCooldown <= 0
  ) {
    state.dashCooldown = .9;
    state.invulnerable = .25;

    makeBurst(
      player.position,
      state.dimension ? CONFIG.colors.echo : CONFIG.colors.material,
      18
    );
  }

  player.position.addScaledVector(direction, speed * dt);

  if (keys.has('Space') && state.grounded) {
    state.velocity.y = CONFIG.player.jump;
    state.grounded = false;
  }

  state.velocity.y -= 19 * dt;
  player.position.y += state.velocity.y * dt;

  // Approximate landing on the top surface of generated islands.
  let floorY = -100;

  for (const island of world.islands) {
    if (
      island.dimension !== undefined &&
      island.dimension !== state.dimension
    ) continue;

    const d = Math.hypot(
      player.position.x - island.x,
      player.position.z - island.z
    );

    if (d < island.radius && island.y > floorY) {
      floorY = island.y;
    }
  }

  if (player.position.y <= floorY + CONFIG.player.height) {
    player.position.y = floorY + CONFIG.player.height;
    player.velocity.y = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  if (player.position.y < -28) {
    player.position.set(0, 5, 0);
    player.velocity.set(0, 0, 0);
    playerDamage(25);
    notify('REALITY RELOCATED YOU');
  }

  player.position.x = clamp(player.position.x, -145, 145);
  player.position.z = clamp(player.position.z, -145, 145);

  camera.position.copy(player.position);
  camera.position.y += .12;
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function toggleDimension() {
  state.dimension = 1 - state.dimension;

  world.setDimension(state.dimension);

  makeBurst(
    player.position,
    state.dimension ? CONFIG.colors.echo : CONFIG.colors.material,
    26
  );

  notify(
    state.dimension
      ? 'ENTERED THE ECHO REALITY'
      : 'RETURNED TO MATERIAL REALITY'
  );
}

function activateSlowTime() {
  if (state.slow || state.energy < 28) {
    notify('CHRONO ENERGY INSUFFICIENT');
    return;
  }

  state.energy -= 28;
  state.slow = true;
  state.slowTimer = 4.5;

  notify('TIME IS LOSING ITS GRIP');
}

function firePulse() {
  if (state.energy < 18 || state.pulseCooldown > 0) {
    notify('PULSE SYSTEM RECHARGING');
    return;
  }

  state.energy -= 18;
  state.pulseCooldown = .35;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  const origin = camera.position
    .clone()
    .addScaledVector(direction, 1.2);

  pulses.push(new Pulse(scene, origin, direction));

  makeBurst(origin, CONFIG.colors.material, 5);
}

function collectCore(core) {
  core.remove(scene);

  state.cores++;
  state.energy = Math.min(100, state.energy + 22);
  state.health = Math.min(100, state.health + 8);

  makeBurst(core.group.position, CONFIG.colors.gold, 34);

  floaters.push(
    new FloatingText(
      scene,
      'CORE RECOVERED',
      core.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      '#ffe08a'
    )
  );

  notify(`CHRONO CORE ${state.cores} / 7 RECOVERED`);

  if (state.cores >= CONFIG.coresRequired) {
    state.objective =
      'Return to the central gate. The final sequence is ready.';

    world.gate.position.set(0, 8, -28);
    world.gate.scale.setScalar(1.5);

    notify('ALL CORES FOUND — THE GATE HAS AWAKENED', 4);
  } else {
    state.objective =
      `Recover the remaining ${CONFIG.coresRequired - state.cores} Chrono Cores.`;
  }
}

function updateMinimap() {
  const canvas = $('minimap');
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 150, 150);
  ctx.fillStyle = 'rgba(5,10,25,.88)';
  ctx.fillRect(0, 0, 150, 150);

  ctx.strokeStyle = 'rgba(99,245,255,.18)';

  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(75, 75, i * 21, 0, Math.PI * 2);
    ctx.stroke();
  }

  const scale = 140 / (CONFIG.worldRadius * 2.2);

  for (const island of world.islands) {
    if (
      island.dimension !== undefined &&
      island.dimension !== state.dimension
    ) continue;

    ctx.fillStyle = '#35516b';

    ctx.fillRect(
      75 + island.x * scale - 1.5,
      75 + island.z * scale - 1.5,
      3,
      3
    );
  }

  for (const core of cores) {
    if (!core.collected && core.dimension === state.dimension) {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();

      ctx.arc(
        75 + core.group.position.x * scale,
        75 + core.group.position.z * scale,
        3,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }

  for (const enemy of enemies) {
    if (!enemy.dead) {
      ctx.fillStyle = '#ff5478';

      ctx.fillRect(
        75 + enemy.group.position.x * scale - 2,
        75 + enemy.group.position.z * scale - 2,
        4,
        4
      );
    }
  }

  ctx.save();
  ctx.translate(75, 75);
  ctx.rotate(-player.yaw);
  ctx.fillStyle = '#63f5ff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-4, 5);
  ctx.lineTo(4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function finish(won) {
  state.ended = true;
  document.exitPointerLock?.();

  ending.classList.remove('hidden');

  $('ending-title').textContent =
    won ? 'THE CITY REMEMBERS' : 'YOU WERE ERASED';

  $('ending-copy').textContent = won
    ? `You recovered all seven cores and stabilized the timeline. Sentinels neutralized: ${state.kills}.`
    : `The timeline fractured before you could finish. Cores recovered: ${state.cores} / ${CONFIG.coresRequired}.`;
}

function checkGate() {
  if (state.cores < CONFIG.coresRequired) return;

  const gatePosition = new THREE.Vector3(0, 8, -28);

  if (player.position.distanceTo(gatePosition) < 7) {
    finish(true);
  }
}

function tick() {
  requestAnimationFrame(tick);

  const rawDt = Math.min(clock.getDelta(), .04);

  if (!state.started || state.paused || state.ended) {
    renderer.render(scene, camera);
    return;
  }

  const dt = rawDt;

  state.elapsed += dt;
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.pulseCooldown = Math.max(0, state.pulseCooldown - dt);

  state.energy = Math.min(
    100,
    state.energy + (state.slow ? 0 : 3.2 * dt)
  );

  state.health = Math.min(100, state.health + .55 * dt);

  if (state.slow) {
    state.slowTimer -= dt;

    if (state.slowTimer <= 0) {
      state.slow = false;
      notify('TEMPORAL DISTORTION ENDED');
    }
  }

  updatePlayer(dt);
  world.update(dt, state.elapsed);

  for (const core of cores) {
    if (
      !core.collected &&
      core.update(dt, state.elapsed, player.position, state.dimension)
    ) {
      collectCore(core);
    }
  }

  for (const enemy of enemies) {
    if (enemy.dead) continue;

    const damage = enemy.update(
      dt,
      player.position,
      state.slow
    );

    if (damage) playerDamage(damage);
  }

  for (let i = pulses.length - 1; i >= 0; i--) {
    const result = pulses[i].update(dt, scene, enemies);

    if (result?.killed) {
      state.kills++;
      state.energy = Math.min(100, state.energy + 9);
    }

    if (pulses[i].life <= 0) {
      pulses.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.velocity.y -= 4 * dt;

    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].update(dt, scene);

    if (floaters[i].life <= 0) {
      floaters.splice(i, 1);
    }
  }

  state.spawnTimer -= dt;

  if (
    state.spawnTimer <= 0 &&
    enemies.filter(e => !e.dead).length < CONFIG.enemyCap
  ) {
    makeEnemy();
    state.spawnTimer = CONFIG.enemySpawnSeconds;
  }

  if (toastTimer > 0) {
    toastTimer -= dt;

    if (toastTimer <= 0) {
      toast.style.opacity = '0';
    }
  }

  checkGate();
  updateHUD();
  updateMinimap();

  renderer.render(scene, camera);
}

function startGame() {
  state.started = true;
  boot.classList.add('hidden');
  hud.classList.remove('hidden');

  renderer.domElement.requestPointerLock?.();

  notify('WELCOME, WANDERER');
}

function pauseGame() {
  if (!state.started || state.ended) return;

  state.paused = true;
  pauseScreen.classList.remove('hidden');

  document.exitPointerLock?.();
}

function resumeGame() {
  state.paused = false;
  pauseScreen.classList.add('hidden');

  renderer.domElement.requestPointerLock?.();
}

$('start-button').addEventListener('click', startGame);
$('resume-button').addEventListener('click', resumeGame);

$('restart-button').addEventListener('click', () => {
  location.reload();
});

document.addEventListener('pointerlockchange', () => {
  mouseLocked =
    document.pointerLockElement === renderer.domElement;

  if (
    state.started &&
    !mouseLocked &&
    !state.paused &&
    !state.ended
  ) {
    pauseGame();
  }
});

document.addEventListener('mousemove', event => {
  if (!mouseLocked || state.paused) return;

  player.yaw -= event.movementX * .0022;
  player.pitch -= event.movementY * .002;

  player.pitch = clamp(player.pitch, -1.42, 1.42);
});

document.addEventListener('keydown', event => {
  keys.add(event.code);

  if (
    event.code === 'Escape' &&
    state.started &&
    !state.paused
  ) {
    pauseGame();
  }

  if (
    event.code === 'KeyQ' &&
    state.started &&
    !state.paused
  ) {
    toggleDimension();
  }

  if (
    event.code === 'KeyF' &&
    state.started &&
    !state.paused
  ) {
    activateSlowTime();
  }

  if (
    event.code === 'KeyE' &&
    state.started &&
    !state.paused
  ) {
    firePulse();
  }

  if (event.code === 'Space') {
    event.preventDefault();
  }
});

document.addEventListener('keyup', event => {
  keys.delete(event.code);
});

renderer.domElement.addEventListener('click', () => {
  if (
    state.started &&
    !state.paused &&
    !state.ended &&
    !mouseLocked
  ) {
    renderer.domElement.requestPointerLock?.();
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
});

updateHUD();
tick();
