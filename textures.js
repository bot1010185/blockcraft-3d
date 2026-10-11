/* Blockcraft 3D textures (Trish)
   Original hand-tuned 16x16 pixel art, generated in code. No Mojang assets.
   Usage:
     import { buildAtlas, TEX, faceTex } from './textures.js';
     const atlas = buildAtlas();          // { canvas, size, cols, uv(name) -> [u0,v0,u1,v1] }
     const tile = faceTex('grass', 'top') // texture name for a block face: 'top' | 'bottom' | 'side' | 'front'
*/
const T = 16;

// deterministic per-texture random so textures never change between loads
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function canvas() { const c = document.createElement('canvas'); c.width = c.height = T; return c; }

// helpers that paint into an ImageData buffer
function paint(draw, seed) {
  const c = canvas(), g = c.getContext('2d'), img = g.createImageData(T, T), d = img.data, r = rng(seed);
  const set = (x, y, rgb, a = 255) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const i = (y * T + x) * 4; d[i] = clamp(rgb[0]); d[i + 1] = clamp(rgb[1]); d[i + 2] = clamp(rgb[2]); d[i + 3] = a; };
  const get = (x, y) => { const i = (y * T + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const shade = (rgb, k) => [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  // palette noise: pick from a small palette so it looks hand-placed, not blurry
  const pal = (x, y, colors, weights) => { let t = r(), acc = 0; for (let i = 0; i < colors.length; i++) { acc += weights ? weights[i] : 1 / colors.length; if (t <= acc) return set(x, y, colors[i]); } set(x, y, colors[colors.length - 1]); };
  draw({ set, get, shade, pal, r });
  g.putImageData(img, 0, 0); return c;
}

const P = {
  dirt: ['#79553a', '#8a6142', '#6c4a31', '#5c3f2a', '#966c4a'].map(hex),
  stone: ['#7f7f7f', '#8a8a8a', '#747474', '#6b6b6b', '#929292'].map(hex),
  grass: ['#5f9f35', '#6db43c', '#558f2f', '#7cc247', '#4c8129'].map(hex),
  sand: ['#dbd3a0', '#e3dcae', '#cfc690', '#d6cd98', '#e8e2b8'].map(hex),
  plank: ['#a2834f', '#b08f59', '#94774a', '#bd9b63'].map(hex),
  bark: ['#6b5132', '#5c4529', '#7a5d3a', '#4f3b23'].map(hex),
  ring: ['#b8945a', '#a58350', '#c9a66c'].map(hex),
  leaf: ['#3e7d2a', '#4a9132', '#356b24', '#57a33b', '#2c5a1e'].map(hex),
  bedrock: ['#4a4a4a', '#2e2e2e', '#5e5e5e', '#1f1f1f', '#757575'].map(hex),
};

function stoneBase(api) { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, P.stone, [.34, .2, .22, .14, .1]); }
// an ore: stone base + 4 to 5 clusters with a highlight and a dark edge so they read at distance
function ore(main, light, dark, clusters) {
  return api => {
    stoneBase(api);
    for (const [cx, cy, shape] of clusters) for (const [dx, dy, k] of shape) {
      const col = k === 2 ? light : k === 0 ? dark : main; api.set(cx + dx, cy + dy, hex(col));
    }
  };
}
const BLOB_A = [[1, 0, 2], [2, 0, 1], [0, 1, 2], [1, 1, 1], [2, 1, 1], [3, 1, 0], [1, 2, 1], [2, 2, 0]];
const BLOB_B = [[0, 0, 2], [1, 0, 1], [0, 1, 1], [1, 1, 1], [2, 1, 2], [1, 2, 1], [2, 2, 0], [0, 2, 0]];
const BLOB_C = [[0, 0, 2], [1, 0, 1], [2, 0, 1], [0, 1, 1], [1, 1, 0], [1, 2, 0]];
const ORE_SPOTS = [[1, 2, BLOB_A], [10, 1, BLOB_B], [6, 7, BLOB_C], [11, 10, BLOB_A], [2, 12, BLOB_B]];

export const TEX = {
  dirt: api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, P.dirt, [.32, .22, .2, .14, .12]); },
  stone: api => {
    stoneBase(api);
    // short dark cracks like real stone
    const cracks = [[2, 4, 4], [9, 2, 3], [6, 11, 5], [12, 8, 3], [1, 14, 3]];
    for (const [x, y, n] of cracks) for (let i = 0; i < n; i++) api.set(x + i, y, hex('#636363'));
  },
  cobblestone: api => {
    // lumpy round stones packed together with dark mortar, no straight grid
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, hex('#3f3f3f'));
    const rocks = [[2.5, 2, 3, 2.2], [8.5, 1.5, 2.6, 2], [13.5, 3, 2.4, 3], [4, 7, 3.2, 2.6], [10.5, 6.5, 2.8, 2.4], [1, 11.5, 2.4, 3], [7, 12, 3.4, 2.6], [13, 12, 2.6, 3], [14.8, 7.5, 1.4, 2]];
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) for (const [cx, cy, rx, ry] of rocks) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1) { const top = (y - cy) < -ry * .4 || (x - cx) < -rx * .5; api.pal(x, y, top ? [hex('#a6a6a6'), hex('#9a9a9a')] : d > .7 ? [hex('#6a6a6a'), hex('#727272')] : P.stone); break; }
    }
  },
  grass_top: api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, P.grass, [.3, .22, .2, .14, .14]); },
  grass_side: api => {
    TEX.dirt(api);
    // grass lip with uneven drips, like the real side texture
    const drip = [3, 4, 3, 2, 3, 5, 4, 3, 2, 3, 4, 3, 5, 3, 2, 4];
    for (let x = 0; x < T; x++) for (let y = 0; y < drip[x]; y++) api.pal(x, y, P.grass, [.3, .25, .2, .15, .1]);
  },
  sand: api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, P.sand, [.3, .2, .2, .2, .1]); },
  gravel: api => {
    // loose pebbles: dark gaps with rounded light/brown stones, clearly not stone
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, hex('#4e4846'));
    const peb = [['#9c9391', '#bdb5b3'], ['#857b78', '#a39895'], ['#7a6a5e', '#9a887a'], ['#a8a3a0', '#cfc9c6']].map(c => c.map(hex));
    for (let i = 0; i < 26; i++) { const x = (api.r() * 15) | 0, y = (api.r() * 15) | 0, c = peb[(api.r() * peb.length) | 0];
      api.set(x, y, c[1]); api.set(x + 1, y, c[0]); api.set(x, y + 1, c[0]); api.set(x + 1, y + 1, c[0]); }
  },
  oak_planks: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 2, seam = y % 4 === 3, joint = (x + row * 7) % 16 === 0;
      if (seam || joint) api.set(x, y, hex('#6e5734')); else api.pal(x, y, P.plank, [.35, .3, .2, .15]);
    }
    for (const [x, y] of [[3, 1], [11, 5], [6, 9], [13, 13]]) api.set(x, y, hex('#7d6440'));
  },
  oak_log: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const groove = x % 4 === 0 || (x % 4 === 2 && api.r() < .35);
      api.pal(x, y, groove ? [P.bark[3], P.bark[1]] : P.bark);
    }
  },
  oak_log_top: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const e = x === 0 || y === 0 || x === 15 || y === 15;
      if (e) { api.pal(x, y, P.bark); continue; }
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0;
      api.set(x, y, d % 2 ? P.ring[1] : P.ring[0]);
    }
  },
  oak_leaves: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (api.r() < .14) api.set(x, y, [0, 0, 0], 0); // holes, render with alphaTest
      else api.pal(x, y, P.leaf, [.28, .22, .2, .15, .15]);
    }
  },
  glass: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const frame = x === 0 || y === 0 || x === 15 || y === 15;
      api.set(x, y, frame ? hex('#d9eef5') : [0, 0, 0], frame ? 255 : 0);
    }
    // two diagonal glints
    for (let i = 0; i < 4; i++) { api.set(3 + i, 6 - i, hex('#ffffff'), 220); api.set(9 + i, 12 - i, hex('#ffffff'), 200); api.set(10 + i, 12 - i, hex('#e8f6fb'), 160); }
  },
  bedrock: api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, P.bedrock, [.3, .25, .2, .15, .1]); },
  coal_ore: ore('#2b2b2b', '#4a4a4a', '#141414', [[1, 1, BLOB_B], [9, 2, BLOB_A], [4, 7, BLOB_A], [12, 8, BLOB_C], [6, 12, BLOB_B], [1, 11, BLOB_C]]),
  iron_ore: ore('#d8af93', '#efd3be', '#a07a62', [[3, 1, BLOB_C], [11, 3, BLOB_A], [1, 7, BLOB_B], [8, 9, BLOB_C], [12, 12, BLOB_B]]),
  gold_ore: ore('#fcee4b', '#fffbb0', '#c99a1a', [[2, 3, BLOB_A], [10, 1, BLOB_C], [7, 7, BLOB_B], [1, 12, BLOB_C], [11, 11, BLOB_A]]),
  diamond_ore: ore('#5decf5', '#d2fdff', '#1e9a9e', [[1, 1, BLOB_C], [8, 3, BLOB_B], [12, 7, BLOB_C], [3, 9, BLOB_A], [9, 12, BLOB_C]]),
  crafting_table_top: api => {
    TEX.oak_planks(api);
    // tool grid on top
    for (let i = 1; i < 15; i++) { api.set(i, 1, hex('#5a4326')); api.set(i, 14, hex('#5a4326')); api.set(1, i, hex('#5a4326')); api.set(14, i, hex('#5a4326')); }
    for (let i = 2; i < 14; i++) { api.set(i, 5, hex('#7d6440')); api.set(i, 10, hex('#7d6440')); api.set(5, i, hex('#7d6440')); api.set(10, i, hex('#7d6440')); }
  },
  crafting_table_side: api => {
    TEX.oak_planks(api);
    for (let x = 0; x < T; x++) for (let y = 0; y < 3; y++) api.pal(x, y, P.bark);
    // saw hanging on the side
    for (let x = 3; x < 9; x++) api.set(x, 7, hex('#c8c8c8'));
    for (let x = 3; x < 9; x += 2) api.set(x, 8, hex('#9a9a9a'));
    api.set(9, 7, hex('#6b5132')); api.set(10, 7, hex('#6b5132'));
  },
  crafting_table_front: api => {
    TEX.oak_planks(api);
    for (let x = 0; x < T; x++) for (let y = 0; y < 3; y++) api.pal(x, y, P.bark);
    // tool rack: a pickaxe and a hammer hung on pegs
    const dark = hex('#5a4326');
    for (let x = 1; x < 15; x++) api.set(x, 4, dark);
    const pick = [[3,6],[4,5],[5,5],[6,5],[7,6],[5,6],[5,7],[5,8],[5,9],[5,10],[5,11]];
    pick.forEach(([x, y], i) => api.set(x, y, i < 6 ? hex('#9a9a9a') : hex('#6b5132')));
    for (let x = 9; x < 14; x++) { api.set(x, 6, hex('#b0b0b0')); api.set(x, 7, hex('#8a8a8a')); }
    for (let y = 8; y < 13; y++) api.set(11, y, hex('#6b5132'));
  },
  water: api => {
    const w = ['#2f5fd0', '#3768dc', '#2a55bd', '#4176e6'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { api.pal(x, y, w); const p = api.get(x, y); api.set(x, y, p, 150); }
  },
  torch: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, [0, 0, 0], 0);
    for (let y = 6; y < 16; y++) { api.set(7, y, hex('#6b5132')); api.set(8, y, hex('#5c4529')); }
    api.set(7, 5, hex('#ffd23f')); api.set(8, 5, hex('#ffb01f')); api.set(7, 4, hex('#fff2a0')); api.set(8, 4, hex('#ffd23f')); api.set(7, 6, hex('#ff8c1a')); api.set(8, 6, hex('#ff8c1a'));
  },
  furnace_side: api => {
    TEX.cobblestone(api);
    for (let i = 0; i < T; i++) { api.set(i, 0, hex('#5a5a5a')); api.set(i, 15, hex('#3a3a3a')); }
  },
  furnace_top: api => {
    stoneBase(api);
    for (let i = 0; i < T; i++) { api.set(i, 0, hex('#5a5a5a')); api.set(i, 15, hex('#5a5a5a')); api.set(0, i, hex('#5a5a5a')); api.set(15, i, hex('#5a5a5a')); }
    for (let i = 2; i < 14; i++) { api.set(i, 2, hex('#a0a0a0')); api.set(2, i, hex('#a0a0a0')); api.set(i, 13, hex('#6a6a6a')); api.set(13, i, hex('#6a6a6a')); }
  },
  furnace_front: api => {
    TEX.furnace_side(api);
    // smooth stone face plate with a dark mouth and a grate
    for (let y = 2; y < 15; y++) for (let x = 2; x < 14; x++) api.pal(x, y, [hex('#8a8a8a'), hex('#828282'), hex('#909090')]);
    for (let x = 2; x < 14; x++) { api.set(x, 2, hex('#a6a6a6')); api.set(x, 14, hex('#5e5e5e')); }
    for (let y = 2; y < 15; y++) { api.set(2, y, hex('#a6a6a6')); api.set(13, y, hex('#5e5e5e')); }
    for (let x = 4; x < 12; x++) { api.set(x, 4, hex('#2c2c2c')); api.set(x, 6, hex('#2c2c2c')); } // vents
    for (let y = 8; y < 13; y++) for (let x = 4; x < 12; x++) api.set(x, y, y === 8 ? hex('#3a3a3a') : hex('#141414')); // mouth
    for (let x = 4; x < 12; x += 2) api.set(x, 12, hex('#3d3d3d')); // grate bars
  },
  chest_side: api => {
    const W = ['#a8732e', '#9a6828', '#b57d34', '#8f5f22'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) api.set(x, y, hex('#3d2a12')); else if (y % 4 === 3) api.set(x, y, hex('#7a5220')); else api.pal(x, y, W);
    }
    for (let x = 0; x < T; x++) { api.set(x, 5, hex('#3d2a12')); api.set(x, 6, hex('#5a3d18')); } // lid seam
  },
  chest_front: api => {
    TEX.chest_side(api);
    // metal latch
    for (let y = 4; y < 9; y++) for (let x = 6; x < 10; x++) api.set(x, y, hex('#c9c9c9'));
    for (let x = 6; x < 10; x++) api.set(x, 8, hex('#7a7a7a'));
    api.set(7, 6, hex('#3a3a3a')); api.set(8, 6, hex('#3a3a3a'));
  },
  chest_top: api => {
    const W = ['#a8732e', '#9a6828', '#b57d34', '#8f5f22'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      api.set(x, y, edge ? hex('#3d2a12') : x % 5 === 0 ? hex('#7a5220') : W[(api.r() * 4) | 0]);
    }
  },
  snow: api => { const c = ['#f4f8fa', '#e6eef2', '#ffffff', '#d8e3e8'].map(hex); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, c, [.4, .25, .2, .15]); },
  grass_side_snowy: api => {
    TEX.dirt(api);
    const drip = [3, 4, 3, 2, 4, 5, 3, 3, 2, 4, 4, 3, 5, 3, 2, 4], c = ['#f4f8fa', '#e6eef2', '#ffffff'].map(hex);
    for (let x = 0; x < T; x++) for (let y = 0; y < drip[x]; y++) api.pal(x, y, c);
  },
  sandstone: api => {
    TEX.sand(api);
    for (let x = 0; x < T; x++) { api.set(x, 3, hex('#c4b980')); api.set(x, 4, hex('#e8e0b0')); api.set(x, 11, hex('#c4b980')); api.set(x, 12, hex('#e8e0b0')); }
  },
  sandstone_top: api => { TEX.sand(api); for (let i = 0; i < T; i++) { api.set(i, 0, hex('#c4b980')); api.set(0, i, hex('#c4b980')); api.set(i, 15, hex('#c4b980')); api.set(15, i, hex('#c4b980')); } },
  birch_log: api => {
    const w = ['#e3e0d4', '#d6d2c4', '#ece9df'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, w);
    // dark birch marks: short horizontal dashes
    const m = [[1, 2, 3], [9, 1, 2], [5, 5, 4], [12, 6, 3], [2, 9, 2], [8, 10, 4], [13, 12, 2], [3, 13, 3]];
    for (const [x, y, n] of m) for (let i = 0; i < n; i++) api.set(x + i, y, hex(i === 0 ? '#2e2a24' : '#45403a'));
  },
  birch_log_top: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) { api.set(x, y, hex('#e3e0d4')); continue; }
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0; api.set(x, y, d % 2 ? hex('#c9b27a') : hex('#d8c38c'));
    }
  },
  birch_leaves: api => {
    const c = ['#6a9a3e', '#7aab48', '#5c8a35', '#86b852', '#4f7a2d'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { if (api.r() < .14) api.set(x, y, [0, 0, 0], 0); else api.pal(x, y, c, [.28, .22, .2, .15, .15]); }
  },
  cactus_side: api => {
    const g = ['#3e8a2c', '#357a26', '#4a9a34'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const rib = x === 1 || x === 14 || x === 5 || x === 10;
      api.pal(x, y, rib ? [hex('#2a5e1c'), hex('#2f6820')] : g);
    }
    for (const [x, y] of [[2, 3], [6, 7], [11, 2], [13, 9], [3, 12], [8, 13]]) api.set(x, y, hex('#e8e8c0')); // spines
  },
  cactus_top: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const e = x === 1 || y === 1 || x === 14 || y === 14, out = x === 0 || y === 0 || x === 15 || y === 15;
      api.set(x, y, out ? [0, 0, 0] : e ? hex('#2a5e1c') : (x + y) % 3 ? hex('#4a9a34') : hex('#3e8a2c'), out ? 0 : 255);
    }
  },
  bricks: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 2, mort = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7;
      api.set(x, y, mort ? hex('#b9b2a8') : [hex('#94443a'), hex('#a24d40'), hex('#86392f'), hex('#ad5a4a')][(api.r() * 4) | 0]);
    }
  },
  stone_bricks: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 3, mort = y % 8 === 7 || (x + row * 8) % 16 === 15, top = y % 8 === 0 || (x + row * 8) % 16 === 0;
      api.set(x, y, mort ? hex('#4f4f4f') : top ? hex('#9c9c9c') : P.stone[(api.r() * 4) | 0]);
    }
  },
  white_wool: api => {
    const c = ['#eaeaea', '#f5f5f5', '#dcdcdc', '#e2e2e2'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, c[((x * 3 + y * 5 + ((x ^ y) & 3)) % 4)]); // woven look
  },
  iron_block: api => storage(api, '#dcdcdc', '#f6f6f6', '#a8a8a8'),
  gold_block: api => storage(api, '#f5d43a', '#fff6a0', '#c99a1a'),
  diamond_block: api => storage(api, '#5decf5', '#d2fdff', '#28a9ae'),
  coal_block: api => storage(api, '#1f1f1f', '#3a3a3a', '#0f0f0f'),
  ...woolSet({ black_wool: ['#1d1d21', '#26262b', '#141417', '#2e2e33'], brown_wool: ['#6f4a2a', '#7b5432', '#613f23', '#86603a'],
    gray_wool: ['#3f4447', '#484d50', '#363a3d', '#52575a'], light_gray_wool: ['#8e8e86', '#9b9b93', '#828279', '#a6a69e'],
    pink_wool: ['#ed8dac', '#f49cb8', '#e07c9d', '#f7aec4'] }),
  hay_block_side: api => {
    const c = ['#c9a332', '#b8922a', '#d6b13e', '#a8841f'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, (x % 3 === 0) ? c[3] : c[(api.r() * 3) | 0]); // vertical straw
    for (const y of [3, 12]) for (let x = 0; x < T; x++) { api.set(x, y, hex('#7a4f1c')); api.set(x, y + 1, hex('#5e3c14')); } // red-brown bands
  },
  hay_block_top: api => {
    const c = ['#c9a332', '#b8922a', '#d6b13e', '#a8841f'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, c);
    for (let i = 0; i < 18; i++) { const x = (api.r() * 14) | 0, y = (api.r() * 16) | 0; api.set(x, y, c[3]); api.set(x + 1, y, c[3]); }
  },
  farmland: api => {
    const c = ['#5a3c22', '#4e331c', '#66452a', '#43301a'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, (y % 4 === 0 || y % 4 === 1) ? c[3] : c[(api.r() * 3) | 0]); // tilled furrows
  },
  ...woodSet('spruce', ['#6b4c2c', '#76552f', '#5f4326', '#82603a'], '#3f2c18', ['#3b2a18', '#2f2113', '#47331e', '#261a0e'], ['#7a5a36', '#6a4d2d', '#8a6a42']),
  ...woodSet('birch', ['#c8b77a', '#d4c488', '#bba96c', '#ddce96'], '#9a8a55'),
  spruce_leaves: api => { const c = ['#2f4f2f', '#3a5c38', '#25412a', '#45694a'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.r() < .12 ? api.set(x, y, [0, 0, 0], 0) : api.pal(x, y, c, [.35, .3, .2, .15]); },
  tnt_side: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const band = y >= 5 && y <= 10, stick = x % 4 === 3;
      api.set(x, y, band ? hex(y === 5 || y === 10 ? '#c9c9c9' : '#f2f2f2') : hex(stick ? '#8e1d16' : (api.r() < .3 ? '#c4372b' : '#db4334')));
    }
    // original 3-letter mark in the white band (blocky, not the MC font)
    const L = ['###.#..#.###', '.#..##.#..#.', '.#..#.##..#.', '.#..#..#..#.'];
    L.forEach((r, j) => [...r].forEach((ch, i) => ch === '#' && api.set(2 + i, 6 + j, hex('#1d1d1d'))));
  },
  tnt_top: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, hex((x % 4 === 3 || y % 4 === 3) ? '#8e1d16' : '#c4372b'));
    for (const [x, y] of [[1, 1], [5, 1], [9, 1], [13, 1], [1, 5], [5, 5], [9, 5], [13, 5], [1, 9], [5, 9], [9, 9], [13, 9], [1, 13], [5, 13], [9, 13], [13, 13]]) { api.set(x, y, hex('#3a3a3a')); api.set(x + 1, y + 1, hex('#5a5a5a')); }
    api.set(6, 6, hex('#d9d9d9')); api.set(7, 7, hex('#d9d9d9')); api.set(8, 6, hex('#ffcf4a'));
  },
  tnt_bottom: api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, hex((x % 4 === 3 || y % 4 === 3) ? '#8e1d16' : (api.r() < .3 ? '#b83126' : '#c4372b'))); },
  oak_trapdoor: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const frame = x < 2 || x > 13 || y < 2 || y > 13, bar = y === 7 || y === 8 || x === 7 || x === 8;
      const hole = !frame && !bar && ((x > 2 && x < 6) || (x > 9 && x < 13)) && ((y > 2 && y < 6) || (y > 9 && y < 13));
      if (hole) api.set(x, y, [0, 0, 0], 0); else api.pal(x, y, frame ? [hex('#7d6440'), hex('#6e5734')] : P.plank);
    }
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) api.set(x, y, hex('#4a4a4a')); // nails
  },
  // fire: flame tongues that repeat every 16px vertically, so the shader can scroll it upward forever
  fire: api => {
    const c = ['#fff6b0', '#ffd84a', '#ffa21f', '#e8600f', '#a8300a'].map(hex), k = Math.PI * 2 / T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const v = .55 * Math.sin(x * k * 3 + Math.sin(y * k) * 1.5) + .35 * Math.sin(y * k * 2 + x * k * 5) + .25 * Math.cos(y * k - x * k * 2) + (api.r() - .5) * .25;
      if (v < -.25) { api.set(x, y, [0, 0, 0], 0); continue; }
      api.set(x, y, c[v > .75 ? 0 : v > .45 ? 1 : v > .15 ? 2 : v > -.05 ? 3 : 4]);
    }
  },
  experience_orb: api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      api.set(x, y, d > 5.5 ? [0, 0, 0] : hex(d > 4.5 ? '#3d7a10' : d > 3 ? '#8fdc2a' : d > 1.5 ? '#c8f24a' : '#f7ffb0'), d > 5.5 ? 0 : 255);
    }
  },
  ...cropStages('wheat', 8), ...cropStages('carrots', 4),
  ...sprites({
    // ladder: two rails + 4 rungs, transparent gaps
    ladder: { pal: { R: '#6e5434', r: '#4f3b22', U: '#8a6a40', u: '#5e4729' }, rows: [
      '.Rr..........Rr.', '.RrUUUUUUUUUURr.', '.Rruuuuuuuuuurr.', '.Rr..........Rr.', '.Rr..........Rr.', '.RrUUUUUUUUUURr.', '.Rruuuuuuuuuurr.', '.Rr..........Rr.', '.Rr..........Rr.', '.RrUUUUUUUUUURr.', '.Rruuuuuuuuuurr.', '.Rr..........Rr.', '.Rr..........Rr.', '.RrUUUUUUUUUURr.', '.Rruuuuuuuuuurr.', '.Rr..........Rr.'] },
    oak_door_top: { pal: { F: '#5e4729', P: '#9c7c4a', p: '#b08f5a', W: '#c9e6f0', w: '#9fc6d4' }, rows: [
      'FFFFFFFFFFFFFFFF', 'FPPPPPPPPPPPPPPF', 'FPWWWWWFWWWWWWPF', 'FPWwWWWFWWwWWWPF', 'FPWWWWWFWWWWWWPF', 'FPWWWWwFWWWWWWPF', 'FPFFFFFFFFFFFFPF', 'FPWWWWWFWWWWWWPF',
      'FPWWwWWFWWWWwWPF', 'FPWWWWWFWWWWWWPF', 'FPWWWWWFWWWWWWPF', 'FPPPPPPPPPPPPPPF', 'FPpPPpPPPpPPpPPF', 'FPPPPPPPPPPPPPPF', 'FPpPPPPpPPPPpPPF', 'FPPPPPPPPPPPPPPF'] },
    oak_door_bottom: { pal: { F: '#5e4729', P: '#9c7c4a', p: '#b08f5a', K: '#3a3a3a', k: '#8a8a8a' }, rows: [
      'FPPPPPPPPPPPPPPF', 'FPpPPPpPPPPpPPPF', 'FPPPPPPPPPPPPPPF', 'FPFFFFFFFFFFFFPF', 'FPPPPPPPPPPPPPPF', 'FPPPpPPPPPPPPPPF', 'FPPPPPPPPPPPkKPF', 'FPPPPPPPPPPPKKPF',
      'FPPPPPPpPPPPPPPF', 'FPFFFFFFFFFFFFPF', 'FPPPPPPPPPPPPPPF', 'FPpPPPPPPpPPPPPF', 'FPPPPPPPPPPPPPPF', 'FPPPPPpPPPPPPPPF', 'FPPPPPPPPPPPPPPF', 'FFFFFFFFFFFFFFFF'] },
    oak_sapling: { pal: { L: '#3b7a1f', l: '#4f9a2c', d: '#26571a', S: '#6b5232' }, rows: [
      '................', '......lL........', '.....lLLd..lL...', '....lLLLLdlLLd..', '...LLlLdLLLLd...', '....dLLLlLLd....', '..lLLdLLLLdLl...', '.lLLLLLlSLLLLd..',
      '..dLLLdLSLdLd...', '....dLLdSLLd....', '.......SS.......', '.......S........', '.......SS.......', '.......S........', '.......S........', '.......S........'] },
    birch_sapling: { pal: { L: '#5f9a3c', l: '#79b34f', d: '#46733a', S: '#dcdad3', s: '#4a4a4a' }, rows: [
      '................', '.......lL.......', '.....lLLLd......', '....lLLlLLd.....', '...lLLLLdLLL....', '..lLLdLLLLlLd...', '...dLLLLSLLd....', '....dLLdSLd.....',
      '......lLSd......', '.......sS.......', '.......SS.......', '.......Ss.......', '.......SS.......', '.......sS.......', '.......SS.......', '.......SS.......'] },
    spruce_sapling: { pal: { L: '#3a5c38', l: '#4f7a4a', d: '#25412a', S: '#5a3f22' }, rows: [
      '.......l........', '......lLd.......', '.....lLLLd......', '......LLd.......', '....lLLLLLd.....', '...lLLdLLLLd....', '.....LLLLd......', '...lLLLLLLLd....',
      '..lLLdLLLdLLd...', '.lLLLLLSLLLLLd..', '......dSd.......', '.......S........', '.......SS.......', '.......S........', '.......S........', '.......S........'] },
    short_grass: { pal: { G: '#6aa43a', g: '#4e8429', h: '#86bf52' }, rows: [
      '................', '................', '................', '.....h......h...', '.h...G...h..G...', '.G..hG...G..Gh..', '.Gh.Gg..hG.gG...', '.gG.G..hGg.G..h.',
      '..G.Gg.Gg..Gg.G.', '..GgG..G..gG.hG.', 'h.gGg.gG.hGg.G..', 'G..Gg.G..GgGgG..', 'Gg.gGgGg.gG.Gg.h', '.GggGgGGgGg.gGgG', '.gGgGGgGGgGGgGg.', 'gGGgGGgGgGGgGGgG'] },
    dandelion: { pal: { Y: '#ffd83a', y: '#f2b50f', O: '#e08a00', G: '#4f9a2c', g: '#3b7a1f' }, rows: [
      '................', '................', '................', '................', '......yYy.......', '.....yYYYy......', '.....YYOYY......', '.....yYYYy......',
      '......yYy.......', '.......G........', '.......G..g.....', '....gG.G.gG.....', '.....gGGGg......', '.......G........', '.......G........', '.......G........'] },
    poppy: { pal: { R: '#e3262b', r: '#a8151a', K: '#1d1d1d', G: '#4f9a2c', g: '#3b7a1f' }, rows: [
      '................', '................', '................', '.....rR..Rr.....', '....rRRRRRRr....', '....RRRKKRRR....', '....RRKKKKRR....', '....rRRKKRRr....',
      '.....rRRRRr.....', '.......G........', '.......G........', '....gG.G........', '.....gGG..Gg....', '.......GGg......', '.......G........', '.......G........'] },
    bed_head_top: { pal: { W: '#e9ecec', w: '#cfd5d5', R: '#b02e26', r: '#8e1f19' }, rows: [
      'wwwwwwwwwwwwwwww', 'wWWWWWWWWWWWWWWw', 'wWWWWWWWWWWWWWWw', 'wWWWWWWWWWWWWWWw', 'wWWWWWWWWWWWWWWw', 'wWwWWWWWWWWWwWWw', 'wWWWWWWWWWWWWWWw', 'wwwwwwwwwwwwwwww',
      'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRrRRRRRRRRRRrRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRrRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr'] },
    bed_foot_top: { pal: { R: '#b02e26', r: '#8e1f19', W: '#e9ecec' }, rows: [
      'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRrRRRRRRRRRRr', 'rRRRRRRRRRRRrRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRrRRRRRRRr', 'rRRRRRRRRRRRRRRr',
      'rRRRRRRRRRRRRRRr', 'rRrRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRrRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rRRRRRRRRRRRRRRr', 'rrrrrrrrrrrrrrrr'] },
    bed_head_side: { pal: { W: '#e9ecec', R: '#b02e26', r: '#8e1f19', P: '#9c7c4a', F: '#5e4729' }, rows: [
      '................', '................', '................', '................', '................', '................', '................', 'WWWWWWWWRRRRRRRR',
      'WWWWWWWWRRRRRRRR', 'rrrrrrrrrrrrrrrr', 'PPPPPPPPPPPPPPPP', 'FFFFFFFFFFFFFFFF', 'PPP..........PPP', 'PPP..........PPP', 'FFF..........FFF', '................'] },
    bed_foot_side: { pal: { R: '#b02e26', r: '#8e1f19', P: '#9c7c4a', F: '#5e4729' }, rows: [
      '................', '................', '................', '................', '................', '................', '................', 'RRRRRRRRRRRRRRRR',
      'RRRRRRRRRRRRRRRR', 'rrrrrrrrrrrrrrrr', 'PPPPPPPPPPPPPPPP', 'FFFFFFFFFFFFFFFF', 'PPP..........PPP', 'PPP..........PPP', 'FFF..........FFF', '................'] },
  }),
  // lava: hot glowing blobs with dark crust veins
  lava: api => {
    const c = ['#ffd04a', '#ffad1f', '#f2800f', '#d9560b', '#a8360a'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const k = Math.PI * 2 / T, n = Math.sin(x * k * 2 + Math.sin(y * k) * 2) + Math.cos(y * k * 3 - x * k) + api.r() * .5; // periodic in 16 so it tiles and can scroll
      api.set(x, y, c[n > 1.3 ? 0 : n > .7 ? 1 : n > -.1 ? 2 : n > -.9 ? 3 : 4]);
    }
  },
  // obsidian: near-black purple glass with sharp shards and highlights
  obsidian: api => {
    const c = ['#0f0b17', '#16101f', '#1d1529', '#2a1f3d'].map(hex);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.pal(x, y, c, [.35, .35, .2, .1]);
    for (const [x, y, l] of [[2, 3, 4], [9, 1, 3], [5, 9, 5], [11, 10, 4], [1, 13, 3]]) for (let i = 0; i < l; i++) { api.set(x + i, y + (i >> 1), hex('#3b2b59')); if (i === 0) api.set(x, y, hex('#6a4fa0')); }
  },
  ...items({
    bow: { pal: { W: '#8a5a2b', w: '#5e3a17', d: '#3d240c', S: '#dcdcdc' }, rows: [
      '................', '..........dwww..', '.........dW..wS.', '..........W.S...', '...........WS...', '...........SW...', '..........S.W...', '.........S..W...',
      '........S...W...', '.......S....W...', '......S....Ww...', '.....S....Ww....', '...dS...wWw.....', '...wSwwWWd......', '...dwWwd........', '................'] },
    arrow: { pal: { H: '#d0d0d0', h: '#8a8a8a', S: '#8a6a3e', s: '#5e4729', F: '#f2f2f2', f: '#bdbdbd' }, rows: [
      '................', '...........hHH..', '...........HHHh.', '............Hh..', '...........S.h..', '..........S.....', '.........S......', '........s.......',
      '.......S........', '......S.........', '.....s..........', '..f.S...........', '.fFS............', 'fF.ff...........', '.F..............', '................'] },
  }),
  ...armorSet(),
};
// flat item sprites with an auto dark outline
function items(defs) {
  const out = {};
  for (const [name, { pal, rows }] of Object.entries(defs)) out[name] = api => rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '.' ? api.set(x, y, [0, 0, 0], 0) : api.set(x, y, hex(pal[ch]))));
  return out;
}
// armor: one mask per piece, shaded by neighbours (outline, top-left light, bottom-right shade) + per-material details
function armorSet() {
  const M = {
    helmet: ['................', '................', '....########....', '...##########...', '..############..', '..############..', '..############..', '..####....####..', '..###......###..', '................', '................', '................', '................', '................', '................', '................'],
    chestplate: ['................', '..####....####..', '.######..######.', '.##############.', '.##############.', '.##############.', '..############..', '...##########...', '...##########...', '...##########...', '...##########...', '...##########...', '...##########...', '................', '................', '................'],
    leggings: ['................', '...##########...', '...##########...', '...##########...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '...####..####...', '................', '................', '................'],
    boots: ['................', '................', '................', '................', '.#####....#####.', '.#####....#####.', '.#####....#####.', '.#####....#####.', '.#####....#####.', '.######..######.', '#######..#######', '#######..#######', '#######..#######', '................', '................', '................'],
  };
  const MAT = { leather: ['#a0603a', '#c88458', '#6b3c20', '#3a1e0d'], iron: ['#c8c8c8', '#f4f4f4', '#8a8a8a', '#262626'], golden: ['#f2cf37', '#fff6a0', '#c08f12', '#5e4206'], diamond: ['#43d9de', '#c8fdff', '#1a9aa0', '#0c4a4d'] };
  const out = {};
  for (const [m, [base, hi, sh, ol]] of Object.entries(MAT)) for (const [piece, rows] of Object.entries(M)) out[`${m}_${piece}`] = api => {
    const on = (x, y) => rows[y]?.[x] === '#';
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (!on(x, y)) { api.set(x, y, [0, 0, 0], 0); continue; }
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      let c = edge ? ol : (!on(x - 1, y - 1) || !on(x - 2, y)) ? hi : (!on(x + 1, y + 1) || !on(x + 2, y)) ? sh : base;
      if (!edge && m === 'leather' && api.r() < .12) c = sh; // worn leather
      if (!edge && m === 'diamond' && api.r() < .08) c = hi; // sparkle
      api.set(x, y, hex(c));
    }
    if (piece === 'chestplate') for (let y = 4; y < 12; y++) if (on(7, y)) api.set(7, y, hex(m === 'leather' ? '#5a3018' : sh)); // centre seam
    if (m === 'leather' && piece === 'leggings') for (let x = 4; x < 12; x++) if (on(x, 2) && x % 2) api.set(x, 2, hex('#e6d2a8')); // stitched waistband
    if (m === 'iron' && piece === 'helmet') { api.set(4, 4, hex('#ffffff')); api.set(11, 4, hex('#ffffff')); } // rivets
  };
  return out;
}
// pixel-row sprites; '.' is transparent
function sprites(defs) {
  const out = {};
  for (const [name, { pal, rows }] of Object.entries(defs)) out[name] = api => rows.forEach((row, y) => [...row.padEnd(T, '.').slice(0, T)].forEach((ch, x) => ch === '.' ? api.set(x, y, [0, 0, 0], 0) : api.set(x, y, hex(pal[ch]))));
  return out;
}
function woolSet(sets) {
  const out = {};
  for (const [name, cols] of Object.entries(sets)) out[name] = api => { const c = cols.map(hex); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, c[((x * 3 + y * 5 + ((x ^ y) & 3)) % 4)]); };
  return out;
}
// crops: transparent cross-plant sprites that grow taller and change colour with each stage
function cropStages(kind, n) {
  const out = {};
  for (let st = 0; st < n; st++) out[`${kind}_stage${st}`] = api => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) api.set(x, y, [0, 0, 0], 0);
    const t = st / (n - 1), h = 3 + Math.round(t * 11), stems = [2, 5, 8, 11, 14];
    const ripe = kind === 'wheat' && st === n - 1;
    const stem = ripe ? hex('#b8922a') : t > .6 && kind === 'wheat' ? hex('#8fa83a') : hex('#4f9a2c');
    for (const sx of stems) for (let i = 0; i < h; i++) { const x = sx + (i > h * .6 ? ((sx + i) % 2 ? 1 : 0) : 0); api.set(x, 15 - i, stem); }
    if (kind === 'wheat' && t > .5) for (const sx of stems) for (let i = 0; i < 3; i++) api.set(sx, 15 - h + i, ripe ? hex('#d6b13e') : hex('#a8b84a')); // ears
    if (kind === 'carrots' && st === n - 1) for (const sx of [3, 9]) { api.set(sx, 15, hex('#e8811f')); api.set(sx + 1, 15, hex('#f29a35')); api.set(sx, 14, hex('#e8811f')); }
  };
  return out;
}

// storage blocks: bevelled metal plate with a highlight edge and a darker inner frame
function storage(api, main, light, dark) {
  const m = hex(main), l = hex(light), d = hex(dark);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const outer = x === 0 || y === 0 || x === 15 || y === 15;
    const hi = (x === 1 || y === 1) && !outer, lo = (x === 14 || y === 14) && !outer;
    api.set(x, y, outer ? d : hi ? l : lo ? d : (x + y) % 7 === 0 ? l : m);
  }
}

// which texture each face of a block uses
export const BLOCK_FACES = {
  grass: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  dirt: { all: 'dirt' }, stone: { all: 'stone' }, cobblestone: { all: 'cobblestone' },
  sand: { all: 'sand' }, gravel: { all: 'gravel' }, bedrock: { all: 'bedrock' },
  oak_log: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log' },
  oak_planks: { all: 'oak_planks' }, oak_leaves: { all: 'oak_leaves' }, glass: { all: 'glass' },
  coal_ore: { all: 'coal_ore' }, iron_ore: { all: 'iron_ore' }, gold_ore: { all: 'gold_ore' }, diamond_ore: { all: 'diamond_ore' },
  crafting_table: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' },
  water: { all: 'water' }, torch: { all: 'torch' },
  furnace: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' },
  chest: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' },
};
export function faceTex(block, face) { const f = BLOCK_FACES[block]; if (!f) return 'stone'; return f[face] || (face === 'front' && f.side) || f.all; }

// pack every texture into one atlas canvas; nearest filtering keeps pixels sharp
export function buildAtlas() {
  const names = Object.keys(TEX), cols = Math.ceil(Math.sqrt(names.length)), size = cols * T;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const at = {};
  names.forEach((n, i) => { const x = (i % cols) * T, y = Math.floor(i / cols) * T; g.drawImage(paint(TEX[n], i * 7919 + 13), x, y); at[n] = [x, y]; });
  // half-texel inset prevents neighbouring tiles bleeding at the edges
  const uv = n => { const [x, y] = at[n] || at.stone, e = .5; return [(x + e) / size, 1 - (y + T - e) / size, (x + T - e) / size, 1 - (y + e) / size]; };
  return { canvas: c, size, cols, names, uv };
}

// planks + log side + log top for a wood type (only what's missing gets made; birch log already exists)
function woodSet(name, plank, seam, bark, ring) {
  const out = {}, pc = plank.map(hex);
  out[`${name}_planks`] = api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const row = y >> 2, s = y % 4 === 3 || (x + row * 7) % 16 === 0; s ? api.set(x, y, hex(seam)) : api.pal(x, y, pc, [.35, .3, .2, .15]); } };
  if (bark) {
    const bc = bark.map(hex), rc = ring.map(hex);
    out[`${name}_log`] = api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const g = x % 3 === 0 || (x % 3 === 1 && api.r() < .25); api.pal(x, y, g ? [bc[3], bc[1]] : bc); } };
    out[`${name}_log_top`] = api => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const e = x === 0 || y === 0 || x === 15 || y === 15; if (e) { api.pal(x, y, bc); continue; } const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0; api.set(x, y, d % 2 ? rc[1] : rc[0]); } };
  }
  return out;
}
