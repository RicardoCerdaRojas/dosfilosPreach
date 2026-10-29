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

/** Revisión adversarial de 8b (E3). */
describe('reviewProseFixed — bordes de la revisión', () => {
    it('el «;» griego (interrogación) y la cursiva no son un cierre doble', () => {
        expect(kinds('Primera oración. El texto dice πόθεν πόλεμοι καὶ πόθεν μάχαι ἐν ὑμῖν; y lo responde enseguida.')).toEqual([]);
        expect(kinds('Primera oración. La pregunta *¿de dónde vienen; las guerras?* se responde así.')).toEqual([]);
    });

    it('«, y así» sí cierra doble', () => {
        expect(kinds('Primera oración. La petición es mala, y así Dios no responde.')).toEqual(['double-closing']);
    });

    it('la grave no cruza de un párrafo al otro; una fecha no es un rango', () => {
        expect(kinds('Dice ἀδελφοί\n\nἘκ τούτου sigue el texto.')).toEqual([]);
        expect(kinds('Entregado el 2026-10 según el curso.')).toEqual([]);
    });

    it('un criterio ausente no pasa por presente con palabras de raíz parecida', () => {
        const a = analisis({
            questionAnswers: [{
                questionNumber: 1, directAnswer: 'x', options: [], decision: 'y',
                decisiveCriterion: { text: 'La concesión permite incluir la voz media', whyThisOverThat: '', sources: [] },
            }],
        });
        // Con cinco letras, «conce», «permi» e «inclu» daban el criterio por presente.
        expect(kinds('Mayor concede incluso permisos amplios.', a)).toContain('missing-criterion');
    });
});

describe('proseReviewCriteria — las nueve reglas del plan no duplican las de serie', () => {
    it('las reglas que repiten un criterio con otras palabras no se suman', () => {
        const PLAN = [
            'Cada oración de cierre afirma una sola cosa; dos afirmaciones van en dos oraciones.',
            'La categoría gramatical tiene que coincidir con la traducción: si es genitivo descriptivo, la traducción no puede ser atributiva. Decir qué sustantivo califica a cuál.',
            'Refutar una lectura rival con una razón del contexto, no repitiendo la definición de la categoría.',
            'Si se anuncia un respaldo, decir qué aporta cada dato.',
            'Un criterio decisivo tiene que distinguir entre las lecturas: si se cumple con las dos, no decide.',
            'Toda afirmación muestra su relevancia para la pregunta, o se quita.',
            'No usar la clasificación de un elemento para decidir otro sin mostrar la relación entre los dos.',
            'Responder a cómo clasifica la gramática del curso la construcción, con su página.',
            'Títulos entre « »; rangos de páginas y versículos con raya corta (–); concordancia, tildes y acentos griegos.',
        ];
        const base = proseReviewCriteria('es');
        const con = proseReviewCriteria('es', PLAN);
        // Solo la de títulos y raya es nueva.
        expect(con.length - base.length).toBeLessThanOrEqual(1);
    });
});

/** TP #9 (Santiago 4:11-17, 2026-10-28), casos leídos en producción. */
describe('TP #9 · la gramática del curso en una cita de varias páginas o compuesta (B37)', () => {
    const CLAVES9 = ['Wallace', 'Robertson', 'Tuggy', 'McCartney', 'Varner'];
    const conCitas = analisis({
        questionAnswers: [{
            questionNumber: 2, directAnswer: 'x', options: [], decision: 'y',
            decisiveCriterion: {
                text: 'x', whyThisOverThat: '',
                sources: [{ sourceKey: 'Wallace', page: 232 }, { sourceKey: 'Robertson', page: 574 }],
            },
        }],
    });
    const fijos = (prose: string) => reviewProseFixed({ prose, analysis: conCitas, citationKeys: CLAVES9, grammarKeys: ['Wallace', 'Robertson'] })
        .filter(f => f.kind === 'missing-grammar');

    it('«(Wallace, p. 232, 236)» cita la 232 (4:14)', () => {
        const prosa = 'Wallace reconoce aquí el uso sustantivador del artículo y traduce la construcción como aquello que pertenece al mañana (Wallace, p. 232, 236). Tuggy incluye este empleo de ἀντί entre los que expresan sustitución, mientras Robertson lo describe como sustitución de perspectivas (Tuggy, p. 90; Robertson, p. 574).';
        expect(fijos(prosa)).toEqual([]);
    });

    it('la segunda cita de un paréntesis cuenta (4:15)', () => {
        expect(fijos('Sustitución (Tuggy, 90; Robertson, 574). Artículo (Wallace, 232).')).toEqual([]);
    });

    it('un rango abreviado «559–61» cubre la 560, como lo lee el verificador', () => {
        const a = analisis({ commentatorEngagement: [{ commentator: 'Wallace', sourceKey: 'Wallace', page: 560, position: 'x', evaluation: '' } as never] });
        const f = reviewProseFixed({ prose: 'Es causal (Wallace, 559–61).', analysis: a, citationKeys: CLAVES9, grammarKeys: ['Wallace'] });
        expect(f.map(x => x.kind)).not.toContain('missing-grammar');
    });

    it('si de verdad falta, se sigue avisando', () => {
        expect(fijos('Sustitución (Tuggy, 90). Artículo (Wallace, 236).').map(f => f.data)).toEqual([
            { key: 'Wallace', page: 232 }, { key: 'Robertson', page: 574 },
        ]);
    });
});

describe('TP #9 · la traducción adoptada en el cierre contra la del análisis (B31)', () => {
    const FINAL_14 = 'Aunque no saben lo que traerá el mañana. ¿Qué es su vida? Pues ustedes son un vapor que aparece por poco tiempo y después desaparece.';
    const cierre = (t: string) => `Primer párrafo del análisis.\n\nLa metáfora del vapor permite caracterizar la existencia de los destinatarios como pasajera. Por ello, se prefiere expresar el contraste entre desconocimiento del mañana y fragilidad humana mediante la traducción: ${t}`;
    const con = (final: string) => analisis({ finalTranslation: final });
    const mismatch = (prose: string, final: string) => reviewProseFixed({ prose, analysis: con(final) }).filter(f => f.kind === 'translation-mismatch');

    it('4:14: el cierre perdió el «Aunque» concesivo del análisis', () => {
        const f = mismatch(cierre('«No saben lo que traerá el mañana. ¿Qué es su vida?»'), FINAL_14);
        expect(f).toEqual([{ kind: 'translation-mismatch', excerpt: 'No saben lo que traerá el mañana. ¿Qué es su vida?', data: { analysis: FINAL_14 } }]);
    });

    it('4:14 corregido: «aunque no saben…» (minúscula, parte del versículo) coincide', () => {
        expect(mismatch(cierre('«aunque no saben lo que traerá el mañana. ¿Qué es su vida?»'), FINAL_14)).toEqual([]);
    });

    it('4:12: una frase de la traducción basta («el que puede salvar y destruir»)', () => {
        const prosa = 'Uno.\n\nPara expresar que la capacidad de salvar y destruir identifica al único legislador y juez, se adopta la traducción apositiva «el que puede salvar y destruir».';
        expect(mismatch(prosa, 'Uno solo es legislador y juez, el que puede salvar y destruir; pero tú, ¿quién eres, tú que juzgas al prójimo?')).toEqual([]);
        // La versión del análisis que decía «que puede» (atributiva) sí difiere.
        expect(mismatch(prosa, 'Uno solo es legislador y juez, que puede salvar y destruir; pero tú, ¿quién eres, tú que juzgas al prójimo?')).toHaveLength(1);
    });

    it('4:15 y 4:17: comillas anidadas, dos puntos y texto entre «traducción» y la cita', () => {
        const p15 = 'Uno.\n\nSe adopta, por ello, la traducción: «En lugar de eso, deberían decir: “Si el Señor quiere, viviremos y haremos esto o aquello”».';
        expect(mismatch(p15, 'En lugar de eso, deberían decir: «Si el Señor quiere, viviremos y haremos esto o aquello».')).toEqual([]);
        const p17 = 'Uno.\n\nSe adopta, por ello, una traducción que presenta la omisión del bien conocido como pecado: «Por tanto, al que sabe hacer el bien y no lo hace, le es pecado».';
        expect(mismatch(p17, 'Por tanto, al que sabe hacer el bien y no lo hace, le es pecado.')).toEqual([]);
    });

    it('una pregunta que abre con «¿» dentro de la oración empieza ahí', () => {
        const prosa = 'Uno.\n\nSe adopta la traducción «¿quién eres, tú que juzgas al prójimo?».';
        expect(mismatch(prosa, 'Uno solo es legislador y juez; pero tú, ¿quién eres, tú que juzgas al prójimo?')).toEqual([]);
    });

    it('la «traducción» de un párrafo que no es el cierre no cuenta; sin traducción final, nada', () => {
        const prosa = 'La traducción «deberían decir» no presupone un modal equivalente a la traducción «deber».\n\nCierre sin traducción adoptada.';
        expect(mismatch(prosa, 'En lugar de eso, deberían decir: «Si el Señor quiere…».')).toEqual([]);
        expect(reviewProseFixed({ prose: cierre('«No saben.»'), analysis: con('') }).map(f => f.kind)).not.toContain('translation-mismatch');
    });

    it('la traducción rechazada no cuenta como adoptada (revisión)', () => {
        const prosa = 'Uno.\n\nPor el contexto forense se prefiere «condenar» y no la traducción «juzgar» de la RVR60.';
        expect(mismatch(prosa, 'No condenen al hermano.')).toEqual([]);
        // Sin verbo de adopción, tampoco: «la traducción «juzgar» es la de la RVR60».
        expect(mismatch('Uno.\n\nLa traducción «juzgar» es la de la RVR60.', 'No condenen al hermano.')).toEqual([]);
    });

    it('un punto solo al final de la comilla no vuelve oración a una frase (revisión)', () => {
        const prosa = 'Uno.\n\nSe adopta la traducción apositiva «el que puede salvar y destruir.»';
        expect(mismatch(prosa, 'Uno solo es legislador y juez, el que puede salvar y destruir; pero tú, ¿quién eres?')).toEqual([]);
    });

    it('la indicación para recomponer lleva las dos traducciones', () => {
        const f = mismatch(cierre('«No saben lo que traerá el mañana. ¿Qué es su vida?»'), FINAL_14);
        expect(proseReviewGuidance(f, [], 'es')).toContain('pero la traducción final del análisis es «Aunque no saben');
    });
});
