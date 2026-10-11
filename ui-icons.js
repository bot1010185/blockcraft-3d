/* Blockcraft 3D - item icons + pixel font (Timmy)
   All art here is original 16x16 pixel art drawn from code. No Mojang assets.
   Block items are drawn as small isometric cubes from Trish's atlas (textures.js) when a
   texture exists; otherwise from the fallback tiles below. Non-block items use SPRITES.
   No DOM is touched at import time, so node can import this file for tests. */
import { ITEMS, TIERS, ARMOR_SLOTS } from './ui-data.js';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------------------------------------------------------------- sprite art
// '.' = transparent. Each sprite: { rows: 16 strings x 16 chars, pal: { char: '#rrggbb' } }
const HANDLE = { k: '#3a2a12', h: '#a07c3c', d: '#6b4f22' };
// tool handle: two-tone diagonal from bottom-left (1,14) up to (x,y)
function handle(top) { const rows = Array.from({ length: 16 }, () => '.'.repeat(16).split('')); for (let y = top; y <= 14; y++) { const x = 15 - y; if (x >= 0) rows[y][x] = 'h'; if (x + 1 < 16) rows[y][x + 1] = 'd'; } return rows; }
function overlay(base, head) { return base.map((r, y) => r.map((c, x) => (head[y] && head[y][x] && head[y][x] !== '.' ? head[y][x] : c)).join('')); }
const pad = (rows, top = 0) => { const out = [...Array(top).fill('.'.repeat(16)), ...rows]; while (out.length < 16) out.push('.'.repeat(16)); return out.slice(0, 16); };

const HEADS = {
  pickaxe: pad([
    '................',
    '....oooooo......',
    '...oaaaaaboo....',
    '....oobbbbbbo...',
    '........oobcbo..',
    '..........obco..',
    '...........obco.',
    '...........obco.',
    '............oco.',
    '............oco.',
    '............oco.',
    '.............o..']),
  axe: pad([
    '................',
    '.......ooo......',
    '......oaabo.....',
    '.....oaabbbo....',
    '.....oabbbo.....',
    '......obbco.....',
    '.......oco......',
    '........o.......']),
  shovel: pad([
    '..........ooo...',
    '.........oaabo..',
    '........oaabbbo.',
    '........oabbbco.',
    '.........obbco..',
    '..........occo..',
    '...........oo...']),
  hoe: pad([
    '................',
    '.......oooooo...',
    '......oaaaabbo..',
    '.......oooobco..',
    '..........oco...',
    '...........o....']),
};
const SWORD = [
  '................',
  '.............ooo',
  '............oabo',
  '...........oabo.',
  '..........oabo..',
  '.........oabo...',
  '........oabo....',
  '.......oabo.....',
  '..kk..oabo......',
  '..kdkoabo.......',
  '...kddbo........',
  '....kdk.........',
  '...hdkdk........',
  '..hd..kk........',
  '.kd.............',
  '................'];
const TOOL_PAL = {
  wooden:  { o: '#3f2f14', a: '#b18e55', b: '#8f6d38', c: '#6a4f24' },
  stone:   { o: '#2e2e2e', a: '#a5a5a5', b: '#808080', c: '#5e5e5e' },
  iron:    { o: '#373737', a: '#ffffff', b: '#d8d8d8', c: '#a8a8a8' },
  golden:  { o: '#5a4100', a: '#fffba6', b: '#f2d23c', c: '#c08a18' },
  diamond: { o: '#0c3c3a', a: '#d5fff9', b: '#4fe1d3', c: '#21a597' },
};
export function toolSprite(type, tier) {
  const pal = { ...HANDLE, ...TOOL_PAL[tier] };
  if (type === 'sword') return { rows: SWORD, pal };
  const top = { pickaxe: 5, axe: 3, shovel: 6, hoe: 4 }[type];
  return { rows: overlay(handle(top), HEADS[type]), pal };
}

const LUMP = [
  '................',
  '................',
  '......ooo.......',
  '....ooabbo......',
  '...oaabbbboo....',
  '..oabbbbbbbbo...',
  '..oabbwbbbccbo..',
  '.oabbbbbbbbcco..',
  '.obbbbbcbbbbco..',
  '.obbcbbbbbbcco..',
  '..obbbbbbccco...',
  '...occbbccoo....',
  '....ooccoo......',
  '......oo........',
  '................',
  '................'];
const INGOT = pad([
  '......oooooo....',
  '....ooaaaaaboo..',
  '..ooaaawaaabbbo.',
  '.oaaaaaabbbbbco.',
  '.obbbbbbbbbccco.',
  '..occcccccccoo..',
  '...oooooooo.....'], 5);
const GEM = pad([
  '.....oooooo.....',
  '....oaaabbbo....',
  '...oaawabbbco...',
  '..oaaaabbbbbco..',
  '..oooooooooooo..',
  '...obbbbbbbco...',
  '....obbbbbco....',
  '.....obbbco.....',
  '......obco......',
  '.......oo.......'], 3);
const MEAT = pad([
  '.....oooooo.....',
  '...ooaaaaabboo..',
  '..oaawaaabbbbbo.',
  '.oaaaaabbbbbbbco',
  '.oaabbbbbbbbbcco',
  '.obbbbbbbbbbccfo',
  '..obbbbbbbbccffo',
  '...occcbbbcccfo.',
  '....oocccccffo..',
  '......oooooo....'], 3);
const DRUM = pad([
  '.......oooo.....',
  '.....ooaaabo....',
  '....oaawabbbo...',
  '...oaaaabbbbco..',
  '...oaabbbbbbco..',
  '...obbbbbbbcco..',
  '....obbbbbcco...',
  '.....occccoo....',
  '....owwoooo.....',
  '...owwo.........',
  '.owwwo..........',
  '.owwo...........',
  '..oo............'], 2);
const BUCKET = pad([
  '...oooooooooo...',
  '..oaaaaaaaaabo..',
  '..oaiiiiiiiibo..',
  '..oajiiiiiiibo..',
  '...oaaaaaaabo...',
  '...oabbbbbbco...',
  '...oabbbbbbco...',
  '....oabbbbco....',
  '....oabbbbco....',
  '....oooooooo....'], 3);
const BUCKET_PAL = { o: '#2b2b2b', a: '#e6e6e6', b: '#b4b4b4', c: '#7d7d7d' };

export const SPRITES = {
  stick: { rows: (() => { const r = handle(2).map(x => x.join('')); return r; })(), pal: HANDLE },
  coal: { rows: LUMP, pal: { o: '#0e0e0e', a: '#5a5a5a', b: '#2a2a2a', c: '#1a1a1a', w: '#8a8a8a' } },
  charcoal: { rows: LUMP, pal: { o: '#1a140f', a: '#6b5a48', b: '#3b3027', c: '#2a221b', w: '#8f7c66' } },
  raw_iron: { rows: LUMP, pal: { o: '#4a3527', a: '#e8c9b0', b: '#c69a7b', c: '#9b7258', w: '#f8e6d6' } },
  raw_gold: { rows: LUMP, pal: { o: '#5a3d00', a: '#fff27a', b: '#e7b52a', c: '#b8810f', w: '#fffbd0' } },
  flint: { rows: GEM, pal: { o: '#151515', a: '#6a6a6a', b: '#3d3d3d', c: '#262626', w: '#9a9a9a' } },
  iron_ingot: { rows: INGOT, pal: { o: '#3a3a3a', a: '#f2f2f2', b: '#cfcfcf', c: '#9a9a9a', w: '#ffffff' } },
  gold_ingot: { rows: INGOT, pal: { o: '#5a3d00', a: '#fff58c', b: '#f0c829', c: '#b98412', w: '#ffffe0' } },
  diamond: { rows: GEM, pal: { o: '#0b3633', a: '#bffff6', b: '#3fd9cb', c: '#1d9a8e', w: '#ffffff' } },
  porkchop: { rows: MEAT, pal: { o: '#5c1f22', a: '#ffb3b3', b: '#f08a8e', c: '#c45a62', f: '#fff0e8', w: '#ffe0e0' } },
  cooked_porkchop: { rows: MEAT, pal: { o: '#3a1f0e', a: '#e3b07a', b: '#c3824a', c: '#8f5728', f: '#f3dfb5', w: '#f6d7a8' } },
  beef: { rows: MEAT, pal: { o: '#4a0d0d', a: '#f05a4a', b: '#c8302a', c: '#8f1a1a', f: '#ffe6d6', w: '#ff9a8a' } },
  cooked_beef: { rows: MEAT, pal: { o: '#2a1306', a: '#a8683a', b: '#7a4320', c: '#552c12', f: '#d8b48a', w: '#c88a58' } },
  mutton: { rows: MEAT, pal: { o: '#4a1010', a: '#e8706a', b: '#c4443e', c: '#922a26', f: '#f6e2d6', w: '#ffb0a0' } },
  cooked_mutton: { rows: MEAT, pal: { o: '#2e170a', a: '#b8784a', b: '#8a4f28', c: '#5e3416', f: '#e4c49c', w: '#d49a6a' } },
  rotten_flesh: { rows: MEAT, pal: { o: '#2a2010', a: '#a88a4a', b: '#7e6a30', c: '#5a6a28', f: '#6f8a3a', w: '#c0a060' } },
  chicken: { rows: DRUM, pal: { o: '#5a3a2a', a: '#ffe6d0', b: '#f4c4a8', c: '#d69a7c', w: '#f8f4ec' } },
  cooked_chicken: { rows: DRUM, pal: { o: '#3a1f0e', a: '#f0c070', b: '#cf8a3a', c: '#9a5a1e', w: '#f8f0dc' } },
  bucket: { rows: BUCKET, pal: { ...BUCKET_PAL, i: '#3c3c3c', j: '#4a4a4a' } },
  water_bucket: { rows: BUCKET, pal: { ...BUCKET_PAL, i: '#2f5fd0', j: '#8fb4ff' } },
  lava_bucket: { rows: BUCKET, pal: { ...BUCKET_PAL, i: '#e3631a', j: '#ffd24a' } },
  apple: { rows: pad([
    '........k.......',
    '........kll.....',
    '....ooo.k.ooo...',
    '...oawaookbbbo..',
    '..oawaabbbbbbco.',
    '..oaaabbbbbbbco.',
    '..oabbbbbbbbbco.',
    '..obbbbbbbbbcco.',
    '..obbbbbbbbbcco.',
    '...obbbbbbbcco..',
    '...occbbbbccco..',
    '....occoocco....',
    '.....oo..oo.....'], 1), pal: { o: '#4a0a0a', a: '#ff6a5a', b: '#de2a1e', c: '#a01810', w: '#ffd0c8', k: '#5a3a14', l: '#3fae2a' } },
  bread: { rows: pad([
    '........oooo....',
    '.....oooaaabo...',
    '...ooaaaabwbbo..',
    '..oaawaabbbbbbo.',
    '.oaaaabbbbbbcco.',
    '.obbbbbbbbccco..',
    '.occcbbbcccoo...',
    '..ooocccooo.....',
    '.....ooo........'], 4), pal: { o: '#3e2208', a: '#e9b25c', b: '#c98a34', c: '#99601c', w: '#ffe2a0' } },
  wheat: { rows: pad([
    '...........y.y..',
    '..........yYyY..',
    '.........yYyY...',
    '.....y.yYyYg....',
    '....yYyYyYg.....',
    '.....YyYyg......',
    '....yYyYg.......',
    '.....YgYg.......',
    '.....g.g........',
    '....g.g.........',
    '...g.g..........',
    '..g.g...........',
    '..gg............'], 1), pal: { y: '#e8c64a', Y: '#b88e22', g: '#7a8a2a' } },
  wheat_seeds: { rows: pad([
    '.......g........',
    '.....g...G......',
    '.........G..g...',
    '...G..g.........',
    '........G...G...',
    '..g...G.....g...',
    '......g...G.....',
    '....G.....g.....',
    '..........G.....'], 3), pal: { g: '#5fae3a', G: '#2f7a22' } },
  carrot: { rows: pad([
    '........gg......',
    '.......gLg......',
    '......g.g.g.....',
    '.......ooo......',
    '......oaaao.....',
    '.....oaawwao....',
    '.....oaabbbo....',
    '.....oabbbbo....',
    '......obbbco....',
    '......obbco.....',
    '.......occo.....',
    '........oo......'], 2), pal: { o: '#8a3a08', a: '#f08a28', b: '#e06a14', c: '#b84a0a', w: '#ffc060', g: '#3fae2a', L: '#6fd44a' } },
  bone: { rows: pad([
    '............ww..',
    '...........wwwo.',
    '..........wwoo..',
    '.........wwo....',
    '........wwo.....',
    '.......wwo......',
    '......wwo.......',
    '.....wwo........',
    '....wwo.........',
    '..wwwo..........',
    '.wwoo...........',
    '..oo............'], 2), pal: { w: '#f2eee0', o: '#b8b29a' } },
  string: { rows: pad([
    '..........ww....',
    '.........w..w...',
    '.........w......',
    '..........w.....',
    '...........w....',
    '..........w.....',
    '.........w......',
    '....ww..w.......',
    '...w..ww........',
    '...w............',
    '....w...........'], 2), pal: { w: '#f4f4f4' } },
  feather: { rows: pad([
    '...........www..',
    '..........wwgw..',
    '.........wwgww..',
    '........wwgwg...',
    '.......wwgww....',
    '......wwgwg.....',
    '.....wwgww......',
    '.....wgwg.......',
    '....wgww........',
    '...gwg..........',
    '..g.............',
    '.g..............'], 2), pal: { w: '#f4f4f4', g: '#bdbdbd' } },
  gunpowder: { rows: pad([
    '.......a........',
    '.....a.b.a......',
    '....b.a.b.b.....',
    '...a.b.a.b.a....',
    '..b.a.b.c.b.a...',
    '.a.c.b.a.b.c.b..',
    '..b.a.c.b.a.b...',
    '...c.b.a.c.b....',
    '.....c.b.c......'], 4), pal: { a: '#8a8a8a', b: '#5a5a5a', c: '#3a3a3a' } },
  leather: { rows: pad([
    '...ooooooooo....',
    '..oaaaabbbbbo...',
    '..oabbbbbbbbo...',
    '...obbbbbbbbco..',
    '...obbbbbbbbco..',
    '..obbbbbbbbbco..',
    '..obbbbbbbbcco..',
    '...occbbbcccco..',
    '...oooccccooo...',
    '......ooo.......'], 3), pal: { o: '#3a1e0e', a: '#c8784a', b: '#a05a30', c: '#7a3e1c' } },
  ender_pearl: { rows: pad([
    '......oooo......',
    '....oaabbbbo....',
    '...oabccccbbo...',
    '...obcddddcbo...',
    '..obcdeeeddcbo..',
    '..obcdeeeddcbo..',
    '...obcddddcbo...',
    '...obbccccbbo...',
    '....oobbbboo....',
    '......oooo......'], 3), pal: { o: '#0b2a26', a: '#7fe0c8', b: '#1f6b5e', c: '#258576', d: '#2fa08c', e: '#0e3d36' } },
  slime_ball: { rows: pad([
    '.....oooooo.....',
    '....oaaabbbo....',
    '...oawaabbbbo...',
    '...oaaabbbbco...',
    '...obbbbbbbco...',
    '...obbbbbccco...',
    '....obbccccoo...',
    '.....oooooo.....'], 4), pal: { o: '#2f6b23', a: '#a9ec8e', b: '#78c95c', c: '#56a63e', w: '#e8ffe0' } },
  ink_sac: { rows: pad([
    '......oooo......',
    '.....oaabbo.....',
    '....oawabbbo....',
    '....oaabbbbo....',
    '...oabbbbbbco...',
    '...obbbbbbcco...',
    '....obbbccco....',
    '.....oocccoo....',
    '......o..o......'], 3), pal: { o: '#0a0a12', a: '#4a4a66', b: '#25253a', c: '#16162a', w: '#8a8aa8' } },
  bone_meal: { rows: pad([
    '................',
    '.......oo.......',
    '.....ooaao......',
    '....oaawaao.....',
    '...oaaaaabao....',
    '..oaaabaaaabo...',
    '..oabaaaabaao...',
    '...oooooooooo...'], 4), pal: { o: '#9a9a94', a: '#f4f4ee', b: '#d6d6cc', w: '#ffffff' } },
  egg: { rows: pad([
    '......oooo......',
    '.....oaaabo.....',
    '....oawaabbo....',
    '....oaaaabbo....',
    '...oaaaabbbbo...',
    '...oaaabbbbco...',
    '...obbbbbbbco...',
    '....obbbbcco....',
    '.....occcco.....',
    '......oooo......'], 3), pal: { o: '#7a6248', a: '#fff6e4', b: '#efdcbc', c: '#cdb48c', w: '#ffffff' } },
  shears: { rows: pad([
    '..........oo....',
    '.........oabo...',
    '........oabo....',
    '.......oabo.....',
    '..oo..oabo......',
    '.oabo.obo.......',
    '..oabooo........',
    '...oaboo........',
    '....oo.rro......',
    '......rRRr......',
    '.....rR..Rr.....',
    '.....rR..Rr.....',
    '......rRRr......',
    '.......rr.......'], 1), pal: { o: '#2e2e2e', a: '#ffffff', b: '#b8b8b8', r: '#5a2a10', R: '#8a4a20' } },
  ladder: { rows: [
    '.kd.........kd..',
    '.hd.........hd..',
    '.hdkkkkkkkkkhd..',
    '.hhhhhhhhhhhhd..',
    '.hdddddddddddd..',
    '.hd.........hd..',
    '.hd.........hd..',
    '.hdkkkkkkkkkhd..',
    '.hhhhhhhhhhhhd..',
    '.hdddddddddddd..',
    '.hd.........hd..',
    '.hd.........hd..',
    '.hdkkkkkkkkkhd..',
    '.hhhhhhhhhhhhd..',
    '.hdddddddddddd..',
    '.hd.........hd..'], pal: { k: '#3a2a12', h: '#a07c3c', d: '#6b4f22' } },
  oak_door: { rows: [
    '....kkkkkkkk....',
    '....khhhhhhk....',
    '....khggggdk....',
    '....khgwggdk....',
    '....khggggdk....',
    '....khhhhhhk....',
    '....khddddhk....',
    '....khhhhhhk....',
    '....khddddhk....',
    '....khhhhhmk....',
    '....khddddmk....',
    '....khhhhhhk....',
    '....khddddhk....',
    '....khhhhhhk....',
    '....khddddhk....',
    '....kkkkkkkk....'], pal: { k: '#3e2c12', h: '#b08f59', d: '#8a6a3a', g: '#9cc8d8', w: '#e8f8ff', m: '#4a4a4a' } },
  white_bed: { rows: pad([
    '.p..............',
    '.pqq............',
    '.pqqwwwwwwwwwwo.',
    '.pqqwwwwwwwwwwo.',
    '.pqqWWWWWWWWWWo.',
    '.pppppppppppppp.',
    '.pddddddddddddp.',
    '.p............p.',
    '.d............d.'], 5), pal: { p: '#a2834f', d: '#6e5734', q: '#f8f8f8', w: '#ececec', W: '#c8c8c8', o: '#9a9a9a' } },
  torch: { rows: [
    '................',
    '................',
    '................',
    '.......yY.......',
    '......yWWY......',
    '......yWyY......',
    '.......oo.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '.......hd.......',
    '................'], pal: { y: '#ffd23f', Y: '#ff9a1f', W: '#fff6c0', o: '#ff7a1a', h: '#a07c3c', d: '#6b4f22' } },
};
for (const tier of Object.keys(TIERS)) for (const type of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) SPRITES[`${tier}_${type}`] = toolSprite(type, tier);

// ---------------------------------------------------------------- armor, bow, arrow (fallback art)
// These are fallbacks: when Trish's atlas has a tile with the item id (bow, arrow, all 16 armor pieces)
// the icon factory uses her tile, so the inventory matches the world. fallback: true marks that rule.
const ARMOR_SHAPES = {
  helmet: pad([
    '...oooooooooo...',
    '..oaawaaaaabo...',
    '..oawaaaaaabbo..',
    '..oaaaaaaaabbo..',
    '..oabbooooobbo..',
    '..obbo....obbo..',
    '..obbo....obbo..',
    '..oooo....oooo..'], 3),
  chestplate: pad([
    '..ooo......ooo..',
    '.oaabo....oabbo.',
    'oaaaabooooabbbbo',
    'oaawaaaaaaabbbbo',
    'ooaaaaaaaaabbboo',
    '..oaaaaaaabbbo..',
    '..oaawaaaabbbo..',
    '..oaaaaaaabbbo..',
    '..oaaaaaaabbbo..',
    '..oaaaaaabbbbo..',
    '..oooooooooooo..'], 1),
  leggings: pad([
    '...oooooooooo...',
    '...oaaaaaabbo...',
    '...oaawaaabbo...',
    '...oaaaooabbo...',
    '...oaabo.oabo...',
    '...oaabo.oabo...',
    '...oawbo.oabo...',
    '...oaabo.oabo...',
    '...oaabo.oabo...',
    '...oaabo.oabo...',
    '...oooo..oooo...'], 2),
  boots: pad([
    '..oooo....oooo..',
    '..oawo....oabo..',
    '..oabo....oabo..',
    '..oabo....oabo..',
    '.ooaabo..ooaabo.',
    'oaaaabo.oaaaabo.',
    'obbbbbo.obbbbbo.',
    'ooooooo.ooooooo.'], 6),
};
const ARMOR_PAL = {
  leather: { o: '#3b2210', a: '#a0653a', b: '#7a4a28', w: '#c48858' },
  iron:    { o: '#3a3a3a', a: '#e6e6e6', b: '#a8a8a8', w: '#ffffff' },
  golden:  { o: '#5a3d00', a: '#f6d84a', b: '#c99a1a', w: '#fffbb0' },
  diamond: { o: '#0b3633', a: '#5fe3d6', b: '#2aa79a', w: '#d5fff9' },
};
for (const [mat, pal] of Object.entries(ARMOR_PAL)) for (const slot of ARMOR_SLOTS) SPRITES[`${mat}_${slot}`] = { rows: ARMOR_SHAPES[slot], pal, fallback: true };
// empty armor slot silhouettes (drawn in the slot while it is empty, like Minecraft)
export const ARMOR_EMPTY = Object.fromEntries(ARMOR_SLOTS.map(slot => [slot, { rows: ARMOR_SHAPES[slot], pal: { o: '#6e6e6e', a: '#7d7d7d', b: '#7d7d7d', w: '#7d7d7d' } }]));
function plot(fn) { const g = Array.from({ length: 16 }, () => '.'.repeat(16).split('')); fn((x, y, ch) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = ch; }, g); return g.map(r => r.join('')); }
SPRITES.bow = { fallback: true, pal: { s: '#e8e8e8', h: '#8a6234', d: '#5a3c1a', k: '#2a1a0a' }, rows: plot(put => {
  for (let t = 0; t <= 1.0001; t += 0.02) {                                  // limb: bezier (13,2) -> (3,3) -> (2,13)
    const x = (1 - t) ** 2 * 13 + 2 * (1 - t) * t * 3 + t * t * 2, y = (1 - t) ** 2 * 2 + 2 * (1 - t) * t * 3 + t * t * 13;
    put(x, y, Math.abs(t - 0.5) < 0.12 ? 'k' : 'h'); put(x + 1, y + 1, 'd');
  }
  for (let i = 1; i <= 10; i++) put(13 - i, 2 + i, 's');                      // string, drawn last
}) };
SPRITES.arrow = { fallback: true, pal: { h: '#8a6a42', d: '#5e4528', t: '#d8d8d8', T: '#7a7a7a', f: '#ffffff', F: '#bdbdbd' }, rows: plot(put => {
  for (let i = 0; i <= 9; i++) put(3 + i, 12 - i, i % 2 ? 'h' : 'd');      // shaft
  put(13, 2, 't'); put(12, 2, 't'); put(13, 3, 't'); put(11, 2, 'T'); put(13, 4, 'T'); put(12, 3, 'T'); // head
  put(2, 13, 'f'); put(3, 13, 'F'); put(2, 12, 'F'); put(1, 13, 'f'); put(2, 14, 'f'); put(4, 13, 'f'); put(2, 11, 'f'); put(3, 14, 'F'); put(1, 12, 'F'); // fletching
}) };
SPRITES.spider_eye = { pal: { o: '#3a0a0a', a: '#c8303a', b: '#8f1a22', w: '#ff9aa0', p: '#1a0505' }, rows: plot(put => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 8.5); if (d < 5.2) put(x, y, d > 4.4 ? 'o' : x + y < 12 ? 'w' : x + y > 18 ? 'b' : 'a'); }
  put(8, 9, 'p'); put(9, 9, 'p'); put(8, 10, 'p'); put(9, 10, 'p');
}) };

// fences, fence gates, trapdoor, boats, flint & steel (MC-style item sprites; wood-colored per type)
const WOOD_PAL = {
  oak:    { o: '#3e2c12', a: '#b08f59', b: '#8a6a3a', c: '#6b5232', w: '#d4b87a' },
  spruce: { o: '#261a0e', a: '#7a5a36', b: '#6b4c2c', c: '#3f2c18', w: '#8a6a42' },
  birch:  { o: '#6a5a30', a: '#ddce96', b: '#c8b77a', c: '#9a8a55', w: '#f0e6bc' },
};
const FENCE_ROWS = pad([
  '..o..o....o..o..',
  '..a..a....a..a..',
  '.aaaaaaaaaaaaaa.',
  '.bbbbbbbbbbbbbb.',
  '..b..b....b..b..',
  '..b..b....b..b..',
  '.aaaaaaaaaaaaaa.',
  '.bbbbbbbbbbbbbb.',
  '..b..b....b..b..',
  '..c..c....c..c..',
  '..c..c....c..c..',
  '..o..o....o..o..'], 2);
const GATE_ROWS = pad([
  '................',
  '..o..........o..',
  '..a..aaaaaa..a..',
  '..a..bbbbbb..a..',
  '..a..b....b..a..',
  '..a..b.ww.b..a..',
  '..a..b....b..a..',
  '..a..bbbbbb..a..',
  '..a..aaaaaa..a..',
  '..c..........c..',
  '..c..........c..',
  '..o..........o..'], 2);
const TRAP_ROWS = pad([
  'oooooooooooooooo',
  'oaawaaaaaaaabbbo',
  'oaaaaaaaaaaabbbo',
  'oa.........abbbo',
  'oa.ooooooo.abbbo',
  'oa.aaaaaab.abbbo',
  'oa.a.....b.abbbo',
  'oa.a.www.b.abbbo',
  'oa.a.....b.abbbo',
  'oa.abbbbbb.abbbo',
  'oa.ooooooo.abbbo',
  'oa.........abbbo',
  'oaaaaaaaaaaabbbo',
  'oabbbbbbbbbbbbbo',
  'oooooooooooooooo'], 0);
const BOAT_ROWS = pad([
  '................',
  '................',
  '....oooooooo....',
  '...oaaaaaaaabo..',
  '..oaawaaaaaabbo.',
  '.oaaaaaaaaaabbbo',
  'oaaaaaaaaaaabbbo',
  'oabbbbbbbbbbbbbo',
  'occcccccccccccco',
  '.oooooooooooooo.',
  '................',
  '................'], 2);
SPRITES.flint_and_steel = { pal: { o: '#2a2a2a', a: '#e8e8e8', b: '#a8a8a8', c: '#6a6a6a', s: '#4a4a4a', f: '#ff9a2a', F: '#ffd24a' }, rows: pad([
  '.............ff.',
  '............fFf.',
  '...........fFfo.',
  '..........osso..',
  '.........osso...',
  '........oabo....',
  '.......oaabo....',
  '......oaabo.....',
  '.....oaabo......',
  '....oaabo.......',
  '...oaabo........',
  '..ocabo.........',
  '.occbo..........',
  '.occo...........',
  '..oo............'], 1) };
SPRITES.oak_trapdoor = { rows: TRAP_ROWS, pal: WOOD_PAL.oak };
for (const wood of ['oak', 'spruce', 'birch']) {
  const pal = WOOD_PAL[wood];
  SPRITES[`${wood}_fence`] = { rows: FENCE_ROWS, pal };
  SPRITES[`${wood}_fence_gate`] = { rows: GATE_ROWS, pal };
  SPRITES[`${wood}_boat`] = { rows: BOAT_ROWS, pal };
}

// ---------------------------------------------------------------- fallback block tiles
// Blocks the atlas does not (yet) have. Each returns a 16x16 color grid (rows of hex or null).
function tileFrom(fn, seed = 1) { let s = seed >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); const g = []; for (let y = 0; y < 16; y++) { g.push([]); for (let x = 0; x < 16; x++) g[y].push(fn(x, y, r)); } return g; }
const pick = (r, cols) => cols[(r() * cols.length) | 0];
const STONEY = ['#7f7f7f', '#8a8a8a', '#747474', '#6b6b6b'];
const PLANK = ['#a2834f', '#b08f59', '#94774a'];
export const TILES = {
  furnace_side: () => tileFrom((x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15 ? '#5c5c5c' : y % 5 === 4 || (x + (y / 5 | 0) * 5) % 8 === 7 ? '#666666' : pick(r, STONEY)), 3),
  furnace_top: () => tileFrom((x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15 ? '#5c5c5c' : pick(r, ['#8e8e8e', '#9a9a9a', '#858585'])), 5),
  furnace_front: () => tileFrom((x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#5c5c5c';
    if (x >= 4 && x <= 11 && y >= 8 && y <= 13) return y === 8 || x === 4 || x === 11 ? '#3a3a3a' : '#141414';
    if (x >= 3 && x <= 12 && y === 7) return '#a8a8a8';
    if (x >= 4 && x <= 11 && y >= 2 && y <= 4) return y === 3 && x > 4 && x < 11 ? '#1e1e1e' : '#5a5a5a';
    return pick(r, STONEY);
  }, 7),
  chest_front: () => tileFrom((x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '#3e2c12';
    if (y === 6) return '#3e2c12';
    if (x >= 7 && x <= 8 && y >= 5 && y <= 8) return y === 8 ? '#6a6a6a' : '#cfcfcf';
    return y % 4 === 1 ? '#8a6a3a' : pick(r, PLANK);
  }, 11),
  chest_side: () => tileFrom((x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15 || y === 6 ? '#3e2c12' : y % 4 === 1 ? '#8a6a3a' : pick(r, PLANK)), 13),
  chest_top: () => tileFrom((x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15 ? '#3e2c12' : x % 5 === 2 ? '#8a6a3a' : pick(r, PLANK)), 17),
  white_wool: () => tileFrom((x, y, r) => pick(r, ['#ececec', '#f6f6f6', '#dedede', '#e6e6e6', (x + y) % 4 === 0 ? '#d2d2d2' : '#efefef']), 19),
  black_wool: () => tileFrom((x, y, r) => pick(r, ['#1d1d21', '#252529', '#17171b', '#222226', (x + y) % 4 === 0 ? '#101014' : '#1a1a1e']), 41),
  brown_wool: () => tileFrom((x, y, r) => pick(r, ['#835432', '#945f3a', '#73482a', '#8c5a36', (x + y) % 4 === 0 ? '#6a3f22' : '#875834']), 43),
  gray_wool: () => tileFrom((x, y, r) => pick(r, ['#3e4447', '#4a5054', '#353a3d', '#454b4e', (x + y) % 4 === 0 ? '#2c3134' : '#40464a']), 47),
  light_gray_wool: () => tileFrom((x, y, r) => pick(r, ['#8e8e86', '#9a9a92', '#82827a', '#94948c', (x + y) % 4 === 0 ? '#74746c' : '#888880']), 53),
  pink_wool: () => tileFrom((x, y, r) => pick(r, ['#ed8dac', '#f49ab8', '#e07a9c', '#f0a0b8', (x + y) % 4 === 0 ? '#d86a90' : '#ee94b0']), 67),
  // hay bale: top has spiral end-grain, side has straw stripes + red-brown binding bands
  hay_top: () => tileFrom((x, y, r) => {
    const cx = 7.5, cy = 7.5, dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
    if (dist < 1.2) return '#c9a24a';
    if (dist > 7.2) return pick(r, ['#8a6a28', '#7a5a1e', '#9a7a32']);
    const ring = Math.floor(dist);
    const spiral = ((ang / Math.PI + 1) * 4 + ring * 0.7 + r() * 0.3) % 2 < 1;
    return spiral ? pick(r, ['#e8c86a', '#d4b050', '#f0d478']) : pick(r, ['#b8923a', '#a07a28', '#c4a044']);
  }, 59),
  hay_side: () => tileFrom((x, y, r) => {
    // red-brown binding bands near top and bottom (MC hay bale look)
    if (y === 2 || y === 3 || y === 12 || y === 13) return pick(r, ['#8a3a1e', '#9a4424', '#7a3018', '#a04c2a']);
    // vertical straw stripes
    const stripe = (x + (y % 3 === 0 ? 1 : 0)) % 3;
    if (stripe === 0) return pick(r, ['#e8c86a', '#f0d478', '#dcc060']);
    if (stripe === 1) return pick(r, ['#c4a044', '#b8923a', '#d0ac50']);
    return pick(r, ['#a07a28', '#8a6a22', '#b08830']);
  }, 61),
  iron_block: () => tileFrom((x, y, r) => (x === 0 || y === 0 ? '#ffffff' : x === 15 || y === 15 ? '#9a9a9a' : (x + y) % 9 === 0 && x < 13 && y < 13 ? '#f6f6f6' : pick(r, ['#dcdcdc', '#d4d4d4', '#e2e2e2'])), 23),
  gold_block: () => tileFrom((x, y, r) => (x === 0 || y === 0 ? '#fffbb0' : x === 15 || y === 15 ? '#b8830f' : (x + y) % 9 === 0 && x < 13 && y < 13 ? '#fff6a0' : pick(r, ['#f7d13c', '#f0c42c', '#fbd94a'])), 29),
  diamond_block: () => tileFrom((x, y, r) => (x === 0 || y === 0 ? '#d8fffa' : x === 15 || y === 15 ? '#1f9a8e' : (x === y || x === 15 - y) && x > 2 && x < 13 ? '#b6fff5' : pick(r, ['#62e8da', '#55dccf', '#6ff0e2'])), 31),
  coal_block: () => tileFrom((x, y, r) => (x === 0 || y === 0 ? '#3a3a3a' : x === 15 || y === 15 ? '#0a0a0a' : pick(r, ['#1c1c1c', '#232323', '#151515', (x * y) % 7 === 0 ? '#3a3a3a' : '#1a1a1a'])), 37),
};
// generic fallbacks for atlas blocks (used only if textures.js is missing a tile)
const FLAT = { grass: '#5f9f35', dirt: '#79553a', stone: '#7f7f7f', cobblestone: '#777777', sand: '#dbd3a0', gravel: '#857b78', bedrock: '#3a3a3a', oak_log: '#6b5132', oak_planks: '#a2834f', oak_leaves: '#3e7d2a', glass: '#d9eef5', coal_ore: '#6f6f6f', iron_ore: '#8f8478', gold_ore: '#8f8a5a', diamond_ore: '#6f9a9a', crafting_table: '#8a6a3a', spruce_log: '#3b2a18', spruce_planks: '#6b4c2c', spruce_leaves: '#2f4f2f', birch_planks: '#c8b77a', birch_log: '#dcdad3', tnt: '#c4372b' };
const BLOCK_TILES = {
  // furnace + chest (+ white_wool in atlas) prefer Trish's textures.js when present;
  // colored wool + hay are not in the atlas yet, so keep own tiles.
  white_wool: { all: 'white_wool' },
  // colored wool + hay now come from Trish's atlas
  iron_block: { all: 'iron_block' }, gold_block: { all: 'gold_block' },
  diamond_block: { all: 'diamond_block' }, coal_block: { all: 'coal_block' },
};

// ---------------------------------------------------------------- canvas helpers
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
export function spriteCanvas(sp) {
  const [c, g] = mk(16, 16), img = g.createImageData(16, 16);
  sp.rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = sp.pal[ch]; if (!col) return; const [r, gg, b] = hex(col), i = (y * 16 + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255; }));
  g.putImageData(img, 0, 0); return c;
}
function gridCanvas(grid) { const [c, g] = mk(16, 16); grid.forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } })); return c; }
function solid(col) { const [c, g] = mk(16, 16); g.fillStyle = col; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16); return c; }

/* Icon factory. atlas = buildAtlas() result ({canvas, size, uv(name), names}); faceTex(block, face) from textures.js.
   Returns icon(id) -> 16x16-or-larger canvas (cached). Block cubes are 64x64 for smooth isometric edges. */
export function createIconFactory(atlas, faceTex) {
  const cache = new Map(), tileCache = new Map();
  const has = n => !!(atlas && atlas.names && atlas.names.includes(n));
  function atlasTile(name) {
    if (tileCache.has(name)) return tileCache.get(name);
    let c = null;
    if (has(name)) {
      const [u0, , , v1] = atlas.uv(name), x = Math.round(u0 * atlas.size - 0.5), y = Math.round((1 - v1) * atlas.size - 0.5);
      let g; [c, g] = mk(16, 16); g.drawImage(atlas.canvas, x, y, 16, 16, 0, 0, 16, 16);
    }
    tileCache.set(name, c); return c;
  }
  // resolve the texture canvas for one face of a block
  function face(id, f) {
    const own = BLOCK_TILES[id];
    if (own) { const n = own[f] || (f === 'front' ? own.side : null) || own.all || own.side; const k = 'own:' + n; if (!tileCache.has(k)) tileCache.set(k, gridCanvas(TILES[n]())); return tileCache.get(k); }
    let name = null;
    if (faceTex) { try { name = faceTex(id, f); } catch (e) { name = null; } if (name === 'stone' && id !== 'stone') name = null; }
    if (!name || !has(name)) name = [id + '_' + f, f === 'side' ? id : null, id].find(n => n && has(n));
    return (name && atlasTile(name)) || solid(FLAT[id] || '#888888');
  }
  function shaded(tile, k) { const [c, g] = mk(16, 16); g.drawImage(tile, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${k})`; g.fillRect(0, 0, 16, 16); return c; }
  function cube(id) {
    const S = 64, [c, g] = mk(S, S);
    const top = face(id, 'top'), left = face(id, 'front'), right = face(id, 'side');
    // slight overdraw (1.04) hides seams between faces
    g.setTransform(1.75, 0.875, -1.75, 0.875, 32, 2); g.drawImage(top, 0, 0, 16, 16, -0.15, -0.15, 16.3, 16.3);
    g.setTransform(1.75, 0.875, 0, 2, 4, 16); g.drawImage(shaded(left, 0.22), 0, 0, 16, 16, 0, -0.1, 16.1, 16.2);
    g.setTransform(1.75, -0.875, 0, 2, 32, 30); g.drawImage(shaded(right, 0.42), 0, 0, 16, 16, -0.1, -0.1, 16.1, 16.2);
    g.setTransform(1, 0, 0, 1, 0, 0); return c;
  }
  function flatFromAtlas(id) { const t = atlasTile(id); return t; }
  function icon(id) {
    if (cache.has(id)) return cache.get(id);
    const it = ITEMS[id]; let c;
    // flat items: my hand-drawn sprite unless it is marked fallback (then Trish's atlas tile wins when she has one)
    const sp = SPRITES[id], atlasFirst = (sp && sp.fallback) || id === 'torch';
    if (sp && !(atlasFirst && has(id))) c = spriteCanvas(sp);
    else if (it && it.block && !it.flat) c = cube(id);
    else c = flatFromAtlas(id) || (sp ? spriteCanvas(sp) : missing());
    cache.set(id, c); return c;
  }
  function missing() { const [c, g] = mk(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = ((x >> 3) + (y >> 3)) % 2 ? '#f800f8' : '#000'; g.fillRect(x, y, 1, 1); } return c; }
  function emptyArmor(slot) { const k = 'empty:' + slot; if (!cache.has(k)) cache.set(k, ARMOR_EMPTY[slot] ? spriteCanvas(ARMOR_EMPTY[slot]) : null); return cache.get(k); }
  return { icon, face, cube, emptyArmor, clear: () => { cache.clear(); tileCache.clear(); } };
}

// ---------------------------------------------------------------- pixel font (original 5x7, variable width)
const F = {};
const def = (chars, ...glyphs) => [...chars].forEach((ch, i) => (F[ch] = glyphs[i]));
def('ABCDEFGHIJKLM',
  ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], ['####.', '#...#', '####.', '#...#', '#...#', '#...#', '####.'],
  ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  ['#####', '#....', '###..', '#....', '#....', '#....', '#####'], ['#####', '#....', '###..', '#....', '#....', '#....', '#....'],
  ['.####', '#....', '#..##', '#...#', '#...#', '#...#', '.###.'], ['#...#', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
  ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], ['....#', '....#', '....#', '....#', '....#', '#...#', '.###.'],
  ['#...#', '#..#.', '###..', '#..#.', '#...#', '#...#', '#...#'], ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#']);
def('NOPQRSTUVWXYZ',
  ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'], ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['####.', '#...#', '####.', '#....', '#....', '#....', '#....'], ['.###.', '#...#', '#...#', '#...#', '#...#', '#..#.', '.##.#'],
  ['####.', '#...#', '####.', '#...#', '#...#', '#...#', '#...#'], ['.####', '#....', '.###.', '....#', '....#', '#...#', '.###.'],
  ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'], ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#', '#...#'], ['#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..', '..#..'],
  ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####']);
def('abcdefghijklm',
  ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'], ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '####.'],
  ['.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.'], ['....#', '....#', '.##.#', '#..##', '#...#', '#...#', '.####'],
  ['.....', '.....', '.###.', '#...#', '#####', '#....', '.####'], ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '####.'], ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  ['#', '.', '#', '#', '#', '#', '#'], ['....#', '.....', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'], ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#']);
def('nopqrstuvwxyz',
  ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'], ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  ['.....', '.....', '#.##.', '##..#', '#...#', '####.', '#....', '#....'], ['.....', '.....', '.##.#', '#..##', '#...#', '.####', '....#', '....#'],
  ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'], ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'], ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'], ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.####'],
  ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'], ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '####.'],
  ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####']);
def('0123456789',
  ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  ['.###.', '#...#', '....#', '..##.', '.#...', '#...#', '#####'], ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  ['...##', '..#.#', '.#..#', '#...#', '#####', '....#', '....#'], ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], ['#####', '#...#', '....#', '...#.', '..#..', '..#..', '..#..'],
  ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..']);
def(" .,:/-()!?'+%",
  ['...', '...', '...', '...', '...', '...', '...'], ['.', '.', '.', '.', '.', '.', '#'], ['.', '.', '.', '.', '.', '#', '#', '#'],
  ['.', '#', '.', '.', '.', '#', '.'], ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  ['.....', '.....', '.....', '#####', '.....', '.....', '.....'], ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'], ['#', '#', '#', '#', '#', '.', '#'],
  ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], ['#', '#', '.', '.', '.', '.', '.'],
  ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], ['#...#', '....#', '...#.', '..#..', '.#...', '#....', '#...#']);
export const FONT = F;
export const textWidth = s => [...s].reduce((w, ch) => w + ((F[ch] || F['?'])[0].length + 1), 0) - (s.length ? 1 : 0);
// draw text at (x,y) in font pixels, each font pixel = u device pixels. shadow like Minecraft (+1,+1, 1/4 brightness)
export function drawText(g, s, x, y, color = '#ffffff', u = 1, shadow = true) {
  const pass = (ox, oy, col) => {
    g.fillStyle = col; let cx = x;
    for (const ch of s) { const gl = F[ch] || F['?']; gl.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect((cx + rx + ox) * u, (y + ry + oy) * u, u, u); }); cx += gl[0].length + 1; }
  };
  if (shadow) { const [r, gg, b] = hex(color); pass(1, 1, `rgb(${r >> 2},${gg >> 2},${b >> 2})`); }
  pass(0, 0, color);
}
export function textCanvas(s, color, u, shadow = true) {
  const w = textWidth(s) + (shadow ? 1 : 0), h = 9; const [c, g] = mk(w * u, h * u); drawText(g, s, 0, 0, color, u, shadow); return c;
}
