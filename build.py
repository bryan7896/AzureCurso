#!/usr/bin/env python3
# build.py — genera index.html + manifest.json + service-worker.js
#
# Uso:  python build.py
#
# Lee estilos/main.css, motor/*.js y tipos-ejercicio/*.js, y los inyecta en
# una única plantilla HTML (todo corre 100% en el navegador, sin backend).
# No edites index.html a mano: se sobreescribe en cada build.

import os
import sys
import json
from datetime import datetime

# En Windows, la consola suele usar cp1252 y no puede imprimir emojis
# (revienta con UnicodeEncodeError apenas se llama a print). Forzamos la
# salida a UTF-8 si el intérprete lo permite (Python 3.7+); si no, seguimos
# igual — el build en sí no depende de esto, solo los mensajes en consola.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

VERSION = "1.0.0 (Parte 5 — 1.1, Conceptos y mapa de servicios)"
NOMBRE_APP = "AI-901 Trainer"
NOMBRE_CORTO = "AI901Trainer"
STORAGE_KEY = "ai901_trainer_v1"
COLOR_FONDO = "#060a13"
COLOR_TEMA = "#38bdf8"

# Ícono embebido como SVG (data URI) para no depender de ningún CDN externo
# — importante porque la app debe funcionar 100% offline desde el primer
# instante, incluso antes de que el Service Worker cachee nada.
ICONO_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="#060a13"/>
  <rect x="10" y="10" width="108" height="108" rx="22" fill="url(#g)"/>
  <text x="64" y="80" font-family="Arial, sans-serif" font-size="46" font-weight="800"
        fill="#041423" text-anchor="middle">AI</text>
</svg>'''

MOTOR_JS_FILES = [
    "motor/temario.js",
    "motor/storage.js",
    "motor/ejercicio-ui.js",
    "motor/codigo.js",
    "motor/registro-tipos.js",
    "motor/reporte.js",
    "motor/sesion.js",
    "motor/practica.js",
    "motor/conceptos.js",
    "motor/mapa-servicios.js",
    "motor/simulacro.js",
    "motor/modal.js",
    "motor/mapa.js",
    "motor/ajustes.js",
]

TIPOS_EJERCICIO_JS_FILES = [
    "tipos-ejercicio/single-select.js",
    "tipos-ejercicio/multi-select.js",
    "tipos-ejercicio/true-false.js",
    "tipos-ejercicio/matching.js",
    "tipos-ejercicio/dropdown.js",
    "tipos-ejercicio/code-fill.js",
    "tipos-ejercicio/texto-libre.js",
]

DATOS_DIR = "datos"
ICONOS_DIR = "iconos"


def leer(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ No encontrado: {path}")
        sys.exit(1)


def listar_json_datos():
    if not os.path.isdir(DATOS_DIR):
        return []
    return sorted(f for f in os.listdir(DATOS_DIR) if f.endswith(".json"))


def crear_icono():
    with open("icon.svg", "w", encoding="utf-8") as f:
        f.write(ICONO_SVG)
    print("  ✅ icon.svg creado")


def crear_manifest():
    manifest = {
        "name": NOMBRE_APP,
        "short_name": NOMBRE_CORTO,
        "description": "Banco de práctica offline para la certificación AI-901 (Azure AI Fundamentals)",
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": COLOR_FONDO,
        "theme_color": COLOR_FONDO,
        "orientation": "portrait-primary",
        "icons": [
            {"src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"},
        ],
    }
    with open("manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("  ✅ manifest.json creado")


def crear_service_worker():
    archivos_datos = listar_json_datos()
    lista_datos_js = ",\n  ".join(f'"./{DATOS_DIR}/{nombre}"' for nombre in archivos_datos)

    sw = f'''// service-worker.js (generado por build.py — no editar a mano)
const CACHE_NAME = "ai901-trainer-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  {lista_datos_js}
];

self.addEventListener("install", (event) => {{
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
}});

self.addEventListener("activate", (event) => {{
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
}});

// Estrategia "network-first, cache-fallback": si hay internet, siempre trae
// la versión más nueva (útil mientras vas editando los .json de datos/) y
// la deja en caché; si no hay internet, sirve la última copia cacheada —
// así la app funciona 100% offline después del primer uso.
self.addEventListener("fetch", (event) => {{
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {{
        const clonado = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonado));
        return response;
      }})
      .catch(() => caches.match(event.request))
  );
}});
'''
    with open("service-worker.js", "w", encoding="utf-8") as f:
        f.write(sw)
    print(f"  ✅ service-worker.js creado ({len(archivos_datos)} archivos de datos/ listados)")


def get_html_template():
    return '''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="__COLOR_TEMA__" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="__NOMBRE_APP__" />
  <link rel="icon" href="./icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="./icon.svg" />
  <link rel="manifest" href="./manifest.json" />
  <title>__NOMBRE_APP__</title>
  <style>__ESTILOS__</style>
</head>
<body>
<div class="app-container">

  <div class="topbar">
    <div class="marca">
      <div class="marca-logo">AI</div>
      <div>
        <div class="marca-titulo">__NOMBRE_APP__</div>
        <div class="marca-sub">__VERSION__</div>
      </div>
    </div>
    <button class="btn-icono" id="btnAjustes" aria-label="Ajustes">⚙️</button>
  </div>

  <div id="pantallaSecciones" class="screen active">
    <div id="seccionesContainer"></div>
  </div>

  <div id="pantallaLecciones" class="screen">
    <div class="lecciones-header">
      <button class="btn-icono" id="btnVolverSecciones" aria-label="Volver">←</button>
      <h2 id="leccionesTitulo" style="flex:1;font-size:1rem;margin:0;"></h2>
      <div class="lecciones-acciones">
        <button class="btn" id="btnAbrirAprendizaje">💡 Aprendizaje</button>
        <button class="btn" id="btnCopiarReporteSeccion" disabled>📋 Reporte</button>
      </div>
    </div>
    <div id="leccionesContainer"></div>
  </div>

  <div id="pantallaEjercicio" class="screen">
    <div class="lecciones-header">
      <button class="btn-icono" id="btnVolverLecciones" aria-label="Volver">←</button>
      <span id="ejercicioTag" style="color:var(--text-dim);font-size:0.85rem;"></span>
    </div>
    <div id="ejercicioDefinicion" class="definicion-banner" style="display:none;"></div>
    <div id="ejercicioContainer"></div>
  </div>

  <div id="pantallaAprendizaje" class="screen">
    <div class="lecciones-header">
      <button class="btn-icono" id="btnVolverDeAprendizaje" aria-label="Volver">←</button>
      <h2 style="flex:1;font-size:1rem;margin:0;">💡 Aprendizaje</h2>
    </div>
    <div id="aprendizajeContainer"></div>
  </div>

  <div id="pantallaConceptos" class="screen">
    <div id="conceptosContainer"></div>
  </div>

  <div id="pantallaMapaServicios" class="screen">
    <div class="lecciones-header">
      <button class="btn-icono" id="btnVolverMapaServicios" aria-label="Volver">←</button>
      <h2 style="flex:1;font-size:1rem;margin:0;">🗺️ Mapa de servicios</h2>
    </div>
    <div id="mapaServiciosContainer"></div>
  </div>

  <div id="pantallaSimulacro" class="screen">
    <div id="simulacroContainer"></div>
  </div>

</div>

<nav class="tabbar" id="tabbar">
  <button class="tabbar-btn active" data-tab="secciones">
    <span class="tabbar-icono">🗂️</span><span class="tabbar-label">Secciones</span>
  </button>
  <button class="tabbar-btn" data-tab="conceptos">
    <span class="tabbar-icono">📚</span><span class="tabbar-label">Conceptos</span>
  </button>
  <button class="tabbar-btn" data-tab="simulacro">
    <span class="tabbar-icono">⏱️</span><span class="tabbar-label">Simulacro</span>
  </button>
</nav>

<div id="toast" class="toast"></div>

<script type="module">
__ICONOS_JS__

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then((reg) => console.log("✅ Service worker registrado:", reg.scope))
        .catch((err) => console.log("⚠️ Service worker falló:", err));
    });
  }

__MOTOR_JS__

__TIPOS_EJERCICIO_JS__

__MAIN_LOGIC__
</script>
</body>
</html>'''


def get_main_logic():
    return '''
  const $ = (sel) => document.querySelector(sel);

  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  window._toast = toast;

  const pantallas = {
    secciones: document.getElementById("pantallaSecciones"),
    lecciones: document.getElementById("pantallaLecciones"),
    ejercicio: document.getElementById("pantallaEjercicio"),
    aprendizaje: document.getElementById("pantallaAprendizaje"),
    conceptos: document.getElementById("pantallaConceptos"),
    simulacro: document.getElementById("pantallaSimulacro"),
    mapaServicios: document.getElementById("pantallaMapaServicios"),
  };

  function mostrarPantalla(nombre, opciones) {
    const push = !opciones || opciones.push !== false;
    Object.entries(pantallas).forEach(([k, el]) => {
      if (!el) return;
      const activa = k === nombre;
      if (activa && !el.classList.contains("active")) {
        el.classList.add("active", "screen-entrando");
        requestAnimationFrame(() => el.classList.remove("screen-entrando"));
      }
      el.classList.toggle("active", activa);
    });
    // Solo las 2 pantallas "de nivel superior" (con pestaña propia) cambian
    // el resaltado de la barra inferior; Lecciones/Ejercicio/Aprendizaje son
    // parte del flujo de "Secciones" y no deben apagar esa pestaña.
    if (nombre !== "simulacro") {
      document.body.classList.remove("en-simulacro");
      detenerTemporizadorSim(); // el reloj sigue corriendo por marca de tiempo; solo se apaga el repintado
    }
    if (nombre === "secciones" || nombre === "conceptos" || nombre === "simulacro" || nombre === "mapaServicios") {
      const pestana = nombre === "mapaServicios" ? "conceptos" : nombre; // el mapa vive dentro de Conceptos
      document.querySelectorAll(".tabbar-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === pestana));
    }
    // Empuja un estado al historial del navegador para que el botón/gesto de
    // "atrás" del teléfono navegue entre pantallas de la app en vez de
    // salir de ella — sin esto, no hay nada que "deshacer" y el gesto nativo
    // simplemente cierra la página. Ver el listener de "popstate" en init().
    if (push && nombre !== pantallaActual) {
      history.pushState({ pantalla: nombre }, "", "#" + nombre);
    }
    pantallaActual = nombre;
  }
  let pantallaActual = "secciones";

  const callbacksLecciones = { onAbrirLeccion: abrirLeccion, onGenerarReintento: generarReintentoUI };
  const callbacksAprendizaje = { onIniciarPractica: iniciarPracticaUI };
  const callbacksConceptos = { onAbrirConcepto: abrirConcepto, onAbrirMapa: abrirMapaServicios };

  function refrescarSecciones() {
    renderSecciones({ onAbrirSeccion: abrirSeccion });
  }

  async function abrirSeccion(seccionId) {
    await asegurarDatosSeccion(seccionId);
    if (!seccionTieneDatos(seccionId)) {
      toast("📭 Esta sección todavía no tiene ejercicios cargados");
      refrescarSecciones();
      return;
    }
    AppState.seccionActivaId = seccionId;
    obtenerIntentoActual(seccionId);
    renderLecciones(seccionId, callbacksLecciones);
    mostrarPantalla("lecciones");
  }

  function generarReintentoUI(seccionId) {
    generarReintento(seccionId);
    renderLecciones(seccionId, callbacksLecciones);
  }

  // ---------------- Lección calificable ----------------

  function abrirLeccion(seccionId, leccionIndex) {
    AppState.seccionActivaId = seccionId;
    AppState.leccionActivaIndex = leccionIndex;
    mostrarPantalla("ejercicio");
    mostrarSiguienteEjercicio(seccionId);
  }

  function mostrarSiguienteEjercicio(seccionId) {
    const leccionIndex = AppState.leccionActivaIndex;
    const actual = obtenerItemActual(seccionId, leccionIndex);
    const tagEl = document.getElementById("ejercicioTag");
    const cont = document.getElementById("ejercicioContainer");
    ocultarDefinicion();
    if (!actual) {
      history.back(); // el popstate reconstruye Lecciones (ver init())
      return;
    }
    if (tagEl) tagEl.textContent = "Sección " + seccionId + " · Lección " + (leccionIndex + 1) + (actual.esRepaso ? " · repaso" : "");
    renderEjercicio(actual.exercise, cont, (respuesta) => manejarRespuesta(seccionId, respuesta));
  }

  function manejarRespuesta(seccionId, respuesta) {
    const leccionIndex = AppState.leccionActivaIndex;
    const pendiente = procesarRespuesta(seccionId, leccionIndex, respuesta);
    if (!pendiente) return;
    mostrarModalFeedback({
      exercise: pendiente.exercise,
      correcto: pendiente.correcto,
      respuestaUsuario: pendiente.respuestaUsuario,
      onContinuar: () => manejarAvanceLeccion(seccionId, confirmarContinuar(seccionId, leccionIndex, pendiente)),
      onRepasar: () => manejarAvanceLeccion(seccionId, confirmarRepasar(seccionId, leccionIndex, pendiente)),
    });
  }

  function manejarAvanceLeccion(seccionId, r) {
    if (r.cierre) {
      toast(r.cierre.aprobado
        ? ("🎉 ¡Sección aprobada con " + r.cierre.pct + "%!")
        : ("🔁 Obtuviste " + r.cierre.pct + "%. Necesitas 90% — genera un reintento desde la sección."));
      history.back(); // vuelve a Lecciones sin apilar una entrada nueva
    } else if (r.terminoLeccion) {
      toast("✅ Lección completada");
      history.back();
    } else {
      mostrarSiguienteEjercicio(seccionId);
    }
  }

  // ---------------- Aprendizaje (teoría + logros + práctica no calificable) ----------------

  function abrirAprendizaje() {
    const seccionId = AppState.seccionActivaId;
    if (!seccionId) return;
    renderAprendizaje(seccionId, callbacksAprendizaje);
    mostrarPantalla("aprendizaje");
  }

  function iniciarPracticaUI(seccionId) {
    asegurarPracticaActual(seccionId);
    mostrarPantalla("ejercicio");
    mostrarSiguientePractica(seccionId);
  }

  function mostrarSiguientePractica(seccionId) {
    const actual = obtenerItemPractica(seccionId);
    const tagEl = document.getElementById("ejercicioTag");
    const cont = document.getElementById("ejercicioContainer");
    ocultarDefinicion();
    if (!actual) {
      toast("🎉 Terminaste la práctica de esta sección");
      history.back(); // el popstate reconstruye Aprendizaje (ver init())
      return;
    }
    if (tagEl) tagEl.textContent = "💡 Práctica · " + seccionId;
    renderEjercicio(actual.exercise, cont, (respuesta) => manejarRespuestaPractica(seccionId, respuesta));
  }

  function manejarRespuestaPractica(seccionId, respuesta) {
    const pendiente = procesarRespuestaPractica(seccionId, respuesta);
    if (!pendiente) return;
    mostrarModalFeedback({
      exercise: pendiente.exercise,
      correcto: pendiente.correcto,
      respuestaUsuario: respuesta,
      onContinuar: () => { avanzarPunteroPractica(seccionId); mostrarSiguientePractica(seccionId); },
      onRepasar: () => { repasarItemPractica(seccionId); mostrarSiguientePractica(seccionId); },
    });
  }

  // ---------------- Conceptos (glosario con repetición espaciada) ----------------

  function abrirMapaServicios() {
    renderMapaServicios();
    mostrarPantalla("mapaServicios");
  }

  function abrirSimulacroUI() {
    abrirSimulacroDesdeTab();
    mostrarPantalla("simulacro");
  }

  async function abrirConceptos() {
    await asegurarCatalogoConceptos();
    renderConceptos(callbacksConceptos);
    mostrarPantalla("conceptos");
  }

  function abrirConcepto(conceptoId) {
    AppState.conceptoActivoId = conceptoId;
    iniciarRepasoConcepto(conceptoId);
    mostrarPantalla("ejercicio");
    mostrarSiguienteItemConcepto();
  }

  function ocultarDefinicion() {
    const def = document.getElementById("ejercicioDefinicion");
    if (def) { def.style.display = "none"; def.textContent = ""; }
  }

  function mostrarSiguienteItemConcepto() {
    const conceptoId = AppState.conceptoActivoId;
    const actual = obtenerItemRepasoConcepto(conceptoId);
    const tagEl = document.getElementById("ejercicioTag");
    const cont = document.getElementById("ejercicioContainer");
    if (!actual) {
      ocultarDefinicion();
      history.back(); // el popstate reconstruye Conceptos (ver init())
      return;
    }
    const concepto = (AppState.conceptosCatalogo || []).find((c) => c.id === conceptoId);
    if (tagEl) tagEl.textContent = "📚 " + (concepto ? concepto.termino : conceptoId) + (actual.esRepaso ? " · repaso" : "");

    // La definición se muestra SOLO en el primer ejercicio de la PRIMERA
    // vez que se estudia este concepto (historial vacío) — en repasos
    // posteriores se va directo a las preguntas.
    const esPrimeraVezDelConcepto = getConceptoState(conceptoId).historial.length === 0 && actual.posicion === 0 && !actual.esRepaso;
    const defEl = document.getElementById("ejercicioDefinicion");
    if (defEl) {
      if (esPrimeraVezDelConcepto && concepto?.definicion) {
        defEl.style.display = "block";
        defEl.innerHTML = "💡 <strong>" + (concepto.nombreCompleto || concepto.termino) + ":</strong> " + concepto.definicion;
      } else {
        defEl.style.display = "none";
        defEl.textContent = "";
      }
    }

    renderEjercicio(actual.exercise, cont, (respuesta) => manejarRespuestaConcepto(respuesta));
  }

  function manejarRespuestaConcepto(respuesta) {
    const conceptoId = AppState.conceptoActivoId;
    const pendiente = procesarRespuestaConcepto(conceptoId, respuesta);
    if (!pendiente) return;
    mostrarModalFeedback({
      exercise: pendiente.exercise,
      correcto: pendiente.correcto,
      esReflexion: pendiente.esReflexion,
      respuestaUsuario: respuesta,
      onContinuar: () => manejarAvanceConcepto(confirmarContinuarConcepto(conceptoId, pendiente)),
      onRepasar: () => manejarAvanceConcepto(confirmarRepasarConcepto(conceptoId, pendiente)),
    });
  }

  function manejarAvanceConcepto(r) {
    if (r.cierre) {
      toast("📈 Nivel " + r.cierre.nivel + "/10 — " + r.cierre.aciertos + "/" + r.cierre.total + " correctas");
      history.back(); // vuelve a Conceptos sin apilar una entrada nueva
    } else {
      mostrarSiguienteItemConcepto();
    }
  }

  async function init() {
    cargarDeStorage();
    refrescarSecciones();

    document.getElementById("btnAjustes").addEventListener("click", () => {
      mostrarModalAjustes({ onCambios: refrescarSecciones });
    });

    // Los botones ← simplemente le piden al navegador que retroceda en su
    // historial — y es el listener de "popstate" de más abajo el que
    // reconstruye la pantalla de destino. Así el botón en pantalla y el
    // gesto/botón físico de "atrás" del teléfono quedan sincronizados: es
    // literalmente el mismo camino de código.
    document.getElementById("btnVolverSecciones").addEventListener("click", () => history.back());
    document.getElementById("btnVolverLecciones").addEventListener("click", () => history.back());
    document.getElementById("btnVolverDeAprendizaje").addEventListener("click", () => history.back());
    document.getElementById("btnVolverMapaServicios").addEventListener("click", () => history.back());

    document.getElementById("btnAbrirAprendizaje").addEventListener("click", abrirAprendizaje);
    document.getElementById("btnCopiarReporteSeccion").addEventListener("click", () => {
      copiarReporteSeccion(AppState.seccionActivaId);
    });

    document.querySelectorAll(".tabbar-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "secciones") { refrescarSecciones(); mostrarPantalla("secciones"); }
        else if (btn.dataset.tab === "conceptos") { abrirConceptos(); }
        else if (btn.dataset.tab === "simulacro") { abrirSimulacroUI(); }
      });
    });

    // Punto de partida del historial de navegación (ver mostrarPantalla).
    history.replaceState({ pantalla: "secciones" }, "", "#secciones");
    window.addEventListener("popstate", (evento) => {
      const destino = (evento.state && evento.state.pantalla) || "secciones";
      // Reconstruye el contenido de la pantalla destino, igual que hacía
      // cada botón de "volver" antes — solo que ahora responde tanto al
      // botón en pantalla como al gesto/botón nativo del teléfono.
      if (destino === "secciones") refrescarSecciones();
      else if (destino === "lecciones") renderLecciones(AppState.seccionActivaId, callbacksLecciones);
      else if (destino === "aprendizaje") renderAprendizaje(AppState.seccionActivaId, callbacksAprendizaje);
      else if (destino === "conceptos") renderConceptos(callbacksConceptos);
      else if (destino === "simulacro") abrirSimulacroDesdeTab();
      else if (destino === "mapaServicios") renderMapaServicios();
      mostrarPantalla(destino, { push: false });
    });

    // Si entregué ejercicios nuevos (DATA_VERSION distinta), vuelve a leer todos
    // los bancos y limpia el progreso de lo que ya no existe. Si es la misma
    // versión no hace nada. Después precarga las secciones para que el mapa
    // muestre de una vez cuáles están "(Vacío)" y cuáles no.
    const sincronizado = await sincronizarBancos();
    await Promise.all(SECCIONES.map((s) => asegurarDatosSeccion(s.id)));
    refrescarSecciones();
    await asegurarCatalogoConceptos();
    if (sincronizado) toast("📦 Banco de ejercicios actualizado");
  }

  init();
'''


def generar_iconos_js():
    """Convierte iconos/*.svg en una constante ICONOS (data URIs) dentro del index.html:
    cero peticiones extra y funcionan offline desde el primer arranque."""
    import base64
    ruta_cat = os.path.join(ICONOS_DIR, "catalogo.json")
    catalogo = json.loads(leer(ruta_cat))["iconos"]
    mapa = {}
    for ic in catalogo:
        ruta = os.path.join(ICONOS_DIR, ic["id"] + ".svg")
        svg = leer(ruta)
        b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
        mapa[ic["id"]] = {"n": ic["nombre"], "src": "data:image/svg+xml;base64," + b64, "o": bool(ic.get("oficial", True))}
    print(f"  ✅ {len(mapa)} iconos de {ICONOS_DIR}/ embebidos")
    return "const ICONOS = " + json.dumps(mapa, ensure_ascii=False, separators=(",", ":")) + ";"


def build_html():
    print("📂 Leyendo archivos…")
    estilos = leer("estilos/main.css")

    motor_js = "\n\n".join(leer(f) for f in MOTOR_JS_FILES)
    for f in MOTOR_JS_FILES:
        print(f"  ✅ {f}")

    tipos_js = "\n\n".join(leer(f) for f in TIPOS_EJERCICIO_JS_FILES)
    for f in TIPOS_EJERCICIO_JS_FILES:
        print(f"  ✅ {f}")

    plantilla = get_html_template()
    html = plantilla.replace("__ESTILOS__", estilos)
    html = html.replace("__NOMBRE_APP__", NOMBRE_APP)
    html = html.replace("__VERSION__", VERSION)
    html = html.replace("__COLOR_TEMA__", COLOR_TEMA)
    html = html.replace("__ICONOS_JS__", generar_iconos_js())
    html = html.replace("__MOTOR_JS__", motor_js)
    html = html.replace("__TIPOS_EJERCICIO_JS__", tipos_js)
    html = html.replace("__MAIN_LOGIC__", get_main_logic())
    return html


def main():
    print("=" * 60)
    print(f"🔨 {NOMBRE_APP} — Builder (PWA offline)")
    print(f"📦 Versión: {VERSION}")
    print("=" * 60)

    requeridos = ["estilos/main.css", "iconos/catalogo.json"] + MOTOR_JS_FILES + TIPOS_EJERCICIO_JS_FILES
    faltantes = [f for f in requeridos if not os.path.exists(f)]
    if faltantes:
        print("❌ Faltan archivos:")
        for f in faltantes:
            print(f"   - {f}")
        sys.exit(1)

    print(f"✅ {len(requeridos)} archivos fuente encontrados")

    import auditoria
    errores = auditoria.auditar(detalle="--auditar" in sys.argv)
    if "--auditar" in sys.argv:
        sys.exit(1 if errores else 0)
    if errores:
        print("\n⛔ Corrige los errores de datos/ antes de construir (los avisos no frenan el build).")
        sys.exit(1)
    print()
    print("📱 Generando archivos PWA…")
    crear_icono()
    crear_manifest()
    crear_service_worker()
    print()

    html = build_html()
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)

    tam = os.path.getsize("index.html")
    print("\n" + "=" * 60)
    print(f"✅ index.html generado ({tam:,} bytes)")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print("\n🌐 Para probar localmente:")
    print("   python -m http.server 8000")
    print("   y abre http://localhost:8000 en el navegador")


if __name__ == "__main__":
    main()
