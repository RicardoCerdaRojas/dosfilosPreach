import { describe, it, expect } from 'vitest';
import { cleanBibliographyCriteria, isNoRepeatRule, measureRequirement, requirementsFromExtraction, requirementTemplate, type ProjectBibliographyEntry, type ProjectRequirement } from '../projectBibliography';

/**
 * Etapa 2b: los requisitos del curso (o del nivel, sin sílabo) se miden
 * sobre la bibliografía aprobada. Caso real: la rúbrica y el sílabo de NT785.
 */
const f = (over: Partial<ProjectBibliographyEntry>): ProjectBibliographyEntry => ({ id: Math.random().toString(36).slice(2), title: 'Obra', weight: 'recommended', decision: 'approved', origins: ['manual'], ...over });
const req = (over: Partial<ProjectRequirement>): ProjectRequirement => ({ id: 'r', kind: 'other', text: 'x', origin: 'syllabus', ...over });

describe('medir los requisitos', () => {
    it('100 páginas de artículos: cuentan las reseñadas; lo que falta para medir se dice', () => {
        const fichas = [
            f({ id: 'laws', sourceType: 'journal-article', pageCount: 6, read: true, annotation: { review: { mainIdea: 'Santiago 4:5 cita…', rating: 8 } } }),
            // Reseñada sin marcar «leída»: escribir la idea principal es haberla leído.
            f({ id: 'johnson', sourceType: 'journal-article', pageCount: 12, annotation: { review: { mainIdea: 'La envidia en 4:5' } } }),
            f({ id: 'kirk', sourceType: 'journal-article', pageCount: 15, read: true }),
            f({ id: 'reese', sourceType: 'journal-article' }),
            f({ id: 'cand', sourceType: 'journal-article', pageCount: 90, read: true, decision: 'candidate', annotation: { review: { mainIdea: 'x' } } }),
        ];
        const m = measureRequirement(req({ kind: 'quantity', sourceType: 'journal-article', unit: 'pages', minimum: 100 }), fichas, () => null);
        expect(m).toMatchObject({ status: 'unmet', value: 18, target: 100 });
        expect(m.unmeasurable.sort()).toEqual(['kirk', 'reese']);
    });

    it('fuentes antiguas y actuales: una antes del corte y N desde el año reciente; sin año no cuenta para nada', () => {
        const r = req({ kind: 'date-range', before: 1950, after: 2011, recentMinimum: 2 });
        const fichas = [f({ year: 1910 }), f({ year: 2017 }), f({ evaluation: { editionYear: 2015 } }), f({ id: 'sin' })];
        expect(measureRequirement(r, fichas, () => null)).toMatchObject({ status: 'met', unmeasurable: ['sin'] });
        expect(measureRequirement(r, fichas.slice(1), () => null).status).toBe('unmet');
    });

    it('épocas con un solo corte: pide solo lo de ese corte, sin sumar el otro (segunda revisión)', () => {
        const antes = req({ kind: 'date-range', before: 1900, recentMinimum: 1 });
        expect(measureRequirement(antes, [f({ year: 1850 })], () => null)).toMatchObject({ status: 'met', value: 1, target: 1 });
        const desde = req({ kind: 'date-range', after: 2011, recentMinimum: 1 });
        expect(measureRequirement(desde, [f({ year: 2017 })], () => null)).toMatchObject({ status: 'met', value: 1, target: 1 });
        expect(measureRequirement(desde, [f({ year: 1990 })], () => null)).toMatchObject({ status: 'unmet', value: 0, target: 1 });
    });

    it('puntos de vista opuestos: enfoques distintos, sin contar «otro»; los sin enfoque se señalan', () => {
        const r = req({ kind: 'perspectives', minimum: 3 });
        const fichas = [
            f({ evaluation: { approach: 'historical-grammatical' } }), f({ evaluation: { approach: 'historical-critical' } }),
            f({ evaluation: { approach: 'other' } }), f({ id: 'x' }),
        ];
        const m = measureRequirement(r, fichas, () => null);
        expect(m).toMatchObject({ status: 'unmet', value: 2, target: 3 });
        expect(m.unmeasurable).toEqual(['x']);
    });

    it('mínimo por tipo con la clasificación del libro; variedad; lo que se marca a mano', () => {
        const fichas = [f({ resourceId: 'm', sourceType: null }), f({ sourceType: 'journal-article' })];
        const tipo = () => ({ exegeticalType: 'commentary-critical' as const });
        expect(measureRequirement(req({ kind: 'minimum-type', sourceType: 'commentary-critical', minimum: 1 }), fichas, tipo).status).toBe('met');
        expect(measureRequirement(req({ kind: 'variety', types: ['commentary-critical', 'journal-article', 'theological-monograph'] }), fichas, tipo)).toMatchObject({ value: 2, target: 3, status: 'unmet' });
        expect(measureRequirement(req({ kind: 'other' }), fichas, tipo).status).toBe('manual');
        expect(measureRequirement(req({ kind: 'other', done: true }), fichas, tipo).status).toBe('met');
    });

    it('un requisito sin su cifra no se da por cumplido: queda incompleto (revisión de la 2b)', () => {
        const fichas = [f({ sourceType: 'journal-article' })];
        expect(measureRequirement(req({ kind: 'minimum-type', sourceType: 'journal-article' }), fichas, () => null).status).toBe('incomplete');
        expect(measureRequirement(req({ kind: 'quantity', unit: 'works' }), fichas, () => null).status).toBe('incomplete');
        expect(measureRequirement(req({ kind: 'variety' }), fichas, () => null).status).toBe('incomplete');
        expect(measureRequirement(req({ kind: 'date-range' }), fichas, () => null).status).toBe('incomplete');
        // «Opuestos» sin cifra tampoco: la importación la completa y la declara.
        expect(measureRequirement(req({ kind: 'perspectives' }), [f({ evaluation: { approach: 'historical-critical' } })], () => null).status).toBe('incomplete');
    });

    it('las candidatas no cuentan: se mide lo aprobado', () => {
        expect(measureRequirement(req({ kind: 'minimum-type', sourceType: 'grammar-syntax', minimum: 1 }), [f({ sourceType: 'grammar-syntax', decision: 'candidate' })], () => null).status).toBe('unmet');
    });
});

describe('plantillas por nivel, sin sílabo', () => {
    it('el texto sale en el idioma de la pantalla, con las cifras de la plantilla', () => {
        const xs = requirementTemplate('research', () => 'x', new Date('2026-10-23'), (k, v) => `${k}:${v.minimum}:${v.recent}`);
        expect(xs.find(r => r.kind === 'date-range')!.text).toBe('dateRange:0:2');
        expect(xs.find(r => r.sourceType === 'commentary-critical')!.text).toBe('criticalCommentaries:4:0');
        expect(requirementTemplate('seminary', () => 'x', new Date('2026-10-23')).find(r => r.kind === 'date-range')!.text).toContain('anterior a 1950');
    });

    it('suben con el nivel, declaran su origen y piden posturas y épocas', () => {
        let n = 0;
        const sem = requirementTemplate('seminary', () => `s${++n}`, new Date('2026-10-23'));
        const inv = requirementTemplate('research', () => `i${++n}`, new Date('2026-10-23'));
        const criticos = (xs: ProjectRequirement[]) => xs.find(r => r.sourceType === 'commentary-critical')!.minimum;
        expect(criticos(inv)).toBeGreaterThan(criticos(sem)!);
        expect(inv.every(r => r.origin === 'level')).toBe(true);
        expect(inv.map(r => r.kind)).toEqual(expect.arrayContaining(['perspectives', 'date-range']));
        expect(inv.find(r => r.kind === 'date-range')).toMatchObject({ before: 1950, after: 2011 });
        expect(sem.some(r => r.sourceType === 'theological-monograph')).toBe(false);
    });
});

it('los requisitos se guardan sin undefined anidado', () => {
    const c = cleanBibliographyCriteria({ requirementItems: [req({ id: 'a', sourceType: undefined, minimum: 3 }), req({ id: 'a' }), req({ id: 'b', text: '  ' })] });
    expect(c.requirementItems).toEqual([{ id: 'a', kind: 'other', text: 'x', origin: 'syllabus', minimum: 3 }]);
    const d = cleanBibliographyCriteria({ requirementItems: [req({ id: 'a', assumed: ['before', 'nada' as never] }), req({ id: 'b', assumed: [] })] });
    expect(d.requirementItems!.map(r => r.assumed)).toEqual([['before'], undefined]);
    expect('assumed' in d.requirementItems![1]!).toBe(false);
});

describe('requisitos leídos de un sílabo', () => {
    it('lo que el sílabo no fija se completa y se declara; lo que ya estaba no se repite', () => {
        let n = 0;
        const ya = [req({ id: 'x', kind: 'rule', text: 'No se permite utilizar la misma fuente dos semanas consecutivas' })];
        const out = requirementsFromExtraction([
            { kind: 'date-range', text: 'Fuentes antiguas y actuales', before: null, after: null },
            { kind: 'perspectives', text: 'Puntos de vista opuestos', minimum: null },
            { kind: 'rule', text: 'No se permite utilizar la misma fuente dos semanas consecutivas' },
            { kind: 'quantity', text: 'Mínimo de 100 páginas', sourceType: 'journal-article', minimum: 100, unit: 'pages' },
        ], ya, () => `n${++n}`, new Date('2026-10-23'));
        expect(out.map(r => r.kind)).toEqual(['date-range', 'perspectives', 'quantity']);
        expect(out[0]).toMatchObject({ before: 1950, after: 2011, recentMinimum: 1, origin: 'syllabus' });
        // El texto queda como lo dice el sílabo; lo supuesto, aparte.
        expect(out[0]).toMatchObject({ text: 'Fuentes antiguas y actuales', assumed: ['before', 'after', 'recentMinimum'] });
        expect(out[1]).toMatchObject({ minimum: 2, assumed: ['minimum'] });
        expect(out[2]!.text).toBe('Mínimo de 100 páginas');
        expect(out[2]!.assumed).toBeUndefined();
    });

    it('solo se declara lo que se supuso, y reimportar lo supuesto no lo duplica', () => {
        const uno = requirementsFromExtraction([{ kind: 'date-range', text: 'Una obra anterior a 1900 y otras actuales', before: 1900, after: null }], [], () => 'a', new Date('2026-10-23'));
        expect(uno[0]).toMatchObject({ before: 1900, after: 2011, assumed: ['after', 'recentMinimum'] });
        const otra = requirementsFromExtraction([{ kind: 'date-range', text: 'Una obra anterior a 1900 y otras actuales ', before: 1900, after: null }, { kind: 'perspectives', text: 'Opuestos' }], uno, () => 'b', new Date('2026-10-23'));
        expect(otra.map(r => r.kind)).toEqual(['perspectives']);
    });

    it('la regla de no repetir se reconoce por su texto; otra regla no', () => {
        expect(isNoRepeatRule('No se permite utilizar la misma fuente dos semanas consecutivas')).toBe(true);
        expect(isNoRepeatRule('Do not reuse a source in consecutive weeks')).toBe(true);
        expect(isNoRepeatRule('No usar fuentes de internet')).toBe(false);
        expect(isNoRepeatRule('Se puede repetir una fuente si se justifica')).toBe(false);
        expect(isNoRepeatRule('Sources may be reused across weeks')).toBe(false);
    });
});
