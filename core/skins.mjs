// Skins de los ojos (D-005, D-023). Una skin no cambia el comportamiento ni
// las expresiones: cambia cómo se pintan los ojos. Desde D-023 una skin se
// compone de una FORMA de ojo y un COLOR por ojo, y su rareza sale sola de
// multiplicar probabilidades:
//
//   id de una skin   'forma.color'             los dos ojos iguales
//                    'forma.izquierdo+derecho' un ojo de cada color
//                    'cero-uno'                las únicas, aparte (hechas a mano)
//
// Las FORMAS son las cuatro comunes de Jacobo (core/formas.mjs, 13-nov) y la
// legendaria Mariguano de Chief: la pupila es parte de la forma («al final
// pupila y forma de ojo es lo mismo»). Las cuatro comunes salen igual de a
// menudo; las raras pesan menos (PESOS_FORMA) y, si cambian, el test de rarezas
// avisa si hay que recalcular los cortes de RAREZAS. Los COLORES son los 44 de
// core/colores.mjs.
//
// Parámetros de forma que entiende web/face.mjs:
//   trazo      el contorno de Jacobo (con muescas y huecos)
//   sw, sh     factor de ancho y de alto sobre la expresión (salen de la
//              proporción y el alto del dibujo)
//   redondo, pupila, destello   solo para las únicas hechas a mano

import { COLORES, color } from './colores.mjs';
import { FORMAS_JACOBO } from './formas.mjs';
import { BASE } from './expressions.mjs';

// Peso de cada forma. Las cuatro comunes de Jacobo, 25 cada una. Mariguano
// (dibujo que pasó Chief el 13-nov como «forma de ojos legendaria») pesa 0,1:
// sale en 1 de cada 1.000 cajas y, con cualquier color, su probabilidad queda
// por debajo del corte de épica, así que siempre es Legendaria (o Bicolor si
// lleva dos colores). Ese 0,1 % se descuenta de los efectos (core/colores.mjs)
// para que las legendarias sigan sumando el 0,6 %. Decidido por Chief (13-nov).
const PESOS_FORMA = { mariguano: 0.1 };

export const FORMAS = FORMAS_JACOBO.map((f) => ({
  id: f.id,
  nombre: f.nombre,
  peso: PESOS_FORMA[f.id] ?? 25,
  params: { trazo: f, sh: f.alto, sw: (f.aspecto * f.alto * BASE.h) / BASE.w },
}));
const PESO_FORMAS = FORMAS.reduce((s, f) => s + f.peso, 0);
for (const f of FORMAS) f.p = f.peso / PESO_FORMAS;

// Probabilidad de que una caja traiga un ojo de cada color: 0,1 % (Chief,
// 13-nov). Toda skin de dos colores es de nivel Bicolor, sin mirar más.
export const PROB_DOS_COLORES = 0.001;

// Niveles de las de un color: una skin es del nivel más alto cuya probabilidad
// alcanza. Chief pidió (13-nov) que las cajas den 60 % comunes, 34 % raras,
// 5,4 % épicas, 0,6 % legendarias y 0,1 % bicolor. Con las cuatro formas comunes
// igual de probables, el nivel lo pone el color (pesos en core/colores.mjs,
// hechos para dar justo eso). Si cambian los pesos o llegan formas raras, hay
// que recalcular los cortes: el test de rarezas avisa.
export const RAREZAS = {
  comun:      { nombre: 'Común',          desde: 0.009 },
  rara:       { nombre: 'Rara',           desde: 0.003 },
  epica:      { nombre: 'Épica',          desde: 0.0008 },
  legendaria: { nombre: 'Legendaria',     desde: 0 },
  bicolor:    { nombre: 'Bicolor',        desde: null },
  unica:      { nombre: 'Única (1 de 1)', desde: null },
};

export function rarezaDe(p) {
  for (const [id, r] of Object.entries(RAREZAS)) if (r.desde !== null && p >= r.desde) return id;
  return 'legendaria';
}

// Las únicas, 1 de 1, hechas a mano: nunca salen de una caja (en el producto
// las reparte un servidor). Llevan su forma y su material propios.
const UNICAS = [
  {
    id: 'cero-uno', nombre: 'Cero Uno',
    params: { redondo: true, sw: 0.8, sh: 1.1, destello: true },
    material: { id: 'cero-uno', nombre: 'Cero Uno', t: 'grad', c: ['#ffffff', '#9aa7ff'], tinta: '#ffffff', css: 'linear-gradient(#ffffff, #9aa7ff)', halo: '#9aa7ff' },
  },
];

// Las diez skins de prueba de antes de D-023, por si quedan guardadas en un
// navegador o en la app de Windows: cada una pasa a su equivalente.
export const ANTIGUAS = {
  clasico: 'ovalo.cian', menta: 'ovalo.turquesa', coral: 'ovalo.coral',
  canica: 'ovalo.blanco', gato: 'palito.amarillo', atardecer: 'ovalo.atardecer',
  neon: 'ovalo.neonrosa', oro: 'ovalo.dorado', arcoiris: 'ovalo.arcoiris',
};
// Y las tres formas de prueba que hubo unas horas (13-nov) antes de las de Jacobo.
const FORMAS_ANTIGUAS = { normal: 'ovalo', canica: 'ovalo', gato: 'palito' };
export function idActual(id) {
  if (ANTIGUAS[id]) return ANTIGUAS[id];
  const m = /^([a-z]+)\.(.+)$/.exec(id ?? '');
  return m && FORMAS_ANTIGUAS[m[1]] ? `${FORMAS_ANTIGUAS[m[1]]}.${m[2]}` : id;
}

export const SKIN_INICIAL = 'ovalo.cian';

export function probabilidad(forma, izq, der = izq) {
  const f = FORMAS.find((x) => x.id === forma);
  const a = color(izq);
  const b = color(der);
  const pColores = a === b ? a.p * (1 - PROB_DOS_COLORES) : a.p * PROB_DOS_COLORES * (b.p / (1 - a.p));
  return f.p * pColores;
}

const cache = new Map();

export function skin(id) {
  if (cache.has(id)) return cache.get(id);
  const unica = UNICAS.find((u) => u.id === id);
  let s;
  if (unica) {
    s = { id, nombre: unica.nombre, rareza: 'unica', p: 0, forma: 'unica', ...unica.params, izq: unica.material, der: unica.material };
  } else {
    const m = /^([a-z]+)\.([a-z]+)(?:\+([a-z]+))?$/.exec(id ?? '');
    const f = m && FORMAS.find((x) => x.id === m[1]);
    if (!f) throw new Error(`Skin desconocida: ${id}`);
    const izq = color(m[2]);
    const der = m[3] ? color(m[3]) : izq;
    if (m[3] && der === izq) throw new Error(`Skin desconocida: ${id}`); // «cian+cian» se escribe «cian»
    const p = probabilidad(f.id, izq.id, der.id);
    const colores = izq === der ? izq.nombre : `${izq.nombre} y ${der.nombre}`;
    s = {
      id,
      nombre: `${colores} · ${f.nombre}`,
      rareza: izq === der ? rarezaDe(p) : 'bicolor',
      p,
      forma: f.id,
      ...f.params,
      izq,
      der,
    };
  }
  // Lo que usa la interfaz: tinta para los extras de la cara y muestra en CSS.
  s.color = s.izq.tinta;
  s.arcoiris = s.izq.t === 'arco';
  s.css = s.izq === s.der ? s.izq.css : `linear-gradient(90deg, ${s.izq.tinta} 50%, ${s.der.tinta} 50%)`;
  cache.set(id, s);
  return s;
}

export const idDe = (forma, izq, der = izq) => (izq === der ? `${forma}.${izq}` : `${forma}.${izq}+${der}`);

// Catálogo de un solo color (formas × colores) más las únicas. Las de dos
// colores (más de 5.000) no se listan: se construyen por su id.
export const SKINS = [
  ...FORMAS.flatMap((f) => COLORES.map((c) => skin(idDe(f.id, c.id)))),
  ...UNICAS.map((u) => skin(u.id)),
];

function elegir(lista, azar) {
  const total = lista.reduce((s, x) => s + x.p, 0);
  let tirada = azar() * total;
  for (const x of lista) {
    if (tirada < x.p) return x;
    tirada -= x.p;
  }
  return lista[lista.length - 1];
}

// Sortea una skin entera, como sale de una caja (D-023) o de fábrica (D-024):
// forma, color y, a veces, otro color para el ojo derecho. `azar` devuelve un
// número en [0, 1) y entra como argumento para poder probarlo.
export function sortearSkin(azar = Math.random) {
  const f = elegir(FORMAS, azar);
  const izq = elegir(COLORES, azar);
  const dos = azar() >= 1 - PROB_DOS_COLORES;
  const der = dos ? elegir(COLORES.filter((c) => c !== izq), azar) : izq;
  return skin(idDe(f.id, izq.id, der.id));
}
