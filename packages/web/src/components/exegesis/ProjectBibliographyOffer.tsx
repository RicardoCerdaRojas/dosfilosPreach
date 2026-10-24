import { useEffect, useMemo, useRef, useState } from 'react';
import { Library } from 'lucide-react';
import {
    inheritableProjectEntries,
    initialSourcesFromBibliography,
    type AddProjectSourceInput,
    type AIProject,
    type BibleBookId,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';

interface ProjectBibliographyOfferProps {
    project: AIProject | null;
    /** El libro del pasaje: un comentario de otro libro no se ofrece. */
    bookId: BibleBookId | null;
    onChange: (sources: AddProjectSourceInput[]) => void;
}

/**
 * Lo que el estudio hereda del estado del arte del proyecto (etapa 2): las
 * obras aprobadas que están en la biblioteca, marcadas por defecto. Se
 * pueden desmarcar antes de crear. Las hojas de cada libro se eligen
 * después, en el corpus, contra el pasaje de este estudio.
 */
export function ProjectBibliographyOffer({ project, bookId, onChange }: ProjectBibliographyOfferProps) {
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
    const fuentes = initialSourcesFromBibliography(elegidas, id => porId.get(id)?.exegeticalType ?? null, id => porId.get(id)?.title);
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
                                {(e.sourceType ?? porId.get(e.resourceId!)?.exegeticalType) && (
                                    <span className="block text-[11px] text-muted-foreground">{t(`sourceTypes.${e.sourceType ?? porId.get(e.resourceId!)?.exegeticalType}.label`)}</span>
                                )}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">{t('create.projectSources.hint')}</p>
        </fieldset>
    );
}
