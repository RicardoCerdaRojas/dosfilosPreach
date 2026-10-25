import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
    AIProject,
    AssistantVerseInput,
    BibleBookId,
    BookPanorama,
    FramingFrequency,
    MacroSection,
    NewHypothesisEntry,
    PassageReference,
} from '@dosfilos/domain';
import {
    framingPrefill,
    hasReadingToContrast,
    isPassageRun,
    seriesDescriptionFor,
    type ProjectEntryState,
} from '../utils/serieDesdeProyecto';

/**
 * El encuadre del proyecto en el planificador (`docs/FASE_ENCUADRE_SERIE_2026-10.md`,
 * §2 pasos 6–8), fuera de la página: precarga el formulario de la serie UNA
 * vez, decide cuándo aparece «Tu lectura y lo que propone el panorama» y
 * arma las salidas del aviso de unidades contra domingos.
 *
 * Nada de esto entra a los pases: solo se muestra y precarga.
 */
export function useFramingInPlanner(input: {
    project: AIProject | null;
    projectState: ProjectEntryState;
    bookParam: string | null;
    lang: 'es' | 'en';
    panorama: BookPanorama | null;
    macroSections: MacroSection[] | null;
    analyzedBookId: BibleBookId | null;
    updateProject: { mutateAsync: (v: { projectId: string; hypothesisEntry: NewHypothesisEntry }) => Promise<unknown> };
    setCollapsedPasses: Dispatch<SetStateAction<Set<number>>>;
}) {
    const { project, projectState, bookParam, lang, panorama, macroSections, analyzedBookId, updateProject, setCollapsedPasses } = input;
    const prefill = useMemo(() => framingPrefill(project, { bookParam }), [project, bookParam]);

    const [startDate, setStartDate] = useState('');
    const [frequency, setFrequency] = useState<FramingFrequency>('weekly');
    // `null`: sin encuadre, el campo no aparece y la serie lleva el texto de siempre.
    const [description, setDescription] = useState<string | null>(null);
    // Si el último análisis fue de un pasaje: la tarjeta dice «del pasaje».
    const [analyzedPassage, setAnalyzedPassage] = useState(false);

    // Fecha, frecuencia y descripción no viven en el borrador: se precargan
    // también con uno restaurado, pero UNA sola vez. Un refetch del proyecto
    // (otra pestaña, una anotación del registro) no pisa lo que el pastor editó.
    const prefilled = useRef(false);
    useEffect(() => {
        if (prefilled.current || projectState === 'loading') return;
        prefilled.current = true;
        if (prefill.startDate) setStartDate(prefill.startDate);
        if (prefill.frequency) setFrequency(prefill.frequency);
        if (prefill.description !== null) setDescription(prefill.description);
    }, [projectState, prefill]);

    // Cada panorama nuevo es otra corrida: la tarjeta se vuelve a montar y
    // vuelve a invitar a anotar.
    const runIds = useRef(new WeakMap<object, number>());
    const runCounter = useRef(0);
    const panoramaRun = useMemo(() => {
        if (!panorama) return 0;
        const known = runIds.current.get(panorama);
        if (known) return known;
        runCounter.current += 1;
        runIds.current.set(panorama, runCounter.current);
        return runCounter.current;
    }, [panorama]);

    const framing = project?.framing ?? null;
    const books = project?.bibliographyCriteria?.bibleBooks ?? [];
    // Solo si lo analizado es un libro del proyecto: contrastar la lectura
    // de Esdras con el panorama de Rut no dice nada.
    const contrast = project && framing && panorama && analyzedBookId
        && books.includes(analyzedBookId) && hasReadingToContrast(framing)
        ? {
            key: `panorama-${panoramaRun}`,
            props: {
                framing,
                panorama,
                macroSections,
                bookId: analyzedBookId,
                isPassage: analyzedPassage,
                lang,
                onRecord: (hypothesisEntry: NewHypothesisEntry) => updateProject.mutateAsync({ projectId: project.id, hypothesisEntry }),
            },
        }
        : null;

    // «Revisar la división»: despliega el Pase 4 si estaba plegado y lleva
    // ahí la vista y el foco.
    const reviewDivision = useCallback(() => {
        setCollapsedPasses((prev) => {
            if (!prev.has(4)) return prev;
            const next = new Set(prev);
            next.delete(4);
            return next;
        });
        requestAnimationFrame(() => {
            const el = document.getElementById('expository-pass-4');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el?.focus({ preventScroll: true });
        });
    }, [setCollapsedPasses]);

    const unitsNotice = (units: number) => (project
        ? {
            units,
            sundays: framing?.rhythm?.sundays,
            onReviewDivision: reviewDivision,
            calendarHref: `/dashboard/projects/${encodeURIComponent(project.id)}?encuadre=1`,
        }
        : null);

    return {
        /** El alcance del encuadre: la página lo aplica solo sin borrador. */
        scope: prefill.scope as PassageReference | null,
        startDate, setStartDate,
        frequency, setFrequency,
        description, setDescription,
        descriptionFor: (fallback: string) => seriesDescriptionFor(description, fallback),
        setAnalyzedPassage,
        restoreAnalyzedPassage: (verses: AssistantVerseInput[], bookId: BibleBookId, readerChapterCount: number) =>
            setAnalyzedPassage(isPassageRun(verses, bookId, readerChapterCount)),
        contrast,
        unitsNotice,
    };
}
