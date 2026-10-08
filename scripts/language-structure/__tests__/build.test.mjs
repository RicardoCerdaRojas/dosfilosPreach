import { describe, it, expect } from 'vitest';
import { clausulasDelCapitulo, leerLowfat, leerOshb, sinAparato, sinMarcas } from '../build.mjs';

/** Revisión adversarial de G0 (2026-10-07): cada caso fue un defecto medido sobre el corpus. */
describe('lectura de OSHB', () => {
    it('REGRESIÓN: una palabra con letra grande (<seg>) no se pierde — el Shemá, Dt 6:4', () => {
        const xml = '<verse osisID="Deut.6.4"><w lemma="8085" morph="HVqv2ms">שְׁמַ֖<seg type="x-large">ע</seg></w> <w lemma="3478" morph="HNp">יִשְׂרָאֵ֑ל</w></verse>';
        const ws = leerOshb(xml).get('6:4');
        expect(ws.map(w => w.text)).toEqual(['שְׁמַ֖ע', 'יִשְׂרָאֵ֑ל']);
    });
});

describe('texto griego', () => {
    it('REGRESIÓN: las marcas del aparato de SBLGNT no cuentan como diferencia (1 Co 12:10)', () => {
        expect(sinAparato('⸀1ἄλλῳ')).toBe('ἄλλῳ');
        expect(sinMarcas('⸀1ἄλλῳ')).toBe(sinMarcas('ἄλλῳ'));
        expect(sinAparato('⸂ἐπὶ τὴν⸃,')).toBe('ἐπὶ τὴν,');
    });
});

describe('cláusulas del capítulo', () => {
    const xml = `
      <wg class="cl" rule="ClCl">
        <wg class="cl" rule="S-V-O">
          <w xml:id="a1" ref="X 1:1!2" role="v">b</w>
          <w xml:id="a2" ref="X 1:1!1" role="s">a</w>
          <wg class="np" role="o" rule="NP-CL">
            <wg class="cl" rule="V"><w xml:id="a3" ref="X 1:1!3" role="v">c</w></wg>
          </wg>
          <wg role="adv" class="pp"><wg class="cl" rule="sub-CL" role="err__x"><w xml:id="a4" ref="X 1:1!4">d</w></wg></wg>
        </wg>
      </wg>`;
    const { clausulas, palabras } = leerLowfat(xml);
    const orden = new Map(['1!1', '1!2', '1!3', '1!4'].map((r, i) => [r, i]));
    const cls = clausulasDelCapitulo(clausulas, palabras, 1, orden);

    it('REGRESIÓN: se conserva la coordinación sin palabras propias, y sus hijas la tienen de padre', () => {
        expect(cls[0]).toMatchObject({ rule: 'ClCl', p: null, w: [] });
        expect(cls[1]).toMatchObject({ rule: 'S-V-O', p: 0 });
    });

    it('REGRESIÓN: las palabras de una cláusula van en el orden del texto, no del árbol', () => {
        expect(cls[1].w).toEqual(['1!1', '1!2']);
    });

    it('REGRESIÓN: una relativa dentro de una frase nominal no hereda su rol; los roles de error se descartan', () => {
        expect(cls.find(c => c.rule === 'V').role).toBe('');
        expect(cls.find(c => c.rule === 'sub-CL').role).toBe('adv');
    });
});
