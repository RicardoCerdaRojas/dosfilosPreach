import type { FuenteDeConsulta, LibroDelTema } from '@dosfilos/infrastructure';

/** Una hoja del resultado, con la forma de una fuente para citarla y abrirla igual. */
const comoFuente = (libro: LibroDelTema, h: LibroDelTema['hojas'][number]): FuenteDeConsulta => ({
    n: 0, resourceId: libro.resourceId, titulo: libro.titulo, autor: libro.autor, hoja: h.hoja, seccion: h.seccion, extracto: h.extracto,
});

/**
 * Los libros y hojas de una búsqueda de temas: la que se acaba de hacer y la
 * que se abre desde el historial (fase «buscador de la biblioteca»).
 */
export function ResultadosDeTemas({ libros, etiquetar, onAbrir }: {
    libros: ReadonlyArray<LibroDelTema>;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
}) {
    return (
        <ul className="space-y-5" data-testid="temas-por-libro">
            {libros.map(libro => (
                <li key={libro.resourceId} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                        {libro.titulo}
                        {libro.autor && <span className="ml-2 font-normal text-muted-foreground">{libro.autor}</span>}
                    </h3>
                    <ol className="space-y-1 border-l-2 border-primary/30 pl-3">
                        {libro.hojas.map(h => {
                            const fuente = comoFuente(libro, h);
                            return (
                                <li key={`${libro.resourceId}-${h.hoja}`}>
                                    <button
                                        type="button"
                                        onClick={() => onAbrir(fuente)}
                                        className="group w-full rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="font-serif text-sm font-semibold text-foreground group-hover:text-primary">{etiquetar(fuente)}</span>
                                        {h.seccion && <span className="ml-2 text-xs text-muted-foreground">§ {h.seccion}</span>}
                                        <span className="mt-1 block text-sm text-muted-foreground line-clamp-2">{h.extracto}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </li>
            ))}
        </ul>
    );
}
