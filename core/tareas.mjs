// Lista de tareas (D-020, copiado de Troko): con día, hora opcional y
// categoría (Trabajo, Estudio, Personal). Una tarea con hora crea también su
// recordatorio (eso lo hace quien llama, con ponerRecordatorio).
//
// PROPUESTA, no decisión: sin hora queda en la lista sin aviso (Troko te
// pregunta la hora antes de guardarla); las hechas se quedan tachadas hasta
// que las borras.
//
// Lógica pura: el día entra como texto 'AAAA-MM-DD'.

export const CATEGORIAS = ['trabajo', 'estudio', 'personal'];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function createTareas() {
  return { lista: [], siguienteId: 1 };
}

// { titulo, dia: 'AAAA-MM-DD', hora?: 'HH:MM', categoria? }
export function anadirTarea(ts, { titulo, dia, hora = null, categoria = null }) {
  const t = String(titulo ?? '').trim();
  if (!t) throw new Error('Una tarea necesita título.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? '')) throw new Error('El día va como AAAA-MM-DD.');
  if (hora && !/^\d{2}:\d{2}$/.test(hora)) throw new Error('La hora va como HH:MM.');
  if (categoria && !CATEGORIAS.includes(categoria)) throw new Error(`Categoría desconocida: ${categoria}`);
  const tarea = { id: ts.siguienteId++, titulo: t, dia, hora, categoria: categoria ?? categoriaDe(t), hecha: false, recordatorio: null };
  ts.lista.push(tarea);
  return tarea;
}

// La tarea pendiente con el mismo título (sin mayúsculas, tildes ni signos), o
// null. Quien añade la mira antes: decir dos veces «tengo que comprar pan» no
// apunta dos tareas, y el plan del día no reparte la misma dos veces (14-nov).
export function tareaIgual(ts, titulo) {
  const clave = (x) => norm(String(x ?? '')).replace(/[^a-z0-9]+/g, ' ').trim();
  const t = clave(titulo);
  if (!t) return null;
  return ts.lista.find((x) => !x.hecha && clave(x.titulo) === t) ?? null;
}

// Del título saca una categoría probable, o null.
export function categoriaDe(titulo) {
  const t = norm(titulo);
  if (/reunion|cliente|informe|correo|presupuesto|factura|trabajo|oficina/.test(t)) return 'trabajo';
  if (/estudi|examen|clase|apuntes|practica|entrega|repasar|tfg/.test(t)) return 'estudio';
  if (/compra|medico|mama|papa|cumple|casa|ropa|banco|gimnasio|cena/.test(t)) return 'personal';
  return null;
}

export function buscarTarea(ts, cual) {
  if (typeof cual === 'number') return ts.lista.find((x) => x.id === cual) ?? null;
  const c = norm(String(cual ?? ''));
  if (!c) return null;
  const vivas = [...ts.lista.filter((x) => !x.hecha), ...ts.lista.filter((x) => x.hecha)];
  return vivas.find((x) => norm(x.titulo) === c)
    ?? vivas.find((x) => norm(x.titulo).includes(c) || c.includes(norm(x.titulo)))
    ?? vivas.find((x) => c.split(' ').some((p) => p.length > 3 && norm(x.titulo).includes(p)))
    ?? null;
}

export function completarTarea(ts, cual, si = true) {
  const t = buscarTarea(ts, cual);
  if (!t) throw new Error('No encuentro esa tarea.');
  t.hecha = si;
  return t;
}

export function borrarTarea(ts, cual) {
  const t = buscarTarea(ts, cual);
  if (!t) throw new Error('No encuentro esa tarea.');
  ts.lista = ts.lista.filter((x) => x.id !== t.id);
  return t;
}

// Pendientes primero (por día y hora), luego las hechas.
export function tareasOrdenadas(ts) {
  const clave = (x) => `${x.hecha ? 1 : 0}${x.dia}${x.hora ?? '99:99'}`;
  return [...ts.lista].sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : a.id - b.id));
}

export function pendientes(ts, hastaDia = null) {
  return tareasOrdenadas(ts).filter((x) => !x.hecha && (!hastaDia || x.dia <= hastaDia));
}

function diaSiguiente(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function decirTarea(x, hoy) {
  const cuando = x.dia === hoy ? 'hoy' : x.dia === diaSiguiente(hoy) ? 'mañana' : x.dia < hoy ? `atrasada (${x.dia})` : x.dia;
  return `${x.titulo} · ${cuando}${x.hora ? ` ${x.hora}` : ''}${x.categoria ? ` · ${x.categoria}` : ''}`;
}
