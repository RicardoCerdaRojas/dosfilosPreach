import { useTranslation } from 'react-i18next';
import { printedRangeOf } from '@dosfilos/domain';
import type { NumberingSegment, PageNumbering } from '@dosfilos/domain';

interface Props {
    numbering: PageNumbering | null;
}

/**
 * Cómo queda descrito un tramo, sin prometer páginas imposibles.
 *
 * La primera versión mostraba «la hoja 1 imprime −3», que es lo que sale de
 * aplicar el desfase a la primera hoja de un libro con preliminares: la cuenta
 * cae antes de la página 1. Un número negativo en una pantalla cuyo trabajo es
 * dar confianza sobre números destruye justamente eso.
 *
 * Se muestra el rango de páginas impresas que el tramo produce de verdad, y se
 * dice aparte cuántas hojas quedan antes de que el libro empiece a numerar.
 */
export function NumberingSegmentsPreview({ numbering }: Props) {
    const { t } = useTranslation('library');

    const describeSegment = (segment: NumberingSegment): string => {
        // El rango lo calcula el DOMINIO, no esta pantalla. Antes lo recalculaba
        // acá con `hoja + offset` —su propia copia de la regla— y con un tramo
        // descendente habría mostrado el rango al revés mientras las citas
        // mostraban el correcto.
        const rango = printedRangeOf(segment);
        if (!rango) return t('numbering.noArabic');

        const range = t('numbering.printedRange', { from: rango.from, to: rango.to });
        return rango.unnumberedSheets > 0
            ? `${range} · ${t('numbering.frontMatter', { count: rango.unnumberedSheets })}`
            : range;
    };

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
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
                    >
                        <span className="tabular-nums text-muted-foreground">
                            {t('numbering.sheetRange', { from: segment.fromSheet, to: segment.toSheet })}
                        </span>
                        <span className={`tabular-nums ${segment.offset === null ? 'text-muted-foreground' : ''}`}>
                            {describeSegment(segment)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
