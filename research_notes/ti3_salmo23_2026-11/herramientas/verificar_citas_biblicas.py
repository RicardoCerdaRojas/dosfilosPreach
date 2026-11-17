"""Verifica las citas bíblicas de un borrador: «texto» (Ref).
- (v. N) / (vv. …) y las lecturas «…» del Sal 23 → contra la traducción aprobada (bloque '>' de la Parte 1).
- Otras referencias → contra la RV1960 del repo (subcadena, normalizando espacios y '/n').
Uso: python3 -I verificar_citas_biblicas.py <borrador.md> <parte1_aprobada.md> <rvr1960.json>"""
import sys,re,json,unicodedata
draft=open(sys.argv[1],encoding='utf-8').read().split('\n---\n')[0]
p1=open(sys.argv[2],encoding='utf-8').read()
trad=' '.join(l[2:] for l in p1.split('\n') if l.startswith('> '))
rvr={b['id']:b for b in json.load(open(sys.argv[3],encoding='utf-8'))}
IDS={'Sal':'ps','Is':'is','Ez':'ez','Gn':'gn','Jn':'jo','Mt':'mt','Mr':'mk','Heb':'hb','Lm':'lm','Ro':'rm','1 P':'1pe','Ap':'re','2 Co':'2co','1 Co':'1co'}
def norm(s):
    s=re.sub(r'\s*/n\s*',' ',s); s=re.sub(r'[¹²³⁴⁵⁶]','',s); s=s.replace('SEÑOR','Señor')
    return re.sub(r'\s+',' ',s).strip().lower()
T=norm(trad); ok=0; bad=[]
for m in re.finditer(r'«([^«»]+)»\s*\(([^)]+)\)',draft):
    q,ref=m.group(1),m.group(2)
    if re.match(r'vv?\. ',ref):
        good=norm(q).rstrip('.') in T
    else:
        mm=re.match(r'(\d? ?[A-Za-zñ]+) (\d+):(\d+)(?:–(\d+))?',ref.split(';')[0])
        if not mm or mm.group(1) not in IDS: bad.append(('sin mapa',ref,q[:60])); continue
        b=rvr[IDS[mm.group(1)]]; c=int(mm.group(2)); v1=int(mm.group(3)); v2=int(mm.group(4) or v1)
        txt=norm(' '.join(b['chapters'][c-1][v1-1:v2]))
        good=norm(q).rstrip('.') in txt
    (ok:=ok+1) if good else bad.append(('NO COINCIDE',ref,q[:90]))
# lecturas «…» sin referencia entre paréntesis (Lectura: Salmo 23:x)
for m in re.finditer(r'\*\*Lectura: Salmo 23:[^*]+\*\*\s*«([^»]+)»',draft):
    good=norm(m.group(1)).rstrip('.') in T
    (ok:=ok+1) if good else bad.append(('LECTURA NO COINCIDE','',m.group(1)[:90]))
print('coinciden:',ok); [print(' -',*x) for x in bad]
