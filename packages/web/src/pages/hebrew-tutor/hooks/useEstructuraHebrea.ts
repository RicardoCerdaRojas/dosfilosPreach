import React from 'react';
import { HEBREW_ANALYSIS_PROMPT_VERSION, type SpeechFact, type StructureWord, type VerseAnalysis } from '@dosfilos/domain';
import { conLectura, useVerseStructure } from '@/components/language-structure/useVerseStructure';
import { alinearConAnalisis } from '@/components/language-structure/alinearHebreo';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';

/** Un hecho de «quién habla» con los nombres en el idioma del análisis. */
export type SpeechView = SpeechFact & { readonly speakerName?: string; readonly addresseeName?: string };

/**
 * «Estructura» en el analizador hebreo (G1 + G5): los datos de MACULA del
 * versículo YA analizado, enlazados a las palabras del análisis.
 */
export function useEstructuraHebrea(
    analysis: VerseAnalysis,
    ref: { book: string; chapter: number; verse: number } | undefined,
) {
    const estructura = useVerseStructure('he', ref?.book, ref?.chapter ?? 0, ref?.verse ?? 0);
    const alinear = React.useCallback(
        (palabras: readonly StructureWord[]) => alinearConAnalisis(analysis.words, palabras),
        [analysis.words],
    );
    /** Índice del análisis → cómo va antepuesta al verbo y, con la lectura, foco o marco (tarjeta y tooltip). */
    const antepuestas = React.useMemo(() => {
        const m = new Map<number, FrontedInfo>();
        const indice = alinear(estructura.words);
        conLectura(estructura.nodes ?? [], estructura.ordinal, analysis.clauseReadings).forEach((info, o) => {
            const i = indice[o];
            if (i !== undefined) m.set(i, info);
        });
        return m;
    }, [estructura, alinear, analysis.clauseReadings]);
    /**
     * Índice del análisis → quién habla, en la 2.ª persona de un discurso: es el
     * DESTINATARIO, no el hablante (Rut 1:16, la tarjeta de תֵּלְכִי decía «Rut como
     * sujeto»). Se aplica al mostrar: corrige también lo ya guardado.
     */
    const discurso = React.useMemo(() => {
        const m = new Map<number, SpeechView>();
        const indice = alinear(estructura.words);
        // El nombre con la traducción del análisis («Rut»), no en hebreo en medio de la frase.
        const nombre = (ordinales: readonly number[] | undefined) => {
            const vistos = new Set<number>();
            const partes = (ordinales ?? []).flatMap((o) => {
                const i = indice[o];
                if (i === undefined || vistos.has(i)) return [];
                vistos.add(i);
                const t = analysis.words[i]?.translation?.trim();
                return t ? [t] : [];
            });
            return partes.length ? partes.join(' ') : undefined;
        };
        for (const f of estructura.speech ?? []) {
            const i = indice[f.ordinal];
            if (i === undefined) continue;
            const speakerName = nombre(f.speakerOrdinals);
            const addresseeName = nombre(f.addresseeOrdinals);
            m.set(i, { ...f, ...(speakerName ? { speakerName } : {}), ...(addresseeName ? { addresseeName } : {}) });
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /**
     * Por qué no hay lectura: un análisis anterior a v3 («stale») o uno nuevo en
     * el que el asistente no la devolvió o no pasó la validación («empty»). Se
     * dice y se ofrece re-analizar (la traducción corregida se conserva).
     */
    const sinLectura: 'stale' | 'empty' | null =
        (analysis.promptVersion ?? 1) < HEBREW_ANALYSIS_PROMPT_VERSION ? 'stale'
            : !analysis.clauseReadings?.length && (estructura.nodes?.length ?? 0) > 0 ? 'empty'
                : null;
    return { estructura, alinear, antepuestas, discurso, sinLectura };
}

/**
 * El versículo que acompaña al scroll: APAGADO por defecto (pedido del
 * fundador, 2026-10-08 — con «Estructura» la página creció y verlo siempre
 * molesta). Se recuerda en este navegador.
 */
export function useVersiculoFijo() {
    const [fijo, setFijo] = React.useState<boolean>(() => {
        try { return localStorage.getItem('ht-sticky-verse') === '1'; } catch { return false; }
    });
    const alternar = () => setFijo(v => {
        try { localStorage.setItem('ht-sticky-verse', v ? '0' : '1'); } catch { /* sin almacenamiento */ }
        return !v;
    });
    return [fijo, alternar] as const;
}
