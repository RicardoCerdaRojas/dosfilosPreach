import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    bibliographyWarnings,
    catalogCandidates,
    cleanProjectBibliography,
    libraryCandidates,
    mergeBibliographyCandidates,
    newBibliographyEntryId,
    paperRoleInProject,
    projectBibleBooks,
    projectBibliography,
    projectWorkTypes,
    studiesCandidates,
    syllabusCandidates,
    syllabusOfProject,
    type AIProject,
    type ProjectBibliographyCriteria,
    type ProjectBibliographyEntry,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';


/**
 * Lo que necesita la página del estado del arte (etapa 2): las fichas del
 * proyecto como borrador, las candidatas de los cuatro orígenes y los
 * avisos. El borrador se guarda entero con un botón, como las tarjetas del
 * proyecto: una ficha a medio evaluar no se escribe sola.
 */
export function useProjectBibliography(project: AIProject | undefined) {
    const { resources } = useLibrary();
    const { rubrics } = useUserRubrics();
    const { papers } = useExegesisPapers();

    const porId = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
    const lookup = useCallback((id: string) => {
        const r = porId.get(id);
        return r ? { title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
    }, [porId]);

    const guardadas = useMemo(() => projectBibliography(project, lookup), [project, lookup]);
    const clave = JSON.stringify(guardadas);
    const [draft, setDraft] = useState<ProjectBibliographyEntry[]>(guardadas);
    useEffect(() => setDraft(JSON.parse(clave) as ProjectBibliographyEntry[]), [clave]);

    const criteriosGuardados = project?.bibliographyCriteria ?? {};
    const claveCriterios = JSON.stringify(criteriosGuardados);
    const [criteria, setCriteria] = useState<ProjectBibliographyCriteria>(criteriosGuardados);
    useEffect(() => setCriteria(JSON.parse(claveCriterios) as ProjectBibliographyCriteria), [claveCriterios]);

    const studies = useMemo(
        () => (project ? (papers ?? []).filter(p => paperRoleInProject(p, project.id)) : []),
        [papers, project],
    );
    const bibleBooks = useMemo(() => projectBibleBooks(criteria, studies), [criteria, studies]);
    const workTypes = useMemo(() => projectWorkTypes(project), [project]);

    /** Paso 2: cruza los cuatro orígenes con las fichas que hay. */
    const gatherCandidates = useCallback(() => {
        const biblioteca = resources.map(r => ({ id: r.id, title: r.title, author: r.author ?? null, coversBibleBooks: r.coversBibleBooks, scope: r.scope, exegeticalType: r.exegeticalType }));
        const candidatas = [
            ...syllabusCandidates(syllabusOfProject(workTypes, rubrics), biblioteca),
            ...studiesCandidates(studies),
            ...libraryCandidates(bibleBooks, biblioteca),
            ...catalogCandidates(bibleBooks, biblioteca, 'es'),
        ];
        setDraft(d => mergeBibliographyCandidates(d, candidatas, newBibliographyEntryId));
    }, [resources, workTypes, rubrics, studies, bibleBooks]);

    /** Los mínimos por tipo que piden las rúbricas de los tipos de trabajo. */
    const requirements = useMemo(() => {
        const ids = new Set(workTypes.map(t => t.rubricTemplateId).filter(Boolean));
        return rubrics.filter(r => ids.has(r.id)).flatMap(r => r.rubric.sourceRequirements ?? []);
    }, [workTypes, rubrics]);

    const warnings = useMemo(
        () => bibliographyWarnings(draft, requirements, id => porId.get(id), bibleBooks),
        [draft, requirements, porId, bibleBooks],
    );

    const update = useCallback((id: string, patch: Partial<ProjectBibliographyEntry>) => {
        setDraft(d => d.map(e => (e.id === id ? { ...e, ...patch } : e)));
    }, []);
    const add = useCallback((entry: ProjectBibliographyEntry) => setDraft(d => [...d, entry]), []);
    const remove = useCallback((id: string) => setDraft(d => d.filter(e => e.id !== id)), []);

    const dirty = JSON.stringify(cleanProjectBibliography(draft)) !== JSON.stringify(cleanProjectBibliography(guardadas))
        || JSON.stringify(criteria) !== claveCriterios;

    return {
        entries: draft, criteria, setCriteria, update, add, remove, gatherCandidates,
        warnings, requirements, bibleBooks, workTypes, resourceOf: (id: string) => porId.get(id) ?? null, dirty,
        /**
         * Los libros de la biblioteca para ligar una obra por conseguir: solo
         * los que no tienen ya su ficha, o quedarían dos fichas del mismo libro.
         */
        library: resources.filter(r => !draft.some(e => e.resourceId === r.id)).map(r => ({ id: r.id, title: r.title })),
    };
}
