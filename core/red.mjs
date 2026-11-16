// Abrir el simulador desde el móvil, en la misma wifi (PACOLO_LAN=1).
// Lógica pura: las direcciones y la hora entran como argumentos.
//
// Regla: desde el propio PC (127.0.0.1) todo funciona como siempre. Desde
// otro aparato de la red se sirve la página (es el mismo código del simulador,
// nada personal), pero cualquier /api/ exige el código de 6 cifras que enseña
// la página del PC: notificaciones (pueden llevar texto de correos), música
// (controla el PC), estado del equipo y lo que se añada después.

export const CABECERA_CODIGO = 'x-pacolo-codigo';
export const INTENTOS = 5;
export const BLOQUEO_MS = 60_000;

// ¿La petición viene del propio PC?
export function esLocal(direccion) {
  if (!direccion) return false;
  const d = String(direccion).replace(/^::ffff:/, '');
  return d === '::1' || /^127\./.test(d);
}

// Cabecera `Host` de una petición a /api/ (anti DNS rebinding, 13-nov).
// Una web ajena puede hacer que su dominio apunte a 127.0.0.1 o a la IP del PC y
// pedir /api/ desde el navegador de Chief: la petición llega «desde dentro», pero
// lleva el nombre de la web ajena en `Host`. Por eso en /api/ solo vale:
//   · 127.0.0.1, localhost o [::1], con el puerto del puente;
//   · en `--lan`, además, una IP privada que sea de este PC (la del QR), con ese puerto.
// Nada más: ni otro nombre, ni sin `Host`, ni un puerto distinto. Las IP no sirven
// para un rebinding (el navegador no las resuelve), por eso se admiten; los nombres
// de la red (mipc.local) no, hasta que alguien los pida.
// `ipsPropias`: direcciones IPv4 de este PC (direccionesLan(os.networkInterfaces())).
const HOST_LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/i;
const IP_PRIVADA = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d{1,3}(\.\d{1,3}){1,2}$/;
export function hostPermitido(host, { puerto, lan = false, ipsPropias = [] } = {}) {
  const m = /^(\[[0-9a-f:]+\]|[^\s:\[\]\/@]+)(?::(\d{1,5}))?$/i.exec(String(host ?? ''));
  if (!m) return false;
  const [, nombre, p] = m;
  if (Number(p) !== Number(puerto)) return false;
  if (HOST_LOCAL.test(nombre)) return true;
  return Boolean(lan && IP_PRIVADA.test(nombre) && ipsPropias.includes(nombre));
}

// Seis cifras a partir de un entero de 0 a 999999 (crypto.randomInt en el servidor).
export const codigoDesde = (n) => String(Math.trunc(n) % 1e6).padStart(6, '0');

export const pareceCodigo = (c) => /^\d{6}$/.test(String(c ?? ''));

// Direcciones IPv4 de la red local, la wifi primero; las de máquinas virtuales,
// VPN y Docker al final. `interfaces` tiene la forma de os.networkInterfaces().
const VIRTUALES = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|tailscale|zerotier|hamachi|vpn|loopback|bluetooth/i;
const WIFI = /wi-?fi|wlan|inal[aá]mbrica|wireless/i;
export function direccionesLan(interfaces) {
  const lista = [];
  for (const [nombre, dirs] of Object.entries(interfaces ?? {})) {
    for (const d of dirs ?? []) {
      const familia = d.family === 4 ? 'IPv4' : d.family;
      if (familia !== 'IPv4' || d.internal) continue;
      if (/^169\.254\./.test(d.address)) continue; // sin red (APIPA)
      const privada = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(d.address);
      const peso = (VIRTUALES.test(nombre) ? 4 : 0) + (privada ? 0 : 2) + (WIFI.test(nombre) ? 0 : 1);
      lista.push({ nombre, direccion: d.address, peso });
    }
  }
  return lista.sort((a, b) => a.peso - b.peso).map(({ nombre, direccion }) => ({ nombre, direccion }));
}

// `esquema` 'https' para la dirección segura (puente/certificado.mjs): la que da
// el sensor de movimiento del móvil.
export const urlMovil = (direccion, puerto, codigo, esquema = 'http') => `${esquema}://${direccion}:${puerto}/#codigo=${codigo}`;

// Frena a quien prueba códigos: INTENTOS fallos seguidos bloquean esa IP un minuto.
export function createLimitador({ intentos = INTENTOS, bloqueoMs = BLOQUEO_MS } = {}) {
  const fallos = new Map(); // ip -> { n, hasta }
  return {
    bloqueado(ip, ahora) {
      const f = fallos.get(ip);
      return Boolean(f && f.hasta > ahora);
    },
    fallo(ip, ahora) {
      const f = fallos.get(ip) ?? { n: 0, hasta: 0 };
      if (f.hasta && f.hasta <= ahora) { f.n = 0; f.hasta = 0; }
      f.n += 1;
      if (f.n >= intentos) f.hasta = ahora + bloqueoMs;
      fallos.set(ip, f);
    },
    acierto(ip) { fallos.delete(ip); },
  };
}

// Qué hacer con una petición. Devuelve 'local', 'ok', 'sin-codigo', 'mal' o
// 'bloqueado'. Solo 'mal' cuenta como intento fallido (la página del móvil
// sin código no debe bloquearse sola).
export function permiso({ direccion, codigoEnviado, codigo, limitador, ahora }) {
  if (esLocal(direccion)) return 'local';
  if (limitador.bloqueado(direccion, ahora)) return 'bloqueado';
  if (!codigoEnviado) return 'sin-codigo';
  if (codigo && String(codigoEnviado) === codigo) { limitador.acierto(direccion); return 'ok'; }
  limitador.fallo(direccion, ahora);
  return limitador.bloqueado(direccion, ahora) ? 'bloqueado' : 'mal';
}
