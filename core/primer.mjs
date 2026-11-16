// Primer encendido (D-024, D-035): la animación con la que Tulo descubre qué
// ojos le han tocado. Aquí está el guion, sin pantalla: qué fase toca en cada
// instante y qué ojos pasan por la ruleta. Lo pinta web/primer.mjs.
//
// El guion es el del firmware (firmware/nucleo/pk_primer.c), que es donde Chief
// lo eligió: si cambian los tiempos allí, se cambian aquí.
//   ARRANQUE  4,0 s  un punto de luz se parte en dos ojos blancos, sin dueño
//   RULETA   10,0 s  pasan ojos de todas las formas y colores, cada vez más despacio
//   DORMIDO   2,0 s  se le cierran los ojos y detrás crece una luz del color de la rareza
//   REVELAR   1,2 s  entreabre los ojos nuevos y los abre de golpe
//   ESTRENO   1,8 s  parpadea, mira a los lados y bota
//   CARTEL    6,0 s  rareza, nombre y «1 de cada N»
//   ASENTAR   0,6 s  se va el cartel y los ojos vuelven al centro
// Todo depende solo de t: el mismo instante da el mismo dibujo.

import { FORMAS, RAREZAS } from './skins.mjs';
import { COLORES } from './colores.mjs';

export const FASES = ['arranque', 'ruleta', 'dormido', 'revelar', 'estreno', 'cartel', 'asentar'];
export const DURA = { arranque: 4000, ruleta: 10000, dormido: 2000, revelar: 1200, estreno: 1800, cartel: 6000, asentar: 600 };
export const ABRE_EN = 500; // ms dentro de REVELAR en que los ojos se abren de golpe
export const PASOS = 40;    // ojos que pasan por la ruleta
const PASO_PRIMERO = 70;    // ms que dura el primer paso…
const PASO_CRECE = 1.05664; // …y cada uno dura un 5,7 % más (el último, ~600 ms)

// Nivel de la rareza, de 0 a 4: cuanto más alto, más luz, anillos y chispas.
export const NIVELES = ['comun', 'rara', 'epica', 'legendaria', 'bicolor'];
export const nivelDe = (rareza) => Math.max(0, NIVELES.indexOf(rareza === 'unica' ? 'bicolor' : rareza));

function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// «1 de cada 12.345»
export function unoDe(p) {
  if (!(p > 0)) return 'Única';
  return `1 de cada ${Math.max(1, Math.round(1 / p)).toLocaleString('es-ES', { useGrouping: 'always' })}`;
}

// Prepara la animación para la skin que ha tocado. `semilla` decide qué ojos
// pasan por la ruleta (la misma semilla, la misma ruleta).
export function crearPrimer(skin, semilla = 1) {
  const azar = mulberry32(semilla || 1);
  // Cuándo empieza cada paso: cada uno dura más que el anterior y entre todos
  // llenan justo la ruleta.
  const duras = Array.from({ length: PASOS }, (_, i) => PASO_PRIMERO * PASO_CRECE ** i);
  const suma = duras.reduce((s, d) => s + d, 0);
  let acum = 0;
  const pasos = [];
  // Qué ojos pasan: forma y color al azar (todos los colores igual de a menudo,
  // para que se vean pasar los raros), sin repetir color seguido y sin que el
  // último sea el que ha tocado.
  let antes = null;
  for (let i = 0; i < PASOS; i++) {
    let c;
    do c = COLORES[Math.floor(azar() * COLORES.length)];
    while (c === antes || (i === PASOS - 1 && (c === skin.izq || c === skin.der)));
    const f = FORMAS[Math.floor(azar() * FORMAS.length)];
    pasos.push({ t: Math.round((acum / suma) * DURA.ruleta), forma: f.id, color: c.id });
    acum += duras[i];
    antes = c;
  }
  const inicio = {};
  let t = 0;
  for (const f of FASES) {
    inicio[f] = t;
    t += DURA[f];
  }
  return {
    skin,
    nivel: nivelDe(skin.rareza),
    rareza: (RAREZAS[skin.rareza]?.nombre ?? skin.rareza).replace(/ \(.*$/, ''),
    unoDe: unoDe(skin.p),
    pasos,
    inicio,
    dura: t,
  };
}

// Dónde está la animación en el instante t (ms desde que empieza):
//   fase      nombre de la fase, o 'fin'
//   t         ms dentro de la fase
//   paso      en la ruleta, qué ojos se ven (índice de a.pasos); si no, -1
//   tics      cuántos pasos de ruleta han sonado ya
//   revelado  si ya se han visto los ojos que han tocado
export function momento(a, t) {
  if (t >= a.dura) return { fase: 'fin', t: t - a.dura, paso: -1, tics: PASOS, revelado: true, fin: true };
  let fase = FASES[0];
  for (const f of FASES) if (t >= a.inicio[f]) fase = f;
  const dentro = Math.max(0, t - a.inicio[fase]);
  let paso = -1;
  let tics = fase === 'arranque' ? 0 : PASOS;
  if (fase === 'ruleta') {
    paso = 0;
    while (paso + 1 < PASOS && a.pasos[paso + 1].t <= dentro) paso++;
    tics = paso + 1;
  }
  const ya = ['estreno', 'cartel', 'asentar'].includes(fase) || (fase === 'revelar' && dentro >= ABRE_EN);
  return { fase, t: dentro, paso, tics, revelado: ya, fin: false };
}
