/* Blockcraft 3D mob skins + box models (Amir)
   Original pixel art painted in code on a canvas at load time. No Mojang files are used or copied;
   the look (proportions, palettes, face layouts) is drawn from scratch to read as the classic mobs.

   Units are "model pixels" (1px = 1/16 block). Every model faces +Z, origin = centre of the feet.
   A part: { name, size:[w,h,d], pivot:[x,y,z] (absolute), off:[x,y,z] (box centre relative to pivot),
             rot:[x,y,z] (rest pose), parent, inflate, layer:'skin'|'wool'|'eyes', same:'partName', paint(face,f) }
   Face names as seen from OUTSIDE the box, image y=0 is the top edge:
     front (+z, x=0 is mob's right)   back (-z, x=0 is mob's left)
     right (-x, x=0 is the back)      left (+x, x=0 is the front)
     top (+y, x=0 mob's right, y=0 back)   bottom (-y, x=0 mob's right, y=0 front)
*/

const ccache = new Map();
const col = c => { if (typeof c !== 'string') return c; let v = ccache.get(c); if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; ccache.set(c, v); } return v; };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (r, pal, w) => { if (!w) return pal[(r() * pal.length) | 0]; let t = r(), a = 0; for (let i = 0; i < pal.length; i++) { a += w[i]; if (t <= a) return pal[i]; } return pal[pal.length - 1]; };

function painter(data, W, rx, ry, w, h, face, r) {
  const f = {
    w, h, face, r,
    set(x, y, c, a = 255) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; c = col(c); const i = ((ry + y) * W + rx + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a; },
    clear(x, y) { if (x < 0 || y < 0 || x >= w || y >= h) return; data[((ry + y) * W + rx + x) * 4 + 3] = 0; },
    get(x, y) { const i = ((ry + y) * W + rx + x) * 4; return [data[i], data[i + 1], data[i + 2]]; },
    shade(x, y, k) { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = ((ry + y) * W + rx + x) * 4; for (let j = 0; j < 3; j++) data[i + j] = Math.max(0, Math.min(255, data[i + j] * k)); },
    fill(pal, wt) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f.set(x, y, pick(r, pal, wt)); },
    rect(x0, y0, ww, hh, c, wt) { for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) f.set(x, y, Array.isArray(c) && typeof c[0] !== 'number' ? pick(r, c, wt) : c); },
    // map rows of characters to colors: '.' leaves the pixel alone
    map(rows, key, x0 = 0, y0 = 0) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const k = row[x]; if (k === '.') continue; if (k === ' ') { f.clear(x0 + x, y0 + y); continue; } const c = key[k]; f.set(x0 + x, y0 + y, Array.isArray(c) && typeof c[0] !== 'number' ? pick(r, c) : c); } }); },
    // soft vertical shading: darker toward the bottom of side faces, like baked AO
    grade(top = 1.06, bottom = .86) { for (let y = 0; y < h; y++) { const k = top + (bottom - top) * (h > 1 ? y / (h - 1) : 0); for (let x = 0; x < w; x++) f.shade(x, y, k); } },
    clearAll() { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f.clear(x, y); },
  };
  return f;
}

const P = (name, size, pivot, off = [0, 0, 0], o = {}) => ({ name, size, pivot, off, rot: o.rot || [0, 0, 0], order: o.order || 'XYZ', parent: o.parent || null, inflate: o.inflate || 0, layer: o.layer || 'skin', same: o.same || null, paint: o.paint || null, tsize: o.tsize || null });
const SIDES = ['front', 'back', 'left', 'right'];
const isSide = f => SIDES.includes(f);

/* ------------------------------------------------------------------ palettes */
const C = {
  zSkin: ['#68a24c', '#5d9643', '#74ad55', '#548a3c', '#6aa84f'], zSkinW: [.32, .26, .16, .12, .14],
  zDark: ['#447a30', '#4b8236', '#3b6c29'],
  shirt: ['#1f9e9e', '#178f8f', '#2aabab', '#138282'], shirtW: [.36, .28, .2, .16],
  pants: ['#3d3f97', '#34368a', '#4749a5', '#2e3080'], pantsW: [.36, .28, .2, .16],
  shoe: ['#4b4b4b', '#565656', '#404040'],
  bone: ['#c7c7c7', '#bdbdbd', '#d3d3d3', '#b1b1b1', '#dcdcdc'], boneW: [.3, .25, .2, .13, .12],
  boneDk: ['#8f8f8f', '#9b9b9b', '#858585'],
  hole: ['#2c2c2c', '#262626', '#333333'],
  cr: ['#55b047', '#4aa13d', '#62c152', '#3c8a31', '#74cf62', '#2f7327', '#9ad98a'], crW: [.24, .2, .16, .14, .1, .1, .06],
  crFace: ['#101010', '#171717', '#0b0b0b', '#202020'],
  sp: ['#3b342c', '#332d26', '#443c33', '#2a2520', '#4b4238'], spW: [.3, .25, .2, .15, .1],
  spMark: ['#5e3f2c', '#6b4732', '#523626'],
  eyeR: '#d61f1f', eyeR2: '#ff4d3d', eyeDk: '#7a0f0f',
  pig: ['#f0a8a4', '#ec9f9b', '#f5b5b1', '#e39592', '#f7c0bc'], pigW: [.32, .26, .18, .14, .1],
  snout: ['#f9c9c5', '#f6c0bc'], nostril: '#7d3d3a', hoofPig: ['#c98582', '#be7c79'],
  cowB: ['#4e3726', '#45301f', '#5a3f2b', '#3d2a1b'], cowBW: [.35, .3, .2, .15],
  cowW: ['#ececec', '#dedede', '#f6f6f6', '#d2d2d2'], cowWW: [.36, .3, .2, .14],
  muzzle: ['#c9b9ad', '#bfae9f', '#d3c4b8'], horn: ['#e2dccb', '#d1c9b4'], hoof: ['#3a3a3a', '#2f2f2f'], udder: ['#eba7a4', '#e39894'],
  sheepFace: ['#e6d2b8', '#dcc6aa', '#efdcc4', '#d4bc9e'],
  wool: ['#ffffff', '#f7f7f7', '#efefef', '#fbfbfb', '#e6e6e6'], woolW: [.3, .24, .2, .16, .1],
  ch: ['#ffffff', '#f4f4f4', '#e8e8e8', '#fbfbfb'], chW: [.35, .3, .2, .15],
  beak: ['#f2b232', '#e8a325', '#f7c247'], wattle: ['#d42b2b', '#c42222', '#e03a3a'], chLeg: ['#e6a03a', '#d48e2c'],
  wood: ['#a57c45', '#93703d', '#b68b52'], string: '#e8e8e8',
  // round 3
  end: ['#161616', '#121212', '#1b1b1b', '#0e0e0e', '#202020'], endW: [.32, .26, .18, .14, .1],
  slime: ['#5fae4b', '#56a442', '#68b854', '#4d973b'], slimeW: [.34, .28, .22, .16],
  slimeShell: ['#7fcf66', '#76c55d', '#88d870', '#6fbd57'],
  wolf: ['#dad6d2', '#d1cdc9', '#e3e0dc', '#c8c3bf', '#ebe8e5'], wolfW: [.3, .25, .2, .15, .1],
  wolfDk: ['#a8a19b', '#9b948e', '#b3ada7', '#8f8882'], wolfMz: ['#b9afa5', '#aea398', '#c4bab0'],
  collar: ['#b52a2a', '#a82222', '#c23333'],
  sq: ['#2a405c', '#253951', '#304866', '#213249', '#36507a'], sqW: [.3, .26, .2, .14, .1],
  grass: ['#5f9f35', '#6aab3e', '#55922f', '#73b446'], dirt: ['#866043', '#79553a', '#93694b', '#6c4b33'],
};

/* ------------------------------------------------------------------ painters */
// humanoid zombie
const zombieHead = (face, f) => {
  f.fill(C.zSkin, C.zSkinW);
  if (face === 'top') { f.fill(C.zDark); return; }
  if (face === 'bottom') { f.grade(.85, .85); return; }
  // darker scalp band
  f.rect(0, 0, f.w, 2, C.zDark); for (let x = 0; x < f.w; x++) if (f.r() < .45) f.set(x, 2, pick(f.r, C.zDark));
  if (face === 'back') f.rect(0, 2, f.w, 2, C.zDark);
  if (face === 'front') f.map([
    '........',
    '........',
    '........',
    '.KK..KK.',
    '.EE..EE.',
    '...NN...',
    '..MMMM..',
    '.m....m.',
  ], { K: '#355c25', E: '#121a0d', N: '#3a6129', M: '#2a4520', m: '#3f6a2c' });
};
const zombieBody = (face, f) => {
  f.fill(C.shirt, C.shirtW);
  if (face === 'front') { f.map(['...SS...', '....S...'], { S: C.zSkin }); for (let x = 0; x < 8; x++) f.shade(x, 11, .82); }
  if (face === 'back') for (let x = 0; x < 8; x++) f.shade(x, 11, .82);
  if (isSide(face)) f.grade(1.04, .88);
  if (face === 'top') { f.map(['...SS...', '...SS...'], { S: C.zSkin }, 0, 1); }
};
const zombieArm = (face, f) => {
  f.fill(C.zSkin, C.zSkinW);
  if (isSide(face)) { f.grade(1.06, .84); for (let x = 0; x < f.w; x++) { f.shade(x, f.h - 1, .8); } }
  if (face === 'top') f.fill(C.zSkin);
};
const zombieLeg = (face, f) => {
  f.fill(C.pants, C.pantsW);
  if (isSide(face)) { f.grade(1.02, .9); f.rect(0, f.h - 2, f.w, 2, C.shoe); for (let x = 0; x < f.w; x++) if (f.r() < .5) f.set(x, f.h - 3, pick(f.r, C.pants)); }
  if (face === 'bottom') f.fill(C.shoe);
};

// skeleton
const skelHead = (face, f) => {
  f.fill(C.bone, C.boneW);
  if (isSide(face)) f.grade(1.04, .9);
  if (face === 'front') f.map([
    '........',
    '........',
    '........',
    '.HH..HH.',
    '.HD..DH.',
    '...NN...',
    '.T.T.T..',
    '..b..b..',
  ], { H: C.hole, D: '#141414', N: '#4a4a4a', T: '#3a3a3a', b: C.boneDk });
  if (face === 'back') { f.set(2, 3, C.boneDk[0]); f.set(5, 5, C.boneDk[1]); }
};
const skelBody = (face, f) => {
  if (face === 'top' || face === 'bottom') { f.fill(C.bone, C.boneW); return; }
  f.clearAll();
  const ribs = [0, 2, 4, 6], fb = face === 'front' || face === 'back';
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const spine = fb && (x === 3 || x === 4) && y < 10;
    const rib = ribs.includes(y) && (fb ? (x > 0 && x < 7) || y === 0 : true);
    const hip = y >= 10;
    if (spine || rib || hip) f.set(x, y, pick(f.r, C.bone, C.boneW));
  }
  for (let x = 0; x < f.w; x++) f.shade(x, 11, .8);
};
const skelLimb = (face, f) => {
  f.fill(C.bone, C.boneW);
  if (isSide(face)) { f.set(0, 5, C.boneDk[0]); f.set(1, 6, C.boneDk[1]); for (let y = 0; y < f.h; y++) f.shade(f.w - 1, y, .9); }
};
const bowPaint = (face, f) => { f.fill(C.wood); if (isSide(face)) for (let x = 0; x < f.w; x++) f.set(x, 0, '#c9a26a'); };
const bowGrip = (face, f) => { f.fill(['#4a3420', '#3e2b1a']); if (isSide(face)) f.set(0, 0, '#6b4d2a'); };
const strPaint = (face, f) => { f.fill(['#f4f4f4', '#e6e6e6']); };

// creeper
const crNoise = (face, f) => {
  f.fill(C.cr, C.crW);
  // let pixels copy a neighbour now and then so the camo forms small clumps instead of pure static
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const q = f.r(); if (q < .3 && x > 0) f.set(x, y, f.get(x - 1, y)); else if (q < .5 && y > 0) f.set(x, y, f.get(x, y - 1)); }
  // a few lighter "speckle pairs" and dark blotches for the classic camo look
  for (let i = 0; i < f.w * f.h / 10; i++) { const x = (f.r() * f.w) | 0, y = (f.r() * f.h) | 0; f.set(x, y, f.r() < .5 ? '#2a6623' : '#a6e096'); }
};
const creeperHead = (face, f) => {
  crNoise(face, f);
  if (face === 'front') f.map([
    '........',
    '........',
    '.FF..FF.',
    '.FF..FF.',
    '...FF...',
    '..FFFF..',
    '..FFFF..',
    '..F..F..',
  ], { F: C.crFace });
  if (face === 'front') { f.set(1, 2, '#2b2b2b'); f.set(5, 2, '#2b2b2b'); }
};
const creeperBody = (face, f) => { crNoise(face, f); if (isSide(face)) f.grade(1.04, .9); };
const creeperLeg = (face, f) => {
  crNoise(face, f);
  if (isSide(face)) { f.grade(1, .85); for (let x = 0; x < f.w; x++) f.set(x, f.h - 1, x % 2 ? '#1f4d1a' : '#2b6324'); }
  if (face === 'bottom') f.fill(['#1f4d1a', '#2b6324']);
};

// spider
const spHead = (face, f) => {
  f.fill(C.sp, C.spW);
  if (isSide(face)) f.grade(1.06, .85);
  if (face === 'front') f.map([
    '........',
    '..e..e..',
    'e......e',
    '.RRrrRR.',
    '.RR..RR.',
    '........',
    '..F..F..',
    '..F..F..',
  ], { e: C.eyeDk, R: C.eyeR, r: C.eyeR2, F: '#1e1a16' });
};
const spEyes = (face, f) => {
  f.clearAll();
  if (face === 'front') f.map([
    '        ',
    '  e  e  ',
    'e      e',
    ' RrrrrR ',
    ' Rr  rR ',
  ], { e: '#ff3b2e', R: '#ff2a2a', r: '#ff7a5e' });
};
const spNeck = (face, f) => { f.fill(C.sp, C.spW); if (isSide(face)) f.grade(1, .82); };
const spAbdomen = (face, f) => {
  f.fill(C.sp, C.spW);
  if (face === 'top') {
    // classic darker diamond + reddish brown chevron markings down the back
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const cx = Math.abs(x - 4.5), cy = y;
      if (cx < 1 && cy > 1 && cy < 10) f.set(x, y, '#241f1a');
      if ((cy === 3 || cy === 6 || cy === 9) && cx > 1 && cx < 3.6) f.set(x, y, pick(f.r, C.spMark));
      if ((cy === 4 || cy === 7) && cx > 2 && cx < 4) f.set(x, y, pick(f.r, C.spMark));
    }
  }
  if (face === 'back') { f.rect(3, 2, 4, 4, ['#241f1a', '#2c2620']); f.rect(4, 3, 2, 2, C.spMark); }
  if (isSide(face)) { f.grade(1.05, .82); for (let x = 2; x < f.w - 2; x += 3) f.set(x, 2, pick(f.r, C.spMark)); }
};
const spLeg = (face, f) => {
  f.fill(C.sp, C.spW);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (x % 5 === 4) f.set(x, y, '#5a4f43');
};

// pig
const pigHead = (face, f) => {
  f.fill(C.pig, C.pigW);
  if (isSide(face)) f.grade(1.04, .9);
  if (face === 'front') f.map([
    '........',
    '........',
    '........',
    'WK....KW',
    '........',
    '........',
    '........',
    '........',
  ], { W: '#ffffff', K: '#1a1a1a' });
};
const pigSnout = (face, f) => {
  f.fill(C.snout);
  if (face === 'front') { f.set(0, 1, C.nostril); f.set(3, 1, C.nostril); f.set(1, 1, '#fbd3cf'); f.set(2, 1, '#fbd3cf'); f.set(0, 2, '#e09a96'); f.set(3, 2, '#e09a96'); }
  if (isSide(face) && face !== 'front') f.grade(.95, .8);
};
const pigBody = (face, f) => {
  f.fill(C.pig, C.pigW);
  if (isSide(face)) f.grade(1.06, .86);
  if (face === 'bottom') f.fill(['#e08f8b', '#d98884']);
  if (face === 'back') { f.set(4, 2, '#e39592'); f.set(5, 2, '#d9817d'); f.set(5, 1, '#d9817d'); } // little tail
};
const pigLeg = (face, f) => { f.fill(C.pig, C.pigW); if (isSide(face)) { f.grade(1, .9); f.rect(0, f.h - 1, f.w, 1, C.hoofPig); } if (face === 'bottom') f.fill(C.hoofPig); };

// cow
function blobs(f, seedShift, pal, wt, n, rmin, rmax) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([f.r() * f.w, f.r() * f.h, rmin + f.r() * (rmax - rmin), rmin + f.r() * (rmax - rmin)]);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) for (const [cx, cy, rx, ry] of pts) { const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2; if (d < 1 - f.r() * .25) { f.set(x, y, pick(f.r, pal, wt)); break; } }
}
const cowHead = (face, f) => {
  f.fill(C.cowB, C.cowBW);
  if (face === 'front') {
    f.map([
      '...ww...',
      '...ww...',
      '..www...',
      'WK.ww.KW',
      '...ww...',
      '.mmmmmm.',
      '.mNmmNm.',
      '.mmmmmm.',
    ], { w: C.cowW, W: '#ffffff', K: '#111111', m: C.muzzle, N: '#4a3a33' });
  }
  if (face === 'left' || face === 'right') { const fr = face === 'left' ? 0 : f.w - 1; for (let y = 5; y < 8; y++) f.set(fr, y, pick(f.r, C.muzzle)); f.grade(1.03, .9); }
  if (face === 'top') blobs(f, 1, C.cowW, C.cowWW, 1, 1.5, 2.5);
};
const hornPaint = (face, f) => { f.fill(C.horn); f.set(0, 0, '#a59d88'); };
const cowBody = (face, f) => {
  f.fill(C.cowB, C.cowBW);
  blobs(f, 2, C.cowW, C.cowWW, face === 'top' || face === 'bottom' ? 4 : isSide(face) && f.w > 12 ? 3 : 1, 2.2, 4.5);
  if (isSide(face)) f.grade(1.05, .86);
};
const udderPaint = (face, f) => { f.fill(C.udder); };
const cowLeg = (face, f) => {
  f.fill(C.cowB, C.cowBW);
  if (isSide(face)) { if (f.r() < .6) f.rect(0, 4, f.w, 5, C.cowW, C.cowWW); f.grade(1, .9); f.rect(0, f.h - 2, f.w, 2, C.hoof); }
  if (face === 'bottom') f.fill(C.hoof);
};

// sheep
const sheepHead = (face, f) => {
  f.fill(C.sheepFace);
  if (isSide(face)) f.grade(1.02, .9);
  if (face === 'front') f.map([
    '......',
    '......',
    'WK..KW',
    '......',
    '..pp..',
    '..mm..',
  ], { W: '#ffffff', K: '#151515', p: '#c9958a', m: '#b98a80' });
};
const woolPaint = (face, f) => {
  f.fill(C.wool, C.woolW);
  // little curls: a light pixel with a shadow under-right
  for (let y = 0; y < f.h; y += 2) for (let x = (y / 2) % 2 ? 1 : 0; x < f.w; x += 3) { f.set(x, y, '#ffffff'); f.set(x + 1, y + 1, '#dedede'); }
  if (isSide(face)) f.grade(1.04, .88);
};
const sheepLeg = (face, f) => { f.fill(C.sheepFace); if (isSide(face)) { f.grade(1, .88); f.rect(0, f.h - 1, f.w, 1, ['#8b7d6b', '#7d705f']); } };
const sheepBody = (face, f) => { f.fill(C.sheepFace); };

// chicken
const chHead = (face, f) => {
  f.fill(C.ch, C.chW);
  if (isSide(face)) f.grade(1.02, .9);
  if (face === 'front') { f.set(0, 1, '#111111'); f.set(3, 1, '#111111'); }
  if (face === 'left') f.set(f.w - 1, 1, '#111111');
  if (face === 'right') f.set(0, 1, '#111111');
};
const chBody = (face, f) => { f.fill(C.ch, C.chW); if (isSide(face)) f.grade(1.03, .85); if (face === 'back') f.rect(1, 0, 4, 2, ['#ffffff', '#eeeeee']); };
const chWing = (face, f) => { f.fill(C.ch, C.chW); if (isSide(face)) { f.grade(1, .82); for (let x = 0; x < f.w; x++) if (x % 2) f.set(x, f.h - 1, '#d6d6d6'); } };
const chLeg = (face, f) => f.fill(C.chLeg);


// enderman: near-black, long limbs, glowing magenta eyes
const endFill = (face, f) => { f.fill(C.end, C.endW); if (isSide(face)) f.grade(1.08, .9); };
const END_EYE = { a: '#9b2fd0', b: '#e6a6ff', c: '#cc5cf4' };
const endHead = (face, f) => {
  endFill(face, f);
  if (face === 'front') f.map(['........', '........', '........', '........', 'abc..cba', '........', '........', '........'], END_EYE);
};
const endEyes = (face, f) => { f.clearAll(); if (face === 'front') f.map(['        ', '        ', '        ', '        ', 'abc  cba'], END_EYE); };
const endMouth = (face, f) => { f.fill(['#060606', '#0a0a0a', '#030303']); if (face === 'front') for (let x = 1; x < f.w - 1; x++) f.set(x, f.h - 1, x % 2 ? '#2a0f33' : '#1c0a22'); };
// carried block: a grass block painted to the same 16px scale
const carriedGrass = (face, f) => {
  if (face === 'top') { f.fill(C.grass); return; }
  f.fill(C.dirt); if (face === 'bottom') return;
  for (let x = 0; x < f.w; x++) { f.set(x, 0, pick(f.r, C.grass)); if (f.r() < .55) f.set(x, 1, pick(f.r, C.grass)); }
};
// slime: darker opaque core with the face, translucent shell around it
const slimeCore = (face, f) => {
  f.fill(C.slime, C.slimeW); if (isSide(face)) f.grade(1.04, .88);
  if (face === 'front') f.map(['......', 'EE..EE', 'EE..EE', '......', '...M..', '......'], { E: ['#1d3b17', '#244a1d'], M: '#2a5222' });
};
const slimeShell = (face, f) => {
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const edge = x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1;
    f.set(x, y, edge ? pick(f.r, ['#5aa845', '#62b04c']) : pick(f.r, C.slimeShell), edge ? 215 : 120 + ((f.r() * 40) | 0));
  }
  if (face !== 'bottom') { f.set(1, 1, '#c8f5b4', 190); f.set(2, 1, '#b2eb9c', 170); f.set(1, 2, '#b2eb9c', 170); }
};
// wolf: pale grey fur, darker saddle, brown-grey muzzle, black nose
const wolfFur = (face, f) => { f.fill(C.wolf, C.wolfW); if (isSide(face)) f.grade(1.04, .9); };
const wolfHead = (face, f) => {
  wolfFur(face, f);
  if (face === 'top') f.fill(C.wolfDk);
  if (face === 'front') f.map(['dddddd', 'dDddDd', '.K..K.', '......', '......', '......'], { d: C.wolfDk, D: '#7d7670', K: '#141414' });
  if (face === 'left' || face === 'right') f.rect(0, 0, f.w, 1, C.wolfDk);
  if (face === 'back') f.rect(0, 0, f.w, 2, C.wolfDk);
};
const wolfSnout = (face, f) => {
  f.fill(C.wolfMz); if (face === 'top') f.fill(['#a99e93', '#9f948a']);
  if (face === 'front') f.map(['.N.', 'nnn', '...'], { N: '#1a1a1a', n: '#8e8379' });
  if (face === 'bottom') f.fill(C.wolf);
};
const wolfEar = (face, f) => { f.fill(C.wolfDk); if (face === 'front') f.fill(['#8a817a', '#7c736c']); };
const wolfMane = (face, f) => {
  wolfFur(face, f);
  if (face === 'top') { f.fill(C.wolfDk); for (let x = 0; x < f.w; x++) if (f.r() < .4) f.set(x, f.h - 1, pick(f.r, C.wolf)); }
  if (isSide(face)) { f.rect(0, 0, f.w, 2, C.wolfDk); for (let x = 0; x < f.w; x++) if (f.r() < .5) f.set(x, 2, pick(f.r, C.wolfDk)); }
};
const wolfBody = (face, f) => {
  wolfFur(face, f);
  if (face === 'top') { f.fill(C.wolfDk); for (let y = 1; y < f.h; y += 3) for (let x = 1; x < f.w - 1; x++) if (f.r() < .5) f.set(x, y, '#857e78'); }
  if (isSide(face)) { f.rect(0, 0, f.w, 2, C.wolfDk); }
  if (face === 'bottom') f.fill(['#efedeb', '#e6e3e0']);
};
const wolfLeg = (face, f) => { f.fill(C.wolf, C.wolfW); if (isSide(face)) { f.grade(1, .88); f.rect(0, f.h - 1, f.w, 1, ['#b5aea8', '#aaa39d']); } };
const wolfTail = (face, f) => { f.fill(C.wolfDk); if (isSide(face)) { f.rect(0, f.h - 3, f.w, 3, C.wolf); f.grade(1.04, .92); } if (face === 'bottom') f.fill(C.wolf); };
const collarPaint = (face, f) => { f.fill(C.collar); if (isSide(face)) for (let x = 0; x < f.w; x++) f.set(x, f.h - 1, '#7e1515'); };
// squid: deep blue body with big side eyes, tentacles with lighter tips
const squidBody = (face, f) => {
  f.fill(C.sq, C.sqW); if (isSide(face)) f.grade(1.1, .82);
  for (let i = 0; i < f.w * f.h / 14; i++) f.set((f.r() * f.w) | 0, (f.r() * f.h) | 0, '#3f5d82');
  if (face === 'left' || face === 'right') f.map(['....wwww....', '...wwKKww...', '...wwKKww...', '....wwww....'], { w: ['#c9d4de', '#bcc8d3'], K: '#0e141d' }, 0, 9);
  if (face === 'bottom') f.map(['....mm....', '...mBBm...', '...mBBm...', '....mm....'].map(r => '.' + r + '.'), { m: '#1a2738', B: '#b9a27e' }, 0, 4);
};
const squidTent = (face, f) => { f.fill(C.sq, C.sqW); if (isSide(face)) { f.rect(0, f.h - 4, f.w, 4, ['#3d5a7d', '#46658a']); f.grade(.95, 1.05); } };

/* ------------------------------------------------------------------ models */
const humanoid = (head, body, arm, leg, armW, legW, armX) => [
  P('body', [8, 12, 4], [0, 12, 0], [0, 6, 0], { paint: body }),
  P('head', [8, 8, 8], [0, 24, 0], [0, 4, 0], { paint: head }),
  P('armR', [armW, 12, armW], [-armX, 22, 0], [0, -4, 0], { paint: arm }),
  P('armL', [armW, 12, armW], [armX, 22, 0], [0, -4, 0], { paint: arm, same: 'armR' }),
  P('legR', [legW, 12, legW], [-2, 12, 0], [0, -6, 0], { paint: leg }),
  P('legL', [legW, 12, legW], [2, 12, 0], [0, -6, 0], { paint: leg, same: 'legR' }),
];

export const MOB_MODELS = {
  zombie: { anim: 'zombie', parts: humanoid(zombieHead, zombieBody, zombieArm, zombieLeg, 4, 4, 6) },
  skeleton: {
    anim: 'skeleton', doubleSided: true, parts: [
      ...humanoid(skelHead, skelBody, skelLimb, skelLimb, 2, 2, 5),
      // bow held in the right hand; the stave runs along the arm's local Z so it stands upright when aimed.
      // Chunky (2px) light wood with a dark grip and bright string so it reads at a distance.
      P('bowMid', [2, 2, 4], [-5, 12, 0], [0, -0.5, 0], { parent: 'armR', paint: bowGrip }),
      P('bowTop', [1.6, 1.6, 5], [-5, 12, 0], [0, 0.6, 4.4], { parent: 'armR', paint: bowPaint, tsize: [2, 2, 4] }),
      P('bowBot', [1.6, 1.6, 5], [-5, 12, 0], [0, 0.6, -4.4], { parent: 'armR', paint: bowPaint, same: 'bowTop', tsize: [2, 2, 4] }),
      P('bowTip1', [1.4, 1.4, 2], [-5, 12, 0], [0, 2, 7.6], { parent: 'armR', paint: bowPaint, same: 'bowTop', tsize: [2, 2, 4] }),
      P('bowTip2', [1.4, 1.4, 2], [-5, 12, 0], [0, 2, -7.6], { parent: 'armR', paint: bowPaint, same: 'bowTop', tsize: [2, 2, 4] }),
      P('bowStr', [.45, .45, 15.5], [-5, 12, 0], [0, 2.9, 0], { parent: 'armR', paint: strPaint, tsize: [1, 1, 4] }),
    ],
  },
  creeper: {
    anim: 'quad', parts: [
      P('body', [8, 12, 4], [0, 6, 0], [0, 6, 0], { paint: creeperBody }),
      P('head', [8, 8, 8], [0, 18, 0], [0, 4, 0], { paint: creeperHead }),
      P('legFR', [4, 6, 4], [-2, 6, 4], [0, -3, 0], { paint: creeperLeg }),
      P('legFL', [4, 6, 4], [2, 6, 4], [0, -3, 0], { paint: creeperLeg, same: 'legFR' }),
      P('legBR', [4, 6, 4], [-2, 6, -4], [0, -3, 0], { paint: creeperLeg, same: 'legFR' }),
      P('legBL', [4, 6, 4], [2, 6, -4], [0, -3, 0], { paint: creeperLeg, same: 'legFR' }),
    ],
  },
  spider: {
    anim: 'spider', parts: [
      P('neck', [6, 6, 6], [0, 9, 0], [0, 0, 0], { paint: spNeck }),
      P('head', [8, 8, 8], [0, 9, 3], [0, 0, 4], { paint: spHead }),
      P('eyes', [8, 8, 8], [0, 9, 3], [0, 0, 4], { parent: 'head', paint: spEyes, inflate: .08, layer: 'eyes' }),
      P('abdomen', [10, 8, 12], [0, 9, -3], [0, 0, -6], { paint: spAbdomen }),
      ...[1.5, .5, -.5, -1.5].flatMap((z, i) => [
        P('legR' + i, [16, 2, 2], [-3, 9, z], [-7, 0, 0], { paint: spLeg, same: i ? 'legR0' : null }),
        P('legL' + i, [16, 2, 2], [3, 9, z], [7, 0, 0], { paint: spLeg, same: 'legR0' }),
      ]),
    ],
  },
  pig: {
    anim: 'quad', parts: [
      P('body', [10, 8, 16], [0, 10, 0], [0, 0, 0], { paint: pigBody }),
      P('head', [8, 8, 8], [0, 12, 6], [0, 0, 4], { paint: pigHead }),
      P('snout', [4, 3, 1], [0, 12, 6], [0, -1.5, 8.5], { parent: 'head', paint: pigSnout }),
      P('legFR', [4, 6, 4], [-3, 6, 5], [0, -3, 0], { paint: pigLeg }),
      P('legFL', [4, 6, 4], [3, 6, 5], [0, -3, 0], { paint: pigLeg, same: 'legFR' }),
      P('legBR', [4, 6, 4], [-3, 6, -6], [0, -3, 0], { paint: pigLeg, same: 'legFR' }),
      P('legBL', [4, 6, 4], [3, 6, -6], [0, -3, 0], { paint: pigLeg, same: 'legFR' }),
    ],
  },
  cow: {
    anim: 'quad', parts: [
      P('body', [12, 10, 18], [0, 17, 0], [0, 0, 0], { paint: cowBody }),
      P('head', [8, 8, 6], [0, 20, 8], [0, 0, 4], { paint: cowHead }),
      P('hornR', [1, 3, 1], [0, 20, 8], [-4.5, 4.5, 4], { parent: 'head', paint: hornPaint }),
      P('hornL', [1, 3, 1], [0, 20, 8], [4.5, 4.5, 4], { parent: 'head', paint: hornPaint, same: 'hornR' }),
      P('udder', [4, 1, 6], [0, 12, -4], [0, -.5, 0], { paint: udderPaint }),
      P('legFR', [4, 12, 4], [-4, 12, 6], [0, -6, 0], { paint: cowLeg }),
      P('legFL', [4, 12, 4], [4, 12, 6], [0, -6, 0], { paint: cowLeg }),
      P('legBR', [4, 12, 4], [-4, 12, -7], [0, -6, 0], { paint: cowLeg }),
      P('legBL', [4, 12, 4], [4, 12, -7], [0, -6, 0], { paint: cowLeg }),
    ],
  },
  sheep: {
    anim: 'quad', parts: [
      P('body', [8, 6, 16], [0, 16, 0], [0, 0, 0], { paint: sheepBody }),
      P('wool', [8, 6, 16], [0, 16, 0], [0, 0, 0], { paint: woolPaint, inflate: 1.75, layer: 'wool' }),
      P('head', [6, 6, 8], [0, 18, 8], [0, 1, 2], { paint: sheepHead }),
      P('headWool', [6, 6, 6], [0, 18, 8], [0, 1.6, 0.6], { parent: 'head', paint: woolPaint, inflate: .6, layer: 'wool' }),
      ...[['FR', -3, 5], ['FL', 3, 5], ['BR', -3, -7], ['BL', 3, -7]].flatMap(([n, x, z], i) => [
        P('leg' + n, [4, 12, 4], [x, 12, z], [0, -6, 0], { paint: sheepLeg, same: i ? 'legFR' : null }),
        P('legWool' + n, [4, 6, 4], [x, 12, z], [0, -3, 0], { parent: 'leg' + n, paint: woolPaint, inflate: .5, layer: 'wool', same: i ? 'legWoolFR' : null }),
      ]),
    ],
  },
  chicken: {
    anim: 'chicken', parts: [
      P('body', [6, 6, 8], [0, 8, 0], [0, 0, 0], { paint: chBody }),
      P('head', [4, 6, 3], [0, 9, 3], [0, 3, 1.5], { paint: chHead }),
      P('beak', [4, 2, 2], [0, 9, 3], [0, 3, 4], { parent: 'head', paint: (fc, f) => { f.fill(C.beak); if (isSide(fc)) f.grade(1.05, .85); } }),
      P('wattle', [2, 2, 2], [0, 9, 3], [0, 1, 3.5], { parent: 'head', paint: (fc, f) => f.fill(C.wattle) }),
      P('wingR', [1, 4, 6], [-3.5, 11, 0], [0, -2, 0], { paint: chWing }),
      P('wingL', [1, 4, 6], [3.5, 11, 0], [0, -2, 0], { paint: chWing, same: 'wingR' }),
      P('legR', [1, 5, 1], [-1.5, 5, 0], [0, -2.5, 0], { paint: chLeg }),
      P('legL', [1, 5, 1], [1.5, 5, 0], [0, -2.5, 0], { paint: chLeg, same: 'legR' }),
      P('footR', [3, 1, 3], [-1.5, 5, 0], [0, -4.5, .5], { parent: 'legR', paint: chLeg, same: 'legR', tsize: [1, 1, 1] }),
      P('footL', [3, 1, 3], [1.5, 5, 0], [0, -4.5, .5], { parent: 'legL', paint: chLeg, same: 'legR', tsize: [1, 1, 1] }),
    ],
  },
  enderman: {
    anim: 'enderman', parts: [
      P('body', [8, 12, 4], [0, 27, 0], [0, 6, 0], { paint: endFill }),
      P('mouth', [7, 6, 7], [0, 39, 0], [0, 3, 0], { paint: endMouth }), // hidden inside the head until the head lifts (angry)
      P('head', [8, 8, 8], [0, 39, 0], [0, 4, 0], { paint: endHead }),
      P('eyes', [8, 8, 8], [0, 39, 0], [0, 4, 0], { parent: 'head', paint: endEyes, inflate: .06, layer: 'eyes' }),
      P('armR', [2, 28, 2], [-5, 38, 0], [0, -13.5, 0], { paint: endFill }),
      P('armL', [2, 28, 2], [5, 38, 0], [0, -13.5, 0], { paint: endFill, same: 'armR' }),
      P('legR', [2, 27, 2], [-2, 27, 0], [0, -13.5, 0], { paint: endFill, same: 'armR', tsize: [2, 28, 2] }),
      P('legL', [2, 27, 2], [2, 27, 0], [0, -13.5, 0], { paint: endFill, same: 'armR', tsize: [2, 28, 2] }),
      P('block', [8, 8, 8], [0, 16, 9.5], [0, 0, 0], { paint: carriedGrass }),
    ],
  },
  slime: {
    anim: 'slime', parts: [
      P('core', [6, 6, 6], [0, 0, 0], [0, 4, 0], { paint: slimeCore }),
      P('shell', [8, 8, 8], [0, 0, 0], [0, 4, 0], { paint: slimeShell, layer: 'shell' }),
    ],
  },
  wolf: {
    anim: 'wolf', parts: [
      P('body', [6, 6, 9], [0, 10.5, -1.5], [0, 0, 0], { paint: wolfBody }),
      P('mane', [8, 7, 6], [0, 10.5, 3], [0, 0, 0], { paint: wolfMane }),
      P('collar', [8, 7, 1.4], [0, 10.5, 3], [0, 0, 1.75], { parent: 'mane', paint: collarPaint, inflate: .35, tsize: [8, 7, 2] }),
      P('head', [6, 6, 4], [0, 11.5, 6], [0, .5, 2], { paint: wolfHead }),
      P('snout', [3, 3, 4], [0, 11.5, 6], [0, -1, 6], { parent: 'head', paint: wolfSnout }),
      P('earR', [2, 2, 1], [0, 11.5, 6], [-2, 4.5, 2.5], { parent: 'head', paint: wolfEar }),
      P('earL', [2, 2, 1], [0, 11.5, 6], [2, 4.5, 2.5], { parent: 'head', paint: wolfEar, same: 'earR' }),
      P('legFR', [2, 8, 2], [-2, 8, 3.5], [0, -4, 0], { paint: wolfLeg }),
      P('legFL', [2, 8, 2], [2, 8, 3.5], [0, -4, 0], { paint: wolfLeg, same: 'legFR' }),
      P('legBR', [2, 8, 2], [-2, 8, -5], [0, -4, 0], { paint: wolfLeg, same: 'legFR' }),
      P('legBL', [2, 8, 2], [2, 8, -5], [0, -4, 0], { paint: wolfLeg, same: 'legFR' }),
      P('tail', [2, 8, 2], [0, 12, -6], [0, -4, 0], { paint: wolfTail, rot: [.63, 0, 0] }),
    ],
  },
  squid: {
    anim: 'squid', parts: [
      P('body', [12, 16, 12], [0, 8, 0], [0, 0, 0], { paint: squidBody }),
      ...Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, cx = Math.cos(a) * 5, cz = Math.sin(a) * 5;
        return P('t' + i, [2, 18, 2], [cx, 0, cz], [0, -9, 0], { parent: 'body', paint: squidTent, same: i ? 't0' : null, rot: [.15, Math.atan2(-cx, -cz), 0], order: 'YXZ' }); }),
    ],
  },
};

// natural sheep wool colours (weights roughly like the real game)
export const WOOL_COLORS = [
  { name: 'white', color: 0xffffff, w: .8 }, { name: 'light_gray', color: 0xa5a5a0, w: .05 },
  { name: 'gray', color: 0x55595c, w: .05 }, { name: 'black', color: 0x2a2a2e, w: .05 },
  { name: 'brown', color: 0x8a5a36, w: .04 }, { name: 'pink', color: 0xf3a6c0, w: .01 },
];

/* ------------------------------------------------------------------ painting + packing */
// face rects inside a part's texture block (Minecraft-style cross layout)
function faceRects(u, v, w, h, d) {
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h],
    left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}

const skinCache = new Map();
/** Paint one mob type's skin. Returns { canvas, W, H, rects: { partName: {top,bottom,left,right,front,back} } } */
export function paintMobSkin(type) {
  if (skinCache.has(type)) return skinCache.get(type);
  const model = MOB_MODELS[type]; if (!model) throw new Error('unknown mob ' + type);
  const own = model.parts.filter(p => !p.same);
  const dims = p => (p.tsize || p.size).map(s => Math.max(1, Math.ceil(s)));
  // shelf pack
  let W = 64; for (const p of own) { const [w, , d] = dims(p); if (2 * (w + d) > W) W = 128; }
  let x = 0, y = 0, rowH = 0; const at = {};
  for (const p of own) {
    const [w, h, d] = dims(p), bw = 2 * (w + d), bh = d + h;
    if (x + bw > W) { x = 0; y += rowH; rowH = 0; }
    at[p.name] = [x, y]; x += bw; rowH = Math.max(rowH, bh);
  }
  let H = 16; while (H < y + rowH) H *= 2;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), img = g.createImageData(W, H);
  const rects = {}; let seed = 1;
  for (const p of own) {
    const [w, h, d] = dims(p), [u, v] = at[p.name], fr = faceRects(u, v, w, h, d);
    rects[p.name] = fr;
    const r = rng(type.length * 1000 + (seed++) * 7919);
    for (const face of ['top', 'bottom', 'right', 'front', 'left', 'back']) {
      const [rx, ry, rw, rh] = fr[face];
      p.paint(face, painter(img.data, W, rx, ry, rw, rh, face, r));
    }
  }
  for (const p of model.parts) if (p.same) rects[p.name] = rects[p.same];
  g.putImageData(img, 0, 0);
  const out = { canvas, W, H, rects };
  skinCache.set(type, out);
  return out;
}

export const MOB_LIST = Object.keys(MOB_MODELS);
