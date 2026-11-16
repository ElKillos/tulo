// La pantalla del aparato: AMOLED redonda de 1,75″ y 466 × 466 px por QSPI
// (D-029), vista a través de la ventana de la carcasa (core/flor.mjs).
// Una sola casa para el tamaño y para «qué se ve»: la usan el simulador
// (web/face.mjs, web/primer.mjs, web/app.mjs) y el generador del firmware
// (firmware/herramientas/generar-datos.mjs → PK_VENTANA).
//
// Las caras y los ojos se diseñaron en 240 × 240 (core/expressions.mjs): se
// pintan escalados ×K y centrados, igual que el firmware (PK_K en pk.h).
// K = 1,75 es PROPUESTA del firmware: los ojos caben en lo que deja ver la
// ventana en estrella de la carcasa v1.
//
// Lógica pura: sin lienzo ni DOM.
import { que, R_VALLE } from './flor.mjs';

export const LADO = 466;                 // px de la pantalla
export const DIAMETRO_MM = 44.45;        // 1,75″ de diagonal (sin medir en el panel real)
export const PX_POR_MM = LADO / DIAMETRO_MM;
export const C = LADO / 2;               // centro
export const CARA = 240;                 // lado del diseño de las caras
export const K = 1.75;                   // px de pantalla por px de la cara de 240
export const DESPLAZA = (LADO - CARA * K) / 2; // dónde empieza la cara de 240 escalada

// ¿Se ve el píxel (x, y) de la pantalla? Dentro del círculo del panel y de la
// ventana de la carcasa.
export function visible(x, y) {
  if (Math.hypot(x + 0.5 - C, y + 0.5 - C) > C) return false;
  return que((x + 0.5 - C) / PX_POR_MM, (y + 0.5 - C) / PX_POR_MM) === 'pantalla';
}

// Por cada fila de la pantalla, el tramo [x0, x1) que se ve seguido desde el
// centro (o [0, 0] si el centro de esa fila está tapado). Es lo mismo que
// PK_VENTANA del firmware.
let cacheFilas = null;
export function filas() {
  if (cacheFilas) return cacheFilas;
  const ve = (x, y) => que((x + 0.5 - C) / PX_POR_MM, (y + 0.5 - C) / PX_POR_MM) === 'pantalla';
  const f = [];
  for (let y = 0; y < LADO; y++) {
    if (!ve(C, y) || !ve(C - 1, y)) { f.push([0, 0]); continue; }
    let x0 = C - 1;
    let x1 = C;
    while (x0 > 0 && ve(x0 - 1, y)) x0--;
    while (x1 < LADO - 1 && ve(x1 + 1, y)) x1++;
    f.push([x0, x1 + 1]);
  }
  cacheFilas = f;
  return f;
}

// Lo que se ve a la vez en todas las filas de y0 a y1: [izquierda, derecha].
// Para colocar una línea de texto o una fila de una lista.
export function tramo(y0, y1) {
  const f = filas();
  let a = 0;
  let b = LADO;
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(LADO - 1, Math.floor(y1)); y++) {
    a = Math.max(a, f[y][0]);
    b = Math.min(b, f[y][1]);
  }
  return b > a ? [a, b] : [C, C];
}

// Ancho visible entre y0 e y1 (como pk_ventana_ancho del firmware).
export function anchoEn(y0, y1) {
  const [a, b] = tramo(y0, y1);
  return b - a;
}

// Filas de arriba y de abajo entre las que se ve al menos `ancho` px seguidos
// (como pk_ventana_alto del firmware).
export function altoPara(ancho) {
  const f = filas();
  const w = (y) => f[y][1] - f[y][0];
  let a = Math.floor(C);
  let b = Math.floor(C);
  while (a > 0 && w(a - 1) >= ancho) a--;
  while (b < LADO - 1 && w(b + 1) >= ancho) b++;
  return [a, b];
}

// Hasta dónde se puede subir sin salir de la ventana entre las columnas xa y
// xb: la fila más alta (y de la pantalla) desde la que, bajando hasta el
// centro, se ve todo ese tramo. Para que lo que sube de un ojo (chispas de
// fuego y lava) no llegue detrás de la carcasa.
export function techo(xa, xb) {
  const f = filas();
  let y = Math.floor(C);
  while (y > 0 && f[y - 1][0] <= xa && f[y - 1][1] >= xb) y--;
  return y;
}

// Lo mismo hacia abajo: la fila más baja (incluida) hasta la que se ve todo el
// tramo [xa, xb] bajando desde el centro.
export function suelo(xa, xb) {
  const f = filas();
  let y = Math.floor(C);
  while (y < LADO - 1 && f[y + 1][0] <= xa && f[y + 1][1] >= xb) y++;
  return y;
}

// El círculo más grande que cabe en la ventana en estrella (r = 15 mm, debajo
// de los lóbulos). Con la cara girada (D-043), lo que se ve alrededor de ella
// gira también, y este círculo es lo único que se ve siempre: tramo, techo y
// suelo «en círculo» para colocar dentro de él.
export const R_CIRCULO = R_VALLE * PX_POR_MM - 1;

export function tramoCirculo(y0, y1) {
  const d = Math.max(Math.abs(y0 - C), Math.abs(y1 - C));
  if (d >= R_CIRCULO) return [C, C];
  const m = Math.sqrt(R_CIRCULO * R_CIRCULO - d * d);
  return [C - m, C + m];
}
export function techoCirculo(xa, xb) {
  const d = Math.max(Math.abs(xa - C), Math.abs(xb - C));
  return d >= R_CIRCULO ? C : C - Math.sqrt(R_CIRCULO * R_CIRCULO - d * d);
}
export function sueloCirculo(xa, xb) {
  return 2 * C - techoCirculo(xa, xb);
}

// Coordenada de la cara de 240 → px de la pantalla, y al revés.
export const aPantalla = (v) => DESPLAZA + v * K;
export const aCara = (p) => (p - DESPLAZA) / K;
