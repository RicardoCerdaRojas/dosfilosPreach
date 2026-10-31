import {
    approvedThesisOf,
    briefWithExclusions,
    formatPassageReference,
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
