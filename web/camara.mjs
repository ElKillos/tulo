// La cámara del simulador: la webcam del ordenador hace de cámara del aparato.
// Detecta dónde hay una cara y qué hace una mano (no reconoce a nadie) con
// MediaPipe, que corre dentro del navegador: la imagen no sale del ordenador.
// Lo que sí se descarga de internet, la primera vez, es la propia librería y
// sus dos modelos.

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODELOS = 'https://storage.googleapis.com/mediapipe-models';
const MODELO_CARA = `${MODELOS}/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`;
const MODELO_MANO = `${MODELOS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`;
const CADA_MS = 66; // unas quince miradas por segundo: un saludo es rápido

let detectorCara = null;
let detectorMano = null;

export async function cargarDetectores() {
  if (detectorCara && detectorMano) return;
  const { FaceDetector, GestureRecognizer, FilesetResolver } = await import(`${CDN}/vision_bundle.mjs`);
  const ficheros = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  detectorCara ??= await FaceDetector.createFromOptions(ficheros, {
    baseOptions: { modelAssetPath: MODELO_CARA, delegate: 'CPU' },
    runningMode: 'VIDEO',
  });
  detectorMano ??= await GestureRecognizer.createFromOptions(ficheros, {
    baseOptions: { modelAssetPath: MODELO_MANO, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}

// Mira una imagen (un <video> o un <canvas>) y devuelve lo que hay, todo en
// fracciones de la imagen (0 a 1):
//   cara: { x, y, ancho, alto } | null     la cara más grande
//   mano: { gesto, puntos } | null         gesto según el detector y sus 21 puntos
export function mirar(fuente, t, ancho, alto) {
  const caras = detectorCara.detectForVideo(fuente, t).detections;
  let cara = null;
  if (caras.length) {
    const c = caras.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a)).boundingBox;
    cara = { x: c.originX / ancho, y: c.originY / alto, ancho: c.width / ancho, alto: c.height / alto };
  }
  const manos = detectorMano.recognizeForVideo(fuente, t);
  const mano = manos.landmarks.length
    ? { gesto: manos.gestures[0]?.[0]?.categoryName ?? 'None', puntos: manos.landmarks[0] }
    : null;
  return { cara, mano };
}

// Enciende la webcam y llama a `alVer({ cara, mano })` unas quince veces por
// segundo. Devuelve la función que la apaga.
export async function encenderCamara(video, alVer) {
  await cargarDetectores();
  const flujo = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
  video.srcObject = flujo;
  await video.play();
  const reloj = setInterval(() => {
    if (video.readyState < 2) return;
    alVer(mirar(video, performance.now(), video.videoWidth, video.videoHeight));
  }, CADA_MS);
  return () => {
    clearInterval(reloj);
    for (const pista of flujo.getTracks()) pista.stop();
    video.srcObject = null;
  };
}
