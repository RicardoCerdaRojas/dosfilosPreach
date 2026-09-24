import { describe, it, expect } from 'vitest';
import { sectionBudgets } from '../paperLength';

/**
 * El presupuesto dividía entre TODOS los pasos del trabajo, no entre las
 * secciones del documento. Medido sobre Santiago 2:1–13 —cuatro preguntas,
 * cuatro versículos, trece pasos—: cada versículo recibió 50 palabras cuando
 * le tocaban 100.
 *
 * Y reservaba un quinto para introducción y conclusión aunque no fueran a
 * escribirse, dejando el documento corto sin que nadie supiera por qué.
 */
const DOS_PAGINAS = { unit: 'pages' as const, min: 2, max: 3 };

describe('sectionBudgets', () => {
    it('las partes suman el trabajo entero, dentro del redondeo', () => {
        // El invariante que ata los números entre sí. No es igualdad exacta:
        // un presupuesto se dice en decenas —«unas 150 palabras»— y redondear
        // a 50 no puede sumar al centavo. Lo que no puede pasar es que las
        // partes deriven del total, que es lo que ocurría cuando una fracción
        // se ajustaba y las otras se quedaban donde estaban.
        //
        // Media vuelta de redondeo por sección es el margen máximo posible.
        for (const sections of [
            { verses: 4, introduction: true, conclusion: true },
            { verses: 4, introduction: false, conclusion: false },
            { verses: 4, introduction: false, conclusion: true },
            { verses: 13, introduction: true, conclusion: true },
        ]) {
            const b = sectionBudgets(DOS_PAGINAS, sections);
            const partes = sections.verses
                + (sections.introduction ? 1 : 0) + (sections.conclusion ? 1 : 0);
            const suma = (b.perVerse ?? 0) * sections.verses
                + (b.introduction ?? 0) + (b.conclusion ?? 0);
            expect(Math.abs(suma - 500)).toBeLessThanOrEqual(25 * partes);
        }
    });

    it('el caso real: cuatro versículos, con marco', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: true, conclusion: true });
        expect(b.perVerse).toBe(100);
        expect(b.introduction).toBe(50);
        expect(b.conclusion).toBe(50);
    });

    it('sin marco, el cien por ciento va a los versículos', () => {
        // Un documento de sólo versículos. Reservarle extensión a una sección
        // que no va escrita deja el trabajo corto.
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: false, conclusion: false });
        // 500 ÷ 4 = 125, que redondeado a decenas de cincuenta da 150.
        expect(b.perVerse).toBe(150);
        expect(b.introduction).toBeNull();
        expect(b.conclusion).toBeNull();
        // Y es MÁS que las 100 que recibía cada uno con el marco puesto: la
        // parte de las secciones que no van vuelve a los versículos.
        expect(b.perVerse!).toBeGreaterThan(
            sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: true, conclusion: true }).perVerse!,
        );
    });

    it('con conclusión pero sin introducción, el décimo sobrante va a los versículos', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: false, conclusion: true });
        expect(b.introduction).toBeNull();
        expect(b.conclusion).toBe(50);
        // 500 × 0,9 ÷ 4 = 112,5 → 100.
        expect(b.perVerse).toBe(100);
    });

    it('sin versículos no se divide por cero', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 0, introduction: true, conclusion: true });
        expect(b.perVerse).toBeNull();
        expect(b.introduction).toBe(50);
    });

    it('sin extensión declarada no se inventa un objetivo', () => {
        const b = sectionBudgets(null, { verses: 4, introduction: true, conclusion: true });
        expect(b).toEqual({ perVerse: null, introduction: null, conclusion: null });
        expect(sectionBudgets({ unit: 'pages', min: null, max: null }, { verses: 4, introduction: true, conclusion: true }).perVerse).toBeNull();
    });

    it('un presupuesto nunca baja de 50 palabras', () => {
        // Redondear a cero deja al compositor con la instrucción de no
        // escribir nada, que es peor que no darle ninguna.
        const b = sectionBudgets({ unit: 'words', min: 100, max: null }, { verses: 1, introduction: true, conclusion: true });
        expect(b.introduction).toBe(50);
    });

    it('un trabajo largo reparte en proporción', () => {
        const b = sectionBudgets({ unit: 'pages', min: 20, max: 25 }, { verses: 10, introduction: true, conclusion: true });
        expect(b.perVerse).toBe(400);
        expect(b.introduction).toBe(500);
    });
});
