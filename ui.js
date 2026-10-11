/* Blockcraft 3D - inventory (with armor), hotbar, crafting table, furnace and chest UI (Timmy)
   Original pixel-art GUI in Minecraft's style; no Mojang assets. ES module, no dependencies.

   QUICK START (engine)
     import { buildAtlas, faceTex } from './textures.js';
     import { createUI, tickFurnace, createFurnace } from './ui.js';
     const ui = createUI({
       atlas: buildAtlas(), faceTex,           // icons for block items come from Trish's atlas
       container: document.body,              // element the HUD + screens are drawn in
       onOpen:  kind => {},                   // a screen opened; the UI already called document.exitPointerLock()
       onClose: kind => canvas.requestPointerLock(), // re-lock here (E/Esc keydown counts as a user gesture)
       onDrop:  stack => {},                  // player threw items (Q, or clicked outside the panel)
     });
     ui.give('oak_log', 5);                   // pick-ups. returns how many did NOT fit
     const held = ui.selectedItem();          // { id, count, damage, info } or null; info.block = block id to place
     ui.removeSelected(1);                    // after placing a block / eating
     ui.damageSelected(1);                    // after mining with a tool; returns true if it broke
     ui.openCraftingTable(); ui.openFurnace(furnaceStateOfThatBlock); ui.close(); ui.isOpen();
     ui.openChest(chestStateOfThatBlock);    // { slots: Array(27) } owned + saved by the engine (createChest())
     createUI({ armor: player.armor, onArmor: e => hud.armor(e.points) });  // armor object is shared, mutated in place
     ui.equipSelected(); ui.armorPoints(); ui.armorToughness(); ui.damageArmor(hitDamage); ui.armor();
     // furnaces keep smelting while closed: call tickFurnace(state) 20x per second for every furnace
     localStorage.inv = JSON.stringify(ui.save()); ui.load(JSON.parse(localStorage.inv));

   Keys handled by the UI (opts.keys !== false): E toggle inventory, Esc close, 1-9 hotbar (or swap the
   hovered slot while a screen is open), Q drop one (Ctrl+Q stack), mouse wheel cycles the hotbar.
   While ui.isOpen() is true the engine should ignore movement / mining input.
   Full reference: 3d/UI-API.md. Data model (pure, node-testable): ./ui-data.js. Icons + font: ./ui-icons.js
*/
import { ITEMS, Inventory, Session, createFurnace, normalizeChest, itemName, durabilityOf, maxStack, ARMOR_SLOTS, createXp, addXp, xpProgress } from './ui-data.js';
import { createIconFactory, drawText, textWidth, textCanvas } from './ui-icons.js';
export * from './ui-data.js';
export { SPRITES, FONT } from './ui-icons.js';

const PW = 176, PH0 = 166; // panel size in GUI pixels (same as Minecraft); chests are 114 + rows*18 tall
const LAYOUT = {
  inventory: { grid: [97, 17, 2], result: [153, 27, false], arrow: [134, 31, 16, 11], label: ['Crafting', 97, 7], player: true, armor: true },
  chest: { chest: true, invLabel: true },
  crafting: { grid: [29, 16, 3], result: [119, 30, true], arrow: [90, 35, 22, 15], title: 'Crafting', invLabel: true },
  furnace: { furnace: true, title: 'Furnace', invLabel: true },
};

function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
function cv(w, h, cls, parent) { const c = el('canvas', cls, parent); c.width = Math.max(1, w); c.height = Math.max(1, h); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }

// ---------------------------------------------------------------- 1x pixel-art painters
function bevelPanel(g, w, h) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
    if (cx + cy < 1 || (cx === 0 && cy < 2) || (cy === 0 && cx < 2)) continue; // notched corners
    let col = '#c6c6c6';
    if (cx === 0 || cy === 0 || (cx === 1 && cy === 1)) col = '#000000';
    else {
      const tl = (x <= 2 || y <= 2) && x < w - 3 && y < h - 3, br = (x >= w - 3 || y >= h - 3) && x > 2 && y > 2;
      if (tl && !br) col = '#ffffff'; else if (br && !tl) col = '#555555';
    }
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
}
function slotFrame(g, x, y, s = 18) {
  g.fillStyle = '#8b8b8b'; g.fillRect(x, y, s, s);
  g.fillStyle = '#373737'; g.fillRect(x, y, s - 1, 1); g.fillRect(x, y, 1, s - 1);
  g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + s - 1, s - 1, 1); g.fillRect(x + s - 1, y + 1, 1, s - 1);
}
function arrowShape(w, h) { // returns fn(x,y)->bool for a right-pointing arrow
  const head = Math.ceil(h / 2), shaft = Math.max(1, Math.round(h * 0.2)), mid = (h - 1) / 2;
  return (x, y) => { const dy = Math.abs(y - mid); return x < w - head ? dy <= shaft : dy <= (w - 1 - x) + 0.01 && dy <= mid; };
}
function drawArrow(g, ox, oy, w, h, frac = 0) {
  const f = arrowShape(w, h), lit = Math.round(w * frac);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x, y)) { g.fillStyle = x < lit ? '#ffffff' : '#8b8b8b'; g.fillRect(ox + x, oy + y, 1, 1); }
}
const FLAME = [
  '......#.......', '.....##.......', '.....###......', '....####......', '....#####...#.', '...######..##.', '...#######.##.',
  '..##########..', '..###########.', '.############.', '.############.', '.############.', '..##########..', '...########...'];
function drawFlame(g, ox, oy, frac) {
  const top = 14 - Math.ceil(14 * frac);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    if (FLAME[y][x] !== '#') continue;
    let col = '#8b8b8b';
    if (frac > 0 && y >= top) {
      const edge = FLAME[y][x - 1] !== '#' || FLAME[y][x + 1] !== '#' || !FLAME[y - 1] || FLAME[y - 1][x] !== '#';
      col = edge ? '#e2541a' : y > 9 ? '#ffd23f' : (x + y) % 3 ? '#ff9a1f' : '#ffd23f';
      if (y >= 12 && !edge) col = '#fff3a0';
    }
    g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1);
  }
}
function drawPlayer(g, ox, oy) { // original blocky explorer, 2x scale, in the black preview box
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(ox + x * 2, oy + y * 2, w * 2, h * 2); };
  R(10, 2, 8, 8, '#c99b74'); R(10, 2, 8, 3, '#4a2f1a'); R(10, 5, 1, 2, '#4a2f1a'); R(17, 5, 1, 2, '#4a2f1a');
  R(12, 6, 1, 1, '#ffffff'); R(13, 6, 1, 1, '#3b5ea8'); R(15, 6, 1, 1, '#3b5ea8'); R(16, 6, 1, 1, '#ffffff'); R(13, 8, 3, 1, '#8a5a3a');
  R(10, 10, 8, 12, '#b5452f'); R(10, 10, 8, 1, '#8f3424'); R(13, 10, 2, 3, '#c99b74');
  R(6, 10, 4, 12, '#b5452f'); R(18, 10, 4, 12, '#b5452f'); R(6, 18, 4, 4, '#c99b74'); R(18, 18, 4, 4, '#c99b74');
  R(10, 22, 4, 10, '#3c4a6a'); R(14, 22, 4, 10, '#34405c'); R(10, 30, 4, 2, '#5a5a5a'); R(14, 30, 4, 2, '#4f4f4f');
}

// ---------------------------------------------------------------- createUI
export function createUI(opts = {}) {
  const container = opts.container || document.body;
  const listeners = { change: [], open: [], close: [], drop: [], armor: [] };
  const emit = (t, v) => listeners[t].forEach(f => { try { f(v); } catch (e) { setTimeout(() => { throw e; }); } });
  if (opts.onChange) listeners.change.push(opts.onChange);
  if (opts.onOpen) listeners.open.push(opts.onOpen);
  if (opts.onClose) listeners.close.push(opts.onClose);
  if (opts.onDrop) listeners.drop.push(opts.onDrop);
  ensureCss();

  const inv = opts.inventory instanceof Inventory ? opts.inventory : new Inventory(opts.armor);
  if (opts.inventory instanceof Inventory && opts.armor && typeof opts.armor === 'object') { for (const k of ARMOR_SLOTS) if (!opts.armor[k]) opts.armor[k] = null; inv.armor = opts.armor; }
  const xpState = createXp(opts.xp | 0);
  if (opts.onArmor) listeners.armor.push(opts.onArmor);
  const armorSig = () => ARMOR_SLOTS.map(k => { const a = inv.armor[k]; return a ? a.id + ':' + (a.damage | 0) : '-'; }).join(',');
  let lastArmor = armorSig();
  // fire 'armor' whenever the worn armor differs from last time (UI clicks, equipSelected, damageArmor, load, engine edits + refresh)
  function checkArmor(extra) { const sig = armorSig(); if (sig === lastArmor && !extra) return; lastArmor = sig; emit('armor', { armor: inv.armorList(), points: inv.armorPoints(), toughness: inv.armorToughness(), ...extra }); }
  let icons = createIconFactory(opts.atlas, opts.faceTex);
  const touch = opts.touch != null ? !!opts.touch : (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  if (container !== document.body && getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const root = el('div', 'bcui-root', container); if (container === document.body) root.classList.add('bcui-fixed');
  const hud = el('div', 'bcui-hud', root);
  const screenEl = el('div', 'bcui-screen', root); screenEl.hidden = true;
  const cursorEl = el('div', 'bcui-cursor', root); cursorEl.hidden = true;
  const tipEl = el('div', 'bcui-tip', root); tipEl.hidden = true;

  let p = 2, hp = 2, u = 2, hu = 2, session = null, slotEls = [], hovered = null, quickMode = false, furnaceTimer = 0, tipTimer = 0, nameTimer = 0, hudVisible = true;
  let mouse = { x: 0, y: 0 }, drag = null, pending = null, last = { key: '', t: 0 };
  const px = n => n * p + 'px';

  // ---------------- slot drawing (canvas in device pixels: 18 GUI px square, icon in 0..16)
  function drawStack(c, stack, unit, empty) {
    const S = 18 * unit; if (c.width !== S) { c.width = S; c.height = S; }
    const g = c.getContext('2d'); g.clearRect(0, 0, S, S);
    if (!stack) { const e = empty && icons.emptyArmor && icons.emptyArmor(empty); if (e) { g.imageSmoothingEnabled = false; g.drawImage(e, 0, 0, 16 * unit, 16 * unit); } return; }
    const ic = icons.icon(stack.id); g.imageSmoothingEnabled = ic.width > 16; g.imageSmoothingQuality = 'high';
    g.drawImage(ic, 0, 0, 16 * unit, 16 * unit); g.imageSmoothingEnabled = false;
    const d = durabilityOf(stack);
    if (d && stack.damage > 0) {
      g.fillStyle = '#000'; g.fillRect(2 * unit, 13 * unit, 13 * unit, 2 * unit);
      g.fillStyle = `hsl(${Math.round(d.frac * 120)},100%,50%)`; g.fillRect(2 * unit, 13 * unit, Math.max(1, Math.round(13 * d.frac)) * unit, unit);
    }
    if (stack.count > 1) { const t = String(stack.count); drawText(g, t, 17 - textWidth(t), 9, '#ffffff', unit, true); }
  }
  function sizeCanvas(c, unit, scale) { c.style.width = 18 * scale + 'px'; c.style.height = 18 * scale + 'px'; }

  // ---------------- HUD
  const hotbar = el('div', 'bcui-hotbar', hud);
  const [hbCanvas, hbG] = cv(182, 22, 'bcui-abs', hotbar);
  const hslots = Array.from({ length: 9 }, (_, i) => { const d = el('div', 'bcui-hslot', hotbar); const [c] = cv(18, 18, '', d); d._i = i; return d; });
  const [selCanvas, selG] = cv(24, 24, 'bcui-selector', hotbar);
  const nameEl = el('div', 'bcui-name bcui-fade', hud);
  const invBtn = el('button', 'bcui-invbtn', hud); invBtn.type = 'button'; invBtn.title = 'Inventory (E)'; invBtn.setAttribute('aria-label', 'Open inventory');
  const [ibCanvas, ibG] = cv(20, 20, '', invBtn);
  (function paintHud() {
    hbG.clearRect(0, 0, 182, 22);
    hbG.fillStyle = 'rgba(0,0,0,.85)'; hbG.fillRect(0, 0, 182, 22);
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 20; hbG.fillStyle = '#6f6f6f'; hbG.fillRect(x, 1, 20, 20);
      hbG.fillStyle = '#9a9a9a'; hbG.fillRect(x, 1, 20, 1); hbG.fillRect(x, 1, 1, 20);
      hbG.fillStyle = '#3d3d3d'; hbG.fillRect(x + 19, 1, 1, 20); hbG.fillRect(x, 20, 20, 1);
      hbG.fillStyle = 'rgba(28,28,28,.92)'; hbG.fillRect(x + 2, 3, 16, 16);
    }
    selG.fillStyle = '#000'; selG.fillRect(0, 0, 24, 24); selG.clearRect(3, 3, 18, 18);
    selG.fillStyle = '#ffffff'; selG.fillRect(1, 1, 22, 2); selG.fillRect(1, 1, 2, 22);
    selG.fillStyle = '#cfcfcf'; selG.fillRect(21, 1, 2, 22); selG.fillRect(1, 21, 22, 2);
    bevelButton(ibG, 20, 20, false);
    ibG.fillStyle = '#3f3f3f'; for (const x of [5, 9, 13]) ibG.fillRect(x + 1, 10, 2, 2);
    ibG.fillStyle = '#ffffff'; for (const x of [5, 9, 13]) ibG.fillRect(x, 9, 2, 2);
  })();
  function bevelButton(g, w, h, on) {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = on ? '#7f8fbf' : '#6f6f6f'; g.fillRect(1, 1, w - 2, h - 2);
    g.fillStyle = on ? '#b5c3ee' : '#aaaaaa'; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, 1, 1, h - 2);
    g.fillStyle = on ? '#4c5a85' : '#4a4a4a'; g.fillRect(1, h - 2, w - 2, 1); g.fillRect(w - 2, 1, 1, h - 2);
  }
  hotbar.addEventListener('pointerdown', e => {
    const d = e.target.closest('.bcui-hslot'); if (!d || isOpen()) return; e.preventDefault(); select(d._i);
  });
  invBtn.addEventListener('click', e => { e.preventDefault(); isOpen() ? close() : openInventory(); });

  function layoutHud() {
    const W = container.clientWidth || innerWidth, H = container.clientHeight || innerHeight, dpr = devicePixelRatio || 1;
    hp = Math.max(1, Math.min(opts.maxScale || 3, Math.floor((W - 8) / 182))); hu = Math.max(1, Math.round(hp * dpr));
    const w = 182 * hp, left = Math.round((W - w) / 2), bottom = 4 * hp;
    Object.assign(hotbar.style, { left: left + 'px', top: (H - bottom - 22 * hp) + 'px', width: w + 'px', height: 22 * hp + 'px' });
    hbCanvas.style.width = w + 'px'; hbCanvas.style.height = 22 * hp + 'px';
    hslots.forEach((d, i) => { Object.assign(d.style, { left: (3 + i * 20) * hp + 'px', top: 3 * hp + 'px', width: 16 * hp + 'px', height: 16 * hp + 'px' }); sizeCanvas(d.firstChild, hu, hp); });
    selCanvas.style.width = selCanvas.style.height = 24 * hp + 'px';
    const showBtn = opts.showInventoryButton !== false;
    invBtn.hidden = !showBtn;
    ibCanvas.style.width = ibCanvas.style.height = 20 * hp + 'px';
    const room = W - (left + w) >= 26 * hp;
    Object.assign(invBtn.style, room ? { left: left + w + 4 * hp + 'px', top: (H - bottom - 21 * hp) + 'px' } : { left: left + w - 20 * hp + 'px', top: (H - bottom - 22 * hp - 24 * hp) + 'px' });
    nameEl.style.top = (H - bottom - 22 * hp - (room ? 14 : 36) * hp - 20) + 'px';
    renderHud(); showName(false);
  }
  function renderHud() {
    hud.style.display = hudVisible ? '' : 'none';
    hslots.forEach((d, i) => drawStack(d.firstChild, inv.slots[i], hu));
    selCanvas.style.left = (-1 + inv.selected * 20) * hp + 'px'; selCanvas.style.top = -1 * hp + 'px';
  }
  function showName(flash = true) {
    const s = inv.slots[inv.selected]; nameEl.innerHTML = '';
    if (!s) { nameEl.classList.add('bcui-fade'); return; }
    const c = textCanvas(itemName(s.id), '#ffffff', hu); c.style.width = c.width / hu * hp + 'px'; c.style.height = c.height / hu * hp + 'px';
    nameEl.appendChild(c); const W = container.clientWidth || innerWidth; nameEl.style.left = Math.round((W - c.width / hu * hp) / 2) + 'px';
    if (!flash) return;
    nameEl.classList.remove('bcui-fade'); clearTimeout(nameTimer); nameTimer = setTimeout(() => nameEl.classList.add('bcui-fade'), 2000);
  }

  // ---------------- screens
  let panel = null, furnaceCanvas = null, toolbar = null;
  function buildScreen() {
    screenEl.innerHTML = ''; slotEls = [];
    if (!session) return;
    const L = LAYOUT[session.kind], W = container.clientWidth || innerWidth, H = container.clientHeight || innerHeight, dpr = devicePixelRatio || 1;
    const rows = session.chest ? session.chest.slots.length / 9 : 0, PH = session.chest ? 114 + rows * 18 : PH0;
    const invTop = session.chest ? rows * 18 + 30 : 83; // frame y of the 3x9 main inventory (Minecraft: slot y 84 / chest 103+(rows-4)*18)
    const extra = touch ? 26 : 0;
    p = Math.max(1, Math.min(opts.maxScale || 3, Math.floor((W - 8) / PW), Math.floor((H - 8 - extra * 2) / PH))); u = Math.max(1, Math.round(p * dpr));
    panel = el('div', 'bcui-panel', screenEl);
    const left = Math.round((W - PW * p) / 2), top = Math.max(extra * p, Math.round((H - PH * p) / 2));
    Object.assign(panel.style, { left: left + 'px', top: top + 'px', width: px(PW), height: px(PH) });
    const [bg, g] = cv(PW, PH, 'bcui-abs', panel); bg.style.width = px(PW); bg.style.height = px(PH);
    bevelPanel(g, PW, PH);
    const label = (t, x, y) => drawText(g, t, x, y, '#404040', 1, false);
    if (L.title) label(L.title, session.kind === 'furnace' ? Math.round((PW - textWidth(L.title)) / 2) : 28, 6);
    if (L.chest) label(session.title || (rows > 3 ? 'Large Chest' : 'Chest'), 8, 6);
    if (L.label) label(L.label[0], L.label[1], L.label[2]);
    if (L.invLabel) label('Inventory', 8, PH - 94);
    if (L.player) { g.fillStyle = '#000'; g.fillRect(25, 7, 52, 72); g.fillStyle = '#373737'; g.fillRect(25, 7, 51, 1); g.fillRect(25, 7, 1, 71); g.fillStyle = '#ffffff'; g.fillRect(26, 78, 51, 1); g.fillRect(76, 8, 1, 71); g.fillStyle = '#1b1b1b'; g.fillRect(26, 8, 50, 70); drawPlayer(g, 23, 10); }
    const addSlot = (ref, fx, fy, big = false, empty = null) => {
      const s = big ? 26 : 18; slotFrame(g, fx, fy, s);
      const d = el('div', 'bcui-slot', panel), off = big ? 5 : 1;
      Object.assign(d.style, { left: px(fx + off), top: px(fy + off), width: px(16), height: px(16) });
      const [c] = cv(18 * u, 18 * u, '', d); sizeCanvas(c, u, p); d._ref = ref; d._empty = empty; slotEls.push(d);
      if (ref.g === 'armor') d.setAttribute('aria-label', ARMOR_SLOTS[ref.i] + ' slot');
      bindSlot(d);
    };
    // armor: 4 slots down the left edge of the player screen (helmet at the top), Minecraft positions
    if (L.armor) for (let i = 0; i < 4; i++) addSlot({ g: 'armor', i }, 7, 7 + i * 18, false, ARMOR_SLOTS[i]);
    if (L.chest) for (let i = 0; i < rows * 9; i++) addSlot({ g: 'chest', i }, 7 + (i % 9) * 18, 17 + Math.floor(i / 9) * 18);
    if (L.grid) {
      const [gx, gy, n] = L.grid;
      for (let i = 0; i < n * n; i++) addSlot({ g: 'craft', i }, gx + (i % n) * 18, gy + Math.floor(i / n) * 18);
      const [rx, ry, big] = L.result; addSlot({ g: 'result', i: 0 }, rx, ry, big);
      const [ax, ay, aw, ah] = L.arrow; drawArrow(g, ax, ay, aw, ah, 0);
    }
    if (L.furnace) {
      addSlot({ g: 'furnace', i: 0 }, 55, 16); addSlot({ g: 'furnace', i: 1 }, 55, 52); addSlot({ g: 'furnace', i: 2 }, 111, 30, true);
      const [fc] = cv(48, 18, 'bcui-abs', panel); furnaceCanvas = fc;
      Object.assign(fc.style, { left: px(56), top: px(34), width: px(48), height: px(18) });
    } else furnaceCanvas = null;
    for (let i = 0; i < 27; i++) addSlot({ g: 'inv', i: 9 + i }, 7 + (i % 9) * 18, invTop + Math.floor(i / 9) * 18);
    for (let i = 0; i < 9; i++) addSlot({ g: 'inv', i }, 7 + i * 18, invTop + 58);
    // touch toolbar: quick-move toggle + close (there is no Shift or E key on a phone)
    if (touch) {
      toolbar = el('div', 'bcui-toolbar', screenEl);
      Object.assign(toolbar.style, { left: left + PW * p - (2 * 52 + 4) * p + 'px', top: top - 22 * p + 'px' });
      const mkBtn = (txt, w, on, fn, aria) => {
        const b = el('button', 'bcui-btn', toolbar); b.type = 'button'; b.setAttribute('aria-label', aria);
        const [c, bg2] = cv(w * u, 18 * u, '', b); c.style.width = px(w); c.style.height = px(18);
        bg2.scale(u, u); bevelButton(bg2, w, 18, on); bg2.setTransform(1, 0, 0, 1, 0, 0);
        drawText(bg2, txt, Math.round((w - textWidth(txt)) / 2), 5, on ? '#ffffa0' : '#ffffff', u, true);
        b.addEventListener('pointerdown', e => e.stopPropagation());
        b.addEventListener('click', e => { e.preventDefault(); fn(); }); return b;
      };
      mkBtn(quickMode ? 'Move: on' : 'Move: off', 52, quickMode, () => { quickMode = !quickMode; buildScreen(); }, 'Toggle quick move');
      mkBtn('Close', 52, false, () => close(), 'Close inventory');
    }
    render();
  }
  function renderFurnace() {
    if (!furnaceCanvas || !session || !session.furnace) return;
    const f = session.furnace, g = furnaceCanvas.getContext('2d');
    g.clearRect(0, 0, 48, 18);
    drawFlame(g, 0, 2, f.burn > 0 && f.burnMax ? f.burn / f.burnMax : 0);
    drawArrow(g, 23, 0, 24, 17, f.cookMax ? f.cook / f.cookMax : 0);
  }
  function render() {
    renderHud();
    if (session) {
      for (const d of slotEls) drawStack(d.firstChild, session.get(d._ref), u, d._empty);
      renderFurnace();
      if (session.cursor) {
        cursorEl.hidden = false; if (!cursorEl.firstChild) cv(18, 18, '', cursorEl);
        drawStack(cursorEl.firstChild, session.cursor, u); sizeCanvas(cursorEl.firstChild, u, p); placeCursor();
      } else cursorEl.hidden = true;
    } else cursorEl.hidden = true;
  }
  function placeCursor() {
    const r = root.getBoundingClientRect();
    cursorEl.style.left = mouse.x - r.left - 8 * p + 'px'; cursorEl.style.top = mouse.y - r.top - 8 * p + 'px';
  }

  // ---------------- tooltip
  function showTip(stack, x, y, ms = 0) {
    if (!stack) return hideTip();
    const lines = [[itemName(stack.id), '#ffffff']], d = durabilityOf(stack), it = ITEMS[stack.id];
    if (d) lines.push([`Durability: ${d.left} / ${d.max}`, '#aaaaaa']);
    if (it && it.food) lines.push([`Food: +${it.food}`, '#55aaff']);
    if (it && it.armor) { lines.push([`+${it.armor.def} Armor`, '#5555ff']); if (it.armor.tough) lines.push([`+${it.armor.tough} Armor Toughness`, '#5555ff']); }
    const w = Math.max(...lines.map(l => textWidth(l[0]))) + 8, h = lines.length * 10 + 5 + (lines.length > 1 ? 2 : 0);
    tipEl.innerHTML = ''; const [c, g] = cv(w * u, h * u, '', tipEl); c.style.width = px(w); c.style.height = px(h);
    g.scale(u, u);
    g.fillStyle = 'rgba(16,0,16,.94)'; g.fillRect(1, 0, w - 2, h); g.fillRect(0, 1, w, h - 2);
    const grd = g.createLinearGradient(0, 1, 0, h - 1); grd.addColorStop(0, '#5000ff'); grd.addColorStop(1, '#28007f');
    g.fillStyle = grd; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, h - 2, w - 2, 1); g.fillRect(1, 1, 1, h - 2); g.fillRect(w - 2, 1, 1, h - 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    lines.forEach(([t, col], i) => drawText(g, t, 4, 4 + i * 10 + (i ? 2 : 0), col, u, true));
    tipEl.hidden = false;
    const r = root.getBoundingClientRect(); let lx = x - r.left + 12 * p, ly = y - r.top - 12 * p;
    if (lx + w * p > r.width) lx = Math.max(0, x - r.left - 8 * p - w * p);
    tipEl.style.left = Math.max(0, lx) + 'px'; tipEl.style.top = Math.max(0, Math.min(ly, r.height - h * p)) + 'px';
    clearTimeout(tipTimer); if (ms) tipTimer = setTimeout(hideTip, ms);
  }
  function hideTip() { tipEl.hidden = true; clearTimeout(tipTimer); }

  // ---------------- pointer handling
  const keyOf = r => r.g + ':' + r.i;
  function act(fn) {
    fn(); render(); emit('change', { type: 'inventory', inventory: inv });
    if (session && session.chest) emit('change', { type: 'chest', chest: session.chest, inventory: inv });
    checkArmor();
  }
  function markDrag() { slotEls.forEach(d => d.classList.toggle('bcui-drag', !!drag && drag.refs.length > 1 && drag.refs.some(r => keyOf(r) === keyOf(d._ref)))); }
  function bindSlot(d) {
    d.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      hovered = d._ref; d.classList.add('bcui-hover');
      if (!session.cursor && !drag) showTip(session.get(d._ref), e.clientX, e.clientY);
    });
    d.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse') return; d.classList.remove('bcui-hover'); if (hovered === d._ref) hovered = null; hideTip(); });
    d.addEventListener('contextmenu', e => e.preventDefault());
    d.addEventListener('pointerdown', e => {
      if (e.button === 1 || !session) return;
      e.preventDefault(); e.stopPropagation(); hideTip();
      mouse = { x: e.clientX, y: e.clientY };
      const ref = d._ref, isTouch = e.pointerType !== 'mouse', btn = e.button === 2 ? 1 : 0;
      const k = keyOf(ref), now = performance.now(), dbl = last.key === k && now - last.t < 300 && btn === 0;
      last = { key: k, t: now };
      if ((e.shiftKey || quickMode) && !session.cursor) { act(() => session.click(ref, btn, { shift: true })); return; }
      if (!session.cursor || session.isOutput(ref)) {
        if (isTouch && !session.isOutput(ref)) {
          const pd = pending = { ref, id: e.pointerId, done: false };
          pd.timer = setTimeout(() => { if (pending !== pd) return; pd.done = true; act(() => session.click(ref, 1)); }, 380);
          return;
        }
        act(() => session.click(ref, btn));
        if (isTouch) showTip(session.cursor, e.clientX, e.clientY, 1200);
        return;
      }
      drag = { btn, refs: [ref], dbl, id: e.pointerId, touch: isTouch, timer: 0 };
      if (isTouch) { const dg = drag; dg.timer = setTimeout(() => { if (drag === dg) dg.btn = 1; }, 380); }
      markDrag();
    });
  }
  function slotAt(x, y) { const t = document.elementFromPoint(x, y); const d = t && t.closest && t.closest('.bcui-slot'); return d && slotEls.includes(d) ? d : null; }
  function onMove(e) {
    mouse = { x: e.clientX, y: e.clientY };
    if (session && session.cursor) placeCursor();
    if (!tipEl.hidden && e.pointerType === 'mouse' && hovered) showTip(session && session.get(hovered), e.clientX, e.clientY);
    if (drag && e.pointerId === drag.id) {
      const d = slotAt(e.clientX, e.clientY);
      if (d && !session.isOutput(d._ref) && !drag.refs.some(r => keyOf(r) === keyOf(d._ref))) { drag.refs.push(d._ref); clearTimeout(drag.timer); markDrag(); }
    }
    if (pending && e.pointerId === pending.id) {
      const d = slotAt(e.clientX, e.clientY); if (!d || d._ref !== pending.ref) { clearTimeout(pending.timer); }
    }
  }
  function onUp(e) {
    if (pending && e.pointerId === pending.id) {
      const pd = pending; pending = null; clearTimeout(pd.timer);
      if (!pd.done) { act(() => session.click(pd.ref, 0)); }
      const s = session && (session.cursor || session.get(pd.ref)); if (s) showTip(s, e.clientX, e.clientY, 1200);
    }
    if (drag && e.pointerId === drag.id) {
      const dg = drag; drag = null; clearTimeout(dg.timer);
      if (session) {
        if (dg.refs.length === 1) act(() => (dg.dbl ? session.collect() : session.click(dg.refs[0], dg.btn)));
        else act(() => session.distribute(dg.refs, dg.btn));
      }
      markDrag();
    }
  }
  function onCancel(e) {
    if (pending && e.pointerId === pending.id) { clearTimeout(pending.timer); pending = null; }
    if (drag && e.pointerId === drag.id) { clearTimeout(drag.timer); drag = null; markDrag(); }
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  screenEl.addEventListener('contextmenu', e => e.preventDefault());
  // tapping where the engine's Bag button sits (it is underneath this overlay) closes the screen
  screenEl.addEventListener('pointerdown', e => {
    if (!isOpen() || e.target.closest('.bcui-panel') || e.target.closest('.bcui-toolbar')) return;
    const bag = document.getElementById('t-bag'); if (!bag || !bag.offsetParent) return;
    const r = bag.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  });
  // click outside the panel while holding items = throw them (left: all, right: one)
  screenEl.addEventListener('pointerdown', e => {
    if (!session || !session.cursor || e.target.closest('.bcui-panel') || e.target.closest('.bcui-toolbar')) return;
    if (!listeners.drop.length) return;
    e.preventDefault();
    const c = session.cursor, k = e.button === 2 ? 1 : c.count, out = { ...c, count: k };
    c.count -= k; if (c.count <= 0) session.cursor = null;
    render(); emit('drop', out); emit('change', { type: 'inventory', inventory: inv });
  });

  // ---------------- keyboard + wheel
  function onKey(e) {
    if (opts.keys === false) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (isOpen()) {
      if (e.code === 'KeyE' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) close(); return; }
      if (digit && hovered) { e.preventDefault(); act(() => session.swapHotbar(hovered, +digit[1] - 1)); return; }
      if (e.code === 'KeyQ' && hovered && !session.cursor) {
        if (!listeners.drop.length) return;
        const s = session.drop(hovered, e.ctrlKey || e.metaKey); if (s) { render(); emit('drop', s); emit('change', { type: 'inventory', inventory: inv }); }
      }
      return;
    }
    if (e.code === 'KeyE' && !e.repeat) { if (opts.canOpen && opts.canOpen() === false) return; e.preventDefault(); openInventory(); return; }
    if (digit) { select(+digit[1] - 1); return; }
    if (e.code === 'KeyQ' && listeners.drop.length) {
      const s = inv.removeSelected(e.ctrlKey || e.metaKey ? 64 : 1); if (s) { render(); emit('drop', s); emit('change', { type: 'inventory', inventory: inv }); }
    }
  }
  function onWheel(e) {
    if (opts.wheel === false || isOpen() || !e.deltaY) return;
    select(inv.selected + (e.deltaY > 0 ? 1 : -1));
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onWheel, { passive: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => relayout()) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', relayout);
  function relayout() { layoutHud(); if (session) buildScreen(); }

  // ---------------- open / close
  function open(kind, o) {
    if (session) closeSession(false);
    session = new Session(inv, kind, o); session.title = (o && o.title) || null; quickMode = false;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    screenEl.hidden = false; buildScreen();
    clearInterval(furnaceTimer); if (kind === 'furnace') furnaceTimer = setInterval(() => { if (session && session.furnace) { for (const d of slotEls) if (d._ref.g === 'furnace') drawStack(d.firstChild, session.get(d._ref), u); renderFurnace(); } }, 100);
    emit('open', kind);
  }
  function closeSession(notify) {
    const kind = session.kind, drops = session.close();
    session = null; drag = null; pending = null; hovered = null; hideTip();
    clearInterval(furnaceTimer); screenEl.hidden = true; screenEl.innerHTML = ''; slotEls = []; cursorEl.hidden = true;
    render(); drops.forEach(s => emit('drop', s)); emit('change', { type: 'inventory', inventory: inv }); checkArmor();
    if (notify) emit('close', kind);
  }
  function openInventory() { open('inventory'); }
  // chest: the engine owns one state per chest block ({ slots: Array(27) }, or 54 for a large chest); edits land in it directly
  function openChest(state, o = {}) {
    const c = normalizeChest(state || undefined);
    open('chest', { chest: c, title: o.title }); return c;
  }
  function openCraftingTable() { open('crafting'); }
  function openFurnace(state) {
    const f = state || createFurnace();
    if (!Array.isArray(f.slots)) f.slots = [null, null, null];
    for (const [k, v] of [['burn', 0], ['burnMax', 0], ['cook', 0], ['cookMax', 200]]) if (typeof f[k] !== 'number') f[k] = v;
    open('furnace', { furnace: f }); return f;
  }
  function close() { if (session) closeSession(true); }
  function isOpen() { return !!session; }
  function select(i) { const before = inv.selected; inv.select(i); renderHud(); if (before !== inv.selected) { showName(true); emit('change', { type: 'select', selected: inv.selected, inventory: inv }); } }

  layoutHud();

  const api = {
    inventory: inv,
    get session() { return session; },
    give(id, count = 1, damage = 0) {
      if (!ITEMS[id]) { console.warn('[ui] unknown item id', id); return count; }
      const left = inv.add(id, count, damage); render(); if (left !== count) emit('change', { type: 'inventory', inventory: inv }); return left;
    },
    removeSelected(n = 1) { const s = inv.removeSelected(n); if (s) { render(); emit('change', { type: 'inventory', inventory: inv }); } return s; },
    damageSelected(n = 1) { const broke = inv.damageSelected(n); render(); emit('change', { type: 'inventory', inventory: inv, broke }); return broke; },
    selectedItem() { const s = inv.selectedStack(); return s ? { ...s, info: ITEMS[s.id] || null } : null; },
    selectedIndex: () => inv.selected,
    select,
    has: (id, n = 1) => inv.has(id, n),
    count: id => inv.count(id),
    take(id, n = 1) { const k = inv.removeItem(id, n); if (k) { render(); emit('change', { type: 'inventory', inventory: inv }); } return k; },
    openInventory, openCraftingTable, openFurnace, openChest, close, isOpen,
    currentChest: () => (session && session.chest) || null,
    // armor
    armor: () => inv.armorList(),
    armorPoints: () => inv.armorPoints(),
    armorToughness: () => inv.armorToughness(),
    damageArmor(n = 1) { const broke = inv.damageArmor(n); render(); if (broke.length) emit('change', { type: 'inventory', inventory: inv }); checkArmor(broke.length ? { broke } : undefined); return broke; },
    equipSelected() { if (isOpen()) return null; const slot = inv.equipSelected(); if (slot) { render(); showName(false); emit('change', { type: 'inventory', inventory: inv }); checkArmor({ equipped: slot }); } return slot; },
    // XP helpers (no drawing — Mike's hud.js can draw the bar). Minecraft Java formula.
    xp: () => xpProgress(xpState.total),
    addXp(n = 0) { const p = addXp(xpState, n); emit('change', { type: 'xp', ...p }); return p; },
    setXp(total = 0) { xpState.total = Math.max(0, total | 0); const p = xpProgress(xpState.total); emit('change', { type: 'xp', ...p }); return p; },
    screen: () => (session ? session.kind : null),
    toggleInventory() { isOpen() ? close() : openInventory(); },
    on(type, cb) { listeners[type].push(cb); return () => { const a = listeners[type], i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); }; },
    onChange(cb) { return api.on('change', cb); },
    save: () => ({ ...inv.toJSON(), xp: xpState.total }),
    load(d) { if (session) closeSession(true); inv.load(d); if (d && d.xp != null) xpState.total = Math.max(0, d.xp | 0); render(); showName(false); emit('change', { type: 'inventory', inventory: inv }); checkArmor(); },
    setHudVisible(v) { hudVisible = !!v; renderHud(); },
    setAtlas(atlas, faceTex) { icons = createIconFactory(atlas, faceTex || opts.faceTex); render(); if (session) buildScreen(); },
    iconCanvas: id => icons.icon(id),
    itemInfo: id => ITEMS[id] || null,
    itemName, maxStack,
    refresh() { relayout(); checkArmor(); },
    destroy() {
      if (session) closeSession(false);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', relayout);
      root.remove();
    },
  };
  return api;
}

function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-bcui], link[href$="ui.css"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./ui.css', import.meta.url).href; l.dataset.bcui = '1';
  document.head.appendChild(l);
}
