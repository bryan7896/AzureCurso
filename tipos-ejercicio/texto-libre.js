// tipos-ejercicio/texto-libre.js
//
// Input de escritura libre, con dos modos:
//
//  - modo "recordar" (por defecto, para compatibilidad con datos ya
//    existentes): se califica comparando contra `respuestasAceptadas`, de
//    forma flexible (sin importar mayúsculas, tildes ni espacios extra).
//    El prompt puede ir en cualquier dirección: dar el término y pedir su
//    significado, o dar el significado/definición y pedir el término/sigla.
//
//  - modo "reflexion": NO tiene respuesta correcta. Es para preguntas
//    abiertas de análisis ("¿cuál usarías para X y por qué?"). Lo que se
//    escribe se guarda tal cual (ver motor/conceptos.js) para poder
//    revisarlo después — no cuenta para el nivel del concepto, igual que
//    los ejercicios de la sección de Aprendizaje no cuentan para la nota.

function renderTextoLibre(exercise, container, onListo) {
  const esReflexion = exercise.modo === "reflexion";
  const pintar = (valor) => {
    container.innerHTML = `
      <div class="pregunta-prompt">${escHTML(exercise.prompt)}</div>
      <div class="texto-libre-area">
        <input type="text" class="texto-libre-input" placeholder="${esReflexion ? "Escribe tu respuesta o reflexión…" : "Escribe tu respuesta…"}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               value="${escHTML(valor || "")}">
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${(valor || "").trim() ? "" : "disabled"}>
          ${esReflexion ? "💭 Guardar" : "✅ Comprobar"}
        </button>
      </div>
    `;
    const input = container.querySelector(".texto-libre-input");
    input.addEventListener("input", () => {
      container.querySelector("#btnComprobar").disabled = !input.value.trim();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) container.querySelector("#btnComprobar").click();
    });
    container.querySelector("#btnComprobar").addEventListener("click", () => {
      if (input.value.trim()) onListo(input.value.trim());
    });
    input.focus();
  };
  pintar("");
}

function calificarTextoLibre(exercise, respuesta) {
  if (exercise.modo === "reflexion") {
    // No hay respuesta correcta: se marca "correcto" para no afectar el
    // nivel del concepto, y se señala esReflexion para que el motor de
    // conceptos guarde el texto en vez de comparalo contra nada.
    return { correcto: true, esReflexion: true };
  }
  const dado = normalizarTextoLibre(respuesta);
  const aceptadas = exercise.respuestasAceptadas || [];
  const correcto = aceptadas.some((a) => normalizarTextoLibre(a) === dado);
  return { correcto };
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
