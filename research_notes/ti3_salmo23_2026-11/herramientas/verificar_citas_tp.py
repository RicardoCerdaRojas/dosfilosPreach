"""Verifica las citas bíblicas de un TP de griego (citas entre paréntesis, sin notas).

1. Cada cadena griega del cuerpo de 3 palabras o más tiene que estar, tal cual (sin
   puntuación ni mayúsculas), en el texto de la carta según MorphGNT (SBLGNT). Las
   cadenas más cortas son formas sueltas o lemas: se comprueba que cada palabra
   exista en la carta como forma o como lema. Lo que no está (una forma citada en
   otro caso, como ὁ κάμνων, o una forma de otro libro) se lista para verificarlo a
   mano: no es necesariamente un error.
2. Cada referencia bíblica (Libro cap:vers) se imprime con la RV1960 del repo, para
   que el revisor compruebe que el versículo dice lo que el texto le atribuye.

Uso: python3 -I verificar_citas_tp.py <borrador.md> <morphgnt-carta.txt> <rvr1960.json>
Prueba de la prueba: con --mutar, cambia una letra de la primera cadena larga y
tiene que fallar (código de salida 1)."""
import sys, re, json, unicodedata

args = [a for a in sys.argv[1:] if not a.startswith('--')]
mutar = '--mutar' in sys.argv
draft = open(args[0], encoding='utf-8').read().split('# BIBLIOGRAF')[0]


def norm(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[⸀⸁⸂⸃⸄⸅⸆⸇⸉⸊⸋⸌⸍⸎⸏⸐⸑⸒⸓⸔⸕⸖⸗⸘⸙⸚⸛⸜⸝⸞⸟·;,.’\'«»()\[\]]', ' ', s)
    s = s.replace('’', ' ').replace('ʼ', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()


def sin_acento_final(w):
    # el grave de la forma en contexto equivale al agudo de la forma citada aislada
    return w.replace('ὰ', 'ά').replace('ὲ', 'έ').replace('ὴ', 'ή').replace('ὶ', 'ί').replace('ὸ', 'ό').replace('ὺ', 'ύ').replace('ὼ', 'ώ')


carta_words = []
lemas = set()
for line in open(args[1], encoding='utf-8'):
    parts = line.split()
    if len(parts) >= 4:
        carta_words.append(sin_acento_final(norm(parts[3])))
        lemas.add(sin_acento_final(norm(parts[-1])))
carta_words = [w for w in carta_words if w]
carta = ' ' + ' '.join(carta_words) + ' '
vocab = set(carta_words) | lemas

greek = re.findall(r'[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿’\'\s;,·.⁷⁴𝔓]*[Ͱ-Ͽἀ-῿]', draft)
greek = [g for g in greek if not g.startswith('𝔓')]
if mutar:
    for i, g in enumerate(greek):
        if len(norm(g).split()) >= 3:
            greek[i] = g[:-1] + ('α' if g[-1] != 'α' else 'ο')
            print('MUTACIÓN aplicada a:', greek[i])
            break
ok, bad = 0, []
for g in greek:
    n = ' '.join(sin_acento_final(w) for w in norm(g).split())
    if len(n.split()) >= 3:
        good = (' ' + n + ' ') in carta
    else:
        good = all(w in vocab for w in n.split())
    if good:
        ok += 1
    else:
        bad.append(g)
print(f'griego: {ok} cadenas coinciden con la carta; {len(bad)} no')
for b in bad:
    print('  NO ESTÁ EN LA CARTA:', b)

IDS = {'Romanos': 'rm', 'Hebreos': 'hb', 'Proverbios': 'prv', 'Salmo': 'ps', 'Ezequiel': 'ez',
       'Gálatas': 'gl', '1 Tesalonicenses': '1ts', '1 Pedro': '1pe', 'Sabiduría': None}
rvr = {b['id']: b for b in json.load(open(args[2], encoding='utf-8'))}
refs = sorted(set(re.findall(r'(1 Tesalonicenses|1 Pedro|Romanos|Hebreos|Proverbios|Salmo|Ezequiel|Gálatas|Sabiduría) (\d+):(\d+)(?:–(\d+))?', draft)))
print(f'\nreferencias a otros libros: {len(refs)}')
for b, c, v1, v2 in refs:
    bid = IDS[b]
    if not bid:
        print(f'  {b} {c}:{v1}: deuterocanónico, no está en la RV1960; verificar a mano')
        continue
    vs = rvr[bid]['chapters'][int(c) - 1][int(v1) - 1:int(v2 or v1)]
    print(f'  {b} {c}:{v1}{"–" + v2 if v2 else ""}: ' + ' '.join(re.sub(r'\s*/n\s*', ' ', x).strip() for x in vs))
own = sorted(set(re.findall(r'(?<![\w:])([1-5]):(\d+)(?:–(\d+))?(?:[a-c])?', draft)), key=lambda x: (int(x[0]), int(x[1])))
print(f'\nreferencias a la misma carta: {", ".join(a + ":" + b + ("–" + c if c else "") for a, b, c in own)}')
sys.exit(1 if bad else 0)
