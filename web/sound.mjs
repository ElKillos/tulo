// La voz de Tulo: no habla, hace pitidos (D-010). Cada sonido es una lista
// de notas [frecuencia en Hz, duración en s]. Se sintetizan en el momento,
// sin ficheros de audio.

export const SONIDOS = {
  ok:      [[880, 0.07], [1320, 0.1]],
  feliz:   [[660, 0.06], [880, 0.06], [1175, 0.12]],
  carino:  [[784, 0.08], [988, 0.14]],
  triste:  [[440, 0.12], [330, 0.2]],
  no:      [[311, 0.1], [247, 0.16]],
  escucha: [[1175, 0.06]],
  pide:    [[784, 0.09], [659, 0.14]],
  duda:    [[660, 0.08], [622, 0.08], [698, 0.14]],
  aviso:   [[988, 0.09], [988, 0.09], [1319, 0.16]],
  caja:    [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.07], [1319, 0.2]],
  mareo:   [[700, 0.07], [500, 0.07], [650, 0.07], [450, 0.12]],
  dormir:  [[523, 0.14], [392, 0.22]],
  // Primer encendido (D-035): arranque, cada paso de la ruleta y el estreno,
  // con más notas cuanto más rara es la skin.
  arranque: [[262, 0.09], [392, 0.09], [523, 0.16]],
  tic:      [[1568, 0.025]],
  estreno0: [[659, 0.08], [880, 0.16]],
  estreno1: [[659, 0.07], [880, 0.07], [1175, 0.18]],
  estreno2: [[659, 0.07], [880, 0.07], [1175, 0.07], [1568, 0.2]],
  estreno3: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.07], [1319, 0.07], [1568, 0.26]],
  estreno4: [[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.06], [1319, 0.06], [1568, 0.06], [2093, 0.3]],
};

let contexto = null;
let activo = true;

export function ponerSonido(valor) {
  activo = valor;
}

// `afinacion` multiplica la frecuencia: el mismo pitido, más agudo o más grave.
export function tocar(nombre, afinacion = 1) {
  const notas = SONIDOS[nombre];
  if (!notas) throw new Error(`Sonido desconocido: ${nombre}`);
  if (!activo) return;
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') contexto.resume();
    let t = contexto.currentTime + 0.01;
    for (const [nota, duracion] of notas) {
      const frecuencia = nota * afinacion;
      const osc = contexto.createOscillator();
      const gan = contexto.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frecuencia, t);
      // Sube un poco al final de cada nota: suena a pregunta, más simpático.
      osc.frequency.exponentialRampToValueAtTime(frecuencia * 1.04, t + duracion);
      // Entrada rápida y caída hasta casi cero: ninguna nota acaba en corte seco.
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion + 0.06);
      osc.connect(gan).connect(contexto.destination);
      osc.start(t);
      osc.stop(t + duracion + 0.08);
      t += duracion;
    }
  } catch {
    // Sin audio (navegador sin permiso o sin salida): Tulo sigue en silencio.
  }
}
