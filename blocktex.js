// Engine atlas (Mike). Trish's textures.js is the source of truth for every texture it defines;
// the painters below only fill in textures she hasn't drawn yet (birch, snow, cactus, furnace, items, tools...).
import { mulberry32, strHash } from './noise.js';
import { buildAtlas as trishAtlas } from './textures.js';
export const T = 16;
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (c, k) => [clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k), c[3] ?? 255];
const pick = (rnd, arr) => arr[(rnd() * arr.length) | 0];

function speckle(px, rnd, palette, weights) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let r = rnd(), i = 0; while (i < weights.length - 1 && r > weights[i]) { r -= weights[i]; i++; } px(x, y, palette[i]); }
}
const STONE = ['#7d7d7d', '#747474', '#868686', '#6a6a6a', '#8f8f8f'].map(hex);
const stone = (px, rnd) => {
  speckle(px, rnd, STONE, [.38, .25, .2, .1, .07]);
  for (let i = 0; i < 7; i++) { const x = rnd() * 15 | 0, y = rnd() * 16 | 0, l = 1 + (rnd() * 3 | 0); for (let k = 0; k < l; k++) px((x + k) % 16, y, hex('#5f5f5f')); }
};
const DIRT = ['#866043', '#79553a', '#96704d', '#5f4129', '#a07a55'].map(hex);
const dirt = (px, rnd) => speckle(px, rnd, DIRT, [.4, .25, .17, .1, .08]);
const GRASS = ['#6aa43a', '#5d9632', '#79b347', '#4e8429', '#86bf52'].map(hex);
const grassTop = (px, rnd) => speckle(px, rnd, GRASS, [.35, .25, .2, .12, .08]);
function grassSide(px, rnd, top = GRASS, w = [.35, .3, .2, .15]) {
  dirt(px, rnd);
  for (let x = 0; x < T; x++) { const d = 2 + (rnd() * 3 | 0) + (rnd() < .2 ? 1 : 0); for (let y = 0; y < d; y++) { let r = rnd(), i = 0; while (i < w.length - 1 && r > w[i]) { r -= w[i]; i++; } px(x, y, top[i]); } }
}
function ore(color) {
  const c = hex(color);
  return (px, rnd) => { stone(px, rnd);
    for (let k = 0; k < 4; k++) { const cx = 2 + rnd() * 11 | 0, cy = 2 + rnd() * 11 | 0;
      for (let i = 0; i < 4 + (rnd() * 3 | 0); i++) { const x = cx + (rnd() * 3 | 0) - 1, y = cy + (rnd() * 3 | 0) - 1; px(x, y, shade(c, .8 + rnd() * .4)); px(x + 1, y + 1, shade(c, .5)); }
      px(cx, cy, shade(c, 1.35)); } };
}
const PLANK = ['#a2834f', '#9c7c4a', '#b08f5a', '#8f7044'].map(hex);
const planks = (px, rnd) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(pick(rnd, PLANK), .97 + rnd() * .06));
  for (let b = 0; b < 4; b++) { const yb = b * 4 + 3; for (let x = 0; x < T; x++) px(x, yb, hex('#6b5232'));
    const seam = (b % 2 ? 4 : 11) + (rnd() * 2 | 0); for (let y = b * 4; y < yb; y++) px(seam, y, hex('#7a5f3a'));
    for (let i = 0; i < 3; i++) { const gx = rnd() * 16 | 0, gy = b * 4 + (rnd() * 3 | 0); px(gx, gy, hex('#8a6c41')); px((gx + 1) % 16, gy, hex('#8a6c41')); } }
};
const logSide = (base, dark, light) => (px, rnd) => {
  const B = hex(base), D = hex(dark), L = hex(light);
  for (let x = 0; x < T; x++) { const col = rnd() < .35 ? D : rnd() < .2 ? L : B; for (let y = 0; y < T; y++) px(x, y, shade(rnd() < .15 ? D : col, .92 + rnd() * .14)); }
};
const birchSide = (px, rnd) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex('#d8d7d2'), .9 + rnd() * .12));
  for (let i = 0; i < 9; i++) { const y = rnd() * 16 | 0, x = rnd() * 13 | 0, l = 2 + (rnd() * 4 | 0); for (let k = 0; k < l; k++) px(x + k, y, hex('#2b2b28')); if (rnd() < .5) px(x + 1, y + 1, hex('#4a4a44')); }
};
const logTop = (ring, ringDark, bark) => (px, rnd) => {
  const R = hex(ring), D = hex(ringDark), K = hex(bark);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const e = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (e > 6.6) px(x, y, shade(K, .85 + rnd() * .25));
    else px(x, y, shade((Math.round(e) % 2 === 0) ? D : R, .94 + rnd() * .1));
  }
};
function leaves(cols) { const C = cols.map(hex);
  return (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { if (rnd() < .18) px(x, y, [0, 0, 0, 0]); else px(x, y, shade(pick(rnd, C), .85 + rnd() * .3)); } };
}
const SAND = ['#dbd3a0', '#d4cb94', '#e3dbad', '#cbc189'].map(hex);
const sand = (px, rnd) => speckle(px, rnd, SAND, [.4, .3, .2, .1]);
const gravel = (px, rnd) => {
  speckle(px, rnd, ['#857f7b', '#6f6a66', '#9a938e', '#5c5653'].map(hex), [.35, .3, .2, .15]);
  for (let i = 0; i < 10; i++) { const x = rnd() * 15 | 0, y = rnd() * 15 | 0, c = pick(rnd, ['#a39b95', '#7b6e66', '#4d4846'].map(hex)); px(x, y, c); px(x + 1, y, c); px(x, y + 1, shade(c, .8)); }
};
const cobble = (px, rnd) => {
  const pts = []; for (let i = 0; i < 9; i++) pts.push([rnd() * 16, rnd() * 16, .8 + rnd() * .4]);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let a = 1e9, b = 1e9, ai = 0;
    for (let i = 0; i < pts.length; i++) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) { const d = Math.hypot(x - pts[i][0] - ox, y - pts[i][1] - oy); if (d < a) { b = a; a = d; ai = i; } else if (d < b) b = d; }
    if (b - a < 1.2) px(x, y, shade(hex('#4d4d4d'), .9 + rnd() * .2));
    else { const base = shade(hex('#7c7c7c'), pts[ai][2]); px(x, y, shade(base, (a < 2 ? 1.12 : 1) * (.92 + rnd() * .14))); }
  }
};
const bedrock = (px, rnd) => speckle(px, rnd, ['#565656', '#2e2e2e', '#7a7a7a', '#141414'].map(hex), [.35, .3, .2, .15]);
const water = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const w = Math.sin((x + y * .6) * .9) * .5 + .5; px(x, y, [clamp(44 + w * 30), clamp(92 + w * 40), clamp(196 + w * 30), 255]); } };
const glass = (px) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
  const edge = x === 0 || y === 0 || x === 15 || y === 15; const streak = (x - y === 4 || x - y === 5 || x - y === -7) && x > 1 && x < 14 && y > 1 && y < 14;
  px(x, y, edge ? [218, 240, 244, 255] : streak ? [235, 250, 252, 200] : [0, 0, 0, 0]); } };
const ctTop = (px, rnd) => { planks(px, rnd); for (let i = 0; i < 16; i++) { px(i, 0, hex('#5a4128')); px(i, 15, hex('#5a4128')); px(0, i, hex('#5a4128')); px(15, i, hex('#5a4128')); }
  for (let i = 2; i < 14; i++) { px(i, 5, hex('#6b4e2e')); px(i, 10, hex('#6b4e2e')); px(5, i, hex('#6b4e2e')); px(10, i, hex('#6b4e2e')); } };
const ctSide = (front) => (px, rnd) => { planks(px, rnd); for (let x = 0; x < 16; x++) { px(x, 0, hex('#5a4128')); px(x, 1, hex('#7a5a36')); px(x, 2, hex('#5a4128')); }
  const M = hex('#9e9e9e'), H = hex('#6b4e2e');
  if (front) { for (let y = 5; y < 13; y++) px(4, y, H); for (let x = 2; x < 7; x++) px(x, 5, M); px(2, 6, M); px(6, 6, M);  // hammer
    for (let i = 0; i < 7; i++) px(9 + (i >> 1), 6 + i, M); for (let y = 12; y < 15; y++) px(12, y, H); } // saw
  else { for (let y = 5; y < 14; y++) px(7, y, H); for (let x = 5; x < 11; x++) px(x, 5, M); px(5, 6, M); px(10, 6, M); } };
const sandstoneSide = (px, rnd) => { sand(px, rnd); for (let x = 0; x < 16; x++) { px(x, 3, hex('#c7bd85')); px(x, 11, hex('#c7bd85')); px(x, 12, hex('#bdb27a')); } };
const SNOW = ['#f4fbfb', '#e8f3f4', '#ffffff', '#dbe9ea'].map(hex);
const snow = (px, rnd) => speckle(px, rnd, SNOW, [.4, .3, .2, .1]);
const cactusSide = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const stripe = x % 4 === 1; px(x, y, x === 0 || x === 15 ? [0, 0, 0, 0] : shade(hex(stripe ? '#0e6b1d' : '#13861f'), .9 + rnd() * .2)); }
  for (let i = 0; i < 8; i++) px(2 + (rnd() * 12 | 0), rnd() * 16 | 0, hex('#d9d7a3')); };
const cactusTop = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const e = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); px(x, y, e > 6.6 ? [0, 0, 0, 0] : shade(hex(e > 5 ? '#0e6b1d' : '#3d9d3a'), .9 + rnd() * .2)); } };
const bricks = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
  const row = y >> 2, off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7;
  px(x, y, mortar ? shade(hex('#b4aca0'), .9 + rnd() * .15) : shade(pick(rnd, ['#965343', '#8a4a3b', '#a35d4c'].map(hex)), .9 + rnd() * .15)); } };
const stoneBricks = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
  const row = y >> 3, off = row % 2 ? 4 : 0, mortar = y % 8 === 7 || (x + off) % 8 === 7, hi = y % 8 === 0 || (x + off) % 8 === 0;
  px(x, y, mortar ? hex('#4f4f4f') : shade(hex('#7b7b7b'), (hi ? 1.12 : 1) * (.9 + rnd() * .15))); } };
const torch = (px) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, [0, 0, 0, 0]);
  for (let y = 6; y < 16; y++) { px(7, y, hex('#6b4e2e')); px(8, y, hex('#856139')); }
  px(7, 5, hex('#ffd84a')); px(8, 5, hex('#fff2a8')); px(7, 6, hex('#ff9a1f')); px(8, 6, hex('#ffd84a')); px(7, 4, hex('#ff9a1f')); };
// item icons (2D)
const item = (rows, pal) => (px) => rows.forEach((r, y) => [...r].forEach((ch, x) => px(x, y, ch === '.' ? [0, 0, 0, 0] : hex(pal[ch]))));
const coal = item(['................', '................', '.....KKKK.......', '....KKGKKKK.....', '...KKKKKKGKK....', '...KGKKKKKKK....', '..KKKKKKGKKKK...', '..KKKGKKKKKKK...', '..KKKKKKKKGKK...', '...KKGKKKKKK....', '...KKKKKKKK.....', '....KKKGKK......', '......KKK.......', '................', '................', '................'], { K: '#222222', G: '#555555' });
const gem = (a, b, c) => item(['................', '................', '.....AAAAAA.....', '....ABBAAAAA....', '...ABAAAAAAAA...', '..AAAAAAAAAACA..', '..AAAAAAAAACCA..', '...AAAAAAACCA...', '....AAAAACCA....', '.....AAACCA.....', '......ACCA......', '.......AA.......', '................', '................', '................', '................'], { A: a, B: b, C: c });
const raw = (a, b, c) => item(['................', '................', '................', '.....AAA........', '....ABBAAA......', '...ABAAAAAAA....', '...AAAACAAAAA...', '..AAACCAAAACA...', '..AAAAAAAACCA...', '...AACAAACCA....', '....AAAAAAA.....', '......AAA.......', '................', '................', '................', '................'], { A: a, B: b, C: c });
const stick = item(['................', '................', '............LS..', '...........LS...', '..........LS....', '.........LS.....', '........LS......', '.......LS.......', '......LS........', '.....LS.........', '....LS..........', '...LS...........', '..LS............', '................', '................', '................'], { L: '#9b7742', S: '#5a3f1e' });

export const PAINTERS = {
  stone, dirt, grass_top: grassTop, grass_side: (p, r) => grassSide(p, r), grass_side_snowy: (p, r) => grassSide(p, r, SNOW),
  cobblestone: cobble, bedrock, sand, gravel, oak_planks: planks,
  oak_log: logSide('#6b5232', '#4f3c23', '#7c6240'), oak_log_top: logTop('#b4925a', '#9c7c48', '#5e4729'),
  birch_log: birchSide, birch_log_top: logTop('#d6c08a', '#bba56f', '#dcdad3'),
  oak_leaves: leaves(['#3b7a1f', '#2f6618', '#4a8c2a', '#26571a']), birch_leaves: leaves(['#5f9a3c', '#527f34', '#6fab49', '#46733a']),
  coal_ore: ore('#1e1e1e'), iron_ore: ore('#d8af93'), gold_ore: ore('#fce33e'), diamond_ore: ore('#5decf5'),
  water, glass, crafting_table_top: ctTop, crafting_table_side: ctSide(false), crafting_table_front: ctSide(true),
  sandstone: sandstoneSide, sandstone_top: sand, snow, cactus_side: cactusSide, cactus_top: cactusTop,
  bricks, stone_bricks: stoneBricks, torch,
  coal, diamond: gem('#4ee1e6', '#dffcff', '#1a9aa0'), raw_iron: raw('#d8af93', '#f1d5bf', '#8a6a55'), raw_gold: raw('#fce33e', '#fff6a8', '#c99a00'), stick,
};

// Builds a square padded atlas (1px gutter per tile so nearest sampling never bleeds).
export function buildAtlas() {
  const over = {}; try { const t = trishAtlas(), g = t.canvas.getContext('2d');
    for (const n of t.names) { const [u0, v0, u1, v1] = t.uv(n), x = Math.round(u0 * t.size - .5), y = Math.round((1 - v1) * t.size - .5); over[n] = g.getImageData(x, y, T, T).data; } } catch (e) { console.warn('textures.js failed, using fallback art', e); }
  const names = [...new Set([...Object.keys(over), ...Object.keys(PAINTERS)])], P = T + 2, cols = Math.ceil(Math.sqrt(names.length)), size = cols * P;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), uvs = {}, tiles = {};
  names.forEach((n, i) => {
    let tile = over[n];
    if (!tile) { tile = new Uint8ClampedArray(T * T * 4); const rnd = mulberry32(strHash(n));
      PAINTERS[n]((x, y, c) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const o = (y * T + x) * 4; tile[o] = c[0]; tile[o + 1] = c[1]; tile[o + 2] = c[2]; tile[o + 3] = c[3] ?? 255; }, rnd); }
    tiles[n] = tile;
    const ox = (i % cols) * P, oy = ((i / cols) | 0) * P;
    for (let y = -1; y <= T; y++) for (let x = -1; x <= T; x++) { const sx = Math.min(T - 1, Math.max(0, x)), sy = Math.min(T - 1, Math.max(0, y)), s2 = (sy * T + sx) * 4, d = ((oy + 1 + y) * size + ox + 1 + x) * 4;
      img.data[d] = tile[s2]; img.data[d + 1] = tile[s2 + 1]; img.data[d + 2] = tile[s2 + 2]; img.data[d + 3] = tile[s2 + 3]; }
    uvs[n] = [(ox + 1) / size, 1 - (oy + 1 + T) / size, (ox + 1 + T) / size, 1 - (oy + 1) / size];
  });
  g.putImageData(img, 0, 0);
  const uv = n => uvs[n] || uvs.stone; Object.assign(uv, uvs); // works as uv(name) for the UI and uv[name] for the mesher
  return { canvas: cv, size, cols, names, uv, tiles };
}
// Small canvas of one texture, for icons.
export function tileCanvas(tiles, name, scale = 1) { const c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d'), im = g.createImageData(T, T); im.data.set(tiles[name]); g.putImageData(im, 0, 0); return c; }

// Tool icons: material colors -> pickaxe / axe / shovel / sword sprites.
const MAT = { wooden: ['#a0794a', '#6b4e2e', '#c49a62'], stone: ['#8a8a8a', '#555555', '#b0b0b0'], iron: ['#d8d8d8', '#8f8f8f', '#ffffff'], golden: ['#f5d742', '#b8901a', '#fff59a'], diamond: ['#4ee1e6', '#1a9aa0', '#c8fdff'] };
const SHAPES = {
  pickaxe: ['................', '...HHHHHHH......', '..HLLLLLLLH.....', '..H.DDDDSHLH....', '........SHDH....', '.......S..HD....', '......S...HD....', '.....S.....D....', '....S...........', '...S............', '..S.............', '.S..............', '................', '................', '................', '................'],
  axe: ['................', '......HHH.......', '.....HLLLH......', '.....HLLLDH.....', '......HLSDH.....', '.......SHD......', '......S.........', '.....S..........', '....S...........', '...S............', '..S.............', '.S..............', '................', '................', '................', '................'],
  shovel: ['................', '..........HHH...', '.........HLLDH..', '.........HLLDH..', '..........HDH...', '.........S......', '........S.......', '.......S........', '......S.........', '.....S..........', '....S...........', '...S............', '..S.............', '................', '................', '................'],
  sword: ['................', '.............HH.', '............HLH.', '...........HLDH.', '..........HLDH..', '.........HLDH...', '........HLDH....', '...G...HLDH.....', '....G.HLDH......', '.....GLDH.......', '.....SG.........', '....S..G........', '...S............', '..S.............', '................', '................'],
};
for (const m in MAT) for (const s in SHAPES) PAINTERS[`${m}_${s}`] = item(SHAPES[s], { H: MAT[m][1], L: MAT[m][2], D: MAT[m][0], S: '#6b4e2e', G: '#3d2a15' });
const ingot = (a, b, c) => item(['................', '................', '................', '................', '.......BBBBBB...', '.....BBAAAAAAC..', '...BBAAAAAAACC..', '..BAAAAAAAACC...', '..AAAAAAAACC....', '..CAAAAAACC.....', '...CCCCCCC......', '................', '................', '................', '................', '................'], { A: a, B: b, C: c });
PAINTERS.iron_ingot = ingot('#d8d8d8', '#ffffff', '#8f8f8f');
PAINTERS.gold_ingot = ingot('#f5d742', '#fff59a', '#b8901a');
PAINTERS.apple = item(['................', '.......S........', '.......SL.......', '....RRRSRRR.....', '...RWRRRRRRR....', '..RWRRRRRRRRR...', '..RRRRRRRRRRR...', '..RRRRRRRRRRR...', '..RRRRRRRRRRD...', '...RRRRRRRRD....', '....RRRRRRD.....', '.....RRDDD......', '................', '................', '................', '................'], { S: '#5a3f1e', L: '#3fa040', R: '#d8262e', W: '#ff9c9c', D: '#8e1218' });

// furnace, chest, storage blocks, wool
const furnaceSide = (px, rnd) => cobble(px, rnd);
const furnaceTop = (px, rnd) => { stone(px, rnd); for (let i = 0; i < 16; i++) { px(i, 0, hex('#555555')); px(i, 15, hex('#555555')); px(0, i, hex('#555555')); px(15, i, hex('#555555')); } };
const furnaceFront = (px, rnd) => { cobble(px, rnd); for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, y > 11 ? hex('#2a2a2a') : hex('#111111')); for (let x = 3; x < 13; x++) { px(x, 7, hex('#5c5c5c')); px(x, 14, hex('#5c5c5c')); } for (let x = 4; x < 12; x++) px(x, 3, hex('#3a3a3a')); };
const chestBase = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(pick(rnd, ['#a8732e', '#9a6828', '#b57d34'].map(hex)), .92 + rnd() * .12));
  for (let i = 0; i < 16; i++) { px(i, 0, hex('#3d2a12')); px(i, 15, hex('#3d2a12')); px(0, i, hex('#3d2a12')); px(15, i, hex('#3d2a12')); } };
const chestSide = (px, rnd) => { chestBase(px, rnd); for (let x = 0; x < 16; x++) px(x, 5, hex('#3d2a12')); };
const chestFront = (px, rnd) => { chestSide(px, rnd); for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) px(x, y, hex('#c7c7c7')); px(7, 7, hex('#7a7a7a')); };
const storage = (c1, c2, c3) => (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15; px(x, y, shade(hex(e ? c3 : (x + y) % 7 === 0 ? c2 : c1), .95 + rnd() * .08)); } };
const wool = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex('#e9ecec'), ((x * 3 + y * 5) % 4 === 0 ? .88 : 1) * (.94 + rnd() * .08))); };
Object.assign(PAINTERS, { furnace_side: furnaceSide, furnace_top: furnaceTop, furnace_front: furnaceFront, chest_top: chestBase, chest_side: chestSide, chest_front: chestFront,
  white_wool: wool, iron_block: storage('#dcdcdc', '#c4c4c4', '#a0a0a0'), gold_block: storage('#f9d849', '#ffef8a', '#d6a92a'), diamond_block: storage('#61e2dc', '#a6fff9', '#2aa59f'), coal_block: storage('#1d1d1d', '#2e2e2e', '#0e0e0e') });

// farming + colored wool placeholders (Trish, replace these in textures.js and they'll win automatically)
const woolOf = c => (px, rnd) => { const C = hex(c); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(C, ((x * 3 + y * 5) % 4 === 0 ? .86 : 1) * (.93 + rnd() * .1))); };
const farmland = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex(y % 4 === 0 ? '#3e2716' : '#5a3a22'), .9 + rnd() * .15)); };
const haySide = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex(x % 3 === 0 ? '#a88a1e' : '#c9a72c'), .9 + rnd() * .15)); for (const yy of [3, 12]) for (let x = 0; x < T; x++) { px(x, yy, hex('#7a3d16')); px(x, yy + 1, hex('#5e2e10')); } };
const hayTop = (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex(rnd() < .4 ? '#a88a1e' : '#d0ae35'), .9 + rnd() * .15)); };
const crop = (stage, max, ripe) => (px, rnd) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, [0, 0, 0, 0]);
  const h = 3 + Math.round(stage / max * 12), done = stage === max;
  for (const sx of [2, 5, 8, 11, 13]) { const hh = Math.max(2, h - ((sx * 7) % 3)); for (let k = 0; k < hh; k++) px(sx + ((k > hh - 4 && done && ripe) ? (k % 2) : 0), 15 - k, hex(done && ripe && k > hh - 5 ? ripe : k % 3 ? '#4f9a2a' : '#3b7d1f')); } };
const carrots = (stage) => (px, rnd) => { crop(stage, 3)(px, rnd); if (stage === 3) for (const sx of [3, 9]) { px(sx, 14, hex('#f08a1c')); px(sx + 1, 14, hex('#e0700f')); px(sx, 15, hex('#f08a1c')); } };
Object.assign(PAINTERS, { black_wool: woolOf('#1d1d21'), brown_wool: woolOf('#734a2b'), gray_wool: woolOf('#3f4448'), light_gray_wool: woolOf('#8e8e87'), pink_wool: woolOf('#ec9bb5'),
  farmland, hay_block_side: haySide, hay_block_top: hayTop });
for (let i = 0; i < 8; i++) PAINTERS['wheat_stage' + i] = crop(i, 7, '#d6b43a');
for (let i = 0; i < 4; i++) PAINTERS['carrots_stage' + i] = carrots(i);

// ---------- round 3 (Mike): ladder, door, bed, plants, bow, arrow. Placeholders until Trish draws them in textures.js ----------
const clear = px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, [0, 0, 0, 0]); };
const ladder = (px, rnd) => { clear(px); const R = ['#7a5a32', '#6b4e2b', '#86663a'].map(hex), D = hex('#4a3419');
  for (let y = 0; y < T; y++) for (const x of [2, 3, 12, 13]) px(x, y, shade(x === 3 || x === 13 ? R[1] : pick(rnd, R), .95 + rnd() * .1));
  for (const y of [1, 5, 9, 13]) for (let x = 4; x < 12; x++) { px(x, y, shade(pick(rnd, R), 1.05)); px(x, y + 1, shade(D, 1)); } };
const doorBase = (px, rnd, top) => { const P = PLANK.map(c => shade(c, .9)), F = hex('#5c4426');
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(pick(rnd, P), .94 + rnd() * .1));
  for (let i = 0; i < T; i++) { px(0, i, F); px(15, i, F); px(i, top ? 0 : 15, F); }
  for (let x = 1; x < 15; x++) px(x, top ? 15 : 0, hex('#6b5232'));
  for (let y = 1; y < 15; y++) for (const x of [5, 10]) px(x, y, hex('#7a5f3a')); // plank seams
  if (top) { for (const [x0, y0] of [[2, 2], [9, 2]]) for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 5; x++) px(x, y, (x === x0 || y === y0) ? hex('#4a3a22') : [0, 0, 0, 0]); } // two windows
  else { px(12, 1, hex('#3a3a3a')); px(12, 2, hex('#9a9a9a')); px(13, 2, hex('#6a6a6a')); } };
const bedTop = head => (px, rnd) => { // red blanket, white pillow at the head end (north = top of the texture)
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(hex((x + y * 3) % 5 ? '#b02e26' : '#9a2620'), .95 + rnd() * .08));
  for (let x = 0; x < T; x++) { px(x, head ? 0 : 15, hex('#7a1e18')); }
  if (head) { for (let y = 1; y < 6; y++) for (let x = 2; x < 14; x++) px(x, y, shade(hex(y === 5 || x === 2 || x === 13 ? '#d0d0d0' : '#f2f2f2'), .97 + rnd() * .05)); for (let x = 0; x < T; x++) px(x, 6, hex('#e6e6e6')); } };
const bedSide = head => (px, rnd) => { clear(px); // texture rows 7..12 = the mattress (box y 3..9), rows 13..15 = legs
  for (let r = 7; r < 13; r++) for (let x = 0; x < T; x++) px(x, r, r < 10 ? shade(hex(head && r < 9 ? '#f2f2f2' : '#b02e26'), .95 + rnd() * .08) : shade(pick(rnd, PLANK), r === 12 ? .75 : .9));
  for (let r = 13; r < 16; r++) for (let x = 0; x < T; x++) px(x, r, shade(PLANK[3], .7 + rnd() * .1)); };
const sapling = (leaf, trunk) => (px, rnd) => { clear(px); const L = leaf.map(hex);
  for (let y = 10; y < 16; y++) px(7 + (y % 3 === 0 ? 1 : 0), y, hex(trunk));
  for (const [cx, cy, r] of [[7, 5, 3.6], [4, 8, 2.4], [11, 8, 2.4], [8, 2, 2]]) for (let y = 0; y < 13; y++) for (let x = 0; x < T; x++) { const d = Math.hypot(x - cx, y - cy); if (d < r && rnd() < .85) px(x, y, shade(pick(rnd, L), .85 + rnd() * .3)); } };
const shortGrass = (px, rnd) => { clear(px); const G = ['#5d9632', '#6aa43a', '#4e8429', '#79b347'].map(hex);
  for (let b = 0; b < 9; b++) { let x = 1 + rnd() * 14; const h = 6 + rnd() * 9 | 0, lean = (rnd() - .5) * .5; for (let k = 0; k < h; k++) { px(x | 0, 15 - k, shade(pick(rnd, G), .8 + k / h * .4)); x += lean; } } };
const flower = (petal, center, dark) => (px, rnd) => { clear(px); for (let y = 8; y < 16; y++) px(7, y, hex(y % 3 ? '#3f7d22' : '#4f9a2a')); px(8, 12, hex('#4f9a2a')); px(9, 11, hex('#4f9a2a')); px(6, 13, hex('#3f7d22'));
  const P = hex(petal), D = hex(dark); for (const [x, y] of [[6, 4], [7, 4], [8, 4], [5, 5], [6, 5], [8, 5], [9, 5], [5, 6], [9, 6], [6, 7], [7, 7], [8, 7], [6, 6], [8, 6]]) px(x, y, (x + y) % 3 ? P : D);
  px(7, 3, P); px(7, 5, hex(center)); px(7, 6, hex(center)); };
const bow = item(['................', '..........SSS...', '........SS..W...', '.......S....W...', '......S....W....', '.....S....W.....', '....S....W......', '...S....W.......', '...S...W........', '..S...W.........', '..S..W..........', '..S.W...........', '..SW............', '..W.............', '................', '................'], { S: '#7a5a32', W: '#e8e8e8' });
const arrow = item(['................', '...........HH...', '..........HHH...', '..........HHH...', '.........S.H....', '........S.......', '.......S........', '......S.........', '.....S..........', '....S...........', '..FS............', '.FF.............', 'FF..F...........', '.F.F............', '..F.............', '................'], { H: '#c9c9c9', S: '#7a5a32', F: '#f0f0f0' });
Object.assign(PAINTERS, { ladder, oak_door_bottom: (p, r) => doorBase(p, r, false), oak_door_top: (p, r) => doorBase(p, r, true),
  bed_head_top: bedTop(true), bed_foot_top: bedTop(false), bed_head_side: bedSide(true), bed_foot_side: bedSide(false),
  oak_sapling: sapling(['#3b7a1f', '#2f6618', '#4a8c2a'], '#6b5232'), birch_sapling: sapling(['#6fab49', '#5f9a3c', '#7fbb59'], '#d8d7d2'),
  short_grass: shortGrass, dandelion: flower('#f5d33a', '#e8a01a', '#d9a817'), poppy: flower('#d8322a', '#2a1a14', '#a3201a'), bow, arrow });

// lava + obsidian + armor (Mike placeholders; Trish's textures.js versions win when she adds the same ids)
const lava = (px, rnd) => { const C = ['#d4560c', '#e8700f', '#f59a1c', '#c2400a', '#ffc23a'].map(hex);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const n = Math.sin(x * .9 + y * .4) + Math.sin(y * 1.3 - x * .5) + rnd() * .8; px(x, y, C[n > 1.4 ? 4 : n > .7 ? 2 : n > 0 ? 1 : n > -.8 ? 0 : 3]); } };
const obsidian = (px, rnd) => { const C = ['#14101e', '#1d1729', '#0c0a12', '#2b2240', '#3b2d5a'].map(hex);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, C[rnd() < .06 ? 4 : rnd() < .15 ? 3 : (rnd() * 3) | 0]); };
const ARMOR_SHAPES = {
  helmet: ['................', '................', '................', '...HHHHHHHHHH...', '..HLLLLLLLLLDH..', '..HLDDDDDDDDDH..', '..HLH......HDH..', '..HDH......HDH..', '..HHH......HHH..', '................', '................', '................', '................', '................', '................', '................'],
  chestplate: ['................', '..HHH......HHH..', '.HLLDH....HLLDH.', '.HLLDHHHHHHLLDH.', '.HLLLLLLLLLLLDH.', '.HHHLLLLLLLLDHH.', '...HLLLLLLLLDH..', '...HLLLLLLLLDH..', '...HLLLLLLLLDH..', '...HLLLLLLLLDH..', '...HLLLLLLLLDH..', '...HDDDDDDDDDH..', '...HHHHHHHHHHH..', '................', '................', '................'],
  leggings: ['................', '...HHHHHHHHHH...', '...HLLLLLLLLDH..', '...HLLLLLLLLDH..', '...HLLDHHHLLDH..', '...HLLDH.HLLDH..', '...HLLDH.HLLDH..', '...HLLDH.HLLDH..', '...HLLDH.HLLDH..', '...HLLDH.HLLDH..', '...HLLDH.HLLDH..', '...HDDDH.HDDDH..', '...HHHHH.HHHHH..', '................', '................', '................'],
  boots: ['................', '................', '................', '................', '................', '...HHH....HHH...', '...HLH....HLH...', '...HLH....HLH...', '...HLH....HLH...', '..HLLH....HLLH..', '.HLLDH....HLLDH.', '.HDDDH....HDDDH.', '.HHHHH....HHHHH.', '................', '................', '................'] };
const ARMOR_MAT = { leather: ['#a0603a', '#c07d4f', '#6b3c20'], iron: ['#c6c6c6', '#f2f2f2', '#7a7a7a'], golden: ['#f2cf37', '#fff28a', '#b8901a'], diamond: ['#4ee1e6', '#c8fdff', '#1a9aa0'] };
for (const m in ARMOR_MAT) for (const p in ARMOR_SHAPES) PAINTERS[`${m}_${p}`] = item(ARMOR_SHAPES[p], { H: '#1d1d1d', L: ARMOR_MAT[m][1], D: ARMOR_MAT[m][2] });
Object.assign(PAINTERS, { lava, obsidian });
// batch 4 placeholder (Trish's textures.js wins if she draws it)
PAINTERS.spruce_sapling = sapling(['#2f4f2f', '#3a5c38', '#25412a', '#45694a'], '#4a3520');
