import { useState, type FormEvent } from 'react';
import { Loader2, Search } from 'lucide-react';
import { buscarTemasEnBiblioteca, type AlcanceDeConsulta, type FuenteDeConsulta, type LibroDelTema } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { ResultadosDeTemas } from './ResultadosDeTemas';

/**
 * «Buscar temas» (fase «biblioteca consultable», U5): dónde se habla de algo
 * en la biblioteca, agrupado por libro, sin respuesta redactada. Cada hoja
 * abre el visor. Queda en el historial (el servidor la guarda) y se marca ahí.
 */
export function BuscarTemas({ alcance, etiquetar, onAbrir, onGuardada }: {
    alcance: AlcanceDeConsulta;
    etiquetar: (fuente: FuenteDeConsulta) => string;
    onAbrir: (fuente: FuenteDeConsulta) => void;
    /** El id con que quedó en el historial, para marcarla ahí. */
    onGuardada?: (consultaId: string) => void;
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
            if (r.consultaId) onGuardada?.(r.consultaId);
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            setError(/\s/.test(mensaje) ? mensaje : t('consult.errorGeneric'));
        } finally {
            setBuscando(false);
        }
    };

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
            {libros && libros.length > 0 && <ResultadosDeTemas libros={libros} etiquetar={etiquetar} onAbrir={onAbrir} />}
        </div>
    );
}
