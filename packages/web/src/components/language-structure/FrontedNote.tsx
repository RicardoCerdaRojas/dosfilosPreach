import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConstituentRole, FrontingFunction } from '@dosfilos/domain';

/** Una palabra antepuesta al verbo: su función (MACULA) y, si el asistente la leyó, foco o marco. */
export interface FrontedInfo {
    readonly role: ConstituentRole;
    readonly fronting?: FrontingFunction;
}

/**
 * En la ficha de una palabra: va antepuesta al verbo (dato de MACULA). El
 * profesor lo pidió en Stg 2:9 «ἁμαρτίαν ἐργάζεσθε». Si es foco o marco lo
 * decide el contexto (Runge): lo dice el asistente cuando leyó la cláusula;
 * si no, se nombran las dos.
 */
export const FrontedNote: React.FC<{ fronted?: FrontedInfo }> = ({ fronted }) => {
    const { t } = useTranslation('languageStructure');
    if (!fronted) return null;
    const role = t(`roleNames.${fronted.role}`);
    return (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[12px] leading-snug" data-testid="fronted-note">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cardFrontedTitle')}</span>
            {fronted.fronting
                ? t('cardFrontedChosen', { role, fronting: t(`fronting.${fronted.fronting}`) })
                : t('cardFronted', { role })}
        </div>
    );
};
