// Lo que Tulo saca de la cámara (D-012, nivel 1): dónde está tu cara y si
// estás delante. Lógica pura: recibe la caja de la cara ya detectada, no
// imágenes. Detectar la cara es cosa de quien tenga la cámara.

export const MIRADA_MAX_X = 26; // píxeles que pueden desplazarse los ojos
export const MIRADA_MAX_Y = 14;
export const AUSENTE_TRAS_MS = 20000; // sin cara este tiempo = te has ido
export const LEVANTARSE_MS = 30000; // ausencia que cuenta como haberse levantado

// De la caja de la cara en la imagen a un desplazamiento de los ojos.
// La cámara te mira de frente: si te mueves a tu derecha sales a la izquierda
// de la imagen, y los ojos tienen que irse a tu derecha. Por eso x va invertida.
export function miradaDesdeCara(caja, anchoImagen, altoImagen) {
  const cx = (caja.x + caja.ancho / 2) / anchoImagen; // 0 a 1
  const cy = (caja.y + caja.alto / 2) / altoImagen;
  const limitar = (v) => Math.max(-1, Math.min(1, v));
  return {
    x: -limitar((cx - 0.5) * 2) * MIRADA_MAX_X,
    y: limitar((cy - 0.5) * 2) * MIRADA_MAX_Y,
  };
}

export function createPresencia(now = 0) {
  return { presente: true, ultimaCara: now, seFue: null };
}

// Se llama cada vez que la cámara mira. Devuelve los eventos ocurridos:
//   { tipo: 'se-va' }                  lleva AUSENTE_TRAS_MS sin verte
//   { tipo: 'vuelve', ausenteMs }      te vuelve a ver; cuánto has faltado
export function actualizarPresencia(p, hayCara, now) {
  const eventos = [];
  if (hayCara) {
    if (!p.presente) {
      eventos.push({ tipo: 'vuelve', ausenteMs: now - p.seFue });
      p.presente = true;
      p.seFue = null;
    }
    p.ultimaCara = now;
  } else if (p.presente && now - p.ultimaCara >= AUSENTE_TRAS_MS) {
    p.presente = false;
    p.seFue = p.ultimaCara;
    eventos.push({ tipo: 'se-va' });
  }
  return eventos;
}
