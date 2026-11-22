import { useTranslation } from 'react-i18next';
import { sheetPagesIn, sheetPagesLabel, type PageNumbering } from '@dosfilos/domain';

/**
 * En lugar del formulario de calibración, para un libro que marca sus páginas
 * dentro del texto («[p 667]», A8b). Ahí no se calibra a mano: el número
 * arriba de la hoja de Kittel es el del archivo («224») y no el del libro
 * (pp. 281–282), y escribirlo devolvía las hojas sin marca a la cita falsa
 * del TP #10. Solo se muestra qué páginas tiene la hoja que se mira.
 */
export function MarkedPagesPanel({ numbering, sheet, markedSheets }: {
    numbering: PageNumbering | null;
    sheet: number;
    markedSheets: number;
}) {
    const { t } = useTranslation('library');
    const pages = sheetPagesIn(numbering, sheet);
    return (
        <div className="space-y-3 text-sm">
            <p className="text-foreground">{t('numbering.markedPages', { count: markedSheets })}</p>
            <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 font-medium text-foreground">
                {pages
                    ? t(pages.from === pages.to ? 'numbering.markedSheetOne' : 'numbering.markedSheetMany', { sheet, pages: sheetPagesLabel(pages) })
                    : t('numbering.markedSheetNone', { sheet })}
            </p>
            <p className="text-xs text-muted-foreground">{t('numbering.markedNoCalibration')}</p>
        </div>
    );
}
