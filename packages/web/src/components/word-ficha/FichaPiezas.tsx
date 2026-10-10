import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RuleSource } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';
import { cn } from '@/lib/utils';

/**
 * Las piezas comunes de la ficha de palabra (hebreo y griego). Los bloques
 * de cada idioma se arman con estas: así las dos fichas se leen igual.
 */

/** Rótulo + valor, en una grilla de dos columnas («Raíz · אכל»). */
export function FichaFilas({ filas }: { filas: readonly (readonly [string, React.ReactNode])[] }) {
    return (
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            {filas.map(([rotulo, valor], i) => (
                <React.Fragment key={i}>
                    <dt className="text-muted-foreground">{rotulo}</dt>
                    <dd className="m-0 leading-snug">{valor}</dd>
                </React.Fragment>
            ))}
        </dl>
    );
}

/** Las celdas de la forma (binyan, tiempo, caso…). Las ausentes no se pasan. */
export function FichaCeldas({ celdas }: { celdas: readonly { label: string; value: string; ancha?: boolean }[] }) {
    if (!celdas.length) return null;
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="ficha-celdas">
            {celdas.map((c) => (
                <div key={c.label} className={cn('flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3 py-2', c.ancha && 'col-span-2')}>
                    <span className="text-[11px] text-muted-foreground">{c.label}</span>
                    <span className="text-sm font-semibold leading-snug break-words">{c.value}</span>
                </div>
            ))}
        </div>
    );
}

/** Una caja con título y contenido plegable («Cómo se reconoce», «Morfemas»). */
export function FichaCaja({
    titulo, children, plegable = false, abiertaAlInicio = true, pie, testId,
}: {
    titulo: string;
    children: React.ReactNode;
    plegable?: boolean;
    abiertaAlInicio?: boolean;
    pie?: React.ReactNode;
    testId?: string;
}) {
    const { t } = useTranslation('languageStructure');
    const [abierta, setAbierta] = React.useState(abiertaAlInicio);
    return (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-3" data-testid={testId}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{titulo}</span>
                {plegable && (
                    <button
                        type="button"
                        onClick={() => setAbierta(v => !v)}
                        aria-expanded={abierta}
                        className="min-h-8 rounded px-1 text-[12.5px] font-semibold text-primary hover:underline print:hidden"
                    >
                        {abierta ? t('wordFicha.hide') : t('wordFicha.show')}
                    </button>
                )}
            </div>
            {/* Plegado se sigue imprimiendo: en papel no hay botón para abrirlo. */}
            <div className={cn(!abierta && 'hidden print:block')}>{children}</div>
            {pie && <div className="border-t border-border pt-2 text-[11.5px] text-muted-foreground">{pie}</div>}
        </div>
    );
}

/** Lista de pistas («Cómo se reconoce»). */
export function FichaPistas({ pistas }: { pistas: readonly React.ReactNode[] }) {
    return (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-relaxed text-foreground/85">
            {pistas.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
    );
}

export type OrigenFuncion = 'regla' | 'asistente';

/** El punto y el rótulo del origen: ámbar, según la gramática; azul, el asistente. */
export function FichaOrigenRotulo({ origen }: { origen: OrigenFuncion }) {
    const { t } = useTranslation('languageStructure');
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide',
                origen === 'regla' ? 'text-warning-subtle-foreground' : 'text-info-subtle-foreground',
            )}
            title={t(origen === 'regla' ? 'wordFicha.origin.ruleTitle' : 'wordFicha.origin.assistantTitle')}
            data-testid={`ficha-origen-${origen}`}
        >
            <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', origen === 'regla' ? 'bg-warning' : 'bg-info')} />
            {t(origen === 'regla' ? 'wordFicha.origin.rule' : 'wordFicha.origin.assistant')}
        </span>
    );
}

/**
 * EL BLOQUE DE FUNCIÓN: uno solo por función (antes eran tres que se leían
 * como contradicción: la regla, «el asistente lee otra» y la función libre).
 * Lleva el nombre, de dónde sale, la explicación, cómo se reconoce, las
 * opciones si quedan varias, la cita y —plegada— la otra lectura posible.
 */
export function FichaFuncion({
    titulo, nombre, origen, texto, reconoce, opciones, fuentes, porValidar, otra, extra, testId,
}: {
    /** Qué forma es («Infinitivo constructo», «Participio», «כִּי»). */
    titulo?: string;
    /** La función decidida o elegida; sin ella, sólo las opciones. */
    nombre?: string;
    origen: OrigenFuncion;
    texto?: React.ReactNode;
    /** Por qué la regla dice esto: lo escribe el código, no el asistente. */
    reconoce?: React.ReactNode;
    /** Las opciones que deja la gramática, cuando el asistente no eligió. */
    opciones?: { lista: readonly string[]; reanalizar: boolean };
    fuentes?: readonly RuleSource[];
    /** Regla medida, todavía sin validar por el profesor. */
    porValidar?: boolean;
    /** Otra lectura: el asistente lee una función que la regla no deja. */
    otra?: string;
    extra?: React.ReactNode;
    testId?: string;
}) {
    const { t } = useTranslation('languageStructure');
    const [otraAbierta, setOtraAbierta] = React.useState(false);
    const regla = origen === 'regla';
    return (
        <div className="flex flex-col gap-2" data-testid={testId}>
            <div className={cn(
                'flex flex-col gap-2 rounded-2xl border px-4 py-3',
                regla ? 'border-warning/30 bg-warning-subtle' : 'border-info/30 bg-info-subtle',
            )}>
                {titulo && <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</span>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {nombre ? <span className="text-lg font-extrabold leading-tight tracking-tight">{nombre}</span> : <span />}
                    <FichaOrigenRotulo origen={origen} />
                </div>
                {texto && <div className="text-[14px] leading-relaxed text-foreground">{texto}</div>}
                {opciones && (
                    <p className="m-0 text-[13px] leading-relaxed text-foreground/80">
                        {t('wordFicha.options', { list: opciones.lista.join(' · ') })}
                        {opciones.reanalizar && <> {t('wordFicha.reanalyze')}</>}
                    </p>
                )}
                {(reconoce || extra) && (
                    <dl className="m-0 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px] leading-snug">
                        {reconoce && (
                            <>
                                <dt className={regla ? 'text-warning-subtle-foreground' : 'text-info-subtle-foreground'}>{t('wordFicha.howRecognized')}</dt>
                                <dd className="m-0">{reconoce}</dd>
                            </>
                        )}
                        {extra}
                    </dl>
                )}
                {fuentes && fuentes.length > 0 && (
                    <div className={cn('flex flex-wrap items-center gap-x-2 border-t pt-2', regla ? 'border-warning/30' : 'border-info/30')}>
                        <SourceNote sources={fuentes} />
                        {porValidar && <span className="text-[11px] text-muted-foreground">· {t('wordFicha.ruleToValidate')}</span>}
                    </div>
                )}
            </div>
            {otra && (
                <>
                    <button
                        type="button"
                        onClick={() => setOtraAbierta(v => !v)}
                        aria-expanded={otraAbierta}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 text-left text-[13.5px] font-semibold print:hidden"
                        data-testid="ficha-otra-lectura"
                    >
                        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-info" />{t('wordFicha.otherReading', { fn: otra })}</span>
                        <span className="text-muted-foreground">{otraAbierta ? t('wordFicha.hide') : t('wordFicha.show')}</span>
                    </button>
                    <div className={cn('rounded-xl border border-info/30 bg-info-subtle px-4 py-3 text-[13.5px] leading-relaxed text-info-subtle-foreground', !otraAbierta && 'hidden print:block')}>
                        {t('wordFicha.otherReadingText', { fn: otra })}
                    </div>
                </>
            )}
        </div>
    );
}
