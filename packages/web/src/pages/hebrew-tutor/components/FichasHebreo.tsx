import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { VerseAnalysis } from '@dosfilos/domain';
import { FichaCompleta, FichaPanel, FichaResumen } from '@/components/word-ficha/Ficha';
import { cn } from '@/lib/utils';
import { BLOQUES_HEBREO, type DatosHebreo } from '../ficha/bloquesHebreo';

/**
 * La ficha de palabra en el tutor de hebreo: los datos de cada palabra, el
 * panel lateral y la grilla de tarjetas resumen (decisión del fundador: la
 * grilla queda, cada tarjeta resume y abre la ficha completa).
 */

/** El panel lateral, con «anterior» y «siguiente» sin cerrarse. */
export function FichaPanelHebreo({
    analysis, datos, abierta, onAbrir,
}: {
    analysis: VerseAnalysis;
    datos: (i: number) => DatosHebreo | null;
    abierta: number | null;
    onAbrir: (i: number | null) => void;
}) {
    const { t } = useTranslation('languageStructure');
    const total = analysis.words.length;
    const i = abierta;
    return (
        <FichaPanel
            registro={BLOQUES_HEBREO}
            d={i === null ? null : datos(i)}
            abierto={i !== null}
            onCerrar={() => onAbrir(null)}
            referencia={i === null ? '' : t('wordFicha.reference', { ref: analysis.reference, n: i + 1, total })}
            onAnterior={i !== null && i > 0 ? () => onAbrir(i - 1) : undefined}
            onSiguiente={i !== null && i < total - 1 ? () => onAbrir(i + 1) : undefined}
            rtl
        />
    );
}

/** Una tarjeta resumen: lo esencial de la palabra; al tocarla abre la ficha. */
function TarjetaResumen({
    d, activa, onAbrir, onHover, cardRef,
}: {
    d: DatosHebreo;
    activa: boolean;
    onAbrir: () => void;
    onHover: (h: boolean) => void;
    cardRef?: React.Ref<HTMLButtonElement>;
}) {
    const { t } = useTranslation('languageStructure');
    return (
        <button
            ref={cardRef}
            type="button"
            onClick={onAbrir}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            className={cn(
                'flex h-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-colors',
                activa ? 'border-primary/70 ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
            )}
            data-testid="tarjeta-resumen"
        >
            <div className="flex-1"><FichaResumen registro={BLOQUES_HEBREO} d={d} /></div>
            <span className="flex items-center justify-end gap-1 border-t border-border px-4 py-2 text-xs font-semibold text-primary">
                {t('wordFicha.seeFicha')}<ChevronRight className="h-3.5 w-3.5" />
            </span>
        </button>
    );
}

/**
 * La grilla de tarjetas resumen. Al imprimir se reemplaza por la ficha
 * completa de cada palabra: en papel no hay panel que abrir y nada se pierde.
 */
export function TarjetasResumenHebreo({
    analysis, datos, activa, onAbrir, onHover, cardRefs,
}: {
    analysis: VerseAnalysis;
    datos: (i: number) => DatosHebreo | null;
    activa: number | null;
    onAbrir: (i: number) => void;
    onHover: (i: number | null) => void;
    cardRefs?: React.MutableRefObject<(HTMLElement | null)[]>;
}) {
    return (
        <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
                {analysis.words.map((w, i) => {
                    const d = datos(i);
                    return d ? (
                        <TarjetaResumen
                            key={`${w.hebrewText}-${i}`}
                            d={d}
                            activa={activa === i}
                            onAbrir={() => onAbrir(i)}
                            onHover={(h) => onHover(h ? i : null)}
                            cardRef={(el) => { if (cardRefs) cardRefs.current[i] = el; }}
                        />
                    ) : null;
                })}
            </div>
            <div className="hidden print:block">
                {analysis.words.map((w, i) => {
                    const d = datos(i);
                    return d ? (
                        <div key={`${w.hebrewText}-${i}`} className="mb-4 break-inside-avoid rounded-xl border border-border">
                            <FichaCompleta registro={BLOQUES_HEBREO} d={d} />
                        </div>
                    ) : null;
                })}
            </div>
        </>
    );
}
