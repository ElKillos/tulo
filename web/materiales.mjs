// Cómo se pinta cada color de skin (core/colores.mjs) dentro de un ojo, sea
// cual sea su forma (D-023, D-025). Es la misma receta que se vio en las
// maquetas del 13-nov, adaptada a la cara de 240 × 240:
//
//   1. detrás   lo que asoma por fuera y queda por debajo del ojo (llamas, gotas)
//   2. halo     un desenfoque del color alrededor del contorno
//   3. relleno  el material, recortado al contorno del ojo
//   4. pupila   la forma de pupila (si la forma tiene), con el color que da el material
//   5. capa     lo que va encima dentro del ojo (escaneo, párpado de fumado…)
//   6. fuera    lo que sale del ojo por encima de todo (chispas, humo, tubo de neón)
//
// pintarOjo(ctx, mat, g, t, o):
//   mat  un color de core/colores.mjs (o el material de una única)
//   g    caja del ojo { x, y, w, h, r, trazo } en las coordenadas actuales de
//        ctx; trazo es una forma de core/formas.mjs (sin él, rectángulo redondeado)
//   t    tiempo en ms
//   o    { lado, pupila: null|'redonda'|'rendija', px, py, destello, fondo }
//
// Las medidas están pensadas para un ojo de 112 px y se escalan con k, que sale
// del ancho o del alto (los ojos de Jacobo pueden ser muy estrechos).

const FUM = new Set(['colocon', 'humo', 'nube']);
const S = { b: false, s: 0 }; // estado del glitch del ojo que se está pintando

function hex(h) {
  const n = parseInt(h.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function osc(h, f) {
  const [r, g, b] = hex(h);
  return `rgb(${(r * f) | 0}, ${(g * f) | 0}, ${(b * f) | 0})`;
}
function rnd(i) {
  const s = Math.sin(i * 127.1 + 11.3) * 43758.5;
  return s - Math.floor(s);
}
// El contorno del ojo: la forma de Jacobo (polígono con huecos, en una caja
// de 0 a 100) o, si no hay, un rectángulo redondeado. Se rellena y se recorta
// con la regla par-impar para que los huecos queden vacíos.
function contorno(x, g) {
  x.beginPath();
  const f = g.trazo;
  if (!f) {
    x.roundRect(g.x, g.y, g.w, g.h, Math.min(g.r, g.w / 2, g.h / 2));
    return;
  }
  for (const pts of [f.contorno, ...(f.huecos ?? [])]) {
    pts.forEach(([px, py], i) => {
      const X = g.x + (px / 100) * g.w;
      const Y = g.y + (py / 100) * g.h;
      if (i === 0) x.moveTo(X, Y); else x.lineTo(X, Y);
    });
    x.closePath();
  }
}
function rad(x, cx, cy, r, c0, c1, g) {
  const n = x.createRadialGradient(cx, cy, 0.5, cx, cy, Math.max(1, r));
  n.addColorStop(0, c0);
  n.addColorStop(1, c1);
  x.fillStyle = n;
  x.fillRect(g.x, g.y, g.w, g.h);
}
function estrella(x, px, py, s, col) {
  x.fillStyle = col;
  x.beginPath();
  x.moveTo(px, py - s); x.lineTo(px + s * 0.25, py); x.lineTo(px, py + s); x.lineTo(px - s * 0.25, py);
  x.closePath(); x.fill();
  x.beginPath();
  x.moveTo(px - s, py); x.lineTo(px, py + s * 0.25); x.lineTo(px + s, py); x.lineTo(px, py - s * 0.25);
  x.closePath(); x.fill();
}
function brilla(x, a, px, py, s) {
  estrella(x, px, py, s, `rgba(255,255,255,${a})`);
}
const parpadeoNeon = (t) => {
  const p = t % 3400;
  return p < 80 || (p > 170 && p < 230) || (p > 1500 && p < 1530) || (p > 2600 && p < 2900 && p % 60 < 30) ? 0.18 : 1;
};
const hayGlitch = (t) => {
  const p = t % 2700;
  return p < 240 || (p > 950 && p < 1010) || (p > 1820 && p < 2060);
};

function geoPupila(mat, g, o) {
  if (!o.pupila) return null;
  let rx, ry;
  if (o.pupila === 'rendija') { rx = g.w * 0.09; ry = g.h * 0.36; } else { rx = ry = Math.min(g.w, g.h) * 0.22; }
  const dil = mat.t === 'seta' ? 1.45 : FUM.has(mat.t) ? 1.3 : 1;
  if (dil > 1) {
    rx = Math.min(rx * (o.pupila === 'rendija' ? 2.6 : dil), g.w * 0.42);
    ry = Math.min(ry * dil, g.h * 0.45);
  }
  return { rx, ry, cx: g.x + g.w / 2 + o.px, cy: g.y + g.h / 2 + o.py };
}

function relleno(x, mat, g, t, o, k) {
  const c = mat.c;
  const T = mat.t;
  const ecx = g.x + g.w / 2;
  const ecy = g.y + g.h / 2;
  const lado = o.lado;
  let gr;
  if (!T) { x.fillStyle = c[0]; x.fillRect(g.x, g.y, g.w, g.h); return; }
  if (T === 'grad' || T === 'aurora') {
    const d = T === 'aurora' ? Math.sin(t / 900) * g.h * 0.35 : 0;
    gr = x.createLinearGradient(g.x, g.y - d, g.x + g.w * 0.3, g.y + g.h + d);
    c.forEach((col, i) => gr.addColorStop(i / (c.length - 1), col));
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h); return;
  }
  if (T === 'neon' || T === 'falla') {
    x.fillStyle = c[0]; x.fillRect(g.x, g.y, g.w, g.h);
    rad(x, ecx, ecy, g.w * 0.55, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)', g); return;
  }
  if (T === 'tubo') {
    x.fillStyle = osc(c[0], 0.1); x.fillRect(g.x, g.y, g.w, g.h);
    rad(x, ecx, ecy, g.w * 0.7, 'rgba(0,234,255,0)', 'rgba(0,234,255,0.35)', g); return;
  }
  if (T === 'uv') {
    x.fillStyle = '#12032a'; x.fillRect(g.x, g.y, g.w, g.h);
    rad(x, ecx, ecy, g.w * 0.65, 'rgba(166,77,255,0.7)', 'rgba(166,77,255,0.05)', g); return;
  }
  if (T === 'hielo') {
    gr = x.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#c9f3ff'); gr.addColorStop(1, '#7fd6ff');
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    for (let i = 0; i < 7; i++) {
      const a = Math.max(0, Math.sin(t / 260 + i * 2.1));
      brilla(x, a, g.x + rnd(i + lado * 9) * g.w, g.y + rnd(i + 3 + lado * 9) * g.h, (2 + 5 * a) * k);
    }
    return;
  }
  if (T === 'metal') {
    gr = x.createLinearGradient(g.x, g.y, g.x + g.w * 0.5, g.y + g.h);
    gr.addColorStop(0, c[0]); gr.addColorStop(0.4, c[1]); gr.addColorStop(0.6, c[2]); gr.addColorStop(1, c[3]);
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    const bx = g.x + (((t % 2600) / 2600) * 2.2 - 0.6) * g.w;
    const s = x.createLinearGradient(bx - 30 * k, 0, bx + 30 * k, 0);
    s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.75)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = s; x.fillRect(g.x, g.y, g.w, g.h); return;
  }
  if (T === 'fantasma') {
    gr = x.createLinearGradient(0, g.y, 0, g.y + g.h);
    gr.addColorStop(0, 'rgba(240,246,255,0.85)'); gr.addColorStop(1, 'rgba(150,180,255,0.08)');
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    for (let i = 0; i < 3; i++) {
      rad(x, g.x + g.w * (0.5 + 0.32 * Math.sin(t / 1300 + i * 2.1)), g.y + g.h * (0.5 + 0.3 * Math.cos(t / 1600 + i * 1.7)),
        g.w * 0.38, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', g);
    }
    return;
  }
  if (T === 'holo') {
    const h = t / 14 + o.px * 10;
    gr = x.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
    for (let i = 0; i < 5; i++) gr.addColorStop(i / 4, `hsl(${(((h + i * 70) % 360) + 360) % 360} 95% 78%)`);
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    const bx = g.x + (((t % 3000) / 3000) * 2 - 0.5) * g.w;
    const s = x.createLinearGradient(bx - 18 * k, 0, bx + 18 * k, 0);
    s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.55)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = s; x.fillRect(g.x, g.y, g.w, g.h); return;
  }
  if (T === 'matrix') {
    x.fillStyle = '#021a08'; x.fillRect(g.x, g.y, g.w, g.h);
    const paso = Math.max(6, 10 * k);
    x.font = `bold ${Math.max(6, Math.round(11 * k))}px monospace`;
    const ch = 'ｱｲｳｴｵｶｷｸｹｺ01ﾊﾐﾋ';
    for (let i = 0; i * paso < g.w; i++) {
      const sp = (0.04 + rnd(i + lado * 31) * 0.05) * k;
      const hy = ((t * sp + rnd(i + 7) * 400 * k) % (g.h + 90 * k)) - 20 * k;
      for (let j = 0; j < 8; j++) {
        const a = j === 0 ? 1 : 0.8 - j * 0.1;
        x.fillStyle = j === 0 ? `rgba(220,255,225,${a})` : `rgba(46,255,106,${a})`;
        x.fillText(ch[Math.floor(rnd(i * 13 + j + Math.floor(t / 140)) * ch.length)], g.x + i * paso + 1, g.y + hy - j * paso * 1.1);
      }
    }
    return;
  }
  if (T === 'galaxia') {
    gr = x.createRadialGradient(g.x + g.w * 0.4, g.y + g.h * 0.4, 2, ecx, ecy, g.w * 0.8);
    gr.addColorStop(0, '#3a1470'); gr.addColorStop(1, '#07031a');
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    [['255,63,210', 0], ['63,224,255', 2]].forEach(([col, d]) => rad(x,
      g.x + g.w * (0.5 + 0.3 * Math.sin(t / 2200 + d)), g.y + g.h * (0.5 + 0.3 * Math.cos(t / 2600 + d)),
      g.w * 0.45, `rgba(${col},0.5)`, `rgba(${col},0)`, g));
    const pt = Math.max(1, 1.8 * k);
    for (let brazo = 0; brazo < 2; brazo++) {
      for (let i = 0; i < 24; i++) {
        const r = 4 * k + i * (g.w * 0.52 / 24);
        const a = i * 0.36 + brazo * Math.PI + t / 2500;
        x.fillStyle = `rgba(225,205,255,${0.9 - i / 28})`;
        x.fillRect(ecx + Math.cos(a) * r, ecy + Math.sin(a) * r * (g.h / g.w), pt, pt);
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 500 + i * 1.7));
      x.fillStyle = `rgba(255,255,255,${a})`;
      const s = (rnd(i + 50) > 0.85 ? 2.2 : 1.2) * Math.max(0.7, k);
      x.fillRect(g.x + rnd(i + lado * 5) * g.w, g.y + rnd(i + 90 + lado * 5) * g.h, s, s);
    }
    const fase = (t + lado * 1700) % 5200;
    if (fase < 560) {
      const q = fase / 560;
      const sx = g.x - 10 * k + q * (g.w + 20 * k);
      const sy = g.y + g.h * 0.15 + q * g.h * 0.35;
      const l = x.createLinearGradient(sx - 30 * k, sy - 10 * k, sx, sy);
      l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(1, 'rgba(255,255,255,1)');
      x.strokeStyle = l; x.lineWidth = Math.max(1, 1.8 * k);
      x.beginPath(); x.moveTo(sx - 30 * k, sy - 10 * k); x.lineTo(sx, sy); x.stroke();
    }
    return;
  }
  if (T === 'lava') {
    gr = x.createLinearGradient(0, g.y, 0, g.y + g.h);
    gr.addColorStop(0, '#ffb000'); gr.addColorStop(0.5, '#ff4a00'); gr.addColorStop(1, '#d01800');
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h);
    for (let j = 0; j < 5; j++) {
      const y0 = g.y + (((j / 5) * g.h + t * 0.012 * k) % (g.h + 20 * k)) - 10 * k;
      x.beginPath();
      for (let xx = g.x; xx <= g.x + g.w; xx += 3) {
        const yy = y0 + Math.sin((xx - g.x) * 0.08 / k + t / 500 + j * 1.3) * 5 * k;
        if (xx === g.x) x.moveTo(xx, yy); else x.lineTo(xx, yy);
      }
      x.strokeStyle = j % 2 ? 'rgba(255,240,140,0.75)' : 'rgba(255,200,60,0.55)';
      x.lineWidth = (j % 2 ? 2.5 : 5) * k; x.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const cy = (t * 0.00035 * (1 + rnd(i)) + rnd(i + 4)) % 1;
      const by = g.y + g.h * (1.05 - cy * 1.1);
      const bx = g.x + g.w * (0.15 + 0.7 * rnd(i + lado)) + Math.sin(t / 600 + i) * 8 * k;
      const r = (6 + rnd(i + 2) * 10) * (0.5 + cy) * k;
      const a = cy > 0.85 ? (1 - cy) / 0.15 : 1;
      rad(x, bx, by, r, `rgba(255,250,190,${0.95 * a})`, 'rgba(255,170,0,0)', g);
    }
    return;
  }
  if (T === 'glitch') { x.fillStyle = S.b && S.s % 5 === 0 ? '#ff3fd2' : c[0]; x.fillRect(g.x, g.y, g.w, g.h); return; }
  if (T === 'arco') {
    gr = x.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
    for (let i = 0; i < 7; i++) gr.addColorStop(i / 6, `hsl(${(t / 8 + i * 55) % 360} 95% 62%)`);
    x.fillStyle = gr; x.fillRect(g.x, g.y, g.w, g.h); return;
  }
  if (T === 'fuego') {
    x.fillStyle = c[0]; x.fillRect(g.x, g.y, g.w, g.h);
    for (let j = 0; j < 3; j++) {
      x.beginPath();
      x.moveTo(g.x, g.y + g.h + 2);
      for (let xx = g.x; xx <= g.x + g.w; xx += 2) {
        const u = (xx - g.x) / k;
        const yy = g.y + g.h * (0.2 + 0.24 * j) - Math.abs(Math.sin(u * 0.09 + t / 170 + j * 1.9)) * g.h * 0.16 + Math.sin(u * 0.05 - t / 260 + j) * 6 * k;
        x.lineTo(xx, yy);
      }
      x.lineTo(g.x + g.w, g.y + g.h + 2); x.closePath();
      x.fillStyle = c[j + 1]; x.fill();
    }
    for (let i = 0; i < 6; i++) {
      const cy = (t * 0.0009 * (1 + rnd(i + 3)) + rnd(i)) % 1;
      x.fillStyle = `rgba(255,255,220,${1 - cy})`;
      x.fillRect(g.x + g.w * rnd(i + lado * 7) + Math.sin(t / 200 + i) * 4 * k, g.y + g.h * (1 - cy), 2 * k, 2 * k);
    }
    return;
  }
  if (T === 'seta') {
    const cx = ecx + o.px;
    const cy = ecy + o.py;
    const paso = 11 * k;
    const fase = (t * 0.03 * k) % paso;
    for (let r = Math.hypot(g.w, g.h) * 0.6 + paso - fase; r > 0; r -= paso) {
      const idx = Math.round((r + fase) / paso);
      x.fillStyle = `hsl(${(((idx * 47 - t / 5) % 360) + 360) % 360} 100% 60%)`;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    return;
  }
  if (T === 'caleido') {
    const n = 12;
    const h = t / 10;
    [[Math.hypot(g.w, g.h), t / 2000, 0], [g.w * 0.42, -t / 1400, 120]].forEach(([R, giro, dh]) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + giro;
        x.beginPath(); x.moveTo(ecx, ecy); x.arc(ecx, ecy, R, a0, a0 + (Math.PI * 2) / n + 0.01); x.closePath();
        x.fillStyle = `hsl(${(h + dh + (i % 3) * 110) % 360} 100% ${i % 2 ? 58 : 70}%)`;
        x.fill();
      }
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - t / 900;
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(ecx + Math.cos(a) * g.w * 0.32, ecy + Math.sin(a) * g.h * 0.32, 2.2 * k, 0, Math.PI * 2); x.fill();
    }
    return;
  }
  if (T === 'derretido') {
    const bh = g.h / 5;
    const off = (t * 0.02 * k) % bh;
    for (let j = -1; j < 7; j++) {
      const y0 = g.y + j * bh + off - bh;
      x.beginPath(); x.moveTo(g.x, g.y + g.h + 40);
      for (let xx = g.x; xx <= g.x + g.w; xx += 2) x.lineTo(xx, y0 + Math.sin(((xx - g.x) / k) * 0.07 + t / 420 + j) * 7 * k);
      x.lineTo(g.x + g.w, g.y + g.h + 40); x.closePath();
      x.fillStyle = `hsl(${(j * 55 - t / 7 + 7200) % 360} 95% 62%)`; x.fill();
    }
    return;
  }
  if (T === 'colocon') {
    const r = 0.5 + 0.5 * Math.sin(t / 1600);
    rad(x, ecx, ecy, g.w * 0.62, '#fff4f2', `rgb(255, ${(150 - 35 * r) | 0}, ${(150 - 30 * r) | 0})`, g);
    return;
  }
  if (T === 'humo' || T === 'nube') {
    const verde = T === 'humo';
    x.fillStyle = verde ? '#0c2612' : '#22103a'; x.fillRect(g.x, g.y, g.w, g.h);
    for (let i = 0; i < 5; i++) {
      const an = t / 4000 + i * 1.25;
      const rr = g.w * 0.25 * (0.6 + 0.4 * Math.sin(t / 3000 + i));
      const col = verde ? '150,235,160' : i % 2 ? '255,140,220' : '190,140,255';
      rad(x, ecx + Math.cos(an) * rr, ecy + Math.sin(an) * rr * 0.8, g.w * 0.38, `rgba(${col},0.4)`, `rgba(${col},0)`, g);
    }
  }
}

function pupila(x, mat, g, t, o, k) {
  const p = geoPupila(mat, g, o);
  if (!p) return;
  const T = mat.t;
  if (T === 'glitch' && S.b) { p.cx += (rnd(S.s + 9) - 0.5) * 16 * k; p.cy += (rnd(S.s + 19) - 0.5) * 8 * k; }
  const forma = () => { x.beginPath(); x.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2); };
  let col;
  if (T === 'fantasma') col = 'rgba(40,60,110,0.5)';
  else if (['galaxia', 'uv', 'matrix', 'lava', 'fuego', 'seta', 'caleido', 'derretido', 'humo', 'nube', 'colocon'].includes(T)) col = '#050505';
  else if (T === 'holo' || T === 'arco') col = 'rgba(20,10,40,0.85)';
  else if (T === 'tubo') col = mat.c[0];
  else col = osc(mat.c[mat.c.length > 2 ? 1 : mat.c.length - 1], 0.13);
  if (T === 'matrix' && t % 4500 < 700) {
    forma(); x.fillStyle = '#2eff6a'; x.fill();
    x.fillStyle = '#021a08';
    x.font = `bold ${Math.max(8, Math.round(Math.min(p.rx, p.ry) * 1.5))}px monospace`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ｱｲｳ01ﾊ'[Math.floor(t / 90) % 6], p.cx, p.cy);
    x.textAlign = 'start'; x.textBaseline = 'alphabetic';
    return;
  }
  forma(); x.fillStyle = col; x.fill();
  if (T === 'tubo') {
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.beginPath(); x.ellipse(p.cx, p.cy, p.rx * 0.45, p.ry * 0.45, 0, 0, Math.PI * 2); x.fill();
  }
  if (T === 'matrix' || T === 'uv' || T === 'lava') {
    forma();
    x.strokeStyle = T === 'uv' ? '#c88cff' : T === 'lava' ? '#ffd040' : '#2eff6a';
    x.lineWidth = (T === 'lava' ? 2.5 : 1.6) * k; x.stroke();
  }
  if (T === 'galaxia') {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + t / 500;
      x.strokeStyle = `hsla(${20 + i * 9},100%,65%,${0.25 + 0.75 * i / 28})`;
      x.lineWidth = 2.4 * k;
      x.beginPath(); x.ellipse(p.cx, p.cy, p.rx * 1.3 + 2 * k, p.ry * 1.15 + 2 * k, 0, a, a + 0.26); x.stroke();
    }
  }
  if (T === 'arco' || T === 'caleido') {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      x.strokeStyle = `hsl(${(i * 15 + t / 6) % 360} 95% 62%)`;
      x.lineWidth = 2.5 * k;
      x.beginPath(); x.ellipse(p.cx, p.cy, p.rx + k, p.ry + k, 0, a, a + 0.3); x.stroke();
    }
  }
}

function capa(x, mat, g, t, o, k) {
  const T = mat.t;
  const lado = o.lado;
  if (T === 'holo') {
    x.fillStyle = 'rgba(0,0,0,0.22)';
    const paso = Math.max(3, 4 * k);
    for (let y = g.y + ((t / 40) % paso); y < g.y + g.h; y += paso) x.fillRect(g.x, y, g.w, paso * 0.4);
    x.fillStyle = 'rgba(255,255,255,0.4)';
    x.fillRect(g.x, g.y + ((t / 12) % (g.h + 30 * k)) - 15 * k, g.w, 3 * k);
  }
  if (T === 'uv') {
    const cols = ['#b6ff00', '#ff3fd2', '#3fe0ff'];
    for (let i = 0; i < 11; i++) {
      const a = Math.max(0.3, 0.45 + 0.55 * Math.sin(t / 400 + i * 1.3));
      x.fillStyle = cols[i % 3]; x.shadowColor = cols[i % 3]; x.shadowBlur = 6 * k;
      x.fillRect(g.x + ((rnd(i + lado) * g.w + t * 0.008 * k * ((i % 3) + 1)) % g.w), g.y + rnd(i + 30) * g.h + Math.sin(t / 700 + i) * 4 * k, 2.2 * a * k + 0.6, 2.2 * a * k + 0.6);
    }
    x.shadowBlur = 0;
  }
  if (T === 'arco') {
    for (let i = 0; i < 5; i++) {
      const a = Math.max(0, Math.sin(t / 300 + i * 1.9));
      brilla(x, a, g.x + rnd(i + lado * 3 + 70) * g.w, g.y + rnd(i + lado * 3 + 80) * g.h, (2 + 5 * a) * k);
    }
  }
  if (T === 'glitch') {
    x.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = g.y; y < g.y + g.h; y += 3) x.fillRect(g.x, y, g.w, 1);
    if (S.b) {
      const cols = ['#ff2850', '#28dcff', '#ffffff', '#000000'];
      for (let i = 0; i < 5; i++) {
        x.fillStyle = cols[i % 4];
        x.fillRect(g.x + rnd(S.s * 7 + i) * g.w - 8 * k, g.y + rnd(S.s * 7 + i + 50) * g.h, (8 + rnd(S.s + i) * 30) * k, (3 + rnd(S.s + i + 9) * 9) * k);
      }
      x.fillStyle = '#000';
      x.fillRect(g.x - 10 * k, g.y + rnd(S.s) * g.h, g.w + 20 * k, 3 * k);
    }
  }
  if (FUM.has(T)) {
    // Párpado caído del color de la pantalla, con el borde del color del ojo.
    const ecx = g.x + g.w / 2;
    const lid = g.y + g.h * (0.4 + 0.05 * Math.sin(t / 1800));
    const borde = () => { x.lineTo(g.x + g.w + 6, lid); x.quadraticCurveTo(ecx, lid + g.h * 0.12, g.x - 6, lid); };
    x.beginPath(); x.moveTo(g.x - 6, g.y - 6); x.lineTo(g.x + g.w + 6, g.y - 6); borde(); x.closePath();
    x.fillStyle = o.fondo; x.fill();
    x.beginPath(); x.moveTo(g.x + g.w + 6, lid); x.quadraticCurveTo(ecx, lid + g.h * 0.12, g.x - 6, lid);
    x.strokeStyle = mat.c[0]; x.globalAlpha *= 0.7; x.lineWidth = 2.5 * k; x.stroke();
  }
}

function detras(x, mat, g, t, o, k) {
  const T = mat.t;
  const lado = o.lado;
  if (T === 'fuego') {
    const c = mat.c;
    x.shadowColor = c[1]; x.shadowBlur = 14 * k;
    for (let i = 0; i < 5; i++) {
      const bx = g.x + g.w * (0.14 + 0.18 * i);
      const by = g.y + g.h * 0.3;
      // Sin pasar del techo que deja la carcasa (`o.techo`, ver fuera()).
      // (16 de margen: el resplandor, shadowBlur de 14, también cuenta)
      const tope = o.techo == null ? Infinity : Math.max(g.h * 0.3, o.techo + g.h * 0.3 - 16 * k);
      const alto = Math.min(tope, g.h * (0.28 + 0.2 * Math.abs(Math.sin(t / 180 + i * 1.7 + lado))));
      const w = g.w * 0.09;
      const gr = x.createLinearGradient(0, by, 0, by - alto);
      gr.addColorStop(0, c[3]); gr.addColorStop(0.35, c[2]); gr.addColorStop(0.75, c[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr;
      x.beginPath(); x.moveTo(bx - w, by);
      x.quadraticCurveTo(bx - w, by - alto * 0.55, bx + Math.sin(t / 150 + i) * w * 0.8, by - alto);
      x.quadraticCurveTo(bx + w, by - alto * 0.55, bx + w, by); x.closePath(); x.fill();
    }
    x.shadowBlur = 0;
  }
  if (T === 'derretido') {
    const base = x.globalAlpha;
    for (let i = 0; i < 5; i++) {
      const dx = g.x + g.w * (0.18 + 0.16 * i);
      const cy = (t / 2600 + rnd(i + lado)) % 1;
      const largo = 6 * k + cy * g.h * 0.5;
      const y0 = g.y + g.h * 0.72;
      x.globalAlpha = base * (cy > 0.9 ? (1 - cy) * 10 : 1);
      x.fillStyle = `hsl(${(i * 60 + t / 8) % 360} 95% 62%)`;
      x.beginPath(); x.roundRect(dx - 3.5 * k, y0, 7 * k, largo, 3.5 * k); x.fill();
      x.beginPath(); x.arc(dx, y0 + largo, 5 * k, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = base;
  }
}

function fuera(x, mat, g, t, o, k) {
  const T = mat.t;
  const lado = o.lado;
  const base = x.globalAlpha;
  if (T === 'tubo') {
    contorno(x, g); x.shadowColor = mat.c[0]; x.shadowBlur = 18 * k; x.strokeStyle = mat.c[0]; x.lineWidth = 6 * k; x.stroke();
    x.shadowBlur = 0; contorno(x, g); x.strokeStyle = '#eaffff'; x.lineWidth = 2 * k; x.stroke();
  }
  if (T === 'holo') {
    x.globalAlpha = base * 0.6; x.lineWidth = 1.5 * k;
    x.translate(-2.5 * k, 0); contorno(x, g); x.strokeStyle = '#ff3fd2'; x.stroke();
    x.translate(5 * k, 0); contorno(x, g); x.strokeStyle = '#3fe0ff'; x.stroke();
    x.translate(-2.5 * k, 0); x.globalAlpha = base;
    for (let i = 0; i < 3; i++) {
      const a = Math.max(0, Math.sin(t / 350 + i * 2.3));
      brilla(x, a, g.x + rnd(i + lado * 4 + 20) * g.w, g.y + (i % 2 ? -4 * k : g.h + 4 * k), (2 + 6 * a) * k);
    }
  }
  if (T === 'matrix') { contorno(x, g); x.strokeStyle = 'rgba(46,255,106,0.75)'; x.lineWidth = 1.5 * k; x.stroke(); }
  if (T === 'lava' || T === 'fuego') {
    for (let i = 0; i < 8; i++) {
      const cy = (t * 0.0006 * (1 + rnd(i + 40)) + rnd(i + 41)) % 1;
      const ex = g.x + g.w * (0.15 + 0.7 * rnd(i + 42 + lado)) + Math.sin(t / 300 + i) * 6 * k * cy;
      // Las chispas suben 60 px (ojo de 112) o lo que deje la carcasa encima
      // del ojo (`o.techo`, en las mismas unidades que g; face.mjs lo calcula).
      const sale0 = T === 'fuego' ? -g.h * 0.15 : 8 * k;
      const sale = o.techo == null ? sale0 : Math.max(sale0, 3 * k - o.techo); // nacen bajo el techo
      const sube = o.techo == null ? 60 * k : Math.max(0, Math.min(60 * k, o.techo + sale - 3 * k));
      const ey = g.y + sale - cy * sube;
      x.fillStyle = T === 'fuego' ? mat.c[3] : `rgb(255, ${(150 + rnd(i) * 90) | 0}, 40)`;
      x.globalAlpha = base * (1 - cy);
      const s = Math.max(1, 2.4 * (1 - cy * 0.5) * k);
      x.fillRect(ex, ey, s, s);
    }
    x.globalAlpha = base;
  }
  if (mat.id === 'fenix') {
    for (let i = 0; i < 5; i++) {
      const a = Math.max(0, Math.sin(t / 280 + i * 1.6));
      estrella(x, g.x - 8 * k + rnd(i + lado * 6 + 90) * (g.w + 16 * k), g.y - 10 * k + rnd(i + lado * 6 + 95) * (g.h + 20 * k), (2 + 5 * a) * k, `rgba(255,220,120,${a})`);
    }
  }
  if (T === 'fantasma') {
    for (let i = 0; i < 3; i++) {
      const cy = (t / 2400 + i / 3) % 1;
      x.fillStyle = `rgba(230,240,255,${(1 - cy) * 0.4})`;
      x.beginPath();
      x.arc(g.x + g.w * (0.3 + 0.2 * i) + Math.sin(t / 500 + i) * 6 * k, g.y + 4 * k - cy * 45 * k, (3 + cy * 7) * k, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (FUM.has(T)) {
    const col = T === 'humo' ? '170,235,175' : T === 'nube' ? '205,165,255' : '220,220,220';
    for (let i = 0; i < 4; i++) {
      const cy = (t / 3200 + i / 4 + lado * 0.13) % 1;
      x.fillStyle = `rgba(${col},${(1 - cy) * (T === 'colocon' ? 0.2 : 0.35)})`;
      x.beginPath();
      x.arc(g.x + g.w * 0.5 + Math.sin(t / 900 + i) * 10 * k + (i - 1.5) * 12 * k * cy, g.y + g.h * 0.2 - cy * 75 * k, (5 + cy * 16) * k, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (T === 'glitch' && S.b) {
    for (let i = 0; i < 4; i++) {
      x.fillStyle = i % 2 ? '#28dcff' : '#ff2850';
      const dcha = rnd(S.s + i * 3) > 0.5;
      x.fillRect(dcha ? g.x + g.w + 2 * k + rnd(S.s + i) * 10 * k : g.x - 14 * k + rnd(S.s + i) * 10 * k, g.y + rnd(S.s + i + 30) * g.h, (4 + rnd(S.s + i + 5) * 8) * k, (2 + rnd(S.s + i + 6) * 4) * k);
    }
  }
}

function halo(mat, t) {
  const T = mat.t;
  if (mat.halo) return [mat.halo, 14];
  if (T === 'neon') return [mat.c[0], 22 + 6 * Math.sin(t / 400)];
  if (T === 'falla') return [mat.c[0], 24];
  if (T === 'uv') return ['#a64dff', 20];
  if (T === 'hielo') return ['#9fe8ff', 16];
  if (T === 'metal') return [mat.c[1], 10];
  if (T === 'fantasma') return ['#cfe0ff', 18];
  if (T === 'matrix') return ['#2eff6a', 14];
  if (T === 'lava') return ['#ff6a00', 20];
  if (T === 'fuego') return [mat.c[1], 22];
  if (T === 'galaxia') return ['#8c5cff', 12];
  if (T === 'holo') return [`hsl(${(t / 14) % 360} 95% 70%)`, 12];
  if (T === 'arco' || T === 'seta' || T === 'caleido' || T === 'derretido') return [`hsl(${(t / 8) % 360} 95% 60%)`, 12];
  if (T === 'colocon') return ['#ff4d6a', 10];
  if (T === 'humo') return ['#6dff8a', 10];
  if (T === 'nube') return ['#b07cff', 14];
  return null;
}

// Cuánto sobresale por arriba, abajo y a los lados lo que pinta un material,
// en múltiplos del ancho del ojo: face.mjs agranda su recorte con esto.
export function margenDe(mat) {
  const T = mat?.t;
  if (T === 'fuego' || FUM.has(T) || T === 'lava' || T === 'fantasma') return { arriba: 1.2, abajo: 0.3, lados: 0.25 };
  if (T === 'derretido') return { arriba: 0.3, abajo: 0.9, lados: 0.25 };
  return { arriba: 0.3, abajo: 0.3, lados: 0.25 };
}

export function pintarOjo(x, mat, g0, t, o) {
  const k = Math.max(g0.w, g0.h * 0.78) / 112;
  let g = g0;
  let alfa = 1;
  if (mat.t === 'seta') {
    const s = 1 + 0.06 * Math.sin(t / 380);
    g = { ...g0, x: g0.x - (g0.w * (s - 1)) / 2, y: g0.y - (g0.h * (s - 1)) / 2, w: g0.w * s, h: g0.h * s };
  }
  if (mat.t === 'fantasma') {
    g = { ...g0, y: g0.y + Math.sin(t / 700) * 5 * k };
    const fase = t % 6000;
    const f = fase < 900 ? 0.1 + 0.9 * Math.abs(Math.cos((fase / 900) * Math.PI)) : 1;
    alfa = (0.62 + 0.25 * Math.sin(t / 900)) * f;
  }
  if (mat.t === 'falla') alfa = parpadeoNeon(t);
  S.b = mat.t === 'glitch' && hayGlitch(t);
  S.s = Math.floor(t / 60);

  const dibuja = (h, tinte, a) => {
    x.save();
    x.globalAlpha *= a;
    const b = tinte ? null : halo(mat, t);
    if (b) {
      x.shadowColor = b[0]; x.shadowBlur = b[1] * k;
      contorno(x, h); x.fillStyle = b[0]; x.fill('evenodd');
      x.shadowBlur = 0;
    }
    contorno(x, h);
    x.clip('evenodd');
    if (tinte) {
      x.fillStyle = tinte; x.fillRect(h.x, h.y, h.w, h.h);
    } else {
      relleno(x, mat, h, t, o, k);
      pupila(x, mat, h, t, o, k);
      capa(x, mat, h, t, o, k);
    }
    x.restore();
  };

  x.save();
  x.globalAlpha *= alfa;
  detras(x, mat, g, t, o, k);
  x.restore();
  if (mat.t === 'fantasma') dibuja({ ...g, y: g.y + 14 * k }, null, alfa * 0.16);
  if (S.b) {
    const d = (S.s % 2 ? 1 : -1) * (5 + rnd(S.s) * 7) * k;
    x.save();
    x.globalCompositeOperation = 'lighter';
    dibuja({ ...g, x: g.x - d }, 'rgba(255,40,80,0.85)', 1);
    dibuja({ ...g, x: g.x + d }, 'rgba(40,220,255,0.85)', 1);
    x.restore();
    g = { ...g, x: g.x + (rnd(S.s + 3) - 0.5) * 10 * k };
  }
  dibuja(g, null, alfa);
  x.save();
  x.globalAlpha *= alfa;
  fuera(x, mat, g, t, o, k);
  x.restore();
  if (o.destello && g.h > 24 && mat.t !== 'matrix' && mat.t !== 'tubo' && !FUM.has(mat.t)) {
    x.fillStyle = mat.t === 'fantasma' ? 'rgba(255,255,255,0.5)' : 'rgba(255, 255, 255, 0.9)';
    x.beginPath(); x.arc(g.x + g.w * 0.3, g.y + g.h * 0.26, 4, 0, Math.PI * 2); x.fill();
  }
}
