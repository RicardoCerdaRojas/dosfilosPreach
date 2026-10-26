import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { RoadmapCtaKind } from '@/pages/projects/projectRoadmaps';
import { cn } from '@/lib/utils';

/**
 * Una fase, en la forma mínima que se dibuja. `computeRoadmapState`
 * (`RoadmapState` de projectRoadmaps) la cumple sin moldes.
 */
export interface RoadmapPhaseEntry {
    complete: boolean;
    phase: {
        id: string;
        title: string;
        description: string;
        icon: React.ComponentType<{ className?: string }>;
        /** Clave bajo `roadmap.phases.`; sin ella, los textos en español de la fase. */
        i18nKey?: string;
        cta: {
            label: string;
            kind: RoadmapCtaKind;
        };
    };
}

export interface RoadmapState {
    phases: RoadmapPhaseEntry[];
    activeIndex: number;
    allComplete: boolean;
}

interface ProjectRoadmapProps {
    /** Roadmap state computed via `computeRoadmapState`. */
    roadmap: RoadmapState;
    /** Localised label for the project type (e.g. "Serie de sermones"). */
    typeLabel: string;
    /** Triggered when the active-phase CTA is clicked. */
    onPhaseCta: (kind: RoadmapPhaseEntry['phase']['cta']['kind']) => void;
}

/**
 * El recorrido de los tipos que todavía no tienen escritorio propio
 * (Investigación, Consejería, Sermón y Serie heredados): fases, el próximo
 * paso y el aviso de terminado. Exegético, Curso y General usan
 * `desk/DeskJourney`.
 *
 * Self-contained — only depends on the roadmap state shape and a single CTA
 * callback. Caller doesn't need to know about phase rendering details.
 */
export function ProjectRoadmap({ roadmap, typeLabel, onPhaseCta }: ProjectRoadmapProps) {
    const { t } = useTranslation('projects');
    const completedCount = roadmap.phases.filter(p => p.complete).length;
    const activePhase = roadmap.phases[roadmap.activeIndex]?.phase;
    // Solo el recorrido Exegético pasó a i18n (sus claves están en es y en);
    // los demás muestran su texto en español.
    const texto = (phase: RoadmapPhaseEntry['phase'], campo: 'title' | 'description' | 'cta') => {
        if (phase.i18nKey) return t(`roadmap.phases.${phase.i18nKey}.${campo}`);
        return campo === 'cta' ? phase.cta.label : phase[campo];
    };

    return (
        <section className="space-y-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary-text font-medium inline-flex items-center gap-2">
                <span>{t('roadmap.label', { type: typeLabel })}</span>
                <span className="text-border normal-case tracking-normal">·</span>
                <span className="text-muted-foreground normal-case tracking-normal font-mono">
                    {completedCount}/{roadmap.phases.length}
                </span>
            </div>

            {/* Phase pills */}
            <ol className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-stretch sm:overflow-x-auto">
                {roadmap.phases.map((p, idx) => {
                    const PhaseIcon = p.phase.icon;
                    const isActive = idx === roadmap.activeIndex;
                    const isComplete = p.complete;
                    return (
                        <li key={p.phase.id} className="flex flex-1 sm:min-w-[160px]">
                        {/* Cada fase se puede abrir, también las cumplidas: si no, la
                            página del estado del arte quedaba sin entrada una vez
                            cumplida (prueba del fundador, NT785). */}
                        <button
                            type="button"
                            onClick={() => onPhaseCta(p.phase.cta.kind)}
                            title={texto(p.phase, 'cta')}
                            className={cn(
                                'w-full min-h-11 text-left flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                isComplete
                                    ? 'bg-success-subtle border-success/30'
                                    : isActive
                                        // La fase activa lleva el tinte de la marca, no el de un estado.
                                        ? 'bg-primary/5 border-primary/30'
                                        : 'bg-card border-border/60'
                            )}
                        >
                            <div
                                className={cn(
                                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono font-medium',
                                    isComplete
                                        // El ✓ blanco sobre `success` no llega a AA: el par sutil sí.
                                        ? 'bg-success-subtle text-success-subtle-foreground border border-success/30'
                                        : isActive
                                            ? 'bg-primary-solid text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                )}
                            >
                                {isComplete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium inline-flex items-center gap-1">
                                    <PhaseIcon className="h-3 w-3" />
                                    <span className="truncate">{t('roadmap.phaseLabel', { number: idx + 1 })}</span>
                                </div>
                                <div
                                    className={cn(
                                        'text-[12.5px] truncate',
                                        isActive ? 'font-medium text-foreground' : 'text-foreground/85'
                                    )}
                                >
                                    {texto(p.phase, 'title')}
                                </div>
                            </div>
                        </button>
                        </li>
                    );
                })}
            </ol>

            {/* Active phase callout */}
            {activePhase && !roadmap.allComplete && (
                <div className="bg-primary/5 border border-primary/30 rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="h-11 w-11 rounded-lg bg-primary-solid text-primary-foreground flex items-center justify-center shrink-0">
                        <activePhase.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-primary-text font-medium mb-1">
                            {t('roadmap.activePhase.label', { number: roadmap.activeIndex + 1 })}
                        </div>
                        <h2 className="font-reading text-[19px] leading-tight text-foreground mb-1">
                            {texto(activePhase, 'title')}
                        </h2>
                        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                            {texto(activePhase, 'description')}
                        </p>
                    </div>
                    <Button
                        onClick={() => onPhaseCta(activePhase.cta.kind)}
                        className="bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground font-medium gap-1.5 shrink-0"
                    >
                        {texto(activePhase, 'cta')}
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* All complete callout */}
            {roadmap.allComplete && (
                <div className="bg-success-subtle border border-success/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="text-[14px] font-medium text-foreground">
                            {t('roadmap.allComplete.title')}
                        </div>
                        <div className="text-[12.5px] text-muted-foreground">
                            {t('roadmap.allComplete.description')}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
