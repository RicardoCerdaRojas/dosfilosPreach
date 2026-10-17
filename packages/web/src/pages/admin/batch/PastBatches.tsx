import { useTranslation } from '@/i18n';
import { Card } from '@/components/ui/card';
import type { LotePasado } from '@/lib/loteReport';

/** Los lotes ya aplicados a esta biblioteca: la marca que deja `aplicar` en cada libro. */
export function PastBatches({ lotes }: { lotes: LotePasado[] }) {
    const { t, i18n } = useTranslation('admin');
    if (lotes.length === 0) return <Card className="p-6 text-sm text-muted-foreground">{t('batch.past.empty')}</Card>;
    const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : '—');
    return (
        <div className="space-y-3">
            {lotes.map(l => (
                <Card key={l.nombre} className="p-5 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold">{l.nombre}</h3>
                        <span className="text-sm text-muted-foreground">{t('batch.past.meta', { count: l.libros.length, fecha: fecha(l.fecha) })}</span>
                    </div>
                    <ul className="m-0 list-none space-y-1 p-0 text-sm">
                        {l.libros.map(b => (
                            <li key={b.id} className="flex flex-wrap gap-x-2">
                                <span className="font-medium">{b.titulo || b.id}</span>
                                {b.motivo && <span className="text-muted-foreground">{b.motivo}</span>}
                            </li>
                        ))}
                    </ul>
                </Card>
            ))}
        </div>
    );
}
