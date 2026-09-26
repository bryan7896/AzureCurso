// motor/modal.js
//
// Modal que se muestra DESPUÉS de responder cualquier ejercicio (de los 5
// tipos, calificable o no). Siempre ofrece [Continuar] y [Repasar] — el
// usuario puede mandar a repasar incluso una respuesta correcta.

function mostrarModalFeedback({ exercise, correcto, onContinuar, onRepasar }) {
  const existente = document.querySelector(".modal-overlay");
  if (existente) existente.remove();

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-activo";
  modal.innerHTML = `
    <div class="modal-tarjeta modal-feedback ${correcto ? "feedback-correcto" : "feedback-incorrecto"}">
      <div class="feedback-encabezado">
        <span class="feedback-icono">${correcto ? "✅" : "❌"}</span>
        <span class="feedback-titulo">${correcto ? "¡Correcto!" : "No era esa"}</span>
      </div>
      <p class="feedback-explicacion">${escHTML(exercise?.explanation || "")}</p>
      <div class="modal-botones">
        <button class="btn" id="btnRepasar">🔁 Repasar</button>
        <button class="btn btn-solido" id="btnContinuar">Continuar ▶</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cerrar = () => modal.remove();
  modal.querySelector("#btnContinuar").addEventListener("click", () => { cerrar(); onContinuar?.(); });
  modal.querySelector("#btnRepasar").addEventListener("click", () => { cerrar(); onRepasar?.(); });
}
