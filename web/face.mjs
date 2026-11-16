// Dibuja la cara de Tulo en el lienzo de la pantalla del aparato: la AMOLED
// redonda de 466 × 466 (D-029, core/pantalla.mjs). Pasa de una expresión a
// otra con suavidad, parpadea y mueve un poco la mirada cuando está quieto. La
// skin decide cómo se pintan los ojos; la expresión, su forma.
//
// Los ojos y sus extras se diseñaron en 240 × 240 (core/expressions.mjs): se
// pintan con esas coordenadas, escalados ×K y centrados, como el firmware. Las
// vistas a pantalla completa (hábitos, tareas, progreso) se colocan en px de
// la pantalla, dentro de lo que deja ver la carcasa (norma de Chief: nada
// detrás de la carcasa).

import { BASE, expression } from '../core/expressions.mjs';
import { pintarOjo, margenDe } from './materiales.mjs';
import * as P from '../core/pantalla.mjs';

const LADO = P.CARA; // las coordenadas de los ojos: la cara de 240
const NUMERICOS = Object.keys(BASE).filter((k) => typeof BASE[k] === 'number');

// Lo que le hace parecer vivo cuando no pasa nada (Chief, 13-nov: «que pestañee
// cada x tiempo, que mire un poco alrededor y que los ojos respiren»). Todos
// los valores son de partida: se ajustan viéndolo.
export const VIDA = {
  parpadeoMin: 2200,   // ms entre parpadeos, como poco…
  parpadeoMax: 5600,   // …y como mucho
  parpadeoDura: 170,   // ms que tarda en cerrar y abrir
  parpadeoDoble: 0.18, // parte de las veces que parpadea dos veces seguidas
  mira: 0.7,           // tranquilo: parte de las veces que echa una ojeada
  miraPoco: 0.35,      // con otra cara: se le va la vista menos y más cerca
};
export const RESPIRA = {
  periodo: 3800,        // ms de una respiración despierto
  periodoDormido: 5400, // dormido respira más despacio…
  dormido: 1.6,         // …y más hondo
  alto: 0.035,          // cuánto crece el ojo a lo alto al coger aire (3,5 %)
  ancho: 0.012,         // y cuánto se estrecha
  sube: 1.4,            // px que sube
};
const QUIETAS = new Set(['reposo', 'contento', 'relajado']);

export function createFace(canvas, piel) {
  const ctx = canvas.getContext('2d');
  const actual = { ...BASE };
  let objetivo = { ...BASE };
  let nombre = 'reposo';
  let skin = { color: '#7fe3ff' };
  let ultimo = null;
  let parpadeoDesde = -1;
  let proximoParpadeo = 1500;
  let mirada = { x: 0, y: 0 };
  let miradaObjetivo = { x: 0, y: 0 };
  let proximaMirada = 2500;

  function setExpression(n) {
    if (n === nombre) return;
    nombre = n;
    objetivo = expression(n);
  }

  function setSkin(s) {
    skin = s;
  }

  // Tema de la pantalla (D-020): 'oscuro' usa el color de pantalla elegido;
  // 'claro', un fondo claro con los ojos oscurecidos para que se lean.
  let tema = 'oscuro';
  const CLARO = '#eceee4';
  function fondo() {
    return tema === 'claro' ? CLARO : piel.pantalla;
  }
  function setTema(t) {
    tema = t === 'claro' ? 'claro' : 'oscuro';
  }
  // En el tema claro, el color de los ojos se oscurece.
  function col(c) {
    if (tema !== 'claro' || !c) return c;
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) {
      const n = parseInt(m[1], 16);
      const f = (v) => Math.round(v * 0.45);
      return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
    }
    return c.replace(/(\d+)%\)$/, '34%)');
  }

  // Vista a pantalla completa (hábitos, progreso, tareas) o null: mientras
  // hay una, se pinta en lugar de los ojos. La prepara core/vistas.mjs.
  let vista = null;
  function setVista(v) {
    vista = v;
  }

  // Inclinación del llavero (D-043, D-044; core/inclina.mjs): `giro` en rad
  // (la cara gira eso, en el sentido de las agujas del reloj si es positivo) y
  // la mirada por inclinación `mx`, `my` en px del aparato (pantalla de 466).
  let incl = { giro: 0, mx: 0, my: 0 };
  function setInclinacion(i) {
    incl = i ? { giro: i.giro || 0, mx: i.mx || 0, my: i.my || 0 } : { giro: 0, mx: 0, my: 0 };
  }
  // Con la cara girada, lo que se ve alrededor gira con ella: se coloca dentro
  // del círculo que se ve siempre (core/pantalla.mjs). Inclinado (mirando por la
  // inclinación), también: en la estrella, una caja ancha solo cabe entera en
  // una franja estrecha y encoger con esa cuenta dejaba la cara a la mitad
  // (13-nov). Recto y sin inclinar, la estrella, como siempre.
  const CIRCULO = { tramo: P.tramoCirculo, techo: P.techoCirculo, suelo: P.sueloCirculo };
  const ventana = () => (Math.abs(incl.giro) > 0.005 || Math.hypot(incl.mx, incl.my) > 1 ? CIRCULO : P);

  // Mirada mandada desde fuera (la cámara). Con null vuelve a mirar por su cuenta.
  let miradaExterna = null;
  function setMirada(m) {
    miradaExterna = m;
  }

  // Algo que pasa por la pantalla y le distrae: { cual, x, y, p } con x e y de
  // 0 a 1, o null. Mientras está, los ojos lo siguen (manda sobre la cámara).
  let distraccion = null;
  function setDistraccion(d) {
    distraccion = d;
  }

  function pintarDistraccion(t, tinta) {
    const x = distraccion.x * LADO;
    const y = distraccion.y * LADO;
    ctx.save();
    if (distraccion.cual === 'pelota') {
      const R = 11;
      // Un cerco del color de la pantalla la separa del ojo cuando pasa por delante.
      ctx.fillStyle = fondo();
      ctx.beginPath();
      ctx.arc(x, y, R + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tinta;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(x - R * 0.35, y - R * 0.35, R * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mosca: un cuerpo pequeño y dos alas que vibran.
      const aleteo = Math.sin(t / 18) > 0 ? 1 : 0.45;
      ctx.fillStyle = fondo();
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tinta;
      ctx.globalAlpha = 0.45;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + lado * 6, y - 5, 6.5 * aleteo, 3.5, lado * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Dónde cae cada ojo y de qué tamaño, en unidades de la cara de 240.
  function geo(lado, a, cierreComun, t, resp = 0) {
    // Guiño (D-020): cada ojo puede cerrarse por su cuenta.
    const cierre = Math.max(cierreComun, lado < 0 ? a.winkL : a.winkR);
    const escala = 1 - lado * a.asym;
    // `resp` va de -1 a 1 (ver respiracion): al coger aire el ojo crece un poco
    // a lo alto, se estrecha apenas y sube.
    const w = a.w * (1 + (escala - 1) * 0.5) * (skin.sw ?? 1) * (1 - resp * RESPIRA.ancho);
    const h = Math.max(6, a.h * escala * (skin.sh ?? 1) * (1 - 0.92 * cierre) * (1 + resp * RESPIRA.alto));
    const cx = LADO / 2 + lado * (a.gap / 2 + a.w / 2) + a.gx + mirada.x;
    const cy = LADO / 2 + a.dy + a.gy + mirada.y - Math.abs(Math.sin(t / 110)) * a.bote - resp * RESPIRA.sube;
    return { cierre, w, h, cx, cy };
  }

  // Nada detrás de la carcasa (norma de Chief): si un ojo se saldría de la
  // ventana (una forma ancha mirando a un lado, unos ojos muy altos…), los dos
  // se corren lo justo hacia dentro. Devuelve el corrimiento que haría falta
  // ahora; frame() lo suaviza en `ajuste`.
  const HOLGURA = 6; // unidades de la cara entre el ojo y el borde de la ventana (con 4, el resplandor del fuego asomaba 1-2 px)
  function corrimiento(a, cierre, t, resp) {
    let izq = 0; let der = 0; let arriba = 0; let abajo = 0;
    let x0 = Infinity, x1 = -Infinity, y0t = Infinity, y1t = -Infinity; // caja de los dos ojos
    // Lo que se ve: a la izquierda, en las filas del ojo izquierdo; a la derecha,
    // en las del derecho; arriba y abajo, en las columnas de cada ojo.
    let bordeIzq = -Infinity, bordeDer = Infinity, bordeArr = -Infinity, bordeAba = Infinity;
    const V = ventana();
    for (const lado of [-1, 1]) {
      const g = geo(lado, a, cierre, t, resp);
      // Las gafas miden el ojo de la expresión (a.w) + 8 por lado, sea cual sea la
      // forma (con el Palito, estrecho, son más anchas que el ojo), más su borde.
      if (objetivo.icono === 'gafas') g.w = Math.max(g.w, a.w) + 22;
      const y0 = g.cy - g.h / 2;
      const y1 = g.cy + g.h / 2 + (a.rubor > 0.01 ? 19 : 0); // con coloretes, también ellos
      const [ta, tb] = V.tramo(P.aPantalla(y0), P.aPantalla(y1));
      izq = Math.max(izq, P.aCara(ta) + HOLGURA - (g.cx - g.w / 2));
      der = Math.max(der, (g.cx + g.w / 2) - (P.aCara(tb) - HOLGURA));
      const xa = P.aPantalla(g.cx - g.w / 2); const xb = P.aPantalla(g.cx + g.w / 2);
      const techo = P.aCara(V.techo(xa, xb)), suelo = P.aCara(V.suelo(xa, xb));
      arriba = Math.max(arriba, techo + HOLGURA - y0);
      abajo = Math.max(abajo, y1 - (suelo - HOLGURA));
      x0 = Math.min(x0, g.cx - g.w / 2); x1 = Math.max(x1, g.cx + g.w / 2);
      y0t = Math.min(y0t, y0); y1t = Math.max(y1t, y1);
      if (lado < 0) bordeIzq = P.aCara(ta); else bordeDer = P.aCara(tb);
      bordeArr = Math.max(bordeArr, techo); bordeAba = Math.min(bordeAba, suelo);
    }
    // Si sobresale por los dos lados, se centra en lo que se ve (antes se quedaba
    // donde estuviera y un vistazo a un lado sacaba las gafas de «chulo»).
    let dx = izq > 0 && der > 0 ? (bordeIzq + bordeDer) / 2 - (x0 + x1) / 2 : izq > 0 ? izq : der > 0 ? -der : 0;
    let dy = arriba > 0 && abajo > 0 ? (bordeArr + bordeAba) / 2 - (y0t + y1t) / 2 : arriba > 0 ? arriba : abajo > 0 ? -abajo : 0;
    // Si no cabe ni corriéndola (las gafas de «chulo», el Mariguano mirando a un
    // lado con la cara girada, los coloretes mirando abajo…), la cara se encoge
    // lo justo y se centra en lo que se ve. «No cabe» = después de correrla aún
    // sobresale por algún lado (corridos para meter un ojo, el otro se salía por
    // el contrario). Solo en el círculo (cara girada o inclinada): recto, en la
    // estrella, solo se corre, como antes.
    // En un círculo la cuenta es exacta: se centran los dos ojos y se encoge lo
    // justo para que las esquinas de su caja queden dentro del radio. (Con el
    // ancho del círculo en las filas de cada ojo, cerca del borde casi cero, el
    // Mariguano girado e inclinado se encogía hasta desaparecer: medido 13-nov.)
    let s = 1;
    const M = LADO / 2;
    const sigueFuera = izq - dx > 0.01 || der + dx > 0.01 || arriba - dy > 0.01 || abajo + dy > 0.01;
    if (V === CIRCULO && sigueFuera) {
      const R = P.R_CIRCULO / P.K - HOLGURA;
      const esquina = Math.hypot((x1 - x0) / 2, (y1t - y0t) / 2);
      s = Math.min(1, R / esquina);
      dx = M - (x0 + x1) / 2;
      dy = M - (y0t + y1t) / 2;
    }
    return { x: dx, y: dy, s };
  }
  let ajuste = { x: 0, y: 0, s: 1 };

  // D-043: con la cara girada, lo de alrededor de los ojos (zetas, gotas,
  // flechas, corazón, coloretes…) va donde la estrella deja ver sin girar; si
  // no cabe en el círculo que se ve siempre, se acerca al centro lo justo.
  // Devuelve el centro (x, y) donde pintarlo; sin girar, el mismo.
  function dentro(x, y, r) {
    if (ventana() !== CIRCULO) return [x, y];
    const R = P.R_CIRCULO / P.K - HOLGURA;
    const dx = x - LADO / 2, dy = y - LADO / 2;
    const d = Math.hypot(dx, dy);
    if (d + r <= R || d < 1e-6) return [x, y];
    const f = Math.max(0, R - r) / d;
    return [LADO / 2 + dx * f, LADO / 2 + dy * f];
  }

  function ojo(lado, a, cierreComun, t, resp = 0) {
    const g0 = geo(lado, a, cierreComun, t, resp);
    const { w, h } = g0;
    const cx = g0.cx + ajuste.x;
    const cy = g0.cy + ajuste.y;
    const r = skin.redondo ? Math.min(w, h) / 2 : Math.min(a.r, w / 2, h / 2);

    // El color de cada ojo es un material (D-023, D-025): web/materiales.mjs
    // lo pinta dentro del contorno. Lo que sobresale (llamas, humo, halo) cabe
    // en un recorte más grande, que no llega a medio camino del otro ojo.
    const mat = (lado < 0 ? skin.izq : skin.der) ?? { t: null, c: [skin.color ?? '#7fe3ff'] };
    const m = margenDe(mat);
    const u = Math.max(w, a.h * (skin.sh ?? 1) * 0.78); // un ojo estrecho no recorta sus llamas
    const lados = Math.min(u * m.lados, a.gap / 2);
    // Cuánto sitio queda encima del ojo antes de la carcasa (en unidades de la
    // cara): lo que sube del ojo (chispas y llamas) no pasa de ahí.
    const techo = (cy - h / 2) - P.aCara(ventana().techo(P.aPantalla(cx - w / 2 - 6), P.aPantalla(cx + w / 2 + 6)));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.rect(-w / 2 - lados, -h / 2 - u * m.arriba, w + lados * 2, h + u * (m.arriba + m.abajo));
    ctx.clip();
    if (tema === 'claro') ctx.filter = 'brightness(0.5)';
    pintarOjo(ctx, mat, { x: -w / 2, y: -h / 2, w, h, r, trazo: skin.trazo }, t, {
      lado,
      pupila: skin.pupila && h > 18 ? skin.pupila : null,
      px: mirada.x * 0.3,
      py: mirada.y * 0.3,
      destello: skin.destello,
      fondo: fondo(),
      techo,
    });
    ctx.restore();

    // Los párpados son formas del color del fondo; el recorte evita que
    // tapen el otro ojo.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.rect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    ctx.clip();
    ctx.fillStyle = fondo();
    if (a.lidTop > 0.01) {
      ctx.save();
      ctx.rotate((-lado * a.tilt * Math.PI) / 180);
      ctx.fillRect(-w * 1.5, -h * 2, w * 3, h * 2 - h / 2 + a.lidTop * h);
      ctx.restore();
    }
    if (a.cheek > 0.01) {
      const R = w * 0.9;
      ctx.beginPath();
      ctx.arc(0, h / 2 + R - a.cheek * h * 0.75, R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Coloretes e iconos de las caras nuevas (D-020).
  function corazon(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.5);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.fill();
  }
  function gota(x, y, alto, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + alto * 0.4, y + alto * 0.6, x + alto * 0.35, y + alto, x, y + alto);
    ctx.bezierCurveTo(x - alto * 0.35, y + alto, x - alto * 0.4, y + alto * 0.6, x, y);
    ctx.fill();
  }
  function pintarExtras(a, t, tinta) {
    const centroX = (lado) => LADO / 2 + lado * (a.gap / 2 + a.w / 2) + a.gx + mirada.x + ajuste.x;
    const baseY = LADO / 2 + a.dy + a.gy + mirada.y + a.h / 2 + ajuste.y;
    if (a.rubor > 0.01) {
      // Más opaco en el tema oscuro: sobre negro, el rosa flojo se ve marrón.
      ctx.fillStyle = `rgba(255, 120, 150, ${(tema === 'claro' ? 0.55 : 0.85) * a.rubor})`;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        const [rx, ry] = dentro(centroX(lado), baseY + 12, 17);
        ctx.ellipse(rx, ry, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const icono = objetivo.icono;
    // Lágrimas, corazón, sudor e interrogación, dentro de lo que deja ver la
    // ventana de la carcasa en la pantalla redonda (antes, en la cara cuadrada
    // de 240, iban más hacia las esquinas).
    if (icono === 'lagrima') {
      for (const [lado, desfase] of [[-1, 0], [1, 0.5]]) {
        const f = ((t / 700) + desfase) % 1;
        ctx.globalAlpha = 1 - f;
        const x = centroX(lado) + lado * 6;
        // La gota (18 de alto, ~8 de ancho) no baja más allá de la carcasa.
        const fondoVentana = P.aCara(ventana().suelo(P.aPantalla(x - 6), P.aPantalla(x + 6))) - 18 - HOLGURA;
        gota(x, Math.min(baseY - 6 + f * 18, fondoVentana), 18, '#6bb8ff');
      }
      ctx.globalAlpha = 1;
    }
    if (icono === 'corazon') {
      const f = (t / 1600) % 1;
      ctx.fillStyle = '#ff6b9a';
      ctx.globalAlpha = 1 - f;
      corazon(...dentro(180, 84 - f * 20, 13), 9);
      ctx.globalAlpha = 1;
    }
    if (icono === 'sudor') {
      const [sx, sy] = dentro(64, 70 + Math.sin(t / 400) * 2, 11); // centro de la gota de 16
      gota(sx, sy - 8, 16, '#8fd0ff');
    }
    if (icono === 'gafas') {
      const y = LADO / 2 + a.dy + a.gy + mirada.y + ajuste.y - a.h * 0.2; // con los ojos (antes no bajaba ni subía con la mirada)
      const alto = a.h * 0.55;
      // En el tema oscuro, cristales grises con borde del color de los ojos.
      ctx.fillStyle = tema === 'claro' ? '#0b0b0d' : '#2b2e36';
      ctx.strokeStyle = tinta;
      ctx.lineWidth = 2;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(centroX(lado) - a.w / 2 - 8, y, a.w + 16, alto, 10);
        ctx.fill();
        if (tema !== 'claro') ctx.stroke();
      }
      ctx.fillStyle = tema === 'claro' ? '#0b0b0d' : tinta;
      ctx.fillRect(centroX(-1) + a.w / 2 + 6, y + 6, a.gap - 12, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (const lado of [-1, 1]) ctx.fillRect(centroX(lado) - a.w / 2 + 2, y + 6, 10, 4);
    }
    if (icono === 'lengua') {
      ctx.fillStyle = '#ff7b93';
      ctx.beginPath();
      ctx.ellipse(LADO / 2 + a.gx, baseY + 22, 11, 8, 0, 0, Math.PI);
      ctx.fill();
    }
    if (icono === 'interrogacion') {
      ctx.fillStyle = tinta;
      ctx.font = 'bold 30px ui-monospace, Consolas, monospace';
      const [qx, qy] = dentro(186, 73 + Math.sin(t / 500) * 3, 17); // centro del «?»
      ctx.fillText('?', qx - 8, qy + 11);
    }
  }

  // --- Vistas a pantalla completa (D-020) ---
  // En px de la pantalla de 466, no en los de la cara de 240: cada línea se
  // coloca con lo que deja ver la carcasa a esa altura (P.tramo), nunca con
  // coordenadas fijas, y la letra encoge si no cabe. Las alturas son
  // propuesta (Jacobo diseña las vistas).
  const LETRA = 'system-ui, "Segoe UI", sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const MARGEN = 10; // px libres hasta el borde de la ventana
  const VISTA = {
    titulo: 128, raya: 147,        // cabecera
    fila0: 172, fila: 38,          // listas: centro de la primera fila y paso
    puntos: 362,                   // puntos de página
    anillo: { y: 206, r: 76, grueso: 20 },
    texto: 306, pestanas: 336,     // progreso
  };

  // Escribe `s` centrado en (cx, y) o desde x (con alinear 'left'); si no cabe
  // en lo que se ve a esa altura, la letra encoge hasta `min` px.
  function linea(s, y, px, { peso = '', alinear = 'center', x = null, min = 11 } = {}) {
    const [a, b] = P.tramo(y - px * 0.6, y + px * 0.6);
    const izq = (x ?? a) ;
    const cabe = alinear === 'center' ? b - a - 2 * MARGEN : b - MARGEN - izq;
    let tam = px;
    ctx.font = `${peso} ${tam}px ${LETRA}`;
    const ancho = ctx.measureText(s).width;
    if (ancho > cabe) {
      tam = Math.max(min, Math.floor((px * cabe) / ancho));
      ctx.font = `${peso} ${tam}px ${LETRA}`;
    }
    ctx.textAlign = alinear;
    ctx.textBaseline = 'middle';
    ctx.fillText(s, alinear === 'center' ? (a + b) / 2 : izq, y, Math.max(1, cabe));
    return ctx.measureText(s).width;
  }

  function cabecera(texto, tinta) {
    ctx.fillStyle = tinta;
    linea(texto, VISTA.titulo, 23, { peso: 600 });
    const [a, b] = P.tramo(VISTA.raya - 2, VISTA.raya + 2);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(a + MARGEN + 6, VISTA.raya, b - a - 2 * (MARGEN + 6), 2);
    ctx.globalAlpha = 1;
  }

  function puntosDePagina(v, tinta) {
    if (v.paginas <= 1) return;
    ctx.fillStyle = tinta;
    for (let i = 0; i < v.paginas; i++) {
      ctx.globalAlpha = i === v.pagina ? 1 : 0.3;
      ctx.beginPath();
      ctx.arc(P.C + (i - (v.paginas - 1) / 2) * 18, VISTA.puntos, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function casilla(x, y, marcada, redonda, tinta) {
    const r = 12;
    ctx.strokeStyle = tinta;
    ctx.fillStyle = tinta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (redonda) ctx.arc(x, y, r, 0, Math.PI * 2);
    else ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 6);
    if (marcada) ctx.fill();
    else ctx.stroke();
    if (marcada) {
      ctx.strokeStyle = fondo();
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 1.5, y + 5);
      ctx.lineTo(x + 6.5, y - 5);
      ctx.stroke();
    }
  }

  function vacio(texto, tinta) {
    ctx.fillStyle = tinta;
    ctx.globalAlpha = 0.6;
    linea(texto, P.C + 10, 22);
    ctx.globalAlpha = 1;
  }

  function pintarVista(v, tinta) {
    ctx.save();
    if (v.tipo === 'habitos' || v.tipo === 'tareas') {
      cabecera(v.titulo, tinta);
      if (!v.filas.length) vacio(v.vacio, tinta);
      // Todas las filas empiezan en la misma x: la que cabe en las cinco.
      const [a] = P.tramo(VISTA.fila0 - VISTA.fila / 2, VISTA.fila0 + 4.5 * VISTA.fila);
      v.filas.forEach((f, i) => {
        const y = VISTA.fila0 + i * VISTA.fila;
        const hecho = v.tipo === 'habitos' ? f.hecho : f.hecha;
        const xc = a + MARGEN + 12;
        casilla(xc, y, hecho, v.tipo === 'habitos', tinta);
        let x = xc + 22;
        if (v.tipo === 'habitos' && f.icono) {
          ctx.font = `22px ${EMOJI}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(f.icono, x, y + 1);
          x += 32;
        }
        ctx.fillStyle = tinta;
        ctx.globalAlpha = hecho && v.tipo === 'tareas' ? 0.5 : 1;
        const detalle = v.tipo === 'habitos' ? f.detalle : f.cuando;
        const ty = detalle ? y - 8 : y;
        const ancho = linea(f.titulo, ty, 20, { alinear: 'left', x });
        if (hecho && v.tipo === 'tareas') ctx.fillRect(x, ty, ancho, 2);
        if (detalle) {
          ctx.globalAlpha = f.atrasada ? 1 : 0.6;
          linea(detalle, y + 11, 15, { alinear: 'left', x, peso: f.atrasada ? 600 : '' });
        }
        ctx.globalAlpha = 1;
      });
      puntosDePagina(v, tinta);
    } else if (v.tipo === 'progreso') {
      const cx = P.C;
      const { y: cy, r: R, grueso } = VISTA.anillo;
      ctx.lineWidth = grueso;
      ctx.lineCap = 'round';
      ctx.strokeStyle = tinta;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (v.pct > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(100, v.pct)) / 100);
        ctx.stroke();
      }
      ctx.fillStyle = tinta;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 46px ${LETRA}`;
      ctx.fillText(v.vacio ? '—' : `${v.pct}%`, cx, cy - (v.estrella ? 12 : 0));
      if (v.estrella) {
        ctx.font = `28px ${EMOJI}`;
        ctx.fillText('⭐', cx, cy + 32);
      }
      ctx.globalAlpha = 0.75;
      linea(v.vacio ? 'Sin hábitos todavía' : v.texto, VISTA.texto, 21);
      ctx.globalAlpha = 1;
      // Pestañas «Hoy · Semana», como el panel de Troko.
      ctx.font = `600 19px ${LETRA}`;
      ctx.textAlign = 'center';
      for (const [modo, x] of [['hoy', cx - 52], ['semana', cx + 52]]) {
        ctx.globalAlpha = v.modo === modo ? 1 : 0.4;
        ctx.fillText(modo === 'hoy' ? 'Hoy' : 'Semana', x, VISTA.pestanas);
        if (v.modo === modo) ctx.fillRect(x - 30, VISTA.pestanas + 14, 60, 3);
      }
      ctx.globalAlpha = 1;
      // En la semana, siete barritas a los lados del anillo (4 a la izquierda,
      // 3 a la derecha), pegadas a lo que se ve a esa altura.
      if (v.modo === 'semana') {
        const suelo = cy + 56;
        const [a, b] = P.tramo(suelo - 60, suelo);
        v.barras.forEach((pct, i) => {
          const alto = 6 + (pct / 100) * 52;
          const x = i < 4 ? a + MARGEN + i * 12 : b - MARGEN - (7 - i) * 12 + 4;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x, suelo - alto, 8, alto);
        });
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // Respira: de -1 (sin aire) a 1 (lleno). Dormido, más despacio y más hondo.
  function respiracion(t) {
    const dormido = !!objetivo.zzz;
    const fase = (t / (dormido ? RESPIRA.periodoDormido : RESPIRA.periodo)) * Math.PI * 2;
    return Math.sin(fase) * (dormido ? RESPIRA.dormido : 1);
  }

  // `progreso` (0 a 1 o null) pinta la barra del bloque de concentración:
  // la cara hace de reloj.
  function frame(t, progreso = null) {
    // Nunca negativo: si el tiempo va hacia atrás, los ojos se quedarían sin tamaño.
    const dt = ultimo === null ? 0 : Math.max(0, Math.min(0.1, (t - ultimo) / 1000));
    ultimo = t;
    const k = 1 - Math.exp(-dt * 12);
    for (const key of NUMERICOS) actual[key] += (objetivo[key] - actual[key]) * k;

    // Parpadeo (no parpadea dormido).
    let cierre = 0;
    if (!objetivo.zzz) {
      if (parpadeoDesde < 0 && t >= proximoParpadeo) parpadeoDesde = t;
      if (parpadeoDesde >= 0) {
        const p = (t - parpadeoDesde) / VIDA.parpadeoDura;
        if (p >= 1) {
          parpadeoDesde = -1;
          // A veces parpadea dos veces seguidas, como hace la gente.
          proximoParpadeo = Math.random() < VIDA.parpadeoDoble
            ? t + 130
            : t + VIDA.parpadeoMin + Math.random() * (VIDA.parpadeoMax - VIDA.parpadeoMin);
        } else {
          cierre = Math.sin(Math.PI * p);
        }
      }
    }

    // Mirada: pequeños saltos solo en reposo.
    if (distraccion) {
      miradaObjetivo = {
        x: Math.max(-1, Math.min(1, (distraccion.x - 0.5) * 2)) * 16,
        y: Math.max(-1, Math.min(1, (distraccion.y - 0.5) * 2)) * 9,
      };
      proximaMirada = t + 400;
    } else if (miradaExterna) {
      miradaObjetivo = miradaExterna;
      proximaMirada = t + 400;
    } else if (t >= proximaMirada) {
      // Tranquilo mira alrededor a gusto; con otra cara (atento, con sed, con
      // sueño…) solo se le va un poco la vista; dormido, nada.
      const quieto = QUIETAS.has(nombre);
      const [ganas, ancho, alto] = objetivo.zzz ? [0, 0, 0] : quieto ? [VIDA.mira, 30, 13] : [VIDA.miraPoco, 12, 5];
      const mira = Math.random() < ganas;
      miradaObjetivo = mira
        ? { x: (Math.random() - 0.5) * ancho, y: (Math.random() - 0.5) * alto }
        : { x: 0, y: 0 };
      // Una ojeada dura poco; mirando al frente aguanta más.
      proximaMirada = t + (mira ? 700 + Math.random() * 1600 : 1400 + Math.random() * 2600);
    }
    const km = 1 - Math.exp(-dt * 9);
    // D-044: cuanto más tira la inclinación, menos mira por su cuenta (como el firmware).
    const tira = Math.min(1, Math.hypot(incl.mx / (14 * P.K), incl.my / (10 * P.K)));
    const mx = miradaObjetivo.x * (1 - tira) + incl.mx / P.K;
    const my = miradaObjetivo.y * (1 - tira) + incl.my / P.K;
    mirada.x += (mx - mirada.x) * km;
    mirada.y += (my - mirada.y) * km;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = fondo();
    ctx.fillRect(0, 0, P.LADO, P.LADO);
    if (vista) {
      pintarVista(vista, col(skin.arcoiris ? `hsl(${(t / 20) % 360} 90% 66%)` : skin.color));
      return;
    }
    // De aquí abajo, coordenadas de la cara de 240, escaladas a la pantalla.
    ctx.setTransform(P.K, 0, 0, P.K, P.DESPLAZA, P.DESPLAZA);
    if (incl.giro) { // D-043: la cara gira alrededor del centro para quedar recta
      ctx.translate(LADO / 2, LADO / 2);
      ctx.rotate(incl.giro);
      ctx.translate(-LADO / 2, -LADO / 2);
    }
    const resp = respiracion(t);
    // Sin suavizar a propósito: los ojos se paran en el borde de la ventana
    // como contra una pared (con el parpadeo fuera, para que no tiemble).
    ajuste = corrimiento(actual, 0, t, resp);
    if (ajuste.s < 1) { // no cabía por ningún lado: se encoge alrededor del centro
      ctx.translate(LADO / 2, LADO / 2);
      ctx.scale(ajuste.s, ajuste.s);
      ctx.translate(-LADO / 2, -LADO / 2);
    }
    ojo(-1, actual, cierre, t, resp);
    ojo(1, actual, cierre, t, resp);

    const tinta = col(skin.arcoiris ? `hsl(${(t / 20) % 360} 90% 66%)` : skin.color);
    pintarExtras(actual, t, tinta);
    if (distraccion) pintarDistraccion(t, tinta);
    if (objetivo.zzz) {
      ctx.fillStyle = tinta;
      ctx.font = 'bold 22px ui-monospace, Consolas, monospace';
      const fase = (t / 1400) % 1;
      const fase2 = (fase + 0.5) % 1;
      ctx.globalAlpha = 1 - fase;
      const [z1x, z1y] = dentro(174 + fase * 14, 84 - fase * 26, 12); // centro de la «z»
      ctx.fillText('z', z1x - 6, z1y + 8);
      ctx.globalAlpha = 1 - fase2;
      const [z2x, z2y] = dentro(174 + fase2 * 14, 84 - fase2 * 26, 12);
      ctx.fillText('z', z2x - 6, z2y + 8);
      ctx.globalAlpha = 1;
    }

    if (objetivo.icono === 'gota') {
      const sube = Math.sin(t / 500) * 2;
      const [gx, gy] = dentro(186, 75 + sube, 19); // centro de la gota
      ctx.save();
      ctx.translate(gx - 186, gy - 75 - sube);
      ctx.fillStyle = '#6bb8ff';
      ctx.beginPath();
      ctx.moveTo(186, 58 + sube);
      ctx.bezierCurveTo(200, 78 + sube, 198, 92 + sube, 186, 92 + sube);
      ctx.bezierCurveTo(174, 92 + sube, 172, 78 + sube, 186, 58 + sube);
      ctx.fill();
      ctx.restore();
    }
    if (objetivo.icono === 'flecha') {
      const sube = ((t / 900) % 1) * 10;
      ctx.strokeStyle = tinta;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Dentro de la ventana de la carcasa (antes, x 34 y 206 y 14 px más arriba).
      for (const x0 of [48, 192]) {
        const [x, cy] = dentro(x0, 95 - sube, 20); // centro de la flecha
        const dy = cy - (95 - sube);
        ctx.globalAlpha = 1 - sube / 12;
        ctx.save();
        ctx.translate(0, dy);
        ctx.beginPath();
        ctx.moveTo(x - 9, 92 - sube);
        ctx.lineTo(x, 80 - sube);
        ctx.lineTo(x + 9, 92 - sube);
        ctx.moveTo(x, 80 - sube);
        ctx.lineTo(x, 110 - sube);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    if (progreso !== null) {
      ctx.fillStyle = tinta;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      // Debajo de los ojos y dentro de la ventana (antes, 40-200 a y = 214,
      // que en la pantalla redonda queda detrás de la carcasa).
      ctx.roundRect(70, 186, 100, 6, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(70, 186, Math.max(6, 100 * progreso), 6, 3);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { setExpression, setSkin, setMirada, setInclinacion, setDistraccion, setTema, setVista, frame, get nombre() { return nombre; }, get ajuste() { return ajuste; }, get tema() { return tema; }, get fondo() { return fondo(); } };
}
