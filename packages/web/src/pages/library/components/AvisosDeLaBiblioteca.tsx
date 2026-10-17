import { AlertTriangle } from 'lucide-react';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LibraryAttentionCallout } from './LibraryAttentionCallout';
import { LibraryStatusCallout } from './LibraryStatusCallout';
import { LibraryCalibrationCallout } from './LibraryCalibrationCallout';
import { needsCalibration } from './necesitaCalibrar';

/**
 * Los avisos de estado de la biblioteca en una pastilla de la barra (fase
 * «barra única»): antes eran hasta cinco carteles apilados sobre la lista de
 * libros. Al abrirla se ven los mismos avisos, con sus botones. Sin avisos,
 * no aparece.
 */
export function AvisosDeLaBiblioteca({
    resources, pendingCount, extractingCount, indexFailed, failedCount, isProcessing, onProcessAll, onRetryIndexing,
}: {
    resources: LibraryResourceEntity[];
    pendingCount: number;
    extractingCount: number;
    indexFailed: LibraryResourceEntity[];
    failedCount: number;
    isProcessing: boolean;
    onProcessAll: () => void;
    onRetryIndexing: () => void;
}) {
    const { t } = useTranslation('library');
    const avisos = [
        pendingCount > 0 && !isProcessing,
        extractingCount > 0,
        indexFailed.length > 0,
        failedCount > 0,
        resources.some(needsCalibration),
    ].filter(Boolean).length;
    if (avisos === 0) return null;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warning-subtle px-3 text-[12.5px] font-semibold text-warning-subtle-foreground transition-colors hover:bg-warning-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('notices.pill', { count: avisos })}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-[min(30rem,calc(100vw-2rem))] flex-col gap-2 p-3">
                <LibraryAttentionCallout pendingCount={pendingCount} isProcessing={isProcessing} onProcessAll={onProcessAll} />
                <LibraryStatusCallout variant="extracting" count={extractingCount} />
                <LibraryStatusCallout variant="indexFailed" count={indexFailed.length} onRetry={onRetryIndexing} isRetrying={isProcessing} />
                <LibraryStatusCallout variant="failed" count={failedCount} />
                <LibraryCalibrationCallout resources={resources} />
            </PopoverContent>
        </Popover>
    );
}
