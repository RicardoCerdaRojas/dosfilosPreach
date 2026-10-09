import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Rut 1:16 (bitácora del módulo de hebreo): la tarjeta de תֵּלְכִי decía «Rut como
 * sujeto»; la 2.ª persona del discurso es a quien Rut habla. Y H6: con formas
 * corregidas según OSHB, la traducción literal avisa que es anterior.
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('../StickyVerseHeader', () => ({ StickyVerseHeader: () => null }));
vi.mock('../../HebrewTutorProvider', () => ({ useHebrewTutor: () => ({}) }));
vi.mock('../VerbDetectivePanel', () => ({ VerbDetectivePanel: () => null }));
vi.mock('../NominalDetectivePanel', () => ({ NominalDetectivePanel: () => null }));
const estado = vi.hoisted(() => ({
    estructura: { loading: false, unavailable: true, nodes: null, words: [] as unknown[], ordinal: new Map(), frontedByOrdinal: new Map(), speech: [] as unknown[] },
}));
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => estado.estructura,
    conLectura: () => new Map(),
}));
const { SpeechNote } = await import('../SpeechNote');
const { VerseAnalysisResult } = await import('../VerseAnalysisResult');
const { TooltipProvider } = await import('@/components/ui/tooltip');

describe('quién habla (Rut 1:16)', () => {
    it('sin destinatario escrito: «a quien Rut se dirige, no Rut»', () => {
        render(<SpeechNote speech={{ ordinal: 11, text: 'תֵּלְכִי', kind: 'verb', speaker: 'רוּת', speakerOrdinals: [1] }} />);
        expect(screen.getByTestId('speech-note').textContent).toContain('verseAnalyzer.speech.verb {"speaker":"רוּת"}');
    });
    it('con destinatario (Rut 1:8): lo nombra; un sufijo usa su propio texto', () => {
        render(<SpeechNote speech={{ ordinal: 4, text: 'עִמָּכֶם', kind: 'suffix', speaker: 'נָעֳמִי', speakerOrdinals: [1], addressee: 'לִשְׁתֵּי כַלֹּתֶיהָ', addresseeOrdinals: [2, 3] }} />);
        expect(screen.getByTestId('speech-note').textContent).toContain('verseAnalyzer.speech.suffixTo');
        expect(screen.getByTestId('speech-note').textContent).toContain('לִשְׁתֵּי כַלֹּתֶיהָ');
    });
    it('sin hecho, nada', () => {
        expect(render(<SpeechNote />).container).toBeEmptyDOMElement();
    });
});

describe('H6: la traducción literal es anterior a una corrección de OSHB', () => {
    const base = { reference: 'Rut 1:13', hebrewText: '', literalTranslation: 'esperarían', fluidTranslation: 'x', verbTable: [], exegeticalNotes: [] };
    const conCorreccion = { ...base, words: [{ hebrewText: 'תְּשַׂבֵּרְנָה', hebrewWord: 'תְּשַׂבֵּרְנָה', morphemes: [], category: 'VERB', translation: 'esperarían', oshbReference: { morphCode: 'HVpi2fp', strongNumber: '7663', agreesWithAnalysis: false, corrections: [{ field: 'binyan', analysis: 'QAL', oshb: 'PIEL' }] } }] };
    const pagina = (a: unknown) => render(<TooltipProvider><VerseAnalysisResult analysis={a as never} /></TooltipProvider>);
    it('con correcciones, la literal avisa', () => {
        pagina(conCorreccion);
        expect(screen.getByTestId('literal-notice').textContent).toBe('verseAnalyzer.oshb.literalNote');
    });
    it('la fórmula de juramento sola no avisa: su traducción la pone el código (Rut 1:17)', () => {
        const juramento = { ...conCorreccion, words: [{ ...conCorreccion.words[0], oshbReference: { ...conCorreccion.words[0]!.oshbReference, corrections: [{ field: 'verbForm', analysis: 'IMPERFECT', oshb: 'JUSSIVE', reason: 'oath-formula' }] } }] };
        pagina(juramento);
        expect(screen.queryByTestId('literal-notice')).toBeNull();
    });
    it('sin correcciones, no', () => {
        pagina({ ...base, words: [] });
        expect(screen.queryByTestId('literal-notice')).toBeNull();
    });
});

describe('del dato a la tarjeta (revisión: el camino no tenía prueba)', () => {
    it('la nota «Quién habla» llega a la tarjeta de la palabra alineada (Rut 1:16 תֵּלְכִי)', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false,
            words: [{ r: '16!1', t: 'תֵּלְכִי', l: '3212', m: 'HVqi2fs', role: 'v' }],
            speech: [{ ordinal: 0, text: 'תֵּלְכִי', kind: 'verb', speaker: 'רוּת' }],
        };
        const analisis = { reference: 'Rut 1:16', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [{ hebrewText: 'תֵּלְכִי', hebrewWord: 'תֵּלְכִי', morphemes: [], category: 'VERB', translation: 'irás' }] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.1.16" /></TooltipProvider>);
        expect(screen.getAllByTestId('speech-note')[0]!.textContent).toContain('verseAnalyzer.speech.verb {"speaker":"רוּת"}');
    });
});

describe('el hablante con su nombre en español (prueba del fundador: «Habla רוּת» en medio de la frase)', () => {
    it('toma la traducción de la palabra del hablante en el análisis: «Rut»', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false,
            words: [{ r: '16!1', t: 'רוּת', l: '7327', m: 'HNp', role: 's' }, { r: '16!2', t: 'תֵּלְכִי', l: '3212', m: 'HVqi2fs', role: 'v' }],
            speech: [{ ordinal: 1, text: 'תֵּלְכִי', kind: 'verb', speaker: 'רוּת', speakerOrdinals: [0] }],
        };
        const analisis = { reference: 'Rut 1:16', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'רוּת', hebrewWord: 'רוּת', morphemes: [], category: 'NOUN', translation: 'Rut' },
                { hebrewText: 'תֵּלְכִי', hebrewWord: 'תֵּלְכִי', morphemes: [], category: 'VERB', translation: 'vayas' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.1.16" /></TooltipProvider>);
        const nota = screen.getAllByTestId('speech-note')[0]!.textContent!;
        expect(nota).toContain('{"speaker":"Rut"}');
        expect(nota).toContain('verseAnalyzer.speech.rule');
    });
});
