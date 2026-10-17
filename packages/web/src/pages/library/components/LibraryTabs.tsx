import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export type VistaDeBiblioteca = 'libros' | 'consultar';

/**
 * Las dos vistas de la Biblioteca, como control segmentado en la barra única
 * (fase «barra única», 2026-10-17). Antes eran pestañas subrayadas en su
 * propia fila, bajo un encabezado editorial.
 */
export function LibraryTabs({ vista, onCambiar }: { vista: VistaDeBiblioteca; onCambiar: (v: VistaDeBiblioteca) => void }) {
    const { t } = useTranslation('library');
    return (
        <nav aria-label={t('tabs.label')} className="inline-flex rounded-lg bg-muted p-[3px]">
            {(['libros', 'consultar'] as const).map(v => (
                <button
                    key={v}
                    type="button"
                    aria-current={vista === v ? 'page' : undefined}
                    onClick={() => onCambiar(v)}
                    className={cn(
                        'h-[30px] flex-1 rounded-md px-3 text-[13.5px] transition-colors sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        vista === v ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                >
                    {v === 'libros' ? t('tabs.books') : t('tabs.consult')}
                </button>
            ))}
        </nav>
    );
}
