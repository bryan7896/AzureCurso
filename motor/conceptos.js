// motor/conceptos.js
//
// Módulo de "Conceptos": un glosario de términos técnicos (SaaS, API, LLM,
// etc.) con repetición espaciada tipo Anki. Cada concepto tiene un nivel de
// 1 a 10; acertar sus ejercicios sube el nivel y programa la próxima
// revisión más lejos en el tiempo; fallar lo baja y la reprograma pronto.
// Reutiliza el mismo renderEjercicio/calificarEjercicio/modal que las
// lecciones — aquí solo vive la lógica de niveles, fechas y reflexiones.

const CONCEPTOS_NIVEL_MIN = 1;
const CONCEPTOS_NIVEL_MAX = 10;

// Horas hasta la próxima revisión, según el nivel alcanzado (índice = nivel-1).
// Nivel 1 se repasa en unas horas; nivel 10, cada mes y medio — curva típica
// de un sistema de repetición espaciada.
const CONCEPTOS_INTERVALOS_HORAS = [4, 8, 24, 48, 96, 168, 288, 480, 720, 1080];

// Cuántos conceptos NUNCA estudiados se introducen como máximo por día —
// para que el primer día no aparezcan los 180 de una sola vez. Los repasos
// ya vencidos (conceptos que ya se estudiaron antes) NO tienen este límite:
// siempre se muestran todos, como en cualquier sistema de repetición
// espaciada real.
const CONCEPTOS_NUEVOS_POR_DIA = 12;

function horasDesdeAhora(horas) {
  return new Date(Date.now() + horas * 3600 * 1000).toISOString();
}

function conceptoEstaParaHoy(progreso) {
  if (!progreso.proximaRevision) return true;
  return new Date(progreso.proximaRevision).getTime() <= Date.now();
}

function contarNuevosIntroducidosHoy() {
  const hoyStr = new Date().toISOString().slice(0, 10);
  let cuenta = 0;
  Object.values(AppState.conceptos).forEach((p) => {
    if (p.historial.length && p.historial[0].fecha.slice(0, 10) === hoyStr) cuenta++;
  });
  return cuenta;
}

// Devuelve los conceptos para hoy: TODOS los repasos ya vencidos (sin
// límite) + conceptos nunca estudiados hasta agotar el cupo diario.
function conceptosDeHoy() {
  const catalogo = AppState.conceptosCatalogo || [];
  const vencidos = [];
  const nuevos = [];

  catalogo.forEach((c) => {
    const p = getConceptoState(c.id);
    if (!conceptoEstaParaHoy(p)) return;
    if (p.proximaRevision === null) nuevos.push(c);
    else vencidos.push(c);
  });

  vencidos.sort((a, b) => (getConceptoState(a.id).proximaRevision || "").localeCompare(getConceptoState(b.id).proximaRevision || ""));

  const cupoRestante = Math.max(0, CONCEPTOS_NUEVOS_POR_DIA - contarNuevosIntroducidosHoy());
  return { lista: [...vencidos, ...nuevos.slice(0, cupoRestante)], nuevosEnEspera: Math.max(0, nuevos.length - cupoRestante) };
}

function iniciarRepasoConcepto(conceptoId) {
  const progreso = getConceptoState(conceptoId);
  const concepto = (AppState.conceptosCatalogo || []).find((c) => c.id === conceptoId);
  if (!concepto) return null;
  progreso.repasoActual = {
    cola: concepto.ejercicios.map((e) => ({ exerciseId: e.id, excluido: false })),
    indiceActual: 0,
    resultados: {},
  };
  guardarConDebounce();
  return progreso.repasoActual;
}

function obtenerItemRepasoConcepto(conceptoId) {
  const progreso = getConceptoState(conceptoId);
  const repaso = progreso.repasoActual;
  const concepto = (AppState.conceptosCatalogo || []).find((c) => c.id === conceptoId);
  if (!repaso || !concepto || repaso.indiceActual >= repaso.cola.length) return null;
  const item = repaso.cola[repaso.indiceActual];
  const exercise = concepto.ejercicios.find((e) => e.id === item.exerciseId);
  return { item, exercise, posicion: repaso.indiceActual, esRepaso: item.excluido };
}

function procesarRespuestaConcepto(conceptoId, respuestaUsuario) {
  const actual = obtenerItemRepasoConcepto(conceptoId);
  if (!actual) return null;
  const resultado = calificarEjercicio(actual.exercise, respuestaUsuario);
  return {
    correcto: resultado.correcto,
    esReflexion: !!resultado.esReflexion,
    respuestaUsuario,
    exercise: actual.exercise,
    posicion: actual.posicion,
  };
}

function confirmarContinuarConcepto(conceptoId, pendiente) {
  const progreso = getConceptoState(conceptoId);
  const repaso = progreso.repasoActual;
  const item = repaso.cola[pendiente.posicion];
  const concepto = (AppState.conceptosCatalogo || []).find((c) => c.id === conceptoId);
  // Una reflexión queda excluida de la calificación del concepto, igual que
  // una copia reinsertada por [Repasar] — no tiene "correcto/incorrecto".
  const excluido = item.excluido || pendiente.esReflexion;
  repaso.resultados[pendiente.posicion] = { correcto: pendiente.correcto, excluido };

  if (pendiente.esReflexion) {
    AppState.reflexiones.push({
      conceptoId,
      termino: concepto ? concepto.termino : conceptoId,
      pregunta: pendiente.exercise.prompt,
      texto: pendiente.respuestaUsuario,
      fecha: new Date().toISOString(),
    });
  }

  return avanzarRepasoConcepto(conceptoId);
}

function confirmarRepasarConcepto(conceptoId, pendiente) {
  const progreso = getConceptoState(conceptoId);
  const repaso = progreso.repasoActual;
  const item = repaso.cola[pendiente.posicion];
  // Al mandar a repasar NO se guarda la reflexión de este intento (se
  // guardará la próxima vez que se confirme con Continuar).
  repaso.resultados[pendiente.posicion] = { correcto: pendiente.correcto, excluido: true };
  repaso.cola.push({ exerciseId: item.exerciseId, excluido: true });
  return avanzarRepasoConcepto(conceptoId);
}

function avanzarRepasoConcepto(conceptoId) {
  const progreso = getConceptoState(conceptoId);
  const repaso = progreso.repasoActual;
  repaso.indiceActual += 1;

  let cierre = null;
  if (repaso.indiceActual >= repaso.cola.length) {
    cierre = cerrarRepasoConcepto(conceptoId);
  }
  guardarConDebounce();
  return { termino: repaso.indiceActual >= repaso.cola.length, cierre };
}

function cerrarRepasoConcepto(conceptoId) {
  const progreso = getConceptoState(conceptoId);
  const repaso = progreso.repasoActual;

  let total = 0;
  let aciertos = 0;
  repaso.cola.forEach((item, i) => {
    const r = repaso.resultados[i];
    if (!r || r.excluido) return;
    total++;
    if (r.correcto) aciertos++;
  });

  // Ajuste de nivel: 100% -> +2, 2/3 o más -> +1, menos de la mitad -> -2.
  // Si TODO el repaso eran reflexiones (total=0), el nivel no se toca.
  if (total > 0) {
    const ratio = aciertos / total;
    let delta;
    if (ratio === 1) delta = 2;
    else if (ratio >= 0.6) delta = 1;
    else delta = -2;
    progreso.nivel = Math.min(CONCEPTOS_NIVEL_MAX, Math.max(CONCEPTOS_NIVEL_MIN, progreso.nivel + delta));
  }

  progreso.proximaRevision = horasDesdeAhora(CONCEPTOS_INTERVALOS_HORAS[progreso.nivel - 1]);
  progreso.historial.push({ fecha: new Date().toISOString(), aciertos, total });
  progreso.repasoActual = null;
  guardarConDebounce();

  return { nivel: progreso.nivel, proximaRevision: progreso.proximaRevision, aciertos, total };
}

// ------------------------------------------------------------
// Render de la pantalla de Conceptos (directorio + cola de hoy + reflexiones)
// ------------------------------------------------------------

function renderConceptos(callbacks) {
  const cont = document.getElementById("conceptosContainer");
  if (!cont) return;
  const catalogo = AppState.conceptosCatalogo || [];

  if (!catalogo.length) {
    cont.innerHTML = `<p class="aviso-vacio">Todavía no hay conceptos cargados en datos/conceptos.json.</p>`;
    return;
  }

  const { lista: hoy, nuevosEnEspera } = conceptosDeHoy();
  const todos = [...catalogo].sort((a, b) => getConceptoState(a.id).nivel - getConceptoState(b.id).nivel);

  const tarjeta = (c) => {
    const p = getConceptoState(c.id);
    return `
      <button class="tarjeta-concepto" data-concepto="${c.id}">
        <div class="concepto-nivel-anillo" style="--pct:${(p.nivel / CONCEPTOS_NIVEL_MAX) * 100}%"><span class="concepto-nivel-numero">${p.nivel}</span></div>
        <div class="concepto-info">
          <div class="concepto-termino">${escHTML(c.termino)}</div>
          <div class="concepto-nombre">${escHTML(c.nombreCompleto)}</div>
        </div>
      </button>
    `;
  };

  const reflexiones = AppState.reflexiones || [];

  cont.innerHTML = `
    <button class="btn-mapa-servicios" id="btnMapaServicios">
      <span class="btn-mapa-iconos">${["foundry", "language", "speech", "vision"].map((id) => iconoHTML(id, { tam: "sm", conNombre: false })).join("")}</span>
      <span class="btn-mapa-texto"><strong>🗺️ Mapa de servicios</strong><small>Los iconos de Azure agrupados por necesidad, con modo autoevaluación</small></span>
      <span class="btn-mapa-flecha">›</span>
    </button>
    ${hoy.length ? `
      <h3 class="conceptos-subtitulo">📅 Para repasar hoy (${hoy.length})</h3>
      <div class="lista-conceptos">${hoy.map(tarjeta).join("")}</div>
      ${nuevosEnEspera > 0 ? `<p class="ajustes-nota">➕ ${nuevosEnEspera} término(s) nuevo(s) esperando su turno mañana (máx. ${CONCEPTOS_NUEVOS_POR_DIA}/día).</p>` : ""}
    ` : `<p class="aviso-vacio">✅ No tienes repasos pendientes por ahora — vuelve más tarde.</p>`}

    <h3 class="conceptos-subtitulo">📚 Todos los conceptos</h3>
    <div class="lista-conceptos">${todos.map(tarjeta).join("")}</div>

    ${reflexiones.length ? `
      <h3 class="conceptos-subtitulo">💭 Tus reflexiones (${reflexiones.length})</h3>
      <button class="btn btn-ajustes full" id="btnCopiarReflexiones">📋 Copiar todas mis reflexiones</button>
    ` : ""}
  `;

  cont.querySelectorAll("[data-concepto]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onAbrirConcepto(btn.dataset.concepto));
  });
  cont.querySelector("#btnMapaServicios")?.addEventListener("click", () => callbacks.onAbrirMapa?.());
  cont.querySelector("#btnCopiarReflexiones")?.addEventListener("click", copiarReflexiones);
}
