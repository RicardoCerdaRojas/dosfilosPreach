import { describe, expect, it } from 'vitest';
import { hasCriterionPremises,
    buildEmptyCanonicalVerseAnalysis,
    criterionInference,
    criterionPremises,
    criterionStatement,
    type CanonicalVerseAnalysis,
    type DecisiveCriterion,
} from '../../entities/CanonicalVerseAnalysis';
import { collectAnalysisClaims } from '../analysisClaims';
import { editCitationAt, parseCitationPath } from '../citationCorrection';
import { serializeAnalysis } from '../serializeAnalysis';
import { renderVerseAnalysisProse } from '../renderVerseAnalysisProse';

/**
 * P2 (etapa 4): el análisis separa sus inferencias de lo que dicen las
 * fuentes. En el TP #9 el modelo escribió cuatro veces la síntesis y la colgó
 * de fuentes que solo daban las premisas.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 };
const conCriterio = (decisiveCriterion: DecisiveCriterion): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis(REF as never),
    commentatorEngagement: [{ sourceKey: 'McCartney', page: 225, position: 'p', engagement: 'e' }],
    questionAnswers: [{
        questionNumber: 1, directAnswer: 'apositiva', decision: 'apositiva',
        options: [{ reading: 'apositiva', argument: 'paralelo', defenders: [{ sourceKey: 'Robertson', page: 778 }] }],
        decisiveCriterion,
    }],
} as unknown as CanonicalVerseAnalysis);

/** Como lo guardó el TP #9 (4:12) antes de P2: la síntesis colgada de Robertson. */
const VIEJO: DecisiveCriterion = {
    text: 'El paralelo entre las dos cláusulas participiales favorece la identificación apositiva de sus referentes.',
    whyThisOverThat: 'la lectura atributiva no explica el paralelo',
    sources: [{ sourceKey: 'Robertson', page: 778 }] as never,
};
const NUEVO: DecisiveCriterion = {
    text: 'El paralelo entre las dos cláusulas participiales favorece la identificación apositiva.',
    inference: 'El paralelo entre las dos cláusulas participiales favorece la identificación apositiva.',
    whyThisOverThat: 'la lectura atributiva no explica el paralelo',
    sources: [],
    premises: [
        { text: 'Robertson clasifica ὁ κρίνων como participio articular en aposición a σύ.', sources: [{ sourceKey: 'Robertson', page: 778 }] as never },
        { text: 'McCartney lee ὁ δυνάμενος como predicado de εἷς.', sources: [{ sourceKey: 'McCartney', page: 226 }] as never },
    ],
};

describe('un análisis guardado antes de P2 se lee igual, sin migrar', () => {
    it('su criterio es una sola premisa, sin inferencia aparte', () => {
        expect(criterionPremises(VIEJO)).toEqual([{ text: VIEJO.text, sources: VIEJO.sources }]);
        expect(criterionInference(VIEJO)).toBeNull();
        expect(criterionStatement(VIEJO)).toBe(VIEJO.text);
    });

    it('enumera sus citas en el mismo orden, con las mismas rutas y el mismo texto: los veredictos guardados se identifican por ese lugar', () => {
        const claims = collectAnalysisClaims(conCriterio(VIEJO));
        expect(claims.map(c => c.path)).toEqual([
            'commentatorEngagement[0]',
            'questionAnswers[0].options[0].defenders[0]',
            'questionAnswers[0].decisiveCriterion.sources[0]',
        ]);
        expect(claims[2]!.claim).toBe(VIEJO.text);
    });

    it('el compositor lo recibe como siempre', () => {
        expect(serializeAnalysis(conCriterio(VIEJO), 'es')).toContain(`· decisive criterion: ${VIEJO.text} — why this and not the other: ${VIEJO.whyThisOverThat} (sources: Robertson`);
    });
});

describe('la forma con premisas', () => {
    it('cada fuente se coteja con SU premisa; la inferencia no lleva cita ni se verifica', () => {
        const claims = collectAnalysisClaims(conCriterio(NUEVO)).filter(c => c.path.includes('decisiveCriterion'));
        expect(claims.map(c => [c.path, c.claim])).toEqual([
            ['questionAnswers[0].decisiveCriterion.premises[0].sources[0]', NUEVO.premises![0]!.text],
            ['questionAnswers[0].decisiveCriterion.premises[1].sources[0]', NUEVO.premises![1]!.text],
        ]);
    });

    it('la ruta de una premisa se puede recorrer y corregir', () => {
        for (const c of collectAnalysisClaims(conCriterio(NUEVO))) expect(parseCitationPath(c.path), c.path).not.toBeNull();
        const a = editCitationAt(conCriterio(NUEVO), 'questionAnswers[0].decisiveCriterion.premises[1].sources[0]', { kind: 'page', page: 230, pageKind: 'printed' });
        expect(a.questionAnswers![0]!.decisiveCriterion.premises![1]!.sources[0]!.page).toBe(230);
        expect(a.questionAnswers![0]!.decisiveCriterion.premises![0]!.sources[0]!.page).toBe(778);
    });

    it('el compositor recibe la inferencia como propia, sin cita, y cada premisa con su fuente', () => {
        const texto = serializeAnalysis(conCriterio(NUEVO), 'es');
        expect(texto).toContain(`decisive criterion (the analysis's own inference — write it in the prose as the paper's own, WITHOUT a citation): ${NUEVO.inference}`);
        expect(texto).toContain(`premise: ${NUEVO.premises![0]!.text} (sources: Robertson`);
    });

    it('la prosa de respaldo pone cada premisa con su cita y la inferencia sin ella', () => {
        const prosa = renderVerseAnalysisProse(conCriterio(NUEVO), 'es');
        expect(prosa).toContain('Robertson clasifica ὁ κρίνων como participio articular en aposición a σύ');
        expect(prosa).toContain(`De ahí, el criterio que decide: ${NUEVO.inference}`);
    });

    it('una premisa sin su última cita no se atribuye, ni en la prosa ni al redactar', () => {
        const criterio = { ...NUEVO, premises: [{ text: 'Varner representa τὸ como objeto.', sources: [] }, ...NUEVO.premises!] };
        expect(renderVerseAnalysisProse(conCriterio(criterio), 'es')).not.toContain('Varner representa');
        expect(serializeAnalysis(conCriterio(criterio), 'es')).not.toContain('Varner representa');
    });

    it('sin premisas, el análisis se dice sin fuente y no se le atribuye a nadie', () => {
        const criterio = { ...NUEVO, sources: [], premises: [] };
        expect(hasCriterionPremises(criterio)).toBe(true);
        expect(serializeAnalysis(conCriterio(criterio), 'es')).toContain('no source supports this criterion');
    });

    it('una inferencia vacía no deja una oración vacía', () => {
        const criterio = { ...NUEVO, inference: '', text: '' };
        expect(renderVerseAnalysisProse(conCriterio(criterio), 'es')).not.toContain('el criterio que decide:');
    });
});
