"""Arma un trabajo académico TMS completo desde UN Markdown: portada, CONTENIDO, cuerpo, apéndices y bibliografía.

Uso: python3 -I armar_trabajo.py <plantilla_dir> <trabajo.md> <salida.docx> <portada.json> [paginas.json]

- trabajo.md: secciones '# ' (nivel uno; entran al CONTENIDO como TOC1), '## ' (nivel dos; TOC2),
  párrafos, '> ' citas en bloque, tablas '|', listas, notas [^n] con sus definiciones después de '\\n---\\n'.
  '# APÉNDICE…' y '# BIBLIOGRAFÍA' empiezan página nueva; los párrafos bajo BIBLIOGRAFÍA llevan sangría
  francesa a espacio simple.
- portada.json: lista de pares [texto_en_plantilla, texto_nuevo]; cada texto debe aparecer una sola vez.
- paginas.json: números de página del CONTENIDO, en el orden de los títulos (segunda pasada:
  exportar a PDF y ubicarlos con paginas_contenido.py).
Generaliza armar_entrega.py (TI #3). Reutiliza runs(), items() y table() de md2docx_tms.py.
"""
import os, re, sys, json, shutil, zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'md2docx_tms.py'), encoding='utf-8').read()
ns = {'re': re, 'escape': escape}
exec(src[src.index('HEB = '):src.index('paras = []')], ns)
runs, items, table = ns['runs'], ns['items'], ns['table']

tpl, mdp, out, portada_json = sys.argv[1:5]
TP = os.environ.get('TP') == '1'  # trabajo práctico: sin CONTENIDO; cuerpo simple + línea entre párrafos
PSIMPLE = '<w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/></w:pPr>' if TP else ''
paginas = json.load(open(sys.argv[5])) if len(sys.argv) > 5 else None
md = open(mdp, encoding='utf-8').read()

notes = {m.group(1): m.group(2).strip() for m in re.finditer(r'^\[\^(\d+)\]:\s*(.+)$', md, flags=re.M)}
body = re.sub(r'^\[\^(\d+)\]:.*$', '', md, flags=re.M).split('\n---\n')[0]

B = lambda x: x.replace('<w:rPr>', '<w:rPr><w:b/><w:bCs/>')
paras, titulos, en_biblio, primera = [], [], False, True
for block in re.split(r'\n\s*\n', body.strip()):
    lines = [l for l in block.split('\n') if l.strip()]
    if not lines:
        continue
    l0 = lines[0]
    if l0.startswith('# '):
        t = l0[2:].strip()
        en_biblio = t.startswith('BIBLIOGRAFÍA')
        brk = '<w:pageBreakBefore/>' if (t.startswith(('APÉNDICE', 'BIBLIOGRAFÍA')) and not primera) else ''
        paras.append(f'<w:p><w:pPr><w:pStyle w:val="Heading1"/>{brk}<w:jc w:val="center"/></w:pPr>' + (runs(t) if t.startswith(('APÉNDICE', 'BIBLIOGRAFÍA')) else B(runs(t))) + '</w:p>')
        titulos.append((1, t)); primera = False
    elif l0.startswith('## '):
        t = l0[3:].strip()
        paras.append('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:jc w:val="center"/></w:pPr>' + runs(t) + '</w:p>')
        titulos.append((2, t))
    elif l0.lstrip().startswith('|'):
        paras.append(table(lines))
    elif l0.startswith('>'):
        for i, l in enumerate(lines):
            after = '240' if i == len(lines) - 1 else '0'
            paras.append(f'<w:p><w:pPr><w:spacing w:after="{after}" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:right="720" w:firstLine="0"/></w:pPr>' + runs(l.lstrip('>').strip()) + '</w:p>')
    elif en_biblio:
        paras.append('<w:p><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/></w:pPr>' + runs(' '.join(x.strip() for x in lines)) + '</w:p>')
    else:
        paras.extend('<w:p>' + PSIMPLE + runs(t) + '</w:p>' for t in items(lines))

work = out + '.dir'
shutil.rmtree(work, ignore_errors=True)
shutil.copytree(tpl, work)
doc = open(os.path.join(work, 'word/document.xml'), encoding='utf-8').read()
head = doc[:doc.index('<w:body>') + len('<w:body>')]
ps = re.findall(r'<w:p[ >].*?</w:p>', doc, flags=re.S)
txt = lambda p: ''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p))

i_sec1 = next(i for i, p in enumerate(ps) if '<w:sectPr' in p)
portada = ''.join(ps[:i_sec1 + 1])
for a, b in json.load(open(portada_json, encoding='utf-8')):
    assert portada.count(escape(a)) == 1, f'portada: no encontré una sola vez «{a}»'
    portada = portada.replace(escape(a), escape(b))

i_cont = next(i for i, p in enumerate(ps) if txt(p).strip() == 'CONTENIDO')
i_sec2 = next(i for i, p in enumerate(ps) if i > i_sec1 and '<w:sectPr' in p)
sec2 = re.search(r'<w:sectPr.*?</w:sectPr>', ps[i_sec2], flags=re.S).group(0)
toc = [ps[i_cont]]
for k, (lvl, t) in enumerate(titulos):
    num = str(paginas[k]) if paginas else '0'
    toc.append(f'<w:p><w:pPr><w:pStyle w:val="{"TOC1" if lvl == 1 else "TOC2"}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs>{'<w:spacing w:line="360" w:lineRule="auto"/>' if lvl == 2 else ''}</w:pPr>'
               + runs(t) + f'<w:r><w:tab/></w:r><w:r><w:t>{num}</w:t></w:r></w:p>')
toc.append(f'<w:p><w:pPr>{sec2}</w:pPr></w:p>')

sect_final = re.findall(r'<w:sectPr.*?</w:sectPr>', doc, flags=re.S)[-1]
open(os.path.join(work, 'word/document.xml'), 'w', encoding='utf-8').write(
    head + portada + ('' if TP else ''.join(toc)) + ''.join(paras) + sect_final + '</w:body></w:document>')

fn = open(os.path.join(work, 'word/footnotes.xml'), encoding='utf-8').read()
fhead = fn[:fn.index('<w:footnote ')]
seps = ''.join(re.findall(r'<w:footnote w:type="(?:separator|continuationSeparator)".*?</w:footnote>', fn, flags=re.S))
used = re.findall(r'\[\^(\d+)\]', body)
faltan = [k for k in used if k not in notes]
assert not faltan, f'llamadas sin nota: {faltan}'
fx = [f'<w:footnote w:id="{k}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:spacing w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr>'
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>' + runs(' ' + notes[k], size=20) + '</w:p></w:footnote>'
      for k in sorted(set(used), key=int)]
open(os.path.join(work, 'word/footnotes.xml'), 'w', encoding='utf-8').write(fhead + seps + ''.join(fx) + '</w:footnotes>')

if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(work):
        for f in files:
            pth = os.path.join(root, f); z.write(pth, os.path.relpath(pth, work))
shutil.rmtree(work)
json.dump([t for _, t in titulos], open(out + '.titulos.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', out, '| notas', len(set(used)), '| títulos', len(titulos))
