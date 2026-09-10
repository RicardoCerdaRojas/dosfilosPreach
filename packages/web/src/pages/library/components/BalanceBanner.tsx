import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { useFirebase } from '@/context/firebase-context';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { processingBalanceService, type ProcessingMode } from '@dosfilos/application';
import {
    STUDY_UNIT_USD,
    computeExegesisQuotaState,
    type ProcessingBalance,
} from '@dosfilos/domain';
import { CreditPacksDialog } from './CreditPacksDialog';

/**
 * Saldo de páginas de procesamiento.
 *
 * Colapsado por defecto a una sola línea. Ocupaba una tarjeta de ancho completo
 * con tres azulejos y un botón, encima de la biblioteca —el lugar de mayor
 * jerarquía de la página— para un dato que casi nunca se mira: no se consulta
 * el saldo, se lo consulta cuando algo falla o antes de subir un libro grande.
 * Los números siguen a la vista; lo que se guarda es el desglose y el botón.
 *
 * Sigue suscrito al `users/{uid}.processingBalance` en vivo, así que el conteo
 * baja en el momento en que la función descuenta, sin recargar.
 */
export function BalanceBanner() {
    const { user } = useFirebase();
    const { t } = useTranslation('library');
    const [balance, setBalance] = useState<ProcessingBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [packsOpen, setPacksOpen] = useState(false);
    const [expandido, setExpandido] = useState(false);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        const unsubscribe = processingBalanceService.subscribeToBalance(
            user.uid,
            (b) => {
                setBalance(b);
                setLoading(false);
            },
            () => setLoading(false),
        );
        return () => unsubscribe();
    }, [user]);

    if (!user) return null;

    return (
        <>
            <div className="rounded-lg border border-border/60 bg-card">
                <button
                    type="button"
                    onClick={() => setExpandido(v => !v)}
                    aria-expanded={expandido}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left"
                >
                    <span className="text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground shrink-0">
                        {t('balance.title')}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tabular-nums text-muted-foreground">
                        <Resumen icon={Wand2} tone="text-info" label={t('balance.standard')}
                            value={loading ? null : (balance?.standardPagesAvailable ?? 0).toLocaleString()} />
                        <Resumen icon={Sparkles} tone="text-success" label={t('balance.premium')}
                            value={loading ? null : (balance?.premiumPagesAvailable ?? 0).toLocaleString()} />
                        <Resumen icon={BookOpen} tone="text-primary" label={t('balance.exegesis')}
                            value={loading ? null : estudiosDisponibles(balance)} />
                    </span>
                    <ChevronDown
                        className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expandido ? 'rotate-180' : ''}`}
                        aria-hidden
                    />
                </button>

                {expandido && (
                    <div className="border-t border-border/60 p-4 flex items-start justify-between gap-4 flex-wrap">
                        <p className="text-[13px] text-muted-foreground">{t('balance.subtitle')}</p>
                        <div className="flex flex-wrap items-stretch gap-3">
                            <BalanceTile
                                mode="standard"
                                pages={balance?.standardPagesAvailable ?? 0}
                                planPages={balance?.planStandardPages ?? 0}
                                packPages={balance?.packStandardPages ?? 0}
                                loading={loading}
                            />
                            <BalanceTile
                                mode="premium"
                                pages={balance?.premiumPagesAvailable ?? 0}
                                planPages={balance?.planPremiumPages ?? 0}
                                packPages={balance?.packPremiumPages ?? 0}
                                loading={loading}
                            />
                            {/* Exegesis bucket: USD-based, displayed in
                                "estudios" via STUDY_UNIT_USD. */}
                            <ExegesisBalanceTile balance={balance} loading={loading} />
                            <Button onClick={() => setPacksOpen(true)} className="self-center">
                                {t('balance.buyButton')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <CreditPacksDialog open={packsOpen} onOpenChange={setPacksOpen} />
        </>
    );
}

interface BalanceTileProps {
    mode: ProcessingMode;
    pages: number;
    planPages: number;
    packPages: number;
    loading: boolean;
}

function BalanceTile({ mode, pages, planPages, packPages, loading }: BalanceTileProps) {
    const { t } = useTranslation('library');
    const Icon = mode === 'standard' ? Wand2 : Sparkles;
    const tone = mode === 'standard' ? 'text-info' : 'text-success';

    return (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 min-w-[160px]">
            <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone}`}>
                <Icon className="h-3 w-3" />
                <span>{t(`balance.${mode}`)}</span>
            </div>
            <div className="text-[20px] font-bold leading-tight tabular-nums text-foreground mt-0.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : pages.toLocaleString()}
            </div>
            {!loading && (
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight tabular-nums">
                    {t('balance.split', {
                        plan: planPages.toLocaleString(),
                        pack: packPages.toLocaleString(),
                    })}
                </p>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
                {t(`balance.${mode}Help`)}
            </p>
        </div>
    );
}

interface ExegesisBalanceTileProps {
    balance: ProcessingBalance | null;
    loading: boolean;
}

function ExegesisBalanceTile({ balance, loading }: ExegesisBalanceTileProps) {
    const { t } = useTranslation('library');
    const state = computeExegesisQuotaState(balance);

    const tone =
        state.capState === 'hard-cap'
            ? 'text-destructive'
            : state.capState === 'soft-warn'
                ? 'text-warning'
                : 'text-primary';

    const studiesDisplay = state.remainingStudies < 0.1 && state.remainingUsd > 0
        ? '<0.1'
        : state.remainingStudies.toLocaleString(undefined, { maximumFractionDigits: 1 });

    const planStudies = Math.round(state.planAllowanceUsd / STUDY_UNIT_USD);
    const packStudies = Math.round(state.packBalanceUsd / STUDY_UNIT_USD);

    return (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 min-w-[160px]">
            <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone}`}>
                <BookOpen className="h-3 w-3" />
                <span>{t('balance.exegesis')}</span>
            </div>
            <div className="text-[20px] font-bold leading-tight tabular-nums text-foreground mt-0.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : studiesDisplay}
            </div>
            {!loading && !state.noAccess && (
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight tabular-nums">
                    {t('balance.split', {
                        plan: planStudies.toLocaleString(),
                        pack: packStudies.toLocaleString(),
                    })}
                </p>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
                {state.noAccess ? t('balance.exegesisNoAccess') : t('balance.exegesisHelp')}
            </p>
        </div>
    );
}

/** Un número del resumen colapsado. */
function Resumen({ icon: Icon, tone, label, value }: {
    icon: typeof Wand2; tone: string; label: string; value: string | null;
}) {
    return (
        <span className="inline-flex items-center gap-1">
            <Icon className={`h-3 w-3 ${tone}`} aria-hidden />
            <span className="text-muted-foreground/80">{label}</span>
            <strong className="font-semibold text-foreground">{value ?? '—'}</strong>
        </span>
    );
}

/**
 * Estudios disponibles, con el mismo criterio que el azulejo expandido: si
 * queda saldo pero menos de una décima, se dice «<0.1» en vez de redondear a
 * cero, que se leería como «no te queda nada».
 */
function estudiosDisponibles(balance: ProcessingBalance | null): string {
    const estado = computeExegesisQuotaState(balance);
    if (estado.noAccess) return '—';
    return estado.remainingStudies < 0.1 && estado.remainingUsd > 0
        ? '<0.1'
        : estado.remainingStudies.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
