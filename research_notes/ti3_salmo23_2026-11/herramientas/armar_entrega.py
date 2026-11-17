"""Arma el Word de entrega del TI #3: portada (del TI #2), CONTENIDO, Parte 1, Parte 2 y bibliografía.

Uso: python3 -I armar_entrega.py <plantilla_dir> <parte1.md> <parte2.md> <salida.docx> [paginas.json]
- paginas.json: lista de números de página para el CONTENIDO, en el orden de los títulos
  (se obtiene con una primera pasada: generar sin él, exportar a PDF y ubicar cada título).
Reutiliza runs()/_run() de md2docx_tms.py para que el cuerpo salga idéntico al medido.
"""
import os, re, sys, json, shutil, zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'md2docx_tms.py'), encoding='utf-8').read()
ns = {'re': re, 'escape': escape}
exec(src[src.index('HEB = '):src.index('paras = []')], ns)
runs = ns['runs']; items = ns['items']

tpl, p1, p2, out = sys.argv[1:5]
paginas = json.load(open(sys.argv[5])) if len(sys.argv) > 5 else None

BIBLIO = [
    "Andersen, Francis I. *The Hebrew Verbless Clause in the Pentateuch*. Journal of Biblical Literature Monograph Series 14. Nashville: Abingdon, 1970.",
    "Arnold, Bill T., y John H. Choi. *A Guide to Biblical Hebrew Syntax*. Cambridge: Cambridge University Press, 2003.",
    "Barrick, William D. «Psalm 23: Lessons from Its Translation from the Early Church until Today. Part 1—The Ancient Versions». Ponencia presentada en la reunión anual de la Evangelical Theological Society, Valley Forge, PA, 16 de noviembre de 2005.",
    "Botha, Phil J. «Following the “Tracks of Righteousness” of Psalm 23». *Old Testament Essays* 28, no. 2 (2015): 283–300.",
    "Brown, Francis, S. R. Driver y Charles A. Briggs, eds. *The New Brown, Driver, and Briggs Hebrew and English Lexicon of the Old Testament*. 1906. Reimpreso, Lafayette, IN: Associated Publishers & Authors, 1981.",
    "Craigie, Peter C. *Psalms 1–50*. Word Biblical Commentary 19. Waco, TX: Word Books, 1983.",
    "deClaissé-Walford, Nancy, Rolf A. Jacobson y Beth LaNeel Tanner. *The Book of Psalms*. New International Commentary on the Old Testament. Grand Rapids: Eerdmans, 2014.",
    "Elliger, K., y W. Rudolph, eds. *Biblia Hebraica Stuttgartensia*. 5ta ed. Stuttgart, Alemania: Deutsche Bibelgesellschaft, 1997.",
    "Ortiz V., Pedro. *Lexicón hebreo-arameo-español*. Madrid: Sociedad Bíblica, 2009.",
    "Ross, Allen P. *A Commentary on the Psalms*. Vol. 1, *1–41*. Kregel Exegetical Library. Grand Rapids: Kregel, 2011.",
    "Tov, Emanuel. *Textual Criticism of the Hebrew Bible*. 3ra ed. Minneapolis: Fortress, 2012.",
    "Vos, Cas J. A. «The Lord Is My Shepherd in Suffering». *Old Testament Essays* 33, no. 3 (2020): 634–48.",
    "Waltke, Bruce K., y M. O’Connor. *An Introduction to Biblical Hebrew Syntax*. Winona Lake, IN: Eisenbrauns, 1990.",
]

def parte(md_text, offset, primera):
    notes = {}
    for m in re.finditer(r'^\[\^(\d+)\]:\s*(.+)$', md_text, flags=re.M):
        notes[str(int(m.group(1)) + offset)] = m.group(2).strip()
    body = re.sub(r'^\[\^(\d+)\]:.*$', '', md_text, flags=re.M).split('\n---\n')[0]
    body = re.sub(r'\[\^(\d+)\]', lambda m: f'[^{int(m.group(1)) + offset}]', body)
    paras, titulos = [], []
    for block in re.split(r'\n\s*\n', body.strip()):
        lines = [l for l in block.split('\n') if l.strip()]
        if not lines:
            continue
        if lines[0].startswith('# '):
            brk = '' if primera else '<w:pageBreakBefore/>'
            paras.append(f'<w:p><w:pPr><w:pStyle w:val="Heading1"/>{brk}<w:jc w:val="center"/></w:pPr>' + runs(lines[0][2:]) + '</w:p>')
            titulos.append((1, lines[0][2:]))
        elif lines[0].startswith('## '):
            paras.append('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' + runs(lines[0][3:]).replace('<w:rPr>', '<w:rPr><w:b/><w:bCs/>') + '</w:p>')
            titulos.append((2, lines[0][3:]))
        elif lines[0].startswith('>'):
            for i, l in enumerate(lines):
                t = l.lstrip('>').strip(); after = '240' if i == len(lines) - 1 else '0'
                paras.append(f'<w:p><w:pPr><w:spacing w:after="{after}" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:right="720" w:firstLine="0"/></w:pPr>' + runs(t) + '</w:p>')
        else:
            paras.extend('<w:p>' + runs(t) + '</w:p>' for t in items(lines))
    return paras, notes, titulos

t1 = open(p1, encoding='utf-8').read(); t2 = open(p2, encoding='utf-8').read()
n1 = len(re.findall(r'^\[\^\d+\]:', t1, flags=re.M))
pa1, no1, ti1 = parte(t1, 0, True)
pa2, no2, ti2 = parte(t2, n1, False)
notes = {**no1, **no2}

# Bibliografía
bib = ['<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:pageBreakBefore/><w:spacing w:after="480"/></w:pPr>' + runs('BIBLIOGRAFÍA').replace('<w:rPr>', '<w:rPr><w:b/><w:bCs/>') + '</w:p>']
bib += ['<w:p><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/></w:pPr>' + runs(e) + '</w:p>' for e in BIBLIO]
titulos = ti1 + ti2 + [(2, 'BIBLIOGRAFÍA')]

work = out + '.dir'
shutil.rmtree(work, ignore_errors=True)
shutil.copytree(tpl, work)
doc = open(os.path.join(work, 'word/document.xml'), encoding='utf-8').read()
head = doc[:doc.index('<w:body>') + len('<w:body>')]
ps = re.findall(r'<w:p[ >].*?</w:p>', doc, flags=re.S)
txt = lambda p: ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))

# Portada: párrafos hasta el primer salto de sección (incluido)
i_sec1 = next(i for i, p in enumerate(ps) if '<w:sectPr' in p)
portada = ''.join(ps[:i_sec1 + 1])
for a, b in (('TRABAJO DE INVESTIGACIÓN #2', 'TRABAJO DE INVESTIGACIÓN #3'), ('SALMOS 23:4–6', 'SALMO 23:1–6'), ('OCTUBRE 2026', 'NOVIEMBRE 2026')):
    assert portada.count(a) == 1, f'portada: no encontré «{a}»'
    portada = portada.replace(a, b)

# CONTENIDO: el párrafo «CONTENIDO» + entradas estáticas + el párrafo con el salto de la sección romana
i_cont = next(i for i, p in enumerate(ps) if txt(p).strip() == 'CONTENIDO')
i_sec2 = next(i for i, p in enumerate(ps) if i > i_sec1 and '<w:sectPr' in p)
sec2 = re.search(r'<w:sectPr.*?</w:sectPr>', ps[i_sec2], flags=re.S).group(0)
toc = [ps[i_cont]]
for k, (lvl, t) in enumerate(titulos):
    num = str(paginas[k]) if paginas else '0'
    sty = 'TOC1' if lvl == 1 else 'TOC2'
    toc.append(f'<w:p><w:pPr><w:pStyle w:val="{sty}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs></w:pPr>'
               + runs(t) + f'<w:r><w:tab/></w:r><w:r><w:t>{num}</w:t></w:r></w:p>')
toc.append(f'<w:p><w:pPr>{sec2}</w:pPr></w:p>')

sect_final = re.findall(r'<w:sectPr.*?</w:sectPr>', doc, flags=re.S)[-1]
open(os.path.join(work, 'word/document.xml'), 'w', encoding='utf-8').write(
    head + portada + ''.join(toc) + ''.join(pa1 + pa2 + bib) + sect_final + '</w:body></w:document>')

fn = open(os.path.join(work, 'word/footnotes.xml'), encoding='utf-8').read()
fhead = fn[:fn.index('<w:footnote ')]
seps = ''.join(re.findall(r'<w:footnote w:type="(?:separator|continuationSeparator)".*?</w:footnote>', fn, flags=re.S))
fx = [f'<w:footnote w:id="{k}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:spacing w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr>'
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>' + runs(' ' + notes[k], size=20) + '</w:p></w:footnote>'
      for k in sorted(notes, key=int)]
open(os.path.join(work, 'word/footnotes.xml'), 'w', encoding='utf-8').write(fhead + seps + ''.join(fx) + '</w:footnotes>')

if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(work):
        for f in files:
            pth = os.path.join(root, f); z.write(pth, os.path.relpath(pth, work))
shutil.rmtree(work)
json.dump([t for _, t in titulos], open(out + '.titulos.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', out, '| notas', len(notes), f'(P1 {n1}, P2 {len(no2)}) | títulos', len(titulos))
