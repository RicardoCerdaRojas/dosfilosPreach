import { describe, it, expect } from 'vitest';
import { clausulasDelCapitulo, leerLowfat, leerOshb, sinAparato, sinMarcas } from '../build.mjs';

/** Revisión adversarial de G0 (2026-10-07): cada caso fue un defecto medido sobre el corpus. */
describe('lectura de OSHB', () => {
    it('REGRESIÓN: una palabra con letra grande (<seg>) no se pierde — el Shemá, Dt 6:4', () => {
        const xml = '<verse osisID="Deut.6.4"><w lemma="8085" morph="HVqv2ms">שְׁמַ֖<seg type="x-large">ע</seg></w> <w lemma="3478" morph="HNp">יִשְׂרָאֵ֑ל</w></verse>';
        const ws = leerOshb(xml).get('6:4');
        expect(ws.map(w => w.text)).toEqual(['שְׁמַ֖ע', 'יִשְׂרָאֵ֑ל']);
    });
    it('ketiv con su qere, ketiv sin qere y qere sin ketiv (Rut 2:1, 3:12, 3:5; revisión del profesor, 2026-11)', () => {
        const xml = '<verse osisID="Ruth.2.1"><w lemma="c/l/5281" morph="HC/R/Np">וּ/לְ/נָעֳמִ֞י</w> <w type="x-ketiv" lemma="3045" morph="HVPsmsa">מידע</w><note type="variant"><catchWord>מידע</catchWord><rdg type="x-qere"><w lemma="4129" morph="HNcmsa">מוֹדַ֣ע</w></rdg></note> <w lemma="l/376" morph="HR/Ncmsc/Sp3fs">לְ/אִישָׁ֗/הּ</w></verse>'
            + '<verse osisID="Ruth.3.12"><w lemma="3588 a" morph="HC">כִּ֥י</w> <w type="x-ketiv" lemma="518 a" morph="HC">אם</w><note type="variant"><catchWord>אם</catchWord><rdg type="x-qere"/></note> <w lemma="1350 a" morph="HVqrmsa">גֹאֵ֖ל</w></verse>'
            + '<verse osisID="Ruth.3.5"><w lemma="559" morph="HVqi2fs">תֹּאמְרִ֥י</w> <note type="variant"><rdg type="x-qere"><w lemma="413" morph="HR/Sp1cs">אֵלַ֖/י</w></rdg></note> <w lemma="6213 a" morph="HVqi1cs">אֶֽעֱשֶֽׂה</w></verse>';
        const o = leerOshb(xml);
        const marcas = (k) => o.get(k).map(w => [w.text, w.type === 'x-ketiv' ? 'K' : '', w.qere ? 'Q' : '', w.sinQere ? 'sinQ' : ''].filter(Boolean).join(' '));
        expect(marcas('2:1')).toEqual(['וּ/לְ/נָעֳמִ֞י', 'מידע K', 'מוֹדַ֣ע Q', 'לְ/אִישָׁ֗/הּ']);
        expect(marcas('3:12')).toEqual(['כִּ֥י', 'אם K sinQ', 'גֹאֵ֖ל']);
        expect(marcas('3:5')).toEqual(['תֹּאמְרִ֥י', 'אֵלַ֖/י Q', 'אֶֽעֱשֶֽׂה']);
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

    it('REGRESIÓN (G1): las palabras de un constituyente de varias palabras llevan su rol (Stg 2:7 τὸ καλὸν ὄνομα = o)', () => {
        const x = `<wg class="cl" rule="S-V-O"><w xml:id="b1" ref="X 2:7!1" role="s">αὐτοὶ</w><w xml:id="b2" ref="X 2:7!2" role="v">βλ</w>
          <wg class="np" role="o"><w xml:id="b3" ref="X 2:7!3">τὸ</w><wg class="np"><w xml:id="b4" ref="X 2:7!4">καλὸν</w></wg></wg></wg>`;
        const { palabras } = leerLowfat(x);
        expect(palabras.map(p => p.role)).toEqual(['s', 'v', 'o', 'o']);
    });

    it('U3c (revisión del profesor, Stg 2:10): se lee el sentido de Louw-Nida (`ln`) de MACULA, también doble', () => {
        const x = `<wg class="cl"><w xml:id="c1" ref="X 2:10!9" class="prep" ln="89.5">ἐν</w><w xml:id="c2" ref="X 2:21!6" class="prep" ln="89.25 89.77">ἐξ</w><w xml:id="c3" ref="X 2:10!10">ἑνί</w></wg>`;
        const { palabras } = leerLowfat(x);
        expect(palabras.map(p => p.ln)).toEqual(['89.5', '89.25 89.77', '']);
    });
});

