import { useEffect, useState } from 'react';
import { BookOpenCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    BIBLIOGRAPHY_FIELDS,
    REQUIRED_BIBLIOGRAPHY_FIELDS,
    completeWithProposal,
    formatBibliographyEntry,
    proposeSortedAuthor,
    type BibliographicData,
    type BibliographyField,
} from '@dosfilos/domain';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useReadBibliographyFromCover, useSaveBibliography } from '@/hooks/exegesis/usePaperBibliography';

// La lista y los obligatorios son del dominio: la bibliografía se imprime
// con ellos y el formulario solo los muestra.
const FIELDS = BIBLIOGRAPHY_FIELDS;
type Field = BibliographyField;

const REQUIRED: ReadonlySet<string> = new Set(REQUIRED_BIBLIOGRAPHY_FIELDS);

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resourceId: string;
    displayLabel: string;
    data: BibliographicData | null;
    /** Las fuentes de la biblioteca común se miran, no se escriben. */
    canEdit: boolean;
}

/**
 * La ficha bibliográfica de un libro, copiada de su portada.
 *
 * Se pide a una persona porque es la única que tiene el ejemplar. El
 * compositor recibía la clave de cita y el nombre del archivo, y de ahí
 * sacaba editorial, ciudad y año: en el trabajo de Salmo 23 salieron
 * inventados y hubo que corregirlos uno por uno.
 */
export function BibliographyEditDialog({ open, onOpenChange, resourceId, displayLabel, data, canEdit }: Props) {
    const { t } = useTranslation('exegesis');
    const save = useSaveBibliography();
    const read = useReadBibliographyFromCover();
    const [draft, setDraft] = useState<Record<Field, string>>(() => emptyDraft());
    // Qué campos vinieron del ejemplar y no de la mano de quien lo tiene.
    // Se marca porque un dato leído se revisa distinto de uno escrito.
    const [fromBook, setFromBook] = useState<ReadonlySet<Field>>(() => new Set());

    useEffect(() => {
        if (!open) return;
        setDraft(Object.fromEntries(FIELDS.map(f => [f, data?.[f] ?? ''])) as Record<Field, string>);
        setFromBook(new Set());
    }, [open, data]);

    const set = (field: Field, value: string) => {
        // Tocar un campo leído lo vuelve escrito: la marca dejaría de ser
        // cierta. Va FUERA del actualizador de `draft` porque ese se ejecuta
        // dos veces en modo estricto y no debe tener efectos.
        setFromBook(marked => {
            // Escribir el autor reescribe también la forma ordenable, así
            // que su marca deja de ser cierta junto con la del autor.
            const tambien = field === 'author' ? (['authorSorted'] as const) : [];
            if (!marked.has(field) && !tambien.some(f => marked.has(f))) return marked;
            const next = new Set(marked);
            next.delete(field);
            for (const f of tambien) next.delete(f);
            return next;
        });
        setDraft(d => {
            // Al escribir el nombre se propone la forma ordenable, y solo
            // mientras el autor no la haya tocado: es una ayuda, no una regla
            // —«Ricardo Cerda Rojas» ordena por «Cerda Rojas»—.
            if (field !== 'author') return { ...d, [field]: value };
            const proposal = proposeSortedAuthor(value);
            const untouched = d.authorSorted === '' || d.authorSorted === proposeSortedAuthor(d.author);
            return { ...d, author: value, authorSorted: untouched ? proposal : d.authorSorted };
        });
    };

    const clean: BibliographicData = Object.fromEntries(
        FIELDS.map(f => [f, draft[f].trim()]).filter(([, v]) => (v as string).length > 0),
    );
    const preview = formatBibliographyEntry(clean);

    /**
     * Vuelca sobre los huecos lo que dice la portada del propio ejemplar.
     *
     * Nunca pisa lo ya escrito: quien tiene el libro en la mano sabe más
     * que un PDF, y el lector solo vio el PDF.
     */
    const readFromBook = async () => {
        try {
            const result = await read.mutateAsync(resourceId);
            if (!result.hasText) {
                toast.error(t('detail.bibliography.readNoText'));
                return;
            }
            const { data: merged, filled } = completeWithProposal(clean, result.data);
            if (filled.length === 0) {
                // Tres razones distintas para no llenar nada, y decirlas
                // todas «tu libro no trae datos» sería mentir en dos de ellas.
                const huecos = FIELDS.some(f => !draft[f].trim());
                if (!huecos) toast.info(t('detail.bibliography.readAlreadyComplete'));
                else if (Object.keys(result.data).length === 0) toast.info(t('detail.bibliography.readNothing'));
                else toast.info(t('detail.bibliography.readNothingNew'));
                return;
            }
            // `completeWithProposal` habla de campos de la ficha y el
            // formulario de los suyos: se filtra en vez de forzar el tipo,
            // que mentiría si alguna vez dejaran de coincidir.
            const llenados = filled.filter((f): f is Field => (FIELDS as ReadonlyArray<string>).includes(f));
            setDraft(d => ({
                ...d,
                ...Object.fromEntries(llenados.map(f => [f, (merged[f] ?? '').toString()])),
            }));
            // Se suman a las de una lectura anterior en vez de reemplazarlas.
            setFromBook(marcadas => new Set([...marcadas, ...llenados]));
            toast.success(t('detail.bibliography.readFilled', { count: llenados.length }));
        } catch (err) {
            console.error('[exegesis] no se pudo leer la portada del libro:', err);
            toast.error(t('detail.bibliography.readFailed'));
        }
    };

    const busy = save.isPending || read.isPending || !canEdit;

    const submit = async () => {
        try {
            await save.mutateAsync({ resourceId, data: clean });
            toast.success(t('detail.bibliography.saved'));
            onOpenChange(false);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar la ficha bibliográfica:', err);
            toast.error(t('detail.bibliography.saveFailed'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('detail.bibliography.dialogTitle')}</DialogTitle>
                    <DialogDescription>{displayLabel}</DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    {!canEdit && (
                        <p className="text-[11px] text-muted-foreground">{t('detail.bibliography.notEditable')}</p>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={readFromBook}
                        disabled={busy}
                    >
                        {read.isPending
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <BookOpenCheck className="h-3.5 w-3.5 mr-1.5" />}
                        {read.isPending ? t('detail.bibliography.reading') : t('detail.bibliography.readFromBook')}
                    </Button>
                    {canEdit && (
                        <p className="text-[11px] text-muted-foreground">{t('detail.bibliography.readHint')}</p>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {FIELDS.map(field => (
                        <label key={field} className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                {t(`detail.bibliography.fields.${field}`)}
                                {REQUIRED.has(field) && <span className="text-destructive"> *</span>}
                                {fromBook.has(field) && (
                                    <span className="ml-1.5 normal-case tracking-normal font-normal text-primary">
                                        {t('detail.bibliography.fromBook')}
                                    </span>
                                )}
                            </span>
                            <input
                                type="text"
                                value={draft[field]}
                                onChange={e => set(field, e.target.value)}
                                disabled={busy}
                                placeholder={t(`detail.bibliography.placeholders.${field}`)}
                                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                            />
                        </label>
                    ))}
                </div>

                <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {t('detail.bibliography.previewLabel')}
                    </p>
                    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        {preview || t('detail.bibliography.previewEmpty')}
                    </p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                        {t('detail.bibliography.cancel')}
                    </Button>
                    <Button type="button" onClick={submit} disabled={busy}>
                        {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {t('detail.bibliography.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function emptyDraft(): Record<Field, string> {
    return Object.fromEntries(FIELDS.map(f => [f, ''])) as Record<Field, string>;
}
