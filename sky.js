// Sky + graphics settings (Timmy). Hooks into Mike's sky in engine.js without replacing it:
// - upgrades his sky dome shader in place: horizon-matched gradient, sun glow halo, sunrise/sunset colours on the sun's side
// - fog colour follows the horizon in the direction you look (orange toward a setting sun, blue away from it)
// - pixel-art sun and moon, Minecraft-style 3D blocky clouds on Fancy (Fast keeps his flat cloud layer)
// - Graphics: Fast / Fancy setting with a button in the pause menu. Phones start on Fast.
// No scene lights and no post-processing: everything is a few extra shader lines.
import * as THREE from './vendor/three.module.js';

const KEY = 'bc3d-gfx';
const C = h => new THREE.Color(h);
const R = h => { const n = parseInt(h.slice(1), 16); return new THREE.Color().setRGB((n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace); }; // raw: the cloud shader writes these straight to the screen
const PAL = { dusk: C('#a58f93'), dayTop: C('#78a7ff'), dayBot: C('#c0d8ff'), nightTop: C('#02030a'), nightBot: C('#0a0f1e'), setTop: C('#3d4f8f'), setBot: C('#b98aa6'), setCol: C('#ff8a3d'), setDeep: C('#e0503a'), glowDay: C('#fff4d6'), glowSet: C('#ffb469'),
  cloudDay: R('#ffffff'), cloudNight: R('#3a4357'), cloudPink: R('#ffa294'), cloudOrange: R('#ffbc78'), cloudPurple: R('#75688a') };

function pixTex(n, draw) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }

export function installGfx({ renderer, U, mats, skyMat, skyMesh, sun, moon, stars, clouds, scene, camera, TOUCH }, opts = {}) {
  let soft = false; try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); soft = /swiftshader|llvmpipe|software/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''); } catch (e) {}
  const auto = TOUCH || soft || (navigator.hardwareConcurrency || 8) <= 4 ? 'fast' : 'fancy'; // phones, weak CPUs and software GL start on Fast
  let quality = localStorage.getItem(KEY) || auto;

  // ---- uniforms shared with the block shader (fog toward the sun) ----
  U.uFogSun = { value: new THREE.Color() }; U.uSunDir = { value: new THREE.Vector3(1, 0, 0) }; U.uSunset = { value: 0 };
  for (const m of mats) for (const k of ['uFogSun', 'uSunDir', 'uSunset']) m.uniforms[k] = U[k];
  // shader variants instead of runtime branches: WATER only on the water material, SUNFOG only while the sun is low
  for (const m of mats) if (m.uniforms.uAlpha?.value < 1) { m.defines = Object.assign(m.defines || {}, { WATER: 1 }); m.needsUpdate = true; }
  let sunFog = false; const setSunFog = on => { if (on === sunFog) return; sunFog = on; for (const m of mats) { m.defines = m.defines || {}; if (on) m.defines.SUNFOG = 1; else delete m.defines.SUNFOG; m.needsUpdate = true; } };

  // ---- sky dome: same mesh + top/bot uniforms Mike drives, better shader ----
  Object.assign(skyMat.uniforms, { uSun: { value: new THREE.Vector3() }, uSunset: U.uSunset, uSetCol: { value: new THREE.Color() }, uFogSun: U.uFogSun, uFog: U.uFog });
  // all the colour maths runs per vertex (a 48x32 dome), the fragment shader is a single copy: cheap on phones
  skyMat.vertexShader = `uniform vec3 top; uniform vec3 bot; uniform vec3 uSun; uniform float uSunset; uniform vec3 uSetCol; uniform vec3 uFogSun; uniform vec3 uFog; varying vec3 vC;
void main(){ vec3 v=normalize(position); float h=v.y;
 vec3 c=mix(bot,top,smoothstep(0.0,0.6,h)*0.85+smoothstep(0.3,1.0,h)*0.15);
 vec2 hx=normalize(v.xz+vec2(1e-5)), sx=normalize(uSun.xz+vec2(1e-5)); float side=pow(max(dot(hx,sx),0.0),2.0);
 vec3 up=mix(c,uSetCol,uSunset*side*exp(-max(h,0.0)*4.0)*0.85), dn=mix(uFog,uFogSun,uSunset*side);
 // below and just above the horizon (~5 deg) = exactly the colour terrain fogs to, so fully fogged hills melt into the sky like MC; the warm glow sits above that
 vC=mix(dn,up,smoothstep(0.0,0.09,h)); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  skyMat.fragmentShader = 'varying vec3 vC; void main(){ gl_FragColor=vec4(vC,1.0); }';
  if (skyMesh) { skyMesh.geometry.dispose(); skyMesh.geometry = new THREE.SphereGeometry(500, 48, 32); }
  // sun glow: one additive soft sprite behind the sun instead of per-pixel maths over the whole sky
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.18, 'rgba(255,255,255,.4)'); gr.addColorStop(.5, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  glow.renderOrder = -9.5; scene.add(glow);
  // sun, moon and glow never draw below the horizon: one clipping plane at eye height (a discard in their own shaders, no extra pass)
  const horizon = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); renderer.localClippingEnabled = true;
  for (const m of [sun.material, moon.material, glow.material]) { m.clippingPlanes = [horizon]; m.needsUpdate = true; }
  skyMat.needsUpdate = true;

  // ---- pixel sun + moon (additive like Minecraft, so they glow into the sky) ----
  sun.material.map = pixTex(16, g => { g.fillStyle = 'rgba(255,240,170,.22)'; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(255,236,150,.45)'; g.fillRect(2, 2, 12, 12); g.fillStyle = '#ffe98a'; g.fillRect(4, 4, 8, 8); g.fillStyle = '#fffbe6'; g.fillRect(5, 5, 6, 6); });
  moon.material.map = pixTex(16, g => { g.fillStyle = 'rgba(200,210,255,.12)'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#d9dce8'; g.fillRect(4, 4, 8, 8); g.fillStyle = '#aeb3c6'; g.fillRect(5, 6, 2, 2); g.fillRect(9, 5, 1, 1); g.fillRect(8, 9, 3, 2); g.fillStyle = '#eef0f7'; g.fillRect(4, 4, 8, 1); });
  for (const m of [sun.material, moon.material]) { m.blending = THREE.AdditiveBlending; m.needsUpdate = true; }

  // ---- 3D blocky clouds (Fancy): 64x64 cells of 12x4x12 blocks, wraps every 768 blocks, drifts east ----
  const N = 64, CELL = 12, TH = 4, TILE = N * CELL, Y = 140;
  const grid = new Uint8Array(N * N); { let s = 1234567; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, v = new Float32Array(9 * 9).map(rnd);
    const val = (x, y, f) => { const gx = x / N * f, gy = y / N * f, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, at = (a, b) => v[((b % f) * 9 + (a % f)) % 81];
      const sm = t => t * t * (3 - 2 * t), a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sm(tx), b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sm(tx); return a + (b - a) * sm(ty); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) grid[y * N + x] = val(x, y, 8) * .7 + rnd() * .3 > .56 ? 1 : 0; }
  const pos = [], shade = [], nrm = [], idx = [], on = (x, z) => grid[((z + N) % N) * N + ((x + N) % N)];
  const quad = (pts, k, n) => { const b = pos.length / 3; for (const p of pts) { pos.push(...p); shade.push(k); nrm.push(...n); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { if (!on(x, z)) continue; const X0 = x * CELL, X1 = X0 + CELL, Z0 = z * CELL, Z1 = Z0 + CELL;
    quad([[X0, TH, Z0], [X0, TH, Z1], [X1, TH, Z1], [X1, TH, Z0]], 1, [0, 1, 0]); quad([[X0, 0, Z0], [X1, 0, Z0], [X1, 0, Z1], [X0, 0, Z1]], .72, [0, -1, 0]);
    if (!on(x - 1, z)) quad([[X0, 0, Z0], [X0, 0, Z1], [X0, TH, Z1], [X0, TH, Z0]], .8, [-1, 0, 0]); if (!on(x + 1, z)) quad([[X1, 0, Z1], [X1, 0, Z0], [X1, TH, Z0], [X1, TH, Z1]], .8, [1, 0, 0]);
    if (!on(x, z - 1)) quad([[X1, 0, Z0], [X0, 0, Z0], [X0, TH, Z0], [X1, TH, Z0]], .9, [0, 0, -1]); if (!on(x, z + 1)) quad([[X0, 0, Z1], [X1, 0, Z1], [X1, TH, Z1], [X0, TH, Z1]], .9, [0, 0, 1]); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1)); cg.setAttribute('nrm', new THREE.Float32BufferAttribute(nrm, 3)); cg.setIndex(idx);
  // sunrise/sunset: warm pink-orange where the low sun lights the cloud (undersides + sun-facing sides, toward the sun),
  // cool purple-grey on the far side; night: dim blue-grey. All colours are uniforms set once per frame.
  const cm = new THREE.ShaderMaterial({ transparent: true, depthWrite: true,
    uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uFog: U.uFog, uFogSun: U.uFogSun, uCam: { value: new THREE.Vector3() }, uSunDir: U.uSunDir, uSunset: U.uSunset, uWarm: { value: new THREE.Color() }, uCool: { value: new THREE.Color() } },
    vertexShader: `attribute float shade; attribute vec3 nrm; uniform vec3 uCam; uniform vec3 uSunDir; varying float vS; varying float vD; varying float vSide; varying float vLit;
void main(){ vS=shade; vec4 w=modelMatrix*vec4(position,1.0); vD=length(w.xz-uCam.xz);
 vec2 sx=normalize(uSunDir.xz+vec2(1e-5)); vSide=dot(normalize(w.xyz-uCam),vec3(sx.x,0.0,sx.y))*0.5+0.5; vSide*=vSide;
 vLit=max(dot(nrm,normalize(vec3(sx.x,-0.55,sx.y))),0.0); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uFog; uniform vec3 uFogSun; uniform float uSunset; uniform vec3 uWarm; uniform vec3 uCool; varying float vS; varying float vD; varying float vSide; varying float vLit;
void main(){ vec3 c=uCol*vS;
 vec3 warm=uWarm*(0.72+0.45*vLit), cool=uCool*(0.8+0.25*vS)+uWarm*(0.22*vLit);
 c=mix(c,mix(cool,warm,clamp(vSide*(0.75+0.45*vLit),0.0,1.0)),min(uSunset*1.35,1.0));
 float f=smoothstep(140.0,360.0,vD); vec3 fog=mix(uFog,uFogSun,min(uSunset*1.35,1.0)*vSide);
 gl_FragColor=vec4(mix(c,fog,f*0.7),0.82*(1.0-smoothstep(260.0,380.0,vD))); }` });
  const cloud3d = new THREE.Group(); const tiles = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(cg, cm); m.frustumCulled = false; m.renderOrder = 5; tiles.push(m); cloud3d.add(m); } scene.add(cloud3d);

  // ---- quality ----
  function apply() {
    const fancy = quality === 'fancy';
    renderer.setPixelRatio(Math.min(devicePixelRatio, fancy ? 2 : TOUCH ? 1.5 : 1.25)); renderer.setSize(innerWidth, innerHeight);
    cloud3d.visible = fancy; clouds.visible = !fancy;
    const b = document.getElementById('gfx'); if (b) b.textContent = 'Graphics: ' + (fancy ? 'Fancy' : 'Fast');
  }
  { const row = document.querySelector('#menu .row'); if (row && !document.getElementById('gfx')) { const b = document.createElement('button'); b.id = 'gfx'; b.type = 'button'; b.className = 'btn'; row.appendChild(b);
      b.onclick = () => { quality = quality === 'fancy' ? 'fast' : 'fancy'; localStorage.setItem(KEY, quality); apply(); }; } }
  apply();

  const tmp = new THREE.Color(), top = new THREE.Color(), bot = new THREE.Color(), fwd = new THREE.Vector3();
  // ---- weather: read-only from Mike's features.js (FX.weather.rain, and .thunder if it ever exists). FX lives inside engine.js,
  // reachable via the always-on window.__qa.fx(); the body 'raining' class is the fallback. Missing either = clear sky, no-op.
  // Snow biomes use the same flag (FX.weather.rain is true there too), so snow gets the same grey sky.
  let wRain = 0, wThunder = 0, wLast = 0;
  const weatherNow = () => { let w = null; try { w = opts.fx?.weather || window.__qa?.fx?.()?.weather || null; } catch (e) {} // opts.fx = FX from engine.js, read lazily (Mike)
    if (w) return { rain: !!w.rain, thunder: !!w.thunder }; return { rain: !!document.body?.classList.contains('raining'), thunder: false }; };
  const grey = (c, k, dim) => { const l = c.r * .3 + c.g * .59 + c.b * .11; return c.lerp(tmp.setRGB(l, l, l), k).multiplyScalar(dim); };
  const api = {
    renderer, // for QA: renderer.info
    get weather() { return { rain: +wRain.toFixed(2), thunder: +wThunder.toFixed(2) }; }, // for QA
    get fog() { return { near: +U.uFogNear.value.toFixed(1), far: +U.uFogFar.value.toFixed(1) }; }, // for QA
    get quality() { return quality; }, set quality(q) { quality = q === 'fancy' ? 'fancy' : 'fast'; apply(); },
    // called at the end of Mike's updateSky(): time 0..1 (0 sunrise, .25 noon, .5 sunset), day 0..1, under = camera in water
    update(time, day, under, cp) {
      const a = time * Math.PI * 2, sh = Math.sin(a), set0 = THREE.MathUtils.clamp(1 - Math.abs(sh) * 3.2, 0, 1);
      // weather fade: ~6 s to settle (exponential, frame-rate independent)
      const now = performance.now(), dt = wLast ? Math.min(.25, (now - wLast) / 1000) : 1; wLast = now; const W = weatherNow(), k = 1 - Math.exp(-dt / 2);
      wRain += ((W.rain ? 1 : 0) - wRain) * k; wThunder += ((W.thunder ? 1 : 0) - wThunder) * k;
      const rn = Math.min(1, wRain), th = Math.min(wRain, wThunder), skyDim = 1 - .32 * rn - .22 * th, set = set0 * (1 - .75 * rn); // rain washes out the sunset
      U.uSunDir.value.set(Math.cos(a), sh, 0); skyMat.uniforms.uSun.value.copy(U.uSunDir.value);
      top.copy(PAL.nightTop).lerp(PAL.dayTop, day).lerp(PAL.setTop, set * .45); bot.copy(PAL.nightBot).lerp(PAL.dayBot, day).lerp(PAL.setBot, set * .35);
      if (rn > .001) { grey(top, .8 * rn, skyDim); grey(bot, .7 * rn, skyDim); }
      skyMat.uniforms.top.value.copy(top); skyMat.uniforms.bot.value.copy(bot);
      const setCol = skyMat.uniforms.uSetCol.value.copy(PAL.setDeep).lerp(PAL.setCol, THREE.MathUtils.clamp(sh * 4 + .6, 0, 1));
      if (rn > .001) grey(setCol, .6 * rn, 1);
      // daylight: MC dims sky light in rain (~-20%) and more in thunder. engine.js sets uDay just before this call.
      U.uDay.value *= 1 - .2 * rn - .15 * th; if (clouds.material?.color) clouds.material.color.multiplyScalar(1 - .45 * rn);
      U.uSunset.value = under ? 0 : set;
      // terrain fog toward the sun: a muted dusk tone, not the saturated sky orange (that stays in the sky above the horizon)
      U.uFogSun.value.copy(bot).lerp(PAL.dusk, .45).lerp(setCol, .18);
      setSunFog(quality === 'fancy' && U.uSunset.value > .001); // Fancy: per-pixel sun-side fog
      if (!under) { U.uFog.value.copy(bot).lerp(PAL.dusk, set * .3);
        // Minecraft-style fog: clear out to ~82% of the render distance, fully fogged just inside the chunk border, same at every
        // time of day and quality. engine.js sets uFogFar = RD*CS*.95 (RD = render distance in use: 4 on phones, 7 desktop, ?rd= override), so recover RD*CS from it.
        const edge = U.uFogFar.value / .95; U.uFogFar.value = edge - 4; U.uFogNear.value = U.uFogFar.value * (.82 - .22 * rn - .1 * th); // rain: fog starts at ~60% (thunder ~50%), same solid edge
        // Fast: one fog colour per frame, taken from the horizon you're facing
        if (quality !== 'fancy' && set > 0 && camera) { camera.getWorldDirection(fwd); const l = Math.hypot(fwd.x, fwd.z) || 1, d = Math.max(0, fwd.x / l * Math.sign(Math.cos(a))); U.uFog.value.lerp(U.uFogSun.value, set * d * d); } }
      glow.material.color.copy(PAL.glowDay).lerp(PAL.glowSet, set).multiplyScalar(.55 * THREE.MathUtils.smoothstep(sh, -.12, .08)); glow.visible = sh > -.12 && !under;
      glow.position.copy(sun.position); glow.quaternion.copy(sun.quaternion);
      horizon.constant = -cp.y; // keep y >= eye height
      const veil = 1 - .85 * rn; glow.material.color.multiplyScalar(veil * veil); // sun/moon/stars behind the rain clouds
      sun.material.opacity = THREE.MathUtils.smoothstep(sh, -.02, .1) * veil; sun.visible = sh > -.02 && !under && veil > .02;
      moon.material.opacity = THREE.MathUtils.smoothstep(-sh, -.02, .1) * veil; moon.visible = -sh > -.02 && veil > .02;
      stars.material.opacity = Math.max(0, 1 - day * 1.6) * (.75 + .25 * Math.sin(performance.now() / 700)) * (1 - rn); // slow twinkle
      if (cloud3d.visible) { const d = (performance.now() / 1000 * .8) % TILE, bx = cp.x - d, bz = cp.z, ox = Math.floor(bx / TILE) * TILE, oz = Math.floor(bz / TILE) * TILE;
        const sx = bx - ox < TILE / 2 ? -1 : 1, sz = bz - oz < TILE / 2 ? -1 : 1;
        tiles.forEach((m, i) => m.position.set(ox + d + ((i & 1) ? sx * TILE : 0), Y, oz + ((i & 2) ? sz * TILE : 0)));
        cm.uniforms.uCam.value.copy(cp); cm.uniforms.uCol.value.copy(PAL.cloudNight).lerp(PAL.cloudDay, day);
        const lit = THREE.MathUtils.smoothstep(sh, -.22, .12); // sun just below the horizon still lights the undersides, then fades
        cm.uniforms.uWarm.value.copy(PAL.cloudPink).lerp(PAL.cloudOrange, THREE.MathUtils.clamp(sh * 5 + .5, 0, 1)).lerp(PAL.cloudNight, 1 - lit);
        cm.uniforms.uCool.value.copy(PAL.cloudPurple).lerp(PAL.cloudNight, (1 - lit) * .8);
        if (rn > .001) { const cd = 1 - .45 * rn - .15 * th; grey(cm.uniforms.uCol.value, .9 * rn, cd); grey(cm.uniforms.uWarm.value, .7 * rn, cd); grey(cm.uniforms.uCool.value, .7 * rn, cd); } }
    },
  };
  window.__gfx = api; return api;
}

// Difficulty button next to Graphics in the pause menu (Timmy). Saved in localStorage 'bc3d-difficulty', default Normal.
export function installDifficulty(mobs) {
  const KEYD = 'bc3d-difficulty', L = ['peaceful', 'easy', 'normal', 'hard'], name = d => d[0].toUpperCase() + d.slice(1);
  let d = localStorage.getItem(KEYD); if (!L.includes(d)) d = 'normal'; mobs.difficulty = d;
  const row = document.querySelector('#menu .row'); if (!row || document.getElementById('difficulty')) return;
  const b = document.createElement('button'); b.id = 'difficulty'; b.type = 'button'; b.className = 'btn'; b.textContent = 'Difficulty: ' + name(d); row.appendChild(b);
  b.onclick = () => { d = L[(L.indexOf(d) + 1) % L.length]; mobs.difficulty = d; localStorage.setItem(KEYD, d); b.textContent = 'Difficulty: ' + name(d); };
}
