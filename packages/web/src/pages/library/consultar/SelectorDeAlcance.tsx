import { useState } from 'react';
import { Check, ChevronDown, Library } from 'lucide-react';
import type { AlcanceDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface LibroElegible {
    id: string;
    title: string;
    author: string;
}

/**
 * Dónde se pregunta: toda la biblioteca o los libros que se elijan (fase
 * «biblioteca consultable», U3). Un solo chip dentro del buscador
 * (rediseño, 2026-10-17). Sólo se ofrecen libros indexados: uno sin índice
 * no tiene fragmentos y la consulta no lo vería.
 */
export function SelectorDeAlcance({ libros, alcance, onCambiar }: {
    libros: ReadonlyArray<LibroElegible>;
    alcance: AlcanceDeConsulta;
    onCambiar: (alcance: AlcanceDeConsulta) => void;
}) {
    const { t } = useTranslation('library');
    const [abierto, setAbierto] = useState(false);
    const elegidos = alcance.tipo === 'libros' ? alcance.ids : [];

    const alternar = (id: string) => {
        const ids = elegidos.includes(id) ? elegidos.filter(x => x !== id) : [...elegidos, id];
        onCambiar(ids.length === 0 ? { tipo: 'todo' } : { tipo: 'libros', ids });
    };

    const rotulo = alcance.tipo === 'todo'
        ? t('consult.scopeAll')
        : elegidos.length === 1
            ? libros.find(l => l.id === elegidos[0])?.title ?? t('consult.scopeBooks', { count: 1 })
            : t('consult.scopeBooks', { count: elegidos.length });

    return (
        <Popover open={abierto} onOpenChange={setAbierto}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${t('consult.scopeLabel')} ${rotulo}`}
                    className={cn(
                        'inline-flex min-h-9 max-w-[18rem] items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        alcance.tipo === 'libros' ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border bg-card text-foreground/80 hover:bg-muted',
                    )}
                >
                    <Library className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{rotulo}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[22rem] p-0" align="end">
                <Command>
                    <CommandInput placeholder={t('consult.scopeSearch')} />
                    <CommandList className="max-h-72">
                        <CommandEmpty>{t('consult.scopeEmpty')}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem value={`__todo ${t('consult.scopeAll')}`} onSelect={() => { onCambiar({ tipo: 'todo' }); setAbierto(false); }}>
                                <Check className={cn('mr-2 h-4 w-4 shrink-0', alcance.tipo === 'todo' ? 'opacity-100' : 'opacity-0')} />
                                <span className="text-sm font-medium">{t('consult.scopeAll')}</span>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading={t('consult.scopePick')}>
                            {libros.map(l => (
                                <CommandItem key={l.id} value={`${l.title} ${l.author} ${l.id}`} onSelect={() => alternar(l.id)}>
                                    <Check className={cn('mr-2 h-4 w-4 shrink-0', elegidos.includes(l.id) ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm">{l.title}</span>
                                        {l.author && <span className="block truncate text-xs text-muted-foreground">{l.author}</span>}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
