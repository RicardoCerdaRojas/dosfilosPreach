import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { formatCitation, type RuleSource } from '@dosfilos/domain';

/**
 * La fuente de una regla o categoría, lista para citar (Wallace, Runge…).
 * Sin página verificada, la cita va sin página: nunca una inventada.
 */
export const SourceNote: React.FC<{
    sources?: readonly RuleSource[];
    /** Compacta: sólo «Fuente», y la cita al tocarla (en «Estructura», una por fila sería ruido). */
    compact?: boolean;
}> = ({ sources, compact = false }) => {
    const { t } = useTranslation('languageStructure');
    const [copiada, setCopiada] = React.useState(false);
    const [abierta, setAbierta] = React.useState(!compact);
    if (!sources?.length) return null;
    if (!abierta) {
        return (
            <button
                type="button"
                onClick={() => setAbierta(true)}
                aria-expanded={false}
                // Antes era un «FUENTE» de 9,5 px sin señal de que se podía tocar
                // (prueba del fundador, Stg 2:9): ahora se lee como enlace.
                className="-mx-1 rounded px-1 py-0.5 text-[11px] text-primary underline-offset-2 hover:underline cursor-pointer print:hidden"
                data-testid="source-toggle"
            >
                {t('showSource')}
            </button>
        );
    }
    const citas = sources.map(s => formatCitation(s));
    // Se copia la cita completa (obra y año), como va en un trabajo.
    const completas = sources.map(s => formatCitation(s, 'full'));
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(completas.join('; '));
            setCopiada(true);
            setTimeout(() => setCopiada(false), 1500);
        } catch { /* sin portapapeles: la cita sigue a la vista */ }
    };
    return (
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-snug text-muted-foreground" data-testid="source-note">
            <span className="font-semibold uppercase tracking-wider text-[9.5px]">{t('source')}</span>
            <span className="italic" title={completas.join('\n')}>{citas.join(' · ')}</span>
            <button
                type="button"
                onClick={() => void copiar()}
                title={t('copyCitation')}
                aria-label={t('copyCitation')}
                className="inline-flex items-center text-muted-foreground hover:text-foreground print:hidden"
            >
                {copiada ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
        </p>
    );
};
