import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import {
    defaultPageJumpMode,
    hasKnownPrintedNumbering,
    resolvePageJump,
    type PageJumpMode,
    type PageJumpResult,
    type PageNumbering,
} from '@dosfilos/domain';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Lo que impide ir: se dice en línea. */
type Problem = Exclude<PageJumpResult, { kind: 'go' }>;

interface Props {
    numbering: PageNumbering | null;
    printedPageOffset: number | null | undefined;
    /** Hojas del archivo, cuando se conocen: una hoja mayor se avisa. */
    totalSheets: number | null;
    onGo: (sheet: number) => void;
}

/**
 * «Ir a»: la página impresa o la hoja del archivo, y dice cuál.
 *
 * TP #9 (B27): en el NA28 el fundador escribió 803 queriendo la hoja y el
 * cuadro lo llevó a la p. 803; una página que no existía se tomaba en
 * silencio como hoja. Ahora el cuadro pide la impresa cuando el libro la
 * tiene (con un conmutador, o «h. 803», para ir a una hoja) y la hoja cuando
 * no, y lo que no tiene hoja se avisa en línea en vez de saltar.
 */
export function IrAPagina({ numbering, printedPageOffset, totalSheets, onGo }: Props) {
    const { t } = useTranslation('exegesis');
    const offset = printedPageOffset ?? null;
    const known = hasKnownPrintedNumbering(numbering, offset);
    const [mode, setMode] = useState<PageJumpMode>(() => defaultPageJumpMode(numbering, offset));
    // La numeración llega después del primer render: se adopta su modo
    // mientras el lector no haya elegido otro.
    const chosen = useRef(false);
    useEffect(() => { if (!chosen.current) setMode(known ? 'printed' : 'sheet'); }, [known]);
    const [value, setValue] = useState('');
    const [problem, setProblem] = useState<Problem | null>(null);
    const problemId = useId();

    const submit = () => {
        const result = resolvePageJump(value, mode, { numbering, offset, totalSheets });
        if (result.kind === 'go') {
            onGo(result.sheet);
            setValue('');
            setProblem(null);
            return;
        }
        setProblem(result);
    };

    const choose = (next: PageJumpMode) => {
        chosen.current = true;
        setMode(next);
        setProblem(null);
    };

    const problemText = (problem: Problem): string => {
        switch (problem.kind) {
            case 'invalid':
                return t(problem.mode === 'printed' ? 'citationViewer.jump.invalidPrinted' : 'citationViewer.jump.invalidSheet');
            case 'noNumbering':
                return t('citationViewer.jump.noNumbering');
            case 'sheetOutOfBook':
                return t('citationViewer.jump.sheetOutOfBook', { total: problem.total });
            case 'printedUnnumbered':
                return t('citationViewer.jump.printedUnnumbered', { page: problem.page });
            case 'printedOutOfBook':
                return problem.first && problem.last
                    ? t('citationViewer.jump.printedOutOfBook', { page: problem.page, first: problem.first, last: problem.last })
                    : t('citationViewer.jump.printedOutOfBookNoRange', { page: problem.page });
        }
    };

    const label = mode === 'printed' ? t('citationViewer.jump.printedAria') : t('citationViewer.jump.sheetAria');
    return (
        <form
            onSubmit={e => { e.preventDefault(); submit(); }}
            className="flex flex-wrap items-center gap-1"
            data-testid="ir-a-pagina"
        >
            {known ? (
                <div role="group" aria-label={t('citationViewer.jump.modeLabel')} className="flex items-center overflow-hidden rounded-md border border-border">
                    {(['printed', 'sheet'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => choose(m)}
                            aria-pressed={mode === m}
                            className={cn(
                                'min-h-11 px-2 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-0 sm:py-1',
                                mode === m ? 'bg-primary-solid text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                            )}
                        >
                            {t(`citationViewer.jump.mode.${m}`)}
                        </button>
                    ))}
                </div>
            ) : (
                <span className="text-[11px] text-muted-foreground" data-testid="ir-a-sin-numeracion">
                    {t('citationViewer.jump.noNumberingHint')}
                </span>
            )}
            <Input
                type="text"
                inputMode={mode === 'sheet' ? 'numeric' : undefined}
                value={value}
                onChange={e => { setValue(e.target.value); setProblem(null); }}
                placeholder={mode === 'printed' ? t('citationViewer.goToPage') : t('citationViewer.jump.sheetPlaceholder')}
                aria-label={label}
                title={label}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? problemId : undefined}
                className="h-auto min-h-11 w-24 px-2 py-1 text-xs tabular-nums focus-visible:ring-offset-0 aria-[invalid]:border-destructive sm:min-h-0"
            />
            {problem && (
                <span id={problemId} aria-live="polite" className="text-[11px] text-destructive" data-testid="ir-a-aviso">
                    {problemText(problem)}
                </span>
            )}
        </form>
    );
}
