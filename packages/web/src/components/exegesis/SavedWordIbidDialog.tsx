import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { shortFormForIbid, type BibliographicData, type SavedWordIbidReview } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { readSavedWordIbid } from '@/lib/exegesis/readSavedWord';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * «Revisar el Word guardado»: lo único de la revisión que no se puede saber
 * antes de exportar —el «Ibid.» que cae al comienzo de una página, porque
 * las páginas las arma Word— (fase «Lecciones del TI #2», etapa 2.3). Para
 * cada uno propone la forma abreviada que va en su lugar; el cambio se hace
 * en el Word, que es donde está la página.
 */
export function SavedWordIbidDialog({ file, fichas, onClose }: {
    file: File | null;
    fichas: ReadonlyArray<BibliographicData>;
    onClose: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const [estado, setEstado] = useState<{ file: File; review: SavedWordIbidReview | null; failed: boolean } | null>(null);

    useEffect(() => {
        if (!file) return;
        let vigente = true;
        readSavedWordIbid(file)
            .then(review => { if (vigente) setEstado({ file, review, failed: false }); })
            .catch(err => {
                console.error('[exegesis] saved Word review failed:', err);
                if (vigente) setEstado({ file, review: null, failed: true });
            });
        return () => { vigente = false; };
    }, [file]);

    // Mientras se lee el archivo nuevo, no se muestra el resultado del anterior.
    const actual = estado && estado.file === file ? estado : null;
    const review = actual?.review ?? null;

    return (
        <Dialog open={!!file} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('detail.savedWord.title')}</DialogTitle>
                    <DialogDescription>{t('detail.savedWord.description')}</DialogDescription>
                </DialogHeader>
                {!actual && <p className="text-sm text-muted-foreground">{t('detail.savedWord.reading')}</p>}
                {actual?.failed && <p className="text-sm text-destructive">{t('detail.savedWord.failed')}</p>}
                {review && !review.paginated && (
                    <p className="flex items-start gap-2 text-sm text-foreground">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        {t('detail.savedWord.notPaginated')}
                    </p>
                )}
                {review && review.paginated && review.findings.length === 0 && (
                    <p className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        {t('detail.savedWord.clean', { notes: review.notes, pages: review.pages })}
                    </p>
                )}
                {review && review.findings.length > 0 && (
                    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {review.findings.map(f => {
                            const forma = shortFormForIbid(f, fichas)?.replace(/\*/g, '') ?? null;
                            return (
                                <li key={f.note} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-medium text-foreground">
                                            {t('detail.savedWord.finding', { note: f.note, page: f.page, text: f.text })}
                                        </span>
                                        <span className="block text-muted-foreground">
                                            {forma
                                                ? t('detail.savedWord.replaceWith', { form: forma })
                                                : t('detail.savedWord.noForm', { previousNote: f.previousNote })}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <DialogFooter>
                    <Button type="button" onClick={onClose}>{t('detail.savedWord.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
