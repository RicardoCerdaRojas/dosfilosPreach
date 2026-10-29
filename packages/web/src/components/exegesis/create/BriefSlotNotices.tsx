import { useState } from 'react';
import { toast } from 'sonner';
import {
    BRIEF_PASSAGE_SLOT, formatPassageForReader, hasBriefSlot, joinSourceKeys, replaceBriefPassages, samePassage, stalePassagesInBrief,
    type BriefPassageMention, type PassageReference, type UserAssignmentBrief,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import type { PreviousCourseDelivery } from '@/hooks/exegesis/usePreviousCourseDelivery';

interface BriefSlotNoticesProps {
    /** El encuadre tal como está en el campo. */
    brief: string;
    /** La plantilla de la que salió, si salió de una. */
    template: UserAssignmentBrief | null;
    passage: PassageReference | null;
    language: 'es' | 'en';
    previous: PreviousCourseDelivery;
    /** Reemplaza el encuadre del campo (el estudiante lo pidió con un botón). */
    onReplace: (body: string) => void;
}

/**
 * Lo que pasó con los huecos del encargo y el pasaje que quedó fijo (TP #9,
 * B5/B4). Avisa y propone; el texto lo decide el estudiante.
 */
export function BriefSlotNotices({ brief, template, passage, language, previous, onReplace }: BriefSlotNoticesProps) {
    const { t } = useTranslation('exegesis');
    const anterior = previous.title || t('paperSetup.subSteps.corpus.excluded.previousFallback');
    const avisos: string[] = [];
    if (template && hasBriefSlot(template.body, 'passage') && !passage) avisos.push(t('create.brief.slotPassagePending'));
    if (template && hasBriefSlot(template.body, 'previousSources')) {
        const claves = previous.restrictedKeys;
        // «La regla no rige» y «no hay anterior» son cosas distintas (revisión de B4).
        avisos.push(previous.status === 'off'
            ? t('create.brief.slotSourcesRuleOff')
            : claves === null
                ? t('create.brief.slotSourcesNoPrevious')
                : claves.length === 0
                    ? t('create.brief.slotSourcesNone', { paper: anterior })
                    : t('create.brief.slotSourcesFilled', { paper: anterior, sources: joinSourceKeys(claves, language) }));
    }
    const fijos = passage ? stalePassagesInBrief(brief, passage) : [];
    if (avisos.length === 0 && fijos.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2" data-testid="brief-slot-notices" aria-live="polite">
            {avisos.map(a => <p key={a} className="text-[11px] text-foreground">{a}</p>)}
            {fijos.length > 0 && passage && (
                <StalePassageChooser
                    brief={brief} mentions={fijos} template={template} passage={passage} language={language}
                    previous={previous} previousName={anterior} onReplace={onReplace}
                />
            )}
        </div>
    );
}

interface StalePassageChooserProps {
    brief: string;
    mentions: BriefPassageMention[];
    template: UserAssignmentBrief | null;
    passage: PassageReference;
    language: 'es' | 'en';
    previous: PreviousCourseDelivery;
    previousName: string;
    onReplace: (body: string) => void;
}

/**
 * Los pasajes que podrían haber quedado fijos, uno por uno. «a la luz de
 * Santiago 1:19-21» es un rango legítimo: nada se reemplaza sin marcarlo, y
 * viene marcado solo el que coincide con el pasaje del trabajo anterior del
 * mismo tipo (revisión de B5). La plantilla cambia solo en los marcados.
 */
function StalePassageChooser({ brief, mentions, template, passage, language, previous, previousName, onReplace }: StalePassageChooserProps) {
    const { t } = useTranslation('exegesis');
    const { updateBrief } = useUserAssignmentBriefs();
    const pasaje = formatPassageForReader(passage, language);
    const delAnterior = (m: BriefPassageMention) => !!previous.passage && samePassage(m.ref, previous.passage);
    // Claves de las menciones cuya marca el estudiante invirtió.
    const [invertidas, setInvertidas] = useState<ReadonlySet<string>>(new Set());
    const clave = (m: BriefPassageMention) => `${m.start}:${m.text}`;
    const marcada = (m: BriefPassageMention) => delAnterior(m) !== invertidas.has(clave(m));
    const elegidas = mentions.filter(marcada);
    const alternar = (m: BriefPassageMention) => setInvertidas(s => {
        const n = new Set(s);
        if (n.has(clave(m))) n.delete(clave(m)); else n.add(clave(m));
        return n;
    });
    // En la plantilla, las mismas referencias que se marcaron aquí.
    const enPlantilla = template
        ? stalePassagesInBrief(template.body, passage).filter(m => elegidas.some(e => samePassage(e.ref, m.ref)))
        : [];

    const arreglarPlantilla = async () => {
        if (!template || enPlantilla.length === 0) return;
        try {
            await updateBrief?.mutateAsync({ briefId: template.id, body: replaceBriefPassages(template.body, enPlantilla, BRIEF_PASSAGE_SLOT[language]) });
            toast.success(t('create.brief.staleTemplateFixed', { name: template.displayName }));
        } catch (err) {
            console.error('[exegesis] no se pudo dejar el hueco del pasaje en la plantilla:', err);
            toast.error(t('create.brief.staleTemplateFailed'));
        }
    };

    return (
        <fieldset className="space-y-1.5" data-testid="brief-stale-passage">
            <legend className="text-[11px] text-warning-subtle-foreground">
                {t('create.brief.stalePassage', { count: mentions.length, passage: pasaje })}
            </legend>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {mentions.map(m => (
                    <li key={clave(m)}>
                        <label className="inline-flex min-h-11 items-center gap-1.5 text-xs text-foreground sm:min-h-0">
                            <input
                                type="checkbox"
                                checked={marcada(m)}
                                onChange={() => alternar(m)}
                                className="h-4 w-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-focus"
                            />
                            {m.text}
                        </label>
                    </li>
                ))}
            </ul>
            {mentions.some(delAnterior) && (
                <p className="text-[11px] text-muted-foreground">{t('create.brief.stalePreviousMarked', { paper: previousName })}</p>
            )}
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-0" disabled={elegidas.length === 0} onClick={() => onReplace(replaceBriefPassages(brief, elegidas, pasaje))}>
                    {t('create.brief.staleUseHere', { passage: pasaje })}
                </Button>
                {template && (
                    <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-0" disabled={enPlantilla.length === 0 || !!updateBrief?.isPending} onClick={() => void arreglarPlantilla()}>
                        {t('create.brief.staleFixTemplate', { name: template.displayName })}
                    </Button>
                )}
            </div>
        </fieldset>
    );
}
