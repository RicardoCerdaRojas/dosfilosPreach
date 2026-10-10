"""
Coteja cada fuente VERIFICADA del registro con el texto del ejemplar: el
encabezado impreso tiene que estar en la página que dice la cita (R0,
docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md).

Comprueba encabezado y página, NO que la categoría del libro corresponda a la
regla: eso lo revisa una persona (docs/CITAS_REGLAS_IDIOMA.md).

Uso (el texto de los libros NO va al repo):
    pdftotext -layout <ejemplar.pdf> wallace.txt          # Wallace 1996 (OCR del escaneo)
    pdftotext -layout <ejemplar.pdf> arnold-choi.txt      # Arnold y Choi 2003 (digital)
    (cd packages/domain && npx vite-node scripts/listar-fuentes.mts > /tmp/fuentes.json)
    python3 scripts/language-rules/cotejar-citas.py /tmp/fuentes.json wallace=wallace.txt:36 arnoldChoi=arnold-choi.txt:14
El número tras «:» es el desfase hoja → página impresa (`pageNumbering` del recurso).
Con `--aprobar <ruta>` y sin fallos, escribe la lista de pares «obra|sección|página» cotejados:
la prueba de CI (`ruleSources.test.ts`) exige que toda fuente verificada esté en esa lista.
Sale con código 1 si algún encabezado no está en su página.
"""
import json,re,sys
F=json.load(open(sys.argv[1]))
libros={}
for arg in [a for a in sys.argv[2:] if '=' in a]:
    obra,resto=arg.split('=',1); ruta,off=resto.rsplit(':',1)
    # Ligaduras tipográficas de la capa («inﬁnitive»).
    libros[obra]=(open(ruta).read().translate(str.maketrans({'ﬁ':'fi','ﬂ':'fl','ﬀ':'ff','ﬃ':'ffi','ﬄ':'ffl'})).split('\f'),int(off))
def lat(x): return [w for w in re.findall(r'[a-z]+',x.lower()) if len(w)>2 and w not in ('the','and','aka','with')]
ok=0; malos=[]
for f in F:
    if not f.get('verified') or f['work'] not in libros: continue
    hojas,off=libros[f['work']]; p=int(f['verified']['page'])
    lineas=[set(lat(l)) for l in re.sub(r'-\n\s*','',hojas[p+off-1]).split('\n')]
    pares=lineas+[lineas[i]|lineas[i+1] for i in range(len(lineas)-1)]
    leaf=f['section'].split('›')[-1]
    leaf=re.sub(r'^\s*[\d.]+\s+','',leaf); leaf=re.sub(r'^\s*\([a-z](?:\.\d+)?\)\s*','',leaf)
    lw=set(lat(re.sub(r'\(a\.k\.a\.[^)]*\)','',leaf)))
    crudas=re.sub(r'-\n\s*','',hojas[p+off-1]).split('\n')
    if len(lw)<=2:
        # Encabezado corto («Cause»): la línea tiene que EMPEZAR con su marca de nivel y la palabra.
        primera=lat(leaf)[0] if lat(leaf) else ''
        # Encabezado que empieza en griego («ἵνα + the Subjunctive»): el OCR lo lee «“Iva»; se admiten
        # hasta tres palabras antes de la primera latina.
        griego=r'(?:\S+\s+){0,3}?' if re.match(r'\s*[\u0370-\u03ff\u1f00-\u1fff]',leaf) else ''
        # Ruido del OCR tolerado: basura antes de la marca («a> 5.»), «ID.» por «D.», «Asan» por «As an».
        marca=re.compile(r'^\W*(?:\w\W+)?(?:\d+(?:\.\d+)+\.?|[IVX]+\.|[A-L]{1,2}[.,]|\d{1,2}[.,]|[a-l][.,]|\d{1,2}\)|\([a-z](?:\.\d+)?\))\s+(?:as\s?an\s*)?'+griego+re.escape(primera),re.I)
        hallado=any(marca.match(l) and lw<=set(lat(l)) for l in crudas)
    else:
        hallado=any(lw<=l for l in pares)
    if hallado: ok+=1
    else: malos.append((f['work'],f['section'],p,sorted(lw)))
print(f'verificadas: {ok+len(malos)} · encabezado hallado en su página: {ok} · no hallado: {len(malos)}')
for m in malos: print('  ',m)
if '--aprobar' in sys.argv and not malos:
    salida=sys.argv[sys.argv.index('--aprobar')+1]
    aprobados=sorted(f"{f['work']}|{f['section']}|{f['verified']['page']}" for f in F if f.get('verified') and f['work'] in libros)
    json.dump(aprobados,open(salida,'w'),ensure_ascii=False,indent=1); print('aprobados escritos en',salida)
sys.exit(1 if malos else 0)
