import React from 'react';
import { applyHebrewFiniteVerb, applyHebrewPreposition, applyHebrewInfinitive, applyHebrewKi, applyHebrewParticiple, hebrewSuffix, HEBREW_ANALYSIS_PROMPT_VERSION, readingFor, type HebrewSuffix, type HebrewArticleFact, type HebrewVerbView, type HebrewPrepositionView, type ResolvedRelation, type HebrewInfinitiveView, type HebrewKiView, type HebrewParticipleView, type KetivQereFact, type PhraseKind, type SpeechFact, type StructureWord, type VerseAnalysis } from '@dosfilos/domain';
import { conLectura, useVerseStructure } from '@/components/language-structure/useVerseStructure';
import { alinearConAnalisis } from '@/components/language-structure/alinearHebreo';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import { frasePorRef } from '@/components/language-structure/frases';

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
     * el que el asistente no la devolvió o no pasó la validación («empty»). Un
     * v3 SÍ tiene lectura, pero su waw disyuntiva salía «pero» por defecto
     * («staleWaw», revisión del profesor 2026-11). Un v4 tiene la waw, pero no la
     * función de cada verbo finito (U5, Rut 3:5): «staleVerb». Se dice y se ofrece
     * re-analizar (la traducción corregida se conserva).
     */
    const version = analysis.promptVersion ?? 1;
    // El motivo se dice sólo si el versículo lo tiene (revisión adversarial, 2026-11-12: en Rut, 53 de
    // 85 versículos v3 decían «la traducía "pero"» sin ninguna waw disyuntiva). Si no, el aviso genérico.
    const conWaw = (estructura.nodes ?? []).some(n => n.relation === 'disjunctive');
    const conVerbo = (estructura.hebrewVerbs?.length ?? 0) > 0;
    const sinLectura: 'stale' | 'staleWaw' | 'staleVerb' | 'staleHebrew' | 'empty' | null =
        version < 3 ? 'stale'
            : version < 4 && conWaw ? 'staleWaw'
            : version < HEBREW_ANALYSIS_PROMPT_VERSION ? (conVerbo ? 'staleVerb' : 'staleHebrew')
                : !analysis.clauseReadings?.length && (estructura.nodes?.length ?? 0) > 0 ? 'empty'
                    : null;
    /**
     * R4 — índice del análisis → la función del infinitivo: la regla (medida)
     * propone; la elección del asistente vale si está en su lista y, si no, se
     * muestra al lado. Lo ya guardado (sin elección) muestra la regla o las opciones.
     * Límite: si el asistente une dos infinitivos en una palabra (maqaf), queda el último.
     */
    const infinitivos = React.useMemo(() => {
        const m = new Map<number, HebrewInfinitiveView>();
        const indice = alinear(estructura.words);
        for (const c of estructura.infinitives ?? []) {
            const i = indice[c.ordinal];
            if (i !== undefined) m.set(i, applyHebrewInfinitive(c, analysis.words[i]?.infinitiveFunction));
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /** R4 — lo mismo para el participio (Arnold y Choi §3.4.3). */
    const participios = React.useMemo(() => {
        const m = new Map<number, HebrewParticipleView>();
        const indice = alinear(estructura.words);
        for (const c of estructura.participles ?? []) {
            const i = indice[c.ordinal];
            if (i !== undefined) m.set(i, applyHebrewParticiple(c, analysis.words[i]?.participleFunction));
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /** R4 — y para כִּי (Arnold y Choi §4.3.4). */
    const kis = React.useMemo(() => {
        const m = new Map<number, HebrewKiView>();
        const indice = alinear(estructura.words);
        for (const c of estructura.kis ?? []) {
            const i = indice[c.ordinal];
            if (i !== undefined) m.set(i, applyHebrewKi(c, analysis.words[i]?.kiFunction));
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /**
     * Índice del análisis → el ketiv y el qere de la palabra (revisión del profesor, 2026-11):
     * el análisis es del qere; la ficha dice qué está escrito y lo marca con el círculo de la BHS.
     */
    const ketivQere = React.useMemo(() => {
        const m = new Map<number, KetivQereFact>();
        const indice = alinear(estructura.words);
        for (const f of estructura.ketivQere ?? []) {
            const i = indice[f.ordinal];
            if (i !== undefined) m.set(i, f);
        }
        return m;
    }, [estructura, alinear]);
    /**
     * Índice del análisis → su sufijo pronominal, desde el código OSHB de la palabra alineada
     * (revisión del profesor, Rut 3:3 כַּלֹּתוֹ): la ficha no lo mostraba como dato de la forma.
     */
    const sufijos = React.useMemo(() => {
        const m = new Map<number, HebrewSuffix>();
        const indice = alinear(estructura.words);
        estructura.words.forEach((w, o) => {
            const i = indice[o];
            const s = hebrewSuffix(w.m);
            if (i !== undefined && s && !m.has(i)) m.set(i, s);
        });
        return m;
    }, [estructura, alinear]);
    /**
     * Índice del análisis → la waw disyuntiva que abre su cláusula y el valor que eligió el
     * asistente (revisión del profesor, Rut 2:1: «waw + no verbo → disyuntiva, no
     * necesariamente contrastiva»). La ficha de esa palabra lo dice.
     */
    const disyuntivas = React.useMemo(() => {
        const m = new Map<number, { resolved?: ResolvedRelation }>();
        const indice = alinear(estructura.words);
        for (const n of estructura.nodes ?? []) {
            if (n.relation !== 'disjunctive' || !n.connector) continue;
            const o = estructura.ordinal.get(n.connector);
            const i = o === undefined ? undefined : indice[o];
            if (i === undefined) continue;
            const resolved = readingFor(n, analysis.clauseReadings)?.resolved;
            m.set(i, resolved ? { resolved } : {});
        }
        return m;
    }, [estructura, alinear, analysis.clauseReadings]);
    /**
     * Índice del análisis → el sustantivo con artículo que ya apareció poco antes (U4, Rut 3:6
     * הַגֹּרֶן, nombrada en 3:3): un DATO; si el artículo la retoma, lo decide quien lee.
     */
    const articulos = React.useMemo(() => {
        const m = new Map<number, HebrewArticleFact>();
        const indice = alinear(estructura.words);
        for (const f of estructura.articles ?? []) {
            const i = indice[f.ordinal];
            if (i !== undefined) m.set(i, f);
        }
        return m;
    }, [estructura, alinear]);
    /** Índice del análisis → el rol de la palabra en su oración según MACULA (s, o, adv…). */
    const roles = React.useMemo(() => {
        const m = new Map<number, string>();
        const indice = alinear(estructura.words);
        estructura.words.forEach((w, o) => {
            const i = indice[o];
            if (i !== undefined && w.role && !m.has(i)) m.set(i, w.role);
        });
        return m;
    }, [estructura, alinear]);
    /** U5 (Rut 3:5 אֶעֱשֶׂה): índice del análisis → la función del verbo finito, de la lista de su forma. */
    const verbos = React.useMemo(() => {
        const m = new Map<number, HebrewVerbView>();
        const indice = alinear(estructura.words);
        for (const c of estructura.hebrewVerbs ?? []) {
            const i = indice[c.ordinal];
            if (i !== undefined) m.set(i, applyHebrewFiniteVerb(c, analysis.words[i]?.verbFunction));
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /** U3a (Rut 2:1, 2:7): índice del análisis → la función de su preposición, de la lista de A&C §4.1. */
    const preposiciones = React.useMemo(() => {
        const m = new Map<number, HebrewPrepositionView>();
        const indice = alinear(estructura.words);
        for (const c of estructura.hebrewPrepositions ?? []) {
            const i = indice[c.ordinal];
            if (i !== undefined) m.set(i, applyHebrewPreposition(c, analysis.words[i]?.prepositionFunction));
        }
        return m;
    }, [estructura, alinear, analysis.words]);
    /**
     * U11b (Rut 2:1 לְאִישָׁהּ): índice del análisis → la clase de su frase preposicional según MACULA,
     * o `null` si está alineada y no va en ninguna. Falta (undefined) si la palabra no se alineó: ahí
     * la marca sigue saliendo como antes.
     */
    const frases = React.useMemo(() => {
        const m = new Map<number, PhraseKind | null>();
        const indice = alinear(estructura.words);
        const porRef = frasePorRef(estructura.phrases ?? []);
        estructura.words.forEach((w, o) => {
            const i = indice[o];
            if (i !== undefined && !m.get(i)) m.set(i, porRef.get(w.r) ?? null);
        });
        return m;
    }, [estructura, alinear]);
    return { estructura, alinear, frases, antepuestas, discurso, infinitivos, participios, kis, ketivQere, sufijos, disyuntivas, articulos, roles, verbos, preposiciones, sinLectura };
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
