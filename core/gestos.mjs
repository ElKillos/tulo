// Lo que Tulo entiende de lo que ve (D-012, nivel 2): gestos de la mano,
// que bebes y que llevas un rato quieto. Lógica pura: recibe puntos y cajas
// ya detectados, nunca imágenes.
//
// Los puntos de la mano son los 21 de MediaPipe, con x e y de 0 a 1:
// 0 muñeca; pulgar 1-4; índice 5-8; corazón 9-12; anular 13-16; meñique 17-20.
// De cada dedo, el segundo punto es el nudillo medio y el cuarto, la punta.

const DEDOS = { indice: [6, 8], corazon: [10, 12], anular: [14, 16], menique: [18, 20] };

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Ancho de la palma: de la base del índice a la del meñique. Sirve de regla
// para medir lo demás sin depender de lo lejos que esté la mano.
const palma = (puntos) => distancia(puntos[5], puntos[17]);

// Un dedo está estirado si su punta queda claramente más lejos de la muñeca
// que su nudillo medio. Vale con la mano en cualquier orientación.
// El pulgar es distinto: recogido se pega a la palma, así que se mira lo lejos
// que queda su punta de la base del meñique.
export function dedosEstirados(puntos) {
  const muneca = puntos[0];
  const dedos = { pulgar: distancia(puntos[4], puntos[17]) > palma(puntos) * 1.4 };
  for (const [nombre, [nudillo, punta]] of Object.entries(DEDOS)) {
    dedos[nombre] = distancia(muneca, puntos[punta]) > distancia(muneca, puntos[nudillo]) * 1.15;
  }
  return dedos;
}

// La peineta: solo el corazón estirado. El pulgar no cuenta, cada uno lo pone
// a su manera.
export function esPeineta(puntos) {
  const d = dedosEstirados(puntos);
  return d.corazon && !d.indice && !d.anular && !d.menique;
}

// Qué gesto es cada combinación de dedos estirados. La clave lleva una letra
// por dedo estirado: P pulgar, I índice, C corazón, A anular, M meñique.
const GESTOS_POR_DEDOS = {
  '': 'puno',
  I: 'uno',
  IC: 'dos',
  ICA: 'tres',
  PIC: 'tres', // el tres con pulgar, índice y corazón
  ICAM: 'cuatro',
  PICAM: 'palma',
  C: 'peineta',
  PC: 'peineta',
  PM: 'shaka', // el saludo surfero
  IM: 'cuernos',
  PIM: 'te-quiero',
  PI: 'pistola',
};

// Cuántos dedos enseña cada gesto de contar.
export const NUMERO_DE_GESTO = { uno: 1, dos: 2, tres: 3, cuatro: 4, palma: 5 };

// De los 21 puntos de la mano al gesto que Tulo conoce, o null.
export function nombrarGesto(puntos) {
  const d = dedosEstirados(puntos);
  const ancho = palma(puntos);
  // OK: pulgar e índice se tocan y los otros tres están estirados.
  if (distancia(puntos[4], puntos[8]) < ancho * 0.35 && d.corazon && d.anular && d.menique) return 'ok';
  const clave = (d.pulgar ? 'P' : '') + (d.indice ? 'I' : '') + (d.corazon ? 'C' : '') + (d.anular ? 'A' : '') + (d.menique ? 'M' : '');
  if (clave === 'P') {
    // Solo el pulgar: arriba o abajo según hacia dónde apunte.
    const sube = puntos[2].y - puntos[4].y;
    if (sube > ancho * 0.5) return 'pulgar-arriba';
    if (sube < -ancho * 0.5) return 'pulgar-abajo';
    return null;
  }
  return GESTOS_POR_DEDOS[clave] ?? null;
}

// --- Gesto sostenido ---------------------------------------------------------
// Un gesto cuenta cuando se ve varias miradas seguidas, y no se repite hasta
// pasado un descanso: así un fotograma suelto no dispara nada. La palma pide
// más, para dar tiempo a ver si en realidad es un saludo.
export const MIRADAS_PARA_GESTO = 5;
export const MIRADAS_PARA_PALMA = 12;
export const DESCANSO_GESTO_MS = 3000;

export function createGestos() {
  return { actual: null, seguidas: 0, ultimo: {} };
}

// Devuelve el nombre del gesto en el momento en que queda confirmado, o null.
export function actualizarGestos(g, gesto, now) {
  if (gesto !== g.actual) {
    g.actual = gesto;
    g.seguidas = 0;
  }
  if (!gesto) return null;
  g.seguidas += 1;
  if (g.seguidas !== (gesto === 'palma' ? MIRADAS_PARA_PALMA : MIRADAS_PARA_GESTO)) return null;
  if (now - (g.ultimo[gesto] ?? -Infinity) < DESCANSO_GESTO_MS) return null;
  g.ultimo[gesto] = now;
  return gesto;
}

// --- Saludo ------------------------------------------------------------------
// Saludar es mover la mano abierta de lado a lado: dos cambios de sentido en
// poco tiempo. Se sigue la punta del corazón, no la muñeca: al saludar la
// muñeca casi no se mueve, son los dedos los que van y vienen.
export const SALUDO_VENTANA_MS = 1800;
export const SALUDO_RECORRIDO = 0.03; // fracción del ancho de la imagen
export const SALUDO_DESCANSO_MS = 3000;
export const SALUDO_HUECO_MS = 400; // perder la mano menos de esto no corta el saludo

export function createSaludo() {
  return { extremo: null, sentido: 0, giros: [], ultimo: -Infinity, ultimaVez: null };
}

// ¿Vale esta mano para saludar? Abierta, con cuatro o cinco dedos estirados.
export function manoAbierta(puntos) {
  const d = dedosEstirados(puntos);
  return d.indice && d.corazon && d.anular && d.menique;
}

// ¿Se está moviendo de lado a lado ahora mismo?
export function saludando(s) {
  return s.sentido !== 0;
}

// `x` es la posición horizontal de la punta del corazón (0 a 1) con la mano
// abierta, o null si no la hay. Devuelve true en el momento en que reconoce
// el saludo.
export function actualizarSaludo(s, x, now) {
  if (x === null) {
    // Con la mano en movimiento el detector la pierde algún fotograma.
    if (s.ultimaVez === null || now - s.ultimaVez > SALUDO_HUECO_MS) {
      s.extremo = null;
      s.sentido = 0;
      s.giros = [];
    }
    return false;
  }
  s.ultimaVez = now;
  if (s.extremo === null) {
    s.extremo = x;
    return false;
  }
  const delta = x - s.extremo;
  const sentido = Math.sign(delta);
  if (s.sentido === 0) {
    if (Math.abs(delta) >= SALUDO_RECORRIDO) {
      s.sentido = sentido;
      s.extremo = x;
    }
    return false;
  }
  if (sentido === s.sentido) {
    s.extremo = x; // sigue en el mismo sentido: el extremo avanza
    return false;
  }
  if (Math.abs(delta) < SALUDO_RECORRIDO) return false;
  // Ha vuelto atrás lo bastante: es un giro.
  s.sentido = sentido;
  s.extremo = x;
  s.giros = s.giros.filter((t) => now - t <= SALUDO_VENTANA_MS);
  s.giros.push(now);
  if (s.giros.length >= 2 && now - s.ultimo >= SALUDO_DESCANSO_MS) {
    s.ultimo = now;
    s.giros = [];
    return true;
  }
  return false;
}

// --- Beber -------------------------------------------------------------------
// Beber, visto desde la cámara, es una mano que se queda un momento a la altura
// de la boca. No distingue un vaso de rascarse la barbilla o de comer.
export const BEBER_SOSTENIDO_MS = 1200;
export const BEBER_DESCANSO_MS = 60000;

// ¿Está la mano junto a la boca? `cara` es la caja de la cara y `puntos` los
// de la mano, todo en las mismas unidades (0 a 1).
export function manoEnLaBoca(cara, puntos) {
  const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
  const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
  const dentroX = cx > cara.x - cara.ancho * 0.3 && cx < cara.x + cara.ancho * 1.3;
  const dentroY = cy > cara.y + cara.alto * 0.45 && cy < cara.y + cara.alto * 1.6;
  return dentroX && dentroY;
}

export function createBebida() {
  return { desde: null, ultimo: -Infinity };
}

// Devuelve true una vez, cuando la mano lleva BEBER_SOSTENIDO_MS en la boca.
export function actualizarBebida(b, enLaBoca, now) {
  if (!enLaBoca) {
    b.desde = null;
    return false;
  }
  if (b.desde === null) b.desde = now;
  if (now - b.desde >= BEBER_SOSTENIDO_MS && now - b.ultimo >= BEBER_DESCANSO_MS) {
    b.ultimo = now;
    return true;
  }
  return false;
}

// --- Quietud = concentración ---------------------------------------------------
// Concentrado, visto desde la cámara, es una cara que lleva mucho tiempo casi
// en el mismo sitio. No distingue trabajar de ver un vídeo.
export const QUIETO_TRAS_MS = 120000; // quieto este tiempo = concentrado
export const QUIETO_MARGEN = 0.35; // cuánto puede moverse, en anchos de cara
export const QUIETO_SIN_CARA_MS = 4000; // perder la cara menos de esto no rompe

export function createQuietud(tras = QUIETO_TRAS_MS) {
  return { tras, ancla: null, desde: null, ultimaCara: null, concentrado: false };
}

// Devuelve eventos:
//   { tipo: 'empieza', desde }   lleva `tras` ms quieto; `desde` es cuándo empezó
//   { tipo: 'acaba', ms }        se ha movido o se ha ido; cuánto ha durado
export function actualizarQuietud(q, cara, now) {
  const eventos = [];
  const romper = () => {
    if (q.concentrado) eventos.push({ tipo: 'acaba', ms: (q.ultimaCara ?? now) - q.desde });
    q.ancla = null;
    q.desde = null;
    q.concentrado = false;
  };
  if (!cara) {
    if (q.ancla && now - q.ultimaCara > QUIETO_SIN_CARA_MS) romper();
    return eventos;
  }
  const centro = { x: cara.x + cara.ancho / 2, y: cara.y + cara.alto / 2 };
  if (q.ancla && distancia(centro, q.ancla) > cara.ancho * QUIETO_MARGEN) romper();
  q.ultimaCara = now;
  if (!q.ancla) {
    q.ancla = centro;
    q.desde = now;
    return eventos;
  }
  if (!q.concentrado && now - q.desde >= q.tras) {
    q.concentrado = true;
    eventos.push({ tipo: 'empieza', desde: q.desde });
  }
  return eventos;
}
