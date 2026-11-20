"""Índice de respaldo para un TP (citas entre paréntesis «(Autor, N)» y «(BDAG, s.v. «lema», acepción)»).

Uso: python3 -I indice_respaldo_tp.py <borrador.md> <carpeta 05_Respaldo_citas>

Lee las citas del cuerpo (todo lo anterior a «# BIBLIOGRAFÍA»), busca para cada una su
archivo de respaldo en la carpeta y escribe 00_INDICE.md. Convención de nombres:
  <Autor>_p<N>[_…].png|txt   (rangos con raya corta: Wallace_p617–618.txt)
  BDAG_<lema sin acentos>_pdf<N>.png   (ver LEMAS abajo)
Sale con código 1 si una cita no tiene respaldo, y avisa de los archivos que ya no
se usan. Complementa a indice_respaldo.py, que lee notas al pie."""
import sys, re, os, hashlib

AUTORES = {'McKnight': 'McKnight_p', 'McCartney': 'McCartney_p', 'Martin': 'Martin_p', 'Wallace': 'Wallace_p',
           'Metzger': 'Metzger_p', 'NA28': 'NA28_p', 'Louw y Nida': 'LouwNida_p', 'Kittel y Friedrich': 'KittelFriedrich_p',
           'Porter': 'Porter_p', 'Allison': 'Allison_p', 'Ropes': 'Ropes_p', 'Varner': 'Varner_p', 'Adamson': 'Adamson_p',
           'Mayor': 'Mayor_p', 'Moo': 'Moo_p', 'Davids': 'Davids_p'}
LEMAS = {'κάμνω': 'kamno', 'καλύπτω': 'kalypto', 'σῴζω': 'sozo', 'ἐνεργέω': 'energeo', 'ἰσχύω': 'ischyo',
         'παρουσία': 'parousia', 'κύριος': 'kyrios', 'τέλος': 'telos'}

src, R = sys.argv[1], sys.argv[2]
raw = open(src, encoding='utf-8').read()
cuerpo = raw.split('# BIBLIOGRAF')[0]
files = sorted(f for f in os.listdir(R) if not f.startswith('00_') and not f.startswith('.'))
autor_re = '|'.join(re.escape(a) for a in AUTORES)
rows, missing = [], []
for qi, sec in enumerate(re.split(r'(?m)^# ', cuerpo)[1:], 1):
    for m in re.finditer(r'\(([^()]*?)\)', sec):
        for part in m.group(1).split(';'):
            part = part.strip()
            mm = re.match(r'^BDAG, s\.v\. «(.+?)», (.+)$', part)
            if mm:
                key = LEMAS.get(mm.group(1), '?')
                f = [x for x in files if x.startswith(f'BDAG_{key}_')]
            else:
                mm = re.match(rf'^({autor_re}), ([\d–]+)$', part)
                if not mm:
                    continue
                pre, p = AUTORES[mm.group(1)], mm.group(2)
                f = [x for x in files if re.match(re.escape(pre + p) + r'[_.]', x)]
                if not f:
                    a, *b = [int(x) for x in p.split('–')]
                    f = [x for x in files if any(re.match(re.escape(pre + str(q)) + r'[_.]', x) for q in range(a, (b[0] if b else a) + 1))]
            rows.append((qi, part, f))
            if not f:
                missing.append(part)
seen, lines = set(), []
for qi, part, f in rows:
    if (qi, part) in seen:
        continue
    seen.add((qi, part))
    lines.append(f'| P{qi} | {part} | {", ".join(f) or "**FALTA**"} |')
sha = hashlib.sha256(raw.encode()).hexdigest()[:12]
hdr = f"""# Respaldo de citas

Versión del texto: `{os.path.basename(src)}` (SHA `{sha}`). Cada cita «(Autor, N)» del cuerpo remite a su respaldo:
imagen de la página (`.png`) cuando la fuente es un PDF o un EPUB de imágenes; extracto de texto (`.txt`) con su
desfase en el encabezado cuando está en la biblioteca de la plataforma.

| Pregunta | Cita | Respaldo |
|---|---|---|
"""
open(os.path.join(R, '00_INDICE.md'), 'w', encoding='utf-8').write(hdr + '\n'.join(lines) + '\n')
used = {x for _, _, f in rows for x in f}
sobran = [x for x in files if x not in used]
print(f'citas distintas por pregunta: {len(lines)}; sin respaldo: {missing or "ninguna"}; archivos sin uso: {sobran or "ninguno"}')
sys.exit(1 if missing else 0)
