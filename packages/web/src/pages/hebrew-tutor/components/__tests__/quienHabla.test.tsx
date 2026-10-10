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
    estructura: { loading: false, unavailable: true, nodes: null, words: [] as unknown[], ordinal: new Map(), frontedByOrdinal: new Map(), speech: [] as unknown[], infinitives: [] as unknown[], participles: [] as unknown[], kis: [] as unknown[] },
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

describe('R4: del dato a la tarjeta', () => {
    it('la función del infinitivo llega a la tarjeta de la palabra alineada (Gn 19:22 «עַד בֹּאֲךָ»)', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [],
            words: [{ r: '22!9', t: 'עַד', l: '5704', m: 'HR', role: '' }, { r: '22!10', t: 'בֹּאֲךָ', l: '935', m: 'HVqc/Sp2ms', role: 'v' }],
            infinitives: [{ ordinal: 1, text: 'בֹּאֲךָ', form: 'construct', rule: 'adInf', allowed: ['temporalUntil'], status: 'medida' }],
        };
        const analisis = { reference: 'Gn 19:22', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'עַד', hebrewWord: 'עַד', morphemes: [], category: 'PREPOSITION', translation: 'hasta' },
                { hebrewText: 'בֹּאֲךָ', hebrewWord: 'בֹּאֲךָ', morphemes: [], category: 'VERB', translation: 'que llegues' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Gen.19.22" /></TooltipProvider>);
        expect(screen.getAllByTestId('infinitive-note')[0]!.textContent).toContain('verseAnalyzer.infinitive.functions.temporalUntil');
    });
    it('la del participio, con la elección del asistente (Gn 6:17 «הִנְנִי מֵבִיא»)', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [], infinitives: [],
            words: [{ r: '17!2', t: 'הִנְנִי', l: '2009', m: 'HTm/Sp1cs', role: 'p' }, { r: '17!3', t: 'מֵבִיא', l: '935', m: 'HVhrmsa', role: 'v' }],
            participles: [{ ordinal: 1, text: 'מֵבִיא', rule: 'ptcHinne', allowed: ['predicatePresent', 'predicatePast', 'predicateFuture'], status: 'medida' }],
        };
        const analisis = { reference: 'Gn 6:17', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'הִנְנִי', hebrewWord: 'הִנְנִי', morphemes: [], category: 'PARTICLE', translation: 'he aquí yo' },
                { hebrewText: 'מֵבִיא', hebrewWord: 'מֵבִיא', morphemes: [], category: 'VERB', translation: 'traigo', participleFunction: 'predicateFuture' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Gen.6.17" /></TooltipProvider>);
        const nota = screen.getAllByTestId('participle-note')[0]!.textContent!;
        expect(nota).toContain('verseAnalyzer.participle.functions.predicateFuture');
        expect(nota).toContain('verseAnalyzer.ruleChoice.assistant');
    });
    it('la de כִּי, con la elección del asistente (2 S 12:5, si la regla diera varias opciones)', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [], infinitives: [], participles: [],
            words: [{ r: '5!7', t: 'חַי', l: '2416 a', m: 'HAamsa', role: '' }, { r: '5!8', t: 'יְהוָה', l: '3068', m: 'HNp', role: '' }, { r: '5!9', t: 'כִּי', l: '3588', m: 'HC', role: '' }],
            kis: [{ ordinal: 2, text: 'כִּי', rule: 'kiGeneral', allowed: ['causal', 'asseverative'], status: 'medida' }],
        };
        const analisis = { reference: '2 S 12:5', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'חַי', hebrewWord: 'חַי', morphemes: [], category: 'ADJECTIVE', translation: 'vive' },
                { hebrewText: 'יְהוָה', hebrewWord: 'יְהוָה', morphemes: [], category: 'PROPER_NOUN', translation: 'YHWH' },
                { hebrewText: 'כִּי', hebrewWord: 'כִּי', morphemes: [], category: 'CONJUNCTION', translation: 'que', kiFunction: 'asseverative' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="2Sam.12.5" /></TooltipProvider>);
        const nota = screen.getAllByTestId('ki-note')[0]!.textContent!;
        expect(nota).toContain('verseAnalyzer.ki.functions.asseverative');
        expect(nota).toContain('verseAnalyzer.ruleChoice.assistant');
    });
});
