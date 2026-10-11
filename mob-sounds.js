/* Blockcraft 3D mob sounds (Amir). Procedural WebAudio, no audio files.
   Hookup (engine.js):
     import { attachMobSounds } from './mob-sounds.js';
     attachMobSounds(mobs, { camera, getMuted: () => localStorage.getItem('bc3d-mute') === '1' });
   Every name mobs.js emits through onSound has a voice here; unknown names fall back by suffix (_hurt, _death, _idle).
   Volume falls off with distance to the listener (camera) and pans left/right. */

let AC = null;
function ctx() {
  if (AC) return AC;
  const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return null;
  try { AC = new C(); } catch (e) { return null; }
  const resume = () => { if (AC.state === 'suspended') AC.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, resume, { passive: true });
  return AC;
}

const noiseBuf = {};
function noise(ac, secs = 1) {
  const k = secs; if (noiseBuf[k] && noiseBuf[k].sampleRate === ac.sampleRate) return noiseBuf[k];
  const n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf[k] = b);
}

// pitch multiplier for the voice being scheduled right now (baby mobs, slime sizes); set around each play() call
let PM = 1;
/* tiny synthesis helpers; every voice ends in `out` (a GainNode that the player routes to pan + master) */
function env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); return a + hold + rel; }
function osc(ac, out, t, type, f0, f1, dur, vol, a = .02, filt) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; f0 *= PM; if (f1) f1 *= PM; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  let node = o; if (filt) { const f = ac.createBiquadFilter(); f.type = filt.type || 'lowpass'; f.frequency.setValueAtTime(filt.f, t); if (filt.f1) f.frequency.exponentialRampToValueAtTime(filt.f1, t + dur); f.Q.value = filt.q ?? 1; o.connect(f); node = f; }
  node.connect(g).connect(out); env(g, t, a, vol, Math.max(0, dur - a - .08), .08); o.start(t); o.stop(t + dur + .05); return o;
}
function nz(ac, out, t, dur, vol, type, f0, f1, q = 1, a = .005) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise(ac, 2); f.type = type; f0 *= PM; if (f1) f1 *= PM; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  s.connect(f).connect(g).connect(out); env(g, t, a, vol, Math.max(0, dur * .3), dur * .7); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function vib(ac, o, t, rate, depth, dur) { const l = ac.createOscillator(), g = ac.createGain(); l.frequency.value = rate; g.gain.value = depth; l.connect(g).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
function trem(ac, gainNode, t, rate, depth, dur) { const l = ac.createOscillator(), g = ac.createGain(); l.frequency.value = rate; g.gain.value = depth; l.connect(g).connect(gainNode.gain); l.start(t); l.stop(t + dur + .05); }
const R = (a, b) => a + Math.random() * (b - a);

// formant-ish voice: sawtooth through two bandpass filters (vowel colour)
function voice(ac, out, t, f0, f1, dur, vol, formants, vibr) {
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * PM, t); o.frequency.exponentialRampToValueAtTime(f1 * PM, t + dur);
  const g = ac.createGain(); env(g, t, Math.min(.08, dur * .25), vol, dur * .45, dur * .4);
  for (const [ff, q, k] of formants) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff * Math.sqrt(PM); b.Q.value = q; const kg = ac.createGain(); kg.gain.value = k; o.connect(b).connect(kg).connect(g); }
  g.connect(out); if (vibr) vib(ac, o, t, vibr[0], vibr[1], dur); o.start(t); o.stop(t + dur + .1); return g;
}

const V = {
  // --- zombie: low wet groans
  zombie_idle: (ac, o, t) => { voice(ac, o, t, R(85, 100), R(62, 72), R(.9, 1.3), .9, [[400, 4, 1], [900, 6, .5]], [5, 4]); nz(ac, o, t, .8, .08, 'lowpass', 500, 200); },
  zombie_hurt: (ac, o, t) => { voice(ac, o, t, 140, 95, .35, .9, [[500, 4, 1], [1100, 6, .5]], [9, 6]); nz(ac, o, t, .15, .25, 'bandpass', 700, 300, 1.5); },
  zombie_death: (ac, o, t) => { voice(ac, o, t, 120, 45, 1.4, 1, [[380, 4, 1], [800, 5, .4]], [4, 5]); },
  // round 3b: zombie pounding a wooden door (hollow thump + splinter crackle), the door giving way, mobs touching lava
  zombie_door: (ac, o, t) => { osc(ac, o, t, 'sine', 120, 55, .22, .9, .002); nz(ac, o, t, .16, .7, 'lowpass', 900, 250, 1, .002); nz(ac, o, t + .02, .2, .3, 'bandpass', 2600, 1400, 2.5, .003); for (let i = 0; i < 3; i++) nz(ac, o, t + .05 + i * R(.03, .06), .04, .18, 'highpass', 3000, 5000, 1, .001); },
  zombie_door_break: (ac, o, t) => { osc(ac, o, t, 'sine', 140, 40, .45, 1, .002); nz(ac, o, t, .6, .9, 'lowpass', 1600, 200, .8, .002); for (let i = 0; i < 7; i++) nz(ac, o, t + i * R(.03, .08), .07, .35, 'bandpass', R(1800, 3500), 900, 2, .001); },
  lava_sizzle: (ac, o, t) => { nz(ac, o, t, .6, .35, 'highpass', 3500, 6000, .7, .01); for (let i = 0; i < 5; i++) nz(ac, o, t + i * R(.04, .1), .05, .2, 'bandpass', R(1500, 3000), 2000, 3, .001); },
  zombie_attack: (ac, o, t) => { nz(ac, o, t, .12, .6, 'lowpass', 300, 120, 1); voice(ac, o, t + .03, 110, 85, .25, .5, [[450, 4, 1]]); },
  // --- skeleton: bone rattles
  skeleton_idle: (ac, o, t) => rattle(ac, o, t, R(5, 9), .35, .25),
  skeleton_hurt: (ac, o, t) => rattle(ac, o, t, 12, .25, .45),
  skeleton_death: (ac, o, t) => { rattle(ac, o, t, 22, .9, .45); nz(ac, o, t + .5, .3, .3, 'bandpass', 1500, 500, 2); },
  skeleton_shoot: (ac, o, t) => { osc(ac, o, t, 'triangle', 330, 160, .18, .5, .002, { type: 'lowpass', f: 2200 }); nz(ac, o, t + .02, .25, .35, 'highpass', 1800, 4000, .7); },
  // --- arrows
  arrow_hit: (ac, o, t) => { nz(ac, o, t, .09, .6, 'bandpass', 900, 500, 2); osc(ac, o, t, 'sine', 160, 90, .1, .4, .002); },
  arrow_hit_player: (ac, o, t) => { nz(ac, o, t, .1, .7, 'bandpass', 1400, 600, 1.5); osc(ac, o, t, 'sine', 220, 110, .12, .4, .002); },
  // --- creeper: (silent walker) fuse hiss + boom
  creeper_idle: (ac, o, t) => nz(ac, o, t, .25, .04, 'bandpass', 700, 500, 1),
  creeper_hurt: (ac, o, t) => { nz(ac, o, t, .18, .35, 'bandpass', 600, 300, 1.2); osc(ac, o, t, 'square', 140, 90, .15, .12, .005, { f: 800 }); },
  creeper_death: (ac, o, t) => { nz(ac, o, t, .5, .3, 'bandpass', 500, 150, 1); },
  creeper_hiss: (ac, o, t) => { const g = ac.createGain(); g.connect(o); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.7, t + 1.4); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(); s.buffer = noise(ac, 2); f.type = 'highpass'; f.frequency.setValueAtTime(2500, t); f.frequency.linearRampToValueAtTime(4500, t + 1.5); s.connect(f).connect(g); s.start(t); s.stop(t + 1.65); },
  explode: (ac, o, t) => { nz(ac, o, t, 1.8, 1.2, 'lowpass', 1800, 60, .7, .003); nz(ac, o, t, .35, .9, 'bandpass', 900, 200, .8, .002); osc(ac, o, t, 'sine', 70, 28, 1.2, 1, .005); },
  // --- spider: chitter + hiss
  spider_idle: (ac, o, t) => { chitter(ac, o, t, .45, 1); nz(ac, o, t + .1, .3, .08, 'highpass', 3000, 5000, .7); },
  spider_hurt: (ac, o, t) => { chitter(ac, o, t, .2, 1.4); nz(ac, o, t, .15, .3, 'bandpass', 2500, 1200, 1.5); },
  spider_death: (ac, o, t) => { chitter(ac, o, t, .7, .8); nz(ac, o, t, .8, .25, 'bandpass', 1800, 400, 1.2); },
  spider_attack: (ac, o, t) => { nz(ac, o, t, .22, .5, 'highpass', 2000, 4500, .8, .01); },
  // --- pig: nasal oinks, squeals when hurt
  pig_idle: (ac, o, t) => { const n = Math.random() < .5 ? 2 : 1; for (let i = 0; i < n; i++) { voice(ac, o, t + i * .22, R(160, 190), 120, .17, .8, [[650, 5, 1], [1300, 6, .7], [2400, 8, .3]], [30, 18]); nz(ac, o, t + i * .22, .14, .12, 'bandpass', 900, 500, 3); } },
  pig_hurt: (ac, o, t) => { voice(ac, o, t, 600, 820, .3, .7, [[1200, 4, 1], [2600, 6, .5]], [14, 40]); },
  pig_death: (ac, o, t) => { voice(ac, o, t, 820, 300, .8, .8, [[1100, 4, 1], [2400, 6, .4]], [10, 40]); },
  // --- cow: long moo with an opening "mm-oo" filter
  cow_idle: (ac, o, t) => moo(ac, o, t, R(125, 145), R(.95, 1.3), .9),
  cow_hurt: (ac, o, t) => moo(ac, o, t, 185, .42, .9),
  cow_death: (ac, o, t) => moo(ac, o, t, 160, 1.1, .9, 70),
  // --- sheep: bleating baa (fast amplitude wobble)
  sheep_idle: (ac, o, t) => baa(ac, o, t, R(300, 360), R(.7, .95), .7),
  sheep_hurt: (ac, o, t) => baa(ac, o, t, 420, .35, .8),
  sheep_death: (ac, o, t) => baa(ac, o, t, 380, .9, .8, 200),
  // --- chicken: clucks and squawks
  chicken_idle: (ac, o, t) => { const n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) cluck(ac, o, t + i * R(.09, .14), R(620, 760)); },
  chicken_hurt: (ac, o, t) => { voice(ac, o, t, 900, 1500, .22, .6, [[1800, 4, 1], [3200, 6, .5]], [25, 60]); nz(ac, o, t, .2, .2, 'bandpass', 3000, 2000, 2); },
  chicken_death: (ac, o, t) => { voice(ac, o, t, 1400, 500, .5, .6, [[1600, 4, 1], [3000, 6, .4]], [25, 60]); },
  chicken_egg: (ac, o, t) => { osc(ac, o, t, 'sine', 700, 280, .12, .6, .003); },
  // --- enderman: warbling "vwoop" breaths, a harsh scream when stared at, a pitch-swept teleport
  enderman_idle: (ac, o, t) => { const g = voice(ac, o, t, R(70, 90), R(52, 64), R(1.1, 1.5), .55, [[320, 3, 1], [760, 5, .45]], [3.2, 9]); trem(ac, g, t, 7, .2, 1.5); nz(ac, o, t + .1, 1, .07, 'bandpass', 500, 260, 2); },
  enderman_stare: (ac, o, t) => { for (const d of [1, 1.013, .987]) { const g = voice(ac, o, t, 260 * d, 760 * d, 1.5, .4, [[1200, 3, 1], [2600, 4, .6]], [11, 40]); trem(ac, g, t, 17, .25, 1.5); } nz(ac, o, t, 1.4, .22, 'bandpass', 1800, 3200, 1.5, .05); },
  enderman_teleport: (ac, o, t) => { osc(ac, o, t, 'sine', 180, 1300, .16, .45, .005, { type: 'lowpass', f: 2500 }); osc(ac, o, t + .15, 'sine', 1300, 140, .38, .5, .005, { type: 'lowpass', f: 2200, f1: 500 }); nz(ac, o, t, .5, .18, 'bandpass', 600, 2400, 2); },
  enderman_hurt: (ac, o, t) => { const g = voice(ac, o, t, 230, 140, .45, .7, [[900, 3, 1], [2000, 4, .5]], [14, 30]); trem(ac, g, t, 22, .35, .45); },
  enderman_death: (ac, o, t) => { for (const d of [1, 1.02]) { const g = voice(ac, o, t, 520 * d, 70 * d, 2, .45, [[1000, 3, 1], [2200, 4, .5]], [6, 30]); trem(ac, g, t, 12, .25, 2); } nz(ac, o, t, 1.8, .15, 'bandpass', 1500, 300, 1.5); },
  enderman_attack: (ac, o, t) => { nz(ac, o, t, .14, .7, 'lowpass', 400, 120, 1); osc(ac, o, t, 'sine', 120, 60, .18, .5, .003); },
  // --- slime: wet squelches (pitch follows size)
  slime_jump: (ac, o, t) => { nz(ac, o, t, .2, .55, 'lowpass', 900, 180, 3); osc(ac, o, t, 'sine', 230, 110, .16, .45, .004); osc(ac, o, t + .05, 'sine', 330, 160, .09, .18, .004); },
  slime_attack: (ac, o, t) => { nz(ac, o, t, .16, .6, 'lowpass', 700, 150, 4); osc(ac, o, t, 'sine', 180, 90, .14, .5, .003); },
  slime_hurt: (ac, o, t) => { nz(ac, o, t, .22, .55, 'bandpass', 800, 300, 3); osc(ac, o, t, 'sine', 300, 140, .2, .4, .003); },
  slime_death: (ac, o, t) => { for (let i = 0; i < 3; i++) { nz(ac, o, t + i * .07, .2, .45, 'lowpass', 1000 - i * 200, 160, 3); osc(ac, o, t + i * .07, 'sine', 260 - i * 40, 90, .16, .35, .003); } },
  // --- wolf: pants, barks, growl, whine, yelp
  wolf_idle: (ac, o, t) => { if (Math.random() < .55) { for (let i = 0; i < 4; i++) nz(ac, o, t + i * .19, .13, .22, 'bandpass', i % 2 ? 1300 : 1700, 900, 2.5, .02); } else bark(ac, o, t, R(380, 430)); },
  wolf_growl: (ac, o, t) => { const g = voice(ac, o, t, 78, 70, 1.1, .7, [[300, 3, 1], [650, 4, .5]], [3, 4]); trem(ac, g, t, 26, .35, 1.1); nz(ac, o, t, 1, .12, 'lowpass', 400, 250, 1); },
  wolf_whine: (ac, o, t) => { osc(ac, o, t, 'sine', 880, 760, .45, .35, .03); osc(ac, o, t + .5, 'sine', 940, 700, .55, .3, .03); },
  wolf_hurt: (ac, o, t) => { voice(ac, o, t, 900, 620, .2, .7, [[1400, 4, 1], [2600, 6, .4]], [20, 30]); },
  wolf_death: (ac, o, t) => { voice(ac, o, t, 820, 280, .9, .7, [[1300, 4, 1], [2500, 6, .4]], [8, 25]); },
  wolf_attack: (ac, o, t) => { voice(ac, o, t, 140, 95, .22, .55, [[500, 4, 1], [1100, 5, .4]], [25, 10]); nz(ac, o, t + .08, .08, .45, 'bandpass', 1500, 700, 2); },
  wolf_tame: (ac, o, t) => { bark(ac, o, t, 440); bark(ac, o, t + .22, 470); osc(ac, o, t + .1, 'sine', 990, 990, .2, .2, .01); osc(ac, o, t + .25, 'sine', 1480, 1480, .25, .16, .01); },
  // --- squid: bubbles
  squid_idle: (ac, o, t) => bubbles(ac, o, t, 5, .5),
  squid_hurt: (ac, o, t) => { bubbles(ac, o, t, 8, .35); nz(ac, o, t, .2, .3, 'lowpass', 700, 200, 2); },
  squid_death: (ac, o, t) => { bubbles(ac, o, t, 14, 1.1); nz(ac, o, t, .6, .3, 'lowpass', 600, 120, 1.5); },
  squid_squirt: (ac, o, t) => { nz(ac, o, t, .35, .5, 'lowpass', 1200, 200, 1.5, .004); bubbles(ac, o, t + .05, 4, .25); },
  // --- misc
  breed: (ac, o, t) => { osc(ac, o, t, 'sine', 880, 880, .18, .25, .01); osc(ac, o, t + .12, 'sine', 1320, 1320, .25, .2, .01); },
  baby: (ac, o, t) => { osc(ac, o, t, 'sine', 520, 1040, .16, .5, .004); nz(ac, o, t, .1, .15, 'highpass', 3000, 3000, .7); },
  splash: (ac, o, t) => { nz(ac, o, t, .5, .6, 'lowpass', 2200, 400, .8, .004); nz(ac, o, t + .05, .35, .2, 'highpass', 3000, 1500, .7); },
  // generic fallbacks
  _hurt: (ac, o, t) => { nz(ac, o, t, .12, .5, 'bandpass', 600, 300, 2); osc(ac, o, t, 'sine', 180, 90, .12, .3, .003); },
  _death: (ac, o, t) => { nz(ac, o, t, .4, .4, 'bandpass', 500, 120, 1.5); },
  _idle: () => {},
};
function rattle(ac, o, t, n, span, vol) { for (let i = 0; i < n; i++) { const tt = t + Math.random() * span; nz(ac, o, tt, .025, vol * R(.5, 1), 'bandpass', R(1800, 3600), 0, 6, .001); osc(ac, o, tt, 'square', R(700, 1200), 0, .02, vol * .15, .001, { type: 'bandpass', f: 1500, q: 3 }); } }
function chitter(ac, o, t, dur, pitch) { const n = Math.floor(dur * 28); for (let i = 0; i < n; i++) { const tt = t + i / 28 + Math.random() * .01; nz(ac, o, tt, .03, R(.15, .35), 'bandpass', R(1100, 1700) * pitch, 0, 8, .002); } }
function moo(ac, o, t, f, dur, vol, fEnd) {
  f *= PM; if (fEnd) fEnd *= PM; const ox = ac.createOscillator(); ox.type = 'sawtooth'; ox.frequency.setValueAtTime(f * .9, t); ox.frequency.linearRampToValueAtTime(f, t + dur * .25); ox.frequency.exponentialRampToValueAtTime(fEnd || f * .78, t + dur);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(900, t + dur * .45); lp.frequency.linearRampToValueAtTime(420, t + dur);
  const g = ac.createGain(); env(g, t, .12, vol, dur * .55, dur * .35); ox.connect(lp).connect(g).connect(o); vib(ac, ox, t, 4.5, 2.5, dur); ox.start(t); ox.stop(t + dur + .1);
}
function baa(ac, o, t, f, dur, vol, fEnd) { const g = voice(ac, o, t, f, fEnd || f * .9, dur, vol, [[900, 4, 1], [1500, 6, .6], [2600, 8, .25]], [6, 6]); trem(ac, g, t, 24, vol * .45, dur); }
function bark(ac, o, t, f) { voice(ac, o, t, f, f * .62, .16, .9, [[900, 4, 1], [1800, 5, .6], [3000, 7, .25]], [30, 20]); nz(ac, o, t, .07, .3, 'bandpass', 1500, 800, 2); }
function bubbles(ac, o, t, n, span) { for (let i = 0; i < n; i++) { const tt = t + Math.random() * span, f = R(250, 600); osc(ac, o, tt, 'sine', f, f * R(1.8, 2.6), .07, R(.15, .3), .004); } }
function cluck(ac, o, t, f) { osc(ac, o, t, 'square', f, f * .7, .06, .35, .003, { type: 'bandpass', f: 1500, q: 2.5 }); nz(ac, o, t, .05, .1, 'bandpass', 2200, 1500, 3); }

/**
 * Wire mob sounds to a MobManager. Returns a small controller { play(name, pos), setVolume(v), detach() }.
 * onSound(name, pos, { pitch, volume }) - the optional 3rd arg comes from mobs.js (baby mobs squeak higher, slimes scale with size).
 * opts: camera (THREE camera used as listener), getMuted() -> bool, volume (0..1, default .8), maxDistance (default 24),
 *       chain (call the previous onSound too, default false), explode (play 'explode', default true)
 */
export function attachMobSounds(mobs, opts = {}) {
  const prev = mobs.onSound;
  const player = createMobSounds(opts);
  mobs.onSound = (name, pos, o) => { player.play(name, pos, o); if (opts.chain && prev) prev(name, pos, o); };
  player.detach = () => { mobs.onSound = prev; };
  return player;
}

export function createMobSounds(opts = {}) {
  let master = null, volume = opts.volume ?? .8, voices = 0; const last = new Map();
  const maxD = opts.maxDistance ?? 24, getMuted = opts.getMuted || (() => { try { return localStorage.getItem('bc3d-mute') === '1'; } catch (e) { return false; } });
  const self = {
    names: Object.keys(V).filter(k => !k.startsWith('_')),
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    /** returns true if a voice was started */
    play(name, pos, o) {
      if (getMuted()) return false;
      if (name === 'explode' && opts.explode === false) return false;
      const ac = ctx(); if (!ac || ac.state === 'closed') return false;
      if (ac.state !== 'running') { ac.resume().catch(() => {}); return false; } // before the first user gesture: drop, don't queue
      if (!master) { master = ac.createGain(); master.gain.value = volume; const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination); }
      // distance + pan from the camera
      let gain = 1, pan = 0;
      const cam = opts.camera;
      if (pos && cam) {
        cam.updateMatrixWorld && cam.updateMatrixWorld();
        const e = cam.matrixWorld.elements, dx = pos.x - e[12], dy = pos.y - e[13], dz = pos.z - e[14], d = Math.hypot(dx, dy, dz);
        const big = name === 'explode' ? 3 : 1; if (d > maxD * big) return false;
        gain = Math.pow(1 - d / (maxD * big), 1.6); if (d > .01) pan = Math.max(-1, Math.min(1, (dx * e[0] + dy * e[1] + dz * e[2]) / d)) * .8;
      }
      if (gain < .01) return false;
      const now = ac.currentTime, k = last.get(name) || 0; if (now - k < .06) return false; last.set(name, now);
      if (voices > 14) return false;
      const fn = V[name] || V['_' + (name.split('_').pop())] || null; if (!fn) return false;
      const out = ac.createGain(); out.gain.value = gain * .55 * (o && o.volume ? o.volume : 1);
      let tail = out; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; out.connect(p); tail = p; }
      tail.connect(master);
      voices++; setTimeout(() => { voices--; try { tail.disconnect(); } catch (e) {} }, name === 'explode' ? 2200 : 1700);
      PM = o && o.pitch ? o.pitch : 1;
      try { fn(ac, out, now + .01); } catch (e) { return false; } finally { PM = 1; }
      return true;
    },
  };
  return self;
}

export const MOB_SOUND_NAMES = Object.keys(V).filter(k => !k.startsWith('_'));
