// Vistas en la pantalla de Tulo (240 × 240): hábitos, progreso y tareas,
// como las pantallas completas de Troko (D-020). Aquí se decide QUÉ se
// enseña; `web/face.mjs` lo pinta.
//
// PROPUESTA, no decisión: 5 filas por página, la vista dura 15 s y pasa de
// página cada 4 s, se cierra al tocarle o con «cierra»; un aviso que salta la
// quita.
//
// Lógica pura: el día entra como texto y el tiempo como argumento.

import { hecho, resumenDia, resumenSemana, ICONOS } from './habitos.mjs';
import { tareasOrdenadas, pendientes } from './tareas.mjs';

export const FILAS = 5;
export const DURA_MS = 15000;
export const PAGINA_MS = 4000;

// Corta un texto a `max` caracteres con «…» (la pantalla es pequeña).
export function recortar(texto, max) {
  const t = String(texto ?? '');
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function paginar(items, pagina) {
  const paginas = Math.max(1, Math.ceil(items.length / FILAS));
  const p = ((pagina % paginas) + paginas) % paginas;
  return { filas: items.slice(p * FILAS, p * FILAS + FILAS), pagina: p, paginas };
}

export function vistaHabitos(h, dia, pagina = 0) {
  const r = resumenDia(h, dia);
  // En la pantalla, unidades cortas: «30 minutos» → «30 min».
  const corto = (o) => o && o.replace(/\bminutos?\b/i, 'min').replace(/\bhoras?\b/i, 'h').replace(/\bkil[oó]metros?\b/i, 'km');
  const items = h.lista.map((x) => ({
    icono: ICONOS[x.icono] ?? '',
    titulo: recortar(x.titulo, 17),
    detalle: recortar([corto(x.objetivo), x.hora].filter(Boolean).join(' · '), 22),
    hecho: hecho(h, x, dia),
  }));
  return { tipo: 'habitos', titulo: `Hábitos · ${r.hechos}/${r.total} hoy`, vacio: 'Sin hábitos todavía', ...paginar(items, pagina) };
}

export function vistaProgreso(h, dia, modo = 'hoy') {
  const s = resumenSemana(h, dia);
  const r = resumenDia(h, dia);
  const semana = modo === 'semana';
  return {
    tipo: 'progreso',
    modo: semana ? 'semana' : 'hoy',
    pct: semana ? s.pct : r.pct,
    estrella: semana ? s.completos === 7 : r.completo,
    texto: semana ? `${s.completos} ${s.completos === 1 ? 'día completo' : 'días completos'}` : `${r.hechos} de ${r.total} hoy`,
    barras: s.dias.map((d) => d.pct),
    vacio: h.lista.length === 0,
  };
}

export function vistaTareas(ts, hoy, pagina = 0) {
  const manana = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const items = tareasOrdenadas(ts).map((x) => ({
    titulo: recortar(x.titulo, 20),
    cuando: recortar(`${x.dia === hoy ? 'hoy' : x.dia === manana ? 'mañana' : x.dia < hoy ? 'atrasada' : x.dia.slice(5).split('-').reverse().join('/')}${x.hora ? ` ${x.hora}` : ''}`, 12),
    hecha: x.hecha,
    atrasada: !x.hecha && x.dia < hoy,
  }));
  const n = pendientes(ts).length;
  return { tipo: 'tareas', titulo: `Tareas · ${n} ${n === 1 ? 'pendiente' : 'pendientes'}`, vacio: 'Sin tareas', ...paginar(items, pagina) };
}

// Estado de la vista abierta: { tipo, modo?, desde, hasta }. Devuelve la
// página que toca en `now`, o null si ya ha caducado.
export function abrirVista(tipo, now, { modo = 'hoy', dura = DURA_MS } = {}) {
  return { tipo, modo, desde: now, hasta: now + dura };
}

export function paginaEn(v, now) {
  return Math.floor(Math.max(0, now - v.desde) / PAGINA_MS);
}

export function vigente(v, now) {
  return Boolean(v) && now < v.hasta;
}
