// motor/storage.js
//
// Estado global de la app + persistencia en localStorage (100% offline,
// sin backend). También contiene la lógica de "intento" de una sección:
// cómo se arma la primera tanda de lecciones y cómo se arma la tanda de
// reintento (100% de los fallados + 30% de refuerzo, ponderado hacia el
// subtema que más se falló).
//
// Lo que NO vive aquí (llega en la Parte 2): renderizar cada tipo de
// ejercicio, calificarlo, el modal de Continuar/Repasar, y la función que
// CIERRA un intento (calcula el % final y decide aprobado/reintento).
// Esos módulos usan las funciones de aquí (obtenerIntentoActual,
// generarReintento, registrarResultadoEjercicio, etc.).

// NOTA: no se importa nada de temario.js con `import` — build.py concatena
// todos los módulos de motor/ en un único <script type="module">, así que
// SECCIONES, rutaInformacion, rutaEjercicios, RETRY_REFUERZO_RATIO y
// TAMANO_MAX_LECCION (definidos en temario.js, que se concatena ANTES que
// este archivo) ya están disponibles como variables del mismo scope.

const STORAGE_KEY = "ai901_trainer_v1";

export const AppState = {
  seccionActivaId: null,
  leccionActivaIndex: 0,
  secciones: {}, // seccionId -> ver seccionVacia()
  conceptosCatalogo: null, // contenido de datos/conceptos.json (no se persiste, se re-consulta como las secciones)
  conceptos: {}, // conceptoId -> ver conceptoVacio() (SÍ se persiste: nivel, próxima revisión, historial)
  reflexiones: [], // respuestas de ejercicios texto-libre modo "reflexion" (SÍ se persiste)
};

function seccionVacia() {
  return {
    cargada: false, // true una vez se consultó el .json (o falló al consultarlo)
    info: null, // contenido de {id}-informacion.json
    ejercicios: [], // banco completo de {id}-ejercicios.json
    progreso: {
      aprendizajeVisto: false,
      logrosMarcados: {}, // logroId -> true
      errorBank: {}, // exerciseId -> { vecesFallado, ultimaRespuesta, resuelto }
      intentos: [], // historial de intentos ya cerrados (resumen)
      intentoActual: null, // intento en curso (ver crearLeccionesDesdeIds)
      ultimoResultadoDetalle: {}, // exerciseId -> true/false, del último intento cerrado
      historialIntentoActual: [], // detalle fila x fila para el reporte (se reinicia con cada intento nuevo)
      estado: "no-iniciado", // no-iniciado | en-progreso | aprobado | requiere-reintento
      mejorPuntajePct: 0,
      leccionesCompletadas: 0, // para habilitar el botón de reporte (>=5)
      practicaActual: null, // cola de los 30 ejercicios de Aprendizaje (no calificables, ver practica.js)
    },
  };
}

export function getSeccionState(id) {
  if (!AppState.secciones[id]) AppState.secciones[id] = seccionVacia();
  return AppState.secciones[id];
}

export function seccionTieneDatos(id) {
  const s = AppState.secciones[id];
  return !!(s && s.cargada && s.ejercicios.length > 0);
}

// ------------------------------------------------------------
// Conceptos (glosario con repetición espaciada) — ver motor/conceptos.js
// para toda la lógica de niveles y programación de repasos. Aquí solo
// vive el modelo de datos y su persistencia.
// ------------------------------------------------------------

function conceptoVacio() {
  return {
    nivel: 1, // 1 a 10
    proximaRevision: null, // ISO string; null = nunca estudiado -> siempre "para hoy"
    historial: [], // [{ fecha, aciertos, total }]
    repasoActual: null, // cola en curso de este concepto (3 ejercicios)
  };
}

export function getConceptoState(id) {
  if (!AppState.conceptos[id]) AppState.conceptos[id] = conceptoVacio();
  return AppState.conceptos[id];
}

// ------------------------------------------------------------
// Persistencia
// ------------------------------------------------------------

export function guardar() {
  try {
    const data = {
      secciones: AppState.secciones,
      conceptos: AppState.conceptos,
      reflexiones: AppState.reflexiones,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("No se pudo guardar el progreso:", e);
  }
}

let _saveTimer = null;
export function guardarConDebounce() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(guardar, 400);
}

export function cargarDeStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    AppState.secciones = data.secciones || {};
    AppState.conceptos = data.conceptos || {};
    AppState.reflexiones = data.reflexiones || [];
    return true;
  } catch (e) {
    console.warn("No se pudo leer el progreso guardado:", e);
    return false;
  }
}

// Consulta datos/conceptos.json una sola vez (igual que asegurarDatosSeccion).
export async function asegurarCatalogoConceptos({ forzar = false } = {}) {
  if (AppState.conceptosCatalogo && !forzar) return AppState.conceptosCatalogo;
  try {
    const resp = await fetch("datos/conceptos.json", { cache: "no-store" });
    const data = resp.ok ? await resp.json() : null;
    AppState.conceptosCatalogo = (data && data.conceptos) || [];
  } catch (e) {
    console.warn("No se pudo cargar datos/conceptos.json:", e);
    AppState.conceptosCatalogo = AppState.conceptosCatalogo || [];
  }
  return AppState.conceptosCatalogo;
}

// ------------------------------------------------------------
// Carga de datos (fetch on demand, solo la primera vez por sección)
// ------------------------------------------------------------

/**
 * Asegura que una sección tenga sus datos cargados en memoria.
 * Si ya estaba cargada (this session o restaurada de localStorage) y no
 * se fuerza, NO vuelve a consultar el .json — así se respeta la regla:
 * "si tiene data no consulta nuevamente el json, si no tiene data, sí".
 */
export async function asegurarDatosSeccion(seccionId, { forzar = false } = {}) {
  const estado = getSeccionState(seccionId);
  if (estado.cargada && !forzar) return estado;

  try {
    const [infoResp, ejResp] = await Promise.all([
      fetch(rutaInformacion(seccionId), { cache: "no-store" }),
      fetch(rutaEjercicios(seccionId), { cache: "no-store" }),
    ]);
    const info = infoResp.ok ? await infoResp.json() : null;
    const ejData = ejResp.ok ? await ejResp.json() : null;
    const nuevos = (ejData && ejData.exercises) || [];

    estado.ejercicios = forzar && estado.ejercicios.length
      ? mergeEjercicios(estado.ejercicios, nuevos)
      : nuevos;
    estado.info = info;
    estado.cargada = true;
  } catch (e) {
    console.warn(`No se pudo cargar la sección ${seccionId}:`, e);
    estado.cargada = true; // evita reintentos infinitos automáticos en cada render
  }
  guardarConDebounce();
  return estado;
}

// Suma ejercicios nuevos (por id) sin perder errorBank/intentos de los que
// ya existían — usado por "🔍 Analizar" en Ajustes cuando vas rellenando
// los .json poco a poco.
function mergeEjercicios(actuales, nuevos) {
  const idsActuales = new Set(actuales.map((e) => e.id));
  const agregados = nuevos.filter((e) => !idsActuales.has(e.id));
  return [...actuales, ...agregados];
}

/** Re-consulta TODOS los .json de datos/, sin importar si ya estaban cargados. */
export async function analizarTodo() {
  const resultados = [];
  for (const s of SECCIONES) {
    const antes = getSeccionState(s.id).ejercicios.length;
    const estado = await asegurarDatosSeccion(s.id, { forzar: true });
    resultados.push({ id: s.id, titulo: s.titulo, total: estado.ejercicios.length, nuevos: estado.ejercicios.length - antes });
  }
  guardar();
  return resultados;
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

function barajar(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Cada lección es una "cola" única de posiciones (no dos arrays separados):
// así [Repasar] simplemente EMPUJA una copia excluida al final de la misma
// cola, y el puntero (indiceActual) avanza en línea recta hasta agotarla
// — sin importar cuánto haya crecido mientras tanto.
function crearLeccionesDesdeIds(ids) {
  const lecciones = [];
  for (let i = 0; i < ids.length; i += TAMANO_MAX_LECCION) {
    const grupo = ids.slice(i, i + TAMANO_MAX_LECCION);
    lecciones.push({
      cola: grupo.map((id) => ({ exerciseId: id, excluido: false })),
      indiceActual: 0,
      completada: false,
      resultados: {}, // posicion (índice en cola) -> { exerciseId, correcto, excluido }
    });
  }
  return lecciones;
}

// ------------------------------------------------------------
// Intento actual de una sección (1er intento y reintento)
// ------------------------------------------------------------

export function obtenerIntentoActual(seccionId) {
  const estado = getSeccionState(seccionId);
  if (!estado.progreso.intentoActual) {
    const ids = barajar(estado.ejercicios.map((e) => e.id));
    estado.progreso.intentoActual = {
      numero: estado.progreso.intentos.length + 1,
      esReintento: false,
      generadoEn: new Date().toISOString(),
      lecciones: crearLeccionesDesdeIds(ids),
    };
    estado.progreso.historialIntentoActual = [];
    estado.progreso.estado = "en-progreso";
    guardarConDebounce();
  }
  return estado.progreso.intentoActual;
}

// Arma la tanda de reintento: 100% de los fallados + 30% de refuerzo,
// ponderado hacia los subtemas donde más se falló (ver muestraPonderada).
export function generarReintento(seccionId) {
  const estado = getSeccionState(seccionId);
  const detalle = estado.progreso.ultimoResultadoDetalle || {};
  const ids = construirIdsReintento(estado.ejercicios, detalle);

  estado.progreso.intentoActual = {
    numero: estado.progreso.intentos.length + 1,
    esReintento: true,
    generadoEn: new Date().toISOString(),
    lecciones: crearLeccionesDesdeIds(ids),
  };
  estado.progreso.historialIntentoActual = [];
  estado.progreso.estado = "en-progreso";
  guardarConDebounce();
  return estado.progreso.intentoActual;
}

function construirIdsReintento(todosEjercicios, resultadosFinales) {
  const porId = new Map(todosEjercicios.map((e) => [e.id, e]));
  const falladosIds = Object.keys(resultadosFinales).filter((id) => resultadosFinales[id] === false);
  const aprobadosIds = Object.keys(resultadosFinales).filter((id) => resultadosFinales[id] === true);

  const fallosPorSubtema = {};
  falladosIds.forEach((id) => {
    const sub = porId.get(id)?.subtopic || porId.get(id)?.topic || "_general";
    fallosPorSubtema[sub] = (fallosPorSubtema[sub] || 0) + 1;
  });

  const cantidadRefuerzo = Math.round(aprobadosIds.length * RETRY_REFUERZO_RATIO);
  const refuerzo = muestraPonderadaPorSubtema(aprobadosIds, porId, fallosPorSubtema, cantidadRefuerzo);

  return barajar([...falladosIds, ...refuerzo]);
}

// Elige `cantidad` ids de `passedIds` sin reemplazo, dando más probabilidad
// a los que pertenecen a un subtema con más fallos (así el 30% de refuerzo
// se concentra en lo que más te costó, en vez de ser puramente al azar).
function muestraPonderadaPorSubtema(passedIds, porId, fallosPorSubtema, cantidad) {
  if (cantidad <= 0 || passedIds.length === 0) return [];
  const pool = passedIds.map((id) => {
    const sub = porId.get(id)?.subtopic || porId.get(id)?.topic || "_general";
    return { id, peso: (fallosPorSubtema[sub] || 0) + 1 };
  });
  const elegidos = [];
  const disponibles = [...pool];
  for (let i = 0; i < cantidad && disponibles.length; i++) {
    const total = disponibles.reduce((s, x) => s + x.peso, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < disponibles.length - 1; idx++) {
      r -= disponibles[idx].peso;
      if (r <= 0) break;
    }
    elegidos.push(disponibles[idx].id);
    disponibles.splice(idx, 1);
  }
  return elegidos;
}

// ------------------------------------------------------------
// Reset / exportar / importar
// ------------------------------------------------------------

export function reiniciarProgresoSeccion(seccionId) {
  const estado = getSeccionState(seccionId);
  const { ejercicios, info } = estado;
  AppState.secciones[seccionId] = { ...seccionVacia(), cargada: true, ejercicios, info };
  guardar();
}

export function reiniciarTodoElProgreso() {
  Object.keys(AppState.secciones).forEach((id) => reiniciarProgresoSeccion(id));
  Object.keys(AppState.conceptos).forEach((id) => { AppState.conceptos[id] = conceptoVacio(); });
  AppState.reflexiones = [];
  guardar();
}

export function exportarProgreso() {
  return JSON.stringify({ secciones: AppState.secciones, conceptos: AppState.conceptos, reflexiones: AppState.reflexiones, exportadoEn: new Date().toISOString() }, null, 2);
}

export function importarProgreso(jsonText) {
  const data = JSON.parse(jsonText);
  if (!data || !data.secciones) throw new Error("El archivo no tiene el formato esperado.");
  AppState.secciones = data.secciones;
  AppState.conceptos = data.conceptos || {};
  AppState.reflexiones = data.reflexiones || [];
  guardar();
}
