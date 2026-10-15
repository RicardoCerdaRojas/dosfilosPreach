import { useState } from 'react';
import { Check, ChevronsUpDown, Library } from 'lucide-react';
import type { AlcanceDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface LibroElegible {
    id: string;
    title: string;
    author: string;
}

/**
 * Dónde se pregunta: toda la biblioteca o los libros que se elijan (fase
 * «biblioteca consultable», U3). Sólo se ofrecen libros indexados: uno sin
 * índice no tiene fragmentos y la consulta no lo vería.
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
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('consult.scopeLabel')}>
            <span className="text-sm text-muted-foreground">{t('consult.scopeLabel')}</span>
            <button
                type="button"
                onClick={() => onCambiar({ tipo: 'todo' })}
                aria-pressed={alcance.tipo === 'todo'}
                className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    alcance.tipo === 'todo' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
            >
                <Library className="h-4 w-4" />
                {t('consult.scopeAll')}
            </button>
            <Popover open={abierto} onOpenChange={setAbierto}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-pressed={alcance.tipo === 'libros'}
                        className={cn(
                            'inline-flex min-h-9 max-w-[18rem] items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            alcance.tipo === 'libros' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                    >
                        <span className="truncate">{alcance.tipo === 'libros' ? rotulo : t('consult.scopePick')}</span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-70" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[22rem] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={t('consult.scopeSearch')} />
                        <CommandList className="max-h-72">
                            <CommandEmpty>{t('consult.scopeEmpty')}</CommandEmpty>
                            <CommandGroup>
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
        </div>
    );
}
