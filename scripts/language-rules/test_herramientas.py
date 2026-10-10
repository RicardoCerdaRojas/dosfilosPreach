"""
Pruebas de las herramientas de R1 con casos sintéticos (revisión de R1). No
corren en CI (que no ejecuta Python): correrlas antes de cambiar un script.

    python3 -m unittest discover -s scripts/language-rules -p 'test_*.py'
"""
import json, os, subprocess, sys, tempfile, unittest
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from libros import referencias


class Referencias(unittest.TestCase):
    def test_formas_de_las_gramaticas(self):
        self.assertEqual([r[:3] for r in referencias('x (Gen 19:22), y )1 Kgs 3:7( z', 'he')], [('Gen', 19, 22), ('1Kgs', 3, 7)])
        self.assertEqual([r[:3] for r in referencias('in Rom 7:14 and Matthew 6:24', 'gr')], [('ROM', 7, 14), ('MAT', 6, 24)])

    def test_partida_entre_lineas_y_sin_espacio(self):
        self.assertEqual([r[:3] for r in referencias('(1\nKgs 12:27) y (1 Sam\n26:15)', 'he')], [('1Kgs', 12, 27), ('1Sam', 26, 15)])
        self.assertEqual([r[:3] for r in referencias('cf. 1Cor 13:4', 'gr')], [('1CO', 13, 4)])

    def test_un_solo_capitulo(self):
        self.assertEqual([r[:3] for r in referencias('Jude 3 y Phlm 10', 'gr')], [('JUD', 1, 3), ('PHM', 1, 10)])

    def test_no_confunde_numeros_sueltos(self):
        self.assertEqual(referencias('Waltke and O’Connor 1990, 602; vol. 2, 3.5', 'he'), [])


class Extractor(unittest.TestCase):
    def correr(self, capa, *args, desfase=-1):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, 'capa.txt'), 'w').write('\f'.join(capa))
            json.dump({'title': 'T', 'author': 'A', 'id': 'x', 'pageNumbering': {'segments': [{'fromSheet': 1, 'toSheet': 99, 'offset': desfase}]}}, open(os.path.join(d, 'meta.json'), 'w'))
            out = subprocess.run([sys.executable, os.path.join(AQUI, 'ejemplos-del-libro.py'), d, *args], capture_output=True, text=True, check=True).stdout
            return json.loads(out)

    def test_bloques_paginas_indice_y_corte(self):
        capa = [
            '3.4.1. Infinitive Construct          67\n3.5 Verbal Sequences      84',  # índice: se ignora
            '3.4.1 Infinitive Construct\n(a) Nominal – as a noun (Prov 17:26),',
            '3.4 Nonfinites                                   2\n(b) Temporal – when (1\nKgs 3:7) y (Gen 2:17)',
            '3.5 Verbal Sequences\n(a) Otra – (Gen 1:1)',
            # Runge reinicia la numeración en cada capítulo: un «3.4.2» posterior NO es del tramo.
            '3.4.2 Otro capítulo con la misma numeración\n(a) X – (Gen 1:2)',
        ]
        r = self.correr(capa, '--desde', '3.4.1', '--hasta', '3.5')
        sec = r['secciones']
        self.assertEqual([s['seccion'] for s in sec], ['3.4.1'])
        a, b = sec[0]['subcategorias']
        self.assertEqual((a['nombre'], a['pagina'], [e['libro'] for e in a['ejemplos']]), ('Nominal', 1, ['Prov']))
        self.assertEqual((b['nombre'], [(e['libro'], e['pagina']) for e in b['ejemplos']]), ('Temporal', [('1Kgs', 2), ('Gen', 2)]))
        self.assertEqual(r['ejemplos'], 3)

    def test_titulo_ilegible(self):
        r = self.correr(['4.1.14 yqZy\n(a) S – (Gen 1:1)', '4.1.15 d¡\n(a) T – (Gen 1:2)', '4.2 Adverbs'], '--desde', '4.1.14', '--hasta', '4.2')
        self.assertEqual([(s['titulo'], s.get('tituloIlegible')) for s in r['secciones']], [(None, True), (None, True)])


if __name__ == '__main__':
    unittest.main()
