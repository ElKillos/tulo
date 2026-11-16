// El simulador abierto desde el móvil, en la misma wifi (PACOLO_LAN=1 al
// arrancar server.mjs). Las reglas están en core/red.mjs.
//
// - En el PC: si la red local está abierta, enseña la dirección, el código y un
//   QR que ya lleva el código (en el #, que no llega al servidor ni a los logs).
// - En el móvil: guarda el código (del enlace o escrito a mano) y lo añade a
//   cada petición a /api/. Sin código, ni lo intenta: el resto del simulador
//   (cara, órdenes, avisos, hábitos…) vive en el navegador y va igual.
// - Cámara y micrófono: el navegador del móvil no los deja usar en una página
//   http que no sea localhost, así que se desactivan con un aviso a la vista.

import { CABECERA_CODIGO, pareceCodigo } from '../core/red.mjs';
import { crearQr } from '../core/qr.mjs';

const $ = (id) => document.getElementById(id);
const LOCALES = ['127.0.0.1', 'localhost', '::1', '[::1]'];
const CLAVE = 'pacolo.codigoPC';
const remoto = !LOCALES.includes(location.hostname);

function leerGuardado() {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}
function guardarCodigo(c) {
  try { if (c) localStorage.setItem(CLAVE, c); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento: vale para esta visita */ }
}

let codigo = remoto ? leerGuardado() : null;
let estado = remoto ? (codigo ? 'comprobando' : 'sin-codigo') : 'pc';
let infoPc = null;

const delEnlace = /(?:^#|&)codigo=(\d{6})/.exec(location.hash);
if (delEnlace) {
  if (remoto) { codigo = delEnlace[1]; guardarCodigo(codigo); estado = 'comprobando'; }
  history.replaceState(null, '', location.pathname + location.search);
}

function olvidar(motivo) {
  codigo = null;
  guardarCodigo(null);
  estado = motivo;
  pintar();
}

// Todas las llamadas al puente pasan por aquí: así también las que se añadan
// a app.mjs más adelante llevan el código sin tocarlas una a una.
const fetchOriginal = window.fetch.bind(window);
window.fetch = (entrada, opciones = {}) => {
  const url = typeof entrada === 'string' ? entrada : (entrada?.url ?? String(entrada));
  const ruta = url.startsWith('/') ? url : new URL(url, location.href).pathname;
  if (!remoto || !ruta.startsWith('/api/')) return fetchOriginal(entrada, opciones);
  if (!codigo && !ruta.startsWith('/api/red')) {
    return Promise.resolve(new Response(JSON.stringify({ error: 'falta el código del PC' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
  }
  const cabeceras = new Headers(opciones.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
  if (codigo) cabeceras.set(CABECERA_CODIGO, codigo);
  return fetchOriginal(entrada, { ...opciones, headers: cabeceras }).then((r) => {
    // Un código malo se olvida al momento: si no, el sondeo de cada 2 s
    // gastaría los 5 intentos y bloquearía al propio móvil.
    if (r.status === 401 && codigo) olvidar('mal');
    if (r.status === 429) olvidar('bloqueado');
    if (r.ok && estado === 'comprobando' && !ruta.startsWith('/api/red')) { estado = 'ok'; pintar(); }
    return r;
  });
};

export const red = {
  remoto,
  get codigo() { return codigo; },
  // En el PC, la webcam; en el móvil por http el navegador no da cámara.
  camara: Boolean(navigator.mediaDevices?.getUserMedia),
  microfono: window.isSecureContext,
  // Por qué no se llega al PC, o null si se llega (o se puede intentar).
  motivoSinPuente() {
    if (!remoto) return null;
    if (estado === 'bloqueado') return 'Desde el móvil no llego al PC: demasiados códigos malos. Espera un minuto.';
    if (!codigo) return 'Desde el móvil no llego al PC: escribe el código que enseña la página del PC.';
    return null;
  },
};

// --- Lo que se ve --------------------------------------------------------
function pintarQr(lienzo, texto) {
  const qr = crearQr(texto);
  const margen = 3;
  const lado = qr.tam + margen * 2;
  const esc = Math.max(2, Math.floor(lienzo.width / lado));
  lienzo.width = lienzo.height = lado * esc;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < qr.tam; y++) for (let x = 0; x < qr.tam; x++) {
    if (qr.modulos[y][x]) ctx.fillRect((x + margen) * esc, (y + margen) * esc, esc, esc);
  }
}

const TEXTOS = {
  'sin-codigo': 'Para las notificaciones y la música del PC, escribe el código que enseña la página del PC.',
  comprobando: 'Comprobando el código…',
  ok: 'Conectado al PC con el código: notificaciones, música y estado del equipo.',
  mal: 'Ese código no vale. Cambia cada vez que se arranca el PC: mira el de su página.',
  bloqueado: 'Demasiados códigos malos: espera un minuto y vuelve a probar.',
  'sin-puente': 'El PC no contesta. ¿Sigue encendido el simulador en el PC?',
};

function pintar() {
  const caja = $('red');
  if (!caja) return;
  if (!remoto) {
    caja.hidden = !infoPc?.lan;
    if (!infoPc?.lan) return;
    $('red-pc').hidden = false;
    $('red-form').hidden = true;
    const [primera, ...otras] = infoPc.direcciones;
    if (!primera) {
      $('red-estado').textContent = 'Red local abierta, pero no encuentro la wifi del PC.';
      return;
    }
    // Por https si el puente lo tiene: así el móvil da su sensor de movimiento (D-043, D-044).
    const url = infoPc.https ? `https://${primera.direccion}:${infoPc.https}/` : `http://${primera.direccion}:${infoPc.puerto}/`;
    $('red-codigo').textContent = infoPc.codigo;
    $('red-url').textContent = url;
    pintarQr($('red-qr'), `${url}#codigo=${infoPc.codigo}`);
    const aviso = infoPc.https ? ' La primera vez el móvil avisa de que la conexión «no es privada» (el certificado es de este PC): «Avanzado» → «Continuar».' : '';
    $('red-estado').textContent = `Escanéalo con el móvil en la misma wifi, o abre la dirección y escribe el código.${aviso}${otras.length ? ` Otras direcciones del PC: ${otras.map((d) => d.direccion).join(', ')}.` : ''}`;
    return;
  }
  caja.hidden = false;
  $('red-pc').hidden = true;
  $('red-form').hidden = estado === 'ok' || estado === 'comprobando';
  $('red-olvidar').hidden = estado !== 'ok';
  $('red-estado').textContent = TEXTOS[estado] ?? '';
}

async function comprobar() {
  try {
    const r = await fetch('/api/red');
    if (!r.ok) {
      if (r.status === 404 && !remoto) return; // servidor de antes de este cambio
      if (remoto && r.status !== 401 && r.status !== 429) estado = 'sin-puente';
      return pintar();
    }
    const info = await r.json();
    if (!remoto) infoPc = info;
    else if (info.bloqueado) olvidar('bloqueado');
    else if (codigo) estado = info.codigoOk ? 'ok' : 'mal';
    if (remoto && estado === 'mal') olvidar('mal');
  } catch {
    if (remoto) estado = 'sin-puente';
  }
  pintar();
}

function avisosDelMovil() {
  if (!red.camara) {
    const c = $('camara');
    if (c) { c.disabled = true; c.closest('label')?.classList.add('no-disponible'); }
  }
  if (!red.microfono) {
    const h = $('hablar');
    if (h) { h.disabled = true; h.title = 'El micrófono solo se puede usar en el PC (o con https).'; }
  }
  if (red.camara && red.microfono) return;
  const nota = $('red-limites');
  if (!nota) return;
  const falta = [!red.camara && 'cámara', !red.microfono && 'micrófono'].filter(Boolean).join(' ni ');
  nota.textContent = `Aquí no hay ${falta}: el navegador del móvil solo los deja usar en el PC (o con https). Escribe las órdenes; lo demás va igual.`;
  nota.hidden = false;
}

$('red-form')?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const c = $('red-entrada').value.replace(/\D/g, '');
  if (!pareceCodigo(c)) { $('red-estado').textContent = 'Son 6 cifras.'; return; }
  codigo = c;
  guardarCodigo(c);
  estado = 'comprobando';
  $('red-entrada').value = '';
  pintar();
  comprobar();
});
$('red-olvidar')?.addEventListener('click', () => olvidar('sin-codigo'));

avisosDelMovil();
pintar();
comprobar();
