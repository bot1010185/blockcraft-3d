// Blockcraft 3D engine (Mike): renderer, world streaming, player, mining, sky, and glue for
// Trish's textures (textures.js via blocktex.js), Timmy's inventory UI (ui.js), and Amir's mobs (mobs.js).
import * as THREE from './vendor/three.module.js';
import { World, buildChunkMesh, addModel, spruceTree, CS, CH, SEA } from './world.js';
import { installFeatures } from './features.js'; // Mike batch 4: XP orbs, fences/gates/trapdoors, fire, TNT, boats, weather
import { BLOCKS, ID, isSolid, isBlocking, isWater, isLava, isFluid, faceTex, DIRS } from './blocks.js';
import { buildAtlas } from './blocktex.js';
import { createUI, ITEMS, RECIPES, createFurnace, tickFurnace, createChest, normalizeChest, armorReduce } from './ui.js';
import { MobManager } from './mobs.js';
import { attachMobSounds } from './mob-sounds.js';
import { HUD } from './hud.js';
import { installGfx, installDifficulty } from './sky.js'; import { lightAt } from './lighting.js'; // Timmy: sky/clouds/Fast-Fancy (sky.js) + flood-fill light (lighting.js)

const SAVE = 'blockcraft3d-v1', TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const params = new URLSearchParams(location.search);
let RD = +(params.get('rd') || (TOUCH ? 4 : 7)); // render distance in chunks

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(TOUCH ? 75 : 70, innerWidth / innerHeight, .05, 1000);
camera.rotation.order = 'YXZ';
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const atlas = buildAtlas(), tex = new THREE.CanvasTexture(atlas.canvas);
tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
const U = { map: { value: tex }, uDay: { value: 1 }, uSkyTint: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color() }, uFogNear: { value: 50 }, uFogFar: { value: 100 }, uAlpha: { value: 1 }, uTime: { value: 0 } };
const VS = `attribute vec3 light; varying vec2 vUv; varying vec2 vL; varying float vD; varying vec3 vW; uniform float uTime; uniform float uWave;
void main(){ vUv=uv; vL=light.xy; vec3 p=position; if(uWave>0.5){ p.y += sin(p.x*1.3+uTime*1.6)*0.03+cos(p.z*1.1+uTime*1.3)*0.03 - 0.04; }
 if(light.z>0.5){ float w=sin(uTime*1.7+p.x*0.6+p.z*0.4)*0.035+sin(uTime*2.9+p.z*0.9)*0.015; p.x+=w; p.z+=w*0.6; } vW=p;
vec4 mv=modelViewMatrix*vec4(p,1.0); vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`;
const FS = `uniform sampler2D map; uniform float uDay; uniform vec3 uSkyTint; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uCut;
uniform float uTime; uniform float uWave; varying vec2 vUv; varying vec2 vL; varying float vD; varying vec3 vW; uniform float uLava; uniform vec4 uTile; /* Mike: lava scroll */
uniform vec3 uFogSun; uniform vec3 uSunDir; uniform float uSunset; /* Timmy: set by sky.js. No extra varyings on purpose (they cost fill rate) */
void main(){ vec2 uv=vUv; if(uLava>0.5){ vec2 sz=uTile.zw-uTile.xy; vec2 f=fract((vUv-uTile.xy)/sz+vec2(uTime*0.018,uTime*0.03)+0.06*vec2(sin(vW.z*0.8+uTime*0.7),sin(vW.x*0.8+uTime*0.6))); uv=uTile.xy+clamp(f,0.001,0.999)*sz; }
 vec4 t=texture2D(map,uv); if(uCut>0.5 && t.a<0.5) discard;
 if(uLava>0.5){ float r=sin(vW.x*1.3+uTime*0.9)*sin(vW.z*1.1-uTime*0.7)+0.5*sin((vW.x-vW.z)*2.1+uTime*1.3); t.rgb*=0.88+0.16*r; t.rgb+=vec3(0.18,0.07,0.0)*smoothstep(0.8,1.4,r); }
 if(uWave>0.5 && uLava<0.5){ float r=sin(vW.x*2.1+uTime*1.9)*sin(vW.z*1.7-uTime*1.4)+0.5*sin((vW.x+vW.z)*3.3+uTime*2.6); t.rgb*=0.92+0.12*r; t.rgb+=vec3(0.08,0.1,0.12)*smoothstep(0.9,1.4,r)*uDay; }
 float s=vL.x; vec3 sky=uSkyTint*s*uDay; vec3 torch=vec3(1.0,0.78,0.5)*pow(vL.y,1.4)*1.1;
 vec3 l=max(sky,torch); l=max(l, vec3(0.035)*max(s,0.25)); vec3 c=t.rgb*l;
 float a=uAlpha<1.0 ? uAlpha : t.a;
#ifdef WATER
 float k=1.0-abs(normalize(vW-cameraPosition).y); k*=k; k*=k; c=mix(c,uFog*(0.55+0.45*uDay),k*0.6); a=mix(0.62,0.94,k); /* Timmy: water fresnel, compiled into the water material only */
#endif
 float f=smoothstep(uFogNear,uFogFar,vD); vec3 fc=uFog;
#ifdef SUNFOG
 float d=max(dot(normalize(vW.xz-cameraPosition.xz+vec2(1e-4)),normalize(uSunDir.xz+vec2(1e-5))),0.0); fc=mix(uFog,uFogSun,uSunset*d*d); /* Timmy: only compiled in around sunrise/sunset */
#endif
 gl_FragColor=vec4(mix(c,fc,f), a); }`; /* Timmy: fog turns toward the sunset colour on the sun's side */
const mat = (o) => new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, U, { uCut: { value: 0 }, uWave: { value: 0 }, uLava: { value: 0 }, uTile: { value: new THREE.Vector4(0, 0, 1, 1) } }), vertexShader: VS, fragmentShader: FS }, o));
const mSolid = mat({}), mCut = mat({ side: THREE.DoubleSide }), mWater = mat({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
const mLava = mat({}); mLava.uniforms.uWave.value = 1; mLava.uniforms.uLava.value = 1; mLava.uniforms.uTile.value.fromArray(atlas.uv.lava || atlas.uv.stone); mCut.uniforms.uCut.value = 1; mWater.uniforms.uAlpha.value = .78; mWater.uniforms.uWave.value = 1;
for (const m of [mSolid, mCut, mWater, mLava]) for (const k in U) m.uniforms[k] = U[k];

// ---------- world ----------
let saved = null; try { saved = JSON.parse(localStorage.getItem(SAVE)); } catch (e) {}
if (params.has('new')) saved = null;
const seed = saved?.seed ?? (params.get('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0);
const world = new World(seed); if (saved?.mods) world.mods = saved.mods;
const group = new THREE.Group(); scene.add(group);

function toGeo(b) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('light', new THREE.Float32BufferAttribute(b.col, 3)); g.setIndex(b.idx); g.computeBoundingSphere(); return g; }
function remesh(ch) {
  if (ch.mesh) { for (const m of ch.mesh) { group.remove(m); m.geometry.dispose(); } }
  const o = buildChunkMesh(world, ch, atlas.uv); ch.mesh = [];
  for (const [b, m, order] of [[o.solid, mSolid, 0], [o.cutout, mCut, 1], [o.lava, mLava, 0], [o.water, mWater, 2]]) if (b.idx.length) { const mesh = new THREE.Mesh(toGeo(b), m); mesh.renderOrder = order; group.add(mesh); ch.mesh.push(mesh); }
  ch.dirty = false;
}
const ready = (cx, cz) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!world.getChunk(cx + dx, cz + dz)) return false; return true; };
function streamChunks(budgetMs) {
  const t0 = performance.now(), pcx = Math.floor(player.pos.x / CS), pcz = Math.floor(player.pos.z / CS), list = [];
  for (let dz = -RD - 1; dz <= RD + 1; dz++) for (let dx = -RD - 1; dx <= RD + 1; dx++) if (dx * dx + dz * dz <= (RD + 1.5) ** 2) list.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, cx, cz] of list) { if (performance.now() - t0 > budgetMs) break; if (!world.getChunk(cx, cz)) world.genChunk(cx, cz); }
  for (const [d, cx, cz] of list) { if (performance.now() - t0 > budgetMs) break; if (d > (RD + .5) ** 2) continue; const ch = world.getChunk(cx, cz); if (ch && ch.dirty && ready(cx, cz)) remesh(ch); }
  for (const [k, ch] of world.chunks) { const dx = ch.cx - pcx, dz = ch.cz - pcz; if (dx * dx + dz * dz > (RD + 4) ** 2) { if (ch.mesh) for (const m of ch.mesh) { group.remove(m); m.geometry.dispose(); } world.chunks.delete(k); } }
}

// ---------- player ----------
const armorOf = () => ui.armorPoints();
const player = { armor: saved?.armor || { helmet: null, chestplate: null, leggings: null, boots: null }, pos: new THREE.Vector3(.5, 80, .5), vel: new THREE.Vector3(), yaw: 0, pitch: 0, ground: false, hp: 20, fallStart: null, inWater: false, hurtT: 0, air: 15, food: saved?.food ?? 20, sat: saved?.sat ?? 5, exh: 0, spawn: saved?.spawn || null };
function spawnPoint() { for (let r = 0; r < 200; r += 4) for (let a = 0; a < 8; a++) { const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r), h = world.height(x, z), b = world.biome(x, z); if (h > SEA + 1 && h < 95 && b !== 'desert') return [x + .5, h + 1, z + .5]; } return [.5, 90, .5]; }
if (saved?.p) { player.pos.set(...saved.p); player.yaw = saved.yaw || 0; player.hp = saved.hp ?? 20; } else player.pos.set(...spawnPoint());
const W2 = .3, PH = 1.8, EYE = 1.62; let FX = null; // features.js, installed once the UI + mobs exist
// collision: full cubes, plus the boxes of doors, beds, slabs and stairs (ladders and plants have none)
function collides(p, w = W2, h = PH) { for (let y = Math.floor(p.y - .5); y <= Math.floor(p.y + h - 1e-4); y++) for (let z = Math.floor(p.z - w); z <= Math.floor(p.z + w - 1e-4); z++) for (let x = Math.floor(p.x - w); x <= Math.floor(p.x + w - 1e-4); x++) {
  const id = world.get(x, y, z); if (!id) continue; const B = BLOCKS[id];
  if (B.kind === 'solid' || B.kind === 'cutout') { if (y >= Math.floor(p.y)) return true; continue; }
  if (B.kind !== 'model' || B.collide === false) continue;
  for (const b of (FX ? FX.boxesOf(id, x, y, z, true) : B.boxes)) if (p.x + w > x + b[0] / 16 && p.x - w < x + b[3] / 16 && p.y + h > y + b[1] / 16 && p.y < y + b[4] / 16 && p.z + w > z + b[2] / 16 && p.z - w < z + b[5] / 16) return true; }
  return false; }
function moveAxis(axis, d) { if (!d) return false; const steps = Math.ceil(Math.abs(d) / .3), s = d / steps;
  for (let i = 0; i < steps; i++) { player.pos[axis] += s; if (collides(player.pos)) {
      if (axis !== 'y' && player.ground) { const y0 = player.pos.y; player.pos.y += .6; // step up slabs, stairs and beds (Minecraft's 0.6 step height)
        if (!collides(player.pos)) { let lo = 0, hi = .6; for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; player.pos.y = y0 + m; if (collides(player.pos)) lo = m; else hi = m; } player.pos.y = y0 + hi; continue; }
        player.pos.y = y0; }
      player.pos[axis] -= s; // slide to contact
      for (let k = 0; k < 8; k++) { const h = s / 2 ** (k + 1); player.pos[axis] += h; if (collides(player.pos)) player.pos[axis] -= h; } return true; } } return false; }
const keys = {}, touch = { mx: 0, mz: 0, jump: false, sneak: false };
let sprinting = false, flying = false, touchSprint = false;
function physics(dt) {
  if (player.riding) { player.hurtT = Math.max(0, player.hurtT - dt); player.fallStart = null; return; } // in a boat: features.js steers
  const feet = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y + .3), Math.floor(player.pos.z)), head = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y + EYE), Math.floor(player.pos.z));
  const inLava = isLava(feet) || isLava(head) || isLava(world.get(Math.floor(player.pos.x), Math.floor(player.pos.y + 1), Math.floor(player.pos.z)));
  player.inWater = isWater(feet) || isLava(feet); const eyesWet = isWater(head); hud.setUnderwater(eyesWet); hud.setLava?.(isLava(head));
  if (inLava) { player.lavaT = (player.lavaT || 0) - dt; if (player.lavaT <= 0) { player.lavaT = .5; hurt(4); sfx.sizzle(); } } else player.lavaT = 0;
  const onLadder = BLOCKS[world.get(Math.floor(player.pos.x), Math.floor(player.pos.y + .1), Math.floor(player.pos.z))].climb || BLOCKS[feet].climb;
  let fx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.mx, fz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + touch.mz;
  const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
  if (fz >= 0 || len < .1) sprinting = false; if (keys.ControlLeft || keys.ControlRight) if (fz < 0) sprinting = true;
  if (touchSprint && len > .3 && !(keys.ShiftLeft || touch.sneak)) sprinting = true;
  if (player.food <= 6) sprinting = false; // Minecraft: too hungry to sprint
  const sneak = keys.ShiftLeft || touch.sneak, speed = (inLava ? 1.2 : player.inWater ? 2.2 : sneak ? 1.3 : sprinting ? 5.6 : 4.317);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw), wx = (fx * cos + fz * sin) * speed, wz = (-fx * sin + fz * cos) * speed;
  const acc = player.ground ? 18 : player.inWater ? 6 : 4; player.vel.x += (wx - player.vel.x) * Math.min(1, acc * dt); player.vel.z += (wz - player.vel.z) * Math.min(1, acc * dt);
  const jump = keys.Space || touch.jump;
  if (player.inWater) { player.vel.y += (-6 * dt); player.vel.y *= Math.pow(.2, dt); if (jump) player.vel.y = Math.min(player.vel.y + 22 * dt, 3.2); player.fallStart = null; }
  else { player.vel.y -= 32 * dt; if (player.vel.y < -60) player.vel.y = -60; if (jump && player.ground) { player.vel.y = 9; exhaust(sprinting ? .2 : .05); if (sprinting) { player.vel.x += -sin * 1.2; player.vel.z += -cos * 1.2; } } }
  if (onLadder) { player.fallStart = null; // climb by walking into the wall or holding jump, sneak to hold on
    if (sneak) player.vel.y = Math.max(0, player.vel.y); else if (player.pushing || jump) player.vel.y = 3.4; else player.vel.y = Math.max(player.vel.y, -3); }
  // sneaking keeps you from walking off edges
  const before = player.pos.clone(), wasGround = player.ground;
  const hitX = moveAxis('x', player.vel.x * dt); if (hitX) player.vel.x = 0;
  if (sneak && wasGround) { const t = player.pos.clone(); t.y -= .05; if (!collides(t)) { player.pos.x = before.x; player.vel.x = 0; } }
  const hitZ = moveAxis('z', player.vel.z * dt); if (hitZ) player.vel.z = 0; player.pushing = (hitX || hitZ) && len > .1;
  if (sneak && wasGround) { const t = player.pos.clone(); t.y -= .05; if (!collides(t)) { player.pos.z = before.z; player.vel.z = 0; } }
  const vy = player.vel.y; const hitY = moveAxis('y', vy * dt); player.ground = hitY && vy < 0; if (hitY) player.vel.y = 0;
  if (TOUCH && (hitX || hitZ) && player.ground && len > .3) { const t = player.pos.clone(); t.y += 1.1; t.x += Math.sign(wx) * .3 * (hitX ? 1 : 0); t.z += Math.sign(wz) * .3 * (hitZ ? 1 : 0); if (!collides(t)) player.vel.y = 9; } // auto-jump on touch
  // fall damage (Minecraft: 1 per block past 3)
  if (!player.ground && !player.inWater && player.vel.y < 0 && player.fallStart === null) player.fallStart = player.pos.y;
  if (player.vel.y > 0 || player.inWater) player.fallStart = null;
  if (player.ground && player.fallStart !== null) { const d = player.fallStart - player.pos.y; player.fallStart = null; if (d > 3.5) hurt(Math.floor(d - 3)); }
  // drowning
  if (eyesWet) { player.air -= dt; if (player.air < 0) { player.air = 1; hurt(2); } } else player.air = Math.min(15, player.air + dt * 5); hud.air(player.air, eyesWet || player.air < 15);
  if (player.pos.y < -20) hurt(4);
  player.hurtT = Math.max(0, player.hurtT - dt);
  // hunger (Minecraft rules): exhaustion -> saturation -> food. Food 18+ heals, 0 starves (down to half a heart on normal)
  const moved = Math.hypot(player.pos.x - before.x, player.pos.z - before.z); if (player.inWater && len > .1) exhaust(moved * .01); else if (sprinting) exhaust(moved * .1);
  while (player.exh >= 4) { player.exh -= 4; if (player.sat > 0) player.sat = Math.max(0, player.sat - 1); else { player.food = Math.max(0, player.food - 1); hud.food(player.food); } }
  player.regen = (player.regen || 0) + dt;
  if (player.food >= 20 && player.sat > 0 && player.hp < 20) { if (player.regen > .5) { player.regen = 0; player.hp = Math.min(20, player.hp + 1); exhaust(6); hud.hearts(player.hp); } }
  else if (player.food >= 18 && player.hp < 20) { if (player.regen > 4) { player.regen = 0; player.hp = Math.min(20, player.hp + 1); exhaust(6); hud.hearts(player.hp); } }
  else if (player.food <= 0) { if (player.regen > 4) { player.regen = 0; if (player.hp > 1) hurt(Math.min(1, player.hp - 1)); } }
  else player.regen = Math.min(player.regen, 4);
}
// Timmy's armorReduce (Java formula, keeps the fraction) + ui.damageArmor wear; onArmor updates the bar / toasts breaks
function armorHit(n) { const after = armorReduce(n, ui.armorPoints(), ui.armorToughness()); ui.damageArmor(n); return after; } // health is a float like Minecraft; the hearts round up to half-hearts
function exhaust(e) { player.exh = Math.min(40, (player.exh || 0) + e); }
function hurt(n) { if (player.hp <= 0) return; exhaust(.1); player.hp = Math.max(0, player.hp - n); player.hurtT = .4; hud.hearts(player.hp); hud.flash(); if (player.hp <= 0) { hud.dead(); ui.close(); eating = null; bowT = null; } }
function respawn() { dropAll(); player.pos.set(...(player.spawn && bedOK(player.spawn) ? [player.spawn[0] + .5, player.spawn[1] + .6, player.spawn[2] + .5] : spawnPoint())); if (player.spawn && !bedOK(player.spawn)) { hud.toast('Your bed was missing or obstructed'); player.spawn = null; } for (let i = 0; i < 30; i++) streamChunks(1e9); settleSpawn(); player.vel.set(0, 0, 0); player.hp = 20; player.food = 20; player.sat = 5; player.exh = 0; player.fallStart = null; hud.hearts(20); hud.food(20); }

// ---------- targeting ----------
// reach cap for hitting/using mobs: distance to the exact point the crosshair hits a block; walk-through blocks (plants, crops, torches, fire, open gates) never cap it
function mobReach(hit, max) { if (!hit) return max; const B = BLOCKS[hit.id]; if (!B || (B.gate && B.collide === false) || B.kind === 'plant' || B.kind === 'crop' || B.kind === 'torch' || B.fire) return max;
  return Math.min(max, hit.p ? camera.position.distanceTo(hit.p) : camera.position.distanceTo(new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5)) - .5); }
function raycast(maxD = 5, fluids = false) {
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z); const E = 1e-9;
  // axis-safe DDA: a direction component of 0 (or -0) never steps on that axis, and boundaries never produce NaN
  const sx = d.x > E ? 1 : d.x < -E ? -1 : 0, sy = d.y > E ? 1 : d.y < -E ? -1 : 0, sz = d.z > E ? 1 : d.z < -E ? -1 : 0;
  const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tx = sx ? (sx > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity, ty = sy ? (sy > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity, tz = sz ? (sz > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity, n = [0, 0, 0], t = 0;
  while (t <= maxD) { const id = world.get(x, y, z);
    if (id && (fluids ? id === ID.water || id === ID.lava || !isFluid(id) : !isFluid(id))) { const K = BLOCKS[id].kind;
      if (K !== 'model' && K !== 'plant' && K !== 'crop' && K !== 'torch') return { x, y, z, id, n, p: o.clone().addScaledVector(d, t) };
      const bx = K === 'model' ? (FX ? FX.boxesOf(id, x, y, z, false) : BLOCKS[id].boxes).map(b => b.map(v => v / 16)) : [shapeOf(id)]; let best = null; // precise hit on the block's boxes
      for (const b of bx) { let t0 = 0, t1 = 1e9, nn = null; for (let a = 0; a < 3; a++) { const oa = o.getComponent(a) - [x, y, z][a], da = d.getComponent(a);
          if (Math.abs(da) < 1e-9) { if (oa < b[a] || oa > b[a + 3]) { t0 = 1e9; break; } continue; }
          let ta = (b[a] - oa) / da, tb = (b[a + 3] - oa) / da, sgn = -1; if (ta > tb) { [ta, tb] = [tb, ta]; sgn = 1; } if (ta > t0) { t0 = ta; nn = [0, 0, 0]; nn[a] = sgn; } t1 = Math.min(t1, tb); }
        if (t0 <= t1 && t0 < 1e9 && t0 <= maxD && (!best || t0 < best.t)) best = { t: t0, n: nn || n }; }
      if (best) return { x, y, z, id, n: best.n, p: o.clone().addScaledVector(d, best.t) }; }
    if (tx <= ty && tx <= tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; } else if (ty <= tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; } else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; } }
  return null;
}
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .55 })); scene.add(outline);
const crackMats = []; for (let s = 0; s < 10; s++) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); let r = 7 + s * 13;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647; g.fillStyle = 'rgba(0,0,0,.7)';
  for (let k = 0; k < (s + 1) * 4; k++) { let x = 8, y = 8; const ang = rnd() * 6.28; for (let j = 0; j < 2 + s * .7; j++) { x += Math.cos(ang + rnd() - .5) * 1.5; y += Math.sin(ang + rnd() - .5) * 1.5; g.fillRect(x | 0, y | 0, 1, 1); } }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; crackMats.push(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); }
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMats[0]); crack.visible = false; scene.add(crack);
let mining = null, mouseL = false, mouseR = false, placeCd = 0, swungThisPress = false, mobHitCd = 0; const furnaces = saved?.furnaces || {};
const heldTool = () => ui.selectedItem()?.info?.tool || null;
function canHarvest(id) { const B = BLOCKS[id], need = ITEMS[B.name]?.needs ?? (B.needs ? B.needs - 1 : undefined), t = heldTool();
  return need === undefined || (t && t.type === 'pickaxe' && t.level >= need); }
function breakTime(id) { const B = BLOCKS[id]; if (B.hardness === Infinity) return Infinity; const t = heldTool();
  const right = t && B.tool && t.type === B.tool, speed = right ? t.speed : (t?.type === 'sword' && B.leaves ? 1.5 : 1);
  return Math.max(.05, B.hardness * (canHarvest(id) ? 1.5 : 5) / speed); }
// ---------- drops, block updates, gravity, fluids (Mike, round 3) ----------
const SOIL = new Set([ID.grass, ID.dirt, ID.snowy_grass, ID.farmland]);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const replaceable = id => !id || BLOCKS[id].kind === 'plant' && !BLOCKS[id].sapling || (isFluid(id) && !!BLOCKS[id].level);
const roll = (a, b) => a + (Math.random() * (b - a + 1) | 0);
function harvest(id, any = false) { // -> [[item, count], ...]; any = ignore the held tool (explosions)
  const B = BLOCKS[id]; if ((!any && !canHarvest(id)) || isFluid(id) || B.fire) return [];
  if (B.kind === 'crop') { const ripe = B.stage === B.max;
    if (B.crop === 'wheat') return ripe ? [['wheat', 1], ['wheat_seeds', roll(0, 3)]] : [['wheat_seeds', 1]];
    if (B.crop === 'carrots') return [['carrot', ripe ? roll(2, 5) : 1]]; }
  if (B.leaves) { if (heldTool()?.type === 'shears') return [[B.name, 1]];
    const out = []; if (Math.random() < .05) out.push([B.name.replace('_leaves', '_sapling'), 1]);
    if (id === ID.oak_leaves && Math.random() < .005) out.push(['apple', 1]); if (Math.random() < .02) out.push(['stick', roll(1, 2)]); return out; }
  if (id === ID.short_grass) return Math.random() < .125 ? [['wheat_seeds', 1]] : [];
  if (id === ID.gravel && Math.random() < .1) return [['flint', 1]];
  const it = ITEMS[B.name], d = it && 'drops' in it ? it.drops : B.drop === undefined ? B.name : B.drop; return d ? [[d, 1]] : []; }
function breakAt(x, y, z, drop = true) { const id = world.get(x, y, z); if (!id) return; setBlock(x, y, z, 0);
  if (drop) for (const [it, n] of harvest(id)) if (n > 0) spawnDrop(it, n, x + .5, y + .4, z + .5); if (!isFluid(id)) particles({ x, y, z }, id); }
function setBlock(x, y, z, id) { const old = world.get(x, y, z); if (!world.set(x, y, z, id)) return false; if (id === ID.fire) FX?.trackFire(x, y, z);
  if (old === ID.chest && id !== ID.chest) { const k = x + ',' + y + ',' + z; if (openChestKeys.includes(k)) ui.close(); const c = chests[k]; if (c) { for (const s of c.slots) if (s) spawnDrop(s.id, s.count, x + .5, y + .5, z + .5, null, .5, s.damage); delete chests[k]; } }
  if (old === ID.furnace && id !== ID.furnace) { const k = x + ',' + y + ',' + z, f = furnaces[k]; if (f && f.xp >= 1) FX?.spawnXp(Math.floor(f.xp), x + .5, y + .5, z + .5); if (f) { for (const s of f.slots) if (s) spawnDrop(s.id, s.count, x + .5, y + .5, z + .5, null, .5, s.damage); delete furnaces[k]; } }
  blockUpdate(x, y, z); for (const d of N6) blockUpdate(x + d[0], y + d[1], z + d[2]); return true; }
let updDepth = 0;
function blockUpdate(x, y, z) { const id = world.get(x, y, z); if (!id) return; const B = BLOCKS[id]; if (updDepth > 64) return; updDepth++;
  try {
    if (isFluid(id)) { scheduleWater(x, y, z); return; }
    if ((id === ID.sand || id === ID.gravel) && y > 0) { const b = world.get(x, y - 1, z); if (!isBlocking(b) && world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) startFall(x, y, z, id); return; }
    if (B.fire) { if (!FX?.fireOk(x, y, z)) setBlock(x, y, z, 0); return; }
    if (B.kind === 'plant' || B.kind === 'crop') { const b = world.get(x, y - 1, z); if (B.kind === 'crop' ? b !== ID.farmland : !SOIL.has(b)) breakAt(x, y, z); return; }
    if (id === ID.torch) { if (!isSolid(world.get(x, y - 1, z)) && !N6.some(d => d[1] === 0 && isSolid(world.get(x + d[0], y, z + d[2])))) breakAt(x, y, z); return; }
    if (B.climb) { const d = DIRS[B.f]; if (!isSolid(world.get(x + d[0], y, z + d[2]))) breakAt(x, y, z); return; }
    if (B.door) { const o = BLOCKS[world.get(x, y + (B.door === 'lower' ? 1 : -1), z)]; if (!o.door || o.door === B.door) breakAt(x, y, z); else if (B.door === 'lower' && !isSolid(world.get(x, y - 1, z))) breakAt(x, y, z); return; }
    if (B.bed) { const d = DIRS[B.f], k = B.bed === 'foot' ? 1 : -1, o = BLOCKS[world.get(x + d[0] * k, y, z + d[2] * k)]; if (!o.bed || o.bed === B.bed) breakAt(x, y, z); return; }
  } finally { updDepth--; } }
// falling sand + gravel
const falling = [];
function blockMesh(id) { const b = { pos: [], uv: [], col: [], idx: [] }; addModel(b, BLOCKS[id], 0, 0, 0, atlas.uv, 1, 0, null, [[0, 0, 0, 16, 16, 16]]); return new THREE.Mesh(toGeo(b), mSolid); }
function startFall(x, y, z, id) { world.set(x, y, z, 0); const mesh = blockMesh(id); mesh.position.set(x, y, z); scene.add(mesh);
  falling.push({ id, x, z, y, vy: 0, mesh, t: 0 }); for (const d of N6) blockUpdate(x + d[0], y + d[1], z + d[2]); }
function updateFalling(dt) { for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.t += dt; f.vy = Math.max(-40, f.vy - 32 * dt); f.y += f.vy * dt;
    const cy = Math.floor(f.y), below = world.get(f.x, cy, f.z);
    if ((isBlocking(below) || cy < 0 || f.t > 20) && f.vy < 0) { const ly = cy + 1, cur = world.get(f.x, ly, f.z);
      if (replaceable(cur) || isFluid(cur)) { if (cur && !isFluid(cur)) breakAt(f.x, ly, f.z); setBlock(f.x, ly, f.z, f.id); } else spawnDrop(f.id, 1, f.x + .5, ly + .5, f.z + .5);
      scene.remove(f.mesh); f.mesh.geometry.dispose(); falling.splice(i, 1); sfx.place(f.id); continue; }
    f.mesh.position.set(f.x, f.y, f.z); } }
// fluids: Minecraft-style levels. Water spreads 7 blocks every 5 ticks, lava 3 blocks every 30 ticks; both fall straight
// down, two water sources make a new one, and water meeting lava makes obsidian (source) or cobblestone (flowing).
const FL = { water: { src: ID.water, max: 7, is: isWater, lv: l => l ? ID['water_' + l] : ID.water }, lava: { src: ID.lava, max: 3, is: isLava, lv: l => l ? ID['lava_' + l] : ID.lava } };
const wq = new Map(), lq = new Map(), fluidOf = id => isWater(id) ? FL.water : isLava(id) ? FL.lava : null;
const wLevel = (id, F) => id === F.src ? 0 : F.is(id) ? BLOCKS[id].level : -1;
function scheduleWater(x, y, z) { (isLava(world.get(x, y, z)) ? lq : wq).set(x + ',' + y + ',' + z, [x, y, z]); }
function setFluid(x, y, z, id) { world.set(x, y, z, id); if (id) scheduleWater(x, y, z); for (const d of N6) { const n = world.get(x + d[0], y + d[1], z + d[2]); if (isFluid(n)) scheduleWater(x + d[0], y + d[1], z + d[2]); else if (n) blockUpdate(x + d[0], y + d[1], z + d[2]); } }
function flowTick(max = 500, q = wq) { const list = [...q.values()]; q.clear(); let n = 0; for (const [x, y, z] of list) { if (++n > max) q.set(x + ',' + y + ',' + z, [x, y, z]); else flowAt(x, y, z); } return list.length; }
function flowAt(x, y, z) { if (!world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return; const F = fluidOf(world.get(x, y, z)); if (!F) return; let L = wLevel(world.get(x, y, z), F);
  const H = [[1, 0], [-1, 0], [0, 1], [0, -1]], other = F === FL.water ? FL.lava : FL.water;
  if (F === FL.lava) for (const d of N6) if (d[1] >= 0 && isWater(world.get(x + d[0], y + d[1], z + d[2]))) { setBlock(x, y, z, L === 0 ? ID.obsidian : ID.cobblestone); sfx.sizzle(); return; }
  if (L > 0) { const above = F.is(world.get(x, y + 1, z)); let best = 99, src = 0;
    for (const [dx, dz] of H) { const nl = wLevel(world.get(x + dx, y, z + dz), F); if (nl >= 0) best = Math.min(best, nl); if (nl === 0) src++; }
    const b = world.get(x, y - 1, z);
    if (F === FL.water && src >= 2 && (isSolid(b) || b === ID.water)) { setFluid(x, y, z, ID.water); return; }
    const want = above ? 1 : best + 1; if (want > F.max) { setFluid(x, y, z, 0); return; } if (want !== L) { setFluid(x, y, z, F.lv(want)); L = want; } }
  const below = world.get(x, y - 1, z);
  if (y > 0 && other.is(below)) { setBlock(x, y - 1, z, F === FL.lava ? ID.stone : (below === ID.lava ? ID.obsidian : ID.cobblestone)); sfx.sizzle(); return; }
  if (y > 0 && replaceable(below) && !isFluid(below)) { if (below) breakAt(x, y - 1, z); setFluid(x, y - 1, z, F.lv(1)); return; }
  if (F.is(below) || L >= F.max) return;
  for (const [dx, dz] of H) { const n = world.get(x + dx, y, z + dz);
    if (other.is(n)) { setBlock(x + dx, y, z + dz, F === FL.water && n === ID.lava ? ID.obsidian : ID.cobblestone); sfx.sizzle(); }
    else if (replaceable(n) && !isFluid(n)) { if (n) breakAt(x + dx, y, z + dz); setFluid(x + dx, y, z + dz, F.lv(L + 1)); }
    else if (wLevel(n, F) > L + 1) setFluid(x + dx, y, z + dz, F.lv(L + 1)); } }
// item entities: everything you break, throw (Q) or kill lands on the ground and gets picked up when you walk over it
const drops = [], dropTex = new Map();
function spawnDrop(id, count, x, y, z, vel, delay = .4, damage = 0) { if (!id || count <= 0) return;
  if (!dropTex.has(id)) { const t = new THREE.CanvasTexture(ui.iconCanvas(id)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; dropTex.set(id, t); }
  const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex.get(id), alphaTest: .2, fog: true })); const blk = ITEMS[id]?.block && !ITEMS[id]?.flat; mesh.scale.setScalar(blk ? .34 : .3); scene.add(mesh);
  drops.push({ id, count, damage, p: new THREE.Vector3(x, y, z), v: vel || new THREE.Vector3((Math.random() - .5) * 2, 3, (Math.random() - .5) * 2), age: 0, delay, mesh, ph: Math.random() * 6, lt: 0 });
  while (drops.length > 300) killDrop(0); }
function killDrop(i) { const d = drops[i]; scene.remove(d.mesh); d.mesh.material.dispose(); drops.splice(i, 1); }
function updateDrops(dt) { const pc = new THREE.Vector3(player.pos.x, player.pos.y + .7, player.pos.z);
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.age += dt; if (d.age > 300) { killDrop(i); continue; }
    const dist = d.p.distanceTo(pc);
    if (player.hp > 0 && d.age > d.delay && dist < 1.8) { d.p.lerp(pc, Math.min(1, dt * 10)); if (dist < .7) { const left = ui.give(d.id, d.count, d.damage); if (left < d.count) sfx.pop(); d.count = left; if (!left) { killDrop(i); continue; } } }
    else { const inW = isWater(world.get(Math.floor(d.p.x), Math.floor(d.p.y), Math.floor(d.p.z)));
      d.v.y = inW ? Math.min(d.v.y + 6 * dt, 1) : d.v.y - 20 * dt; const n = d.p.clone().addScaledVector(d.v, dt);
      if (isBlocking(world.get(Math.floor(n.x), Math.floor(n.y - .12), Math.floor(n.z)))) { n.y = Math.floor(n.y - .12) + 1.12; d.v.y = 0; d.v.x *= .5; d.v.z *= .5; }
      if (isBlocking(world.get(Math.floor(n.x), Math.floor(n.y), Math.floor(n.z)))) { n.x = d.p.x; n.z = d.p.z; d.v.x = d.v.z = 0; if (isBlocking(world.get(Math.floor(n.x), Math.floor(n.y), Math.floor(n.z)))) n.y += 2 * dt; }
      d.p.copy(n); }
    d.mesh.position.set(d.p.x, d.p.y + .12 + Math.sin(d.age * 2.5 + d.ph) * .06, d.p.z);
    if ((d.lt -= dt) <= 0) { d.lt = .5; const l = mobWorld.getLight(Math.floor(d.p.x), Math.floor(d.p.y), Math.floor(d.p.z)) / 15; d.mesh.material.color.setScalar(.25 + .75 * l); } } }
function throwStack(s) { if (!s) return; const d = new THREE.Vector3(); camera.getWorldDirection(d); spawnDrop(s.id, s.count, camera.position.x + d.x * .4, camera.position.y - .3 + d.y * .4, camera.position.z + d.z * .4, d.multiplyScalar(5).add(new THREE.Vector3(0, 1.5, 0)), 1.5, s.damage); }
function dropAll() { FX?.deathXp(); for (const k in player.armor) { const a = player.armor[k]; if (a) spawnDrop(a.id, 1, player.pos.x, player.pos.y + 1, player.pos.z, new THREE.Vector3((Math.random() - .5) * 4, 4, (Math.random() - .5) * 4), 2, a.damage); player.armor[k] = null; } hud.armor(0); const s = ui.inventory.slots; for (let i = 0; i < s.length; i++) if (s[i]) { spawnDrop(s[i].id, s[i].count, player.pos.x, player.pos.y + 1, player.pos.z, new THREE.Vector3((Math.random() - .5) * 5, 4, (Math.random() - .5) * 5), 2, s[i].damage); s[i] = null; } ui.refresh(); }
// player arrows
const arrows = [], arrowGeo = new THREE.BoxGeometry(.05, .05, .5), arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a6a42 });
function fireArrow(power) { const d = new THREE.Vector3(); camera.getWorldDirection(d); const mesh = new THREE.Mesh(arrowGeo, arrowMat); scene.add(mesh);
  const a = { p: camera.position.clone().addScaledVector(d, .3), v: d.multiplyScalar(power * 60), mesh, stuck: false, t: 0, dmg: Math.ceil(power * 6) + (power >= 1 ? roll(0, 3) : 0) }; arrows.push(a); sfx.bow(power); return a; }
function updateArrows(dt) { for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += dt;
    if (a.stuck) { if (a.p.distanceTo(player.pos.clone().setY(player.pos.y + .9)) < 1.4 && player.hp > 0 && a.t > .3 && !ui.give('arrow', 1)) { sfx.pop(); a.t = 1e9; } if (a.t > 60) { scene.remove(a.mesh); arrows.splice(i, 1); } continue; }
    a.v.y -= 20 * dt; const n = Math.max(1, Math.ceil(a.v.length() * dt / .2)), s = dt / n; let done = false;
    for (let k = 0; k < n && !done; k++) { a.p.addScaledVector(a.v, s);
      if (isBlocking(world.get(Math.floor(a.p.x), Math.floor(a.p.y), Math.floor(a.p.z)))) { a.stuck = true; a.t = 0; done = true; sfx.brk(ID.oak_planks); break; }
      for (const m of mobs.mobs || []) { if (m.dead) continue; const hw = m.w / 2 + .05; if (Math.abs(a.p.x - m.pos.x) < hw && Math.abs(a.p.z - m.pos.z) < hw && a.p.y > m.pos.y && a.p.y < m.pos.y + m.h) FX?.markHit(m);
        if (Math.abs(a.p.x - m.pos.x) < hw && Math.abs(a.p.z - m.pos.z) < hw && a.p.y > m.pos.y && a.p.y < m.pos.y + m.h) { m.hurt(a.dmg, a.p.clone().addScaledVector(a.v, -.05), { cause: 'arrow', knockback: 3.5 }); scene.remove(a.mesh); arrows.splice(i, 1); done = true; a.hit = m; break; } } }
    if (a.t > 10 && !a.stuck) { scene.remove(a.mesh); arrows.splice(i, 1); continue; }
    a.mesh.position.copy(a.p); if (!a.stuck) a.mesh.lookAt(a.p.clone().add(a.v)); } }
// food: hunger points come from Timmy's ITEMS[id].food, saturation follows the Minecraft wiki
const SAT = { apple: 2.4, bread: 6, porkchop: 1.8, cooked_porkchop: 12.8, beef: 1.8, cooked_beef: 12.8, chicken: 1.2, cooked_chicken: 7.2, mutton: 1.2, cooked_mutton: 9.6, rotten_flesh: .8, carrot: 3.6 };
function eatDone(id) { const f = ITEMS[id]?.food || 0; player.food = Math.min(20, player.food + f); player.sat = Math.min(player.food, player.sat + (SAT[id] ?? f * .6)); hud.food(player.food); sfx.burp();
  if ((id === 'rotten_flesh' && Math.random() < .8) || (id === 'chicken' && Math.random() < .3)) { player.hungerFx = 30; hud.toast('Food poisoning! You get hungry faster'); } }
const facing = () => { const dx = -Math.sin(player.yaw), dz = -Math.cos(player.yaw); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0); };
const isNight = () => time > .52 && time < .97;
function bedOK(s) { if (!world.getChunk(Math.floor(s[0] / CS), Math.floor(s[2] / CS))) world.genChunk(Math.floor(s[0] / CS), Math.floor(s[2] / CS)); return !!BLOCKS[world.get(s[0], s[1], s[2])].bed; }
let sleeping = null;
function useBed(x, y, z, B) { if (B.bed === 'head') { const d = DIRS[B.f]; x -= d[0]; z -= d[2]; }
  player.spawn = [x, y, z]; if (!isNight()) { hud.toast('Respawn point set. You can only sleep at night'); return; }
  const near = (mobs.mobs || []).some(m => m.hostile && !m.dead && m.pos.distanceTo(player.pos) < 8);
  if (near) { hud.toast('You may not rest now; there are monsters nearby'); return; }
  sleeping = { t: 0, x, y, z }; player.vel.set(0, 0, 0); hud.sleep(true); hud.toast('Respawn point set'); }
function updateSleep(dt) { if (!sleeping) return false; sleeping.t += dt; if (sleeping.t > 2.5) { time = .005; sleeping = null; hud.sleep(false); save(true); } return true; }
let eating = null, bowT = null;
function interact(dt) {
  const hit = uiOpen() ? null : raycast();
  outline.visible = !!hit; if (hit) { const bb = shapeOf(hit.id, hit.x, hit.y, hit.z); outline.scale.set(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]); outline.position.set(hit.x + (bb[0] + bb[3]) / 2, hit.y + (bb[1] + bb[4]) / 2, hit.z + (bb[2] + bb[5]) / 2); }
  const sel = ui.selectedItem(), h = sel?.id, info = sel?.info;
  if (player.hungerFx > 0) { player.hungerFx -= dt; exhaust(.1 * dt); } // Hunger I: 0.005 exhaustion/tick
  // eating: hold right click for 1.6 s like Minecraft
  if (eating) { if (!mouseR || h !== eating.id) eating = null; else { eating.t += dt; if ((eating.s = (eating.s || 0) + dt) > .21) { eating.s = 0; sfx.eat(); crumbs(h); }
      if (eating.t >= 1.6) { ui.removeSelected(1); eatDone(h); eating = null; placeCd = .3; } return; } }
  // bow: hold right click to draw, release to shoot (needs arrows)
  if (h === 'bow') { if (mouseR && ui.count('arrow') > 0) { bowT = (bowT ?? 0) + dt; mouseL = false; }
    else if (bowT !== null) { const f = Math.min(1, (bowT * bowT + 2 * bowT) / 3); if (f >= .1) { fireArrow(f); ui.take('arrow', 1); ui.damageSelected(1); } bowT = null; } }
  else bowT = null;
  if (mouseL && !swungThisPress && FX.leftClick(hit)) { swungThisPress = true; armSwing = .3; mobHitCd = .3; } // punch a boat
  if (mouseL && !swungThisPress) { swungThisPress = true; armSwing = .3; const d = new THREE.Vector3(); camera.getWorldDirection(d);
    const ray = new THREE.Ray(camera.position.clone(), d), bd = mobReach(hit, 4);
    const t = heldTool(), m = mobs.attack(ray, t ? t.damage : 1, { reach: Math.min(4, bd) }); if (m) { FX.markHit(m); exhaust(.1); if (t) ui.damageSelected(1); mining = null; mobHitCd = .5; } }
  if (!mouseL) swungThisPress = false; mobHitCd -= dt;
  if (mouseL && hit && mobHitCd <= 0) {
    if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) mining = { x: hit.x, y: hit.y, z: hit.z, t: 0, need: breakTime(hit.id) };
    mining.t += dt; armSwing = Math.max(armSwing, .3); sfx.tick(dt, hit.id);
    if (mining.t >= mining.need) { sfx.brk(hit.id); exhaust(.005); const tool = heldTool(), xpOk = canHarvest(hit.id); breakAt(hit.x, hit.y, hit.z, true); if (xpOk) FX.blockXp(hit.id, hit.x, hit.y, hit.z);
      if (tool && BLOCKS[hit.id].hardness > 0) ui.damageSelected(1); mining = null; save(); }
  } else mining = null;
  crack.visible = !!mining && isFinite(mining.need); if (crack.visible) { crack.position.set(mining.x + .5, mining.y + .5, mining.z + .5); crack.material = crackMats[Math.min(9, (mining.t / mining.need * 10) | 0)]; }
  placeCd -= dt;
  if (!mouseR || placeCd > 0 || bowT !== null) return;
  const sneak = keys.ShiftLeft || touch.sneak;
  { const d = new THREE.Vector3(); camera.getWorldDirection(d); // mobs against the sky too (MOBS.md optional 1); grass/flowers/crops/torches/fire don't cut reach (MOBS.md round 4)
    const fed = mobs.interact?.(new THREE.Ray(camera.position.clone(), d), h, { reach: mobReach(hit, 5) }); if (fed) { placeCd = .22; if (fed.consumed) ui.removeSelected(1); armSwing = .3; return; } }
  if (FX.rightClick(hit, h, sneak)) { placeCd = .25; armSwing = .3; save(); return; } // boats, flint and steel, gates, trapdoors
  // buckets look at water too
  if (h === 'bucket') { const w = raycast(5, true); placeCd = .25; if (w && (w.id === ID.water || w.id === ID.lava)) { const full = w.id === ID.lava ? 'lava_bucket' : 'water_bucket'; setFluid(w.x, w.y, w.z, 0); ui.removeSelected(1); if (ui.give(full, 1)) spawnDrop(full, 1, player.pos.x, player.pos.y + 1, player.pos.z); sfx.splash(); armSwing = .3; save(); } return; }
  if (hit && !sneak) { const B = BLOCKS[hit.id];
    if (hit.id === ID.crafting_table) { mouseR = false; mouseL = false; ui.openCraftingTable(); return; }
    if (hit.id === ID.furnace) { mouseR = false; mouseL = false; const k = hit.x + ',' + hit.y + ',' + hit.z; ui.openFurnace(furnaces[k] ||= createFurnace()); return; }
    if (hit.id === ID.chest) { mouseR = false; mouseL = false; const k = hit.x + ',' + hit.y + ',' + hit.z; openChestAt(hit.x, hit.y, hit.z); sfx.door(1); return; }
    if (B.door) { placeCd = .3; const oy = B.door === 'lower' ? 1 : -1, O = BLOCKS[world.get(hit.x, hit.y + oy, hit.z)], nb = 1 - B.open;
      world.set(hit.x, hit.y, hit.z, ID[`oak_door_${B.door}_${B.f}_${nb}`]); if (O.door) world.set(hit.x, hit.y + oy, hit.z, ID[`oak_door_${O.door}_${O.f}_${nb}`]); sfx.door(nb); armSwing = .3; save(); return; }
    if (B.bed) { placeCd = .5; mouseR = false; useBed(hit.x, hit.y, hit.z, B); return; } }
  if (info?.armor) { placeCd = .3; if (ui.equipSelected()) { hud.toast('Wearing ' + info.name); sfx.place(ID.iron_block); armSwing = .3; } return; }
  if (info?.food && player.food < 20 && !(h === 'carrot' && hit?.id === ID.farmland && hit.n[1] === 1)) { eating = { id: h, t: 0 }; return; }
  if (!hit) return; placeCd = .22;
  const above = world.get(hit.x, hit.y + 1, hit.z), topFace = hit.n[1] === 1;
  if (info?.tool?.type === 'hoe' && hit.n[1] !== -1 && (hit.id === ID.grass || hit.id === ID.dirt) && replaceable(above)) { if (above) breakAt(hit.x, hit.y + 1, hit.z); setBlock(hit.x, hit.y, hit.z, ID.farmland); ui.damageSelected(1); armSwing = .3; sfx.place(ID.dirt); save(); return; }
  if ((h === 'wheat_seeds' || h === 'carrot') && hit.id === ID.farmland && topFace && !above) { setBlock(hit.x, hit.y + 1, hit.z, h === 'carrot' ? ID.carrots_0 : ID.wheat_0); ui.removeSelected(1); armSwing = .3; sfx.place(ID.oak_leaves); save(); return; }
  if (h === 'water_bucket' || h === 'lava_bucket') { const fid = h === 'lava_bucket' ? ID.lava : ID.water; const tgt = replaceable(hit.id) ? [hit.x, hit.y, hit.z] : [hit.x + hit.n[0], hit.y + hit.n[1], hit.z + hit.n[2]], cur = world.get(...tgt);
    if (replaceable(cur) || cur === fid) { if (cur && !isFluid(cur)) breakAt(...tgt); setFluid(...tgt, fid); ui.removeSelected(1); ui.give('bucket', 1); sfx.splash(); armSwing = .3; save(); } return; }
  const blockId = placeId(h, hit); if (blockId === undefined) return;
  const B = BLOCKS[blockId];
  // slab on matching slab = full block
  const HB = BLOCKS[hit.id];
  if (HB.slab && B.slab && HB.full === B.full && ((HB.slab === 'bottom' && hit.n[1] === 1) || (HB.slab === 'top' && hit.n[1] === -1))) { setBlock(hit.x, hit.y, hit.z, ID[HB.full]); ui.removeSelected(1); armSwing = .3; sfx.place(blockId); save(); return; }
  const into = replaceable(hit.id) && !isWater(hit.id) && hit.id !== blockId, px = into ? hit.x : hit.x + hit.n[0], py = into ? hit.y : hit.y + hit.n[1], pz = into ? hit.z : hit.z + hit.n[2], cur = world.get(px, py, pz);
  if (!replaceable(cur) && cur !== ID.water) return;
  if (h === 'torch' && hit.n[1] === -1) return;
  if (B.kind === 'plant' && !SOIL.has(world.get(px, py - 1, pz))) return;
  if (B.climb) { if (hit.n[1] !== 0 || !isSolid(hit.id)) return; }
  if (blockId === ID.chest && !chestCanPlace(px, py, pz)) return; // Minecraft: no chest next to a double chest or next to two chests
  let extra = null; // second cell for doors and beds
  if (B.door) { extra = [px, py + 1, pz, ID[`oak_door_upper_${B.f}_0`]]; if (!isSolid(world.get(px, py - 1, pz))) return; }
  if (B.bed) { const d = DIRS[B.f]; extra = [px + d[0], py, pz + d[2], ID[`bed_head_${B.f}`]]; if (!isBlocking(world.get(px, py - 1, pz)) || !isBlocking(world.get(extra[0], py - 1, extra[2]))) return; }
  if (extra && !replaceable(world.get(extra[0], extra[1], extra[2]))) return;
  if (cur && !isWater(cur)) breakAt(px, py, pz, false);
  world.set(px, py, pz, blockId); if (extra) world.set(extra[0], extra[1], extra[2], extra[3]);
  if (collides(player.pos)) { world.set(px, py, pz, cur); if (extra) world.set(extra[0], extra[1], extra[2], 0); return; }
  for (const c of [[px, py, pz], extra].filter(Boolean)) { blockUpdate(c[0], c[1], c[2]); for (const d of N6) blockUpdate(c[0] + d[0], c[1] + d[1], c[2] + d[2]); }
  if (!world.get(px, py, pz)) return; // popped off (no support)
  ui.removeSelected(1); armSwing = .3; sfx.place(blockId); save(); }
// which block an item places here (facing, slab half, ladder wall), or undefined
function placeId(h, hit) { const info = ITEMS[h]; if (!h || !info?.block) return undefined;
  if (h === 'ladder') { const f = DIRS.findIndex(d => d[0] === -hit.n[0] && d[2] === -hit.n[2]); return f < 0 || hit.n[1] ? undefined : ID['ladder_' + f]; }
  if (h === 'oak_door') return ID[`oak_door_lower_${facing()}_0`];
  if (h === 'white_bed') return ID['bed_foot_' + facing()];
  if (/_stairs$/.test(h)) return ID[`${h}_${facing()}`];
  if (/_fence_gate$/.test(h)) return ID[`${h}_${facing()}_0`];
  if (h === 'oak_trapdoor') { const fy = hit.p ? hit.p.y - Math.floor(hit.p.y) : 0, top = hit.n[1] === -1 || (hit.n[1] === 0 && fy > .5); // hinge on the clicked block (side) or away from you (top/bottom)
    const f = hit.n[1] === 0 ? DIRS.findIndex(d => d[0] === -hit.n[0] && d[2] === -hit.n[2]) : (facing() + 2) % 4; return ID[`oak_trapdoor_${f}_${top ? 'top' : 'bottom'}_0`]; }
  if (/_slab$/.test(h)) { const fy = hit.p ? hit.p.y - Math.floor(hit.p.y) : 0, top = hit.n[1] === -1 || (hit.n[1] === 0 && fy > .5); return ID[top ? h + '_top' : h]; }
  const id = ID[h]; if (id === undefined || BLOCKS[id].kind === 'crop' || (info.flat && h !== 'torch' && BLOCKS[id].kind !== 'plant')) return undefined; return id; }
function shapeOf(id, x, y, z) { const B = BLOCKS[id]; if (B.kind === 'plant' || B.kind === 'crop') return [.15, 0, .15, .85, B.kind === 'crop' ? .5 : .8, .85]; if (B.kind === 'torch') return [.4, 0, .4, .6, .65, .6];
  if (B.kind !== 'model') return [0, 0, 0, 1, 1, 1]; const r = [1, 1, 1, 0, 0, 0]; for (const b of (FX && x !== undefined ? FX.boxesOf(id, x, y, z, false) : B.boxes)) for (let i = 0; i < 3; i++) { r[i] = Math.min(r[i], b[i] / 16); r[i + 3] = Math.max(r[i + 3], b[i + 3] / 16); } return r; }
function crumbs(id) { const c = ui.iconCanvas(id), g = c.getContext('2d'), d = new THREE.Vector3(); camera.getWorldDirection(d); const at = camera.position.clone().addScaledVector(d, .5); at.y -= .15;
  for (let i = 0; i < 5; i++) { const x = Math.random() * c.width | 0, y = Math.random() * c.height | 0, px = g.getImageData(x, y, 1, 1).data; if (px[3] < 100) continue;
    parts.push({ p: at.clone(), v: new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 2, (Math.random() - .5) * 2), c: [px[0] / 255, px[1] / 255, px[2] / 255], t: .5 }); } }
// break particles
const partGeo = new THREE.BufferGeometry(), partMax = 300, pPos = new Float32Array(partMax * 3), pCol = new Float32Array(partMax * 3), parts = [];
partGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); partGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const partPts = new THREE.Points(partGeo, new THREE.PointsMaterial({ size: .09, vertexColors: true })); partPts.frustumCulled = false; scene.add(partPts);
function particles(hit, id) { const tile = atlas.tiles[(BLOCKS[id].tex.side || BLOCKS[id].tex)] || atlas.tiles.stone;
  for (let i = 0; i < 18; i++) { const o = ((Math.random() * 16 | 0) * 16 + (Math.random() * 16 | 0)) * 4; if (tile[o + 3] < 128) continue;
    parts.push({ p: new THREE.Vector3(hit.x + Math.random(), hit.y + Math.random(), hit.z + Math.random()), v: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3), c: [tile[o] / 255, tile[o + 1] / 255, tile[o + 2] / 255], t: .6 + Math.random() * .5 }); }
  while (parts.length > partMax) parts.shift(); }
function updateParticles(dt, light) { let n = 0; for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t -= dt; if (q.t <= 0) { parts.splice(i, 1); continue; } q.v.y -= 18 * dt; q.p.addScaledVector(q.v, dt); if (isSolid(world.get(Math.floor(q.p.x), Math.floor(q.p.y), Math.floor(q.p.z)))) { q.p.addScaledVector(q.v, -dt); q.v.set(0, 0, 0); } }
  for (const q of parts) { pPos.set([q.p.x, q.p.y, q.p.z], n * 3); pCol.set(q.c.map(c => c * light), n * 3); n++; }
  partGeo.setDrawRange(0, n); partGeo.attributes.position.needsUpdate = partGeo.attributes.color.needsUpdate = true; }

// ---------- sky ----------
const skyGeo = new THREE.SphereGeometry(500, 24, 12), skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h=clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0); }' });
const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -10; scene.add(sky);
function squareTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 32; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; return t; }
const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: squareTex(g => { g.fillStyle = '#fff7b0'; g.fillRect(4, 4, 24, 24); g.fillStyle = '#ffe866'; g.fillRect(8, 8, 16, 16); }), transparent: true, depthWrite: false, fog: false }));
const moon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: squareTex(g => { g.fillStyle = '#e4e6ee'; g.fillRect(6, 6, 20, 20); g.fillStyle = '#b9bccb'; g.fillRect(10, 10, 6, 6); g.fillRect(19, 17, 4, 4); g.fillRect(12, 20, 3, 3); }), transparent: true, depthWrite: false, fog: false }));
sun.renderOrder = moon.renderOrder = -9; scene.add(sun, moon);
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, () => { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); return [r * Math.cos(a) * 450, Math.abs(u) * 450, r * Math.sin(a) * 450]; }).flat(), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
stars.renderOrder = -9; scene.add(stars);
// blocky clouds: one big plane with a pixel texture that scrolls
const cloudTex = squareTex(() => {}); { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) { const x = rnd() * 128 | 0, y = rnd() * 128 | 0, w = 3 + rnd() * 9 | 0, h = 2 + rnd() * 6 | 0; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillRect((x + 64) % 128, y, w, h); }
  cloudTex.image = c; cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.needsUpdate = true; }
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1536, 1536), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
clouds.rotation.x = -Math.PI / 2; cloudTex.repeat.set(1, 1); scene.add(clouds);
const gfx = installGfx({ renderer, scene, U, mats: [mSolid, mCut, mWater, mLava], skyMat, skyMesh: sky, sun, moon, stars, clouds, camera, TOUCH }, { get fx() { return FX; } }); // Mike: FX (features.js) is created later, so read opts.fx lazily; opts.fx.weather = { rain, level, t, snowAt(x, z) } // Timmy: upgrades the sky above in place + Fast/Fancy setting
let time = saved?.time ?? .02; const DAY = 1200; // 20 minute day like Minecraft
const C = (h) => new THREE.Color(h);
const SKY = { dayTop: C('#78a7ff'), dayBot: C('#c3d8ff'), nightTop: C('#02030a'), nightBot: C('#0b1020'), setBot: C('#ff9a55'), setTop: C('#4a5c9a') };
function updateSky(dt) {
  time = (time + dt / DAY) % 1; const a = time * Math.PI * 2, sh = Math.sin(a); // 0 sunrise, .25 noon, .5 sunset
  const day = THREE.MathUtils.clamp(sh * 2.2 + .35, 0, 1), set = Math.max(0, 1 - Math.abs(sh) * 4) * (Math.cos(a) > -2 ? 1 : 0);
  U.uDay.value = .22 + day * .78; skin.material.forEach((m, i) => m.color.setHex(0xc69c77).multiplyScalar(SHADES[i] * (.35 + day * .65))); sleeve.material.forEach((m, i) => m.color.setHex(0x2f7f8f).multiplyScalar(SHADES[i] * (.35 + day * .65))); U.uSkyTint.value.setRGB(1, .9 + day * .1, .82 + day * .18).lerp(new THREE.Color(.6, .7, 1), 1 - day);
  const top = SKY.nightTop.clone().lerp(SKY.dayTop, day).lerp(SKY.setTop, set * .4), bot = SKY.nightBot.clone().lerp(SKY.dayBot, day).lerp(SKY.setBot, set * .55);
  skyMat.uniforms.top.value.copy(top); skyMat.uniforms.bot.value.copy(bot);
  const under = player.inWater && world.get(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)) === ID.water;
  U.uFog.value.copy(under ? new THREE.Color(.05, .15, .45).multiplyScalar(.3 + day * .7) : bot); U.uFogNear.value = under ? 2 : RD * CS * .55; U.uFogFar.value = under ? 18 : RD * CS * .95;
  const cp = camera.position; sky.position.copy(cp); stars.position.copy(cp); stars.material.opacity = Math.max(0, 1 - day * 1.6);
  sun.position.set(cp.x + Math.cos(a) * 400, cp.y + Math.sin(a) * 400, cp.z); sun.lookAt(cp); moon.position.set(cp.x - Math.cos(a) * 400, cp.y - Math.sin(a) * 400, cp.z); moon.lookAt(cp);
  clouds.position.set(cp.x, 140, cp.z); cloudTex.offset.set((cp.x / 1536 + performance.now() / 1e6 * 2) % 1, -(cp.z / 1536) % 1); clouds.material.color.setScalar(.25 + day * .75);
  gfx.update(time, day, under, cp); // Timmy: sky glow, sunset colours, horizon fog, 3D clouds
  return day;
}

// ---------- view bob / hand ----------
let armSwing = 0, bob = 0;
const SHADES = [.82, .82, 1, .55, .7, .7], armMat = c => SHADES.map(k => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), depthTest: false, depthWrite: false, transparent: true }));
const hand = new THREE.Group(), skin = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .1), armMat(0xc69c77)), sleeve = new THREE.Mesh(new THREE.BoxGeometry(.064, .064, .18), armMat(0x2f7f8f));
skin.position.z = -.12; sleeve.position.z = .02; skin.renderOrder = sleeve.renderOrder = 99; hand.add(skin, sleeve); hand.material = [...skin.material, ...sleeve.material]; camera.add(hand); scene.add(camera);
let heldMesh = null, heldName = null;
function updateHeld() { const h = ui.selectedItem()?.id || null; if (h === heldName) return; heldName = h; if (heldMesh) { camera.remove(heldMesh); heldMesh = null; } if (!h) return;
  const icon = ui.iconCanvas(h), t = new THREE.CanvasTexture(icon); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  heldMesh = new THREE.Mesh(new THREE.PlaneGeometry(.38, .38), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, alphaTest: .1 })); heldMesh.renderOrder = 100; camera.add(heldMesh); }

// ---------- input ----------
const canvas = renderer.domElement;
addEventListener('keydown', e => { keys[e.code] = true; if (e.repeat) return;
  if (e.code === 'KeyW' && performance.now() - (keys._lastW || 0) < 280) sprinting = true; if (e.code === 'KeyW') keys._lastW = performance.now();
  if (e.code === 'F2') { e.preventDefault(); shot(); }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
canvas.addEventListener('mousedown', e => { if (TOUCH || uiOpen()) return; if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; } if (e.button === 0) mouseL = true; if (e.button === 2) { mouseR = true; placeCd = 0; } });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas) return; player.yaw -= e.movementX * .0024; player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0024, -1.55, 1.55); });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) hud.pause(false); else { mouseL = mouseR = false; for (const k in keys) keys[k] = false; if (!uiOpen() && player.hp > 0) hud.pause(true); } });
function shot() { renderer.render(scene, camera); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = 'blockcraft.png'; a.click(); }

// ---------- inventory + UI: Timmy's ui.js owns the hotbar and every inventory screen ----------
for (const B of BLOCKS) if (B.id && !ITEMS[B.name] && B.kind !== 'water' && !B.noItem && B.kind !== 'crop') ITEMS[B.name] = { id: B.name, name: B.label, stack: 64, block: B.name, ...(B.kind === 'plant' ? { flat: true } : {}), ...(B.drop !== undefined && B.drop !== B.name ? { drops: B.drop } : {}) };
for (const k of ['oak', 'cobblestone', 'stone_brick']) ITEMS[k + '_stairs'] = { id: k + '_stairs', name: BLOCKS[ID[k + '_stairs_0']].label, stack: 64, block: k + '_stairs' };
ITEMS.bow ||= { id: 'bow', name: 'Bow', stack: 1, durability: 384 }; ITEMS.arrow ||= { id: 'arrow', name: 'Arrow', stack: 64 }; ITEMS.spider_eye ||= { id: 'spider_eye', name: 'Spider Eye', stack: 64, food: 2 };
// armor fallbacks (Timmy's ui-data defines these first; ||= keeps his). Worn via his 4 armor slots or right-click (ui.equipSelected)
const ARMOR = { leather: { mult: 5, def: [1, 3, 2, 1], mat: 'leather', name: 'Leather', tough: 0 }, golden: { mult: 7, def: [2, 5, 3, 1], mat: 'gold_ingot', name: 'Golden', tough: 0 },
  iron: { mult: 15, def: [2, 6, 5, 2], mat: 'iron_ingot', name: 'Iron', tough: 0 }, diamond: { mult: 33, def: [3, 8, 6, 3], mat: 'diamond', name: 'Diamond', tough: 2 } };
const PIECES = [['helmet', 'Helmet', 11, ['XXX', 'X X']], ['chestplate', 'Chestplate', 16, ['X X', 'XXX', 'XXX']], ['leggings', 'Leggings', 15, ['XXX', 'X X', 'X X']], ['boots', 'Boots', 13, ['X X', 'X X']]];
for (const [m, A] of Object.entries(ARMOR)) PIECES.forEach(([p, pn, base, pat], i) => { const id = `${m}_${p}`; ITEMS[id] ||= { id, name: (m === 'leather' ? { helmet: 'Leather Cap', chestplate: 'Leather Tunic', leggings: 'Leather Pants', boots: 'Leather Boots' }[p] : `${A.name} ${pn}`), stack: 1, durability: base * A.mult, armor: { slot: p, def: A.def[i], tough: A.tough } };
  if (!RECIPES.some(r => r.result.id === id)) RECIPES.push({ type: 'shaped', pattern: pat, key: { X: A.mat }, result: { id, count: 1 } }); });
if (ITEMS.oak_sapling) ITEMS.oak_sapling.fuel = ITEMS.birch_sapling.fuel = 100;
{ const sh = (pattern, key, id, count = 1) => RECIPES.push({ type: 'shaped', pattern, key, result: { id, count } }), has = id => RECIPES.some(r => r.result.id === id);
  for (const [k, base] of [['oak', 'oak_planks'], ['cobblestone', 'cobblestone'], ['stone_brick', 'stone_bricks'], ['stone', 'stone']]) { sh(['###'], { '#': base }, k + '_slab', 6); if (k !== 'stone') sh(['#  ', '## ', '###'], { '#': base }, k + '_stairs', 4); }
  if (!has('stone_bricks')) sh(['##', '##'], { '#': 'stone' }, 'stone_bricks', 4);
  if (!has('bow')) sh([' #S', '# S', ' #S'], { '#': 'stick', S: 'string' }, 'bow');
  if (!has('arrow')) sh(['F', '#', 'E'], { F: 'flint', '#': 'stick', E: 'feather' }, 'arrow', 4);
  if (!has('oak_planks_birch')) RECIPES.push({ type: 'shapeless', ingredients: ['birch_log'], result: { id: 'oak_planks', count: 4 } }); }
const sfx = makeSfx();
let uiReady = false; // armor/chest callbacks wait until hud + chests exist (ui.load fires 'armor')
const ui = createUI({ atlas, faceTex: (b, f) => faceTex(ID[b] ?? ID[b + '_0'] ?? ID[b + '_0_0'] ?? ID[b + '_0_bottom_0'] ?? ID.stone, f), container: document.body,
  canOpen: () => player.hp > 0 && !hud.paused,
  armor: player.armor, // shared object, edited in place by the armor slots
  onArmor: e => { if (!uiReady) return; hud.armor(e.points); if (e.broke) for (const id of e.broke) { hud.toast(ITEMS[id].name + ' broke!'); sfx.brk(ID.iron_block); } save(); },
  onChange: e => { if (uiReady && e.type === 'chest') syncChest(); },
  onOpen: () => { mouseL = mouseR = false; },
  onClose: kind => { if (kind === 'chest') { syncChest(); openChestKeys = []; openLarge = null; sfx.door(0); save(true); } if (!TOUCH && player.hp > 0) canvas.requestPointerLock(); },
  onDrop: s => throwStack(s) });
if (saved?.ui) ui.load(saved.ui);
// chests: one 27-slot state per block, saved per block (old saves load as-is; bare arrays / odd lengths are normalised).
// Two chests side by side open as one 54-slot Large Chest: a joined view whose edits are copied back to both halves.
const chests = saved?.chests || {};
for (const k in chests) { const c = normalizeChest(chests[k]); if (c.slots.length > 27) c.slots.length = 27; chests[k] = c; }
let openChestKeys = [], openLarge = null;
// pairing is deterministic (also for old saves holding triples / L-shapes): a chest's candidate is its first chest neighbour in the
// order W, N, E, S; two chests pair only if each is the other's candidate, so a chest belongs to at most one large chest.
const CHEST_N = [[-1, 0], [0, -1], [1, 0], [0, 1]];
const chestCandidate = (x, y, z) => { for (const [dx, dz] of CHEST_N) if (world.get(x + dx, y, z + dz) === ID.chest) return [x + dx, z + dz]; return null; };
function chestPartner(x, y, z) { const c = chestCandidate(x, y, z); if (!c) return null; const b = chestCandidate(c[0], y, c[1]); return b && b[0] === x && b[1] === z ? c : null; }
function chestCanPlace(x, y, z) { const nb = CHEST_N.filter(([dx, dz]) => world.get(x + dx, y, z + dz) === ID.chest); if (nb.length > 1) return false;
  return !nb.length || !CHEST_N.some(([dx, dz]) => { const ax = x + nb[0][0] + dx, az = z + nb[0][1] + dz; return (ax !== x || az !== z) && world.get(ax, y, az) === ID.chest; }); }
function openChestAt(x, y, z) { const k = x + ',' + y + ',' + z, c = chests[k] ||= createChest(), p = chestPartner(x, y, z);
  if (!p) { openChestKeys = [k]; openLarge = null; return ui.openChest(c); }
  const k2 = p[0] + ',' + y + ',' + p[1], c2 = chests[k2] ||= createChest(), first = p[0] < x || p[1] < z; // west/north half on top
  openChestKeys = first ? [k2, k] : [k, k2]; openLarge = createChest(54); openLarge.slots = [...chests[openChestKeys[0]].slots, ...chests[openChestKeys[1]].slots].map(s => s || null);
  return ui.openChest(openLarge, { title: 'Large Chest' }); }
function syncChest() { if (!openLarge || openChestKeys.length < 2) return; for (let h = 0; h < 2; h++) { const c = chests[openChestKeys[h]]; if (c) for (let i = 0; i < 27; i++) c.slots[i] = openLarge.slots[h * 27 + i] || null; } }
const uiOpen = () => ui.isOpen();
const hud = new HUD({ TOUCH, onRespawn: respawn, onResume: () => { if (!TOUCH) canvas.requestPointerLock(); } });
uiReady = true;
// ---------- mobs (Amir's mobs.js) ----------
let dayNow = 1;
const mobWorld = { isSolid: (x, y, z) => { const ch = world.getChunk(Math.floor(x / CS), Math.floor(z / CS)); return !ch || isBlocking(world.get(x, y, z)); }, isWater: (x, y, z) => isWater(world.get(x, y, z)),
  isDay: () => dayNow > .5, isGrass: (x, y, z) => world.get(x, y, z) === ID.grass,
  isLava: (x, y, z) => isLava(world.get(x, y, z)), // MOBS.md round 3b optional lines
  isRaining: (x, z) => !!FX?.weather.rain && !(x !== undefined && FX.weather.snowAt(Math.floor(x), Math.floor(z))), // MOBS.md round 4: snow doesn't count
  biomeAt: (x, z) => world.biome(x, z),
  isFire: (x, y, z) => !!BLOCKS[world.get(x, y, z)]?.fire,
  isDoor: (x, y, z) => { const B = BLOCKS[world.get(x, y, z)]; return B?.door && !B.open && B.name.startsWith('oak_door') ? B.door : null; },
  boxesAt: (x, y, z) => { const id = world.get(x, y, z), B = BLOCKS[id]; return B?.kind === 'model' ? (FX ? FX.boxesOf(id, x, y, z, true) : B.boxes) : null; }, // fences + closed gates report 1.5 high
  getLight: (x, y, z) => { const pk = lightAt(world, x, y, z); if (pk >= 0) return Math.round(Math.max((pk >> 4) * dayNow, pk & 15)); // Timmy: same flood-fill light the blocks are drawn with (old estimate below is the fallback)
    let top = CH - 1; while (top > y && !isSolid(world.get(x, top, z))) top--; const sky = top <= y ? 15 * dayNow : Math.max(0, 6 - (top - y)) * dayNow; let tl = 0;
    for (const ch of [world.getChunk(Math.floor(x / CS), Math.floor(z / CS))]) for (const t of ch?.torches || []) tl = Math.max(tl, 14 - Math.abs(t[0] - x) - Math.abs(t[1] - y) - Math.abs(t[2] - z)); return Math.max(0, Math.round(Math.max(sky, tl))); } };
const mobPlayer = { position: player.pos, eyeHeight: EYE, height: PH, get heldItem() { return ui.selectedItem()?.id; }, get health() { return player.hp; }, get dead() { return player.hp <= 0; },
  hurt(n, from) { if (player.hurtT > 0) return; hurt(armorHit(n)); if (from) { const k = new THREE.Vector3().subVectors(player.pos, from).setY(0).normalize(); player.vel.x += k.x * 6; player.vel.z += k.z * 6; player.vel.y = Math.max(player.vel.y, 5); } } };
const mobs = new MobManager(scene, mobWorld);
installDifficulty(mobs); // Timmy: Easy/Normal/Hard button in the pause menu, saved as bc3d-difficulty (default normal)
mobs.onDrop = (item, pos, count = 1) => { const p = pos || player.pos; spawnDrop(item, count, p.x, p.y + .5, p.z); };
mobs.onExplode = (pos, rad) => { FX.explodeBlocks(pos, rad, .3); save(); }; // creeper: blocks only (mobs.js hurts the player); TNT nearby chain-reacts
mobs.camera = camera;
// zombies break closed oak doors: (x,y,z) is the lower half; breakAt drops one door and blockUpdate pops the upper half
mobs.onBreakDoor = (x, y, z) => { if (!BLOCKS[world.get(x, y, z)]?.door) return; breakAt(x, y, z, true); save(); };
attachMobSounds(mobs, { camera, getMuted: () => localStorage.getItem('bc3d-mute') === '1' });
// one growth tick per second: each crop has a 3% chance to advance a stage (about 4 minutes to ripen)
function growCrops(ticks) { for (let t = 0; t < ticks; t++) for (const ch of world.chunks.values()) { if (ch.dirty) remesh(ch);
  for (const c of ch.crops || []) { const id = world.get(c[0], c[1], c[2]), B = BLOCKS[id];
    if (B.sapling) { if (Math.random() < .012) growTree(c[0], c[1], c[2], id === ID.spruce_sapling ? 'spruce' : id === ID.birch_sapling); continue; }
    if (B.kind !== 'crop') continue; if (world.get(c[0], c[1] - 1, c[2]) !== ID.farmland) { world.set(c[0], c[1], c[2], 0); continue; }
    if (B.stage < B.max && Math.random() < .03) world.set(c[0], c[1], c[2], id + 1); } } }
function growTree(x, y, z, birch) { if (birch === 'spruce') { const th = 6 + (Math.random() * 4 | 0); for (let i = 1; i <= th + 1; i++) { const k = world.get(x, y + i, z); if (!replaceable(k) && BLOCKS[k].kind !== 'cutout') return false; } if (y + th + 3 >= CH) return false;
    world.set(x, y, z, 0); spruceTree((X, Y, Z, id, soft) => { if (soft && !replaceable(world.get(X, Y, Z))) return; world.set(X, Y, Z, id); }, x, y - 1, z, th); save(); return true; }
  const th = (birch ? 5 : 4) + (Math.random() * 3 | 0), log = birch ? ID.birch_log : ID.oak_log, leaf = birch ? ID.birch_leaves : ID.oak_leaves;
  for (let i = 1; i <= th + 1; i++) { const k = world.get(x, y + i, z); if (!replaceable(k) && BLOCKS[k].kind !== 'cutout') return false; }
  if (y + th + 2 >= CH) return false;
  for (let dy = th - 2; dy <= th + 1; dy++) { const rad = dy >= th ? 1 : 2;
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy >= th || Math.random() < .5)) continue; if (dy === th + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
      if (replaceable(world.get(x + dx, y - 1 + dy, z + dz))) world.set(x + dx, y - 1 + dy, z + dz, leaf); } }
  for (let i = 0; i < th; i++) world.set(x, y + i, z, log); world.set(x, y - 1, z, ID.dirt); save(); return true; }
function nearBlock(id, r) { const p = player.pos; for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (world.get(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z) === id) return true; return false; }
hud.hearts(player.hp); hud.food(player.food); hud.armor(armorOf());
FX = installFeatures({ THREE, scene, camera, world, player, ui, hud, sfx, atlas, mobs, keys, touch, saved, get save() { return save; }, setBlock, breakAt, spawnDrop, harvest, hurt, armorHit, collides, raycast, blockMesh, particles });

// touch: left half joystick, right half look; buttons from ui
if (TOUCH) hud.bindTouch({ bag: () => ui.toggleInventory(), move: (x, z) => { touch.mx = x; touch.mz = z; }, look: (dx, dy) => { player.yaw -= dx * .006; player.pitch = THREE.MathUtils.clamp(player.pitch - dy * .006, -1.55, 1.55); },
  jump: v => touch.jump = v, sneak: v => touch.sneak = v, mine: v => mouseL = v, place: v => { mouseR = v; if (v) placeCd = 0; }, sprint: () => (touchSprint = !touchSprint) });

// ---------- save ----------
let lastSave = 0;
function save(force) { const now = performance.now(); if (!force && now - lastSave < 3000) return; lastSave = now;
  try { localStorage.setItem(SAVE, JSON.stringify({ seed, mods: world.mods, p: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, hp: player.hp, ui: ui.save(), furnaces, chests, time, ...FX.save(), food: player.food, sat: player.sat, spawn: player.spawn, armor: player.armor,
    drops: drops.slice(-150).map(d => [d.id, d.count, d.damage | 0, +d.p.x.toFixed(2), +d.p.y.toFixed(2), +d.p.z.toFixed(2)]) })); } catch (e) {} }
addEventListener('beforeunload', () => save(true)); document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
hud.onNewWorld = () => { localStorage.removeItem(SAVE); location.search = '?new'; };

// ---------- sound (procedural, tiny) ----------
function makeSfx() { let ac = null; const on = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ac && localStorage.getItem('bc3d-mute') !== '1'; };
  const noise = (dur, f, q, vol) => { if (!on()) return; const n = ac.sampleRate * dur | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol; s.connect(fl).connect(g).connect(ac.destination); s.start(); };
  const tone = (fr, dur, vol, to) => { if (!on()) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(fr, ac.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
    g.gain.setValueAtTime(vol * .4, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur); };
  const f = id => { const t = BLOCKS[id]?.tool; return t === 'pickaxe' ? 1400 : t === 'axe' ? 700 : t === 'shovel' ? 450 : 2200; };
  let acc = 0, step = 0;
  return { tick(dt, id) { acc += dt; if (acc > .22) { acc = 0; noise(.06, f(id), 2, .25); } }, brk: id => noise(.18, f(id) * .8, 1.2, .5), place: id => noise(.09, f(id) * .7, 1.5, .4), eat: () => noise(.15, 900, 3, .4),
    boom: () => { noise(.9, 120, .7, 1); noise(.5, 60, .5, .8); }, pop: () => tone(1400 + Math.random() * 600, .06, .12), burp: () => { tone(160, .25, .25, 90); },
    bow: p => noise(.25, 1800, 1.5, .25 + p * .3), door: o => { noise(.12, o ? 500 : 380, 2, .4); tone(o ? 220 : 180, .08, .15); }, splash: () => { noise(.4, 900, .8, .4); noise(.25, 2400, 1, .15); }, sizzle: () => noise(.5, 4000, .6, .2), mob: (n) => { if (/hurt|death/.test(n)) noise(.12, 500, 2, .3); else if (/hiss/.test(n)) noise(1.2, 3000, .8, .2); else if (/shoot|arrow/.test(n)) noise(.08, 2500, 3, .2); },
    xp: () => tone(1700 + Math.random() * 500, .07, .1), levelup: big => { tone(big ? 520 : 660, .25, .2, big ? 1040 : 990); }, flint: () => { noise(.1, 3500, 2, .35); tone(2600, .03, .1); }, fuse: () => noise(1.2, 2500, .6, .25),
    step(dt, moving, id) { if (!moving) return; step += dt; if (step > .42) { step = 0; noise(.05, f(id) * .5, 1, .12); } } };
}
addEventListener('pointerdown', () => { try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch (e) {} }, { once: true });

// ---------- loop ----------
for (let i = 0; i < 40; i++) streamChunks(1e9); // prime nearby terrain so you never fall through
function faceOpen() { let best = 0, by = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; let free = 0;
    for (let d = 1; d <= 24; d++) { const X = Math.floor(player.pos.x - Math.sin(a) * d), Z = Math.floor(player.pos.z - Math.cos(a) * d), Y = Math.floor(player.pos.y + 1.6 - d * .08);
      if (isSolid(world.get(X, Y, Z)) || isSolid(world.get(X, Y + 1, Z))) break; free++; } if (free > best) { best = free; by = a; } }
  player.yaw = by; player.pitch = -.12; }
function settleSpawn() { // stand on dry open ground, never inside a tree or underwater; search outward in a spiral
  const cx = Math.floor(player.pos.x), cz = Math.floor(player.pos.z);
  for (let r = 0; r < 40; r++) for (let k = 0; k < Math.max(1, r * 8); k++) {
    const a = k / Math.max(1, r * 8) * Math.PI * 2, x = cx + Math.round(Math.cos(a) * r), z = cz + Math.round(Math.sin(a) * r);
    if (!world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) continue;
    let y = CH - 1; while (y > 0 && !world.get(x, y, z)) y--;
    const top = world.get(x, y, z);
    if (top !== ID.grass && top !== ID.sand && top !== ID.snowy_grass && top !== ID.dirt) continue;
    if (isSolid(world.get(x, y + 1, z)) || isSolid(world.get(x, y + 2, z)) || world.get(x, y + 1, z) === ID.water) continue;
    player.pos.set(x + .5, y + 1, z + .5); faceOpen(); return; }
  while (collides(player.pos)) player.pos.y += 1; }
if (!saved?.p) settleSpawn(); else while (collides(player.pos)) player.pos.y += 1;
let last = performance.now(), fpsT = 0, frames = 0, furnaceAcc = 0, cropAcc = 0, flowAcc = 0, lavaAcc = 0;
if (saved?.drops) for (const [id, n, dmg, x, y, z] of saved.drops) spawnDrop(id, n, x, y, z, new THREE.Vector3(), 0, dmg);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; U.uTime.value = now / 1000;
  const loaded = world.getChunk(Math.floor(player.pos.x / CS), Math.floor(player.pos.z / CS))?.mesh;
  const asleep = updateSleep(dt);
  if (!hud.paused && !uiOpen() && player.hp > 0 && loaded && !asleep) { physics(dt); interact(dt); const g = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - .1), Math.floor(player.pos.z)); sfx.step(dt, player.ground && Math.hypot(player.vel.x, player.vel.z) > 1, g); }
  streamChunks(TOUCH ? 6 : 8);
  const sp = Math.hypot(player.vel.x, player.vel.z); bob += (player.ground ? sp : 0) * dt * 1.6;
  const by = Math.abs(Math.sin(bob * Math.PI)) * .05 * Math.min(1, sp / 4), bx = Math.cos(bob * Math.PI) * .03 * Math.min(1, sp / 4);
  camera.position.set(player.pos.x + bx * Math.cos(player.yaw), player.pos.y + EYE + by - ((keys.ShiftLeft || touch.sneak) ? .15 : 0), player.pos.z - bx * Math.sin(player.yaw));
  camera.rotation.set(player.pitch, player.yaw, 0); const fov = (TOUCH ? 75 : 70) * (sprinting && sp > 4.5 ? 1.12 : 1); camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  armSwing = Math.max(0, armSwing - dt * 2.5); const sw = Math.sin(armSwing / .3 * Math.PI);
  hand.position.set(.22 - sw * .06, -.22 + by * .5 + sw * .04, -.3 - sw * .08); hand.rotation.set(.35 - sw * .9, .3, .25);
  updateHeld(); if (heldMesh) { heldMesh.position.set(.36 - sw * .12, -.3 + by * .5 - sw * .1, -.6); heldMesh.rotation.set(-sw * .9, -.6, .15 - sw * .3); hand.visible = false; } else hand.visible = true;
  const day = updateSky(dt); dayNow = day; updateParticles(dt, .3 + day * .7);
  if (!hud.paused && player.hp > 0 && loaded) { try { mobs.spawnAround(mobPlayer); mobs.update(dt, mobPlayer); } catch (e) { console.error('mobs', e); } }
  cropAcc += dt; if (cropAcc > 1) { cropAcc = 0; growCrops(1); }
  if (!hud.paused) { FX.update(dt); updateDrops(dt); updateFalling(dt); updateArrows(dt); flowAcc += dt; if (flowAcc > .25) { flowAcc = 0; flowTick(); } lavaAcc += dt; if (lavaAcc > 1.5) { lavaAcc = 0; flowTick(200, lq); } }
  furnaceAcc += dt; while (furnaceAcc >= .05) { furnaceAcc -= .05; for (const k in furnaces) FX.furnaceTick(furnaces[k], tickFurnace); }
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 1) { hud.debug(`${frames} fps · ${Math.floor(player.pos.x)} ${Math.floor(player.pos.y)} ${Math.floor(player.pos.z)} · ${world.biome(player.pos.x, player.pos.z)}`); frames = 0; fpsT = 0; save(); }
}
requestAnimationFrame(frame);
window.game = { THREE, scene, camera, world, player, ui, hud, mobs, hurt, raycast, remesh, get time() { return time; }, set time(v) { time = v; }, render: () => renderer.render(scene, camera), keys, collides, furnaces, get FX() { return FX; }, get weather() { return FX?.weather; } }; // Timmy/Amir: game.FX.weather = { rain, level, t, snowAt(x, z) }
// QA hooks for Pete's harness. Each call runs real input through the real physics/mining code.
const qaStep = (secs, fn) => { const n = Math.ceil(secs * 60); for (let i = 0; i < n; i++) { fn?.(); physics(1 / 60); interact(1 / 60); FX.update(1 / 60); updateDrops(1 / 60); updateFalling(1 / 60); updateArrows(1 / 60); mobs.spawnAround(mobPlayer); mobs.update(1 / 60, mobPlayer); camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0); camera.updateMatrixWorld(); } };
window.__qa = {
  start() { hud.pause(false); document.querySelector('#menu').hidden = true; return this.state(); },
  state() { const h = raycast(); return { food: player.food, pos: [player.pos.x, player.pos.y, player.pos.z].map(v => +v.toFixed(2)), yaw: player.yaw, pitch: player.pitch, hp: player.hp, ground: player.ground, inWater: player.inWater, time, target: h && { x: h.x, y: h.y, z: h.z, block: BLOCKS[h.id].name }, held: ui.selectedItem()?.id || null, mobs: mobs.mobs?.length ?? null }; },
  look(yaw, pitch) { player.yaw = yaw; if (pitch !== undefined) player.pitch = pitch; camera.rotation.set(player.pitch, player.yaw, 0); camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z); camera.updateMatrixWorld(); return this.state(); },
  walk(dir = 'forward', secs = 1, sprint = false) { const k = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' }[dir]; keys[k] = true; if (sprint) sprinting = true; qaStep(secs); keys[k] = false; sprinting = false; return this.state(); },
  jump() { keys.Space = true; qaStep(.1); keys.Space = false; qaStep(.9); return this.state(); },
  mine(secs = 5) { const t0 = raycast(); if (!t0) return { ok: false, reason: 'no block in reach' }; const before = BLOCKS[t0.id].name; mouseL = true; let n = 0; qaStep(secs, () => { if (world.get(t0.x, t0.y, t0.z) === 0 && n++ > 1) mouseL = false; }); mouseL = false; swungThisPress = false;
    return { ok: world.get(t0.x, t0.y, t0.z) === 0, block: before, at: [t0.x, t0.y, t0.z], held: ui.selectedItem()?.id || null }; },
  place(item) { if (item) { if (!ui.count(item)) ui.give(item, 1); const i = ui.inventory.slots.findIndex(s => s && s.id === item); if (i > 8) { const sl = ui.inventory.slots; [sl[i], sl[ui.selectedIndex()]] = [sl[ui.selectedIndex()], sl[i]]; ui.refresh(); } else ui.select(i); }
    const t0 = raycast(); if (!t0) return { ok: false, reason: 'no block in reach' }; const at = [t0.x + t0.n[0], t0.y + t0.n[1], t0.z + t0.n[2]], before = world.get(...at);
    mouseR = true; placeCd = 0; qaStep(1 / 60); mouseR = false; return { ok: world.get(...at) !== before, at, block: BLOCKS[world.get(...at)].name }; },
  // round 3 hooks (Mike)
  tp(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.fallStart = null; for (let i = 0; i < 20; i++) streamChunks(1e9); return this.state(); },
  get: (x, y, z) => BLOCKS[world.get(x, y, z)].name, set(x, y, z, name) { return setBlock(x, y, z, ID[name]); }, rawSet: (x, y, z, name) => world.set(x, y, z, ID[name]),
  hold(item, n = 1) { if (ui.count(item) < n) ui.give(item, n - ui.count(item)); const i = ui.inventory.slots.findIndex(s => s && s.id === item); if (i > 8) { const sl = ui.inventory.slots; [sl[i], sl[ui.selectedIndex()]] = [sl[ui.selectedIndex()], sl[i]]; ui.refresh(); } else ui.select(i); return ui.selectedItem()?.id; },
  rclick(secs = 1 / 60) { mouseR = true; placeCd = 0; qaStep(secs); mouseR = false; qaStep(1 / 60); return this.state(); },
  drops: () => drops.map(d => ({ id: d.id, count: d.count, p: [d.p.x, d.p.y, d.p.z].map(v => +v.toFixed(2)) })), falling: () => falling.length, arrows: () => arrows.map(a => ({ stuck: a.stuck, hit: a.hit?.type || null, p: [a.p.x, a.p.y, a.p.z].map(v => +v.toFixed(1)) })),
  flow(n = 1) { let k = 0; for (let i = 0; i < n; i++) k += flowTick(); return k; }, lavaFlow(n = 1) { let k = 0; for (let i = 0; i < n; i++) k += flowTick(500, lq); return k; }, tick(secs) { const n = Math.ceil(secs * 60); for (let i = 0; i < n; i++) { updateDrops(1 / 60); updateFalling(1 / 60); updateArrows(1 / 60); updateSleep(1 / 60); } },
  hunger: () => ({ food: player.food, sat: +player.sat.toFixed(2), exh: +(player.exh || 0).toFixed(3), hp: player.hp, fx: +(player.hungerFx || 0).toFixed(2) }), poison(secs = 30) { player.hungerFx = secs; }, setFood(f, s = 0) { player.food = f; player.sat = s; hud.food(f); },
  chest: { open: () => ui.screen() === 'chest', size: () => ui.currentChest()?.slots.length || 0, close: () => ui.close(), data: () => { syncChest(); return JSON.parse(JSON.stringify(chests)); },
    // real UI clicks: half=false is a shift-click (quick-move whole stack), half=true picks up half and drops it into the first empty slot on the other side
    click: (side, i, half) => { const S = ui.session; if (!S) return; const ref = { g: side === 'chest' ? 'chest' : 'inv', i };
      if (!half) S.click(ref, 0, { shift: true }); else { S.click(ref, 1); const other = side === 'chest' ? 'inv' : 'chest', arr = other === 'chest' ? S.chest.slots : ui.inventory.slots; const e = arr.findIndex(x => !x); if (e >= 0) S.click({ g: other, i: e }, 0); }
      syncChest(); ui.refresh(); } },
  armorClick: (slot, shift) => { const S = ui.session; if (!S) return; S.click({ g: 'armor', i: slot }, 0, shift ? { shift: true } : {}); ui.refresh(); }, invClick: (i, shift) => { const S = ui.session; if (!S) return; S.click({ g: 'inv', i }, 0, shift ? { shift: true } : {}); ui.refresh(); },
  openInv: () => ui.openInventory(), screen: () => ui.screen(),
  armor: () => ({ worn: Object.fromEntries(Object.entries(player.armor).map(([k, v]) => [k, v && v.id + ':' + (v.damage | 0)])), points: armorOf() }), mobHit: n => { const h0 = player.hp; player.hurtT = 0; mobPlayer.hurt(n); return h0 - player.hp; },
  heal() { player.hp = 20; hud.hearts(20); return 20; }, hp: () => player.hp,
  bed: () => ({ spawn: player.spawn, sleeping: !!sleeping, time }), count: id => ui.count(id), remeshAll() { for (const ch of world.chunks.values()) if (ch.dirty && ready(ch.cx, ch.cz)) remesh(ch); },
  spawnMob: (t, x, y, z) => mobs.spawn(t, x, y, z), mobList: () => (mobs.mobs || []).map(m => ({ type: m.type, hp: m.hp, dead: m.dead, p: [m.pos.x, m.pos.y, m.pos.z].map(v => +v.toFixed(1)) })),
  punch() { mouseL = true; swungThisPress = false; qaStep(1 / 60); mouseL = false; swungThisPress = false; qaStep(.35); return this.state(); },
  mobReach: (secs) => mobReach(raycast(), 5), mobsApi: () => mobs,
  fx: () => FX, xp: () => ui.xp(), smelt(k, n) { const f = furnaces[k] ||= createFurnace(); for (let i = 0; i < n; i++) FX.furnaceTick(f, tickFurnace); return { out: f.slots[2], xp: +(f.xp || 0).toFixed(2) }; }, fireTicks(n = 1) { for (let i = 0; i < n; i++) FX.fireTick(); }, weather: (on, secs, thunder) => { FX.setWeather(!!on, secs, thunder); return FX.weather.rain; }, riding: () => !!player.riding, burning: () => document.body.classList.contains('onfire'),
  give: (id, n = 1) => ui.give(id, n), growCrops: (secs = 60) => { growCrops(secs); return 'ok'; }, time: v => { time = v; }, step: secs => { qaStep(secs); return window.__qa.state(); },
};
