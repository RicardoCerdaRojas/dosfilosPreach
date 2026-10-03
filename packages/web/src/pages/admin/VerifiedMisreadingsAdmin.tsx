import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { parsePassageReference, type VerifiedMisreadingRecord } from '@dosfilos/domain';
import {
    useVerifiedMisreadings,
    useReviewVerifiedMisreading,
    useIngestVerifiedMisreading,
    useDeleteVerifiedMisreading,
} from '@/hooks/admin/useVerifiedMisreadings';

/**
 * ADR-036 — admin del set crítico curado (`verifiedMisreadings/`).
 *
 * Curar / editar / borrar + revisar la cola (verifica verso + adjudica refuta +
 * resuelve procedencia R3 + aprueba). Editar resetea a pending (re-verificar).
 * El gate fail-closed (yes + reviewed) lo aplica el merge runtime (PR5). Rol:
 * super_admin (placeholder de `floor-reviewer`).
 */
export function VerifiedMisreadingsAdmin() {
    const pending = useVerifiedMisreadings('pending-pastoral-review');
    const reviewed = useVerifiedMisreadings('reviewed');
    const [editing, setEditing] = useState<VerifiedMisreadingRecord | null>(null);

    const refreshAll = () => { void pending.refresh(); void reviewed.refresh(); };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-semibold">Lecturas erróneas verificadas</h1>
            </div>
            <p className="text-sm text-muted-foreground">
                Set crítico curado (ADR-036). Las anclas se verifican (verso real + refuta la lectura) y se
                aprueban antes de poder confrontar con ellas. El gate duro se re-evalúa en el sermón.
            </p>

            <CurateForm editing={editing} onDone={() => setEditing(null)} refreshAll={refreshAll} />

            <Section
                title="Cola de revisión"
                empty="Sin entradas pendientes."
                items={pending.items}
                loading={pending.loading}
                onRefresh={refreshAll}
                reviewable
                onChanged={refreshAll}
                onEdit={setEditing}
            />

            <Section
                title="Revisadas"
                empty="Aún no hay entradas revisadas."
                items={reviewed.items}
                loading={reviewed.loading}
                onRefresh={refreshAll}
                onChanged={refreshAll}
                onEdit={setEditing}
            />
        </div>
    );
}

function Section(props: {
    title: string;
    empty: string;
    items: VerifiedMisreadingRecord[];
    loading: boolean;
    onRefresh: () => void;
    reviewable?: boolean;
    onChanged: () => void;
    onEdit: (e: VerifiedMisreadingRecord) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                    {props.title} <span className="text-muted-foreground">({props.items.length})</span>
                </h2>
                <Button size="sm" variant="ghost" onClick={props.onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
            {props.loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : props.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{props.empty}</p>
            ) : (
                props.items.map((item) => (
                    <EntryCard
                        key={item.id}
                        item={item}
                        reviewable={props.reviewable}
                        onChanged={props.onChanged}
                        onEdit={props.onEdit}
                    />
                ))
            )}
        </div>
    );
}

function refutesBadge(refutes?: string) {
    if (refutes === 'yes') return <Badge className="bg-success text-success-foreground">refuta ✓</Badge>;
    if (refutes === 'unclear') return <Badge variant="secondary">ambiguo</Badge>;
    if (refutes === 'no') return <Badge variant="destructive">no refuta</Badge>;
    return <Badge variant="outline">sin verificar</Badge>;
}

/** Reconstruye una referencia legible del scope (para prefill del form). */
function scopeToRef(e: VerifiedMisreadingRecord): string {
    const s = e.passageScope;
    const end = s.verseEnd && s.verseEnd !== s.verseStart ? `-${s.verseEnd}` : '';
    return `${s.bookId} ${s.chapterStart}:${s.verseStart}${end}`;
}

function EntryCard({
    item,
    reviewable,
    onChanged,
    onEdit,
}: {
    item: VerifiedMisreadingRecord;
    reviewable?: boolean;
    onChanged: () => void;
    onEdit: (e: VerifiedMisreadingRecord) => void;
}) {
    const { review, busy } = useReviewVerifiedMisreading();
    const { remove, busy: deleting } = useDeleteVerifiedMisreading();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const runReview = async (approve: boolean) => {
        try {
            const res = await review(item.id, approve);
            toast.success(
                `Verificación: verso ${res.verification.versesExist ? 'existe' : 'NO existe'}, ${res.verification.refutes}` +
                    (approve ? ' · aprobada' : ''),
            );
            onChanged();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falló la revisión');
        }
    };

    const runDelete = async () => {
        try {
            await remove(item.id);
            toast.success('Entrada borrada');
            onChanged();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falló el borrado');
        }
    };

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-medium">{item.claim}</p>
                    <p className="text-xs text-muted-foreground">
                        {scopeToRef(item)} · {item.severity}
                    </p>
                </div>
                {refutesBadge(item.verification?.refutes)}
            </div>
            {item.whyWrong && <p className="text-sm text-muted-foreground">{item.whyWrong}</p>}
            <ul className="space-y-1">
                {item.correctiveAnchors.map((a, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                        <span className="font-semibold">{a.reference}</span>
                        {a.note && <span className="text-muted-foreground">— {a.note}</span>}
                        {a.provenanceVerified && a.sourceProvenance?.kind === 'chunk' ? (
                            <Badge variant="outline" className="text-xs">
                                {a.sourceProvenance.resourceTitle}
                                {a.sourceProvenance.page ? ` p.${a.sourceProvenance.page}` : ''}
                            </Badge>
                        ) : a.sourceId ? (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> sin fuente trazable
                            </Badge>
                        ) : null}
                    </li>
                ))}
            </ul>
            <div className="flex gap-2 pt-1">
                {reviewable && (
                    <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void runReview(false)}>
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verificar'}
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => void runReview(true)}>
                            <CheckCircle2 className="h-3 w-3 mr-1.5" /> Verificar y aprobar
                        </Button>
                    </>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                    <Pencil className="h-3 w-3 mr-1.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(true)}>
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
            </div>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Borrar entrada"
                body={`¿Borrar la entrada "${item.claim}"? Esta acción no se puede deshacer.`}
                confirmLabel="Borrar"
                cancelLabel="Cancelar"
                onConfirm={() => void runDelete()}
            />
        </Card>
    );
}

function CurateForm({
    editing,
    onDone,
    refreshAll,
}: {
    editing: VerifiedMisreadingRecord | null;
    onDone: () => void;
    refreshAll: () => void;
}) {
    const { ingest, update, busy } = useIngestVerifiedMisreading();
    const [claim, setClaim] = useState('');
    const [whyWrong, setWhyWrong] = useState('');
    const [passageRef, setPassageRef] = useState('');
    const [severity, setSeverity] = useState<'critical' | 'standard'>('critical');
    const [anchorRef, setAnchorRef] = useState('');
    const [anchorSourceId, setAnchorSourceId] = useState('');

    // Prefill al entrar en modo edición.
    useEffect(() => {
        if (!editing) return;
        setClaim(editing.claim);
        setWhyWrong(editing.whyWrong);
        setPassageRef(scopeToRef(editing));
        setSeverity(editing.severity);
        setAnchorRef(editing.correctiveAnchors[0]?.reference ?? '');
        setAnchorSourceId(editing.correctiveAnchors[0]?.sourceId ?? '');
        // sube al form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [editing]);

    const reset = () => {
        setClaim(''); setWhyWrong(''); setPassageRef(''); setAnchorRef(''); setAnchorSourceId('');
        setSeverity('critical');
        onDone();
    };

    const submit = async () => {
        if (!claim.trim() || !passageRef.trim() || !anchorRef.trim()) {
            toast.error('Claim, pasaje y al menos un ancla son obligatorios');
            return;
        }
        // Si editamos y el pasaje no cambió, reusamos el scope original (evita
        // re-parsear un id canónico). Si cambió o es alta nueva, parseamos.
        let passageScope = editing?.passageScope;
        if (!editing || passageRef.trim() !== scopeToRef(editing)) {
            const parsed = parsePassageReference(passageRef.trim());
            if (!parsed.ok) {
                toast.error(`Pasaje no reconocido: ${parsed.hint || passageRef}`);
                return;
            }
            passageScope = {
                bookId: parsed.ref.bookId,
                chapterStart: parsed.ref.chapterStart,
                verseStart: parsed.ref.verseStart ?? 0,
                verseEnd: parsed.ref.verseEnd ?? parsed.ref.verseStart ?? 0,
            };
        }
        const args = {
            passageScope: passageScope!,
            claim: claim.trim(),
            whyWrong: whyWrong.trim(),
            severity,
            correctiveAnchors: [
                { reference: anchorRef.trim(), ...(anchorSourceId.trim() ? { sourceId: anchorSourceId.trim() } : {}) },
            ],
        };
        try {
            if (editing) {
                await update({ ...args, id: editing.id });
                toast.success('Entrada actualizada (vuelve a la cola: re-verifica)');
            } else {
                await ingest(args);
                toast.success('Entrada creada (pendiente de revisión)');
            }
            reset();
            refreshAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falló la operación');
        }
    };

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{editing ? 'Editar entrada' : 'Curar entrada nueva'}</h2>
                {editing && (
                    <Button size="sm" variant="ghost" onClick={reset}>
                        <X className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                )}
            </div>
            <Textarea placeholder="Lectura errónea (claim)" value={claim} onChange={(e) => setClaim(e.target.value)} />
            <Textarea placeholder="Por qué es errónea" value={whyWrong} onChange={(e) => setWhyWrong(e.target.value)} />
            <Input
                placeholder="Pasaje donde dispara (ej. 2 Pedro 2:20-22)"
                value={passageRef}
                onChange={(e) => setPassageRef(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Ancla (ej. Juan 10:28-29)" value={anchorRef} onChange={(e) => setAnchorRef(e.target.value)} />
                <Input placeholder="sourceId del chunk (opcional)" value={anchorSourceId} onChange={(e) => setAnchorSourceId(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant={severity === 'critical' ? 'default' : 'outline'} onClick={() => setSeverity('critical')}>
                    critical
                </Button>
                <Button size="sm" variant={severity === 'standard' ? 'default' : 'outline'} onClick={() => setSeverity('standard')}>
                    standard
                </Button>
                <div className="flex-1" />
                <Button disabled={busy} onClick={() => void submit()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Guardar cambios' : 'Crear entrada'}
                </Button>
            </div>
        </Card>
    );
}
