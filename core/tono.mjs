// El ánimo de Tulo cambia cómo contesta: lo que dice es lo mismo, cambia el
// tono. Lógica pura; las frases son datos que se pueden tocar sin leer el resto.
//
// Tulo no habla (D-010): estas frases salen escritas en el bocadillo.

import { UMBRAL_BAJO } from './pet.mjs';

// De qué humor está para contestar. Las necesidades mandan sobre el ánimo.
export function tonoDe(pet) {
  if (pet.energia < UMBRAL_BAJO || pet.tarde) return 'cansado';
  if (pet.saciedad < UMBRAL_BAJO) return 'hambriento';
  if (pet.animo < 25) return 'triste';
  if (pet.animo > 80) return 'alegre';
  return 'normal';
}

export const TONOS = ['alegre', 'normal', 'triste', 'hambriento', 'cansado'];

// Por cada cosa que dice, las variantes de cada tono. Si un tono no tiene la
// suya, vale la normal.
export const FRASES = {
  saludo: {
    alegre: ['¡Hola, hola!', '¡Hombre, tú por aquí!'],
    normal: ['Hola.'],
    triste: ['Hola…'],
    hambriento: ['Hola. Tengo hambre.'],
    cansado: ['Hola… qué sueño.'],
  },
  // Lo que dice delante de una confirmación («Vale. Te aviso en 5 min.»).
  vale: {
    alegre: ['¡Hecho!', '¡Marchando!'],
    normal: ['Vale.'],
    triste: ['Bueno, vale.'],
    cansado: ['Vale…'],
  },
  foco: {
    alegre: ['¡Vamos allá!'],
    normal: ['Vamos.'],
    triste: ['Venga. A ver si así me animo.'],
    hambriento: ['¡Por fin, comida!'],
    cansado: ['Vamos… poco a poco.'],
  },
  bloque: {
    alegre: ['¡Bloque hecho! Estamos que nos salimos.'],
    normal: ['¡Bloque hecho! Qué rico.'],
    triste: ['Bloque hecho. Ya me siento mejor.'],
    hambriento: ['¡Bloque hecho! Lo necesitaba.'],
    cansado: ['Bloque hecho. Y ahora, a descansar.'],
  },
  desconocida: {
    alegre: ['Eso todavía no sé hacerlo. ¡Pero aprenderé!'],
    normal: ['Todavía no sé hacer eso.'],
    triste: ['No sé hacer eso. Lo siento.'],
    cansado: ['Eso no sé… y con este sueño, menos.'],
  },
  como_estas: {
    alegre: ['Muy bien.', '¡De maravilla!'],
    normal: ['Bien.'],
    triste: ['Regular.'],
    hambriento: ['Tengo hambre. Un bloque de concentración me vendría bien.'],
    cansado: ['Tengo sueño.'],
  },
};

export function frase(clave, tono, azar = Math.random) {
  const variantes = FRASES[clave];
  if (!variantes) throw new Error(`Frase desconocida: ${clave}`);
  const lista = variantes[tono] ?? variantes.normal;
  return lista[Math.min(lista.length - 1, Math.floor(azar() * lista.length))];
}

// El pitido de confirmación también cambia: más agudo contento, más grave
// triste o cansado. Es el factor por el que se multiplica la frecuencia.
export function afinacion(tono) {
  if (tono === 'alegre') return 1.12;
  if (tono === 'triste' || tono === 'cansado') return 0.84;
  return 1;
}
