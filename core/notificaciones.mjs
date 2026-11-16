// Notificaciones del ordenador: lo que llega (un correo, un mensaje, un
// aviso de un programa) y cómo reacciona Tulo. Pedido por Chief como
// conector el 12-nov.
//
// En el simulador las manda el puente (`POST /api/notificar`), así que
// cualquier programa o script del PC puede avisar a Tulo. Leer las
// notificaciones de las demás apps de Windows es otro paso, sin comprobar.
//
// PROPUESTA, no decisión: durante un bloque de concentración no interrumpe;
// las guarda y te las cuenta al acabar. La reacción depende de la app.
//
// Lógica pura: el tiempo entra como argumento.

export const MAX_LISTA = 20;

// De qué app viene → cara y sonido. Se mira el nombre de la app y el texto.
const REGLAS = [
  { re: /error|fall[oó]|failed|crash|caído|caida/i, cara: 'triste', sonido: 'no', tipo: 'error' },
  { re: /correo|mail|outlook|gmail/i, cara: 'sorpresa', sonido: 'aviso', tipo: 'correo' },
  { re: /whatsapp|telegram|mensaje|slack|discord|teams|signal/i, cara: 'feliz', sonido: 'feliz', tipo: 'mensaje' },
  { re: /calendario|reuni[oó]n|meet|zoom/i, cara: 'sorpresa', sonido: 'aviso', tipo: 'cita' },
];

export function reaccionDe(n) {
  const texto = `${n.app ?? ''} ${n.titulo ?? ''} ${n.texto ?? ''}`;
  return REGLAS.find((r) => r.re.test(texto)) ?? { cara: 'sorpresa', sonido: 'aviso', tipo: 'otra' };
}

export function createBuzon() {
  return { lista: [], guardadas: [], noMolestar: true };
}

// Llega una notificación { app, titulo?, texto }. Devuelve qué hacer:
//   { accion: 'avisar', reaccion }   decírtela ahora
//   { accion: 'guardar' }            estás en un bloque: te la cuenta al acabar
export function recibir(b, n, { enFoco = false, now = 0 } = {}) {
  if (!n || !(n.app || n.texto)) throw new Error('Una notificación necesita app o texto.');
  const nota = { app: String(n.app ?? 'Ordenador').slice(0, 40), titulo: n.titulo ? String(n.titulo).slice(0, 80) : null, texto: String(n.texto ?? '').slice(0, 200), llega: now };
  b.lista.unshift(nota);
  b.lista.length = Math.min(b.lista.length, MAX_LISTA);
  if (enFoco && b.noMolestar) {
    b.guardadas.push(nota);
    return { accion: 'guardar', nota };
  }
  return { accion: 'avisar', nota, reaccion: reaccionDe(nota) };
}

// Al acabar el bloque: las guardadas y una frase que las resume, o null.
export function soltarGuardadas(b) {
  if (!b.guardadas.length) return null;
  const notas = b.guardadas.splice(0);
  const porApp = new Map();
  for (const n of notas) porApp.set(n.app, (porApp.get(n.app) ?? 0) + 1);
  const partes = [...porApp].map(([app, k]) => (k > 1 ? `${app} (${k})` : app));
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
  const frase = notas.length === 1
    ? `Mientras te concentrabas llegó una notificación: ${lista}.`
    : `Mientras te concentrabas llegaron ${notas.length} notificaciones: ${lista}.`;
  return { notas, frase };
}

// Lo que dice Tulo de una notificación.
export function decirNotificacion(n) {
  const cuerpo = [n.titulo, n.texto].filter(Boolean).join(': ');
  return cuerpo ? `${n.app}: ${cuerpo}` : `Te ha llegado algo de ${n.app}.`;
}
