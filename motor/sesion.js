// motor/sesion.js
//
// Ejecuta UNA lección calificable dentro de un intento de sección.
//
// Flujo por ejercicio:
//   1) obtenerItemActual()      -> qué mostrar
//   2) procesarRespuesta()      -> califica pero NO compromete nada todavía
//      (se guarda en memoria como "pendiente" hasta que el usuario elige)
//   3a) confirmarContinuar()    -> compromete el resultado tal cual salió,
//       actualiza errorBank + historial (para el reporte) y avanza
//   3b) confirmarRepasar()      -> compromete el resultado como EXCLUIDO
//       de la calificación, agrega una copia al final de la cola, y avanza
//
// Al completarse la última lección del intento, se cierra automáticamente
// (verificarCierreIntento): calcula el % final sobre las posiciones NO
// excluidas de TODAS las lecciones y decide aprobado / requiere-reintento.

function obtenerItemActual(seccionId, leccionIndex) {
  const estado = getSeccionState(seccionId);
  const leccion = estado.progreso.intentoActual?.lecciones?.[leccionIndex];
  if (!leccion || leccion.indiceActual >= leccion.cola.length) return null;
  const item = leccion.cola[leccion.indiceActual];
  const exercise = estado.ejercicios.find((e) => e.id === item.exerciseId);
  return { item, exercise, posicion: leccion.indiceActual, leccion, esRepaso: item.excluido };
}

// Califica la respuesta pero no toca errorBank/historial ni avanza el
// puntero — eso solo pasa al confirmar Continuar o Repasar en el modal.
function procesarRespuesta(seccionId, leccionIndex, respuestaUsuario) {
  const actual = obtenerItemActual(seccionId, leccionIndex);
  if (!actual) return null;
  const resultado = calificarEjercicio(actual.exercise, respuestaUsuario);
  return {
    correcto: resultado.correcto,
    respuestaUsuario,
    exercise: actual.exercise,
    posicion: actual.posicion,
  };
}

function confirmarContinuar(seccionId, leccionIndex, pendiente) {
  const estado = getSeccionState(seccionId);
  const leccion = estado.progreso.intentoActual.lecciones[leccionIndex];
  const item = leccion.cola[pendiente.posicion];

  leccion.resultados[pendiente.posicion] = {
    exerciseId: item.exerciseId,
    correcto: pendiente.correcto,
    excluido: item.excluido,
  };

  if (!item.excluido) {
    actualizarErrorBank(estado, item.exerciseId, pendiente.correcto, pendiente.respuestaUsuario);
    estado.progreso.historialIntentoActual.push({
      exerciseId: pendiente.exercise.id,
      subtema: pendiente.exercise.subtopic || pendiente.exercise.topic || "General",
      pregunta: pendiente.exercise.prompt,
      correcto: pendiente.correcto,
      respuestaUsuarioTexto: formatearRespuestaUsuario(pendiente.exercise, pendiente.respuestaUsuario),
      respuestaEsperadaTexto: formatearRespuestaEsperada(pendiente.exercise),
    });
  }

  return avanzarPuntero(seccionId, leccionIndex);
}

function confirmarRepasar(seccionId, leccionIndex, pendiente) {
  const estado = getSeccionState(seccionId);
  const leccion = estado.progreso.intentoActual.lecciones[leccionIndex];
  const item = leccion.cola[pendiente.posicion];

  // Se compromete EXCLUIDO de la calificación (aunque haya sido correcto o
  // incorrecto), y se agrega una copia al final para volver a verlo.
  leccion.resultados[pendiente.posicion] = {
    exerciseId: item.exerciseId,
    correcto: pendiente.correcto,
    excluido: true,
  };
  leccion.cola.push({ exerciseId: item.exerciseId, excluido: true });

  return avanzarPuntero(seccionId, leccionIndex);
}

function actualizarErrorBank(estado, exerciseId, correcto, respuestaUsuario) {
  const eb = estado.progreso.errorBank;
  if (!correcto) {
    const prev = eb[exerciseId] || { vecesFallado: 0 };
    eb[exerciseId] = { vecesFallado: prev.vecesFallado + 1, ultimaRespuesta: respuestaUsuario, resuelto: false };
  } else if (eb[exerciseId]) {
    eb[exerciseId].resuelto = true;
  }
}

// Devuelve { cierre: null } si la lección/el intento siguen abiertos, o
// { cierre: { pct, aprobado } } si esta fue la última lección y el intento
// se acaba de cerrar.
function avanzarPuntero(seccionId, leccionIndex) {
  const estado = getSeccionState(seccionId);
  const leccion = estado.progreso.intentoActual.lecciones[leccionIndex];
  leccion.indiceActual += 1;

  let cierre = null;
  if (leccion.indiceActual >= leccion.cola.length && !leccion.completada) {
    leccion.completada = true;
    estado.progreso.leccionesCompletadas += 1;
    cierre = verificarCierreIntento(seccionId);
  }
  guardarConDebounce();
  return { terminoLeccion: leccion.completada, cierre };
}

function verificarCierreIntento(seccionId) {
  const estado = getSeccionState(seccionId);
  const intento = estado.progreso.intentoActual;
  const todasCompletas = intento.lecciones.every((l) => l.completada);
  if (!todasCompletas) return null;

  let total = 0;
  let aciertos = 0;
  const detalle = {};
  intento.lecciones.forEach((leccion) => {
    leccion.cola.forEach((item, i) => {
      // OJO: se decide por resultados[i].excluido (lo que de verdad se
      // comprometió al confirmar), no por item.excluido (que solo marca
      // "esta posición es una copia reinsertada por [Repasar]"). Un ítem
      // ORIGINAL marcado como [Repasar] tiene item.excluido=false pero
      // resultados[i].excluido=true — y ese es el que debe excluirse.
      const r = leccion.resultados[i];
      if (!r || r.excluido) return;
      total++;
      if (r.correcto) aciertos++;
      detalle[item.exerciseId] = !!r.correcto;
    });
  });

  // % de ESTE intento (solo lo que se contestó ahora)
  const pctIntento = total ? Math.round((aciertos / total) * 100) : 0;

  // Acumulado de la sección: el último resultado de CADA ejercicio calificado.
  // Antes el 90% se medía solo sobre el reintento (fallados + 30% de refuerzo),
  // lo que distorsionaba el resultado. Ahora se mide sobre toda la sección.
  const prog = estado.progreso;
  prog.resultadoPorEjercicio = { ...(prog.resultadoPorEjercicio || {}), ...detalle };
  const idsBanco = estado.ejercicios.map((e) => e.id);
  const calificados = idsBanco.filter((id) => prog.resultadoPorEjercicio[id] !== undefined);
  const correctosSeccion = calificados.filter((id) => prog.resultadoPorEjercicio[id] === true).length;
  const sinCalificar = idsBanco.length - calificados.length;
  const pct = calificados.length ? Math.round((correctosSeccion / calificados.length) * 100) : 0;
  // Aprobar exige el umbral Y haber calificado todos los ejercicios al menos una vez.
  const aprobado = pct >= UMBRAL_APROBACION_PCT && sinCalificar === 0;

  prog.ultimoResultadoDetalle = detalle;
  prog.intentos.push({
    numero: intento.numero,
    esReintento: intento.esReintento,
    pct,
    pctIntento,
    correctosSeccion,
    totalSeccion: idsBanco.length,
    sinCalificar,
    aprobado,
    cerradoEn: new Date().toISOString(),
  });
  prog.mejorPuntajePct = Math.max(prog.mejorPuntajePct, pct);
  prog.estado = aprobado ? "aprobado" : "requiere-reintento";
  guardar();

  return { pct, pctIntento, aprobado, sinCalificar, correctosSeccion, totalSeccion: idsBanco.length };
}
