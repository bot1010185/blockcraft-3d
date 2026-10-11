// Lighting (Timmy): Minecraft-style sky light + block light for the chunk mesher, and smooth (per-vertex) lighting.
// For each remesh we copy the chunk plus a 15-block margin into a small volume, run two BFS flood fills
// (sky light falls straight down at 15 and spreads sideways losing 1 per block; torches and other blocks
// with a `light` value spread the same way), then the mesher reads per-corner averages from it.
// The chunk's own light is kept in ch.light (sky << 4 | block) so mobs, drops and getLight() match what you see.
import { BLOCKS } from './blocks.js';

const CS = 16, CH = 128, M = 15, RW = CS + 2 * M, AREA = RW * RW, VOL = AREA * CH;
// how much light a block eats. Full cubes stop it, leaves and water dim it by 1 extra per block, slabs/stairs by 1.
const OP = new Uint8Array(256), LUM = new Uint8Array(256);
for (const B of BLOCKS) { const k = B.kind;
  OP[B.id] = k === 'solid' ? 15 : k === 'water' ? 1 : (k === 'cutout' && B.name !== 'glass') ? 1 : (B.slab || B.stairs) ? 1 : 0;
  LUM[B.id] = B.light | 0; }
const vb = new Uint8Array(VOL), vs = new Uint8Array(VOL), vl = new Uint8Array(VOL), top = new Int16Array(AREA);
const q = new Int32Array(1 << 20); // ring buffer for the flood fills
// sky light (0-15) -> brightness. Between Minecraft's f/(4-3f) and linear so caves are dark but overhangs aren't black.
export const SKY_CURVE = new Float32Array(16).map((_, l) => { const f = l / 15; return f / (3 - 2 * f); });
const SKYB = SKY_CURVE, BLKB = new Float32Array(16).map((_, l) => Math.max(0, (l - 1) / 13));

function flood(lv, head, tail) { // BFS over the queue, decay 1 + opacity per step, never leaves the volume
  const mask = q.length - 1;
  while (head !== tail) { const i = q[head]; head = (head + 1) & mask; const L = lv[i]; if (L <= 1) continue;
    const x = i % RW, z = ((i / RW) | 0) % RW, y = (i / AREA) | 0;
    for (let k = 0; k < 6; k++) { let n;
      if (k === 0) { if (x === 0) continue; n = i - 1; } else if (k === 1) { if (x === RW - 1) continue; n = i + 1; }
      else if (k === 2) { if (z === 0) continue; n = i - RW; } else if (k === 3) { if (z === RW - 1) continue; n = i + RW; }
      else if (k === 4) { if (y === 0) continue; n = i - AREA; } else { if (y === CH - 1) continue; n = i + AREA; }
      const op = OP[vb[n]]; if (op >= 15) continue; const nl = L - 1 - op;
      if (nl > lv[n]) { lv[n] = nl; q[tail] = n; tail = (tail + 1) & mask; if (tail === head) return; } } }
}

// Build the light volume for chunk ch. Returns an accessor object used by world.js buildChunkMesh.
export function lightChunk(world, ch) {
  const ox = ch.cx * CS - M, oz = ch.cz * CS - M;
  // 1. copy blocks (one chunk lookup per column) + find light emitters
  let ql = 0; const seeds = [];
  for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
    const wx = ox + x, wz = oz + z, cx = Math.floor(wx / CS), cz = Math.floor(wz / CS), c = world.chunks.get(cx + ',' + cz), col = z * RW + x;
    if (!c) { for (let y = 0; y < CH; y++) vb[y * AREA + col] = 0; continue; }
    const b = c.b, li = (wz - cz * CS) * CS + (wx - cx * CS);
    for (let y = 0; y < CH; y++) { const id = b[y * CS * CS + li]; vb[y * AREA + col] = id; if (LUM[id]) seeds.push(y * AREA + col); } }
  // 2. sky: straight down from the top, then spread sideways
  vs.fill(0); vl.fill(0);
  for (let col = 0; col < AREA; col++) { let L = 15, t = -1;
    for (let y = CH - 1; y >= 0; y--) { const i = y * AREA + col, op = OP[vb[i]]; if (op) { if (t < 0) t = y; L = op >= 15 ? 0 : Math.max(0, L - op); if (!L) break; } vs[i] = L; }
    top[col] = t; }
  const mask = q.length - 1; let tail = 0;
  const push = i => { q[tail] = i; tail = (tail + 1) & mask; };
  for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) { const col = z * RW + x, t = top[col]; if (t < 0) continue;
    let hi = t; if (x > 0) hi = Math.max(hi, top[col - 1]); if (x < RW - 1) hi = Math.max(hi, top[col + 1]); if (z > 0) hi = Math.max(hi, top[col - RW]); if (z < RW - 1) hi = Math.max(hi, top[col + RW]);
    for (let y = t + 1; y <= hi + 1 && y < CH; y++) push(y * AREA + col); // open air next to a taller neighbour column
    for (let y = t; y >= 0; y--) { const i = y * AREA + col; if (!vs[i]) break; push(i); } } // light under leaves / in water
  flood(vs, 0, tail);
  // 3. block light (torches etc.)
  tail = 0; for (const i of seeds) { vl[i] = LUM[vb[i]]; push(i); } flood(vl, 0, tail);
  // 4. keep the chunk's own light for gameplay queries (mobs, drops)
  const own = ch.light || (ch.light = new Uint8Array(CS * CS * CH));
  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) { const s = y * AREA + (z + M) * RW + M, d = (y * CS + z) * CS; for (let x = 0; x < CS; x++) own[d + x] = (vs[s + x] << 4) | vl[s + x]; }
  const inside = (x, y, z) => x >= 0 && z >= 0 && x < RW && z < RW && y >= 0 && y < CH;
  const out = [0, 0];
  return {
    // fast block lookup for the mesher (falls back to world.get outside the volume)
    get: (x, y, z) => { const lx = x - ox, lz = z - oz; if (y < 0 || y >= CH || lx < 0 || lz < 0 || lx >= RW || lz >= RW) return world.get(x, y, z); return vb[(y * RW + lz) * RW + lx]; },
    // flat light of one cell -> [sky brightness, torch brightness]
    at(x, y, z) { const lx = x - ox, lz = z - oz; if (y >= CH) { out[0] = 1; out[1] = 0; return out; } if (!inside(lx, y, lz)) { out[0] = 1; out[1] = 0; return out; }
      const i = (y * RW + lz) * RW + lx; out[0] = SKYB[vs[i]]; out[1] = BLKB[vl[i]]; return out; },
    // smooth light for one face corner: average of the 4 cells touching the corner on the face's open side.
    // (px,py,pz) is the open cell in front of the face, a/b are the two in-plane axes (0..2) and sa/sb their signs.
    corner(px, py, pz, a, sa, b, sb) { const x0 = px - ox, z0 = pz - oz; let S = 0, T = 0, n = 0, s1 = false, s2 = false;
      for (let k = 0; k < 4; k++) { let x = x0, y = py, z = z0;
        if (k & 1) { if (a === 0) x += sa; else if (a === 1) y += sa; else z += sa; }
        if (k & 2) { if (b === 0) x += sb; else if (b === 1) y += sb; else z += sb; }
        let ls = 15, lt = 0, opq = false;
        if (y < CH && inside(x, y, z)) { const i = (y * RW + z) * RW + x; opq = OP[vb[i]] >= 15; ls = vs[i]; lt = vl[i]; }
        if (k === 1) s1 = opq; else if (k === 2) s2 = opq;
        if (opq || (k === 3 && s1 && s2)) continue; S += ls; T += lt; n++; }
      if (!n) { out[0] = 0; out[1] = 0; return out; }
      // interpolate brightness between levels so the average stays smooth
      const fs = S / n, ft = T / n, is = fs | 0, it = ft | 0;
      out[0] = SKYB[is] + (SKYB[Math.min(15, is + 1)] - SKYB[is]) * (fs - is); out[1] = BLKB[it] + (BLKB[Math.min(15, it + 1)] - BLKB[it]) * (ft - it); return out; },
  };
}

// Light level at a world block (packed sky << 4 | block), or -1 if that chunk hasn't been lit yet.
export function lightAt(world, x, y, z) { if (y >= CH) return 240; if (y < 0) return 0;
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = world.chunks.get(cx + ',' + cz); if (!ch || !ch.light) return -1;
  return ch.light[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)]; }
