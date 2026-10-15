import { describe, it, expect } from 'vitest';
import { findQuoteInPageText } from '../findQuoteInPageText';

describe('findQuoteInPageText', () => {
    it('devuelve el rango exacto de la frase en el texto original', () => {
        const page = 'Antes de la cita. God gives his wisdom to men freely. Después.';

        const match = findQuoteInPageText('God gives his wisdom to men freely.', page);

        expect(match).not.toBeNull();
        expect(page.slice(match!.start, match!.end)).toBe('God gives his wisdom to men freely.');
    });

    it('encuentra una palabra que el PDF partió con guion', () => {
        // La forma real del texto extraído: el renglón corta la palabra y
        // quien la lee transcribe la palabra entera.
        const page = 'Aquí el uso queda comple-\ntamente dentro del marco social.';

        const match = findQuoteInPageText('queda completamente dentro del marco', page);

        expect(match).not.toBeNull();
        // El rango cubre el guion y el salto, que son del PDF y no de la frase.
        expect(page.slice(match!.start, match!.end)).toContain('comple-\ntamente');
    });

    it('tolera comillas curvas y espaciado irregular', () => {
        const page = 'Adamson lo llama  ‘unmixed  joy’ en su comentario.';

        const match = findQuoteInPageText("lo llama 'unmixed joy'", page);

        expect(match).not.toBeNull();
    });

    it('resalta el hebreo y el griego escritos sin vocales ni acentos (2026-10-15)', () => {
        const hebreo = 'גַּ֘ם כִּֽי־אֵלֵ֨ךְ בְּגֵ֪יא צַלְמָ֡וֶת';
        const h = findQuoteInPageText('גיא', hebreo);
        expect(h && hebreo.slice(h.start, h.end)).toBe('גֵ֪יא');
        const griego = 'sounded by the Adjunct πρὸ πάντων which appears';
        const g = findQuoteInPageText('προ παντων', griego);
        expect(g && griego.slice(g.start, g.end)).toBe('πρὸ πάντων');
    });

    it('no encuentra una frase reescrita', () => {
        const page = 'Puesto que el grupo denota un servicio restrictivo, es el término apropiado.';

        // Una palabra cambiada: "restrictivo" → "degradante".
        expect(findQuoteInPageText('el grupo denota un servicio degradante', page)).toBeNull();
    });

    it('devuelve null cuando el OCR de la página es ilegible', () => {
        // Página real de Mayor tal como llega del OCR. Es la mitad de la
        // biblioteca, y contra esto no hay coincidencia posible: la
        // respuesta correcta es abrir la página y decirlo.
        const page = 'τ πνμ μν υ › s ωσ › 7 κ ατοι βλασφημουσιν τ καλν νομα τ › 25';

        expect(findQuoteInPageText('el espíritu que habita en nosotros', page)).toBeNull();
    });

    it('encuentra griego con acentos y espíritus', () => {
        const page = 'La frase πᾶσαν χαρὰν ἡγήσασθε abre el cuerpo de la carta.';

        const match = findQuoteInPageText('πᾶσαν χαρὰν ἡγήσασθε', page);

        expect(match).not.toBeNull();
        expect(page.slice(match!.start, match!.end)).toBe('πᾶσαν χαρὰν ἡγήσασθε');
    });

    it('encuentra la primera aparición cuando la frase se repite', () => {
        const page = 'siervo de Dios. Más adelante: siervo de Dios otra vez.';

        const match = findQuoteInPageText('siervo de Dios', page);

        expect(match!.start).toBe(0);
    });

    it('devuelve null con entradas vacías', () => {
        expect(findQuoteInPageText('', 'texto')).toBeNull();
        expect(findQuoteInPageText('   ', 'texto')).toBeNull();
        expect(findQuoteInPageText('cita', '')).toBeNull();
    });
});
