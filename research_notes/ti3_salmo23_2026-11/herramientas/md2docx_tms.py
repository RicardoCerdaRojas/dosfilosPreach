"""Convierte el borrador Markdown del TI #3 en un .docx con los estilos del TI #2 entregado.

Uso: python3 -I md2docx_tms.py <plantilla_unzip_dir> <borrador.md> <salida.docx>

Soporta: '# ' título centrado, '## ' Heading2, párrafos, '> ' bloque (cita sangrada,
interlineado simple), *cursiva*, notas [^n] con su definición '[^n]: texto', hebreo en
runs RTL, SEÑOR en versalitas. Lo demás se ignora. Solo sirve para medir y para la
etapa 6; el formato final lo revisa el fundador en Word.
"""
import os, re, shutil, sys, zipfile
from xml.sax.saxutils import escape

tpl, src, out = sys.argv[1:4]
md = open(src, encoding='utf-8').read()

# separar notas
notes = {}
for m in re.finditer(r'^\[\^(\d+)\]:\s*(.+)$', md, flags=re.M):
    notes[m.group(1)] = m.group(2).strip()
body = re.sub(r'^\[\^(\d+)\]:.*$', '', md, flags=re.M)
body = body.split('\n---\n')[0]

HEB = re.compile(r'([֐-׿][֐-׿־\s־]*[֐-׿])|([֐-׿])')

def runs(text, size=None, base_italic=False):
    """Texto con *cursiva*, [^n] y hebreo -> runs XML."""
    xml = []
    text = text.replace('\\*', '⁣AST⁣')  # «\*» = asterisco literal (p. ej., ℵ\*)
    parts = re.split(r'(\[\^\d+\]|\*\*[^*]+\*\*|\*[^*]+\*)', text)
    for p in parts:
        if not p:
            continue
        fm = re.fullmatch(r'\[\^(\d+)\]', p)
        if fm:
            xml.append(f'<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="{fm.group(1)}"/></w:r>')
            continue
        ital = base_italic; bold = False
        if p.startswith('**') and p.endswith('**') and len(p) > 4:
            p = p[2:-2]; bold = True
        elif p.startswith('*') and p.endswith('*') and len(p) > 2:
            p = p[1:-1]; ital = True
        # SEÑOR -> Señor en versalitas
        for chunk in re.split(r'(SEÑOR)', p):
            if not chunk:
                continue
            sc = chunk == 'SEÑOR'
            if sc:
                chunk = 'Señor'
            pos = 0
            for hm in HEB.finditer(chunk):
                if hm.start() > pos:
                    xml.append(_run(chunk[pos:hm.start()], ital, sc, size, False, bold))
                xml.append(_run(hm.group(0), False, False, size, True, bold))
                pos = hm.end()
            if pos < len(chunk):
                xml.append(_run(chunk[pos:], ital, sc, size, False, bold))
    return ''.join(xml)

def table(lines, size=20):
    """Tabla Markdown (líneas que empiezan con '|') -> w:tbl con bordes simples, interlineado simple."""
    rows = [l.strip().strip('|').split('|') for l in lines if not re.fullmatch(r'\|?[\s:|-]+\|?', l.strip())]
    b = '<w:tblBorders>' + ''.join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>' for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) + '</w:tblBorders>'
    out = [f'<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>{b}</w:tblPr>']
    for i, r in enumerate(rows):
        out.append('<w:tr>')
        for c in r:
            txt = c.strip()
            if i == 0:
                txt = f'**{txt}**' if txt else txt
            out.append('<w:tc><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr>'
                       + runs(txt, size=size) + '</w:p></w:tc>')
        out.append('</w:tr>')
    out.append('</w:tbl><w:p/>')
    return ''.join(out)

ITEM = re.compile(r'^(?:- |\d+\. )')

def items(lines):
    """Un bloque de párrafo -> lista de textos. Cada línea que empieza con '- ' o 'N. '
    abre un párrafo propio (lista); las demás líneas continúan el párrafo en curso."""
    out = []
    for l in lines:
        if ITEM.match(l.strip()) or not out:
            out.append(l.strip())
        else:
            out[-1] += ' ' + l.strip()
    return out

def _run(t, ital, sc, size, rtl, bold=False):
    rpr = ''
    if bold:
        rpr += '<w:b/><w:bCs/>'
    if rtl:
        rpr += '<w:rFonts w:cs="SBL Hebrew"/><w:rtl/>'
    if ital:
        rpr += '<w:i/><w:iCs/>'
    if sc:
        rpr += '<w:smallCaps/>'
    if size:
        rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    else:
        rpr += '<w:szCs w:val="24"/>'
    rpr += '<w:lang w:val="es-ES" w:bidi="he-IL"/>'
    t = t.replace('⁣AST⁣', '*')
    return f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{escape(t)}</w:t></w:r>'

paras = []
for block in re.split(r'\n\s*\n', body.strip()):
    lines = [l for l in block.split('\n') if l.strip()]
    if not lines:
        continue
    if lines[0].startswith('# '):
        brk = '<w:pageBreakBefore/>' if lines[0][2:].startswith(('APÉNDICE', 'BIBLIOGRAFÍA')) else ''
        # Guía TMS: nivel uno centrado y en negrita
        paras.append(f'<w:p><w:pPr><w:pStyle w:val="Heading1"/>{brk}<w:jc w:val="center"/></w:pPr>' + runs(lines[0][2:]).replace('<w:rPr>', '<w:rPr><w:b/><w:bCs/>') + '</w:p>')
    elif lines[0].startswith('## '):
        # Títulos en negrita: marca «Negrita» del profesor en el TI #2 y Guía TMS (nivel uno centrado y en negrita)
        # Guía TMS (R17 del TI #3): nivel dos centrado, sin negrita. NIVEL2_NEGRITA=1 restaura la negrita (TI #3).
        neg = os.environ.get('NIVEL2_NEGRITA') == '1'
        r2 = runs(lines[0][3:])
        if neg:
            r2 = r2.replace('<w:rPr>', '<w:rPr><w:b/><w:bCs/>')
        paras.append('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:jc w:val="center"/></w:pPr>' + r2 + '</w:p>')
    elif lines[0].lstrip().startswith('|'):
        paras.append(table(lines))
    elif lines[0].startswith('>'):
        for i, l in enumerate(lines):
            t = l.lstrip('>').strip()
            after = '240' if i == len(lines) - 1 else '0'
            paras.append(f'<w:p><w:pPr><w:spacing w:after="{after}" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:right="720" w:firstLine="0"/></w:pPr>' + runs(t) + '</w:p>')
    else:
        paras.extend('<w:p>' + runs(t) + '</w:p>' for t in items(lines))

work = out + '.dir'
shutil.rmtree(work, ignore_errors=True)
shutil.copytree(tpl, work)
doc = open(os.path.join(work, 'word/document.xml'), encoding='utf-8').read()
head = doc[:doc.index('<w:body>') + len('<w:body>')]
sect = re.findall(r'<w:sectPr.*?</w:sectPr>', doc, flags=re.S)[-1]
open(os.path.join(work, 'word/document.xml'), 'w', encoding='utf-8').write(head + ''.join(paras) + sect + '</w:body></w:document>')

fn = open(os.path.join(work, 'word/footnotes.xml'), encoding='utf-8').read()
fhead = fn[:fn.index('<w:footnote ')]
seps = ''.join(re.findall(r'<w:footnote w:type="(?:separator|continuationSeparator)".*?</w:footnote>', fn, flags=re.S))
fxml = []
for k in sorted(notes, key=int):
    fxml.append(f'<w:footnote w:id="{k}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:spacing w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr>'
                '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>'
                + runs(' ' + notes[k], size=20) + '</w:p></w:footnote>')
open(os.path.join(work, 'word/footnotes.xml'), 'w', encoding='utf-8').write(fhead + seps + ''.join(fxml) + '</w:footnotes>')

if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(work):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, work))
shutil.rmtree(work)
print('ok', out, len(paras), 'párrafos', len(notes), 'notas')
