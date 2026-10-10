"""
Saca de la capa de texto los EJEMPLOS de un tramo del libro, por sección y
subcategoría (R1, docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md). Son el
conjunto de prueba hecho por el autor: la regla tiene que dar, en cada
versículo, la categoría que el libro le asigna.

    python3 scripts/language-rules/ejemplos-del-libro.py <carpeta> --desde 3.4.1 --hasta 3.5 \
        [--lengua he|gr] [--edicion "<editorial año, ISBN>"] [--desfase <n>]

`--desfase` (página = hoja + n) hace falta si el recurso no lo tiene guardado;
`medir-extraccion.py` lo infiere.

Salida (JSON): por sección, su página impresa y sus subcategorías «(a)»,
«(b.3)»… con el nombre corto («Temporal», «Purpose») y las referencias
bíblicas con su página. NO guarda texto del libro: sólo etiquetas, nombres de
categoría y referencias, que es lo que se commitea como prueba.

Formato que entiende: secciones numeradas («3.4.1 Infinitive Construct») y
subcategorías con letra («(b.3)»), como Arnold y Choi. Con Runge funciona a
medias: su numeración se reinicia en cada capítulo (el tramo se corta en la
primera sección fuera de rango) y no tiene subcategorías (los ejemplos quedan
en la sección). La jerarquía de Wallace (I. / A. / 1. / a.) queda pendiente.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from libros import referencias

args = sys.argv[1:]
if len(args) < 5 or '--desde' not in args or '--hasta' not in args:
    sys.exit(__doc__)
carpeta = args[0]
desde = args[args.index('--desde') + 1]
hasta = args[args.index('--hasta') + 1]
lengua = args[args.index('--lengua') + 1] if '--lengua' in args else 'he'
meta = json.load(open(os.path.join(carpeta, 'meta.json')))
# Ligaduras tipográficas de la capa («Inﬁnitive» → «Infinitive»); la última hoja tras el último \f está vacía.
hojas = open(os.path.join(carpeta, 'capa.txt')).read().translate(str.maketrans({'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'})).split('\f')
if hojas and not hojas[-1].strip():
    hojas = hojas[:-1]
segmentos = (meta.get('pageNumbering') or {}).get('segments') or []
if '--desfase' in args:
    segmentos = [{'fromSheet': 1, 'toSheet': len(hojas), 'offset': int(args[args.index('--desfase') + 1])}]


def impresa(hoja):
    for s in segmentos:
        if s.get('offset') is not None and s['fromSheet'] <= hoja <= s['toSheet']:
            p = hoja + s['offset']
            return p if p > 0 else None
    return None


def clave(sec):
    return tuple(int(x) for x in sec.split('.'))


# Encabezado del cuerpo: «3.4.1 Infinitive Construct». El índice y el encabezado de página llevan el
# número de página separado por varios espacios («4.1.2. l5 / Al0          97»); un título ilegible
# puede terminar en dígito («Al0»).
ENCABEZADO = re.compile(r'^\s*(\d+(?:\.\d+)+)\.?\s+([^\d\s][^\n]*?)\s*$')
SUBCATEGORIA = re.compile(r'^\s*\(([a-z](?:\.\d+)?)\)\s+(.*)$')


def legible(titulo):
    """¿Se puede leer? Un título en hebreo con codificación propia sale como «Œ», «d¡À», «yqZy»."""
    letras = r"A-Za-z" + (r"Ͱ-Ͽἀ-῿" if lengua == 'gr' else '')
    if not re.fullmatch(rf"[{letras}][{letras}\s,'’()/–Ø-]{{2,}}", titulo):
        return False
    # Mayúscula después de minúscula dentro de una palabra («yqZy»): basura de la fuente.
    return not re.search(r'[a-z][A-Z]', titulo)


def nombre_corto(texto):
    """Lo que va antes de la raya («Temporal – locates…»), sin el número de nota pegado («Essence13»)."""
    if '–' not in texto:
        return None
    return re.sub(r'\d+$', '', texto.split('–')[0].strip()).strip() or None


# Se lee por BLOQUES (una subcategoría o la parte suelta de una sección): una referencia partida
# entre líneas («(1\nKgs 12:27)») sólo se reconoce con el bloque entero. Cada trozo recuerda su hoja.
secciones, actual, sub, bloque = [], None, None, []


def cerrar():
    global bloque
    if actual is None or not bloque:
        bloque = []
        return
    texto, hojas_de = '', []
    for t, h in bloque:
        hojas_de.append((len(texto), h))
        texto += t + '\n'
    destino = sub['ejemplos'] if sub else actual.setdefault('ejemplos', [])
    for libro, cap, vers, pos in referencias(texto, lengua):
        hoja = [h for inicio, h in hojas_de if inicio <= pos][-1]
        destino.append({'libro': libro, 'capitulo': cap, 'versiculo': vers, 'pagina': impresa(hoja)})
    bloque = []


terminado = False
for n, hoja in enumerate(hojas, start=1):
    if terminado:
        break
    for linea in hoja.split('\n'):
        m = ENCABEZADO.match(linea)
        if m and not re.search(r'\s{3,}\d{1,4}\s*$', linea) and len(m.group(2)) < 80:
            sec = m.group(1)
            if actual is not None and clave(sec) >= clave(hasta):
                # Fin del tramo, y no se vuelve a entrar: Runge reinicia la numeración en cada capítulo.
                cerrar(); terminado = True; break
            if clave(desde) <= clave(sec) < clave(hasta):
                cerrar()
                titulo = m.group(2).strip()
                ok = legible(titulo)
                actual = {'seccion': sec, 'titulo': titulo if ok else None, **({} if ok else {'tituloIlegible': True}),
                          'pagina': impresa(n), 'subcategorias': []}
                secciones.append(actual); sub = None
                continue
        if actual is None:
            continue
        s = SUBCATEGORIA.match(linea)
        if s:
            cerrar()
            sub = {'etiqueta': s.group(1), 'nombre': nombre_corto(s.group(2)), 'pagina': impresa(n), 'ejemplos': []}
            actual['subcategorias'].append(sub)
        bloque.append((linea, n))
if not terminado:
    cerrar()

total = sum(len(s['ejemplos']) for x in secciones for s in x['subcategorias']) + sum(len(x.get('ejemplos', [])) for x in secciones)
salida = {'obra': meta.get('title'), 'autor': meta.get('author'), 'recurso': meta.get('id'), 'tramo': f'{desde}–{hasta}', 'ejemplos': total, 'secciones': secciones}
if '--edicion' in args:
    salida['edicion'] = args[args.index('--edicion') + 1]
print(json.dumps(salida, ensure_ascii=False, indent=1))
