import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, Search } from 'lucide-react';
import { buscarTemasEnBiblioteca, type AlcanceDeConsulta, type FuenteDeConsulta, type LibroDelTema } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { ResultadosDeTemas } from './ResultadosDeTemas';

/**
 * «Buscar temas» (fase «biblioteca consultable», U5): dónde se habla de algo
 * en la biblioteca, agrupado por libro, sin respuesta redactada. Cada hoja
 * abre el visor. Queda en el historial (el servidor la guarda) y se marca ahí.
 */
export function BuscarTemas({ alcance, etiquetar, onAbrir, onGuardada, envoltorio }: {
    alcance: AlcanceDeConsulta;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
    /** El id con que quedó en el historial, para marcarla ahí. */
    onGuardada?: (consultaId: string) => void;
    /** El bloque del buscador que rodea la caja (modo y alcance). */
    envoltorio: (caja: ReactNode) => ReactNode;
}) {
    const { t } = useTranslation('library');
    const [texto, setTexto] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [libros, setLibros] = useState<LibroDelTema[] | null>(null);
    const [aproximado, setAproximado] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Cada búsqueda nueva empieza sin filtro por libro. */
    const [busqueda, setBusqueda] = useState(0);

    const buscar = async (e: FormEvent) => {
        e.preventDefault();
        const consulta = texto.trim();
        if (consulta.length < 2 || buscando) return;
        setBuscando(true);
        setError(null);
        try {
            const r = await buscarTemasEnBiblioteca(consulta, alcance);
            setLibros(r.libros);
            setBusqueda(n => n + 1);
            setAproximado(!r.reordenado);
            if (r.consultaId) onGuardada?.(r.consultaId);
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            setError(/\s/.test(mensaje) ? mensaje : t('consult.errorGeneric'));
        } finally {
            setBuscando(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                {envoltorio(
                    <form onSubmit={e => void buscar(e)} className="flex items-center gap-2 p-1">
                        <label htmlFor="tema-biblioteca" className="sr-only">{t('consult.topicPlaceholder')}</label>
                        <Search className="ml-2.5 h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
                        <input
                            id="tema-biblioteca"
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            maxLength={300}
                            placeholder={t('consult.topicPlaceholder')}
                            className="min-h-12 min-w-0 flex-1 bg-transparent px-1.5 font-serif text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={texto.trim().length < 2 || buscando}
                            className="inline-flex min-h-12 flex-none items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {t('consult.topicSearch')}
                        </button>
                    </form>,
                )}
                <p className="px-1 text-xs text-muted-foreground">{t('consult.topicHint')}</p>
            </div>

            {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {buscando && <EsqueletoDeResultados />}
            {!buscando && libros && libros.length === 0 && <p className="text-sm text-muted-foreground">{t('consult.topicNone')}</p>}
            {!buscando && libros && libros.length > 0 && <ResultadosDeTemas key={busqueda} libros={libros} etiquetar={etiquetar} onAbrir={onAbrir} aproximado={aproximado} />}
        </div>
    );
}

/** Mientras busca: la forma de las fichas, sin texto (más calmo que un spinner suelto). */
function EsqueletoDeResultados() {
    const { t } = useTranslation('library');
    return (
        <div className="flex flex-col gap-4" role="status" aria-label={t('consult.searching')}>
            {[0, 1].map(i => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-3.5 border-b border-border/60 px-5 py-4">
                        <div className="h-12 w-10 animate-pulse rounded-md bg-muted" />
                        <div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div>
                    </div>
                    <div className="space-y-2 px-5 py-4"><div className="h-3 animate-pulse rounded bg-muted" /><div className="h-3 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /></div>
                </div>
            ))}
        </div>
    );
}
