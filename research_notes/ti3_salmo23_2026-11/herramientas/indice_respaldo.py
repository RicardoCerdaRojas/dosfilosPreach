"""Genera 05_Respaldo_citas/00_INDICE.md (nota → imagen de página) desde las notas vigentes del borrador.
Uso: python3 -I indice_respaldo.py <borrador.md> <carpeta 05_Respaldo_citas>
Conserva el encabezado del índice existente (todo lo anterior a la tabla). Falla si una página citada no tiene imagen."""
import sys,re,os
t=open(sys.argv[1],encoding='utf-8').read(); D=sys.argv[2]; OUT=sys.argv[3] if len(sys.argv)>3 else '00_INDICE.md'
notes=re.findall(r'^\[\^(\d+)\]: (.*)$',t.split('\n## Notas\n')[1],flags=re.M)
SRC=[('deClaissé-Walford','NICOT_2014','NICOT','html'),('Book of Psalms','NICOT_2014','NICOT','html'),('Vos','Vos_2020','Vos','png'),('Botha','Botha_2015','Botha','png'),
('Barrick','Barrick_2005','Barrick','png'),('BDB','BDB','BDB','png'),('Brown, Driver','BDB','BDB','png'),('Tov','Tov_2012','Tov','png'),('Biblia Hebraica','BHS','BHS','png'),
('Lexicón','Ortiz','Ortiz','png'),('IBHS','IBHS_1990','IBHS','png'),('Waltke','IBHS_1990','IBHS','png'),('Arnold','ArnoldChoi_2003','AC','png'),('Ross','Ross_2011','Ross','png'),
('Craigie','Craigie_1983','Craigie','png'),('Andersen','Andersen_1970','Andersen','png')]
def pages(seg):
    seg=re.sub(r'Psalms 1–50|\*1–41\*|\(\d{4}\)|\b(19|20)\d\d\b|\bno\. \d+|\b\d+, no\.|Psalm 23|Salmo 23|vol\. 1|3ra ed|5ta ed|Commentary 19|Series 14|\d+:\d+(–\d+)?|vv?\. ?[\d–a-c]+|n\. \d+|\d+ de noviembre|principios \d y \d|Part 1','',seg)
    out=[]
    for a,b in re.findall(r'(\d{2,4})(?:–(\d{1,4}))?',seg):
        a=int(a)
        if b: b=int(str(a)[:len(str(a))-len(b)]+b) if len(b)<len(str(a)) else int(b); out+=list(range(a,b+1))
        else: out.append(a)
    return out
rows=[]; last=None; missing=[]
for n,x in notes:
    files=[]; cur=None
    for seg in re.split(r';|(?<![A-Z])\. (?=[A-ZÁÉÍÓÚ«*])',x):
        src=None
        if seg.strip().startswith('Ibid'): src=last
        for k,sub,tag,ext in SRC:
            if k in seg: src=(sub,tag,ext); break
        if not src: src=cur
        if not src: continue
        cur=last=src; sub,tag,ext=src
        for p in pages(seg):
            f=f"{sub}/NICOT_p{p}.html" if ext=='html' else f"{sub}/{tag}_p{p:04d}.png"
            if os.path.exists(os.path.join(D,f)): files.append(f)
            else: missing.append((n,f))
        if ext=='html' and 'n. 10' in seg: files.append(f"{sub}/NICOT_notas_finales_Sal23.html")
        if tag=='Ross' and '566' in seg: files.append("Ross_2011/Ross_p0566_foto_del_libro.png")
    rows.append((n,x,list(dict.fromkeys(files))))
head=open(os.path.join(D,'00_INDICE.md'),encoding='utf-8').read().split('| Nota |')[0]
if OUT!='00_INDICE.md': head=head.replace('Parte 1','Parte 2')
head=re.sub(r'\(versión del [^)]*\)',f'(versión vigente, {len(rows)} notas)',head)
idx=[head.rstrip('\n'),"","| Nota | Texto de la nota (inicio) | Archivo(s) |","|---|---|---|"]
for n,x,f in rows:
    idx.append(f"| {n} | {re.sub(r'[*|]','',x)[:90]}… | {'<br>'.join('`'+i+'`' for i in f) if f else '— (sin cita de página)'} |")
open(os.path.join(D,OUT),'w',encoding='utf-8').write('\n'.join(idx)+'\n')
print('notas',len(rows),'| sin archivo:',missing or 'ninguna','| sin página:',[n for n,x,f in rows if not f])
assert not missing
