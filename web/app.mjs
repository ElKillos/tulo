// Simulador de Tulo: une el comportamiento (core/), la cara (face.mjs),
// los sonidos (sound.mjs) y el puente con el ordenador (server.mjs).

import {
  createPet, tick, actuar, reaccion, ponerTemporizador, ponerRecordatorio, ponerAlarma, pararAlarma, quitarAviso, avisosPendientes, expresionActual,
  empezarFoco, cancelarFoco, progresoFoco, empezarFocoVisto, acabarFocoVisto, FOCO_VISTO_MIN_BLOQUE, cuidar, tocaDormir, reiniciarCuidados, CUIDADOS,
} from '../core/pet.mjs';
import { EXPRESSION_NAMES } from '../core/expressions.mjs';
import { svg as svgFlor, ventana as ventanaFlor } from '../core/flor.mjs';
import { DIAMETRO_MM } from '../core/pantalla.mjs';
import { crearInclina, pasoInclina, gravedadDe, gravedadDelMovil } from '../core/inclina.mjs';
import { interpretar, normalizar, llamaPacolo, RE_NOMBRE } from '../core/intents.mjs';
import { proximaHora, decirDuracion, decirHora, moverADia, NOMBRES_DIAS } from '../core/tiempo.mjs';
import {
  createHabitos, crearHabito, buscarHabito, marcarHabito, borrarHabito, resumenDia, resumenSemana, habitosQueTocan, hecho, decirHabito, ICONOS,
} from '../core/habitos.mjs';
import {
  createTareas, anadirTarea, tareaIgual, completarTarea, borrarTarea, buscarTarea, tareasOrdenadas, pendientes, decirTarea, CATEGORIAS,
} from '../core/tareas.mjs';
import { RAREZAS, skin, FORMAS, idDe, sortearSkin } from '../core/skins.mjs';
import { COLORES, FAMILIAS } from '../core/colores.mjs';
import { MISIONES, BLOQUES_POR_CAJA, createProgreso, registrar, abrirCaja, equipar, migrarProgreso, estrenar } from '../core/progress.mjs';
import { crearPrimer } from '../core/primer.mjs';
import {
  createMercado, recargar, publicar, retirar, comprar, pasarMercado, vendibles, misAnuncios, anunciosDeOtros,
  netoDe, comisionDe, precioRef, euros, PRECIO_MIN, migrarMercado,
} from '../core/mercado.mjs';
import {
  DISTRACCIONES, createDistracciones, actualizarDistracciones, empezarDistraccion, posicion,
} from '../core/distracciones.mjs';
import { tonoDe, frase, afinacion } from '../core/tono.mjs';
import {
  createAparato, cambiarModo, tickAparato, tocarAparato, pasear, capacidades, cargando, enchufar, quienContesta, BATERIA_BAJA,
} from '../core/aparato.mjs';
import {
  createPomodoro, empezarPomodoro, acabarTrabajo, tickPomodoro, pararPomodoro, resumenPomodoro, DURACIONES, DURACIONES_PRUEBA,
} from '../core/pomodoro.mjs';
import { leerIcs, createCalendario, proximas, delDia, avisosCalendario, calendarioDeEjemplo } from '../core/calendario.mjs';
import { createBuzon, recibir, soltarGuardadas, decirNotificacion } from '../core/notificaciones.mjs';
import { leerMusica, baila, pasoDeBaile, cambioDeCancion, decirCancion } from '../core/musica.mjs';
import { vistaHabitos, vistaProgreso, vistaTareas, abrirVista, paginaEn, vigente } from '../core/vistas.mjs';
import { createFace } from './face.mjs';
import { createPrimer } from './primer.mjs';
import { tocar, ponerSonido } from './sound.mjs';
import { miradaDesdeCara, createPresencia, actualizarPresencia, LEVANTARSE_MS } from '../core/presencia.mjs';
import {
  nombrarGesto, createGestos, actualizarGestos, createSaludo, actualizarSaludo, manoAbierta, saludando, NUMERO_DE_GESTO, dedosEstirados,
  manoEnLaBoca, createBebida, actualizarBebida, createQuietud, actualizarQuietud,
} from '../core/gestos.mjs';
import { encenderCamara } from './camara.mjs';
// Abierto desde el móvil (PACOLO_LAN=1): código para el puente, sin cámara ni micro.
import { red } from './red.mjs';

const $ = (id) => document.getElementById(id);
const CLAVE_PET = 'pacolo.pet.v1';
const CLAVE_PIEL = 'pacolo.piel.v1';
const CLAVE_PROGRESO = 'pacolo.progreso.v1';
const CLAVE_SONIDO = 'pacolo.sonido.v1';
const CLAVE_DORMIR = 'pacolo.horaDormir.v1';
const CLAVE_MERCADO = 'pacolo.mercado.v1';
const CLAVE_APARATO = 'pacolo.aparato.v1';
const CLAVE_POMODORO = 'pacolo.pomodoro.v1';
const CLAVE_CALENDARIO = 'pacolo.calendario.v1';
const CLAVE_CONECTORES = 'pacolo.conectores.v1';
const CLAVE_HABITOS = 'pacolo.habitos.v1';
const CLAVE_TAREAS = 'pacolo.tareas.v1';
const CLAVE_MOVIL = 'pacolo.movil.v1';

function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: sigue sin memoria */ }
}

// --- Estado ---------------------------------------------------------------
const piel = { carcasa: '#e9e4d8', pantalla: '#101114', ...(leer(CLAVE_PIEL) ?? {}) };
const pet = createPet(Date.now());
const guardado = leer(CLAVE_PET);
if (guardado) {
  // Recupera a Tulo donde se quedó; el primer tick le pasa el tiempo que estuvo cerrado.
  for (const k of ['energia', 'saciedad', 'animo', 'dormido', 'ultimoTick']) {
    if (k in guardado) pet[k] = guardado[k];
  }
  // Los avisos guardan su instante exacto, así que sobreviven a cerrar la página.
  for (const k of ['temporizadores', 'recordatorios', 'alarmas']) {
    if (Array.isArray(guardado[k])) pet[k] = guardado[k];
  }
  if (guardado.siguienteId > 0) pet.siguienteId = guardado.siguienteId;
}
// migrar…: lo guardado antes de D-023 traía ids de skin de prueba («clasico»…).
// Sin nada guardado, este Tulo acaba de salir de fábrica: al abrir se ve el
// primer encendido y le tocan sus ojos (D-024).
const recienSalido = !leer(CLAVE_PROGRESO);
const progreso = migrarProgreso({ ...createProgreso(), ...(leer(CLAVE_PROGRESO) ?? {}) });
const mercado = migrarMercado(leer(CLAVE_MERCADO) ?? createMercado());
// Dónde está (D-014): en el stand o de llavero. Al abrir, el tiempo cerrado no
// gasta batería.
const aparato = { ...createAparato(Date.now()), ...(leer(CLAVE_APARATO) ?? {}), ultimoTick: Date.now(), ultimoToque: Date.now(), pantalla: true };
// Sin batería (D-017) sigue apagado al abrir, hasta que cargue en el stand.
if (aparato.apagado) aparato.pantalla = false;
// Conectores (12-nov, propuesta): pomodoro, calendario, notificaciones y música.
const pomodoro = { ...createPomodoro(), ...(leer(CLAVE_POMODORO) ?? {}) };
const calGuardado = leer(CLAVE_CALENDARIO);
// Las citas que se repiten salen entre ayer y dentro de 60 días (13-nov).
const calendario = createCalendario(calGuardado?.ics ? leerIcs(calGuardado.ics, { ahora: Date.now() }) : []);
calendario.avisados = calGuardado?.avisados ?? [];
let icsTexto = calGuardado?.ics ?? null;
let calLeido = Date.now(); // última vez que se pasó el .ics a citas
// Calendario de Google en vivo (13-nov): lo que dice el panel y cuándo se pidió.
let calGoogleEstado = null;
let calGooglePedido = 0;
// `calGoogleElegido`: alguien ya encendió o apagó el de Google a mano (15-nov):
// hasta entonces se enciende solo si el .env tiene la dirección.
const conectores = { noMolestar: true, verMusica: false, reposo: false, tema: 'oscuro', copiarAvisos: true, calGoogle: false, calGoogleElegido: false, ...(leer(CLAVE_CONECTORES) ?? {}) };
// Dónde se encienden las cosas: en la app de escritorio (la carga con su
// preload, que pone `window.pkApp`) es Ajustes; en el simulador, el panel de
// conectores. Antes las frases decían «panel de conectores» también en la app,
// donde no existe (15-nov).
const enLaApp = () => !!window.pkApp;
const dondeCalendario = () => (enLaApp() ? 'Ajustes → Calendario' : 'el panel de conectores');
const dondeMusica = () => (enLaApp() ? 'Ajustes → Pantalla y sentidos' : 'el panel de conectores');
// Funciones copiadas de Troko (D-020): hábitos, tareas y el móvil simulado.
const habitos = { ...createHabitos(), ...(leer(CLAVE_HABITOS) ?? {}) };
const tareas = { ...createTareas(), ...(leer(CLAVE_TAREAS) ?? {}) };
const movilChat = leer(CLAVE_MOVIL) ?? []; // [{ de: 'pacolo' | 'yo' | 'sistema', texto, hora }]
let ecoMovil = false; // mientras se atiende una orden que vino del móvil, la respuesta vuelve al móvil
let ultimoPitidoAlarma = 0;
let vistaAbierta = null; // lo que enseña a pantalla completa: { tipo, modo, desde, hasta }
const buzon = createBuzon();
buzon.noMolestar = conectores.noMolestar;
let musica = null; // lo último que dijo el puente de la música
let horaDormir = leer(CLAVE_DORMIR) ?? '23:30';
let avisadoDeDormir = false;
let fijada = null; // expresión fijada a mano desde el panel
let sonido = leer(CLAVE_SONIDO) ?? true;
ponerSonido(sonido);
const face = createFace($('pantalla'), piel);
// La carcasa es la flor de Jacobo y la cara se ve por su ventana en estrella.
{
  // El lienzo es la pantalla redonda entera (44,45 mm, core/pantalla.mjs),
  // un poco más grande que la ventana: lo que sobra lo tapa la carcasa.
  const v = ventanaFlor(DIAMETRO_MM);
  $('flor').innerHTML = svgFlor({ anilla: false }); // sin anilla en pantalla (Chief, 13-nov)
  Object.assign($('ventana').style, { left: v.left, top: v.top, width: v.width, height: v.height, clipPath: v.recorte });
  $('pantalla').style.width = v.cara;
}
face.setTema(conectores.tema);
face.setSkin(skin(progreso.equipada));

const hoy = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD, hora local

// --- Salida ---------------------------------------------------------------
function decir(texto) {
  // Si Tulo dice algo, la pantalla está encendida.
  if (tocarAparato(aparato, Date.now())) pintarAparato();
  $('bocadillo').textContent = texto;
  anotar(texto);
  if (ecoMovil) alMovil(texto);
}

// Apunta en el registro sin que Tulo diga nada.
function anotar(texto) {
  const li = document.createElement('li');
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const marca = document.createElement('time');
  marca.textContent = hora;
  li.append(marca, texto);
  $('registro').prepend(li);
}

const duracion = decirDuracion;

function reloj(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pintarPanel() {
  for (const k of ['energia', 'saciedad', 'animo']) {
    $(`m-${k}`).value = pet[k];
    $(`v-${k}`).textContent = Math.round(pet[k]);
  }
  $('cara').textContent = fijada ? `${fijada} (fijada)` : expresionActual(pet);
  const ahora = Date.now();
  pintarAvisos(ahora);
  $('foco-estado').textContent = pet.foco
    ? `Concentrados: quedan ${reloj(pet.foco.fin - ahora)}`
    : pet.focoVisto ? `Te veo concentrado: ${reloj(ahora - pet.focoVisto.inicio)}`
    : `Sin bloque en marcha · ${progreso.bloques} hechos, ${progreso.bloquesHoy} hoy, racha de ${progreso.racha} d`;
  $('cancelar-foco').disabled = !pet.foco;
  const nombres = { agua: 'Agua', estirar: 'Estirarse' };
  for (const [id, c] of Object.entries(pet.cuidados)) {
    const el = $(`e-${id}`);
    el.className = c.pendiente ? 'pide' : '';
    const faltan = Math.max(0, Math.ceil((CUIDADOS[id].cada - c.minutos) / pet.velocidad));
    el.textContent = c.pendiente
      ? `${nombres[id]}: te lo está pidiendo`
      : pet.dormido ? `${nombres[id]}: en pausa, duerme` : `${nombres[id]}: en ${faltan} min`;
  }
}

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const horaDe = (ms) => {
  const d = new Date(ms);
  return decirHora({ hora: d.getHours(), minuto: d.getMinutes() });
};

const REPITE = { diario: 'cada día', semanal: 'cada semana' };
function nombreAviso(a) {
  if (a.clase === 'temporizador') return a.texto ? `Temporizador de ${a.texto}` : 'Temporizador';
  if (a.clase === 'alarma') return `Alarma${a.texto ? `: ${a.texto}` : ''}${a.repite ? ` (${REPITE[a.repite]})` : ''}`;
  if (a.repite) return `${a.texto ? mayuscula(a.texto) : 'Aviso'} (${REPITE[a.repite]})`;
  return a.texto ? mayuscula(a.texto) : 'Aviso';
}

// La lista se rehace solo cuando cambian los avisos (así no se pierde un clic
// en la ✕); entre tanto se actualiza la cuenta atrás.
let avisosPintados = '';
function pintarAvisos(ahora) {
  const avisos = avisosPendientes(pet);
  $('temporizadores').textContent = avisos.length === 0 ? 'sin avisos' : avisos.length === 1 ? '1 aviso' : `${avisos.length} avisos`;
  const lista = $('avisos');
  const firma = avisos.map((a) => a.id).join(',');
  if (firma !== avisosPintados) {
    avisosPintados = firma;
    lista.replaceChildren();
    for (const a of avisos) {
      const li = document.createElement('li');
      li.dataset.clase = a.clase;
      const nombre = document.createElement('span');
      nombre.textContent = nombreAviso(a);
      const cuando = document.createElement('span');
      cuando.className = 'cuando';
      cuando.dataset.id = a.id;
      const quitar = document.createElement('button');
      quitar.textContent = '✕';
      quitar.dataset.quitar = a.id;
      quitar.setAttribute('aria-label', `Quitar: ${nombreAviso(a)}`);
      li.append(nombre, cuando, quitar);
      lista.append(li);
    }
  }
  for (const a of avisos) {
    const falta = a.fin - ahora;
    const texto = a.clase === 'temporizador' || falta < 3600000
      ? `quedan ${reloj(falta)}`
      : `a las ${horaDe(a.fin)}${new Date(a.fin).getDate() !== new Date(ahora).getDate() ? ' de mañana' : ''}`;
    lista.querySelector(`[data-id="${a.id}"]`).textContent = texto;
  }
}

function guardarPet() {
  guardar(CLAVE_PET, {
    energia: pet.energia, saciedad: pet.saciedad, animo: pet.animo, dormido: pet.dormido, ultimoTick: pet.ultimoTick,
    temporizadores: pet.temporizadores, recordatorios: pet.recordatorios, alarmas: pet.alarmas, siguienteId: pet.siguienteId,
  });
}

function pintarProgreso() {
  const lista = $('misiones');
  lista.replaceChildren();
  for (const m of MISIONES) {
    const li = document.createElement('li');
    const hecha = progreso.hechas.includes(m.id);
    li.className = hecha ? 'hecha' : '';
    li.textContent = `${hecha ? '✓' : '○'} ${m.texto}`;
    lista.append(li);
  }
  const resto = BLOQUES_POR_CAJA - (progreso.bloques % BLOQUES_POR_CAJA);
  const li = document.createElement('li');
  li.textContent = `↻ Cada ${BLOQUES_POR_CAJA} bloques, una caja (faltan ${resto})`;
  lista.append(li);

  $('cajas').textContent = progreso.cajas === 1 ? '1 caja' : `${progreso.cajas} cajas`;
  $('abrir-caja').disabled = progreso.cajas <= 0;

  // Solo las que tienes (D-023: con 44 colores, 3 formas y dos colores por
  // ojo hay miles; el catálogo entero se recorre con «Probar»).
  const rejilla = $('skins');
  rejilla.replaceChildren();
  const orden = Object.keys(RAREZAS);
  const tuyas = Object.keys(progreso.inventario).filter((id) => progreso.inventario[id] > 0 || id === progreso.equipada).map(skin)
    .sort((a, b) => orden.indexOf(b.rareza) - orden.indexOf(a.rareza) || a.nombre.localeCompare(b.nombre, 'es'));
  for (const s of tuyas) {
    const cuantas = progreso.inventario[s.id] ?? 0;
    const b = document.createElement('button');
    b.className = `skin rareza-${s.rareza}`;
    b.dataset.skin = s.id;
    b.disabled = cuantas === 0;
    b.setAttribute('aria-pressed', String(progreso.equipada === s.id));
    const muestra = document.createElement('span');
    muestra.className = 'muestra';
    muestra.style.background = s.css;
    const nombre = document.createElement('span');
    nombre.textContent = cuantas > 1 ? `${s.nombre} ×${cuantas}` : s.nombre;
    const rareza = document.createElement('small');
    rareza.textContent = cuantas === 0 && s.rareza === 'unica' ? 'Única · la reparte el servidor' : RAREZAS[s.rareza].nombre;
    b.append(muestra, nombre, rareza);
    rejilla.append(b);
  }
}

function aplicarPiel() {
  $('carcasa').style.setProperty('--pk-carcasa', piel.carcasa);
  $('carcasa').style.setProperty('--pk-pantalla', face.fondo);
  $('c-carcasa').value = piel.carcasa;
  $('c-pantalla').value = piel.pantalla;
}

function guardarProgreso() {
  guardar(CLAVE_PROGRESO, progreso);
  pintarProgreso();
  pintarMercado();
}

// --- Mercado de skins, simulado (D-005, D-008) ------------------------------
function muestraDe(s) {
  const m = document.createElement('span');
  m.className = 'muestra';
  m.style.background = s.css;
  return m;
}

function filaDeAnuncio(a, boton, dato) {
  const s = skin(a.skin);
  const li = document.createElement('li');
  li.className = `rareza-${s.rareza}`;
  const nombre = document.createElement('span');
  nombre.className = 'nombre';
  const detalle = document.createElement('small');
  detalle.textContent = a.vendedor === 'tu'
    ? `${RAREZAS[s.rareza].nombre} · cobrarías ${euros(netoDe(a.precio))}`
    : `${RAREZAS[s.rareza].nombre} · la vende ${a.vendedor}`;
  nombre.append(s.nombre, detalle);
  const precio = document.createElement('span');
  precio.className = 'precio';
  precio.textContent = euros(a.precio);
  const b = document.createElement('button');
  b.textContent = boton;
  b.dataset[dato] = a.id;
  if (dato === 'comprar' && mercado.saldo < a.precio) {
    b.disabled = true;
    b.title = `Te faltan ${euros(a.precio - mercado.saldo)}`;
  }
  li.append(muestraDe(s), nombre, precio, b);
  return li;
}

function pintarPrecioNeto() {
  const precio = Math.round(Number($('precio-venta').value.replace(',', '.')) * 100);
  $('neto-venta').textContent = precio >= PRECIO_MIN
    ? `Cobras ${euros(netoDe(precio))} · comisión ${euros(comisionDe(precio))}`
    : `Mínimo ${euros(PRECIO_MIN)}`;
}

function pintarMercado() {
  $('saldo').textContent = euros(mercado.saldo);
  $('mercado-cuentas').textContent = `${mercado.ventas} ${mercado.ventas === 1 ? 'venta' : 'ventas'} · ${mercado.compras} ${mercado.compras === 1 ? 'compra' : 'compras'} · comisiones cobradas por la plataforma: ${euros(mercado.comisiones)}`;

  // Qué puedes vender: todo lo que tengas, menos la copia que llevas puesta.
  const sel = $('skin-venta');
  const elegida = sel.value;
  sel.replaceChildren();
  for (const s of Object.keys(progreso.inventario).map(skin).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    const n = vendibles(progreso, s.id);
    if (n <= 0) continue;
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.nombre} (${RAREZAS[s.rareza].nombre.toLowerCase()}${n > 1 ? `, ×${n}` : ''})`;
    sel.append(o);
  }
  const hay = sel.options.length > 0;
  $('vender').disabled = !hay;
  $('precio-venta').disabled = !hay;
  if (!hay) {
    const o = document.createElement('option');
    o.textContent = 'Nada que vender: abre cajas';
    sel.append(o);
  } else if ([...sel.options].some((o) => o.value === elegida)) sel.value = elegida;
  else ponerPrecioOrientativo();
  pintarPrecioNeto();

  const mias = $('mis-anuncios');
  mias.replaceChildren(...misAnuncios(mercado).map((a) => filaDeAnuncio(a, 'Retirar', 'retirar')));
  if (!mias.children.length) {
    const li = document.createElement('li');
    li.className = 'vacio';
    li.textContent = 'No tienes nada a la venta.';
    mias.append(li);
  }
  $('anuncios').replaceChildren(...anunciosDeOtros(mercado)
    .sort((a, b) => a.precio - b.precio)
    .map((a) => filaDeAnuncio(a, 'Comprar', 'comprar')));
}

function ponerPrecioOrientativo() {
  const id = $('skin-venta').value;
  const ref = id ? precioRef(id) : null;
  if (ref) $('precio-venta').value = (ref / 100).toFixed(2).replace('.', ',');
}

function guardarMercado() {
  guardar(CLAVE_MERCADO, mercado);
  guardar(CLAVE_PROGRESO, progreso);
  pintarProgreso();
  pintarMercado();
}

// Hace una operación del mercado y cuenta lo que pasa; si no se puede, lo dice.
function enMercado(operacion) {
  try {
    const dicho = operacion();
    pitar('ok');
    decir(dicho);
  } catch (err) {
    tocar('no');
    decir(err.message);
  }
  guardarMercado();
}

// Los compradores inventados pasan cada pocos segundos.
function latidoDelMercado() {
  const eventos = pasarMercado(mercado);
  if (!eventos.length) return;
  for (const ev of eventos) {
    if (ev.tipo !== 'vendida') continue;
    reaccion(pet, 'feliz', Date.now());
    tocar('caja');
    decir(`Vendida: ${skin(ev.skin).nombre} a ${ev.comprador} por ${euros(ev.precio)}. Cobras ${euros(ev.neto)} (comisión ${euros(ev.comision)}).`);
  }
  guardarMercado();
}
setInterval(latidoDelMercado, 4000);

// Anuncia lo ganado al registrar un bloque o una caricia.
function premiar({ nuevas, cajaPorBloques }) {
  for (const m of nuevas) decir(`Misión cumplida: ${m.texto}. Ganas una caja.`);
  if (cajaPorBloques) decir(`${progreso.bloques} bloques. Ganas una caja.`);
  if (nuevas.length || cajaPorBloques) setTimeout(() => tocar('caja'), 500);
  guardarProgreso();
}

// --- Órdenes --------------------------------------------------------------
async function estadoEquipo() {
  reaccion(pet, 'pensando', Date.now(), 1500);
  try {
    const r = await fetch('/api/equipo');
    if (!r.ok) throw new Error(String(r.status));
    const e = await r.json();
    const cpu = e.cpuPct === null ? 'CPU aún sin medir' : `CPU al ${e.cpuPct} %`;
    const alta = e.cpuPct !== null && e.cpuPct > 85;
    reaccion(pet, alta ? 'sorpresa' : 'contento', Date.now());
    tocar(alta ? 'aviso' : 'ok');
    return `${cpu}, memoria al ${e.memoriaPct} % de ${String(e.memoriaTotalGB).replace('.', ',')} GB, encendido desde hace ${String(e.encendidoHoras).replace('.', ',')} h.`;
  } catch {
    reaccion(pet, 'triste', Date.now());
    tocar('no');
    return red.motivoSinPuente() ?? 'No llego al ordenador. ¿Está encendido el puente?';
  }
}

// El ánimo cambia cómo contesta (core/tono.mjs): la frase y lo agudo del pitido.
const dice = (clave) => frase(clave, tonoDe(pet));
const pitar = (nombre) => tocar(nombre, afinacion(tonoDe(pet)));

// Sin batería (D-017) no responde a nada: lo dice el registro, no Tulo.
function sinBateria() {
  if (!aparato.apagado) return false;
  anotar('(Sin batería: no responde. Ponle en el stand enchufado.)');
  return true;
}

function foco(segundos) {
  if (sinBateria()) return;
  if (pet.foco) {
    tocar('no');
    return decir('Ya estamos en un bloque.');
  }
  acabarConcentracionVista(Date.now());
  empezarFoco(pet, segundos, Date.now());
  pitar('ok');
  decir(`${dice('foco')} ${duracion(segundos)} de concentración.`);
}

function dejarFoco() {
  const conPomodoro = pararPomodoro(pomodoro);
  if (conPomodoro) guardarConectores();
  if (!cancelarFoco(pet, Date.now())) return decir(conPomodoro ? 'Pomodoro parado.' : 'No había ningún bloque.');
  tocar('triste');
  decir(conPomodoro ? 'Pomodoro parado a medias. Me quedo sin comer.' : 'Bloque cancelado. Me quedo sin comer.');
  contarGuardadas();
}

// --- Copiado de Troko (D-020): hábitos, tareas, móvil, pantalla --------------
const dosCifras = (n) => String(n).padStart(2, '0');
const hhmm = (h) => `${dosCifras(h.hora)}:${dosCifras(h.minuto)}`;
const diaMas = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

function guardarHabitos() {
  guardar(CLAVE_HABITOS, habitos);
  pintarHabitos();
}
function guardarTareas() {
  guardar(CLAVE_TAREAS, tareas);
  pintarTareas();
}

function nuevoHabito(i, ahora) {
  if (i.falta) return decir('¿Qué hábito? Dime, por ejemplo, «nuevo hábito leer 30 minutos a las 22».');
  let hora = null;
  if (i.hora) {
    const d = new Date(ahora);
    hora = hhmm(proximaHora(i.hora, { hora: d.getHours(), minuto: d.getMinutes() }));
  }
  try {
    const x = crearHabito(habitos, { titulo: mayuscula(i.titulo), objetivo: i.objetivo, hora, periodicidad: i.periodicidad, creado: hoy() });
    guardarHabitos();
    reaccion(pet, 'contento', ahora, 1500);
    pitar('ok');
    decir(`Hábito nuevo: ${decirHabito(x)}.${x.hora ? ' A esa hora te pregunto si lo has hecho.' : ''}`);
    mostrarVista('habitos', { dura: 8000 });
  } catch (e) {
    tocar('no');
    decir(e.message);
  }
}

function marcarHabitoUI(cual, si) {
  const dia = hoy();
  const antes = resumenDia(habitos, dia).completo;
  try {
    const r = marcarHabito(habitos, typeof cual === 'number' ? cual : String(cual), dia, si);
    guardarHabitos();
    const res = resumenDia(habitos, dia);
    if (si && r.todosHoy && !antes) {
      reaccion(pet, 'riendo', Date.now(), 3000);
      tocar('feliz');
      decir(`¡Todos los hábitos de hoy hechos (${res.total} de ${res.total})!`);
      mostrarVista('progreso', { dura: 6000 });
      premiar(registrar(progreso, 'dia-habitos', { dia }));
    } else if (si) {
      reaccion(pet, 'contento', Date.now(), 1500);
      pitar('ok');
      decir(`Hecho: ${r.habito.titulo}. Llevas ${res.hechos} de ${res.total} hoy.`);
    } else {
      decir(`Desmarcado: ${r.habito.titulo}. Llevas ${res.hechos} de ${res.total} hoy.`);
    }
  } catch (e) {
    tocar('duda');
    decir(e.message);
  }
}

function textoHabitos() {
  if (!habitos.lista.length) return 'No tienes hábitos. Di «nuevo hábito…» para empezar.';
  const dia = hoy();
  const r = resumenDia(habitos, dia);
  return `Hábitos (${r.hechos} de ${r.total} hoy): ${habitos.lista.map((x) => `${hecho(habitos, x, dia) ? '✓' : '○'} ${x.titulo}`).join(' · ')}`;
}

function textoProgreso(semana) {
  if (!habitos.lista.length) return 'No tienes hábitos todavía.';
  if (!semana) {
    const r = resumenDia(habitos, hoy());
    return `Hoy llevas ${r.hechos} de ${r.total} hábitos (${r.pct} %).`;
  }
  const s = resumenSemana(habitos, hoy());
  return `Últimos 7 días: ${s.pct} % de tus hábitos, ${s.completos} ${s.completos === 1 ? 'día completo' : 'días completos'}.`;
}

function nuevaTarea(i, ahora) {
  if (i.falta) return decir('¿Qué tarea? Dime, por ejemplo, «añade la tarea comprar pan mañana a las 5».');
  let dia = i.manana ? diaMas(1) : hoy();
  let hora = null;
  let fin = null;
  if (i.hora) {
    const d = new Date(ahora);
    const p = proximaHora(i.hora, { hora: d.getHours(), minuto: d.getMinutes(), segundo: d.getSeconds() }, { manana: i.manana });
    hora = hhmm(p);
    fin = ahora + p.segundos * 1000;
    dia = new Date(fin).toLocaleDateString('sv-SE');
  }
  const igual = tareaIgual(tareas, i.titulo);
  if (igual) { tocar('no'); return decir(`Ya la tenía apuntada: ${decirTarea(igual, hoy())}.`); }
  try {
    const x = anadirTarea(tareas, { titulo: mayuscula(i.titulo), dia, hora, categoria: i.categoria });
    if (fin) x.recordatorio = ponerRecordatorio(pet, fin, ahora, `Tarea: ${x.titulo}`).id;
    guardarTareas();
    guardarPet();
    pitar('ok');
    decir(`Apuntada: ${decirTarea(x, hoy())}.${fin ? ' Te aviso a esa hora.' : ''}`);
  } catch (e) {
    tocar('no');
    decir(e.message);
  }
}

function tareaHecha(cual) {
  try {
    const x = completarTarea(tareas, typeof cual === 'number' ? cual : String(cual));
    if (x.recordatorio) quitarAviso(pet, x.recordatorio);
    x.recordatorio = null;
    guardarTareas();
    guardarPet();
    reaccion(pet, 'contento', Date.now(), 1500);
    pitar('ok');
    const quedan = pendientes(tareas).length;
    decir(`Tachada: ${x.titulo}. ${quedan ? `Te ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`}.` : '¡No te queda ninguna!'}`);
  } catch (e) {
    tocar('duda');
    decir(e.message);
  }
}

// Un hábito por la raíz de un verbo: «leído» → «Leer», «meditado» → «Meditar».
function habitoPorVerbo(verbo) {
  const raiz = normalizar(String(verbo ?? '')).replace(/(ado|ido|ida|ada|to|cho)$/, '');
  if (raiz.length < 2) return null;
  return habitos.lista.find((x) => normalizar(x.titulo).split(' ').some((p) => p.startsWith(raiz))) ?? null;
}

// «¿Me queda algo por hacer?»: hábitos sin hacer, tareas y citas del día.
function textoPendiente(dia, solo) {
  const d = dia === 1 ? diaMas(1) : hoy();
  const habs = dia === 0 ? habitos.lista.filter((x) => !hecho(habitos, x, d)).map((x) => x.titulo.toLowerCase()) : [];
  if (solo === 'habitos') {
    if (!habitos.lista.length) return 'No tienes hábitos apuntados.';
    return habs.length ? `Te falta: ${unirY(habs)}.` : '¡No! Los tienes todos hechos hoy.';
  }
  const tars = tareas.lista.filter((x) => !x.hecha && (dia === 0 ? x.dia <= d : x.dia === d))
    .map((x) => `${x.titulo.toLowerCase()}${x.hora ? ` a las ${x.hora}` : ''}`);
  const citas = delDia(calendario, Date.now(), dia).filter((c) => c.fin > Date.now()).map((c) => (c.diaEntero ? c.titulo : `${c.titulo} a las ${horaCorta(c.inicio)}`));
  const todo = [...habs, ...tars, ...citas];
  if (dia === 1) return todo.length ? `Mañana: ${unirY(todo)}.` : 'Mañana no tienes nada apuntado.';
  return todo.length ? `Te queda: ${unirY(todo)}.` : 'Nada: lo tienes todo hecho por hoy.';
}
const unirY = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l.at(-1)}` : l[0] ?? '');

// «¿Tienes hambre?», «¿estás contento?»: con sus necesidades de verdad.
function comoEstoy(sobre) {
  const a = pet.animo;
  switch (sobre) {
    case 'hambre':
      return pet.saciedad < 30 ? '¡Sí! Tengo la tripa vacía. Concéntrate un rato y como.'
        : pet.saciedad < 60 ? 'Un poquito. Un bloque de foco me vendría bien.' : 'No, estoy lleno.';
    case 'sed':
      return pet.cuidados.agua?.pendiente ? 'Más que yo, tú: hace rato que no bebes.' : 'No, pero bebe tú, que se te olvida.';
    case 'sueno':
    case 'cansado':
      return pet.dormido ? 'Zzz.' : pet.energia < 30 ? 'Mucho. Se me cierran los ojos.' : 'No, estoy despierto del todo.';
    case 'frio':
    case 'calor':
      return 'Ni frío ni calor: soy de plástico.';
    case 'enfadado':
      return a < 25 ? 'Un poco… me tienes abandonado.' : 'No, contigo nunca.';
    case 'aburrido':
      return a < 50 ? 'Un poco. Hazme caso, anda.' : 'No, aquí contigo estoy bien.';
    default: // contento, feliz, bien, triste
      return a < 25 ? 'Pues no mucho, estoy triste.' : a < 50 ? 'Regular, un poco bajo de ánimo.'
        : a > 80 ? '¡Mucho! Estoy contentísimo.' : 'Bien, tranquilo.';
  }
}

function textoTareas() {
  const p = pendientes(tareas);
  if (!p.length) return 'No tienes tareas pendientes.';
  return `${p.length === 1 ? 'Tienes 1 tarea' : `Tienes ${p.length} tareas`}: ${p.slice(0, 5).map((x) => decirTarea(x, hoy())).join(' · ')}${p.length > 5 ? '…' : ''}`;
}

// --- Vistas en su pantalla (hábitos, progreso, tareas), como Troko ---
function mostrarVista(tipo, opciones = {}) {
  if (aparato.apagado) return;
  tocarAparato(aparato, Date.now());
  vistaAbierta = abrirVista(tipo, Date.now(), opciones);
}
function cerrarVista() {
  const habia = vigente(vistaAbierta, Date.now());
  vistaAbierta = null;
  return habia;
}
function vistaModelo(v, ahora) {
  if (v.tipo === 'habitos') return vistaHabitos(habitos, hoy(), paginaEn(v, ahora));
  if (v.tipo === 'progreso') return vistaProgreso(habitos, hoy(), v.modo);
  return vistaTareas(tareas, hoy(), paginaEn(v, ahora));
}

// --- Móvil simulado (D-020; la app de D-006 no existe) ---
function movilDisponible() {
  return aparato.modo === 'stand' || aparato.movilCerca;
}

function alMovil(texto, de = 'pacolo') {
  movilChat.push({ de, texto, hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) });
  movilChat.splice(0, Math.max(0, movilChat.length - 40));
  guardar(CLAVE_MOVIL, movilChat);
  pintarMovil();
}

function textoParaMovil(i) {
  if (i.que === 'tareas') return textoTareas();
  if (i.que === 'habitos') return textoHabitos();
  if (i.que === 'calendario') return decirCalendario({ cual: 'dia', dia: 0 });
  if (i.que === 'avisos') {
    const a = avisosPendientes(pet);
    return a.length ? `Avisos: ${a.map((x) => `${nombreAviso(x)} · ${horaDe(x.fin)}`).join(' · ')}` : 'No hay avisos en marcha.';
  }
  if (i.que === 'resumen') return resumenParaMovil();
  return `Nota: ${i.texto}`;
}

function resumenParaMovil() {
  const r = resumenDia(habitos, hoy());
  const a = avisosPendientes(pet)[0];
  return `Tulo · ánimo ${Math.round(pet.animo)} · hábitos ${r.hechos}/${r.total} · ${pendientes(tareas).length === 1 ? '1 tarea pendiente' : `${pendientes(tareas).length} tareas pendientes`}`
    + `${a ? ` · próximo aviso: ${nombreAviso(a)} a las ${horaDe(a.fin)}` : ''} · batería ${Math.round(aparato.bateria)} %`;
}

// Lo que escribes en el móvil: un mensaje sale en la pantalla de Tulo; si
// empieza por «/» es una orden (como el bot de Telegram de Troko) y la
// respuesta vuelve al móvil.
async function desdeMovil(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return;
  alMovil(t, 'yo');
  if (!movilDisponible()) return alMovil('(Tulo no está al alcance: de llavero y sin el móvil cerca.)', 'sistema');
  if (aparato.apagado) return alMovil('(Tulo está sin batería.)', 'sistema');
  if (t.startsWith('/')) {
    const orden = t.slice(1).trim();
    if (/^(estado|resumen)$/i.test(orden)) return alMovil(resumenParaMovil());
    if (/^ayuda$/i.test(orden)) return alMovil('Escribe sin «/» y sale en mi pantalla. Con «/» es una orden: /estado, /tareas, /hábitos, /recuérdame en 10 minutos sacar la ropa…');
    ecoMovil = true;
    try {
      await atender(orden, { origen: 'movil' });
    } finally {
      ecoMovil = false;
    }
    return;
  }
  reaccion(pet, 'feliz', Date.now(), 2500);
  tocar('feliz');
  decir(`📱 ${t}`);
  alMovil('✓ Lo ha visto', 'sistema');
}

// --- Pantalla: brillo y tema (D-020) ---
function ponerBrillo(b) {
  aparato.brillo = Math.max(10, Math.min(100, Math.round(Number(b) || 100)));
  aplicarBrillo();
  guardarAparato();
}
function aplicarBrillo() {
  // De 10 % a 100 %: el lienzo va de 0,4 a 1 de luminosidad.
  $('carcasa').style.setProperty('--brillo', String(0.4 + 0.6 * ((aparato.brillo ?? 100) - 10) / 90));
  $('brillo').value = aparato.brillo ?? 100;
  $('brillo-valor').textContent = `${aparato.brillo ?? 100} %`;
}
function ponerTema(t) {
  conectores.tema = t === 'claro' ? 'claro' : 'oscuro';
  face.setTema(conectores.tema);
  aplicarPiel();
  guardarConectores();
}

function pintarHabitos() {
  const dia = hoy();
  const r = resumenDia(habitos, dia);
  const s = resumenSemana(habitos, dia);
  $('habitos-anillo').style.setProperty('--pct', String(r.pct));
  $('habitos-pct').textContent = `${r.pct} %`;
  $('habitos-resumen').textContent = habitos.lista.length
    ? `Hoy ${r.hechos} de ${r.total} · últimos 7 días ${s.pct} % · ${s.completos} ${s.completos === 1 ? 'día completo' : 'días completos'}`
    : 'Sin hábitos. Añade uno o di «nuevo hábito leer 30 minutos a las 22».';
  $('habitos-semana').replaceChildren(...s.dias.map((d) => {
    const b = document.createElement('span');
    b.style.setProperty('--alto', `${Math.max(4, d.pct)}%`);
    b.title = `${d.dia}: ${d.hechos} de ${d.total}`;
    b.dataset.dia = new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'narrow' });
    return b;
  }));
  $('habitos-lista').replaceChildren(...habitos.lista.map((x) => {
    const li = document.createElement('li');
    const caja = document.createElement('input');
    caja.type = 'checkbox';
    caja.checked = hecho(habitos, x, dia);
    caja.dataset.habito = String(x.id);
    caja.setAttribute('aria-label', `Hecho hoy: ${x.titulo}`);
    const texto = document.createElement('span');
    texto.textContent = decirHabito(x);
    const quitar = document.createElement('button');
    quitar.textContent = '✕';
    quitar.dataset.borrarHabito = String(x.id);
    quitar.setAttribute('aria-label', `Borrar ${x.titulo}`);
    li.append(caja, texto, quitar);
    return li;
  }));
}

function pintarTareas() {
  const dia = hoy();
  $('tareas-lista').replaceChildren(...tareasOrdenadas(tareas).map((x) => {
    const li = document.createElement('li');
    const caja = document.createElement('input');
    caja.type = 'checkbox';
    caja.checked = x.hecha;
    caja.dataset.tarea = String(x.id);
    caja.setAttribute('aria-label', `Hecha: ${x.titulo}`);
    const texto = document.createElement('span');
    texto.textContent = decirTarea(x, dia);
    if (x.hecha) texto.style.textDecoration = 'line-through';
    const quitar = document.createElement('button');
    quitar.textContent = '✕';
    quitar.dataset.borrarTarea = String(x.id);
    quitar.setAttribute('aria-label', `Borrar ${x.titulo}`);
    li.append(caja, texto, quitar);
    return li;
  }));
  const nPend = pendientes(tareas).length;
  $('tareas-resumen').textContent = tareas.lista.length ? `${nPend} ${nPend === 1 ? 'pendiente' : 'pendientes'} de ${tareas.lista.length}` : 'Sin tareas.';
}

function pintarMovil() {
  $('movil-chat').replaceChildren(...movilChat.slice(-12).map((m) => {
    const li = document.createElement('li');
    li.className = `burbuja ${m.de}`;
    li.textContent = m.texto;
    const h = document.createElement('time');
    h.textContent = m.hora;
    li.append(h);
    return li;
  }));
  $('movil-chat').scrollTop = $('movil-chat').scrollHeight;
  $('movil-estado').textContent = movilDisponible() ? 'Conectado con Tulo.' : 'Tulo no está al alcance (de llavero y sin el móvil cerca).';
}

// --- Conectores (propuesta, 12-nov) -------------------------------------------
function guardarConectores() {
  guardar(CLAVE_POMODORO, pomodoro);
  guardar(CLAVE_CALENDARIO, icsTexto ? { ics: icsTexto, avisados: calendario.avisados.slice(-200) } : null);
  guardar(CLAVE_CONECTORES, conectores);
  pintarConectores();
  pintarPantallaVoz();
}

function arrancarPomodoro(dur = DURACIONES) {
  if (sinBateria()) return;
  if (pet.foco) {
    tocar('no');
    return decir(pomodoro.activo ? 'Ya estamos en un pomodoro.' : 'Ya estamos en un bloque.');
  }
  const f = empezarPomodoro(pomodoro, Date.now(), dur);
  acabarConcentracionVista(Date.now());
  empezarFoco(pet, f.segundos, Date.now());
  pitar('ok');
  decir(`Pomodoro: ${duracion(f.segundos)} de trabajo y luego ${duracion(dur.corto)} de descanso. Tanda 1.`);
  guardarConectores();
}

function estadoPomodoro() {
  const r = resumenPomodoro(pomodoro, Date.now());
  if (!r) return 'No hay ningún pomodoro en marcha.';
  const queda = reloj(r.quedaMs);
  return r.fase === 'trabajo'
    ? `Tanda ${r.tanda} de ${r.de}: quedan ${queda} de trabajo. Llevas ${r.hechos} ${r.hechos === 1 ? "hecho" : "hechos"}.`
    : `Descanso${r.fase === 'largo' ? ' largo' : ''}: quedan ${queda}. Llevas ${r.hechos} ${r.hechos === 1 ? "hecho" : "hechos"}.`;
}

// Las notificaciones guardadas durante un bloque, al acabarlo.
function contarGuardadas() {
  const g = soltarGuardadas(buzon);
  if (g) decir(g.frase);
  pintarConectores();
}

const horaCorta = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const nombreCita = (c) => (c.diaEntero ? `todo el día: ${c.titulo}` : `${horaCorta(c.inicio)} ${c.titulo}`);

function decirCalendario(i) {
  // Sin nada leído: si el de Google está encendido, se dice por qué no llega (falta
  // el .env, Google da error…); si no, dónde se enciende. Leído y vacío, sigue abajo.
  if (!calendario.citas.length && !icsTexto) {
    if (!conectores.calGoogle) return `No tengo tu calendario. Enciéndelo en ${dondeCalendario()}.`;
    return calGoogleEstado && !/^Pidiendo/.test(calGoogleEstado) ? `No tengo tu calendario. ${calGoogleEstado}` : 'Estoy pidiendo tu calendario. Pregúntamelo en un momento.';
  }
  const ahora = Date.now();
  if (i.cual === 'proxima') {
    const c = proximas(calendario, ahora, 5).find((x) => !x.diaEntero);
    if (!c) return 'No tienes nada más con hora.';
    if (c.inicio <= ahora) return `Ahora mismo: ${c.titulo}.`;
    return `Lo próximo: ${c.titulo}, a las ${horaCorta(c.inicio)}${c.lugar ? ` (${c.lugar})` : ''}.`;
  }
  const lista = delDia(calendario, ahora, i.dia ?? 0);
  const cuando = i.dia === 1 ? 'Mañana' : 'Hoy';
  if (!lista.length) return `${cuando} no tienes nada en el calendario.`;
  return `${cuando}: ${lista.map(nombreCita).join('; ')}.`;
}

function cargarIcs(texto, origen) {
  // Un fichero a mano manda: el de Google se apaga para que no lo pise.
  if (conectores.calGoogle) { conectores.calGoogle = false; calGoogleEstado = null; }
  conectores.calGoogleElegido = true; // y no se vuelve a encender solo al abrir
  const citas = leerIcs(texto, { ahora: Date.now() });
  calendario.citas = citas;
  calendario.avisados = [];
  icsTexto = texto;
  calLeido = Date.now();
  guardarConectores();
  decir(citas.length ? `Calendario cargado (${origen}): ${citas.length} citas.` : 'Ese fichero no tiene citas que entienda.');
}

// --- Calendario de Google en vivo (13-nov) --------------------------------------
// El puente descarga la «dirección secreta en formato iCal» que Chief pone en
// el .env (GET /api/calendario). PROPUESTA: recargar cada 10 min.
const RECARGA_CAL_MS = 10 * 60000;

async function leerCalendarioGoogle({ forzar = false, avisar = false } = {}) {
  calGooglePedido = Date.now();
  let r;
  let d = null;
  try {
    r = await fetch(`/api/calendario${forzar ? '?forzar=1' : ''}`);
    d = await r.json().catch(() => null);
  } catch {
    r = null;
  }
  if (!conectores.calGoogle) return; // se apagó mientras descargaba
  if (!r || !d) {
    calGoogleEstado = red.motivoSinPuente() ?? (r?.status === 404
      ? 'El puente no tiene /api/calendario: reinícialo (node server.mjs).'
      : 'No llego al puente. ¿Está encendido?');
  } else if (!r.ok || !d.ics) {
    // En la app instalada no hay .env.example: se manda a la ayuda de Ajustes (15-nov).
    calGoogleEstado = d.error === 'sin-config' && enLaApp()
      ? 'Falta la dirección de tu calendario en el fichero .env. Los pasos, en Ajustes → Calendario → «Cómo se conecta».'
      : d.mensaje ?? d.error ?? `Error ${r.status}.`;
  } else {
    calendario.citas = leerIcs(d.ics, { ahora: Date.now() });
    // `avisados` se conserva: recargar no repite avisos ya dados.
    icsTexto = d.ics;
    calLeido = Date.now();
    calGoogleEstado = `Google Calendar, leído a las ${horaCorta(d.descargado)}${d.aviso ? `. ${d.aviso}` : ''}.`;
    guardarConectores();
    if (avisar) decir(`Calendario de Google: ${calendario.citas.length} citas de aquí a 60 días.`);
    return;
  }
  if (avisar) decir(calGoogleEstado);
  pintarConectores();
}

setInterval(() => {
  const ahora = Date.now();
  if (conectores.calGoogle) {
    if (ahora - calGooglePedido >= RECARGA_CAL_MS && !aparato.apagado && capacidades(aparato).ordenador) leerCalendarioGoogle();
  } else if (icsTexto && ahora - calLeido >= 3600000) {
    // Un .ics cargado a mano: cada hora se vuelve a mirar qué repeticiones tocan.
    calendario.citas = leerIcs(icsTexto, { ahora });
    calLeido = ahora;
  }
}, 30000);

async function accionMusica(accion) {
  if (!conectores.verMusica) return decir(`Enciende «Ver la música del PC» en ${dondeMusica()}.`);
  if (red.motivoSinPuente()) return decir(red.motivoSinPuente());
  if (!capacidades(aparato).ordenador) return decir('De llavero no tengo el ordenador cerca.');
  if (accion === 'que_suena') {
    await leerMusicaDelPuente();
    return decir(decirCancion(musica));
  }
  try {
    const r = await fetch(`/api/musica/${accion}`, { method: 'POST' }).then((x) => x.json());
    musica = leerMusica(r);
    pintarConectores();
    if (r.error === 'sin-sesion') return decir('No suena nada en el ordenador.');
    if (r.error) return decir(`No he podido tocar la música (${r.error}).`);
    pitar('ok');
    decir(decirCancion(musica));
  } catch {
    decir('El puente con el ordenador no contesta.');
  }
}

function atenderCuidado(cual) {
  const pedia = cuidar(pet, cual, Date.now());
  if (!pedia) {
    pitar('ok');
    return decir('Apuntado. Empiezo a contar otra vez.');
  }
  tocar('feliz');
  decir(CUIDADOS[cual].gracias);
  premiar(registrar(progreso, 'cuidado'));
}

// La hora la conoce el simulador, no el comportamiento: aquí se le dice a
// Tulo si ya es tarde.
function mirarLaHora() {
  const d = new Date();
  const [h, m] = horaDormir.split(':').map(Number);
  pet.tarde = tocaDormir(d.getHours() + d.getMinutes() / 60, h + m / 60);
  if (!pet.tarde) avisadoDeDormir = false;
  else if (!avisadoDeDormir && !pet.dormido && !pet.foco) {
    avisadoDeDormir = true;
    tocar('dormir');
    decir('Es tarde. ¿Nos vamos a dormir?');
  }
}

function caja() {
  if (progreso.cajas <= 0) {
    tocar('no');
    return decir('No tienes cajas. Se ganan con misiones.');
  }
  const s = abrirCaja(progreso);
  reaccion(pet, s.rareza === 'comun' ? 'feliz' : 'sorpresa', Date.now(), 3500);
  tocar('caja');
  const repetida = progreso.inventario[s.id] > 1 ? ' (repetida)' : '';
  decir(`Caja abierta: ${s.nombre}, ${RAREZAS[s.rareza].nombre.toLowerCase()}${repetida}.`);
  guardarProgreso();
}

// --- Temporizadores y recordatorios ---------------------------------------
function recordar(i, ahora) {
  if (i.falta === 'cuando') {
    reaccion(pet, 'pensando', ahora, 2500);
    tocar('duda');
    return decir('¿Cuándo? Dímelo entero, con la hora o con dentro de cuánto.');
  }
  const { fin, cuando } = cuandoDe(i, ahora);
  ponerRecordatorio(pet, fin, ahora, i.texto, i.repite ?? null);
  guardarPet();
  reaccion(pet, 'contento', ahora, 1500);
  pitar('ok');
  decir(i.texto ? `${dice('vale')} ${cuando} te recuerdo: ${i.texto}.` : `${dice('vale')} ${cuando} te aviso.`);
}

// Cuándo salta un aviso dicho con duración o con hora, y cómo decirlo. Con
// repetición (D-020): «cada día a las 8», «cada lunes a las 9».
function cuandoDe(i, ahora) {
  if (i.segundos) return { fin: ahora + i.segundos * 1000, cuando: `En ${duracion(i.segundos)}` };
  const d = new Date(ahora);
  const p = proximaHora(i.hora, { hora: d.getHours(), minuto: d.getMinutes(), segundo: d.getSeconds() }, { manana: i.manana, periodo: i.periodo });
  let fin = ahora + p.segundos * 1000;
  if (i.diaSemana !== undefined) fin = moverADia(fin, i.diaSemana);
  if (i.repite === 'diario') return { fin, cuando: `Cada día a las ${decirHora(p)}` };
  if (i.repite === 'semanal') return { fin, cuando: `Cada ${NOMBRES_DIAS[new Date(fin).getDay()]} a las ${decirHora(p)}` };
  if (i.diaSemana !== undefined) return { fin, cuando: `El ${NOMBRES_DIAS[i.diaSemana]} a las ${decirHora(p)}` };
  return { fin, cuando: `${p.manana ? 'Mañana a' : 'A'} las ${decirHora(p)}` };
}

// Alarma (D-020): suena hasta que la paras.
function alarmar(i, ahora) {
  const { fin, cuando } = cuandoDe(i, ahora);
  ponerAlarma(pet, fin, ahora, i.etiqueta ?? '', i.repite ?? null);
  guardarPet();
  reaccion(pet, 'contento', ahora, 1500);
  pitar('ok');
  decir(`${dice('vale')} Alarma: ${cuando.charAt(0).toLowerCase()}${cuando.slice(1)}. Sonará hasta que me digas «para la alarma».`);
}

// 14-nov: cada aviso sale también como evento de la página, para que la app de
// escritorio lo despliegue en el notch con botones (escritorio/inyectado.js).
// El simulador no lo usa: si nadie escucha, no pasa nada.
function avisarFuera(detalle) {
  try { window.dispatchEvent(new CustomEvent('pk-aviso', { detail: detalle })); } catch { /* sin página */ }
}
// Posponer un aviso que acaba de sonar: vuelve dentro de `minutos` con el mismo
// texto. La alarma se calla y se vuelve a poner; lo demás vuelve como recordatorio.
function posponerAviso(tipo, etiqueta = '', minutos = 5) {
  const ahora = Date.now();
  const fin = ahora + minutos * 60000;
  if (tipo === 'alarma') { callarAlarma(); ponerAlarma(pet, fin, ahora, etiqueta); }
  else ponerRecordatorio(pet, fin, ahora, etiqueta || (tipo === 'temporizador' ? 'el temporizador' : ''));
  guardarPet();
  tocar('ok');
  decir(`Vale, te lo recuerdo a las ${horaDe(fin)}.`);
}

function callarAlarma() {
  const s = pararAlarma(pet);
  if (s) {
    tocar('ok');
    $('parar-alarma').hidden = true;
    decir('Alarma apagada.');
    return true;
  }
  return false;
}

// «a las 9:00», «mañana a las 9:00» o «el lunes a las 9:00».
function cuandoEs(fin, ahora) {
  const dias = Math.round((new Date(fin).setHours(0, 0, 0, 0) - new Date(ahora).setHours(0, 0, 0, 0)) / 86400000);
  if (dias === 0) return `a las ${horaDe(fin)}`;
  if (dias === 1) return `mañana a las ${horaDe(fin)}`;
  return `el ${NOMBRES_DIAS[new Date(fin).getDay()]} a las ${horaDe(fin)}`;
}

function listarAvisos(ahora) {
  const avisos = avisosPendientes(pet);
  if (!avisos.length && !pet.foco) return decir('No tienes ningún aviso en marcha.');
  const partes = avisos.map((a) => (a.clase === 'temporizador'
    ? `${nombreAviso(a).toLowerCase()}, quedan ${duracion(Math.ceil((a.fin - ahora) / 1000))}`
    : `${nombreAviso(a).toLowerCase()}, ${cuandoEs(a.fin, ahora)}`));
  if (pet.foco) partes.unshift(`bloque de concentración, quedan ${reloj(pet.foco.fin - ahora)}`);
  const deHoy = pendientes(tareas, hoy());
  if (deHoy.length) partes.push(`tareas de hoy: ${deHoy.map((x) => x.titulo).join(', ')}`);
  decir(`${mayuscula(partes.join(' · '))}.`);
}

function cancelarAviso(i) {
  const avisos = avisosPendientes(pet);
  if (!avisos.length) return decir('No había ningún aviso.');
  let elegidos;
  if (i.todos) elegidos = avisos;
  else if (i.cual) {
    const busca = normalizar(i.cual);
    elegidos = avisos.filter((a) => normalizar(a.texto).includes(busca));
    if (!elegidos.length) {
      tocar('duda');
      return decir(`No encuentro ningún aviso de «${i.cual}».`);
    }
  } else if (avisos.length === 1) elegidos = avisos;
  else {
    tocar('duda');
    return decir(`¿Cuál? Tienes ${avisos.length}: ${avisos.map((a) => nombreAviso(a).toLowerCase()).join(', ')}.`);
  }
  for (const a of elegidos) quitarAviso(pet, a.id);
  guardarPet();
  pitar('ok');
  decir(elegidos.length === 1 ? `Quitado: ${nombreAviso(elegidos[0]).toLowerCase()}.` : `Quitados ${elegidos.length} avisos.`);
}

// Modelo de lenguaje local por el puente (POST /api/modelo, que llama a Ollama).
// Devuelve una intención ya validada en core/modelo.mjs, o la `desconocida`
// de entrada si no hay modelo. Si no está, no se vuelve a preguntar en 60 s.
// La última respuesta queda en window.pacolo.modelo para mirarla en la consola.
let modeloNoEstaDesde = 0;

// Lo que Tulo sabe ahora mismo, para el modelo (core/modelo.mjs lo pasa a
// frases y lo recorta).
function contextoParaModelo() {
  const ahora = Date.now();
  const dia = hoy();
  return {
    animo: pet.animo, saciedad: pet.saciedad, energia: pet.energia,
    pide: Object.entries(pet.cuidados).filter(([, c]) => c.pendiente).map(([id]) => id),
    foco: pet.foco ? reloj(pet.foco.fin - ahora) : null,
    modo: aparato.modo, bateria: aparato.bateria,
    habitos: habitos.lista.map((x) => ({ titulo: x.titulo, objetivo: x.objetivo, hecho: hecho(habitos, x, dia) })),
    tareas: pendientes(tareas).map((x) => ({ titulo: x.titulo, cuando: decirTarea(x, dia).split(' · ')[1] ?? '' })),
    avisos: avisosPendientes(pet).map((a) => `${nombreAviso(a)}, ${cuandoEs(a.fin, ahora)}`),
  };
}

async function preguntarAlModelo(i) {
  if (Date.now() - modeloNoEstaDesde < 60000) return i;
  reaccion(pet, 'pensando', Date.now(), 20000);
  try {
    const r = await fetch('/api/modelo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: i.texto, contexto: contextoParaModelo() }) });
    const j = await r.json().catch(() => ({}));
    if (window.pacolo) window.pacolo.modelo = { estado: r.status, ...j };
    if (r.status === 503 || r.status === 404) modeloNoEstaDesde = Date.now();
    if (!r.ok || !j.intencion) return i;
    anotar(`(Lo contesta el modelo local, ${j.modelo}, en ${(j.ms / 1000).toFixed(1)} s.)`);
    return j.intencion;
  } catch {
    modeloNoEstaDesde = Date.now();
    return i;
  }
}

// Le han llamado por su nombre: sale del reposo con su pitido y su cara, sin
// decir nada (lo que toca decir lo dice quien atiende la orden). La app de
// escritorio lo usa cuando la orden la atiende ella (`window.pacolo.despertar`, 15-nov).
function salirDelReposo({ anotarlo = true } = {}) {
  if (!conectores.reposo) return false;
  conectores.reposo = false;
  guardarConectores();
  tocar('escucha');
  reaccion(pet, 'escucha', Date.now(), 1500);
  if (anotarlo) anotar('(Sale del reposo.)');
  return true;
}

async function atender(texto, { origen = 'voz' } = {}) {
  if (sinBateria()) return;
  // Modo reposo (D-020): solo atiende si le llaman por su nombre. Lo del móvil
  // no pasa por el micrófono, así que no le afecta.
  if (conectores.reposo && origen !== 'movil') {
    if (!llamaPacolo(texto)) {
      anotar('(En reposo: solo atiende si le llamas «Tulo».)');
      return;
    }
    salirDelReposo();
    if (!String(texto).replace(RE_NOMBRE, '').trim()) return decir('¡Aquí estoy! ¿Qué quieres?');
  }
  let i = interpretar(texto);
  // Lo que las reglas no entienden, al modelo local del ordenador (solo en el
  // stand, D-019). Sin modelo sigue siendo `desconocida`, como antes.
  if (i.tipo === 'desconocida' && quienContesta(aparato) === 'ordenador') i = await preguntarAlModelo(i);
  const ahora = Date.now();
  switch (i.tipo) {
    case 'vacia':
      return;
    case 'charla':
      reaccion(pet, 'contento', ahora, 1500);
      tocar('ok');
      return decir(i.respuesta);
    case 'foco':
      return foco(i.segundos);
    case 'cancelar_foco':
      return dejarFoco();
    case 'pomodoro':
      if (i.accion === 'empezar') return arrancarPomodoro();
      if (i.accion === 'parar') return pomodoro.activo ? dejarFoco() : decir('No hay ningún pomodoro en marcha.');
      return decir(estadoPomodoro());
    case 'calendario':
      return decir(decirCalendario(i));
    case 'notificaciones':
      return decir(buzon.lista.length
        ? `Las últimas: ${buzon.lista.slice(0, 3).map(decirNotificacion).join(' · ')}`
        : 'No ha llegado ninguna notificación.');
    case 'no_molestar':
      buzon.noMolestar = conectores.noMolestar = i.activar;
      guardarConectores();
      return decir(i.activar ? 'No molestar: en los bloques guardo las notificaciones para después.' : 'Te aviso de todo al momento, aunque estés concentrado.');
    case 'musica':
      return accionMusica(i.accion);
    case 'abrir_caja':
      return caja();
    case 'cuidado':
      return atenderCuidado(i.cual);
    case 'temporizador':
      ponerTemporizador(pet, i.segundos, ahora, i.etiqueta ?? '');
      guardarPet();
      reaccion(pet, 'contento', ahora, 1500);
      pitar('ok');
      return decir(i.etiqueta
        ? `${dice('vale')} Temporizador de ${i.etiqueta}: ${duracion(i.segundos)}.`
        : `${dice('vale')} Te aviso en ${duracion(i.segundos)}.`);
    case 'recordatorio':
      return recordar(i, ahora);
    case 'alarma':
      return alarmar(i, ahora);
    case 'parar_alarma': {
      if (callarAlarma()) return;
      const prox = avisosPendientes(pet).find((a) => a.clase === 'alarma');
      if (!prox) return decir('No hay ninguna alarma.');
      quitarAviso(pet, prox.id);
      guardarPet();
      return decir(`Quitada la alarma de las ${horaDe(prox.fin)}.`);
    }
    case 'habito_nuevo':
      return nuevoHabito(i, ahora);
    case 'habito_deshacer':
      return marcarHabitoUI(i.cual, false);
    case 'habito_borrar':
      try {
        const x = borrarHabito(habitos, i.cual);
        guardarHabitos();
        return decir(`Hábito borrado: ${x.titulo}.`);
      } catch (e) {
        return decir(`${e.message}`);
      }
    case 'habitos':
      mostrarVista('habitos');
      return decir(textoHabitos());
    case 'habitos_progreso':
      mostrarVista('progreso', { modo: i.semana ? 'semana' : 'hoy' });
      return decir(textoProgreso(i.semana));
    case 'cerrar_vista':
      return cerrarVista() ? pitar('ok') : decir('No estaba enseñando nada.');
    case 'pendiente':
      return decir(textoPendiente(i.dia ?? 0, i.solo));
    case 'pregunta_hecho': {
      const x = habitoPorVerbo(i.verbo);
      if (!x) return decir('Eso no lo tengo entre tus hábitos.');
      return decir(hecho(habitos, x, hoy()) ? `Sí, «${x.titulo}» ya está hecho hoy.` : `Todavía no: «${x.titulo}» está sin hacer.`);
    }
    case 'hecho':
      if (i.verbo && habitoPorVerbo(i.verbo)) return marcarHabitoUI(habitoPorVerbo(i.verbo).id, true);
      if (buscarHabito(habitos, i.cual)) return marcarHabitoUI(i.cual, true);
      if (buscarTarea(tareas, i.cual)) return tareaHecha(i.cual);
      tocar('duda');
      return decir(`No encuentro «${i.cual}» ni en tus hábitos ni en tus tareas.`);
    case 'tarea_nueva':
      return nuevaTarea(i, ahora);
    case 'tarea_hecha':
      return tareaHecha(i.cual);
    case 'tarea_borrar':
      try {
        const x = borrarTarea(tareas, i.cual);
        if (x.recordatorio) quitarAviso(pet, x.recordatorio);
        guardarTareas();
        return decir(`Tarea borrada: ${x.titulo}.`);
      } catch (e) {
        return decir(e.message);
      }
    case 'tareas':
      mostrarVista('tareas');
      return decir(textoTareas());
    case 'reposo':
      conectores.reposo = true;
      guardarConectores();
      tocar('dormir');
      return decir('Reposo: dejo de escuchar. Llámame «Tulo» cuando me necesites.');
    case 'brillo': {
      const b = i.valor ?? { subir: (aparato.brillo ?? 100) + 20, bajar: (aparato.brillo ?? 100) - 20, max: 100, min: 10 }[i.cambio];
      ponerBrillo(b);
      pitar('ok');
      return decir(`Brillo al ${aparato.brillo} %.`);
    }
    case 'tema':
      ponerTema(i.tema);
      pitar('ok');
      return decir(i.tema === 'claro' ? 'Tema claro.' : 'Tema oscuro.');
    case 'al_movil':
      if (!movilDisponible()) return decir('No tengo el móvil a mano.');
      alMovil(textoParaMovil(i));
      pitar('ok');
      return decir('Enviado al móvil.');
    case 'risa':
      reaccion(pet, 'riendo', ahora, 2500);
      tocar('feliz');
      return decir('¡Jajaja!');
    case 'mimo':
      reaccion(pet, 'enamorado', ahora, 3000);
      pet.animo = Math.min(100, pet.animo + 3);
      tocar('carino');
      return decir('¡Yo también te quiero!');
    case 'avisos':
      return listarAvisos(ahora);
    case 'cancelar_aviso':
      return cancelarAviso(i);
    case 'estado_equipo':
      if (!capacidades(aparato).ordenador) {
        tocar('duda');
        return decir('De llavero no tengo el ordenador cerca.');
      }
      return decir(await estadoEquipo());
    case 'hora':
      reaccion(pet, 'contento', ahora, 1500);
      pitar('ok');
      return decir(`Son las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`);
    case 'accion':
      return hacer(i.accion);
    case 'saludo':
      if (pet.dormido) return decir('Zzz.');
      reaccion(pet, 'feliz', ahora);
      tocar('feliz');
      return decir(dice('saludo'));
    case 'como_estas':
      if (i.sobre && !pet.dormido) return decir(comoEstoy(i.sobre));
      return decir(pet.dormido ? 'Zzz.' : dice('como_estas'));
    default:
      reaccion(pet, 'pensando', ahora, 3000);
      tocar('duda');
      // D-019: de llavero se lo pasa al móvil. Ni la app ni el modelo existen aún.
      if (quienContesta(aparato) === 'movil') {
        alMovil(`Tulo pregunta: «${i.texto}». Aquí contestaría la app (falta el modelo de lenguaje).`);
        return decir('Se lo paso al móvil… pero la app aún no existe: me falta el modelo de lenguaje.');
      }
      if (quienContesta(aparato) === 'sin-movil') return decir('Eso no lo sé, y no tengo el móvil cerca. Pregúntamelo con el móvil al lado.');
      return decir(dice('desconocida'));
  }
}

const SONIDO_DE_ACCION = { acariciar: 'carino', dormir: 'dormir', despertar: 'ok', agitar: 'mareo' };

function hacer(accion) {
  if (sinBateria()) return;
  if (accion === 'agitar') {
    const c = $('carcasa');
    c.classList.remove('agitada');
    void c.offsetWidth; // reinicia la animación
    c.classList.add('agitada');
  }
  const estabaDormido = pet.dormido;
  decir(actuar(pet, accion, Date.now()));
  tocar(SONIDO_DE_ACCION[accion]);
  if (accion === 'acariciar' && !estabaDormido) premiar(registrar(progreso, 'caricia'));
}

// --- Micrófono (D-011): escucha órdenes, no contesta hablando --------------
const Reconocedor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
let escuchando = null;

function escuchar() {
  if (escuchando) return escuchando.stop();
  if (sinBateria()) return;
  const rec = new Reconocedor();
  rec.lang = 'es-ES';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onstart = () => {
    escuchando = rec;
    $('hablar').setAttribute('aria-pressed', 'true');
    reaccion(pet, 'escucha', Date.now(), 15000);
    tocar('escucha');
  };
  rec.onresult = (ev) => {
    const texto = ev.results[0][0].transcript;
    decir(`He oído: «${texto}»`);
    atender(texto);
  };
  rec.onerror = (ev) => {
    const motivos = {
      'not-allowed': 'No tengo permiso para usar el micrófono.',
      'service-not-allowed': 'Este navegador no deja usar el reconocimiento de voz.',
      'no-speech': 'No he oído nada.',
      'audio-capture': 'No encuentro ningún micrófono.',
      network: 'El reconocimiento de voz no funciona en este navegador. Prueba en Chrome.',
    };
    tocar('no');
    decir(motivos[ev.error] ?? `No he podido escuchar (${ev.error}).`);
  };
  rec.onend = () => {
    escuchando = null;
    $('hablar').setAttribute('aria-pressed', 'false');
    if (pet.transitoria?.nombre === 'escucha') pet.transitoria = null;
  };
  rec.start();
}

if (Reconocedor) {
  $('hablar').addEventListener('click', escuchar);
} else {
  $('hablar').disabled = true;
  $('hablar').title = 'Este navegador no tiene reconocimiento de voz. Funciona en Chrome.';
}

// --- Cámara (D-012, nivel 1): te sigue con los ojos y sabe si estás ----------
let apagarCamara = null;
let presencia = createPresencia(Date.now());
let dormidoPorAusencia = false;

let gestos = createGestos();
let saludo = createSaludo();
let bebida = createBebida();
let quietud = createQuietud();

const NOMBRE_GESTO = {
  puno: 'puño', uno: 'uno', dos: 'dos', tres: 'tres', cuatro: 'cuatro', palma: 'mano abierta',
  'pulgar-arriba': 'pulgar arriba', 'pulgar-abajo': 'pulgar abajo', peineta: 'peineta',
  shaka: 'surfero', cuernos: 'cuernos', 'te-quiero': 'te quiero', pistola: 'pistola', ok: 'OK',
};
const NUMEROS = ['', 'Uno.', 'Dos.', 'Tres.', 'Cuatro.', 'Cinco.'];

// Cómo reacciona Tulo a cada gesto.
function reaccionarAGesto(gesto, ahora) {
  if (pet.dormido && !dormidoPorAusencia) return;
  switch (gesto) {
    case 'saludo':
      reaccion(pet, 'feliz', ahora);
      tocar('feliz');
      return decir('¡Hola! Te he visto saludar.');
    case 'peineta':
      pet.animo = Math.max(0, pet.animo - 10);
      reaccion(pet, 'enfadado', ahora, 4000);
      tocar('no');
      return decir('¡Oye! Eso no se hace.');
    case 'pulgar-arriba':
      pet.animo = Math.min(100, pet.animo + 3);
      reaccion(pet, 'contento', ahora);
      pitar('ok');
      return decir('¡Bien!');
    case 'pulgar-abajo':
      reaccion(pet, 'triste', ahora);
      tocar('triste');
      return decir('Vaya.');
    case 'shaka':
      reaccion(pet, 'feliz', ahora);
      tocar('feliz');
      return decir('¡Buenas olas!');
    case 'cuernos':
      reaccion(pet, 'sorpresa', ahora);
      tocar('aviso');
      return decir('¡Rock!');
    case 'te-quiero':
      pet.animo = Math.min(100, pet.animo + 5);
      reaccion(pet, 'carino', ahora);
      tocar('carino');
      return decir('Yo también.');
    case 'ok':
      reaccion(pet, 'contento', ahora);
      pitar('ok');
      return decir('Perfecto.');
    case 'pistola':
      reaccion(pet, 'sorpresa', ahora);
      tocar('duda');
      return decir('¡No dispares!');
    default:
      // Contar con los dedos: dice el número.
      if (NUMERO_DE_GESTO[gesto]) {
        reaccion(pet, 'contento', ahora, 1500);
        pitar('ok');
        return decir(NUMEROS[NUMERO_DE_GESTO[gesto]]);
      }
  }
}

// Para afinar: qué dedos ve estirados (P pulgar, I índice, C corazón, A anular, M meñique).
function letrasDeDedos(puntos) {
  const d = dedosEstirados(puntos);
  return ['pulgar', 'indice', 'corazon', 'anular', 'menique'].map((n) => (d[n] ? n[0].toUpperCase() : '·')).join(' ');
}

function acabarConcentracionVista(ahora) {
  const minutos = acabarFocoVisto(pet, ahora);
  if (minutos === null || minutos < 1) return;
  decir(`Te he visto concentrado ${Math.round(minutos)} min. Qué rico.`);
  if (minutos >= FOCO_VISTO_MIN_BLOQUE) {
    tocar('feliz');
    premiar(registrar(progreso, 'bloque', { dia: hoy(), minutos }));
  }
}

function alVer({ cara, mano }) {
  const ahora = Date.now();
  const caja = cara;
  face.setMirada(caja ? miradaDesdeCara(caja, 1, 1) : null);

  // Gestos de la mano.
  const gesto = mano ? nombrarGesto(mano.puntos) : null;
  const confirmado = actualizarGestos(gestos, gesto, ahora);
  const abierta = Boolean(mano && manoAbierta(mano.puntos));
  const saluda = actualizarSaludo(saludo, abierta ? mano.puntos[12].x : null, ahora);
  if (saluda) reaccionarAGesto('saludo', ahora);
  // Una mano abierta que se mueve es un saludo a medias, no un cinco.
  else if (confirmado && !(abierta && saludando(saludo))) reaccionarAGesto(confirmado, ahora);

  // Beber: una mano que no saluda, un rato a la altura de la boca.
  const enLaBoca = Boolean(cara && mano && !abierta && manoEnLaBoca(cara, mano.puntos));
  if (actualizarBebida(bebida, enLaBoca, ahora)) {
    decir('Te he visto beber.');
    atenderCuidado('agua');
  }

  // Quieto mucho rato = concentrado.
  for (const ev of actualizarQuietud(quietud, cara, ahora)) {
    if (ev.tipo === 'empieza' && empezarFocoVisto(pet, ev.desde)) decir('Te veo concentrado. Sigo contigo.');
    if (ev.tipo === 'acaba') acabarConcentracionVista(ahora);
  }

  $('camara-estado').textContent = [
    caja ? 'Te veo.' : 'No veo a nadie.',
    mano ? `Dedos: ${letrasDeDedos(mano.puntos)}. Mano: ${NOMBRE_GESTO[gesto] ?? 'sin gesto'}${abierta && saludando(saludo) ? ', moviéndose' : ''}${enLaBoca ? ', en la boca' : ''}.` : '',
  ].join(' ');
  for (const ev of actualizarPresencia(presencia, Boolean(caja), ahora)) {
    if (ev.tipo === 'se-va' && !pet.foco && !pet.dormido) {
      pet.dormido = true;
      dormidoPorAusencia = true;
      decir('No te veo. Me echo una siesta.');
    }
    if (ev.tipo === 'vuelve') {
      if (dormidoPorAusencia) {
        pet.dormido = false;
        dormidoPorAusencia = false;
        reaccion(pet, 'feliz', ahora);
        tocar('feliz');
        decir('¡Has vuelto!');
      }
      // Si pedía estirarse y has faltado un rato, lo da por hecho: lo ha visto.
      if (ev.ausenteMs >= LEVANTARSE_MS && pet.cuidados.estirar.pendiente) atenderCuidado('estirar');
    }
  }
}

async function conmutarCamara(encender) {
  if (!encender) {
    apagarCamara?.();
    apagarCamara = null;
    acabarConcentracionVista(Date.now());
    face.setMirada(null);
    $('visor').hidden = true;
    if (dormidoPorAusencia) {
      pet.dormido = false;
      dormidoPorAusencia = false;
    }
    return;
  }
  $('visor').hidden = false;
  $('camara-estado').textContent = 'Encendiendo la cámara…';
  try {
    presencia = createPresencia(Date.now());
    gestos = createGestos();
    saludo = createSaludo();
    bebida = createBebida();
    quietud = createQuietud(window.pacolo.quietoTrasMs);
    apagarCamara = await encenderCamara($('video'), alVer);
  } catch (err) {
    const motivos = {
      NotAllowedError: 'No tengo permiso para usar la cámara.',
      NotFoundError: 'No encuentro ninguna cámara.',
      NotReadableError: 'La cámara la está usando otro programa.',
    };
    $('camara').checked = false;
    $('visor').hidden = true;
    tocar('no');
    decir(motivos[err.name] ?? 'No he podido encender la cámara. Hace falta internet la primera vez.');
  }
}
$('camara').addEventListener('change', (ev) => conmutarCamara(ev.target.checked));

// --- Controles ------------------------------------------------------------
$('orden').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const campo = $('texto');
  const texto = campo.value;
  campo.value = '';
  atender(texto);
});

$('acciones').addEventListener('click', (ev) => {
  const accion = ev.target.dataset?.accion;
  if (accion) hacer(accion);
});
$('pantalla').addEventListener('click', () => {
  if (sinBateria()) return;
  if (callarAlarma()) return;
  if (cerrarVista()) return;
  // Con la pantalla dormida, el primer toque solo la despierta.
  if (tocarAparato(aparato, Date.now())) return pintarAparato();
  hacer('acariciar');
});

$('foco').addEventListener('click', (ev) => {
  const s = ev.target.dataset?.s;
  if (s) foco(Number(s));
});
$('cancelar-foco').addEventListener('click', dejarFoco);
$('cuidados').addEventListener('click', (ev) => {
  const cual = ev.target.dataset?.cuidado;
  if (cual) atenderCuidado(cual);
});
$('hora-dormir').value = horaDormir;
$('hora-dormir').addEventListener('change', (ev) => {
  if (!ev.target.value) return;
  horaDormir = ev.target.value;
  avisadoDeDormir = false;
  guardar(CLAVE_DORMIR, horaDormir);
});
$('abrir-caja').addEventListener('click', caja);

$('recargar').addEventListener('click', () => enMercado(() => {
  recargar(mercado, 500);
  return `Recarga simulada de ${euros(500)}. Saldo: ${euros(mercado.saldo)}.`;
}));
$('skin-venta').addEventListener('change', () => { ponerPrecioOrientativo(); pintarPrecioNeto(); });
$('precio-venta').addEventListener('input', pintarPrecioNeto);
$('venta').addEventListener('submit', (ev) => {
  ev.preventDefault();
  enMercado(() => {
    const precio = Math.round(Number($('precio-venta').value.replace(',', '.')) * 100);
    if (!Number.isFinite(precio)) throw new Error('Ese precio no lo entiendo.');
    const a = publicar(mercado, progreso, $('skin-venta').value, precio);
    return `A la venta: ${skin(a.skin).nombre} por ${euros(a.precio)}.`;
  });
});
$('mis-anuncios').addEventListener('click', (ev) => {
  const id = Number(ev.target.dataset?.retirar);
  if (id) enMercado(() => `Retirada del mercado: ${skin(retirar(mercado, progreso, id).skin).nombre}.`);
});
$('anuncios').addEventListener('click', (ev) => {
  const id = Number(ev.target.dataset?.comprar);
  if (id) enMercado(() => {
    const a = comprar(mercado, progreso, id);
    reaccion(pet, 'feliz', Date.now());
    return `Comprada: ${skin(a.skin).nombre} a ${a.vendedor} por ${euros(a.precio)}. Saldo: ${euros(mercado.saldo)}.`;
  });
});
$('avisos').addEventListener('click', (ev) => {
  const id = Number(ev.target.dataset?.quitar);
  if (!id) return;
  const a = avisosPendientes(pet).find((x) => x.id === id);
  if (!a || !quitarAviso(pet, id)) return;
  guardarPet();
  decir(`Quitado: ${nombreAviso(a).toLowerCase()}.`);
});

$('skins').addEventListener('click', (ev) => {
  const id = ev.target.closest('[data-skin]')?.dataset.skin;
  if (!id || !progreso.inventario[id]) return;
  equipar(progreso, id);
  face.setSkin(skin(id));
  quitarPrueba();
  pitar('ok');
  guardarProgreso();
});

// Probar cualquier forma y color sin tenerlos (solo en el simulador): sirve
// para ver los 44 colores de D-025 sin abrir cajas. No equipa ni guarda nada.
function rellenarProbar() {
  const opcion = (valor, texto) => Object.assign(document.createElement('option'), { value: valor, textContent: texto });
  $('probar-forma').replaceChildren(...FORMAS.map((f) => opcion(f.id, f.nombre)));
  for (const id of ['probar-izq', 'probar-der']) {
    const sel = $(id);
    sel.replaceChildren(...(id === 'probar-der' ? [opcion('', 'el mismo')] : []));
    for (const fam of Object.keys(FAMILIAS)) {
      const g = document.createElement('optgroup');
      g.label = fam;
      g.append(...COLORES.filter((c) => c.familia === fam).map((c) => opcion(c.id, c.nombre)));
      sel.append(g);
    }
  }
}
function probar() {
  const izq = $('probar-izq').value;
  const der = $('probar-der').value || izq;
  const s = skin(idDe($('probar-forma').value, izq, der));
  face.setSkin(s);
  $('probar-info').textContent = `${s.nombre} · ${RAREZAS[s.rareza].nombre.toLowerCase()} · sale en 1 de cada ${Math.round(1 / s.p).toLocaleString('es')} cajas`;
  $('probar-quitar').hidden = false;
}
function quitarPrueba() {
  $('probar-info').textContent = '';
  $('probar-quitar').hidden = true;
}
rellenarProbar();
for (const id of ['probar-forma', 'probar-izq', 'probar-der']) $(id).addEventListener('change', probar);
$('probar-quitar').addEventListener('click', () => {
  face.setSkin(skin(progreso.equipada));
  quitarPrueba();
});

$('velocidad').addEventListener('click', (ev) => {
  const v = ev.target.dataset?.v;
  if (!v) return;
  pet.velocidad = Number(v);
  for (const b of $('velocidad').querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(b === ev.target));
});
$('reiniciar').addEventListener('click', () => {
  Object.assign(pet, createPet(Date.now()), { velocidad: pet.velocidad });
  Object.assign(progreso, createProgreso());
  delete progreso.fabrica; // sale de fábrica otra vez: le tocan ojos nuevos
  Object.assign(mercado, createMercado());
  Object.assign(aparato, createAparato(Date.now()));
  guardarAparato();
  face.setSkin(skin(progreso.equipada));
  guardarMercado();
  decir('Tulo, como nuevo. Misiones, skins y mercado, a cero.');
  primer = null;
  primerEncendido();
});
$('primer-prueba').addEventListener('click', () => primerEncendido({ prueba: true }));

$('sonido').checked = sonido;
$('sonido').addEventListener('change', (ev) => {
  sonido = ev.target.checked;
  ponerSonido(sonido);
  guardar(CLAVE_SONIDO, sonido);
  if (sonido) pitar('ok');
});

const cajaExpresiones = $('expresiones');
for (const nombre of ['automática', ...EXPRESSION_NAMES]) {
  const b = document.createElement('button');
  b.textContent = nombre;
  b.dataset.exp = nombre;
  b.setAttribute('aria-pressed', String(nombre === 'automática'));
  cajaExpresiones.append(b);
}
cajaExpresiones.addEventListener('click', (ev) => {
  const exp = ev.target.dataset?.exp;
  if (!exp) return;
  fijada = exp === 'automática' ? null : exp;
  for (const b of cajaExpresiones.children) b.setAttribute('aria-pressed', String(b === ev.target));
});

for (const parte of ['carcasa', 'pantalla']) {
  $(`c-${parte}`).addEventListener('input', (ev) => {
    piel[parte] = ev.target.value;
    aplicarPiel();
    guardar(CLAVE_PIEL, piel);
  });
}

// --- Stand o llavero (D-014) -----------------------------------------------
function pintarAparato() {
  const cap = capacidades(aparato);
  for (const b of $('modo').querySelectorAll('[data-modo]')) b.setAttribute('aria-pressed', String(b.dataset.modo === aparato.modo));
  $('carcasa').dataset.modo = aparato.modo;
  $('carcasa').classList.toggle('apagada', !aparato.pantalla);
  const pct = Math.round(aparato.bateria);
  $('bateria').textContent = `${pct} %`;
  $('bateria').className = pct <= BATERIA_BAJA ? 'pide' : '';
  $('aparato-estado').textContent = aparato.apagado
    ? (cargando(aparato) ? 'Sin batería: apagado, cargando. Se enciende al 3 %.' : 'Sin batería: apagado. Ponle en el stand enchufado.')
    : cap.carga
      ? (!aparato.enchufado ? 'En el stand, desenchufado: gasta batería.' : pct >= 100 ? 'En el stand, cargado.' : 'En el stand, cargando.')
      : `De llavero · pantalla ${aparato.pantalla ? 'encendida' : 'dormida: tócale para despertarle'} · ${aparato.movilCerca ? 'móvil cerca' : 'sin móvil'}${aparato.paseoMin ? ` · ${aparato.paseoMin} min de paseo` : ''}`;
  $('pasear').disabled = !cap.pasear || aparato.apagado;
  $('cruzarse').disabled = !cap.pasear || aparato.apagado;
  $('camara').disabled = !cap.camara || aparato.apagado || !red.camara;
  $('enchufado').checked = aparato.enchufado;
  $('movil-cerca').checked = aparato.movilCerca;
}

function guardarAparato() {
  guardar(CLAVE_APARATO, {
    modo: aparato.modo, bateria: aparato.bateria, paseoMin: aparato.paseoMin, avisadoBateria: aparato.avisadoBateria,
    enchufado: aparato.enchufado, movilCerca: aparato.movilCerca, apagado: aparato.apagado, apagadoDesde: aparato.apagadoDesde, brillo: aparato.brillo,
  });
  pintarAparato();
}

function ponerModo(modo) {
  const cambio = cambiarModo(aparato, modo, Date.now());
  if (!cambio) return;
  if (modo === 'llavero') {
    // De llavero no hay cámara ni se le ve concentrado.
    if ($('camara').checked) {
      $('camara').checked = false;
      conmutarCamara(false);
    }
    tocar('feliz');
    decir('¡Nos vamos! De llavero no llevo cámara ni ordenador.');
  } else {
    tocar('ok');
    decir(cambio.paseoMin
      ? `Ya estamos en el escritorio. Hemos andado ${cambio.paseoMin} min.`
      : 'Ya estamos en el escritorio.');
  }
  guardarAparato();
}

function salirDePaseo(minutos) {
  const pedia = pasear(aparato, pet, minutos);
  reaccion(pet, 'feliz', Date.now(), 3000);
  tocar('feliz');
  decir(pedia ? `${minutos} min andando. Y así ya hemos estirado.` : `${minutos} min andando. Me gusta salir.`);
  if (pedia) premiar(registrar(progreso, 'cuidado'));
  guardarAparato();
}

$('modo').addEventListener('click', (ev) => {
  const modo = ev.target.dataset?.modo;
  if (modo) ponerModo(modo);
});
$('pasear').addEventListener('click', () => salirDePaseo(5));

// D-018: dos Tulos de llavero que se cruzan se saludan; los distintos
// cuentan para una misión. Los otros dueños son inventados.
const OTROS_DUENOS = ['Lucía', 'Mateo', 'Sara', 'Hugo', 'Vera'];
function cruzarse(nombre = OTROS_DUENOS[Math.floor(Math.random() * OTROS_DUENOS.length)]) {
  if (!capacidades(aparato).pasear || aparato.apagado) return anotar('(Solo se cruza con otros de llavero y con batería.)');
  const r = registrar(progreso, 'encuentro', { id: `pacolo-de-${normalizar(nombre)}` });
  reaccion(pet, 'feliz', Date.now(), 2500);
  tocar('feliz');
  decir(r.repetido ? `¡Otra vez el Tulo de ${nombre}! Ya nos conocíamos.` : `¡Otro Tulo! Es el de ${nombre}. Nos hemos saludado.`);
  premiar(r);
}
$('cruzarse').addEventListener('click', () => cruzarse());

$('enchufado').addEventListener('change', (ev) => {
  enchufar(aparato, ev.target.checked);
  if (aparato.modo === 'stand' && !aparato.apagado) decir(ev.target.checked ? 'Stand enchufado: cargo.' : 'Se ha desenchufado el stand. Tiro de batería.');
  guardarAparato();
});
$('movil-cerca').addEventListener('change', (ev) => {
  aparato.movilCerca = ev.target.checked;
  guardarAparato();
});
$('vaciar').addEventListener('click', () => {
  aparato.bateria = Math.min(aparato.bateria, 2);
  guardarAparato();
  anotar('(Prueba: batería al 2 %.)');
});

// --- Distracciones en reposo ----------------------------------------------
const distracciones = createDistracciones(Date.now());

// Sin nada que hacer: despierto, sin bloque, sin reacción en marcha, sin
// escuchar y sin necesidades. Solo entonces se distrae.
function estaTranquilo() {
  return capacidades(aparato).distracciones && !fijada && !pet.dormido && !pet.transitoria && !pet.foco && !pet.focoVisto && !escuchando
    && ['reposo', 'contento'].includes(expresionActual(pet));
}

function distraer(cual) {
  if (!estaTranquilo()) return decir('Ahora no está para distracciones.');
  empezarDistraccion(distracciones, cual, Date.now());
}

$('distraer').addEventListener('click', (ev) => {
  const cual = ev.target.dataset?.d;
  if (cual) distraer(cual);
});

// --- Bucle ----------------------------------------------------------------
let ultimoPanel = 0;
let ultimoGuardado = 0;
let primerTick = true;
// El latido hace pasar el tiempo y dice lo que ocurre. Va aparte del dibujo
// porque una pestaña en segundo plano deja de pintar, y un recordatorio tiene
// que saltar aunque nadie esté mirando la página.
function latido() {
  const ahora = Date.now();
  // Si nadie pinta (pestaña oculta), el primer encendido acaba igual a su hora.
  if (primer && ahora - primer.reloj >= primer.a.dura + 400) acabarPrimer();
  for (const ev of tickAparato(aparato, ahora, pet.velocidad)) {
    if (ev.tipo === 'bateria-baja') {
      tocar('pide');
      decir(ev.enStand ? 'Me queda poca batería. Enchufa el stand.' : 'Me queda poca batería. Llévame al stand.');
    }
    if (ev.tipo === 'cargado') decir('Batería llena.');
    if (ev.tipo === 'apagado') {
      // Se duerme sin castigo (D-017). Un bloque a medias no cuenta: se quita
      // sin lo que resta cancelarFoco al ánimo. La cámara se apaga con él.
      pet.foco = null;
      pararPomodoro(pomodoro);
      if ($('camara').checked) {
        $('camara').checked = false;
        conmutarCamara(false);
      }
      tocar('dormir');
      $('bocadillo').textContent = '';
      anotar('Se ha quedado sin batería y se ha dormido. Al cargar despertará igual que estaba.');
      guardarPet();
      guardarAparato();
    }
    if (ev.tipo === 'encendido') {
      pet.ultimoTick = ahora; // el rato apagado no cuenta para sus necesidades
      tocar('ok');
      decir(`Ya tengo batería. He estado apagado ${duracion(Math.max(1, Math.round(ev.apagadoMs / 1000)))}.`);
      avisosPasados(ahora, 'sin batería', 0);
      guardarAparato();
    }
  }
  if (aparato.apagado) {
    pet.ultimoTick = ahora;
    if (ahora - ultimoPanel > 250) { pintarPanel(); pintarAparato(); ultimoPanel = ahora; }
    return;
  }
  for (const ev of tick(pet, ahora)) {
    if (['temporizador', 'recordatorio', 'alarma'].includes(ev.tipo)) vistaAbierta = null;
    if (ev.tipo === 'temporizador') {
      tocar('aviso');
      const t = ev.etiqueta ? `¡Tiempo! Temporizador de ${ev.etiqueta}.` : '¡Tiempo! Ha acabado el temporizador.';
      decir(t);
      avisarFuera({ tipo: 'temporizador', titulo: '¡Tiempo!', texto: ev.etiqueta ? `Temporizador de ${ev.etiqueta}` : 'Ha acabado el temporizador', etiqueta: ev.etiqueta ?? '' });
      if (conectores.copiarAvisos && movilDisponible()) alMovil(t);
      guardarPet();
    }
    if (ev.tipo === 'recordatorio') {
      tocar('aviso');
      const t = ev.texto ? `Recordatorio: ${ev.texto}.` : `Son las ${horaDe(ahora)}. Me pediste que te avisara.`;
      decir(t);
      avisarFuera({ tipo: 'recordatorio', titulo: 'Recordatorio', texto: ev.texto || `Son las ${horaDe(ahora)}`, etiqueta: ev.texto ?? '' });
      if (conectores.copiarAvisos && movilDisponible()) alMovil(t);
      guardarPet();
    }
    if (ev.tipo === 'alarma') {
      tocar('aviso');
      ultimoPitidoAlarma = ahora;
      $('parar-alarma').hidden = false;
      const t = `⏰ ¡Alarma${ev.etiqueta ? `: ${ev.etiqueta}` : ''}! Di «para la alarma» o tócame.`;
      decir(t);
      avisarFuera({ tipo: 'alarma', titulo: '¡Alarma!', texto: ev.etiqueta || horaDe(ahora), etiqueta: ev.etiqueta ?? '' });
      if (conectores.copiarAvisos && movilDisponible()) alMovil(t);
      guardarPet();
    }
    if (ev.tipo === 'alarma_sin_atender') {
      $('parar-alarma').hidden = true;
      decir('La alarma ha sonado dos minutos y nadie la ha parado.');
      avisarFuera({ tipo: 'fin' });
    }
    if (ev.tipo === 'despierta') decir('Ya he descansado.');
    if (ev.tipo === 'cuidado' && !primerTick) {
      tocar('pide');
      decir(CUIDADOS[ev.cual].pide);
      avisarFuera({ tipo: 'cuidado', cual: ev.cual, titulo: ev.cual === 'agua' ? 'Agua' : 'Estírate', texto: CUIDADOS[ev.cual].pide });
    }
    if (ev.tipo === 'foco') {
      tocar('feliz');
      decir(dice('bloque'));
      premiar(registrar(progreso, 'bloque', { dia: hoy(), minutos: ev.minutos }));
      const descanso = acabarTrabajo(pomodoro, ahora);
      if (descanso) {
        reaccion(pet, 'contento', ahora, 3000);
        decir(`Pomodoro ${descanso.hechos} hecho. Descanso${descanso.fase === 'largo' ? ' largo' : ''} de ${duracion(descanso.segundos)}: levántate y bebe agua.`);
        guardarConectores();
      }
      contarGuardadas();
    }
  }
  const vuelta = tickPomodoro(pomodoro, ahora);
  if (vuelta) {
    if (pet.foco) {
      // Hay un bloque suelto en marcha: el pomodoro se para para no pisarlo.
      pararPomodoro(pomodoro);
    } else {
      empezarFoco(pet, vuelta.segundos, ahora);
      tocar('aviso');
      decir(`Vuelta al trabajo: tanda ${vuelta.numero}, ${duracion(vuelta.segundos)}.`);
    }
    guardarConectores();
  }
  // La alarma pita cada 2,5 s mientras suena.
  if (pet.sonando && ahora - ultimoPitidoAlarma >= 2500) {
    tocar('aviso');
    ultimoPitidoAlarma = ahora;
    const c = $('carcasa');
    c.classList.remove('agitada');
    void c.offsetWidth;
    c.classList.add('agitada');
  }
  // Hábitos con hora: a su hora pregunta si ya está hecho (una vez al día).
  {
    const d = new Date(ahora);
    const tocan = habitosQueTocan(habitos, hoy(), d.getHours() * 60 + d.getMinutes());
    for (const x of tocan) {
      tocar('pide');
      decir(`¿Has hecho «${x.titulo}» hoy? Dime «he hecho ${x.titulo.toLowerCase()}».`);
    }
    if (tocan.length) guardarHabitos();
  }
  for (const a of avisosCalendario(calendario, ahora)) {
    tocar('aviso');
    reaccion(pet, 'sorpresa', ahora, 2500);
    const lugar = a.cita.lugar ? ` (${a.cita.lugar})` : '';
    decir(a.tipo === 'pronto' ? `En ${a.minutos} min: ${a.cita.titulo}${lugar}.` : `Empieza: ${a.cita.titulo}${lugar}.`);
    guardarConectores();
  }
  if (primerTick) {
    // El tiempo que el simulador estuvo cerrado no cuenta para agua ni estirarse.
    reiniciarCuidados(pet);
    primerTick = false;
  }
  for (const ev of actualizarDistracciones(distracciones, estaTranquilo(), ahora)) {
    // La mosca se va por arriba y se queda mirando por dónde se ha ido.
    if (ev.tipo === 'acaba' && !ev.cortada && ev.cual === 'mosca') reaccion(pet, 'pensando', ahora, 1200);
  }
  if (ahora - ultimoPanel > 250) { mirarLaHora(); pintarPanel(); pintarAparato(); pintarConectores(); ultimoPanel = ahora; }
  if (ahora - ultimoGuardado > 5000) {
    guardarPet();
    guardarAparato();
    ultimoGuardado = ahora;
  }
}
setInterval(latido, 1000);

// Notificaciones y música del PC: solo en el stand y con batería. Lo que llega
// de llavero o apagado se recoge al volver (el puente lo guarda).
let notifDesde = null;
async function mirarNotificaciones() {
  if (aparato.apagado || !capacidades(aparato).ordenador) return;
  try {
    const r = await fetch(`/api/notificaciones?desde=${notifDesde ?? 0}`).then((x) => x.json());
    if (notifDesde === null) { notifDesde = r.ultima; return; } // las de antes de abrir no se dicen
    notifDesde = r.ultima;
    for (const n of r.nuevas) {
      const ahora = Date.now();
      const res = recibir(buzon, n, { enFoco: Boolean(pet.foco), now: ahora });
      if (res.accion === 'avisar') {
        reaccion(pet, res.reaccion.cara, ahora, 2500);
        tocar(res.reaccion.sonido);
        decir(decirNotificacion(res.nota));
      } else {
        anotar(`(Notificación de ${res.nota.app} guardada para después del bloque.)`);
      }
    }
    pintarConectores();
  } catch {
    // Sin puente (página abierta como fichero): no hay notificaciones.
  }
}
setInterval(mirarNotificaciones, 2000);
mirarNotificaciones();

async function leerMusicaDelPuente() {
  try {
    const nueva = leerMusica(await fetch('/api/musica').then((x) => x.json()));
    const cambio = cambioDeCancion(musica, nueva);
    musica = nueva;
    if (cambio && baila(musica, pet)) {
      reaccion(pet, 'feliz', Date.now(), 2000);
      decir(`¡Me gusta esta! ${decirCancion(musica)}`);
    }
  } catch {
    musica = null;
  }
  pintarConectores();
}
setInterval(() => {
  if (conectores.verMusica && !aparato.apagado && capacidades(aparato).ordenador) leerMusicaDelPuente();
  else if (musica) { musica = null; pintarConectores(); }
}, 5000);

function pintarConectores() {
  const r = resumenPomodoro(pomodoro, Date.now());
  $('pomodoro-estado').textContent = r ? estadoPomodoro() : 'Sin pomodoro.';
  $('parar-pomodoro').disabled = !r;
  const lista = $('citas');
  lista.replaceChildren(...proximas(calendario, Date.now(), 4).map((c) => {
    const li = document.createElement('li');
    const dia = new Date(c.inicio).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    li.textContent = `${dia} · ${nombreCita(c)}${c.lugar ? ` · ${c.lugar}` : ''}${c.repite ? ' · se repite' : ''}`;
    return li;
  }));
  const resumenCal = calendario.citas.length ? `${calendario.citas.length} citas; avisa 10 min antes y al empezar.` : 'Sin calendario.';
  $('cal-google').checked = conectores.calGoogle;
  $('cal-estado').textContent = conectores.calGoogle && calGoogleEstado ? `${calGoogleEstado} ${calendario.citas.length ? resumenCal : ''}` : resumenCal;
  $('no-molestar').checked = buzon.noMolestar;
  $('notificaciones').replaceChildren(...buzon.lista.slice(0, 5).map((n) => {
    const li = document.createElement('li');
    li.textContent = decirNotificacion(n);
    return li;
  }));
  $('ver-musica').checked = conectores.verMusica;
  $('musica-estado').textContent = !conectores.verMusica ? 'Apagado.' : red.motivoSinPuente() ?? (musica ? decirCancion(musica) + (baila(musica, pet) ? ' Bailando.' : '') : 'No suena nada (o el puente no la ve).');
}

$('pomodoro').addEventListener('click', (ev) => {
  const cual = ev.target.dataset?.po;
  if (cual) arrancarPomodoro(cual === 'prueba' ? DURACIONES_PRUEBA : DURACIONES);
});
$('parar-pomodoro').addEventListener('click', () => dejarFoco());
$('ics').addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (f) cargarIcs(await f.text(), f.name);
  ev.target.value = '';
});
$('cal-ejemplo').addEventListener('click', () => cargarIcs(calendarioDeEjemplo(Date.now()), 'de ejemplo'));
$('cal-quitar').addEventListener('click', () => {
  calendario.citas = [];
  calendario.avisados = [];
  icsTexto = null;
  conectores.calGoogle = false;
  conectores.calGoogleElegido = true;
  calGoogleEstado = null;
  guardarConectores();
  decir('Calendario quitado.');
});
$('cal-google').addEventListener('change', (ev) => {
  conectores.calGoogle = ev.target.checked;
  conectores.calGoogleElegido = true;
  calGoogleEstado = conectores.calGoogle ? 'Pidiendo el calendario al puente…' : null;
  guardarConectores();
  if (conectores.calGoogle) leerCalendarioGoogle({ forzar: true, avisar: true });
  else decir('Calendario de Google apagado; me quedo con lo último que leí.');
});
// 15-nov (Chief, «casilla + sola con .env»): mientras nadie lo haya encendido ni
// apagado a mano, se pregunta al puente si el .env tiene la dirección y, si la
// tiene y Google contesta, se enciende solo. Quien lo apaga lo deja apagado.
async function encenderCalendarioSiHay() {
  let r;
  try { r = await fetch('/api/calendario'); } catch { return; }
  if (!r.ok || conectores.calGoogle || conectores.calGoogleElegido) return;
  conectores.calGoogle = true;
  await leerCalendarioGoogle(); // el puente lo tiene en caché: no vuelve a ir a Google
  anotar('(Calendario de Google encendido solo: el .env tiene la dirección.)');
}
// Abierto con el de Google encendido: se pide ya, sin esperar a la recarga.
if (conectores.calGoogle) leerCalendarioGoogle();
else if (!conectores.calGoogleElegido) encenderCalendarioSiHay();
$('no-molestar').addEventListener('change', (ev) => {
  buzon.noMolestar = conectores.noMolestar = ev.target.checked;
  guardarConectores();
});
const EJEMPLOS_NOTIF = [
  { app: 'Gmail', titulo: 'Lucía', texto: 'Te paso el presupuesto' },
  { app: 'WhatsApp', titulo: 'Jacobo', texto: '¿Has visto los bocetos?' },
  { app: 'GitHub', texto: 'Build failed en main' },
  { app: 'Calendario', texto: 'Reunión en 10 minutos' },
];
$('notif-ejemplo').addEventListener('click', async () => {
  const n = EJEMPLOS_NOTIF[Math.floor(Math.random() * EJEMPLOS_NOTIF.length)];
  // Pasa por el puente, como una de verdad.
  try {
    const r = await fetch('/api/notificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) });
    if (!r.ok) decir(red.motivoSinPuente() ?? 'El puente no ha aceptado la notificación.');
  } catch {
    decir('El puente con el ordenador no contesta.');
  }
});
$('ver-musica').addEventListener('change', (ev) => {
  conectores.verMusica = ev.target.checked;
  guardarConectores();
  if (conectores.verMusica) leerMusicaDelPuente();
});
// --- Paneles de lo copiado de Troko ---
function pintarPantallaVoz() {
  for (const b of $('tema').querySelectorAll('[data-tema]')) b.setAttribute('aria-pressed', String(b.dataset.tema === conectores.tema));
  $('reposo').checked = conectores.reposo;
  $('copiar-avisos').checked = conectores.copiarAvisos;
}
$('habito-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const titulo = $('h-titulo').value.trim();
  if (!titulo) return;
  try {
    const x = crearHabito(habitos, { titulo, objetivo: $('h-objetivo').value.trim() || null, hora: $('h-hora').value || null, periodicidad: $('h-semanal').checked ? 'semanal' : 'diario', creado: hoy() });
    guardarHabitos();
    decir(`Hábito nuevo: ${decirHabito(x)}.`);
    $('habito-form').reset();
  } catch (e) {
    decir(e.message);
  }
});
$('habitos-lista').addEventListener('change', (ev) => {
  const id = Number(ev.target.dataset?.habito);
  if (id) marcarHabitoUI(id, ev.target.checked);
});
$('habitos-lista').addEventListener('click', (ev) => {
  const id = Number(ev.target.dataset?.borrarHabito);
  if (!id) return;
  const x = borrarHabito(habitos, id);
  guardarHabitos();
  decir(`Hábito borrado: ${x.titulo}.`);
});
$('tarea-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const titulo = $('t-titulo').value.trim();
  if (!titulo) return;
  const dia = $('t-dia').value === 'manana' ? diaMas(1) : hoy();
  const hora = $('t-hora').value || null;
  const igual = tareaIgual(tareas, titulo);
  if (igual) return decir(`Ya la tenía apuntada: ${decirTarea(igual, hoy())}.`);
  try {
    const x = anadirTarea(tareas, { titulo, dia, hora, categoria: $('t-cat').value || null });
    if (hora) {
      const [hh, mm] = hora.split(':').map(Number);
      const [y, m, d] = dia.split('-').map(Number);
      const fin = new Date(y, m - 1, d, hh, mm).getTime();
      if (fin > Date.now()) x.recordatorio = ponerRecordatorio(pet, fin, Date.now(), `Tarea: ${x.titulo}`).id;
    }
    guardarTareas();
    guardarPet();
    decir(`Apuntada: ${decirTarea(x, hoy())}.`);
    $('tarea-form').reset();
  } catch (e) {
    decir(e.message);
  }
});
$('tareas-lista').addEventListener('change', (ev) => {
  const id = Number(ev.target.dataset?.tarea);
  if (!id) return;
  if (ev.target.checked) return tareaHecha(id);
  completarTarea(tareas, id, false);
  guardarTareas();
});
$('tareas-lista').addEventListener('click', (ev) => {
  const id = Number(ev.target.dataset?.borrarTarea);
  if (!id) return;
  const x = borrarTarea(tareas, id);
  if (x.recordatorio) quitarAviso(pet, x.recordatorio);
  guardarTareas();
  guardarPet();
  decir(`Tarea borrada: ${x.titulo}.`);
});
$('movil-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const t = $('movil-texto').value;
  $('movil-texto').value = '';
  desdeMovil(t);
});
$('copiar-avisos').addEventListener('change', (ev) => {
  conectores.copiarAvisos = ev.target.checked;
  guardarConectores();
});
$('brillo').addEventListener('input', (ev) => ponerBrillo(ev.target.value));
$('tema').addEventListener('click', (ev) => {
  const t = ev.target.dataset?.tema;
  if (!t) return;
  ponerTema(t);
  pintarPantallaVoz();
});
$('reposo').addEventListener('change', (ev) => {
  conectores.reposo = ev.target.checked;
  guardarConectores();
  pintarPantallaVoz();
  decir(conectores.reposo ? 'Reposo: llámame «Tulo» cuando me necesites.' : '¡Aquí estoy!');
});
$('parar-alarma').addEventListener('click', () => callarAlarma());
$('ver-habitos').addEventListener('click', () => mostrarVista('habitos'));
$('ver-progreso').addEventListener('click', () => mostrarVista('progreso', { modo: 'hoy' }));
$('ver-semana').addEventListener('click', () => mostrarVista('progreso', { modo: 'semana' }));
$('ver-tareas').addEventListener('click', () => mostrarVista('tareas'));

$('musica-botones').addEventListener('click', (ev) => {
  const m = ev.target.dataset?.m;
  if (m) accionMusica(m);
});

// Pinta un fotograma. `ahora` entra como argumento para poder pintar un
// instante concreto al probar.
let mirandoBaile = false;
// --- Primer encendido (D-024, D-035) -----------------------------------------
// La animación con la que Tulo descubre qué ojos le han tocado: arranque,
// ruleta, se duerme, los abre y enseña el cartel. El guion está en
// core/primer.mjs y el dibujo en web/primer.mjs. Los ojos se sortean al
// empezar (la luz canta la rareza antes de verlos) y se le entregan al
// enseñarlos. Con `prueba` no se guarda nada: es solo para verla.
const pintorPrimer = createPrimer($('pantalla'), () => face.fondo);
let primer = null; // { a, t0, reloj, prueba, tics, sono, entregado }

function primerEncendido({ prueba = false, id = null } = {}) {
  if (primer) return;
  if (!prueba && progreso.fabrica) return;
  const s = id ? skin(id) : sortearSkin();
  cerrarVista();
  $('bocadillo').textContent = '…';
  primer = { a: crearPrimer(s, Math.floor(Math.random() * 0xffffffff) + 1), t0: null, reloj: Date.now(), prueba, tics: 0, sono: {}, entregado: false };
}

// Los ojos ya se han visto: son suyos (salvo en la prueba).
function entregarPrimer() {
  if (!primer || primer.entregado) return;
  primer.entregado = true;
  if (primer.prueba) return;
  estrenar(progreso, Math.random, primer.a.skin);
  face.setSkin(skin(progreso.equipada));
  guardarProgreso();
}

// Pitidos de la animación, según por dónde va.
function sonarPrimer(m) {
  const una = (clave, nombre, afinacion = 1) => {
    if (primer.sono[clave]) return;
    primer.sono[clave] = true;
    tocar(nombre, afinacion);
  };
  if (m.fase === 'arranque' && m.t >= 400) una('arranque', 'arranque');
  if (m.fase === 'ruleta' && m.tics > primer.tics) {
    primer.tics = m.tics;
    tocar('tic', 0.8 + 0.5 * (m.tics / primer.a.pasos.length));
  }
  if (m.fase === 'dormido') una('dormido', 'dormir');
  if (m.revelado) {
    una('estreno', `estreno${primer.a.nivel}`);
    entregarPrimer();
  }
}

function acabarPrimer() {
  if (!primer) return;
  entregarPrimer();
  const { a, prueba } = primer;
  primer = null;
  face.setSkin(skin(progreso.equipada));
  reaccion(pet, 'feliz', Date.now());
  const que = `${a.skin.nombre} · ${a.rareza} · ${a.unoDe.toLowerCase()}`;
  decir(prueba ? `Prueba del primer encendido: habrían tocado ${que}. Tus ojos siguen igual.` : `¡Estos son mis ojos! ${que}.`);
}

function dibujar(t, ahora = Date.now()) {
  if (primer) {
    primer.t0 ??= t;
    const m = pintorPrimer.pintar(primer.a, t - primer.t0);
    sonarPrimer(m);
    if (!m.fin) return;
    acabarPrimer();
  }
  const pos = posicion(distracciones, ahora);
  face.setDistraccion(pos);
  // Con música baila con los ojos, salvo que la cámara mande sobre la mirada.
  const bailando = baila(musica, pet) && !$('camara').checked;
  if (bailando) {
    face.setMirada(pasoDeBaile(t));
    mirandoBaile = true;
  } else if (mirandoBaile) {
    face.setMirada(null);
    mirandoBaile = false;
  }
  let cara = expresionActual(pet);
  if (pet.sonando) cara = 'asustado';
  else if (conectores.reposo && cara === 'reposo') cara = 'relajado';
  face.setExpression(fijada ?? (pos ? DISTRACCIONES[pos.cual].cara : bailando && cara === 'reposo' ? 'contento' : cara));
  face.setVista(vigente(vistaAbierta, ahora) ? vistaModelo(vistaAbierta, ahora) : null);
  face.frame(t, progresoFoco(pet, ahora));
}

function bucle(t) {
  latido();
  dibujar(t);
  requestAnimationFrame(bucle);
}

// Avisos que debían saltar mientras no podía (el simulador cerrado o sin
// batería): se dicen una vez, sin pitido. Los de hace menos de `margenMs`
// saltan normal en el siguiente tick.
function avisosPasados(ahora, mientras, margenMs) {
  for (const a of avisosPendientes(pet)) {
    if (a.fin > ahora - margenMs) continue;
    quitarAviso(pet, a.id);
    decir(`Mientras estaba ${mientras} se pasó (${horaDe(a.fin)}): ${nombreAviso(a).toLowerCase()}.`);
  }
}
if (!aparato.apagado) avisosPasados(Date.now(), 'cerrado', 60000);

aplicarPiel();
pintarPanel();
pintarProgreso();
pintarMercado();
pintarAparato();
pintarConectores();
pintarHabitos();
pintarTareas();
pintarMovil();
aplicarBrillo();
pintarPantallaVoz();
// Al abrir, los hábitos cuya hora pasó hace más de una hora no preguntan de golpe.
{
  const d = new Date();
  habitosQueTocan(habitos, hoy(), d.getHours() * 60 + d.getMinutes() - 60);
}
requestAnimationFrame(bucle);

// Para depurar desde la consola. `oir` hace lo mismo que una frase reconocida.
// `quietoTrasMs` cambia cuánto hay que estar quieto para contar como concentrado
// (por defecto, dos minutos); se lee al encender la cámara.
// --- Mover el llavero (D-043, D-044) ------------------------------------------
// Hace de acelerómetro: el panel «Mover el llavero» o, en un móvil, su sensor.
// La cuenta es la misma que la del firmware (core/inclina.mjs ↔ pk_inclina.c).
const inclina = crearInclina();
let gravedadMovil = null; // última lectura del sensor del móvil, en los ejes de la pantalla
let usandoSensor = false;
let ultimaInclina = performance.now();
const posturaInclina = () => document.querySelector('input[name="i-postura"]:checked')?.value ?? 'pie';
function gravedadAhora() {
  if (usandoSensor && gravedadMovil) return gravedadMovil;
  return gravedadDe({ postura: posturaInclina(), giro: Number($('i-giro').value), arriba: Number($('i-arriba').value), derecha: Number($('i-derecha').value) });
}
// Por setInterval, como el latido: requestAnimationFrame no corre con la pestaña oculta.
function latidoInclina() {
  const ahora = performance.now();
  pasoInclina(inclina, gravedadAhora(), Math.min(200, ahora - ultimaInclina));
  ultimaInclina = ahora;
  face.setInclinacion(inclina);
}
setInterval(latidoInclina, 33);
function pintarInclina() {
  const pie = posturaInclina() === 'pie';
  for (const [id, activo] of [['i-giro', pie], ['i-arriba', !pie], ['i-derecha', !pie]]) {
    $(id).disabled = !activo || usandoSensor;
    $(`${id}-v`).textContent = `${$(id).value}°`;
  }
  // El dibujo del llavero gira con él; si va bien, la cara de dentro se queda recta en la página.
  const a = !usandoSensor && pie && $('i-girar').checked ? Number($('i-giro').value) : 0;
  // Girada, la flor ocupa más ancho: se encoge lo justo para caber en su sitio (en el móvil se salía).
  const r = (Math.abs(a) * Math.PI) / 180;
  const cabe = Math.min(1, 1 / (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)) * (78.5 / 69)));
  $('carcasa').style.transform = a ? `rotate(${a}deg) scale(${cabe.toFixed(3)})` : '';
  $('i-sensor').textContent = usandoSensor ? 'Dejar el sensor' : 'Usar el sensor de este móvil';
}
for (const id of ['i-giro', 'i-arriba', 'i-derecha', 'i-girar']) $(id).addEventListener('input', pintarInclina);
for (const r of document.querySelectorAll('input[name="i-postura"]')) r.addEventListener('change', pintarInclina);
$('i-recto').addEventListener('click', () => {
  for (const id of ['i-giro', 'i-arriba', 'i-derecha']) $(id).value = 0;
  pintarInclina();
});
function alMoverse(ev) {
  const a = ev.accelerationIncludingGravity;
  if (!a || a.x === null || a.y === null || a.z === null) return;
  gravedadMovil = gravedadDelMovil(a);
}
$('i-sensor').addEventListener('click', async () => {
  if (usandoSensor) {
    window.removeEventListener('devicemotion', alMoverse);
    usandoSensor = false;
    gravedadMovil = null;
    $('i-estado').textContent = '';
    pintarInclina();
    return;
  }
  // Los navegadores solo dan el sensor en páginas seguras (https o localhost):
  // el modo móvil del simulador (--lan) va por http, así que ahí no llega.
  if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
    $('i-estado').textContent = 'Aquí no hay sensor: los móviles solo lo dan en páginas https (o en este mismo ordenador), y el modo móvil del simulador va por http. Usa los deslizadores.';
    return;
  }
  try {
    // iPhone: pide permiso, y solo al tocar un botón.
    if (typeof DeviceMotionEvent.requestPermission === 'function' && (await DeviceMotionEvent.requestPermission()) !== 'granted') {
      $('i-estado').textContent = 'Sin permiso para el sensor de movimiento.';
      return;
    }
  } catch {
    $('i-estado').textContent = 'El navegador no ha dejado usar el sensor.';
    return;
  }
  gravedadMovil = null;
  usandoSensor = true;
  window.addEventListener('devicemotion', alMoverse);
  $('i-estado').textContent = 'Usando el sensor: gíralo de pie o túmbalo e inclínalo. Con el móvil en vertical.';
  pintarInclina();
  setTimeout(() => {
    if (usandoSensor && !gravedadMovil) $('i-estado').textContent = 'No llegan lecturas: este aparato no tiene sensor de movimiento (o el navegador no lo da). Siguen mandando los deslizadores.';
  }, 2000);
});
pintarInclina();

window.pacolo = { posponerAviso, callarAlarma, pet, progreso, mercado, aparato, habitos, tareas, get vista() { return vistaAbierta; }, mostrarVista, movil: { desde: desdeMovil, chat: movilChat }, pomodoro, calendario, buzon, get musica() { return musica; }, set musica(m) { musica = m; pintarConectores(); }, ponerModo, enchufar: (si) => { enchufar(aparato, si); guardarAparato(); }, cruzarse, face, distracciones, distraer, dibujar, get primer() { return primer; }, primerEncendido: (o = {}) => primerEncendido({ prueba: true, ...o }), oir: atender, despertar: () => salirDelReposo({ anotarlo: false }), ver: alVer, quietoTrasMs: undefined, inclina };

// Recién salido de fábrica: lo primero que hace es el primer encendido.
if (recienSalido) primerEncendido();
