import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    formatBibliographyEntry,
    proposeSortedAuthor,
    type BibliographicData,
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
import { useSaveBibliography } from '@/hooks/exegesis/usePaperBibliography';

/** Campos del formulario, en el orden en que se leen de una portada. */
const FIELDS = [
    'author', 'authorSorted', 'title', 'subtitle', 'shortTitle',
    'volume', 'volumeTitle', 'series', 'edition', 'translator', 'editor',
    'city', 'publisher', 'year',
] as const;
type Field = (typeof FIELDS)[number];

const REQUIRED: ReadonlySet<Field> = new Set(['author', 'title', 'city', 'publisher', 'year']);

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resourceId: string;
    displayLabel: string;
    data: BibliographicData | null;
}

/**
 * La ficha bibliográfica de un libro, copiada de su portada.
 *
 * Se pide a una persona porque es la única que tiene el ejemplar. El
 * compositor recibía la clave de cita y el nombre del archivo, y de ahí
 * sacaba editorial, ciudad y año: en el trabajo de Salmo 23 salieron
 * inventados y hubo que corregirlos uno por uno.
 */
export function BibliographyEditDialog({ open, onOpenChange, resourceId, displayLabel, data }: Props) {
    const { t } = useTranslation('exegesis');
    const save = useSaveBibliography();
    const [draft, setDraft] = useState<Record<Field, string>>(() => emptyDraft());

    useEffect(() => {
        if (!open) return;
        setDraft(Object.fromEntries(FIELDS.map(f => [f, data?.[f] ?? ''])) as Record<Field, string>);
    }, [open, data]);

    const set = (field: Field, value: string) => setDraft(d => {
        // Al escribir el nombre se propone la forma ordenable, y solo
        // mientras el autor no la haya tocado: es una ayuda, no una regla
        // —«Ricardo Cerda Rojas» ordena por «Cerda Rojas»—.
        if (field !== 'author') return { ...d, [field]: value };
        const proposal = proposeSortedAuthor(value);
        const untouched = d.authorSorted === '' || d.authorSorted === proposeSortedAuthor(d.author);
        return { ...d, author: value, authorSorted: untouched ? proposal : d.authorSorted };
    });

    const clean: BibliographicData = Object.fromEntries(
        FIELDS.map(f => [f, draft[f].trim()]).filter(([, v]) => (v as string).length > 0),
    );
    const preview = formatBibliographyEntry(clean);

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

                <div className="grid gap-3 sm:grid-cols-2">
                    {FIELDS.map(field => (
                        <label key={field} className="space-y-1">
                            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                {t(`detail.bibliography.fields.${field}`)}
                                {REQUIRED.has(field) && <span className="text-destructive"> *</span>}
                            </span>
                            <input
                                type="text"
                                value={draft[field]}
                                onChange={e => set(field, e.target.value)}
                                disabled={save.isPending}
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
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                        {t('detail.bibliography.cancel')}
                    </Button>
                    <Button type="button" onClick={submit} disabled={save.isPending}>
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
