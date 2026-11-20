"""Ubica en el PDF la página impresa de cada título del CONTENIDO (cuerpo numerado desde 1).
Uso: python3 -I paginas_contenido.py <pdf> <titulos.json> <salida.json>
Busca en orden por el texto completo; descarta la línea del bosquejo (termina en punto)."""
import sys,json,subprocess,re
pdf,tj,outj=sys.argv[1:4]
tit=json.load(open(tj,encoding='utf-8'))
n=int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',pdf],capture_output=True,text=True).stdout).group(1))
pages=[subprocess.run(['pdftotext','-layout','-f',str(i),'-l',str(i),pdf,'-'],capture_output=True,text=True).stdout for i in range(1,n+1)]
norm=lambda s: re.sub(r'[ \t]+',' ',s.replace('SEÑOR','Señor')).upper()
starts=[]; full=''
for p in pages: starts.append(len(full)); full+=norm(p)+'\n\f\n'
page_of=lambda off: max(i for i,s in enumerate(starts) if s<=off)
first=None; pos=0; res=[]
for k,t in enumerate(tit):
    key=re.escape(norm(t).strip())
    m=None
    for m0 in re.finditer(key+r'(?!\.)',full[pos:]):
        line_end=full.find('\n',pos+m0.end()); tail=full[pos+m0.end():line_end].strip()
        if tail=='' : m=m0; break
    assert m, f'no encontré el título: {t}'
    off=pos+m.start(); pg=page_of(off)
    if first is None: first=pg
    res.append(pg-first+1); pos=off+len(m.group(0))
json.dump(res,open(outj,'w')); print('cuerpo empieza en la hoja PDF',first+1); [print(f'{r:>3}  {t}') for r,t in zip(res,tit)]
