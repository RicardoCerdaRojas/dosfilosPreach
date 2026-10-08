import { describe, it, expect } from 'vitest';
import { buildGreekInsightPrompt } from '../buildGreekInsightPrompt';
import { parseGreekInsight } from '../parseGreekInsight';
import type { GreekWordToken } from '../morphGntToken';

const tokens: GreekWordToken[] = [
    { text: 'Πᾶσαν', lemma: 'πᾶς', pos: 'A', tag: { case: 'A', number: 'S', gender: 'F' }, transliteration: 'Pasan' },
    { text: 'χαρὰν', lemma: 'χαρά', pos: 'N', tag: { case: 'A', number: 'S', gender: 'F' }, transliteration: 'charan' },
    {
        text: 'ἡγήσασθε,', lemma: 'ἡγέομαι', pos: 'V',
        tag: { person: '2', tense: 'A', voice: 'M', mood: 'D', number: 'P' }, transliteration: 'hēgēsasthe,',
    },
];

describe('buildGreekInsightPrompt', () => {
    const p = buildGreekInsightPrompt({ reference: 'Santiago 1:2', tokens });

    it('la morfología viaja RESUELTA y en palabras, no en códigos', () => {
        expect(p).toContain('verbo, aoristo, media, imperativo, 2ª persona, plural');
        expect(p).toContain('NO la recalcules');
        expect(p).not.toContain('2AMD');
    });

    it('exige el conteo exacto de palabras y pide el rango, no un sentido', () => {
        expect(p).toContain('EXACTAMENTE 3 palabras');
        expect(p).toContain('rango semántico del LEMA');
    });
});

describe('parseGreekInsight — el alineamiento es el contrato', () => {
    const valido = JSON.stringify({
        literalTranslation: 'Toda alegría considerad…',
        fluidTranslation: 'Considérenlo todo motivo de alegría…',
        words: [
            { text: 'Πᾶσαν', semanticRange: 'todo / cada / entero', syntacticFunction: 'modifica a χαρὰν', translation: 'toda' },
            { text: 'χαρὰν', semanticRange: 'alegría / gozo', syntacticFunction: 'objeto directo', translation: 'alegría' },
            { text: 'ἡγήσασθε,', semanticRange: 'considerar / estimar / guiar', syntacticFunction: 'verbo principal', translation: 'considerad' },
        ],
    });

    it('acepta la respuesta bien alineada', () => {
        const out = parseGreekInsight(valido, { reference: 'JAS 1:2', expectedWordCount: 3 });
        expect(out?.words).toHaveLength(3);
        expect(out?.words[1].semanticRange).toContain('gozo');
    });

    it('RECHAZA la respuesta con una palabra de menos — corrida es peor que ausente', () => {
        const corta = JSON.parse(valido);
        corta.words.pop();
        expect(parseGreekInsight(JSON.stringify(corta), { reference: 'JAS 1:2', expectedWordCount: 3 })).toBeNull();
    });

    it('rechaza campos vacíos y JSON roto', () => {
        const vacia = JSON.parse(valido);
        vacia.words[0].semanticRange = '';
        expect(parseGreekInsight(JSON.stringify(vacia), { reference: 'JAS 1:2', expectedWordCount: 3 })).toBeNull();
        expect(parseGreekInsight('no es json', { reference: 'JAS 1:2', expectedWordCount: 3 })).toBeNull();
    });

    it('tolera texto alrededor del JSON (fences del modelo)', () => {
        const out = parseGreekInsight('```json\n' + valido + '\n```', { reference: 'JAS 1:2', expectedWordCount: 3 });
        expect(out).not.toBeNull();
    });
});

describe('keyInsights — el "¿y qué?" homilético (fase 3)', () => {
    const base = {
        literalTranslation: 'lit', fluidTranslation: 'fluida',
        words: [{ text: 'χαίρειν.', semanticRange: 'a / b', syntacticFunction: 'f', translation: 't' }],
    };

    it('acepta hasta 3 claves bien formadas y descarta las malformadas SIN tumbar el análisis', () => {
        const out = parseGreekInsight(
            JSON.stringify({
                ...base,
                keyInsights: [
                    { text: 'χαίρειν.', significance: 'El infinitivo de saludo…' },
                    { text: '', significance: 'sin palabra' },
                    { text: 'x', significance: '' },
                ],
            }),
            { reference: 'JAS 1:1', expectedWordCount: 1 },
        );
        expect(out?.keyInsights).toHaveLength(1);
        expect(out?.words).toHaveLength(1);
    });

    it('un caché anterior (sin keyInsights) sigue siendo válido', () => {
        const out = parseGreekInsight(JSON.stringify(base), { reference: 'JAS 1:1', expectedWordCount: 1 });
        expect(out).not.toBeNull();
        expect(out?.keyInsights).toBeUndefined();
    });

    it('recorta a 3: sólo las palabras que cargan el peso, no una glosa por palabra', () => {
        const out = parseGreekInsight(
            JSON.stringify({
                ...base,
                keyInsights: Array.from({ length: 5 }, (_, i) => ({ text: `w${i}`, significance: 's' })),
            }),
            { reference: 'JAS 1:1', expectedWordCount: 1 },
        );
        expect(out?.keyInsights).toHaveLength(3);
    });
});

describe('caseFunction — la taxonomía es CERRADA (v5)', () => {
    const conFuncion = (caseFunction: string, nameNote = '') =>
        JSON.stringify({
            literalTranslation: 'lit',
            fluidTranslation: 'fluida',
            words: [{ text: 'Ἰάκωβος', semanticRange: 'a / b', syntacticFunction: 'f', translation: 'Santiago', caseFunction, nameNote }],
        });

    const parse = (raw: string) =>
        parseGreekInsight(raw, { reference: 'JAS 1:1', expectedWordCount: 1, cases: ['N'] });

    it('acepta una función válida para ESE caso — el caso real de Santiago 1:1', () => {
        expect(parse(conFuncion('absolute'))?.words[0].caseFunction).toBe('absolute');
    });

    it('DESCARTA una función que no pertenece al caso (no hay "posesión" nominativa)', () => {
        // El profesor del fundador la habría llamado mal; el sistema no la
        // repite. Una etiqueta con aire académico que nadie reconoce es peor
        // que ninguna: el pastor la repetiría en clase.
        expect(parse(conFuncion('possession'))?.words[0].caseFunction).toBeUndefined();
    });

    it('descarta una etiqueta inventada, y el resto del análisis sobrevive', () => {
        const out = parse(conFuncion('nominativoDeSaludoProfético'));
        expect(out?.words[0].caseFunction).toBeUndefined();
        expect(out?.words[0].translation).toBe('Santiago');
    });

    it('la nota del nombre viaja cuando tiene contenido', () => {
        const out = parse(conFuncion('absolute', 'Del latín Iacobus → "Sant Iago". El doblete culto es Jacobo.'));
        expect(out?.words[0].nameNote).toContain('Jacobo');
    });

    it('sin la lista de casos no se valida nada: la función se descarta', () => {
        const out = parseGreekInsight(conFuncion('absolute'), { reference: 'JAS 1:1', expectedWordCount: 1 });
        expect(out?.words[0].caseFunction).toBeUndefined();
    });
});

describe('articleUse — el artículo que abre Santiago 1:4 (v8)', () => {
    const conArticulo = (articleUse: string, antecedent = '') =>
        JSON.stringify({
            literalTranslation: 'lit',
            fluidTranslation: 'fluida',
            words: [{ text: 'ἡ', semanticRange: 'el / la', syntacticFunction: 'f', translation: 'la', articleUse, antecedent }],
        });
    const parse = (raw: string) =>
        parseGreekInsight(raw, { reference: 'JAS 1:4', expectedWordCount: 1, cases: ['N'] });

    it('el uso anafórico conserva su antecedente — el hilo entre versículos', () => {
        const out = parse(conArticulo('anaphoric', 'ὑπομονήν, v. 3'));
        expect(out?.words[0].articleUse).toBe('anaphoric');
        expect(out?.words[0].antecedent).toBe('ὑπομονήν, v. 3');
    });

    it('el antecedente SÓLO existe con anáfora: colgado de otro uso se descarta', () => {
        // "Señala hacia atrás" en un artículo genérico sería una relación
        // inventada entre versículos.
        expect(parse(conArticulo('generic', 'algo, v. 3'))?.words[0].antecedent).toBeUndefined();
    });

    it('descarta un uso inventado y el resto del análisis sobrevive', () => {
        const out = parse(conArticulo('articuloDeEnfasisProfetico'));
        expect(out?.words[0].articleUse).toBeUndefined();
        expect(out?.words[0].translation).toBe('la');
    });
});

describe('composition — ὁλόκληροι y la falacia de la raíz (v9)', () => {
    const conComposicion = (composition: unknown) =>
        JSON.stringify({
            literalTranslation: 'lit',
            fluidTranslation: 'fluida',
            words: [{ text: 'ὁλόκληροι', semanticRange: 'íntegro', syntacticFunction: 'f', translation: 'íntegros', composition }],
        });
    const parse = (raw: string) =>
        parseGreekInsight(raw, { reference: 'JAS 1:4', expectedWordCount: 1, cases: ['N'] });

    it('descompone ὁλόκληροι en sus dos raíces con glosa', () => {
        const out = parse(
            conComposicion({
                parts: [{ text: 'ὅλος', gloss: 'entero, completo' }, { text: 'κλῆρος', gloss: 'porción, parte' }],
                note: 'Entero en todas sus partes: sin que le falte ninguna.',
                meaningMatchesParts: true,
            }),
        );
        expect(out?.words[0].composition?.parts).toHaveLength(2);
        expect(out?.words[0].composition?.meaningMatchesParts).toBe(true);
    });

    it('EXIGE el veredicto sobre la falacia: sin él la descomposición se descarta', () => {
        // Mostrar partes sin decir si el uso las respalda INVITA al error que
        // se pretende prevenir.
        const out = parse(
            conComposicion({
                parts: [{ text: 'ὅλος', gloss: 'entero' }, { text: 'κλῆρος', gloss: 'porción' }],
                note: 'x',
            }),
        );
        expect(out?.words[0].composition).toBeUndefined();
    });

    it('una sola parte no es un compuesto', () => {
        const out = parse(
            conComposicion({ parts: [{ text: 'ὅλος', gloss: 'entero' }], note: 'x', meaningMatchesParts: true }),
        );
        expect(out?.words[0].composition).toBeUndefined();
    });
});

describe('lectura de cláusulas en el análisis griego (G1 + G5)', () => {
    const fila = {
        index: 7, depth: 0, words: [{ r: '2!1', t: 'Πᾶσαν', role: 'o' as const }, { r: '2!3', t: 'ἡγήσασθε,', role: 'v' as const }],
        connector: null, relation: 'main' as const, isApodosis: false, verbless: false,
        fronted: [{ r: '2!1', rs: ['2!1'], role: 'o' as const }],
    };

    it('con filas, el prompt las manda a LEER y pide "clauseReadings"; sin filas, no', () => {
        const con = buildGreekInsightPrompt({ reference: 'Santiago 1:2', tokens, structure: [fila] });
        expect(con).toContain('CLÁUSULAS:');
        expect(con).toContain('1. [nivel 0] Πᾶσαν ἡγήσασθε,');
        expect(con).toContain('"clauseReadings"');
        const sin = buildGreekInsightPrompt({ reference: 'Santiago 1:2', tokens });
        expect(sin).not.toContain('clauseReadings');
    });

    it('el parser valida la lectura contra las filas y la guarda', () => {
        const raw = JSON.stringify({
            literalTranslation: 'Toda alegría considerad', fluidTranslation: 'Considérenlo motivo de alegría',
            words: tokens.map(t => ({ text: t.text, semanticRange: 'x', syntacticFunction: 'y', translation: 'z' })),
            clauseReadings: [{ n: 1, value: 'mandato', explanation: 'Imperativo aoristo.', fronting: 'focus' }, { n: 5, value: 'x', explanation: 'y' }],
        });
        const r = parseGreekInsight(raw, { reference: 'Santiago 1:2', expectedWordCount: 3, structure: [fila] });
        expect(r?.clauseReadings).toEqual([{ index: 7, anchor: '2!1', value: 'mandato', explanation: 'Imperativo aoristo.', fronting: 'focus' }]);
        expect(parseGreekInsight(raw, { reference: 'Santiago 1:2', expectedWordCount: 3 })?.clauseReadings).toBeUndefined();
    });
});

describe('función de los verbos en el análisis griego (G2)', () => {
    const verbos = [{ ordinal: 2, form: 'imperative' as const, allowed: ['command', 'request'] as const, tenseUses: [] }];

    it('con verbos, el prompt pide "verbFunction" de la lista; sin verbos, no', () => {
        expect(buildGreekInsightPrompt({ reference: 'Santiago 1:2', tokens, verbs: verbos as never })).toMatch(/3\. ἡγήσασθε, — imperativo — "verbFunction", elige de: "command"/);
        expect(buildGreekInsightPrompt({ reference: 'Santiago 1:2', tokens })).not.toContain('verbFunction');
    });

    it('el parser guarda la función válida en la palabra del verbo', () => {
        const raw = JSON.stringify({
            literalTranslation: 'x', fluidTranslation: 'y',
            words: tokens.map((t, i) => ({ text: t.text, semanticRange: 'a', syntacticFunction: 'b', translation: 'c', ...(i === 2 ? { verbFunction: 'command', verbNote: 'Mandato puntual.' } : { verbFunction: 'command' }) })),
        });
        const r = parseGreekInsight(raw, { reference: 'Santiago 1:2', expectedWordCount: 3, verbs: verbos as never });
        expect(r?.words[2]).toMatchObject({ verbFunction: 'command', verbNote: 'Mandato puntual.' });
        // Una palabra que no es verbo no recibe función aunque el asistente la mande.
        expect(r?.words[0]).not.toHaveProperty('verbFunction');
    });
});

describe('claves por posición (G3)', () => {
    it('la posición vale sólo si en ella está esa palabra', () => {
        const raw = JSON.stringify({
            literalTranslation: 'x', fluidTranslation: 'y',
            words: tokens.map(t => ({ text: t.text, semanticRange: 'a', syntacticFunction: 'b', translation: 'c' })),
            keyInsights: [{ n: 2, text: 'χαρὰν', significance: 's' }, { n: 1, text: 'ἡγήσασθε,', significance: 't' }],
        });
        const r = parseGreekInsight(raw, { reference: 'Santiago 1:2', expectedWordCount: 3 });
        expect(r?.keyInsights?.[0]).toMatchObject({ index: 1, text: 'χαρὰν' });
        expect(r?.keyInsights?.[1]).not.toHaveProperty('index');
    });
});
