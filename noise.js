// Seeded simplex noise (2D and 3D) plus small hash helpers.
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash3(x, y, z, s) { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

const G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
export function makeNoise(seed) {
  const rnd = mulberry32(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3c = 1 / 6;
  function n2(xin, yin) {
    let n0 = 0, n1 = 0, n2v = 0; const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
    let t0 = .5 - x0 * x0 - y0 * y0; if (t0 > 0) { const g = G3[pm12[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = .5 - x1 * x1 - y1 * y1; if (t1 > 0) { const g = G3[pm12[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = .5 - x2 * x2 - y2 * y2; if (t2 > 0) { const g = G3[pm12[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2v = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2v);
  }
  function n3(xin, yin, zin) {
    let n0, n1, n2v, n3v; const s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3c;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t); let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; } }
    else { if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; } }
    const x1 = x0 - i1 + G3c, y1 = y0 - j1 + G3c, z1 = z0 - k1 + G3c, x2 = x0 - i2 + 2 * G3c, y2 = y0 - j2 + 2 * G3c, z2 = z0 - k2 + 2 * G3c, x3 = x0 - 1 + .5, y3 = y0 - 1 + .5, z3 = z0 - 1 + .5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const c = (tt, gi, x, y, z) => { if (tt < 0) return 0; const g = G3[gi]; tt *= tt; return tt * tt * (g[0] * x + g[1] * y + g[2] * z); };
    n0 = c(.6 - x0*x0 - y0*y0 - z0*z0, pm12[ii + perm[jj + perm[kk]]], x0, y0, z0);
    n1 = c(.6 - x1*x1 - y1*y1 - z1*z1, pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1);
    n2v = c(.6 - x2*x2 - y2*y2 - z2*z2, pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2);
    n3v = c(.6 - x3*x3 - y3*y3 - z3*z3, pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
    return 32 * (n0 + n1 + n2v + n3v);
  }
  const fbm2 = (x, y, oct = 4) => { let a = 1, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f); n += a; a *= .5; f *= 2; } return s / n; };
  return { n2, n3, fbm2 };
}
