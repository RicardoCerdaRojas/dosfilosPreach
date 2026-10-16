import { useState, type FormEvent } from 'react';
import { Loader2, Search } from 'lucide-react';
import { buscarTemasEnBiblioteca, type AlcanceDeConsulta, type FuenteDeConsulta, type LibroDelTema } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';

/**
 * «Buscar temas» (fase «biblioteca consultable», U5): dónde se habla de algo
 * en la biblioteca, agrupado por libro, sin respuesta redactada. Cada hoja
 * abre el visor. No se guarda en el historial: es una búsqueda.
 */
export function BuscarTemas({ alcance, etiquetar, onAbrir }: {
    alcance: AlcanceDeConsulta;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
}) {
    const { t } = useTranslation('library');
    const [texto, setTexto] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [libros, setLibros] = useState<LibroDelTema[] | null>(null);
    const [aproximado, setAproximado] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buscar = async (e: FormEvent) => {
        e.preventDefault();
        const consulta = texto.trim();
        if (consulta.length < 2 || buscando) return;
        setBuscando(true);
        setError(null);
        try {
            const r = await buscarTemasEnBiblioteca(consulta, alcance);
            setLibros(r.libros);
            setAproximado(!r.reordenado);
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            setError(/\s/.test(mensaje) ? mensaje : t('consult.errorGeneric'));
        } finally {
            setBuscando(false);
        }
    };

    /** Una hoja del resultado, con la forma de una fuente para citarla y abrirla igual. */
    const comoFuente = (libro: LibroDelTema, h: LibroDelTema['hojas'][number]): FuenteDeConsulta => ({
        n: 0, resourceId: libro.resourceId, titulo: libro.titulo, autor: libro.autor, hoja: h.hoja, seccion: h.seccion, extracto: h.extracto,
    });

    return (
        <div className="space-y-5">
            <form onSubmit={e => void buscar(e)} className="flex gap-2">
                <label htmlFor="tema-biblioteca" className="sr-only">{t('consult.topicPlaceholder')}</label>
                <input
                    id="tema-biblioteca"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    maxLength={300}
                    placeholder={t('consult.topicPlaceholder')}
                    className="min-h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                    type="submit"
                    disabled={texto.trim().length < 2 || buscando}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {t('consult.topicSearch')}
                </button>
            </form>
            <p className="text-xs text-muted-foreground">{t('consult.topicHint')}</p>

            {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {libros && aproximado && <p className="text-sm text-muted-foreground">{t('consult.topicApproximate')}</p>}
            {libros && libros.length === 0 && <p className="text-sm text-muted-foreground">{t('consult.topicNone')}</p>}
            {libros && libros.length > 0 && (
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
            )}
        </div>
    );
}
