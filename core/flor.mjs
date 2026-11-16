// La carcasa de Tulo vista de frente: la flor de Jacobo (carcasa v1, 13-nov).
// Medidas en milímetros, sacadas de su plano (vault: 02_PROJECTS/Pacolo/
// attachments/carcasa-v1/): 10 lóbulos de R10 con el centro a r = 25 (uno arriba,
// 67,55 × 70 mm) y una ventana en estrella de 10 puntas, de r = 21,24 en las
// puntas (entre lóbulos) a r = 15 debajo de cada lóbulo.
// La usan el simulador (web/app.mjs) y la app de Windows (panel e icono de la
// bandeja); escritorio/crear-icono.py repite estas medidas para el .ico.
// Origen en el centro de la flor, x a la derecha, y hacia abajo.
export const N = 10;
export const R_LOBULO = 10;
export const R_CENTROS = 25;
export const R_PUNTA = 21.24;
export const R_VALLE = 15;
const rad = (g) => (g * Math.PI) / 180;
const eje = (k) => rad(18 + 36 * k); // k = 2 es el lóbulo de abajo; k = 7, el de arriba
export const LOBULOS = Array.from({ length: N }, (_, k) => [R_CENTROS * Math.cos(eje(k)), R_CENTROS * Math.sin(eje(k))]);

// Cada entrante de la ventana es un arco que pasa por dos puntas vecinas y
// llega a r = 15 en el eje del lóbulo: un círculo de radio RHO con centro a D.
const px = R_PUNTA * Math.cos(rad(18));
const py = R_PUNTA * Math.sin(rad(18));
const D = (px * px + py * py - R_VALLE * R_VALLE) / (2 * (px - R_VALLE));
const RHO = D - R_VALLE;
const ENTRANTES = Array.from({ length: N }, (_, k) => [D * Math.cos(eje(k)), D * Math.sin(eje(k))]);

// Contorno de la ventana como puntos (sirve para un <path> y para clip-path).
export function estrella(pasos = 10) {
  const media = Math.atan2(py, D - px); // medio arco, visto desde el centro del entrante
  const pts = [];
  for (let k = 0; k < N; k++) {
    const [cx, cy] = ENTRANTES[k];
    const haciaDentro = eje(k) + Math.PI;
    for (let i = 0; i <= pasos; i++) {
      const a = haciaDentro + media - (2 * media * i) / pasos;
      pts.push([cx + RHO * Math.cos(a), cy + RHO * Math.sin(a)]);
    }
  }
  return pts;
}

// Qué hay en un punto: 'pantalla', 'carcasa' o null (fuera). Para pintar por píxeles.
export function que(x, y) {
  const r = Math.hypot(x, y);
  if (r <= R_PUNTA + 0.05 && ENTRANTES.every(([cx, cy]) => Math.hypot(x - cx, y - cy) > RHO)) return 'pantalla';
  if (LOBULOS.some(([cx, cy]) => Math.hypot(x - cx, y - cy) <= R_LOBULO)) return 'carcasa';
  return null;
}

const n2 = (v) => Math.round(v * 100) / 100;
export const camino = (pts) => `M${pts.map(([x, y]) => `${n2(x)} ${n2(y)}`).join('L')}Z`;

// Caja del dibujo: la flor, la anilla del llavero arriba y el canto abajo.
export const CAJA = { x: -34.5, y: -40.5, ancho: 69, alto: 78.5 };
export const CANTO = 1.8;

// SVG de la flor. Los colores entran por variables CSS (--pk-carcasa y
// --pk-pantalla) para que cambien sin volver a dibujarla.
export function svg({ anilla = true, canto = true } = {}) {
  const lobulos = (extra = '') => LOBULOS.map(([x, y]) => `<circle cx="${n2(x)}" cy="${n2(y)}" r="${R_LOBULO}"${extra}/>`).join('');
  const pliegues = Array.from({ length: N }, (_, k) => {
    const a = rad(36 * k);
    return `<line x1="${n2(22.5 * Math.cos(a))}" y1="${n2(22.5 * Math.sin(a))}" x2="${n2(29.6 * Math.cos(a))}" y2="${n2(29.6 * Math.sin(a))}"/>`;
  }).join('');
  const ventana = camino(estrella());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CAJA.x} ${CAJA.y} ${CAJA.ancho} ${CAJA.alto}" aria-hidden="true">`
    + (anilla ? '<circle cx="0" cy="-36.4" r="2.7" fill="none" stroke="#a3a199" stroke-width="1.1"/>' : '')
    + (canto ? `<g transform="translate(0 ${CANTO})"><g fill="var(--pk-carcasa, #e9e4d8)">${lobulos()}</g><g fill="#000" opacity="0.2">${lobulos()}</g></g>` : '')
    + `<g fill="var(--pk-carcasa, #e9e4d8)">${lobulos()}</g>`
    + `<g stroke="#000" stroke-opacity="0.13" stroke-width="0.5" stroke-linecap="round">${pliegues}</g>`
    + `<path d="${ventana}" fill="var(--pk-pantalla, #101114)" stroke="#000" stroke-opacity="0.35" stroke-width="0.7" stroke-linejoin="round"/>`
    + '</svg>';
}

// Dónde va la ventana dentro de la caja del dibujo, en % (para colocarla con
// CSS a cualquier tamaño), y su contorno como polígono de clip-path.
// caraMm = lado, en mm, del lienzo cuadrado de la cara, que va centrado.
export function ventana(caraMm = 36) {
  const lado = (R_PUNTA + 0.1) * 2;
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  return {
    left: pct((-CAJA.x - lado / 2) / CAJA.ancho),
    top: pct((-CAJA.y - lado / 2) / CAJA.alto),
    width: pct(lado / CAJA.ancho),
    height: pct(lado / CAJA.alto),
    cara: pct(caraMm / lado),
    recorte: `polygon(${estrella().map(([x, y]) => `${pct((x + lado / 2) / lado)} ${pct((y + lado / 2) / lado)}`).join(',')})`,
  };
}
