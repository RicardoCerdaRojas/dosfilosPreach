import { describe, expect, it } from 'vitest';
import { checkLength, countProseWords, estimateLength, sectionBudgets, wordsPerPage } from '../paperLength';
import { DEFAULT_PAPER_FORMATTING, type PaperFormatting } from '../../entities/PaperRubric';

describe('countProseWords', () => {
    it('cuenta palabras, no espacios ni puntuación', () => {
        expect(countProseWords('El pastor restaura mi alma.')).toBe(5);
        expect(countProseWords('  —  ¿Y?  ')).toBe(1);
        expect(countProseWords('')).toBe(0);
    });

    it('una palabra con guion o apóstrofo es una sola', () => {
        expect(countProseWords("Waltke-O'Connor")).toBe(1);
    });
});

describe('estimateLength', () => {
    it('las marcas de markdown no se imprimen y no cuentan', () => {
        const limpio = estimateLength('El **pastor** restaura mi *alma*');
        expect(limpio.words).toBe(5);
    });

    it('una cita entre paréntesis cuenta como nota al pie, no como cuerpo', () => {
        const e = estimateLength('La raíz aparece dos veces (Waltke-O\'Connor, "Syntax", p. 436).');
        expect(e.words).toBe(5);
        expect(e.footnoteWords).toBeGreaterThan(0);
    });

    it('250 palabras de cuerpo son una página del formato del seminario', () => {
        const texto = Array.from({ length: 250 }, () => 'palabra').join(' ');
        expect(estimateLength(texto).estimatedPages).toBe(1);
    });

    it('las notas ocupan la mitad de espacio: van a 10 pt y espacio simple', () => {
        const cuerpo = Array.from({ length: 250 }, () => 'palabra').join(' ');
        // 125 citas ≈ 500 palabras de nota: una página del cuerpo, media de notas.
        const notas = Array.from({ length: 125 }, () => '(Ross, "Psalms", p. 561)').join(' ');
        const e = estimateLength(`${cuerpo} ${notas}`);
        expect(e.footnoteWords).toBe(500);
        expect(e.estimatedPages).toBe(2);
        expect(e.words).toBe(250);
    });
});

describe('checkLength', () => {
    const doceQuinceHojas = { unit: 'pages' as const, min: 12, max: 15 };

    it('el trabajo de ~930 palabras que debía tener doce páginas sale corto y dice cuánto falta', () => {
        const texto = Array.from({ length: 930 }, () => 'palabra').join(' ');
        const c = checkLength(texto, doceQuinceHojas);
        expect(c.verdict).toBe('short');
        expect(c.estimatedPages).toBe(3.5);
        expect(c.missing).toBe(8.5);
    });

    it('dentro del rango, sin peros', () => {
        const texto = Array.from({ length: 3200 }, () => 'palabra').join(' ');
        const c = checkLength(texto, doceQuinceHojas);
        expect(c.verdict).toBe('ok');
        expect(c.missing).toBe(0);
    });

    it('pasarse también se avisa: un máximo es un máximo', () => {
        const texto = Array.from({ length: 4500 }, () => 'palabra').join(' ');
        expect(checkLength(texto, doceQuinceHojas).verdict).toBe('long');
    });

    it('en palabras se compara en palabras, que es exacto', () => {
        const texto = Array.from({ length: 1500 }, () => 'palabra').join(' ');
        const c = checkLength(texto, { unit: 'words', min: 2000, max: null });
        expect(c.verdict).toBe('short');
        expect(c.missing).toBe(500);
    });

    it('sin extensión declarada no se inventa una', () => {
        expect(checkLength('texto corto', null).verdict).toBe('unknown');
        expect(checkLength('texto corto', { unit: 'pages', min: null, max: null }).verdict).toBe('unknown');
    });
});

const CON_MARCO = { introduction: true, conclusion: true };

describe('sectionBudgets — el reparto por versículo', () => {
    it('doce páginas entre tres versos, dejando su parte a introducción y conclusión', () => {
        // 12 × 250 = 3.000 palabras; 80 % para los versos = 2.400; /3 = 800.
        expect(sectionBudgets({ unit: 'pages', min: 12, max: 15 }, { verses: 3, ...CON_MARCO }).perVerse).toBe(800);
    });

    it('en palabras se reparte igual', () => {
        expect(sectionBudgets({ unit: 'words', min: 3000, max: null }, { verses: 3, ...CON_MARCO }).perVerse).toBe(800);
    });

    it('redondea a cincuenta: más precisión de la que la cuenta sostiene es falsa', () => {
        expect(sectionBudgets({ unit: 'pages', min: 10, max: null }, { verses: 3, ...CON_MARCO }).perVerse! % 50).toBe(0);
    });

    it('sin extensión declarada o sin versos, no se propone nada', () => {
        expect(sectionBudgets(null, { verses: 3, ...CON_MARCO }).perVerse).toBeNull();
        expect(sectionBudgets({ unit: 'pages', min: 12, max: null }, { verses: 0, ...CON_MARCO }).perVerse).toBeNull();
        expect(sectionBudgets({ unit: 'pages', min: null, max: null }, { verses: 3, ...CON_MARCO }).perVerse).toBeNull();
    });
});

describe('wordsPerPage — la página rinde según el interlineado', () => {
    const formato = (over: Partial<PaperFormatting>): PaperFormatting =>
        ({ ...DEFAULT_PAPER_FORMATTING, ...over });

    it('la maquetación de la casa sigue dando las 250 de siempre', () => {
        // Doble espacio, sin línea entre párrafos: es el número que estaba
        // cableado, y este caso es el que garantiza que nada cambió para los
        // trabajos que no declaran formato.
        expect(wordsPerPage(null)).toBe(250);
        expect(wordsPerPage(DEFAULT_PAPER_FORMATTING)).toBe(250);
    });

    it('los tres interlineados salen de un solo número, no de tres cuentas sueltas', () => {
        // El invariante que hay que preservar es la RELACIÓN: un renglón a
        // doble espacio ocupa exactamente dos renglones simples. Tres
        // constantes escritas a mano la pierden en cuanto alguien toca una.
        const simple = wordsPerPage(formato({ lineSpacing: 'single' }));
        for (const [spacing, alto] of [['double', 2], ['one-and-a-half', 1.5]] as const) {
            const rinde = wordsPerPage(formato({ lineSpacing: spacing }));
            // La tolerancia es el redondeo a 25 de los dos extremos, más el
            // renglón que se pierde al truncar la división.
            expect(Math.abs(rinde - simple / alto)).toBeLessThanOrEqual(25);
        }
    });

    it('el interlineado de uno y medio queda entre los otros dos', () => {
        const medio = wordsPerPage(formato({ lineSpacing: 'one-and-a-half' }));
        expect(medio).toBeGreaterThan(wordsPerPage(formato({ lineSpacing: 'double' })));
        expect(medio).toBeLessThan(wordsPerPage(formato({ lineSpacing: 'single' })));
    });

    it('la línea entre párrafos hace rendir menos, no más', () => {
        const con = wordsPerPage(formato({ lineSpacing: 'single', blankLineBetweenParagraphs: true }));
        const sin = wordsPerPage(formato({ lineSpacing: 'single', blankLineBetweenParagraphs: false }));
        expect(con).toBeLessThan(sin);
    });
});

describe('la extensión de un trabajo a espacio simple', () => {
    // El caso medido: Santiago 2:1-13, rúbrica de 2-3 páginas, formato a
    // espacio simple con línea entre párrafos, 881 palabras de prosa. El aviso
    // decía «se pasa de 3 páginas» y el documento entregado cumplía.
    const formato: PaperFormatting = {
        lineSpacing: 'single',
        citationForm: 'parenthetical',
        blankLineBetweenParagraphs: true,
    };
    const prosa = 'palabra '.repeat(881);

    it('medido a doble espacio decía que se pasaba', () => {
        const viejo = checkLength(prosa, { unit: 'pages', min: 2, max: 3 }, null);
        expect(viejo.verdict).toBe('long');
    });

    it('medido con el formato de la entrega, cumple', () => {
        const check = checkLength(prosa, { unit: 'pages', min: 2, max: 3 }, formato);
        expect(check.verdict).toBe('ok');
    });

    it('y el presupuesto por versículo deja de pedir la mitad', () => {
        const secciones = { verses: 4, introduction: false, conclusion: false };
        const viejo = sectionBudgets({ unit: 'pages', min: 2, max: 3 }, secciones, null).perVerse!;
        const nuevo = sectionBudgets({ unit: 'pages', min: 2, max: 3 }, secciones, formato).perVerse!;
        expect(viejo).toBe(150);
        expect(nuevo).toBeGreaterThan(viejo);
    });
});
