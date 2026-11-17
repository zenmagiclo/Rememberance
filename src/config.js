export const CONFIG = {
  coresRequired: 7,
  worldRadius: 115,
  islandCount: 34,
  enemyCap: 12,
  enemySpawnSeconds: 8,
  player: { height: 1.75, radius: .38, speed: 8.5, jump: 8.5, maxHealth: 100, maxEnergy: 100 },
  colors: {
    material: 0x59eaff,
    echo: 0xc16bff,
    enemy: 0xff4f76,
    gold: 0xffd77a
  }
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = list => list[Math.floor(Math.random() * list.length)];
