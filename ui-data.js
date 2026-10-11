/* Blockcraft 3D - UI data model (Timmy)
   Pure logic, no DOM: items, stacks, the 36-slot inventory, crafting recipes
   (2x2 + 3x3, shaped with mirroring + shapeless), furnace smelting/fuel, and the
   click/drag rules of an open container screen (a "Session").
   Runs in the browser and in node (see ui.test.mjs). Item ids for blocks match the
   block names in textures.js (grass, dirt, stone, oak_log, crafting_table, ...).
*/

// ---------------------------------------------------------------- items
export const ITEMS = {};
const TIERS = {
  wooden:  { name: 'Wooden',  level: 0, durability: 59,   speed: 2,  material: '#planks',     sword: 4, axe: 7, fuel: 200 },
  stone:   { name: 'Stone',   level: 1, durability: 131,  speed: 4,  material: 'cobblestone', sword: 5, axe: 9 },
  iron:    { name: 'Iron',    level: 2, durability: 250,  speed: 6,  material: 'iron_ingot',  sword: 6, axe: 9 },
  golden:  { name: 'Golden',  level: 0, durability: 32,   speed: 12, material: 'gold_ingot',  sword: 4, axe: 7 },
  diamond: { name: 'Diamond', level: 3, durability: 1561, speed: 8,  material: 'diamond',     sword: 7, axe: 9 },
};
export { TIERS };
export const TOOL_TYPES = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];

function def(id, name, o = {}) { ITEMS[id] = { id, name, stack: 64, ...o }; return ITEMS[id]; }
// blocks: block = block id the engine should place (same as item id)
const block = (id, name, o) => def(id, name, { block: id, ...o });

block('grass', 'Grass Block', { drops: 'dirt' });
block('dirt', 'Dirt');
block('stone', 'Stone', { drops: 'cobblestone', needs: 0 });
block('cobblestone', 'Cobblestone', { needs: 0 });
block('sand', 'Sand');
block('gravel', 'Gravel');
block('bedrock', 'Bedrock');
block('oak_log', 'Oak Log', { fuel: 300 });
block('oak_planks', 'Oak Planks', { fuel: 300 });
block('oak_leaves', 'Oak Leaves');
block('glass', 'Glass', { drops: null });
block('coal_ore', 'Coal Ore', { drops: 'coal', needs: 0 });
block('iron_ore', 'Iron Ore', { drops: 'raw_iron', needs: 1 });
block('gold_ore', 'Gold Ore', { drops: 'raw_gold', needs: 2 });
block('diamond_ore', 'Diamond Ore', { drops: 'diamond', needs: 2 });
block('crafting_table', 'Crafting Table', { fuel: 300 });
block('furnace', 'Furnace', { needs: 0 });
block('chest', 'Chest', { fuel: 300 });
block('torch', 'Torch', { flat: true });
block('ladder', 'Ladder', { flat: true, fuel: 300 });
block('oak_door', 'Oak Door', { flat: true, fuel: 200 });
block('white_bed', 'White Bed', { flat: true, stack: 1 });
block('white_wool', 'White Wool', { fuel: 100 });
block('black_wool', 'Black Wool', { fuel: 100 });
block('brown_wool', 'Brown Wool', { fuel: 100 });
block('gray_wool', 'Gray Wool', { fuel: 100 });
block('light_gray_wool', 'Light Gray Wool', { fuel: 100 });
block('pink_wool', 'Pink Wool', { fuel: 100 });
block('hay_block', 'Hay Bale');
block('iron_block', 'Block of Iron', { needs: 1 });
block('gold_block', 'Block of Gold', { needs: 2 });
block('diamond_block', 'Block of Diamond', { needs: 2 });
block('coal_block', 'Block of Coal', { fuel: 16000, needs: 0 });
block('obsidian', 'Obsidian', { needs: 3 });
// blocks from Mike's blocks.js (same shape his engine would auto-add, so names, icons and fuel are known up front)
block('snowy_grass', 'Snowy Grass', { drops: 'dirt' });
block('sandstone', 'Sandstone');
block('birch_log', 'Birch Log', { fuel: 300 });
block('birch_leaves', 'Birch Leaves', { drops: null });
block('cactus', 'Cactus');
block('bricks', 'Bricks');
block('stone_bricks', 'Stone Bricks');
block('snow_block', 'Snow Block');
block('oak_sapling', 'Oak Sapling', { flat: true, fuel: 100 });
block('birch_sapling', 'Birch Sapling', { flat: true, fuel: 100 });
block('spruce_sapling', 'Spruce Sapling', { flat: true, fuel: 100 });
block('spruce_log', 'Spruce Log', { fuel: 300 });
block('spruce_planks', 'Spruce Planks', { fuel: 300 });
block('spruce_leaves', 'Spruce Leaves', { drops: null });
block('birch_planks', 'Birch Planks', { fuel: 300 });
block('oak_fence', 'Oak Fence', { fuel: 300 });
block('spruce_fence', 'Spruce Fence', { fuel: 300 });
block('birch_fence', 'Birch Fence', { fuel: 300 });
block('oak_fence_gate', 'Oak Fence Gate', { fuel: 300 });
block('spruce_fence_gate', 'Spruce Fence Gate', { fuel: 300 });
block('birch_fence_gate', 'Birch Fence Gate', { fuel: 300 });
block('oak_trapdoor', 'Oak Trapdoor', { fuel: 300 });
block('tnt', 'TNT');
block('short_grass', 'Grass', { flat: true, drops: null });
block('dandelion', 'Dandelion', { flat: true });
block('poppy', 'Poppy', { flat: true });

def('stick', 'Stick', { fuel: 100 });
def('coal', 'Coal', { fuel: 1600 });
def('charcoal', 'Charcoal', { fuel: 1600 });
def('raw_iron', 'Raw Iron');
def('raw_gold', 'Raw Gold');
def('iron_ingot', 'Iron Ingot');
def('gold_ingot', 'Gold Ingot');
def('diamond', 'Diamond');
def('flint', 'Flint');
def('wheat_seeds', 'Wheat Seeds');
def('wheat', 'Wheat');
def('string', 'String');
def('feather', 'Feather');
def('gunpowder', 'Gunpowder');
def('bone', 'Bone');
def('leather', 'Leather');
def('egg', 'Egg', { stack: 16 });
def('ender_pearl', 'Ender Pearl', { stack: 16 });
def('slime_ball', 'Slimeball');
def('bone_meal', 'Bone Meal');
def('ink_sac', 'Ink Sac');
def('bucket', 'Bucket', { stack: 16 });
def('water_bucket', 'Water Bucket', { stack: 1, remainder: 'bucket' });
def('lava_bucket', 'Lava Bucket', { stack: 1, remainder: 'bucket', fuel: 20000 });
def('shears', 'Shears', { stack: 1, durability: 238, tool: { type: 'shears', level: 0, speed: 1.5 } });
def('flint_and_steel', 'Flint and Steel', { stack: 1, durability: 64 });
def('oak_boat', 'Oak Boat', { stack: 1 });
def('spruce_boat', 'Spruce Boat', { stack: 1 });
def('birch_boat', 'Birch Boat', { stack: 1 });
// food: value = hunger points restored
def('apple', 'Apple', { food: 4 });
def('bread', 'Bread', { food: 5 });
def('porkchop', 'Raw Porkchop', { food: 3 });
def('cooked_porkchop', 'Cooked Porkchop', { food: 8 });
def('beef', 'Raw Beef', { food: 3 });
def('cooked_beef', 'Steak', { food: 8 });
def('chicken', 'Raw Chicken', { food: 2 });
def('cooked_chicken', 'Cooked Chicken', { food: 6 });
def('mutton', 'Raw Mutton', { food: 2 });
def('cooked_mutton', 'Cooked Mutton', { food: 6 });
def('rotten_flesh', 'Rotten Flesh', { food: 4 });
def('carrot', 'Carrot', { food: 3 });
def('spider_eye', 'Spider Eye', { food: 2 });
// ranged
def('bow', 'Bow', { stack: 1, durability: 384, fuel: 300, ranged: true });
def('arrow', 'Arrow');
// armor (Minecraft Java values). armor = { slot, def (armor points), tough (toughness) }; same shape Mike's engine reads.
export const ARMOR_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];
export const ARMOR_MATERIALS = {
  leather: { name: 'Leather', material: 'leather',    def: [1, 3, 2, 1], durability: [55, 80, 75, 65],     tough: 0 },
  iron:    { name: 'Iron',    material: 'iron_ingot', def: [2, 6, 5, 2], durability: [165, 240, 225, 195], tough: 0 },
  golden:  { name: 'Golden',  material: 'gold_ingot', def: [2, 5, 3, 1], durability: [77, 112, 105, 91],   tough: 0 },
  diamond: { name: 'Diamond', material: 'diamond',    def: [3, 8, 6, 3], durability: [363, 528, 495, 429], tough: 2 },
};
const LEATHER_NAMES = ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots'];
const PIECE_NAMES = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
for (const [mat, A] of Object.entries(ARMOR_MATERIALS)) ARMOR_SLOTS.forEach((slot, i) => {
  def(`${mat}_${slot}`, mat === 'leather' ? LEATHER_NAMES[i] : `${A.name} ${PIECE_NAMES[i]}`, {
    stack: 1, durability: A.durability[i], armor: { slot, def: A.def[i], tough: A.tough, material: mat },
  });
});
// tools: wooden_pickaxe ... diamond_hoe
for (const [tier, t] of Object.entries(TIERS)) for (const type of TOOL_TYPES) {
  const id = `${tier}_${type}`, nm = type[0].toUpperCase() + type.slice(1);
  def(id, `${t.name} ${nm}`, {
    stack: 1, durability: t.durability, fuel: t.fuel,
    tool: { type, tier, level: t.level, speed: t.speed, damage: type === 'sword' ? t.sword : type === 'axe' ? t.axe : type === 'pickaxe' ? t.sword - 2 : t.sword - 3 },
  });
}

export const item = id => ITEMS[id] || null;
export const maxStack = id => (ITEMS[id] ? ITEMS[id].stack : 64);
export const itemName = id => (ITEMS[id] ? ITEMS[id].name : String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

// ---------------------------------------------------------------- stacks
// a stack is { id, count, damage? } ; damage = durability used so far (tools only)
export function makeStack(id, count = 1, damage = 0) {
  const s = { id, count: Math.max(1, count | 0) };
  if (ITEMS[id] && ITEMS[id].durability && damage) s.damage = damage | 0;
  return s;
}
export const cloneStack = s => (s ? { ...s } : null);
// two stacks can merge when they are the same item and the item stacks above 1
export const canStack = (a, b) => !!a && !!b && a.id === b.id && maxStack(a.id) > 1 && (a.damage | 0) === (b.damage | 0);

// ---------------------------------------------------------------- inventory
export const HOTBAR = 9, INV_SIZE = 36;
export const armorSlotOf = id => (ITEMS[id] && ITEMS[id].armor ? ITEMS[id].armor.slot : null);
export const emptyArmor = () => ({ helmet: null, chestplate: null, leggings: null, boots: null });
/* Minecraft damage after armor (Java): dmg * (1 - min(20, max(def/5, def - 4*dmg/(tough+8))) / 25).
   Returns a float; keep the fraction (or carry it) so full diamond is not immune to small hits. */
export function armorReduce(dmg, points, tough = 0) {
  if (!(dmg > 0)) return 0;
  const red = Math.min(20, Math.max(points / 5, points - (4 * dmg) / (tough + 8)));
  return dmg * (1 - red / 25);
}
export class Inventory {
  // armor: optional object { helmet, chestplate, leggings, boots } to share with the engine (mutated in place)
  constructor(armor) {
    this.slots = new Array(INV_SIZE).fill(null); this.selected = 0;
    this.armor = armor && typeof armor === 'object' ? armor : emptyArmor();
    for (const k of ARMOR_SLOTS) if (!this.armor[k]) this.armor[k] = null;
  }
  armorList() { return ARMOR_SLOTS.map(k => this.armor[k]); }
  armorPoints() { return ARMOR_SLOTS.reduce((n, k) => { const s = this.armor[k], a = s && ITEMS[s.id] && ITEMS[s.id].armor; return n + (a ? a.def : 0); }, 0); }
  armorToughness() { return ARMOR_SLOTS.reduce((n, k) => { const s = this.armor[k], a = s && ITEMS[s.id] && ITEMS[s.id].armor; return n + (a ? a.tough : 0); }, 0); }
  /* Minecraft armor wear for a hit of `dmg` (Java): every worn piece loses max(1, floor(dmg/4)) durability,
     and a piece whose damage reaches its durability breaks (slot empties). Returns the ids that broke. */
  damageArmor(dmg = 1) {
    const broke = []; if (!(dmg > 0)) return broke;
    const wear = Math.max(1, Math.floor(dmg / 4));
    for (const k of ARMOR_SLOTS) {
      const s = this.armor[k], it = s && ITEMS[s.id]; if (!s || !it || !it.durability) continue;
      s.damage = (s.damage | 0) + wear;
      if (s.damage >= it.durability) { this.armor[k] = null; broke.push(s.id); }
    }
    return broke;
  }
  // wear the selected hotbar item if it is armor (swaps with what was worn, like Minecraft 1.19.4+). Returns the slot name or null.
  equipSelected() {
    const s = this.slots[this.selected], slot = s && armorSlotOf(s.id); if (!slot) return null;
    const old = this.armor[slot]; // armor never stacks, so this is a straight swap
    this.armor[slot] = { ...s, count: 1 }; this.slots[this.selected] = old ? { ...old } : null;
    return slot;
  }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && s.count > 0 ? s : null; }
  selectedStack() { return this.slots[this.selected]; }
  select(i) { this.selected = ((i % HOTBAR) + HOTBAR) % HOTBAR; }
  // Minecraft pickup order: top up matching stacks (selected slot first, then 0..35), then first empty slot.
  // Returns the count that did not fit.
  add(id, count = 1, damage = 0) {
    if (!ITEMS[id] && typeof id !== 'string') return count;
    let left = count | 0; const max = maxStack(id), probe = makeStack(id, 1, damage);
    const order = [this.selected, ...Array.from({ length: INV_SIZE }, (_, i) => i).filter(i => i !== this.selected)];
    if (max > 1) for (const i of order) {
      const s = this.slots[i]; if (!left) break;
      if (s && canStack(s, probe) && s.count < max) { const n = Math.min(max - s.count, left); s.count += n; left -= n; }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) if (!this.slots[i]) {
      const n = Math.min(max, left); this.slots[i] = makeStack(id, n, damage); left -= n;
    }
    return left;
  }
  // how many of `id` would fit right now
  room(id) {
    const max = maxStack(id); let r = 0;
    for (const s of this.slots) r += !s ? max : (s.id === id && max > 1 && !s.damage ? max - s.count : 0);
    return r;
  }
  count(id) { return this.slots.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0); }
  has(id, n = 1) { return this.count(id) >= n; }
  // remove up to n of an item from anywhere (main inventory first, hotbar last); returns removed count
  removeItem(id, n = 1) {
    let left = n;
    const order = [...Array.from({ length: 27 }, (_, i) => 35 - i), ...Array.from({ length: 9 }, (_, i) => 8 - i)];
    for (const i of order) { const s = this.slots[i]; if (!left) break; if (s && s.id === id) { const k = Math.min(s.count, left); s.count -= k; left -= k; if (!s.count) this.slots[i] = null; } }
    return n - left;
  }
  removeAt(i, n = 1) {
    const s = this.slots[i]; if (!s) return null;
    const k = Math.min(n, s.count); s.count -= k; if (!s.count) this.slots[i] = null;
    return { ...s, count: k };
  }
  removeSelected(n = 1) { return this.removeAt(this.selected, n); }
  // wear the selected tool; returns true when it breaks (slot is emptied)
  damageSelected(n = 1) {
    const s = this.slots[this.selected]; if (!s) return false;
    const it = ITEMS[s.id]; if (!it || !it.durability) return false;
    s.damage = (s.damage | 0) + n;
    if (s.damage >= it.durability) { this.slots[this.selected] = null; return true; }
    return false;
  }
  clear() { this.slots.fill(null); for (const k of ARMOR_SLOTS) this.armor[k] = null; }
  toJSON() { return { v: 1, selected: this.selected, slots: this.slots.map(s => (s ? { ...s } : null)), armor: Object.fromEntries(ARMOR_SLOTS.map(k => [k, this.armor[k] ? { ...this.armor[k] } : null])) }; }
  // armor in the save is optional: a save without `armor` leaves the worn armor untouched (the engine may save it itself)
  load(d) {
    this.slots.fill(null);
    if (!d || !Array.isArray(d.slots)) return this;
    d.slots.slice(0, INV_SIZE).forEach((s, i) => { if (s && s.id && s.count > 0) this.slots[i] = makeStack(s.id, Math.min(s.count, maxStack(s.id)), s.damage); });
    if (d.armor && typeof d.armor === 'object') for (const k of ARMOR_SLOTS) { const s = d.armor[k]; this.armor[k] = s && s.id && armorSlotOf(s.id) === k ? makeStack(s.id, 1, s.damage) : null; }
    this.select(d.selected | 0); return this;
  }
}
export function durabilityOf(s) {
  const it = s && ITEMS[s.id]; if (!it || !it.durability) return null;
  return { max: it.durability, left: it.durability - (s.damage | 0), frac: 1 - (s.damage | 0) / it.durability };
}

// ---------------------------------------------------------------- recipes
// Shaped: pattern rows + key. Key values are an item id or an array of accepted ids.
// Shapeless: ingredients list. Matching ignores position in the grid and accepts the
// horizontal mirror of every shaped pattern (exactly like Minecraft).
// Item tags (Minecraft-style). Recipe keys may use a tag id like '#planks' or an array of ids/tags.
export const TAGS = {
  '#planks': ['oak_planks', 'birch_planks', 'spruce_planks'],
  '#logs': ['oak_log', 'birch_log', 'spruce_log'],
};
export const RECIPES = [];
const shaped = (pattern, key, id, count = 1) => RECIPES.push({ type: 'shaped', pattern, key, result: { id, count } });
const shapeless = (ingredients, id, count = 1) => RECIPES.push({ type: 'shapeless', ingredients, result: { id, count } });
const FUELISH_COAL = ['coal', 'charcoal'];
const PLANKS = '#planks';

shapeless(['oak_log'], 'oak_planks', 4);
shapeless(['birch_log'], 'birch_planks', 4);
shapeless(['spruce_log'], 'spruce_planks', 4);
shaped(['#', '#'], { '#': PLANKS }, 'stick', 4);
shaped(['##', '##'], { '#': PLANKS }, 'crafting_table');
shaped(['###', '# #', '###'], { '#': 'cobblestone' }, 'furnace');
shaped(['###', '# #', '###'], { '#': PLANKS }, 'chest');
shaped(['C', 'S'], { C: FUELISH_COAL, S: 'stick' }, 'torch', 4);
shaped(['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3);
shaped(['WWW'], { W: 'wheat' }, 'bread');
shaped(['##', '##', '##'], { '#': 'oak_planks' }, 'oak_door', 3);
shaped(['WWW', 'PPP'], { W: 'white_wool', P: PLANKS }, 'white_bed');
shaped(['##', '##'], { '#': 'string' }, 'white_wool');
shaped(['I I', ' I '], { I: 'iron_ingot' }, 'bucket');
shaped([' I', 'I '], { I: 'iron_ingot' }, 'shears');
// fences (4 planks + 2 sticks -> 3), fence gates (4 sticks + 2 planks), trapdoor, tnt, boats, flint & steel
for (const wood of ['oak', 'spruce', 'birch']) {
  const P = `${wood}_planks`;
  shaped(['P#P', 'P#P'], { P, '#': 'stick' }, `${wood}_fence`, 3);
  shaped(['#P#', '#P#'], { P, '#': 'stick' }, `${wood}_fence_gate`);
  shaped(['P P', 'PPP'], { P }, `${wood}_boat`);
}
shaped(['PPP', 'PPP'], { P: 'oak_planks' }, 'oak_trapdoor', 2);
shaped(['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' }, 'tnt');
shapeless(['iron_ingot', 'flint'], 'flint_and_steel');
for (const [blk, ing] of [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond'], ['coal_block', 'coal']]) {
  shaped(['###', '###', '###'], { '#': ing }, blk);
  shapeless([blk], ing, 9);
}
shaped(['###', '###', '###'], { '#': 'wheat' }, 'hay_block');
shapeless(['hay_block'], 'wheat', 9);
shapeless(['bone'], 'bone_meal', 3);
shaped([' #S', '# S', ' #S'], { '#': 'stick', S: 'string' }, 'bow');
shaped(['F', '#', 'E'], { F: 'flint', '#': 'stick', E: 'feather' }, 'arrow', 4);
const ARMOR_SHAPES = { helmet: ['XXX', 'X X'], chestplate: ['X X', 'XXX', 'XXX'], leggings: ['XXX', 'X X', 'X X'], boots: ['X X', 'X X'] };
for (const [mat, A] of Object.entries(ARMOR_MATERIALS)) for (const slot of ARMOR_SLOTS) shaped(ARMOR_SHAPES[slot], { X: A.material }, `${mat}_${slot}`);
for (const [tier, t] of Object.entries(TIERS)) {
  const k = { X: t.material, S: 'stick' };
  shaped(['XXX', ' S ', ' S '], k, `${tier}_pickaxe`);
  shaped(['XX', 'XS', ' S'], k, `${tier}_axe`);
  shaped(['X', 'S', 'S'], k, `${tier}_shovel`);
  shaped(['X', 'X', 'S'], k, `${tier}_sword`);
  shaped(['XX', ' S', ' S'], k, `${tier}_hoe`);
}

const accepts = (want, id) => {
  if (Array.isArray(want)) return want.some(w => accepts(w, id));
  if (typeof want === 'string' && want.startsWith('#')) return (TAGS[want] || []).includes(id);
  return want === id;
};

/* matchRecipe(grid, w, h)
   grid: array of w*h stacks (or ids, or null), row-major. Returns
   { recipe, result: {id,count} } or null. */
export function matchRecipe(grid, w, h) {
  const ids = grid.map(s => (s ? (typeof s === 'string' ? s : s.id) : null));
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ids[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, at = (x, y) => ids[(y0 + y) * w + x0 + x];
  const used = ids.filter(Boolean);
  for (const r of RECIPES) {
    if (r.type === 'shaped') {
      const ph = r.pattern.length, pw = Math.max(...r.pattern.map(p => p.length));
      if (ph !== bh || pw !== bw) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < bh && ok; y++) for (let x = 0; x < bw && ok; x++) {
          const ch = (r.pattern[y][mirror ? bw - 1 - x : x] || ' '), id = at(x, y);
          ok = ch === ' ' ? !id : !!id && accepts(r.key[ch], id);
        }
        if (ok) return { recipe: r, result: { ...r.result } };
      }
    } else {
      if (used.length !== r.ingredients.length) continue;
      const left = [...r.ingredients]; let ok = true;
      for (const id of used) { const i = left.findIndex(want => accepts(want, id)); if (i < 0) { ok = false; break; } left.splice(i, 1); }
      if (ok) return { recipe: r, result: { ...r.result } };
    }
  }
  return null;
}
// which recipes fit a grid size (for recipe-book style hints)
export const recipeFits = (r, w, h) => r.type === 'shapeless' ? r.ingredients.length <= w * h : r.pattern.length <= h && Math.max(...r.pattern.map(p => p.length)) <= w;

// ---------------------------------------------------------------- furnace
export const SMELTING = {
  iron_ore: 'iron_ingot', raw_iron: 'iron_ingot', gold_ore: 'gold_ingot', raw_gold: 'gold_ingot',
  diamond_ore: 'diamond', coal_ore: 'coal', sand: 'glass', cobblestone: 'stone',
  porkchop: 'cooked_porkchop', beef: 'cooked_beef', chicken: 'cooked_chicken', mutton: 'cooked_mutton',
};
export const COOK_TICKS = 200; // 10 s at 20 ticks/s, like Minecraft
export const smeltResult = id => SMELTING[id] || ((TAGS['#logs'] || []).includes(id) ? 'charcoal' : null);
export const fuelTicks = id => (ITEMS[id] && ITEMS[id].fuel) || 0;

// furnace state is owned by the engine (one per furnace block); slots = [input, fuel, output]
export function createFurnace() { return { slots: [null, null, null], burn: 0, burnMax: 0, cook: 0, cookMax: COOK_TICKS }; }
export function furnaceCanSmelt(f) {
  const [inp, , out] = f.slots, r = inp && smeltResult(inp.id);
  return !!r && (!out || (out.id === r && out.count < maxStack(r)));
}
// advance a furnace by n game ticks (20 ticks = 1 second). Returns true if anything changed.
export function tickFurnace(f, n = 1) {
  let changed = false;
  for (let t = 0; t < n; t++) {
    const was = f.burn > 0;
    if (f.burn > 0) f.burn--;
    const can = furnaceCanSmelt(f), fuel = f.slots[1];
    if (f.burn === 0 && can && fuel && fuelTicks(fuel.id) > 0) {
      f.burn = f.burnMax = fuelTicks(fuel.id);
      const rem = ITEMS[fuel.id].remainder;
      if (--fuel.count <= 0) f.slots[1] = rem ? makeStack(rem) : null;
      changed = true;
    }
    if (f.burn > 0 && can) {
      if (++f.cook >= f.cookMax) {
        f.cook = 0; const r = smeltResult(f.slots[0].id);
        if (f.slots[2]) f.slots[2].count++; else f.slots[2] = makeStack(r);
        if (--f.slots[0].count <= 0) f.slots[0] = null;
        changed = true;
      }
    } else if (!can) { if (f.cook) changed = true; f.cook = 0; }
    else if (f.burn === 0 && f.cook > 0) f.cook = Math.max(0, f.cook - 2);
    if (was !== f.burn > 0) changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------- open screen session
/* A Session holds the cursor stack and applies Minecraft's slot rules.
   Slot refs: { g: 'inv', i: 0..35 } | { g: 'craft', i } | { g: 'result', i: 0 } | { g: 'furnace', i: 0..2 }
              | { g: 'armor', i: 0..3 } (helmet, chestplate, leggings, boots; inventory screen) | { g: 'chest', i: 0..26 (or 53) }
   kind: 'inventory' (2x2 + armor) | 'crafting' (3x3) | 'furnace' (needs opts.furnace state) | 'chest' (needs opts.chest state) */
// normalise an engine-owned chest state in place: { slots: Array(27|54) } (a bare array is wrapped, keeping the same array)
export function createChest(size = 27) { return { slots: new Array(size).fill(null) }; }
export function normalizeChest(c) {
  const st = Array.isArray(c) ? { slots: c } : c && typeof c === 'object' ? c : createChest();
  if (!Array.isArray(st.slots)) st.slots = [];
  const n = st.slots.length > 27 ? 54 : 27;
  for (let i = 0; i < n; i++) { const s = st.slots[i]; st.slots[i] = s && s.id && s.count > 0 ? s : null; }
  st.slots.length = n; return st;
}
export class Session {
  constructor(inv, kind = 'inventory', opts = {}) {
    this.inv = inv; this.kind = kind; this.cursor = null;
    this.gw = kind === 'crafting' ? 3 : 2;
    this.craft = kind === 'furnace' || kind === 'chest' ? [] : new Array(this.gw * this.gw).fill(null);
    this.furnace = kind === 'furnace' ? (opts.furnace || createFurnace()) : null;
    this.chest = kind === 'chest' ? normalizeChest(opts.chest) : null;
    this.hasArmor = kind === 'inventory';
  }
  // every slot of this screen, in Minecraft's container order (container first, then main, then hotbar)
  refs() {
    const out = [];
    if (this.furnace) for (let i = 0; i < 3; i++) out.push({ g: 'furnace', i });
    else if (this.chest) this.chest.slots.forEach((_, i) => out.push({ g: 'chest', i }));
    else { out.push({ g: 'result', i: 0 }); this.craft.forEach((_, i) => out.push({ g: 'craft', i })); }
    if (this.hasArmor) for (let i = 0; i < 4; i++) out.push({ g: 'armor', i });
    for (let i = 9; i < 36; i++) out.push({ g: 'inv', i });
    for (let i = 0; i < 9; i++) out.push({ g: 'inv', i });
    return out;
  }
  match() { return this.furnace || this.chest ? null : matchRecipe(this.craft, this.gw, this.gw); }
  get(r) {
    if (r.g === 'inv') return this.inv.slots[r.i];
    if (r.g === 'craft') return this.craft[r.i];
    if (r.g === 'furnace') return this.furnace.slots[r.i];
    if (r.g === 'chest') return this.chest ? this.chest.slots[r.i] || null : null;
    if (r.g === 'armor') return this.inv.armor[ARMOR_SLOTS[r.i]] || null;
    if (r.g === 'result') { const m = this.match(); return m ? makeStack(m.result.id, m.result.count) : null; }
    return null;
  }
  set(r, s) {
    s = s && s.count > 0 ? s : null;
    if (r.g === 'inv') this.inv.slots[r.i] = s;
    else if (r.g === 'craft') this.craft[r.i] = s;
    else if (r.g === 'furnace') this.furnace.slots[r.i] = s;
    else if (r.g === 'chest') this.chest.slots[r.i] = s;
    else if (r.g === 'armor') this.inv.armor[ARMOR_SLOTS[r.i]] = s;
  }
  isOutput(r) { return r.g === 'result' || (r.g === 'furnace' && r.i === 2); }
  accepts(r, s) {
    if (this.isOutput(r)) return false;
    if (r.g === 'furnace' && r.i === 1) return fuelTicks(s.id) > 0 || s.id === 'bucket';
    if (r.g === 'armor') return armorSlotOf(s.id) === ARMOR_SLOTS[r.i];
    return true;
  }
  // ---- left (button 0) / right (button 1) click, shift = quick move
  click(r, button = 0, mods = {}) {
    if (mods.shift) return this.quickMove(r);
    if (r.g === 'result') return this.takeResult(false);
    const slot = this.get(r), cur = this.cursor;
    if (this.isOutput(r)) { // furnace output: take only
      if (!slot) return false;
      if (!cur) { const k = button === 1 ? Math.ceil(slot.count / 2) : slot.count; this.cursor = { ...slot, count: k }; slot.count -= k; this.set(r, slot); return true; }
      if (canStack(cur, slot)) { const k = Math.min(slot.count, maxStack(cur.id) - cur.count); if (!k) return false; cur.count += k; slot.count -= k; this.set(r, slot); return true; }
      return false;
    }
    if (!cur) {
      if (!slot) return false;
      if (button === 1) { const k = Math.ceil(slot.count / 2); this.cursor = { ...slot, count: k }; slot.count -= k; this.set(r, slot); }
      else { this.cursor = slot; this.set(r, null); }
      return true;
    }
    if (!this.accepts(r, cur)) return false;
    const max = maxStack(cur.id);
    if (!slot) {
      if (button === 1) { this.set(r, { ...cur, count: 1 }); cur.count--; }
      else { const k = Math.min(cur.count, max); this.set(r, { ...cur, count: k }); cur.count -= k; }
      if (cur.count <= 0) this.cursor = null; return true;
    }
    if (canStack(slot, cur)) {
      const k = Math.min(button === 1 ? 1 : cur.count, max - slot.count);
      if (k <= 0) return false;
      slot.count += k; cur.count -= k; if (cur.count <= 0) this.cursor = null; return true;
    }
    // different items: swap
    this.set(r, cur); this.cursor = slot; return true;
  }
  consumeGrid() {
    this.craft.forEach((s, i) => {
      if (!s) return;
      const rem = ITEMS[s.id] && ITEMS[s.id].remainder;
      s.count--; if (s.count <= 0) this.craft[i] = rem ? makeStack(rem) : null;
      else if (rem && this.inv.add(rem, 1)) { /* no room: lost, same as a full inventory in MC drops it */ }
    });
  }
  takeResult(shift) {
    if (shift) {
      let n = 0;
      for (let guard = 0; guard < 64; guard++) {
        const m = this.match(); if (!m) break;
        if (this.inv.room(m.result.id) < m.result.count) break;
        this.mergeInto(makeStack(m.result.id, m.result.count), this.invOrder(true)); this.consumeGrid(); n++;
      }
      return n > 0;
    }
    const m = this.match(); if (!m) return false;
    const res = makeStack(m.result.id, m.result.count), cur = this.cursor;
    if (!cur) this.cursor = res;
    else if (canStack(cur, res) && cur.count + res.count <= maxStack(res.id)) cur.count += res.count;
    else return false;
    this.consumeGrid(); return true;
  }
  invOrder(reverse) { // main (9..35) then hotbar (0..8); reverse = hotbar 8..0 then main 35..9
    const a = [...Array.from({ length: 27 }, (_, i) => ({ g: 'inv', i: 9 + i })), ...Array.from({ length: 9 }, (_, i) => ({ g: 'inv', i }))];
    return reverse ? a.reverse() : a;
  }
  // put as much of stack s as possible into refs (top up existing stacks first, then empty slots). Returns leftover count.
  mergeInto(s, refs) {
    const max = maxStack(s.id);
    if (max > 1) for (const r of refs) { if (!s.count) break; const t = this.get(r); if (t && canStack(t, s) && t.count < max && this.accepts(r, s)) { const k = Math.min(max - t.count, s.count); t.count += k; s.count -= k; } }
    for (const r of refs) { if (!s.count) break; if (!this.get(r) && this.accepts(r, s)) { const k = Math.min(max, s.count); this.set(r, { ...s, count: k }); s.count -= k; } }
    return s.count;
  }
  quickMove(r) {
    if (r.g === 'result') return this.takeResult(true);
    const s = this.get(r); if (!s) return false;
    const before = s.count; let targets;
    const hot = Array.from({ length: 9 }, (_, i) => ({ g: 'inv', i })), main = Array.from({ length: 27 }, (_, i) => ({ g: 'inv', i: 9 + i }));
    const aslot = armorSlotOf(s.id);
    if (r.g === 'craft' || r.g === 'armor') targets = this.invOrder(false);
    else if (r.g === 'furnace') targets = this.invOrder(r.i === 2);
    // chest -> player: Minecraft fills from the right end of the hotbar backwards, then main 35..9
    else if (r.g === 'chest') targets = this.invOrder(true);
    else if (this.chest) targets = this.chest.slots.map((_, i) => ({ g: 'chest', i }));
    else {
      const other = r.i < 9 ? main : hot;
      if (this.hasArmor && aslot && !this.inv.armor[aslot]) targets = [{ g: 'armor', i: ARMOR_SLOTS.indexOf(aslot) }];
      else if (this.furnace && smeltResult(s.id)) targets = [{ g: 'furnace', i: 0 }, ...other];
      else if (this.furnace && fuelTicks(s.id) > 0) targets = [{ g: 'furnace', i: 1 }, ...other];
      else targets = other;
    }
    const moving = { ...s }; const left = this.mergeInto(moving, targets);
    s.count = left; this.set(r, s);
    return left !== before;
  }
  // double-click: gather matching items onto the cursor (partial stacks first)
  collect() {
    const cur = this.cursor; if (!cur) return false;
    const max = maxStack(cur.id); if (max <= 1) return false;
    let moved = false;
    for (const pass of [0, 1]) for (const r of this.refs()) {
      if (cur.count >= max) break;
      if (this.isOutput(r)) continue;
      const s = this.get(r);
      if (!s || !canStack(s, cur) || (pass === 0 && s.count >= max)) continue;
      const k = Math.min(s.count, max - cur.count); cur.count += k; s.count -= k; this.set(r, s); moved = true;
    }
    return moved;
  }
  // drag across slots holding a stack: left splits evenly, right places one per slot
  distribute(refList, button = 0) {
    const cur = this.cursor; if (!cur) return false;
    const seen = new Set(), max = maxStack(cur.id);
    let targets = refList.filter(r => {
      const key = r.g + r.i; if (seen.has(key)) return false; seen.add(key);
      const s = this.get(r); return this.accepts(r, cur) && (!s || (canStack(s, cur) && s.count < max));
    });
    if (!targets.length) return false;
    if (button === 0) {
      targets = targets.slice(0, cur.count);
      const per = Math.floor(cur.count / targets.length);
      for (const r of targets) { const s = this.get(r), k = Math.min(per, max - (s ? s.count : 0)); if (s) s.count += k; else this.set(r, { ...cur, count: k }); cur.count -= k; }
    } else {
      for (const r of targets) { if (!cur.count) break; const s = this.get(r); if (s) s.count++; else this.set(r, { ...cur, count: 1 }); cur.count--; }
    }
    if (cur.count <= 0) this.cursor = null;
    return true;
  }
  // number key while hovering a slot: swap it with hotbar slot n (0..8)
  swapHotbar(r, n) {
    if (r.g === 'result' || (r.g === 'inv' && r.i === n)) return false;
    const a = this.get(r), b = this.inv.slots[n];
    if (this.isOutput(r)) { if (!a || b) return false; this.inv.slots[n] = a; this.set(r, null); return true; }
    if (b && !this.accepts(r, b)) return false;
    this.set(r, b); this.inv.slots[n] = a; return true;
  }
  // remove from a slot to throw it in the world (Q key); returns the stack or null
  drop(r, all = false) {
    if (r.g === 'result') return null;
    const s = this.get(r); if (!s) return null;
    const k = all ? s.count : 1; s.count -= k; this.set(r, s);
    return { ...s, count: k };
  }
  // closing: crafting grid + cursor go back to the inventory; returns stacks that did not fit (to be dropped)
  close() {
    const drops = [];
    const back = s => { if (!s) return; const left = this.inv.add(s.id, s.count, s.damage); if (left) drops.push({ ...s, count: left }); };
    this.craft.forEach((s, i) => { back(s); this.craft[i] = null; });
    back(this.cursor); this.cursor = null;
    return drops;
  }
}

// ---------------------------------------------------------------- experience (Minecraft Java)
// Bar capacity to go from `level` to level+1. Total XP to reach a level is xpForLevel(level).
export function xpBarCap(level) {
  const L = Math.max(0, level | 0);
  return L < 16 ? 2 * L + 7 : L < 31 ? 5 * L - 38 : 9 * L - 158;
}
export function xpForLevel(level) {
  const L = Math.max(0, level | 0);
  if (L <= 16) return L * L + 6 * L;
  if (L <= 31) return Math.floor(2.5 * L * L - 40.5 * L + 360);
  return Math.floor(4.5 * L * L - 162.5 * L + 2220);
}
/* { total, level, xp (into current bar), needed (bar cap), progress 0..1 } */
export function xpProgress(total = 0) {
  const totalXp = Math.max(0, total | 0);
  let left = totalXp, level = 0;
  for (;;) {
    const need = xpBarCap(level);
    if (left < need) return { total: totalXp, level, xp: left, needed: need, progress: need ? left / need : 0 };
    left -= need; level++;
    if (level > 100000) return { total: totalXp, level, xp: 0, needed: xpBarCap(level), progress: 0 };
  }
}
export function createXp(total = 0) { return { total: Math.max(0, total | 0) }; }
export function addXp(state, n = 0) {
  if (!state || typeof state !== 'object') state = createXp();
  state.total = Math.max(0, (state.total | 0) + (n | 0));
  return xpProgress(state.total);
}
