// Colores de skin como DATOS (D-023, D-025). Un color no es un hex suelto sino
// un MATERIAL: la manera de rellenar lo que haya dentro del contorno del ojo,
// sea cual sea la forma. Así formas y colores se combinan sin tocarse: añadir
// una forma de Jacobo no obliga a tocar ningún color, y al revés.
//
// Campos de un color:
//   id, nombre, familia
//   t      tipo de material; sin t, color plano. Cómo se pinta cada tipo está
//          en web/materiales.mjs (aquí no hay lienzo).
//   c      sus colores, de arriba abajo o de fuera adentro según el tipo
//   tinta  el color con que se pintan los extras de la cara (zetas, iconos,
//          listas) cuando lleva este color; si falta, c[0]
//   peso   probabilidad relativa de salir (ver FAMILIAS)
//
// La lista es la propuesta de Claude del 13-nov (nota «Colores de skins —
// propuesta de 30» en el vault); Chief la vio en cuatro maquetas y pidió
// pasarla al simulador. Los pesos y los niveles de rareza son PROPUESTA: D-023
// los deja sin decidir.

// Cuánto sale cada familia en total, en %. Dentro de la familia se reparte a
// partes iguales, salvo los metales, que van en escalera de valor. Con las
// cuatro formas comunes igual de probables, estos pesos dan el reparto que pidió
// Chief (13-nov): comunes = básicos (60 %); raras = degradados, neón y brillo,
// cobre, cromo y fuego (34 %); épicas = titanio, dorado, psicodélico y fumado
// (5,4 %); legendarias = efectos (0,6 %). Bicolor (0,1 %) va aparte, en skins.mjs.
// Desde el 13-nov (tarde) hay una forma legendaria, Mariguano, que sale en 1 de
// cada 1.000 cajas con cualquier color: para que las legendarias sigan siendo el
// 0,6 %, los efectos bajan de 0,6 a 0,5 (Chief, 13-nov; ver skins.mjs).
export const FAMILIAS = {
  'Básico':        { peso: 60 },
  'Degradado':     { peso: 10.2 },
  'Neón y brillo': { peso: 13.2 },
  'Metal':         { peso: 5.9 },
  'Fuego':         { peso: 6.2 },
  'Psicodélico':   { peso: 1.95 },
  'Fumado':        { peso: 1.95 },
  'Efecto':        { peso: 0.5 },
};

const PESO_METAL = { cobre: 2.4, cromo: 2, titanio: 0.9, dorado: 0.6 };

const LISTA = [
  // Básicos: planos, vivos, uno por tono.
  ['cian', 'Cian', 'Básico', null, ['#3fe0ff']],
  ['azul', 'Azul', 'Básico', null, ['#3d7bff']],
  ['indigo', 'Índigo', 'Básico', null, ['#6f5bff']],
  ['violeta', 'Violeta', 'Básico', null, ['#a64dff']],
  ['magenta', 'Magenta', 'Básico', null, ['#ff3fd2']],
  ['rosa', 'Rosa', 'Básico', null, ['#ff7aa8']],
  ['rojo', 'Rojo', 'Básico', null, ['#ff3b3b']],
  ['coral', 'Coral', 'Básico', null, ['#ff7a59']],
  ['naranja', 'Naranja', 'Básico', null, ['#ff9a1f']],
  ['ambar', 'Ámbar', 'Básico', null, ['#ffc21a']],
  ['amarillo', 'Amarillo', 'Básico', null, ['#f5f03a']],
  ['lima', 'Lima', 'Básico', null, ['#a8ff3e']],
  ['verde', 'Verde', 'Básico', null, ['#2eeb6e']],
  ['turquesa', 'Turquesa', 'Básico', null, ['#2ef0c2']],
  ['blanco', 'Blanco', 'Básico', null, ['#f2f4ff']],
  // Degradados.
  ['atardecer', 'Atardecer', 'Degradado', 'grad', ['#ffc21a', '#ff5f7a', '#ff3fd2']],
  ['oceano', 'Océano', 'Degradado', 'grad', ['#7ff6ff', '#3d7bff', '#3b2bd9']],
  ['aurora', 'Aurora', 'Degradado', 'aurora', ['#2eeb6e', '#2ef0c2', '#a64dff']],
  // Neón y brillo: cada uno enciende de una manera.
  ['neonrosa', 'Neón rosa', 'Neón y brillo', 'neon', ['#ff2bd6']],
  ['neonacido', 'Neón ácido', 'Neón y brillo', 'neon', ['#b6ff00']],
  ['tubo', 'Tubo cian', 'Neón y brillo', 'tubo', ['#00eaff']],
  ['uv', 'Luz negra', 'Neón y brillo', 'uv', ['#a64dff']],
  ['falla', 'Neón roto', 'Neón y brillo', 'falla', ['#ff2a3c']],
  ['hielo', 'Hielo', 'Neón y brillo', 'hielo', ['#ffffff', '#9fe8ff']],
  // Metal: reflejo que barre el ojo.
  ['cobre', 'Cobre', 'Metal', 'metal', ['#ffd9bf', '#c4612c', '#f3a776', '#5e220b']],
  ['cromo', 'Cromo', 'Metal', 'metal', ['#ffffff', '#9aa3b5', '#e8ecf5', '#5d6577']],
  ['titanio', 'Titanio', 'Metal', 'metal', ['#f0d77a', '#c46bd6', '#3d6bff', '#26c9d6']],
  ['dorado', 'Dorado', 'Metal', 'metal', ['#fff3b0', '#e0a82e', '#ffe27a', '#9c6a0c']],
  // Efectos animados.
  ['fantasma', 'Fantasma', 'Efecto', 'fantasma', ['#e6f0ff']],
  ['holograma', 'Holograma', 'Efecto', 'holo', ['#c8f7ff']],
  ['matrix', 'Matrix', 'Efecto', 'matrix', ['#2eff6a']],
  ['galaxia', 'Galaxia', 'Efecto', 'galaxia', ['#b48cff']],
  ['lava', 'Lava', 'Efecto', 'lava', ['#ff5a00']],
  ['glitch', 'Glitch', 'Efecto', 'glitch', ['#e8fbff']],
  ['arcoiris', 'Arcoíris', 'Efecto', 'arco', ['#ff5f7a']],
  // Fuego: fondo, exterior, medio y núcleo de la llama.
  ['llama', 'Llama', 'Fuego', 'fuego', ['#c41a00', '#ff4a00', '#ffa000', '#fff3a8']],
  ['fuegoazul', 'Fuego azul', 'Fuego', 'fuego', ['#1430a0', '#1f6bff', '#3fd6ff', '#efffff']],
  ['fenix', 'Fénix', 'Fuego', 'fuego', ['#a8126a', '#ff3f8a', '#ffb300', '#fff6c0']],
  // Psicodélico (trip de setas).
  ['seta', 'Seta mágica', 'Psicodélico', 'seta', ['#ff3fd2']],
  ['caleido', 'Caleidoscopio', 'Psicodélico', 'caleido', ['#ffc21a']],
  ['derretido', 'Derretido', 'Psicodélico', 'derretido', ['#2ef0c2']],
  // Fumado: párpado caído, pupila dilatada y humo.
  ['colocon', 'Colocón', 'Fumado', 'colocon', ['#ff8f8f']],
  ['humo', 'Humo verde', 'Fumado', 'humo', ['#6dff8a']],
  ['nube', 'Nube morada', 'Fumado', 'nube', ['#b07cff']],
];

const TINTA = { tubo: '#00eaff', fuego: null };

// Muestra para la interfaz (CSS): un color o un degradado que lo recuerda.
const ARCO_CSS = 'linear-gradient(90deg, #ff5f5f, #ffd84a, #6be38a, #6bb8ff, #c58bff)';
function cssDe(t, c) {
  if (t === 'arco' || t === 'seta' || t === 'caleido' || t === 'derretido') return ARCO_CSS;
  if (t === 'holo') return 'linear-gradient(135deg, #ffd6f5, #c8f7ff, #d9ffc8, #fff1b8)';
  if (t === 'matrix') return 'linear-gradient(#2eff6a, #021a08)';
  if (t === 'galaxia') return 'radial-gradient(circle at 40% 40%, #ff3fd2, #3a1470 45%, #07031a)';
  if (t === 'lava') return 'linear-gradient(#ffb000, #ff4a00, #d01800)';
  if (t === 'uv') return 'radial-gradient(circle, #a64dff, #12032a)';
  if (t === 'tubo') return 'radial-gradient(circle, #003038 55%, #00eaff 60%)';
  if (t === 'humo') return 'radial-gradient(circle, #6dff8a, #0c2612)';
  if (t === 'nube') return 'radial-gradient(circle, #ff8cdc, #b07cff, #22103a)';
  if (t === 'colocon') return 'radial-gradient(circle, #fff4f2, #ff8a8a)';
  if (t === 'fuego') return `linear-gradient(${c[3]}, ${c[2]}, ${c[1]}, ${c[0]})`;
  if (c.length > 1) return `linear-gradient(${c.join(', ')})`;
  return c[0];
}

const porFamilia = {};
for (const [, , f] of LISTA) porFamilia[f] = (porFamilia[f] ?? 0) + 1;

export const COLORES = LISTA.map(([id, nombre, familia, t, c]) => ({
  id,
  nombre,
  familia,
  t: t ?? null,
  c,
  tinta: (t === 'fuego' ? c[2] : TINTA[t]) ?? c[0],
  css: cssDe(t, c),
  peso: familia === 'Metal' ? PESO_METAL[id] : FAMILIAS[familia].peso / porFamilia[familia],
}));

const PESO_TOTAL = COLORES.reduce((s, x) => s + x.peso, 0);
for (const x of COLORES) x.p = x.peso / PESO_TOTAL; // probabilidad de 0 a 1

export function color(id) {
  const x = COLORES.find((k) => k.id === id);
  if (!x) throw new Error(`Color desconocido: ${id}`);
  return x;
}
