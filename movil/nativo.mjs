// Puente con la app nativa de iPhone (movil/swift/, D-049; sin compilar todavía).
// Dentro de la app de Swift la página corre en una ventana web y puede pedirle
// lo que la web no tiene: avisos con la app cerrada. Fuera de ella (Safari, la
// web instalada) no hace nada.
//
// Lógica pura: qué avisos se le pasan al teléfono. El envío está al final.

export const MAX_AVISOS = 60; // iOS admite 64 avisos locales pendientes por app

const TITULOS = { temporizador: 'Temporizador', recordatorio: 'Recordatorio', alarma: 'Alarma' };

// `avisos`: lo que da avisosPendientes(pet) → [{ id, clase, fin, etiqueta?, texto? }].
// Devuelve los que aún no han vencido, por orden, con lo justo para el teléfono.
export function avisosParaNativo(avisos, ahora, max = MAX_AVISOS) {
  return (avisos ?? [])
    .filter((a) => a && Number.isFinite(a.fin) && a.fin > ahora)
    .sort((a, b) => a.fin - b.fin)
    .slice(0, max)
    .map((a) => ({
      id: `tulo-${a.clase ?? 'aviso'}-${a.id}`,
      fin: Math.round(a.fin),
      titulo: TITULOS[a.clase] ?? 'Tulo',
      texto: String(a.texto || a.etiqueta || '').slice(0, 120) || (TITULOS[a.clase] ? `${TITULOS[a.clase]} de Tulo` : 'Tulo te avisa'),
      alarma: a.clase === 'alarma',
    }));
}

// Un bloque de concentración en marcha también avisa al acabar.
export function avisoDeFoco(foco, ahora) {
  if (!foco || !Number.isFinite(foco.fin) || foco.fin <= ahora) return null;
  return { id: 'tulo-foco', fin: Math.round(foco.fin), titulo: 'Bloque acabado', texto: 'Tulo ha comido. Descansa un poco.', alarma: false };
}

// La misma lista dos veces seguidas no se manda dos veces.
export const huella = (lista) => JSON.stringify(lista.map((a) => [a.id, a.fin, a.texto]));

export function hayNativo(ventana = globalThis) {
  return Boolean(ventana?.webkit?.messageHandlers?.tulo?.postMessage);
}

// Arranca el envío: cada `cadaMs` mira los avisos y, si han cambiado, se los
// pasa a la app. `leer()` devuelve { avisos, foco }. Devuelve una función que lo para.
// Va con su propio latido (setInterval), no colgado del dibujo.
export function conectarNativo({ leer, ventana = globalThis, cadaMs = 3000, ahora = () => Date.now() } = {}) {
  if (!hayNativo(ventana)) return null;
  let ultima = null;
  const paso = () => {
    let lista;
    try {
      const { avisos, foco } = leer();
      lista = avisosParaNativo(avisos, ahora());
      const f = avisoDeFoco(foco, ahora());
      if (f) lista.push(f);
    } catch { return; }
    const h = huella(lista);
    if (h === ultima) return;
    ultima = h;
    ventana.webkit.messageHandlers.tulo.postMessage({ tipo: 'avisos', avisos: lista });
  };
  paso();
  const id = ventana.setInterval(paso, cadaMs);
  return () => ventana.clearInterval(id);
}
