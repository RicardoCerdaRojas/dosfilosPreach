import {
    approvedThesisOf,
    briefWithExclusions,
    formatPassageReference,
    MAX_SECTION_TITLE_CHARS,
    previousUnitOf,
    previousUnitStatement,
    serializeAnalysis,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
    type IThesisAdvisor,
    type ThesisAdvisorInput,
    type ThesisProposal,
    type ThesisReview,
} from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

/**
 * Proponer y revisar la tesis del trabajo con el modelo (fase «Lecciones del
 * TI #2», etapa 3.3; B63). Se cobran del saldo (0,05 y 0,04 USD, el costo
 * medido; decisión del fundador) y se devuelven sin guardar: el estudiante
 * elige, edita y aprueba en el panel (`SetPaperThesisUseCase`).
 */

/** Lo que leen las dos: el pasaje, el enunciado, los análisis ACEPTADOS y la unidad anterior. */
export async function thesisAdvisorInput(
    paperRepository: IExegeticalPaperRepository,
    ownerId: string,
    paper: ExegeticalPaper,
): Promise<ThesisAdvisorInput> {
    const lang = paper.displayLanguage;
    const aceptados = paper.steps
        .filter(s => s.kind === 'verse' && s.accepted?.canonicalAnalysis)
        .sort((a, b) => a.order - b.order);
    if (aceptados.length === 0) {
        throw new Error('ThesisAdvisor: la tesis se formula sobre los análisis aceptados, y no hay ninguno');
    }
    // La unidad anterior: el trabajo del mismo proyecto cuyo pasaje termina
    // justo antes. Leer la lista solo cuando el trabajo está en un proyecto.
    const enProyecto = !!paper.projectId || (paper.linkedProjectIds?.length ?? 0) > 0;
    const anterior = enProyecto ? previousUnitOf(paper, await paperRepository.listPapers(ownerId)) : null;
    return {
        passageLabel: formatPassageReference(paper.passage, lang),
        language: lang,
        assignmentBrief: briefWithExclusions(paper),
        briefings: aceptados.map(s => serializeAnalysis(s.accepted!.canonicalAnalysis!, lang)).join('\n\n'),
        previousUnitThesis: previousUnitStatement(anterior),
    };
}

async function loadPaper(paperRepository: IExegeticalPaperRepository, ownerId: string, paperId: string): Promise<ExegeticalPaper> {
    if (!ownerId || !paperId) throw new Error('ThesisAdvisor: ownerId y paperId requeridos');
    const paper = await paperRepository.getPaper(ownerId, paperId);
    if (!paper) throw new Error(`Paper ${paperId} not found`);
    return paper;
}

export class ProposeThesisUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository, private advisor: IThesisAdvisor) { }

    async execute(input: { ownerId: string; paperId: string }): Promise<{ proposals: ThesisProposal[] }> {
        const paper = await loadPaper(this.paperRepository, input.ownerId, input.paperId);
        const datos = await thesisAdvisorInput(this.paperRepository, input.ownerId, paper);
        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'proposeThesis');
        try {
            reservation.markLlmContacted();
            const { proposals } = await this.advisor.propose(datos);
            return { proposals };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

export class ReviewThesisUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository, private advisor: IThesisAdvisor) { }

    /** Revisa `thesis` si se da; si no, la tesis guardada del trabajo. */
    async execute(input: { ownerId: string; paperId: string; thesis?: string }): Promise<ThesisReview> {
        const paper = await loadPaper(this.paperRepository, input.ownerId, input.paperId);
        const tesis = (input.thesis ?? paper.thesis?.text ?? approvedThesisOf(paper) ?? '').trim();
        if (!tesis) throw new Error('ReviewThesis: no hay tesis que revisar');
        const datos = await thesisAdvisorInput(this.paperRepository, input.ownerId, paper);
        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'reviewThesis');
        try {
            reservation.markLlmContacted();
            const { criteria, suggestion } = await this.advisor.review({ ...datos, thesis: tesis });
            return { criteria, suggestion };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

/**
 * Un título temático por versículo aceptado (etapa 3.4), desde la tesis
 * aprobada y los análisis. Devuelve los títulos por id del paso, sin
 * guardar: el estudiante los edita y los aprueba (`SetSectionTitlesUseCase`).
 */
export class ProposeHeadingsUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository, private advisor: IThesisAdvisor) { }

    async execute(input: { ownerId: string; paperId: string }): Promise<{ headings: Record<string, string> }> {
        const paper = await loadPaper(this.paperRepository, input.ownerId, input.paperId);
        const lang = paper.displayLanguage;
        const versos = paper.steps
            .filter(s => s.kind === 'verse' && s.verseRef && s.accepted?.canonicalAnalysis)
            .sort((a, b) => a.order - b.order);
        if (versos.length === 0) throw new Error('ProposeHeadings: no hay versículos aceptados que titular');
        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'proposeHeadings');
        try {
            reservation.markLlmContacted();
            const { headings } = await this.advisor.proposeHeadings({
                passageLabel: formatPassageReference(paper.passage, lang),
                language: lang,
                briefings: versos.map(s => serializeAnalysis(s.accepted!.canonicalAnalysis!, lang)).join('\n\n'),
                thesis: approvedThesisOf(paper),
                verses: versos.map(s => ({ key: s.id, label: formatPassageReference(s.verseRef!, lang) })),
            });
            return { headings };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

/** Guarda los títulos aprobados: los vacíos se quitan; solo de pasos de versículo del trabajo. */
export class SetSectionTitlesUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: { ownerId: string; paperId: string; titles: Record<string, string> }): Promise<ExegeticalPaper> {
        const paper = await loadPaper(this.paperRepository, input.ownerId, input.paperId);
        const versos = new Set(paper.steps.filter(s => s.kind === 'verse').map(s => s.id));
        const limpios = Object.fromEntries(
            Object.entries(input.titles)
                .map(([id, t]) => [id, (t ?? '').trim().slice(0, MAX_SECTION_TITLE_CHARS)] as const)
                .filter(([id, t]) => versos.has(id) && t.length > 0),
        );
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, { sectionTitles: Object.keys(limpios).length > 0 ? limpios : null });
    }
}
