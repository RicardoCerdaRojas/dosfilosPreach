import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import {
    overlappingProjectStudies,
    projectsOfPaper,
    type AddProjectSourceInput,
    type AIProject,
    type BibleBookId,
    type ExegeticalUnit,
    type PreachableUnit,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { ProjectBibliographyOffer } from '@/components/exegesis/ProjectBibliographyOffer';
import { useProjectSourcesForBook } from '@/hooks/exegesis/useProjectSourcesForBook';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { excludedFrom, pericopesForOverlap, type ProjectSeriesSourcesState } from '../utils/serieDesdeProyecto';

interface ProjectSeriesSourcesProps {
    project: AIProject;
    /** El libro ANALIZADO: cambiar el selector después no cambia lo heredado. */
    bookId: BibleBookId;
    preachableUnits: readonly PreachableUnit[];
    exegeticalUnits: readonly ExegeticalUnit[] | null;
    onChange: (state: ProjectSeriesSourcesState) => void;
}

/**
 * El paso de crear la serie dentro del proyecto: las obras que heredan los
 * estudios (marcadas, se pueden desmarcar) y el aviso de estudios del
 * proyecto que ya tratan alguna perícopa. Solo se monta con proyecto, así
 * que la entrada genérica no carga la biblioteca ni los estudios.
 */
export function ProjectSeriesSources({ project, bookId, preachableUnits, exegeticalUnits, onChange }: ProjectSeriesSourcesProps) {
    const { t } = useTranslation('series');
    const { sources: todas, isLoading: libraryLoading } = useProjectSourcesForBook(project, bookId);
    // `null` hasta que la oferta avisa con la biblioteca ya cargada. Lo que
    // avisa mientras carga puede salir distinto (un proyecto de antes no
    // tiene títulos ni tipos sin la biblioteca): tomarlo haría contar obras
    // como desmarcadas durante el render en que llega la biblioteca.
    const [elegidas, setElegidas] = useState<AddProjectSourceInput[] | null>(null);
    const cargando = useRef(libraryLoading);
    cargando.current = libraryLoading;
    // La última lista de la oferta, también la que avisó cargando.
    const ultimaLista = useRef<AddProjectSourceInput[] | null>(null);
    const elegir = useCallback((s: AddProjectSourceInput[]) => {
        ultimaLista.current = s;
        setElegidas(cargando.current ? null : s);
    }, []);
    // La oferta avisa solo cuando cambia su lista. Con fichas modernas (título
    // y tipo en la ficha) sale igual antes y después de cargar y no vuelve a
    // avisar: sin esto, «Crear serie» quedaba deshabilitado para siempre. Los
    // efectos del hijo corren antes, así que si la lista sí cambió, el ref ya
    // trae la nueva.
    useEffect(() => {
        if (!libraryLoading) setElegidas((prev) => prev ?? ultimaLista.current);
    }, [libraryLoading]);

    // Se avisa por contenido, no por identidad: el padre guarda el estado y
    // un arreglo nuevo con lo mismo haría un ciclo de renders.
    // Sin nada heredable la oferta no vuelve a avisar (su lista sigue vacía),
    // así que no hay nada que esperar.
    const efectivas = elegidas ?? (!libraryLoading && todas.length === 0 ? [] : null);
    const estado = JSON.stringify({
        sources: efectivas ?? [],
        excludedResourceIds: efectivas ? excludedFrom(todas, efectivas) : [],
        libraryLoading: libraryLoading || efectivas === null,
    });
    const ultimo = useRef<string | null>(null);
    useEffect(() => {
        if (ultimo.current === estado) return;
        ultimo.current = estado;
        onChange(JSON.parse(estado) as ProjectSeriesSourcesState);
    }, [estado, onChange]);

    const { papers } = useExegesisPapers();
    const solapes = useMemo(() => {
        const delProyecto = papers
            .filter((p) => !p.archivedAt && projectsOfPaper(p).includes(project.id))
            .map((p) => ({ id: p.id, title: p.title?.trim() || '', passage: p.passage, seriesId: p.seriesId }));
        const pericopas = pericopesForOverlap(preachableUnits, exegeticalUnits, bookId);
        const hallados = overlappingProjectStudies(pericopas, delProyecto);
        return pericopas.flatMap((p) => (hallados.get(p.id) ?? []).map((s) => ({ key: `${p.id}:${s.id}`, passage: p.passage, title: s.title })));
    }, [papers, project.id, preachableUnits, exegeticalUnits, bookId]);

    return (
        <div className="mt-4 space-y-3">
            <ProjectBibliographyOffer project={project} bookId={bookId} onChange={elegir} hint={t('expository.project.sourcesHint')} />
            {!libraryLoading && todas.length === 0 && (
                // Sin esto, el banner promete «las obras que marques abajo» y
                // los estudios nacen sin fuentes sin que nada lo diga.
                <p role="status" className="flex items-start gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        {t('expository.project.noSources')}{' '}
                        <Link
                            to={`/dashboard/projects/${project.id}/estado-del-arte`}
                            className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {t('expository.project.openStateOfArt')}
                        </Link>
                    </span>
                </p>
            )}
            {libraryLoading && (
                <p role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t('expository.project.libraryLoading')}
                </p>
            )}
            {solapes.length > 0 && (
                <div role="status" className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground space-y-1.5">
                    <p className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {t('expository.project.overlapTitle')}
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                        {solapes.map((s) => (
                            <li key={s.key}>{s.title ? `${s.passage} — ${s.title}` : s.passage}</li>
                        ))}
                    </ul>
                    <p>{t('expository.project.overlapHint')}</p>
                </div>
            )}
        </div>
    );
}
