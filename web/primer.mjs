// Pinta el primer encendido (D-024, D-035) en la pantalla redonda de 466
// (core/pantalla.mjs). El guion (fases y ruleta) está en core/primer.mjs; aquí,
// cómo se ve cada instante. Es el mismo dibujo que firmware/nucleo/pk_primer.c,
// pasado a canvas: coordenadas de la cara de 240 escaladas ×K, como allí.
// Todo depende solo de t: el mismo instante da el mismo fotograma.

import { BASE } from '../core/expressions.mjs';
import { skin as skinDe, idDe } from '../core/skins.mjs';
import { momento, DURA, ABRE_EN, PASOS } from '../core/primer.mjs';
import { pintarOjo, margenDe } from './materiales.mjs';
import * as P from '../core/pantalla.mjs';

const LADO = P.CARA; // coordenadas de la cara de 240
const C = LADO / 2;
const SEP = BASE.gap / 2 + BASE.w / 2; // del centro de la cara al centro de cada ojo
const NEUTRO = '#dde3f0';
// Luz de cada rareza: gris, azul, morado, dorado y arcoíris (propuesta).
const LUZ = ['#c9d1e0', '#3d8bff', '#a64dff', '#ffc21a', '#ffffff'];
const LETRA = 'system-ui, "Segoe UI", sans-serif';

const lim = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const tramo = (t, a, b) => lim((t - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const sale = (x) => 1 - (1 - x) ** 3;
const rebote = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2);
// sube de 0 a 1 y vuelve a 0 entre a y b
const bulto = (t, a, b) => {
  const p = (t - a) / (b - a);
  return p <= 0 || p >= 1 ? 0 : suave(1 - Math.abs(2 * p - 1));
};
const hash01 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const luz = (nivel, t) => (nivel >= 4 ? `hsl(${(t / 6) % 360} 95% 62%)` : LUZ[nivel]);

export function createPrimer(canvas, fondoDe) {
  const x = canvas.getContext('2d');

  function resplandor(cx, cy, r, color, alfa) {
    if (alfa <= 0 || r <= 0) return;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    x.save();
    x.globalAlpha = lim(alfa);
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.restore();
  }

  function anillo(r, grosor, color, alfa, arco = false, giro = 0) {
    if (alfa <= 0 || r <= 0 || grosor <= 0) return;
    x.save();
    x.globalAlpha = lim(alfa);
    if (arco) {
      const g = x.createConicGradient((giro * Math.PI) / 180, C, C);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60} 95% 62%)`);
      x.strokeStyle = g;
    } else {
      x.strokeStyle = color;
    }
    x.lineWidth = grosor;
    x.beginPath();
    x.arc(C, C, r, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }

  function capsula(cx, cy, w, h, color, alfa = 1) {
    x.save();
    x.globalAlpha = lim(alfa);
    x.fillStyle = color;
    x.beginPath();
    x.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2);
    x.fill();
    x.restore();
  }

  function brillo4(cx, cy, r, color, alfa) {
    x.save();
    x.globalAlpha = lim(alfa);
    x.fillStyle = color;
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? r * 0.28 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.fill();
    x.restore();
  }

  function texto(s, cy, px, color, alfa, { peso = 500, espacio = 0, cx = C } = {}) {
    if (alfa <= 0) return;
    x.save();
    x.globalAlpha = lim(alfa);
    x.fillStyle = color;
    x.font = `${peso} ${px}px ${LETRA}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if ('letterSpacing' in x) x.letterSpacing = `${espacio}px`;
    // Nada detrás de la carcasa: si no cabe en lo que se ve a esa altura, la
    // letra encoge (el firmware parte la línea; aquí basta con encoger).
    const [a, b] = P.tramo(P.aPantalla(cy - px * 0.6), P.aPantalla(cy + px * 0.6));
    const cabe = (b - a) / P.K - 12;
    const ancho = x.measureText(s).width;
    if (ancho > cabe) x.font = `${peso} ${Math.max(7, (px * cabe) / ancho)}px ${LETRA}`;
    x.fillText(s, cx + espacio / 2, cy);
    x.restore();
  }

  // Pose de los ojos: cuánto abren (0 a 1), desplazamiento, escala y opacidad.
  const POSE = { abre: 1, dx: 0, dy: 0, escala: 1, alfa: 1 };

  // Unos ojos con su skin (forma de Jacobo + material), como los pinta face.mjs.
  function ojosSkin(s, p, t) {
    for (const lado of [-1, 1]) {
      const mat = lado < 0 ? s.izq : s.der;
      const w = BASE.w * (s.sw ?? 1) * p.escala;
      const hEntero = BASE.h * (s.sh ?? 1) * p.escala;
      const h = Math.max(5, hEntero * lim(p.abre));
      const m = margenDe(mat);
      const u = Math.max(w, hEntero * 0.78);
      const lados = Math.min(u * m.lados, BASE.gap / 2);
      x.save();
      x.globalAlpha = lim(p.alfa);
      x.translate(C + lado * SEP * p.escala + p.dx, C + p.dy);
      x.beginPath();
      x.rect(-w / 2 - lados, -h / 2 - u * m.arriba, w + lados * 2, h + u * (m.arriba + m.abajo));
      x.clip();
      pintarOjo(x, mat, { x: -w / 2, y: -h / 2, w, h, r: Math.min(BASE.r, w / 2, h / 2), trazo: s.trazo }, t, { lado, px: 0, py: 0, fondo: fondoDe() });
      x.restore();
    }
  }

  // Ojos blancos y sencillos, sin dueño todavía: dos cápsulas.
  function ojosNeutros(p) {
    const w = BASE.w * 0.78 * p.escala;
    const h = Math.max(5, BASE.h * 0.9 * p.escala * lim(p.abre));
    for (const lado of [-1, 1]) capsula(C + lado * SEP * p.escala + p.dx, C + p.dy, w, h, NEUTRO, p.alfa);
  }

  function ojosCerrados(p) {
    for (const lado of [-1, 1]) capsula(C + lado * SEP * p.escala + p.dx, C + p.dy, BASE.w * 0.78 * p.escala, 5, NEUTRO, p.alfa);
  }

  // Arranque: un punto de luz se parte en dos, los dos se estiran en rayas y se
  // abren en unos ojos blancos. Parpadea, mira a los lados y se pone a temblar.
  function arranque(t) {
    if (t < 400) return;
    const onda = tramo(t, 500, 1500);
    if (onda > 0 && onda < 1) anillo(5 + 98 * sale(onda), 8 - 4 * onda, NEUTRO, 0.35 * (1 - onda));
    if (t < 2200) {
      const nace = rebote(tramo(t, 400, 800));
      const parte = suave(tramo(t, 1100, 1700));
      const estira = suave(tramo(t, 1700, 2200));
      const punto = 8 * nace;
      const w = punto + (BASE.w * 0.78 - punto) * estira;
      const h = punto + (5 - punto) * estira;
      resplandor(C, C, 36, NEUTRO, 0.25 * tramo(t, 400, 800) * (1 - parte));
      if (parte <= 0) return capsula(C, C, w, h, NEUTRO);
      capsula(C - SEP * parte, C, w, h, NEUTRO);
      capsula(C + SEP * parte, C, w, h, NEUTRO);
      return;
    }
    const tiembla = tramo(t, 3600, DURA.arranque);
    ojosNeutros({
      ...POSE,
      abre: rebote(tramo(t, 2200, 2700)) - bulto(t, 2850, 3020),
      dx: (-bulto(t, 3000, 3320) + bulto(t, 3300, 3620)) * 13 + Math.sin(t / 19) * 1.6 * tiembla,
      escala: 1 + 0.05 * tiembla,
    });
  }

  function ruleta(a, t, m, tAbs) {
    const dentro = t - a.pasos[m.paso].t;
    const golpe = 1 - lim(dentro / 140);
    // Los últimos pasos laten: una luz blanca muy floja detrás.
    if (m.paso >= PASOS - 7) {
      const q = (m.paso - (PASOS - 7)) / 6;
      resplandor(C, C, 98, '#ffffff', 0.05 * q * (0.5 + 0.5 * Math.sin(t / 90)));
    }
    const paso = a.pasos[m.paso];
    ojosSkin(skinDe(idDe(paso.forma, paso.color)), { ...POSE, escala: 1 + 0.1 * golpe * golpe }, tAbs);
  }

  function luzDeFondo(a, t, cuanto) {
    if (cuanto <= 0) return;
    const n = a.nivel;
    const late = 0.75 + 0.25 * Math.sin(t / (140 - 12 * n));
    const r = 41 + (49 + 7 * n) * cuanto;
    const f = (0.3 + 0.09 * n) * cuanto * late;
    if (n >= 4) anillo(r * 0.62, r * 0.55, null, f * 1.3, true, t / 4);
    else resplandor(C, C, r, LUZ[n], f);
  }

  function dormido(a, t, tAbs) {
    const cierra = tramo(t, 0, 260);
    luzDeFondo(a, tAbs, suave(tramo(t, 450, DURA.dormido)));
    if (cierra < 1) {
      const u = a.pasos[PASOS - 1];
      ojosSkin(skinDe(idDe(u.forma, u.color)), { ...POSE, abre: 1 - cierra }, tAbs);
    }
    ojosCerrados({
      ...POSE,
      alfa: tramo(t, 160, 320),
      dy: Math.sin(t / 320) * 1.6,
      escala: 1 + 0.03 * Math.sin(t / 320),
      // tiembla un poco más cuanto más cerca está de abrirlos
      dx: Math.sin(t / 23) * 1.3 * tramo(t, 1200, DURA.dormido),
    });
    for (let i = 0; i < 2; i++) {
      if (t < 300 + i * 520) continue;
      const q = ((t - 300 - i * 520) / 1300) % 1;
      // la z sale hacia arriba a la derecha
      texto('z', C - 18 - q * 21 - i * 5, i ? 13 : 18, NEUTRO, 0.8 * bulto(q, 0, 1), { peso: 700, cx: C + 47 + q * 9 + i * 7 });
    }
  }

  function revelar(a, t, tAbs) {
    const n = a.nivel;
    if (t < ABRE_EN) {
      // entreabre: asoma el color nuevo
      luzDeFondo(a, tAbs, 1);
      ojosSkin(a.skin, { ...POSE, abre: 0.3 * suave(tramo(t, 0, 320)), dx: Math.sin(t / 23) * 1.3 }, tAbs);
      return;
    }
    const d = t - ABRE_EN;
    // fogonazo y anillos
    const fog = 1 - tramo(d, 0, 420);
    if (n >= 4) anillo(62, 72, null, (0.55 + 0.1 * n) * fog * fog, true, tAbs / 3);
    else resplandor(C, C, 155, LUZ[n], (0.55 + 0.1 * n) * fog * fog);
    const anillos = Math.min(4, 1 + n);
    for (let i = 0; i < anillos; i++) {
      const q = tramo(d, i * 110, i * 110 + 620);
      if (q <= 0 || q >= 1) continue;
      anillo(21 + 111 * sale(q), 13 - 8 * q, LUZ[n], (0.5 + 0.12 * n) * (1 - q), n >= 4, tAbs / 3);
    }
    // chispas, de épica para arriba
    if (n >= 2) {
      const cuantas = 6 + 4 * (n - 2);
      const q = tramo(d, 0, 650);
      for (let i = 0; i < cuantas && q < 1; i++) {
        const ang = (i / cuantas) * Math.PI * 2 + hash01(i + 40) * 0.6;
        const r = 36 + (57 + 31 * hash01(i + 80)) * sale(q);
        brillo4(C + Math.cos(ang) * r, C + Math.sin(ang) * r * 0.85, 2.6 + 3.6 * (1 - q), luz(n, tAbs + i * 300), 1 - q);
      }
    }
    ojosSkin(a.skin, { ...POSE, abre: 0.3 + 0.7 * sale(tramo(d, 0, 260)), escala: 0.86 + 0.14 * rebote(tramo(d, 0, 380)) }, tAbs);
  }

  function estreno(a, t, tAbs) {
    resplandor(C, C, 108, luz(a.nivel, tAbs), 0.06);
    ojosSkin(a.skin, {
      ...POSE,
      abre: 1 - bulto(t, 250, 420),
      dx: (-bulto(t, 480, 900) + bulto(t, 900, 1320)) * 14,
      dy: -Math.abs(Math.sin((t - 1380) / 67)) * 4.6 * tramo(t, 1380, 1420) * (1 - tramo(t, 1700, DURA.estreno)),
    }, tAbs);
  }

  // `fuera` va de 0 a 1 mientras el cartel se va.
  function cartel(a, t, tAbs, fuera) {
    const ve = 1 - fuera;
    const sube = suave(tramo(t, 0, 500)) * ve;
    resplandor(C, C, 108, luz(a.nivel, tAbs), 0.06);
    ojosSkin(a.skin, { ...POSE, dy: -22 * sube, abre: 1 - bulto(t, 2500, 2660) - bulto(t, 4800, 4960) }, tAbs);
    texto(a.rareza.toUpperCase(), C + 26, 17, luz(a.nivel, tAbs), ve * tramo(t, 200, 600), { peso: 700, espacio: 2 });
    texto(a.skin.nombre, C + 47, 12.5, '#f2f4ff', ve * tramo(t, 400, 800));
    texto(a.unoDe, C + 63, 11, '#8a93a6', ve * tramo(t, 600, 1000));
  }

  // Pinta el instante t (ms desde que empieza) y devuelve en qué momento está.
  function pintar(a, t) {
    const m = momento(a, t);
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = fondoDe();
    x.fillRect(0, 0, P.LADO, P.LADO);
    x.setTransform(P.K, 0, 0, P.K, P.DESPLAZA, P.DESPLAZA);
    if (m.fase === 'arranque') arranque(m.t);
    else if (m.fase === 'ruleta') ruleta(a, m.t, m, t);
    else if (m.fase === 'dormido') dormido(a, m.t, t);
    else if (m.fase === 'revelar') revelar(a, m.t, t);
    else if (m.fase === 'estreno') estreno(a, m.t, t);
    else if (m.fase === 'cartel') cartel(a, m.t, t, 0);
    else if (m.fase === 'asentar') cartel(a, DURA.cartel, t, suave(m.t / DURA.asentar));
    x.restore();
    return m;
  }

  return { pintar };
}
