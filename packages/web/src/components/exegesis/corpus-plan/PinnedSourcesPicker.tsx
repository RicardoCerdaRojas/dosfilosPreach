import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { ProjectSource, SourceRole } from '@dosfilos/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PinnedSourcesPickerProps {
    /** All sources currently in the paper's corpus (the picker's universe). */
    sources: ReadonlyArray<ProjectSource>;
    /** Currently pinned ids (controlled). */
    selected: ReadonlyArray<string>;
    /**
     * Optional dialectical role per pinned id. When provided, each
     * chip renders a small role badge (anchor / contrast / technical)
     * so the user sees the strategy at a glance instead of a flat list.
     * Pre-roles plans (or sources the planner couldn't classify) just
     * render without a badge — visually backward-compatible.
     */
    roles?: Readonly<Record<string, SourceRole>>;
    /**
     * Cambiar el rol de una fuente pinchada. `null` se lo quita.
     *
     * Sin esto el rol era de sólo lectura: lo asignaba el plan y quien editaba
     * las fuentes a mano no tenía manera de dárselo a la que agregaba. Con
     * #698 el analizador lee el rol, así que dejarlo sin asignar no es
     * neutral — esa fuente vuelve a clasificarse sola.
     */
    onChangeRole?: (sourceId: string, role: SourceRole | null) => void;
    onChange: (next: ReadonlyArray<string>) => void;
    disabled?: boolean;
}

// Role pill palette. Uses the paired `*-subtle` / `*-subtle-foreground`
// design tokens so the text stays legible against the small filled
// pill — the previous `bg-{color}/15 text-{color}` combo was too low
// contrast (especially on the secondary parent badge's gray
// background, where the colored text washed out almost to invisible).
const ROLE_BADGE_CLASSES: Record<SourceRole, string> = {
    anchor: 'bg-success text-success-foreground border-success',
    contrast: 'bg-info text-info-foreground border-info',
    technical: 'bg-warning text-warning-foreground border-warning',
};

/**
 * v1.7 corpus-usage planning — multi-select picker over the paper's
 * `ProjectSource[]`. Shows selected sources as removable badges above
 * + a popover (Command) for add/toggle. Mirrors the
 * `BibleBookMultiSelect` pattern from the smart-match feature.
 *
 * Read-only short labels in the badges (truncated displayLabel +
 * citationKey). The popover shows the full label for picking.
 */
export function PinnedSourcesPicker({
    sources,
    selected,
    roles,
    onChange,
    onChangeRole,
    disabled = false,
}: PinnedSourcesPickerProps) {
    const { t } = useTranslation('exegesis');
    const [open, setOpen] = useState(false);

    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const sourcesById = useMemo(() => {
        const map = new Map<string, ProjectSource>();
        for (const s of sources) map.set(s.id, s);
        return map;
    }, [sources]);

    const toggle = (id: string) => {
        if (selectedSet.has(id)) {
            onChange(selected.filter(s => s !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    const remove = (id: string) => {
        onChange(selected.filter(s => s !== id));
    };

    return (
        <div className="space-y-1.5">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1" role="list">
                    {selected.map(id => {
                        const source = sourcesById.get(id);
                        const label = source?.displayLabel ?? id;
                        const role = roles?.[id];
                        return (
                            <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 pr-1 text-[10.5px] max-w-[320px]"
                                role="listitem"
                                title={role
                                    ? `${t(`paperSetup.subSteps.corpus-plan.role.${role}`)} · ${label}`
                                    : label}
                            >
                                {/* El rol se puede cambiar acá. Antes sólo se
                                    mostraba: el plan lo asignaba y quien
                                    editaba las fuentes a mano no tenía manera
                                    de dárselo a la que agregaba. Desde #698 el
                                    analizador LEE el rol, así que una fuente
                                    sin él vuelve a clasificarse sola. */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild disabled={disabled}>
                                        <button
                                            type="button"
                                            className={`shrink-0 rounded-full border px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide leading-tight ${
                                                role ? ROLE_BADGE_CLASSES[role] : 'border-dashed border-border text-muted-foreground'
                                            }`}
                                            aria-label={t('paperSetup.subSteps.corpus-plan.picker.roleAria', { label })}
                                        >
                                            {role
                                                ? t(`paperSetup.subSteps.corpus-plan.role.${role}`)
                                                : t('paperSetup.subSteps.corpus-plan.role.none')}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {(['anchor', 'contrast', 'technical'] as const).map(r => (
                                            <DropdownMenuItem key={r} onClick={() => onChangeRole?.(id, r)}>
                                                {t(`paperSetup.subSteps.corpus-plan.role.${r}`)}
                                            </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => onChangeRole?.(id, null)}>
                                            {t('paperSetup.subSteps.corpus-plan.role.clear')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <span className="truncate">{label}</span>
                                <button
                                    type="button"
                                    onClick={() => remove(id)}
                                    disabled={disabled}
                                    className="rounded-sm hover:bg-foreground/10 focus:outline-none focus:ring-1 focus:ring-ring p-0.5 shrink-0"
                                    aria-label={t('paperSetup.subSteps.corpus-plan.picker.removeAria', { label })}
                                >
                                    <X className="h-2.5 w-2.5" aria-hidden />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled || sources.length === 0}
                        className="h-7 text-[11px] font-normal gap-1"
                    >
                        {selected.length === 0
                            ? t('paperSetup.subSteps.corpus-plan.picker.add')
                            : t('paperSetup.subSteps.corpus-plan.picker.edit', { count: selected.length })}
                        <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[460px] max-w-[calc(100vw-2rem)] p-0 shadow-xl border-2 border-border z-50"
                    align="start"
                    sideOffset={6}
                >
                    <Command>
                        <CommandInput
                            placeholder={t('paperSetup.subSteps.corpus-plan.picker.search')}
                            className="text-[12px]"
                        />
                        <CommandList className="max-h-72">
                            <CommandEmpty>{t('paperSetup.subSteps.corpus-plan.picker.noMatches')}</CommandEmpty>
                            <CommandGroup>
                                {sources.map(source => (
                                    <CommandItem
                                        key={source.id}
                                        value={`${source.id} ${source.displayLabel} ${source.citationKey ?? ''}`}
                                        onSelect={() => toggle(source.id)}
                                        className="text-[12px] gap-2 items-start py-2"
                                    >
                                        <Check
                                            className={cn(
                                                'h-3.5 w-3.5 mt-0.5 shrink-0',
                                                selectedSet.has(source.id) ? 'opacity-100' : 'opacity-0',
                                            )}
                                            aria-hidden
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-foreground leading-snug break-words">
                                                {source.displayLabel}
                                            </div>
                                            {source.citationKey && (
                                                <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                                                    {source.citationKey} · {source.sourceType}
                                                </div>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
