// App del móvil (D-049): volver a intentar lo que se trae por la red al arrancar.
// El 16-nov, recién publicada, la primera carga falló una vez con «Failed to
// fetch dynamically imported module … web/app.mjs» y al recargar fue bien: un
// fallo de red de un momento no debe dejar a Tulo sin arrancar.
//
// Lógica pura (la espera y lo que se intenta entran como argumentos), con tests.

// Esperas antes del 2.º y del 3.er intento.
export const ESPERAS_MS = [700, 2000];

// ¿Es un fallo de traer algo (red, despliegue a medias) y no un error del código?
// Chrome: «Failed to fetch dynamically imported module»; Safari: «Importing a
// module script failed» o «Load failed»; Firefox: «error loading dynamically
// imported module». Todos son TypeError. Un error al ejecutar el módulo no se
// reintenta: volver a cargarlo lo ejecutaría dos veces.
export function esFalloDeCarga(e) {
  if (e?.reintentable === true) return true;
  if (!(e instanceof TypeError)) return false;
  return /import|module|fetch|load/i.test(String(e.message ?? ''));
}

// Un error que sí merece otro intento (una respuesta 404 o 503 a medio publicar).
export function reintentable(mensaje) {
  const e = new Error(mensaje);
  e.reintentable = true;
  return e;
}

// `intentar(n)`: n = 0 la primera vez, 1 y 2 en los reintentos (para pedir la
// misma dirección con otra coletilla: algunos navegadores recuerdan el fallo de
// un módulo y no lo vuelven a pedir). `yaArranco()`: si lo que se traía llegó a
// ponerse en marcha, no se repite aunque después haya dado un error.
export async function conReintento(intentar, { esperas = ESPERAS_MS, yaArranco = () => false, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), alReintentar = () => {} } = {}) {
  let ultimo;
  for (let n = 0; n <= esperas.length; n++) {
    if (n > 0) {
      alReintentar(n, ultimo);
      await esperar(esperas[n - 1]);
    }
    try {
      return await intentar(n);
    } catch (e) {
      ultimo = e;
      if (yaArranco() || !esFalloDeCarga(e)) throw e;
    }
  }
  throw ultimo;
}
