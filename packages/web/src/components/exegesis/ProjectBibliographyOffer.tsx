import { useEffect, useMemo, useRef, useState } from 'react';
import { Library } from 'lucide-react';
import {
    inheritableProjectEntries,
    initialSourcesFromBibliography,
    sourceTypeForInherited,
    type AddProjectSourceInput,
    type KnownSourceIdentity,
    type AIProject,
    type BibleBookId,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import { useCourseSourceIdentities } from '@/hooks/exegesis/usePreviousCourseDelivery';

interface ProjectBibliographyOfferProps {
    project: AIProject | null;
    /** El libro del pasaje: un comentario de otro libro no se ofrece. */
    bookId: BibleBookId | null;
    onChange: (sources: AddProjectSourceInput[]) => void;
    /** El texto de ayuda; sin él, el del estudio suelto. La serie lo dice para todos sus estudios. */
    hint?: string;
    /** El idioma del trabajo: la clave de cita de varios autores se une con «y» o «and». */
    language?: 'es' | 'en';
}

/**
 * Lo que el estudio hereda del estado del arte del proyecto (etapa 2): las
 * obras aprobadas que están en la biblioteca, marcadas por defecto. Se
 * pueden desmarcar antes de crear. Las hojas de cada libro se eligen
 * después, en el corpus, contra el pasaje de este estudio.
 */
export function ProjectBibliographyOffer({ project, bookId, onChange, hint, language = 'es' }: ProjectBibliographyOfferProps) {
    const { t } = useTranslation('exegesis');
    const { resources } = useLibrary();
    const [desmarcadas, setDesmarcadas] = useState<ReadonlySet<string>>(new Set());
    const porId = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
    // La regla vive en el dominio: el planificador de la serie hereda lo mismo.
    const heredables = useMemo(
        () => inheritableProjectEntries(project, bookId, id => porId.get(id)),
        [project, bookId, porId],
    );
    const elegidas = useMemo(() => heredables.filter(e => !desmarcadas.has(e.id)), [heredables, desmarcadas]);
    // Se avisa solo cuando cambia QUÉ se hereda: la lista de la biblioteca
    // puede llegar como un arreglo nuevo en cada render, y avisar por eso
    // hacía un ciclo de renders.
    // Lo que ya se sabe de cada libro por los trabajos del curso: una obra
    // traída al curso sin clasificar llegaba como «otro» y sin clave de cita
    // (TP #9, B13/B14).
    const identidades = useCourseSourceIdentities(project?.id ?? null);
    const tipoEnBiblioteca = (id: string) => porId.get(id)?.exegeticalType ?? null;
    const known: KnownSourceIdentity = { usedBefore: id => identidades.get(id), authorOf: id => porId.get(id)?.author, language };
    const fuentes = initialSourcesFromBibliography(elegidas, tipoEnBiblioteca, id => porId.get(id)?.title, known);
    const clave = JSON.stringify(fuentes);
    const ultimo = useRef<string | null>(null);
    useEffect(() => {
        if (ultimo.current === clave) return;
        ultimo.current = clave;
        onChange(JSON.parse(clave) as AddProjectSourceInput[]);
    }, [clave, onChange]);

    if (heredables.length === 0) return null;
    const alternar = (id: string) => setDesmarcadas(s => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    return (
        <fieldset className="rounded-xl border border-border bg-card p-3 space-y-2">
            <legend className="px-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Library className="h-3.5 w-3.5" />{t('create.projectSources.title', { count: heredables.length })}</span>
            </legend>
            <ul className="grid gap-1 sm:grid-cols-2">
                {heredables.map(e => (
                    <li key={e.id}>
                        <label className="flex items-start gap-2 text-sm text-foreground">
                            <input type="checkbox" className="mt-1" checked={!desmarcadas.has(e.id)} onChange={() => alternar(e.id)} />
                            <span className="min-w-0">
                                <span className="block truncate">{e.title || porId.get(e.resourceId!)?.title}</span>
                                {/* El autor a la vista, para saber qué desmarcar (p. ej. lo citado la semana anterior). */}
                                {(e.author || porId.get(e.resourceId!)?.author) && (
                                    <span className="block truncate text-xs text-foreground/80" data-testid="project-source-author">{e.author || porId.get(e.resourceId!)?.author}</span>
                                )}
                                <span className="block text-[11px] text-muted-foreground" data-testid="project-source-type">
                                    {t(`sourceTypes.${sourceTypeForInherited(e, tipoEnBiblioteca, known)}.label`)}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">{hint ?? t('create.projectSources.hint')}</p>
        </fieldset>
    );
}
