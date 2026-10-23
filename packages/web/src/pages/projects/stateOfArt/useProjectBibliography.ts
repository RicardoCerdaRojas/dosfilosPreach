import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    bibliographyCoverage,
    chaptersMentioned,
    measureRequirement,
    requirementsFromExtraction,
    isNoRepeatRule,
    sameWork,
    bibliographyEntryError,
    classificationHistory,
    bibliographyWarnings,
    catalogCandidates,
    extractedBibliographyCandidates,
    cleanProjectBibliography,
    cleanBibliographyCriteria,
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
    type BibliographySearchLogEntry,
    type ExtractedBibliographyEntry,
    type ExtractedCourseBibliography,
    type BibleBookId,
    type ProjectRequirement,
    type ProjectBibliographyCriteria,
    type ProjectBibliographyEntry,
} from '@dosfilos/domain';
import { useLibrary } from '@/hooks/library';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * Para comparar lo de pantalla con lo guardado: limpio (como lo deja el caso
 * de uso) y con las claves en orden, porque Firestore no respeta el orden en
 * que se escribieron (segunda revisión de la 2b).
 */
function canonico(x: unknown): string {
    const orden = (v: unknown): unknown => Array.isArray(v)
        ? v.map(orden)
        : v && typeof v === 'object'
            ? Object.fromEntries(Object.keys(v).sort().map(k => [k, orden((v as Record<string, unknown>)[k])]))
            : v;
    return JSON.stringify(orden(x));
}

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
        const limpia = (x: ProjectBibliographyEntry[]) => canonico(cleanProjectBibliography(x));
        const sinCambios = limpia(draftRef.current) === limpia(JSON.parse(claveAnterior.current) as ProjectBibliographyEntry[]);
        const yaIgual = limpia(draftRef.current) === limpia(JSON.parse(clave) as ProjectBibliographyEntry[]);
        if (sinCambios || yaIgual) setDraft(JSON.parse(clave) as ProjectBibliographyEntry[]);
        claveAnterior.current = clave;
    }, [clave]);

    const criteriosGuardados = project?.bibliographyCriteria ?? {};
    const claveCriterios = JSON.stringify(criteriosGuardados);
    const [criteria, setCriteria] = useState<ProjectBibliographyCriteria>(criteriosGuardados);
    // Como las fichas: lo guardado reemplaza a los criterios solo si no tienen
    // cambios propios. Guardar una importación no puede borrar un criterio a
    // medio escribir (revisión de la 2b).
    const claveCriteriosAnterior = useRef(claveCriterios);
    const criteriaRef = useRef(criteria);
    criteriaRef.current = criteria;
    useEffect(() => {
        const limpia = (c: string | ProjectBibliographyCriteria) => canonico(cleanBibliographyCriteria(typeof c === 'string' ? JSON.parse(c) as ProjectBibliographyCriteria : c));
        const actual = limpia(criteriaRef.current);
        if (actual === limpia(claveCriteriosAnterior.current) || actual === limpia(claveCriterios)) setCriteria(JSON.parse(claveCriterios) as ProjectBibliographyCriteria);
        claveCriteriosAnterior.current = claveCriterios;
    }, [claveCriterios]);

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

    const { updateProject } = useFacultyProjects();
    const logGuardado = useMemo(() => project?.bibliographySearchLog ?? [], [project]);
    // El registro se lleva aquí también: dos importaciones seguidas, antes de
    // que el proyecto se vuelva a leer, no deben pisarse (revisión de la 2b).
    const [log, setLog] = useState(logGuardado);
    const logRef = useRef(logGuardado);
    useEffect(() => { logRef.current = logGuardado; setLog(logGuardado); }, [logGuardado]);

    /** Guarda todo: fichas, criterios y registro. Devuelve si se pudo. */
    const persist = useCallback(async (entries: ProjectBibliographyEntry[], crit: ProjectBibliographyCriteria, log?: BibliographySearchLogEntry[]) => {
        if (!project) return false;
        await updateProject.mutateAsync({
            projectId: project.id, bibliography: entries, bibliographyCriteria: crit,
            ...(log ? { bibliographySearchLog: log } : {}),
        });
        return true;
    }, [project, updateProject]);
    const save = useCallback(() => persist(draftRef.current, criteriaRef.current), [persist]);

    /**
     * Aplica lo que se confirmó en la revisión de una importación y lo GUARDA
     * en el mismo paso (prueba del fundador: lo leído quedaba solo en
     * pantalla). Las obras se juntan con las fichas (la misma no se duplica,
     * lo decidido no se pisa), los requisitos se suman sin repetirse, y la
     * importación queda en el registro de búsquedas.
     *
     * Se guarda lo GUARDADO más lo importado, no el borrador: una ficha a
     * medio evaluar (o con error) sigue esperando su «Guardar» (revisión de
     * la 2b). En pantalla, lo importado se suma al borrador con los mismos ids.
     * Devuelve los ids de las fichas que tocó, para mostrarlas.
     */
    const applyImport = useCallback(async (plan: ImportPlan): Promise<ImportOutcome> => {
        const biblioteca = resources.map(r => ({ id: r.id, title: r.title, author: r.author ?? null, coversBibleBooks: r.coversBibleBooks, scope: r.scope, exegeticalType: r.exegeticalType }));
        const candidatas = extractedBibliographyCandidates(plan.entries, biblioteca, plan.origin);
        const base = JSON.parse(clave) as ProjectBibliographyEntry[];
        const guardar = mergeBibliographyCandidates(base, candidatas, newBibliographyEntryId);
        const nuevasGuardadas = guardar.filter(e => !base.some(b => b.id === e.id));
        const sumar = (actual: string | null | undefined, nuevo: string | null | undefined) => {
            if (!nuevo?.trim()) return actual ?? null;
            if ((actual ?? '').includes(nuevo.trim())) return actual ?? null;
            return actual?.trim() ? `${actual.trim()}\n${nuevo.trim()}` : nuevo.trim();
        };
        const conImportado = (c: ProjectBibliographyCriteria, nuevos: ProjectRequirement[]): ProjectBibliographyCriteria => ({
            ...c,
            requirements: sumar(c.requirements, plan.requirementsText),
            prohibitions: sumar(c.prohibitions, plan.prohibitionsText),
            requirementItems: [...(c.requirementItems ?? []), ...nuevos.filter(n => !(c.requirementItems ?? []).some(r => r.id === n.id))],
            // La regla de no repetir del sílabo enciende el criterio, salvo que se haya apagado a mano.
            ...(nuevos.some(r => r.kind === 'rule' && isNoRepeatRule(r.text)) && c.noRepeatSources == null ? { noRepeatSources: true } : {}),
        });
        const critGuardados = JSON.parse(claveCriterios) as ProjectBibliographyCriteria;
        // Los mismos requisitos nuevos (mismos ids) para lo guardado y el borrador.
        const nuevos = requirementsFromExtraction(plan.requirementItems, [...(critGuardados.requirementItems ?? []), ...(criteriaRef.current.requirementItems ?? [])], newBibliographyEntryId, new Date());
        const added = nuevasGuardadas.length;
        const registro = [...logRef.current, { id: newBibliographyEntryId(), at: new Date().toISOString(), kind: plan.logKind, label: plan.label, found: plan.found ?? plan.entries.length, added }];
        // Primero se guarda; si falla, la pantalla queda como estaba y la
        // revisión sigue abierta para reintentar.
        await persist(guardar, conImportado(critGuardados, nuevos), registro);
        // Sobre el borrador de AHORA (pudo cambiar mientras se guardaba). Una
        // obra nueva toma el id que recibió al guardarse, para que no queden
        // dos fichas de la misma obra.
        const PENDIENTE = '__pendiente__';
        const usados = new Set(draftRef.current.map(e => e.id));
        const enPantalla = mergeBibliographyCandidates(draftRef.current, candidatas, () => PENDIENTE).map(e => {
            if (e.id !== PENDIENTE) return e;
            // Nunca un id que ya tiene otra ficha en pantalla: serían dos fichas con el mismo id.
            const igual = guardar.find(g => !usados.has(g.id) && ((e.resourceId && g.resourceId === e.resourceId) || sameWork(g, e)));
            if (igual) usados.add(igual.id);
            return { ...e, id: igual?.id ?? newBibliographyEntryId() };
        });
        setDraft(enPantalla);
        setCriteria(c => conImportado(c, nuevos));
        logRef.current = registro;
        setLog(registro);
        const tocadas = enPantalla.filter(e => candidatas.some(c => (c.resourceId && e.resourceId === c.resourceId) || sameWork(e, c)));
        // Se muestran donde están: candidatas, o aprobadas si ya se habían decidido.
        const step = tocadas.some(e => e.decision === 'candidate') || tocadas.length === 0 ? 'candidates' : tocadas.some(e => e.decision === 'approved') ? 'approved' : 'discarded';
        return { added, ids: tocadas.map(e => e.id), step };
    }, [resources, persist, clave, claveCriterios]);

    /**
     * La revisión de una importación vive aquí, no en el panel: cambiar de
     * paso con la revisión abierta no puede perder lo que ya se leyó (y se
     * cobró). Revisión de la 2b.
     */
    const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

    const setRequirementItems = useCallback((items: ProjectRequirement[]) => setCriteria(c => ({ ...c, requirementItems: items })), []);

    /** Los capítulos de los estudios del proyecto, por libro, para «menciona Santiago 4». */
    const capitulos = useMemo(() => {
        const m = new Map<BibleBookId, Set<number>>();
        for (const s of studies) {
            const p = s.passage;
            const fin = p.chapterEnd ?? p.chapterStart;
            const xs = m.get(p.bookId) ?? new Set<number>();
            for (let c = p.chapterStart; c <= Math.max(p.chapterStart, fin); c++) xs.add(c);
            m.set(p.bookId, xs);
        }
        return m;
    }, [studies]);
    const mentions = useCallback(
        (title: string) => [...capitulos].flatMap(([b, xs]) => chaptersMentioned(title, b, [...xs]).map(c => ({ bookId: b, chapter: c }))),
        [capitulos],
    );

    /** Los mínimos por tipo que piden las rúbricas, con el tipo de trabajo que los pide. */
    const requirementsByWorkType = useMemo(() => workTypes.flatMap(w => {
        const rubrica = rubrics.find(r => r.id === w.rubricTemplateId);
        return (rubrica?.rubric.sourceRequirements ?? []).map(q => ({ sourceType: q.sourceType, minimum: q.minimum, workType: w.label }));
    }), [workTypes, rubrics]);
    const requirements = requirementsByWorkType;
    // La cobertura también muestra los mínimos por tipo de los requisitos del
    // proyecto (sílabo, nivel o a mano), no solo los de las rúbricas.
    const coverage = useMemo(() => {
        const propios = (criteria.requirementItems ?? [])
            .filter(r => r.kind === 'minimum-type' && r.sourceType && (r.minimum ?? 0) > 0)
            .map(r => ({ sourceType: r.sourceType!, minimum: r.minimum!, workType: t('stateOfArt.requirement.coverageLabel') }));
        return bibliographyCoverage(draft, [...requirementsByWorkType, ...propios], id => porId.get(id));
    }, [draft, requirementsByWorkType, criteria.requirementItems, porId, t]);
    /** Cada requisito medible, con su medida sobre lo aprobado. */
    const requirementMeasures = useMemo(
        () => (criteria.requirementItems ?? []).map(r => ({ requirement: r, measure: measureRequirement(r, draft, id => porId.get(id)) })),
        [criteria.requirementItems, draft, porId],
    );
    /**
     * Cómo clasificaste un libro en TODOS tus trabajos, para proponerlo. Se
     * calcula una vez por libro sin clasificar, no en cada tarjeta.
     */
    const sinClasificar = useMemo(
        () => [...new Set(draft.filter(e => e.resourceId && !e.sourceType && !porId.get(e.resourceId)?.exegeticalType).map(e => e.resourceId!))].sort().join('|'),
        [draft, porId],
    );
    const historias = useMemo(() => new Map(
        (sinClasificar ? sinClasificar.split('|') : []).map(id => [id, classificationHistory(papers ?? [], id)] as const),
    ), [sinClasificar, papers]);
    const historyOf = useCallback((resourceId: string) => historias.get(resourceId) ?? [], [historias]);

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
        entries: draft, errors, criteria, setCriteria, applyImport, save, saving: updateProject.isPending, update, add, remove, gatherCandidates,
        warnings, requirements, coverage, requirementMeasures, setRequirementItems, searchLog: log, mentions,
        pendingImport, setPendingImport,
        historyOf, bibleBooks, workTypes, resourceOf: (id: string) => porId.get(id) ?? null, dirty,
        /**
         * Los libros de la biblioteca para ligar una obra por conseguir: solo
         * los que no tienen ya su ficha, o quedarían dos fichas del mismo libro.
         */
        library: resources.filter(r => !draft.some(e => e.resourceId === r.id)).map(r => ({ id: r.id, title: r.title })),
        /** Toda la biblioteca, para emparejar lo importado. */
        libraryAll: resources.map(r => ({ id: r.id, title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null, coversBibleBooks: r.coversBibleBooks, scope: r.scope })),
    };
}

/** Lo que se confirmó en la revisión de una importación. */
export interface ImportPlan {
    entries: ExtractedBibliographyEntry[];
    requirementItems: Array<Omit<ProjectRequirement, 'id' | 'origin'>>;
    requirementsText?: string | null;
    prohibitionsText?: string | null;
    origin: { kind: 'syllabus' | 'import' } | { kind: 'citation'; citedBy: string };
    logKind: BibliographySearchLogEntry['kind'];
    /** Cuántas obras se leyeron (no solo las marcadas), para el registro. */
    found?: number;
    /** El archivo, la base o «Lista pegada». */
    label: string;
}

/** Lo leído que espera su revisión. RIS y BibTeX se leen aquí, sin el asistente (`local`). */
export interface PendingImport {
    result: ExtractedCourseBibliography;
    label: string;
    local: boolean;
}

/** Lo que dejó una importación: cuántas obras nuevas, cuáles tocó y en qué paso se ven. */
export interface ImportOutcome {
    added: number;
    ids: string[];
    step: 'candidates' | 'approved' | 'discarded';
}
