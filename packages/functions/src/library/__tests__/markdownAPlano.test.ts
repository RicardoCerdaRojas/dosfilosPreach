import { describe, expect, it } from 'vitest';
import { markdownAPlano } from '../markdownAPlano';

describe('markdownAPlano', () => {
    it('quita encabezados, viñetas y énfasis', () => {
        expect(markdownAPlano('## La oración bimembre\n\n- **Prótasis**: *wayyiqtol*')).toBe(
            'La oración bimembre\n\nPrótasis: wayyiqtol',
        );
    });

    it('aplana una tabla sin perder una celda', () => {
        const md = '| P | כִּי־יַכְרִית יְהוָה | Cuando Yahveh |\n|---|---|---|\n| A | הִשָּׁמֶר לְךָ | guárdate |';
        expect(markdownAPlano(md)).toBe('P  כִּי־יַכְרִית יְהוָה  Cuando Yahveh\nA  הִשָּׁמֶר לְךָ  guárdate');
    });

    it('no toca un solo carácter del griego ni del hebreo', () => {
        const texto = 'Ἰάκωβος θεοῦ καὶ κυρίου — רֹ֝עִ֗י לֹ֣א אֶחְסָֽר׃ ᵃ';
        expect(markdownAPlano(texto)).toBe(texto);
    });

    it('deja el asterisco suelto del autor', () => {
        // Un lema reconstruido o una llamada a nota no es énfasis.
        expect(markdownAPlano('la raíz *qtl, reconstruida')).toBe('la raíz *qtl, reconstruida');
    });
});
