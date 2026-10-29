import { useId } from 'react';
import { DEFAULT_SOURCE_REPETITION_POLICY, SOURCE_REPETITION_GROUPS, type SourceType } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface WorkTypeNoRepeatFieldProps {
    /** La lista guardada; ausente: el curso no lo dijo. */
    value: ReadonlyArray<SourceType> | undefined;
    onChange: (types: SourceType[]) => void;
}

/** Lo que la regla general excluye: es lo que se muestra marcado mientras no se fije. */
const DE_LA_REGLA_GENERAL = (Object.entries(DEFAULT_SOURCE_REPETITION_POLICY) as Array<[SourceType, string]>)
    .filter(([, r]) => r === 'exclude')
    .map(([t]) => t);

const ORDEN: SourceType[] = SOURCE_REPETITION_GROUPS.flatMap(g => g.types);

/**
 * Qué tipos de fuente no se repiten entre dos entregas seguidas de este
 * tipo de trabajo (TP #9, B11). En NT785: los comentarios no; las
 * gramáticas y el texto base sí. Se elige por grupos («los comentarios»),
 * que es como lo dice un sílabo, y se guarda la lista de tipos.
 */
export function WorkTypeNoRepeatField({ value, onChange }: WorkTypeNoRepeatFieldProps) {
    const { t } = useTranslation('projects');
    const id = useId();
    const fijado = Array.isArray(value);
    const vigentes = new Set<SourceType>(fijado ? value : DE_LA_REGLA_GENERAL);
    const alternar = (tipos: ReadonlyArray<SourceType>, marcar: boolean) => {
        const next = new Set(vigentes);
        for (const x of tipos) {
            if (marcar) next.add(x); else next.delete(x);
        }
        // En el orden de los grupos: marcar y desmarcar no deja «cambios sin guardar».
        onChange(ORDEN.filter(x => next.has(x)));
    };

    return (
        <fieldset className="space-y-1.5 sm:col-span-2" aria-describedby={`${id}-hint`}>
            <legend className="text-xs text-muted-foreground">{t('workTypes.noRepeatLegend')}</legend>
            <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">{t('workTypes.noRepeatHint')}</p>
            <div className="grid gap-1 sm:grid-cols-2">
                {SOURCE_REPETITION_GROUPS.map(g => {
                    const marcado = g.types.every(x => vigentes.has(x));
                    return (
                        <label key={g.id} className="flex min-h-11 items-center gap-2 text-sm text-foreground sm:min-h-0">
                            <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternar(g.types, !marcado)}
                                className="h-4 w-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-focus"
                            />
                            {t(`workTypes.noRepeatGroup_${g.id}`)}
                        </label>
                    );
                })}
            </div>
            {fijado ? (
                <p className="text-[11px] text-muted-foreground" data-testid="no-repeat-set">{t('workTypes.noRepeatSet')}</p>
            ) : (
                <div className="flex flex-wrap items-center gap-2" data-testid="no-repeat-unset">
                    <p className="text-[11px] text-warning-subtle-foreground">{t('workTypes.noRepeatUnset')}</p>
                    <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => onChange(ORDEN.filter(x => DE_LA_REGLA_GENERAL.includes(x)))}>
                        {t('workTypes.noRepeatFix')}
                    </Button>
                </div>
            )}
        </fieldset>
    );
}
