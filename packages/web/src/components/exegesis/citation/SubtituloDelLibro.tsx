import { cn } from '@/lib/utils';

import { subtituloDelLibro } from './subtituloDelLibroTexto';

/** Título del recurso y autor, bajo el rótulo de la fuente (TP #9, B19; ver `subtituloDelLibro`). */
interface Props {
    label: string;
    title: string | null | undefined;
    author: string | null | undefined;
    className?: string;
}

export function SubtituloDelLibro({ label, title, author, className }: Props) {
    const text = subtituloDelLibro(label, title, author);
    if (!text) return null;
    return (
        <p className={cn('truncate text-xs text-muted-foreground', className)} title={text} data-testid="libro-autor">
            {text}
        </p>
    );
}
