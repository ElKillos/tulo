// Órdenes escritas (más adelante, habladas) -> intención.
// Es un intérprete por reglas, a propósito: cubre lo básico sin gastar en un
// modelo. Lo que no entiende devuelve { tipo: 'desconocida' }, y ese es el
// punto donde se enchufará el modelo de lenguaje.

import { trocear, buscarDuracion, buscarHora } from './tiempo.mjs';

const RE_RECORDAR = /^(recuerdame(lo)?|recordarme|recordatorio|acuerdame)$/;
const RE_AVISAR = /^(temporizador(es)?|cronometro|alarma|avisame|despiertame|cuenta|timer)$/;
// Palabras que no forman parte del nombre de un temporizador.
const RELLENO = new Set(('pon ponme poner ponle un una otro otra el la los las de del para por favor en a al que me y con '
  + 'nombre llamado llamada atras hoy').split(' '));
const RELLENO_DELANTE = new Set('pon ponme poner un una de que para por favor lo y hoy'.split(' '));
const RELLENO_DETRAS = new Set('de que para en a y el la por favor hoy'.split(' '));

function recortar(palabras, delante, detras) {
  let i = 0;
  let j = palabras.length;
  while (i < j && delante.has(palabras[i].norm)) i++;
  while (j > i && detras.has(palabras[j - 1].norm)) j--;
  return palabras.slice(i, j).map((p) => p.orig).join(' ');
}

// Días de la semana como los da Date#getDay (domingo = 0), en singular y plural.
const DIAS = {
  domingo: 0, domingos: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sabados: 6,
};

// «cada día», «todos los días», «a diario», «cada semana», «cada lunes»,
// «todos los martes», «los viernes» (D-020). Devuelve { repite, diaSemana,
// indices } con las palabras que hay que quitar del texto, o null.
function buscarRepeticion(norm) {
  for (let i = 0; i < norm.length; i++) {
    const [p, q = '', r = ''] = norm.slice(i, i + 3);
    const de = (n, repite, diaSemana = null) => ({ repite, diaSemana, indices: Array.from({ length: n }, (_, k) => i + k) });
    if (p === 'a' && q === 'diario') return de(2, 'diario');
    if (p === 'diariamente') return de(1, 'diario');
    if (p === 'cada' && /^dias?$/.test(q)) return de(2, 'diario');
    if (p === 'todos' && q === 'los' && r === 'dias') return de(3, 'diario');
    if (p === 'semanalmente') return de(1, 'semanal');
    if (p === 'cada' && q === 'semana') return de(2, 'semanal');
    if (p === 'todas' && q === 'las' && r === 'semanas') return de(3, 'semanal');
    if (p === 'cada' && q in DIAS) return de(2, 'semanal', DIAS[q]);
    if (p === 'todos' && q === 'los' && r in DIAS) return de(3, 'semanal', DIAS[r]);
    if (p === 'los' && q in DIAS) return de(2, 'semanal', DIAS[q]);
  }
  return null;
}

// Temporizadores («temporizador de la pasta de diez minutos») y recordatorios
// («recuérdame a las seis y media llamar a mamá»). Devuelve null si la frase
// no va de eso.
function avisos(texto) {
  const { orig, norm } = trocear(texto);
  const recordar = norm.some((p) => RE_RECORDAR.test(p));
  if (!recordar && !norm.some((p) => RE_AVISAR.test(p))) return null;

  const hora = buscarHora(norm);
  const dur = buscarDuracion(norm);
  // Si la frase trae una hora y una duración, manda la que se dice antes.
  const cuando = hora && dur ? (hora.inicio < dur.inicio ? hora : dur) : hora ?? dur;
  if (!cuando && !recordar) return null;

  // «mañana» (el día, no «de la mañana») y «esta tarde», «esta noche».
  const fuera = new Set();
  const repeticion = buscarRepeticion(norm);
  for (const k of repeticion?.indices ?? []) fuera.add(k);
  let manana = false;
  let periodo = null;
  norm.forEach((p, i) => {
    if (cuando && i >= cuando.inicio && i < cuando.fin) return fuera.add(i);
    if (RE_RECORDAR.test(p) || RE_AVISAR.test(p)) return fuera.add(i);
    if (p === 'esta' && /^(manana|tarde|noche)$/.test(norm[i + 1] ?? '')) {
      periodo = norm[i + 1];
      fuera.add(i).add(i + 1);
    } else if (p === 'manana' && !fuera.has(i) && norm[i - 1] !== 'la') {
      manana = true;
      fuera.add(i);
    }
  });
  const resto = orig.map((o, i) => ({ orig: o, norm: norm[i] })).filter((_, i) => !fuera.has(i));

  // La repetición solo vale con una hora («cada lunes a las 9»), no con «en 10 minutos».
  const conRepeticion = repeticion && cuando === hora
    ? { repite: repeticion.repite, ...(repeticion.diaSemana !== null ? { diaSemana: repeticion.diaSemana } : {}) }
    : {};
  const aLaHora = () => ({
    hora: { hora: hora.hora, minuto: hora.minuto, ambigua: hora.ambigua },
    manana,
    periodo,
    ...conRepeticion,
  });

  // Alarma (D-020): «alarma a las 7», «despiértame a las 8 y media», «pon una
  // alarma cada día a las 7». Suena hasta que la paras.
  const esAlarma = !recordar && norm.some((p) => /^(alarma|alarmas|despiertame)$/.test(p));
  if (esAlarma && cuando) {
    const etiqueta = recortar(resto, RELLENO, RELLENO);
    return { tipo: 'alarma', etiqueta, ...(cuando === dur ? { segundos: dur.segundos } : aLaHora()) };
  }

  if (cuando === dur && dur && !recordar) {
    const etiqueta = recortar(resto, RELLENO, RELLENO);
    return etiqueta ? { tipo: 'temporizador', segundos: dur.segundos, etiqueta } : { tipo: 'temporizador', segundos: dur.segundos };
  }
  const recordatorio = { tipo: 'recordatorio', texto: recortar(resto, RELLENO_DELANTE, RELLENO_DETRAS) };
  if (!cuando) return { ...recordatorio, falta: 'cuando' };
  if (cuando === dur) return { ...recordatorio, segundos: dur.segundos };
  return { ...recordatorio, ...aLaHora() };
}

export function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// «Tulo, …» al principio: es la palabra de activación, no parte de la orden.
export const RE_NOMBRE = /^\s*(?:oye|hey|ey|eh)?[\s,]*(?:tulo|pacolo)\b[\s,:!.¡]*/i; // «Pacolo» fue su nombre hasta el 13-nov-2026: se sigue entendiendo
export const llamaPacolo = (texto) => RE_NOMBRE.test(texto ?? '');

// Quita del texto original la hora y la duración que trae, y las palabras
// sueltas «mañana», «hoy», «semanal», para quedarse con el nombre de la cosa.
function sinTiempo(textoOriginal) {
  const { orig, norm } = trocear(textoOriginal);
  const hora = buscarHora(norm);
  const fuera = new Set();
  if (hora) for (let i = hora.inicio; i < hora.fin; i++) fuera.add(i);
  norm.forEach((p, i) => {
    if (/^(hoy|semanal|semanalmente)$/.test(p)) fuera.add(i);
    if (p === 'manana' && norm[i - 1] !== 'la') fuera.add(i);
    if (p === 'cada' && norm[i + 1] === 'semana') fuera.add(i).add(i + 1);
  });
  // «para» solo se va si lleva detrás algo de tiempo que también se va («para
  // mañana», «para hoy»). Antes se quitaba siempre y «preparar la presentación
  // para el trabajo» se quedaba en «preparar la presentación el» (15-nov).
  norm.forEach((p, i) => {
    if (p === 'para' && fuera.has(i + 1)) fuera.add(i);
  });
  const resto = orig.filter((_, i) => !fuera.has(i)).join(' ').replace(/\s+/g, ' ').trim();
  return {
    resto: resto.replace(/^(de|del|el|la|un|una)\s+/i, '').replace(/\s+(a|de|para|el|la)$/i, '').trim(),
    hora: hora ? { hora: hora.hora, minuto: hora.minuto, ambigua: hora.ambigua } : null,
    manana: norm.some((p, i) => p === 'manana' && norm[i - 1] !== 'la'),
    semanal: /\b(semanal|semanalmente|cada semana)\b/.test(norm.join(' ')),
  };
}

// «30 minutos», «8 vasos», «2 horas», «10 páginas» dentro de un título.
const RE_OBJETIVO = /\b(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|media)\s+(min|minutos?|horas?|vasos?|paginas?|páginas?|km|kilometros?|kilómetros?|veces|flexiones|pasos)\b/i;

export function interpretar(textoOriginal) {
  textoOriginal = String(textoOriginal ?? '').replace(RE_NOMBRE, '');
  const t = normalizar(textoOriginal ?? '');
  if (!t) return { tipo: 'vacia' };

  // Pomodoro, antes que los avisos: «cuánto queda del pomodoro» va de esto.
  if (/pomodoro/.test(t) && !/recuerda|recordatorio|avisame/.test(t)) {
    if (/\b(para|parar|paralo|deten|detener|cancela|cancelar|quita|acaba|termina|deja)\w*\b/.test(t)) return { tipo: 'pomodoro', accion: 'parar' };
    if (/(como va|cuanto (queda|falta)|cuantos (llevo|van)|en que (va|tanda))/.test(t)) return { tipo: 'pomodoro', accion: 'estado' };
    // Con duración («pomodoro de media hora») es un bloque suelto, como antes.
    const d = buscarDuracion(trocear(textoOriginal).norm);
    if (d) return { tipo: 'foco', segundos: d.segundos };
    return { tipo: 'pomodoro', accion: 'empezar' };
  }

  if (/(que|cuantos|cuales) (temporizadores|recordatorios|avisos|alarmas)|cuanto (queda|falta)|que tengo pendiente/.test(t)) {
    return { tipo: 'avisos' };
  }
  // Cerrar lo que enseña en su pantalla (hábitos, progreso, tareas).
  if (/^(cierra|cerrar|quita|sal de|salir de)( los| las| la| el)? (habitos|lista|tracking|tareas|eso|progreso|pantalla)$/.test(t)) {
    return { tipo: 'cerrar_vista' };
  }
  if (/\b(para|parar|paralo|apaga|apagala|calla|callate|silencia|quita)\w* (la |esa |esta )?alarma\b/.test(t) || /^(ya voy|vale ya|ya estoy despierto|ya me levanto)$/.test(t)) {
    return { tipo: 'parar_alarma' };
  }
  const quitar = t.match(/\b(?:cancela|borra|quita|elimina|anula|para)\w* (?:(todos|todas) )?(?:el |la |los |las |mi |mis )?(?:temporizador|recordatorio|alarma|aviso)(?:es|s)?(?: (?:de|del|para|sobre) (?:el |la |los |las )?(.+))?$/);
  if (quitar) return { tipo: 'cancelar_aviso', todos: Boolean(quitar[1]), cual: quitar[2] ?? '' };
  const aviso = avisos(textoOriginal);
  if (aviso) return aviso;

  // Música del ordenador.
  if (/(que (suena|cancion|musica|tema)|como se llama (esta|la) cancion)/.test(t)) return { tipo: 'musica', accion: 'que_suena' };
  if (/(siguiente|pasa|salta)\w* (de |la |esta )?(cancion|tema)|^siguiente( cancion)?$/.test(t)) return { tipo: 'musica', accion: 'siguiente' };
  if (/(cancion|tema) (anterior|de antes)|(vuelve|pon) (a )?la (cancion )?anterior|^anterior$/.test(t)) return { tipo: 'musica', accion: 'anterior' };
  if (/(pausa|para|paralo|deten|quita|silencia)\w* (la |esta )?(musica|cancion)|^pausa(la)?$/.test(t)) return { tipo: 'musica', accion: 'pausa' };
  if (/(pon|reanuda|sigue con|dale a|vuelve a poner)\w* (la |algo de )?(musica|cancion)|^(play|reanuda|reanudala)$/.test(t)) return { tipo: 'musica', accion: 'play' };

  // Calendario y notificaciones.
  if (/(que tengo|que hay|tengo algo)( hoy| manana| esta tarde| luego)?$|agenda|calendario|(proxima|siguiente) (reunion|cita|clase)|(tengo|hay) (alguna )?(reunion|cita)/.test(t)) {
    if (/(proxima|siguiente)/.test(t)) return { tipo: 'calendario', cual: 'proxima' };
    return { tipo: 'calendario', cual: 'dia', dia: /manana/.test(t) ? 1 : 0 };
  }
  if (/no molest/.test(t)) return { tipo: 'no_molestar', activar: !/(quita|desactiva|apaga|sin)\w* (el |modo )?no molest/.test(t) };
  if (/notificacion/.test(t)) return { tipo: 'notificaciones' };

  if (/(cancela|para|deja) (el |la )?(foco|bloque|pomodoro|concentracion)/.test(t)) return { tipo: 'cancelar_foco' };
  // \b delante: «para estudiar» o «nada estudiar» contienen «a estudiar» y no son órdenes.
  if (/\b(foco|pomodoro|concentracion|concentrarme|a trabajar|a estudiar)\b/.test(t)) {
    const d = buscarDuracion(trocear(textoOriginal).norm);
    if (d) return { tipo: 'foco', segundos: d.segundos };
    // Con una cifra que no se entiende («foco 10 patatas») no se inventa la duración.
    if (!/\d/.test(t)) return { tipo: 'foco', segundos: 25 * 60 };
  }
  if (/abr\w* (una |la |otra )?caja/.test(t)) return { tipo: 'abrir_caja' };

  if (/(he bebido|ya bebi|bebo agua|agua)/.test(t) && !/habito|tarea|movil|recuerda|^(ya )?(he hecho|hice|complete|he completado|he cumplido|marca)\b|desmarca|deshaz|no he hecho|no hice|tengo que|apunta|tacha/.test(t)) return { tipo: 'cuidado', cual: 'agua' };
  if (/(me he (levantado|estirado)|ya me (levante|estire)|estir)/.test(t)) return { tipo: 'cuidado', cual: 'estirar' };

  // --- Móvil (D-020) ---
  const alMovil = t.match(/\b(?:manda|mandame|envia|enviame|pasa|pasame)\w*(?: me)? (.+?) al (?:movil|telefono|celular)\b/)
    ?? t.match(/\b(?:manda|mandame|envia|enviame)\w*(?: me)? al (?:movil|telefono|celular) (.+)$/);
  if (alMovil) {
    const que = alMovil[1];
    if (/tarea/.test(que)) return { tipo: 'al_movil', que: 'tareas' };
    if (/habito/.test(que)) return { tipo: 'al_movil', que: 'habitos' };
    if (/(recordatorio|aviso|alarma|temporizador)/.test(que)) return { tipo: 'al_movil', que: 'avisos' };
    if (/(agenda|calendario|citas|reunion)/.test(que)) return { tipo: 'al_movil', que: 'calendario' };
    if (/(resumen|estado|todo)/.test(que)) return { tipo: 'al_movil', que: 'resumen' };
    return { tipo: 'al_movil', que: 'texto', texto: que.replace(/^(que |esto:? |un mensaje:? )/, '') };
  }

  // --- Hábitos (D-020) ---
  const nuevoHabito = textoOriginal.match(/\b(?:crea|crear|añade|anade|agrega|configura|pon|nuevo)\w*\s+(?:un\s+|el\s+)?(?:nuevo\s+)?h[aá]bito\s*(?:de|para|:)?\s*(.*)$/i);
  if (nuevoHabito) {
    const { resto, hora, semanal } = sinTiempo(nuevoHabito[1]);
    const obj = resto.match(RE_OBJETIVO);
    const titulo = (obj ? resto.replace(new RegExp(`${obj[0]}\\s+de\\b`, 'i'), ' ').replace(obj[0], '') : resto).replace(/\s+/g, ' ').replace(/\s+(a|de|cada)$/i, '').trim();
    if (!titulo) return { tipo: 'habito_nuevo', falta: 'titulo' };
    return { tipo: 'habito_nuevo', titulo, objetivo: obj ? obj[0] : null, hora, periodicidad: semanal ? 'semanal' : 'diario' };
  }
  const borrarHab = t.match(/\b(?:borra|elimina|quita)\w* (?:el )?habito (?:de )?(.+)$/);
  if (borrarHab) return { tipo: 'habito_borrar', cual: borrarHab[1] };
  const deshacer = t.match(/\b(?:desmarca|deshaz|no he hecho|no hice|no complete)\w* (?:el )?(?:habito )?(?:de )?(.+)$/);
  if (deshacer) return { tipo: 'habito_deshacer', cual: deshacer[1] };
  if (/(mis habitos|ver (los )?habitos|lista de habitos|que habitos|ensename (mis )?habitos|cuales son mis habitos)/.test(t)) return { tipo: 'habitos' };
  if (/(como voy|progreso|estadisticas|resumen semanal|tracking)/.test(t)) return { tipo: 'habitos_progreso', semana: /seman/.test(t) };

  // --- Tareas (D-020) ---
  const nuevaTarea = textoOriginal.match(/\b(?:añade|anade|agrega|apunta|crea|nueva|pon)\w*\s+(?:la\s+|una\s+)?(?:nueva\s+)?tarea\s*(?:de|:)?\s*(.*)$/i)
    ?? textoOriginal.match(/^\s*(?:apunta|tengo que)\s+(.+)$/i);
  if (nuevaTarea) {
    let { resto, hora, manana } = sinTiempo(nuevaTarea[1]);
    let categoria = null;
    const cat = resto.match(/\s*(?:de|para el|del|para)\s+(trabajo|estudio|clase|personal)\b|\b(trabajo|estudio|personal)\s*$/i);
    if (cat) {
      const c = (cat[1] ?? cat[2]).toLowerCase();
      categoria = c === 'clase' ? 'estudio' : c;
      resto = resto.replace(cat[0], '').trim();
    }
    if (!resto) return { tipo: 'tarea_nueva', falta: 'titulo' };
    return { tipo: 'tarea_nueva', titulo: resto, hora, manana, categoria };
  }
  const tareaHecha = t.match(/\b(?:he terminado|termine|he hecho|tacha|completa|marca)\w* (?:la )?tarea (?:de )?(.+)$/) ?? t.match(/^tacha (.+)$/);
  if (tareaHecha) return { tipo: 'tarea_hecha', cual: tareaHecha[1] };
  const borrarTar = t.match(/\b(?:borra|elimina|quita)\w* (?:la )?tarea (?:de )?(.+)$/);
  if (borrarTar) return { tipo: 'tarea_borrar', cual: borrarTar[1] };
  if (/(mis tareas|que tareas|lista de tareas|ver (las )?tareas|tareas pendientes)/.test(t)) return { tipo: 'tareas' };

  // «He hecho / hice / completé X»: un hábito o una tarea; lo decide quien los tiene.
  const hechoAlgo = t.match(/^(?:ya )?(?:he hecho|hice|complete|he completado|he cumplido|marca)(?: el| la)?(?: habito| tarea)?(?: de)? (.+)$/);
  if (hechoAlgo) return { tipo: 'hecho', cual: hechoAlgo[1] };

  // --- Aparato (D-020) ---
  if (/(modo reposo|deja de escuchar|no escuches|ponte en reposo|^reposo$)/.test(t)) return { tipo: 'reposo' };
  const brillo = t.match(/brillo(?: al| a| del)? (\d{1,3})/);
  if (brillo) return { tipo: 'brillo', valor: Math.min(100, Number(brillo[1])) };
  if (/(sube|mas|aumenta)\w* (el )?brillo|brillo (mas alto|al maximo)/.test(t)) return { tipo: 'brillo', cambio: /maximo/.test(t) ? 'max' : 'subir' };
  if (/(baja|menos|reduce)\w* (el )?brillo|brillo (mas bajo|al minimo)/.test(t)) return { tipo: 'brillo', cambio: /minimo/.test(t) ? 'min' : 'bajar' };
  if (/(tema|modo|pantalla) (claro|blanco|dia)|modo dia/.test(t)) return { tipo: 'tema', tema: 'claro' };
  if (/(tema|modo|pantalla) (oscuro|negro|noche)|modo noche/.test(t)) return { tipo: 'tema', tema: 'oscuro' };

  // --- Caras (D-020): reírse y el cariño dicho ---
  if (/^(ja|je|ji)+$|jaja|jeje|me parto|que gracioso|que risa/.test(t)) return { tipo: 'risa' };
  if (/(te quiero|te amo|eres (el )?mejor|que mono|que bonito)/.test(t)) return { tipo: 'mimo' };

  if (/(como (va|esta) (el|mi) (ordenador|pc|equipo|portatil)|estado del (equipo|ordenador|pc))/.test(t)) {
    return { tipo: 'estado_equipo' };
  }
  // Preguntas cuya respuesta Tulo ya sabe (13-nov): mejor las reglas con los
  // datos reales que el modelo pequeño leyendo el contexto (medido: acertaba
  // 5 de 18 con el contexto delante).
  if (/(me queda|me falta|tengo) algo (por|que) hacer|que me (queda|falta)( por hacer)?( hoy| manana)?$/.test(t)) {
    return { tipo: 'pendiente', dia: /manana/.test(t) ? 1 : 0 };
  }
  if (/(me he olvidado|me olvido|me falta|me queda)\w* (de )?(algun |algo de |ningun )?habito|que habitos (me faltan|me quedan|tengo sin hacer)|habitos (sin hacer|pendientes)/.test(t)) {
    return { tipo: 'pendiente', dia: 0, solo: 'habitos' };
  }
  const yaHe = t.match(/^(?:ya )?he (\w+(?:ado|ido|ida|ada|to|cho))(?: ya)?(?: hoy)?$/);
  if (yaHe && /\?\s*$/.test(textoOriginal)) return { tipo: 'pregunta_hecho', verbo: yaHe[1] };
  // Sin interrogación es que lo ha hecho: «He leído» marca el hábito de leer.
  if (yaHe && !/^(hecho|dicho)$/.test(yaHe[1])) return { tipo: 'hecho', cual: yaHe[1], verbo: yaHe[1] };
  const siente = t.match(/^(?:tienes|tienes mucha|tienes algo de|estas con) (hambre|sed|sueno|frio|calor)\b|^estas (contento|feliz|triste|cansado|bien|enfadado|aburrido)\b/);
  if (siente) return { tipo: 'como_estas', sobre: siente[1] ?? siente[2] };
  if (/que hora/.test(t) && /alarma|despertador/.test(t)) return { tipo: 'avisos' };
  if (/que hora/.test(t)) return { tipo: 'hora' };
  // \b: «debería dormir» contiene «a dormir». Y una pregunta sobre dormir no le duerme.
  if (/\b(buenas noches|a dormir|duermete|duerme)\b/.test(t) && !/^(cuant|cuando|que |como|por que|a que hora)/.test(t)) {
    return { tipo: 'accion', accion: 'dormir' };
  }
  if (/(buenos dias|despierta)/.test(t)) return { tipo: 'accion', accion: 'despertar' };
  if (/^(hola|buenas|hey|ey)\b/.test(t)) return { tipo: 'saludo' };
  if (/(como estas|que tal)/.test(t)) return { tipo: 'como_estas' };

  return { tipo: 'desconocida', texto: textoOriginal.trim() };
}
