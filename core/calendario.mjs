// Calendario: lee un fichero .ics (el formato que exportan Google Calendar,
// Outlook y Apple) y avisa antes de cada cita. Pedido por Chief como conector
// el 12-nov. Desde el 13-nov el puente también lo descarga en vivo de la
// «dirección secreta en formato iCal» de Google Calendar (puente/calendario.mjs).
//
// PROPUESTA, no decisión: avisar 10 min antes y al empezar.
//
// Citas que se repiten (RRULE, 13-nov): con `leerIcs(texto, { ahora })` se
// sacan todas las veces que caen entre un día antes y 60 días después de
// `ahora`. Entiende FREQ DAILY/WEEKLY/MONTHLY/YEARLY con INTERVAL, COUNT,
// UNTIL, BYDAY (también «2TU» o «-1FR» en las mensuales), BYMONTHDAY y
// BYMONTH; EXDATE (veces quitadas) y RECURRENCE-ID (una vez cambiada de hora o
// cancelada, como las exporta Google). No entiende BYSETPOS, BYWEEKNO,
// BYYEARDAY ni RDATE: con esas, la cita sale solo con lo que sí entiende.
// Sin `ahora`, como antes: solo la primera vez.
//
// Las zonas horarias se resuelven con Intl (en Node y en el navegador). Lógica
// pura salvo eso: el tiempo entra como argumento.

export const AVISO_ANTES_MIN = 10;
export const VENTANA_DIAS = { atras: 1, adelante: 60 };

const DIA_MS = 86400000;
const DIAS_SEMANA = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Junta las líneas partidas (RFC 5545: una línea que empieza por espacio o
// tabulador sigue a la anterior) y las separa en { nombre, params, valor }.
function lineas(texto) {
  const crudas = String(texto).replace(/\r\n?/g, '\n').split('\n');
  const juntas = [];
  for (const l of crudas) {
    if (/^[ \t]/.test(l) && juntas.length) juntas[juntas.length - 1] += l.slice(1);
    else if (l.trim()) juntas.push(l);
  }
  return juntas.map((l) => {
    const dos = l.indexOf(':');
    if (dos < 0) return null;
    const [nombre, ...params] = l.slice(0, dos).split(';');
    const p = {};
    for (const x of params) {
      const [k, v] = x.split('=');
      p[k.toUpperCase()] = v?.replace(/^"|"$/g, '');
    }
    return { nombre: nombre.toUpperCase(), params: p, valor: l.slice(dos + 1) };
  }).filter(Boolean);
}

const desescapar = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// Un formateador por zona: crearlos es lo caro, y una cita diaria de hace
// años pide miles de conversiones.
const formateadores = new Map();
function formateador(zona) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formateadores.set(zona, f);
  }
  return f;
}

// Diferencia en ms entre la hora de pared de `zona` y la UTC en el instante `ms`.
function desfase(ms, zona) {
  const partes = formateador(zona).formatToParts(new Date(ms));
  const v = Object.fromEntries(partes.map((x) => [x.type, Number(x.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(ms / 1000) * 1000;
}

// Hora de pared en una zona → instante en ms.
export function instanteEnZona(y, mes, d, h, mi, s, zona) {
  const pared = Date.UTC(y, mes - 1, d, h, mi, s);
  let ms = pared - desfase(pared, zona);
  ms = pared - desfase(ms, zona); // segunda pasada por si cae cerca de un cambio de hora
  return ms;
}

// Hora de pared → ms. `zona`: 'Z' (UTC), un TZID que Intl conoce, o null
// (hora local del equipo).
function aMs(p, zona) {
  if (zona === 'Z') return Date.UTC(p.y, p.mes - 1, p.d, p.h, p.mi, p.s);
  if (zona) return instanteEnZona(p.y, p.mes, p.d, p.h, p.mi, p.s, zona);
  return new Date(p.y, p.mes - 1, p.d, p.h, p.mi, p.s).getTime();
}

// Una fecha del .ics → { ms, diaEntero, pared, zona }. `pared` y `zona` sirven
// para repetirla: las repeticiones van en hora de pared (la reunión de las 9
// sigue a las 9 tras el cambio de hora).
export function leerFecha(valor, params = {}) {
  const m = String(valor).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mes, d, h, mi, s, z] = m;
  const n = (x) => Number(x ?? 0);
  const pared = { y: n(y), mes: n(mes), d: n(d), h: n(h), mi: n(mi), s: n(s) };
  if (h === undefined || params.VALUE === 'DATE') {
    const p = { ...pared, h: 0, mi: 0, s: 0 };
    return { ms: aMs(p, null), diaEntero: true, pared: p, zona: null };
  }
  if (z) return { ms: aMs(pared, 'Z'), diaEntero: false, pared, zona: 'Z' };
  if (params.TZID) {
    try {
      return { ms: aMs(pared, params.TZID), diaEntero: false, pared, zona: params.TZID };
    } catch {
      // Zona que Intl no conoce: se toma como hora local.
    }
  }
  return { ms: aMs(pared, null), diaEntero: false, pared, zona: null };
}

// Lista de fechas separadas por comas (EXDATE, RDATE) → instantes en ms.
function leerFechas(valor, params) {
  return String(valor).split(',').map((v) => leerFecha(v, params)?.ms).filter((x) => x !== undefined);
}

// DURATION (P1W, P2D, PT1H30M, P1DT2H…) → ms.
function leerDuracion(valor) {
  const m = String(valor).match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, signo, w, d, h, mi, s] = m.map((x, i) => (i <= 1 ? x : Number(x ?? 0)));
  const ms = ((w * 7 + d) * 24 * 3600 + h * 3600 + mi * 60 + s) * 1000;
  return signo === '-' ? -ms : ms;
}

// RRULE → { freq, intervalo, cuenta, hasta, porDia, porDiaMes, porMes }.
export function leerRrule(valor) {
  const r = {};
  for (const parte of String(valor).split(';')) {
    const [k, v] = parte.split('=');
    if (k && v !== undefined) r[k.toUpperCase()] = v;
  }
  const lista = (x) => (x ? x.split(',').map((y) => y.trim()).filter(Boolean) : []);
  const porDia = lista(r.BYDAY).map((x) => {
    const m = x.toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
    return m ? { n: m[1] ? Number(m[1]) : null, dia: DIAS_SEMANA[m[2]] } : null;
  }).filter(Boolean);
  return {
    freq: (r.FREQ ?? '').toUpperCase(),
    intervalo: Math.max(1, Number(r.INTERVAL) || 1),
    cuenta: r.COUNT ? Number(r.COUNT) : null,
    hasta: r.UNTIL ?? null,
    porDia,
    porDiaMes: lista(r.BYMONTHDAY).map(Number).filter((x) => Number.isInteger(x) && x !== 0),
    porMes: lista(r.BYMONTH).map(Number).filter((x) => x >= 1 && x <= 12),
  };
}

// --- Días de calendario como números (días desde 1970 en el calendario civil,
// sin zona: solo sirven para contar días, semanas y meses).
const numDia = (y, mes, d) => Math.round(Date.UTC(y, mes - 1, d) / DIA_MS);
const deNumDia = (n) => { const x = new Date(n * DIA_MS); return { y: x.getUTCFullYear(), mes: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
const diaSemana = (n) => new Date(n * DIA_MS).getUTCDay();
const diasDelMes = (y, mes) => new Date(Date.UTC(y, mes, 0)).getUTCDate();

// Días de un mes que cumplen BYMONTHDAY o BYDAY; si no hay ninguno, el
// mismo día del mes que la primera vez (y ese mes se salta si no lo tiene).
function diasEnMes(y, mes, regla, diaInicio) {
  const total = diasDelMes(y, mes);
  const fuera = new Set();
  if (regla.porDiaMes.length) {
    for (const x of regla.porDiaMes) {
      const d = x > 0 ? x : total + 1 + x;
      if (d >= 1 && d <= total) fuera.add(d);
    }
  } else if (regla.porDia.length) {
    for (const { n, dia } of regla.porDia) {
      const todos = [];
      for (let d = 1; d <= total; d++) if (diaSemana(numDia(y, mes, d)) === dia) todos.push(d);
      if (n === null) todos.forEach((d) => fuera.add(d));
      else {
        const d = n > 0 ? todos[n - 1] : todos[todos.length + n];
        if (d) fuera.add(d);
      }
    }
  } else if (diaInicio <= total) fuera.add(diaInicio);
  // Con BYMONTHDAY y BYDAY a la vez, deben cumplirse los dos.
  if (regla.porDiaMes.length && regla.porDia.length) {
    const dias = new Set(regla.porDia.map((x) => x.dia));
    for (const d of [...fuera]) if (!dias.has(diaSemana(numDia(y, mes, d)))) fuera.delete(d);
  }
  return [...fuera].sort((a, b) => a - b).map((d) => numDia(y, mes, d));
}

// Días candidatos del periodo k (el día de la primera vez es el periodo 0).
function diasDelPeriodo(regla, inicio, k) {
  const n0 = numDia(inicio.y, inicio.mes, inicio.d);
  const conDias = new Set(regla.porDia.map((x) => x.dia));
  const pasaMes = (n) => !regla.porMes.length || regla.porMes.includes(deNumDia(n).mes);
  if (regla.freq === 'DAILY') {
    const n = n0 + k * regla.intervalo;
    const { d } = deNumDia(n);
    if (regla.porDia.length && !conDias.has(diaSemana(n))) return [];
    if (regla.porDiaMes.length && !regla.porDiaMes.includes(d)) return [];
    return pasaMes(n) ? [n] : [];
  }
  if (regla.freq === 'WEEKLY') {
    const lunes = n0 - ((diaSemana(n0) + 6) % 7) + k * 7 * regla.intervalo;
    const dias = regla.porDia.length ? [...conDias] : [diaSemana(n0)];
    return dias.map((dia) => lunes + ((dia + 6) % 7)).sort((a, b) => a - b).filter(pasaMes);
  }
  if (regla.freq === 'MONTHLY') {
    const indice = inicio.y * 12 + (inicio.mes - 1) + k * regla.intervalo;
    const y = Math.floor(indice / 12);
    const mes = (indice % 12) + 1;
    if (regla.porMes.length && !regla.porMes.includes(mes)) return [];
    return diasEnMes(y, mes, regla, inicio.d);
  }
  if (regla.freq === 'YEARLY') {
    const y = inicio.y + k * regla.intervalo;
    // Sin BYMONTH, el mes de la primera vez (un BYDAY anual sin mes, raro, se
    // lee dentro de ese mes).
    const meses = regla.porMes.length ? regla.porMes : [inicio.mes];
    return meses.flatMap((mes) => diasEnMes(y, mes, regla, inicio.d)).sort((a, b) => a - b);
  }
  return null; // frecuencia que no se entiende
}

// Instantes de inicio de las veces que una cita se repite y tocan la ventana
// [desde, hasta) (una que empezó antes de `desde` y no ha acabado, también).
// La primera vez (DTSTART) cuenta siempre como una de ellas, como dice el RFC.
export function repeticiones(inicio, regla, duracionMs, desde, hasta, maxPeriodos = 40000) {
  const n0 = numDia(inicio.pared.y, inicio.pared.mes, inicio.pared.d);
  const hastaRegla = regla.hasta ? leerFecha(regla.hasta, regla.hasta.length === 8 ? { VALUE: 'DATE' } : {}) : null;
  // UNTIL con solo fecha: ese día entero cuenta.
  const limite = hastaRegla ? hastaRegla.ms + (hastaRegla.diaEntero ? DIA_MS - 1 : 0) : Infinity;
  const fuera = [];
  let contadas = 0;
  const margen = 2 * DIA_MS; // las zonas se mueven como mucho ±14 h
  const anotar = (n) => {
    contadas += 1;
    const { y, mes, d } = deNumDia(n);
    // Lejos de la ventana basta con una cuenta aproximada; cerca, la exacta.
    const aprox = Date.UTC(y, mes - 1, d, inicio.pared.h, inicio.pared.mi, inicio.pared.s);
    if (aprox + duracionMs + margen < desde && aprox + margen < limite) return 'sigue';
    const ms = aMs({ y, mes, d, h: inicio.pared.h, mi: inicio.pared.mi, s: inicio.pared.s }, inicio.zona);
    if (ms > limite) return 'para';
    if (ms >= hasta) return 'para';
    if (ms + duracionMs > desde) fuera.push(ms);
    return 'sigue';
  };
  if (anotar(n0) === 'para') return fuera;
  for (let k = 0; k < maxPeriodos; k++) {
    if (regla.cuenta !== null && contadas >= regla.cuenta) break;
    const dias = diasDelPeriodo(regla, inicio.pared, k);
    if (dias === null) break;
    let parar = false;
    for (const n of dias) {
      if (n <= n0) continue;
      if (regla.cuenta !== null && contadas >= regla.cuenta) { parar = true; break; }
      if (anotar(n) === 'para') { parar = true; break; }
    }
    if (parar) break;
  }
  return fuera;
}

// .ics → lista de citas { id, titulo, inicio, fin, diaEntero, lugar, repite, enlaces? },
// ordenadas por inicio. Con `opciones.ahora`, las que se repiten salen una vez
// por cada repetición dentro de la ventana (todas con el mismo `id`: los
// avisos se distinguen por `id@inicio`).
export function leerIcs(texto, opciones = {}) {
  const eventos = [];
  let actual = null;
  for (const l of lineas(texto)) {
    if (l.nombre === 'BEGIN' && l.valor.toUpperCase() === 'VEVENT') actual = { exdates: [] };
    else if (l.nombre === 'END' && l.valor.toUpperCase() === 'VEVENT') {
      if (actual?.inicio) eventos.push(actual);
      actual = null;
    } else if (actual) {
      if (l.nombre === 'SUMMARY') actual.titulo = desescapar(l.valor);
      else if (l.nombre === 'LOCATION') actual.lugar = desescapar(l.valor) || null;
      else if (l.nombre === 'UID') actual.uid = l.valor;
      else if (l.nombre === 'DTSTART') actual.inicio = leerFecha(l.valor, l.params);
      else if (l.nombre === 'DTEND') actual.fin = leerFecha(l.valor, l.params);
      else if (l.nombre === 'DURATION') actual.duracion = leerDuracion(l.valor);
      else if (l.nombre === 'RRULE') actual.rrule = l.valor;
      else if (l.nombre === 'EXDATE') actual.exdates.push(...leerFechas(l.valor, l.params));
      else if (l.nombre === 'RECURRENCE-ID') actual.recurrencia = leerFecha(l.valor, l.params)?.ms;
      else if (l.nombre === 'STATUS') actual.estado = l.valor.toUpperCase();
      // 16-nov: las direcciones que traiga la cita (la de la videollamada suele
      // venir aquí), para el botón «Unirme» de la app de escritorio. Solo las
      // direcciones: la descripción no se guarda.
      if (['URL', 'X-GOOGLE-CONFERENCE', 'LOCATION', 'DESCRIPTION'].includes(l.nombre)) {
        for (const m of desescapar(l.valor).matchAll(/https?:\/\/[^\s<>"')\\]+/g)) {
          actual.enlaces ??= [];
          if (actual.enlaces.length < 6 && !actual.enlaces.includes(m[0])) actual.enlaces.push(m[0]);
        }
      }
    }
  }

  const ahora = opciones.ahora;
  const ventana = { ...VENTANA_DIAS, ...opciones.ventana };
  const desde = ahora - ventana.atras * DIA_MS;
  const hasta = ahora + ventana.adelante * DIA_MS;

  // Veces cambiadas o canceladas sueltas (RECURRENCE-ID): quitan la repetición
  // que sustituyen.
  const sustituidas = new Map();
  for (const e of eventos) {
    if (e.recurrencia === undefined) continue;
    const id = e.uid ?? '';
    if (!sustituidas.has(id)) sustituidas.set(id, new Set());
    sustituidas.get(id).add(e.recurrencia);
  }

  const citas = [];
  for (const e of eventos) {
    if (e.estado === 'CANCELLED') continue;
    const id = e.uid ?? `${e.inicio.ms}-${e.titulo ?? ''}`;
    const finMs = e.fin?.ms ?? (e.duracion !== null && e.duracion !== undefined
      ? e.inicio.ms + e.duracion
      : e.inicio.ms + (e.inicio.diaEntero ? DIA_MS : 3600000));
    const duracionMs = Math.max(0, finMs - e.inicio.ms);
    const base = {
      id,
      titulo: e.titulo ?? '(sin título)',
      diaEntero: e.inicio.diaEntero,
      lugar: e.lugar ?? null,
      repite: Boolean(e.rrule),
      ...(e.enlaces?.length ? { enlaces: e.enlaces } : {}),
    };
    if (!e.rrule || ahora === undefined || e.recurrencia !== undefined) {
      citas.push({ ...base, inicio: e.inicio.ms, fin: finMs });
      continue;
    }
    const quitadas = new Set([...e.exdates, ...(sustituidas.get(e.uid ?? '') ?? [])]);
    const regla = leerRrule(e.rrule);
    // De día entero, la duración se cuenta en días (un cambio de hora no la mueve).
    const dias = Math.round(duracionMs / DIA_MS);
    for (const ms of repeticiones(e.inicio, regla, duracionMs, desde, hasta)) {
      if (quitadas.has(ms)) continue;
      let fin = ms + duracionMs;
      if (e.inicio.diaEntero) {
        const x = new Date(ms);
        fin = new Date(x.getFullYear(), x.getMonth(), x.getDate() + dias).getTime();
      }
      citas.push({ ...base, inicio: ms, fin });
    }
  }
  return citas.sort((a, b) => a.inicio - b.inicio);
}

export function createCalendario(citas = []) {
  return { citas, avisados: [] };
}

// Las que aún no han acabado, de la más próxima a la más lejana.
export function proximas(cal, now, n = 3) {
  return cal.citas.filter((c) => c.fin > now).slice(0, n);
}

// Las de un día (el de `now` desplazado `dias`), en hora local.
export function delDia(cal, now, dias = 0) {
  const d = new Date(now);
  const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias).getTime();
  const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias + 1).getTime();
  return cal.citas.filter((c) => c.inicio < fin && c.fin > ini);
}

// Avisos que tocan ahora: { tipo: 'pronto' | 'empieza', cita, minutos }. Cada
// uno sale una vez y las de día entero no avisan.
//   'pronto': desde `antesMin` antes hasta que empieza (si abres el simulador
//             a 5 min de una cita, avisa con los 5 que faltan).
//   'empieza': en el primer minuto; pasado ese minuto se da por perdido.
export function avisosCalendario(cal, now, antesMin = AVISO_ANTES_MIN) {
  const fuera = [];
  const ya = (clave) => cal.avisados.includes(clave);
  for (const c of cal.citas) {
    if (c.diaEntero || c.fin <= now) continue;
    const kPronto = `${c.id}@${c.inicio}:pronto`;
    const kEmpieza = `${c.id}@${c.inicio}:empieza`;
    if (now < c.inicio) {
      if (now >= c.inicio - antesMin * 60000 && !ya(kPronto)) {
        cal.avisados.push(kPronto);
        fuera.push({ tipo: 'pronto', cita: c, minutos: Math.ceil((c.inicio - now) / 60000) });
      }
    } else if (!ya(kEmpieza)) {
      cal.avisados.push(kEmpieza);
      if (!ya(kPronto)) cal.avisados.push(kPronto);
      if (now - c.inicio <= 60000) fuera.push({ tipo: 'empieza', cita: c, minutos: 0 });
    }
  }
  return fuera;
}

// Un calendario de ejemplo alrededor de `now`, para probar sin un .ics.
export function calendarioDeEjemplo(now) {
  const min = 60000;
  const z = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const d = new Date(now);
  const manana = (h) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, h).getTime();
  const fecha = (ms) => { const x = new Date(ms); return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`; };
  const ev = (uid, titulo, ini, fin, extra = '') => [
    'BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${titulo}`, ini, fin, ...extra, 'END:VEVENT',
  ].join('\r\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tulo//ejemplo//ES',
    // La primera, a 10 min y 20 s: el aviso de «pronto» salta a los 20 s.
    ev('ej-1', 'Reunión con Jacobo y Gonzalo', `DTSTART:${z(now + AVISO_ANTES_MIN * min + 20000)}`, `DTEND:${z(now + (AVISO_ANTES_MIN + 45) * min)}`, ['LOCATION:Videollamada']),
    ev('ej-2', 'Gimnasio', `DTSTART:${z(now + 3 * 60 * min)}`, `DTEND:${z(now + 4 * 60 * min)}`),
    ev('ej-3', 'Revisar el prototipo', `DTSTART;VALUE=DATE:${fecha(manana(0))}`, `DTEND;VALUE=DATE:${fecha(manana(24))}`),
    ev('ej-4', 'Café con el equipo', `DTSTART:${z(manana(10))}`, `DTEND:${z(manana(11))}`),
    // Se repite cada día a las 9 (hora local) desde hace una semana, para ver
    // las RRULE.
    ev('ej-5', 'Repaso del día', `DTSTART:${fecha(now - 7 * 24 * 60 * min)}T090000`, `DTEND:${fecha(now - 7 * 24 * 60 * min)}T091500`, ['RRULE:FREQ=DAILY']),
    'END:VCALENDAR',
  ].join('\r\n');
}
