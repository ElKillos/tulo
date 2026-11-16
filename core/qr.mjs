// Códigos QR sin dependencias, para abrir el simulador en el móvil.
// Modo byte (UTF-8), corrección de errores M, versiones 1 a 10 (hasta 213
// bytes, de sobra para una dirección). Sigue el estándar ISO/IEC 18004; el
// esquema es el de la implementación de referencia de Nayuki (MIT).
// La máscara se elige con las penalizaciones 1, 2 y 4 del estándar (la 3, la
// de patrones parecidos a los de las esquinas, se omite): cualquier máscara
// da un QR válido, la penalización solo ayuda a leerlo.

const NIVEL_M = 0; // bits de formato: L=01, M=00, Q=11, H=10
// Índice = versión (0 sin uso).
const ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
export const VERSION_MAX = 10;

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function modulosDeDatos(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const alin = Math.floor(ver / 7) + 2;
    n -= (25 * alin - 10) * alin - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const palabrasDeDatos = (ver) => Math.floor(modulosDeDatos(ver) / 8) - ECC_POR_BLOQUE[ver] * BLOQUES[ver];

// --- Reed-Solomon sobre GF(256), polinomio 0x11D ---
function multiplicar(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicar(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return r;
}
function resto(datos, div) {
  const r = div.map(() => 0);
  for (const b of datos) {
    const factor = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => { r[i] ^= multiplicar(c, factor); });
  }
  return r;
}

function conCorreccion(datos, ver) {
  const nBloques = BLOQUES[ver];
  const eccLen = ECC_POR_BLOQUE[ver];
  const total = Math.floor(modulosDeDatos(ver) / 8);
  const cortos = nBloques - (total % nBloques);
  const largoCorto = Math.floor(total / nBloques);
  const div = divisor(eccLen);
  const bloques = [];
  for (let i = 0, k = 0; i < nBloques; i++) {
    const dat = datos.slice(k, k + largoCorto - eccLen + (i < cortos ? 0 : 1));
    k += dat.length;
    const ecc = resto(dat, div);
    if (i < cortos) dat.push(0);
    bloques.push(dat.concat(ecc));
  }
  const salida = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b, j) => {
      if (i !== largoCorto - eccLen || j >= cortos) salida.push(b[i]);
    });
  }
  return salida;
}

function posicionesAlineacion(ver, tam) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const paso = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = tam - 7; r.length < n; p -= paso) r.splice(1, 0, p);
  return r;
}

function penalizacion(m) {
  const tam = m.length;
  let p = 0;
  // 1: cinco o más seguidos del mismo color, en filas y en columnas.
  for (let eje = 0; eje < 2; eje++) {
    for (let a = 0; a < tam; a++) {
      let racha = 1;
      for (let b = 1; b < tam; b++) {
        const actual = eje ? m[b][a] : m[a][b];
        const previo = eje ? m[b - 1][a] : m[a][b - 1];
        if (actual === previo) {
          racha++;
          if (racha === 5) p += 3;
          else if (racha > 5) p++;
        } else racha = 1;
      }
    }
  }
  // 2: bloques de 2 × 2 del mismo color.
  for (let y = 0; y < tam - 1; y++) {
    for (let x = 0; x < tam - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
  }
  // 4: equilibrio entre oscuros y claros.
  let oscuros = 0;
  for (const fila of m) for (const c of fila) if (c) oscuros++;
  const total = tam * tam;
  p += (Math.ceil(Math.abs(oscuros * 20 - total * 10) / total) - 1) * 10;
  return p;
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Devuelve { version, tam, mascara, modulos } con modulos[y][x] = true si es oscuro.
export function crearQr(texto) {
  const bytes = [...new TextEncoder().encode(String(texto))];
  let ver = 1;
  for (; ver <= VERSION_MAX; ver++) {
    const cuenta = ver <= 9 ? 8 : 16;
    if (4 + cuenta + bytes.length * 8 <= palabrasDeDatos(ver) * 8) break;
  }
  if (ver > VERSION_MAX) throw new Error(`Texto demasiado largo para un QR (${bytes.length} bytes).`);

  // Bits de datos: modo byte, longitud, bytes, terminador y relleno.
  const bits = [];
  const poner = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poner(0b0100, 4);
  poner(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) poner(b, 8);
  const capacidad = palabrasDeDatos(ver) * 8;
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  const palabras = [];
  for (let i = 0; i < bits.length; i += 8) palabras.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const codigo = conCorreccion(palabras, ver);

  const tam = ver * 4 + 17;
  const mod = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fija = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijar = (x, y, oscuro) => { mod[y][x] = oscuro; fija[y][x] = true; };

  // Patrones fijos: líneas de sincronía, esquinas, alineación.
  for (let i = 0; i < tam; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < tam && y >= 0 && y < tam) fijar(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const alin = posicionesAlineacion(ver, tam);
  const ultima = alin.length - 1;
  for (let i = 0; i < alin.length; i++) {
    for (let j = 0; j < alin.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ultima) || (i === ultima && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) fijar(alin[i] + dx, alin[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  const formato = (mascara) => {
    const datos = (NIVEL_M << 3) | mascara;
    let r = datos;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((datos << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(b, i));
    fijar(8, 7, bit(b, 6));
    fijar(8, 8, bit(b, 7));
    fijar(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) fijar(tam - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) fijar(8, tam - 15 + i, bit(b, i));
    fijar(8, tam - 8, true); // el módulo oscuro fijo
  };
  formato(0); // reserva el sitio; se reescribe con la máscara elegida
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = tam - 11 + (i % 3);
      const c = Math.floor(i / 3);
      fijar(a, c, bit(b, i));
      fijar(c, a, bit(b, i));
    }
  }

  // Datos en zigzag, de dos en dos columnas, de abajo a la derecha.
  let i = 0;
  for (let der = tam - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let v = 0; v < tam; v++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j;
        const sube = ((der + 1) & 2) === 0;
        const y = sube ? tam - 1 - v : v;
        if (!fija[y][x] && i < codigo.length * 8) {
          mod[y][x] = bit(codigo[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }

  const enmascarar = (k) => {
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fija[y][x] && MASCARAS[k](x, y)) mod[y][x] = !mod[y][x];
  };
  let mejor = 0;
  let menor = Infinity;
  for (let k = 0; k < 8; k++) {
    enmascarar(k);
    formato(k);
    const p = penalizacion(mod);
    if (p < menor) { menor = p; mejor = k; }
    enmascarar(k); // deshace (la máscara es su propia inversa)
  }
  enmascarar(mejor);
  formato(mejor);
  return { version: ver, tam, mascara: mejor, modulos: mod };
}

// El QR en texto para la terminal: dos filas de módulos por línea con medios
// bloques, en blanco sobre negro (colores ANSI) para que se lea con cualquier
// tema de terminal. `margen` es el borde claro, en módulos.
export function qrTerminal(qr, { margen = 2, ansi = true } = {}) {
  const tam = qr.tam + margen * 2;
  const claro = (x, y) => {
    const mx = x - margen;
    const my = y - margen;
    if (mx < 0 || my < 0 || mx >= qr.tam || my >= qr.tam) return true;
    return !qr.modulos[my][mx];
  };
  const lineas = [];
  for (let y = 0; y < tam; y += 2) {
    let l = '';
    for (let x = 0; x < tam; x++) {
      const arriba = claro(x, y);
      const abajo = y + 1 < tam ? claro(x, y + 1) : false;
      l += arriba && abajo ? '█' : arriba ? '▀' : abajo ? '▄' : ' ';
    }
    lineas.push(ansi ? `\x1b[97;40m${l}\x1b[0m` : l);
  }
  return lineas.join('\n');
}
