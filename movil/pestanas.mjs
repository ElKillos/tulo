// App del móvil (D-049): cómo se reparten los paneles del simulador en las
// pestañas de la pantalla del teléfono. Lógica pura: entra la lista de títulos
// de la página (h2 y h3 de `.panel`) y sale a qué pestaña va cada grupo.
//
// El cerebro de la app es la página del simulador entera (web/app.mjs), igual
// que en la app de escritorio: aquí solo se decide dónde se ve cada cosa.
// Un panel que no esté en la lista (uno nuevo del simulador) cae en «Más» con
// su propio título: nada se pierde ni hace falta tocar este fichero.

export const PESTANAS = [
  { id: 'tulo', nombre: 'Tulo', icono: '◉' },
  { id: 'habitos', nombre: 'Hábitos', icono: '✓' },
  { id: 'tareas', nombre: 'Tareas', icono: '☰' },
  { id: 'foco', nombre: 'Foco', icono: '◔' },
  { id: 'skins', nombre: 'Skins', icono: '✦' },
  { id: 'mas', nombre: 'Más', icono: '⋯' },
];
export const POR_DEFECTO = 'tulo';
export const RESTO = 'mas';

// `empieza`: principio del título en la página del simulador, sin tildes ni
// mayúsculas. `titulo`: el que se enseña en el móvil (null = no lleva).
// `oculto`: sigue en la página (el cerebro lo usa) pero no se ve.
export const REPARTO = [
  { empieza: 'necesidades', pestana: 'tulo', titulo: 'Cómo está' },
  { empieza: 'sus necesidades son las tuyas', pestana: 'tulo', titulo: 'Cuídate y le cuidas' },
  { empieza: 'acciones', pestana: 'tulo', titulo: 'Hazle algo' },
  { empieza: 'habitos', pestana: 'habitos', titulo: null },
  { empieza: 'tareas', pestana: 'tareas', titulo: null },
  { empieza: 'concentracion', pestana: 'foco', titulo: 'Concentración · así come' },
  { empieza: 'pomodoro', pestana: 'foco', titulo: 'Pomodoro' },
  { empieza: 'misiones', pestana: 'skins', titulo: 'Misiones y cajas' },
  { empieza: 'skins', pestana: 'skins', titulo: 'Tus skins' },
  { empieza: 'mercado', pestana: 'skins', titulo: 'Mercado · simulado' },
  { empieza: 'pantalla y voz', pestana: 'mas', titulo: 'Pantalla y reposo' },
  { empieza: 'mover el llavero', pestana: 'mas', titulo: 'Sensor de movimiento' },
  { empieza: 'donde esta', pestana: 'mas', titulo: 'Stand o llavero · simulado' },
  { empieza: 'conectores', pestana: 'mas', titulo: 'Con el PC' },
  { empieza: 'calendario', pestana: 'mas', titulo: 'Calendario' },
  { empieza: 'notificaciones del pc', pestana: 'mas', titulo: 'Notificaciones del PC' },
  { empieza: 'musica del pc', pestana: 'mas', titulo: 'Música del PC' },
  { empieza: 'aspecto', pestana: 'mas', titulo: 'Aspecto' },
  { empieza: 'para probar', pestana: 'mas', titulo: 'Para probar' },
  { empieza: 'expresiones', pestana: 'mas', titulo: 'Expresiones' },
  { empieza: 'registro', pestana: 'mas', titulo: 'Registro' },
  // El «móvil simulado» del simulador no pinta nada dentro del móvil de verdad.
  { empieza: 'movil', pestana: 'mas', titulo: null, oculto: true },
];

export const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// A qué pestaña va un título de la página.
export function destinoDe(titulo) {
  const t = sinTildes(titulo);
  const r = REPARTO.find((x) => t === x.empieza || t.startsWith(`${x.empieza} `));
  if (r) return { pestana: r.pestana, titulo: r.titulo, oculto: Boolean(r.oculto), conocido: true };
  return { pestana: RESTO, titulo: String(titulo ?? '').trim() || null, oculto: false, conocido: false };
}

// Parte la lista de hijos del panel en grupos. `hijos`: [{ titulo: 'texto' | null, nivel?: 2 | 3 }]
// en el orden de la página (titulo = el texto si el hijo es un h2 o un h3).
// Devuelve [{ desde, hasta, pestana, titulo, oculto }] (hasta sin incluir).
// Lo que haya antes del primer título va a «Más». Un subtítulo (h3) que no está
// en el reparto no corta: se queda con su panel («Tus anuncios» con el mercado).
export function repartir(hijos) {
  const grupos = [];
  let abierto = null;
  hijos.forEach((h, i) => {
    const corta = h.titulo != null && (h.nivel !== 3 || destinoDe(h.titulo).conocido || !abierto);
    if (corta) {
      if (abierto) { abierto.hasta = i; grupos.push(abierto); }
      abierto = { desde: i, hasta: hijos.length, ...destinoDe(h.titulo) };
    } else if (!abierto) {
      abierto = { desde: i, hasta: hijos.length, pestana: RESTO, titulo: null, oculto: false, conocido: false };
    }
  });
  if (abierto) grupos.push(abierto);
  return grupos;
}

export const esPestana = (id) => PESTANAS.some((p) => p.id === id);
