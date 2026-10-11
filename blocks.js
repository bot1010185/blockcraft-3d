// Block registry. Textures are keys into textures.js. faces: [top, bottom, side] or {top,bottom,side,front}.
// kind: 'solid' (opaque cube), 'cutout' (leaves/glass, alpha holes), 'water'.
export const BLOCKS = [];
export const ID = {};
function def(name, o) { const id = BLOCKS.length; ID[name] = id; BLOCKS.push(Object.assign({ id, name, kind: 'solid', hardness: 1, tex: name }, o)); }
def('air', { kind: 'air', hardness: 0 });
def('grass', { label: 'Grass Block', tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: .6, tool: 'shovel', drop: 'dirt' });
def('dirt', { label: 'Dirt', hardness: .5, tool: 'shovel' });
def('stone', { label: 'Stone', hardness: 1.5, tool: 'pickaxe', needs: 1, drop: 'cobblestone' });
def('cobblestone', { label: 'Cobblestone', hardness: 2, tool: 'pickaxe', needs: 1 });
def('bedrock', { label: 'Bedrock', hardness: Infinity });
def('sand', { label: 'Sand', hardness: .5, tool: 'shovel' });
def('gravel', { label: 'Gravel', hardness: .6, tool: 'shovel' });
def('oak_log', { label: 'Oak Log', tex: { top: 'oak_log_top', bottom: 'oak_log_top', side: 'oak_log' }, hardness: 2, tool: 'axe' });
def('oak_leaves', { label: 'Oak Leaves', kind: 'cutout', hardness: .2, drop: null });
def('oak_planks', { label: 'Oak Planks', hardness: 2, tool: 'axe' });
def('coal_ore', { label: 'Coal Ore', hardness: 3, tool: 'pickaxe', needs: 1, drop: 'coal' });
def('iron_ore', { label: 'Iron Ore', hardness: 3, tool: 'pickaxe', needs: 2, drop: 'raw_iron' });
def('gold_ore', { label: 'Gold Ore', hardness: 3, tool: 'pickaxe', needs: 3, drop: 'raw_gold' });
def('diamond_ore', { label: 'Diamond Ore', hardness: 3, tool: 'pickaxe', needs: 3, drop: 'diamond' });
def('water', { label: 'Water', kind: 'water', hardness: Infinity });
def('glass', { label: 'Glass', kind: 'cutout', hardness: .3, drop: null });
def('crafting_table', { label: 'Crafting Table', tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' }, hardness: 2.5, tool: 'axe' });
def('snowy_grass', { label: 'Snowy Grass', tex: { top: 'snow', bottom: 'dirt', side: 'grass_side_snowy' }, hardness: .6, tool: 'shovel', drop: 'dirt' });
def('sandstone', { label: 'Sandstone', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' }, hardness: .8, tool: 'pickaxe', needs: 1 });
def('birch_log', { label: 'Birch Log', tex: { top: 'birch_log_top', bottom: 'birch_log_top', side: 'birch_log' }, hardness: 2, tool: 'axe' });
def('birch_leaves', { label: 'Birch Leaves', kind: 'cutout', hardness: .2, drop: null });
def('cactus', { label: 'Cactus', tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, hardness: .4 });
def('bricks', { label: 'Bricks', hardness: 2, tool: 'pickaxe', needs: 1 });
def('stone_bricks', { label: 'Stone Bricks', hardness: 1.5, tool: 'pickaxe', needs: 1 });
def('snow_block', { label: 'Snow Block', tex: 'snow', hardness: .2, tool: 'shovel' });
def('torch', { label: 'Torch', kind: 'torch', hardness: 0, light: 14 });
def('furnace', { label: 'Furnace', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', needs: 1 });
def('chest', { label: 'Chest', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe' });
def('white_wool', { label: 'White Wool', hardness: .8 });
def('iron_block', { label: 'Block of Iron', hardness: 5, tool: 'pickaxe', needs: 2 });
def('gold_block', { label: 'Block of Gold', hardness: 3, tool: 'pickaxe', needs: 3 });
def('diamond_block', { label: 'Block of Diamond', hardness: 5, tool: 'pickaxe', needs: 3 });
for (const c of ['black', 'brown', 'gray', 'light_gray', 'pink']) def(c + '_wool', { label: c.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') + ' Wool', hardness: .8 });
def('hay_block', { label: 'Hay Bale', tex: { top: 'hay_block_top', bottom: 'hay_block_top', side: 'hay_block_side' }, hardness: .5 });
def('farmland', { label: 'Farmland', tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, hardness: .6, tool: 'shovel', drop: 'dirt' });
for (let i = 0; i < 8; i++) def('wheat_' + i, { label: 'Wheat', kind: 'crop', tex: 'wheat_stage' + i, hardness: 0, crop: 'wheat', stage: i, max: 7 });
for (let i = 0; i < 4; i++) def('carrots_' + i, { label: 'Carrots', kind: 'crop', tex: 'carrots_stage' + i, hardness: 0, crop: 'carrots', stage: i, max: 3 });
def('coal_block', { label: 'Block of Coal', hardness: 5, tool: 'pickaxe', needs: 1 });

// ---------- non-cube blocks (Mike): kind 'model' = list of boxes in 1/16ths, drawn + collided per box ----------
// f = facing 0..3 = north(-z), east(+x), south(+z), west(-x). Boxes are written for north and rotated.
export const DIRS = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
const rot = (b, k) => { let [x0, y0, z0, x1, y1, z1] = b; for (let i = 0; i < k; i++) { [x0, z0, x1, z1] = [16 - z0, x0, 16 - z1, x1]; } return [Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1)]; };
const model = (name, o, boxes, f = 0) => def(name, Object.assign({ kind: 'model', f, boxes: boxes.map(b => rot(b, f)), canon: boxes, noItem: true }, o));
for (let f = 0; f < 4; f++) model('ladder_' + f, { label: 'Ladder', tex: 'ladder', hardness: .4, tool: 'axe', drop: 'ladder', climb: true, collide: false, cut: true }, [[0, 0, 0, 16, 16, 1]], f);
for (let f = 0; f < 4; f++) for (const open of [0, 1]) for (const half of ['lower', 'upper']) // closed panel sits on the facing edge; open swings to the side
  model(`oak_door_${half}_${f}_${open}`, { label: 'Oak Door', tex: half === 'lower' ? 'oak_door_bottom' : 'oak_door_top', hardness: 3, tool: 'axe', drop: half === 'lower' ? 'oak_door' : null, door: half, open, cut: true }, open ? [[13, 0, 0, 16, 16, 16]] : [[0, 0, 0, 16, 16, 3]], f);
for (let f = 0; f < 4; f++) for (const part of ['foot', 'head']) model(`bed_${part}_${f}`, { label: 'Bed', tex: { top: 'bed_' + part + '_top', bottom: 'oak_planks', side: 'bed_' + part + '_side' }, hardness: .2, drop: part === 'foot' ? 'white_bed' : null, bed: part }, [[0, 3, 0, 16, 9, 16], [0, 0, 0, 3, 3, 3], [13, 0, 0, 16, 3, 3], [0, 0, 13, 3, 3, 16], [13, 0, 13, 16, 3, 16]], f);
const SLABS = { oak: ['oak_planks', 'Oak', 'axe', 2], cobblestone: ['cobblestone', 'Cobblestone', 'pickaxe', 2], stone_brick: ['stone_bricks', 'Stone Brick', 'pickaxe', 1.5], stone: ['stone', 'Stone', 'pickaxe', 1.5] };
export const SLAB_BASE = {};
for (const [k, [base, lab, tool, hard]] of Object.entries(SLABS)) {
  const pick = tool === 'pickaxe' ? { needs: 1 } : {};
  def(k + '_slab', { label: lab + ' Slab', kind: 'model', tex: BLOCKS[ID[base]].tex, hardness: hard, tool, ...pick, boxes: [[0, 0, 0, 16, 8, 16]], slab: 'bottom', full: base });
  def(k + '_slab_top', { label: lab + ' Slab', kind: 'model', tex: BLOCKS[ID[base]].tex, hardness: hard, tool, ...pick, boxes: [[0, 8, 0, 16, 16, 16]], slab: 'top', drop: k + '_slab', noItem: true, full: base });
  SLAB_BASE[k + '_slab'] = base;
  if (k === 'stone') continue;
  for (let f = 0; f < 4; f++) model(`${k}_stairs_${f}`, { label: lab + ' Stairs', tex: BLOCKS[ID[base]].tex, hardness: hard, tool, ...pick, drop: k + '_stairs', stairs: true, noItem: f > 0 }, [[0, 0, 0, 16, 8, 16], [0, 8, 0, 16, 16, 8]], f);
}
// plants: crossed quads, no collision
for (const [n, l] of [['oak_sapling', 'Oak Sapling'], ['birch_sapling', 'Birch Sapling'], ['short_grass', 'Grass'], ['dandelion', 'Dandelion'], ['poppy', 'Poppy']]) def(n, { label: l, kind: 'plant', hardness: 0, sapling: /sapling/.test(n), drop: n === 'short_grass' ? null : n });
for (let l = 1; l < 8; l++) def('water_' + l, { label: 'Water', kind: 'water', tex: 'water', level: l, hardness: Infinity, noItem: true }); // flowing water, 1 = next to source

def('lava', { label: 'Lava', kind: 'lava', hardness: Infinity, light: 15, noItem: true });
for (let l = 1; l < 4; l++) def('lava_' + l, { label: 'Lava', kind: 'lava', tex: 'lava', level: l, hardness: Infinity, light: 15, noItem: true });
def('obsidian', { label: 'Obsidian', hardness: 50, tool: 'pickaxe', needs: 4 });

// ---------- batch 4 (Mike): more wood, fences, gates, trapdoors, fire, TNT. Appended so saved block ids never shift ----------
def('spruce_log', { label: 'Spruce Log', tex: { top: 'spruce_log_top', bottom: 'spruce_log_top', side: 'spruce_log' }, hardness: 2, tool: 'axe', flammable: 5 });
def('spruce_leaves', { label: 'Spruce Leaves', kind: 'cutout', hardness: .2, drop: null, leaves: true, flammable: 30 });
def('spruce_planks', { label: 'Spruce Planks', hardness: 2, tool: 'axe', flammable: 20 });
def('birch_planks', { label: 'Birch Planks', hardness: 2, tool: 'axe', flammable: 20 });
def('spruce_sapling', { label: 'Spruce Sapling', kind: 'plant', hardness: 0, sapling: true, drop: 'spruce_sapling' });
// fences: one id per wood; the arms toward fences/gates/solid blocks are worked out from the neighbours (fenceBoxes), 1.5 high to collide
export const FENCE_POST = [6, 0, 6, 10, 16, 10];
for (const [w, lab] of [['oak', 'Oak'], ['birch', 'Birch'], ['spruce', 'Spruce']]) def(w + '_fence', { label: lab + ' Fence', kind: 'model', tex: w + '_planks', hardness: 2, tool: 'axe', fence: true, boxes: [FENCE_POST], flammable: 20 });
// fence gates (oak, birch, spruce): closed = posts + 2 rails across the facing axis; open = rails swung inward, no collision
for (const w of ['oak', 'birch', 'spruce']) for (let f = 0; f < 4; f++) for (const open of [0, 1]) model(`${w}_fence_gate_${f}_${open}`, { label: BLOCKS[ID[w + '_fence']].label + ' Gate', tex: w + '_planks', hardness: 2, tool: 'axe', drop: w + '_fence_gate', gate: true, open, collide: !open, flammable: 20,
  coll: open ? [] : [rot([0, 0, 6, 16, 24, 10], f)], sel: [rot([0, 0, 6, 16, 16, 10], f)] }, open ? [[0, 5, 7, 2, 16, 9], [14, 5, 7, 16, 16, 9], [0, 6, 9, 2, 9, 16], [0, 12, 9, 2, 15, 16], [14, 6, 9, 16, 9, 16], [14, 12, 9, 16, 15, 16]]
  : [[0, 5, 7, 2, 16, 9], [14, 5, 7, 16, 16, 9], [2, 6, 7, 14, 9, 9], [2, 12, 7, 14, 15, 9], [6, 9, 7, 10, 12, 9]], f);
// trapdoors (oak): bottom/top half when shut, a wall on the hinge side (facing edge = the block it was placed against) when open
for (let f = 0; f < 4; f++) for (const half of ['bottom', 'top']) for (const open of [0, 1]) model(`oak_trapdoor_${f}_${half}_${open}`, { label: 'Oak Trapdoor', tex: 'oak_trapdoor', hardness: 3, tool: 'axe', drop: 'oak_trapdoor', trapdoor: half, open, cut: true, flammable: 20 },
  open ? [[0, 0, 0, 16, 16, 3]] : half === 'top' ? [[0, 13, 0, 16, 16, 16]] : [[0, 0, 0, 16, 3, 16]], f);
def('fire', { label: 'Fire', kind: 'plant', tex: 'fire', hardness: 0, light: 15, drop: null, fire: true, noItem: true });
def('tnt', { label: 'TNT', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, tnt: true, flammable: 15 });
for (const n of ['oak_log', 'birch_log', 'oak_planks', 'crafting_table', 'chest', 'white_wool', 'black_wool', 'brown_wool', 'gray_wool', 'light_gray_wool', 'pink_wool', 'hay_block', 'oak_slab', 'oak_slab_top', 'bookshelf']) if (ID[n] !== undefined) BLOCKS[ID[n]].flammable = /wool|leaves|hay/.test(n) ? 30 : n.endsWith('log') ? 5 : 20;
for (const n of ['oak_leaves', 'birch_leaves']) Object.assign(BLOCKS[ID[n]], { leaves: true, flammable: 30 });
for (const n of ['short_grass', 'dandelion', 'poppy']) BLOCKS[ID[n]].flammable = 60;
for (let f = 0; f < 4; f++) for (const o of [0, 1]) for (const h of ['lower', 'upper']) BLOCKS[ID[`oak_door_${h}_${f}_${o}`]].flammable = 20;
for (let f = 0; f < 4; f++) BLOCKS[ID['oak_stairs_' + f]].flammable = 20;

export const isOpaque = id => BLOCKS[id].kind === 'solid';
export const isSolid = id => { const k = BLOCKS[id].kind; return k === 'solid' || k === 'cutout'; };
// what mobs and falling blocks treat as a wall: full cubes plus closed doors, beds, slabs and stairs
export const isBlocking = id => { const B = BLOCKS[id]; return B.kind === 'solid' || B.kind === 'cutout' || (B.kind === 'model' && B.collide !== false && !B.open); };
// fences join to fences, gates (along their axis) and full blocks, like Minecraft. get(x,y,z) -> id
export function fenceBoxes(get, x, y, z, tall) { const out = [[6, 0, 6, 10, tall ? 24 : 16, 10]];
  for (const [dx, dz, box] of [[0, -1, [7, 0, 0, 9, 0, 6]], [1, 0, [10, 0, 7, 16, 0, 9]], [0, 1, [7, 0, 10, 9, 0, 16]], [-1, 0, [0, 0, 7, 6, 0, 9]]]) { const n = get(x + dx, y, z + dz), N = BLOCKS[n];
    if (!(N.fence || (N.gate && (N.f % 2 === 0 ? dx !== 0 : dz !== 0)) || N.kind === 'solid')) continue;
    if (tall) out.push([box[0], 0, box[2], box[3], 24, box[5]]); else { out.push([box[0], 12, box[2], box[3], 15, box[5]]); out.push([box[0], 6, box[2], box[3], 9, box[5]]); } }
  return out; }
export const isWater = id => BLOCKS[id].kind === 'water';
export const isLava = id => BLOCKS[id].kind === 'lava';
export const isFluid = id => { const k = BLOCKS[id].kind; return k === 'water' || k === 'lava'; };
export const faceTex = (id, face) => { const t = BLOCKS[id].tex; if (typeof t === 'string') return t; if (face === 'front' && t.front) return t.front; return t[face] || t.side; };
