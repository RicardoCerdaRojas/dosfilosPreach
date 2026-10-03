import { describe, it, expect } from 'vitest';
import { filterQuestionCandidates, insertQuestionsIntoBrief, passageFormKeys } from '../briefQuestionCandidates';
import { PREACHING_BRIEF_TEMPLATE } from '../preachingBriefTemplate';

/** Tokens reales de morphhb, Jonás 4:9-10. */
const tok = (text: string, lemma: string, oshbMorphCode: string) => ({ text, lemma, oshbMorphCode });
const VERSOS = [
    { chapter: 4, verse: 9, morphology: { tokens: [tok('הַ/הֵיטֵ֥ב', 'd/3190', 'HTi/Vha'), tok('חָרָֽה', '2734', 'HVqp3ms'), tok('לְ/ךָ֖', 'l', 'HR/Sp2ms')] } },
    { chapter: 4, verse: 10, morphology: { tokens: [tok('חַ֨סְתָּ֙', '2347', 'HVqp2ms'), tok('עָמַ֥לְתָּ', '5998', 'HVqp2ms')] } },
];
// Los lemas de Strong que da `passageLemmas`.
const CLAVES = passageFormKeys(VERSOS, [{ lemma: 'חוּס' }, { lemma: 'חָרָה' }, { lemma: 'עָמַל' }]);
const c = (question: string, forms: string[] = []) => ({ question, why: '', forms });

describe('filterQuestionCandidates — una pregunta sobre una palabra que el texto no tiene se descarta', () => {
    it('las preguntas que se le dieron al fundador pasan (por forma o por lema)', () => {
        const r = filterQuestionCandidates([
            c('¿Qué carga la pregunta הַהֵיטֵב חָרָה־לְךָ en 4:9?', ['הַהֵיטֵב', 'חָרָה']),
            c('¿Qué contraste arma חוּס entre Jonás y Dios?', ['חוּס']),
        ], CLAVES);
        expect(r.kept).toHaveLength(2);
        expect(r.dropped).toHaveLength(0);
    });

    it('una forma que no está en el pasaje la descarta, y dice cuál', () => {
        const r = filterQuestionCandidates([c('¿Cómo se relaciona con חֶסֶד?', ['חֶסֶד'])], CLAVES);
        expect(r.kept).toHaveLength(0);
        expect(r.dropped[0]!.missing).toEqual(['חֶסֶד']);
    });

    it('también cuenta una forma escrita en la pregunta aunque no esté declarada', () => {
        const r = filterQuestionCandidates([c('¿Por qué usa רַחוּם aquí?')], CLAVES);
        expect(r.dropped).toHaveLength(1);
    });

    it('una pregunta sin formas del original no tiene nada que cotejar', () => {
        expect(filterQuestionCandidates([c('¿Cómo termina el libro?')], CLAVES).kept).toHaveLength(1);
    });
});

describe('insertQuestionsIntoBrief', () => {
    it('en la plantilla sin llenar, reemplaza «1.» y «2.» vacíos', () => {
        const r = insertQuestionsIntoBrief(PREACHING_BRIEF_TEMPLATE, ['¿A?', '¿B?']);
        expect(r).toContain('1. ¿A?\n2. ¿B?');
        expect(r).not.toMatch(/\n1\.\n/);
        expect(r).toContain('LO QUE TIENE QUE QUEDAR RESUELTO');
    });

    it('con preguntas ya escritas, numera a continuación', () => {
        const brief = 'PREGUNTAS DEL TEXTO\n1. ¿Primera?\n\nLO QUE TIENE QUE QUEDAR RESUELTO\n- algo';
        expect(insertQuestionsIntoBrief(brief, ['¿Segunda?'])).toContain('1. ¿Primera?\n2. ¿Segunda?');
    });

    it('sin el bloque, lo agrega al final', () => {
        expect(insertQuestionsIntoBrief('Mi encuadre.', ['¿A?'])).toBe('Mi encuadre.\n\nPREGUNTAS DEL TEXTO\n1. ¿A?\n');
    });
});

describe('insertQuestionsIntoBrief — encabezados y numeraciones de otros (revisión adversarial de C4)', () => {
    it('«Preguntas:» con «1)»: continúa en 3, en el mismo bloque', async () => {
        const { parseBriefQuestions } = await import('../briefQuestions');
        const brief = 'Trabajo de Jonás 4.\n\nPreguntas:\n1) ¿Por qué se enoja Jonás?\n2) ¿Qué prepara Dios?\n';
        const out = insertQuestionsIntoBrief(brief, ['¿Qué pregunta Dios en 4:11?']);
        expect(out.match(/Preguntas/gi)).toHaveLength(1);
        expect(parseBriefQuestions(out).map(q => q.number)).toEqual([1, 2, 3]);
    });

    it('sin encabezado pero con preguntas numeradas: el bloque nuevo no repite números', async () => {
        const { parseBriefQuestions } = await import('../briefQuestions');
        const out = insertQuestionsIntoBrief('1. ¿Quién es Jonás?\n2. ¿Dónde está Nínive?', ['¿Qué aprende Jonás?']);
        expect(parseBriefQuestions(out).map(q => q.number)).toEqual([1, 2, 3]);
    });
});
