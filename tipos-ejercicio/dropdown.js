// tipos-ejercicio/dropdown.js
// Completar un enunciado eligiendo de listas desplegables ({{id}} en textWithBlanks).

function renderDropdown(exercise, container, onListo) {
  const seleccionadas = {}; // blankId -> valor

  const construirTexto = () => {
    let html = escHTML(exercise.textWithBlanks || "");
    (exercise.blanks || []).forEach((blank) => {
      const opciones = blank.options
        .map((op) => `<option value="${escHTML(op)}" ${seleccionadas[blank.id] === op ? "selected" : ""}>${escHTML(op)}</option>`)
        .join("");
      const select = `<select class="dropdown-select" data-blank="${escHTML(blank.id)}">
        <option value="" ${!seleccionadas[blank.id] ? "selected" : ""}>—</option>
        ${opciones}
      </select>`;
      html = html.replace(`{{${blank.id}}}`, select);
    });
    return html;
  };

  const pintar = () => {
    const todasLlenas = (exercise.blanks || []).every((b) => !!seleccionadas[b.id]);
    container.innerHTML = `
      <div class="pregunta-prompt dropdown-texto">${construirTexto()}</div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${todasLlenas ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    container.querySelectorAll(".dropdown-select").forEach((sel) => {
      sel.addEventListener("change", () => {
        seleccionadas[sel.dataset.blank] = sel.value;
        pintar();
      });
    });
    container.querySelector("#btnComprobar")?.addEventListener("click", () => {
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
