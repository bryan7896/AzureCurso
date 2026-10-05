// motor/modal.js
//
// Modal que se muestra DESPUÉS de responder cualquier ejercicio (de los 6
// tipos, calificable o no). Siempre ofrece [Continuar] y [Repasar] — el
// usuario puede mandar a repasar incluso una respuesta correcta.
//
// Para ejercicios de texto-libre en modo "reflexion" (sin respuesta
// correcta), se pasa esReflexion:true y el modal muestra un estado neutral
// ("guardado") en vez de ✅/❌.

function mostrarModalFeedback({ exercise, correcto, esReflexion, respuestaUsuario, onContinuar, onRepasar }) {
  const existente = document.querySelector(".modal-overlay");
  if (existente) existente.remove();

  const clase = esReflexion ? "feedback-reflexion" : correcto ? "feedback-correcto" : "feedback-incorrecto";
  const icono = esReflexion ? "💭" : correcto ? "✅" : "❌";
  const titulo = esReflexion ? "Respuesta guardada" : correcto ? "¡Correcto!" : "No era esa";

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-activo";
  modal.innerHTML = `
    <div class="modal-tarjeta modal-feedback ${clase}">
      <div class="feedback-encabezado">
        <span class="feedback-icono">${icono}</span>
        <span class="feedback-titulo">${titulo}</span>
      </div>
      ${exercise?.type === "code-fill" && !esReflexion ? `<div class="feedback-codigo">${renderSolucionCodeFill(exercise, respuestaUsuario)}</div>` : ""}
      <p class="feedback-explicacion">${fmtTxt(exercise?.explanation || (esReflexion ? "Podrás revisar todas tus reflexiones desde la pantalla de Conceptos." : ""))}</p>
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
