import { useTranslation } from '@/i18n';
import { LibraryCategory, ResourceType } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookMarked, LayoutGrid, List, Ruler, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface LibraryFiltersProps {
    /** Categories for the filter dropdown. */
    categories: LibraryCategory[];
    /** Current search query. */
    searchQuery: string;
    /** Current category filter (or 'all'). */
    categoryFilter: ResourceType | 'all';
    /** Active view mode (grid or list). */
    viewMode: ViewMode;
    /** Cuando está activo, sólo se listan los recursos sin libros bíblicos. */
    onlyWithoutBooks: boolean;
    /** Cuando está activo, sólo se listan los recursos sin numeración calibrada. */
    onlyUncalibrated: boolean;
    /** Search input change handler. */
    onSearchChange: (query: string) => void;
    /** Category filter change handler. */
    onCategoryChange: (filter: ResourceType | 'all') => void;
    /** View mode change handler. */
    onViewModeChange: (mode: ViewMode) => void;
    onOnlyWithoutBooksChange: (only: boolean) => void;
    onOnlyUncalibratedChange: (only: boolean) => void;
}

/**
 * Slim filter row: search input + category dropdown + grid/list toggle.
 * No internal state — pure controlled inputs delegated to parent.
 */
export function LibraryFilters({
    categories,
    searchQuery,
    categoryFilter,
    viewMode,
    onlyWithoutBooks,
    onlyUncalibrated,
    onSearchChange,
    onCategoryChange,
    onViewModeChange,
    onOnlyWithoutBooksChange,
    onOnlyUncalibratedChange,
}: LibraryFiltersProps) {
    const { t } = useTranslation('library');

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder={t('filters.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as ResourceType | 'all')}>
                <SelectTrigger className="w-full sm:w-[200px] h-9">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
                    {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/*
              * Sin este filtro no había forma de ver qué recursos
              * quedaron sin libros asignados: el detector automático
              * deja siempre un resto —homilética, consejería— que hay
              * que completar a mano, y encontrarlo obligaba a abrir uno
              * por uno.
              */}
            <Button
                variant={onlyWithoutBooks ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={onlyWithoutBooks}
                onClick={() => onOnlyWithoutBooksChange(!onlyWithoutBooks)}
                className={cn('h-9 gap-1.5', onlyWithoutBooks && 'border-primary/40')}
                title={t('filters.onlyWithoutBooksTitle')}
            >
                <BookMarked className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('filters.onlyWithoutBooks')}</span>
            </Button>
            {/*
              * Sin calibrar, una cita dice «hoja 150» — la hoja del PDF— en vez
              * de «p. 142», que es la página del ejemplar impreso. El sistema
              * calla antes que mentir, así que el recurso no se ve roto: se ve
              * menos preciso, y eso no salta a la vista en ninguna parte.
              *
              * Calibrar es trabajo manual por libro, así que lo primero que
              * hace falta es poder VER cuáles faltan.
              */}
            <Button
                variant={onlyUncalibrated ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={onlyUncalibrated}
                onClick={() => onOnlyUncalibratedChange(!onlyUncalibrated)}
                className={cn('h-9 gap-1.5', onlyUncalibrated && 'border-primary/40')}
                title={t('filters.onlyUncalibratedTitle')}
            >
                <Ruler className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('filters.onlyUncalibrated')}</span>
            </Button>
            <div className="flex gap-0.5 border border-border/60 rounded-lg p-0.5 sm:ml-auto">
                <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => onViewModeChange('grid')}
                    className="h-7 w-7 p-0"
                    title={t('filters.viewGridTitle')}
                >
                    <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => onViewModeChange('list')}
                    className="h-7 w-7 p-0"
                    title={t('filters.viewListTitle')}
                >
                    <List className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
