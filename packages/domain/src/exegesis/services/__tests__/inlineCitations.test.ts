import { describe, expect, it } from 'vitest';
import { findInlineCitations, resolvesToCitedSource } from '../inlineCitations';

describe('findInlineCitations — las tres formas que el sistema emite', () => {
    it('lee la forma con título entera, no como un (Autor, N) recortado adentro', () => {
        const [cita, ...resto] = findInlineCitations('El genitivo (Mayor, "The Epistle of St. James", p. 77).');
        expect(resto).toHaveLength(0);
        expect(cita!.author).toBe('Mayor');
        expect(cita!.title).toBe('The Epistle of St. James');
        expect(cita!.pages).toBe('77');
    });

    it('lee la forma sin título y la del autor fuera del paréntesis', () => {
        expect(findInlineCitations('(Mayor, 77)')[0]!.author).toBe('Mayor');
        expect(findInlineCitations('Así Kistemaker (p. 259).')[0]!.author).toBe('Kistemaker');
    });

    it('«hoja N» se reconoce igual que «p. N»', () => {
        // Es lo que el sistema escribe cuando la página impresa se desconoce.
        expect(findInlineCitations('(Wallace, hoja 87)')[0]!.pages).toBe('87');
    });

    it('una cita compuesta cuenta como dos', () => {
        const citas = findInlineCitations('(Mayor, "A", 330; Adamson, "B", 75)');
        expect(citas.map(c => c.author).sort()).toEqual(['Adamson', 'Mayor']);
    });
});

describe('la cuarta forma — título sin comillas — necesita el corpus', () => {
    const CITA = '(Craigie, Word Biblical Commentary Vol_ 19, Psalms 1-50, 206)';
    const IMPRENTA = '(Waco, TX: Word Books, 1983)';

    it('sin claves de cita no se reconoce, porque sin corpus no se PUEDE', () => {
        // Su estructura es idéntica a la de un pie de imprenta: tres campos
        // separados por comas y el último numérico.
        expect(findInlineCitations(CITA)).toHaveLength(0);
    });

    it('con las claves del trabajo sí, y trae autor y página', () => {
        const [c] = findInlineCitations(CITA, ['Craigie']);
        expect(c!.author).toBe('Craigie');
        expect(c!.pages).toBe('206');
    });

    it('el pie de imprenta no pasa ni con las claves puestas', () => {
        expect(findInlineCitations(IMPRENTA, ['Craigie'])).toHaveLength(0);
        expect(findInlineCitations(IMPRENTA, ['Waco'])).toHaveLength(1);
    });

    it('el título admite los paréntesis que lleva de verdad', () => {
        const [c] = findInlineCitations('(Ross, A Commentary on the Psalms 1-41 (Kregel Exegetical Library), 560)', ['Ross']);
        expect(c!.author).toBe('Ross');
        expect(c!.pages).toBe('560');
    });

    it('pasar claves no cambia lo que las otras tres formas ya veían', () => {
        const texto = 'El genitivo (Mayor, "The Epistle of St. James", p. 77) y Kistemaker (p. 259).';
        expect(findInlineCitations(texto).map(c => c.author).sort())
            .toEqual(findInlineCitations(texto, ['Mayor', 'Kistemaker']).map(c => c.author).sort());
    });
});

describe('resolvesToCitedSource — el corpus separa la cita del pie de imprenta', () => {
    const FUENTES = ['Mayor', 'Adamson', 'Wallace', 'Nestle-Aland', null];

    it('resuelve el apellido declarado, sin importar tildes ni mayúsculas', () => {
        expect(resolvesToCitedSource('Mayor', FUENTES)).toBe(true);
        expect(resolvesToCitedSource('  mayor ', FUENTES)).toBe(true);
    });

    it('admite la clave como palabra del autor citado', () => {
        expect(resolvesToCitedSource('Nestle-Aland', FUENTES)).toBe(true);
        expect(resolvesToCitedSource('Daniel Wallace', FUENTES)).toBe(true);
    });

    it('un pie de imprenta no resuelve, que es todo el punto', () => {
        // Por su FORMA es idéntico a una cita sin título. Por el corpus, no.
        expect(resolvesToCitedSource('Nashville: Broadman & Holman', FUENTES)).toBe(false);
        expect(resolvesToCitedSource('Grand Rapids: Eerdmans', FUENTES)).toBe(false);
    });

    it('una referencia bíblica tampoco', () => {
        expect(resolvesToCitedSource('Génesis 19:25', FUENTES)).toBe(false);
        expect(resolvesToCitedSource('vv. 5', FUENTES)).toBe(false);
    });

    it('la clave tiene que ser una palabra entera, no un trozo del apellido', () => {
        // Sin esto «Santiago» resolvería a la fuente «Santi» y el libro de la
        // Biblia se convertiría en una nota al pie.
        expect(resolvesToCitedSource('Santiago', ['Santi'])).toBe(false);
        expect(resolvesToCitedSource('Mayordomo', FUENTES)).toBe(false);
    });

    it('sin fuentes declaradas no resuelve nada', () => {
        expect(resolvesToCitedSource('Mayor', [])).toBe(false);
        expect(resolvesToCitedSource('Mayor', [null, undefined, '  '])).toBe(false);
        expect(resolvesToCitedSource('', FUENTES)).toBe(false);
    });
});
