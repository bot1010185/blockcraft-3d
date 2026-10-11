// Engine HUD (Mike): start/pause menu, hearts, toasts, death screen, debug line, touch movement.
// The hotbar, inventory, crafting and furnace screens belong to Timmy's ui.js.
const $ = s => document.querySelector(s);
export class HUD {
  constructor(o) { Object.assign(this, o); this.paused = true; this.heartsEl = $('#hearts'); this.toastEl = $('#toast'); this.menu = $('#menu');
    $('#play').onclick = () => { this.pause(false); this.onResume(); };
    $('#newworld').onclick = () => { if (confirm('Start a new world? This one will be deleted.')) this.onNewWorld(); };
    $('#respawn').onclick = () => { $('#death').hidden = true; this.onRespawn(); this.pause(false); this.onResume(); };
    const mute = $('#mute'), setM = () => mute.textContent = localStorage.getItem('bc3d-mute') === '1' ? 'Sound: Off' : 'Sound: On';
    mute.onclick = () => { localStorage.setItem('bc3d-mute', localStorage.getItem('bc3d-mute') === '1' ? '0' : '1'); setM(); }; setM();
    const fit = () => { const hb = document.querySelector('.bcui-hotbar'); if (hb && hb.offsetWidth) document.body.style.setProperty('--hb-w', hb.offsetWidth + 'px'); };
    addEventListener('resize', () => setTimeout(fit, 50)); setTimeout(fit, 100); setTimeout(fit, 1000);
    $('#controls').innerHTML = this.TOUCH ? 'Left thumb moves, right thumb looks. Hold ⛏ to mine or hit, tap ■ to place or use (hold it to eat food or draw a bow), and tap Bag for your inventory and crafting.'
      : 'WASD to move, Space to jump, Ctrl or double-tap W to sprint, Shift to sneak. Left click mines or hits, right click places or uses (hold it to eat or draw a bow). 1-9 or the wheel pick a slot, E opens your inventory, Q drops, F2 takes a screenshot.'; }
  pause(v) { this.paused = v; this.menu.hidden = !v; }
  hearts(hp) { hp = Math.ceil(hp - 1e-6); let h = ''; for (let i = 0; i < 10; i++) h += `<span class="${hp >= (i + 1) * 2 ? 'full' : hp === i * 2 + 1 ? 'half' : 'empty'}"></span>`; this.heartsEl.innerHTML = h; }
  food(f) { if (f === this._food) return; this._food = f; let h = ''; for (let i = 9; i >= 0; i--) h += `<span class="${f >= (i + 1) * 2 ? 'full' : f === i * 2 + 1 ? 'half' : 'empty'}"></span>`; const el = $('#food'); el.innerHTML = h; el.setAttribute('aria-label', `Hunger ${f / 2} of 10`); el.classList.toggle('starving', f <= 6); }
  armor(a) { const el = $('#armor'); el.hidden = !a; if (!a) return; let h = ''; for (let i = 0; i < 10; i++) h += `<span class="${a >= (i + 1) * 2 ? 'full' : a === i * 2 + 1 ? 'half' : 'empty'}"></span>`; el.innerHTML = h; el.setAttribute('aria-label', `Armor ${a / 2} of 10`); }
  // XP bar (Mike, Minecraft style): green bar right above the hotbar, level number in the middle. Numbers come from Timmy's ui.xp()
  xp(level, progress) { const el = $('#xpbar'); if (!el) return; el.style.setProperty('--xp', Math.max(0, Math.min(1, progress)).toFixed(3)); const n = $('#xplevel'); n.textContent = level > 0 ? level : ''; el.setAttribute('aria-label', `Level ${level}, ${Math.round(progress * 100)}% to next`); }
  setLava(v) { document.body.classList.toggle('inlava', v); }
  sleep(on) { document.body.classList.toggle('sleeping', on); }
  air(a, show) { const el = $('#air'); el.hidden = !show; if (!show) return; const n = Math.max(0, Math.ceil(a / 1.5)); if (n !== this._air) { this._air = n; let h = ''; for (let i = 0; i < 10; i++) h += `<span class="${i < n ? 'full' : 'empty'}"></span>`; el.innerHTML = h; } }
  flash() { document.body.classList.remove('hurt'); void document.body.offsetWidth; document.body.classList.add('hurt'); }
  setUnderwater(v) { document.body.classList.toggle('underwater', v); }
  dead() { $('#death').hidden = false; this.paused = true; document.exitPointerLock?.(); }
  toast(t) { this.toastEl.textContent = t; this.toastEl.classList.remove('show'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show'); }
  debug(t) { $('#debug').textContent = t; }
  bindTouch(h) { document.body.classList.add('touch'); const pad = $('#stick'), knob = $('#knob'); let sid = null, ox = 0, oy = 0, lid = null, lx = 0, ly = 0;
    const cv = document.querySelector('#game canvas');
    cv.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX < innerWidth * .5 && sid === null) { sid = t.identifier; ox = t.clientX; oy = t.clientY; pad.style.left = ox - 60 + 'px'; pad.style.top = oy - 60 + 'px'; pad.hidden = false; }
      else if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } } e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === sid) { let dx = t.clientX - ox, dy = t.clientY - oy; const d = Math.hypot(dx, dy); if (d > 50) { dx *= 50 / d; dy *= 50 / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; h.move(dx / 50, dy / 50); }
      if (t.identifier === lid) { h.look(t.clientX - lx, t.clientY - ly); lx = t.clientX; ly = t.clientY; } } e.preventDefault(); }, { passive: false });
    const end = e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; h.move(0, 0); knob.style.transform = ''; pad.hidden = true; } if (t.identifier === lid) lid = null; } };
    cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
    const hold = (sel, fn) => { const b = $(sel); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(true); b.classList.add('on'); }, { passive: false }); const up = e => { e.preventDefault(); fn(false); b.classList.remove('on'); }; b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); };
    hold('#t-jump', h.jump); hold('#t-sneak', h.sneak); hold('#t-mine', h.mine); hold('#t-place', h.place);
    $('#t-sprint').addEventListener('touchstart', e => { e.preventDefault(); $('#t-sprint').classList.toggle('on', h.sprint()); }, { passive: false });
    $('#t-bag').addEventListener('touchstart', e => { e.preventDefault(); h.bag(); }, { passive: false });
    $('#t-pause').addEventListener('touchstart', e => { e.preventDefault(); this.pause(true); }, { passive: false }); }
}
