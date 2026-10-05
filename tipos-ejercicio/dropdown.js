// tipos-ejercicio/dropdown.js
// Completar un enunciado eligiendo de listas desplegables ({{id}} en
// textWithBlanks). Las opciones de cada lista se barajan al abrir el ejercicio.

function renderDropdown(exercise, container, onListo) {
  const seleccionadas = {}; // blankId -> valor
  const opcionesPorBlank = {};
  (exercise.blanks || []).forEach((b) => { opcionesPorBlank[b.id] = opcionesBarajadas(b.options, exercise); });
  const dyn = prepararContenedor(container, exercise, { promptHtml: "" });

  const construirTexto = () => {
    let html = fmtTxt(exercise.textWithBlanks || "");
    (exercise.blanks || []).forEach((blank) => {
      const opciones = opcionesPorBlank[blank.id]
        .map((op) => `<option value="${escAttr(op)}" ${seleccionadas[blank.id] === op ? "selected" : ""}>${escHTML(op)}</option>`)
        .join("");
      const select = `<select class="dropdown-select" data-blank="${escAttr(blank.id)}">
        <option value="" ${!seleccionadas[blank.id] ? "selected" : ""}>—</option>
        ${opciones}
      </select>`;
      html = html.replace(`{{${blank.id}}}`, select);
    });
    return html;
  };

  const pintar = () => {
    const todasLlenas = (exercise.blanks || []).every((b) => !!seleccionadas[b.id]);
    dyn.innerHTML = `
      ${exercise.prompt ? `<div class="dropdown-instruccion">${fmtTxt(exercise.prompt)}</div>` : ""}
      <div class="pregunta-prompt dropdown-texto">${construirTexto()}</div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${todasLlenas ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    dyn.querySelectorAll(".dropdown-select").forEach((sel) => {
      sel.addEventListener("change", () => {
        seleccionadas[sel.dataset.blank] = sel.value;
        pintar();
      });
    });
    dyn.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (todasLlenas) {
        onListo((exercise.blanks || []).map((b) => ({ id: b.id, selected: seleccionadas[b.id] })));
      }
    });
  };

  pintar();
}

function calificarDropdown(exercise, respuesta) {
  const dado = new Map((respuesta || []).map((b) => [b.id, b.selected]));
  for (const blank of exercise.blanks || []) {
    if (dado.get(blank.id) !== blank.correctOption) return { correcto: false };
  }
  return { correcto: true };
}
