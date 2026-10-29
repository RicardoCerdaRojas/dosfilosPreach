import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeConclusionInput, ComposeIntroductionInput, PassageReference } from '@dosfilos/domain';
import { buildIntroductionPrompt } from '../GeminiIntroductionComposer';
import { buildConclusionPrompt } from '../GeminiConclusionComposer';

/**
 * TI #2 del Salmo 23 (2026-10-29): la conclusión salió como lista de
 * traducciones elegidas, sin volver a la tesis, y con «(Ibid., 567)». Las
 * reglas que el estudiante pasó a su guía desde la devolución del TI #1
 * («la tesis es interpretativa y verificable…») solo llegaban al análisis y a
 * la prosa de los versículos.
 */
const PASSAGE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 6 };
const REGLA = 'La tesis es una afirmación interpretativa concreta y verificable, no una descripción del trabajo.';

const base = (lang: 'es' | 'en', rules: string[] | null) => ({
    paperPassage: PASSAGE,
    language: lang,
    assignmentBrief: 'encuadre',
    verseAnalyses: [buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: 4, verseEnd: 4 })],
    styleGuideContent: '',
    styleGuideManifest: rules ? { additionalRules: rules } : null,
    sources: [],
    pinnedSourceKeys: [],
    paperRubric: null,
    exegeticalStrategy: null,
    regenerationHint: null,
});

const construir = {
    introducción: (lang: 'es' | 'en', rules: string[] | null) => buildIntroductionPrompt({ ...base(lang, rules), acceptedConclusionMarkdown: '## Conclusión\n\nTesis.' } as unknown as ComposeIntroductionInput),
    conclusión: (lang: 'es' | 'en', rules: string[] | null) => buildConclusionPrompt(base(lang, rules) as unknown as ComposeConclusionInput),
};

describe.each(Object.entries(construir))('%s — tesis y reglas del curso', (_n, build) => {
    it('REGRESIÓN: las reglas de la guía del curso llegan como reglas obligatorias', () => {
        const s = build('es', [REGLA]).systemInstruction;
        expect(s).toContain('## Reglas del curso (de la guía de estilo, obligatorias)');
        expect(s).toContain(`- ${REGLA}`);
        expect(build('en', [REGLA]).systemInstruction).toContain('## Course rules (from the style guide, mandatory)');
    });

    it('sin reglas no agrega un bloque vacío', () => {
        expect(build('es', null).systemInstruction).not.toContain('Reglas del curso');
    });

    it('prohíbe «Ibid.» en la prosa, en los dos idiomas', () => {
        expect(build('es', null).systemInstruction).toContain('NUNCA escribas «Ibid.»');
        expect(build('en', null).systemInstruction).toContain('NEVER write "Ibid."');
    });
});

describe('la conclusión vuelve a la tesis', () => {
    it('REGRESIÓN: pide volver a la tesis y sostenerla con la sintaxis, no enumerar traducciones', () => {
        const s = buildConclusionPrompt(base('es', null) as unknown as ComposeConclusionInput).systemInstruction;
        expect(s).toContain('Vuelve EXPLÍCITAMENTE a esa tesis');
        expect(s).toContain('NO enumeres las traducciones elegidas');
        expect(s).toContain('Termina con una oración que vuelva a la tesis');
    });

    it('la tesis del encuadre es hipótesis; la de la indicación, decisión del autor (no se contradicen)', () => {
        for (const lang of ['es', 'en'] as const) {
            const s = buildConclusionPrompt(base(lang, null) as unknown as ComposeConclusionInput).systemInstruction;
            expect(s).toMatch(lang === 'es' ? /Una tesis del encuadre es una hipótesis/ : /A thesis in the assignment brief is a hypothesis/);
            expect(s).not.toMatch(lang === 'es' ? /Si el encuadre o la indicación/ : /If the assignment brief or the regeneration hint/);
        }
    });
});

describe('la introducción termina con la tesis de la conclusión', () => {
    it('REGRESIÓN: la tesis es la que la conclusión aceptada reformula, interpretativa y al final', () => {
        const s = buildIntroductionPrompt({ ...base('es', null), acceptedConclusionMarkdown: 'x' } as unknown as ComposeIntroductionInput).systemInstruction;
        expect(s).toContain('usa ESA tesis');
        expect(s).toContain('nunca una descripción del trabajo');
        expect(s).toContain('Termina la introducción con la tesis');
    });
});
