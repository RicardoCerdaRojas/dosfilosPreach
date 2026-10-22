import { describe, it, expect } from 'vitest';
import { verifyAttributedQuotes } from '../verifyAttributedQuotes';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { PassageReference } from '../../../bible/canon/passage-reference';

const VERSE: PassageReference = { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 1 };

// The real page that produced the bug this guard exists for.
const KITTEL_149 =
    'La relación con esta raíz muestra que δοῦλος denota enfáticamente al esclavo y la ' +
    'condición de esclavitud.\nPuesto que el grupo denota un servicio restrictivo, es el ' +
    'término apropiado para la relación entre gobernante y súbditos.\n' +
    'Es por esto que δοῦλοι es un título honorífico cuando se confiere a personajes tan ' +
    'sobresalientes como Moisés, Josué, Abraham, David y Jacob.';

function withCrux(position: {
    sourceKey: string;
    page: number;
    summary: string;
    supports: number;
    verbatimQuote?: string;
}): CanonicalVerseAnalysis {
    return {
        ...buildEmptyCanonicalVerseAnalysis(VERSE),
        translationCruxes: [{
            phrase: 'δοῦλος',
            description: 'Esclavo o siervo.',
            options: [
                { translation: 'siervo', characterization: 'honorífica' },
                { translation: 'esclavo', characterization: 'dura' },
            ],
            commentatorPositions: [position],
            commitment: { chosen: 'siervo', rationale: 'Tradición de los siervos de Dios.' },
        }],
    };
}

const sources = (text = KITTEL_149) => new Map([['Kittel', text]]);

describe('verifyAttributedQuotes', () => {
    it('keeps a position whose quote is in the source text', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 149,
            summary: 'Kittel enfatiza la condición de esclavitud.',
            supports: 1,
            verbatimQuote: 'δοῦλος denota enfáticamente al esclavo y la condición de esclavitud',
        });

        const out = verifyAttributedQuotes(analysis, sources());

        expect(out.dropped).toEqual([]);
        expect(out.analysis.translationCruxes[0].commentatorPositions).toHaveLength(1);
    });

    it('quita la cita inventada pero conserva la atribución', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 149,
            summary: 'Kittel dice que el servicio carece de toda autonomía.',
            supports: 1,
            verbatimQuote: 'el siervo carece por completo de autonomía y de voluntad propia',
        });

        const out = verifyAttributedQuotes(analysis, sources());

        // La atribución es del alumno y descansa en una fuente que sí
        // aportó texto; lo peligroso era la oración presentada como
        // palabras del autor.
        const positions = out.analysis.translationCruxes[0].commentatorPositions;
        expect(positions).toHaveLength(1);
        expect(positions[0].verbatimQuote).toBe('');
        // TP #8 (8b, C5): ya no se borra en silencio; queda para la revisión de citas.
        expect(positions[0].unverifiedQuote).toBe('el siervo carece por completo de autonomía y de voluntad propia');
        expect(positions[0].summary).toContain('carece de toda autonomía');
        expect(out.dropped).toEqual([
            { sourceKey: 'Kittel', page: 149, surface: 'crux', quote: 'el siervo carece por completo de autonomía y de voluntad propia' },
        ]);
    });

    it('forgives typography a faithful copy still changes', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 149,
            summary: 'Servicio restrictivo.',
            supports: 1,
            // Straightened quotes, collapsed newline, different case.
            verbatimQuote: 'Puesto que el grupo denota un    servicio restrictivo,\n es el TÉRMINO apropiado',
        });

        expect(verifyAttributedQuotes(analysis, sources()).dropped).toEqual([]);
    });

    it('does not forgive a reworded quote', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 149,
            summary: 'Servicio restrictivo.',
            supports: 1,
            // One word changed: "restrictivo" → "degradante".
            verbatimQuote: 'el grupo denota un servicio degradante',
        });

        expect(verifyAttributedQuotes(analysis, sources()).dropped).toHaveLength(1);
    });

    it('leaves a paraphrase with no quote alone', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 149,
            summary: 'Kittel recorre el trasfondo veterotestamentario.',
            supports: 1,
        });

        // The schema has always allowed paraphrase without a quote, and
        // older analyses carry none. Deleting those would rewrite
        // conclusions the student already accepted.
        expect(verifyAttributedQuotes(analysis, sources()).dropped).toEqual([]);
    });

    it('refuses to judge when the source text is unavailable', () => {
        const analysis = withCrux({
            sourceKey: 'Mayor',
            page: 307,
            summary: 'Mayor observa la omisión de "apóstol".',
            supports: 0,
            verbatimQuote: 'una cita que no podemos comprobar',
        });

        // Dropping on a guess would silently delete good work whenever a
        // source's text simply wasn't handed to this check.
        expect(verifyAttributedQuotes(analysis, sources()).dropped).toEqual([]);
    });

    it('applies the same rule to commentatorEngagement', () => {
        const analysis: CanonicalVerseAnalysis = {
            ...buildEmptyCanonicalVerseAnalysis(VERSE),
            commentatorEngagement: [
                {
                    sourceKey: 'Kittel',
                    page: 149,
                    role: 'contrast',
                    position: 'Real.',
                    verbatimQuote: 'δοῦλοι es un título honorífico',
                },
                {
                    sourceKey: 'Kittel',
                    page: 149,
                    role: 'anchor',
                    position: 'Inventada.',
                    verbatimQuote: 'Kittel rechaza de plano la lectura honorífica',
                },
            ],
        };

        const out = verifyAttributedQuotes(analysis, sources());

        const quotes = out.analysis.commentatorEngagement.map(c => c.verbatimQuote);
        expect(quotes).toEqual(['δοῦλοι es un título honorífico', '']);
        expect(out.analysis.commentatorEngagement.map(c => c.position)).toEqual(['Real.', 'Inventada.']);
        expect(out.dropped[0]).toMatchObject({ surface: 'commentator', sourceKey: 'Kittel' });
    });
});

describe('verifyAttributedQuotes — texto extraído de PDF', () => {
    // Real shape of the Spanish TDNT extraction: words broken across
    // line ends with a hyphen.
    const HYPHENATED =
        'Aparte de algunos casos en las parábolas, esta palabra figura en el sentido corriente\n' +
        'sólo cuando de lo que se trata es de la posición de los esclavos. Aquí el uso queda comple-\n' +
        'tamente dentro del marco social de la época, y la pala-\nbra no tiene menosprecio.';

    it('matches a quote whose words the PDF split across lines', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 150,
            summary: 'El uso es social.',
            supports: 0,
            // The model reads the hyphenated line break as one word and
            // quotes it whole — which is the correct transcription.
            verbatimQuote: 'Aquí el uso queda completamente dentro del marco social de la época',
        });

        expect(verifyAttributedQuotes(analysis, new Map([['Kittel', HYPHENATED]])).dropped).toEqual([]);
    });

    it('still rejects a reworded quote in hyphenated text', () => {
        const analysis = withCrux({
            sourceKey: 'Kittel',
            page: 150,
            summary: 'Inventada.',
            supports: 0,
            verbatimQuote: 'Aquí el uso queda parcialmente fuera del marco social de la época',
        });

        expect(verifyAttributedQuotes(analysis, new Map([['Kittel', HYPHENATED]])).dropped).toHaveLength(1);
    });
});

describe('verifyAttributedQuotes — citas que cruzan fragmentos', () => {
    it('acepta una cita que abarca dos fragmentos contiguos de la misma página', () => {
        // Lo que llega tras quitar los rótulos `--- p. 57 ---`: prosa
        // corrida, que es lo que era en el documento original.
        const source =
            'James is not, as is often held, here thinking of an alleged distinction '
            + 'between ‘internal’ and ‘external’ temptations. '
            + ' '
            + 'In the Christian life there is really no effective difference between the two: '
            + 'only the defects inherent in human nature make it possible for external or '
            + 'internal stimuli to goad a man into sin.';

        const analysis = withCrux({
            sourceKey: 'Adamson',
            page: 57,
            summary: 'No distingue tentación interna de externa.',
            supports: 0,
            verbatimQuote:
                'between ‘internal’ and ‘external’ temptations. '
                + 'In the Christian life there is really no effective difference between the two',
        });

        expect(verifyAttributedQuotes(analysis, new Map([['Adamson', source]])).dropped).toEqual([]);
    });
});

describe('verifyAttributedQuotes — citas que cruzan la costura entre fragmentos', () => {
    // Dos fragmentos de la misma página traídos por separado: entre
    // ellos falta el texto que el ranking no eligió.
    const FRAGMENTOS =
        'In truth, the meaning he calls less natural is the only one possible '
        + 'for our present πᾶσαν χαρὰν. '
        + ' [texto que el ranking no trajo] '
        + 'James does not say there is no greater joy than that of peirasmos: '
        + 'he does say that peirasmos is an occasion for unmixed joy.';

    it('acepta la cita cuando cada oración está en la fuente', () => {
        const analysis = withCrux({
            sourceKey: 'Adamson',
            page: 93,
            summary: 'Gozo sin mezcla.',
            supports: 0,
            verbatimQuote:
                'In truth, the meaning he calls less natural is the only one possible '
                + 'for our present πᾶσαν χαρὰν. '
                + 'James does not say there is no greater joy than that of peirasmos: '
                + 'he does say that peirasmos is an occasion for unmixed joy.',
        });

        expect(verifyAttributedQuotes(analysis, new Map([['Adamson', FRAGMENTOS]])).dropped).toEqual([]);
    });

    it('rechaza si una sola de las oraciones es inventada', () => {
        const analysis = withCrux({
            sourceKey: 'Adamson',
            page: 93,
            summary: 'Mezcla verdad con invención.',
            supports: 0,
            verbatimQuote:
                'In truth, the meaning he calls less natural is the only one possible '
                + 'for our present πᾶσαν χαρὰν. '
                + 'Adamson concluye que la alegría es incompatible con el sufrimiento real.',
        });

        expect(verifyAttributedQuotes(analysis, new Map([['Adamson', FRAGMENTOS]])).dropped).toHaveLength(1);
    });
});
