import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { GraduationCap, Plus, Trash2, ExternalLink, BookOpen } from 'lucide-react';
import {
    AiAssistType,
    languageForPassage,
    PASTORAL_SEED_THRESHOLDS,
    PastoralSeedTool,
    StepValidationResult,
    WordStudiesStepData,
    WordStudy,
} from '@dosfilos/domain';
import { StepShell } from './StepShell';
import { StepHelp } from './StepHelp';
import { useStepTimer } from './stepTimer';
import { GreekTutorOverlay } from '../exegesis/greek-tutor/GreekTutorOverlay';
import { GreekTutorProvider } from '../exegesis/greek-tutor/GreekTutorProvider';
import { PastoralWordStudyModal } from './wordStudy/PastoralWordStudyModal';
import { usePastoralWordStudyGate } from '@/hooks/usePastoralFidelityGate';

interface Props {
    passage: string;
    sermonId: string | null;
    data: WordStudiesStepData;
    validation?: StepValidationResult;
    onAddWordStudy: (study: WordStudy) => Promise<void>;
    onChange: (patch: Partial<WordStudiesStepData>) => void;
    onLogToolUsage: (tool: PastoralSeedTool) => void;
    /** Phase 2.5 (ADR-024 completion) — first-class assist audit. */
    onLogAiAssist?: (assistType: AiAssistType, outputWasEditedByUser: boolean) => void;
}

const T = PASTORAL_SEED_THRESHOLDS.wordStudies;

/**
 * Paso 4 — Estudio de Palabras (antes "Morfología", ADR-022).
 *
 * Semántica léxica, no parsing (la morfología real es prerrequisito, no
 * un paso). Pastor records `≥2` word studies. Under the
 * `pastoral_word_study` sub-flag the `PastoralWordStudyModal` is the
 * entry point (ADR-016); otherwise the Phase 1 interim greek/hebrew
 * tutors.
 *
 * Each word study captures the original-language form, where it
 * appears, and the pastor's own discovery (≥30 chars).
 */
export function WordStudiesStep({
    passage,
    sermonId,
    data,
    validation,
    onAddWordStudy,
    onChange,
    onLogToolUsage,
    onLogAiAssist,
}: Props) {
    const { t } = useTranslation('wordStudy');
    const wordStudyGate = usePastoralWordStudyGate();
    const [greekOpen, setGreekOpen] = useState(false);
    const [wordStudyOpen, setWordStudyOpen] = useState(false);
    // El idioma sale del testamento del pasaje: en Jonás arrancaba en
    // «Griego» y había que cambiarlo en cada palabra (#29 del ejercicio).
    const [draft, setDraft] = useState<WordStudy>(() => ({
        word: '',
        reference: '',
        pastorDiscovery: '',
        language: languageForPassage(passage),
    }));
    const lang = draft.language ?? 'greek';

    useStepTimer({
        enabled: true,
        onFlush: (delta) => {
            if (delta > 0) onChange({ timeSpentSeconds: (data.timeSpentSeconds ?? 0) + delta });
        },
    });

    const studies = data.studies ?? [];

    const handleAddDraft = async () => {
        if (!draft.word.trim() || !draft.reference.trim()) return;
        if ((draft.pastorDiscovery ?? '').trim().length < T.pastorDiscoveryMinChars) return;
        await onAddWordStudy({ ...draft });
        setDraft({ word: '', reference: '', pastorDiscovery: '', language: draft.language });
    };

    const removeStudy = (index: number) => {
        const next = [...studies];
        next.splice(index, 1);
        onChange({ studies: next });
    };

    // ADR-024 completion (Phase 2.5): opening a lexical tutor/modal is a
    // first-class assist. Display/tutor surfaces → output not edited.
    const openGreek = () => {
        if (!greekOpen) {
            onLogToolUsage('greek-tutor');
            onLogAiAssist?.('lexicalTutor', false);
        }
        setGreekOpen(true);
    };

    const openHebrew = () => {
        onLogToolUsage('hebrew-tutor');
        onLogAiAssist?.('lexicalTutor', false);
        const url = `/hebrew-tutor?passage=${encodeURIComponent(passage)}&returnTo=${encodeURIComponent(
            sermonId ? `/dashboard/sermons?id=${sermonId}` : '/dashboard/sermons',
        )}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openWordStudy = () => {
        if (!wordStudyOpen) {
            onLogToolUsage('pastoral-word-study');
            onLogAiAssist?.('lexicalTutor', false);
        }
        setWordStudyOpen(true);
    };

    return (
        <StepShell
            stepNumber={4}
            title="Estudio de Palabras"
            subtitle={`Estudia ${T.minWordStudies}+ palabras clave del pasaje. Consulta el asistente cuando necesites.`}
            passage={passage}
            validation={validation}
        >
            <div className="space-y-5">
                <StepHelp
                    label="¿Qué es un estudio de palabra? Ver guía rápida"
                    examples={[
                        {
                            title: 'Ejemplo: δικαιοσύνη en Romanos',
                            body: (
                                <>
                                    <p><span className="text-foreground">Palabra:</span> δικαιοσύνη</p>
                                    <p><span className="text-foreground">Referencia:</span> Romanos 8:4</p>
                                    <p>
                                        <span className="text-foreground">Descubrimiento:</span> Pablo no usa la palabra en sentido legal romano (cumplir reglas) sino en sentido pactual hebreo (estar en relación correcta con Dios). El cumplimiento es del Espíritu, no del esfuerzo humano.
                                    </p>
                                </>
                            ),
                        },
                    ]}
                >
                    <p>
                        Selecciona <span className="font-medium">2-3 palabras clave</span> del pasaje (griego para NT, hebreo para AT) que carguen el peso teológico. Para cada una documenta:
                    </p>
                    <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                        <li><span className="text-foreground">Palabra original</span>: transliteración + grafía.</li>
                        <li><span className="text-foreground">Referencia</span>: dónde aparece en el pasaje.</li>
                        <li><span className="text-foreground">Descubrimiento</span>: qué APRENDISTE estudiándola — no copia del lexicón, tu lectura pastoral del peso de la palabra.</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        Usa el tutor de griego (botón abajo) para análisis morfológico y semántico ayudado por AI. El descubrimiento final es tuyo.
                    </p>
                </StepHelp>

                <div className="flex flex-wrap gap-2">
                    {wordStudyGate.enabled ? (
                        <Button variant="outline" size="sm" onClick={openWordStudy} type="button">
                            <BookOpen className="h-4 w-4 mr-2" />
                            {t('modal.buttonOpen')}
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={openGreek} type="button">
                                <GraduationCap className="h-4 w-4 mr-2" />
                                Abrir tutor de griego
                            </Button>
                            <Button variant="outline" size="sm" onClick={openHebrew} type="button">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Abrir tutor de hebreo (nueva pestaña)
                            </Button>
                        </>
                    )}
                </div>

                <div className="border rounded-md p-4 space-y-3 bg-muted/20">
                    <p className="text-sm font-medium">{t('form.title')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input
                            placeholder={t(`form.wordPlaceholder.${lang}`)}
                            value={draft.word}
                            onChange={(e) => setDraft((d) => ({ ...d, word: e.target.value }))}
                        />
                        <Input
                            placeholder={t(`form.referencePlaceholder.${lang}`)}
                            value={draft.reference}
                            onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
                        />
                        <select
                            value={lang}
                            onChange={(e) =>
                                setDraft((d) => ({ ...d, language: e.target.value as 'greek' | 'hebrew' }))
                            }
                            className="border rounded-md px-2 text-sm bg-background"
                        >
                            <option value="greek">{t('form.languages.greek')}</option>
                            <option value="hebrew">{t('form.languages.hebrew')}</option>
                        </select>
                    </div>
                    <Textarea
                        placeholder={`Tu descubrimiento personal sobre esta palabra. ¿Qué carga lleva? ¿Cómo se usa en otros lugares? (mínimo ${T.pastorDiscoveryMinChars} caracteres)`}
                        value={draft.pastorDiscovery}
                        onChange={(e) => setDraft((d) => ({ ...d, pastorDiscovery: e.target.value }))}
                        rows={3}
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                            {(draft.pastorDiscovery ?? '').trim().length} / {T.pastorDiscoveryMinChars}
                        </span>
                        <Button size="sm" onClick={handleAddDraft} type="button">
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar estudio
                        </Button>
                    </div>
                </div>

                {studies.length > 0 && (
                    <ul className="space-y-2">
                        {studies.map((s, i) => (
                            <li key={`${s.word}-${i}`} className="border rounded-md p-3 bg-card">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">
                                            <span className="font-serif">{s.word}</span>{' '}
                                            <span className="text-xs text-muted-foreground">— {s.reference}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">{s.pastorDiscovery}</p>
                                        {s.tutorInteractionId && (
                                            <p className="text-[10px] text-muted-foreground">
                                                Vinculado al tutor: {s.tutorInteractionId.slice(0, 12)}…
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeStudy(i)}
                                        type="button"
                                        aria-label="Eliminar estudio"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <p className="text-xs text-muted-foreground">
                    Mínimo {T.minWordStudies} estudios. Actual: {studies.length}.
                </p>
            </div>

            {!wordStudyGate.enabled && greekOpen && (
                <GreekTutorProvider>
                    <GreekTutorOverlay
                        isOpen={greekOpen}
                        onClose={() => setGreekOpen(false)}
                        passage={passage}
                    />
                </GreekTutorProvider>
            )}
            {wordStudyGate.enabled && (
                <PastoralWordStudyModal
                    isOpen={wordStudyOpen}
                    onClose={() => setWordStudyOpen(false)}
                    passage={passage}
                    existingStudies={studies}
                    onAddWordStudy={onAddWordStudy}
                />
            )}
        </StepShell>
    );
}
