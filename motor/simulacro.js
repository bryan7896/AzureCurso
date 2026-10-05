// motor/simulacro.js
//
// Simulacro de examen: una sesión mixta, cronometrada y SIN retroalimentación
// hasta el final, para medir si estás listo — no solo para aprender.
//
//  • Cuántas preguntas salen de cada sección sigue el peso del examen
//    (SECCIONES[].pesoExamen). Si una sección todavía no tiene ejercicios, el
//    simulacro es "parcial": reparte lo que falta entre las demás y lo avisa.
//  • Dentro de cada sección se muestrea al azar, favoreciendo ejercicios de
//    prioridad alta (`peso: 3`) y los que no han salido en simulacros previos.
//  • Se puede ir y volver, marcar preguntas y revisar un resumen antes de
//    entregar. El reloj corre por marca de tiempo: si cierras la app, sigue.
//  • Al terminar: puntaje, desglose por dominio / sección / habilidad oficial,
//    lista de falladas con su explicación y un repaso con retroalimentación.

let _simVista = null; // "home" | "pregunta" | "resumen" | "resultados" | "repaso"
let _simResultadoId = null;
let _simTimerId = null;
let _simRepaso = null; // { cola: [exerciseId...], i, resultadoId }

// ------------------------------------------------------------
// Muestreo
// ------------------------------------------------------------

function esEjercicioDeSimulacro(e) {
  return !!e && e.type !== "texto-libre";
}

function disponibilidadSimulacro() {
  const porSeccion = {};
  let total = 0;
  SECCIONES.forEach((s) => {
    const n = getSeccionState(s.id).ejercicios.filter(esEjercicioDeSimulacro).length;
    porSeccion[s.id] = n;
    total += n;
  });
  return { porSeccion, total };
}

// Cuántas preguntas salen de cada sección. Respeta pesoExamen; lo que no se
// pueda cubrir (sección vacía o con pocos ejercicios) se reparte entre las
// demás, favoreciendo a las que más pesan.
function distribucionSimulacro(disp) {
  const dist = {};
  let asignadas = 0;
  SECCIONES.forEach((s) => {
    dist[s.id] = Math.min(s.pesoExamen, disp.porSeccion[s.id]);
    asignadas += dist[s.id];
  });
  let faltan = SIMULACRO.totalPreguntas - asignadas;
  let guardia = 0;
  while (faltan > 0 && guardia++ < 1000) {
    const candidatas = SECCIONES.filter((s) => dist[s.id] < disp.porSeccion[s.id]);
    if (!candidatas.length) break;
    candidatas.sort((a, b) => b.pesoExamen / (dist[b.id] + 1) - a.pesoExamen / (dist[a.id] + 1));
    dist[candidatas[0].id]++;
    faltan--;
  }
  return dist;
}

// % del peso real del examen que este simulacro logra representar (0–100).
function coberturaSimulacro(dist) {
  const cubierto = SECCIONES.reduce((t, s) => t + Math.min(dist[s.id] || 0, s.pesoExamen), 0);
  return Math.round((cubierto / SIMULACRO.totalPreguntas) * 100);
}

function pesoDeMuestreo(e) {
  const prioridad = { 1: 1, 2: 2, 3: 4 }[e.peso || PESO_EJERCICIO_DEFECTO] || 2;
  const visto = AppState.simulacros.vistos[e.id];
  const novedad = !visto ? 2 : Date.now() - new Date(visto).getTime() < 86400000 ? 0.5 : 1;
  return prioridad * novedad;
}

function muestrearPonderado(lista, k) {
  const pool = lista.map((x) => ({ x, w: Math.max(0.1, pesoDeMuestreo(x)) }));
  const out = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool[i].x);
    pool.splice(i, 1);
  }
  return out;
}

// ------------------------------------------------------------
// Ciclo de vida
// ------------------------------------------------------------

function iniciarSimulacro() {
  const disp = disponibilidadSimulacro();
  if (disp.total < SIMULACRO.minimoParaIniciar) return false;
  const dist = distribucionSimulacro(disp);
  let preguntas = [];
  SECCIONES.forEach((s) => {
    if (!dist[s.id]) return;
    const elegibles = getSeccionState(s.id).ejercicios.filter(esEjercicioDeSimulacro);
    muestrearPonderado(elegibles, dist[s.id]).forEach((e) => preguntas.push({ exerciseId: e.id, seccion: s.id }));
  });
  preguntas = barajar(preguntas);
  // si el simulacro es parcial, el tiempo se reduce en proporción
  const minutos = Math.max(5, Math.round((SIMULACRO.minutos * preguntas.length) / SIMULACRO.totalPreguntas));
  const ahora = Date.now();
  AppState.simulacros.actual = {
    id: "sim-" + ahora,
    inicioISO: new Date(ahora).toISOString(),
    finISO: new Date(ahora + minutos * 60000).toISOString(),
    minutos,
    preguntas,
    respuestas: {}, // exerciseId -> { respuesta, correcto }
    marcadas: {}, // exerciseId -> true
    indice: 0,
    cobertura: coberturaSimulacro(dist),
  };
  guardar();
  return true;
}

function abandonarSimulacro() {
  AppState.simulacros.actual = null;
  detenerTemporizadorSim();
  guardar();
}

function segundosRestantes(a) {
  return Math.max(0, Math.round((new Date(a.finISO).getTime() - Date.now()) / 1000));
}

function formatoReloj(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function buscarEjercicio(id, seccionId) {
  return getSeccionState(seccionId).ejercicios.find((e) => e.id === id) || null;
}

function finalizarSimulacro(porTiempo) {
  const a = AppState.simulacros.actual;
  if (!a) return null;
  detenerTemporizadorSim();

  const usadoSeg = Math.min(a.minutos * 60, Math.round((Date.now() - new Date(a.inicioISO).getTime()) / 1000));
  const detalle = a.preguntas.map((q) => {
    const r = a.respuestas[q.exerciseId];
    return { id: q.exerciseId, seccion: q.seccion, respondida: !!r, correcto: !!(r && r.correcto), respuesta: r ? r.respuesta : null };
  });

  const porDominio = {};
  const porSeccion = {};
  const porHabilidad = {};
  detalle.forEach((d) => {
    const dom = getSeccion(d.seccion)?.dominio || 0;
    porDominio[dom] = porDominio[dom] || { t: 0, a: 0 };
    porSeccion[d.seccion] = porSeccion[d.seccion] || { t: 0, a: 0 };
    porDominio[dom].t++;
    porSeccion[d.seccion].t++;
    if (d.correcto) { porDominio[dom].a++; porSeccion[d.seccion].a++; }
    const ej = buscarEjercicio(d.id, d.seccion);
    if (ej && ej.skill) {
      const k = d.seccion + ":" + ej.skill;
      porHabilidad[k] = porHabilidad[k] || { t: 0, a: 0 };
      porHabilidad[k].t++;
      if (d.correcto) porHabilidad[k].a++;
    }
    // las falladas también alimentan el banco de errores de su sección
    if (d.respondida) actualizarErrorBank(getSeccionState(d.seccion), d.id, d.correcto, d.respuesta);
    else actualizarErrorBank(getSeccionState(d.seccion), d.id, false, null);
    AppState.simulacros.vistos[d.id] = new Date().toISOString();
  });

  const total = detalle.length;
  const aciertos = detalle.filter((d) => d.correcto).length;
  const pct = total ? Math.round((aciertos / total) * 100) : 0;
  const resultado = {
    id: a.id,
    fechaISO: new Date().toISOString(),
    minutosAsignados: a.minutos,
    usadoSeg,
    porTiempo: !!porTiempo,
    cobertura: a.cobertura,
    total,
    aciertos,
    pct,
    aprobado: pct >= SIMULACRO.aprobadoPct,
    porDominio,
    porSeccion,
    porHabilidad,
    detalle,
  };
  AppState.simulacros.historial.push(resultado);
  if (AppState.simulacros.historial.length > SIMULACRO.historialMax) AppState.simulacros.historial.shift();
  AppState.simulacros.actual = null;
  guardar();
  return resultado;
}

// ------------------------------------------------------------
// Temporizador
// ------------------------------------------------------------

function detenerTemporizadorSim() {
  if (_simTimerId) clearInterval(_simTimerId);
  _simTimerId = null;
}

function iniciarTemporizadorSim() {
  detenerTemporizadorSim();
  const tick = () => {
    const a = AppState.simulacros.actual;
    if (!a) return detenerTemporizadorSim();
    const rest = segundosRestantes(a);
    document.querySelectorAll(".sim-timer-valor").forEach((el) => {
      el.textContent = formatoReloj(rest);
      el.parentElement.classList.toggle("poco", rest <= 300);
    });
    if (rest <= 0) {
      const r = finalizarSimulacro(true);
      window._toast?.("⏰ Se acabó el tiempo: simulacro entregado");
      _simVista = "resultados";
      _simResultadoId = r?.id || null;
      renderSimulacro();
    }
  };
  _simTimerId = setInterval(tick, 1000);
  tick();
}

// ------------------------------------------------------------
// Vistas
// ------------------------------------------------------------

function contSim() {
  return document.getElementById("simulacroContainer");
}

function renderSimulacro() {
  const cont = contSim();
  if (!cont) return;
  const a = AppState.simulacros.actual;
  if (a && segundosRestantes(a) <= 0) {
    const r = finalizarSimulacro(true);
    _simVista = "resultados";
    _simResultadoId = r?.id || null;
  }
  if (!_simVista) _simVista = "home";
  if ((_simVista === "pregunta" || _simVista === "resumen") && !AppState.simulacros.actual) _simVista = "home";

  const enExamen = _simVista === "pregunta" || _simVista === "resumen" || _simVista === "repaso";
  document.body.classList.toggle("en-simulacro", enExamen);
  if (_simVista !== "pregunta" && _simVista !== "resumen") detenerTemporizadorSim();

  if (_simVista === "home") return renderSimHome(cont);
  if (_simVista === "pregunta") return renderSimPregunta(cont);
  if (_simVista === "resumen") return renderSimResumen(cont);
  if (_simVista === "resultados") return renderSimResultados(cont, _simResultadoId);
  if (_simVista === "repaso") return renderSimRepaso(cont);
}

// Al tocar la pestaña: si hay un examen en curso o unos resultados abiertos se
// conservan; de lo contrario se muestra el inicio.
function abrirSimulacroDesdeTab() {
  const enCurso = !!AppState.simulacros.actual && (_simVista === "pregunta" || _simVista === "resumen");
  const enResultados = _simVista === "resultados" || _simVista === "repaso";
  if (!enCurso && !enResultados) _simVista = "home";
  renderSimulacro();
}

// ---- Inicio ----

function renderSimHome(cont) {
  const a = AppState.simulacros.actual;
  const disp = disponibilidadSimulacro();
  const dist = distribucionSimulacro(disp);
  const cobertura = coberturaSimulacro(dist);
  const totalPreg = Object.values(dist).reduce((t, n) => t + n, 0);
  const puede = disp.total >= SIMULACRO.minimoParaIniciar;
  const parcial = cobertura < 100;
  const maxPeso = Math.max(...SECCIONES.map((s) => s.pesoExamen));

  const filas = SECCIONES.map((s) => {
    const n = dist[s.id] || 0;
    const vacia = !disp.porSeccion[s.id];
    return `
      <div class="sim-fila ${vacia ? "vacia" : ""}">
        <span class="sim-fila-id">${s.id}</span>
        <span class="sim-fila-nombre">${escHTML(s.titulo)}</span>
        <div class="sim-fila-barra"><div style="width:${(n / maxPeso) * 100}%"></div></div>
        <span class="sim-fila-n">${vacia ? "—" : n}</span>
      </div>`;
  }).join("");

  const historial = [...AppState.simulacros.historial].reverse().slice(0, 6);
  const hist = historial.length
    ? historial.map((r) => `
        <button class="sim-hist-item" data-res="${escAttr(r.id)}">
          <span class="sim-hist-pct ${r.aprobado ? "ok" : "mal"}">${r.pct}%</span>
          <span class="sim-hist-meta">${new Date(r.fechaISO).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} · ${r.aciertos}/${r.total} · ${Math.round(r.usadoSeg / 60)} min${r.cobertura < 100 ? " · parcial" : ""}</span>
          <span class="sim-hist-ir">›</span>
        </button>`).join("")
    : `<p class="ajustes-nota">Todavía no has hecho ningún simulacro.</p>`;

  const enCurso = a
    ? `<div class="sim-encurso">
         <div><strong>Simulacro en curso</strong><br><span class="sim-timer ${segundosRestantes(a) <= 300 ? "poco" : ""}">⏱ <span class="sim-timer-valor">${formatoReloj(segundosRestantes(a))}</span></span> · ${Object.keys(a.respuestas).length}/${a.preguntas.length} respondidas</div>
         <button class="btn btn-solido" id="simContinuar">Continuar ▶</button>
       </div>`
    : "";

  cont.innerHTML = `
    <section class="sim-home">
      <div class="sim-hero">
        <div class="sim-hero-icono">⏱️</div>
        <h2>Simulacro de examen</h2>
        <p>${totalPreg} preguntas · ${a ? a.minutos : Math.max(5, Math.round((SIMULACRO.minutos * totalPreg) / SIMULACRO.totalPreguntas))} min · sin retroalimentación hasta el final. Las preguntas se reparten según el peso de cada sección en el examen, con prioridad a lo más importante.</p>
      </div>
      ${enCurso}
      ${parcial ? `<div class="banner-estado banner-aviso"><span>Simulacro <strong>parcial</strong>: solo representa el ${cobertura}% del examen real porque aún faltan ejercicios en ${SECCIONES.filter((s) => disp.porSeccion[s.id] < s.pesoExamen).map((s) => s.id).join(", ")}. El puntaje sirve de guía, no de predicción.</span></div>` : ""}
      <h4 class="sim-sub">Reparto de preguntas</h4>
      <div class="sim-pesos">${filas}</div>
      <button class="btn btn-solido full" id="simIniciar" ${puede && !a ? "" : "disabled"}>${a ? "Ya tienes uno en curso" : puede ? "▶ Comenzar simulacro" : `Necesitas al menos ${SIMULACRO.minimoParaIniciar} ejercicios cargados`}</button>
      <p class="ajustes-nota">Referencia: ${SIMULACRO.aprobadoPct}% ≈ 700/1000. Microsoft no publica cómo escala el puntaje ni cuántas preguntas tiene AI-901; tómalo como una guía, no como una garantía.</p>
      <h4 class="sim-sub">Historial</h4>
      <div class="sim-hist">${hist}</div>
    </section>`;

  cont.querySelector("#simIniciar")?.addEventListener("click", () => {
    if (!iniciarSimulacro()) return;
    _simVista = "pregunta";
    renderSimulacro();
  });
  cont.querySelector("#simContinuar")?.addEventListener("click", () => { _simVista = "pregunta"; renderSimulacro(); });
  cont.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", () => { _simVista = "resultados"; _simResultadoId = b.dataset.res; renderSimulacro(); }));
  if (a) iniciarTemporizadorSim();
}

// ---- Pregunta ----

function responderBotonSimulacro(cont) {
  // El renderizador repinta sus botones en cada toque: se renombra "Comprobar"
  // por "Responder" cada vez (el simulacro no califica a la vista).
  const ajustar = () => {
    const b = cont.querySelector("#btnComprobar");
    if (b && !b.dataset.sim) { b.dataset.sim = "1"; b.textContent = "Responder ▶"; }
  };
  new MutationObserver(ajustar).observe(cont, { childList: true, subtree: true });
  ajustar();
}

function renderSimPregunta(cont) {
  const a = AppState.simulacros.actual;
  if (!a) { _simVista = "home"; return renderSimulacro(); }
  const total = a.preguntas.length;
  a.indice = Math.min(Math.max(0, a.indice), total - 1);
  const q = a.preguntas[a.indice];
  const ejercicio = buscarEjercicio(q.exerciseId, q.seccion);
  const respondida = !!a.respuestas[q.exerciseId];
  const marcada = !!a.marcadas[q.exerciseId];

  cont.innerHTML = `
    <div class="sim-top">
      <div class="sim-timer ${segundosRestantes(a) <= 300 ? "poco" : ""}">⏱ <span class="sim-timer-valor">${formatoReloj(segundosRestantes(a))}</span></div>
      <div class="sim-contador">Pregunta ${a.indice + 1} de ${total}</div>
      <button class="sim-flag ${marcada ? "activa" : ""}" id="simMarcar" aria-label="Marcar para revisar">⚑</button>
    </div>
    <div class="sim-barra"><div style="width:${(Object.keys(a.respuestas).length / total) * 100}%"></div></div>
    ${respondida ? `<div class="sim-ya">✔ Ya respondiste esta pregunta. Si respondes otra vez, la nueva respuesta la reemplaza.</div>` : ""}
    <div id="simPregunta"></div>
    <div class="sim-nav">
      <button class="btn" id="simAnterior" ${a.indice === 0 ? "disabled" : ""}>◀ Anterior</button>
      <button class="btn" id="simResumenBtn">▦ Resumen</button>
      <button class="btn" id="simSaltar">${a.indice === total - 1 ? "Al resumen" : "Saltar ▶"}</button>
    </div>`;

  const cp = cont.querySelector("#simPregunta");
  if (!ejercicio) {
    cp.innerHTML = `<p class="aviso-vacio">Este ejercicio ya no existe en el banco (se actualizó). Sáltalo.</p>`;
  } else {
    renderEjercicio(ejercicio, cp, (respuesta) => {
      const r = calificarEjercicio(ejercicio, respuesta);
      a.respuestas[q.exerciseId] = { respuesta, correcto: !!r.correcto };
      guardar();
      avanzarSimulacro();
    });
    responderBotonSimulacro(cp);
  }

  cont.querySelector("#simMarcar").addEventListener("click", () => {
    a.marcadas[q.exerciseId] = !a.marcadas[q.exerciseId];
    if (!a.marcadas[q.exerciseId]) delete a.marcadas[q.exerciseId];
    guardarConDebounce();
    cont.querySelector("#simMarcar").classList.toggle("activa", !!a.marcadas[q.exerciseId]);
  });
  cont.querySelector("#simAnterior").addEventListener("click", () => { a.indice--; guardarConDebounce(); renderSimulacro(); });
  cont.querySelector("#simSaltar").addEventListener("click", () => {
    if (a.indice >= total - 1) _simVista = "resumen"; else a.indice++;
    guardarConDebounce();
    renderSimulacro();
  });
  cont.querySelector("#simResumenBtn").addEventListener("click", () => { _simVista = "resumen"; renderSimulacro(); });
  iniciarTemporizadorSim();
}

// Tras responder: va a la siguiente sin responder (circular); si ya no hay, al resumen.
function avanzarSimulacro() {
  const a = AppState.simulacros.actual;
  const total = a.preguntas.length;
  for (let paso = 1; paso <= total; paso++) {
    const j = (a.indice + paso) % total;
    if (!a.respuestas[a.preguntas[j].exerciseId]) {
      a.indice = j;
      guardarConDebounce();
      return renderSimulacro();
    }
  }
  _simVista = "resumen";
  renderSimulacro();
}

// ---- Resumen previo a entregar ----

function renderSimResumen(cont) {
  const a = AppState.simulacros.actual;
  if (!a) { _simVista = "home"; return renderSimulacro(); }
  const total = a.preguntas.length;
  const respondidas = Object.keys(a.respuestas).length;
  const marcadas = Object.keys(a.marcadas).length;
  const chips = a.preguntas.map((q, i) => {
    const cls = [a.respuestas[q.exerciseId] ? "resp" : "vacio", a.marcadas[q.exerciseId] ? "marc" : "", i === a.indice ? "actual" : ""].join(" ");
    return `<button class="sim-chip ${cls}" data-i="${i}">${i + 1}${a.marcadas[q.exerciseId] ? "<i>⚑</i>" : ""}</button>`;
  }).join("");

  cont.innerHTML = `
    <div class="sim-top">
      <div class="sim-timer ${segundosRestantes(a) <= 300 ? "poco" : ""}">⏱ <span class="sim-timer-valor">${formatoReloj(segundosRestantes(a))}</span></div>
      <div class="sim-contador">Resumen</div>
      <span></span>
    </div>
    <p class="sim-resumen-txt"><strong>${respondidas}</strong> de ${total} respondidas${marcadas ? ` · <strong>${marcadas}</strong> marcadas ⚑` : ""}${respondidas < total ? ` · <span class="txt-alerta">${total - respondidas} sin responder</span>` : ""}</p>
    <div class="sim-mapa">${chips}</div>
    <div class="sim-leyenda"><span><i class="resp"></i> respondida</span><span><i class="vacio"></i> sin responder</span><span><i class="marc"></i> marcada</span></div>
    <button class="btn btn-solido full" id="simEntregar">Entregar simulacro</button>
    <button class="btn full" id="simVolver">← Volver a las preguntas</button>
    <button class="btn btn-peligro full" id="simAbandonar">Abandonar sin entregar</button>`;

  cont.querySelectorAll(".sim-chip").forEach((b) => b.addEventListener("click", () => { a.indice = parseInt(b.dataset.i, 10); _simVista = "pregunta"; guardarConDebounce(); renderSimulacro(); }));
  cont.querySelector("#simVolver").addEventListener("click", () => { _simVista = "pregunta"; renderSimulacro(); });
  cont.querySelector("#simEntregar").addEventListener("click", () => {
    const faltan = total - respondidas;
    if (faltan && !confirm(`Te faltan ${faltan} pregunta(s) sin responder y contarán como incorrectas. ¿Entregar de todos modos?`)) return;
    const r = finalizarSimulacro(false);
    _simVista = "resultados";
    _simResultadoId = r?.id || null;
    renderSimulacro();
  });
  cont.querySelector("#simAbandonar").addEventListener("click", () => {
    if (!confirm("¿Abandonar el simulacro? Se descarta sin guardar el resultado.")) return;
    abandonarSimulacro();
    _simVista = "home";
    renderSimulacro();
  });
  iniciarTemporizadorSim();
}

// ---- Resultados ----

function anilloPuntaje(pct, aprobado) {
  const r = 52, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const color = aprobado ? "var(--success)" : "var(--danger)";
  const ref = SIMULACRO.aprobadoPct;
  const ang = (ref / 100) * 2 * Math.PI - Math.PI / 2;
  const mx = 60 + (r + 0) * Math.cos(ang), my = 60 + (r + 0) * Math.sin(ang);
  return `<svg class="anillo" viewBox="0 0 120 120" role="img" aria-label="${pct}%">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 60 60)"/>
    <circle cx="${mx}" cy="${my}" r="3.5" fill="var(--text)"/>
    <text x="60" y="62" text-anchor="middle" class="anillo-pct">${pct}%</text>
    <text x="60" y="80" text-anchor="middle" class="anillo-sub">${aprobado ? "por encima de " + ref + "%" : "meta " + ref + "%"}</text>
  </svg>`;
}

function filaBarra(etiqueta, a, t, extra) {
  const pct = t ? Math.round((a / t) * 100) : 0;
  const cls = pct >= SIMULACRO.aprobadoPct ? "ok" : pct >= 50 ? "medio" : "mal";
  return `<div class="res-fila"><span class="res-fila-et">${etiqueta}</span><div class="res-barra"><div class="${cls}" style="width:${pct}%"></div></div><span class="res-fila-n">${a}/${t}${extra || ""}</span></div>`;
}

function textoHabilidad(clave) {
  const [seccion, id] = clave.split(":");
  return (HABILIDADES[seccion] || []).find((h) => h.id === id)?.texto || id;
}

function renderSimResultados(cont, resId) {
  const r = AppState.simulacros.historial.find((x) => x.id === resId) || AppState.simulacros.historial[AppState.simulacros.historial.length - 1];
  if (!r) { _simVista = "home"; return renderSimHome(cont); }

  const dom = DOMINIOS.map((d) => {
    const v = r.porDominio[d.id] || { t: 0, a: 0 };
    return v.t ? filaBarra(`D${d.id} · ${escHTML(d.titulo)} <small>(${d.pesoOficial})</small>`, v.a, v.t) : "";
  }).join("");
  const sec = SECCIONES.filter((s) => r.porSeccion[s.id]).map((s) => filaBarra(`${s.id} · ${escHTML(s.titulo)}`, r.porSeccion[s.id].a, r.porSeccion[s.id].t)).join("");

  const habilidades = Object.entries(r.porHabilidad)
    .map(([k, v]) => ({ k, ...v, pct: v.a / v.t }))
    .filter((h) => h.pct < 1)
    .sort((x, y) => x.pct - y.pct || y.t - x.t)
    .slice(0, 5)
    .map((h) => `<li><span>${escHTML(textoHabilidad(h.k))}</span><b>${h.a}/${h.t}</b></li>`)
    .join("");

  const falladas = r.detalle.filter((d) => !d.correcto);
  const lista = falladas.map((d, idx) => {
    const ej = buscarEjercicio(d.id, d.seccion);
    if (!ej) return `<details class="res-fallo"><summary><span class="res-fallo-sec">${d.seccion}</span> (ejercicio ya no existe en el banco)</summary></details>`;
    const titulo = ej.type === "dropdown" || ej.type === "code-fill" ? (ej.prompt || ej.textWithBlanks || "") : ej.statement || ej.prompt;
    const codigo = ej.type === "code-fill" ? renderSolucionCodeFill(ej, d.respuesta) : ej.code ? renderCodigoDeEjercicio(ej) : "";
    return `
      <details class="res-fallo">
        <summary><span class="res-fallo-sec">${d.seccion}</span> ${fmtTxt(String(titulo).slice(0, 140))}</summary>
        <div class="res-fallo-cuerpo">
          ${ej.type === "dropdown" ? `<p class="res-linea">${fmtTxt(ej.textWithBlanks)}</p>` : ""}
          ${codigo}
          <p class="res-linea"><b>Tu respuesta:</b> ${d.respondida ? fmtTxt(formatearRespuestaUsuario(ej, d.respuesta)) : "<em>sin responder</em>"}</p>
          <p class="res-linea"><b>Correcta:</b> ${fmtTxt(formatearRespuestaEsperada(ej))}</p>
          <p class="res-expl">${fmtTxt(ej.explanation || "")}</p>
        </div>
      </details>`;
  }).join("");

  const mins = Math.floor(r.usadoSeg / 60), segs = r.usadoSeg % 60;
  cont.innerHTML = `
    <section class="sim-res">
      <button class="btn-icono sim-res-volver" id="simResHome" aria-label="Volver al inicio del simulacro">←</button>
      <div class="sim-res-hero ${r.aprobado ? "ok" : "mal"}">
        ${anilloPuntaje(r.pct, r.aprobado)}
        <div>
          <div class="sim-res-titulo">${r.aprobado ? "Por encima de la meta" : "Todavía por debajo de la meta"}</div>
          <div class="sim-res-sub">${r.aciertos} de ${r.total} correctas · ${mins} min ${String(segs).padStart(2, "0")} s${r.porTiempo ? " · ⏰ se acabó el tiempo" : ""}</div>
          ${r.cobertura < 100 ? `<div class="sim-res-sub">Simulacro parcial (≈${r.cobertura}% del examen real)</div>` : ""}
        </div>
      </div>
      <h4 class="sim-sub">Por dominio</h4>${dom}
      <h4 class="sim-sub">Por sección</h4>${sec}
      ${habilidades ? `<h4 class="sim-sub">Habilidades oficiales a reforzar</h4><ul class="res-habs">${habilidades}</ul>` : ""}
      <div class="sim-res-acciones">
        ${falladas.length ? `<button class="btn btn-solido" id="simRepasar">🔁 Repasar las ${falladas.length} falladas</button>` : `<div class="banner-estado banner-exito">🎉 Sin errores en este simulacro</div>`}
        <button class="btn" id="simCopiar">📋 Copiar reporte</button>
        <button class="btn" id="simOtro">▶ Nuevo simulacro</button>
      </div>
      ${falladas.length ? `<h4 class="sim-sub">Falladas (${falladas.length})</h4>${lista}` : ""}
      <p class="ajustes-nota">Referencia ${SIMULACRO.aprobadoPct}% ≈ 700/1000: Microsoft no publica la fórmula de escalado, úsalo como guía.</p>
    </section>`;

  cont.querySelector("#simResHome").addEventListener("click", () => { _simVista = "home"; renderSimulacro(); });
  cont.querySelector("#simOtro")?.addEventListener("click", () => {
    if (AppState.simulacros.actual) { _simVista = "home"; return renderSimulacro(); }
    if (!iniciarSimulacro()) { window._toast?.("No hay suficientes ejercicios cargados"); return; }
    _simVista = "pregunta";
    renderSimulacro();
  });
  cont.querySelector("#simCopiar")?.addEventListener("click", () => {
    const texto = construirReporteSimulacro(r);
    (navigator.clipboard?.writeText(texto) || Promise.reject()).then(() => window._toast?.("📋 Reporte copiado")).catch(() => window._toast?.("No se pudo copiar"));
  });
  cont.querySelector("#simRepasar")?.addEventListener("click", () => {
    _simRepaso = { cola: falladas.map((d) => ({ id: d.id, seccion: d.seccion })), i: 0, resultadoId: r.id };
    _simVista = "repaso";
    renderSimulacro();
  });
}

function construirReporteSimulacro(r) {
  const l = [];
  l.push(`Simulacro AI-901 — ${new Date(r.fechaISO).toLocaleString("es-CO")}`);
  l.push(`Puntaje: ${r.pct}% (${r.aciertos}/${r.total}) · meta ${SIMULACRO.aprobadoPct}% · ${Math.round(r.usadoSeg / 60)} min${r.cobertura < 100 ? ` · parcial ≈${r.cobertura}% del examen` : ""}`);
  l.push("", "Por dominio:");
  DOMINIOS.forEach((d) => { const v = r.porDominio[d.id]; if (v) l.push(`  Dominio ${d.id} (${d.pesoOficial}): ${v.a}/${v.t}`); });
  l.push("", "Por sección:");
  SECCIONES.forEach((s) => { const v = r.porSeccion[s.id]; if (v) l.push(`  ${s.id} ${s.titulo}: ${v.a}/${v.t}`); });
  const flojas = Object.entries(r.porHabilidad).filter(([, v]) => v.a < v.t).sort((x, y) => x[1].a / x[1].t - y[1].a / y[1].t).slice(0, 6);
  if (flojas.length) { l.push("", "Habilidades a reforzar:"); flojas.forEach(([k, v]) => l.push(`  ${textoHabilidad(k)}: ${v.a}/${v.t}`)); }
  const falladas = r.detalle.filter((d) => !d.correcto);
  if (falladas.length) {
    l.push("", "Respuestas equivocadas:");
    falladas.forEach((d, i) => {
      const ej = buscarEjercicio(d.id, d.seccion);
      if (!ej) return;
      l.push(`${i + 1}. [${d.seccion}] ${ej.statement || ej.prompt || ej.textWithBlanks}`);
      l.push(`   Tu respuesta: ${d.respondida ? formatearRespuestaUsuario(ej, d.respuesta) : "(sin responder)"}`);
      l.push(`   Respuesta esperada: ${formatearRespuestaEsperada(ej)}`);
    });
  }
  return l.join("\n");
}

// ---- Repaso de falladas (con retroalimentación) ----

function renderSimRepaso(cont) {
  const rp = _simRepaso;
  if (!rp || rp.i >= rp.cola.length) {
    _simVista = "resultados";
    _simResultadoId = rp?.resultadoId || null;
    window._toast?.("🎉 Repaso terminado");
    return renderSimulacro();
  }
  const item = rp.cola[rp.i];
  const ej = buscarEjercicio(item.id, item.seccion);
  if (!ej) { rp.i++; return renderSimRepaso(cont); }
  cont.innerHTML = `
    <div class="sim-top">
      <button class="btn" id="simSalirRepaso">← Salir</button>
      <div class="sim-contador">Repaso ${rp.i + 1} de ${rp.cola.length}</div>
      <span></span>
    </div>
    <div id="simPregunta"></div>`;
  cont.querySelector("#simSalirRepaso").addEventListener("click", () => { _simVista = "resultados"; _simResultadoId = rp.resultadoId; renderSimulacro(); });
  renderEjercicio(ej, cont.querySelector("#simPregunta"), (respuesta) => {
    const r = calificarEjercicio(ej, respuesta);
    mostrarModalFeedback({
      exercise: ej,
      correcto: r.correcto,
      respuestaUsuario: respuesta,
      onContinuar: () => { rp.i++; renderSimRepaso(cont); },
      onRepasar: () => { rp.cola.push(item); rp.i++; renderSimRepaso(cont); },
    });
  });
}
