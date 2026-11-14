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
LIBRO_EN={'Mt':['Matt','Mt'],'Mc':['Mark','Mk'],'Lc':['Luke','Lk'],'Jn':['John','Jn'],'Hch':['Acts'],'Ro':['Rom'],'1 Co':['1 Cor','I Cor'],'2 Co':['2 Cor','II Cor'],'Gá':['Gal'],'Ef':['Eph'],'Flp':['Phil'],'Col':['Col'],'1 Ts':['1 Thess','I Thess'],'2 Ts':['2 Thess','II Thess'],'1 Ti':['1 Tim','I Tim'],'2 Ti':['2 Tim','II Tim'],'Heb':['Heb'],'Stg':['Jas','James'],'1 P':['1 Pet','I Pet'],'2 P':['2 Pet','II Pet'],'1 Jn':['1 John','I John'],'Ap':['Rev'],
    # AT (repetición en espejo en hebreo, pendientes de la revisión del profesor, 2026-11-13).
    'Éx':['Ex','Exod'],'Is':['Isa','Isaiah']}
def romano(n):
    out=''
    for v,r in ((100,'c'),(90,'xc'),(50,'l'),(40,'xl'),(10,'x'),(9,'ix'),(5,'v'),(4,'iv'),(1,'i')):
        while n>=v: out+=r; n-=v
    return out
def cita_en_pagina(seccion,pagina):
    """La referencia del versículo impresa en la página: suelta, en un rango («1 Cor. 11:8-12») o en una
    lista («1 Cor. xi. 8, 9»), con el capítulo en arábigos (Lund) o en romanos (Bullinger)."""
    m=re.search(r'·\s*(.+?)\s+(\d+):(\d+)\s*$',seccion)
    if not m: return False
    libro,c,v=m.group(1),int(m.group(2)),int(m.group(3))
    for a in LIBRO_EN.get(libro,[]):
        base=a.replace(' ',r'\s*')+r'\.?\s*'
        # El OCR de Bullinger lee a veces la «l» romana como «1» («Isa. 1. 1» por «Isa. l. 1», Is 50:1).
        rom=''.join({'l':'[l1I]','i':'[i1lI]'}.get(x,x) for x in romano(c))
        for cap in (str(c)+r'\s*:\s*',rom+r'\s*\.\s*'):
            for hit in re.finditer(base+cap+r'(\d+(?:\s*[-–,]\s*\d+)*)',pagina,re.I):
                nums=hit.group(1)
                for tramo in re.split(r'\s*,\s*',nums):
                    ab=[int(x) for x in re.split(r'\s*[-–]\s*',tramo) if x.strip().isdigit()]
                    if ab and (ab[0]==v or (len(ab)==2 and ab[0]<=v<=ab[1])): return True
    return False
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
    rango=re.search(r'\((\d{1,2}\.\d+(?:-\d{1,2}\.\d+)?)\)\s*$',f['section'])
    if f['work'] in ('lund','bullinger'):
        # La repetición en espejo (revisión del profesor, Stg 2:18): la REFERENCIA del versículo tiene que
        # estar impresa en la página citada («Matt. 10:39» en Lund; «Gal. v. 17» en Bullinger, con romanos).
        hallado=cita_en_pagina(f['section'],hojas[p+off-1])
    elif rango:
        # Louw-Nida (U3c): el «Outline of Subdomains» no lleva marca de nivel; se exige el NOMBRE y el RANGO
        # en la misma línea o en dos seguidas de la página («Specification (89.4-89.7)»).
        sin_esp=lambda x: re.sub(r'\s','',x)
        lw=set(lat(re.sub(r'\([^)]*\)\s*$','',leaf)))
        # A dos columnas, unir el guion de fin de línea pega la columna derecha con la izquierda («…artiDivide»).
        crudas=hojas[p+off-1].split('\n')
        hallado=any(sin_esp(rango.group(0)) in sin_esp(crudas[i]+crudas[i+1] if i+1<len(crudas) else crudas[i]) and lw<=(set(lat(crudas[i]))|set(lat(crudas[i-1] if i else ''))|set(lat(crudas[i+1] if i+1<len(crudas) else ''))) for i in range(len(crudas)))
    elif len(lw)<=2:
        # Encabezado corto («Cause»): la línea tiene que EMPEZAR con su marca de nivel y la palabra.
        primera=lat(leaf)[0] if lat(leaf) else ''
        # Encabezado que empieza en griego («ἵνα + the Subjunctive»): el OCR lo lee «“Iva»; se admiten
        # hasta tres palabras antes de la primera latina.
        griego=r'(?:\S+\s+){0,3}?' if re.match(r'\s*[\u0370-\u03ff\u1f00-\u1fff]',leaf) else ''
        # Ruido del OCR tolerado: basura antes de la marca («a> 5.»), «ID.» por «D.», «Asan» por «As an».
        # Louw-Nida: el dominio se encabeza «89 Relations», con el número sin punto.
        ln_dom=r'|\d{1,2}' if f['work']=='louwNida' else ''
        marca=re.compile(r'^\W*(?:\w\W+)?(?:\d+(?:\.\d+)+\.?|[IVX]+\.|[A-L]{1,2}[.,]|\d{1,2}[.,]|[a-l][.,]|\d{1,2}\)|\([a-z](?:\.\d+)?\)'+ln_dom+r')\s+(?:as\s?an\s*)?'+griego+re.escape(primera),re.I)
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
