import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import { checkLength } from './paperLength';
import { computeRubricCompliance } from '../entities/PaperRubric';
import { answeredUnitIds, derivePaperUnits, framingInDocument, type PaperUnit } from './paperUnits';
import { paperRequirements, requirementWarnings, syllabusRequirementId, type PaperRequirement } from './paperRequirements';
import { readPaperProfileKind } from './paperProfile';
import { sourceTypesForRubric } from './commentaryCoverage';
import type { LibraryResource } from '../../entities/LibraryResource';

/**
 * Los requisitos de un trabajo con lo que se puede medir y lo que el autor
 * marcó (A5). Solo del trabajo: no lee el proyecto ni otros trabajos. Lo usan
 * la pestaña «Entradas» de la web y la herramienta `leer_requisitos` del MCP
 * (A9): una sola regla, para que el asistente vea lo mismo que el autor.
 */
export function requirementsOfPaper(
    paper: ExegeticalPaper,
    /**
     * Los libros de las fuentes, para contar como «Qué conseguir»: un
     * comentario a OTRO libro bíblico no suma (revisión final de la fase A:
     * con un comentario a Jonás en un TP de Santiago, Requisitos decía «2 de
     * 2» y Qué conseguir «1 de 2»). Sin él, toda fuente con texto cuenta.
     */
    resourceOf: (id: string) => Pick<LibraryResource, 'coversBibleBooks' | 'scope'> | null | undefined = () => null,
): {
    profileKind: ReturnType<typeof readPaperProfileKind>['kind'];
    units: PaperUnit[];
    requirements: PaperRequirement[];
    warnings: ReturnType<typeof requirementWarnings>;
} {
    const profileKind = readPaperProfileKind(paper).kind;
    const units = derivePaperUnits({
        kind: profileKind, assignmentBrief: paper.assignmentBrief, passage: paper.passage,
        steps: paper.steps, sectionTitles: paper.sectionTitles,
    });
    // Lo que se puede medir no se marca a mano (prueba del fundador en TP #10).
    const enCorpus = new Set(paper.sources.map(s => s.sourceLibraryResourceId ?? s.corpusId));
    const documento = paper.assembledMarkdown?.trim() ?? '';
    const measures = {
        length: documento && paper.rubric ? checkLength(documento, paper.rubric.expectedLength, paper.rubric.formatting) : null,
        sources: paper.rubric
            ? computeRubricCompliance(sourceTypesForRubric(paper.sources, resourceOf, paper.passage.bookId), paper.rubric).requirements.map(r => ({ sourceType: r.sourceType, have: r.have, required: r.required }))
            : [],
        answeredUnits: answeredUnitIds(units, paper.steps),
        framingInDocument: framingInDocument(paper.steps),
        readingsInCorpus: new Map((paper.rubric?.courseBibliography ?? [])
            .filter(b => !!b.resourceId)
            .map(b => [syllabusRequirementId(b.title), enCorpus.has(b.resourceId!)] as const)),
    };
    const requirements = paperRequirements({
        profileKind, rubric: paper.rubric, units, marks: paper.requirementMarks, manual: paper.manualRequirements, measures,
    });
    return { profileKind, units, requirements, warnings: requirementWarnings(requirements) };
}
