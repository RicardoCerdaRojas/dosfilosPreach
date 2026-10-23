import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    bibliographyEntryError,
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
import { useTranslation } from '@/i18n';


/**
 * Lo que necesita la página del estado del arte (etapa 2): las fichas del
 * proyecto como borrador, las candidatas de los cuatro orígenes y los
 * avisos. El borrador se guarda entero con un botón, como las tarjetas del
 * proyecto: una ficha a medio evaluar no se escribe sola.
 */
export function useProjectBibliography(project: AIProject | undefined) {
    const { t, i18n } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
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
    // Lo guardado reemplaza al borrador solo si el borrador no tiene cambios
    // propios: un refetch (o la biblioteca que llega y pone títulos) en medio
    // de una edición no puede pisarla.
    const claveAnterior = useRef(clave);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    useEffect(() => {
        const limpia = (x: ProjectBibliographyEntry[]) => JSON.stringify(cleanProjectBibliography(x));
        const sinCambios = limpia(draftRef.current) === limpia(JSON.parse(claveAnterior.current) as ProjectBibliographyEntry[]);
        const yaIgual = limpia(draftRef.current) === limpia(JSON.parse(clave) as ProjectBibliographyEntry[]);
        if (sinCambios || yaIgual) setDraft(JSON.parse(clave) as ProjectBibliographyEntry[]);
        claveAnterior.current = clave;
    }, [clave]);

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
            ...studiesCandidates(studies, tipos => t('stateOfArt.conflictNote', { types: tipos.map(([x, n]) => `${tx(`sourceTypes.${x}.label`)} (${n})`).join(', ') })),
            ...libraryCandidates(bibleBooks, biblioteca),
            ...catalogCandidates(bibleBooks, biblioteca, lang),
        ];
        setDraft(d => mergeBibliographyCandidates(d, candidatas, newBibliographyEntryId));
    }, [resources, workTypes, rubrics, studies, bibleBooks, t, tx, lang]);

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

    /** Lo que impide guardar: una ficha sin título ni libro, o descartada sin razón. */
    const errors = useMemo(() => new Map(draft.map(e => [e.id, bibliographyEntryError(e)] as const).filter(([, err]) => err)), [draft]);

    // Sobre el borrador tal cual, no sobre su versión limpia: una ficha que
    // la limpieza descartaría (sin título) también es un cambio, y tiene que
    // verse para que no se pierda al guardar (revisión de la etapa 2).
    const dirty = JSON.stringify(draft) !== clave || JSON.stringify(criteria) !== claveCriterios;

    return {
        entries: draft, errors, criteria, setCriteria, update, add, remove, gatherCandidates,
        warnings, requirements, bibleBooks, workTypes, resourceOf: (id: string) => porId.get(id) ?? null, dirty,
        /**
         * Los libros de la biblioteca para ligar una obra por conseguir: solo
         * los que no tienen ya su ficha, o quedarían dos fichas del mismo libro.
         */
        library: resources.filter(r => !draft.some(e => e.resourceId === r.id)).map(r => ({ id: r.id, title: r.title })),
    };
}
