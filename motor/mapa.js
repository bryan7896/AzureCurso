// motor/mapa.js
//
// Dos vistas:
//  1) renderSecciones(): pantalla principal, agrupada por dominio (1 y 2),
//     con cada sección mostrando su total oficial y si está "(Vacío)".
//  2) renderLecciones(): dentro de una sección, la caja de lecciones
//     (máx. 10 ejercicios cada una) + acceso a "Aprendizaje" + botón de
//     reporte (habilitado desde la lección 5).
//
// Este módulo solo pinta HTML y dispara callbacks; toda la lógica de datos
// vive en storage.js.

// NOTA: sin `import` — este archivo se concatena después de temario.js y
// storage.js (ver MOTOR_JS_FILES en build.py), así que DOMINIOS,
// seccionesDeDominio, getSeccion, LECCIONES_PARA_HABILITAR_REPORTE,
// getSeccionState y seccionTieneDatos ya existen en el mismo scope.

function iconoEstadoSeccion(estado, tieneDatos) {
  if (!tieneDatos) return "🔒";
  if (estado === "aprobado") return "✅";
  if (estado === "requiere-reintento") return "🔁";
  if (estado === "en-progreso") return "▶️";
  return "🟦";
}

function etiquetaEstadoSeccion(estado, tieneDatos, mejorPuntajePct) {
  if (!tieneDatos) return "Vacío";
  if (estado === "aprobado") return `Aprobada · ${mejorPuntajePct}%`;
  if (estado === "requiere-reintento") return `Reintentar · ${mejorPuntajePct}%`;
  if (estado === "en-progreso") return "En progreso";
  return "Disponible";
}

// Fracción (0..1) de ejercicios de una sección cuyo ÚLTIMO resultado fue correcto.
function avanceSeccion(seccionId) {
  const e = getSeccionState(seccionId);
  if (!e.ejercicios.length) return 0;
  const ok = Object.values(e.progreso.resultadoPorEjercicio || {}).filter((v) => v === true).length;
  return ok / e.ejercicios.length;
}

// La sección donde más conviene estudiar ahora: la que más pesa en el examen
// y menos avance lleva (solo entre las que ya tienen ejercicios y no están aprobadas).
function seccionRecomendada() {
  let mejor = null;
  let mejorScore = -1;
  SECCIONES.forEach((s) => {
    if (!seccionTieneDatos(s.id)) return;
    if (getSeccionState(s.id).progreso.estado === "aprobado") return;
    const score = s.pesoExamen * (1 - avanceSeccion(s.id));
    if (score > mejorScore) { mejorScore = score; mejor = s.id; }
  });
  return mejor;
}

function pctExamen(s) {
  return Math.round((s.pesoExamen / SIMULACRO.totalPreguntas) * 100);
}

export function renderSecciones(callbacks) {
  const cont = document.getElementById("seccionesContainer");
  if (!cont) return;

  const recomendada = seccionRecomendada();
  const bloques = DOMINIOS.map((dominio) => {
    const secciones = seccionesDeDominio(dominio.id);
    const tarjetas = secciones
      .map((s) => {
        const estadoSeccion = getSeccionState(s.id);
        const tieneDatos = seccionTieneDatos(s.id);
        const cargando = !estadoSeccion.cargada;
        const icono = iconoEstadoSeccion(estadoSeccion.progreso.estado, tieneDatos);
        const etiqueta = cargando ? "Cargando…" : etiquetaEstadoSeccion(estadoSeccion.progreso.estado, tieneDatos, estadoSeccion.progreso.mejorPuntajePct);
        const bloqueada = !tieneDatos;
        const cargados = estadoSeccion.ejercicios.length;
        const textoEjercicios = !tieneDatos
          ? `${s.totalEjercicios} ejercicios previstos`
          : cargados < s.totalEjercicios
          ? `${cargados} de ${s.totalEjercicios} ejercicios`
          : `${cargados} ejercicios`;
        const esRecomendada = s.id === recomendada;

        return `
          <button class="tarjeta-seccion ${bloqueada ? "bloqueada" : ""} ${esRecomendada ? "recomendada" : ""}" data-seccion="${s.id}" ${bloqueada ? "disabled" : ""}>
            <div class="tarjeta-seccion-top">
              <span class="tarjeta-seccion-id">${s.id}</span>
              <span class="tarjeta-seccion-icono">${icono}</span>
            </div>
            <div class="tarjeta-seccion-titulo">${escHTML(s.titulo)}</div>
            <div class="peso-examen" title="Preguntas de cada 100 del examen que salen de esta sección">
              <div class="peso-examen-barra"><div class="peso-examen-fill" style="width:${Math.min(100, pctExamen(s) * 4)}%"></div></div>
              <span>≈ ${pctExamen(s)} % del examen</span>
            </div>
            <div class="tarjeta-seccion-meta">
              <span>${textoEjercicios}</span>
              <span class="tarjeta-seccion-estado">${esRecomendada ? "👉 Empieza aquí" : etiqueta}</span>
            </div>
          </button>
        `;
      })
      .join("");

    return `
      <section class="bloque-dominio">
        <header class="bloque-dominio-header">
          <h2>${dominio.id}. ${escHTML(dominio.titulo)}</h2>
          <span class="bloque-dominio-peso">${dominio.pesoOficial} del examen · ${seccionesDeDominio(dominio.id).reduce((t, s) => t + (getSeccionState(s.id).ejercicios.length || 0), 0)}/${dominio.totalEjercicios} ejercicios</span>
        </header>
        <div class="grid-secciones">${tarjetas}</div>
      </section>
    `;
  }).join("");

  cont.innerHTML = bloques;

  cont.querySelectorAll(".tarjeta-seccion[data-seccion]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onAbrirSeccion(btn.dataset.seccion));
  });
}

export function renderLecciones(seccionId, callbacks) {
  const cont = document.getElementById("leccionesContainer");
  if (!cont) return;

  const estado = getSeccionState(seccionId);
  const intento = estado.progreso.intentoActual;
  const lecciones = intento?.lecciones || [];

  let primeraNoCompletada = lecciones.findIndex((l) => !l.completada);
  if (primeraNoCompletada === -1) primeraNoCompletada = lecciones.length;

  const cajas = lecciones
    .map((l, idx) => {
      const originales = l.cola.map((item, i) => ({ ...item, i })).filter((item) => !item.excluido);
      const total = originales.length; // cuántos ejercicios "cuenta" nominalmente esta lección (fijo, no cambia con [Repasar])
      const hechos = originales.filter((item) => l.resultados[item.i] !== undefined).length; // para la barra de progreso
      // aciertos: igual que en verificarCierreIntento (sesion.js) — se basa
      // en resultados[i].excluido (lo comprometido), no en item.excluido,
      // porque un ítem ORIGINAL marcado [Repasar] queda excluido del
      // puntaje aunque su posición en `cola` siga con excluido=false.
      const aciertos = originales.filter((item) => {
        const r = l.resultados[item.i];
        return r && !r.excluido && r.correcto;
      }).length;
      const completada = l.completada;
      const actual = idx === primeraNoCompletada;
      const bloqueada = idx > primeraNoCompletada;
      const pct = total ? Math.round((hechos / total) * 100) : 0;

      return `
        <button class="caja-leccion ${completada ? "completada" : ""} ${actual ? "actual" : ""} ${bloqueada ? "bloqueada" : ""}"
                data-leccion="${idx}" ${bloqueada ? "disabled" : ""}>
          <div class="caja-leccion-numero">${bloqueada ? "🔒" : completada ? "✓" : idx + 1}</div>
          ${bloqueada ? "" : `<div class="caja-leccion-barra"><div class="caja-leccion-barra-fill" style="width:${pct}%"></div></div>`}
          <div class="caja-leccion-info">
            ${completada ? `${aciertos}/${total}` : bloqueada ? "Bloqueada" : `${total} ejercicios`}
          </div>
        </button>
      `;
    })
    .join("");

  const meta = getSeccion(seccionId);
  const nombreSeccion = document.getElementById("leccionesTitulo");
  if (nombreSeccion) nombreSeccion.textContent = `${seccionId} · ${meta ? meta.titulo : ""}`;

  const reporteHabilitado = estado.progreso.leccionesCompletadas >= LECCIONES_PARA_HABILITAR_REPORTE;
  const btnReporte = document.getElementById("btnCopiarReporteSeccion");
  if (btnReporte) btnReporte.disabled = !reporteHabilitado;

  const banner = renderBannerEstadoSeccion(estado, seccionId, callbacks);

  cont.innerHTML = banner + (lecciones.length
    ? `<div class="grid-lecciones">${cajas}</div>`
    : `<div class="aviso-vacio">Esta sección todavía no tiene ejercicios cargados.</div>`);

  cont.querySelectorAll(".caja-leccion[data-leccion]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onAbrirLeccion(seccionId, parseInt(btn.dataset.leccion, 10)));
  });

  const btnReintentar = cont.querySelector("#btnGenerarReintento");
  if (btnReintentar) {
    btnReintentar.addEventListener("click", () => callbacks.onGenerarReintento(seccionId));
  }
}

function renderBannerEstadoSeccion(estado, seccionId, callbacks) {
  const p = estado.progreso;
  const ultimo = p.intentos[p.intentos.length - 1];
  const detalleIntento = ultimo && ultimo.totalSeccion
    ? ` <small>(${ultimo.correctosSeccion}/${ultimo.totalSeccion} ejercicios de la sección${ultimo.esReintento ? ` · este reintento: ${ultimo.pctIntento}%` : ""})</small>`
    : "";
  if (p.estado === "aprobado") {
    return `<div class="banner-estado banner-exito">✅ Sección aprobada con ${ultimo ? ultimo.pct : p.mejorPuntajePct}%${detalleIntento}</div>`;
  }
  if (p.estado === "requiere-reintento") {
    const pct = ultimo ? ultimo.pct : p.mejorPuntajePct;
    const sinCal = ultimo ? ultimo.sinCalificar || 0 : 0;
    const mensaje = pct >= UMBRAL_APROBACION_PCT && sinCal > 0
      ? `🔁 Vas en ${pct}%, pero te faltan ${sinCal} ejercicio(s) por calificar (los que mandaste a Repasar).`
      : `🔁 La sección va en ${pct}% y necesitas ${UMBRAL_APROBACION_PCT}%.${sinCal ? ` Además faltan ${sinCal} ejercicio(s) por calificar.` : ""}`;
    return `
      <div class="banner-estado banner-alerta">
        <span>${mensaje}${detalleIntento} El reintento incluye lo que fallaste y lo que falta calificar.</span>
        <button class="btn btn-solido" id="btnGenerarReintento">Generar reintento</button>
      </div>
    `;
  }
  return "";
}

function escHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
