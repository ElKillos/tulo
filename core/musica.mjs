// Música: qué suena en el ordenador, y Tulo baila. Pedido por Chief como
// conector el 12-nov. En el simulador el puente lee la sesión multimedia de
// Windows (Spotify, el navegador, el reproductor) y la controla.
//
// PROPUESTA, no decisión: baila con los ojos mientras suena, salvo dormido o
// en un bloque de concentración (no te distrae), y comenta cuando cambia la
// canción. No sabe el ritmo de la canción: el baile va a un paso fijo.
//
// Lógica pura: el tiempo entra como argumento.

export const PASO_HZ = 1.6; // pasos de baile por segundo

// Lo que da el puente → { titulo, artista, app, sonando } o null si no hay nada.
export function leerMusica(crudo) {
  if (!crudo || crudo.error || !crudo.titulo) return null;
  return {
    titulo: String(crudo.titulo),
    artista: crudo.artista ? String(crudo.artista) : null,
    app: crudo.app ? nombreApp(String(crudo.app)) : null,
    sonando: Boolean(crudo.sonando),
  };
}

// «Spotify.exe» o «SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify» → «Spotify».
export function nombreApp(id) {
  if (/spotify/i.test(id)) return 'Spotify';
  if (/chrome/i.test(id)) return 'Chrome';
  if (/msedge|edge/i.test(id)) return 'Edge';
  if (/firefox/i.test(id)) return 'Firefox';
  if (/zunemusic|music/i.test(id)) return 'Reproductor multimedia';
  return id.replace(/\.exe$/i, '').split(/[!_.]/).filter(Boolean).at(-1) ?? id;
}

export function baila(musica, pet) {
  return Boolean(musica?.sonando) && !pet.dormido && !pet.foco && !pet.focoVisto;
}

// Hacia dónde miran los ojos en el instante `t` (ms) del baile: de lado a lado
// y un saltito en cada paso. Mismas unidades que la mirada de la cámara.
export function pasoDeBaile(t) {
  const fase = (t / 1000) * PASO_HZ * Math.PI;
  return { x: Math.sin(fase) * 14, y: -Math.abs(Math.cos(fase)) * 8 };
}

// ¿Ha cambiado la canción? Devuelve la nueva si sí (y suena), si no null.
export function cambioDeCancion(antes, ahora) {
  if (!ahora?.sonando) return null;
  if (antes && antes.titulo === ahora.titulo && antes.artista === ahora.artista) return null;
  return ahora;
}

export function decirCancion(m) {
  if (!m) return 'No suena nada.';
  const quien = m.artista ? `${m.titulo}, de ${m.artista}` : m.titulo;
  return m.sonando ? `Suena ${quien}${m.app ? ` (${m.app})` : ''}.` : `Está en pausa: ${quien}.`;
}
