import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { CitationVerifierInput, ExegeticalPaper, ICitationVerifier, VerifiedCitation } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({
            markLlmContacted: vi.fn(),
            refundIfPreLlm: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

// Una fuente del trabajo, sin pasar por la biblioteca.
const FUENTE_V = { corpusId: 'res-v', citationKey: 'Varner', fullAuthor: 'Varner', displayLabel: 'Varner', chunks: [{ text: 'relative clause', pageHint: 'p. 162' }], numbering: null };
vi.mock('../../../services/exegesis/VerifierSourcesBuilder', () => ({
    VerifierSourcesBuilder: class { async build() { return [FUENTE_V]; } },
}));

const { VerifyStepCitationsUseCase, verifiedVerdictsOf, stampSourceFingerprints } = await import('../VerifyStepCitationsUseCase');
const { sourceFingerprint } = await import('@dosfilos/domain');

/**
 * TP #9 (B46 y B35b): el caso de uso le pasa al verificador los veredictos
 * verdes de TODAS las versiones del paso —cada camino los suyos— y el pasaje.
 * Editar la prosa a mano crea una versión que nace sin los veredictos de la
 * prosa; la madre los conserva en `step.versions`.
 */
const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 14, verseEnd: 14 } as const;
const analisis = {
    ...buildEmptyCanonicalVerseAnalysis(REF),
    commentatorEngagement: [
        { sourceKey: 'Varner', page: 162, pageKind: 'printed', role: 'anchor', position: 'Distingue la relativa', verbatimQuote: null },
    ],
} as never;

const veredicto = (over: Partial<VerifiedCitation>): VerifiedCitation => ({
    raw: '(Varner, 162)', author: 'Varner', title: '', pages: '162', offset: 0, evidence: 'Varner distingue la relativa',
    evidenceIsQuoted: false, status: 'verified', matchedCorpusId: 'res-v', matchedSourceLabel: 'Varner', similarityScore: 1,
    matchedPage: '162', note: null, ...over,
});

function trabajo(): ExegeticalPaper {
    const madre = {
        id: 'v1', markdown: 'Varner distingue la relativa (Varner, 162).', canonicalAnalysis: analisis, createdAt: new Date('2026-10-28T19:46:00Z'),
        citationVerdicts: [
            veredicto({ origin: 'analysis', note: 'análisis' }),
            veredicto({ origin: 'prose', offset: 30, note: 'prosa de la madre' }),
            veredicto({ origin: 'prose', offset: 60, status: 'page-mismatch', note: 'alarma' }),
        ],
    };
    // La edición a mano: nace sin los veredictos de la prosa (`buildManualEditVersion`).
    const editada = {
        id: 'v2', markdown: 'Otra oración. Varner distingue la relativa (Varner, 162).', canonicalAnalysis: analisis,
        createdAt: new Date('2026-10-28T22:00:00Z'), parentVersionId: 'v1',
        citationVerdicts: [veredicto({ origin: 'analysis', note: 'análisis de la editada' })],
    };
    return {
        id: 'p1', ownerId: 'u1', displayLanguage: 'es', sources: [],
        steps: [{ id: 's1', kind: 'verse', verseRef: REF, order: 1, state: 'accepted', current: editada, accepted: editada, versions: [madre, editada] }],
    } as unknown as ExegeticalPaper;
}

describe('B46 · el caso de uso pasa los verdes de todas las versiones', () => {
    it('cada camino recibe los suyos —solo verdes, la versión más nueva primero— y el pasaje del paso', async () => {
        const llamadas: CitationVerifierInput[] = [];
        const espia: ICitationVerifier = {
            verify: async (input) => {
                llamadas.push(input);
                return { citations: (input.citations ?? []).map(c => ({ ...c, status: 'verified' }) as VerifiedCitation) };
            },
        };
        const repo = { getPaper: async () => trabajo(), setStepVersionVerifications: async () => undefined };
        await new VerifyStepCitationsUseCase(repo as never, { readResourceContent: async () => null } as never, espia)
            .execute({ ownerId: 'u1', paperId: 'p1', stepId: 's1' });

        const delAnalisis = llamadas.find(l => !!l.citations)!;
        const deLaProsa = llamadas.find(l => !l.citations)!;
        expect(delAnalisis.reuseVerified!.map(v => v.note)).toEqual(['análisis de la editada', 'análisis']);
        expect(deLaProsa.reuseVerified!.map(v => v.note)).toEqual(['prosa de la madre']);
        expect(delAnalisis.passageRef).toBe('Santiago 4:14');
        expect(deLaProsa.passageRef).toBe('Santiago 4:14');
    });

    it('lo que se guarda lleva la huella de la fuente (para poder reusarlo la próxima vez)', async () => {
        const guardados: VerifiedCitation[][] = [];
        const juez: ICitationVerifier = {
            verify: async (input) => ({ citations: (input.citations ?? []).map(c => ({ ...c, status: 'verified', matchedCorpusId: 'res-v' }) as VerifiedCitation) }),
        };
        const repo = {
            getPaper: async () => trabajo(),
            setStepVersionVerifications: async (_o: string, _p: string, _s: string, _v: string, _sum: unknown, cits: VerifiedCitation[]) => { guardados.push(cits); },
        };
        await new VerifyStepCitationsUseCase(repo as never, { readResourceContent: async () => null } as never, juez)
            .execute({ ownerId: 'u1', paperId: 'p1', stepId: 's1' });
        expect(guardados[0]!.length).toBeGreaterThan(0);
        expect(guardados[0]!.every(c => c.sourceFingerprint === sourceFingerprint(FUENTE_V))).toBe(true);
    });

    it('verifiedVerdictsOf no duplica `current`/`accepted`, que son versiones de la lista', () => {
        const paso = trabajo().steps[0]!;
        expect(verifiedVerdictsOf(paso).map(v => v.note)).toEqual(['análisis de la editada', 'análisis', 'prosa de la madre']);
    });
});

describe('B46 (revisión) · cada veredicto lleva la huella de la fuente con que se juzgó', () => {
    const fuente = FUENTE_V;

    it('la huella es la de la fuente COMPLETA del trabajo (no la de las hojas que releyó la búsqueda)', () => {
        const [conFuente, sinFuente, otra] = stampSourceFingerprints([
            veredicto({}),
            veredicto({ matchedCorpusId: null, status: 'not-found' }),
            veredicto({ matchedCorpusId: 'res-quitada' }),
        ], [fuente]);
        expect(conFuente!.sourceFingerprint).toBe(sourceFingerprint(fuente));
        expect(sinFuente).not.toHaveProperty('sourceFingerprint');
        expect(otra).not.toHaveProperty('sourceFingerprint');
    });
});
