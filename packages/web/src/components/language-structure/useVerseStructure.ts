import { useEffect, useMemo, useState } from 'react';
import {
    greekDiscourseCandidates,
    greekAgency,
    greekAnaphora,
    greekAutos,
    greekVerbCandidates,
    hebrewSpeechFacts,
    hebrewInfinitiveCandidates,
    hebrewParticipleCandidates,
    hebrewKiCandidates,
    type HebrewInfinitiveCandidate,
    type HebrewParticipleCandidate,
    type HebrewKiCandidate,
    type NominalFacts,
    type SpeechFact,
    type DiscourseCandidate,
    readingFor,
    verseStructure,
    type ClauseReading,
    verseWords,
    type ChapterStructure,
    type StructureLanguage,
    type StructureNode,
    type StructureWord,
    type VerbCandidate,
} from '@dosfilos/domain';

import { languageStructureProvider as provider } from './provider';
import type { FrontedInfo } from './FrontedNote';

export interface VerseStructureState {
    loading: boolean;
    unavailable: boolean;
    nodes: readonly StructureNode[] | null;
    /** Las palabras del versículo en orden (sin ketiv): su posición es el «ordinal». */
    words: readonly StructureWord[];
    /** Referencia de palabra («9!3») → ordinal. */
    ordinal: ReadonlyMap<string, number>;
    /** Ordinal → con qué rol va antepuesta al verbo y, si el asistente lo leyó, foco o marco (para la ficha). */
    frontedByOrdinal: ReadonlyMap<number, FrontedInfo>;
    /** G2 (sólo griego): cada verbo con las funciones que el texto permite o decide. */
    verbs: readonly VerbCandidate[];
    /** G3 (sólo griego): agencia de las preposiciones y artículos anafóricos. */
    nominal: NominalFacts;
    /** G4 (sólo griego): partículas y pronombres explícitos. */
    discourse: readonly DiscourseCandidate[];
    /** Sólo hebreo: la 2.ª persona dentro de un discurso es a quien se habla (Rut 1:16). */
    speech: readonly SpeechFact[];
    /** R4, sólo hebreo: la función posible de cada infinitivo (Arnold y Choi §3.4). */
    infinitives: readonly HebrewInfinitiveCandidate[];
    participles: readonly HebrewParticipleCandidate[];
    kis: readonly HebrewKiCandidate[];
}

/**
 * La estructura de un versículo (G1 + G5): baja el capítulo del sitio una vez
 * y arma las filas con `verseStructure`. Sin libro (un análisis sin referencia)
 * no pide nada.
 */
export function useVerseStructure(
    lang: StructureLanguage,
    book: string | null | undefined,
    chapter: number,
    verse: number,
): VerseStructureState {
    const key = book ? `${lang}/${book}/${chapter}` : null;
    const [estado, setEstado] = useState<{ key: string; chapter: ChapterStructure | null } | null>(null);

    useEffect(() => {
        if (!key || !book) return;
        let vivo = true;
        provider.getChapter(lang, book, chapter).then(
            ch => { if (vivo) setEstado({ key, chapter: ch }); },
            () => { if (vivo) setEstado({ key, chapter: null }); },
        );
        return () => { vivo = false; };
    }, [key, lang, book, chapter]);

    // Mientras llega el capítulo nuevo no se muestra el del anterior.
    const actual = estado?.key === key ? estado : null;
    return useMemo(() => {
        const nodes = actual?.chapter ? verseStructure(actual.chapter, verse) : null;
        const words = actual?.chapter ? verseWords(actual.chapter, verse) : [];
        const ordinal = new Map(words.map((w, i) => [w.r, i]));
        const frontedByOrdinal = conLectura(nodes ?? [], ordinal);
        const griego = actual?.chapter && lang === 'gr' ? actual.chapter : null;
        const verbs = griego ? greekVerbCandidates(griego, verse) : [];
        const nominal = {
            agency: griego ? greekAgency(griego, verse) : [],
            anaphora: griego ? greekAnaphora(griego, verse) : [],
            autos: griego ? greekAutos(griego, verse) : [],
        };
        const discourse = griego ? greekDiscourseCandidates(griego, verse) : [];
        const speech = actual?.chapter && lang === 'he' ? hebrewSpeechFacts(actual.chapter, verse) : [];
        const infinitives = actual?.chapter && lang === 'he' ? hebrewInfinitiveCandidates(actual.chapter, verse) : [];
        const participles = actual?.chapter && lang === 'he' ? hebrewParticipleCandidates(actual.chapter, verse) : [];
        const kis = actual?.chapter && lang === 'he' ? hebrewKiCandidates(actual.chapter, verse) : [];
        return { loading: !!key && !actual, unavailable: !!actual && !actual.chapter, nodes, words, ordinal, frontedByOrdinal, verbs, nominal, discourse, speech, infinitives, participles, kis };
    }, [actual, key, verse, lang]);
}

/**
 * Ordinal → cómo va antepuesta la palabra; con la lectura del asistente, además
 * foco o marco. Aparte del hook porque en griego la lectura llega DESPUÉS: el
 * análisis necesita las filas para pedirla.
 */
export function conLectura(
    nodes: readonly StructureNode[],
    ordinal: ReadonlyMap<string, number>,
    readings?: readonly ClauseReading[],
): Map<number, FrontedInfo> {
    const out = new Map<number, FrontedInfo>();
    for (const n of nodes) {
        const fronting = readingFor(n, readings)?.fronting;
        for (const f of n.fronted) for (const r of f.rs) {
            const i = ordinal.get(r);
            if (i !== undefined) out.set(i, fronting ? { role: f.role, fronting } : { role: f.role });
        }
    }
    return out;
}
