import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import type { DeskNote, DeskNow, DeskPhase, ProjectDeskModel } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { FOCUS_RING, PhaseStep, TOUCH, formatDeskDay, scrollToDeskSection, useDeskText } from './primitives';

interface DeskJourneyProps {
    desk: ProjectDeskModel;
    /** El único botón lleno de la página: la página decide adónde lleva su destino. */
    onNow: (now: DeskNow) => void;
    /** Lo que falta del método: un enlace, nunca un botón lleno. */
    onNote: (note: DeskNote) => void;
    /** Pulsar una fase salta a su sección; si la página quiere otra cosa, lo cambia aquí. */
    onPhase?: (phaseId: string) => void;
}

/** El tipo del escritorio como clave de textos (`desk.journey.phases.<tipo>.<fase>`). */
const tipoDeTextos = (desk: ProjectDeskModel) => (desk.type === 'course' ? 'course' : 'exegetical');

/** El pliegue del andamiaje se recuerda por navegador; si el almacenamiento falla, va abierto. */
const claveDelPliegue = (tipo: string, fase: string) => `dosfilos.desk.scaffold.${tipo}.${fase}`;

function leerPliegue(clave: string): boolean {
    try {
        return window.localStorage.getItem(clave) === 'closed';
    } catch {
        return false;
    }
}

function guardarPliegue(clave: string, plegado: boolean): void {
    try {
        if (plegado) window.localStorage.setItem(clave, 'closed');
        else window.localStorage.removeItem(clave);
    } catch {
        // Modo privado o sin almacenamiento: el pliegue dura lo que la visita.
    }
}

/**
 * El recorrido del escritorio y «Ahora» (§3.1), en un solo componente:
 *   - las fases, compactas, con su estado honesto; tocar una salta a su
 *     sección (no crea nada); en el teléfono van en vertical;
 *   - «Ahora», el único botón lleno de la página: la continuidad (o el
 *     plazo, en el Curso) antes que el método;
 *   - lo que falte del método, como notas secundarias;
 *   - el andamiaje de la fase activa (para qué · cómo se ve bien hecha ·
 *     error común), abierto y plegable.
 *
 * General no tiene fases: muestra solo «Ahora» (lo último que se tocó).
 */
export function DeskJourney({ desk, onNow, onNote, onPhase }: DeskJourneyProps) {
    const { t, i18n } = useTranslation('projects');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    const texto = useDeskText();
    const tipo = tipoDeTextos(desk);
    const conFases = desk.phases.length > 0;
    const nombre = (id: string) => t(`desk.journey.phases.${tipo}.${id}.name`);
    const numero = (id: string) => desk.phases.findIndex(p => p.id === id) + 1;
    const activa = desk.activePhaseId ? desk.phases.find(p => p.id === desk.activePhaseId) ?? null : null;
    const irAFase = (id: string) => (onPhase ? onPhase(id) : scrollToDeskSection(id));

    if (!conFases && !desk.now) return null;

    return (
        <section aria-labelledby="desk-journey-title" className="space-y-3" data-testid="desk-journey">
            <h2 id="desk-journey-title" className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-text">
                {t(conFases ? 'desk.journey.label' : 'desk.journey.nowOnlyLabel')}
            </h2>

            {conFases && (
                <ol className="grid grid-cols-1 gap-2 md:grid-cols-5">
                    {desk.phases.map((p, i) => (
                        <li key={p.id} className="min-w-0">
                            <PhaseStep
                                number={i + 1}
                                name={nombre(p.id)}
                                status={p.status}
                                active={p.id === desk.activePhaseId}
                                onClick={() => irAFase(p.id)}
                            />
                        </li>
                    ))}
                </ol>
            )}

            <NowCard desk={desk} lang={lang} nombre={nombre} numero={numero} onNow={onNow} />

            {desk.notes.length > 0 && (
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-[12px] font-medium text-foreground">{t('desk.journey.notesLabel')}</p>
                    <ul className="mt-1 divide-y divide-border/60 sm:divide-y-0">
                        {desk.notes.map((n, i) => (
                            <li key={`${n.text.key}-${n.target.id ?? i}`}>
                                <button
                                    type="button"
                                    onClick={() => onNote(n)}
                                    className={cn('group flex w-full items-center gap-2 rounded-sm py-1.5 text-left text-[13px] leading-snug text-foreground hover:text-primary-text', TOUCH, FOCUS_RING)}
                                >
                                    {n.phaseId && numero(n.phaseId) > 0 && (
                                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                            {t('desk.journey.phaseLabel', { number: numero(n.phaseId) })}
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1 underline decoration-border underline-offset-2 group-hover:decoration-current">{texto(n.text)}</span>
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {activa && <Scaffold key={`${tipo}-${activa.id}`} tipo={tipo} phase={activa} number={numero(activa.id)} name={nombre(activa.id)} />}
        </section>
    );
}

// ── «Ahora» ────────────────────────────────────────────────────────────

/** El verbo del botón según adónde lleva. El texto del modelo dice QUÉ; esto dice qué hacer. */
function nowActionKey(now: DeskNow): string {
    if (now.text.key === 'desk.now.deadline.review') return 'desk.journey.action.review';
    if (now.text.key === 'desk.now.passageOldNote') return 'desk.journey.action.oldNote';
    return `desk.journey.action.${now.target.type}`;
}

function NowCard({ desk, lang, nombre, numero, onNow }: {
    desk: ProjectDeskModel;
    lang: string;
    nombre: (id: string) => string;
    numero: (id: string) => number;
    onNow: (now: DeskNow) => void;
}) {
    const { t } = useTranslation('projects');
    const texto = useDeskText();
    const now = desk.now;
    if (!now) {
        // Todas las fases listas: nada que empujar.
        return (
            <div className="rounded-xl border border-success/30 bg-success-subtle px-4 py-3" role="status">
                <p className="text-[13px] font-medium text-success-subtle-foreground">{t('desk.journey.allReady')}</p>
            </div>
        );
    }
    const fecha = now.dueDate ? formatDeskDay(now.dueDate, lang) : null;
    const faseId = now.target.phaseId ?? desk.activePhaseId;
    // Por qué es esto lo de «Ahora»: el plazo, la continuidad, la fecha o la fase.
    const porQue = now.kind === 'phase' && faseId && numero(faseId) > 0
        ? t('desk.journey.kind.phase', { number: numero(faseId), name: nombre(faseId) })
        : t(`desk.journey.kind.${now.kind}`, { date: fecha ?? '' });
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5" data-testid="desk-now">
            <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-text">
                    {t('desk.journey.nowLabel')}
                    <span className="normal-case tracking-normal text-muted-foreground"> · {porQue}</span>
                </p>
                <p className="font-reading text-[18px] leading-snug text-foreground">{texto(now.text)}</p>
                {fecha && now.kind !== 'deadline' && now.kind !== 'upcoming' && now.kind !== 'scheduled' && (
                    <p className="text-[12.5px] text-muted-foreground">{t('desk.journey.due', { date: fecha })}</p>
                )}
            </div>
            <Button onClick={() => onNow(now)} className="min-h-11 w-full shrink-0 gap-1.5 sm:w-auto sm:min-h-9">
                {t(nowActionKey(now), { label: now.target.label ?? '' })}
                <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
        </div>
    );
}

// ── Andamiaje ──────────────────────────────────────────────────────────

/**
 * Para qué · cómo se ve bien hecha · error común, de la fase activa. Va
 * abierto y se puede plegar; el pliegue se recuerda por navegador y por
 * fase. Enseña sin examinar: ni puntaje ni casillas.
 */
function Scaffold({ tipo, phase, number, name }: { tipo: string; phase: DeskPhase; number: number; name: string }) {
    const { t } = useTranslation('projects');
    const clave = claveDelPliegue(tipo, phase.id);
    const [plegado, setPlegado] = useState<boolean>(() => leerPliegue(clave));
    useEffect(() => { setPlegado(leerPliegue(clave)); }, [clave]);
    const alternar = () => {
        const nuevo = !plegado;
        setPlegado(nuevo);
        guardarPliegue(clave, nuevo);
    };
    const base = `desk.journey.phases.${tipo}.${phase.id}`;
    const cuerpoId = `desk-scaffold-${phase.id}`;
    const Icono = plegado ? ChevronDown : ChevronUp;
    return (
        <div className="rounded-xl border border-border bg-card" data-testid="desk-scaffold">
            <button
                type="button"
                onClick={alternar}
                aria-expanded={!plegado}
                aria-controls={cuerpoId}
                className={cn('flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-foreground hover:text-primary-text', 'min-h-11', FOCUS_RING)}
            >
                <span className="min-w-0 flex-1">{t('desk.journey.scaffold.title', { number, name })}</span>
                <Icono className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            {!plegado && (
                <dl id={cuerpoId} className="grid gap-3 border-t border-border px-4 pb-4 pt-3 md:grid-cols-3">
                    {(['purpose', 'wellDone', 'commonError'] as const).map(parte => (
                        <div key={parte} className="space-y-0.5">
                            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary-text">{t(`desk.journey.scaffold.${parte}`)}</dt>
                            <dd className="text-[13px] leading-relaxed text-foreground">{t(`${base}.${parte}`)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
