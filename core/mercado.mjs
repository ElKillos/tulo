// Mercado de skins SIMULADO (D-005, D-008). Sirve para ver cómo se siente y
// para enseñarlo; no mueve dinero ni habla con ningún servidor.
//
// Lo que viene de las decisiones:
//   - el saldo no sale de la plataforma: lo que ganas vendiendo solo sirve
//     para comprar dentro (D-008);
//   - la plataforma se queda una comisión de cada venta, en torno al 3 % (D-005);
//   - las cajas no se compran con saldo: se ganan con misiones (D-008).
// Lo que es PROPUESTA de este simulador, sin decidir: que la comisión la pague
// el vendedor, los precios de referencia, los mínimos y que la skin única no
// se pueda vender.
//
// Lógica pura. El dinero va en céntimos enteros. Los otros usuarios son
// inventados: el azar entra como argumento para poder probarlo.

import { skin, sortearSkin, idActual } from './skins.mjs';

export const COMISION = 0.03;
export const PRECIO_MIN = 5; // céntimos
export const PRECIO_MAX = 100000;
export const ANUNCIOS_DE_OTROS = 6;

// Precio orientativo por rareza, en céntimos. Inventado para el simulador.
export const PRECIO_REF = { comun: 20, rara: 80, epica: 300, legendaria: 1500, bicolor: 6000 };

const OTROS = ['luna_42', 'nico', 'marta.b', 'pixel', 'sr_tostada', 'ines', 'kiwi', 'dani_r'];

export const comisionDe = (precio) => Math.max(1, Math.round(precio * COMISION));
export const netoDe = (precio) => precio - comisionDe(precio);
export const sePuedeVender = (id) => skin(id).rareza in PRECIO_REF;
export const precioRef = (id) => PRECIO_REF[skin(id).rareza] ?? null;

export function euros(centimos) {
  return `${(centimos / 100).toFixed(2).replace('.', ',')} €`;
}

function anuncioDeOtro(m, azar) {
  const s = sortearSkin(azar);
  const precio = Math.max(PRECIO_MIN, Math.round(PRECIO_REF[s.rareza] * (0.7 + azar() * 0.9)));
  const vendedor = OTROS[Math.min(OTROS.length - 1, Math.floor(azar() * OTROS.length))];
  const a = { id: m.siguienteId++, skin: s.id, precio, vendedor };
  m.anuncios.push(a);
  return a;
}

export function createMercado(azar = Math.random) {
  const m = { saldo: 0, anuncios: [], siguienteId: 1, comisiones: 0, ventas: 0, compras: 0 };
  for (let i = 0; i < ANUNCIOS_DE_OTROS; i++) anuncioDeOtro(m, azar);
  return m;
}

// Pone al día un mercado guardado con ids de skin de antes de D-023: los
// anuncios pasan a su equivalente y los que ya no existen se quitan (con las
// diez de prueba de antes no pasa: todas tienen equivalente).
export function migrarMercado(m) {
  m.anuncios = m.anuncios.filter((a) => {
    a.skin = idActual(a.skin);
    try { skin(a.skin); return true; } catch { return false; }
  });
  return m;
}

// Recarga de saldo. En el producto sería un pago; aquí, un botón.
export function recargar(m, centimos) {
  if (!(Number.isInteger(centimos) && centimos > 0)) throw new Error('La recarga tiene que ser una cantidad positiva.');
  m.saldo += centimos;
  return m.saldo;
}

export const misAnuncios = (m) => m.anuncios.filter((a) => a.vendedor === 'tu');
export const anunciosDeOtros = (m) => m.anuncios.filter((a) => a.vendedor !== 'tu');

// Cuántas copias de una skin puedes poner a la venta: todas, menos la que
// llevas puesta.
export function vendibles(progreso, id) {
  if (!sePuedeVender(id)) return 0;
  // La de fábrica va atada al aparato (D-024): esa copia tampoco se vende.
  return (progreso.inventario[id] ?? 0) - (progreso.equipada === id || progreso.fabrica === id ? 1 : 0);
}

// Pone una de tus skins a la venta: sale del inventario hasta que se venda o
// la retires.
export function publicar(m, progreso, id, precio) {
  if (!sePuedeVender(id)) throw new Error('Esa skin no se puede vender.');
  if (!(Number.isInteger(precio) && precio >= PRECIO_MIN && precio <= PRECIO_MAX)) {
    throw new Error(`El precio va de ${euros(PRECIO_MIN)} a ${euros(PRECIO_MAX)}.`);
  }
  if (vendibles(progreso, id) <= 0) {
    throw new Error(!progreso.inventario[id] ? 'No tienes esa skin.'
      : progreso.fabrica === id && progreso.equipada !== id ? 'Los ojos de fábrica van con tu Tulo: no se venden.'
      : 'No puedes vender la skin que llevas puesta.');
  }
  progreso.inventario[id] -= 1;
  const a = { id: m.siguienteId++, skin: id, precio, vendedor: 'tu' };
  m.anuncios.push(a);
  return a;
}

function sacar(m, anuncioId) {
  const i = m.anuncios.findIndex((a) => a.id === anuncioId);
  if (i < 0) throw new Error('Ese anuncio ya no está.');
  return m.anuncios.splice(i, 1)[0];
}

// Retira uno de tus anuncios: la skin vuelve al inventario.
export function retirar(m, progreso, anuncioId) {
  const a = m.anuncios.find((x) => x.id === anuncioId);
  if (!a || a.vendedor !== 'tu') throw new Error('Ese anuncio no es tuyo.');
  sacar(m, anuncioId);
  progreso.inventario[a.skin] = (progreso.inventario[a.skin] ?? 0) + 1;
  return a;
}

// Compras el anuncio de otro con tu saldo. La comisión sale de lo que cobra
// el vendedor, así que tú pagas el precio que ves.
export function comprar(m, progreso, anuncioId) {
  const a = m.anuncios.find((x) => x.id === anuncioId);
  if (!a) throw new Error('Ese anuncio ya no está.');
  if (a.vendedor === 'tu') throw new Error('Ese anuncio es tuyo.');
  if (m.saldo < a.precio) throw new Error(`Te faltan ${euros(a.precio - m.saldo)} de saldo.`);
  sacar(m, anuncioId);
  m.saldo -= a.precio;
  m.comisiones += comisionDe(a.precio);
  m.compras += 1;
  progreso.inventario[a.skin] = (progreso.inventario[a.skin] ?? 0) + 1;
  return a;
}

// Alguien compra uno de tus anuncios: cobras el precio menos la comisión.
export function vender(m, anuncioId, comprador = 'alguien') {
  const a = m.anuncios.find((x) => x.id === anuncioId);
  if (!a || a.vendedor !== 'tu') throw new Error('Ese anuncio no es tuyo.');
  sacar(m, anuncioId);
  const comision = comisionDe(a.precio);
  m.saldo += a.precio - comision;
  m.comisiones += comision;
  m.ventas += 1;
  return { tipo: 'vendida', skin: a.skin, precio: a.precio, comision, neto: a.precio - comision, comprador };
}

// Probabilidad de que un comprador inventado se lleve tu anuncio en una
// pasada, según lo caro que esté frente al precio orientativo.
export function probabilidadDeVenta(id, precio) {
  const r = precio / precioRef(id);
  if (r <= 0.8) return 0.9;
  if (r <= 1.2) return 0.5;
  if (r <= 2) return 0.15;
  return 0;
}

// Una pasada del mercado: los compradores inventados miran tus anuncios y, si
// faltan anuncios de otros, aparece alguno. Devuelve lo ocurrido.
export function pasarMercado(m, azar = Math.random) {
  const eventos = [];
  for (const a of misAnuncios(m)) {
    if (azar() < probabilidadDeVenta(a.skin, a.precio)) {
      const comprador = OTROS[Math.min(OTROS.length - 1, Math.floor(azar() * OTROS.length))];
      eventos.push(vender(m, a.id, comprador));
    }
  }
  if (anunciosDeOtros(m).length < ANUNCIOS_DE_OTROS && azar() < 0.5) {
    eventos.push({ tipo: 'anuncio', anuncio: anuncioDeOtro(m, azar) });
  }
  return eventos;
}
