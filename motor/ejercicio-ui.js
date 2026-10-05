// motor/ejercicio-ui.js
//
// Piezas visuales compartidas por todos los tipos de ejercicio: iconos de
// Azure (inyectados por build.py en la constante ICONOS), la imagen que puede
// acompañar a un enunciado y el "esqueleto" estático (imagen + enunciado +
// código) que no debe repintarse cada vez que el usuario toca una opción.

function iconoDe(id) {
  return typeof ICONOS !== "undefined" && ICONOS[id] ? ICONOS[id] : null;
}

function nombreIcono(id) {
  const ic = iconoDe(id);
  return ic ? ic.n : id;
}

// tam: "sm" (opciones) | "md" | "lg" | "xl" (imagen del enunciado)
// conNombre=false => alt vacío: el icono es la pregunta y su nombre no debe filtrarse.
function iconoHTML(id, { tam = "md", conNombre = true } = {}) {
  const ic = iconoDe(id);
  if (!ic) return "";
  const alt = conNombre ? ` alt="${escAttr(ic.n)}"` : ` alt="" aria-hidden="true"`;
  return `<span class="icono-tile icono-${tam}"><img src="${ic.src}"${alt} draggable="false"></span>`;
}

function renderImagenDeEjercicio(exercise) {
  if (!exercise?.imagen) return "";
  return `<div class="ej-imagen">${iconoHTML(exercise.imagen, { tam: "xl", conNombre: false })}</div>`;
}

// Escribe la parte estática del ejercicio y devuelve el <div> dinámico donde
// cada renderizador pinta sus opciones/botones.
function prepararContenedor(container, exercise, { promptHtml } = {}) {
  const prompt = promptHtml !== undefined ? promptHtml : `<div class="pregunta-prompt">${fmtTxt(exercise.prompt)}</div>`;
  container.innerHTML = `${renderImagenDeEjercicio(exercise)}${prompt}${renderCodigoDeEjercicio(exercise)}<div class="ej-dinamico"></div>`;
  const dyn = container.querySelector(".ej-dinamico");
  // La animación de entrada de las opciones solo debe verse al abrir el
  // ejercicio: en cuanto el usuario toca algo y se repinta, ya no se repite
  // (antes todas las opciones parpadeaban desde invisible en cada toque).
  dyn.addEventListener("click", () => dyn.classList.add("ya-pintado"), true);
  return dyn;
}

// Orden aleatorio de opciones salvo que el ejercicio pida `noBarajar` (p. ej.
// "Todas las anteriores"). Se llama UNA vez por render, no en cada repintado.
function opcionesBarajadas(lista, exercise) {
  const base = [...(lista || [])];
  return exercise && exercise.noBarajar ? base : barajar(base);
}
