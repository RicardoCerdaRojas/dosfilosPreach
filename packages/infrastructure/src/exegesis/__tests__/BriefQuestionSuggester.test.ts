import { describe, it, expect } from 'vitest';
import { buildSuggestBriefQuestionsPrompt, parseQuestionCandidates, suggestBriefQuestions } from '../BriefQuestionSuggester';

const input = {
    passageLabel: 'Jonás 4:5-11', genre: 'Narrativa',
    verses: [{ ref: '4:6', text: 'וַיְמַן יְהוָה־אֱלֹהִים קִיקָיוֹן' }],
    lemmas: ['מָנָה', 'קִיקָיוֹן'], existingQuestions: ['¿Qué hace וַיְמַן?'], language: 'es' as const,
};

describe('BriefQuestionSuggester', () => {
    it('el prompt da el texto, los lemas permitidos y lo que ya está', () => {
        const p = buildSuggestBriefQuestionsPrompt(input);
        expect(p).toContain('קִיקָיוֹן');
        expect(p).toContain('las únicas formas que puedes citar');
        expect(p).toContain('¿Qué hace וַיְמַן?');
        expect(p).toContain('tú, no vos');
    });

    it('lee el JSON del modelo y descarta lo que no tiene forma de pregunta', () => {
        const raw = '```json\n{"questions":[{"question":"¿Por qué מָנָה cuatro veces?","why":"repetición","forms":["מָנָה"]},{"why":"sin pregunta"},{"question":"  ","forms":[]}]}\n```';
        const r = parseQuestionCandidates(raw);
        expect(r).toEqual([{ question: '¿Por qué מָנָה cuatro veces?', why: 'repetición', forms: ['מָנָה'] }]);
    });

    it('JSON roto: ninguna candidata, no una excepción', () => {
        expect(parseQuestionCandidates('no es json')).toEqual([]);
    });

    it('no más de ocho', () => {
        const raw = JSON.stringify({ questions: Array.from({ length: 12 }, (_, i) => ({ question: `¿${i}?`, forms: [] })) });
        expect(parseQuestionCandidates(raw)).toHaveLength(8);
    });

    it('usa el ejecutor inyectado', async () => {
        const r = await suggestBriefQuestions(input, async () => '{"questions":[{"question":"¿A?","why":"","forms":[]}]}');
        expect(r).toHaveLength(1);
    });
});
