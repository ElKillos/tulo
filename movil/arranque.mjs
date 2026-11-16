// App del móvil (D-049): arranque.
// 1. Trae la página del simulador (web/index.html) y mete su contenido aquí.
// 2. Reparte sus paneles en pestañas (movil/pestanas.mjs).
// 3. Carga el cerebro del simulador (web/app.mjs), sin tocarlo: lo que hace
//    Tulo en el móvil es exactamente lo que hace en el simulador.
// 4. Pone lo propio de la app: barra de pestañas, funcionar sin conexión,
//    aviso de lo que dice Tulo y el puente con la app de iPhone si la hay.
//
// Las rutas son relativas a propósito: la carpeta funciona igual servida por
// el puente (server.mjs, /movil/) que subida a un alojamiento web, en la raíz
// o en una subcarpeta.

import { PESTANAS, POR_DEFECTO, repartir, esPestana } from './pestanas.mjs';
import { conectarNativo, hayNativo } from './nativo.mjs';

export const VERSION = '0.1.0';
const CLAVE_PESTANA = 'tulo.movil.pestana';
const $ = (id) => document.getElementById(id);

function recordar(clave, valor) {
  try { if (valor === undefined) return localStorage.getItem(clave); localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  return null;
}

// --- 1. La página del simulador ---------------------------------------------
async function traerSimulador() {
  const r = await fetch(new URL('../web/index.html', import.meta.url));
  if (!r.ok) throw new Error(`No encuentro la página de Tulo (${r.status}).`);
  const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
  const main = doc.querySelector('main');
  if (!main) throw new Error('La página de Tulo no tiene contenido.');
  return document.adoptNode(main);
}

// --- 2. Pestañas --------------------------------------------------------------
function ponerEnPestanas(main) {
  const escenario = main.querySelector('.escenario');
  if (escenario) escenario.dataset.pestana = 'tulo';
  const panel = main.querySelector('.panel');
  if (!panel) return;
  const hijos = [...panel.children];
  const grupos = repartir(hijos.map((h) => ({ titulo: /^H[23]$/.test(h.tagName) ? h.textContent : null, nivel: Number(h.tagName[1]) })));
  for (const g of grupos) {
    const caja = document.createElement('section');
    caja.className = 'mv-grupo';
    caja.dataset.pestana = g.pestana;
    if (g.oculto) caja.dataset.oculto = '';
    const trozo = hijos.slice(g.desde, g.hasta);
    panel.insertBefore(caja, trozo[0]);
    for (const h of trozo) caja.append(h);
    const cabeza = /^H[23]$/.test(trozo[0].tagName) ? trozo[0] : null;
    if (cabeza) {
      cabeza.dataset.original = cabeza.textContent;
      if (g.titulo) cabeza.textContent = g.titulo; else if (g.conocido) cabeza.hidden = true;
    }
  }
  // La tarjeta de la app, la primera de «Más».
  panel.prepend($('mv-tarjeta-app').content.cloneNode(true));
}

function irA(id) {
  const destino = esPestana(id) ? id : POR_DEFECTO;
  document.body.dataset.activa = destino;
  for (const b of $('mv-barra').children) {
    if (b.dataset.pestana === destino) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  $('mv-app').scrollTop = 0;
  recordar(CLAVE_PESTANA, destino);
}

function pintarBarra() {
  $('mv-barra').replaceChildren(...PESTANAS.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.pestana = p.id;
    const icono = document.createElement('span');
    icono.textContent = p.icono;
    icono.setAttribute('aria-hidden', 'true');
    const nombre = document.createElement('span');
    nombre.textContent = p.nombre;
    b.append(icono, nombre);
    b.addEventListener('click', () => irA(p.id));
    return b;
  }));
}

// --- 4. Lo propio de la app ---------------------------------------------------
// Lo que dice Tulo (el bocadillo) se enseña arriba unos segundos cuando no se
// está en su pestaña: añadir un hábito o una tarea también le hace hablar.
function seguirBocadillo() {
  const bocadillo = $('bocadillo');
  const aviso = $('mv-aviso');
  if (!bocadillo || !aviso) return;
  let apagar = 0;
  let listo = false;
  new MutationObserver(() => {
    const t = bocadillo.textContent.trim();
    if (!listo || !t || t === '…') return;
    aviso.textContent = t;
    aviso.hidden = false;
    clearTimeout(apagar);
    apagar = setTimeout(() => { aviso.hidden = true; }, 4500);
  }).observe(bocadillo, { childList: true, characterData: true, subtree: true });
  // Lo primero que dice al abrir no hace falta repetirlo arriba.
  setTimeout(() => { listo = true; }, 1500);
}

// Con el teclado abierto se esconde la barra (si no, sube con él y tapa).
function seguirTeclado() {
  const escribe = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|time|number|search|)$/.test(el.type)));
  document.addEventListener('focusin', (ev) => { if (escribe(ev.target)) document.body.dataset.escribiendo = ''; });
  document.addEventListener('focusout', () => { delete document.body.dataset.escribiendo; });
}

function instalada() {
  return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

// Funcionar sin conexión (movil/sw.js). El estado se enseña en «Más → Esta app»:
// si en un iPhone no va, que se vea por qué.
async function sinConexion() {
  const donde = $('mv-sw');
  const decir = (t) => { if (donde) donde.textContent = t; };
  if (!('serviceWorker' in navigator)) return decir('no, este navegador no lo permite.');
  if (!window.isSecureContext) return decir('no por http. Por https (el del PC o un alojamiento web), sí.');
  try {
    const reg = await navigator.serviceWorker.register(new URL('./sw.js', import.meta.url));
    await navigator.serviceWorker.ready;
    decir(reg.active ? 'sí, ya se puede abrir sin red.' : 'preparándolo…');
  } catch (e) {
    decir(`no (${e?.message ?? 'no se pudo preparar'}). Con el certificado del propio PC es normal; en un alojamiento web con https debería ir.`);
  }
}

function tarjetaApp() {
  const es = instalada();
  if ($('mv-instalar')) $('mv-instalar').hidden = es || hayNativo(window);
  if ($('mv-instalada')) $('mv-instalada').hidden = !es;
  if ($('mv-version')) $('mv-version').textContent = `Versión ${VERSION}.`;
  if ($('mv-sin-pc')) $('mv-sin-pc').hidden = !('sinPuente' in document.body.dataset);
  if (hayNativo(window)) {
    if ($('mv-nativo')) $('mv-nativo').hidden = false;
    if ($('mv-cerrada')) $('mv-cerrada').hidden = true;
  }
}

// ¿Hay un PC detrás (el puente de server.mjs) o solo ficheros (alojamiento web,
// app sin red)? Sin puente se esconde el bloque del código del PC, que no pinta nada.
async function hayPuente() {
  try {
    const r = await fetch('/api/red', { cache: 'no-store' });
    if (r.status === 401 || r.status === 429) return true;
    if (!r.ok) return false;
    const j = await r.json();
    return typeof j?.lan === 'boolean';
  } catch { return false; }
}

async function arrancar() {
  pintarBarra();
  const [main, puente] = await Promise.all([traerSimulador(), hayPuente()]);
  if (!puente) document.body.dataset.sinPuente = '';
  ponerEnPestanas(main);
  $('mv-app').replaceChildren(main);
  // 3. El cerebro: necesita que la página ya esté puesta.
  await import('../web/app.mjs');
  delete document.body.dataset.cargando;
  irA(recordar(CLAVE_PESTANA) ?? POR_DEFECTO);
  seguirBocadillo();
  seguirTeclado();
  tarjetaApp();
  sinConexion();
  conectarNativo({
    leer: () => {
      const pet = window.pacolo?.pet;
      if (!pet) return { avisos: [], foco: null };
      return {
        avisos: [
          ...pet.temporizadores.map((t) => ({ clase: 'temporizador', id: t.id, texto: t.etiqueta, fin: t.fin })),
          ...pet.recordatorios.map((r) => ({ clase: 'recordatorio', id: r.id, texto: r.texto, fin: r.fin })),
          ...(pet.alarmas ?? []).map((a) => ({ clase: 'alarma', id: a.id, texto: a.etiqueta, fin: a.fin })),
        ],
        foco: pet.foco,
      };
    },
  });
  window.tuloMovil = { version: VERSION, irA, instalada };
}

arrancar().catch((e) => {
  const c = $('mv-cargando') ?? $('mv-app');
  if (c) c.textContent = `Tulo no ha podido arrancar: ${e?.message ?? e}`;
  console.error(e);
});
