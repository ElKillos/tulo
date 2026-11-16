// Dónde está Tulo (D-014): en su stand, sobre el escritorio, o de llavero,
// encima de su dueño. Aquí va lo que cambia entre un modo y otro.
//
// Decidido por Chief (12-nov): hay dos modos y lleva batería (D-014); de
// llavero hace poco, sin cámara y con el micrófono a botón (D-015); el stand
// carga y Tulo sabe que está en él por un imán (D-016); sin batería se
// apaga dormido, sin castigo (D-017); fuera, lo que no entienden las reglas
// va al móvil (D-019).
//
// SIGUE SIENDO PROPUESTA: que la pantalla se duerma a los 20 s, que pasear le
// anime, cómo se porta con el stand desenchufado, con qué carga se enciende y
// todas las cifras de batería, que son inventadas: no salen de ningún
// componente.
//
// Lógica pura: el tiempo (`now`, en milisegundos) entra como argumento.

export const MODOS = ['stand', 'llavero'];

// Qué puede hacer en cada modo. `carga` dice que el stand carga; con el stand
// desenchufado no lo hace (ver `cargando`).
export const CAPACIDADES = {
  stand:   { camara: true,  ordenador: true,  distracciones: true,  pasear: false, carga: true,  microfono: 'escucha' },
  llavero: { camara: false, ordenador: false, distracciones: false, pasear: true,  carga: false, microfono: 'boton' },
};

export const PANTALLA_SE_APAGA_MS = 20000; // de llavero, sin tocarle
export const BATERIA_BAJA = 15;
export const BATERIA_ARRANQUE = 3; // al cargar tras apagarse, se enciende con esto

// Horas inventadas para que la batería se mueva en el simulador.
export const HORAS = { pantallaEncendida: 6, pantallaApagada: 40, cargaCompleta: 2 };

export const ANIMO_POR_MINUTO_DE_PASEO = 0.8;

export function createAparato(now = 0) {
  return {
    modo: 'stand',
    enchufado: true, // el stand tiene corriente (D-016: el modo lo dice el imán, no la corriente)
    movilCerca: true, // de llavero, el móvil del dueño está a mano (D-019)
    bateria: 100,
    pantalla: true,
    apagado: false, // sin batería (D-017)
    apagadoDesde: null,
    ultimoToque: now,
    ultimoTick: now,
    avisadoBateria: false,
    paseoMin: 0, // minutos andados en esta salida
    brillo: 100, // % de la pantalla (D-020); gasta más cuanto más alto
  };
}

export const capacidades = (a) => CAPACIDADES[a.modo];

// Recibe corriente: está en el stand y el stand está enchufado.
export const cargando = (a) => capacidades(a).carga && a.enchufado;

// Cualquier cosa que le pase (un botón, una orden, un aviso que salta)
// enciende la pantalla. Devuelve true si estaba apagada. Sin batería, nada la
// enciende.
export function tocarAparato(a, now) {
  if (a.apagado) return false;
  a.ultimoToque = now;
  if (a.pantalla) return false;
  a.pantalla = true;
  return true;
}

// Cambia de modo: es lo que nota el sensor del imán al ponerle o quitarle del
// stand. Devuelve { modo, paseoMin } con lo andado en la salida que acaba (0 si
// se va, o si no anduvo).
export function cambiarModo(a, modo, now) {
  if (!MODOS.includes(modo)) throw new Error(`Modo desconocido: ${modo}`);
  if (a.modo === modo) return null;
  const paseoMin = a.modo === 'llavero' ? a.paseoMin : 0;
  a.modo = modo;
  a.paseoMin = 0;
  tocarAparato(a, now);
  return { modo, paseoMin };
}

// Enchufa o desenchufa el stand. Solo cuenta estando en él.
export function enchufar(a, si = true) {
  a.enchufado = Boolean(si);
}

// Avanza hasta `now`. `velocidad` acelera la batería igual que las
// necesidades, para probar. Devuelve lo ocurrido:
//   { tipo: 'pantalla', encendida: false }   se ha dormido la pantalla
//   { tipo: 'bateria-baja', enStand }        una vez, al bajar del umbral
//   { tipo: 'cargado' }                      una vez, al llegar a 100
//   { tipo: 'apagado' }                      se ha quedado sin batería
//   { tipo: 'encendido', apagadoMs }         vuelve tras cargar lo justo
export function tickAparato(a, now, velocidad = 1) {
  const eventos = [];
  const horas = (Math.max(0, now - a.ultimoTick) / 3600000) * velocidad;
  a.ultimoTick = now;

  if (cargando(a)) {
    const antes = a.bateria;
    a.bateria = Math.min(100, a.bateria + (100 / HORAS.cargaCompleta) * horas);
    if (a.apagado) {
      if (a.bateria < BATERIA_ARRANQUE) return eventos;
      const apagadoMs = now - a.apagadoDesde;
      a.apagado = false;
      a.apagadoDesde = null;
      a.ultimoToque = now;
      eventos.push({ tipo: 'encendido', apagadoMs });
    }
    if (antes < 100 && a.bateria >= 100) eventos.push({ tipo: 'cargado' });
    if (a.bateria > BATERIA_BAJA) a.avisadoBateria = false;
    a.pantalla = true;
    return eventos;
  }

  if (a.apagado) return eventos; // apagado no gasta

  // En el stand desenchufado la pantalla no se duerme: gasta como encendida.
  const enStand = a.modo === 'stand';
  // Propuesta: la pantalla gasta la mitad fija y la otra mitad según el brillo.
  const factor = 0.5 + 0.5 * ((a.brillo ?? 100) / 100);
  const dura = a.pantalla ? HORAS.pantallaEncendida / factor : HORAS.pantallaApagada;
  a.bateria = Math.max(0, a.bateria - (100 / dura) * horas);
  if (a.bateria <= 0) {
    a.apagado = true;
    a.apagadoDesde = now;
    a.pantalla = false;
    eventos.push({ tipo: 'apagado' });
    return eventos;
  }
  if (a.bateria <= BATERIA_BAJA && !a.avisadoBateria) {
    a.avisadoBateria = true;
    eventos.push({ tipo: 'bateria-baja', enStand });
  }
  if (!enStand && a.pantalla && now - a.ultimoToque >= PANTALLA_SE_APAGA_MS) {
    a.pantalla = false;
    eventos.push({ tipo: 'pantalla', encendida: false });
  }
  return eventos;
}

// Pasear: de llavero, el acelerómetro nota que su dueño anda. A Tulo le
// anima y cuenta como haberse estirado. Devuelve true si quedaba un aviso de
// estirarse por atender.
export function pasear(a, pet, minutos) {
  if (!capacidades(a).pasear) throw new Error('En el stand no se pasea.');
  if (a.apagado) throw new Error('Sin batería no nota nada.');
  if (!(minutos > 0)) throw new Error('El paseo necesita una duración positiva.');
  a.paseoMin += minutos;
  pet.animo = Math.min(100, pet.animo + minutos * ANIMO_POR_MINUTO_DE_PASEO);
  const pedia = pet.cuidados.estirar.pendiente;
  pet.cuidados.estirar.pendiente = false;
  pet.cuidados.estirar.minutos = 0;
  return pedia;
}

// Lo que no entienden las reglas (D-019). En el stand, al modelo de lenguaje
// del ordenador (sin montar); de llavero, al móvil si está cerca.
//   'ordenador' | 'movil' | 'sin-movil'
export function quienContesta(a) {
  if (a.modo === 'stand') return 'ordenador';
  return a.movilCerca ? 'movil' : 'sin-movil';
}
