import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface StepHeaderAction {
    key: string;
    /** Lo que hace, en palabras: va al tooltip y al `aria-label`. */
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    /** Para «Revisar citas», que es una ruta y no una acción. */
    to?: string;
    disabled?: boolean;
    pending?: boolean;
}

/**
 * Las acciones del paso, como íconos en su encabezado.
 *
 * Pedido del fundador (#26 del ejercicio de Jonás): las acciones sólo estaban
 * al final del paso expandido, y para avanzar rápido —o con todo colapsado—
 * había que abrir cada versículo. Los pies se quedan (el flujo de leer y
 * decidir al final); éstos son un atajo. Cada acción llama al MISMO handler y
 * con la MISMA guarda que su botón del pie: las arma `StepCard` una sola vez.
 *
 * `stopPropagation` en cada clic y en Enter/Espacio: el encabezado entero
 * colapsa el paso, también con el teclado, y su `preventDefault` cancelaba la
 * acción del ícono (revisión adversarial de D2).
 */
export function StepHeaderActions({ actions }: { actions: ReadonlyArray<StepHeaderAction> }) {
    if (actions.length === 0) return null;
    return (
        <div
            className="hidden sm:flex items-center gap-0.5"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            }}
        >
            {actions.map(a => (
                <Tooltip key={a.key}>
                    <TooltipTrigger asChild>
                        {a.to ? (
                            <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label={a.label}>
                                <Link to={a.to}>{a.icon}</Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={a.label}
                                disabled={a.disabled}
                                onClick={a.onClick}
                            >
                                {a.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : a.icon}
                            </Button>
                        )}
                    </TooltipTrigger>
                    <TooltipContent>{a.label}</TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
