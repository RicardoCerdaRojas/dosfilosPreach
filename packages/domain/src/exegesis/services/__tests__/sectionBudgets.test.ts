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
// Mínimo y máximo iguales: el objetivo es el punto medio de lo exigido, y
// así estas cuentas no dependen de él (lo prueba su propio caso abajo).
const DOS_PAGINAS = { unit: 'pages' as const, min: 2, max: 2 };

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
            // Un versículo que responde dos preguntas: tres versículos, cuatro partes.
            { verses: 3, shares: 4, introduction: false, conclusion: false },
        ] as Array<{ verses: number; shares?: number; introduction: boolean; conclusion: boolean }>) {
            const b = sectionBudgets(DOS_PAGINAS, sections);
            const repartos = sections.shares ?? sections.verses;
            const partes = repartos
                + (sections.introduction ? 1 : 0) + (sections.conclusion ? 1 : 0);
            const suma = (b.perShare ?? 0) * repartos
                + (b.introduction ?? 0) + (b.conclusion ?? 0);
            expect(Math.abs(suma - 500)).toBeLessThanOrEqual(25 * partes);
        }
    });

    it('el caso real: cuatro versículos, con marco', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: true, conclusion: true });
        expect(b.perShare).toBe(100);
        expect(b.introduction).toBe(50);
        expect(b.conclusion).toBe(50);
    });

    it('sin marco, el cien por ciento va a los versículos', () => {
        // Un documento de sólo versículos. Reservarle extensión a una sección
        // que no va escrita deja el trabajo corto.
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: false, conclusion: false });
        // 500 ÷ 4 = 125, que redondeado a decenas de cincuenta da 150.
        expect(b.perShare).toBe(150);
        expect(b.introduction).toBeNull();
        expect(b.conclusion).toBeNull();
        // Y es MÁS que las 100 que recibía cada uno con el marco puesto: la
        // parte de las secciones que no van vuelve a los versículos.
        expect(b.perShare!).toBeGreaterThan(
            sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: true, conclusion: true }).perShare!,
        );
    });

    it('con conclusión pero sin introducción, el décimo sobrante va a los versículos', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 4, introduction: false, conclusion: true });
        expect(b.introduction).toBeNull();
        expect(b.conclusion).toBe(50);
        // 500 × 0,9 ÷ 4 = 112,5 → 100.
        expect(b.perShare).toBe(100);
    });

    it('sin versículos no se divide por cero', () => {
        const b = sectionBudgets(DOS_PAGINAS, { verses: 0, introduction: true, conclusion: true });
        expect(b.perShare).toBeNull();
        expect(b.introduction).toBe(50);
    });

    it('sin extensión declarada no se inventa un objetivo', () => {
        const b = sectionBudgets(null, { verses: 4, introduction: true, conclusion: true });
        expect(b).toEqual({ perShare: null, introduction: null, conclusion: null });
        expect(sectionBudgets({ unit: 'pages', min: null, max: null }, { verses: 4, introduction: true, conclusion: true }).perShare).toBeNull();
    });

    it('un presupuesto nunca baja de 50 palabras', () => {
        // Redondear a cero deja al compositor con la instrucción de no
        // escribir nada, que es peor que no darle ninguna.
        const b = sectionBudgets({ unit: 'words', min: 100, max: null }, { verses: 1, introduction: true, conclusion: true });
        expect(b.introduction).toBe(50);
    });

    it('un trabajo largo reparte en proporción', () => {
        const b = sectionBudgets({ unit: 'pages', min: 20, max: 20 }, { verses: 10, introduction: true, conclusion: true });
        expect(b.perShare).toBe(400);
        expect(b.introduction).toBe(500);
    });

    it('apunta al punto medio de lo exigido, no al mínimo', () => {
        // Apuntar al mínimo dejaba el trabajo en el borde de «corto» apenas un
        // versículo salía más breve. 2-3 páginas = 2,5 × 250 = 625 palabras,
        // que a decenas de cincuenta da 650 (con el mínimo daba 500).
        const b = sectionBudgets({ unit: 'pages', min: 2, max: 3 }, { verses: 1, introduction: false, conclusion: false });
        expect(b.perShare).toBe(650);
        // Con un solo extremo declarado, ése es el objetivo.
        expect(sectionBudgets({ unit: 'words', min: 600, max: null }, { verses: 1, introduction: false, conclusion: false }).perShare).toBe(600);
        expect(sectionBudgets({ unit: 'words', min: null, max: 600 }, { verses: 1, introduction: false, conclusion: false }).perShare).toBe(600);
    });

    it('reparte por pregunta respondida, no por versículo', () => {
        // TP Santiago 2:14-26: cuatro preguntas en tres versículos; 2:21
        // responde la 3 y la 4. Tres versículos pero cuatro partes.
        const b = sectionBudgets(
            { unit: 'words', min: 1200, max: 1200 },
            { verses: 3, shares: 4, introduction: false, conclusion: false },
        );
        expect(b.perShare).toBe(300);
    });
});
