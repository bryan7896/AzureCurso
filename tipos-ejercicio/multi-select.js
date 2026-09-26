// tipos-ejercicio/multi-select.js
// Selección múltiple con VARIAS respuestas correctas.

function renderMultiSelect(exercise, container, onListo) {
  const seleccion = new Set();

  const pintar = () => {
    container.innerHTML = `
      <div class="pregunta-prompt">${escHTML(exercise.prompt)}</div>
      <p class="ajustes-nota">Selecciona todas las que apliquen.</p>
      <div class="opciones-lista">
        ${(exercise.options || [])
          .map(
            (o) => `
          <button type="button" class="opcion-btn opcion-multi ${seleccion.has(o.id) ? "seleccionada" : ""}" data-id="${escHTML(o.id)}">
            <span class="opcion-check">${seleccion.has(o.id) ? "☑" : "☐"}</span> ${escHTML(o.text)}
          </button>`
          )
          .join("")}
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${seleccion.size ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    container.querySelectorAll(".opcion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (seleccion.has(id)) seleccion.delete(id);
        else seleccion.add(id);
        pintar();
      });
    });
    container.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (seleccion.size) onListo([...seleccion]);
    });
  };

  pintar();
}

function calificarMultiSelect(exercise, respuesta) {
  const esperado = new Set(exercise.correctOptionIds || []);
  const dado = new Set(respuesta || []);
  if (esperado.size !== dado.size) return { correcto: false };
  for (const id of esperado) if (!dado.has(id)) return { correcto: false };
  return { correcto: true };
}
