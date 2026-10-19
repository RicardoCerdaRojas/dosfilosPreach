import { useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useBatchCandidates } from '@/hooks/admin/useBatchCandidates';
import { useBatchActions, useBatchJobs } from '@/hooks/admin/useBatchJobs';
import { esRecomendado } from '@/lib/loteReport';
import { CandidatesTable } from './batch/CandidatesTable';
import { EstimateBar } from './batch/EstimateBar';
import { PastBatches } from './batch/PastBatches';
import { BatchJobs } from './batch/BatchJobs';
import { BarraDePagina } from '@/components/layout/barra-de-pagina';

/**
 * Reproceso en lote (docs/FASE_LOTE_SUPER_ADMIN_2026-10.md, PR 1 y 2). Los
 * libros de una biblioteca ordenados por lo que conviene reprocesar, el costo
 * de lo elegido, «Preparar lote» (gasta, con confirmación) y el seguimiento
 * de los lotes lanzados. Aplicar el resultado llega en el PR 3. Sólo administración.
 */
export function BatchReprocessDashboard() {
    const { t } = useTranslation('admin');
    const [dueno, setDueno] = useState<string | null>(null);
    const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useBatchCandidates(dueno);
    // Mientras llega otra biblioteca se ve la anterior (para el selector), pero sus libros no se eligen.
    const cargando = isLoading || isPlaceholderData;
    const [elegidos, setElegidos] = useState<ReadonlySet<string>>(new Set());
    const candidatos = useMemo(() => (isPlaceholderData ? [] : data?.candidatos ?? []), [data, isPlaceholderData]);
    // Un excluido nunca entra, aunque haya quedado elegido de antes de actualizar.
    const seleccion = useMemo(() => candidatos.filter(c => elegidos.has(c.id) && !c.excluido), [candidatos, elegidos]);

    const alternar = (id: string) => setElegidos(prev => {
        const sig = new Set(prev);
        if (sig.has(id)) sig.delete(id); else sig.add(id);
        return sig;
    });
    const elegirRecomendados = () => setElegidos(new Set(candidatos.filter(esRecomendado).map(c => c.id)));
    const cambiarDueno = (uid: string) => { setDueno(uid); setElegidos(new Set()); };
    const [pestana, setPestana] = useState('candidatos');
    const lotes = useBatchJobs();
    const { lanzar } = useBatchActions();
    const enMarcha = (lotes.data ?? []).filter(l => l.estado === 'preparando' || l.estado === 'en-curso').length;
    const lanzarLote = (nombre: string, estimadoUsd: number) => {
        if (!data) return;
        lanzar.mutate({ nombre, ownerUid: data.dueno, ids: seleccion.map(c => c.id), estimadoUsd }, {
            onSuccess: r => {
                toast.success(t('batch.launch.done', { nombre: r.id, count: r.libros }));
                setElegidos(new Set());
                setPestana('enMarcha');
            },
            onError: err => toast.error(err instanceof Error ? err.message : String(err)),
        });
    };

    return (
        <>
        {/* Barra única (docs/FASE_BARRA_UNICA_2026-10.md): el título, la
            biblioteca y «Actualizar» van arriba; la bajada, al ⓘ de cada acción. */}
        <BarraDePagina
            titulo={t('batch.title')}
            acciones={<>
                {data && data.duenos.length > 0 && (
                    <>
                        <Label htmlFor="biblioteca-del-lote" className="hidden text-sm text-muted-foreground md:inline">{t('batch.owner')}</Label>
                        <Select value={dueno ?? data.dueno} onValueChange={cambiarDueno}>
                            <SelectTrigger id="biblioteca-del-lote" aria-label={t('batch.owner')} className="h-8 w-44 sm:w-60"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {data.duenos.map(d => <SelectItem key={d.uid} value={d.uid}>{d.email}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </>
                )}
                <Button variant="outline" size="sm" onClick={() => { void refetch(); void lotes.refetch(); }} disabled={isFetching || lotes.isFetching} aria-label={t('common.refresh')}>
                    {isFetching || lotes.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">{t('common.refresh')}</span>
                </Button>
            </>}
        />
        {/* Todo el ancho: con `max-w-6xl` la tabla de libros cortaba los botones. */}
        <div className="w-full space-y-5 px-2 py-3 sm:px-4 lg:px-6">
            {cargando && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {error && <Card className="p-4 border-destructive text-sm text-foreground">{t('batch.loadError')}</Card>}

            {!cargando && (
                <Tabs value={pestana} onValueChange={setPestana}>
                    <TabsList>
                        <TabsTrigger value="candidatos">{t('batch.tabs.candidates')}</TabsTrigger>
                        <TabsTrigger value="enMarcha">{t('batch.tabs.running', { count: enMarcha })}</TabsTrigger>
                        <TabsTrigger value="lotes">{t('batch.tabs.past', { count: data?.lotes.length ?? 0 })}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="candidatos" className="space-y-4">
                        {data && candidatos.length === 0 && <Card className="p-6 text-sm text-muted-foreground">{t('batch.empty')}</Card>}
                        {candidatos.length > 0 && <CandidatesTable candidatos={candidatos} elegidos={elegidos} onAlternar={alternar} onElegirRecomendados={elegirRecomendados} />}
                        <EstimateBar elegidos={seleccion} onLanzar={lanzarLote} lanzando={lanzar.isPending} />
                    </TabsContent>
                    <TabsContent value="enMarcha">
                        <BatchJobs lotes={lotes.data} cargando={lotes.isLoading} error={lotes.error} />
                    </TabsContent>
                    <TabsContent value="lotes">
                        <PastBatches lotes={data?.lotes ?? []} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
        </>
    );
}
