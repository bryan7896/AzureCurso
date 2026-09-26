// motor/temario.js
//
// Configuración ESTÁTICA del temario oficial AI-901. No contiene ni un solo
// ejercicio: solo metadatos (título, dominio, total esperado, rutas de los
// .json). Gracias a esto, el mapa de secciones se puede pintar completo
// (con sus "(Vacío)") aunque datos/*.json todavía no tengan contenido.

export const DOMINIOS = [
  {
    id: 1,
    titulo: "Identificar conceptos y capacidades de IA",
    pesoOficial: "40–45%",
    totalEjercicios: 425,
  },
  {
    id: 2,
    titulo: "Implementar soluciones con Microsoft Foundry",
    pesoOficial: "55–60%",
    totalEjercicios: 575,
  },
];

export const SECCIONES = [
  { id: "1.1", dominio: 1, titulo: "IA responsable (Responsible AI)", totalEjercicios: 110 },
  { id: "1.2", dominio: 1, titulo: "Modelos y deployments", totalEjercicios: 90 },
  { id: "1.3", dominio: 1, titulo: "Cargas de trabajo de IA (AI Workloads)", totalEjercicios: 225 },
  { id: "2.1", dominio: 2, titulo: "Generative AI + Agents", totalEjercicios: 190 },
  { id: "2.2", dominio: 2, titulo: "Text + Speech", totalEjercicios: 115 },
  { id: "2.3", dominio: 2, titulo: "Computer Vision + Image Generation", totalEjercicios: 115 },
  { id: "2.4", dominio: 2, titulo: "Information Extraction + Content Understanding", totalEjercicios: 155 },
];

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
