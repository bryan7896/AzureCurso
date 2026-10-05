# AI-901 Trainer — versión final (partes 1 a 5)

## Cómo construir y probar
    python build.py            # audita datos/ + genera index.html, manifest y service worker
    python build.py --auditar  # solo auditoría detallada (no construye)
    python -m http.server 8000 # y abre http://localhost:8000

Si el build marca ERRORES en datos/, no genera nada hasta que los corrijas (los AVISOS no frenan).

## Cuando cambies ejercicios en datos/*.json
Sube `DATA_VERSION` en `motor/temario.js`. Al abrir la app, vuelve a leer todos los bancos,
conserva el progreso de los ejercicios que no cambiaron y descarta el de los que cambiaron o se borraron.
Si no hay conexión en ese momento no toca nada y reintenta en el próximo arranque.

## Campos nuevos que acepta cada ejercicio
- `peso`: 1 | 2 | 3  (3 = núcleo tipo examen; sin `peso` se asume 2). Pesa en el simulacro y en el refuerzo de reintentos.
- `skill`: id de una habilidad oficial (ver HABILIDADES en motor/temario.js) -> el simulacro dice qué habilidad fallas.
- `imagen`: id de un icono de iconos/catalogo.json, se muestra grande sobre el enunciado.
- `code`: { lang, title, source, highlight:[n] } -> bloque de código bonito en cualquier tipo de ejercicio.
- `noBarajar: true` -> no baraja las opciones (para "Todas las anteriores").
- Texto con `código inline` entre acentos graves se resalta en enunciados, opciones y explicaciones.
- En opciones y en ítems de emparejar: `icono: "id"` (y `soloIcono: true` para ocultar el nombre).
- Ordenar código: en matching/sequence, ítems con `"code": true` y `"lang": "python"` en el ejercicio.

## Tipo nuevo: code-fill
{ "type": "code-fill", "prompt": "...", "code": { "lang": "python", "title": "x.py", "source": "...{{b1}}..." },
  "blanks": [ { "id": "b1", "options": ["correcta", "d1", "d2"], "correctOption": "correcta" } ], "explanation": "..." }

## Iconos
iconos/*.svg + iconos/catalogo.json. Se embeben en index.html (offline). El nombre mostrado es el vigente (Foundry Tools);
"archivoOrigen" conserva el nombre antiguo del archivo de Microsoft. El de Content Understanding es una ilustración propia
(no existe en el paquete oficial V24 de julio de 2026). Uso personal/estudio, según los términos de Microsoft.

## Qué trae esta parte
- Opciones barajadas en cada ejercicio; el 90 % se mide sobre toda la sección (último resultado de cada ejercicio).
- Tarjetas con peso en el examen y sección recomendada.
- Simulacro de 45 preguntas / 60 min por peso real, con resultados por dominio, sección y habilidad.
- 19 ejercicios semilla en 1.3 y 2.1-2.4 (código del Foundry SDK 2.x). Los bancos 1.1 y Conceptos aún son los originales
  (se reescriben en las partes siguientes): el auditor ya marca sus sesgos.


## Parte 2 — contenido de 2.1 y 2.2
- 2.1 Generative AI + Agents: 101 ejercicios (prompts 18, portal 22, cliente de chat con el SDK 21, agentes en el portal 20, agentes desde código 20).
- 2.2 Text + Speech: 66 ejercicios (análisis de texto 24, voz con modelo multimodal 15, Azure Speech 27).
- 30 ejercicios con código Python verificado: el auditor compila cada fragmento (con los huecos ya rellenos) en cada build.
- Teoría y laboratorios (pestaña 💡 Aprendizaje) con bloques de código; 8 labs en 2.1 y 7 en 2.2 para hacer en el portal.
- Sesgo de longitud corregido: la correcta es la opción más larga en ~20 % de las selecciones únicas (el azar daría 25 %).
- Metas del plan ajustadas a lo escrito (2.1 = 100, 2.2 = 60). `DATA_VERSION` = 2026-10-05-p2.
- APIs verificadas contra la documentación de Microsoft (octubre 2026): Foundry SDK 2.x (AIProjectClient, responses, conversations,
  PromptAgentDefinition, CodeInterpreterTool/FileSearchTool/WebSearchTool), Azure Language (azure-ai-textanalytics),
  Azure Speech (azure-cognitiveservices-speech) y audio en chat completions (modalities + input_audio).


## Parte 3 — contenido de 2.3 y 2.4
- 2.3 Computer Vision + Image Generation: 58 ejercicios (imágenes en el prompt 16, generación de imágenes 17, Azure Vision 25).
- 2.4 Information Extraction + Content Understanding: 58 ejercicios (documentos 22, imágenes 7, audio y video 14, aplicación 15).
- 13 ejercicios con código; incluye JSON de analyzers (field schema) con huecos dentro de las comillas.
- Teoría y laboratorios de ambas secciones (6 labs cada una).
- Sesgo de longitud: la correcta es la opción más larga en ~24 % (2.3) y ~17 % (2.4).
- El auditor ahora valida el JSON de los ejercicios de código y detecta ids repetidos entre secciones
  (encontró un choque real entre 2.1 y 2.3, ya corregido: los ejercicios de Vision usan ids z-XX).
- Metas del plan = ejercicios escritos: 101 + 66 + 58 + 58 = 283 en el Dominio 2. `DATA_VERSION` = 2026-10-05-p3.
- APIs verificadas (octubre 2026): azure-ai-vision-imageanalysis, client.images.generate (GPT-image, base64),
  azure-ai-contentunderstanding (begin_analyze, analyzers prebuilt, fieldSchema con extract/generate/classify).


## Parte 4 — contenido de 1.2 y 1.3 (Dominio 1 completo salvo 1.1)
- 1.2 Modelos y deployments: 66 ejercicios (cómo funcionan los modelos 21, elegir modelo 19, deployments y parámetros 26).
- 1.3 Cargas de trabajo de IA: 76 ejercicios (escenarios 22, texto 13, voz 12, visión 13, extracción 16).
- Tipos de deployment verificados (octubre 2026): Global/Data Zone/Regional × Standard/Provisioned/Batch + Developer; cuotas TPM y error 429;
  tokens de razonamiento y reasoning_effort. Sesgo de longitud: 26 % en ambas.
- Metas del plan = ejercicios escritos. `DATA_VERSION` = 2026-10-05-p4. Pendiente: reescribir 1.1 (hoy 110 ejercicios originales) y Conceptos.


## Parte 5 — 1.1, Conceptos y mapa de servicios
- 1.1 IA responsable reescrita: 90 ejercicios (13–14 por principio + 9 de visión general), con las herramientas vigentes de Foundry
  (Guardrails —antes filtros de contenido—, Prompt Shields, groundedness, material protegido, PII) y el enfoque Discover, Protect, Govern.
  Correcta más larga en 30 %; verdaderos 7 de 16. Los 30 ejercicios de práctica antiguos se retiraron (tenían los sesgos originales).
- Conceptos rehechos: 140 conceptos (21 nuevos: agentes y sus herramientas, tipos de deployment, TPM, guardrails, prompt injection, red teaming…)
  y 307 ejercicios con 4 opciones, distractores tomados de conceptos no relacionados y verdadero/falso balanceado (51 %).
  La explicación de cada respuesta dice a qué término corresponde cada alternativa. Se conservan los 27 ejercicios de escritura libre.
  Nombres actualizados a Foundry Tools; «Schema y Extractor» (no oficial) pasó a «Analyzer y field schema».
- Mapa de servicios (pestaña Conceptos → 🗺️): 30 iconos agrupados por necesidad, con modo autoevaluación que oculta los nombres.

## Estado final del banco
| Sección | Ejercicios |  | Sección | Ejercicios |
|---|---|---|---|---|
| 1.1 IA responsable | 90 |  | 2.2 Text + Speech | 66 |
| 1.2 Modelos y deployments | 66 |  | 2.3 Visión e imágenes | 58 |
| 1.3 Cargas de trabajo | 76 |  | 2.4 Content Understanding | 58 |
| 2.1 Generative AI + Agents | 101 |  | **Total secciones** | **515** |
Conceptos: 140 (307 ejercicios). Simulacro: 45 preguntas con el peso real de cada sección.
`DATA_VERSION` = 2026-10-05-p5.
