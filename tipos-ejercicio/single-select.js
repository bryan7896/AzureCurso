// tipos-ejercicio/single-select.js
// Selección múltiple con ÚNICA respuesta correcta.

function renderSingleSelect(exercise, container, onListo) {
  let seleccion = null;

  const pintar = () => {
    container.innerHTML = `
      <div class="pregunta-prompt">${escHTML(exercise.prompt)}</div>
      <div class="opciones-lista">
        ${(exercise.options || [])
          .map(
            (o) => `
          <button type="button" class="opcion-btn ${seleccion === o.id ? "seleccionada" : ""}" data-id="${escHTML(o.id)}">
            ${escHTML(o.text)}
          </button>`
          )
          .join("")}
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${seleccion ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    container.querySelectorAll(".opcion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        seleccion = btn.dataset.id;
        pintar();
      });
    });
    container.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (seleccion) onListo(seleccion);
    });
  };

  pintar();
}

function calificarSingleSelect(exercise, respuesta) {
  return { correcto: respuesta === exercise.correctOptionId };
}
