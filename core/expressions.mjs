// Expresiones de Tulo como DATOS, no como código.
// Cada expresión describe los dos ojos sobre una pantalla de 240 x 240 px.
// Quien diseña (Jacobo) puede tocar estos números sin leer el resto del programa.
//
// Parámetros (todos opcionales; lo que falta sale de BASE):
//   w, h     ancho y alto de cada ojo, en píxeles
//   r        radio de las esquinas
//   gap      separación entre los dos ojos
//   dy       desplazamiento vertical (positivo = hacia abajo)
//   gx, gy   hacia dónde mira (desplaza los dos ojos)
//   lidTop   párpado de arriba, de 0 (abierto) a 1 (cerrado)
//   tilt     inclinación del párpado en grados; positivo = ceño (enfado),
//            negativo = cejas caídas (tristeza)
//   cheek    mejilla que sube desde abajo, de 0 a 1 (ojos de sonrisa)
//   asym     diferencia de tamaño entre ojos, de -1 a 1 (mareo, duda)
//   zzz      dibuja las «z» de dormir
//   icono    dibujo pequeño junto a los ojos: 'gota' (sed), 'flecha' (estirarse),
//            'lagrima', 'corazon', 'sudor', 'gafas', 'lengua' o 'interrogacion'
//   winkL, winkR  cierra un ojo (izquierdo o derecho), de 0 a 1: guiño
//   rubor    coloretes bajo los ojos, de 0 a 1
//   bote     los ojos botan arriba y abajo, en píxeles (risa)
//
// Las caras de «riendo» en adelante (13-nov, D-020) amplían las 16 de antes
// hasta 29, por encima de las 21 de Troko. Son propuesta: Jacobo las retoca.

export const BASE = {
  w: 56, h: 72, r: 18, gap: 40, dy: 0, gx: 0, gy: 0,
  lidTop: 0, tilt: 0, cheek: 0, asym: 0, zzz: false, icono: null,
  winkL: 0, winkR: 0, rubor: 0, bote: 0,
};

export const EXPRESSIONS = {
  reposo:   {},
  contento: { cheek: 0.35 },
  feliz:    { cheek: 0.6, h: 66 },
  carino:   { cheek: 0.75, h: 60, dy: 4 },
  escucha:  { w: 58, h: 82, dy: -4 },
  foco:     { lidTop: 0.28, tilt: 7, h: 64, gy: 8 },
  pensando: { lidTop: 0.18, gx: 12, gy: -12 },
  sorpresa: { w: 62, h: 90, r: 26 },
  triste:   { lidTop: 0.38, tilt: -18, dy: 6 },
  enfadado: { lidTop: 0.42, tilt: 20 },
  hambre:   { lidTop: 0.22, tilt: -8, dy: 8, h: 64 },
  sed:      { lidTop: 0.2, tilt: -10, dy: 6, icono: 'gota' },
  estirar:  { w: 50, h: 88, dy: -6, icono: 'flecha' },
  sueno:    { dy: 4 }, // sin párpados a medio cerrar (Chief, 13-nov): los ojos solo bajan un poco
  dormido:  { h: 8, r: 4, dy: 14, zzz: true },
  mareado:  { asym: 0.45, lidTop: 0.1 },
  riendo:      { cheek: 0.85, h: 58, bote: 3 },
  llorando:    { lidTop: 0.35, tilt: -16, dy: 6, icono: 'lagrima' },
  enamorado:   { cheek: 0.5, rubor: 0.8, icono: 'corazon' },
  avergonzado: { lidTop: 0.15, gx: -10, gy: 10, rubor: 1, icono: 'sudor' },
  asustado:    { w: 48, h: 96, r: 22, dy: -4, icono: 'sudor' },
  guino:       { cheek: 0.3, winkR: 1 },
  chulo:       { lidTop: 0.4, icono: 'gafas' },
  relajado:    { lidTop: 0.5, cheek: 0.3, tilt: -4 },
  rico:        { cheek: 0.6, h: 62, icono: 'lengua' },
  beso:        { winkL: 1, winkR: 1, rubor: 0.7, icono: 'corazon' },
  seguro:      { lidTop: 0.3, tilt: 8, cheek: 0.25 },
  tonto:       { asym: 0.3, winkL: 0.6, icono: 'lengua' },
  confuso:     { asym: 0.25, lidTop: 0.12, gx: 8, gy: -6, icono: 'interrogacion' },
};

export function expression(name) {
  const e = EXPRESSIONS[name];
  if (!e) throw new Error(`Expresión desconocida: ${name}`);
  return { ...BASE, ...e };
}

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
