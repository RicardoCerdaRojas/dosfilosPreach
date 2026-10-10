"""
Mide cómo quedó un libro antes de construir encima (R1/R2,
docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md). Lee la carpeta que deja
`bajar-recurso.cjs` y no escribe nada en ella.

    python3 scripts/language-rules/medir-extraccion.py <carpeta> [--lengua he|gr]

Informa:
  - si la página impresa coincide con hoja + desfase (`pageNumbering`);
  - cuántas referencias bíblicas trae la capa de texto y cuántas la extracción;
  - las hojas donde la extracción de la biblioteca trae menos de la mitad del
    texto que la capa (contenido perdido que la cobertura no ve: Arnold y Choi
    perdió p. 70–81 y 166–188);
  - cuánto hebreo o griego legible trae la capa (una fuente antigua con
    codificación propia lo deja ilegible).
"""
import json, os, re, sys, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from libros import referencias

if len(sys.argv) < 2:
    sys.exit(__doc__)
carpeta = sys.argv[1]
lengua = sys.argv[sys.argv.index('--lengua') + 1] if '--lengua' in sys.argv else 'he'
meta = json.load(open(os.path.join(carpeta, 'meta.json')))
capa = open(os.path.join(carpeta, 'capa.txt')).read().split('\f')
if capa and not capa[-1].strip():
    capa = capa[:-1]  # tras el último \f no hay hoja
ruta_md = os.path.join(carpeta, 'estructurado.md')
md = open(ruta_md).read() if os.path.exists(ruta_md) else ''

# Desfase hoja → página impresa (un solo tramo es lo habitual).
segmentos = (meta.get('pageNumbering') or {}).get('segments') or []
def impresa(hoja):
    for s in segmentos:
        if s.get('offset') is not None and s['fromSheet'] <= hoja <= s['toSheet']:
            p = hoja + s['offset']
            return p if p > 0 else None  # preliminares: sin página impresa arábiga
    return None

# 1. Página impresa: un número suelto en las primeras o últimas líneas de la hoja.
def numeros_de(h):
    lineas = [l.strip() for l in h.split('\n') if l.strip()]
    # Con -layout el número comparte línea con el encabezado («70      Verbs», «3.4 Nonfinites   71»).
    return [int(n) for l in lineas[:3] + lineas[-3:] for n in re.findall(r'^(\d{1,4})\b|\b(\d{1,4})$', l) for n in n if n]

# Sin desfase guardado (Runge: «Faltan datos»), se infiere: el más frecuente entre número impreso y hoja.
inferido = None
if not segmentos:
    from collections import Counter
    votos = Counter(n - i for i, h in enumerate(capa, start=1) for n in numeros_de(h))
    if votos:
        inferido, apoyo = votos.most_common(1)[0]
        segmentos = [{'fromSheet': 1, 'toSheet': len(capa), 'offset': inferido, 'inferido': True, 'apoyo': apoyo}]

ok = distinto = sin_numero = 0
for i, h in enumerate(capa, start=1):
    numeros = numeros_de(h)
    esperado = impresa(i)
    if not numeros or esperado is None:
        sin_numero += 1
    elif esperado in numeros:
        ok += 1
    else:
        distinto += 1

# 2. Referencias bíblicas (y las del otro Testamento, que el extractor de ejemplos no toma).
otra = 'gr' if lengua == 'he' else 'he'
refs_capa = len(referencias('\n'.join(capa), lengua))
refs_otra = len(referencias('\n'.join(capa), otra))
refs_md = len(referencias(md, lengua)) if md else None

# 3. Contenido perdido: hojas del estructurado contra la misma hoja de la capa.
perdidas = []
if md:
    partes = re.split(r'<!-- page: (\d+) -->', md)
    por_hoja = {int(partes[k]): partes[k + 1] for k in range(1, len(partes), 2)}
    # Se cuentan caracteres que no son espacio: `-layout` infla la capa con espacios, y un índice o
    # una tabla salían «perdidos» con las mismas palabras en las dos versiones (revisión de R1).
    lleno = lambda t: len(re.sub(r'\s+', '', re.sub(r'<!--.*?-->|[#*|_-]', '', t)))
    largos = [lleno(h) for h in capa if lleno(h) > 150]
    mediana = statistics.median(largos) if largos else 0
    for hoja, texto in por_hoja.items():
        base = lleno(capa[hoja - 1]) if hoja - 1 < len(capa) else 0
        if base > 0.5 * mediana and lleno(texto) < 0.5 * base:
            perdidas.append(hoja)

def tramos(hojas):
    out, ini = [], None
    for k, h in enumerate(sorted(hojas)):
        if ini is None:
            ini = prev = h
        elif h == prev + 1:
            prev = h
        else:
            out.append((ini, prev)); ini = prev = h
    if ini is not None:
        out.append((ini, prev))
    return out

# 4. Escritura legible en la capa.
texto_capa = '\n'.join(capa)
hebreo = len(re.findall(r'[א-ת]', texto_capa))
griego = len(re.findall(r'[Ͱ-Ͽἀ-῿]', texto_capa))

informe = {
    'libro': f"{meta.get('title')} — {meta.get('author')}",
    'hojas': len(capa),
    'pagina_impresa': {'coincide': ok, 'distinta': distinto, 'sin_numero': sin_numero, 'desfase': segmentos},
    'referencias': {'capa': refs_capa, 'extraccion': refs_md, 'del_otro_testamento': refs_otra},
    'hojas_con_contenido_perdido': [
        {'hojas': f'{a}–{b}', 'paginas': f'{impresa(a) or "prelim."}–{impresa(b) or "prelim."}'} for a, b in tramos(perdidas)
    ],
    'escritura_en_la_capa': {'letras_hebreas': hebreo, 'letras_griegas': griego},
}
avisos = []
if inferido is not None:
    avisos.append(f'El recurso no tiene desfase guardado; inferido de la capa: página = hoja {inferido:+d}. '
                  '«coincide» se mide contra ese mismo desfase (no lo valida): confirmarlo a mano y guardarlo en el recurso.')
if informe['pagina_impresa']['distinta'] > informe['pagina_impresa']['coincide']:
    avisos.append('La página impresa no coincide con el desfase guardado: revisar `pageNumbering` antes de citar páginas.')
if lengua == 'he' and hebreo < 100:
    avisos.append('La capa de texto no trae hebreo legible (fuente con codificación propia): el hebreo de los ejemplos se toma de OSHB por la referencia.')
if lengua == 'gr' and griego < 100:
    avisos.append('La capa de texto no trae griego legible: el griego de los ejemplos se toma de MorphGNT por la referencia.')
if refs_otra:
    avisos.append(f'{refs_otra} referencias del otro Testamento: el extractor de ejemplos con --lengua {lengua} no las toma.')
if perdidas:
    avisos.append(f'La extracción de la biblioteca perdió contenido en {len(perdidas)} hojas (ver tramos): usar la capa de texto para esas páginas.')
informe['avisos'] = avisos
print(json.dumps(informe, ensure_ascii=False, indent=1))
