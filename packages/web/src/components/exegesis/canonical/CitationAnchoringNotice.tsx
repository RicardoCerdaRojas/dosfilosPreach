import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { CitationAnchoringSummary } from '@dosfilos/domain';

/**
 * Aviso previo a componer: qué parte del trabajo se apoya en fuentes que nadie
 * puede comprobar contra un ejemplar impreso.
 *
 * Existe por un caso real. En un trabajo de Santiago con cien citas, la ÚNICA
 * fabricada —una afirmación que no está en el libro— fue la del único libro sin
 * numeración confirmada. Donde el sistema no puede traducir la hoja a página
 * impresa, la cita sale como «hoja 55», nadie la contrasta, y el error viaja
 * hasta la entrega.
 *
 * Decir «hoja N» en lugar de inventar una página ya era lo correcto, pero es
 * honestidad callada. Esto la dice en voz alta y en el único momento en que
 * todavía se puede hacer algo: calibrar el libro, cambiar la fuente, o revisar
 * esas citas con el ejemplar delante.
 *
 * No bloquea. Citar «hoja N» es legítimo cuando el libro de veras no tiene
 * folios, y el trabajo es de quien lo firma.
 */
export function CitationAnchoringNotice({ summary }: { summary: CitationAnchoringSummary | null }) {
    const { t } = useTranslation('exegesis');
    if (!summary || summary.unanchored === 0) return null;

    return (
        <div className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2.5 text-[11px] text-warning-subtle-foreground">
            <p className="inline-flex items-center gap-2 font-medium">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {t('canonical.compose.anchoring.headline', {
                    count: summary.unanchored,
                    total: summary.total,
                })}
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-[1.375rem]">
                {summary.sources.map(s => (
                    <li key={s.citationKey} className="tabular-nums">
                        {t('canonical.compose.anchoring.source', {
                            label: s.displayLabel,
                            count: s.citations,
                        })}
                    </li>
                ))}
            </ul>
            <p className="mt-1.5 pl-[1.375rem] opacity-90">
                {t('canonical.compose.anchoring.hint')}
            </p>
        </div>
    );
}
