import { describe, it, expect } from 'vitest';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { VerifiedCitation } from '../../entities/CitationVerification';
import { grammarCitationsOf, proseReviewCriteria, proseReviewGuidance, reviewProseFixed } from '../proseReview';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8b, E3): lo que quedó para
 * corregir a mano después de recomponer la prosa con la lista del profesor.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 3, verseEnd: 3 } as const;
const CLAVES = ['Mayor', 'Adamson', 'Tuggy', 'Kittel', 'Wallace', 'NA28'];
const GRAMATICAS = ['Wallace'];

const analisis = (over: Partial<CanonicalVerseAnalysis> = {}): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis(REF as never),
    ...over,
} as CanonicalVerseAnalysis);

const kinds = (prose: string, a: CanonicalVerseAnalysis | null = null, extra = {}) =>
    reviewProseFixed({ prose, analysis: a, citationKeys: CLAVES, grammarKeys: GRAMATICAS, ...extra }).map(f => f.kind);

describe('el criterio decisivo del análisis (4:3 retrocedió a κακῶς)', () => {
    const conCriterio = analisis({
        questionAnswers: [{
            questionNumber: 2,
            directAnswer: 'No hay distinción de voces',
            options: [],
            decisiveCriterion: {
                text: 'Mayor concede que la activa puede incluir la fuerza de la voz media cuando no existe razón especial',
                whyThisOverThat: 'la concesión del propio defensor',
                sources: [{ sourceKey: 'Mayor', page: 133 }],
            },
            decision: 'sin distinción',
        }],
    });

    it('la prosa que decide por κακῶς no lo trae: se avisa con la pregunta', () => {
        const prosa = 'La distinción entre αἰτεῖτε y αἰτεῖσθε se resuelve por κακῶς: el problema es el motivo de la petición (Adamson, 169).';
        const f = reviewProseFixed({ prose: prosa, analysis: conCriterio, citationKeys: CLAVES });
        expect(f).toContainEqual(expect.objectContaining({ kind: 'missing-criterion', data: expect.objectContaining({ question: 2 }) }));
    });

    it('la que usa la concesión, no', () => {
        const prosa = 'El propio Mayor concede que la activa puede incluir la fuerza de la media cuando no existe una razón especial para distinguirlas (Mayor, 133).';
        expect(kinds(prosa, conCriterio)).not.toContain('missing-criterion');
    });
});

describe('la gramática del curso (4:5 omitió Wallace 533)', () => {
    const conWallace = analisis({
        syntacticAnalysis: {
            mainVerb: { text: 'λέγει', morphology: 'presente indicativo', syntacticFunction: 'presente perfectivo', interpretiveSignificance: 'Introduce la Escritura como vigente (Wallace, p. 533).' },
            keyConstructions: [],
        } as never,
    });

    it('lee la cita dentro del texto de la sintaxis', () => {
        expect(grammarCitationsOf(conWallace, GRAMATICAS)).toEqual([{ key: 'Wallace', page: 533 }]);
    });

    it('si la prosa no la cita, avisa con clave y página', () => {
        const f = reviewProseFixed({ prose: 'λέγει introduce la cita (Mayor, 135).', analysis: conWallace, citationKeys: CLAVES, grammarKeys: GRAMATICAS });
        expect(f).toContainEqual({ kind: 'missing-grammar', excerpt: '', data: { key: 'Wallace', page: 533 } });
    });

    it('si la cita, no', () => {
        expect(kinds('λέγει es un presente perfectivo (Wallace, 533).', conWallace)).not.toContain('missing-grammar');
    });
});

describe('las citas sin respaldo', () => {
    const v = (over: Partial<VerifiedCitation>): VerifiedCitation => ({
        raw: '(Adamson, p. 171)', author: 'Adamson', title: '', pages: '171', offset: 0, evidence: 'x', evidenceIsQuoted: false,
        status: 'not-found', matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null, ...over,
    });
    const conAdamson = analisis({
        commentatorEngagement: [{ commentator: 'Adamson', sourceKey: 'Adamson', page: 171, position: 'enumera las propuestas', evaluation: '' } as never],
    });

    it('la prosa repite la cita del análisis que no se encontró (Adamson 171)', () => {
        const f = reviewProseFixed({
            prose: 'El origen de la cita es incierto (Adamson, 171).',
            analysis: conAdamson,
            verdicts: [v({ origin: 'analysis' })],
            citationKeys: CLAVES,
        });
        expect(f).toContainEqual(expect.objectContaining({ kind: 'repeated-alert', data: { status: 'not-found' } }));
    });

    it('revisada a mano, ya no', () => {
        const f = reviewProseFixed({
            prose: 'El origen de la cita es incierto (Adamson, 171).',
            analysis: conAdamson,
            verdicts: [v({ origin: 'analysis' })],
            reviews: [{ path: 'commentatorEngagement[0]' }],
            citationKeys: CLAVES,
        });
        expect(f.map(x => x.kind)).not.toContain('repeated-alert');
    });

    it('una cita de la prosa con alarma, sin revisar', () => {
        const f = reviewProseFixed({
            prose: 'Envidiar (Tuggy, 931).',
            analysis: null,
            verdicts: [v({ origin: 'prose', raw: '(Tuggy, 931)', author: 'Tuggy', pages: '931', offset: 10 })],
            citationKeys: CLAVES,
        });
        expect(f).toContainEqual({ kind: 'unverified-citation', excerpt: 'Tuggy, 931', data: { status: 'not-found' } });
    });

    it('verificada, no', () => {
        const f = reviewProseFixed({ prose: 'Xy (Tuggy, 938).', analysis: null, verdicts: [v({ origin: 'prose', status: 'verified' })], citationKeys: CLAVES });
        expect(f).toEqual([]);
    });
});

describe('lo mecánico del Word', () => {
    it('raya corta en rangos de páginas y versículos', () => {
        const f = reviewProseFixed({ prose: 'Santiago 4:1-10 y la entrada (Tuggy, 584-585).', analysis: null, citationKeys: CLAVES });
        expect(f.filter(x => x.kind === 'hyphen-range').map(x => x.replacement)).toEqual(['4:1–10', '584–585']);
    });

    it('no confunde un guion de palabra ni una dirección', () => {
        expect(kinds('El greco-romano y https://x.org/?p=12-15 no son rangos.')).toEqual([]);
    });

    it('«διά τό» lleva grave', () => {
        const f = reviewProseFixed({ prose: 'La construcción διά τό μὴ αἰτεῖσθαι es causal.', analysis: null });
        expect(f).toContainEqual({ kind: 'greek-grave', excerpt: 'διά τό', replacement: 'διὰ τό' });
        expect(f).toContainEqual({ kind: 'greek-grave', excerpt: 'τό μὴ', replacement: 'τὸ μὴ' });
    });

    it('el oxítono ante puntuación, ante enclítica o el interrogativo conservan el agudo', () => {
        expect(kinds('Dice αὐτός. Y ἀδελφοί μου, y τί ἐστιν, y «καλός» solo.')).toEqual([]);
    });

    it('comas dobles', () => {
        const f = reviewProseFixed({ prose: 'parte del cuerpo,, dato que importa.', analysis: null });
        expect(f).toContainEqual(expect.objectContaining({ kind: 'punctuation', replacement: 'cuerpo, dato' }));
    });

    it('un párrafo que abre en minúscula, también en griego', () => {
        expect(kinds('φονεύετε abre el versículo.\n\nΜέλεσιν abre el otro.')).toEqual(['lowercase-start']);
    });

    it('una lista no es un párrafo', () => {
        expect(kinds('- primera\n- segunda')).toEqual([]);
    });
});

describe('el cierre que afirma dos cosas y la síntesis', () => {
    it('un cierre con punto y coma', () => {
        const f = reviewProseFixed({ prose: 'Primera oración. Así, la petición es mala; por eso Dios no responde.', analysis: null });
        expect(f).toContainEqual({ kind: 'double-closing', excerpt: 'Así, la petición es mala; por eso Dios no responde.' });
    });

    it('ni el de una traducción entre « », ni la morfología repetida (TP #8, medido)', () => {
        expect(kinds('Primera oración. Jacobo dice: «Sienten envidia y no pueden alcanzar; entonces combaten».')).toEqual([]);
        expect(kinds('Uno es presente activo indicativo, segunda persona plural. Otro es presente activo indicativo, segunda persona plural.')).toEqual([]);
    });

    it('la oración que empieza dentro de una cita partida, y el nombre de una fuente (TP #8, medido)', () => {
        expect(kinds('Traduce: «Desean. Sienten envidia; entonces combaten». Así queda.')).toEqual([]);
        const f = reviewProseFixed({ prose: 'Lo dicen Kittel y Friedrich (Kittel, 32). Según Kittel y Friedrich, no.', analysis: null, citationKeys: ['Kittel y Friedrich'] });
        expect(f.map(x => x.kind)).not.toContain('repetition');
    });

    it('el punto y coma dentro de la cita no cuenta, y «p.» no corta la oración', () => {
        expect(kinds('Primera oración. Así lo dice (Mayor, p. 133; Adamson, p. 169).')).toEqual([]);
    });

    it('«provisionalmente» dos veces y «paralelos más cercanos» en dos oraciones', () => {
        const f = reviewProseFixed({
            prose: 'Se adopta provisionalmente la lectura. Los paralelos más cercanos son Gn 6:3. Se mantiene provisionalmente. Esos paralelos más cercanos no deciden.',
            analysis: null,
        });
        const r = f.filter(x => x.kind === 'repetition').map(x => x.excerpt);
        expect(r).toContain('provisionalmente');
        expect(r).toContain('paralelos más cercanos');
    });
});

describe('los criterios y la indicación para recomponer', () => {
    it('los criterios del curso se suman sin duplicar los de serie', () => {
        const base = proseReviewCriteria('es');
        const con = proseReviewCriteria('es', [base[1]!, 'Tercera persona en todo el trabajo.']);
        expect(con).toHaveLength(base.length + 1);
        expect(con.at(-1)).toBe('Tercera persona en todo el trabajo.');
    });

    it('la indicación lleva lo argumentativo y deja lo mecánico para corregir a mano', () => {
        const g = proseReviewGuidance(
            [
                { kind: 'missing-grammar', excerpt: '', data: { key: 'Wallace', page: 533 } },
                { kind: 'hyphen-range', excerpt: '584-585', replacement: '584–585' },
            ],
            [{ criterion: 6, quote: 'por κακῶς', problem: 'El criterio se cumple con las dos lecturas.', fix: 'Usar la concesión de Mayor 133.' }],
            'es',
        );
        expect(g).toContain('Si corresponde, incluye cómo lo clasifica la gramática del curso (Wallace, p. 533)');
        expect(g).toContain('En «por κακῶς»: El criterio se cumple con las dos lecturas. → Usar la concesión de Mayor 133.');
        expect(g).not.toContain('584');
    });

    it('sin hallazgos, sin indicación', () => {
        expect(proseReviewGuidance([], [], 'es')).toBe('');
    });
});
