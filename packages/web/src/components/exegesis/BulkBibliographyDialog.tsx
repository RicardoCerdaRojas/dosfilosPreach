import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { readBibliographyFromCover } from '@dosfilos/infrastructure';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useSaveBibliography, type PaperBibliographyRow } from '@/hooks/exegesis/usePaperBibliography';
import { readMissingBibliographies, type BulkReadResult } from '@/hooks/exegesis/readMissingBibliographies';

/**
 * «Leer las portadas de los N que faltan», con revisión en una sola pantalla.
 *
 * #9 del ejercicio de Jonás: once libros sin datos para citar, cada uno abierto,
 * leído y guardado por separado. Aquí se leen todos y el pastor revisa lo que
 * propone cada portada, con una casilla por libro; nada se guarda sin su
 * casilla. Y se dice lo que el fundador no sabía: la ficha queda en el LIBRO y
 * sirve para todos los trabajos.
 */
export function BulkBibliographyDialog({ rows, open, onOpenChange }: {
    rows: ReadonlyArray<PaperBibliographyRow>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation('exegesis');
    const save = useSaveBibliography();
    const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);
    const [resultados, setResultados] = useState<BulkReadResult[] | null>(null);
    const [marcados, setMarcados] = useState<Set<string>>(new Set());
    const [guardando, setGuardando] = useState(false);

    const leer = async () => {
        setResultados(null);
        setAvance({ hechas: 0, total: rows.filter(r => r.missing.length > 0 && r.editable).length });
        const r = await readMissingBibliographies(rows, id => readBibliographyFromCover(id), {
            alAvanzar: (hechas, total) => setAvance({ hechas, total }),
        });
        setResultados(r);
        setMarcados(new Set(r.filter(x => x.status === 'proposal').map(x => x.row.sourceId)));
        setAvance(null);
    };

    const guardar = async () => {
        if (!resultados) return;
        setGuardando(true);
        let n = 0;
        try {
            for (const r of resultados) {
                if (!marcados.has(r.row.sourceId) || !r.merged) continue;
                await save.mutateAsync({ resourceId: r.row.resourceId, data: r.merged });
                n++;
            }
            toast.success(t('detail.bibliography.bulk.saved', { count: n }));
            onOpenChange(false);
        } catch (err) {
            console.error('[bibliografía] no se pudo guardar el lote:', err);
            toast.error(t('detail.bibliography.bulk.saveFailed', { count: n }));
        } finally {
            setGuardando(false);
        }
    };

    const alternar = (id: string) => setMarcados(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return (
        <Dialog open={open} onOpenChange={v => { if (!guardando) onOpenChange(v); }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('detail.bibliography.bulk.title')}</DialogTitle>
                    <DialogDescription>{t('detail.bibliography.bulk.body')}</DialogDescription>
                </DialogHeader>

                {!resultados && (
                    <div className="py-4">
                        <Button type="button" onClick={() => void leer()} disabled={!!avance}>
                            {avance && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {avance
                                ? t('detail.bibliography.bulk.reading', { hechas: avance.hechas, total: avance.total })
                                : t('detail.bibliography.bulk.start')}
                        </Button>
                    </div>
                )}

                {resultados && (
                    <ul className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {resultados.map(r => (
                            <li key={r.row.sourceId} className="rounded-md border border-border px-3 py-2 text-xs">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0"
                                        checked={marcados.has(r.row.sourceId)}
                                        disabled={r.status !== 'proposal'}
                                        onChange={() => alternar(r.row.sourceId)}
                                    />
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-medium text-foreground">{r.row.citationKey}</span>
                                        {r.status === 'proposal' ? (
                                            <span className="block text-[11px] text-muted-foreground">
                                                {r.filled.map(f => `${t(`detail.bibliography.fields.${f}`)}: ${r.merged?.[f] ?? ''}`).join(' · ')}
                                            </span>
                                        ) : (
                                            <span className="block text-[11px] text-muted-foreground italic">
                                                {t(`detail.bibliography.bulk.status.${r.status}`)}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>
                        {t('detail.bibliography.bulk.close')}
                    </Button>
                    {resultados && (
                        <Button type="button" onClick={() => void guardar()} disabled={guardando || marcados.size === 0}>
                            {guardando && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('detail.bibliography.bulk.save', { count: marcados.size })}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
