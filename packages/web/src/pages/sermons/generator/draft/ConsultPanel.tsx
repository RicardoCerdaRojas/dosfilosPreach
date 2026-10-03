import { useState, type FormEvent } from 'react';
import { AlertTriangle, BookOpen, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { useConsultaTaller } from '@/hooks/useConsultaTaller';
import { citedVerses } from '@/lib/bible/bibleReferencePattern';
import { LocalBibleService } from '@/services/LocalBibleService';
import { useExternalProposals } from './externalProposalsContext';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    passage: string;
    proposition?: string;
    /** La sección abierta en el Taller, si hay una. */
    section: { id: string; label: string; pointTitle?: string } | null;
}

/**
 * Chat de CONSULTA del Taller (hallazgo 32 del ejercicio de Jonás 4:5-11).
 *
 * Herramienta transversal: se abre desde la barra del paso, sobre cualquier
 * sección. Responde; no escribe el sermón. Dos reglas de rigor a la vista:
 *   - Cada versículo que nombra se muestra con el texto REAL (RVR1960); el que
 *     no existe se marca.
 *   - «Llevar a mis ideas» deja la respuesta como PROPUESTA en la sección
 *     activa: el pastor la elige, la edita o la descarta.
 */
export function ConsultPanel({ open, onOpenChange, passage, proposition, section }: Props) {
    const { t } = useTranslation('generator');
    const k = (key: string) => `drafting.consult.${key}`;
    const { turns, ask, loading, error, reset } = useConsultaTaller();
    const externas = useExternalProposals();
    const [pregunta, setPregunta] = useState('');
    const ejemplos = t(k('examples'), { returnObjects: true }) as unknown as string[];

    const enviar = async (e?: FormEvent, texto = pregunta) => {
        e?.preventDefault();
        if (!texto.trim() || loading) return;
        setPregunta('');
        await ask({
            question: texto,
            passage,
            proposition,
            sectionLabel: section?.label,
            pointTitle: section?.pointTitle,
        });
    };

    const llevar = (texto: string) => {
        if (!section || !externas) return;
        externas.send(section.id, { text: texto, why: t(k('proposalWhy')) });
        toast.success(t(k('brought'), { section: section.label }));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-b px-5 py-4">
                    <SheetTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                        {t(k('title'))}
                    </SheetTitle>
                    <SheetDescription>{t(k('subtitle'))}</SheetDescription>
                    {section && (
                        <p className="text-xs font-medium text-muted-foreground">{t(k('context'), { section: section.label })}</p>
                    )}
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
                    {turns.length === 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">{t(k('empty'))}</p>
                            {Array.isArray(ejemplos) && ejemplos.map(ej => (
                                <button
                                    key={ej}
                                    type="button"
                                    onClick={() => void enviar(undefined, ej)}
                                    className="block w-full rounded-md border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                                >
                                    {ej}
                                </button>
                            ))}
                        </div>
                    )}

                    {turns.map((turno, i) =>
                        turno.role === 'pastor' ? (
                            <div key={i} className="ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm">{turno.text}</div>
                        ) : (
                            <Respuesta
                                key={i}
                                texto={turno.text}
                                puedeLlevar={!!section && !!externas}
                                onLlevar={() => llevar(turno.text)}
                            />
                        ),
                    )}

                    {loading && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> {t(k('thinking'))}
                        </p>
                    )}
                    {error && <p className="text-sm text-destructive">{t(k('error'))}</p>}
                </div>

                <form onSubmit={enviar} className="space-y-2 border-t px-5 py-4">
                    <Textarea
                        value={pregunta}
                        onChange={e => setPregunta(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) void enviar(e as unknown as FormEvent);
                        }}
                        placeholder={t(k('placeholder'))}
                        aria-label={t(k('placeholder'))}
                        rows={3}
                        className="resize-none text-sm"
                    />
                    <div className="flex items-center justify-between gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={turns.length === 0 || loading}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t(k('clear'))}
                        </Button>
                        <Button type="submit" size="sm" disabled={!pregunta.trim() || loading}>
                            <Send className="mr-1.5 h-3.5 w-3.5" /> {t(k('send'))}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}

function Respuesta({ texto, puedeLlevar, onLlevar }: { texto: string; puedeLlevar: boolean; onLlevar: () => void }) {
    const { t } = useTranslation('generator');
    const k = (key: string) => `drafting.consult.${key}`;
    const versiculos = citedVerses(texto, {
        verses: ref => LocalBibleService.getVerses(ref),
        // Se reconoce el libro: entonces un versículo que no aparece de verdad no existe.
        readable: ref => LocalBibleService.isValidBook(ref.replace(/\s*\d+[:.]\d+.*$/, '').trim()),
    });
    return (
        <div className="space-y-2 rounded-lg border bg-card px-3 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{texto}</p>
            {versiculos.length > 0 && (
                <div className="space-y-1.5 border-t pt-2">
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <BookOpen className="h-3 w-3" aria-hidden /> {t(k('verses'))}
                    </p>
                    {versiculos.map(v => (
                        <div key={v.reference} className="text-xs">
                            <span className="font-semibold">{v.reference}</span>{' '}
                            {v.status === 'found' ? (
                                <span className="text-muted-foreground">{v.text}</span>
                            ) : v.status === 'missing' ? (
                                <span className="inline-flex items-center gap-1 text-warning">
                                    <AlertTriangle className="h-3 w-3" aria-hidden /> {t(k('verseMissing'))}
                                </span>
                            ) : (
                                <span className="text-muted-foreground italic">{t(k('verseUnreadable'))}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">{puedeLlevar ? t(k('bringHint')) : t(k('noSection'))}</span>
                <Button type="button" size="sm" variant="outline" disabled={!puedeLlevar} onClick={onLlevar}>
                    {t(k('bringToIdeas'))}
                </Button>
            </div>
        </div>
    );
}
