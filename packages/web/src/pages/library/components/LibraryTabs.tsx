import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export type VistaDeBiblioteca = 'libros' | 'consultar';

/** «Mis libros» / «Consultar» (fase «biblioteca consultable», U3). */
export function LibraryTabs({ vista, onCambiar }: { vista: VistaDeBiblioteca; onCambiar: (v: VistaDeBiblioteca) => void }) {
    const { t } = useTranslation('library');
    return (
        <nav aria-label={t('tabs.books')} className="flex gap-1 border-b border-border">
            {(['libros', 'consultar'] as const).map(v => (
                <button
                    key={v}
                    type="button"
                    aria-current={vista === v ? 'page' : undefined}
                    onClick={() => onCambiar(v)}
                    className={cn(
                        '-mb-px min-h-10 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        vista === v ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                >
                    {v === 'libros' ? t('tabs.books') : t('tabs.consult')}
                </button>
            ))}
        </nav>
    );
}
