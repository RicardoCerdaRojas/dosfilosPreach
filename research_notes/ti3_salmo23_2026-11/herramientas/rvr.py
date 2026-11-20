"""Imprime versículos de la RV1960 del repo (solo lectura). Uso: python3 -I rvr.py <json> "jn 10:11" "ez 34:11-12" ...
Ojo (memoria del proyecto): hay '/n' literal en miles de versículos; se limpia al imprimir."""
import sys,json,re
d={b['id']:b for b in json.load(open(sys.argv[1],encoding='utf-8'))}
if len(sys.argv)==2: print(' '.join(sorted(d))); sys.exit()
for ref in sys.argv[2:]:
    m=re.match(r'(\S+)\s+(\d+):(\d+)(?:-(\d+))?$',ref); b,c,v1,v2=m.group(1),int(m.group(2)),int(m.group(3)),int(m.group(4) or m.group(3))
    vs=d[b]['chapters'][c-1][v1-1:v2]
    print(f"{ref}: "+' '.join(f"[{v1+i}] "+re.sub(r'\s*/n\s*',' ',x).strip() for i,x in enumerate(vs)))
