// Tiempo dicho en palabras: duraciones («cinco minutos», «hora y media») y
// horas del día («a las seis menos cuarto de la tarde»).
// Lógica pura: no mira el reloj. La hora actual entra como argumento.

const tiene = (obj, clave) => typeof clave === 'string' && Object.hasOwn(obj, clave);
const quitarTildes = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Parte la frase en palabras. Devuelve las originales (para repetirle al dueño
// lo que dijo) y las mismas normalizadas (para entenderlas). Conserva «17:30»
// y «1,5» enteros y separa «10min» en «10 min».
export function trocear(texto) {
  const orig = (texto ?? '')
    .replace(/[¿?¡!;"«»()]/g, ' ')
    .replace(/(?<!\d)[.,:]|[.,:](?!\d)/g, ' ')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  return { orig, norm: orig.map(quitarTildes) };
}

const UNIDADES_SUELTAS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

// Un número en la posición i, en cifras o en palabras (hasta 999).
// Devuelve { valor, n } con las palabras que ocupa, o null.
export function leerNumero(norm, i) {
  const p = norm[i];
  if (p === undefined) return null;
  if (/^\d+([.,]\d+)?$/.test(p)) return { valor: Number(p.replace(',', '.')), n: 1 };
  let valor = 0;
  let n = 0;
  if (tiene(CENTENAS, p)) {
    valor = CENTENAS[p];
    n = 1;
  }
  const q = norm[i + n];
  if (tiene(DECENAS, q)) {
    valor += DECENAS[q];
    n += 1;
    const u = tiene(UNIDADES_SUELTAS, norm[i + n + 1]) ? UNIDADES_SUELTAS[norm[i + n + 1]] : null;
    if (norm[i + n] === 'y' && u >= 1 && u <= 9) {
      valor += u;
      n += 2;
    }
  } else if (tiene(UNIDADES_SUELTAS, q)) {
    valor += UNIDADES_SUELTAS[q];
    n += 1;
  }
  return n ? { valor, n } : null;
}

const UNIDADES = [
  [/^(s|seg|segs|segundos?)$/, 1],
  [/^(m|min|mins|minutos?)$/, 60],
  [/^(h|horas?)$/, 3600],
];
const unidadDe = (p) => (p === undefined ? null : UNIDADES.find(([re]) => re.test(p))?.[1] ?? null);
const esMedia = (p) => p === 'media' || p === 'medio';

// Un trozo de duración: «5 minutos», «media hora», «hora y media»,
// «tres cuartos de hora», «dos horas y cuarto».
function leerTrozo(norm, i) {
  if (esMedia(norm[i])) {
    const u = unidadDe(norm[i + 1]);
    return u ? { segundos: u / 2, n: 2, unidad: u } : null;
  }
  if (norm[i] === 'cuarto' && norm[i + 1] === 'de' && unidadDe(norm[i + 2]) === 3600) {
    return { segundos: 900, n: 3, unidad: 900 };
  }
  const num = leerNumero(norm, i);
  if (num && /^cuartos?$/.test(norm[i + num.n]) && norm[i + num.n + 1] === 'de' && unidadDe(norm[i + num.n + 2]) === 3600) {
    return { segundos: num.valor * 900, n: num.n + 3, unidad: 900 };
  }
  let u;
  let n;
  let cuantas;
  if (num && (u = unidadDe(norm[i + num.n]))) {
    cuantas = num.valor;
    n = num.n + 1;
  } else if (/^(hora|minuto)$/.test(norm[i] ?? '') && norm[i + 1] === 'y' && esMedia(norm[i + 2])) {
    // «hora y media», sin número delante.
    u = unidadDe(norm[i]);
    cuantas = 1;
    n = 1;
  } else return null;
  let segundos = cuantas * u;
  if (norm[i + n] === 'y' && esMedia(norm[i + n + 1])) {
    segundos += u / 2;
    n += 2;
  } else if (u === 3600 && norm[i + n] === 'y' && norm[i + n + 1] === 'cuarto') {
    segundos += 900;
    n += 2;
  }
  return { segundos, n, unidad: u };
}

// Una duración entera en la posición i: uno o varios trozos de mayor a menor
// («1 hora y 20 minutos», «2 min 30 s»).
function leerDuracionEn(norm, i) {
  const primero = leerTrozo(norm, i);
  if (!primero) return null;
  let { segundos, n, unidad } = primero;
  for (let k = 0; k < 2; k++) {
    const salto = norm[i + n] === 'y' || norm[i + n] === 'con' ? 1 : 0;
    const otro = leerTrozo(norm, i + n + salto);
    if (!otro || otro.unidad >= unidad) break;
    segundos += otro.segundos;
    n += salto + otro.n;
    unidad = otro.unidad;
  }
  return segundos > 0 ? { segundos: Math.round(segundos), n } : null;
}

// La primera duración de la frase. `inicio` y `fin` son las palabras que
// ocupa, incluido el «en» o el «dentro de» de delante.
export function buscarDuracion(norm, desde = 0) {
  for (let i = desde; i < norm.length; i++) {
    const d = leerDuracionEn(norm, i);
    if (!d) continue;
    let inicio = i;
    if (norm[i - 1] === 'en') inicio = i - 1;
    else if (norm[i - 1] === 'de' && norm[i - 2] === 'dentro') inicio = i - 2;
    return { segundos: d.segundos, inicio, fin: i + d.n };
  }
  return null;
}

const PERIODOS = { manana: 'manana', tarde: 'tarde', noche: 'noche', madrugada: 'madrugada', mediodia: 'tarde' };

function aplicarPeriodo(hora, periodo) {
  if (periodo === 'tarde') return hora < 12 ? hora + 12 : hora;
  if (periodo === 'noche') return hora === 12 ? 0 : hora >= 6 && hora < 12 ? hora + 12 : hora;
  return hora === 12 && periodo === 'madrugada' ? 0 : hora; // mañana y madrugada
}

// Una hora del día en la posición i: «a las 17:30», «a las cinco y media»,
// «a la una menos cuarto de la tarde», «al mediodía».
// `ambigua` es true si no se sabe si es de la mañana o de la tarde.
function leerHoraEn(norm, i) {
  if ((norm[i] === 'al' || norm[i] === 'a') && norm[i + 1] === 'mediodia') return { hora: 12, minuto: 0, ambigua: false, n: 2 };
  if ((norm[i] === 'al' || norm[i] === 'a') && norm[i + 1] === 'medianoche') return { hora: 0, minuto: 0, ambigua: false, n: 2 };
  if (!/^(a|para|sobre)$/.test(norm[i] ?? '') || !/^(la|las)$/.test(norm[i + 1] ?? '')) return null;
  let n = 2;
  let hora;
  let minuto = 0;
  const reloj = (norm[i + n] ?? '').match(/^(\d{1,2})[:.](\d{2})$/);
  if (reloj) {
    hora = Number(reloj[1]);
    minuto = Number(reloj[2]);
    n += 1;
  } else {
    const num = leerNumero(norm, i + n);
    if (!num || num.n !== 1 || !Number.isInteger(num.valor)) return null;
    hora = num.valor;
    n += 1;
  }
  if (norm[i + n] === 'h' || norm[i + n] === 'horas') n += 1;
  if (!reloj && (norm[i + n] === 'y' || norm[i + n] === 'menos')) {
    const signo = norm[i + n] === 'y' ? 1 : -1;
    const sig = norm[i + n + 1];
    let m = null;
    let usadas = 0;
    if (sig === 'media' && signo === 1) { m = 30; usadas = 2; }
    else if (sig === 'cuarto') { m = 15; usadas = 2; }
    else {
      const num = leerNumero(norm, i + n + 1);
      if (num && Number.isInteger(num.valor) && num.valor > 0 && num.valor < 60) { m = num.valor; usadas = 1 + num.n; }
    }
    if (m !== null) {
      n += usadas;
      if (/^minutos?$/.test(norm[i + n] ?? '')) n += 1;
      if (signo === 1) minuto = m;
      else { hora -= 1; minuto = 60 - m; }
    }
  }
  if (norm[i + n] === 'en' && norm[i + n + 1] === 'punto') n += 2;
  let periodo = null;
  if (/^(de|por)$/.test(norm[i + n] ?? '') && norm[i + n + 1] === 'la' && tiene(PERIODOS, norm[i + n + 2])) {
    periodo = PERIODOS[norm[i + n + 2]];
    n += 3;
  } else if (norm[i + n] === 'del' && norm[i + n + 1] === 'mediodia') {
    periodo = 'tarde';
    n += 2;
  }
  if (hora === 24) hora = 0;
  if (hora < 0) hora += 24;
  if (hora > 23 || minuto > 59) return null;
  const ambigua = !periodo && hora >= 1 && hora <= 12;
  if (periodo) hora = aplicarPeriodo(hora, periodo);
  return { hora, minuto, ambigua, n };
}

// La primera hora del día de la frase, con las palabras que ocupa.
export function buscarHora(norm, desde = 0) {
  for (let i = desde; i < norm.length; i++) {
    const h = leerHoraEn(norm, i);
    if (h) return { hora: h.hora, minuto: h.minuto, ambigua: h.ambigua, inicio: i, fin: i + h.n };
  }
  return null;
}

// Cuánto falta para la próxima vez que sea esa hora.
// `ahora` es la hora local: { hora, minuto, segundo }.
// Si la hora es ambigua («a las 5») coge la que llegue antes; con «mañana»,
// de 1 a 6 se entiende de la tarde y de 7 a 12, de la mañana.
// Devuelve { segundos, hora, minuto, manana } con la hora ya resuelta.
export function proximaHora(cuando, ahora, { manana = false, periodo = null } = {}) {
  const ahoraSeg = ahora.hora * 3600 + ahora.minuto * 60 + (ahora.segundo ?? 0);
  const DIA = 86400;
  let horas;
  if (!cuando.ambigua) horas = [cuando.hora];
  else if (periodo) horas = [aplicarPeriodo(cuando.hora, periodo)];
  else if (manana) horas = [cuando.hora <= 6 ? cuando.hora + 12 : cuando.hora];
  else horas = [cuando.hora % 12, (cuando.hora % 12) + 12];
  let mejor = null;
  for (const hora of horas) {
    const objetivo = hora * 3600 + cuando.minuto * 60;
    let segundos = manana ? DIA - ahoraSeg + objetivo : objetivo - ahoraSeg;
    if (segundos <= 0) segundos += DIA;
    if (!mejor || segundos < mejor.segundos) {
      mejor = { segundos, hora, minuto: cuando.minuto, manana: ahoraSeg + segundos >= DIA };
    }
  }
  return mejor;
}

// Lleva un instante al primer `diaSemana` (0 = domingo) a la misma hora, ese
// mismo día si ya lo es. Para «cada lunes a las 9» (D-020).
export function moverADia(ms, diaSemana) {
  const d = new Date(ms);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function decirDuracion(segundos) {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  const min = Math.round((s % 3600) / 60);
  const h = Math.floor(s / 3600) + (min === 60 ? 1 : 0);
  return min && min !== 60 ? `${h} h ${min} min` : `${h} h`;
}

export function decirHora({ hora, minuto }) {
  return `${hora}:${String(minuto).padStart(2, '0')}`;
}
