// motor/practica.js
//
// Todo lo de la sección "💡 Aprendizaje": teoría, logros autoreportados
// (checklist, sin verificación automática — el usuario marca "ya lo hice")
// y los ejercicios de práctica NO calificables. Reutilizan renderEjercicio/
// calificarEjercicio y el modal de feedback, pero [Repasar] aquí solo
// reordena dentro de la misma cola de práctica: nunca toca errorBank,
// historial de reporte, ni el % de la sección.

function renderAprendizaje(seccionId, callbacks) {
  const estado = getSeccionState(seccionId);
  const cont = document.getElementById("aprendizajeContainer");
  if (!cont) return;

  const info = estado.info;
  if (!info) {
    cont.innerHTML = `<p class="aviso-vacio">Esta sección todavía no tiene contenido de aprendizaje.</p>`;
    return;
  }

  const teoria = (info.learningContent?.sections || [])
    .map(
      (s) => `
        <div class="teoria-bloque">
          ${s.heading ? `<h3>${escHTML(s.heading)}</h3>` : ""}
          <div class="teoria-cuerpo">${formatearMarkdownBasico(s.body || "")}</div>
        </div>
      `
    )
    .join("");

  const logros = (info.achievements || [])
    .map((logro) => {
      const marcado = !!estado.progreso.logrosMarcados[logro.id];
      return `
        <label class="logro-item">
          <input type="checkbox" data-logro="${logro.id}" ${marcado ? "checked" : ""}>
          <span>${escHTML(logro.texto)}</span>
        </label>
      `;
    })
    .join("");

  const totalPractica = (info.practiceExercises || []).length;
  const practicaEnCurso = estado.progreso.practicaActual;
  const yaEmpezada = practicaEnCurso && practicaEnCurso.indiceActual < practicaEnCurso.cola.length;
  const yaCompleta = practicaEnCurso && practicaEnCurso.indiceActual >= practicaEnCurso.cola.length && practicaEnCurso.cola.length > 0;

  cont.innerHTML = `
    ${info.learningContent?.title ? `<h2>${escHTML(info.learningContent.title)}</h2>` : ""}
    ${teoria || `<p class="aviso-vacio">Sin contenido de teoría todavía.</p>`}

    ${logros ? `<div class="logros-bloque"><h4>🏅 Logros de esta sección</h4>${logros}</div>` : ""}

    ${totalPractica === 0 ? "" : `<div class="practica-bloque">
      <h4>✏️ Práctica (no calificable)</h4>
      <p class="ajustes-nota">${totalPractica} ejercicio(s) de refuerzo.</p>
      <button class="btn btn-solido full" id="btnIniciarPractica">
        ${yaCompleta ? "🔁 Repetir práctica" : yaEmpezada ? "▶ Continuar práctica" : "▶ Comenzar práctica"}
      </button>
    </div>`}
  `;

  cont.querySelectorAll("[data-logro]").forEach((chk) => {
    chk.addEventListener("change", () => {
      estado.progreso.logrosMarcados[chk.dataset.logro] = chk.checked;
      guardarConDebounce();
    });
  });

  cont.querySelector("#btnIniciarPractica")?.addEventListener("click", () => {
    if (yaCompleta) estado.progreso.practicaActual = null; // repetir desde cero
    callbacks.onIniciarPractica(seccionId);
  });
}

// Formateo de la teoría: **negritas**, `código inline`, saltos de línea y
// bloques ```lenguaje ... ``` que se muestran con el mismo estilo que los
// ejercicios de código (ver motor/codigo.js).
function formatearMarkdownBasico(texto) {
  const partes = String(texto ?? "").split(/```(\w+)?\n([\s\S]*?)```/g);
  let html = "";
  for (let i = 0; i < partes.length; i += 3) {
    html += fmtTxt((partes[i] || "").replace(/^\n+|\n+$/g, ""))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    if (i + 2 < partes.length) html += renderBloqueCodigo({ lang: partes[i + 1] || "text", title: "", source: partes[i + 2] });
  }
  return html;
}

// ------------------------------------------------------------
// Cola de práctica (no calificable)
// ------------------------------------------------------------

function asegurarPracticaActual(seccionId) {
  const estado = getSeccionState(seccionId);
  if (!estado.progreso.practicaActual) {
    const ids = (estado.info?.practiceExercises || []).map((e) => e.id);
    estado.progreso.practicaActual = {
      cola: ids.map((id) => ({ exerciseId: id })),
      indiceActual: 0,
    };
    guardarConDebounce();
  }
  return estado.progreso.practicaActual;
}

function obtenerItemPractica(seccionId) {
  const estado = getSeccionState(seccionId);
  const practica = estado.progreso.practicaActual;
  if (!practica || practica.indiceActual >= practica.cola.length) return null;
  const item = practica.cola[practica.indiceActual];
  const exercise = (estado.info?.practiceExercises || []).find((e) => e.id === item.exerciseId);
  return { exercise, posicion: practica.indiceActual };
}

function procesarRespuestaPractica(seccionId, respuestaUsuario) {
  const actual = obtenerItemPractica(seccionId);
  if (!actual) return null;
  const resultado = calificarEjercicio(actual.exercise, respuestaUsuario);
  return { correcto: resultado.correcto, exercise: actual.exercise, posicion: actual.posicion };
}

function avanzarPunteroPractica(seccionId) {
  const estado = getSeccionState(seccionId);
  const practica = estado.progreso.practicaActual;
  practica.indiceActual += 1;
  guardarConDebounce();
  return practica.indiceActual >= practica.cola.length;
}

function repasarItemPractica(seccionId) {
  const estado = getSeccionState(seccionId);
  const practica = estado.progreso.practicaActual;
  const item = practica.cola[practica.indiceActual];
  practica.cola.push({ exerciseId: item.exerciseId });
  return avanzarPunteroPractica(seccionId);
}
