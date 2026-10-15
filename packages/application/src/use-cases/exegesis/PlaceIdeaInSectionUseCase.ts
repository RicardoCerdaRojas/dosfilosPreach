import {
    applyPageLabelStyle,
    citationsLost,
    insertIdea,
    paragraphHeadings,
    proseParagraphs,
    stepTextForEditing,
    type IdeaPlacement,
    type IExegeticalPaperRepository,
    type IIdeaPlacer,
} from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

export interface PlaceIdeaInSectionInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /** La idea con su cita, como la escribió el estudiante. */
    idea: string;
}

export interface PlaceIdeaInSectionOutput {
    /** La sección con la idea ya puesta. NO se guarda: se muestra y se decide. */
    markdown: string;
    sentence: string;
    /** El párrafo donde quedó, para mostrarlo resaltado. */
    paragraph: string;
    /** Falso si la idea fue al final del párrafo porque la referencia no estaba. */
    anchored: boolean;
    /** La oración de la sección que ya dice la idea, o vacía. */
    alreadyStated: string;
    /** Citas que el estudiante escribió y la redacción perdió. */
    lostCitations: string[];
    /**
     * Dónde y qué. Al insertar se vuelve a aplicar sobre el texto VIGENTE:
     * guardar `markdown` pisaría lo que haya cambiado mientras tanto.
     */
    placement: IdeaPlacement;
}

/**
 * «Agregar una idea a esta sección» (TP #6, #22).
 *
 * Calcula y NO guarda: el estudiante ve la oración y dónde entra, y la
 * inserción se guarda con el mismo camino que una edición a mano. Parte de
 * la prosa como se ENTREGA (`applyPageLabelStyle`), que es la que el
 * estudiante ve y edita.
 */
export class PlaceIdeaInSectionUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private placer: IIdeaPlacer,
    ) { }

    async execute(input: PlaceIdeaInSectionInput): Promise<PlaceIdeaInSectionOutput> {
        const idea = input.idea.trim();
        if (!input.ownerId || !input.paperId || !input.stepId) {
            throw new Error('PlaceIdeaInSectionUseCase: ownerId, paperId, stepId required');
        }
        if (!idea) throw new Error('PlaceIdeaInSectionUseCase: idea required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found`);
        // El mismo texto que la tarjeta muestra: en el ensamble, el documento.
        const prosa = applyPageLabelStyle(stepTextForEditing(step, paper.assembledMarkdown), paper.rubric?.formatting ?? null);

        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'placeIdeaInSection');
        try {
            reservation.markLlmContacted();
            const { placement } = await this.placer.placeIdea({
                paragraphs: proseParagraphs(prosa),
                headings: paragraphHeadings(prosa),
                idea,
                language: paper.displayLanguage,
            });
            const r = insertIdea(prosa, placement);
            return {
                markdown: r.markdown,
                sentence: placement.sentence.trim(),
                paragraph: r.paragraph,
                anchored: r.anchored,
                lostCitations: citationsLost(idea, placement.sentence),
                // Sólo si la oración está de verdad en la sección: no se avisa
                // de una repetición que el asistente imaginó.
                alreadyStated: placement.alreadyStated && comparable(prosa).includes(comparable(placement.alreadyStated)) ? placement.alreadyStated : '',
                placement,
            };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

/**
 * Para decidir si una oración está en el texto: el asistente la copia con
 * otro espacio, otras comillas o con «p.» (revisión adversarial).
 */
function comparable(texto: string): string {
    return texto.normalize('NFC')
        .replace(/[“”«»„"]/g, '"').replace(/[‘’‚']/g, "'")
        .replace(/\bpp?\.\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
