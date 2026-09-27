// motor/registro-tipos.js
//
// Punto único donde se conecta cada `exercise.type` con su renderizador y
// su función de calificación (definidos en tipos-ejercicio/*.js). Así el
// motor de sesión (sesion.js / practica.js) nunca necesita un switch por
// tipo: solo llama renderEjercicio() / calificarEjercicio().
//
// NOTA: sin `import` — build.py concatena motor/ y tipos-ejercicio/ en el
// mismo <script>, y las funciones (declaradas con `function`) quedan
// disponibles por hoisting sin importar el orden de concatenación.

const REGISTRO_TIPOS = {
  "single-select": { render: renderSingleSelect, calificar: calificarSingleSelect },
  "multi-select": { render: renderMultiSelect, calificar: calificarMultiSelect },
  "true-false": { render: renderTrueFalse, calificar: calificarTrueFalse },
  "matching": { render: renderMatching, calificar: calificarMatching },
  "dropdown": { render: renderDropdown, calificar: calificarDropdown },
  "texto-libre": { render: renderTextoLibre, calificar: calificarTextoLibre },
};

function renderEjercicio(exercise, container, onListo) {
  const entrada = REGISTRO_TIPOS[exercise?.type];
  if (!entrada) {
    container.innerHTML = `<p class="aviso-vacio">⚠️ Tipo de ejercicio desconocido: "${exercise?.type}"</p>`;
    return;
  }
  entrada.render(exercise, container, onListo);
}

function calificarEjercicio(exercise, respuestaUsuario) {
  const entrada = REGISTRO_TIPOS[exercise?.type];
  if (!entrada) return { correcto: false };
  return entrada.calificar(exercise, respuestaUsuario);
}
