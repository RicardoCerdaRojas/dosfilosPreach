import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEspacioDeLaBarra } from './barra-de-pagina-contexto';

/**
 * El encabezado de una página, dentro de la barra única de la app: un título
 * chico con su dato al lado, los controles de la vista (pestañas) y las
 * acciones a la derecha. Reemplaza al encabezado editorial de cada página
 * (rótulo + título grande + bajada), que ocupaba ~150 px antes del contenido.
 *
 * Sin `DashboardLayout` alrededor (pruebas, páginas sueltas) no dibuja nada.
 */
export function BarraDePagina({ titulo, dato, controles, acciones }: {
    titulo: string;
    /** Un dato corto junto al título («73 libros · 64 listos»). */
    dato?: ReactNode;
    /** Los controles de la vista: pestañas, segmentos. */
    controles?: ReactNode;
    /** Las acciones de la página, a la derecha. */
    acciones?: ReactNode;
}) {
    const espacio = useEspacioDeLaBarra();
    if (!espacio) return null;
    return createPortal(
        <>
            <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="m-0 truncate text-[15px] font-semibold leading-none text-foreground">{titulo}</h1>
                {dato && <span className="hidden truncate text-[12.5px] tabular-nums text-muted-foreground sm:inline">{dato}</span>}
            </div>
            {/* En el teléfono bajan a una segunda fila, a todo el ancho (no
                caben junto al título y las acciones: se encimaban). */}
            {controles && <div className="order-last flex min-w-0 basis-full items-center sm:order-none sm:basis-auto [&>*]:w-full sm:[&>*]:w-auto">{controles}</div>}
            <div className="flex-1" />
            {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </>,
        espacio,
    );
}
