import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import type { BibliographyEntry, ExegeticalPaper } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { usePaperBibliography, type PaperBibliographyRow } from '@/hooks/exegesis/usePaperBibliography';
import { BibliographyEditDialog } from './BibliographyEditDialog';
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
 * Las fichas que faltan, ANTES de descargar.
 *
 * El aviso de después llegaba como un mensaje pasajero sobre un archivo que
 * ya estaba bajado, y en el TP #6 (2026-10-07) el Word se entregó casi con
 * «[FICHA INCOMPLETA…]» en la bibliografía: el aviso pasó sin verse. Aquí se
 * completa la ficha sin salir, y se exporta igual sólo si se decide. El
 * documento sigue imprimiendo el marcador —omitir la obra sería peor (ver
 * `renderBibliography`)—, pero ya no por descuido.
 */
export function IncompleteBibliographyGate({ paper, entries, open, onCancel, onExport }: {
    paper: ExegeticalPaper;
    /**
     * La bibliografía que va a salir: sólo lo CITADO. Es lo que decide; las
     * fuentes del corpus sin citar no entran al documento y no cuentan.
     */
    entries: ReadonlyArray<BibliographyEntry>;
    open: boolean;
    onCancel: () => void;
    onExport: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const rows = usePaperBibliography(paper);
    const [editing, setEditing] = useState<PaperBibliographyRow | null>(null);
    // Las citadas incompletas al abrir, para que no desaparezcan de la lista
    // apenas se completan: se ven pasar a verde.
    const [shown] = useState(() => entries.filter(e => !e.text).map(e => e.citationKey));
    const pendientes = entries.filter(e => !e.text).length;
    const visibles = shown.map(key => {
        const entry = entries.find(e => e.citationKey === key);
        // Una cita a un libro que ya no está en el corpus no tiene ficha que
        // abrir: se muestra igual, sin edición.
        const row = rows.find(r => r.citationKey === key) ?? null;
        return { key, label: row?.displayLabel ?? entry?.displayLabel ?? key, missing: entry?.missing ?? [], row };
    });

    return (
        <>
            <Dialog open={open && !editing} onOpenChange={o => { if (!o) onCancel(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {pendientes > 0 ? t('detail.bibliography.gate.title', { count: pendientes }) : t('detail.bibliography.gate.allComplete')}
                        </DialogTitle>
                        <DialogDescription>{t('detail.bibliography.gate.description')}</DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-2">
                        {visibles.map(item => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={() => item.row && setEditing(item.row)}
                                    disabled={!item.row?.editable}
                                    className="group flex w-full items-start gap-2 rounded-lg border border-border px-3 py-2 text-left disabled:opacity-60"
                                >
                                    {item.missing.length === 0
                                        ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                                        : <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />}
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-medium text-foreground truncate">{item.label}</span>
                                        {item.missing.length > 0 && (
                                            <span className="block text-xs text-muted-foreground">
                                                {item.row
                                                    ? t('detail.bibliography.gate.missing', {
                                                        fields: item.missing.map(f => t(`detail.bibliography.fields.${f}`).toLocaleLowerCase()).join(', '),
                                                    })
                                                    : t('detail.bibliography.gate.notInCorpus')}
                                            </span>
                                        )}
                                    </span>
                                    {item.row?.editable && <Pencil className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onCancel}>{t('detail.bibliography.gate.cancel')}</Button>
                        <Button type="button" variant={pendientes > 0 ? 'outline' : 'default'} onClick={onExport}>
                            {pendientes > 0 ? t('detail.bibliography.gate.exportAnyway') : t('detail.bibliography.gate.export')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {editing && (
                <BibliographyEditDialog
                    open={!!editing}
                    onOpenChange={o => { if (!o) setEditing(null); }}
                    resourceId={editing.resourceId}
                    displayLabel={editing.displayLabel}
                    data={editing.data}
                    canEdit={editing.editable}
                />
            )}
        </>
    );
}
