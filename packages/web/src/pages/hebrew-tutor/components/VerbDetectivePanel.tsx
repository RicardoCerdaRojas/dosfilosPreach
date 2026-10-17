/**
 * VerbDetectivePanel
 *
 * Standalone lateral panel (Sheet) for the "Modo Detective" pedagogical tool.
 * Guides the student through a bifurcated 6-phase investigation to identify
 * a Hebrew verb's binyan and type, following Prof. Farfán's methodology.
 *
 * Flow:
 *  Phase 1: OBSERVE  (both paths)
 *  Phase 2: TRIAGE   (both paths) → forks into STRONG or WEAK path
 *
 *  Strong path: COLORS → DAGESH → BINYAN → STRONG_CONFIRM
 *  Weak path:   PREFORMATIVE → WEAK_ROOT → WEAK_BINYAN
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useTranslation } from '@/i18n';
import type { WordAnalysis, DetectivePhaseResult } from '@dosfilos/domain';
import { DetectivePhase } from '@dosfilos/domain';
import { useHebrewTutor } from '../HebrewTutorProvider';
import { useFirebase } from '@/context/firebase-context';
import { DetectiveProgress } from './detective/DetectiveProgress';
import { DetectiveResultSummary } from './detective/DetectiveResultSummary';
import { DetectiveContextProvider } from './detective/DetectiveContext';
import { DetectivePhaseRenderer } from './detective/DetectivePhaseRenderer';
import { useDragResizeLeft, useDragResizeRight } from '../hooks/useDragResize';
import {
    type InvestigationPath,
    STRONG_PATH,
    getCorrectAnswer,
    evaluateAnswer,
    getNextPhase,
    getSkippedPhases,
    getWeakPath,
} from '../utils/detectiveLogic';

const PANEL_STORAGE_KEY = 'detective-panel-width';
const SIDEBAR_STORAGE_KEY = 'detective-sidebar-width';
const DEFAULT_PANEL_WIDTH = 580;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 900;
const DEFAULT_SIDEBAR_WIDTH = 176;
const MIN_SIDEBAR_WIDTH = 130;
const MAX_SIDEBAR_WIDTH = 260;

interface VerbDetectivePanelProps {
    word: WordAnalysis | null;
    verseReference: string;
    isOpen: boolean;
    onClose: () => void;
    /** Discovery Mode callback — fired when the full investigation finishes. */
    onDiscoveryComplete?: (translation: string, score: number) => void;
    /** Adjacent words for contextual display in the hero card */
    adjacentWords?: {
        prev?: { hebrewText: string; transliteration?: string } | null;
        next?: { hebrewText: string; transliteration?: string } | null;
    };
}

export const VerbDetectivePanel: React.FC<VerbDetectivePanelProps> = ({
    word,
    verseReference,
    isOpen,
    onClose,
    onDiscoveryComplete,
    adjacentWords,
}) => {
    const { t } = useTranslation('hebrewTutor');
    const { saveDetectiveSession } = useHebrewTutor();
    const { user } = useFirebase();

    const {
        width: panelWidth,
        isDragging: isPanelDragging,
        onMouseDown: onPanelHandleMouseDown,
    } = useDragResizeLeft(PANEL_STORAGE_KEY, DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);

    const {
        width: sidebarWidth,
        isDragging: isSidebarDragging,
        onMouseDown: onSidebarHandleMouseDown,
    } = useDragResizeRight(SIDEBAR_STORAGE_KEY, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

    const anyDragging = isPanelDragging || isSidebarDragging;

    const [currentPhase, setCurrentPhase] = useState<DetectivePhase>(DetectivePhase.OBSERVE);
    const [activePath, setActivePath] = useState<InvestigationPath>(null);
    const [completedPhases, setCompletedPhases] = useState<Array<{ phase: DetectivePhase; correct: boolean }>>([]);
    const [phaseResults, setPhaseResults] = useState<DetectivePhaseResult[]>([]);
    const [sessionScore, setSessionScore] = useState<number>(0);
    const [performanceLabel, setPerformanceLabel] = useState<'excellent' | 'good' | 'needs-practice'>('good');
    const [showSummary, setShowSummary] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const resetSession = useCallback(() => {
        setCurrentPhase(DetectivePhase.OBSERVE);
        setActivePath(null);
        setCompletedPhases([]);
        setPhaseResults([]);
        setSessionScore(0);
        setPerformanceLabel('good');
        setShowSummary(false);
        setIsSaving(false);
    }, []);

    useEffect(() => {
        resetSession();
    }, [word?.hebrewText, resetSession]);

    const handlePhaseComplete = useCallback(async (
        phase: DetectivePhase,
        userAnswer: string,
    ) => {
        if (!word) return;

        const correctAnswer = getCorrectAnswer(word, phase);
        const isCorrect = evaluateAnswer(word, phase, userAnswer);

        const result: DetectivePhaseResult = {
            phase,
            userAnswer,
            correctAnswer,
            correct: isCorrect,
            completedAt: new Date(),
        };

        const updatedResults = [...phaseResults, result];
        setPhaseResults(updatedResults);
        setCompletedPhases(prev => [...prev, { phase, correct: isCorrect }]);

        let resolvedPath = activePath;
        if (phase === DetectivePhase.TRIAGE) {
            resolvedPath = userAnswer === 'strong' ? 'strong' : 'weak';
            setActivePath(resolvedPath);
        }

        const nextPhase = getNextPhase(phase, resolvedPath, word);

        if (nextPhase === null) {
            setIsSaving(true);
            try {
                const saved = await saveDetectiveSession.execute({
                    kind: 'verb',
                    userId: user?.uid ?? 'anonymous',
                    tenantId: 'global',
                    wordText: word.hebrewText,
                    verseReference,
                    expectedBinyan: word.verbMorphology!.binyan,
                    expectedVerbType: word.verbMorphology!.verbType,
                    phases: updatedResults,
                });
                setSessionScore(saved.score);
                setPerformanceLabel(saved.performanceLabel);
            } catch (e) {
                console.error('[VerbDetectivePanel] Failed to save session:', e);
                const correct = updatedResults.filter(r => r.correct).length;
                setSessionScore(Math.round((correct / updatedResults.length) * 100));
                setPerformanceLabel(correct >= 5 ? 'excellent' : correct >= 3 ? 'good' : 'needs-practice');
            } finally {
                setIsSaving(false);
                setShowSummary(true);
                if (onDiscoveryComplete && word) {
                    const finalScore = sessionScore || Math.round((updatedResults.filter(r => r.correct).length / updatedResults.length) * 100);
                    onDiscoveryComplete(word.translation, finalScore);
                }
            }
        } else {
            setCurrentPhase(nextPhase);
        }
    }, [word, phaseResults, activePath, saveDetectiveSession, verseReference, sessionScore, user?.uid, onDiscoveryComplete]);

    if (!word) return null;

    const currentSequence = activePath === 'weak' ? getWeakPath(word) : STRONG_PATH;
    const totalPhases = currentSequence.length;
    const progressPercent = (completedPhases.length / totalPhases) * 100;

    const detectiveCtxValue = React.useMemo(
        () => ({ adjacentWords }),
        [adjacentWords],
    );

    return (
        <DetectiveContextProvider value={detectiveCtxValue}>
            <Sheet open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
                <SheetContent
                    side="right"
                    className={`flex flex-col p-0 overflow-hidden ${anyDragging ? 'select-none' : ''}`}
                    style={{ width: panelWidth, maxWidth: '95vw', minWidth: MIN_PANEL_WIDTH }}
                >
                    {/* Outer drag handle (left edge — resizes panel) */}
                    <div
                        onMouseDown={onPanelHandleMouseDown}
                        title={t('detective.dragHandlePanel')}
                        className={`
                            absolute left-0 top-0 bottom-0 w-1.5 z-50 cursor-col-resize group
                            transition-colors
                            ${isPanelDragging ? 'bg-primary' : 'bg-transparent hover:bg-primary/60'}
                        `}
                    >
                        <div className="absolute inset-y-0 left-0 w-full flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="w-1 h-1 rounded-full bg-primary/70" />
                            ))}
                        </div>
                    </div>

                    <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
                        <SheetDescription className="sr-only">
                            {t('detective.srDescription')}
                        </SheetDescription>
                        <div className="flex items-center gap-2 pr-8">
                            <div className="w-8 h-8 rounded-lg bg-primary-solid text-primary-foreground flex items-center justify-center flex-shrink-0">
                                <MagnifyingGlassIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <SheetTitle className="text-base font-bold leading-none">
                                    {t('detective.title')}
                                </SheetTitle>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs text-muted-foreground">{t('detective.subtitle')}</p>
                                    {activePath && (
                                        <span className={`
                                            text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                            ${activePath === 'strong'
                                                ? 'bg-success/15 text-success'
                                                : 'bg-info/15 text-info'}
                                        `}>
                                            {t(activePath === 'strong' ? 'detective.path.strong' : 'detective.path.weak')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!showSummary && (
                            <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                                    <span>{t('detective.progressLabel')}</span>
                                    <span>{t('detective.phaseCount', { completed: completedPhases.length, total: totalPhases })}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-500"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </SheetHeader>

                    <div className="flex flex-1 min-h-0 relative">
                        {!showSummary && (
                            <div
                                className="relative flex-shrink-0 border-r border-border px-3 py-4"
                                style={{ width: sidebarWidth }}
                            >
                                <DetectiveProgress
                                    currentPhase={currentPhase}
                                    completedPhases={completedPhases}
                                    activePath={activePath}
                                    skipPhases={getSkippedPhases(word, activePath)}
                                />

                                <div
                                    onMouseDown={onSidebarHandleMouseDown}
                                    title={t('detective.dragHandleSidebar')}
                                    className={`
                                        absolute right-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize group
                                        transition-colors
                                        ${isSidebarDragging ? 'bg-primary/80' : 'bg-transparent hover:bg-primary/50'}
                                    `}
                                >
                                    <div className="absolute inset-y-0 right-0 w-full flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className="w-1 h-1 rounded-full bg-primary/60" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <ScrollArea className="flex-1 select-text">
                            <div className="p-5">
                                {isSaving ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                        <p className="text-sm">{t('detective.saving')}</p>
                                    </div>
                                ) : showSummary ? (
                                    <DetectiveResultSummary
                                        word={word}
                                        phases={phaseResults}
                                        score={sessionScore}
                                        performanceLabel={performanceLabel}
                                        onReset={resetSession}
                                    />
                                ) : (
                                    <DetectivePhaseRenderer
                                        word={word}
                                        phase={currentPhase}
                                        activePath={activePath}
                                        onComplete={handlePhaseComplete}
                                    />
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>
        </DetectiveContextProvider>
    );
};
