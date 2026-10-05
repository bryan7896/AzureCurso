// motor/temario.js
//
// Configuración ESTÁTICA del temario oficial AI-901 (habilidades medidas al
// 15 de abril de 2026). No contiene ni un solo ejercicio: solo metadatos
// (título, dominio, total esperado, peso en el examen, rutas de los .json).
// Gracias a esto, el mapa de secciones se puede pintar completo (con sus
// "(Vacío)") aunque datos/*.json todavía no tengan contenido.

// Súbelo cada vez que cambies ejercicios en datos/*.json: la app vuelve a
// leer los bancos sola y limpia el progreso de ejercicios que ya no existen.
const DATA_VERSION = "2026-10-05-p5";

export const DOMINIOS = [
  {
    id: 1,
    titulo: "Identificar conceptos y capacidades de IA",
    pesoOficial: "40–45%",
    totalEjercicios: 232,
  },
  {
    id: 2,
    titulo: "Implementar soluciones con Microsoft Foundry",
    pesoOficial: "55–60%",
    totalEjercicios: 283,
  },
];

// `pesoExamen` = cuántas de las 45 preguntas de un simulacro salen de esa
// sección (ver SIMULACRO.distribucion). Es el "foco" de estudio: la sección
// con más peso merece más banco y más tiempo. `totalEjercicios` es la meta
// de banco, repartida en proporción a ese peso (≈13 ejercicios por pregunta
// de examen), con un poco más donde el examen exige más práctica.
export const SECCIONES = [
  { id: "1.1", dominio: 1, titulo: "IA responsable (Responsible AI)", totalEjercicios: 90, pesoExamen: 7 },
  { id: "1.2", dominio: 1, titulo: "Modelos y deployments", totalEjercicios: 66, pesoExamen: 5 },
  { id: "1.3", dominio: 1, titulo: "Cargas de trabajo de IA (AI Workloads)", totalEjercicios: 76, pesoExamen: 7 },
  { id: "2.1", dominio: 2, titulo: "Generative AI + Agents", totalEjercicios: 101, pesoExamen: 9 },
  { id: "2.2", dominio: 2, titulo: "Text + Speech", totalEjercicios: 66, pesoExamen: 6 },
  { id: "2.3", dominio: 2, titulo: "Computer Vision + Image Generation", totalEjercicios: 58, pesoExamen: 5 },
  { id: "2.4", dominio: 2, titulo: "Information Extraction + Content Understanding", totalEjercicios: 58, pesoExamen: 6 },
];

// Habilidades oficiales (study guide AI-901, 15-abr-2026) por sección. Cada
// ejercicio puede declarar `skill: "<id>"` para que el simulacro y el reporte
// digan QUÉ habilidad oficial estás fallando, no solo qué subtema.
export const HABILIDADES = {
  "1.1": [
    { id: "equidad", texto: "Consideraciones de equidad en una solución de IA" },
    { id: "confiabilidad", texto: "Consideraciones de confiabilidad y seguridad" },
    { id: "privacidad", texto: "Consideraciones de privacidad y seguridad" },
    { id: "inclusion", texto: "Consideraciones de inclusión" },
    { id: "transparencia", texto: "Consideraciones de transparencia" },
    { id: "responsabilidad", texto: "Consideraciones de responsabilidad (accountability)" },
  ],
  "1.2": [
    { id: "como-funcionan", texto: "Describir cómo funcionan los modelos de IA generativa" },
    { id: "elegir-modelo", texto: "Elegir un modelo según sus capacidades" },
    { id: "despliegue-config", texto: "Opciones de despliegue y parámetros de configuración" },
  ],
  "1.3": [
    { id: "escenarios", texto: "Escenarios de cargas de trabajo (generativa, agéntica, texto, voz, visión, extracción)" },
    { id: "texto", texto: "Técnicas de análisis de texto: palabras clave, entidades, sentimiento, resumen" },
    { id: "voz", texto: "Reconocimiento y síntesis de voz" },
    { id: "vision", texto: "Visión artificial y generación de imágenes" },
    { id: "extraccion", texto: "Extraer información de texto, imágenes, audio y video" },
  ],
  "2.1": [
    { id: "prompts", texto: "Crear prompts de sistema y de usuario efectivos" },
    { id: "desplegar-portal", texto: "Desplegar un modelo e interactuar con él en el portal de Foundry" },
    { id: "chat-sdk", texto: "Crear un cliente de chat ligero con el Foundry SDK" },
    { id: "agente-portal", texto: "Crear y probar un agente único en el portal de Foundry" },
    { id: "agente-cliente", texto: "Crear una aplicación cliente ligera para un agente" },
  ],
  "2.2": [
    { id: "texto-app", texto: "Aplicación ligera con análisis de texto" },
    { id: "voz-multimodal", texto: "Responder a prompts hablados con un modelo multimodal" },
    { id: "voz-app", texto: "Aplicación ligera con Azure Speech en Foundry Tools" },
  ],
  "2.3": [
    { id: "entrada-visual", texto: "Interpretar entrada visual en prompts con un modelo multimodal" },
    { id: "generar-imagen", texto: "Crear salidas visuales con modelos generativos" },
    { id: "vision-app", texto: "Aplicación ligera con capacidades de visión" },
  ],
  "2.4": [
    { id: "cu-documentos", texto: "Extraer información de documentos y formularios con Content Understanding" },
    { id: "cu-imagenes", texto: "Extraer información de imágenes con Content Understanding" },
    { id: "cu-audio-video", texto: "Extraer información de audio y video con Content Understanding" },
    { id: "cu-app", texto: "Aplicación ligera de extracción de información" },
  ],
};

export function getSeccion(id) {
  return SECCIONES.find((s) => s.id === id) || null;
}

export function getDominio(id) {
  return DOMINIOS.find((d) => d.id === id) || null;
}

export function seccionesDeDominio(dominioId) {
  return SECCIONES.filter((s) => s.dominio === dominioId);
}

export function rutaInformacion(seccionId) {
  return `datos/${seccionId}-informacion.json`;
}

export function rutaEjercicios(seccionId) {
  return `datos/${seccionId}-ejercicios.json`;
}

// ---- Reglas de negocio del examen / la app (ajustables en un solo lugar) ----

export const UMBRAL_APROBACION_PCT = 90; // % mínimo sobre el 100% de la sección
export const RETRY_FAILED_RATIO = 1.0; // 100% de los ejercicios fallados
export const RETRY_REFUERZO_RATIO = 0.3; // 30% de los ejercicios ya aprobados
export const TAMANO_MAX_LECCION = 10; // "caja" de máximo 10 ejercicios
export const LECCIONES_PARA_HABILITAR_REPORTE = 5; // desde la lección 5 en adelante

// ---- Prioridad por ejercicio ----
// Cada ejercicio puede traer `peso: 1 | 2 | 3`:
//   3 = núcleo (escenario tipo examen, "¿qué servicio uso?", código del SDK)
//   2 = importante (concepto que el examen da por sabido)
//   1 = apoyo (dato de contexto; sin `peso` se asume 2)
// Se usa para muestrear el simulacro y para el refuerzo de los reintentos.
export const PESO_EJERCICIO_DEFECTO = 2;

// ---- Simulacro de examen ----
// Microsoft no publica cuántas preguntas tiene AI-901 ni cómo escala el 700;
// estos números son una aproximación de práctica, no la fórmula oficial.
export const SIMULACRO = {
  totalPreguntas: 45,
  minutos: 60,
  aprobadoPct: 70, // referencia: 700 de 1000 puntos
  minimoParaIniciar: 15, // con menos ejercicios cargados no tiene sentido
  historialMax: 20,
};
