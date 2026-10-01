import { citationDisplayRaw, citationSite, type ParsedCitation } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Una cita como se muestra: la cita misma y, si viene del análisis, en qué
 * parte del análisis vive, en español. Antes se mostraba el rótulo interno
 * en inglés pegado a la cita («Ropes, p. 204 · lexical-loading»).
 */
export function CitationLabel({ citation, className }: {
    citation: Pick<ParsedCitation, 'raw' | 'site'>;
    className?: string;
}) {
    const { t } = useTranslation('exegesis');
    const site = citationSite(citation);
    return (
        <span className={className}>
            <span className="font-mono text-foreground">{citationDisplayRaw(citation)}</span>
            {site && (
                <span className="ml-2 text-[11px] font-sans text-muted-foreground">
                    · {t(`canonical.verify.site.${site}`)}
                </span>
            )}
        </span>
    );
}
