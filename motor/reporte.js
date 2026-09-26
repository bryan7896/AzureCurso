// motor/reporte.js
//
// Formatea la respuesta del usuario y la respuesta esperada de un ejercicio
// (para el reporte y para el modal de feedback) y arma el texto final del
// reporte de sección con el formato:
//
//   Temario: 1.1 IA responsable (Responsible AI)
//   Equidad: 30%
//   Confiabilidad y seguridad: 100%
//   ...
//
//   Respuestas equivocadas:
//   Equidad, ejercicio 3:
//   {pregunta}
//   Tu respuesta: {...}
//   Respuesta esperada: {...}

function formatearRespuestaUsuario(exercise, respuesta) {
  switch (exercise.type) {
    case "single-select": {
      const opt = (exercise.options || []).find((o) => o.id === respuesta);
      return opt ? opt.text : "(sin respuesta)";
    }
    case "multi-select": {
      const ids = respuesta || [];
      const textos = (exercise.options || []).filter((o) => ids.includes(o.id)).map((o) => o.text);
      return textos.length ? textos.join(", ") : "(sin selección)";
    }
    case "true-false": {
      const labels = exercise.labels || { affirmative: "Verdadero", negative: "Falso" };
      return respuesta ? labels.affirmative : labels.negative;
    }
    case "matching": {
      if (exercise.mode === "sequence") {
        const orden = respuesta || [];
        return orden.map((id) => (exercise.items || []).find((i) => i.id === id)?.text || id).join(" → ");
      }
      const pares = respuesta || [];
      return pares
        .map((p) => {
          const l = (exercise.leftItems || []).find((i) => i.id === p.leftId)?.text || p.leftId;
          const r = (exercise.rightItems || []).find((i) => i.id === p.rightId)?.text || p.rightId;
          return `${l} = ${r}`;
        })
        .join(" · ");
    }
    case "dropdown": {
      const blanks = respuesta || [];
      return blanks.map((b) => b.selected || "(vacío)").join(", ");
    }
    default:
      return String(respuesta ?? "");
  }
}

function formatearRespuestaEsperada(exercise) {
  switch (exercise.type) {
    case "single-select": {
      const opt = (exercise.options || []).find((o) => o.id === exercise.correctOptionId);
      return opt ? opt.text : exercise.correctOptionId;
    }
    case "multi-select":
      return (exercise.options || [])
        .filter((o) => (exercise.correctOptionIds || []).includes(o.id))
        .map((o) => o.text)
        .join(", ");
    case "true-false": {
      const labels = exercise.labels || { affirmative: "Verdadero", negative: "Falso" };
      return exercise.correctAnswer ? labels.affirmative : labels.negative;
    }
    case "matching": {
      if (exercise.mode === "sequence") {
        return (exercise.correctOrder || []).map((id) => (exercise.items || []).find((i) => i.id === id)?.text || id).join(" → ");
      }
      return (exercise.correctPairs || [])
        .map((p) => {
          const l = (exercise.leftItems || []).find((i) => i.id === p.leftId)?.text || p.leftId;
          const r = (exercise.rightItems || []).find((i) => i.id === p.rightId)?.text || p.rightId;
          return `${l} = ${r}`;
        })
        .join(" · ");
    }
    case "dropdown":
      return (exercise.blanks || []).map((b) => b.correctOption).join(", ");
    default:
      return "";
  }
}

function construirReporteSeccion(seccionId) {
  const estado = getSeccionState(seccionId);
  const meta = getSeccion(seccionId);
  const historial = estado.progreso.historialIntentoActual || [];

  const porSubtema = {};
  const orden = [];
  historial.forEach((h) => {
    if (!porSubtema[h.subtema]) {
      porSubtema[h.subtema] = { total: 0, correctos: 0, items: [] };
      orden.push(h.subtema);
    }
    porSubtema[h.subtema].total++;
    if (h.correcto) porSubtema[h.subtema].correctos++;
    porSubtema[h.subtema].items.push(h);
  });

  const lineas = [`Temario: ${seccionId} ${meta ? meta.titulo : ""}`];

  if (!historial.length) {
    lineas.push("", "(Todavía no hay ejercicios respondidos en esta sección)");
    return lineas.join("\n");
  }

  orden.forEach((sub) => {
    const d = porSubtema[sub];
    const pct = d.total ? Math.round((d.correctos / d.total) * 100) : 0;
    lineas.push(`${sub}: ${pct}%`);
  });

  lineas.push("", "Respuestas equivocadas:");
  let huboFallos = false;
  orden.forEach((sub) => {
    const d = porSubtema[sub];
    d.items.forEach((h, idx) => {
      if (h.correcto) return;
      huboFallos = true;
      lineas.push(`${sub}, ejercicio ${idx + 1}:`);
      lineas.push(h.pregunta);
      lineas.push(`Tu respuesta: ${h.respuestaUsuarioTexto}`);
      lineas.push(`Respuesta esperada: ${h.respuestaEsperadaTexto}`);
      lineas.push("");
    });
  });
  if (!huboFallos) lineas.push("🎉 Ninguna (por ahora).");

  return lineas.join("\n");
}

function copiarReporteSeccion(seccionId) {
  const texto = construirReporteSeccion(seccionId);
  navigator.clipboard
    ?.writeText(texto)
    .then(() => window._toast?.("📋 Reporte copiado al portapapeles"))
    .catch(() => window._toast?.("No se pudo copiar automáticamente — revisa la consola"));
  return texto;
}
