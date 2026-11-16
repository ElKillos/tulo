// Pomodoro: tandas de trabajo y descanso encima de los bloques de
// concentración (cada tanda de trabajo es un bloque: le da de comer y cuenta
// para las misiones). Lo pidió Chief como conector el 12-nov; Troko trae uno
// de 25 min (ver «Funciones de Troko» en el vault).
//
// PROPUESTA, no decisión: 25 min de trabajo, 5 de descanso y 15 de descanso
// largo cada cuatro (el pomodoro clásico), y que encadene solo las tandas
// hasta que le digas que pare.
//
// Lógica pura: el tiempo (`now`, en milisegundos) entra como argumento. El
// bloque de trabajo lo lleva `pet.mjs`; aquí solo se decide qué toca después.

export const DURACIONES = { trabajo: 25 * 60, corto: 5 * 60, largo: 15 * 60 }; // segundos
export const LARGO_CADA = 4;
// Para probar sin esperar media hora.
export const DURACIONES_PRUEBA = { trabajo: 20, corto: 10, largo: 15 };

export function createPomodoro() {
  return { activo: false, fase: null, hechos: 0, fin: 0, dur: { ...DURACIONES } };
}

// Empieza. Devuelve la fase de trabajo; quien llama arranca el bloque de
// concentración con `segundos`.
export function empezarPomodoro(po, now, dur = DURACIONES) {
  po.activo = true;
  po.hechos = 0;
  po.dur = { ...dur };
  return entrarEnTrabajo(po, now);
}

function entrarEnTrabajo(po, now) {
  po.fase = 'trabajo';
  po.fin = now + po.dur.trabajo * 1000;
  return { fase: 'trabajo', segundos: po.dur.trabajo, numero: po.hechos + 1 };
}

// El bloque de trabajo ha acabado (lo dice el evento 'foco' de pet). Devuelve
// el descanso que toca, o null si no había pomodoro.
export function acabarTrabajo(po, now) {
  if (!po.activo || po.fase !== 'trabajo') return null;
  po.hechos += 1;
  const largo = po.hechos % LARGO_CADA === 0;
  po.fase = largo ? 'largo' : 'corto';
  const segundos = largo ? po.dur.largo : po.dur.corto;
  po.fin = now + segundos * 1000;
  return { fase: po.fase, segundos, hechos: po.hechos };
}

// Avanza el descanso. Cuando acaba devuelve la tanda de trabajo siguiente
// (quien llama arranca el bloque); si no, null.
export function tickPomodoro(po, now) {
  if (!po.activo || po.fase === 'trabajo' || now < po.fin) return null;
  return entrarEnTrabajo(po, now);
}

export function pararPomodoro(po) {
  if (!po.activo) return false;
  po.activo = false;
  po.fase = null;
  po.fin = 0;
  return true;
}

// Para contarlo: «tanda 2 de 4 · descanso, quedan 3:12».
export function resumenPomodoro(po, now) {
  if (!po.activo) return null;
  return {
    fase: po.fase,
    // En el trabajo, la que está en marcha; en el descanso, la que acaba de terminar.
    tanda: po.fase === 'trabajo' ? (po.hechos % LARGO_CADA) + 1 : po.hechos % LARGO_CADA || LARGO_CADA,
    de: LARGO_CADA,
    hechos: po.hechos,
    quedaMs: Math.max(0, po.fin - now),
  };
}
