import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { PageNumbering } from '@dosfilos/domain';
import { BookSearchResults } from '@/components/exegesis/citation/BookSearchResults';
import { printedOfSheet } from '@/components/exegesis/citation/citationSheet';
import { IrAPagina } from '@/components/exegesis/citation/IrAPagina';
import { useDocumentTextSearch } from '@/hooks/exegesis/useDocumentTextSearch';

/**
 * Buscar en el libro e ir a una página impresa, dentro del selector de hojas
 * (fase F, F5).
 *
 * En el TP #7, para encontrar el dativo de Robertson hubo que calcular a mano
 * «hoja = impresa + 79» y adivinar el capítulo: el índice por palabra traía
 * secciones de preposiciones. Con esto se busca lo que se pregunta
 * («dativus commodi») y se va a la página que se vio citada. «Ir a» dice si
 * pide la página impresa o la hoja del archivo (TP #9, B27: `IrAPagina`).
 */
/** Cuánto se espera después de la última tecla antes de buscar. */
export const ESPERA_MS = 400;

export function BuscarEnElLibro({ resourceId, numbering, printedPageOffset, totalSheets = null, currentSheet, onGo, onSearchTerm }: {
    resourceId: string;
    numbering: PageNumbering | null;
    printedPageOffset: number | null;
    /** Hojas del archivo, para avisar de una hoja que no existe. */
    totalSheets?: number | null;
    currentSheet: number;
    onGo: (sheet: number) => void;
    /** El término buscado, para que la hoja lo resalte. */
    onSearchTerm: (term: string | null) => void;
}) {
    const { t } = useTranslation('exegesis');
    const [term, setTerm] = useState('');
    const ctx = { numbering, offset: printedPageOffset };
    // Se busca cuando se deja de escribir, no en cada tecla: cada búsqueda
    // relee el libro entero (1,5–1,8 s en Robertson) y «dativus commodi»
    // disparaba catorce (revisión adversarial, fase F).
    const [buscado, setBuscado] = useState('');
    useEffect(() => {
        const id = window.setTimeout(() => setBuscado(term.trim()), ESPERA_MS);
        return () => window.clearTimeout(id);
    }, [term]);
    const search = useDocumentTextSearch(resourceId, buscado, true);
    const searching = buscado.length >= 2;

    useEffect(() => { onSearchTerm(searching ? buscado : null); }, [buscado, searching, onSearchTerm]);

    return (
        <div className="shrink-0 border-b border-border bg-card" data-testid="buscar-en-el-libro">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <IrAPagina numbering={numbering} printedPageOffset={printedPageOffset} totalSheets={totalSheets} onGo={onGo} />
                <div className="relative min-w-40 flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="search"
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        placeholder={t('citationViewer.searchBookPlaceholder')}
                        aria-label={t('citationViewer.searchBookPlaceholder')}
                        className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            </div>
            {searching && (
                <BookSearchResults
                    hits={search.data?.hits ?? []}
                    truncated={search.data?.truncated ?? false}
                    isLoading={search.isLoading}
                    isError={search.isError}
                    printedOf={sheet => printedOfSheet(sheet, ctx)}
                    currentSheet={currentSheet}
                    onGo={onGo}
                />
            )}
        </div>
    );
}
