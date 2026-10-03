import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lightbulb, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    filterQuestionCandidates,
    formatPassageReference,
    insertQuestionsIntoBrief,
    parseBriefQuestions,
    passageFormKeys,
    type ExegeticalPaper,
    type FilteredCandidates,
} from '@dosfilos/domain';
import { suggestBriefQuestions } from '@dosfilos/infrastructure';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { usePassageLemmas } from '@/hooks/exegesis/usePassageLemmas';

interface Props {
    paper: ExegeticalPaper;
    /** Nombre del género elegido, para orientar las preguntas. */
    genreLabel: string;
    draft: string;
    onDraftChange: (next: string) => void;
}

/**
 * «Sugerir preguntas» para el encuadre: candidatas que el pastor marca.
 *
 * Pedido del fundador (#11 del ejercicio de Jonás). Nada entra al encuadre
 * sin que él lo marque y lo agregue, y lo agregado queda en el borrador, para
 * editarlo. Las que citan una forma que el pasaje no tiene se descartan antes
 * de mostrarse (`filterQuestionCandidates`), y se dice cuántas.
 */
export function BriefQuestionSuggestions({ paper, genreLabel, draft, onDraftChange }: Props) {
    const { t } = useTranslation('exegesis');
    const morfologia = usePassageLemmas(paper, true);
    const [resultado, setResultado] = useState<FilteredCandidates | null>(null);
    const [marcadas, setMarcadas] = useState<Set<number>>(new Set());

    const sugerir = useMutation({
        mutationFn: async () => {
            const datos = morfologia.data;
            if (!datos || datos.entries.length === 0) throw new Error('sin morfología');
            const candidatas = await suggestBriefQuestions({
                passageLabel: formatPassageReference(paper.passage, paper.displayLanguage),
                genre: genreLabel,
                verses: datos.entries.map(e => ({
                    ref: `${e.chapter}:${e.verse}`,
                    text: e.morphology.tokens.map(tk => tk.text.replace(/\//g, '')).join(' '),
                })),
                lemmas: datos.lemmas.map(l => l.lemma),
                existingQuestions: parseBriefQuestions(draft).map(q => q.text),
                language: paper.displayLanguage,
            });
            return filterQuestionCandidates(candidatas, passageFormKeys(datos.entries, datos.lemmas));
        },
        onSuccess: r => { setResultado(r); setMarcadas(new Set()); },
        onError: () => toast.error(t('paperSetup.brief.suggest.error')),
    });

    const alternar = (i: number) => setMarcadas(prev => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
    });

    const agregar = () => {
        if (!resultado) return;
        const elegidas = resultado.kept.filter((_, i) => marcadas.has(i)).map(c => c.question);
        onDraftChange(insertQuestionsIntoBrief(draft, elegidas));
        setResultado(null);
        toast.success(t('paperSetup.brief.suggest.added', { count: elegidas.length }));
    };

    return (
        <div className="space-y-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[11px]"
                disabled={sugerir.isPending || morfologia.isLoading}
                onClick={() => sugerir.mutate()}
            >
                {sugerir.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                {t('paperSetup.brief.suggest.cta')}
            </Button>

            {resultado && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-xs">
                    <p className="text-muted-foreground">{t('paperSetup.brief.suggest.intro')}</p>
                    {resultado.kept.length === 0 ? (
                        <p className="text-muted-foreground italic">{t('paperSetup.brief.suggest.none')}</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {resultado.kept.map((c, i) => (
                                <li key={i}>
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={marcadas.has(i)}
                                            onChange={() => alternar(i)}
                                            className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0"
                                        />
                                        <span>
                                            <span className="text-foreground">{c.question}</span>
                                            {c.why && <span className="block text-[11px] text-muted-foreground">{c.why}</span>}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    {resultado.dropped.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                            {t('paperSetup.brief.suggest.dropped', {
                                count: resultado.dropped.length,
                                forms: [...new Set(resultado.dropped.flatMap(d => d.missing))].join(', '),
                            })}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setResultado(null)}>
                            {t('paperSetup.brief.suggest.close')}
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-[11px]" disabled={marcadas.size === 0} onClick={agregar}>
                            {t('paperSetup.brief.suggest.add', { count: marcadas.size })}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
