// Distracciones en reposo: cuando Tulo no tiene nada que hacer, de vez en
// cuando pasa una mosca o una pelota por la pantalla y la sigue con los ojos.
// No sirven para nada, y de eso se trata: que esté vivo aunque nadie le hable.
//
// Lógica pura: el tiempo (`now`, en milisegundos) y el azar entran como
// argumentos. Las posiciones van de 0 a 1 sobre la pantalla (x hacia la
// derecha, y hacia abajo); quien dibuja las pasa a píxeles.
//
// Cada cuánto aparecen y qué cara pone son valores de partida para ajustar
// mirándolo, no decisiones de producto.

export const DISTRACCIONES = {
  mosca:  { dura: 7000, cara: 'escucha' },
  pelota: { dura: 5200, cara: 'contento' },
};
export const ESPERA_MIN_MS = 40000;
export const ESPERA_MAX_MS = 110000;
export const CALMA_MS = 8000; // tras hacer algo, cuánto espera antes de distraerse

const espera = (azar) => ESPERA_MIN_MS + azar() * (ESPERA_MAX_MS - ESPERA_MIN_MS);

export function createDistracciones(now, azar = Math.random) {
  return { actual: null, proxima: now + espera(azar) };
}

// Empieza una distracción ya (también para probarla desde el simulador).
// `semilla` (0 a 1) decide por qué lado entra y por dónde va.
export function empezarDistraccion(d, cual, now, semilla = Math.random()) {
  if (!DISTRACCIONES[cual]) throw new Error(`Distracción desconocida: ${cual}`);
  d.actual = { cual, inicio: now, fin: now + DISTRACCIONES[cual].dura, semilla };
  return d.actual;
}

// Avanza hasta `now`. `tranquilo` dice si Tulo está sin nada que hacer:
// despierto, sin bloque, sin reacción en marcha y sin necesidades.
// Devuelve lo ocurrido: [{ tipo: 'empieza' | 'acaba', cual, cortada? }].
export function actualizarDistracciones(d, tranquilo, now, azar = Math.random) {
  const eventos = [];
  if (d.actual) {
    const cortada = !tranquilo;
    if (cortada || now >= d.actual.fin) {
      eventos.push(cortada ? { tipo: 'acaba', cual: d.actual.cual, cortada: true } : { tipo: 'acaba', cual: d.actual.cual });
      d.actual = null;
      d.proxima = now + espera(azar);
    }
    return eventos;
  }
  if (!tranquilo) {
    // Si acaba de pasar algo, no se distrae nada más terminar.
    d.proxima = Math.max(d.proxima, now + CALMA_MS);
    return eventos;
  }
  if (now >= d.proxima) {
    const cual = azar() < 0.5 ? 'mosca' : 'pelota';
    empezarDistraccion(d, cual, now, azar());
    eventos.push({ tipo: 'empieza', cual });
  }
  return eventos;
}

const mezcla = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

// Dónde está el objeto en `now`. Devuelve { cual, x, y, p } con p de 0 a 1
// (lo que lleva de recorrido), o null si no hay distracción.
export function posicion(d, now) {
  const a = d.actual;
  if (!a) return null;
  const p = Math.max(0, Math.min(1, (now - a.inicio) / (a.fin - a.inicio)));
  const izquierda = a.semilla < 0.5;
  if (a.cual === 'pelota') {
    // Cruza la pantalla botando, cada bote un poco más bajo.
    const avance = mezcla(-0.08, 1.08, p);
    const bote = Math.abs(Math.sin(Math.PI * 4 * p)) * 0.58 * (1 - 0.45 * p);
    return { cual: a.cual, x: izquierda ? avance : 1 - avance, y: 0.9 - bote, p };
  }
  // Mosca: entra por un lado, revolotea y se va por arriba.
  const fase = a.semilla * Math.PI * 2;
  let x = 0.5 + 0.4 * Math.sin(Math.PI * 2 * 1.5 * p + fase) + 0.02 * Math.sin(p * 190);
  let y = 0.36 + 0.26 * Math.sin(Math.PI * 2 * 2.3 * p + fase * 2) + 0.02 * Math.cos(p * 230);
  const ENTRA = 0.12;
  const SALE = 0.88;
  if (p < ENTRA) x = mezcla(izquierda ? -0.1 : 1.1, x, p / ENTRA);
  if (p > SALE) y = mezcla(y, -0.12, (p - SALE) / (1 - SALE));
  return { cual: a.cual, x, y, p };
}

// Hacia dónde miran los ojos para seguir el objeto, en píxeles de mirada
// (lo mismo que `miradaDesdeCara`).
export function miradaHacia(pos, maxX = 16, maxY = 9) {
  const recorta = (v) => Math.max(-1, Math.min(1, v));
  return { x: recorta((pos.x - 0.5) * 2) * maxX, y: recorta((pos.y - 0.5) * 2) * maxY };
}
