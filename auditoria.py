#!/usr/bin/env python3
# auditoria.py — controla la calidad de datos/*.json en cada build.
#
#   python build.py              -> audita (resumen) y construye
#   python build.py --auditar    -> audita en detalle y NO construye
#   python auditoria.py -v       -> igual, directo
#
# ERRORES (frenan el build): ids duplicados, respuesta correcta inexistente,
#   huecos {{x}} sin definir, iconos que no existen, código Python que no compila.
# AVISOS (no frenan): pocas opciones, la correcta casi siempre es la más larga,
#   verdadero/falso desbalanceado, falta `peso`/`skill`, explicaciones cortas...

import ast
import collections
import json
import os
import re
import statistics
import sys

DATOS = "datos"
TIPOS = {"single-select", "multi-select", "true-false", "matching", "dropdown", "code-fill", "texto-libre"}


def leer_plan():
    js = open("motor/temario.js", encoding="utf-8").read()
    plan = {}
    for m in re.finditer(r'\{\s*id:\s*"(\d\.\d)",\s*dominio:\s*(\d),\s*titulo:\s*"([^"]+)",\s*totalEjercicios:\s*(\d+),\s*pesoExamen:\s*(\d+)', js):
        plan[m.group(1)] = {"dominio": int(m.group(2)), "titulo": m.group(3), "meta": int(m.group(4)), "peso": int(m.group(5))}
    habilidades = {}
    bloque = js[js.index("export const HABILIDADES"):js.index("export function getSeccion")]
    for sec in re.finditer(r'"(\d\.\d)":\s*\[(.*?)\n  \],', bloque, re.S):
        habilidades[sec.group(1)] = set(re.findall(r'id:\s*"([\w-]+)"', sec.group(2)))
    return plan, habilidades


def leer_iconos():
    try:
        return {i["id"] for i in json.load(open("iconos/catalogo.json", encoding="utf-8"))["iconos"]}
    except Exception:
        return set()


def largo(opciones):
    return [len(o["text"]) if isinstance(o, dict) else len(o) for o in opciones]


class Informe:
    def __init__(self):
        self.errores = []
        self.avisos = []

    def e(self, donde, msg):
        self.errores.append(f"{donde}: {msg}")

    def w(self, donde, msg):
        self.avisos.append(f"{donde}: {msg}")


def revisar_codigo(inf, donde, ej):
    code = ej.get("code")
    if not code:
        return
    lang = (code.get("lang") or "").lower()
    src = code.get("source", "")
    if lang in ("python", "py"):
        relleno = src
        for b in ej.get("blanks", []) if ej.get("type") == "code-fill" else []:
            relleno = relleno.replace("{{%s}}" % b["id"], b["correctOption"])
        if re.search(r"\{\{\w+\}\}", relleno):
            inf.e(donde, "quedan huecos {{..}} sin definir en blanks")
            return
        try:
            ast.parse(relleno)
        except SyntaxError as err:
            inf.e(donde, f"el código Python no compila (línea {err.lineno}): {err.msg}")
    if lang == "json":
        relleno = src
        for b in ej.get("blanks", []) if ej.get("type") == "code-fill" else []:
            relleno = relleno.replace("{{%s}}" % b["id"], b["correctOption"])
        try:
            json.loads(re.sub(r"\{\{\w+\}\}", "x", relleno))
        except Exception as err:
            (inf.e if ej.get("type") == "code-fill" else inf.w)(donde, f"JSON de ejemplo no válido: {err}")
    for n in code.get("highlight", []) or []:
        if n > len(src.split("\n")):
            inf.e(donde, f"highlight apunta a la línea {n} pero el código tiene {len(src.split(chr(10)))}")


def revisar_ejercicio(inf, donde, ej, seccion, habilidades, iconos, mostrar_peso=True, estricto=True):
    t = ej.get("type")
    if t not in TIPOS:
        inf.e(donde, f"tipo desconocido '{t}'")
        return
    if not ej.get("id"):
        inf.e(donde, "sin id")
    if not (ej.get("prompt") or ej.get("statement") or ej.get("textWithBlanks")):
        (inf.e if estricto else inf.w)(donde, "sin enunciado (solo se ven las opciones)")
    expl = ej.get("explanation", "")
    if t != "texto-libre" or ej.get("modo") != "reflexion":
        if len(expl) < 30:
            inf.w(donde, "explicación ausente o demasiado corta")

    if ej.get("imagen") and ej["imagen"] not in iconos:
        inf.e(donde, f"imagen '{ej['imagen']}' no existe en iconos/catalogo.json")

    if t in ("single-select", "multi-select"):
        ids = [o["id"] for o in ej.get("options", [])]
        if len(ids) != len(set(ids)):
            inf.e(donde, "ids de opción repetidos")
        for o in ej.get("options", []):
            if o.get("icono") and o["icono"] not in iconos:
                inf.e(donde, f"icono '{o['icono']}' no existe")
        if t == "single-select":
            if ej.get("correctOptionId") not in ids:
                inf.e(donde, "correctOptionId no está en las opciones")
            if len(ids) < 4:
                inf.w(donde, f"solo {len(ids)} opciones (el examen usa 4+)")
        else:
            malos = [c for c in ej.get("correctOptionIds", []) if c not in ids]
            if malos or not ej.get("correctOptionIds"):
                inf.e(donde, "correctOptionIds vacío o con ids inexistentes")
            if len(ids) < 4:
                inf.w(donde, f"solo {len(ids)} opciones para selección múltiple")
            if len(ej.get("correctOptionIds", [])) >= len(ids):
                inf.e(donde, "todas las opciones son correctas")
    elif t in ("dropdown", "code-fill"):
        texto = ej.get("textWithBlanks") if t == "dropdown" else (ej.get("code") or {}).get("source", "")
        marcas = set(re.findall(r"\{\{(\w+)\}\}", texto or ""))
        defin = {b["id"] for b in ej.get("blanks", [])}
        if marcas != defin:
            inf.e(donde, f"huecos del texto {sorted(marcas)} ≠ blanks {sorted(defin)}")
        for b in ej.get("blanks", []):
            if b.get("correctOption") not in b.get("options", []):
                inf.e(donde, f"hueco {b['id']}: correctOption no está en options")
            if len(b.get("options", [])) < 3:
                inf.w(donde, f"hueco {b['id']}: solo {len(b.get('options', []))} opciones")
        if t == "code-fill" and not ej.get("code"):
            inf.e(donde, "code-fill sin `code`")
    elif t == "true-false":
        if "correctAnswer" not in ej:
            inf.e(donde, "sin correctAnswer")
    elif t == "matching":
        if ej.get("mode") == "sequence":
            its = {i["id"] for i in ej.get("items", [])}
            if set(ej.get("correctOrder", [])) != its:
                inf.e(donde, "correctOrder no coincide con items")
        else:
            izq = {i["id"] for i in ej.get("leftItems", [])}
            der = {i["id"] for i in ej.get("rightItems", [])}
            for p in ej.get("correctPairs", []):
                if p["leftId"] not in izq or p["rightId"] not in der:
                    inf.e(donde, "correctPairs apunta a ids inexistentes")
            for i in ej.get("leftItems", []) + ej.get("rightItems", []):
                if i.get("icono") and i["icono"] not in iconos:
                    inf.e(donde, f"icono '{i['icono']}' no existe")
    elif t == "texto-libre" and ej.get("modo") != "reflexion" and not ej.get("respuestasAceptadas"):
        inf.e(donde, "texto-libre sin respuestasAceptadas")

    revisar_codigo(inf, donde, ej)

    if seccion and mostrar_peso:
        if "peso" not in ej:
            inf.w(donde, "sin `peso` (1-3)")
        elif ej["peso"] not in (1, 2, 3):
            inf.e(donde, "peso debe ser 1, 2 o 3")
        if "skill" not in ej:
            inf.w(donde, "sin `skill`")
        elif habilidades.get(seccion) and ej["skill"] not in habilidades[seccion]:
            inf.w(donde, f"skill '{ej['skill']}' no está en HABILIDADES[{seccion}]")


def sesgos(inf, donde, ejercicios):
    ss = [e for e in ejercicios if e.get("type") == "single-select" and len(e.get("options", [])) >= 3]
    if len(ss) >= 8:
        mas_largo = 0
        for e in ss:
            ls = largo(e["options"])
            ci = [o["id"] for o in e["options"]].index(e["correctOptionId"])
            mas_largo += ls[ci] == max(ls) and ls.count(max(ls)) == 1
        pct = mas_largo / len(ss)
        if pct > 0.45:
            inf.w(donde, f"la correcta es la opción más larga en {round(pct * 100)}% de las selecciones únicas (ideal ≈ 25-35%)")
    tf = [e for e in ejercicios if e.get("type") == "true-false"]
    if len(tf) >= 10:
        v = sum(1 for e in tf if e.get("correctAnswer")) / len(tf)
        if v > 0.62 or v < 0.38:
            inf.w(donde, f"verdadero/falso desbalanceado: {round(v * 100)}% verdaderos (ideal 40-60%)")
    prompts = collections.Counter((e.get("prompt") or e.get("statement") or "").strip() for e in ejercicios if not e.get("imagen"))
    genericos = {"Completa la frase:", "Relaciona cada término con su definición:", ""}
    dup = [p for p, n in prompts.items() if n > 1 and p not in genericos]
    if dup:
        inf.w(donde, f"{len(dup)} enunciado(s) repetido(s), p. ej.: {dup[0][:70]}")


def auditar(detalle=False):
    plan, habilidades = leer_plan()
    iconos = leer_iconos()
    inf = Informe()
    filas = []
    ids_globales = {}

    for sid, meta in plan.items():
        ruta = os.path.join(DATOS, f"{sid}-ejercicios.json")
        try:
            ejercicios = json.load(open(ruta, encoding="utf-8")).get("exercises", [])
        except Exception as err:
            inf.e(ruta, f"no se pudo leer: {err}")
            continue
        vistos = set()
        for ej in ejercicios:
            donde = f"{sid}/{ej.get('id', '?')}"
            if ej.get("id") in vistos:
                inf.e(donde, "id duplicado en la sección")
            vistos.add(ej.get("id"))
            if ej.get("id") in ids_globales and ids_globales[ej["id"]] != sid:
                inf.e(donde, f"id repetido en la sección {ids_globales[ej['id']]}")
            ids_globales[ej.get("id")] = sid
            revisar_ejercicio(inf, donde, ej, sid, habilidades, iconos)
        sesgos(inf, sid, ejercicios)
        tipos = collections.Counter(e.get("type") for e in ejercicios)
        n = len(ejercicios)
        nucleo = sum(1 for e in ejercicios if e.get("peso") == 3)
        codigo = sum(1 for e in ejercicios if e.get("code") or e.get("type") == "code-fill")
        filas.append((sid, n, meta["meta"], meta["peso"], nucleo, codigo, dict(tipos)))

    # Conceptos
    ruta = os.path.join(DATOS, "conceptos.json")
    try:
        conceptos = json.load(open(ruta, encoding="utf-8")).get("conceptos", [])
        todos = []
        for c in conceptos:
            for e in c.get("ejercicios", []):
                todos.append(e)
                revisar_ejercicio(inf, f"conceptos/{e.get('id', '?')}", e, None, {}, iconos, estricto=False)
        ss = [e for e in todos if e.get("type") == "single-select"]
        if ss:
            dos = sum(1 for e in ss if len(e.get("options", [])) <= 2)
            if dos:
                inf.w("conceptos", f"{dos}/{len(ss)} selecciones únicas con solo 2 opciones (50% de azar)")
        sesgos(inf, "conceptos", todos)
        ids_c = collections.Counter(e.get("id") for e in todos)
        for i, k in ids_c.items():
            if k > 1:
                inf.e(f"conceptos/{i}", "id de ejercicio duplicado")
        ncon = len(conceptos)
        filas.append(("conceptos", len(todos), None, None, None, None, {"conceptos": ncon}))
    except Exception as err:
        inf.w(ruta, f"no se pudo auditar: {err}")

    print("\n📋 Auditoría de datos/")
    print(f"   {'sección':<10}{'ejercicios':>11}{'meta':>7}{'peso':>6}{'núcleo':>8}{'código':>8}")
    tot = tot_meta = 0
    for sid, n, meta, peso, nuc, cod, tipos in filas:
        if sid == "conceptos":
            print(f"   {sid:<10}{n:>11}{'':>7}{'':>6}{'':>8}{'':>8}   ({tipos['conceptos']} conceptos)")
            continue
        tot += n
        tot_meta += meta
        print(f"   {sid:<10}{n:>11}{meta:>7}{peso:>6}{nuc:>8}{cod:>8}")
    print(f"   {'TOTAL':<10}{tot:>11}{tot_meta:>7}   (secciones del examen)")

    if inf.errores:
        print(f"\n❌ {len(inf.errores)} error(es):")
        for x in inf.errores[:40]:
            print("   -", x)
        if len(inf.errores) > 40:
            print(f"   … y {len(inf.errores) - 40} más")
    resumen = collections.Counter(re.sub(r"^[^:]+: ", "", a) for a in inf.avisos)
    if inf.avisos:
        print(f"\n⚠️  {len(inf.avisos)} aviso(s):")
        if detalle:
            for x in inf.avisos:
                print("   -", x)
        else:
            vistos = set()
            for a in inf.avisos:
                clave = a.split(": ", 1)[1]
                clave_g = re.sub(r"\d+", "N", clave)
                if clave_g in vistos:
                    continue
                vistos.add(clave_g)
                n = sum(1 for z in inf.avisos if re.sub(r"\d+", "N", z.split(": ", 1)[1]) == clave_g)
                print(f"   - {a}" + (f"   (+{n - 1} similares; usa --auditar para verlos todos)" if n > 1 else ""))
    if not inf.errores and not inf.avisos:
        print("\n✅ Sin errores ni avisos")
    return len(inf.errores)


if __name__ == "__main__":
    sys.exit(1 if auditar(detalle="-v" in sys.argv or "--auditar" in sys.argv) else 0)
