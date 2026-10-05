// tipos-ejercicio/true-false.js
// Verdadero/Falso o Sí/No (mismo tipo, cambia solo el texto de los botones).
// Puede llevar `code` (p. ej. "¿este código imprime X?") o `imagen`.

function renderTrueFalse(exercise, container, onListo) {
  let seleccion = null; // true | false | null
  const labels = exercise.labels || { affirmative: "Verdadero", negative: "Falso" };
  const dyn = prepararContenedor(container, exercise, {
    promptHtml: `<div class="pregunta-prompt">${fmtTxt(exercise.statement || exercise.prompt)}</div>`,
  });

  const pintar = () => {
    dyn.innerHTML = `
      <div class="opciones-lista opciones-vf">
        <button type="button" class="opcion-btn ${seleccion === true ? "seleccionada" : ""}" data-val="true">${escHTML(labels.affirmative)}</button>
        <button type="button" class="opcion-btn ${seleccion === false ? "seleccionada" : ""}" data-val="false">${escHTML(labels.negative)}</button>
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${seleccion === null ? "disabled" : ""}>✅ Comprobar</button>
      </div>
    `;

    dyn.querySelectorAll(".opcion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        seleccion = btn.dataset.val === "true";
        pintar();
      });
    });
    dyn.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (seleccion !== null) onListo(seleccion);
    });
  };

  pintar();
}

function calificarTrueFalse(exercise, respuesta) {
  return { correcto: !!respuesta === !!exercise.correctAnswer };
}
