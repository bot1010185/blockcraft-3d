// Chunked voxel world: terrain generation, edits, and mesh building.
import { makeNoise, hash3 } from './noise.js';
import { BLOCKS, ID, isOpaque, faceTex, isWater, isLava, fenceBoxes } from './blocks.js';
import { lightChunk } from './lighting.js'; // Timmy: flood-fill sky/block light + smooth lighting (see lighting.js)
export const CS = 16, CH = 128, SEA = 62;
const idx = (x, y, z) => (y * CS + z) * CS + x;

export class World {
  constructor(seed) { this.seed = seed; this.noise = makeNoise(seed); this.cave = makeNoise(seed + 7); this.cave2 = makeNoise(seed + 13); this.chunks = new Map(); this.mods = {}; }
  key(cx, cz) { return cx + ',' + cz; }
  // biomes (Mike, batch 4): temperature t + moisture m pick the land biome; low continentalness makes ocean
  climate(x, z) { const n = this.noise; return [n.fbm2(x / 600 + 100, z / 600, 3), n.fbm2(x / 500 - 300, z / 500 + 50, 3), n.fbm2(x / 400, z / 400, 4)]; }
  biome(x, z) { const [t, m, cont] = this.climate(x, z);
    if (cont < -.3 && this.height(x, z) < SEA - 3) return 'ocean';
    if (t > .32) return 'desert'; if (t > .2) return 'savanna'; if (t < -.35) return 'snowy'; if (t < -.2) return 'taiga';
    if (m > .3 && t > -.1) return 'swamp'; if (m > .15) return 'forest'; if (m < -.25) return 'birch'; return 'plains'; }
  height(x, z) { const n = this.noise, cont = n.fbm2(x / 400, z / 400, 4), hills = n.fbm2(x / 90, z / 90, 4), mt = Math.max(0, n.fbm2(x / 250 + 50, z / 250 - 50, 3) - .1);
    let h = SEA + 2 + cont * 22 + hills * 8 + Math.pow(mt, 1.5) * 90;
    if (cont < -.3) h -= (-.3 - cont) * 70; // oceans: deeper water far from land
    const t = n.fbm2(x / 600 + 100, z / 600, 3), m = n.fbm2(x / 500 - 300, z / 500 + 50, 3), sw = Math.min(1, Math.max(0, (m - .3) / .08)) * Math.min(1, Math.max(0, (t + .1) / .08)) * (t <= .2 && t >= -.2 ? 1 : 0);
    if (sw > 0 && cont >= -.3) h = sw > .9 ? SEA + (hills > .12 ? 1 : hills > -.05 ? 0 : -1) : h + (SEA - h) * sw; // swamps: flat, right at sea level, with puddles
    return Math.max(4, Math.min(CH - 12, Math.round(h))); }
  genChunk(cx, cz) {
    const b = new Uint8Array(CS * CS * CH), x0 = cx * CS, z0 = cz * CS, s = this.seed;
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = x0 + lx, wz = z0 + lz, h = this.height(wx, wz), bio = this.biome(wx, wz), beach = bio !== 'swamp' && h <= SEA + 1 && h >= SEA - 3;
      for (let y = 0; y < CH; y++) {
        let id = 0;
        if (y <= 4 && (y === 0 || hash3(wx, y, wz, s) < (5 - y) / 5)) id = ID.bedrock;
        else if (y < h - 4) id = ID.stone;
        else if (y < h) id = bio === 'desert' || beach ? (y < h - 2 && bio === 'desert' ? ID.sandstone : ID.sand) : ID.dirt;
        else if (y === h) id = bio === 'swamp' && h < SEA ? ID.dirt : h < SEA - 1 ? (hash3(wx, 1, wz, s) < .5 ? ID.gravel : ID.sand) : bio === 'desert' || beach ? ID.sand : bio === 'snowy' || (bio === 'taiga' && h > 90) ? ID.snowy_grass : h > 105 ? ID.stone : ID.grass;
        else if (y <= SEA) id = ID.water;
        if (id === ID.stone) { // ores, rarer and deeper as value rises
          const r = hash3(wx, y, wz, s + 3);
          if (r < .012 && y < 110) id = ID.coal_ore; else if (r < .018 && y < 64) id = ID.iron_ore; else if (r < .0205 && y < 32) id = ID.gold_ore; else if (r < .0222 && y < 16) id = ID.diamond_ore;
          else if (r > .985) id = ID.gravel; }
        if (y > 4 && y < h - 1 + (h > SEA ? 2 : 0) && id !== ID.water && id !== ID.bedrock) { // caves: spaghetti tunnels + caverns
          const a = this.cave.n3(wx / 48, y / 32, wz / 48), c = this.cave2.n3(wx / 48, y / 32, wz / 48), big = this.cave.n3(wx / 90 + 40, y / 40, wz / 90);
          const nearSurf = y > h - 6 && h <= SEA + 1; if (!nearSurf && ((a * a + c * c < .006) || (y < 45 && big > .55))) id = y < 11 ? ID.lava : 0; } // Minecraft: caves fill with lava below y=10
        b[idx(lx, y, lz)] = id;
      }
    }
    // vegetation: check a margin so trees crossing borders appear in both chunks
    for (let wz = z0 - 3; wz < z0 + CS + 3; wz++) for (let wx = x0 - 3; wx < x0 + CS + 3; wx++) {
      const r = hash3(wx, 7, wz, s), bio = this.biome(wx, wz), dens = bio === 'forest' ? .045 : bio === 'birch' ? .035 : bio === 'plains' ? .006 : bio === 'snowy' ? .01 : bio === 'desert' ? .006 : bio === 'taiga' ? .04 : bio === 'swamp' ? .02 : bio === 'savanna' ? .005 : 0;
      if (r >= dens) continue; const h = this.height(wx, wz); if (h <= SEA || h > 100) continue;
      if (this.isCaveAt(wx, h, wz)) continue;
      const put = (x, y, z, id, soft) => { const lx = x - x0, lz = z - z0; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= CH) return; const i = idx(lx, y, lz); if (soft && b[i] !== 0) return; b[i] = id; };
      if (bio === 'desert') { const th = 1 + (hash3(wx, 9, wz, s) * 3 | 0); for (let i = 1; i <= th; i++) put(wx, h + i, wz, ID.cactus); continue; }
      const rr = k => hash3(wx, k, wz, s);
      if (bio === 'taiga' || bio === 'snowy') { spruceTree(put, wx, h, wz, 6 + (rr(9) * 4 | 0)); continue; }
      if (bio === 'savanna') { savannaTree(put, wx, h, wz, 4 + (rr(9) * 2 | 0), rr(10) * 4 | 0, rr(13) < .5); continue; }
      const birch = bio === 'birch' || (bio === 'forest' && hash3(wx, 8, wz, s) < .25), log = birch ? ID.birch_log : ID.oak_log, leaf = birch ? ID.birch_leaves : ID.oak_leaves;
      const th = 4 + (hash3(wx, 9, wz, s) * 3 | 0);
      for (let dy = th - 2; dy <= th + 1; dy++) { const rad = dy >= th ? 1 : 2;
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy >= th || hash3(wx + dx, h + dy, wz + dz, s) < .5)) continue;
          if (dy === th + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          put(wx + dx, h + dy, wz + dz, leaf, true); } }
      for (let i = 1; i <= th; i++) put(wx, h + i, wz, log);
      put(wx, h, wz, ID.dirt);
    }
    // ground cover: short grass and flowers on grass blocks (seeds come from short grass, like Minecraft)
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = x0 + lx, wz = z0 + lz, h = this.height(wx, wz); if (h >= CH - 2 || b[idx(lx, h, lz)] !== ID.grass || b[idx(lx, h + 1, lz)] !== 0) continue;
      const bio = this.biome(wx, wz), r = hash3(wx, 11, wz, s), g = bio === 'plains' ? .2 : bio === 'forest' ? .1 : bio === 'birch' ? .14 : bio === 'savanna' ? .35 : bio === 'swamp' ? .15 : bio === 'taiga' ? .08 : 0;
      const fl = (bio === 'plains' ? .012 : bio === 'taiga' || bio === 'savanna' ? .001 : .005) * (this.noise.fbm2(wx / 40, wz / 40, 2) > .1 ? 4 : 1);
      if (r < fl) b[idx(lx, h + 1, lz)] = hash3(wx, 12, wz, s) < .5 ? ID.dandelion : ID.poppy; else if (r < fl + g) b[idx(lx, h + 1, lz)] = ID.short_grass; }
    const ch = { cx, cz, b, mesh: null, dirty: true };
    const m = this.mods[this.key(cx, cz)]; if (m) for (const k in m) b[+k] = m[k];
    this.chunks.set(this.key(cx, cz), ch); return ch;
  }
  isCaveAt(wx, y, wz) { const a = this.cave.n3(wx / 48, y / 32, wz / 48), c = this.cave2.n3(wx / 48, y / 32, wz / 48); return a * a + c * c < .006; }
  getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }
  get(x, y, z) { if (y < 0) return ID.bedrock; if (y >= CH) return 0; const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = this.chunks.get(cx + ',' + cz); if (!ch) return 0;
    return ch.b[idx(x - cx * CS, y, z - cz * CS)]; }
  set(x, y, z, id) { if (y < 0 || y >= CH) return false; const cx = Math.floor(x / CS), cz = Math.floor(z / CS), k = cx + ',' + cz, ch = this.chunks.get(k); if (!ch) return false;
    const lx = x - cx * CS, lz = z - cz * CS, i = idx(lx, y, lz); ch.b[i] = id; (this.mods[k] ||= {})[i] = id; ch.dirty = true;
    const mark = (dx, dz) => { const n = this.chunks.get((cx + dx) + ',' + (cz + dz)); if (n) n.dirty = true; };
    if (lx === 0) mark(-1, 0); if (lx === CS - 1) mark(1, 0); if (lz === 0) mark(0, -1); if (lz === CS - 1) mark(0, 1);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) mark(dx, dz); // torch light reaches neighbours
    return true; }
}

// spruce: tall trunk, cone of leaves in alternating rings (Minecraft-like). put(x, y, z, id, soft)
export function spruceTree(put, x, h, z, th) { const radii = [0, 1, 1, 2, 1, 2, 3, 2, 3];
  for (let i = 0; i < Math.min(radii.length, th - 1); i++) { const y = h + th + 1 - i, rad = radii[i];
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { if (rad > 1 && Math.abs(dx) === rad && Math.abs(dz) === rad) continue; if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue; put(x + dx, y, z + dz, ID.spruce_leaves, true); } }
  for (let i = 1; i <= th; i++) put(x, h + i, z, ID.spruce_log); put(x, h, z, ID.dirt); }
// savanna "acacia-lite": oak wood, a trunk that leans one way, then a wide flat canopy
export function savannaTree(put, x, h, z, th, dir, twin) { const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][dir]; let cx = x, cz = z, y = h;
  for (let i = 1; i <= th; i++) { y = h + i; if (i > th - 2) { cx += dx; cz += dz; } put(cx, y, cz, ID.oak_log); }
  const canopy = (ax, ay, az) => { for (let ez = -3; ez <= 3; ez++) for (let ex = -3; ex <= 3; ex++) { const d = Math.abs(ex) + Math.abs(ez); if (d <= 4 && !(Math.abs(ex) === 3 && Math.abs(ez) === 3)) put(ax + ex, ay + 1, az + ez, ID.oak_leaves, true); if (d <= 2) put(ax + ex, ay + 2, az + ez, ID.oak_leaves, true); } };
  canopy(cx, y, cz); if (twin) { let bx = x, bz = z, by = h + 2; for (let i = 0; i < 2; i++) { bx -= dx; bz -= dz; by++; put(bx, by, bz, ID.oak_log); } canopy(bx, by, bz); }
  put(x, h, z, ID.dirt); }

// Face table: normal, 4 corners (pos, uv), name for texture lookup.
const FACES = [
  { n: [-1, 0, 0], f: 'side', c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]], sh: .6 }, // Timmy: Minecraft face shades, E/W .6 N/S .8
  { n: [1, 0, 0], f: 'side', c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]], sh: .6 },
  { n: [0, -1, 0], f: 'bottom', c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]], sh: .5 },
  { n: [0, 1, 0], f: 'top', c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]], sh: 1 },
  { n: [0, 0, -1], f: 'side', c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]], sh: .8 },
  { n: [0, 0, 1], f: 'front', c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]], sh: .8 },
];
const AO = [.42, .62, .8, 1];

// Builds three geometry buffers (opaque, cutout, water) for one chunk. Light: sky (heightmap based) + torch light.
export function buildChunkMesh(world, ch, uv) {
  const out = { solid: newBuf(), cutout: newBuf(), water: newBuf(), lava: newBuf() }, x0 = ch.cx * CS, z0 = ch.cz * CS;
  const LV = lightChunk(world, ch), get = LV.get, b = ch.b; // Timmy: light volume for this chunk + 15 block margin; get() reads blocks from it (much faster than world.get)
  const torches = []; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = world.getChunk(ch.cx + dx, ch.cz + dz); if (n?.torches) for (const t of n.torches) torches.push(t); }
  ch.torches = []; ch.crops = []; for (let i = 0; i < b.length; i++) { if (BLOCKS[b[i]].kind === 'crop' || BLOCKS[b[i]].sapling || BLOCKS[b[i]].fire || BLOCKS[b[i]].tnt === 'lit') ch.crops.push([x0 + i % CS, (i / (CS * CS)) | 0, z0 + ((i / CS) | 0) % CS]); } let lavaLights = 0; for (let i = 0; i < b.length; i++) if (b[i] === ID.torch || (isLava(b[i]) && lavaLights < 6 && i + CS * CS < b.length && b[i + CS * CS] === 0 && (i * 7) % 5 === 0 && ++lavaLights)) { const lx = i % CS, lz = ((i / CS) | 0) % CS, y = (i / (CS * CS)) | 0; ch.torches.push([x0 + lx, y, z0 + lz]); }
  for (const t of ch.torches) if (!torches.some(o => o[0] === t[0] && o[1] === t[1] && o[2] === t[2])) torches.push(t);
  const light = (x, y, z) => { const o = LV.at(x, y, z); return [o[0], o[1]]; }; // Timmy: flood-fill light of the cell (was heightmap guess + torch distance)
  for (let y = 0; y < CH; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
    const id = b[idx(lx, y, lz)]; if (!id) continue; const B = BLOCKS[id], wx = x0 + lx, wz = z0 + lz;
    if (B.kind === 'torch') { addTorch(out.cutout, wx, y, wz, uv.torch); continue; }
    if (B.kind === 'crop') { const [sky, tl] = light(wx, y, wz); addCross(out.cutout, wx, y, wz, uv[faceTex(id, 'side')] || uv.stone, sky, tl); continue; }
    if (B.kind === 'plant') { const [sky, tl] = light(wx, y, wz); addCross(out.cutout, wx, y, wz, uv[faceTex(id, 'side')] || uv.stone, sky, tl, id === ID.short_grass ? 1 : 0, id !== ID.short_grass && !B.sapling && !B.fire ? .25 : 0); continue; }
    if (B.kind === 'model') { const [sky, tl] = light(wx, y, wz); addModel(B.cut ? out.cutout : out.solid, B, wx, y, wz, uv, sky, tl, get, B.fence ? fenceBoxes(get, wx, y, wz, false) : B.boxes); continue; }
    const buf = B.kind === 'lava' ? out.lava : B.kind === 'water' ? out.water : B.kind === 'cutout' ? out.cutout : out.solid;
    for (const F of FACES) {
      const nx = wx + F.n[0], ny = y + F.n[1], nz = wz + F.n[2], nb = get(nx, ny, nz);
      if (B.kind === 'water') { if (isWater(nb) || isOpaque(nb) || (F.n[1] === -1 && nb)) continue; }
      else if (B.kind === 'lava') { if (isLava(nb) || isOpaque(nb) || (F.n[1] === -1 && nb)) continue; }
      else if (isOpaque(nb) || (nb === id && B.kind === 'cutout' && id === ID.glass)) continue;
      if (B.kind === 'solid' && nb === ID.water && false) continue;
      const tn = faceTex(id, F.f), t = uv[tn] || uv.stone, [sky, tl] = light(nx, ny, nz), base = buf.pos.length / 3, aos = [];
      for (const c of F.c) {
        let ao = 3;
        if (B.kind !== 'water' && B.kind !== 'lava') { const ax = [], s = [];
          for (let a = 0; a < 3; a++) if (F.n[a] === 0) { ax.push(a); s.push(c[a] ? 1 : -1); }
          const p = [nx, ny, nz], q1 = p.slice(), q2 = p.slice(), q3 = p.slice(); q1[ax[0]] += s[0]; q2[ax[1]] += s[1]; q3[ax[0]] += s[0]; q3[ax[1]] += s[1];
          const s1 = isOpaque(get(...q1)) ? 1 : 0, s2 = isOpaque(get(...q2)) ? 1 : 0, cc = isOpaque(get(...q3)) ? 1 : 0; ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc); }
        aos.push(ao);
        const lc = LV.corner(nx, ny, nz, F.n[0] ? 1 : 0, c[F.n[0] ? 1 : 0] ? 1 : -1, F.n[2] ? 1 : 2, c[F.n[2] ? 1 : 2] ? 1 : -1), vsk = lc[0], vtl = lc[1]; // Timmy: smooth lighting, average of the 4 cells at this corner
        const wy = B.kind === 'water' && c[1] === 1 && !isWater(get(wx, y + 1, wz)) ? (B.level ? .88 - B.level * .11 : .88) : B.kind === 'lava' && c[1] === 1 && !isLava(get(wx, y + 1, wz)) ? .88 - (B.level || 0) * .2 : c[1];
        buf.pos.push(wx + c[0], y + wy, wz + c[2]); buf.uv.push(c[3] ? t[2] : t[0], c[4] ? t[3] : t[1]);
        const k = B.kind === 'lava' ? 1 : F.sh * AO[ao]; buf.col.push(B.kind === 'lava' ? 1 : k * vsk, B.kind === 'lava' ? 1 : k * vtl, B.leaves ? 1 : 0); // r = sky light, g = torch light (shader mixes by time of day)
      }
      if (aos[0] + aos[3] > aos[1] + aos[2]) buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
      else buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  return out;
}
function blocksSky(id) { const B = BLOCKS[id], k = B.kind; return k === 'solid' || B.leaves || k === 'water' || k === 'lava' || !!B.slab || !!B.stairs; }
function newBuf() { return { pos: [], uv: [], col: [], idx: [] }; }
function addTorch(buf, x, y, z, t) { // thin box 2/16 wide, 10/16 tall
  const a = 7 / 16, bq = 9 / 16, h = 10 / 16, u0 = t[0] + (t[2] - t[0]) * 7 / 16, u1 = t[0] + (t[2] - t[0]) * 9 / 16, v0 = t[1], v1 = t[1] + (t[3] - t[1]) * 11 / 16;
  const quads = [[[a, 0, a], [bq, 0, a], [a, h, a], [bq, h, a]], [[bq, 0, bq], [a, 0, bq], [bq, h, bq], [a, h, bq]], [[a, 0, bq], [a, 0, a], [a, h, bq], [a, h, a]], [[bq, 0, a], [bq, 0, bq], [bq, h, a], [bq, h, bq]]];
  for (const q of quads) { const base = buf.pos.length / 3; q.forEach((p, i) => { buf.pos.push(x + p[0], y + p[1], z + p[2]); buf.uv.push(i % 2 ? u1 : u0, i < 2 ? v0 : v1); buf.col.push(1, 1, 0); });
    buf.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3, base, base + 1, base + 2, base + 2, base + 1, base + 3); }
  const base = buf.pos.length / 3, tu = t[0] + (t[2] - t[0]) * 7.5 / 16, tv = t[1] + (t[3] - t[1]) * 10.5 / 16;
  [[a, h, a], [bq, h, a], [a, h, bq], [bq, h, bq]].forEach(p => { buf.pos.push(x + p[0], y + p[1], z + p[2]); buf.uv.push(tu, tv); buf.col.push(1, 1, 0); });
  buf.idx.push(base + 2, base + 1, base, base + 2, base + 3, base + 1);
}

function addCross(buf, x, y, z, t, sky, tl, sway = 0, jit = 0) { // two diagonal planes, like Minecraft crops and plants
  const q = [[[.15, 0, .15], [.85, 0, .85], [.15, 1, .15], [.85, 1, .85]], [[.85, 0, .15], [.15, 0, .85], [.85, 1, .15], [.15, 1, .85]]];
  const jx = jit ? (hash3(x, 1, z, 5) - .5) * jit : 0, jz = jit ? (hash3(x, 2, z, 5) - .5) * jit : 0, dy = sway || jit ? 0 : -1 / 16;
  for (const p4 of q) { const base = buf.pos.length / 3; p4.forEach((p, i) => { buf.pos.push(x + p[0] + jx, y + p[1] + dy, z + p[2] + jz); buf.uv.push(i % 2 ? t[2] : t[0], i < 2 ? t[1] : t[3]); buf.col.push(sky * .95, tl, sway && i >= 2 ? 1 : 0); });
    buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3); } }
// Boxes of a model block (door, bed, slab, stairs, ladder). UVs are cropped to each face like Minecraft; top/bottom
// UVs follow the block's facing so a bed's pillow turns with it.
const BOX_FACES = [
  { n: [-1, 0, 0], f: 'side', sh: .6 }, { n: [1, 0, 0], f: 'side', sh: .6 }, { n: [0, -1, 0], f: 'bottom', sh: .5 }, // Timmy: was .8/.65, now Minecraft's E/W .6 N/S .8
  { n: [0, 1, 0], f: 'top', sh: 1 }, { n: [0, 0, -1], f: 'side', sh: .8 }, { n: [0, 0, 1], f: 'side', sh: .8 }];
const unrot = (x, z, f) => { for (let i = 0; i < f; i++) [x, z] = [z, 16 - x]; return [x, z]; };
export function addModel(buf, B, x, y, z, uv, sky, tl, get, boxes = B.boxes) {
  for (const b of boxes) { const [x0, y0, z0, x1, y1, z1] = b;
    for (const F of BOX_FACES) {
      const ax = F.n[0] ? 0 : F.n[1] ? 1 : 2, hi = F.n[ax] > 0, edge = hi ? b[ax + 3] === 16 : b[ax] === 0;
      if (get && edge) { const nb = get(x + F.n[0], y + F.n[1], z + F.n[2]); if (isOpaque(nb)) continue; }
      if (B.climb && ax === 1) continue;
      const t = uv[faceTex(B.id, F.f)] || uv.stone, du = t[2] - t[0], dv = t[3] - t[1];
      // 4 corners of this face in 1/16ths
      const c = ax === 0 ? [[hi ? x1 : x0, y0, z0], [hi ? x1 : x0, y0, z1], [hi ? x1 : x0, y1, z0], [hi ? x1 : x0, y1, z1]]
        : ax === 1 ? [[x0, hi ? y1 : y0, z0], [x1, hi ? y1 : y0, z0], [x0, hi ? y1 : y0, z1], [x1, hi ? y1 : y0, z1]]
        : [[x0, y0, hi ? z1 : z0], [x1, y0, hi ? z1 : z0], [x0, y1, hi ? z1 : z0], [x1, y1, hi ? z1 : z0]];
      const base = buf.pos.length / 3;
      for (const p of c) { let u, v;
        if (ax === 1) { const [cx, cz] = unrot(p[0], p[2], B.f || 0); u = cx / 16; v = 1 - cz / 16; }
        else { u = (ax === 0 ? p[2] : p[0]) / 16; if ((ax === 0 && !hi) || (ax === 2 && hi)) u = u; else u = 1 - u; v = p[1] / 16; }
        buf.pos.push(x + p[0] / 16, y + p[1] / 16, z + p[2] / 16); buf.uv.push(t[0] + du * u, t[1] + dv * v); buf.col.push(F.sh * sky, F.sh * tl, 0); }
      // winding: front face must be counter-clockwise seen from outside
      const flip = (ax === 0 && !hi) || (ax === 1 && !hi) || (ax === 2 && hi);
      if (flip) buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3); else buf.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    } } }
