// Progreso del dueño: misiones, cajas e inventario de skins (D-008).
// Las cajas no se compran: se ganan con hitos y misiones. Lógica pura; el día
// entra como texto 'AAAA-MM-DD' para no depender del reloj.

import { skin, sortearSkin, idActual, SKIN_INICIAL } from './skins.mjs';

export const BLOQUES_POR_CAJA = 5;

export const MISIONES = [
  { id: 'primer-bloque', texto: 'Completa tu primer bloque de concentración', hecha: (p) => p.bloques >= 1 },
  { id: 'tres-hoy',      texto: 'Tres bloques en un mismo día',               hecha: (p) => p.bloquesHoy >= 3 },
  { id: 'una-hora',      texto: 'Una hora de concentración acumulada',        hecha: (p) => p.minutos >= 60 },
  { id: 'racha-3',       texto: 'Tres días seguidos con al menos un bloque',  hecha: (p) => p.racha >= 3 },
  { id: 'cuidados-5',    texto: 'Atiende cinco avisos de agua o de estirarte', hecha: (p) => p.cuidados >= 5 },
  { id: 'mimos',         texto: 'Acaríciale diez veces',                      hecha: (p) => p.caricias >= 10 },
  // D-018: los encuentros de llavero cuentan para una misión. Solo Tulos
  // distintos (propuesta, para que no se falsee cruzándose con el mismo).
  // D-020: cumplir todos los hábitos de un día (propuesta).
  { id: 'habitos-dia',   texto: 'Cumple todos tus hábitos en un día',          hecha: (p) => (p.diasHabitos?.length ?? 0) >= 1 },
  { id: 'habitos-7',     texto: 'Siete días con todos tus hábitos cumplidos',  hecha: (p) => (p.diasHabitos?.length ?? 0) >= 7 },
  { id: 'conoce-3',      texto: 'Crúzate con tres Tulos distintos',         hecha: (p) => (p.conocidos?.length ?? 0) >= 3 },
];

export function createProgreso() {
  return {
    bloques: 0,
    bloquesHoy: 0,
    minutos: 0,
    caricias: 0,
    cuidados: 0,
    conocidos: [], // ids de los Tulos con que se ha cruzado (D-018)
    diasHabitos: [], // días con todos los hábitos cumplidos (D-020)
    racha: 0,
    ultimoDia: null,
    hechas: [],
    cajas: 0,
    inventario: { [SKIN_INICIAL]: 1 },
    equipada: SKIN_INICIAL,
  };
}

// Pone al día un progreso guardado con ids de skin de antes de D-023 («clasico»,
// «oro»…): cada una pasa a su equivalente y lo que ya no existe se descarta.
// Devuelve el mismo objeto.
export function migrarProgreso(p) {
  const inv = {};
  for (const [id, n] of Object.entries(p.inventario ?? {})) {
    const nuevo = idActual(id);
    try { skin(nuevo); } catch { continue; }
    inv[nuevo] = (inv[nuevo] ?? 0) + n;
  }
  p.inventario = inv;
  const puesta = idActual(p.equipada);
  p.equipada = inv[puesta] ? puesta : Object.keys(inv).find((k) => inv[k] > 0) ?? SKIN_INICIAL;
  if (!inv[p.equipada]) inv[p.equipada] = 1;
  return p;
}

function esDiaSiguiente(anterior, dia) {
  return Date.parse(dia) - Date.parse(anterior) === 86400000;
}

// Apunta algo que ha pasado y devuelve lo que se ha ganado con ello.
//   registrar(p, 'bloque', { dia: '2026-11-12', minutos: 25 })
//   registrar(p, 'caricia')
//   registrar(p, 'encuentro', { id: 'pacolo-de-lucia' })
// Un encuentro con un Tulo ya conocido devuelve `repetido: true` y no suma.
export function registrar(p, tipo, datos = {}) {
  let cajaPorBloques = false;
  let repetido = false;
  if (tipo === 'bloque') {
    if (datos.dia !== p.ultimoDia) {
      p.racha = p.ultimoDia && esDiaSiguiente(p.ultimoDia, datos.dia) ? p.racha + 1 : 1;
      p.bloquesHoy = 0;
      p.ultimoDia = datos.dia;
    }
    p.bloques += 1;
    p.bloquesHoy += 1;
    p.minutos += datos.minutos ?? 0;
    if (p.bloques % BLOQUES_POR_CAJA === 0) {
      p.cajas += 1;
      cajaPorBloques = true;
    }
  } else if (tipo === 'caricia') {
    p.caricias += 1;
  } else if (tipo === 'cuidado') {
    p.cuidados += 1;
  } else if (tipo === 'dia-habitos') {
    if (!datos.dia) throw new Error('Hace falta el día.');
    p.diasHabitos ??= [];
    if (p.diasHabitos.includes(datos.dia)) repetido = true;
    else p.diasHabitos.push(datos.dia);
  } else if (tipo === 'encuentro') {
    if (!datos.id) throw new Error('Un encuentro necesita el id del otro Tulo.');
    p.conocidos ??= [];
    if (p.conocidos.includes(datos.id)) repetido = true;
    else p.conocidos.push(datos.id);
  } else {
    throw new Error(`Tipo de registro desconocido: ${tipo}`);
  }
  const nuevas = MISIONES.filter((m) => !p.hechas.includes(m.id) && m.hecha(p));
  for (const m of nuevas) p.hechas.push(m.id);
  p.cajas += nuevas.length;
  return { nuevas, cajaPorBloques, repetido };
}

// Los ojos de fábrica (D-024): se sortean una vez, con las probabilidades de
// una caja, y van atados al aparato (`p.fabrica`): no se venden ni se vuelven a
// sortear. Sustituyen a la skin inicial. Devuelve la skin, o null si ya los
// tenía. En el producto el sorteo lo hace un servidor; aquí, el simulador.
// `s` deja pasar una skin ya sorteada (la animación la sortea al empezar y la
// entrega al enseñarla).
export function estrenar(p, azar = Math.random, s = sortearSkin(azar)) {
  if (p.fabrica) return null;
  p.inventario = { [s.id]: 1 };
  p.equipada = s.id;
  p.fabrica = s.id;
  return s;
}

export function abrirCaja(p, azar = Math.random) {
  if (p.cajas <= 0) throw new Error('No hay cajas que abrir.');
  p.cajas -= 1;
  const s = sortearSkin(azar);
  p.inventario[s.id] = (p.inventario[s.id] ?? 0) + 1;
  return s;
}

export function equipar(p, id) {
  skin(id); // falla si no existe
  if (!p.inventario[id]) throw new Error(`No tienes la skin ${id}.`);
  p.equipada = id;
}
