// Gameplay batch 4 (Mike): XP orbs + level bar, fences/gates/trapdoors glue, fire + flint and steel, TNT, boats, weather.
// engine.js passes its internals in G; everything here follows Minecraft Java rules where it can.
// Items + recipes for all of this are Timmy's (ui-data.js); textures are Trish's (textures.js). Mob reactions are Amir's.
import { BLOCKS, ID, isSolid, isBlocking, isWater, isFluid, fenceBoxes } from './blocks.js';
import { CS, CH } from './world.js';

export function installFeatures(G) {
  const { THREE, scene, camera, world, player, ui, hud, sfx, atlas } = G;
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const saved = G.saved || {};
  const tileCanvas = name => { const t = atlas.tiles[name]; const c = document.createElement('canvas'); c.width = c.height = 16; if (t) { const g = c.getContext('2d'), im = g.createImageData(16, 16); im.data.set(t); g.putImageData(im, 0, 0); } return c; };
  const nearestTex = c => { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };

  // ---------- shapes: fences / gates need per-position boxes ----------
  // tall = collision (fences and closed gates are 1.5 high), otherwise the visible boxes
  function boxesOf(id, x, y, z, tall) { const B = BLOCKS[id]; if (B.fence) return fenceBoxes(world.get.bind(world), x, y, z, tall); if (tall && B.coll) return B.coll; if (!tall && B.sel) return B.sel; return B.boxes; } // sel = what you aim at (an open gate is still clickable)
  function toggle(B, x, y, z) { // gates + trapdoors open/close on right click
    const nid = B.gate ? ID[B.name.replace(/_\d$/, '_' + (1 - B.open))] : ID[B.name.replace(/_\d$/, '_' + (1 - B.open))];
    if (nid === undefined) return false; world.set(x, y, z, nid); sfx.door(1 - B.open); return true; }

  // ---------- XP (Minecraft Java: points per level, orbs that fly to you) ----------
  // the numbers live in Timmy's ui.js (ui.addXp / ui.xp / ui.setXp, saved with ui.save()); this file spawns orbs and draws the bar
  let lastLevel = ui.xp().level;
  const showXp = () => { const p = ui.xp(); hud.xp?.(p.level, p.progress); return p; };
  ui.on('change', e => { if (e.type === 'xp') hud.xp?.(e.level, e.progress); });
  function addXp(n) { if (n <= 0) return; const p = ui.addXp(n); sfx.xp?.(); if (p.level > lastLevel) sfx.levelup?.(p.level % 5 === 0); lastLevel = p.level; }
  const orbTex = nearestTex(tileCanvas('experience_orb')), orbs = [];
  const SPLIT = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
  function spawnXp(n, x, y, z) { n = Math.round(n); while (n > 0) { const v = SPLIT.find(s => s <= n); n -= v;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: orbTex, alphaTest: .2, color: 0xffffff })); m.scale.setScalar(v >= 17 ? .4 : v >= 7 ? .32 : .24); scene.add(m);
      orbs.push({ v, p: new THREE.Vector3(x, y, z), vel: new THREE.Vector3((Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2), age: 0, mesh: m, ph: Math.random() * 6 }); }
    while (orbs.length > 120) { const o = orbs.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); } }
  function updateOrbs(dt) { const pc = new THREE.Vector3(player.pos.x, player.pos.y + .9, player.pos.z); let cd = 0;
    for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i]; o.age += dt; if (o.age > 300) { scene.remove(o.mesh); o.mesh.material.dispose(); orbs.splice(i, 1); continue; }
      const d = o.p.distanceTo(pc);
      if (player.hp > 0 && o.age > .6 && d < 8) { const k = 1 - d / 8; o.vel.addScaledVector(pc.clone().sub(o.p).normalize(), 40 * k * k * dt + 6 * dt); o.vel.multiplyScalar(Math.pow(.2, dt)); }
      else { o.vel.y -= 14 * dt; o.vel.x *= Math.pow(.3, dt); o.vel.z *= Math.pow(.3, dt); }
      const n = o.p.clone().addScaledVector(o.vel, dt);
      if (isBlocking(world.get(Math.floor(n.x), Math.floor(n.y - .1), Math.floor(n.z))) && !(player.hp > 0 && d < 8)) { n.y = Math.floor(n.y - .1) + 1.1; o.vel.y = 0; }
      o.p.copy(n);
      if (player.hp > 0 && o.age > .6 && d < 1.1 && cd <= 0) { addXp(o.v); cd = .1; scene.remove(o.mesh); o.mesh.material.dispose(); orbs.splice(i, 1); continue; }
      o.mesh.position.set(o.p.x, o.p.y + .1 + Math.sin(o.age * 4 + o.ph) * .05, o.p.z); const pulse = .75 + .25 * Math.sin(o.age * 6 + o.ph); o.mesh.material.color.setRGB(pulse, 1, pulse * .6); } }
  // mining: only ores that drop items (coal 0-2, diamond 3-7, like Minecraft; iron/gold give XP when smelted)
  const roll = (a, b) => a + (Math.random() * (b - a + 1) | 0);
  function blockXp(id, x, y, z) { const n = id === ID.coal_ore ? roll(0, 2) : id === ID.diamond_ore ? roll(3, 7) : 0; if (n) spawnXp(n, x + .5, y + .5, z + .5); return n; }
  // mobs: Amir's mobs.js decides the amount (player kills only) and calls onXp; we just spawn the orbs
  if (G.mobs) G.mobs.onXp = (n, pos) => { if (n > 0 && pos) spawnXp(n, pos.x, pos.y, pos.z); };
  const markHit = () => {}; // kept for engine.js call sites; mobs.js tracks player hits itself (xpT)
  // smelting: XP is stored in the furnace and paid out when you take the result (Minecraft values)
  const SMELT_XP = { iron_ingot: .7, gold_ingot: 1, diamond: 1, coal: .1, glass: .1, stone: .1, charcoal: .15, cooked_porkchop: .35, cooked_beef: .35, cooked_chicken: .35, cooked_mutton: .35 };
  const outCount = f => f.slots?.[2]?.count | 0;
  function furnaceTick(f, tickFurnace) { const b = outCount(f), id0 = f.slots?.[0]?.id; tickFurnace(f); const a = outCount(f);
    if (a > b) { f.xp = (f.xp || 0) + (a - b) * (SMELT_XP[f.slots[2].id] ?? .1); } if (f._out === undefined || a > f._out) f._out = a; }
  function furnaceTake(f) { if (!f) return; const a = outCount(f); if (f._out === undefined) f._out = a; if (a < f._out) { const taken = f._out - a, share = (f.xp || 0) * taken / (taken + a); f.xp = Math.max(0, (f.xp || 0) - share);
      const n = Math.floor(share) + (Math.random() < share % 1 ? 1 : 0); if (n) spawnXp(n, player.pos.x, player.pos.y + 1, player.pos.z); } f._out = a; }
  function deathXp() { const l = ui.xp().level, n = Math.min(7 * l, 100); if (n) spawnXp(n, player.pos.x, player.pos.y + 1, player.pos.z); ui.setXp(0); lastLevel = 0; showXp(); }

  // ---------- fire ----------
  const flam = id => BLOCKS[id]?.flammable | 0;
  const fireAge = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  const flamNear = (x, y, z) => N6.some(d => flam(world.get(x + d[0], y + d[1], z + d[2])) > 0);
  const fireOk = (x, y, z) => isSolid(world.get(x, y - 1, z)) || BLOCKS[world.get(x, y - 1, z)].kind === 'model' || flamNear(x, y, z);
  const skyOpen = (x, y, z) => { for (let yy = y + 1; yy < CH; yy++) { const b = world.get(x, yy, z); if (b && (isSolid(b) || isFluid(b) || BLOCKS[b].kind === 'model')) return false; } return true; };
  function lightFire(x, y, z) { const cur = world.get(x, y, z); if (cur && !(BLOCKS[cur].kind === 'plant' && !BLOCKS[cur].sapling && !BLOCKS[cur].fire)) return false; if (!fireOk(x, y, z) || isWater(world.get(x, y + 1, z)) && false) return false;
    G.setBlock(x, y, z, ID.fire); fireAge.set(key(x, y, z), 0); trackFire(x, y, z); return true; }
  // flint and steel on a block face: TNT primes, anything else gets fire on that face
  function useFlint(hit) { if (!hit) return false; sfx.flint?.() ?? sfx.place(ID.iron_block);
    if (BLOCKS[hit.id].tnt) { primeTnt(hit.x, hit.y, hit.z, 4); ui.damageSelected(1); return true; }
    const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2]; if (!lightFire(x, y, z)) return false; ui.damageSelected(1); return true; }
  let fireAcc = 0;
  const fires = new Map(); const trackFire = (x, y, z) => fires.set(key(x, y, z), [x, y, z]);
  function fireTick() { for (const ch of world.chunks.values()) for (const c of ch.crops || []) if (world.get(c[0], c[1], c[2]) === ID.fire) trackFire(c[0], c[1], c[2]); // fires from saves
    const list = []; for (const [k, c] of fires) { if (world.get(c[0], c[1], c[2]) === ID.fire) list.push(c); else { fires.delete(k); fireAge.delete(k); } }
    for (const [x, y, z] of list.slice(0, 400)) { const k = key(x, y, z), age = (fireAge.get(k) || 0) + 1; fireAge.set(k, age);
      if (world.get(x, y, z) !== ID.fire) { fireAge.delete(k); continue; }
      if (weather.rain && !weather.snowAt(x, z) && skyOpen(x, y, z) && Math.random() < .4) { G.setBlock(x, y, z, 0); sfx.sizzle(); continue; }
      if (!fireOk(x, y, z) || (!flamNear(x, y, z) && age > 3 + Math.random() * 4) || (age > 15 && !flam(world.get(x, y - 1, z)) && Math.random() < .25 * (1 + (age - 15) / 20))) { G.setBlock(x, y, z, 0); fireAge.delete(k); continue; }
      for (const d of N6) { const X = x + d[0], Y = y + d[1], Z = z + d[2], n = world.get(X, Y, Z), f = flam(n); // burn neighbours (wool/leaves fast, logs slow)
        if (f && Math.random() < Math.min(.25, f / 100)) { if (BLOCKS[n].tnt) primeTnt(X, Y, Z, .5 + Math.random()); else { G.setBlock(X, Y, Z, 0); if (Math.random() < .6) lightFire(X, Y, Z); } } }
      if (Math.random() < .3) { const X = x + roll(-1, 1), Y = y + roll(-1, 2), Z = z + roll(-1, 1), n = world.get(X, Y, Z); // jump to air next to fuel
        if ((!n || (BLOCKS[n].kind === 'plant' && !BLOCKS[n].fire && !BLOCKS[n].sapling)) && flamNear(X, Y, Z) && Math.random() < .25) lightFire(X, Y, Z); } } }
  // standing in fire: 1 damage every 0.5 s, then burning for 8 s (1/s); water or rain puts you out
  let burnT = 0, fireDmgT = 0;
  function playerFire(dt) { const fx = Math.floor(player.pos.x), fz = Math.floor(player.pos.z), inFire = [0, 1].some(k => world.get(fx, Math.floor(player.pos.y + k * .9), fz) === ID.fire);
    if (player.inWater || (weather.rain && skyOpen(fx, Math.floor(player.pos.y + 1), fz) && !weather.snowAt(fx, fz))) burnT = 0;
    if (inFire) { burnT = 8; fireDmgT -= dt; if (fireDmgT <= 0) { fireDmgT = .5; G.hurt(1); } }
    else if (burnT > 0) { burnT -= dt; fireDmgT -= dt; if (fireDmgT <= 0) { fireDmgT = 1; G.hurt(1); } }
    document.body.classList.toggle('onfire', burnT > 0 && player.hp > 0); }

  // ---------- TNT ----------
  const tnts = [], flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  function primeTnt(x, y, z, fuse = 4) { if (world.get(x, y, z) === ID.tnt) G.setBlock(x, y, z, 0);
    const mesh = G.blockMesh(ID.tnt), flash = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), flashMat.clone()); flash.position.set(.5, .5, .5); mesh.add(flash); mesh.position.set(x, y, z); scene.add(mesh);
    tnts.push({ p: new THREE.Vector3(x + .5, y, z + .5), vy: 2, fuse, mesh, flash }); sfx.fuse?.() ?? sfx.sizzle(); }
  function updateTnt(dt) { for (let i = tnts.length - 1; i >= 0; i--) { const t = tnts[i]; t.fuse -= dt; t.vy -= 20 * dt; const ny = t.p.y + t.vy * dt;
      if (isBlocking(world.get(Math.floor(t.p.x), Math.floor(ny), Math.floor(t.p.z))) && t.vy < 0) { t.p.y = Math.floor(ny) + 1; t.vy = 0; } else t.p.y = ny;
      const s = 1 + Math.max(0, .4 - t.fuse) * .4; t.mesh.scale.setScalar(s); t.mesh.position.set(t.p.x - .5 * s, t.p.y, t.p.z - .5 * s); t.flash.material.opacity = (Math.floor(t.fuse * 4) % 2) ? .55 : 0;
      if (t.fuse <= 0) { scene.remove(t.mesh); t.flash.geometry.dispose(); tnts.splice(i, 1); explode(t.p.clone().setY(t.p.y + .5), 4); } } }
  // explosion: blocks (TNT in range chain-reacts), then damage with Minecraft's impact formula
  function explodeBlocks(pos, rad, dropChance = 1 / rad) { const R = Math.ceil(rad); let n = 0;
    for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) for (let x = -R; x <= R; x++) if (x * x + y * y + z * z <= rad * rad + Math.random() * rad) {
      const X = Math.floor(pos.x) + x, Y = Math.floor(pos.y) + y, Z = Math.floor(pos.z) + z, id = world.get(X, Y, Z); if (!id || id === ID.bedrock || id === ID.obsidian || isFluid(id)) continue;
      if (BLOCKS[id].tnt) { primeTnt(X, Y, Z, .5 + Math.random()); continue; }
      if (Math.random() < dropChance) for (const [it, k] of G.harvest(id, true)) G.spawnDrop(it, k, X + .5, Y + .5, Z + .5);
      G.setBlock(X, Y, Z, 0); if (n++ < 12) G.particles({ x: X, y: Y, z: Z }, id); } }
  function explode(pos, power) { explodeBlocks(pos, power); sfx.boom(); const r2 = power * 2;
    const eye = new THREE.Vector3(player.pos.x, player.pos.y + .9, player.pos.z), d = eye.distanceTo(pos);
    if (player.hp > 0 && d < r2) { const imp = 1 - d / r2, dmg = (imp * imp + imp) / 2 * 7 * r2 + 1; player.hurtT = 0; G.hurt(G.armorHit(dmg)); const k = eye.clone().sub(pos).normalize().multiplyScalar(imp * 14); player.vel.add(k); player.vel.y = Math.max(player.vel.y, imp * 8); }
    if (G.mobs?.explode) G.mobs.explode(pos, power); // Amir: Minecraft impact formula + knockback for every mob in range
    else for (const m of G.mobs?.mobs || []) { if (m.dead) continue; const md = m.pos.distanceTo(pos); if (md < r2) { const imp = 1 - md / r2; m.invul = 0; m.hurt((imp * imp + imp) / 2 * 7 * r2 + 1, pos, { cause: 'explosion', knockback: imp * 10 }); } }
    for (let i = boats.length - 1; i >= 0; i--) if (boats[i].p.distanceTo(pos) < power) breakBoat(boats[i], true);
    G.save?.(); }

  // ---------- boats ----------
  const boats = [], WOOD = { oak_boat: 'oak_planks', spruce_boat: 'spruce_planks', birch_boat: 'birch_planks' };
  const boatMats = {}; const boatMat = item => boatMats[item] ||= new THREE.MeshBasicMaterial({ map: nearestTex(tileCanvas(WOOD[item] || 'oak_planks')) });
  function boatMesh(item) { const g = new THREE.Group(), m = boatMat(item), box = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
    box(1.3, .12, 1.0, 0, .06, 0); box(1.3, .4, .1, 0, .26, .45); box(1.3, .4, .1, 0, .26, -.45); box(.1, .4, .8, .6, .26, 0); box(.1, .4, .8, -.6, .26, 0); box(.08, .06, .8, .1, .32, 0); return g; } // long axis = local x
  function addBoat(item, x, y, z, yaw = 0) { const mesh = boatMesh(item); scene.add(mesh); const b = { item, p: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), yaw, mesh, hp: 2, hurtT: 0 }; boats.push(b); return b; }
  function breakBoat(b, silent) { scene.remove(b.mesh); boats.splice(boats.indexOf(b), 1); if (player.riding === b) dismount(); G.spawnDrop(b.item, 1, b.p.x, b.p.y + .4, b.p.z); if (!silent) sfx.brk(ID.oak_planks); }
  function rayBoat(maxD = 5) { const d = new THREE.Vector3(); camera.getWorldDirection(d); const ray = new THREE.Ray(camera.position.clone(), d); let best = null;
    for (const b of boats) { if (b === player.riding) continue; const box = new THREE.Box3(new THREE.Vector3(b.p.x - .7, b.p.y, b.p.z - .7), new THREE.Vector3(b.p.x + .7, b.p.y + .6, b.p.z + .7)), hp = ray.intersectBox(box, new THREE.Vector3());
      if (hp) { const t = hp.distanceTo(camera.position); if (t <= maxD && (!best || t < best.t)) best = { b, t }; } } return best; }
  function placeBoat(item) { const w = G.raycast(5, true); if (!w) return false; let x = w.x + .5, z = w.z + .5, y;
    if (isWater(w.id)) y = w.y + .75; else { if (w.n[1] !== 1) return false; y = w.y + 1; }
    if (G.collides(new THREE.Vector3(x, y + .05, z), .6, .5)) return false; addBoat(item, x, y, z, player.yaw + Math.PI / 2); ui.removeSelected(1); sfx.place(ID.oak_planks); return true; }
  function mount(b) { player.riding = b; player.vel.set(0, 0, 0); hud.toast('Sneak (Shift) to get out'); }
  function dismount() { const b = player.riding; player.riding = null; if (!b) return; const p = player.pos;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { p.set(b.p.x + dx * 1.2, b.p.y + .7, b.p.z + dz * 1.2); if (!G.collides(p)) break; } player.fallStart = null; }
  // water surface under/at the hull: the top of the highest water cell at this x,z near y
  function waterTop(x, y, z) { const X = Math.floor(x), Z = Math.floor(z); for (let Y = Math.floor(y + .5); Y >= Math.floor(y) - 1; Y--) if (isWater(world.get(X, Y, Z)) && !isWater(world.get(X, Y + 1, Z))) return Y + .85; return null; }
  function updateBoats(dt) { for (const b of boats) { const ridden = player.riding === b;
      if (ridden) { const k = G.keys, t = G.touch, fwd = ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)) + (-t.mz || 0), turn = ((k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0)) + (-t.mx || 0) * .8;
        const dy = turn * 2.4 * dt; b.yaw += dy; player.yaw += dy; const onW = waterTop(b.p.x, b.p.y, b.p.z) !== null, acc = (onW ? 8 : 1.2) * Math.max(-.4, Math.min(1, fwd));
        // the hull's long axis (local x) points along the player's view when yaw = view yaw + 90 degrees
        b.vel.x += -Math.sin(b.yaw - Math.PI / 2) * acc * dt; b.vel.z += -Math.cos(b.yaw - Math.PI / 2) * acc * dt; }
      const wt = waterTop(b.p.x, b.p.y, b.p.z);
      if (wt !== null && b.p.y < wt + .15) { b.p.y += (wt - .1 - b.p.y) * Math.min(1, dt * 5); b.vel.y = 0; b.vel.x *= Math.pow(.35, dt); b.vel.z *= Math.pow(.35, dt); }
      else { b.vel.y = Math.max(-30, b.vel.y - 20 * dt); b.vel.x *= Math.pow(.01, dt); b.vel.z *= Math.pow(.01, dt); const ny = b.p.y + b.vel.y * dt;
        if (G.collides(new THREE.Vector3(b.p.x, ny, b.p.z), .6, .5)) { b.p.y = b.vel.y < 0 ? Math.floor(ny) + 1 : b.p.y; b.vel.y = 0; } else b.p.y = ny; }
      for (const ax of ['x', 'z']) { const n = b.p.clone(); n[ax] += b.vel[ax] * dt; if (G.collides(n.clone().setY(n.y + .05), .6, .5)) b.vel[ax] = 0; else b.p[ax] = n[ax]; }
      b.mesh.position.copy(b.p); b.mesh.rotation.y = b.yaw; b.hurtT = Math.max(0, b.hurtT - dt); b.mesh.rotation.z = b.hurtT ? Math.sin(b.hurtT * 40) * .08 : 0;
      if (ridden) { player.pos.set(b.p.x, b.p.y + .15, b.p.z); player.vel.set(0, 0, 0); player.ground = true; player.fallStart = null; if (G.keys.ShiftLeft || G.touch.sneak) dismount(); } } }
  function hitBoat(b) { b.hp--; b.hurtT = .4; sfx.place(ID.oak_planks); if (b.hp <= 0) breakBoat(b); }
  for (const s of saved.boats || []) addBoat(s[0], s[1], s[2], s[3], s[4]);

  // ---------- weather: rain, snow in cold biomes (Minecraft durations: clear 10-150 min, rain 10-20 min) ----------
  const weather = { rain: !!saved.weather?.rain, t: saved.weather?.t ?? 600 + Math.random() * 8400, level: saved.weather?.rain ? 1 : 0, thunder: !!(saved.weather?.rain && saved.weather?.thunder),
    snowAt: (x, z) => { const b = world.biome(x, z); return b === 'snowy' || b === 'taiga'; } };
  const RN = 900, rPos = new Float32Array(RN * 6), rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: .55, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
  const SN = 700, sPos = new Float32Array(SN * 3), sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: .9, depthWrite: false })); snow.frustumCulled = false; scene.add(snow);
  const drops = Array.from({ length: RN }, () => ({ x: 0, y: -999, z: 0, v: 0 })), flakes = Array.from({ length: SN }, () => ({ x: 0, y: -999, z: 0, v: 0, ph: Math.random() * 6 }));
  const topCache = new Map(); let topT = 0;
  const colTop = (x, z) => { const k = x + ',' + z; let t = topCache.get(k); if (t === undefined) { t = -1; for (let y = CH - 1; y > 0; y--) { const b = world.get(x, y, z); if (b && b !== ID.fire && BLOCKS[b].kind !== 'plant') { t = y; break; } } topCache.set(k, t); } return t; };
  function setWeather(on, secs, thunder) { weather.rain = on; weather.thunder = !!on && (thunder ?? Math.random() < 1 / 3); // thunderstorm = a rain spell with thunder (no lightning bolts yet)
    weather.t = secs ?? (on ? 600 + Math.random() * 600 : 600 + Math.random() * 8400); }
  function updateWeather(dt) { weather.t -= dt; if (weather.t <= 0) setWeather(!weather.rain);
    weather.level += ((weather.rain ? 1 : 0) - weather.level) * Math.min(1, dt / 3); document.body.classList.toggle('raining', weather.level > .3);
    topT -= dt; if (topT <= 0) { topT = 1; topCache.clear(); }
    const cp = camera.position, R = 14, lv = weather.level; let nr = 0, ns = 0; const want = Math.floor(lv * RN);
    for (let i = 0; i < want; i++) { const d = drops[i]; if (d.y < -500 || d.y < d.floor || Math.abs(d.x - cp.x) > R || Math.abs(d.z - cp.z) > R) { d.x = cp.x + (Math.random() * 2 - 1) * R; d.z = cp.z + (Math.random() * 2 - 1) * R; d.y = cp.y + 6 + Math.random() * 12; d.v = 14 + Math.random() * 4; d.floor = colTop(Math.floor(d.x), Math.floor(d.z)) + 1; d.snow = weather.snowAt(Math.floor(d.x), Math.floor(d.z)); }
      if (d.snow) { if (ns >= SN) continue; d.y -= 2.2 * dt; const s = flakes[ns]; sPos[ns * 3] = d.x + Math.sin(d.y * 1.3 + i) * .3; sPos[ns * 3 + 1] = d.y; sPos[ns * 3 + 2] = d.z + Math.cos(d.y * 1.1 + i) * .3; ns++; continue; }
      d.y -= d.v * dt; if (d.y < d.floor) { d.y = -999; continue; } rPos.set([d.x, d.y, d.z, d.x + .02, d.y + .55, d.z + .02], nr * 6); nr++; }
    rGeo.setDrawRange(0, nr * 2); rGeo.attributes.position.needsUpdate = true; sGeo.setDrawRange(0, ns); sGeo.attributes.position.needsUpdate = true;
    rain.visible = nr > 0; snow.visible = ns > 0; }

  // ---------- per frame + right/left click hooks for engine.js ----------
  function update(dt) { updateOrbs(dt); updateTnt(dt); updateBoats(dt); updateWeather(dt); playerFire(dt); furnaceTake(ui.session?.furnace);
    fireAcc += dt; if (fireAcc > .5) { fireAcc = 0; fireTick(); } }
  // returns true if the right click was used here (before blocks are placed)
  function rightClick(hit, held, sneak) { const rb = rayBoat(5), bd = hit ? camera.position.distanceTo(new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5)) : 99;
    if (rb && rb.t < bd && !player.riding) { mount(rb.b); return true; }
    if (held === 'flint_and_steel') { useFlint(hit); return true; }
    if (/_boat$/.test(held || '')) { placeBoat(held); return true; }
    if (hit && (BLOCKS[hit.id].gate || BLOCKS[hit.id].trapdoor) && !(sneak && held)) { toggle(BLOCKS[hit.id], hit.x, hit.y, hit.z); return true; }
    return false; }
  function leftClick(hit) { const rb = rayBoat(4), bd = hit ? camera.position.distanceTo(new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5)) : 99; if (rb && rb.t < bd) { hitBoat(rb.b); return true; } return false; }
  showXp();
  return { trackFire, boxesOf, toggle, addXp, spawnXp, blockXp, markHit, furnaceTick, deathXp, lightFire, fireOk, fireTick, useFlint, primeTnt, explode, explodeBlocks, tnts, boats, addBoat, mount, dismount, placeBoat, weather, setWeather, precip: () => ({ rain: rain.visible ? rGeo.drawRange.count / 2 : 0, snow: snow.visible ? sGeo.drawRange.count : 0 }),
    update, rightClick, leftClick, riding: () => !!player.riding, orbs,
    save: () => ({ boats: boats.map(b => [b.item, +b.p.x.toFixed(2), +b.p.y.toFixed(2), +b.p.z.toFixed(2), +b.yaw.toFixed(2)]), weather: { rain: weather.rain, thunder: weather.thunder, t: Math.round(weather.t) } }) };
}
