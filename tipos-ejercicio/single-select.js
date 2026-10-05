// tipos-ejercicio/single-select.js
// Selección múltiple con ÚNICA respuesta correcta. Las opciones se barajan
// en cada render (antes la correcta siempre salía primero).

function renderSingleSelect(exercise, container, onListo) {
  let seleccion = null;
  const opciones = opcionesBarajadas(exercise.options, exercise);
  const mono = !!exercise.opcionesCodigo;
  const dyn = prepararContenedor(container, exercise);

  const pintar = () => {
    dyn.innerHTML = `
      <div class="opciones-lista">
        ${opciones
          .map(
            (o) => `
          <button type="button" class="opcion-btn ${mono ? "opcion-codigo" : ""} ${seleccion === o.id ? "seleccionada" : ""}" data-id="${escAttr(o.id)}">
            ${o.icono ? iconoHTML(o.icono, { tam: "sm" }) : ""}
            <span class="opcion-texto">${mono ? `<code>${escHTML(o.text)}</code>` : fmtTxt(o.text)}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${seleccion ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    dyn.querySelectorAll(".opcion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        seleccion = btn.dataset.id;
        pintar();
      });
    });
    dyn.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (seleccion) onListo(seleccion);
    });
  };

  pintar();
}

function calificarSingleSelect(exercise, respuesta) {
  return { correcto: respuesta === exercise.correctOptionId };
}
