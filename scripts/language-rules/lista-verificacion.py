"""
Genera docs/CITAS_REGLAS_IDIOMA.md: cada fuente del registro, dónde se usa,
y su estado. Es la lista para que una persona revise lo que el cotejo
automático no puede: que la categoría del libro sea la de la regla.

    (cd packages/domain && npx vite-node scripts/listar-fuentes.mts > /tmp/fuentes.json)
    python3 scripts/language-rules/lista-verificacion.py /tmp/fuentes.json > docs/CITAS_REGLAS_IDIOMA.md
"""
import json, sys
F = json.load(open(sys.argv[1]))
TABLA = {
    'VERB_RULE_SOURCES': 'Regla de verbo', 'VERB_FUNCTION_SOURCES': 'Función del verbo',
    'TENSE_USE_SOURCES': 'Uso del tiempo', 'DISCOURSE_RULE_SOURCES': 'Conector o partícula',
    'NOMINAL_RULE_SOURCES': 'Regla nominal', 'STRUCTURE_RULE_SOURCES': 'Estructura',
    'HEBREW_INFINITIVE_SOURCES': 'Infinitivo hebreo', 'HEBREW_PARTICIPLE_SOURCES': 'Participio hebreo',
}
TIEMPO = {'P': 'presente', 'I': 'imperfecto', 'A': 'aoristo', 'F': 'futuro', 'X': 'perfecto', 'Y': 'pluscuamperfecto'}
def uso(u):
    t, *resto = u.split('.')
    if t == 'TENSE_USE_SOURCES': return f'{TABLA[t]}: {TIEMPO[resto[0]]} · `{resto[1]}`'
    return f'{TABLA[t]}: `{".".join(resto)}`'
OBRA = {'wallace': 'Wallace (1996)', 'arnoldChoi': 'Arnold y Choi (2003)', 'runge': 'Runge (2010)'}
print('# Citas de las reglas de idioma — lista de verificación\n')
print('Generado con `scripts/language-rules/lista-verificacion.py` (R0, `docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md`). No editar a mano.\n')
print('**Cómo leerla:**')
print('- **Verificada** = el encabezado impreso está en esa página del ejemplar. Lo comprueba `scripts/language-rules/cotejar-citas.py`.')
print('- **Sin verificar** = no hay ejemplar en la biblioteca. La app muestra sólo la obra y el tema.')
print('- **Falta revisar a mano:** que la categoría del libro sea la que la regla aplica. Marca ✓ o anota la corrección en la última columna.\n')
for obra in ('wallace', 'arnoldChoi', 'runge'):
    filas = [f for f in F if f['work'] == obra]
    ver = sum(1 for f in filas if f.get('verified'))
    print(f'## {OBRA[obra]} — {ver} de {len(filas)} verificadas\n')
    print('| Dónde se usa | Tema | Sección impresa | Página | ¿Corresponde? |')
    print('| --- | --- | --- | --- | --- |')
    for f in sorted(filas, key=lambda f: int(f['verified']['page']) if f.get('verified') else 9999):
        pag = f['verified']['page'] if f.get('verified') else 'sin verificar'
        print(f"| {'<br>'.join(uso(u) for u in f['usos'])} | {f['topic']} | {f['section']} | {pag} | |")
    print()
