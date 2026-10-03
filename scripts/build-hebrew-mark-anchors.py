"""
Anclas de las vocales hebreas de Noto Serif Hebrew para el PDF del sermón.

jsPDF no aplica GPOS: sin esto cada vocal caía sobre la letra vecina. Se leen
las anclas «mark-to-base» de la fuente (las que usa un procesador de texto) y
se guardan en una tabla chica que el exportador aplica a mano.

Uso (desde la raíz; fonttools en un entorno virtual):
    python3 -m venv /tmp/v && /tmp/v/bin/pip install fonttools
    /tmp/v/bin/python scripts/build-hebrew-mark-anchors.py
"""
import json
from fontTools.ttLib import TTFont

FUENTE = 'packages/web/public/fonts/pdf/NotoSerifHebrew-Regular.ttf'
SALIDA = 'packages/infrastructure/src/export/hebrewMarkAnchors.json'

f = TTFont(FUENTE)
rev = {}
for cp, g in f.getBestCmap().items():
    rev.setdefault(g, cp)
marks, bases = {}, {}
for i, lk in enumerate(f['GPOS'].table.LookupList.Lookup):
    if lk.LookupType != 4:
        continue
    for st in lk.SubTable:
        for g, mr in zip(st.MarkCoverage.glyphs, st.MarkArray.MarkRecord):
            if g in rev:
                marks.setdefault(chr(rev[g]), []).append([i, mr.Class, mr.MarkAnchor.XCoordinate, mr.MarkAnchor.YCoordinate])
        for g, br in zip(st.BaseCoverage.glyphs, st.BaseArray.BaseRecord):
            if g not in rev:
                continue
            for c, a in enumerate(br.BaseAnchor):
                if a:
                    bases.setdefault(chr(rev[g]), {}).setdefault(str(i), {})[str(c)] = [a.XCoordinate, a.YCoordinate]
with open(SALIDA, 'w', encoding='utf8') as out:
    json.dump({'upm': f['head'].unitsPerEm, 'marks': marks, 'bases': bases}, out, ensure_ascii=False, separators=(',', ':'))
print(f'{len(marks)} marcas, {len(bases)} letras → {SALIDA}')
