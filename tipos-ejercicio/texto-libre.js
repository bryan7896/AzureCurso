// tipos-ejercicio/texto-libre.js
//
// Input de escritura libre, con dos modos:
//
//  - modo "recordar" (por defecto): AUTOEVALUACIÓN. El usuario escribe lo
//    que recuerda, pulsa "Ver respuesta", compara su texto con la respuesta
//    de referencia y decide él mismo si la sabía o no. El sistema NO
//    compara textos (así una respuesta con otras palabras pero correcta no
//    se marca como error). `respuestasAceptadas[0]` es solo la referencia
//    que se le muestra. El prompt puede ir en cualquier dirección.
//
//  - modo "reflexion": NO tiene respuesta correcta. Es para preguntas
//    abiertas de análisis ("¿cuál usarías para X y por qué?"). Lo que se
//    escribe se guarda tal cual (ver motor/conceptos.js) para poder
//    revisarlo después — no cuenta para el nivel del concepto, igual que
//    los ejercicios de la sección de Aprendizaje no cuentan para la nota.

function renderTextoLibre(exercise, container, onListo) {
  const esReflexion = exercise.modo === "reflexion";

  // Fase 1: escribir. Fase 2 (solo "recordar"): comparar y autoevaluarse.
  const pintar = (valor) => {
    container.innerHTML = `
      ${renderImagenDeEjercicio(exercise)}
      <div class="pregunta-prompt">${fmtTxt(exercise.prompt)}</div>
      ${renderCodigoDeEjercicio(exercise)}
      <div class="texto-libre-area">
        <input type="text" class="texto-libre-input" placeholder="${esReflexion ? "Escribe tu respuesta o reflexión…" : "Escribe lo que recuerdas…"}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               value="${escHTML(valor || "")}">
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${(valor || "").trim() ? "" : "disabled"}>
          ${esReflexion ? "💭 Guardar" : "👁️ Ver respuesta"}
        </button>
      </div>
    `;
    const input = container.querySelector(".texto-libre-input");
    const btn = container.querySelector("#btnComprobar");
    input.addEventListener("input", () => { btn.disabled = !input.value.trim(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) btn.click();
    });
    btn.addEventListener("click", () => {
      const texto = input.value.trim();
      if (!texto) return;
      if (esReflexion) onListo(texto);
      else pintarAutoevaluacion(texto);
    });
    input.focus();
  };

  const pintarAutoevaluacion = (texto) => {
    const referencia = (exercise.respuestasAceptadas || [])[0] || "";
    container.innerHTML = `
      ${renderImagenDeEjercicio(exercise)}
      <div class="pregunta-prompt">${fmtTxt(exercise.prompt)}</div>
      ${renderCodigoDeEjercicio(exercise)}
      <div class="autoeval-comparacion">
        <div class="autoeval-caja autoeval-tuya">
          <div class="autoeval-etiqueta">✍️ Tu respuesta</div>
          <div class="autoeval-texto">${escHTML(texto)}</div>
        </div>
        <div class="autoeval-caja autoeval-referencia">
          <div class="autoeval-etiqueta">📖 Respuesta de referencia</div>
          <div class="autoeval-texto">${escHTML(referencia)}</div>
        </div>
      </div>
      <p class="autoeval-pregunta">Compáralas con honestidad: ¿captaste la idea?</p>
      <div class="autoeval-botones">
        <button type="button" class="btn autoeval-no" id="btnNoSabia">❌ No la sabía</button>
        <button type="button" class="btn btn-solido autoeval-si" id="btnSabia">✅ La sabía</button>
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-enlace" id="btnEditar">✏️ Cambiar mi respuesta</button>
      </div>
    `;
    container.querySelector("#btnSabia").addEventListener("click", () => onListo({ autoevaluado: true, texto, sabia: true }));
    container.querySelector("#btnNoSabia").addEventListener("click", () => onListo({ autoevaluado: true, texto, sabia: false }));
    container.querySelector("#btnEditar").addEventListener("click", () => pintar(texto));
  };

  pintar("");
}

function calificarTextoLibre(exercise, respuesta) {
  if (exercise.modo === "reflexion") {
    // No hay respuesta correcta: se marca "correcto" para no afectar el
    // nivel del concepto, y se señala esReflexion para que el motor de
    // conceptos guarde el texto.
    return { correcto: true, esReflexion: true };
  }
  // Modo "recordar": el veredicto lo da el usuario (autoevaluación).
  return { correcto: !!(respuesta && respuesta.sabia), autoevaluado: true };
}

// minúsculas + sin tildes + espacios colapsados y recortados
function normalizarTextoLibre(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
