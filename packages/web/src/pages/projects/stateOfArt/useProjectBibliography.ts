import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    bibliographyCoverage,
    chaptersMentioned,
    measureRequirement,
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
import { canonico } from '@/utils/canonico';

/**
 * Para comparar lo de pantalla con lo guardado se usa la forma canónica
 * compartida (`utils/canonico`): claves en orden, porque Firestore no
 * respeta el orden en que se escribieron (segunda revisión de la 2b), y
 * `null`, `''` y ausente como iguales (fase «Encuadre de la serie»).
 */

/** Los criterios sin sus libros: con encuadre, los libros no son de esta página. */
function sinLibros(c: ProjectBibliographyCriteria): ProjectBibliographyCriteria {
    const { bibleBooks: _libros, ...resto } = c;
    return resto;
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
    /**
     * Con encuadre, los libros son del encuadre: se leen de lo GUARDADO, no
     * del borrador de esta página, y se cambian en el diálogo del encuadre.
     * Sin encuadre (Curso, Investigación), como siempre.
     */
    const booksFromFraming = !!project?.framing;
    const librosGuardados = project?.bibliographyCriteria?.bibleBooks;
    const claveLibros = JSON.stringify(librosGuardados ?? []);
    const bibleBooks = useMemo(
        () => projectBibleBooks(booksFromFraming ? { bibleBooks: JSON.parse(claveLibros) as BibleBookId[] } : criteria, studies),
        [booksFromFraming, claveLibros, criteria, studies],
    );
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
    /**
     * Las escrituras del registro van en fila: cada una parte del registro
     * que dejó la anterior y termina antes de que empiece la siguiente. Sin
     * fila, una importación que terminaba después de una anotación escribía
     * su arreglo sin ella (segunda revisión de la 2c).
     */
    const filaRef = useRef<Promise<unknown>>(Promise.resolve());
    const enFila = useCallback(<T,>(f: () => Promise<T>): Promise<T> => {
        const p = filaRef.current.then(f, f);
        filaRef.current = p.catch(() => undefined);
        return p;
    }, []);
    useEffect(() => { logRef.current = logGuardado; setLog(logGuardado); }, [logGuardado]);

    /** Guarda todo: fichas, criterios y registro. Devuelve si se pudo. */
    const persist = useCallback(async (entries: ProjectBibliographyEntry[], crit: ProjectBibliographyCriteria, log?: BibliographySearchLogEntry[]) => {
        if (!project) return false;
        // Con encuadre, los libros que viajan son los guardados, no los del
        // borrador: esta página no los pisa (el caso de uso también lo protege).
        const libros = JSON.parse(claveLibros) as BibleBookId[];
        const criterios = booksFromFraming ? { ...sinLibros(crit), ...(libros.length ? { bibleBooks: libros } : {}) } : crit;
        await updateProject.mutateAsync({
            projectId: project.id, bibliography: entries, bibliographyCriteria: criterios,
            ...(log ? { bibliographySearchLog: log } : {}),
        });
        return true;
    }, [project, updateProject, booksFromFraming, claveLibros]);
    const save = useCallback(() => persist(draftRef.current, criteriaRef.current), [persist]);

    /**
     * Aplica lo que se confirmó en la revisión de una importación y lo GUARDA
     * en el mismo paso (prueba del fundador: lo leído quedaba solo en
     * pantalla). Las obras se juntan con las fichas (la misma no se duplica,
     * lo decidido no se pisa) y la importación queda en el registro de
     * búsquedas. Los criterios y requisitos no se tocan: se escriben en su editor.
     *
     * Se guarda lo GUARDADO más lo importado, no el borrador: una ficha a
     * medio evaluar (o con error) sigue esperando su «Guardar» (revisión de
     * la 2b). En pantalla, lo importado se suma al borrador con los mismos ids.
     * Devuelve los ids de las fichas que tocó, para mostrarlas.
     */
    const applyImport = useCallback((plan: ImportPlan): Promise<ImportOutcome> => enFila(async () => {
        const biblioteca = resources.map(r => ({ id: r.id, title: r.title, author: r.author ?? null, coversBibleBooks: r.coversBibleBooks, scope: r.scope, exegeticalType: r.exegeticalType }));
        const candidatas = extractedBibliographyCandidates(plan.entries, biblioteca, plan.origin);
        const base = JSON.parse(clave) as ProjectBibliographyEntry[];
        const guardar = mergeBibliographyCandidates(base, candidatas, newBibliographyEntryId);
        const nuevasGuardadas = guardar.filter(e => !base.some(b => b.id === e.id));
        // Los criterios no se tocan: importar trae solo obras (decisión del fundador, 2026-10-24).
        const critGuardados = JSON.parse(claveCriterios) as ProjectBibliographyCriteria;
        const added = nuevasGuardadas.length;
        const registro = [...logRef.current, { id: newBibliographyEntryId(), at: new Date().toISOString(), kind: plan.logKind, label: plan.label, found: plan.found ?? plan.entries.length, added }];
        // Primero se guarda; si falla, la pantalla queda como estaba y la
        // revisión sigue abierta para reintentar.
        await persist(guardar, critGuardados, registro);
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
        logRef.current = registro;
        setLog(registro);
        const tocadas = enPantalla.filter(e => candidatas.some(c => (c.resourceId && e.resourceId === c.resourceId) || sameWork(e, c)));
        // Se muestran donde están: candidatas, o aprobadas si ya se habían decidido.
        const step = tocadas.some(e => e.decision === 'candidate') || tocadas.length === 0 ? 'candidates' : tocadas.some(e => e.decision === 'approved') ? 'approved' : 'discarded';
        return { added, ids: tocadas.map(e => e.id), step };
    }), [resources, persist, clave, claveCriterios, enFila]);

    /**
     * La revisión de una importación vive aquí, no en el panel: cambiar de
     * paso con la revisión abierta no puede perder lo que ya se leyó (y se
     * cobró). Revisión de la 2b.
     */
    const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

    /**
     * Anota una búsqueda hecha en una base que el sistema no consulta
     * (IxTheo, ATLA…): base, consulta y resultado, para que se pueda explicar
     * y repetir (etapa 2c). Se guarda solo el registro, en el acto.
     */
    const addSearchNote = useCallback((note: { database: string; label: string; query: string; found: number; added: number }) => enFila(async () => {
        if (!project) return;
        const registro = [...logRef.current, { id: newBibliographyEntryId(), at: new Date().toISOString(), kind: 'database' as const, ...note }];
        await updateProject.mutateAsync({ projectId: project.id, bibliographySearchLog: registro });
        logRef.current = registro;
        setLog(registro);
    }), [project, updateProject, enFila]);

    const setRequirementItems = useCallback((items: ProjectRequirement[]) => setCriteria(c => ({ ...c, requirementItems: items })), []);

    const passages = useMemo(() => studies.map(s => s.passage), [studies]);
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
    // verse para que no se pierda al guardar (revisión de la etapa 2). La
    // forma canónica solo iguala `null`, `''` y ausente, y el orden de claves.
    // Con encuadre, los libros del borrador no cuentan: no se guardan aquí.
    const criteriosParaComparar = (c: ProjectBibliographyCriteria) => canonico(booksFromFraming ? sinLibros(c) : c);
    const dirty = canonico(draft) !== canonico(guardadas)
        || criteriosParaComparar(criteria) !== criteriosParaComparar(JSON.parse(claveCriterios) as ProjectBibliographyCriteria);

    return {
        entries: draft, errors, criteria, setCriteria, applyImport, save, saving: updateProject.isPending, update, add, remove, gatherCandidates,
        warnings, requirements, coverage, requirementMeasures, setRequirementItems, searchLog: log, mentions,
        pendingImport, setPendingImport, addSearchNote,
        /** Los pasajes de los estudios, para la guía de búsqueda. */
        passages,
        historyOf, bibleBooks, workTypes,
        /** Con encuadre, los libros se ven en solo lectura y se cambian en el encuadre. */
        booksFromFraming, resourceOf: (id: string) => porId.get(id) ?? null, dirty,
        /**
         * Los libros de la biblioteca para ligar una obra por conseguir: solo
         * los que no tienen ya su ficha, o quedarían dos fichas del mismo libro.
         */
        library: resources.filter(r => !draft.some(e => e.resourceId === r.id)).map(r => ({ id: r.id, title: r.title })),
        /** Toda la biblioteca, para emparejar lo importado. */
        libraryAll: resources.map(r => ({ id: r.id, title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null, coversBibleBooks: r.coversBibleBooks, scope: r.scope })),
    };
}

/** Lo que se confirmó en la revisión de una importación: solo obras. */
export interface ImportPlan {
    entries: ExtractedBibliographyEntry[];
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
