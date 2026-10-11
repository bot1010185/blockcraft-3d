/* Blockcraft 3D mobs (Amir)
   import { MobManager } from './mobs.js';
   const mobs = new MobManager(scene, world);
     // world: { isSolid(x,y,z), isDay(), getLight?(x,y,z), isGrass?(x,y,z), isWater?(x,y,z), isLava?(x,y,z), isDoor?(x,y,z), boxesAt?(x,y,z),
     //         isFire?(x,y,z), isFence?(x,y,z), isRaining?(x,z), biomeAt?(x,z) }
     // (water / lava / doors / slab+stair boxes fall back to blocks.js + window.game.world when not given)
   mobs.onDrop = (item, pos, count) => {}; mobs.onExplode = (pos, radius) => {}; mobs.onSound = (name, pos, { pitch, volume }) => {};
   mobs.difficulty = 'normal';   // 'easy' | 'normal' | 'hard' (zombies only break doors on hard, like MC) | 'peaceful'; scales damage to the player like MC
   mobs.onXp = (amount, pos) => {};      // player kills: hostiles 5, baby zombie 12, slime = size, animals 1-3, breeding 1-7
   mobs.explode(pos, power);             // TNT etc.: MC impact damage + knockback to mobs (player/blocks stay engine-side)
   mobs.onBreakDoor = (x, y, z) => {};   // optional: zombies break closed oak doors (lower-half coords); omit and doors stay walls
   each frame: mobs.spawnAround(player); mobs.update(dt, player);   // player: { position (feet), hurt(amount, fromPos), camera? }
   on left click: mobs.attack(raycaster | ray | mob, damage, { reach })
   on right click: mobs.interact(raycaster | ray | mob, itemId, { reach }) -> { mob, consumed }   // feeding, breeding, taming / sitting wolves
   Mobs: zombie (+5% babies), skeleton, creeper, spider, enderman, slime, pig, cow, sheep, chicken, wolf, squid.
   See MOBS.md for details. */
import * as THREE from './vendor/three.module.js';
import { BLOCKS } from './blocks.js';
import { MOB_MODELS, paintMobSkin, WOOL_COLORS, MOB_LIST } from './mob-textures.js';

const PX = 1 / 16;
const GRAV = 28, JUMP_V = 8.4, TERMINAL = -40;
const TAU = Math.PI * 2;

export const MOB_TYPES = {
  zombie:   { hostile: true, hp: 20, w: .6, h: 1.95, speed: 2.5, wander: 1.0, dmg: 3, burns: true, follow: 35, drops: [['rotten_flesh', 0, 2]] },
  skeleton: { hostile: true, hp: 20, w: .6, h: 1.99, speed: 2.5, wander: 1.0, dmg: 3, burns: true, follow: 24, drops: [['bone', 0, 2]] },
  creeper:  { hostile: true, hp: 20, w: .6, h: 1.7, speed: 2.3, wander: 1.0, follow: 22, drops: [['gunpowder', 0, 2]] },
  spider:   { hostile: true, hp: 16, w: 1.4, h: .9, speed: 3.3, wander: 1.3, dmg: 2, climbs: true, follow: 22, drops: [['string', 0, 2]] },
  pig:      { hp: 10, food: 'carrot', w: .9, h: .9, speed: 3.4, wander: 1.2, drops: [['porkchop', 1, 3]] },
  cow:      { hp: 10, food: 'wheat', w: .9, h: 1.4, speed: 3.2, wander: 1.1, drops: [['beef', 1, 3], ['leather', 0, 2]] },
  sheep:    { hp: 8, food: 'wheat', w: .9, h: 1.3, speed: 3.2, wander: 1.1, drops: [['mutton', 1, 2]] },
  chicken:  { hp: 4, food: 'wheat_seeds', lays: 'egg', w: .4, h: .7, speed: 3.0, wander: .9, slowFall: true, drops: [['chicken', 1, 1], ['feather', 0, 2]] },
  // round 3
  enderman: { hostile: true, neutral: true, hp: 40, w: .6, h: 2.9, speed: 3.4, wander: .9, dmg: 7, follow: 64, drops: [['ender_pearl', 0, 1]] },
  slime:    { hostile: true, hp: 16, w: .51, h: .51, speed: 2.6, wander: 1.4, dmg: 0, follow: 16, noIdle: true, drops: [['slime_ball', 0, 2]] },
  wolf:     { hp: 8, w: .6, h: .85, speed: 3.6, wander: 1.1, dmg: 3, tameDmg: 4, follow: 20, drops: [] },
  squid:    { hp: 10, w: .8, h: .95, speed: 2.2, wander: 1.0, swims: true, drops: [['ink_sac', 1, 3]] },
};
// meat a tamed wolf eats to heal (only ids that exist in ui-data.js are ever held, so unknown ones are harmless)
const WOLF_FOOD = { porkchop: 3, cooked_porkchop: 8, beef: 3, cooked_beef: 8, chicken: 2, cooked_chicken: 6, mutton: 2, cooked_mutton: 6, rotten_flesh: 4 };
export { MOB_LIST };
const BABY_GROW = 1200, BREED_CD = 300, LOVE_TIME = 30, PATH_MAX_NODES = 400, PATH_EVERY = .5, PATHS_PER_FRAME = 3;
// overworld weights roughly like the real game (zombie 95, skeleton/creeper/spider 100, enderman 10 -> ~2.5% here)
const HOSTILE_WEIGHTS = [['zombie', 35], ['skeleton', 25], ['creeper', 25], ['spider', 15], ['enderman', 2.5]];
const PASSIVE_WEIGHTS = [['pig', 30], ['cow', 25], ['sheep', 30], ['chicken', 15], ['wolf', 7]];
const BABY_ZOMBIE = .05, SLIME_MAX_Y = 40, WATER_CAP = 5;
const FIRE_DMG = 1, FIRE_AFTER_FIRE = 4, WOLF_BIOMES = /forest|taiga|spruce|grove|snowy|pine/i;
// XP like Minecraft: hostiles 5 (baby zombie 12), slimes = size, animals 1-3 (babies 0); only for player (or tamed-wolf) kills
const XP = { zombie: 5, skeleton: 5, creeper: 5, spider: 5, enderman: 5 };
const DOOR_BREAK_TIME = 8, STEP_H = .6, LAVA_DMG = 4, FIRE_AFTER_LAVA = 8;
const COOKED = { porkchop: 'cooked_porkchop', beef: 'cooked_beef', mutton: 'cooked_mutton', chicken: 'cooked_chicken' };
const BX = new Float64Array(6 * 64);   // scratch: collision boxes overlapping a mob
const BABY_SND = { pitch: 1.45 }, SLIME_SND = { 1: { pitch: 1.5, volume: .6 }, 2: { pitch: 1.1, volume: .85 }, 4: { pitch: .75, volume: 1 } };

// scratch objects so the hot loops never allocate
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const rand = Math.random;
const wrapA = a => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pickW = list => { let t = 0; for (const [, w] of list) t += w; let r = rand() * t; for (const [n, w] of list) { if ((r -= w) <= 0) return n; } return list[0][0]; };

/* ---------------------------------------------------------------- materials */
// Per-mob uniforms: flash (rgb + strength) for hurt red / creeper white, fade (dithered death fade), light (world light).
function patchMobMaterial(mat, u, unlit) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlash = u.flash; sh.uniforms.uFade = u.fade; sh.uniforms.uLight = u.light;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform vec4 uFlash; uniform float uFade; uniform float uLight;
float mobB2(vec2 v){ return mod(v.x * 2.0 + v.y * 3.0, 4.0); }
void main() {
  if (uFade < 0.999) { vec2 p = mod(floor(gl_FragCoord.xy), 4.0); float t = (4.0 * mobB2(mod(p, 2.0)) + mobB2(floor(p / 2.0)) + 0.5) / 16.0; if (t > uFade) discard; }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
  ${unlit ? '' : 'gl_FragColor.rgb *= uLight;'}
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlash.rgb, uFlash.a);`);
  };
  mat.customProgramCacheKey = () => unlit ? 'mob-unlit-1' : 'mob-lit-1';
  return mat;
}

// One skinned geometry per material layer per mob type: every box part becomes a rigid "bone", so a whole mob draws in
// 1 call (2 with wool / glowing eyes / slime shell) instead of one call per box. Mobs of a type share geometry + texture.
const LAYERS = ['skin', 'wool', 'eyes', 'shell'];
const IDENT = new THREE.Matrix4();
class TypeAssets {
  constructor(type) {
    const skin = paintMobSkin(type), model = MOB_MODELS[type];
    this.model = model;
    const tex = this.tex = new THREE.CanvasTexture(skin.canvas);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    // bind pose: the raw model pose with the mob at the origin
    const objs = {}, root = new THREE.Object3D();
    for (const p of model.parts) {
      const o = new THREE.Object3D(), par = p.parent ? model.parts.find(q => q.name === p.parent) : null;
      o.position.set((p.pivot[0] - (par ? par.pivot[0] : 0)) * PX, (p.pivot[1] - (par ? par.pivot[1] : 0)) * PX, (p.pivot[2] - (par ? par.pivot[2] : 0)) * PX);
      o.rotation.order = p.order || 'XYZ'; o.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      (par ? objs[par.name] : root).add(o); objs[p.name] = o;
    }
    root.updateMatrixWorld(true);
    this.boneInverses = model.parts.map(p => objs[p.name].matrixWorld.clone().invert());
    const order = ['left', 'right', 'top', 'bottom', 'front', 'back']; // three.js BoxGeometry face order: +x,-x,+y,-y,+z,-z
    const shade = [.72, .72, 1, .52, .86, .86]; // baked Minecraft-style face shading (used when the scene has no lights)
    const byLayer = {};
    model.parts.forEach((p, bi) => {
      const inf = p.inflate * 2;
      const g = new THREE.BoxGeometry((p.size[0] + inf) * PX, (p.size[1] + inf) * PX, (p.size[2] + inf) * PX);
      const uv = g.attributes.uv, R = skin.rects[p.name];
      order.forEach((face, fi) => {
        const [x, y, w, h] = R[face], u0 = x / skin.W, u1 = (x + w) / skin.W, vt = 1 - y / skin.H, vb = 1 - (y + h) / skin.H, i = fi * 4;
        uv.setXY(i, u0, vt); uv.setXY(i + 1, u1, vt); uv.setXY(i + 2, u0, vb); uv.setXY(i + 3, u1, vb);
      });
      g.translate(p.off[0] * PX, p.off[1] * PX, p.off[2] * PX); g.applyMatrix4(objs[p.name].matrixWorld);
      (byLayer[p.layer] ||= []).push({ g, bi });
    });
    this.layers = []; this.geo = {};
    for (const layer of LAYERS) {
      const list = byLayer[layer]; if (!list) continue;
      let nv = 0, ni = 0; for (const { g } of list) { nv += g.attributes.position.count; ni += g.index.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), colr = new Float32Array(nv * 3);
      const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), idx = new Uint16Array(ni);
      let v = 0, k = 0;
      for (const { g, bi } of list) {
        const n = g.attributes.position.count;
        pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3); uvs.set(g.attributes.uv.array, v * 2);
        for (let j = 0; j < n; j++) { const f = (j / 4) | 0, c = shade[f]; colr[(v + j) * 3] = colr[(v + j) * 3 + 1] = colr[(v + j) * 3 + 2] = c; si[(v + j) * 4] = bi; sw[(v + j) * 4] = 1; }
        const gi = g.index.array; for (let j = 0; j < gi.length; j++) idx[k + j] = gi[j] + v;
        v += n; k += gi.length; g.dispose();
      }
      const G = new THREE.BufferGeometry();
      G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      G.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); G.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      G.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); G.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      G.setIndex(new THREE.BufferAttribute(idx, 1)); G.computeBoundingSphere();
      this.geo[layer] = G; this.layers.push(layer);
    }
    // generous bounds (animation moves limbs; frustum culling uses this instead of re-skinning on the CPU)
    const bs = this.geo.skin.boundingSphere; this.bCenter = bs.center.clone(); this.bRadius = bs.radius * 1.25 + .25;
  }
}

/* ---------------------------------------------------------------- shared FX */
// boxes: [[size xyz], [centre xyz], hex colour] -> one BufferGeometry with vertex colours
function mergeColoredBoxes(boxes) {
  const pos = [], nor = [], colr = [], idx = []; let base = 0; const c = new THREE.Color();
  for (const [sz, at, hex] of boxes) {
    const g = new THREE.BoxGeometry(sz[0], sz[1], sz[2]); g.translate(at[0], at[1], at[2]); c.setHex(hex);
    const n = g.attributes.position.count; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < n; i++) colr.push(c.r, c.g, c.b); for (const i of g.index.array) idx.push(i + base); base += n; g.dispose();
  }
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  G.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); G.setIndex(idx); return G;
}
function makeShadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}
function makeFireTex() {
  // 4 frames of chunky pixel flames, stacked vertically (16x64)
  const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d');
  let s = 99; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cols = ['#fff3a0', '#ffd23f', '#ffa21f', '#f2661a', '#c43a12'];
  for (let f = 0; f < 4; f++) for (let x = 0; x < 16; x++) {
    const hgt = 6 + Math.floor(r() * 9 + 3 * Math.sin((x + f * 3) * .9));
    for (let y = 0; y < hgt; y++) { const k = Math.min(4, Math.floor((y / hgt) * 4 + r() * 1.2)); g.fillStyle = cols[k]; g.fillRect(x, f * 16 + 15 - y, 1, 1); }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1, .25); return t;
}

class Particles {
  constructor(parent, n = 600) {
    this.n = n; this.next = 0;
    this.pos = new Float32Array(n * 3).fill(-1e5); this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.grav = new Float32Array(n);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: .13, vertexColors: true, sizeAttenuation: true }));
    this.points.frustumCulled = false; parent.add(this.points); this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b, grav = -2) {
    const i = this.next; this.next = (i + 1) % this.n; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b; this.life[i] = life; this.grav[i] = grav; this.active = 1.5;
  }
  update(dt) {
    if (this.active <= 0) return; let any = false;
    const P = this.pos, V = this.vel, L = this.life, drag = Math.max(0, 1 - 2.5 * dt);
    for (let i = 0; i < this.n; i++) {
      if (L[i] <= 0) continue; any = true; const k = i * 3;
      L[i] -= dt; if (L[i] <= 0) { P[k + 1] = -1e5; continue; }
      V[k + 1] += this.grav[i] * dt; V[k] *= drag; V[k + 2] *= drag;
      P[k] += V[k] * dt; P[k + 1] += V[k + 1] * dt; P[k + 2] += V[k + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    if (!any) this.active -= dt;
  }
}

/* ---------------------------------------------------------------- path finding */
// Bounded grid A* over standable cells (feet cell free, body free above it, solid or water below).
// Moves: 8-way walk (no corner cutting), 1-block step up, drops of up to 3 blocks (any depth into water).
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  clear() { this.a.length = 0; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= n.f) break; a[i] = a[p]; i = p; } a[i] = n; }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { let i = 0; const n = a.length; for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mf = last.f; if (l < n && a[l].f < mf) { m = l; mf = a[l].f; } if (r < n && a[r].f < mf) m = r; if (m < 0) break; a[i] = a[m]; i = m; } a[i] = last; } return top; }
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
class PathFinder {
  constructor(mgr) { this.mgr = mgr; this.heap = new Heap(); this.nodes = new Map(); this.sc = new Map(); this.wc = new Map(); this.lc = new Map(); this.dset = new Set(); this.doors = false; this.ox = 0; this.oy = 0; this.oz = 0; this.lastExpanded = 0; }
  key(x, y, z) { return ((x - this.ox + 512) * 1024 + (z - this.oz + 512)) * 512 + (y - this.oy + 256); }
  solid(x, y, z) { const k = this.key(x, y, z); let v = this.sc.get(k); if (v === undefined) { v = !!this.mgr.world.isSolid(x, y, z);
      // zombies (when the engine set onBreakDoor) plan straight through closed wooden doors, at a cost, and break them on arrival
      if (v && this.doors && this.mgr.isDoor(x, y, z)) { v = false; this.dset.add(k); }
      this.sc.set(k, v); } return v; }
  lava(x, y, z) { const k = this.key(x, y, z); let v = this.lc.get(k); if (v === undefined) { v = this.mgr.isLava(x, y, z) || this.mgr.isFire(x, y, z); this.lc.set(k, v); } return v; }   // lava or fire
  tall(x, y, z) { return this.solid(x, y, z) && this.mgr.isTall(x, y, z); }   // fences / walls: 1.5 high, can't be jumped or stood on
  water(x, y, z) { const k = this.key(x, y, z); let v = this.wc.get(k); if (v === undefined) { v = this.mgr.isWater(x, y, z); this.wc.set(k, v); } return v; }
  free(x, y, z, hc) { for (let i = 0; i < hc; i++) if (this.solid(x, y + i, z) || this.lava(x, y + i, z)) return false; return true; }   // lava counts as a wall
  stand(x, y, z, hc) { return this.free(x, y, z, hc) && ((this.solid(x, y - 1, z) && !this.tall(x, y - 1, z)) || this.water(x, y - 1, z) || this.water(x, y, z)); }
  /** returns an array of {x,y,z} cells from (excluding) start toward goal, the closest reachable cell if the goal can't be reached in budget, or null */
  find(sx, sy, sz, gx, gy, gz, hc, maxDrop = 3, doors = false) {
    this.ox = sx; this.oy = sy; this.oz = sz; this.sc.clear(); this.wc.clear(); this.lc.clear(); this.dset.clear(); this.doors = doors; this.nodes.clear(); this.heap.clear();
    const H = (x, y, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx > dz ? dx + .414 * dz : dz + .414 * dx) + Math.abs(y - gy) * .5; };
    const start = { x: sx, y: sy, z: sz, g: 0, f: H(sx, sy, sz), p: null, closed: false };
    this.nodes.set(this.key(sx, sy, sz), start); this.heap.push(start);
    let best = start, bestH = start.f, expanded = 0, goal = null;
    const add = (x, y, z, cost, par) => {
      const k = this.key(x, y, z), g = par.g + cost; let n = this.nodes.get(k);
      if (n) { if (n.closed || g >= n.g) return; n.g = g; n.f = g + H(x, y, z); n.p = par; this.heap.push(n); return; }
      n = { x, y, z, g, f: g + H(x, y, z), p: par, closed: false }; this.nodes.set(k, n); this.heap.push(n);
    };
    while (this.heap.size && expanded < PATH_MAX_NODES) {
      const c = this.heap.pop(); if (c.closed) continue; c.closed = true; expanded++;
      const h = c.f - c.g; if (h < bestH) { bestH = h; best = c; }
      if (Math.abs(c.x - gx) <= 1 && Math.abs(c.z - gz) <= 1 && Math.abs(c.y - gy) <= 1) { goal = c; break; }
      const inW = this.water(c.x, c.y, c.z);
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dz = DIRS[d][1], nx = c.x + dx, nz = c.z + dz, diag = d >= 4, base = diag ? 1.414 : 1;
        if (diag && (!this.free(c.x + dx, c.y, c.z, hc) || !this.free(c.x, c.y, c.z + dz, hc))) continue;
        if (this.free(nx, c.y, nz, hc)) {
          if (this.stand(nx, c.y, nz, hc)) { add(nx, c.y, nz, base * (this.water(nx, c.y, nz) || this.water(nx, c.y - 1, nz) ? 2.5 : 1) + (this.dset.size && (this.dset.has(this.key(nx, c.y, nz)) || this.dset.has(this.key(nx, c.y + 1, nz))) ? 8 : 0), c); continue; }
          // drop down
          for (let k = 1; k <= 24; k++) {
            const y = c.y - k; if (this.solid(nx, y, nz) || this.lava(nx, y, nz)) break;
            const wet = this.water(nx, y, nz) || this.water(nx, y - 1, nz);
            if (k > maxDrop && !wet) { if (this.solid(nx, y - 1, nz)) break; continue; }
            if (this.stand(nx, y, nz, hc)) { add(nx, y, nz, base + k * .4, c); break; }
          }
        } else if (!diag && (this.solid(nx, c.y, nz) || inW) && !this.tall(nx, c.y, nz) && this.free(c.x, c.y + hc, c.z, 1) && this.stand(nx, c.y + 1, nz, hc)) {
          add(nx, c.y + 1, nz, base + 1, c); // step / jump up one block
        }
      }
    }
    this.lastExpanded = expanded;
    const end = goal || (best !== start ? best : null); if (!end) return null;
    const out = []; for (let n = end; n && n !== start; n = n.p) out.push(n); out.reverse();
    return out;
  }
}

/* ---------------------------------------------------------------- Mob */
export class Mob {
  constructor(mgr, type, x, y, z, opts = {}) {
    this.mgr = mgr; this.type = type; const def = this.def = MOB_TYPES[type];
    this.hostile = !!def.hostile; this.hp = this.maxHp = def.hp; this.w = def.w; this.h = def.h;
    this.vel = new THREE.Vector3(); this.yaw = opts.yaw ?? rand() * TAU; this.moveYaw = this.yaw; this.moveSpeed = 0;
    this.headYaw = 0; this.headPitch = 0; this.lookX = 0; this.lookY = 0; this.lookZ = 0; this.looking = false;
    this.onGround = false; this.hitWall = false; this.stuckT = 0; this.fallStart = y;
    this.invul = 0; this.hurtT = 0; this.noCtrl = 0; this.dead = false; this.deathT = 0; this.removed = false;
    this.walkPhase = rand() * 6; this.walkAmt = 0; this.age = 0;
    this.state = 'idle'; this.stateT = rand() * 2; this.fleeT = 0; this.fleeX = 0; this.fleeZ = 0;
    this.attackCD = 0; this.swingT = 0; this.aimT = 0; this.shootCD = 1 + rand(); this.strafe = rand() < .5 ? 1 : -1; this.strafeT = 2;
    this.fuse = 0; this.fusing = false; this.anger = 0; this.leapCD = 0; this.graze = 0;
    this.burning = false; this.burnTick = 0; this.fireT = 0; this.xpT = -1e9; this.inFire = false; this.fireBlockT = 0; this.skyOpen = false; this.lavaT = 0; this.inLava = false; this.doorKey = null; this.doorT = 0; this.knockT = 0; this.sunlit = false; this.envT = 0; this.chasing = false; this.seen = false; this.losT = 0;
    this.idleSoundT = 5 + rand() * 15; this.side = rand() < .5 ? 1 : -1;
    this.woolColor = null;
    this.path = null; this.pathI = 0; this.pathT = rand() * PATH_EVERY; this.wpT = 0; this.navDirect = true;
    this.inWater = false; this.headWet = false;
    this.baby = !!opts.baby; this.growT = this.baby ? (opts.growT ?? BABY_GROW) : 0; this.loveT = 0; this.breedCD = opts.breedCD ?? 0; this.partner = null;
    this.eggT = this.def.lays ? 300 + rand() * 300 : 0; this.tempted = false;

    // visuals: per-mob materials (own flash/fade/light uniforms, shared program + texture), skinned meshes sharing one skeleton
    const A = mgr._assets(type);
    this.u = { flash: { value: new THREE.Vector4(1, 0, 0, 0) }, fade: { value: 1 }, light: { value: 1 } };
    const baked = mgr.lighting === 'baked', Mat = baked ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    const mk = (o = {}) => patchMobMaterial(new Mat({ map: A.tex, alphaTest: .5, vertexColors: baked, side: A.model.doubleSided ? THREE.DoubleSide : THREE.FrontSide, ...o }), this.u, false);
    this.mat = mk(); this.mats = [this.mat];
    if (type === 'sheep') {
      const wc = opts.wool ? WOOL_COLORS.find(c => c.name === opts.wool) : pickW(WOOL_COLORS.map(c => [c, c.w]));
      this.woolColor = wc || WOOL_COLORS[0];
    }
    const layerMat = {
      skin: this.mat,
      wool: () => (this.woolMat = mk({ color: this.woolColor.color })),
      eyes: () => (this.eyeMat = patchMobMaterial(new THREE.MeshBasicMaterial({ map: A.tex, alphaTest: .5 }), this.u, true)),
      shell: () => (this.shellMat = mk({ transparent: true, alphaTest: .02, depthWrite: false })),
    };
    this.root = new THREE.Group(); this.tilt = new THREE.Group(); this.root.add(this.tilt);
    this.parts = {}; this.rest = {}; this.restP = {};
    const bones = [];
    for (const p of A.model.parts) {
      const b = new THREE.Bone(), par = p.parent ? A.model.parts.find(q => q.name === p.parent) : null;
      b.position.set((p.pivot[0] - (par ? par.pivot[0] : 0)) * PX, (p.pivot[1] - (par ? par.pivot[1] : 0)) * PX, (p.pivot[2] - (par ? par.pivot[2] : 0)) * PX);
      b.rotation.order = p.order || 'XYZ'; b.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      (par ? this.parts[par.name] : this.tilt).add(b); this.parts[p.name] = b; bones.push(b);
    }
    this.skeleton = new THREE.Skeleton(bones, A.boneInverses);
    this.bounds = new THREE.Sphere(A.bCenter.clone(), A.bRadius); this.meshes = [];
    for (const layer of A.layers) {
      let mat = layerMat[layer]; if (typeof mat === 'function') { mat = mat(); this.mats.push(mat); }
      const mesh = new THREE.SkinnedMesh(A.geo[layer], mat); mesh.bind(this.skeleton, IDENT); mesh.boundingSphere = this.bounds;
      mesh.castShadow = layer === 'skin' || layer === 'wool'; mesh.userData.mob = this; if (layer === 'shell') mesh.renderOrder = 1;
      this.root.add(mesh); this.meshes.push(mesh);
    }
    this._restPose();
    this.shadowScale = Math.max(this.w * 1.5, .7); this.showShadow = false;
    this.fire = null;
    this.root.position.set(x, y, z); this.pos = this.root.position;
    // round 3 state
    this.angry = false; this.angerT = 0; this.stareT = 0; this.stared = false; this.tpCD = 0; this.carrying = false; this.waterT = 0;
    this.size = 1; this.jumpT = rand(); this.squash = 0; this.airborne = false;
    this.tamed = false; this.sitting = false; this.target = null; this.packId = opts.pack ?? 0; this.wolfSnd = 0;
    this.swimT = rand() * 2; this.swimPh = 0; this.swimY = 0; this.air = 6; this.bodyPitch = 0;
    if (type === 'slime') this._setSize(opts.size || [1, 2, 4][randInt(0, 2)]);
    if (type === 'enderman') this._setCarry(opts.carrying ?? rand() < .3);
    if (type === 'wolf') this._setTamed(!!opts.tamed, opts.owner || null);
    if (this.baby) this._setBaby(true);
    this.root.rotation.y = this.yaw;
  }

  _restPose() {
    const P = this.parts;
    if (this.type === 'spider') {
      const spread = [.62, .2, -.2, -.62], droop = [.7, .55, .55, .7];
      for (let i = 0; i < 4; i++) { P['legR' + i].rotation.set(0, spread[i], droop[i]); P['legL' + i].rotation.set(0, -spread[i], -droop[i]); }
    }
    for (const k in P) { this.rest[k] = [P[k].rotation.x, P[k].rotation.y, P[k].rotation.z]; this.restP[k] = P[k].position.clone(); }
  }

  get alive() { return !this.dead; }
  emitSound(name, o) { this.mgr._sound(name, this.pos, o || (this.baby ? BABY_SND : this.type === 'slime' ? SLIME_SND[this.size] : null)); }

  setLook(x, y, z) { this.lookX = x; this.lookY = y; this.lookZ = z; this.looking = true; }

  _setBaby(on) {
    this.baby = on; const s = on ? .5 : 1;
    this.w = this.def.w * s; this.h = this.def.h * s; this.tilt.scale.setScalar(s);
    if (this.parts.head) this.parts.head.scale.setScalar(on ? 1.45 : 1);
    this.shadowScale = Math.max(this.w * 1.5, on ? .45 : .7);
    if (on && this.hostile) this.growT = Infinity; // baby zombies never grow up
  }
  /** slime size 1 | 2 | 4 (hitbox .51 per size, like the real game) */
  _setSize(n) {
    this.size = n; this.w = this.h = .51 * n; this.hp = this.maxHp = n === 1 ? 1 : n === 2 ? 4 : 16;
    this.dmg = n === 1 ? 0 : n === 2 ? 2 : 4; this.tilt.scale.setScalar(n * 1.02);
    this.bounds.center.copy(this.mgr._assets('slime').bCenter).multiplyScalar(n); this.bounds.radius = this.mgr._assets('slime').bRadius * n;
    this.shadowScale = Math.max(this.w * 1.4, .5);
  }
  _hide(part, hidden) { const b = this.parts[part]; if (b) b.scale.setScalar(hidden ? 1e-4 : 1); }
  _setCarry(on) { this.carrying = on; this._hide('block', !on); }
  _setTamed(on, owner) { this.tamed = on; this.owner = owner; this._hide('collar', !on); if (on) { this.hp = this.maxHp = 20; this.angry = false; this.angerT = 0; } }


  /** Steer toward (tx,ty,tz) using A* when there's no straight route; spiders and close targets go direct. */
  navTo(tx, ty, tz, speed, dt, direct) {
    const m = this.mgr, fx = Math.floor(this.pos.x), fz = Math.floor(this.pos.z); let fy = Math.floor(this.pos.y + .01);
    if (m.world.isSolid(fx, fy, fz) && !m.isDoor(fx, fy, fz)) fy++;   // standing on a slab / stair / bed: plan from the cell above it
    const gx = Math.floor(tx), gy = Math.floor(ty + .01), gz = Math.floor(tz);
    this.pathT -= dt;
    const close = Math.abs(gx - fx) <= 1 && Math.abs(gz - fz) <= 1 && Math.abs(gy - fy) <= 1;
    if (direct || close || (this.def.climbs && this.stuckT < 1.2 && !this.inWater)) { this.path = null; this.moveYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z); this.moveSpeed = speed; return; }
    const stale = this.path && (this.pathI >= this.path.length || this.wpT > 2.5);
    if ((this.pathT <= 0 || !this.path || stale) && m._pathBudget > 0 && (this.onGround || this.inWater)) {
      m._pathBudget--; this.pathT = PATH_EVERY + rand() * .15; this.wpT = 0;
      this.path = m.pathfinder.find(fx, fy, fz, gx, gy, gz, Math.ceil(this.h - .05), 3, this.type === 'zombie' && !!m.onBreakDoor && m.difficulty === 'hard'); this.pathI = 0; m.pathStats.runs++; m.pathStats.nodes += m.pathfinder.lastExpanded;
      if (!this.path || !this.path.length) { m.pathStats.fails++; this.path = null; }
    }
    if (!this.path || this.pathI >= this.path.length) { this.moveYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z); this.moveSpeed = speed; return; }
    let wp = this.path[this.pathI];
    const wx = wp.x + .5, wz = wp.z + .5, dx = wx - this.pos.x, dz = wz - this.pos.z, hd = Math.hypot(dx, dz);
    if (hd < .35 + (this.w > .9 ? .2 : 0) && this.pos.y > wp.y - .6 && this.pos.y < wp.y + 1.2) { this.pathI++; this.wpT = 0; if (this.pathI >= this.path.length) return this.navTo(tx, ty, tz, speed, 0, true); wp = this.path[this.pathI]; }
    this.wpT += dt;
    const nx = wp.x + .5 - this.pos.x, nz = wp.z + .5 - this.pos.z;
    this.moveYaw = Math.atan2(nx, nz); this.moveSpeed = speed;
    // jump early for step-ups so mobs don't grind against the ledge
    // (not onto slabs / stairs / beds: the 0.6 auto-step walks up those)
    if (wp.y > this.pos.y + .4 && (this.onGround || this.inWater) && Math.hypot(nx, nz) < 1.25 && !(m._boxFn && wp.y - this.pos.y < 1.1 && m._boxFn(wp.x, wp.y - 1, wp.z))) { this.vel.y = Math.max(this.vel.y, this.inWater ? 5.5 : JUMP_V); this.onGround = false; }
  }

  /** Damage from the player or the world. fromPos (Vector3) gives knockback direction; returns true if it landed. */
  hurt(amount, fromPos, opts = {}) {
    if (this.dead || this.invul > 0) return false;
    const byPlayer = !!opts.player || (opts.cause === 'arrow' && !opts.shooter);
    // endermen dodge every projectile by teleporting (no damage), like the real game
    if (this.type === 'enderman' && opts.cause === 'arrow' && this.mgr.teleport(this, this.pos.x, this.pos.z, 16)) { if (byPlayer) this._anger(); return false; }
    this.hp -= amount; this.invul = .5; this.hurtT = .35;
    if (fromPos) {
      let dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const kb = opts.knockback ?? 6.5;
      this.vel.x = dx * kb; this.vel.z = dz * kb; if (this.onGround || this.def.climbs) this.vel.y = 5.2;
      this.noCtrl = .35;
      this.fleeX = fromPos.x; this.fleeZ = fromPos.z;
    }
    if (!this.hostile && this.type !== 'wolf') { this.fleeT = 4 + rand() * 2; this.graze = 0; if (!fromPos) { const a = rand() * TAU; this.fleeX = this.pos.x + Math.sin(a); this.fleeZ = this.pos.z + Math.cos(a); } }
    if (this.type === 'spider') this.anger = 15;
    if (byPlayer) this.mgr._playerAttacked(this);
    if (byPlayer || (opts.attacker && opts.attacker.tamed)) this.xpT = this.mgr.time;   // a player (or their wolf) hit it: worth XP if it dies soon
    if (this.type === 'wolf') {
      if (this.tamed) { this.sitting = false; if (opts.attacker && opts.attacker !== this && !opts.attacker.dead) this.target = opts.attacker; }
      else if (byPlayer) for (const w of this.mgr.mobs) if (w.type === 'wolf' && !w.tamed && !w.dead && w.pos.distanceToSquared(this.pos) < 256) { w.angry = true; w.angerT = 30; }
    }
    if (this.type === 'squid') { this.fleeT = 3; this.fled = false; this.mgr._ink(this); }
    for (let i = 0; i < 6; i++) this.mgr.particles.emit(this.pos.x + (rand() - .5) * this.w, this.pos.y + this.h * (.4 + rand() * .5), this.pos.z + (rand() - .5) * this.w, (rand() - .5) * 3, 1 + rand() * 2, (rand() - .5) * 3, .45, .65, .08, .08, -10);
    if (this.hp <= 0) this.die(opts.cause || 'hit');
    else {
      this.emitSound(this.type + '_hurt');
      if (this.type === 'enderman') {
        if (byPlayer || opts.attacker) this._anger();
        // hurt by the world: 90% blink away; hit in melee: sometimes blink a short way (fightable, but slippery)
        const env = opts.cause === 'fire' || opts.cause === 'lava' || opts.cause === 'fall' || opts.cause === 'explosion' || opts.cause === 'drown';
        if ((env && rand() < .9) || (opts.player && rand() < .35)) this.mgr.teleport(this, this.pos.x, this.pos.z, opts.player ? 8 : 16);
      }
    }
    return true;
  }

  die(cause = 'hit') {
    if (this.dead) return;
    this.diedBurning = this.burning || this.fireT > 0; this.dead = true; this.deathT = 0; this.hp = 0; this.cause = cause; this.burning = false; this.fireT = 0; this.fusing = false;
    this.side = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw) > 0 ? -1 : 1;
    this.emitSound(this.type + '_death');
  }

  /* ---------------- world queries */
  solid(x, y, z) { return this.mgr.world.isSolid(Math.floor(x), Math.floor(y), Math.floor(z)); }

  _updateEnv(dt) {
    this.envT -= dt; if (this.envT > 0) return; this.envT = .45 + rand() * .1;
    const W = this.mgr.world, x = Math.floor(this.pos.x), z = Math.floor(this.pos.z), yh = Math.floor(this.pos.y + this.h * .7);
    const day = this.mgr.isDay(), rain = this.mgr.isRaining(x, z);
    this.skyOpen = rain && this.mgr.skyExposed(x, Math.floor(this.pos.y + this.h), z, 48);   // rain reaches it: puts fire out, hurts endermen
    if (W.getLight) {
      const L = W.getLight(x, yh, z);
      this.lightLevel = L ?? 15;
      this.sunlit = day && !rain && this.lightLevel >= 12 && this.mgr.skyExposed(x, Math.floor(this.pos.y + this.h), z, 24);
      this.u.light.value = this.mgr.useWorldLight ? this.mgr._brightness(x, yh, z, this.lightLevel) : 1;
    } else {
      this.sunlit = day && !rain && this.mgr.skyExposed(x, Math.floor(this.pos.y + this.h), z, 48);
      if (this.mgr.lighting === 'baked') this.u.light.value = day ? 1 : .35;
    }
  }

  /* ---------------- AI */
  think(dt, player) {
    const m = this.mgr;
    this.looking = false; this.moveSpeed = 0; this.chasing = false;
    if (!m.ai) { if (m.lookTarget) this.setLook(m.lookTarget.x, m.lookTarget.y, m.lookTarget.z); return; }
    let pd = 1e9, pdx = 0, pdz = 0, pdy = 0;
    const tgt = player && !player.dead && !player.ignoredByMobs && (player.health === undefined || player.health > 0) ? player : null;
    if (tgt) { pdx = tgt.position.x - this.pos.x; pdz = tgt.position.z - this.pos.z; pdy = tgt.position.y - this.pos.y; pd = Math.hypot(pdx, pdz); }
    const eyeY = tgt ? tgt.position.y + (tgt.eyeHeight ?? 1.62) : 0;
    const t = this.type;
    if (t === 'enderman') return this._enderman(dt, tgt, pd, pdx, pdz, pdy, eyeY);
    if (t === 'slime') return this._slime(dt, tgt, pd, pdx, pdz, pdy, eyeY);
    if (t === 'wolf') return this._wolf(dt, tgt, pd, pdy, eyeY);
    if (t === 'squid') return this._squid(dt);

    if (t === 'zombie' || t === 'skeleton' || t === 'creeper' || (t === 'spider' && (this.anger > 0 || !this.sunlit))) {
      if (tgt && pd < this.def.follow && Math.abs(pdy) < 12) {
        this.losT -= dt; if (this.losT <= 0) { this.losT = .4 + rand() * .2; const ey = this.pos.y + this.h * .85;
          this.seen = m.lineOfSight(this.pos.x, ey, this.pos.z, tgt.position.x, eyeY, tgt.position.z) || m.lineOfSight(this.pos.x, ey, this.pos.z, tgt.position.x, tgt.position.y + .9, tgt.position.z); }
        // notice by sight, or by "hearing" within 10 blocks; keep tracking for 10s after losing sight (the path finder handles the walls)
        if (this.seen || pd < 10 || this.chasedRecently > 0) {
          this.chasedRecently = this.seen || pd < 10 ? 10 : (this.chasedRecently || 0) - dt;
          this._hostile(dt, tgt, pd, pdx, pdz, pdy, eyeY); return;
        }
      }
      this.aimT = 0; this.fusing = false; this.fuse = Math.max(0, this.fuse - dt);
      this._wander(dt, tgt, pd, eyeY); return;
    }
    if (!this.hostile && this.fleeT <= 0) {
      // love: walk to a partner of the same type
      if (this.loveT > 0 && this.partner && !this.partner.dead && !this.partner.removed) {
        const q = this.partner.pos; this.setLook(q.x, q.y + this.partner.h * .8, q.z);
        if (this.pos.distanceTo(q) > 1.1) this.navTo(q.x, q.y, q.z, this.def.wander * 1.3, dt, false);
        return;
      }
      // tempt: follow a player holding this animal's food
      const held = tgt && this.def.food ? (typeof tgt.heldItem === 'function' ? tgt.heldItem() : tgt.heldItem) : null;
      this.tempted = !!held && held === this.def.food && pd < 10 && Math.abs(pdy) < 4;
      if (this.tempted) { this.setLook(tgt.position.x, eyeY, tgt.position.z); if (pd > 2.2) this.navTo(tgt.position.x, tgt.position.y, tgt.position.z, this.def.wander * 1.25, dt, false); return; }
    }
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      const away = Math.atan2(this.pos.x - this.fleeX, this.pos.z - this.fleeZ);
      this.stateT -= dt; if (this.stateT <= 0) { this.stateT = .6 + rand() * .6; this.fleeJitter = (rand() - .5) * 1.4; }
      this.moveYaw = away + (this.fleeJitter || 0); this.moveSpeed = this.def.speed;
      if (this.stuckT > .5) { this.fleeJitter = (rand() - .5) * 3; this.stuckT = 0; }
      return;
    }
    this._wander(dt, tgt, pd, eyeY);
  }

  _wander(dt, tgt, pd, eyeY) {
    this.stateT -= dt;
    if (this.stateT <= 0) {
      if (this.state === 'walk' || rand() < .45) { this.state = 'idle'; this.stateT = 2 + rand() * 5; if (this.type === 'sheep' && rand() < .35) this.graze = 2; }
      else { this.state = 'walk'; this.moveYaw = this.yaw + (rand() - .5) * 3.5; this.stateT = 1.5 + rand() * 3.5; }
    }
    if (this.graze > 0) { this.graze -= dt; return; }
    if (this.state === 'walk') {
      this.moveSpeed = this.def.wander;
      // don't wander off ledges higher than 2 blocks
      const ax = this.pos.x + Math.sin(this.moveYaw) * (this.w * .5 + .4), az = this.pos.z + Math.cos(this.moveYaw) * (this.w * .5 + .4), fy = this.pos.y;
      if (this.onGround && !this.solid(ax, fy - .5, az) && !this.solid(ax, fy - 1.5, az) && !this.solid(ax, fy - 2.5, az)) { this.state = 'idle'; this.stateT = .5 + rand(); this.moveSpeed = 0; this.moveYaw += Math.PI; }
      if (this.stuckT > .8) { this.moveYaw += (rand() < .5 ? 1 : -1) * (1 + rand() * 2); this.stuckT = 0; }
    }
    if (tgt && pd < 8 && !this.hostile) this.setLook(tgt.position.x, eyeY, tgt.position.z);
    else if (tgt && this.hostile && pd < 12) this.setLook(tgt.position.x, eyeY, tgt.position.z);
  }

  _hostile(dt, tgt, pd, pdx, pdz, pdy, eyeY) {
    const t = this.type, toward = Math.atan2(pdx, pdz), P = tgt.position;
    this.setLook(P.x, eyeY, P.z); this.chasing = true;
    if (t === 'zombie' || t === 'spider') {
      if (pd > .9) this.navTo(P.x, P.y, P.z, this.def.speed, dt, this.seen && Math.abs(pdy) < 1 && pd < 2.5); else { this.moveYaw = toward; this.moveSpeed = 0; }
      if (t === 'spider' && this.onGround && this.leapCD <= 0 && pd > 1.3 && pd < 3.2) {
        this.leapCD = 1.5 + rand(); this.vel.y = 6.5; this.vel.x = Math.sin(toward) * 5.5; this.vel.z = Math.cos(toward) * 5.5; this.noCtrl = .25;
      }
      if (pd < 1.2 + this.w * .5 && pdy > -1.2 && pdy < this.h + .5 && this.attackCD <= 0) {
        this.attackCD = 1; this.swingT = .35;
        if (tgt.hurt) { tgt.hurt(this.mgr.scaleDmg(this.def.dmg), this.pos, this); this.mgr._playerHitBy(this); }
        this.emitSound(t + '_attack');
      }
    } else if (t === 'skeleton') {
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 1.5 + rand() * 2.5; this.strafe = -this.strafe; }
      if (pd < 5) { this.moveYaw = toward + Math.PI; this.moveSpeed = this.def.speed * .9; }
      else if (pd > 11 || !this.seen) this.navTo(P.x, P.y, P.z, this.def.speed, dt, false);
      else { this.moveYaw = toward + this.strafe * Math.PI / 2; this.moveSpeed = this.def.speed * .55; }
      this.faceTarget = true;
      if (this.seen && pd < 16) {
        if (this.shootCD <= 0) { this.aimT += dt; if (this.aimT >= .9) { this.aimT = 0; this.shootCD = 1.4 + rand() * 1.2; this.mgr._shootArrow(this, tgt); } }
      } else this.aimT = Math.max(0, this.aimT - dt);
    } else if (t === 'creeper') {
      if (pd > 1.2) this.navTo(P.x, P.y, P.z, this.def.speed, dt, this.seen && Math.abs(pdy) < 1 && pd < 2.5); else { this.moveYaw = toward; this.moveSpeed = 0; }
      if (!this.fusing && pd < 3 && Math.abs(pdy) < 2.5 && this.seen) { this.fusing = true; this.emitSound('creeper_hiss'); }
      if (this.fusing && (pd > 7 || !this.seen && pd > 3)) this.fusing = false;
      if (this.fusing) this.moveSpeed *= .25;
    }
  }


  /* ---------------- round 3 behaviours */
  _anger() { if (!this.angry) { this.angry = true; this.emitSound('enderman_stare'); } this.angerT = 30; }

  /** Enderman: neutral until the player looks at its head (camera ray, up to 64 blocks) or hits it; then hunts and blinks closer. */
  _enderman(dt, tgt, pd, pdx, pdz, pdy, eyeY) {
    const m = this.mgr;
    if (this.tpCD > 0) this.tpCD -= dt;
    if (this.inWater || this.skyOpen) { this.waterT += dt; if (this.waterT > .5) { this.waterT = 0; this.invul = 0; this.hurt(1, null, { cause: 'water' }); if (!this.dead) m.teleport(this, this.pos.x, this.pos.z, 16); } }
    else this.waterT = 0;
    if (!this.angry && this.sunlit && this.tpCD <= 0 && rand() < dt / 25) m.teleport(this, this.pos.x, this.pos.z, 16);
    if (rand() < dt * 5) m.particles.emit(this.pos.x + (rand() - .5) * .8, this.pos.y + rand() * this.h, this.pos.z + (rand() - .5) * .8, (rand() - .5) * .8, (rand() - .2) * .6, (rand() - .5) * .8, .9, .72, .25, .95, 0);
    // stare test: is the camera looking at the head? (same cone as the real game: dot > 1 - 0.025 / distance)
    this.stared = false;
    const cam = tgt && pd < 64 ? m.getCamera(tgt) : null;
    if (cam) {
      const e = cam.matrixWorld.elements, hx = this.pos.x, hy = this.pos.y + this.h - .25, hz = this.pos.z;
      let vx = hx - e[12], vy = hy - e[13], vz = hz - e[14]; const d = Math.hypot(vx, vy, vz) || 1;
      const fl = Math.hypot(e[8], e[9], e[10]) || 1, dot = -(vx * e[8] + vy * e[9] + vz * e[10]) / (d * fl);
      if (dot > 1 - .025 / d) { this.losT -= dt; if (this.losT <= 0) { this.losT = .15; this.seenByCam = m.lineOfSight(e[12], e[13], e[14], hx, hy, hz); } this.stared = !!this.seenByCam; }
    }
    if (this.stared) { this.stareT += dt; if (!this.angry && this.stareT > .25) this._anger(); else if (this.angry) this.angerT = 30; }
    else this.stareT = Math.max(0, this.stareT - dt);
    if (this.angry && tgt) {
      this.angerT -= dt; const P = tgt.position;
      this.seeT = (this.seeT || 0) - dt;
      if (this.seeT <= 0) { this.seeT = .5; this.seeP = m.lineOfSight(this.pos.x, this.pos.y + 2.6, this.pos.z, P.x, eyeY, P.z); }
      if (this.seeP && pd < 24) this.angerT = Math.max(this.angerT, 10);
      if (this.angerT > 0 && pd < 64) {
        this.setLook(P.x, eyeY, P.z); this.chasing = true;
        if ((pd > 14 || this.stuckT > 1.2) && this.tpCD <= 0 && rand() < dt * 1.5) m.teleport(this, P.x, P.z, 5, true);
        if (pd > 1.1) this.navTo(P.x, P.y, P.z, this.def.speed, dt, this.seeP && Math.abs(pdy) < 1 && pd < 2.5); else { this.moveYaw = Math.atan2(pdx, pdz); this.moveSpeed = 0; }
        if (pd < 1.3 + this.w * .5 && pdy > -1.5 && pdy < this.h && this.attackCD <= 0) {
          this.attackCD = 1; this.swingT = .35; if (tgt.hurt) { tgt.hurt(m.scaleDmg(this.def.dmg), this.pos, this); m._playerHitBy(this); } this.emitSound('enderman_attack');
        }
        return;
      }
      this.angry = false;
    } else if (!tgt) this.angry = false;
    this._wander(dt, tgt, pd, eyeY);
  }

  /** Slime: hops (faster and straight at the player when it sees them), squashes on landing, hurts on touch (size 2+). */
  _slime(dt, tgt, pd, pdx, pdz, pdy, eyeY) {
    const m = this.mgr; let chase = false;
    if (tgt && pd < this.def.follow && Math.abs(pdy) < 8) {
      this.losT -= dt; if (this.losT <= 0) { this.losT = .5; this.seen = m.lineOfSight(this.pos.x, this.pos.y + this.h * .6, this.pos.z, tgt.position.x, eyeY, tgt.position.z); }
      chase = this.seen || pd < 4;
    }
    this.chasing = chase;
    if (chase) { this.setLook(tgt.position.x, eyeY, tgt.position.z); if (this.onGround) this.moveYaw = Math.atan2(pdx, pdz); }
    if (this.onGround && !this.inWater) {
      this.moveSpeed = 0; this.jumpT -= dt;
      if (this.jumpT <= 0) {
        this.jumpT = chase ? .45 + rand() * .55 : 1.2 + rand() * 2.6;
        if (!chase && rand() < .6) this.moveYaw = this.yaw + (rand() - .5) * 2.4;
        this.hopSpeed = (chase ? this.def.speed : this.def.wander) * (.85 + this.size * .1);
        this.vel.y = 5.4 + this.size * .55; this.vel.x = Math.sin(this.moveYaw) * this.hopSpeed; this.vel.z = Math.cos(this.moveYaw) * this.hopSpeed;
        this.onGround = false; this.airborne = true; this.yaw = this.moveYaw;
      }
    } else this.moveSpeed = this.airborne || this.inWater ? (this.hopSpeed || this.def.wander) : 0;
    if (this.stuckT > 1) { this.moveYaw += Math.PI * (.5 + rand()); this.stuckT = 0; }
    if (tgt && this.dmg > 0 && this.attackCD <= 0 && pd < this.w * .5 + .5 && pdy > -1.8 && pdy < this.h + .2) {
      this.attackCD = 1; if (tgt.hurt) { tgt.hurt(m.scaleDmg(this.dmg), this.pos, this); m._playerHitBy(this); } this.emitSound('slime_attack');
    }
  }

  /** Wolf: wild ones are neutral (a hit angers the pack); tamed ones follow, sit, and fight whatever hurts or is hit by the owner. */
  _wolf(dt, tgt, pd, pdy, eyeY) {
    const m = this.mgr, P = tgt && tgt.position;
    if (this.tamed) {
      if (this.sitting) { this.target = null; this.moveSpeed = 0; if (tgt && pd < 12) this.setLook(P.x, eyeY, P.z); return; }
      if (this.target && (this.target.dead || this.target.removed || this.target.pos.distanceToSquared(this.pos) > 24 * 24 || !tgt || pd > 24)) this.target = null;
      if (!this.target) { const c = m._wolfTarget(); if (c && c !== this && !(c.type === 'wolf' && c.tamed) && c.type !== 'creeper' && c.pos.distanceToSquared(this.pos) < 20 * 20) this.target = c; }
      if (this.target) return this._bite(dt, this.target, this.def.tameDmg, false);
      if (!tgt) return this._wander(dt, tgt, pd, eyeY);
      if (pd > 12 && (this.onGround || this.inWater) && m.teleportNear(this, P)) return;
      if (pd > 6 || (this.following && pd > 2.5)) { this.following = true; this.setLook(P.x, eyeY, P.z); this.navTo(P.x, P.y, P.z, this.def.speed, dt, false); return; }
      this.following = false; this._wander(dt, tgt, pd, eyeY); if (pd < 8) this.setLook(P.x, eyeY, P.z); return;
    }
    if (this.angry && tgt) { this.angerT -= dt; if (this.angerT > 0 && pd < this.def.follow) return this._bite(dt, tgt, this.def.dmg, true); this.angry = false; }
    if (this.fleeT > 0) this.fleeT = 0;
    this._wander(dt, tgt, pd, eyeY);
  }
  _bite(dt, victim, dmg, isPlayer) {
    const Q = isPlayer ? victim.position : victim.pos, dx = Q.x - this.pos.x, dz = Q.z - this.pos.z, d = Math.hypot(dx, dz), dy = Q.y - this.pos.y;
    this.setLook(Q.x, Q.y + (isPlayer ? 1.5 : victim.h * .8), Q.z); this.chasing = true;
    if (d > .9) this.navTo(Q.x, Q.y, Q.z, this.def.speed * 1.15, dt, d < 2.5 && Math.abs(dy) < 1); else { this.moveYaw = Math.atan2(dx, dz); this.moveSpeed = 0; }
    if (this.onGround && d > 1.6 && d < 3.2 && this.leapCD <= 0 && Math.abs(dy) < 1) { this.leapCD = 2 + rand(); this.vel.y = 5.2; this.vel.x = dx / d * 4.8; this.vel.z = dz / d * 4.8; this.noCtrl = .2; }
    const reach = 1.05 + this.w * .5 + (isPlayer ? 0 : victim.w * .5);
    if (d < reach && dy > -1.2 && dy < 1.6 && this.attackCD <= 0) {
      this.attackCD = 1; this.swingT = .3; this.emitSound('wolf_attack');
      if (isPlayer) { if (victim.hurt) { victim.hurt(this.mgr.scaleDmg(dmg), this.pos, this); this.mgr._playerHitBy(this); } }
      else victim.hurt(dmg, this.pos, { cause: 'wolf', attacker: this });
    }
  }

  /** Squid: swims in pulses inside water only, flees and inks when hit, flops and suffocates on land. */
  _squid(dt) {
    const m = this.mgr, x = this.pos.x, z = this.pos.z;
    if (!this.inWater) {
      this.air -= dt; if (this.air < 0) { this.air += 1; this.invul = 0; this.hurt(1, null, { cause: 'drown' }); }
      if (this.onGround && rand() < dt * .7) { this.vel.y = 3.5; const a = rand() * TAU; this.vel.x = Math.sin(a) * 1.4; this.vel.z = Math.cos(a) * 1.4; this.onGround = false; }
      this.moveSpeed = 0; this.swimPh += dt * 1.5; return;
    }
    this.air = Math.min(6, this.air + dt * 2);
    const fleeing = this.fleeT > 0; if (fleeing) this.fleeT -= dt;
    this.swimT -= dt;
    if (this.swimT <= 0 || this.stuckT > .4 || (fleeing && !this.fled)) {
      let ok = false;
      for (let i = 0; i < 8 && !ok; i++) {
        const yaw = fleeing ? Math.atan2(x - this.fleeX, z - this.fleeZ) + (rand() - .5) * 1.6 : rand() * TAU, vy = (rand() - .5) * 1.4;
        if (m.isWater(Math.floor(x + Math.sin(yaw) * 2.5), Math.floor(this.pos.y + .45 + vy * 1.5), Math.floor(z + Math.cos(yaw) * 2.5))) { this.moveYaw = yaw; this.swimY = vy; ok = true; }
      }
      if (!ok) { this.moveYaw = this.yaw + Math.PI * (.6 + rand() * .8); this.swimY = -.4; }
      this.swimT = fleeing ? 1 : 2 + rand() * 3; this.stuckT = 0; this.fled = fleeing;
    }
    if (!fleeing) this.fled = false;
    const fx = Math.floor(x), fz = Math.floor(z);
    if (!m.isWater(fx, Math.floor(this.pos.y + this.h + .15), fz)) this.swimY = Math.min(this.swimY, -.5);   // keep under the surface
    if (m.world.isSolid(fx, Math.floor(this.pos.y - .6), fz)) this.swimY = Math.max(this.swimY, .35);        // tentacles off the floor
    this.swimPh += dt * (fleeing ? 5.5 : 2.6);
    const thrust = Math.max(0, Math.sin(this.swimPh));
    this.moveSpeed = (fleeing ? this.def.speed * 1.7 : this.def.wander) * (.2 + thrust);
    const ax = x + Math.sin(this.moveYaw) * (this.w * .5 + .5), az = z + Math.cos(this.moveYaw) * (this.w * .5 + .5);
    if (!m.isWater(Math.floor(ax), Math.floor(this.pos.y + .4), Math.floor(az))) { this.moveSpeed = 0; this.swimT = Math.min(this.swimT, .2); }
  }

  _idleName() {
    const t = this.type;
    if (t === 'wolf') return this.angry ? 'wolf_growl' : this.tamed && this.hp < this.maxHp * .5 ? 'wolf_whine' : 'wolf_idle';
    if (t === 'enderman' && this.angry) return 'enderman_stare';
    return t + '_idle';
  }

  /* ---------------- physics */
  physics(dt) {
    const v = this.vel, ctrl = this.noCtrl > 0 || this.dead ? .08 : 1, M = this.mgr;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    const wasWet = this.inWater;
    this.inWater = M.isWater(px, Math.floor(this.pos.y + .1), pz) || M.isWater(px, Math.floor(this.pos.y + this.h * .5), pz);
    this.headWet = this.inWater && M.isWater(px, Math.floor(this.pos.y + this.h * .55), pz);
    if (this.inWater && !wasWet && v.y < -4) M._sound('splash', this.pos);
    const wasLava = this.inLava;
    this.inLava = !this.inWater && M._lavaFn !== null && (M.isLava(px, Math.floor(this.pos.y + .1), pz) || M.isLava(px, Math.floor(this.pos.y + this.h * .5), pz));
    if (this.inLava && !wasLava && !this.dead) M._sound('lava_sizzle', this.pos);
    this.inFire = !this.inLava && M._fireFn !== null && (M.isFire(px, Math.floor(this.pos.y + .1), pz) || M.isFire(px, Math.floor(this.pos.y + this.h * .5), pz));
    const swim = this.def.swims && this.inWater && !this.dead;
    const spd = this.dead ? 0 : this.moveSpeed * (this.inLava ? .3 : this.inWater && !swim ? .55 : 1) * (this.baby && this.hostile ? 1.5 : 1);
    const tx = Math.sin(this.moveYaw) * spd, tz = Math.cos(this.moveYaw) * spd;
    const k = Math.min(1, (this.onGround ? 12 : 2.5) * ctrl * dt) * (spd > 0 || this.onGround ? 1 : 0);
    v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
    if (swim) {
      // squid: neutral buoyancy, steering up/down with its strokes
      const vyT = this.swimY * (.5 + this.moveSpeed * .6); v.y += (vyT - v.y) * Math.min(1, 3 * dt);
      v.x *= Math.pow(.5, dt); v.z *= Math.pow(.5, dt); this.fallStart = this.pos.y;
    } else if (this.inWater) {
      // float: buoyancy while the chest is under, water drag, and a hop to climb out at the shore
      v.y -= GRAV * .3 * dt; if (this.headWet) v.y += 16 * dt;
      const drag = Math.pow(.25, dt); v.y *= drag; v.x *= Math.pow(.6, dt); v.z *= Math.pow(.6, dt);
      if (v.y > 2.4) v.y = 2.4; if (v.y < -3) v.y = -3;
      if (this.hitWall && spd > 0 && !this.dead) v.y = Math.max(v.y, 4.2);
      this.fallStart = this.pos.y;
    } else if (this.inLava) {
      // lava: thick, sink slowly, scramble out at the edge
      v.y -= GRAV * .15 * dt; v.y *= Math.pow(.1, dt); v.x *= Math.pow(.2, dt); v.z *= Math.pow(.2, dt);
      if (v.y < -1.5) v.y = -1.5; if (this.hitWall && !this.dead) v.y = Math.max(v.y, 4.6);
      this.fallStart = this.pos.y;
    } else if (this.def.climbs && this.hitWall && spd > 0 && !this.dead) v.y = Math.max(v.y, 2.6);
    else { v.y -= GRAV * dt; if (this.def.slowFall && v.y < -2.2) v.y = -2.2; if (v.y < TERMINAL) v.y = TERMINAL; }
    const wasGround = this.onGround;
    this.onGround = false; this.hitWall = false;
    this._stepOK = wasGround && !this.dead && !this.inWater && this.type !== 'slime' && !this.def.swims;   // 0.6 auto step (slabs, stairs, beds)
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / .35));
    const sdt = dt / n;
    for (let i = 0; i < n; i++) { this._moveAxis(0, v.x * sdt); this._moveAxis(2, v.z * sdt); this._moveAxis(1, v.y * sdt); }
    if (this.hitWall && wasGround && spd > 0 && !this.def.climbs && !this.dead && !this.inWater && this.type !== 'slime') {
      // step up a 1-block ledge if there is head room above it
      const ax = this.pos.x + Math.sin(this.moveYaw) * (this.w * .5 + .3), az = this.pos.z + Math.cos(this.moveYaw) * (this.w * .5 + .3);
      if (!this.solid(ax, this.pos.y + 1.1, az) && !this.solid(this.pos.x, this.pos.y + this.h + .6, this.pos.z)) { v.y = JUMP_V; this.onGround = false; }
    }
    this.stuckT = this.hitWall ? this.stuckT + dt : Math.max(0, this.stuckT - dt);
    // fall damage
    if (!this.onGround) { if (v.y > 0 || wasGround) this.fallStart = Math.max(this.pos.y, wasGround ? this.pos.y : this.fallStart); else this.fallStart = Math.max(this.fallStart, this.pos.y); }
    else if (!wasGround) {
      const fall = this.inWater ? 0 : this.fallStart - this.pos.y; if (fall > 3.5 && !this.def.slowFall && !this.dead) this.hurt(Math.floor(fall - 3), null, { cause: 'fall' }); this.fallStart = this.pos.y;
      if (this.type === 'slime' && !this.dead) { this.squash = 1; this.airborne = false; this.vel.x *= .2; this.vel.z *= .2; this.emitSound('slime_jump'); for (let i = 0; i < 4 + this.size * 2; i++) this.mgr.particles.emit(this.pos.x + (rand() - .5) * this.w, this.pos.y + .1, this.pos.z + (rand() - .5) * this.w, (rand() - .5) * 2, 1 + rand(), (rand() - .5) * 2, .5, .45, .8, .35, -8); }
    }
    if (this.pos.y < -80) this.mgr.remove(this);
  }

  /** fill BX with the collision boxes (world units) that overlap this mob's AABB; full cubes, or the engine's per-block boxes
   *  for slabs / stairs / doors / beds when it exposes them (world.boxesAt, else blocks.js through window.game.world). */
  _collect() {
    const p = this.pos, hw = this.w / 2, E = 1e-3, M = this.mgr, W = M.world, bf = M._boxFn;
    const xa = p.x - hw, xb = p.x + hw, ya = p.y, yb = p.y + this.h, za = p.z - hw, zb = p.z + hw;
    const x0 = Math.floor(xa + E), x1 = Math.floor(xb - E), y0 = Math.floor(ya + E), y1 = Math.floor(yb - E), z0 = Math.floor(za + E), z1 = Math.floor(zb - E);
    let n = 0;
    const yS = M._tallFn !== null ? y0 - 1 : y0;   // fences / walls poke 0.5 into the cell above them
    for (let y = yS; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!W.isSolid(x, y, z) || n >= 64 || (y < y0 && !M.isTall(x, y, z))) continue;
      const bs = bf ? bf(x, y, z) : null;
      if (!bs) { if (y < y0) continue; const o = n++ * 6; BX[o] = x; BX[o + 1] = y; BX[o + 2] = z; BX[o + 3] = x + 1; BX[o + 4] = y + 1; BX[o + 5] = z + 1; continue; }
      for (let i = 0; i < bs.length && n < 64; i++) { const b = bs[i];
        const bx0 = x + b[0] * PX, by0 = y + b[1] * PX, bz0 = z + b[2] * PX, bx1 = x + b[3] * PX, by1 = y + b[4] * PX, bz1 = z + b[5] * PX;
        if (bx0 < xb - E && bx1 > xa + E && by0 < yb - E && by1 > ya + E && bz0 < zb - E && bz1 > za + E) { const o = n++ * 6; BX[o] = bx0; BX[o + 1] = by0; BX[o + 2] = bz0; BX[o + 3] = bx1; BX[o + 4] = by1; BX[o + 5] = bz1; } }
    }
    return n;
  }

  _moveAxis(axis, d) {
    if (d === 0) return;
    const p = this.pos, hw = this.w / 2, E = 1e-3;
    if (axis === 0) p.x += d; else if (axis === 1) p.y += d; else p.z += d;
    let n = this._collect(); if (!n) return;
    if (axis !== 1 && this._stepOK) {
      // walk up anything up to 0.6 high (a slab, a stair step, a bed) without jumping, like Minecraft mobs
      let top = -Infinity; for (let i = 0; i < n; i++) if (BX[i * 6 + 4] > top) top = BX[i * 6 + 4];
      if (top > p.y && top - p.y <= STEP_H + E) { const oy = p.y; p.y = top; if (!this._collect()) { this.stepped = true; return; } p.y = oy; n = this._collect(); if (!n) return; }
    }
    let best = d > 0 ? Infinity : -Infinity;
    for (let i = 0; i < n; i++) { const c = d > 0 ? BX[i * 6 + axis] : BX[i * 6 + axis + 3]; if (d > 0 ? c < best : c > best) best = c; }
    if (axis === 0) { p.x = d > 0 ? best - hw - E : best + hw + E; this.vel.x = 0; this.hitWall = true; }
    else if (axis === 2) { p.z = d > 0 ? best - hw - E : best + hw + E; this.vel.z = 0; this.hitWall = true; }
    else { if (d > 0) p.y = best - this.h - E; else { p.y = best; this.onGround = true; } this.vel.y = 0; }
  }

  /** zombie at a closed wooden door: pound it (cracking sound + splinters), and after ~8s ask the engine to break it */
  _doorCheck(dt) {
    const M = this.mgr;
    if (!this.hitWall || this.moveSpeed <= 0 || this.dead) { if (this.doorT > 0) { this.doorT -= dt * .5; if (this.doorT <= 0) { this.doorT = 0; this.doorKey = null; } } return; }
    const s = Math.sin(this.moveYaw), c = Math.cos(this.moveYaw), r = this.w * .5 + .35, y0 = Math.floor(this.pos.y + .2);
    let dx = 0, dy = 0, dz = 0, half = null;
    for (const [qx, qz] of [[this.pos.x + s * r, this.pos.z + c * r], [this.pos.x, this.pos.z]]) {
      const x = Math.floor(qx), z = Math.floor(qz);
      for (const y of [y0, y0 + 1]) { half = M.isDoor(x, y, z); if (half) { dx = x; dy = half === 'upper' ? y - 1 : y; dz = z; break; } }
      if (half) break;
    }
    if (!half) return;
    const key = dx + ',' + dy + ',' + dz;
    if (this.doorKey !== key) { this.doorKey = key; this.doorT = 0; this.knockT = 0; }
    this.doorT += dt; this.knockT -= dt;
    const prog = Math.min(1, this.doorT / M.doorBreakTime);
    if (this.knockT <= 0) {
      this.knockT = .8 + rand() * .5; this.swingT = .3; this.emitSound('zombie_door');
      for (let i = 0; i < 5; i++) M.particles.emit(dx + .5 + (rand() - .5) * .8, dy + .4 + rand() * 1.4, dz + .5 + (rand() - .5) * .8, (rand() - .5) * 2, 1 + rand() * 1.5, (rand() - .5) * 2, .6, .55, .4, .22, -10);
      if (M.onDoorCrack) try { M.onDoorCrack(dx, dy, dz, prog); } catch (e) { /* engine hook */ }
    }
    if (prog >= 1) {
      let ok = true; try { M.onBreakDoor(dx, dy, dz); } catch (e) { ok = false; }
      this.doorT = 0; this.doorKey = null; this.path = null; this.pathT = 0;
      if (ok) { this.emitSound('zombie_door_break'); for (let i = 0; i < 18; i++) M.particles.emit(dx + .5 + (rand() - .5) * .9, dy + rand() * 2, dz + .5 + (rand() - .5) * .9, (rand() - .5) * 4, 1 + rand() * 3, (rand() - .5) * 4, .9, .55, .4, .22, -12); }
      if (M.onDoorCrack) try { M.onDoorCrack(dx, dy, dz, -1); } catch (e) { /* engine hook */ }
    }
  }

  /** stop before walking into lava (or off a ledge that drops into it) */
  _lavaGuard() {
    const M = this.mgr; if ((M._lavaFn === null && M._fireFn === null) || this.moveSpeed <= 0 || this.inLava || this.inFire || this.def.swims) return;
    const r = this.w * .5 + .45, x = Math.floor(this.pos.x + Math.sin(this.moveYaw) * r), z = Math.floor(this.pos.z + Math.cos(this.moveYaw) * r), y = Math.floor(this.pos.y + .1), W = M.world;
    let bad = M.isLava(x, y, z) || M.isLava(x, y + 1, z) || M.isFire(x, y, z) || M.isFire(x, y + 1, z);
    if (!bad && !W.isSolid(x, y, z)) for (let k = 1; k <= 3; k++) { if (W.isSolid(x, y - k, z)) break; if (M.isLava(x, y - k, z)) { bad = true; break; } }
    if (!bad) return;
    this.moveSpeed = 0;
    if (this.state === 'walk') { this.moveYaw += Math.PI * (.7 + rand() * .6); this.stateT = .6 + rand(); }
    if (this.fleeT > 0) this.fleeJitter = (this.fleeJitter || 0) + Math.PI * .6;
    if (this.path) { this.path = null; this.pathT = 0; }
  }

  /* ---------------- animation */
  animate(dt) {
    const P = this.parts, R = this.rest, t = this.age;
    // body yaw
    if (!this.dead) {
      let want = null;
      if ((this.faceTarget || this.aimT > 0) && this.looking) want = Math.atan2(this.lookX - this.pos.x, this.lookZ - this.pos.z);
      else if (this.moveSpeed > .05 && this.noCtrl <= 0) want = this.moveYaw;
      else if (this.looking) { const rel = wrapA(Math.atan2(this.lookX - this.pos.x, this.lookZ - this.pos.z) - this.yaw); if (Math.abs(rel) > 1.1) want = this.yaw + rel * .5; }
      if (want !== null) { const d = wrapA(want - this.yaw); this.yaw += clamp(d, -7 * dt, 7 * dt); }
      this.faceTarget = false;
    }
    this.root.rotation.y = this.yaw;
    // head
    let hy = 0, hp = 0;
    if (this.looking && !this.dead) {
      const dx = this.lookX - this.pos.x, dz = this.lookZ - this.pos.z, hd = Math.hypot(dx, dz) || 1;
      const headY = this.pos.y + this.h * .85;
      hy = clamp(wrapA(Math.atan2(dx, dz) - this.yaw), -1.2, 1.2); hp = clamp(Math.atan2(this.lookY - headY, hd), -.8, .8);
    }
    if (this.graze > 0) { hy = 0; hp = -.9; }
    const kk = Math.min(1, dt * 10); this.headYaw += (hy - this.headYaw) * kk; this.headPitch += (hp - this.headPitch) * kk;
    if (P.head) { P.head.rotation.y = R.head[1] + this.headYaw; P.head.rotation.x = R.head[0] - this.headPitch + (this.graze > 0 ? Math.sin(t * 14) * .08 : 0); }
    // walk cycle
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const target = this.mgr.debugWalk ? 1 : (this.onGround || this.def.climbs ? Math.min(1, hs / 2.2) : this.walkAmt * .9);
    this.walkAmt += (target - this.walkAmt) * Math.min(1, dt * 8);
    this.walkPhase += (this.mgr.debugWalk ? 2.6 : hs) * dt * 4.2;
    const s = Math.cos(this.walkPhase) * this.walkAmt, a = this.anim || (this.anim = MOB_MODELS[this.type].anim);
    if (a === 'zombie' || a === 'skeleton') {
      const amp = .7; P.legR.rotation.x = s * amp; P.legL.rotation.x = -s * amp;
      const sw = this.swingT > 0 ? Math.sin((this.swingT / .35) * Math.PI) * .9 : 0;
      if (a === 'zombie' || this.aimT > 0 || this.chasing && this.type === 'skeleton') {
        const raise = a === 'zombie' ? -Math.PI / 2 : -Math.PI / 2 - this.headPitch;
        const bob = Math.sin(t * 2.2) * .05;
        P.armR.rotation.x = raise + bob - sw; P.armL.rotation.x = (a === 'zombie' ? raise - bob - sw : -Math.PI / 2 * .9);
        P.armR.rotation.y = a === 'skeleton' ? -.1 + this.headYaw * .8 : 0; P.armL.rotation.y = a === 'skeleton' ? .5 + this.headYaw * .8 : 0;
        P.armR.rotation.z = Math.sin(t * 1.7) * .04; P.armL.rotation.z = -Math.sin(t * 1.7) * .04;
      } else {
        P.armR.rotation.x = -s * amp * .9 - (a === 'skeleton' ? .45 : 0); P.armL.rotation.x = s * amp * .9; P.armR.rotation.y = P.armL.rotation.y = 0;
        P.armR.rotation.z = .06 + Math.sin(t * 1.3) * .04; P.armL.rotation.z = -.06 - Math.sin(t * 1.3) * .04;
      }
    } else if (a === 'quad') {
      const amp = this.type === 'creeper' ? .6 : this.type === 'cow' ? .8 : .9;
      P.legFR.rotation.x = s * amp; P.legBL.rotation.x = s * amp; P.legFL.rotation.x = -s * amp; P.legBR.rotation.x = -s * amp;
    } else if (a === 'spider') {
      for (let i = 0; i < 4; i++) {
        const ph = this.walkPhase * 1.2 + (i % 2 ? Math.PI : 0), sy = Math.cos(ph) * .4 * this.walkAmt, sz = Math.abs(Math.sin(ph)) * .4 * this.walkAmt;
        P['legR' + i].rotation.y = R['legR' + i][1] + sy; P['legL' + i].rotation.y = R['legL' + i][1] - sy;
        P['legR' + i].rotation.z = R['legR' + i][2] + sz * (i % 2 ? 1 : -1); P['legL' + i].rotation.z = R['legL' + i][2] - sz * (i % 2 ? -1 : 1);
      }
    } else if (a === 'enderman') {
      const sw = this.swingT > 0 ? Math.sin((this.swingT / .35) * Math.PI) * .7 : 0;
      P.legR.rotation.x = s * .45; P.legL.rotation.x = -s * .45;
      if (this.carrying) { P.armR.rotation.x = P.armL.rotation.x = -.42 + Math.sin(t * 2) * .03; }
      else { P.armR.rotation.x = -s * .4 - sw; P.armL.rotation.x = s * .4 - sw * .4; }
      P.armR.rotation.z = .04; P.armL.rotation.z = -.04;
      this.jaw = (this.jaw || 0) + ((this.angry ? 1 : 0) - (this.jaw || 0)) * Math.min(1, dt * 8);
      P.head.position.y = this.restP.head.y + this.jaw * 3.5 * PX;
      const shake = this.angry && this.stared ? .025 : 0; this.tilt.position.x = shake ? (rand() - .5) * shake : 0; this.tilt.position.z = shake ? (rand() - .5) * shake : 0;
    } else if (a === 'slime') {
      this.squash = Math.max(0, this.squash - dt * 4.5);
      const pre = this.onGround && this.jumpT < .18 ? (.18 - this.jumpT) / .18 * .22 : 0;
      const k = this.onGround || this.inWater ? this.squash * .38 + pre : -clamp(this.vel.y * .035, -.12, .22);
      const sc = this.size * 1.02; this.tilt.scale.set(sc * (1 + k * .55), sc * (1 - k), sc * (1 + k * .55));
    } else if (a === 'wolf') {
      const rp = this.restP, sit = this.sitting && !this.dead;
      if (sit) {
        P.body.rotation.x = -.8; P.body.position.set(rp.body.x, rp.body.y - 2.2 * PX, rp.body.z - .6 * PX);
        P.mane.rotation.x = -.3; P.mane.position.set(rp.mane.x, rp.mane.y + .4 * PX, rp.mane.z - .6 * PX);
        for (const n of ['legBR', 'legBL']) { P[n].rotation.x = -1.5; P[n].position.set(rp[n].x, 1.2 * PX, rp[n].z + 1.5 * PX); }
        for (const n of ['legFR', 'legFL']) { P[n].rotation.x = -.12; P[n].position.copy(rp[n]); }
        P.tail.position.set(rp.tail.x, 2.4 * PX, rp.tail.z + .5 * PX); P.tail.rotation.set(1.52, 0, Math.sin(t * 1.3) * .08);
      } else {
        P.body.rotation.x = 0; P.body.position.copy(rp.body); P.mane.rotation.x = 0; P.mane.position.copy(rp.mane); P.tail.position.copy(rp.tail);
        for (const n of ['legFR', 'legFL', 'legBR', 'legBL']) P[n].position.copy(rp[n]);
        P.legFR.rotation.x = s * .9; P.legBL.rotation.x = s * .9; P.legFL.rotation.x = -s * .9; P.legBR.rotation.x = -s * .9;
        const tx = this.angry ? 1.45 : this.tamed ? .95 + clamp(this.hp / this.maxHp, 0, 1) * .55 : .63;
        const wag = this.tamed && !this.chasing ? Math.sin(t * 9) * .35 : Math.sin(t * 1.7) * .06;
        P.tail.rotation.set(tx, wag, 0);
      }
      if (this.angry) P.head.rotation.x += .12;
    } else if (a === 'squid') {
      // in water: tentacles open and snap shut with each stroke; on land: splayed out, the body resting on them
      const spread = this.inWater ? .12 + (1 - Math.cos(this.swimPh)) * .34 : 1.12 + Math.sin(this.swimPh * 3) * .05;
      for (let i = 0; i < 8; i++) P['t' + i].rotation.x = spread;
      this.landLift = (this.landLift || 0) + ((this.inWater || this.dead ? 0 : 1) - (this.landLift || 0)) * Math.min(1, dt * 4);
      P.body.position.y = this.restP.body.y + this.landLift * 7 * PX;
      const hs = Math.hypot(this.vel.x, this.vel.z), want = this.inWater && !this.dead ? Math.atan2(hs, this.vel.y + .7) * .9 : 0;
      this.bodyPitch += (want - this.bodyPitch) * Math.min(1, dt * 3); P.body.rotation.x = this.bodyPitch;
    } else if (a === 'chicken') {
      P.legR.rotation.x = s * 1.2; P.legL.rotation.x = -s * 1.2;
      const flap = !this.onGround ? Math.sin(t * 28) * .5 + .5 : Math.max(0, Math.sin(t * 1.5) - .97) * 8;
      P.wingR.rotation.z = flap * 1.2; P.wingL.rotation.z = -flap * 1.2;
    }
    // hurt / flash colours
    const fl = this.u.flash.value;
    if (this.dead || this.hurtT > 0) fl.set(1, .1, .1, .45);
    else if (this.type === 'creeper' && this.fuse > 0) { const f = this.fuse / 1.5; fl.set(1, 1, 1, Math.sin(this.fuse * (8 + f * 22)) > 0 ? .25 + f * .5 : 0); }
    else fl.w = 0;
    // creeper swell
    if (this.type === 'creeper') { const f = clamp(this.fuse / 1.5, 0, 1), j = 1 + f * .28 + Math.sin(this.age * 60) * .02 * f; this.tilt.scale.set(j, 1 + f * .1, j); }
    // death tip-over and dithered fade
    if (this.dead) {
      const pr = Math.min(1, this.deathT / .55);
      this.tilt.rotation.z = pr * pr * Math.PI / 2 * this.side; this.tilt.position.y = pr * this.w * .25;
      this.u.fade.value = 1 - clamp((this.deathT - .55) / .5, 0, 1);
    }
    // fire
    if (this.burning && !this.dead) {
      if (!this.fire) { this.fire = new THREE.Sprite(this.mgr._fireMat); this.fire.scale.set(this.w * 1.6 + .2, this.h * 1.15, 1); this.fire.position.y = this.h * .55; this.fire.renderOrder = 2; this.root.add(this.fire); }
      this.fire.visible = true;
    } else if (this.fire) this.fire.visible = false;
    this.showShadow = !this.dead && this.onGround;
  }

  update(dt, player) {
    this.age += dt;
    if (this.invul > 0) this.invul -= dt; if (this.hurtT > 0) this.hurtT -= dt; if (this.noCtrl > 0) this.noCtrl -= dt;
    if (this.attackCD > 0) this.attackCD -= dt; if (this.swingT > 0) this.swingT -= dt; if (this.shootCD > 0) this.shootCD -= dt; if (this.leapCD > 0) this.leapCD -= dt;
    if (this.anger > 0) this.anger -= dt;
    if (this.breedCD > 0) this.breedCD -= dt;
    if (this.loveT > 0) { this.loveT -= dt; if (rand() < dt * 3) this.mgr._hearts(this, 1); if (this.loveT <= 0) this.partner = null; }
    if (this.baby) { this.growT -= dt; if (this.growT <= 0) this._setBaby(false); }
    if (this.def.lays && !this.baby && !this.dead) { this.eggT -= dt; if (this.eggT <= 0) { this.eggT = 300 + rand() * 300; this.emitSound('chicken_egg'); this.mgr._drop(this.def.lays, this.pos.clone(), 1); } }
    this._updateEnv(dt);
    if (this.dead) {
      this.deathT += dt; this.physics(dt); this.animate(dt);
      if (this.deathT >= 1.05) this.mgr._finishDeath(this);
      return;
    }
    // sunlight burning
    if (this.inLava) { this.fireT = FIRE_AFTER_LAVA; this.lavaT -= dt; if (this.lavaT <= 0) { this.lavaT = .5; this.invul = 0; this.hurt(LAVA_DMG, null, { cause: 'lava' }); if (this.dead) return; } }
    else {
      this.lavaT = 0;
      if (this.inFire) { this.fireT = Math.max(this.fireT, FIRE_AFTER_FIRE); this.fireBlockT -= dt; if (this.fireBlockT <= 0) { this.fireBlockT = .5; this.invul = 0; this.hurt(FIRE_DMG, null, { cause: 'fire' }); if (this.dead) return; } }
      else this.fireBlockT = 0;
      if (this.inWater || (this.skyOpen && !this.inFire)) this.fireT = 0; else if (this.fireT > 0) this.fireT -= dt;
    }
    this.burning = (this.def.burns && this.sunlit && this.mgr.ai) || this.fireT > 0;
    if (this.burning) { this.burnTick -= dt; if (this.burnTick <= 0) { this.burnTick = 1; this.invul = 0; this.hurt(1, null, { cause: 'fire' }); } if (rand() < dt * 6) this.mgr.particles.emit(this.pos.x + (rand() - .5) * .5, this.pos.y + this.h * rand(), this.pos.z + (rand() - .5) * .5, 0, 1.5, 0, .7, .25, .25, .25, 1); }
    this.think(dt, player);
    this._lavaGuard();
    // creeper fuse
    if (this.type === 'creeper') {
      if (this.fusing) { this.fuse += dt; if (this.fuse >= 1.5) { this.mgr._explode(this, player); return; } }
      else this.fuse = Math.max(0, this.fuse - dt * .75);
    }
    this.physics(dt);
    if (this.type === 'zombie' && this.mgr.onBreakDoor && this.mgr.difficulty === 'hard') this._doorCheck(dt);
    this.animate(dt);
    // ambient sounds
    this.idleSoundT -= dt; if (this.idleSoundT <= 0) { this.idleSoundT = 8 + rand() * 16; if (player && !this.def.noIdle && this.pos.distanceToSquared(player.position) < 400) this.emitSound(this._idleName()); }
  }

  dispose() { for (const m of this.mats) m.dispose(); this.skeleton.dispose(); }
}

/* ---------------------------------------------------------------- manager */
export class MobManager {
  /**
   * @param {THREE.Scene|THREE.Object3D} scene  where mob meshes are added
   * @param {{isSolid:(x,y,z)=>boolean, isDay?:()=>boolean, getLight?:(x,y,z)=>number, isGrass?:(x,y,z)=>boolean}} world
   */
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.mobs = []; this.time = 0;
    this.onDrop = opts.onDrop || null; this.onExplode = opts.onExplode || null; this.onSound = opts.onSound || null;
    this.hostileCap = opts.hostileCap ?? 8; this.passiveCap = opts.passiveCap ?? 10; this.spawnInterval = opts.spawnInterval ?? 1;
    this.despawnFar = opts.despawnFar ?? 72; this.simDistance = opts.simDistance ?? 56;
    this.useWorldLight = opts.useWorldLight ?? true;
    // 'scene': Lambert materials lit by the scene's lights. 'baked': unlit + per-face shade + world light level (for engines that
    // light blocks in their own shaders and add no three.js lights). 'auto' picks 'scene' only if the scene already has a light.
    let hasLight = false; scene.traverse(o => { if (o.isLight) hasLight = true; });
    this.lighting = opts.lighting && opts.lighting !== 'auto' ? opts.lighting : hasLight ? 'scene' : 'baked';
    this.ai = true; this.debugWalk = false; this.lookTarget = null; this.peaceful = false;
    this.group = new THREE.Group(); this.group.name = 'mobs'; scene.add(this.group);
    this._typeAssets = {}; this._nextSpawn = 0; this._packSeq = 0;
    this.camera = opts.camera || null; this.slimeMaxY = opts.slimeMaxY ?? SLIME_MAX_Y; this.waterCap = opts.waterCap ?? WATER_CAP;
    this.itemExistsFn = opts.itemExists || null; this._items = null; this.missingDrops = new Set();
    this._ownerHurtBy = null; this._ownerHurtT = -1e9; this._ownerHit = null; this._ownerHitT = -1e9; this._player = null;
    // drops are checked against Timmy's item list so an id the UI doesn't know yet is skipped instead of dropping a broken item
    // brightness that matches the block shader exactly: Timmy's lighting.js (sky / torch light split + SKY_CURVE) when it's there
    this._lightMod = null; this._uDayU = null; this._uDayScanT = 0; this.skyBrightness = opts.skyBrightness ?? null;
    import('./lighting.js').then(L => { if (L && typeof L.lightAt === 'function' && L.SKY_CURVE) this._lightMod = L; }).catch(() => {});
    import('./ui-data.js').then(U => { if (U && U.ITEMS) this._items = U.ITEMS; }).catch(() => {});
    // all blob shadows in one instanced draw call
    this._shadowGeo = new THREE.PlaneGeometry(1, 1); this._shadowGeo.rotateX(-Math.PI / 2);
    this._shadowMat = new THREE.MeshBasicMaterial({ map: makeShadowTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.shadows = new THREE.InstancedMesh(this._shadowGeo, this._shadowMat, 192); this.shadows.count = 0; this.shadows.frustumCulled = false; this.shadows.renderOrder = -1;
    this.group.add(this.shadows);
    this._fireTex = makeFireTex(); this._fireMat = new THREE.SpriteMaterial({ map: this._fireTex, transparent: true, depthWrite: false });
    this.particles = new Particles(this.group);
    this.pathfinder = new PathFinder(this); this._pathBudget = PATHS_PER_FRAME; this.pathStats = { runs: 0, nodes: 0, fails: 0 };
    // water: world.isWater if given, else look the block up through the running engine (window.game.world + blocks.js ID.water)
    // lava / doors / part-block boxes likewise: world.isLava / world.isDoor / world.boxesAt if given, else blocks.js lookups
    this._waterFn = typeof world.isWater === 'function' ? world.isWater.bind(world) : null;
    this._lavaFn = typeof world.isLava === 'function' ? world.isLava.bind(world) : null;
    this._doorFn = typeof world.isDoor === 'function' ? world.isDoor.bind(world) : null;
    this._boxFn = typeof world.boxesAt === 'function' ? world.boxesAt.bind(world) : null;
    // round 4: fire blocks, fences (tall), rain, biomes; again optional world functions with blocks.js / game.world fallbacks
    this._fireFn = typeof world.isFire === 'function' ? world.isFire.bind(world) : null;
    this._tallFn = typeof world.isFence === 'function' ? world.isFence.bind(world) : null;
    this._rainFn = typeof world.isRaining === 'function' ? world.isRaining.bind(world) : null;
    this._biomeFn = typeof world.biomeAt === 'function' ? world.biomeAt.bind(world) : null;
    this.onXp = opts.onXp || null; this.wolfBiomes = WOLF_BIOMES;
    this.difficulty = opts.difficulty || 'normal'; this.onBreakDoor = opts.onBreakDoor || null; this.onDoorCrack = opts.onDoorCrack || null; this.doorBreakTime = opts.doorBreakTime ?? DOOR_BREAK_TIME;
    import('./blocks.js').then(B => { const BL = B.BLOCKS; if (!BL || !BL.length) return;
      const blk = (x, y, z) => { const w = globalThis.game && globalThis.game.world; return w && typeof w.get === 'function' ? BL[w.get(x, y, z)] : undefined; };
      if (!this._waterFn) this._waterFn = (x, y, z) => { const b = blk(x, y, z); return !!b && b.kind === 'water'; };
      if (!this._lavaFn) this._lavaFn = (x, y, z) => { const b = blk(x, y, z); return !!b && b.kind === 'lava'; };
      if (!this._doorFn) this._doorFn = (x, y, z) => { const b = blk(x, y, z); return b && b.door && !b.open && /^oak_door/.test(b.name || '') ? b.door : null; };
      const gid = (x, y, z) => globalThis.game.world.get(x, y, z);
      // fences: blocks.js fenceBoxes (post + arms, 1.5 high); closed gates: their 1.5-high collision box (b.coll)
      if (!this._boxFn) this._boxFn = (x, y, z) => { const b = blk(x, y, z); if (!b || b.kind !== 'model') return null;
        if (b.fence && typeof B.fenceBoxes === 'function') return B.fenceBoxes(gid, x, y, z, true); if (b.gate && b.coll) return b.coll; return b.boxes || null; };
      // only install the fire / fence fallbacks once blocks.js actually has such blocks (no per-call cost before Mike_ adds them)
      if (!this._fireFn && BL.some(b => b && (b.fire === true || b.kind === 'fire' || /^fire(_|$)/.test(b.name || '')))) this._fireFn = (x, y, z) => { const b = blk(x, y, z); return !!b && (b.fire === true || b.kind === 'fire' || /^fire(_|$)/.test(b.name || '')); };
      if (!this._tallFn) { const tall = new Set(); BL.forEach((b, i) => { if (b && (b.fence || b.gate || /fence|(^|_)wall($|_)/.test(b.name || '') || (b.boxes && b.boxes.some(q => q[4] > 16)))) tall.add(i); });
        if (tall.size) this._tallFn = (x, y, z) => { const w = globalThis.game && globalThis.game.world; return !!w && typeof w.get === 'function' && tall.has(w.get(x, y, z)); }; }
      if (!this._biomeFn) this._biomeFn = (x, z) => { const w = globalThis.game && globalThis.game.world; return w && typeof w.biome === 'function' ? w.biome(x, z) : null; };
    }).catch(() => {});
    // arrows (pooled)
    // one merged, vertex-coloured mesh per arrow (1 draw call instead of 4)
    const arrowGeo = mergeColoredBoxes([[[.04, .04, .5], [0, 0, 0], 0x8a6a3e], [[.08, .08, .08], [0, 0, .27], 0x9a9a9a], [[.14, .02, .12], [0, 0, -.2], 0xeeeeee], [[.02, .14, .12], [0, 0, -.2], 0xeeeeee]]);
    const arrowMat = this.lighting === 'baked' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
    this._arrowGeos = [arrowGeo]; this._arrowMats = [arrowMat];
    this.arrows = [];
    for (let i = 0; i < 24; i++) {
      const g = new THREE.Mesh(arrowGeo, arrowMat); g.visible = false; this.group.add(g);
      this.arrows.push({ mesh: g, pos: g.position, vel: new THREE.Vector3(), alive: false, stuck: false, t: 0, owner: null, dmg: 3 });
    }
  }

  _assets(type) { return this._typeAssets[type] || (this._typeAssets[type] = new TypeAssets(type)); }
  _sound(name, pos, o) { if (this.onSound) this.onSound(name, pos, o); }
  /** Camera used for the enderman stare test: player.camera, then mobs.camera, then the running engine's game.camera. */
  getCamera(player) { return (player && player.camera) || this.camera || (globalThis.game && globalThis.game.camera && globalThis.game.camera.isCamera ? globalThis.game.camera : null); }
  itemExists(id) { if (this.itemExistsFn) return !!this.itemExistsFn(id); return this._items ? !!this._items[id] : true; }
  /** every mob drop goes through here: unknown item ids are skipped (and remembered in missingDrops), and onDrop can't throw into the game loop */
  _drop(item, pos, n = 1) {
    if (!this.onDrop || !item || n <= 0) return false;
    if (!this.itemExists(item)) { this.missingDrops.add(item); return false; }
    try { this.onDrop(item, pos, n); return true; } catch (e) { return false; }
  }
  _playerHitBy(mob) { this._ownerHurtBy = mob; this._ownerHurtT = this.time; }
  _playerAttacked(mob) { this._ownerHit = mob; this._ownerHitT = this.time; }
  _wolfTarget() {
    const a = this._ownerHurtBy && !this._ownerHurtBy.dead && !this._ownerHurtBy.removed && this.time - this._ownerHurtT < 8 ? this._ownerHurtBy : null;
    const b = this._ownerHit && !this._ownerHit.dead && !this._ownerHit.removed && this.time - this._ownerHitT < 8 ? this._ownerHit : null;
    return a && b ? (this._ownerHurtT > this._ownerHitT ? a : b) : a || b;
  }
  _ink(m) { for (let i = 0; i < 26; i++) this.particles.emit(m.pos.x + (rand() - .5) * .5, m.pos.y + m.h * .3, m.pos.z + (rand() - .5) * .5, (rand() - .5) * 3, (rand() - .5) * 2, (rand() - .5) * 3, 1.4 + rand(), .04, .04, .06, 0); this._sound('squid_squirt', m.pos); }
  _standable(x, y, z, hc) { const W = this.world; if (!W.isSolid(x, y - 1, z)) return false; for (let i = 0; i < hc; i++) if (W.isSolid(x, y + i, z)) return false; return !this.isWater(x, y, z) && !this.isWater(x, y - 1, z) && !this.isLava(x, y, z) && !this.isLava(x, y - 1, z); }
  _blink(m, x, y, z) {
    const P = m.pos, purple = m.type === 'enderman';
    for (let k = 0; k < 2; k++) { const cx = k ? x : P.x, cy = k ? y : P.y, cz = k ? z : P.z;
      for (let i = 0; i < 18; i++) this.particles.emit(cx + (rand() - .5) * m.w * 1.5, cy + rand() * m.h, cz + (rand() - .5) * m.w * 1.5, (rand() - .5) * 2, (rand() - .5) * 2, (rand() - .5) * 2, .8 + rand() * .4, purple ? .75 : .9, purple ? .3 : .9, purple ? .95 : .9, 0);
      if (purple) this._sound('enderman_teleport', k ? new THREE.Vector3(x, y, z) : P.clone()); }
    P.set(x, y, z); m.vel.set(0, 0, 0); m.fallStart = y; m.path = null; m.stuckT = 0; m.onGround = true; m.tpCD = 1 + rand() * .6;
  }
  /** Random teleport within `range` of (cx, cz) to a dry standable spot (enderman). near: land 2+ blocks from the centre (toward the
   *  player); otherwise land 4+ blocks from where it stood. */
  teleport(m, cx, cz, range, near = false) {
    const hc = Math.ceil(m.h - .05), y0 = Math.floor(m.pos.y), top = y0 + Math.ceil(range / 2) + 2, bot = y0 - range - 2, rain = m.type === 'enderman' && this.isRaining(m.pos.x, m.pos.z);
    for (let i = 0; i < 32; i++) {
      const x = Math.floor(cx + (rand() * 2 - 1) * range), z = Math.floor(cz + (rand() * 2 - 1) * range);
      if (near ? (x + .5 - cx) ** 2 + (z + .5 - cz) ** 2 < 4 : (x + .5 - m.pos.x) ** 2 + (z + .5 - m.pos.z) ** 2 < 16) continue;
      for (let y = top; y >= bot; y--) if (this._standable(x, y, z, hc)) { if (rain && i < 24 && this.skyExposed(x, y + hc, z, 48)) continue; this._blink(m, x + .5, y, z + .5); return true; }   // in rain, look for cover first
    }
    return false;
  }
  /** Tamed wolves catch up with the owner: pick a free cell 1-3 blocks from the player. */
  teleportNear(m, P) {
    const hc = Math.ceil(m.h - .05);
    for (let i = 0; i < 14; i++) {
      const a = rand() * TAU, r = 1.5 + rand() * 1.5, x = Math.floor(P.x + Math.sin(a) * r), z = Math.floor(P.z + Math.cos(a) * r);
      for (let y = Math.floor(P.y) + 2; y >= Math.floor(P.y) - 4; y--) if (this._standable(x, y, z, hc)) { m.pos.set(x + .5, y, z + .5); m.vel.set(0, 0, 0); m.fallStart = y; m.path = null; m.onGround = true; return true; }
    }
    return false;
  }
  isSlimeChunk(cx, cz) { let h = Math.imul(cx | 0, 0x2c1b3c6d) ^ Math.imul(cz | 0, 0x297a2d39) ^ 0x5f356495; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; return ((h >>> 0) % 10) === 0; }
  isDay() { return this.world.isDay ? !!this.world.isDay() : true; }
  isWater(x, y, z) { return this._waterFn ? !!this._waterFn(x, y, z) : false; }
  isLava(x, y, z) { return this._lavaFn ? !!this._lavaFn(x, y, z) : false; }
  /** mob brightness 0..1 for light level L at (x,y,z): same formula as engine.js's block shader (sky*uDay vs warm torch light, tiny floor) */
  _brightness(x, y, z, L) {
    const LM = this._lightMod, w = globalThis.game && globalThis.game.world;
    if (LM && w && w.chunks && w === this._gameWorld()) {
      const pk = LM.lightAt(w, x, y, z);
      if (pk >= 0) { const s = pk >> 4, b = pk & 15, C = LM.SKY_CURVE;
        return Math.min(1, Math.max(C[s] * this._uDay(), Math.pow(Math.max(0, (b - 1) / 13), 1.4) * .9, .035 * Math.max(C[s], .25))); }
    }
    return .18 + .82 * Math.pow(clamp(L / 15, 0, 1), 1.3);
  }
  _gameWorld() { const g = globalThis.game; return g && g.mobs === this ? g.world : null; }   // only when these mobs live in the engine
  /** the block shader's uDay (0.22 night .. 1 day): mobs.skyBrightness if the engine sets it, else read once from a chunk material */
  _uDay() {
    if (typeof this.skyBrightness === 'number') return this.skyBrightness;
    if (!this._uDayU && this.time >= this._uDayScanT) { this._uDayScanT = this.time + 5; let f = null; this.scene.traverse(o => { const u = !f && o.material && o.material.uniforms; if (u && u.uDay) f = u.uDay; }); this._uDayU = f; }
    return this._uDayU ? this._uDayU.value : this.isDay() ? 1 : .22;
  }
  isFire(x, y, z) { return this._fireFn ? !!this._fireFn(x, y, z) : false; }
  /** fence / wall (1.5 high): a wall for pathing, never stood on */
  isTall(x, y, z) { return this._tallFn ? !!this._tallFn(x, y, z) : false; }
  /** world.isRaining(x?, z?) (pass x,z so snowy biomes can say no), else window.game.isRaining() / .raining, else false */
  isRaining(x, z) { if (this._rainFn) return !!this._rainFn(x, z); const g = globalThis.game; return !!(g && (typeof g.isRaining === 'function' ? g.isRaining(x, z) : g.raining)); }
  biomeAt(x, z) { try { return this._biomeFn ? this._biomeFn(x, z) : null; } catch (e) { return null; } }
  /** Minecraft difficulty scaling for damage to the player: peaceful 0, easy min(n/2+1, n), normal n, hard 1.5n */
  scaleDmg(n) { const d = this.difficulty; if (n <= 0) return n; return d === 'peaceful' ? 0 : d === 'easy' ? Math.min(n, n / 2 + 1) : d === 'hard' ? n * 1.5 : n; }
  get isPeaceful() { return this.peaceful || this.difficulty === 'peaceful'; }
  _xp(n, pos) { if (!this.onXp || !(n > 0)) return; try { this.onXp(n, pos.clone ? pos.clone() : pos); } catch (e) { /* engine hook */ } }
  /**
   * TNT / any explosion from the engine: damages and knocks back every mob in range with Minecraft's formula
   * (impact = (1 - d / 2P) * exposure; damage = (impact^2 + impact) / 2 * 7 * 2P + 1). Blocks and the player stay the engine's job.
   * Returns the number of mobs hit. Creepers keep using onExplode for their own blast.
   */
  explode(pos, power = 4, opts = {}) {
    if (!pos) return 0; const R = power * 2; let n = 0; const cx = pos.x, cy = pos.y, cz = pos.z;
    for (const o of this.mobs) {
      if (o.dead || o === opts.source) continue;
      const mx = o.pos.x, my = o.pos.y + o.h * .5, mz = o.pos.z, d = Math.hypot(mx - cx, my - cy, mz - cz); if (d >= R) continue;
      let seen = 0; for (const fy of [.1, .5, .9]) if (this.lineOfSight(cx, cy, cz, mx, o.pos.y + o.h * fy, mz)) seen++;
      const exposure = seen / 3, impact = (1 - d / R) * exposure; if (impact <= 0) continue;
      const dmg = Math.floor((impact * impact + impact) / 2 * 7 * R + 1);
      o.invul = 0; _v2.set(cx, cy, cz);
      o.hurt(dmg, _v2, { cause: 'explosion', knockback: 4 + impact * 14, attacker: opts.attacker, player: !!opts.byPlayer });
      if (!o.dead) o.vel.y = Math.max(o.vel.y, 3 + impact * 6);
      n++;
    }
    for (let i = 0; i < 30; i++) this.particles.emit(cx + (rand() - .5) * 2, cy + (rand() - .5) * 1.6, cz + (rand() - .5) * 2, (rand() - .5) * 9, rand() * 7, (rand() - .5) * 9, .6 + rand() * .7, .6, .6, .6, -3);
    return n;
  }
  /** 'lower' | 'upper' for a closed wooden door, else null */
  isDoor(x, y, z) { return this._doorFn ? this._doorFn(x, y, z) || null : null; }

  _hearts(m, n) { for (let i = 0; i < n; i++) this.particles.emit(m.pos.x + (rand() - .5) * m.w, m.pos.y + m.h + .1 + rand() * .3, m.pos.z + (rand() - .5) * m.w, (rand() - .5) * .4, .8 + rand() * .4, (rand() - .5) * .4, 1.1, 1, .25 + rand() * .2, .4, .3); }

  /**
   * Player uses an item on a mob (right click). target: Mob, Ray, or Raycaster. Returns { mob, consumed } or null.
   * Food: cow/sheep take wheat, chicken takes wheat_seeds. Adults enter love mode (30s) and breed with a partner; babies grow 10% faster.
   */
  interact(target, itemId, opts = {}) {
    let mob = null;
    if (target instanceof Mob) mob = target; else if (target) { const h = this.raycast(target.ray || target, opts.reach ?? 4); if (h) mob = h.mob; }
    if (!mob || mob.dead) return null;
    if (mob.type === 'wolf') return { mob, consumed: this._wolfUse(mob, itemId, opts.player || this._player) };
    return { mob, consumed: this.feed(mob, itemId) };
  }
  /** Wolf + item: bone tames a wild wolf (1 in 3, like the game); meat heals a tamed one; anything else makes it sit / stand. */
  _wolfUse(w, itemId, player) {
    if (!w.tamed) {
      if (itemId !== 'bone' || w.angry) return false;
      if (rand() < (this.tameChance ?? 1 / 3)) { w._setTamed(true, player); w.sitting = true; w.path = null; this._hearts(w, 7); this._sound('wolf_tame', w.pos); }
      else for (let i = 0; i < 7; i++) this.particles.emit(w.pos.x + (rand() - .5) * .6, w.pos.y + w.h + rand() * .3, w.pos.z + (rand() - .5) * .6, (rand() - .5) * .5, .7, (rand() - .5) * .5, .9, .55, .55, .55, .2);
      return true;
    }
    const heal = WOLF_FOOD[itemId];
    if (heal && w.hp < w.maxHp) { w.hp = Math.min(w.maxHp, w.hp + heal); this._hearts(w, 3); this._sound('wolf_idle', w.pos); return true; }
    if (heal) return false;
    w.sitting = !w.sitting; w.path = null; w.target = null; w.moveSpeed = 0; return false;
  }
  feed(mob, itemId) {
    if (!mob || mob.dead || !itemId || mob.def.food !== itemId) return false;
    if (mob.baby) { mob.growT *= .9; this._hearts(mob, 3); return true; }
    if (mob.loveT > 0 || mob.breedCD > 0) return false;
    mob.loveT = LOVE_TIME; mob.partner = null; this._hearts(mob, 6); this._sound('breed', mob.pos); return true;
  }
  _updateBreeding() {
    const ms = this.mobs;
    for (const a of ms) {
      if (a.loveT <= 0 || a.dead || a.baby) continue;
      if (!a.partner || a.partner.loveT <= 0 || a.partner.dead || a.partner.removed) {
        a.partner = null; let bd = 64;
        for (const b of ms) if (b !== a && b.type === a.type && b.loveT > 0 && !b.dead && !b.baby) { const d = a.pos.distanceToSquared(b.pos); if (d < bd) { bd = d; a.partner = b; } }
      }
      const b = a.partner;
      if (b && b.partner === a && a.pos.distanceTo(b.pos) < 1.3) {
        a.loveT = b.loveT = 0; a.partner = b.partner = null; a.breedCD = b.breedCD = BREED_CD;
        const kid = this.spawn(a.type, (a.pos.x + b.pos.x) / 2, Math.max(a.pos.y, b.pos.y), (a.pos.z + b.pos.z) / 2, { baby: true, wool: a.woolColor && rand() < .5 ? a.woolColor.name : b.woolColor ? b.woolColor.name : undefined });
        this._hearts(kid, 8); this._sound('baby', kid.pos); this._xp(randInt(1, 7), kid.pos);
      }
    }
  }

  get hostileCount() { let n = 0; for (const m of this.mobs) if (m.hostile && !m.dead) n++; return n; }
  get passiveCount() { let n = 0; for (const m of this.mobs) if (!m.hostile && !m.dead) n++; return n; }

  /** Spawn a mob. opts: { yaw, wool:'white'|'black'|... } */
  spawn(type, x, y, z, opts = {}) {
    if (!MOB_TYPES[type]) throw new Error('unknown mob type ' + type);
    const m = new Mob(this, type, x, y, z, opts);
    this.mobs.push(m); this.group.add(m.root); return m;
  }
  remove(m) {
    if (m.removed) return; m.removed = true;
    const i = this.mobs.indexOf(m); if (i >= 0) this.mobs.splice(i, 1);
    this.group.remove(m.root); m.dispose();
  }
  clear() { while (this.mobs.length) this.remove(this.mobs[this.mobs.length - 1]); for (const a of this.arrows) { a.alive = false; a.mesh.visible = false; } }

  // skylight straight down through leaves (MC: each leaf block only dims it by 1); -1 if anything else blocks the sky
  _leafSky(x, y, z) { const W = this.world, g = globalThis.game?.world; if (!g?.get) return -1; let n = 0;
    for (let i = 0; i < 48; i++) { if (!W.isSolid(x, y + i, z)) continue; if (/_leaves$/.test(BLOCKS[g.get(x, y + i, z)]?.name || '')) n++; else return -1; }
    return 15 - n; }
  // daytime skylight reaching (x,y,z) sideways from the nearest sky-exposed column within 7 blocks (8 directions, walls block it)
  _sideSky(x, y, z) { const W = this.world; let best = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
      for (let d = 1; d <= 7 && 15 - d * (dx && dz ? 2 : 1) > best; d++) { const cx = x + dx * d, cz = z + dz * d;
        if (W.isSolid(cx, y, cz) && W.isSolid(cx, y + 1, cz)) break;
        const cy = W.isSolid(cx, y, cz) ? y + 1 : y; if (this.skyExposed(cx, cy, cz, 40) || this._leafSky(cx, cy, cz) > 7 + d) { best = 15 - d * (dx && dz ? 2 : 1); break; } }
    return best; }
  skyExposed(x, y, z, maxUp = 48) { const W = this.world; for (let i = 0; i < maxUp; i++) if (W.isSolid(x, y + i, z)) return false; return true; }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz), n = Math.ceil(L / .3), W = this.world;
    for (let i = 1; i < n; i++) { const t = i / n; if (W.isSolid(Math.floor(ax + dx * t), Math.floor(ay + dy * t), Math.floor(az + dz * t))) return false; }
    return true;
  }

  /** Ray (THREE.Ray, or a Raycaster) vs mob hitboxes. Returns { mob, distance } or null. */
  raycast(ray, maxDist = 4) {
    if (ray && ray.ray) ray = ray.ray;
    const o = ray.origin, d = ray.direction; let best = null, bt = maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const hw = m.w / 2 + .1, p = m.pos;
      let tmin = 0, tmax = bt;
      for (let ax = 0; ax < 3; ax++) {
        const oo = ax === 0 ? o.x : ax === 1 ? o.y : o.z, dd = ax === 0 ? d.x : ax === 1 ? d.y : d.z;
        const lo = ax === 0 ? p.x - hw : ax === 1 ? p.y : p.z - hw, hi = ax === 0 ? p.x + hw : ax === 1 ? p.y + m.h + .1 : p.z + hw;
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { tmin = Infinity; break; } continue; }
        let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) { tmin = Infinity; break; }
      }
      if (tmin < bt) { bt = tmin; best = m; }
    }
    return best ? { mob: best, distance: bt } : null;
  }

  /**
   * Player attacks. target: a Mob, a THREE.Ray, or a THREE.Raycaster. damage defaults to 1 (fist).
   * opts: { reach = 4 (pass min(reach, distance to first solid block)), from: Vector3 for knockback, knockback }
   * Returns the Mob that was hit (even if still invulnerable) or null.
   */
  attack(target, damage = 1, opts = {}) {
    let mob = null, from = opts.from || null;
    if (target instanceof Mob) mob = target;
    else if (target) { const ray = target.ray || target; const h = this.raycast(ray, opts.reach ?? 4); if (h) mob = h.mob; if (!from) from = ray.origin; }
    if (!mob || mob.dead) return null;
    mob.hurt(damage, from || null, { player: true, knockback: opts.knockback });
    return mob;
  }

  _finishDeath(m) {
    const p = m.pos;
    for (let i = 0; i < 14; i++) this.particles.emit(p.x + (rand() - .5) * m.w, p.y + rand() * m.h * .6 + .1, p.z + (rand() - .5) * m.w, (rand() - .5) * 1.5, .6 + rand() * 1.2, (rand() - .5) * 1.5, .7 + rand() * .4, .85, .85, .85, .4);
    if (m.cause !== 'void' && this.time - m.xpT < 5) {
      const xp = m.type === 'slime' ? m.size : m.type === 'zombie' && m.baby ? 12 : XP[m.type] ?? (m.baby ? 0 : randInt(1, 3));
      this._xp(xp, _v1.set(p.x, p.y + .5, p.z));
    }
    if (m.cause !== 'void' && (!m.baby || m.hostile) && !(m.type === 'slime' && m.size > 1)) {
      _v1.set(p.x, p.y + .4, p.z);
      for (const [item, lo, hi] of m.def.drops) { const n = randInt(lo, hi); if (n <= 0) continue;
        const cooked = m.diedBurning && COOKED[item] && this.itemExists(COOKED[item]) ? COOKED[item] : item;   // died on fire: cooked meat
        this._drop(cooked, _v1.clone(), n); }
      if (m.woolColor) this._drop(m.woolColor.name + '_wool', _v1.clone(), 1);
    }
    // big slimes split into 2-4 of the next size down
    if (m.type === 'slime' && m.size > 1 && m.cause !== 'void') {
      const n = randInt(2, 4), sz = m.size / 2;
      for (let i = 0; i < n; i++) { const a = rand() * TAU, r = m.w * .25; const k = this.spawn('slime', p.x + Math.sin(a) * r, p.y + .05, p.z + Math.cos(a) * r, { size: sz, yaw: a });
        k.vel.set(Math.sin(a) * 2, 3, Math.cos(a) * 2); k.jumpT = .4 + rand() * .6; k.invul = .4; }
    }
    this.remove(m);
  }

  _explode(m, player) {
    const p = m.pos, R = 3; _v2.set(p.x, p.y + .8, p.z);
    for (let i = 0; i < 70; i++) {
      const g = .3 + rand() * .6, fire = rand() < .35;
      this.particles.emit(_v2.x + (rand() - .5) * 2, _v2.y + (rand() - .5) * 1.6, _v2.z + (rand() - .5) * 2, (rand() - .5) * 9, rand() * 7, (rand() - .5) * 9, .6 + rand() * .7, fire ? 1 : g, fire ? .6 : g, fire ? .2 : g, -3);
    }
    this._sound('explode', _v2);
    if (player && player.hurt && !player.ignoredByMobs) {
      const d = player.position.distanceTo(_v2);
      if (d < R * 2) player.hurt(this.scaleDmg(Math.round((1 - d / (R * 2)) * 20)), _v2.clone(), m);
    }
    for (const o of this.mobs) { if (o === m || o.dead) continue; const d = o.pos.distanceTo(_v2); if (d < R * 2) { o.invul = 0; o.hurt(Math.round((1 - d / (R * 2)) * 18), _v2, { cause: 'explosion', knockback: 10 }); } }
    if (this.onExplode) this.onExplode(_v2.clone(), R);
    m.dead = true; m.cause = 'explosion';
    this.remove(m);
  }

  _shootArrow(m, tgt) {
    const a = this.arrows.find(x => !x.alive) || this.arrows.reduce((o, x) => x.t > o.t ? x : o);
    const sx = m.pos.x + Math.sin(m.yaw) * .4, sy = m.pos.y + 1.45, sz = m.pos.z + Math.cos(m.yaw) * .4;
    const tx = tgt.position.x, ty = tgt.position.y + (tgt.height ?? 1.8) * .55, tz = tgt.position.z;
    const dx = tx - sx, dz = tz - sz, hd = Math.hypot(dx, dz), speed = 20, T = hd / speed;
    const err = .06 + hd * .006;
    const vy = (ty - sy) / T + .5 * 16 * T;
    a.vel.set(dx / T + (rand() - .5) * err * speed, vy + (rand() - .5) * err * speed, dz / T + (rand() - .5) * err * speed);
    a.pos.set(sx, sy, sz); a.alive = true; a.stuck = false; a.t = 0; a.owner = m; a.mesh.visible = true;
    _v1.copy(a.pos).add(a.vel); a.mesh.lookAt(_v1);
    m.swingT = .2; this._sound('skeleton_shoot', a.pos);
  }

  _updateArrows(dt, player) {
    const W = this.world;
    for (const a of this.arrows) {
      if (!a.alive) continue; a.t += dt;
      if (a.stuck) { if (a.t > 5) { a.alive = false; a.mesh.visible = false; } continue; }
      if (a.t > 8) { a.alive = false; a.mesh.visible = false; continue; }
      a.vel.y -= 16 * dt;
      const n = Math.max(1, Math.ceil(a.vel.length() * dt / .2)), s = dt / n;
      for (let i = 0; i < n; i++) {
        a.pos.x += a.vel.x * s; a.pos.y += a.vel.y * s; a.pos.z += a.vel.z * s;
        if (W.isSolid(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z))) { a.stuck = true; a.t = 0; this._sound('arrow_hit', a.pos); break; }
        let hitMob = null;
        for (const m of this.mobs) {
          if (m === a.owner && a.t < .5 || m.dead) continue; const hw = m.w / 2 + .05;
          if (Math.abs(a.pos.x - m.pos.x) < hw && Math.abs(a.pos.z - m.pos.z) < hw && a.pos.y > m.pos.y && a.pos.y < m.pos.y + m.h) { hitMob = m; break; }
        }
        if (hitMob) { _v2.set(a.pos.x - a.vel.x, a.pos.y, a.pos.z - a.vel.z); hitMob.hurt(a.dmg, _v2, { cause: 'arrow', knockback: 3.5, shooter: a.owner, attacker: a.owner }); a.alive = false; a.mesh.visible = false; this._sound('arrow_hit', a.pos); break; }
        if (player && player.hurt && !player.ignoredByMobs) {
          const P = player.position, ph = player.height ?? 1.8;
          if (Math.abs(a.pos.x - P.x) < .4 && Math.abs(a.pos.z - P.z) < .4 && a.pos.y > P.y && a.pos.y < P.y + ph) {
            player.hurt(this.scaleDmg(a.dmg), a.owner ? a.owner.pos : a.pos, a.owner); if (a.owner) this._playerHitBy(a.owner); a.alive = false; a.mesh.visible = false; this._sound('arrow_hit_player', a.pos); break;
          }
        }
      }
      if (a.alive && !a.stuck) { _v1.copy(a.pos).add(a.vel); a.mesh.lookAt(_v1); }
    }
  }

  /** Call every frame. player: { position: Vector3 (feet), hurt(amount, fromPos, mob), eyeHeight?, height?, dead?, ignoredByMobs? } */
  update(dt, player) {
    dt = Math.min(dt, .1); this.time += dt; this._pathBudget = PATHS_PER_FRAME; if (player) this._player = player;
    const pp = player ? player.position : null;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i]; if (!m) continue;
      if (pp) {
        const d2 = (m.pos.x - pp.x) ** 2 + (m.pos.z - pp.z) ** 2;
        // tamed wolves never despawn, and a standing one keeps updating far away so it can teleport back to its owner
        if (!m.tamed && d2 > this.despawnFar * this.despawnFar && (m.hostile || d2 > 4 * this.despawnFar * this.despawnFar)) { this.remove(m); continue; }
        if (d2 > this.simDistance * this.simDistance && !(m.tamed && !m.sitting)) { m.root.visible = d2 < 80 * 80; continue; }
        m.root.visible = true;
      }
      m.update(dt, player);
    }
    // blob shadows -> one instanced mesh
    let ns = 0; const S = this.shadows;
    for (const m of this.mobs) { if (!m.showShadow || !m.root.visible || ns >= 192) continue; const k = m.shadowScale; _m4.makeScale(k, 1, k).setPosition(m.pos.x, m.pos.y + .02, m.pos.z); S.setMatrixAt(ns++, _m4); }
    S.count = ns; if (ns) S.instanceMatrix.needsUpdate = true;
    // keep mobs from stacking inside each other
    const ms = this.mobs;
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j]; if (a.dead || b.dead) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, r = (a.w + b.w) * .5, d2 = dx * dx + dz * dz;
      if (d2 > r * r || d2 < 1e-6 || Math.abs(a.pos.y - b.pos.y) > Math.max(a.h, b.h)) continue;
      const d = Math.sqrt(d2), push = (r - d) * 4 * dt / d;
      a.vel.x -= dx * push * 4; a.vel.z -= dz * push * 4; b.vel.x += dx * push * 4; b.vel.z += dz * push * 4;
    }
    this._updateBreeding();
    this._updateArrows(dt, player);
    this.particles.update(dt);
    this._fireTex.offset.y = (Math.floor(this.time * 10) % 4) * .25;
  }

  _findGround(x, z, yTop, yBottom, needH) {
    const W = this.world;
    for (let y = yTop; y >= yBottom; y--) {
      if (W.isSolid(x, y - 1, z) && !W.isSolid(x, y, z) && (needH < 1 || !W.isSolid(x, y + 1, z))) return this.isWater(x, y, z) || this.isWater(x, y - 1, z) || this.isLava(x, y, z) || this.isLava(x, y + 1, z) ? null : y;
    }
    return null;
  }

  /**
   * Call every frame (it throttles itself, once per spawnInterval). Rules:
   *  - hostiles: dark cells (light <= 7) 16-22 blocks out; zombie/skeleton/creeper/spider, rare enderman (needs 3 free blocks),
   *    5% of zombies are babies; below y = slimeMaxY (40) in "slime chunks" (1 in 10, fixed hash) slimes of size 1/2/4.
   *  - animals: lit grass under open sky, 24-48 blocks out, groups of 2-4; wolves (packs) only in daylight.
   *  - squid: separate water cap (5); a column of >= 3 water blocks, 12-40 blocks out, 1-3 at a time.
   */
  spawnAround(player) {
    if (!player || this.time < this._nextSpawn) return; this._nextSpawn = this.time + this.spawnInterval;
    // MC: thunderstorms dim sky light enough that hostiles spawn on the surface even by day
    const thunder = !!(this.world.isThundering ? this.world.isThundering() : globalThis.game?.FX?.weather?.thunder);
    const P = player.position, W = this.world, day = this.isDay() && !thunder;
    let hostile = 0, passive = 0, water = 0; for (const m of this.mobs) if (!m.dead) { if (m.def.swims) water++; else if (m.hostile) hostile++; else passive++; }
    // random despawn of idle far hostiles (like vanilla's 32-block rule)
    for (const m of this.mobs) if (m.hostile && !m.dead && !m.chasing && !m.angry && m.pos.distanceToSquared(P) > 32 * 32 && rand() < .025) { this.remove(m); hostile--; }
    if (this.isPeaceful) for (let i = this.mobs.length - 1; i >= 0; i--) { const m = this.mobs[i]; if (m.hostile && !m.dead) { this.remove(m); hostile--; } }   // peaceful: hostiles vanish, like MC
    if (!this.isPeaceful && hostile < this.hostileCap) {
      for (let tries = 0; tries < 6; tries++) {
        const a = rand() * TAU, r = 16 + rand() * 6, x = Math.floor(P.x + Math.sin(a) * r), z = Math.floor(P.z + Math.cos(a) * r);
        const y = this._findGround(x, z, Math.floor(P.y + 8 + rand() * 12), Math.floor(P.y - 24), 2); if (y === null) continue;
        const sky = this.skyExposed(x, y, z, 40);
        // MC 1.18+: hostiles need light <= 7. Our flood-fill treats leaves as opaque, so by day also count skylight leaking in
        // sideways (15 minus distance to open sky), which is what keeps vanilla tree shade and overhang lips too bright to spawn in.
        // Thunder darkens skylight by 10, so open sky counts as dark then.
        const lit = W.getLight ? (W.getLight(x, y, z) ?? 15) : (day && sky ? 15 : 0);
        const dark = thunder ? (lit <= 7 || sky) : lit <= 7 && !(day && (this._leafSky(x, y, z) > 7 || this._sideSky(x, y, z) > 7));
        if (!dark) continue;
        let type = pickW(HOSTILE_WEIGHTS), o = {};
        if (y <= this.slimeMaxY && this.isSlimeChunk(x >> 4, z >> 4) && rand() < .5) {
          type = 'slime'; let sz = [1, 2, 4][randInt(0, 2)];
          if (sz === 4) for (let dx = -1; dx <= 1 && sz === 4; dx++) for (let dz = -1; dz <= 1; dz++) if (W.isSolid(x + dx, y, z + dz) || W.isSolid(x + dx, y + 1, z + dz) || W.isSolid(x + dx, y + 2, z + dz)) { sz = 2; break; }
          o.size = sz;
        }
        if (type === 'spider' && (W.isSolid(x + 1, y, z) || W.isSolid(x - 1, y, z) || W.isSolid(x, y, z + 1) || W.isSolid(x, y, z - 1))) continue;
        if (type === 'enderman' && W.isSolid(x, y + 2, z)) continue;
        if (type === 'zombie' && rand() < BABY_ZOMBIE) o.baby = true;
        this.spawn(type, x + .5, y, z + .5, o); break;
      }
    }
    if (passive < this.passiveCap && rand() < .35) {
      for (let tries = 0; tries < 4; tries++) {
        const a = rand() * TAU, r = 24 + rand() * 24, x = Math.floor(P.x + Math.sin(a) * r), z = Math.floor(P.z + Math.cos(a) * r);
        const y = this._findGround(x, z, Math.floor(P.y + 30), Math.floor(P.y - 30), 2); if (y === null) continue;
        if (!this.skyExposed(x, y, z, 40)) continue;
        if (W.isGrass && !W.isGrass(x, y - 1, z)) continue;
        if (W.getLight && (W.getLight(x, y, z) ?? 15) < 9) continue;
        const type = pickW(PASSIVE_WEIGHTS); if (type === 'wolf' && !day) continue;
        if (type === 'wolf') { const b = this.biomeAt(x, z); if (b && !this.wolfBiomes.test(b)) continue; }   // forest / taiga only when biomes exist
        const n = Math.min(this.passiveCap - passive, randInt(2, 4)), pack = ++this._packSeq;
        let made = 0;
        for (let k = 0; k < n * 3 && made < n; k++) {
          const xx = x + randInt(-2, 2), zz = z + randInt(-2, 2), yy = this._findGround(xx, zz, y + 2, y - 2, 1);
          if (yy === null) continue; this.spawn(type, xx + .5, yy, zz + .5, { pack }); made++;
        }
        break;
      }
    }
    if (water < this.waterCap && rand() < .25) {
      for (let tries = 0; tries < 4; tries++) {
        const a = rand() * TAU, r = 12 + rand() * 28, x = Math.floor(P.x + Math.sin(a) * r), z = Math.floor(P.z + Math.cos(a) * r);
        let top = null; for (let y = Math.floor(P.y) + 12; y >= Math.floor(P.y) - 24; y--) { if (this.isWater(x, y, z)) { top = y; break; } if (W.isSolid(x, y, z)) break; }
        if (top === null || !this.isWater(x, top - 1, z) || !this.isWater(x, top - 2, z)) continue;
        const n = Math.min(this.waterCap - water, randInt(1, 3));
        for (let k = 0, made = 0; k < n * 3 && made < n; k++) {
          const xx = x + randInt(-2, 2), zz = z + randInt(-2, 2), yy = top - 2;
          if (!this.isWater(xx, yy, zz) || !this.isWater(xx, yy + 1, zz)) continue; this.spawn('squid', xx + .5, yy + .02, zz + .5); made++;
        }
        break;
      }
    }
  }

  dispose() {
    this.clear(); this.scene.remove(this.group);
    for (const k in this._typeAssets) { const A = this._typeAssets[k]; A.tex.dispose(); for (const g of Object.values(A.geo)) g.dispose(); }
    this.shadows.dispose(); this._shadowGeo.dispose(); this._shadowMat.map.dispose(); this._shadowMat.dispose(); this._fireTex.dispose(); this._fireMat.dispose();
    this._arrowGeos.forEach(g => g.dispose()); this._arrowMats.forEach(m => m.dispose());
    this.particles.geo.dispose(); this.particles.points.material.dispose();
  }
}
