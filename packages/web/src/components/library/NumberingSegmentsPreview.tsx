import { useTranslation } from 'react-i18next';
import type { PageNumbering } from '@dosfilos/domain';

interface Props {
    numbering: PageNumbering | null;
}

/**
 * Los tramos que se van a guardar, tal como quedaron.
 *
 * Está a la vista antes de confirmar porque las fronteras son una
 * aproximación: el usuario confirma tres hojas y el sistema reparte el resto a
 * mitad de camino entre ellas. Mostrar el resultado convierte esa
 * aproximación en algo que se puede corregir, en vez de una decisión que el
 * sistema toma por su cuenta y nadie ve hasta que una cita sale mal.
 */
export function NumberingSegmentsPreview({ numbering }: Props) {
    const { t } = useTranslation('library');

    if (!numbering || numbering.segments.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('numbering.previewEmpty')}</p>;
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('numbering.previewTitle')}
            </p>
            <ul className="divide-y rounded border">
                {numbering.segments.map(segment => (
                    <li
                        key={`${segment.fromSheet}-${segment.toSheet}`}
                        className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm"
                    >
                        <span className="tabular-nums text-muted-foreground">
                            {t('numbering.sheetRange', { from: segment.fromSheet, to: segment.toSheet })}
                        </span>
                        <span className="tabular-nums">
                            {segment.offset === null
                                ? <span className="text-muted-foreground">{t('numbering.noArabic')}</span>
                                : t('numbering.offsetLabel', {
                                    example: segment.fromSheet,
                                    printed: segment.fromSheet + segment.offset,
                                })}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
