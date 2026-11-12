import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
    estructura: { loading: false, unavailable: true, nodes: null, words: [] as unknown[], ordinal: new Map(), frontedByOrdinal: new Map(), speech: [] as unknown[], infinitives: [] as unknown[], participles: [] as unknown[], kis: [] as unknown[], ketivQere: [] as unknown[] },
}));
vi.mock('@/components/language-structure/useVerseStructure', () => ({
    useVerseStructure: () => estado.estructura,
    conLectura: () => new Map(),
}));
const { SpeechNote } = await import('../SpeechNote');
const { VerseAnalysisResult } = await import('../VerseAnalysisResult');
const { TooltipProvider } = await import('@/components/ui/tooltip');
/** La ficha completa se abre tocando la tarjeta resumen de la palabra `k` (rediseño de la ficha). */
const abrirFicha = (k: number) => fireEvent.click(screen.getAllByTestId('tarjeta-resumen')[k]!);

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

describe('del dato a la ficha (revisión: el camino no tenía prueba)', () => {
    it('la nota «Quién habla» llega a la ficha de la palabra alineada (Rut 1:16 תֵּלְכִי)', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false,
            words: [{ r: '16!1', t: 'תֵּלְכִי', l: '3212', m: 'HVqi2fs', role: 'v' }],
            speech: [{ ordinal: 0, text: 'תֵּלְכִי', kind: 'verb', speaker: 'רוּת' }],
        };
        const analisis = { reference: 'Rut 1:16', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [{ hebrewText: 'תֵּלְכִי', hebrewWord: 'תֵּלְכִי', morphemes: [], category: 'VERB', translation: 'irás' }] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.1.16" /></TooltipProvider>);
        abrirFicha(0);
        expect(screen.getAllByTestId('speech-note')[0]!.textContent).toContain('verseAnalyzer.speech.verb {"speaker":"רוּת"}');
    });
});

describe('ketiv y qere del dato a la página (revisión del profesor, Rut 2:1 מוֹדַע)', () => {
    it('el círculo sobre la palabra en el versículo y el bloque en su ficha; nada en la vecina', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [], infinitives: [], participles: [], kis: [],
            words: [{ r: '1!1', t: 'וּלְנָעֳמִי', l: 'c/l/5281', m: 'HC/R/Np', role: 'p' }, { r: '1!3', t: 'מוֹדַע', l: '4129', m: 'HNcmsa', role: 's' }],
            ketivQere: [{ ordinal: 1, qere: 'מוֹדַע', ketiv: 'מידע' }],
        };
        const analisis = { reference: 'Rut 2:1', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'וּלְנָעֳמִי', hebrewWord: 'וּלְנָעֳמִי', morphemes: [], category: 'NOUN', translation: 'y para Noemí' },
                { hebrewText: 'מוֹדַע', hebrewWord: 'מוֹדַע', morphemes: [], category: 'NOUN', translation: 'un pariente' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.2.1" /></TooltipProvider>);
        expect(screen.getAllByTestId('ketiv-qere-mark')).toHaveLength(1);
        abrirFicha(1);
        expect(screen.getByTestId('ficha-panel').textContent).toContain('מידע');
    });
});

describe('el sufijo pronominal del dato a la página (revisión del profesor, Rut 3:3 כַּלֹּתוֹ)', () => {
    it('la ficha de la palabra alineada muestra la celda «Sufijo» desde el código OSHB', () => {
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [], infinitives: [], participles: [], kis: [], ketivQere: [],
            words: [{ r: '3!14', t: 'כַּלֹּתוֹ', l: '3615', m: 'HVpc/Sp3ms', role: 'v' }],
        };
        const analisis = { reference: 'Rut 3:3', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [{ hebrewText: 'כַּלֹּתוֹ', hebrewWord: 'כַּלֹּתוֹ', morphemes: [], category: 'VERB', translation: 'su terminar', verbMorphology: { binyan: 'PIEL', verbForm: 'INFINITIVE_CONSTRUCT' } }] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.3.3" /></TooltipProvider>);
        abrirFicha(0);
        expect(screen.getByTestId('ficha-panel').textContent).toContain('verseAnalyzer.ficha.cells.suffix');
        expect(screen.getByTestId('ficha-panel').textContent).toContain('verseAnalyzer.ficha.suffix.host.infinitive');
    });
});

describe('la waw disyuntiva y su valor, de la lectura a la ficha (revisión del profesor, Rut 2:10)', () => {
    it('la ficha de וְאָנֹכִי dice «waw disyuntiva» y el valor que eligió el asistente', () => {
        const w = { r: '10!13', t: 'וְאָנֹכִי', l: 'c/595', m: 'HC/Pp1cs', role: 's' };
        estado.estructura = {
            ...estado.estructura, unavailable: false, speech: [], infinitives: [], participles: [], kis: [], ketivQere: [],
            words: [w], ordinal: new Map([[w.r, 0]]),
            nodes: [{ index: 7, depth: 0, words: [{ r: w.r, t: w.t, role: 's' }], connector: w.r, relation: 'disjunctive', isApodosis: false, verbless: true, fronted: [] }] as never,
        };
        const analisis = { reference: 'Rut 2:10', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [], promptVersion: 4,
            clauseReadings: [{ index: 7, anchor: w.r, value: 'circunstancia', explanation: 'x', resolved: 'circumstantial' }],
            words: [{ hebrewText: 'וְאָנֹכִי', hebrewWord: 'וְאָנֹכִי', morphemes: [], category: 'PRONOUN', translation: 'siendo yo' }] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} verseReference="Ruth.2.10" /></TooltipProvider>);
        abrirFicha(0);
        expect(screen.getByTestId('ficha-panel').textContent).toContain('resolved.circumstantial');
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
        abrirFicha(1);
        const nota = screen.getAllByTestId('speech-note')[0]!.textContent!;
        expect(nota).toContain('{"speaker":"Rut"}');
        expect(nota).toContain('verseAnalyzer.speech.rule');
    });
});

describe('R4: del dato a la tarjeta resumen y a la ficha', () => {
    it('la función del infinitivo llega a la tarjeta resumen y a la ficha de la palabra alineada (Gn 19:22 «עַד בֹּאֲךָ»)', () => {
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
        // En la tarjeta resumen, sin abrir nada: la función en una línea, con su origen.
        const tarjeta = screen.getAllByTestId('tarjeta-resumen')[1]!.textContent!;
        expect(tarjeta).toContain('verseAnalyzer.infinitive.functions.temporalUntil');
        expect(tarjeta).toContain('wordFicha.origin.rule');
        abrirFicha(1);
        expect(screen.getByTestId('ficha-panel').textContent).toContain('wordFicha.reference');
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
        abrirFicha(1);
        const nota = screen.getAllByTestId('participle-note')[0]!.textContent!;
        expect(nota).toContain('verseAnalyzer.participle.functions.predicateFuture');
        expect(nota).toContain('wordFicha.origin.assistant');
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
        abrirFicha(2);
        const nota = screen.getAllByTestId('ki-note')[0]!.textContent!;
        expect(nota).toContain('verseAnalyzer.ki.functions.asseverative');
        expect(nota).toContain('wordFicha.origin.assistant');
    });
});

describe('la ficha en el panel lateral', () => {
    it('tocar la palabra en el versículo abre su ficha; «siguiente» pasa a la otra sin cerrar', () => {
        estado.estructura = { ...estado.estructura, unavailable: true, speech: [], infinitives: [], participles: [], kis: [], ketivQere: [] };
        const analisis = { reference: 'Rut 1:16', hebrewText: '', literalTranslation: '', fluidTranslation: '', verbTable: [], exegeticalNotes: [],
            words: [
                { hebrewText: 'רוּת', hebrewWord: 'רוּת', morphemes: [], category: 'NOUN', translation: 'Rut' },
                { hebrewText: 'תֵּלְכִי', hebrewWord: 'תֵּלְכִי', morphemes: [], category: 'VERB', translation: 'vayas' },
            ] };
        render(<TooltipProvider><VerseAnalysisResult analysis={analisis as never} /></TooltipProvider>);
        fireEvent.click(screen.getAllByText('רוּת')[0]!);
        const panel = () => screen.getByTestId('ficha-panel');
        expect(panel().textContent).toContain('«Rut»');
        fireEvent.click(screen.getByLabelText('wordFicha.next'));
        expect(panel().textContent).toContain('«vayas»');
        expect(screen.getByLabelText('wordFicha.next')).toBeDisabled();
    });
});
