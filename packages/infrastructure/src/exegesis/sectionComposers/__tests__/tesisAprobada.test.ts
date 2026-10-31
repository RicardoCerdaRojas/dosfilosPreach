import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeConclusionInput, ComposeIntroductionInput, PassageReference } from '@dosfilos/domain';
import { buildIntroductionPrompt } from '../GeminiIntroductionComposer';
import { buildConclusionPrompt } from '../GeminiConclusionComposer';

/**
 * Etapa 3.2 (B63): la tesis aprobada llega a los compositores. Sin ella, la
 * introducción del TI #2 tomó la última oración de la conclusión como tesis.
 */
const PASSAGE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 6 };
const TESIS = 'En Salmo 23:4–6 el salmista pasa de la confianza en la travesía a la certeza del hogar.';
const base = (lang: 'es' | 'en', approvedThesis: string | null) => ({
    paperPassage: PASSAGE, language: lang, assignmentBrief: 'encuadre',
    verseAnalyses: [buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: 4, verseEnd: 4 })],
    styleGuideContent: '', styleGuideManifest: null, sources: [], pinnedSourceKeys: [],
    paperRubric: null, exegeticalStrategy: null, regenerationHint: null, approvedThesis,
});
const conclusion = (lang: 'es' | 'en', t: string | null) => buildConclusionPrompt(base(lang, t) as unknown as ComposeConclusionInput).userMessage;
const introduccion = (lang: 'es' | 'en', t: string | null) =>
    buildIntroductionPrompt({ ...base(lang, t), acceptedConclusionMarkdown: '## Conclusión\n\nTexto.' } as unknown as ComposeIntroductionInput).userMessage;

describe('la tesis aprobada en el mensaje de la conclusión y de la introducción', () => {
    it('la conclusión la recibe como LA tesis, para retomarla', () => {
        const m = conclusion('es', TESIS);
        expect(m).toContain('### Tesis aprobada');
        expect(m).toContain(`> ${TESIS}`);
        expect(m).toContain('ESTA es la tesis. Vuelve a ella');
    });

    it('la introducción termina con ella y no deriva otra de la conclusión', () => {
        const m = introduccion('es', TESIS);
        expect(m).toContain(`> ${TESIS}`);
        expect(m).toContain('Termina la introducción con ella');
        expect(m).toContain('Termina con la tesis aprobada de arriba.');
        expect(m).not.toContain('Enuncia la tesis que el cuerpo y la conclusión efectivamente demostraron');
    });

    it('en inglés también', () => {
        expect(conclusion('en', TESIS)).toContain('### Approved thesis');
        expect(introduccion('en', TESIS)).toContain('End it with the approved thesis above.');
    });

    it('sin tesis aprobada, todo sigue como antes', () => {
        expect(conclusion('es', null)).not.toContain('Tesis aprobada');
        const m = introduccion('es', null);
        expect(m).not.toContain('Tesis aprobada');
        expect(m).toContain('Enuncia la tesis que el cuerpo y la conclusión efectivamente demostraron');
    });
});
