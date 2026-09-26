// tipos-ejercicio/matching.js
//
// Dos modos:
//  - "pairs": relacionar dos columnas — se implementa como TOCAR para
//    conectar (más confiable en móvil que un drag & drop real con mouse/touch
//    mezclados) en vez de arrastrar.
//  - "sequence": ordenar pasos — se implementa con flechas ▲▼ por ítem en
//    vez de arrastrar, para evitar los bugs típicos de drag-and-drop táctil
//    en una sola pasada de HTML/JS sin librerías.

function renderMatching(exercise, container, onListo) {
  if (exercise.mode === "sequence") return renderMatchingSequence(exercise, container, onListo);
  return renderMatchingPairs(exercise, container, onListo);
}

function calificarMatching(exercise, respuesta) {
  if (exercise.mode === "sequence") {
    const esperado = exercise.correctOrder || [];
    const dado = respuesta || [];
    if (esperado.length !== dado.length) return { correcto: false };
    for (let i = 0; i < esperado.length; i++) if (esperado[i] !== dado[i]) return { correcto: false };
    return { correcto: true };
  }
  const esperado = exercise.correctPairs || [];
  const dado = respuesta || [];
  if (esperado.length !== dado.length) return { correcto: false };
  const mapaEsperado = new Map(esperado.map((p) => [p.leftId, p.rightId]));
  for (const p of dado) if (mapaEsperado.get(p.leftId) !== p.rightId) return { correcto: false };
  return { correcto: true };
}

// ---------------- modo "sequence" (ordenar con flechas) ----------------

function renderMatchingSequence(exercise, container, onListo) {
  let orden = barajarLocal((exercise.items || []).map((i) => i.id));

  const mover = (idx, delta) => {
    const j = idx + delta;
    if (j < 0 || j >= orden.length) return;
    [orden[idx], orden[j]] = [orden[j], orden[idx]];
    pintar();
  };

  const pintar = () => {
    const filas = orden
      .map((id, idx) => {
        const item = (exercise.items || []).find((i) => i.id === id);
        return `
          <div class="secuencia-fila">
            <span class="secuencia-numero">${idx + 1}</span>
            <span class="secuencia-texto">${escHTML(item ? item.text : id)}</span>
            <span class="secuencia-flechas">
              <button type="button" class="btn-icono btn-mini" data-mover="${idx}" data-delta="-1" ${idx === 0 ? "disabled" : ""}>▲</button>
              <button type="button" class="btn-icono btn-mini" data-mover="${idx}" data-delta="1" ${idx === orden.length - 1 ? "disabled" : ""}>▼</button>
            </span>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="pregunta-prompt">${escHTML(exercise.prompt)}</div>
      <div class="secuencia-lista">${filas}</div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar">✅ Comprobar</button>
      </div>
    `;

    container.querySelectorAll("[data-mover]").forEach((btn) => {
      btn.addEventListener("click", () => mover(parseInt(btn.dataset.mover, 10), parseInt(btn.dataset.delta, 10)));
    });
    container.querySelector("#btnComprobar")?.addEventListener("click", () => onListo([...orden]));
  };

  pintar();
}

// ---------------- modo "pairs" (tocar para conectar) ----------------

function renderMatchingPairs(exercise, container, onListo) {
  const pares = {}; // leftId -> rightId
  let leftActivo = null;
  const rightBarajado = barajarLocal((exercise.rightItems || []).map((i) => i.id));

  const badgePara = (leftId) => {
    const idx = Object.keys(pares).indexOf(leftId);
    return idx === -1 ? null : idx + 1;
  };

  const clic = (lado, id) => {
    if (lado === "left") {
      if (pares[id] !== undefined) {
        delete pares[id]; // togglea: si ya estaba pareado, lo libera
        leftActivo = null;
      } else {
        leftActivo = id;
      }
    } else {
      const rightYaUsado = Object.values(pares).includes(id);
      if (rightYaUsado) {
        const leftDeEse = Object.keys(pares).find((l) => pares[l] === id);
        delete pares[leftDeEse];
      } else if (leftActivo) {
        pares[leftActivo] = id;
        leftActivo = null;
      }
    }
    pintar();
  };

  const pintar = () => {
    const izquierda = (exercise.leftItems || [])
      .map((item) => {
        const badge = badgePara(item.id);
        const activo = leftActivo === item.id;
        return `
          <button type="button" class="opcion-btn opcion-emparejar ${badge ? "pareado" : ""} ${activo ? "activo" : ""}" data-lado="left" data-id="${escHTML(item.id)}">
            ${badge ? `<span class="emparejar-badge">${badge}</span>` : ""} ${escHTML(item.text)}
          </button>
        `;
      })
      .join("");

    const derecha = rightBarajado
      .map((id) => {
        const item = (exercise.rightItems || []).find((i) => i.id === id);
        const badge = badgePara(Object.keys(pares).find((l) => pares[l] === id));
        return `
          <button type="button" class="opcion-btn opcion-emparejar ${badge ? "pareado" : ""}" data-lado="right" data-id="${escHTML(id)}">
            ${badge ? `<span class="emparejar-badge">${badge}</span>` : ""} ${escHTML(item ? item.text : id)}
          </button>
        `;
      })
      .join("");

    const totalIzq = (exercise.leftItems || []).length;
    const completo = Object.keys(pares).length === totalIzq;

    container.innerHTML = `
      <div class="pregunta-prompt">${escHTML(exercise.prompt)}</div>
      <p class="ajustes-nota">Toca un elemento de la izquierda y luego su pareja a la derecha.</p>
      <div class="emparejar-columnas">
        <div class="emparejar-col">${izquierda}</div>
        <div class="emparejar-col">${derecha}</div>
      </div>
      <div class="ejercicio-acciones">
        <button type="button" class="btn btn-solido" id="btnComprobar" ${completo ? "" : "disabled"}>✅ Comprobar</button>
      </div>
    `;

    container.querySelectorAll("[data-lado]").forEach((btn) => {
      btn.addEventListener("click", () => clic(btn.dataset.lado, btn.dataset.id));
    });
    container.querySelector("#btnComprobar")?.addEventListener("click", () => {
      if (completo) onListo(Object.entries(pares).map(([leftId, rightId]) => ({ leftId, rightId })));
    });
  };

  pintar();
}

function barajarLocal(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
