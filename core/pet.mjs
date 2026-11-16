// Comportamiento de Tulo: estado, necesidades y reacciones.
// Lógica pura: no toca pantalla, red ni reloj. El tiempo entra siempre como
// argumento (`now`, en milisegundos), así que el mismo comportamiento se puede
// probar con tests y trasladar después al firmware del aparato.

import { EXPRESSIONS } from './expressions.mjs';

// Ritmos por minuto de tiempo de la mascota. Son valores de partida para
// ajustar jugando con el simulador, no decisiones de producto.
export const RATES = {
  energiaDespierto: -0.5,
  energiaDormido: 2.0,
  saciedad: -0.4,
  saciedadDormido: -0.1,
  animo: -0.3,
  animoConNecesidad: -0.8, // se suma cuando tiene hambre o sueño
};

export const UMBRAL_BAJO = 20;

// Necesidades espejo: Tulo pide lo que le toca a su dueño. `cada` son
// minutos despierto (es decir, con el dueño delante) entre un aviso y otro.
export const CUIDADOS = {
  agua:    { cada: 90, cara: 'sed',     pide: 'Tengo sed. ¿Bebemos agua?',            gracias: 'Qué bien sienta.' },
  estirar: { cada: 50, cara: 'estirar', pide: 'Llevamos mucho sentados. ¿Estiramos?', gracias: 'Mucho mejor.' },
};
export const COMIDA_POR_MINUTO = 1.2; // 25 min de concentración = 30 de saciedad
export const COMIDA_MAX_POR_BLOQUE = 45;
export const FOCO_VISTO_MIN_BLOQUE = 5; // minutos vistos que cuentan como un bloque

const clamp = (v) => Math.max(0, Math.min(100, v));

function nuevosCuidados() {
  const c = {};
  for (const id of Object.keys(CUIDADOS)) c[id] = { minutos: 0, pendiente: false };
  return c;
}

// Pone a cero las cuentas de agua y de estirarse (al abrir el simulador: el
// tiempo que estuvo cerrado, el dueño no estaba delante).
export function reiniciarCuidados(pet) {
  pet.cuidados = nuevosCuidados();
}

export function createPet(now = 0) {
  return {
    energia: 80,
    saciedad: 70,
    animo: 70,
    dormido: false,
    velocidad: 1, // acelera solo las necesidades (para probar); reacciones y temporizadores van a tiempo real
    transitoria: null, // { nombre, hasta }
    foco: null, // bloque de concentración en marcha: { inicio, fin }
    focoVisto: null, // concentración vista por la cámara: { inicio }
    cuidados: nuevosCuidados(), // por cada uno: { minutos, pendiente }
    tarde: false, // lo pone quien conoce la hora: ya es hora de dormir
    temporizadores: [], // { id, etiqueta, fin }
    recordatorios: [], // { id, texto, fin, repite }: avisos a una hora, con lo que hay que recordar
    alarmas: [], // { id, etiqueta, fin, repite }: suenan hasta que las paras (D-020)
    sonando: null, // alarma que está sonando: { id, etiqueta, desde }
    siguienteId: 1,
    ultimoTick: now,
  };
}

// Avanza el tiempo hasta `now`. Devuelve los eventos ocurridos.
export function tick(pet, now) {
  const eventos = [];
  const minutos = (Math.max(0, now - pet.ultimoTick) / 60000) * pet.velocidad;
  pet.ultimoTick = now;

  if (pet.dormido) {
    pet.energia = clamp(pet.energia + RATES.energiaDormido * minutos);
    pet.saciedad = clamp(pet.saciedad + RATES.saciedadDormido * minutos);
    if (pet.energia >= 100) {
      pet.dormido = false;
      eventos.push({ tipo: 'despierta', motivo: 'descansado' });
    }
  } else {
    pet.energia = clamp(pet.energia + RATES.energiaDespierto * minutos);
    pet.saciedad = clamp(pet.saciedad + RATES.saciedad * minutos);
    for (const [id, c] of Object.entries(pet.cuidados)) {
      if (c.pendiente) continue;
      c.minutos += minutos;
      if (c.minutos >= CUIDADOS[id].cada) {
        c.pendiente = true;
        eventos.push({ tipo: 'cuidado', cual: id });
      }
    }
    const conNecesidad = pet.energia < UMBRAL_BAJO || pet.saciedad < UMBRAL_BAJO
      || Object.values(pet.cuidados).some((c) => c.pendiente);
    const ritmo = RATES.animo + (conNecesidad ? RATES.animoConNecesidad : 0);
    pet.animo = clamp(pet.animo + ritmo * minutos);
  }

  if (pet.transitoria && now >= pet.transitoria.hasta) pet.transitoria = null;

  // Tulo come concentración: un bloque acabado le da de comer.
  if (pet.foco && now >= pet.foco.fin) {
    const minutosFoco = (pet.foco.fin - pet.foco.inicio) / 60000;
    pet.saciedad = clamp(pet.saciedad + Math.min(COMIDA_MAX_POR_BLOQUE, minutosFoco * COMIDA_POR_MINUTO));
    pet.animo = clamp(pet.animo + 6);
    pet.foco = null;
    reaccion(pet, 'feliz', now, 4000);
    eventos.push({ tipo: 'foco', minutos: minutosFoco });
  }

  const vivos = [];
  for (const t of pet.temporizadores) {
    if (now >= t.fin) eventos.push({ tipo: 'temporizador', id: t.id, etiqueta: t.etiqueta });
    else vivos.push(t);
  }
  pet.temporizadores = vivos;
  // Recordatorios y alarmas: los que se repiten (D-020) vuelven a programarse.
  const pendientes = [];
  for (const r of pet.recordatorios) {
    if (now < r.fin) { pendientes.push(r); continue; }
    eventos.push({ tipo: 'recordatorio', id: r.id, texto: r.texto, repite: r.repite ?? null });
    if (r.repite) pendientes.push({ ...r, fin: siguienteVez(r.fin, r.repite, now) });
  }
  pet.recordatorios = pendientes;
  if (pet.sonando && now - pet.sonando.desde >= ALARMA_MAX_MS) {
    eventos.push({ tipo: 'alarma_sin_atender', id: pet.sonando.id, etiqueta: pet.sonando.etiqueta });
    pet.sonando = null;
  }
  const alarmas = [];
  for (const a of pet.alarmas ?? []) {
    if (now < a.fin) { alarmas.push(a); continue; }
    pet.sonando = { id: a.id, etiqueta: a.etiqueta, desde: now };
    eventos.push({ tipo: 'alarma', id: a.id, etiqueta: a.etiqueta, repite: a.repite ?? null });
    if (a.repite) alarmas.push({ ...a, fin: siguienteVez(a.fin, a.repite, now) });
  }
  pet.alarmas = alarmas;
  if (eventos.some((e) => ['temporizador', 'recordatorio', 'alarma'].includes(e.tipo))) {
    pet.dormido = false;
    reaccion(pet, 'sorpresa', now, 4000);
  }
  return eventos;
}

export function reaccion(pet, nombre, now, ms = 2500) {
  if (!EXPRESSIONS[nombre]) throw new Error(`Expresión desconocida: ${nombre}`);
  pet.transitoria = { nombre, hasta: now + ms };
}

// Acciones del usuario sobre la mascota. Devuelve un texto corto de lo que pasó.
export function actuar(pet, accion, now) {
  switch (accion) {
    case 'acariciar':
      if (pet.dormido) return 'Está dormido. Mejor no molestarle.';
      pet.animo = clamp(pet.animo + 8);
      reaccion(pet, 'carino', now);
      return 'Le gusta.';
    case 'alimentar':
      if (pet.dormido) return 'Está dormido. Come luego.';
      if (pet.saciedad > 90) {
        pet.animo = clamp(pet.animo - 5);
        reaccion(pet, 'mareado', now);
        return 'Ya estaba lleno.';
      }
      pet.saciedad = clamp(pet.saciedad + 30);
      pet.animo = clamp(pet.animo + 4);
      reaccion(pet, 'feliz', now);
      return 'Ha comido.';
    case 'dormir':
      if (pet.foco) return 'Ahora no: estamos concentrados.';
      pet.dormido = true;
      pet.transitoria = null;
      return 'Se ha dormido.';
    case 'despertar':
      if (!pet.dormido) return 'Ya estaba despierto.';
      pet.dormido = false;
      if (pet.energia < 50) {
        pet.animo = clamp(pet.animo - 10);
        reaccion(pet, 'enfadado', now);
        return 'Le has despertado antes de tiempo.';
      }
      reaccion(pet, 'sorpresa', now, 1500);
      return 'Se ha despertado.';
    case 'agitar':
      pet.dormido = false;
      pet.animo = clamp(pet.animo - 10);
      reaccion(pet, 'mareado', now, 3500);
      return 'Se ha mareado.';
    default:
      throw new Error(`Acción desconocida: ${accion}`);
  }
}

// El dueño ha hecho lo que Tulo pedía (o se ha adelantado). Devuelve true si
// había un aviso pendiente.
export function cuidar(pet, cual, now) {
  const c = pet.cuidados[cual];
  if (!c) throw new Error(`Cuidado desconocido: ${cual}`);
  const pendiente = c.pendiente;
  c.pendiente = false;
  c.minutos = 0;
  if (pendiente) {
    pet.animo = clamp(pet.animo + 5);
    reaccion(pet, 'feliz', now);
  }
  return pendiente;
}

// ¿Es hora de dormir? Horas en decimal (23.5 = 23:30). La ventana dura seis
// horas desde la hora fijada y cruza la medianoche.
export function tocaDormir(hora, horaDeDormir) {
  return ((hora - horaDeDormir + 24) % 24) < 6;
}

// Bloque de concentración. No hay botón de dar de comer: se le alimenta así.
export function empezarFoco(pet, segundos, now) {
  if (!(segundos > 0)) throw new Error('El bloque necesita una duración positiva.');
  if (pet.foco) throw new Error('Ya hay un bloque en marcha.');
  pet.dormido = false;
  pet.transitoria = null;
  pet.focoVisto = null; // el bloque pedido manda sobre el que solo se ha visto
  pet.foco = { inicio: now, fin: now + segundos * 1000 };
  return pet.foco;
}

// Dejar un bloque a medias no da comida y le baja un poco el ánimo.
export function cancelarFoco(pet, now) {
  if (!pet.foco) return false;
  pet.foco = null;
  pet.animo = clamp(pet.animo - 5);
  reaccion(pet, 'triste', now);
  return true;
}

// La cámara te ve quieto mucho rato: lo cuenta como concentración sin que
// pidas un bloque. `desde` es cuándo empezaste a estar quieto.
export function empezarFocoVisto(pet, desde) {
  if (pet.foco || pet.focoVisto || pet.dormido) return false;
  pet.focoVisto = { inicio: desde };
  return true;
}

// Te has movido o te has ido. Come lo que hayas estado concentrado y devuelve
// los minutos (o null si no había nada en marcha).
export function acabarFocoVisto(pet, now) {
  if (!pet.focoVisto) return null;
  const minutos = Math.max(0, now - pet.focoVisto.inicio) / 60000;
  pet.focoVisto = null;
  pet.saciedad = clamp(pet.saciedad + Math.min(COMIDA_MAX_POR_BLOQUE, minutos * COMIDA_POR_MINUTO));
  if (minutos >= FOCO_VISTO_MIN_BLOQUE) {
    pet.animo = clamp(pet.animo + 6);
    reaccion(pet, 'feliz', now, 4000);
  }
  return minutos;
}

export function progresoFoco(pet, now) {
  if (!pet.foco) return null;
  const total = pet.foco.fin - pet.foco.inicio;
  return Math.max(0, Math.min(1, (now - pet.foco.inicio) / total));
}

export function ponerTemporizador(pet, segundos, now, etiqueta = '') {
  if (!(segundos > 0)) throw new Error('El temporizador necesita una duración positiva.');
  const t = { id: pet.siguienteId++, etiqueta, fin: now + segundos * 1000 };
  pet.temporizadores.push(t);
  return t;
}

// Se repite cada día o cada semana (D-020): la próxima vez después de `now`.
// Se suma en hora local, así un cambio de hora no lo mueve de las 9 a las 8.
export const REPETICIONES = ['diario', 'semanal'];
export function siguienteVez(fin, repite, now) {
  if (!REPETICIONES.includes(repite)) throw new Error(`Repetición desconocida: ${repite}`);
  const paso = repite === 'semanal' ? 7 : 1;
  const d = new Date(fin);
  do d.setDate(d.getDate() + paso); while (d.getTime() <= now);
  return d.getTime();
}

// Recordatorio: avisa en el instante `fin` (milisegundos) con un texto.
// `repite`: null, 'diario' o 'semanal'.
export function ponerRecordatorio(pet, fin, now, texto = '', repite = null) {
  if (!(fin > now)) throw new Error('El recordatorio tiene que ser para más tarde.');
  if (repite && !REPETICIONES.includes(repite)) throw new Error(`Repetición desconocida: ${repite}`);
  const r = { id: pet.siguienteId++, texto, fin, repite };
  pet.recordatorios.push(r);
  return r;
}

// Alarma (D-020): a diferencia del recordatorio, suena hasta que la paras o
// hasta ALARMA_MAX_MS (propuesta: 2 min).
export const ALARMA_MAX_MS = 120000;
export function ponerAlarma(pet, fin, now, etiqueta = '', repite = null) {
  if (!(fin > now)) throw new Error('La alarma tiene que ser para más tarde.');
  if (repite && !REPETICIONES.includes(repite)) throw new Error(`Repetición desconocida: ${repite}`);
  pet.alarmas ??= [];
  const a = { id: pet.siguienteId++, etiqueta, fin, repite };
  pet.alarmas.push(a);
  return a;
}

// Para la alarma que suena. Devuelve la que sonaba o null.
export function pararAlarma(pet) {
  const s = pet.sonando;
  pet.sonando = null;
  return s;
}

const LISTAS_AVISOS = ['temporizadores', 'recordatorios', 'alarmas'];

// Quita un temporizador, un recordatorio o una alarma por su id. Devuelve lo
// quitado o null.
export function quitarAviso(pet, id) {
  for (const lista of LISTAS_AVISOS) {
    const i = (pet[lista] ?? []).findIndex((a) => a.id === id);
    if (i >= 0) return pet[lista].splice(i, 1)[0];
  }
  return null;
}

// Todos los avisos en marcha, del que salta antes al que salta después.
export function avisosPendientes(pet) {
  return [
    ...pet.temporizadores.map((t) => ({ clase: 'temporizador', id: t.id, texto: t.etiqueta, fin: t.fin, repite: null })),
    ...pet.recordatorios.map((r) => ({ clase: 'recordatorio', id: r.id, texto: r.texto, fin: r.fin, repite: r.repite ?? null })),
    ...(pet.alarmas ?? []).map((a) => ({ clase: 'alarma', id: a.id, texto: a.etiqueta, fin: a.fin, repite: a.repite ?? null })),
  ].sort((a, b) => a.fin - b.fin);
}

// Qué cara toca ahora mismo: dormir manda, luego la reacción del momento,
// luego las necesidades y por último el ánimo.
export function expresionActual(pet) {
  if (pet.dormido) return 'dormido';
  if (pet.transitoria) return pet.transitoria.nombre;
  if (pet.foco || pet.focoVisto) return 'foco';
  for (const [id, c] of Object.entries(pet.cuidados)) if (c.pendiente) return CUIDADOS[id].cara;
  if (pet.tarde) return 'sueno';
  if (pet.energia < UMBRAL_BAJO) return 'sueno';
  if (pet.saciedad < UMBRAL_BAJO) return 'hambre';
  if (pet.animo < 25) return 'triste';
  if (pet.animo > 80) return 'contento';
  return 'reposo';
}
