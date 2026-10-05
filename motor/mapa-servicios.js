// motor/mapa-servicios.js
//
// "Mapa de servicios": todos los iconos de Azure/Foundry del proyecto,
// agrupados por NECESIDAD ("quiero analizar texto → Azure Language"), con
// el nombre vigente de cada servicio. Elegir el servicio correcto según un
// escenario es la habilidad central del examen, y asociarlo a su icono ayuda
// a recordarlo. El "modo autoevaluación" oculta nombres y descripciones: toca
// un icono, adivina qué es y vuelve a tocarlo para comprobarlo.

const MAPA_SERVICIOS = [
  { titulo: "Generar contenido y crear agentes", emoji: "🤖", nota: "«Quiero que la IA redacte, resuma, cree imágenes o actúe con herramientas».", items: [
    { i: "foundry", d: "La plataforma donde construyes aplicaciones y agentes de IA." },
    { i: "foundry-tools", d: "El conjunto de servicios de IA prediseñados (Language, Speech, Translator, Vision, Content Understanding…)." },
    { i: "foundry-project", d: "Espacio de trabajo con su propio endpoint: agrupa modelos, agentes y conexiones." },
    { i: "foundry-models", d: "Catálogo de modelos y sus deployments (tipo, cuota y filtros)." },
    { i: "openai", d: "Modelos de OpenAI (texto, imágenes, audio) con los controles de Azure." },
    { i: "foundry-agent-service", d: "Crear y ejecutar agentes: modelo + instrucciones + herramientas." },
    { i: "foundry-local", d: "Ejecutar modelos en tu propio equipo." },
  ] },
  { titulo: "Analizar y traducir texto", emoji: "📝", nota: "«Quiero saber el sentimiento, las entidades, las frases clave, el idioma o traducir».", items: [
    { i: "language", d: "Sentimiento, entidades, frases clave, idioma, resumen y detección de datos personales (PII)." },
    { i: "translator", d: "Traducir texto entre decenas de idiomas." },
  ] },
  { titulo: "Trabajar con voz", emoji: "🎙️", nota: "«Quiero transcribir, hablar, traducir lo hablado o distinguir quién habla».", items: [
    { i: "speech", d: "Voz a texto, texto a voz (SSML), traducción de voz y diarización." },
  ] },
  { titulo: "Entender imágenes", emoji: "🖼️", nota: "«Quiero describir fotos, leer su texto o detectar objetos y rostros».", items: [
    { i: "vision", d: "Caption, etiquetas, objetos, personas, OCR y recortes inteligentes." },
    { i: "face", d: "Detección de rostros; la identificación tiene acceso limitado (IA responsable)." },
    { i: "custom-vision", d: "Entrenar tu propio modelo de clasificación o detección de objetos con imágenes etiquetadas." },
  ] },
  { titulo: "Extraer datos de documentos, imágenes, audio y video", emoji: "🧾", nota: "«Quiero convertir contenido no estructurado en campos y datos utilizables».", items: [
    { i: "content-understanding", d: "Analyzers prebuilt o personalizados (field schema) para documentos, imágenes, audio y video. Icono: ilustración propia." },
    { i: "doc-intelligence", d: "Extrae texto, campos y tablas de formularios y documentos." },
  ] },
  { titulo: "Buscar en tus datos (RAG)", emoji: "🔎", nota: "«Quiero que el modelo responda con mi información y la cite».", items: [
    { i: "ai-search", d: "Indexa y recupera tu contenido para fundamentar las respuestas del modelo." },
  ] },
  { titulo: "Seguridad del contenido y IA responsable", emoji: "🛡️", nota: "«Quiero bloquear contenido dañino, ataques y alucinaciones».", items: [
    { i: "content-safety", d: "Guardrails por categorías de daño, Prompt Shields, groundedness, material protegido y PII." },
  ] },
  { titulo: "Entrenar tus propios modelos", emoji: "🧪", nota: "«Quiero entrenar, administrar y desplegar modelos propios de machine learning».", items: [
    { i: "machine-learning", d: "Workspace, AutoML, Designer y el panel de IA responsable." },
    { i: "bot-service", d: "Construir y desplegar bots conversacionales." },
  ] },
  { titulo: "Identidad y protección", emoji: "🔐", nota: "«Quiero controlar quién accede y proteger secretos y recursos».", items: [
    { i: "entra-id", d: "Identidad y acceso (Microsoft Entra ID) con RBAC." },
    { i: "managed-identity", d: "Identidad para tu app sin guardar claves en el código." },
    { i: "key-vault", d: "Guardar secretos, claves y certificados." },
    { i: "defender", d: "Proteger recursos y datos en la nube." },
  ] },
  { titulo: "Infraestructura y operación", emoji: "☁️", nota: "«Quiero organizar, alojar, almacenar, observar y administrar recursos».", items: [
    { i: "resource-group", d: "Contenedor lógico que agrupa los recursos de una solución." },
    { i: "storage-account", d: "Almacenamiento (Blob y más) para datos y archivos." },
    { i: "virtual-machine", d: "Servidor virtual: el ejemplo de IaaS." },
    { i: "app-service", d: "Alojar aplicaciones web: el ejemplo de PaaS." },
    { i: "monitor", d: "Observar el estado, el rendimiento y los registros." },
    { i: "cloud-shell", d: "Línea de comandos (Azure CLI) dentro del portal." },
    { i: "copilot", d: "Asistente de IA generativa de Microsoft integrado en sus productos." },
  ] },
];

let _mapaAutoevaluacion = false;

function renderMapaServicios() {
  const cont = document.getElementById("mapaServiciosContainer");
  if (!cont) return;
  const total = MAPA_SERVICIOS.reduce((t, g) => t + g.items.length, 0);
  const grupos = MAPA_SERVICIOS.map((g) => `
    <section class="mapa-grupo">
      <h3 class="mapa-grupo-titulo"><span>${g.emoji}</span> ${escHTML(g.titulo)}</h3>
      <p class="mapa-grupo-nota">${escHTML(g.nota)}</p>
      <div class="mapa-grid">
        ${g.items.map((it) => `
          <button type="button" class="mapa-tile" data-icono="${escAttr(it.i)}">
            ${iconoHTML(it.i, { tam: "lg", conNombre: false })}
            <span class="mapa-txt">
              <strong class="mapa-nombre">${escHTML(nombreIcono(it.i))}</strong>
              <small class="mapa-desc">${escHTML(it.d)}</small>
            </span>
          </button>`).join("")}
      </div>
    </section>`).join("");

  cont.innerHTML = `
    <p class="mapa-intro">Elegir el servicio correcto según el escenario es la habilidad central del examen. Aquí tienes los ${total} iconos agrupados por <strong>necesidad</strong>. Los de Language, Speech, Translator, Vision, Face, Document Intelligence y Content Understanding forman parte de <strong>Foundry Tools</strong>.</p>
    <label class="mapa-switch">
      <input type="checkbox" id="mapaAutoeval" ${_mapaAutoevaluacion ? "checked" : ""}>
      <span>🙈 Modo autoevaluación: oculta los nombres. Toca un icono para ver su respuesta.</span>
    </label>
    <div id="mapaCuerpo" class="${_mapaAutoevaluacion ? "autoevaluacion" : ""}">${grupos}</div>`;

  const cuerpo = cont.querySelector("#mapaCuerpo");
  cont.querySelector("#mapaAutoeval").addEventListener("change", (e) => {
    _mapaAutoevaluacion = e.target.checked;
    cuerpo.classList.toggle("autoevaluacion", _mapaAutoevaluacion);
    cuerpo.querySelectorAll(".mapa-tile.revelado").forEach((t) => t.classList.remove("revelado"));
  });
  cuerpo.querySelectorAll(".mapa-tile").forEach((t) => {
    t.addEventListener("click", () => { if (_mapaAutoevaluacion) t.classList.toggle("revelado"); });
  });
}
