import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EMPTY_STEP_SOURCE_PLAN } from '@dosfilos/domain';
import type {
    ExegeticalPaper,
    ExegeticalStep,
    PageNumbering,
    PassageReference,
    ProjectSource,
    ProjectSourceExcerpt,
    SourceType,
    VerifierSource,
} from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({
            markLlmContacted: vi.fn(),
            refundIfPreLlm: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

const { VerifyStepCitationsUseCase } = await import('../VerifyStepCitationsUseCase');

/**
 * La unidad en la que el verificador compara.
 *
 * El cotejo de página enfrenta el número que dice la CITA contra el que dice el
 * FRAGMENTO de evidencia. La cita habla de la página impresa; el fragmento sale
 * del archivo y trae la hoja. Si nadie los pone en la misma unidad, el
 * verificador reprueba lo que está bien —y lo hace con 100 % de confianza, que
 * es la peor forma de equivocarse—.
 *
 * Caso real: Adamson, cuya hoja 65 imprime la 61. La cita decía «p. 61», la
 * evidencia decía «65», y el veredicto fue «citaste p. 61 pero el pasaje está
 * en 65». El mismo lugar, dicho de dos maneras.
 */
const NOW = new Date('2026-01-01T00:00:00Z');
const VERSE: PassageReference = { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 10, verseEnd: 10 };

/** Adamson: la hoja 65 imprime la 61. Verificado contra el ejemplar. */
const ADAMSON: PageNumbering = {
    origin: 'confirmed',
    segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
};

function excerpt(sourceLocation: string, extra: Partial<ProjectSourceExcerpt> = {}): ProjectSourceExcerpt {
    return {
        text: 'El rico es un hermano dentro de la comunidad.',
        sourceLocation,
        relevanceScore: 0.9,
        userEdited: false,
        editedAt: null,
        ...extra,
    } as ProjectSourceExcerpt;
}

function makePaper(excerpts: ProjectSourceExcerpt[]): ExegeticalPaper {
    // Sin `excerptRecipe`: es la forma de los trabajos reales, y la que evita
    // el camino que YA convertía. El defecto vivía justo en el otro.
    const source = {
        id: 'src-1', paperId: 'paper-1', corpusId: 'res-adamson',
        sourceType: 'commentary-critical' as SourceType,
        displayLabel: 'Adamson — The Epistle of James',
        citationKey: 'Adamson', order: 0,
        mode: 'extracted-excerpts', excerptSelectionMode: 'semantic',
        excerpts, sourceLibraryResourceId: 'res-adamson',
        extractedAt: NOW, extractionFingerprint: 'fp', createdAt: NOW,
    } as unknown as ProjectSource;

    const step: ExegeticalStep = {
        id: 'step-1', paperId: 'paper-1', kind: 'verse', verseRef: VERSE, order: 1,
        state: 'accepted', current: null,
        accepted: {
            id: 'v1', markdown: 'El rico es hermano (Adamson, "The Epistle of James", p. 61).',
            canonicalAnalysis: null, createdAt: NOW, verifications: [],
        } as never,
        versions: [], createdAt: NOW, updatedAt: NOW,
    };
    return {
        id: 'paper-1', ownerId: 'owner-1', createdAt: NOW, updatedAt: NOW,
        passage: VERSE, displayLanguage: 'es', assignmentBrief: null, styleGuideId: null,
        sources: [source], rubric: null, stepPlan: EMPTY_STEP_SOURCE_PLAN, phase: 'in-progress',
        steps: [step], currentStepId: 'step-1', assembledMarkdown: null, archivedAt: null,
    };
}

async function runWith(excerpts: ProjectSourceExcerpt[], numbering: PageNumbering | null) {
    const paper = makePaper(excerpts);
    const seen: VerifierSource[][] = [];
    const verifier = {
        verify: vi.fn(async (input: { sources: VerifierSource[] }) => {
            seen.push(input.sources);
            return { citations: [] };
        }),
    };
    const useCase = new VerifyStepCitationsUseCase(
        {
            getPaper: vi.fn().mockResolvedValue(paper),
            setStepVersionVerifications: vi.fn().mockResolvedValue(undefined),
        } as never,
        { getTextContent: vi.fn().mockResolvedValue('') } as never,
        verifier as never,
        undefined as never,
        { numberingFor: vi.fn().mockResolvedValue(numbering) } as never,
    );
    await useCase.execute({ ownerId: 'owner-1', paperId: 'paper-1', stepId: 'step-1' });
    return seen[0]![0]!;
}

describe('VerifyStepCitationsUseCase — la evidencia habla en páginas impresas', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('traduce el ancla guardada del extracto, que dice «p.» sobre una hoja', async () => {
        const source = await runWith([excerpt('p. 65')], ADAMSON);
        // Si esto dijera «p. 65», el cotejo marcaría «página no coincide»
        // contra una cita que apunta exactamente al mismo lugar.
        expect(source.chunks[0]!.pageHint).toBe('p. 61');
    });

    it('prefiere la hoja guardada aparte sobre el rótulo ya formateado', async () => {
        const source = await runWith([excerpt('p. 999', { sheet: 65 })], ADAMSON);
        expect(source.chunks[0]!.pageHint).toBe('p. 61');
    });

    it('dice hoja cuando el recurso no declara numeración, en vez de afirmar una página', async () => {
        const source = await runWith([excerpt('p. 55')], null);
        expect(source.chunks[0]!.pageHint).toBe('hoja 55');
    });

    it('le entrega la numeración al verificador, que consigue evidencia por su cuenta', async () => {
        // El verificador recupera fragmentos por embeddings y los rotula él
        // mismo; sin este dato los rotula en hojas y reaparece el defecto por
        // el otro camino.
        const source = await runWith([excerpt('p. 65')], ADAMSON);
        expect(source.numbering).toEqual(ADAMSON);
    });
});
