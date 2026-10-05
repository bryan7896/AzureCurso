// tipos-ejercicio/multi-select.js
// Selección múltiple con VARIAS respuestas correctas (opciones barajadas).

function renderMultiSelect(exercise, container, onListo) {
  const seleccion = new Set();
  const opciones = opcionesBarajadas(exercise.options, exercise);
  const mono = !!exercise.opcionesCodigo;
  const cuantas = (exercise.correctOptionIds || []).length;
  const nota = exercise.ocultarCantidad ? "Selecciona todas las que apliquen." : `Selecciona las ${cuantas} que apliquen.`;
  const dyn = prepararContenedor(container, exercise);

  const pintar = () => {
    dyn.innerHTML = `
      <p class="ajustes-nota">${nota}</p>
      <div class="opciones-lista">
        ${opciones
          .map(
            (o) => `
          <button type="button" class="opcion-btn opcion-multi ${mono ? "opcion-codigo" : ""} ${seleccion.has(o.id) ? "seleccionada" : ""}" data-id="${escAttr(o.id)}">
            <span class="opcion-check">${seleccion.has(o.id) ? "☑" : "☐"}</span>
            ${o.icono ? iconoHTML(o.icono, { tam: "sm" }) : ""}
            <span class="opcion-texto">${mono ? `<code>${escHTML(o.text)}</code>` : fmtTxt(o.text)}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${seleccion.size ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    dyn.querySelectorAll(".opcion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (seleccion.has(id)) seleccion.delete(id);
        else seleccion.add(id);
        pintar();
      });
    });
    dyn.querySelector("#btnComprobar")?.addEventListener("click", () => {
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
