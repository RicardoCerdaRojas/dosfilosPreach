import { describe, expect, it } from 'vitest';
import { buildThesisProposalPrompt, buildThesisReviewPrompt, parseThesisProposals, parseThesisReview } from '../thesisPrompt';

const BASE = { passageLabel: 'Salmo 23:4–6', language: 'es' as const, assignmentBrief: 'Análisis sintáctico y léxico.', briefings: 'v4 …', previousUnitThesis: 'La suficiencia es consecuencia de quién es el SEÑOR.' };

describe('el mensaje de la tesis', () => {
    it('lleva los seis criterios calibrados, la unidad anterior y la tesis a revisar', () => {
        const { system, user } = buildThesisReviewPrompt({ ...BASE, thesis: 'Mi tesis.' });
        for (const c of ['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers']) expect(system).toContain(c);
        // Calibración medida: la tesis no enumera cada versículo; brevedad no se penaliza.
        expect(system).toContain('NO hace falta que nombre cada versículo');
        expect(system).toContain('No penalices la brevedad');
        expect(user).toContain('## Tesis de la unidad anterior del curso\nLa suficiencia es consecuencia de quién es el SEÑOR.');
        expect(user).toContain('## Tesis a revisar\nMi tesis.');
    });
    it('la propuesta nombra la construcción decisiva si el enunciado pide sintaxis', () => {
        expect(buildThesisProposalPrompt(BASE).system).toContain('nombra la construcción o la forma verbal decisiva');
    });
    it('sin unidad anterior lo dice; en inglés, responde en inglés', () => {
        expect(buildThesisReviewPrompt({ ...BASE, previousUnitThesis: null, thesis: 'x' }).user).toContain('primer trabajo de la serie');
        expect(buildThesisProposalPrompt({ ...BASE, language: 'en' }).system).toContain('in English');
    });
});

describe('parseThesisReview', () => {
    it('los seis criterios en orden, aunque falte alguno o vengan desordenados', () => {
        const r = parseThesisReview(JSON.stringify({ criteria: [{ criterion: 'connects', verdict: 'no-cumple', reason: 'No retoma 1–3.' }, { criterion: 'interpretive', verdict: 'cumple', reason: 'Sí.' }], suggestion: '  Otra tesis.  ' }));
        expect(r.criteria.map(c => c.criterion)).toEqual(['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers']);
        expect(r.criteria[4]).toEqual({ criterion: 'connects', verdict: 'no-cumple', reason: 'No retoma 1–3.' });
        expect(r.criteria[1]!.verdict).toBe('no-aplica');
        expect(r.suggestion).toBe('Otra tesis.');
    });
    it('si todo se cumple, no hay sugerencia aunque el modelo mande una', () => {
        const todo = ['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers'].map(criterion => ({ criterion, verdict: 'cumple', reason: 'ok' }));
        expect(parseThesisReview(JSON.stringify({ criteria: todo, suggestion: 'innecesaria' })).suggestion).toBeNull();
    });
});

describe('parseThesisProposals', () => {
    it('como mucho tres, sin vacías ni respaldos vacíos', () => {
        const p = parseThesisProposals(JSON.stringify({ proposals: [
            { thesis: ' A ', support: [{ verse: 'v4', evidence: 'e' }, { verse: '', evidence: 'x' }] }, { thesis: '', support: [] }, { thesis: 'B', support: [] }, { thesis: 'C', support: [] }, { thesis: 'D', support: [] },
        ] }));
        expect(p.map(x => x.thesis)).toEqual(['A', 'B', 'C']);
        expect(p[0]!.support).toEqual([{ verse: 'v4', evidence: 'e' }]);
    });
});
