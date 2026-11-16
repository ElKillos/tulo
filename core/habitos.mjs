// Hábitos (D-020, copiado de Troko): cosas que quieres hacer cada día o cada
// semana, con un objetivo («8 vasos», «30 min»), una hora para recordártelo y
// un icono. Se marcan por día y hay progreso del día y de los últimos 7 días.
//
// PROPUESTA, no decisión: que cumplir todos los hábitos de un día dé una caja
// (misión en progress.mjs), que a su hora pregunte si ya lo has hecho, los
// iconos y que un hábito semanal cuente hecho toda la semana desde que lo
// marcas.
//
// Lógica pura: el día entra como texto 'AAAA-MM-DD'.

export const ICONOS = { libro: '📖', ejercicio: '🏃', agua: '💧', corazon: '❤️', estudio: '🎓', otro: '⭐' };

// Del título saca un icono probable.
export function iconoDe(titulo) {
  const t = norm(titulo); // sin tildes: «inglés» = «ingles»
  if (/le(e|er)|libro|lectura/.test(t)) return 'libro';
  if (/corr|gimnasio|ejercicio|andar|camin|flexion|yoga|entren/.test(t)) return 'ejercicio';
  if (/agua|beber|vasos?/.test(t)) return 'agua';
  if (/medit|respir|gracias|llamar a/.test(t)) return 'corazon';
  if (/estudi|ingles|repas|apuntes|idioma/.test(t)) return 'estudio';
  return 'otro';
}

export function createHabitos() {
  return { lista: [], hechos: {}, siguienteId: 1, avisadosHoy: { dia: null, ids: [] } };
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// { titulo, hora?: 'HH:MM', objetivo?, icono?, periodicidad?: 'diario'|'semanal' }
// `creado` ('AAAA-MM-DD'): desde ese día cuenta para el progreso (sin él, desde siempre).
export function crearHabito(h, { titulo, hora = null, objetivo = null, icono = null, periodicidad = 'diario', creado = null }) {
  const t = String(titulo ?? '').trim();
  if (!t) throw new Error('Un hábito necesita nombre.');
  if (hora && !/^\d{2}:\d{2}$/.test(hora)) throw new Error('La hora va como HH:MM.');
  if (!['diario', 'semanal'].includes(periodicidad)) throw new Error(`Periodicidad desconocida: ${periodicidad}`);
  if (h.lista.some((x) => norm(x.titulo) === norm(t))) throw new Error(`Ya tienes el hábito «${t}».`);
  const habito = { id: h.siguienteId++, titulo: t, hora, objetivo, icono: icono ?? iconoDe(t), periodicidad, creado };
  h.lista.push(habito);
  return habito;
}

// Por id o por una palabra del título («leer» encuentra «Leer 30 min»).
export function buscarHabito(h, cual) {
  if (typeof cual === 'number') return h.lista.find((x) => x.id === cual) ?? null;
  const c = norm(String(cual ?? ''));
  if (!c) return null;
  return h.lista.find((x) => norm(x.titulo) === c)
    ?? h.lista.find((x) => norm(x.titulo).includes(c) || c.includes(norm(x.titulo)))
    ?? h.lista.find((x) => c.split(' ').some((p) => p.length > 3 && norm(x.titulo).includes(p)))
    ?? null;
}

const lunesDe = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const sumarDias = (dia, n) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ¿Está hecho ese día? Un semanal cuenta si se marcó cualquier día de su semana
// hasta ese día.
export function hecho(h, habito, dia) {
  if (habito.periodicidad === 'semanal') {
    for (let d = lunesDe(dia); d <= dia; d = sumarDias(d, 1)) if ((h.hechos[d] ?? []).includes(habito.id)) return true;
    return false;
  }
  return (h.hechos[dia] ?? []).includes(habito.id);
}

// Marca o desmarca. Devuelve { habito, hecho, todosHoy } o lanza si no existe.
export function marcarHabito(h, cual, dia, si = true) {
  const habito = buscarHabito(h, cual);
  if (!habito) throw new Error('No encuentro ese hábito.');
  const antes = hecho(h, habito, dia);
  const lista = (h.hechos[dia] ??= []);
  if (si && !lista.includes(habito.id)) lista.push(habito.id);
  if (!si) {
    // Un semanal se desmarca en el día en que se marcó.
    for (let d = habito.periodicidad === 'semanal' ? lunesDe(dia) : dia; d <= dia; d = sumarDias(d, 1)) {
      h.hechos[d] = (h.hechos[d] ?? []).filter((id) => id !== habito.id);
    }
  }
  return { habito, antes, hecho: hecho(h, habito, dia), todosHoy: resumenDia(h, dia).completo };
}

export function borrarHabito(h, cual) {
  const habito = buscarHabito(h, cual);
  if (!habito) throw new Error('No encuentro ese hábito.');
  h.lista = h.lista.filter((x) => x.id !== habito.id);
  for (const d of Object.keys(h.hechos)) h.hechos[d] = h.hechos[d].filter((id) => id !== habito.id);
  return habito;
}

export function resumenDia(h, dia) {
  // Un hábito no cuenta los días de antes de crearlo.
  const vivos = h.lista.filter((x) => !x.creado || x.creado <= dia);
  const total = vivos.length;
  const hechos = vivos.filter((x) => hecho(h, x, dia)).length;
  return { dia, hechos, total, pct: total ? Math.round((hechos / total) * 100) : 0, completo: total > 0 && hechos === total };
}

// Los 7 días que acaban en `dia`, del más antiguo al más reciente, y el % medio.
export function resumenSemana(h, dia) {
  const dias = Array.from({ length: 7 }, (_, k) => resumenDia(h, sumarDias(dia, k - 6)));
  const total = dias.reduce((a, d) => a + d.total, 0);
  const hechos = dias.reduce((a, d) => a + d.hechos, 0);
  return { dias, pct: total ? Math.round((hechos / total) * 100) : 0, completos: dias.filter((d) => d.completo).length };
}

// Hábitos con hora que ya han pasado su hora hoy, sin hacer y sin preguntar
// todavía. `minutoDelDia` = horas × 60 + minutos (lo da quien sabe la hora).
export function habitosQueTocan(h, dia, minutoDelDia) {
  if (h.avisadosHoy.dia !== dia) h.avisadosHoy = { dia, ids: [] };
  const tocan = h.lista.filter((x) => {
    if (!x.hora || hecho(h, x, dia) || h.avisadosHoy.ids.includes(x.id)) return false;
    const [hh, mm] = x.hora.split(':').map(Number);
    return minutoDelDia >= hh * 60 + mm;
  });
  for (const x of tocan) h.avisadosHoy.ids.push(x.id);
  return tocan;
}

export function decirHabito(x) {
  return `${ICONOS[x.icono] ?? ''} ${x.titulo}${x.objetivo ? ` (${x.objetivo})` : ''}${x.hora ? ` · ${x.hora}` : ''}${x.periodicidad === 'semanal' ? ' · semanal' : ''}`.trim();
}
