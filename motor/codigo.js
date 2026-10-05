// motor/codigo.js
//
// Bloques de código "bonitos" para los ejercicios: resaltado de sintaxis
// propio (sin librerías ni CDN, la app es 100% offline), números de línea,
// barra de título estilo editor, líneas destacadas y botón de copiar.
//
// Lenguajes: python, json, bash (az / pip / curl), xml (SSML), text.
//
// Convenciones de los datos:
//   code: { lang: "python", title: "chat_client.py", source: "...", highlight: [3,4] }
//   En un `code-fill`, los huecos van como {{id}} dentro de `source`.
//   Texto con `código inline` entre acentos graves → <code> (ver fmtTxt).

// ---------------------------------------------------------------------------
// Texto con `código inline`
// ---------------------------------------------------------------------------

// Escapa HTML y convierte `x` en <code class="cod-inline">x</code>.
function fmtTxt(str) {
  const seguro = escHTML(str);
  return seguro.replace(/`([^`\n]+)`/g, '<code class="cod-inline">$1</code>');
}

function escAttr(str) {
  return escHTML(str).replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Tokenizadores — devuelven [{ t: "tipo", x: "texto" }]
// ---------------------------------------------------------------------------

const PY_KW = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else",
  "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);
const PY_CONST = new Set(["True", "False", "None"]);
const PY_BUILTIN = new Set([
  "print", "len", "range", "str", "int", "float", "bool", "list", "dict", "set", "tuple", "open", "input",
  "isinstance", "enumerate", "zip", "map", "filter", "sorted", "sum", "min", "max", "abs", "type", "super",
  "Exception", "ValueError", "KeyError", "RuntimeError", "self", "cls", "__name__",
]);

function tokenizarPython(src) {
  const out = [];
  let i = 0;
  let depth = 0;
  let prevSig = ""; // último token no-espacio (texto)
  let primeroDeLinea = ""; // primer token significativo de la línea actual: "from" | "import" | ""
  let viendoImport = false; // ya pasamos el "import" de la línea
  const n = src.length;

  const push = (t, x) => {
    out.push({ t, x });
    if (t !== "ws" && t !== "cm") prevSig = x; // un comentario no cuenta como "token anterior"
  };
  const siguienteCaracter = (desde) => {
    let j = desde;
    while (j < n && (src[j] === " " || src[j] === "\t")) j++;
    return { c: src[j] || "", j };
  };

  while (i < n) {
    const ch = src[i];

    if (ch === "\n") {
      push("ws", "\n");
      i++;
      primeroDeLinea = "";
      viendoImport = false;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      let j = i;
      while (j < n && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++;
      out.push({ t: "ws", x: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "#") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      push("cm", src.slice(i, j));
      i = j;
      continue;
    }

    // strings (con prefijos r, b, u, f y comillas triples)
    const mStr = /^([rRbBuUfF]{1,2})?("""|'''|"|')/.exec(src.slice(i, i + 5));
    if (mStr) {
      const prefijo = mStr[1] || "";
      const comilla = mStr[2];
      const esF = /[fF]/.test(prefijo);
      let j = i + prefijo.length + comilla.length;
      let fin = -1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src.startsWith(comilla, j)) { fin = j + comilla.length; break; }
        if (comilla.length === 1 && src[j] === "\n") { fin = j; break; }
        j++;
      }
      if (fin === -1) fin = n;
      const cuerpo = src.slice(i, fin);
      if (esF) {
        // separa {expresiones} dentro del f-string
        const partes = cuerpo.split(/(\{\{|\}\}|\{[^{}\n]*\})/);
        partes.forEach((p) => {
          if (!p) return;
          if (/^\{[^{}]/.test(p) || p === "{}") out.push({ t: "ip", x: p });
          else out.push({ t: "st", x: p });
        });
        prevSig = cuerpo;
      } else {
        push("st", cuerpo);
      }
      i = fin;
      continue;
    }

    // decorador
    if (ch === "@" && (prevSig === "" || out[out.length - 1]?.x?.endsWith("\n") || out[out.length - 1]?.t === "ws")) {
      const m = /^@[A-Za-z_][\w.]*/.exec(src.slice(i));
      if (m) { push("dc", m[0]); i += m[0].length; continue; }
    }

    // números
    if (/\d/.test(ch)) {
      const m = /^(?:0[xX][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
      push("nm", m[0]);
      i += m[0].length;
      continue;
    }

    // identificadores
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const w = m[0];
      const sig = siguienteCaracter(i + w.length);
      const despues = src[sig.j + 1] || "";
      let t = "vr";

      if (PY_CONST.has(w)) t = "cn";
      else if (PY_KW.has(w)) {
        t = "kw";
        if (!primeroDeLinea) primeroDeLinea = w;
        if (w === "import") viendoImport = true;
      } else if (prevSig === "def") t = "fd";
      else if (prevSig === "class") t = "cl";
      else if (primeroDeLinea === "from" && !viendoImport) t = "md";
      else if (primeroDeLinea === "import" || (primeroDeLinea === "from" && viendoImport)) {
        t = /^[A-Z]/.test(w) && !/^[A-Z0-9_]+$/.test(w) ? "cl" : "md";
      } else if (prevSig === ".") {
        t = sig.c === "(" ? "fn" : "at";
      } else if (depth > 0 && (prevSig === "(" || prevSig === ",") && sig.c === "=" && despues !== "=") t = "pm";
      else if (PY_BUILTIN.has(w)) t = "bi";
      else if (sig.c === "(") t = /^[A-Z]/.test(w) ? "cl" : "fn";
      else if (/^[A-Z][A-Z0-9_]+$/.test(w)) t = "ev";
      else if (/^[A-Z]/.test(w)) t = "cl";
      push(t, w);
      i += w.length;
      continue;
    }

    // operadores y puntuación
    const mOp = /^(?:==|!=|<=|>=|->|\*\*|\/\/|:=|\+=|-=|\*=|\/=|[+\-*\/%=<>!&|^~])/.exec(src.slice(i, i + 2));
    if (mOp) { push("op", mOp[0]); i += mOp[0].length; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
    push("pn", ch);
    i++;
  }
  return out;
}

function tokenizarJSON(src) {
  const out = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) {
      if (m[2]) { out.push({ t: "jk", x: m[1] }); out.push({ t: "pn", x: m[2] }); }
      else out.push({ t: "st", x: m[1] });
    } else if (m[3] !== undefined) out.push({ t: "nm", x: m[3] });
    else if (m[4] !== undefined) out.push({ t: "cn", x: m[4] });
    else if (m[5] !== undefined) out.push({ t: "pn", x: m[5] });
    else if (m[6] !== undefined) out.push({ t: "ws", x: m[6] });
    else out.push({ t: "vr", x: m[7] });
  }
  return out;
}

function tokenizarBash(src) {
  const out = [];
  src.split("\n").forEach((linea, idx, arr) => {
    const re = /(#.*$)|("(?:\\.|[^"\\])*"|'[^']*')|(\$\{?[A-Za-z_][\w]*\}?)|(--?[A-Za-z][\w-]*)|(\\$)|(\s+)|([^\s"'$#\\]+)/g;
    let m;
    let palabra = 0;
    let primero = true;
    while ((m = re.exec(linea))) {
      if (m[1]) out.push({ t: "cm", x: m[1] });
      else if (m[2]) { out.push({ t: "st", x: m[2] }); palabra++; }
      else if (m[3]) { out.push({ t: "ev", x: m[3] }); palabra++; }
      else if (m[4]) out.push({ t: "pm", x: m[4] });
      else if (m[5]) out.push({ t: "pn", x: m[5] });
      else if (m[6]) out.push({ t: "ws", x: m[6] });
      else if (m[7]) {
        if (primero && m[7] === "$") { out.push({ t: "pn", x: m[7] }); continue; }
        if (palabra === 0) out.push({ t: "fn", x: m[7] });
        else if (palabra === 1) out.push({ t: "cl", x: m[7] });
        else out.push({ t: "vr", x: m[7] });
        palabra++;
        primero = false;
      }
    }
    if (idx < arr.length - 1) out.push({ t: "ws", x: "\n" });
  });
  return out;
}

function tokenizarXML(src) {
  const out = [];
  const re = /(<!--[\s\S]*?-->)|(<\/?)([A-Za-z_][\w:.-]*)|("[^"]*"|'[^']*')|([\w:.-]+)(?==)|(\/?>)|(=)|(\s+)|([^<>"'=\s]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) out.push({ t: "cm", x: m[1] });
    else if (m[2]) { out.push({ t: "pn", x: m[2] }); out.push({ t: "tg", x: m[3] }); }
    else if (m[4]) out.push({ t: "st", x: m[4] });
    else if (m[5]) out.push({ t: "pm", x: m[5] });
    else if (m[6]) out.push({ t: "pn", x: m[6] });
    else if (m[7]) out.push({ t: "op", x: m[7] });
    else if (m[8]) out.push({ t: "ws", x: m[8] });
    else out.push({ t: "tx", x: m[9] });
  }
  return out;
}

function tokenizarCodigo(src, lang) {
  switch ((lang || "").toLowerCase()) {
    case "python":
    case "py":
      return tokenizarPython(src);
    case "json":
      return tokenizarJSON(src);
    case "bash":
    case "sh":
    case "shell":
    case "cli":
      return tokenizarBash(src);
    case "xml":
    case "ssml":
    case "html":
      return tokenizarXML(src);
    default:
      return [{ t: "vr", x: src }];
  }
}

const NOMBRE_LENGUAJE = { python: "Python", py: "Python", json: "JSON", bash: "Bash", sh: "Bash", shell: "Shell", cli: "CLI", xml: "XML", ssml: "SSML", html: "HTML", text: "Texto" };

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function tokensALineas(tokens) {
  const lineas = [[]];
  tokens.forEach((tk) => {
    tk.x.split("\n").forEach((parte, i) => {
      if (i > 0) lineas.push([]);
      if (parte !== "") lineas[lineas.length - 1].push({ t: tk.t, x: parte });
    });
  });
  return lineas;
}

// Resalta una sola línea (para ítems de "ordenar el código").
// Si la línea no cabe, solo se parte después de una coma o de un paréntesis
// de apertura (<wbr>), nunca a mitad de un identificador.
function resaltarLinea(src, lang) {
  return tokenizarCodigo(src, lang)
    .map((tk) => {
      if (tk.t === "ws") return escHTML(tk.x);
      const corte = (tk.t === "pn" && (tk.x === "," || tk.x === "(")) || (tk.t === "op" && tk.x === "=") ? "<wbr>" : "";
      return `<span class="tk-${tk.t}">${escHTML(tk.x)}</span>${corte}`;
    })
    .join("");
}

/**
 * Devuelve el HTML de un bloque de código completo.
 * @param {object} o  { lang, title, source, highlight:[n], blanks:{id: html}, copiar:bool, sinBarra:bool }
 *   - `blanks`: html con el que se reemplaza cada {{id}} (un <select>, o la respuesta correcta)
 */
function renderBloqueCodigo(o) {
  const lang = (o.lang || "text").toLowerCase();
  const fuente = String(o.source || "").replace(/\r\n/g, "\n").replace(/\n+$/, "");
  // los huecos se vuelven identificadores "inocuos" para que el tokenizador
  // los trate como una palabra; después se sustituyen por su HTML real.
  const conMarcas = fuente.replace(/\{\{(\w+)\}\}/g, "__BLK_$1__");
  const lineas = tokensALineas(tokenizarCodigo(conMarcas, lang));
  const resaltadas = new Set(o.highlight || []);
  const blanks = o.blanks || {};

  const filas = lineas
    .map((tokens, idx) => {
      let html = tokens
        .map((tk) => (tk.t === "ws" ? escHTML(tk.x) : `<span class="tk-${tk.t}">${escHTML(tk.x)}</span>`))
        .join("");
      html = html.replace(/__BLK_(\w+)__/g, (_, id) => (blanks[id] !== undefined ? blanks[id] : "▢"));
      return `<div class="cl${resaltadas.has(idx + 1) ? " hl" : ""}"><span class="cn">${idx + 1}</span><span class="cc">${html}</span></div>`;
    })
    .join("");

  const puedeCopiar = o.copiar !== false && !/\{\{\w+\}\}/.test(fuente);
  const barra = o.sinBarra
    ? ""
    : `<figcaption class="codigo-barra">
        <span class="codigo-dots"><i></i><i></i><i></i></span>
        <span class="codigo-titulo">${escHTML(o.title || "")}</span>
        <span class="codigo-lang">${escHTML(NOMBRE_LENGUAJE[lang] || lang)}</span>
        ${puedeCopiar ? `<button type="button" class="codigo-copiar" aria-label="Copiar código">Copiar</button>` : ""}
      </figcaption>`;

  return `<figure class="codigo${o.sinBarra ? " codigo-compacto" : ""}" data-lang="${escAttr(lang)}"${puedeCopiar ? ` data-raw="${escAttr(fuente)}"` : ""}>
    ${barra}
    <div class="codigo-cuerpo" tabindex="0">${filas}</div>
  </figure>`;
}

// Un solo listener para todos los botones "Copiar" de la app.
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".codigo-copiar");
  if (!btn) return;
  const raw = btn.closest(".codigo")?.dataset.raw;
  if (raw == null) return;
  const listo = () => {
    btn.textContent = "¡Copiado!";
    btn.classList.add("ok");
    setTimeout(() => { btn.textContent = "Copiar"; btn.classList.remove("ok"); }, 1400);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(raw).then(listo).catch(() => {});
  else {
    const ta = document.createElement("textarea");
    ta.value = raw; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); listo(); } catch (_) {}
    ta.remove();
  }
});

// Código que acompaña a un ejercicio cualquiera (campo `code`).
function renderCodigoDeEjercicio(exercise) {
  if (!exercise?.code) return "";
  return renderBloqueCodigo({ lang: exercise.code.lang, title: exercise.code.title, source: exercise.code.source, highlight: exercise.code.highlight });
}
