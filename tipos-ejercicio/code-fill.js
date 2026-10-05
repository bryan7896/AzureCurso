// tipos-ejercicio/code-fill.js
//
// "Completa el código": un bloque de código real (resaltado, con números de
// línea) donde los {{huecos}} son listas desplegables dentro del propio
// código. Mide justo lo que pide AI-901 en el dominio de implementación:
// leer y completar fragmentos del SDK, no memorizar definiciones.
//
// Datos:
//   { type: "code-fill", prompt, code: { lang, title, source, highlight },
//     blanks: [{ id, options: [...], correctOption }], explanation }

function renderCodeFill(exercise, container, onListo) {
  const blanks = exercise.blanks || [];
  const seleccion = {};
  const opciones = {};
  blanks.forEach((b) => { opciones[b.id] = opcionesBarajadas(b.options, exercise); });

  const selects = {};
  blanks.forEach((b) => {
    selects[b.id] = `<select class="cf-select" data-blank="${escAttr(b.id)}" aria-label="Hueco ${escAttr(b.id)}">
      <option value="">▢ elige…</option>
      ${opciones[b.id].map((op) => `<option value="${escAttr(op)}">${escHTML(op)}</option>`).join("")}
    </select>`;
  });

  container.innerHTML = `
    ${renderImagenDeEjercicio(exercise)}
    <div class="pregunta-prompt">${fmtTxt(exercise.prompt)}</div>
    ${renderBloqueCodigo({ lang: exercise.code?.lang, title: exercise.code?.title, source: exercise.code?.source, highlight: exercise.code?.highlight, blanks: selects })}
    <p class="ajustes-nota cf-nota">Elige la opción correcta en cada hueco del código (${blanks.length}).</p>
    <div class="ejercicio-acciones">
      <button type="button" class="btn btn-solido" id="btnComprobar" disabled>✅ Comprobar</button>
    </div>
  `;

  const btn = container.querySelector("#btnComprobar");
  const refrescar = () => {
    btn.disabled = !blanks.every((b) => !!seleccion[b.id]);
  };
  container.querySelectorAll(".cf-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      seleccion[sel.dataset.blank] = sel.value;
      sel.classList.toggle("lleno", !!sel.value);
      refrescar();
    });
  });
  btn.addEventListener("click", () => {
    if (!btn.disabled) onListo(blanks.map((b) => ({ id: b.id, selected: seleccion[b.id] })));
  });
}

// Se califica igual que el desplegable de texto: todos los huecos correctos.
function calificarCodeFill(exercise, respuesta) {
  return calificarDropdown(exercise, respuesta);
}

// Para el modal de feedback / el reporte: el código ya resuelto.
function renderSolucionCodeFill(exercise, respuestaUsuario) {
  const dado = new Map((respuestaUsuario || []).map((b) => [b.id, b.selected]));
  const blanks = {};
  (exercise.blanks || []).forEach((b) => {
    const acierto = dado.size ? dado.get(b.id) === b.correctOption : true;
    blanks[b.id] = acierto
      ? `<mark class="cf-res ok">${escHTML(b.correctOption)}</mark>`
      : `<mark class="cf-res mal">${escHTML(dado.get(b.id) || "—")}</mark><mark class="cf-res ok">${escHTML(b.correctOption)}</mark>`;
  });
  return renderBloqueCodigo({ lang: exercise.code?.lang, title: exercise.code?.title, source: exercise.code?.source, highlight: exercise.code?.highlight, blanks, copiar: false });
}
