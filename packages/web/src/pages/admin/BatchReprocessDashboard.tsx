import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBatchCandidates } from '@/hooks/admin/useBatchCandidates';
import { esRecomendado } from '@/lib/loteReport';
import { CandidatesTable } from './batch/CandidatesTable';
import { EstimateBar } from './batch/EstimateBar';
import { PastBatches } from './batch/PastBatches';

/**
 * Reproceso en lote (docs/FASE_LOTE_SUPER_ADMIN_2026-10.md, PR 1: ver,
 * auditar y estimar). Los libros de una biblioteca ordenados por lo que
 * conviene reprocesar, el costo de lo elegido y el comando para lanzarlo.
 * No gasta ni escribe. Sólo administración.
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

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/dashboard/admin" className="text-muted-foreground hover:text-foreground" aria-label={t('common.back')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold flex items-center gap-2"><Layers className="h-5 w-5" /> {t('batch.title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('batch.subtitle')}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {data && data.duenos.length > 0 && (
                        <>
                            <Label htmlFor="biblioteca-del-lote" className="text-sm text-muted-foreground">{t('batch.owner')}</Label>
                            <Select value={dueno ?? data.dueno} onValueChange={cambiarDueno}>
                                <SelectTrigger id="biblioteca-del-lote" className="w-64"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {data.duenos.map(d => <SelectItem key={d.uid} value={d.uid}>{d.email}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-2">{t('common.refresh')}</span>
                    </Button>
                </div>
            </div>

            {cargando && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {error && <Card className="p-4 border-destructive text-sm text-destructive">{t('batch.loadError')}</Card>}
            {data && !cargando && candidatos.length === 0 && <Card className="p-6 text-sm text-muted-foreground">{t('batch.empty')}</Card>}

            {data && !cargando && candidatos.length > 0 && (
                <Tabs defaultValue="candidatos">
                    <TabsList>
                        <TabsTrigger value="candidatos">{t('batch.tabs.candidates')}</TabsTrigger>
                        <TabsTrigger value="lotes">{t('batch.tabs.past', { count: data.lotes.length })}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="candidatos" className="space-y-4">
                        <CandidatesTable candidatos={candidatos} elegidos={elegidos} onAlternar={alternar} onElegirRecomendados={elegirRecomendados} />
                        <EstimateBar elegidos={seleccion} />
                    </TabsContent>
                    <TabsContent value="lotes">
                        <PastBatches lotes={data.lotes} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
