// La inclinación del llavero (D-043 y D-044), para el simulador. Es la misma
// cuenta que firmware/nucleo/pk_inclina.c, con los mismos números:
// test/inclina-js.test.mjs compara las dos con el .wasm del firmware. Si se
// cambia una, hay que cambiar la otra.
//
//   D-043 · de pie, la cara gira lo contrario que el llavero: ojos rectos.
//          Tumbado no se sabe el giro: se queda el último.
//   D-044 · tumbado boca arriba, al inclinarlo los ojos miran hacia el lado
//          que sube (el que queda hacia quien lo sostiene).
//
// La gravedad entra en los ejes de la pantalla (x derecha, y abajo, z hacia
// quien mira), apuntando al SUELO; da igual la unidad. La mirada sale en px
// del aparato (pantalla de 466), en los ejes de la cara. Todo número de aquí
// es PROPUESTA. Lógica pura: el tiempo entra como argumento.
import { K } from './pantalla.mjs';

export const INCLINA = {
  giroDesde: 0.6,      // seno de la inclinación desde plano: ~37°, empieza a enderezarse
  giroDelTodo: 0.8,    // ~53°
  giroTau: 120,        // ms
  miraHasta: 0.5,      // ~30°: ya mira del todo
  miraSeVa: 0.5,       // entre ~30° y ~53° deja de mirar por inclinación
  miraAcaba: 0.8,
  miraX: 14 * K,       // px del aparato
  miraY: 10 * K,
  miraTau: 90,         // ms
  bocaArriba: -0.3,    // z de la gravedad por debajo de esto: la pantalla mira al techo
  sentido: 1,          // 1: hacia el lado que sube; -1: hacia el que baja
};

const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const tramo = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const envolver = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
const acerca = (dt, tau) => (dt <= 0 ? 0 : dt / (tau + dt));

export function crearInclina() {
  return { giro: 0, mx: 0, my: 0, listo: false };
}

// Un paso con la gravedad leída. Cambia `s` y lo devuelve.
export function pasoInclina(s, [gx, gy, gz], dtMs) {
  const n = Math.hypot(gx, gy, gz);
  if (!(n > 1e-6)) return s;
  const ux = gx / n, uy = gy / n, uz = gz / n;
  const plano = Math.hypot(ux, uy);
  const objetivo = Math.atan2(-ux, uy);
  const peso = tramo(plano, INCLINA.giroDesde, INCLINA.giroDelTodo);
  if (!s.listo && peso > 0) s.giro = objetivo;
  else s.giro = envolver(s.giro + envolver(objetivo - s.giro) * peso * acerca(dtMs, INCLINA.giroTau));

  let tx = 0, ty = 0;
  if (uz < INCLINA.bocaArriba && plano > 1e-4) {
    const cuanto = lim(plano / INCLINA.miraHasta, 0, 1) * (1 - tramo(plano, INCLINA.miraSeVa, INCLINA.miraAcaba));
    const sx = (-INCLINA.sentido * ux) / plano, sy = (-INCLINA.sentido * uy) / plano;
    const c = Math.cos(s.giro), si = Math.sin(s.giro);
    tx = (c * sx + si * sy) * cuanto * INCLINA.miraX;
    ty = (-si * sx + c * sy) * cuanto * INCLINA.miraY;
  }
  const k = s.listo ? acerca(dtMs, INCLINA.miraTau) : 1;
  s.mx += (tx - s.mx) * k;
  s.my += (ty - s.my) * k;
  s.listo = true;
  return s;
}

// La gravedad de una postura de prueba (panel «Mover el llavero»), en grados:
// de pie girado `giro` (en el sentido de las agujas del reloj, visto de frente),
// o tumbado boca arriba con el borde de arriba levantado `arriba` y el derecho `derecha`.
export function gravedadDe({ postura = 'pie', giro = 0, arriba = 0, derecha = 0 } = {}) {
  const r = (g) => (g * Math.PI) / 180;
  if (postura === 'pie') return [Math.sin(r(giro)), Math.cos(r(giro)), 0];
  const x = -Math.sin(r(derecha)), y = Math.sin(r(arriba));
  return [x, y, -Math.sqrt(Math.max(0, 1 - x * x - y * y))];
}

// Lo que mide un acelerómetro de móvil (DeviceMotionEvent.accelerationIncludingGravity,
// ejes del móvil en vertical: x derecha, y ARRIBA, z hacia quien mira) → gravedad
// en los ejes de la pantalla de Tulo. En reposo el móvil mide hacia arriba
// (lo que lo sujeta), así que la gravedad es lo contrario; y la y cambia de signo.
// Android y iOS lo dan igual según la especificación; sin comprobar en un móvil real.
export function gravedadDelMovil({ x = 0, y = 0, z = 0 } = {}) {
  return [-x, y, -z];
}
