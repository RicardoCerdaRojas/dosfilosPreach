import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { PlaceIdeaInSectionOutput } from '@dosfilos/application';
import type { IdeaPlacement } from '@dosfilos/domain';
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
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * «Agregar una idea a esta sección» (TP #6, #22; decisión del fundador
 * 2026-10-15).
 *
 * Recomponer reescribe la sección entera; aquí el estudiante escribe la idea
 * con su cita, el asistente la redacta en una o dos oraciones y elige dónde
 * va, y el estudiante ve el párrafo con la oración resaltada ANTES de
 * insertarla. Lo demás queda idéntico: la inserción la hace el código, no el
 * asistente.
 */
export function AgregarIdeaDialog({ open, onOpenChange, paperId, stepId, sectionLabel, onInsert, onQuotaError, assembled = false }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId: string;
    stepId: string;
    sectionLabel: string;
    /** Guarda la sección con la idea puesta sobre el texto vigente. */
    onInsert: (placement: IdeaPlacement) => Promise<void>;
    /** El trabajo ya está ensamblado: el documento no cambia solo. */
    assembled?: boolean;
    /** Sin créditos: lo maneja la tarjeta, que tiene el diálogo de compra. */
    onQuotaError: (err: unknown) => boolean;
}) {
    const { t } = useTranslation('exegesis');
    const { placeIdeaInSection } = useExegesisPapers();
    const [idea, setIdea] = useState('');
    const [propuesta, setPropuesta] = useState<PlaceIdeaInSectionOutput | null>(null);
    const [guardando, setGuardando] = useState(false);

    // Cada apertura es una sesión: una respuesta que llega después de cerrar
    // no se muestra en la siguiente (revisión adversarial).
    const sesion = useRef(0);
    useEffect(() => {
        sesion.current += 1;
        setIdea(''); setPropuesta(null); setGuardando(false);
    }, [open]);

    const proponer = async () => {
        const mia = sesion.current;
        try {
            const r = await placeIdeaInSection.mutateAsync({ paperId, stepId, idea });
            if (mia === sesion.current) setPropuesta(r);
        } catch (err) {
            if (mia !== sesion.current) return;
            if (onQuotaError(err)) { onOpenChange(false); return; }
            console.error('[exegesis] place idea failed:', err);
            toast.error(t('detail.steps.addIdea.failed'));
        }
    };

    const insertar = async () => {
        if (!propuesta) return;
        setGuardando(true);
        try {
            await onInsert(propuesta.placement);
            toast.success(t('detail.steps.addIdea.inserted'));
            onOpenChange(false);
        } catch (err) {
            console.error('[exegesis] insert idea failed:', err);
            toast.error(t('detail.steps.addIdea.insertFailed'));
        } finally {
            setGuardando(false);
        }
    };

    const pidiendo = placeIdeaInSection.isPending;

    return (
        <Dialog open={open} onOpenChange={o => { if (!guardando && !placeIdeaInSection.isPending) onOpenChange(o); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('detail.steps.addIdea.title', { section: sectionLabel })}</DialogTitle>
                    <DialogDescription>{t('detail.steps.addIdea.description')}</DialogDescription>
                </DialogHeader>

                <label htmlFor="idea-nueva" className="text-xs font-medium text-foreground">
                    {t('detail.steps.addIdea.label')}
                </label>
                <textarea
                    id="idea-nueva"
                    value={idea}
                    onChange={e => { setIdea(e.target.value); setPropuesta(null); }}
                    rows={4}
                    disabled={pidiendo || guardando}
                    placeholder={t('detail.steps.addIdea.placeholder')}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                />

                {propuesta && (
                    <div className="space-y-2" role="region" aria-label={t('detail.steps.addIdea.previewTitle')}>
                        <p className="text-xs font-medium text-foreground">{t('detail.steps.addIdea.previewTitle')}</p>
                        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed text-foreground">
                            <ParrafoConIdea parrafo={propuesta.paragraph} oracion={propuesta.sentence} />
                        </p>
                        {assembled && (
                            <p className="text-[11px] text-muted-foreground">{t('detail.steps.addIdea.assembled')}</p>
                        )}
                        {!propuesta.anchored && (
                            <p className="text-[11px] text-muted-foreground">{t('detail.steps.addIdea.atParagraphEnd')}</p>
                        )}
                        {propuesta.lostCitations.length > 0 && (
                            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                {t('detail.steps.addIdea.lostCitations', { citations: propuesta.lostCitations.join(', ') })}
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando || placeIdeaInSection.isPending}>
                        {t('detail.steps.addIdea.cancel')}
                    </Button>
                    <Button type="button" variant={propuesta ? 'outline' : 'default'} onClick={proponer} disabled={!idea.trim() || pidiendo || guardando}>
                        {pidiendo && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {t(propuesta ? 'detail.steps.addIdea.again' : 'detail.steps.addIdea.propose')}
                    </Button>
                    {propuesta && (
                        <Button type="button" onClick={insertar} disabled={guardando || pidiendo}>
                            {guardando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                            {t('detail.steps.addIdea.insert')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** El párrafo con la oración nueva resaltada. */
function ParrafoConIdea({ parrafo, oracion }: { parrafo: string; oracion: string }) {
    const i = oracion ? parrafo.indexOf(oracion) : -1;
    if (i < 0) return <>{parrafo}</>;
    return (
        <>
            {parrafo.slice(0, i)}
            <mark className="rounded bg-success-subtle px-0.5 text-success-subtle-foreground">{oracion}</mark>
            {parrafo.slice(i + oracion.length)}
        </>
    );
}
