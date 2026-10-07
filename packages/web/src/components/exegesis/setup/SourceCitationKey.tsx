import { useState } from 'react';
import { AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { deriveCitationKeyFromAuthor } from '@dosfilos/domain';
import type { ExegeticalPaper, ProjectSource } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * La clave con que se cita esta fuente, editable.
 *
 * Una fuente citable SIN clave quedaba fuera de las citas en silencio: el
 * analizador recibía «(no citation key)» y toda cita exige una clave
 * configurada. La clave sólo se derivaba del autor al agregar la fuente, así
 * que corregir el autor después no la recalculaba: había que quitar la fuente
 * y volver a agregarla (Robertson, TP Santiago 2:14-26).
 *
 * Sin clave se avisa y se propone la que sale del autor del libro, si hay.
 */
export function SourceCitationKey({ paper, source, isCitable, libraryAuthor, libraryTitle = null }: {
    paper: ExegeticalPaper;
    source: ProjectSource;
    isCitable: boolean;
    /** El autor del libro en la biblioteca, si la fuente viene de ahí. */
    libraryAuthor: string | null;
    /** El título del libro: una edición crítica se cita por su sigla (NA28). */
    libraryTitle?: string | null;
}) {
    const { t } = useTranslation('exegesis');
    const { updateSource } = useExegesisPapers();
    const propuesta = deriveCitationKeyFromAuthor(libraryAuthor, libraryTitle, paper.displayLanguage);
    const [draft, setDraft] = useState<string | null>(null);
    const k = (key: string) => `paperSetup.subSteps.corpus.citationKey.${key}`;

    const guardar = async (valor: string) => {
        try {
            await updateSource.mutateAsync({ paperId: paper.id, sourceId: source.id, citationKey: valor.trim() || null });
            toast.success(t(k('saved')));
            setDraft(null);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar la clave de cita:', err);
            toast.error(t(k('saveFailed')));
        }
    };

    if (draft !== null) {
        return (
            <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(e) => { e.preventDefault(); void guardar(draft); }}
            >
                <label htmlFor={`clave-${source.id}`} className="text-[11px] text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.upload.citationKeyLabel')}
                </label>
                <input
                    id={`clave-${source.id}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                    className="w-32 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled={updateSource.isPending}>
                    {updateSource.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {t(k('save'))}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDraft(null)}>
                    {t(k('cancel'))}
                </Button>
                {/* Los análisis guardan la clave con que citaron: cambiarla
                    deja esas citas sin fuente hasta volver a analizar. */}
                {source.citationKey && draft.trim() !== source.citationKey && (
                    <span className="basis-full text-[11px] text-warning-subtle-foreground">
                        {t(k('renameWarning'), { key: source.citationKey })}
                    </span>
                )}
            </form>
        );
    }

    if (source.citationKey) {
        return (
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                {t('paperSetup.subSteps.corpus.upload.citationKeyLabel')}: {source.citationKey}
                <button
                    type="button"
                    onClick={() => setDraft(source.citationKey ?? '')}
                    className="p-0.5 rounded hover:bg-accent hover:text-foreground"
                    aria-label={t(k('edit'))}
                    title={t(k('edit'))}
                >
                    <Pencil className="h-3 w-3" />
                </button>
            </p>
        );
    }

    if (!isCitable) return null;
    return (
        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-subtle/40 px-2 py-1 text-[11px] text-warning-subtle-foreground">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="flex-1 min-w-0">{t(k('missing'))}</span>
            {propuesta && (
                <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => void guardar(propuesta)} disabled={updateSource.isPending}>
                    {t(k('useDerived'), { key: propuesta })}
                </Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDraft(propuesta)}>
                {t(k('write'))}
            </Button>
        </div>
    );
}
