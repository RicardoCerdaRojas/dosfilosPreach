import React from 'react';
import type { HebrewInfinitiveView, HebrewKiView, HebrewParticipleView, HebrewSuffix, HebrewArticleFact, HebrewVerbView, HebrewPrepositionView, KetivQereFact, ResolvedRelation, VerseAnalysis, WordAnalysis } from '@dosfilos/domain';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import type { MirrorView } from '@/components/language-structure/RepeticionEspejo';
import type { SpeechView } from '../hooks/useEstructuraHebrea';
import type { DatosHebreo } from './bloquesHebreo';

interface Mapas {
    antepuestas: ReadonlyMap<number, FrontedInfo>;
    discurso: ReadonlyMap<number, SpeechView>;
    infinitivos: ReadonlyMap<number, HebrewInfinitiveView>;
    participios: ReadonlyMap<number, HebrewParticipleView>;
    kis: ReadonlyMap<number, HebrewKiView>;
    ketivQere: ReadonlyMap<number, KetivQereFact>;
    sufijos: ReadonlyMap<number, HebrewSuffix>;
    disyuntivas: ReadonlyMap<number, { resolved?: ResolvedRelation }>;
    articulos: ReadonlyMap<number, HebrewArticleFact>;
    roles: ReadonlyMap<number, string>;
    verbos: ReadonlyMap<number, HebrewVerbView>;
    preposiciones: ReadonlyMap<number, HebrewPrepositionView>;
    espejos: ReadonlyMap<number, MirrorView>;
}

/** Los datos de la ficha de la palabra `i` del análisis. */
export function useDatosHebreo(analysis: VerseAnalysis, mapas: Mapas, onInvestigate?: (w: WordAnalysis) => void) {
    return React.useCallback((i: number): DatosHebreo | null => {
        const word = analysis.words[i];
        if (!word) return null;
        return {
            word,
            fronted: mapas.antepuestas.get(i),
            speech: mapas.discurso.get(i),
            infinitive: mapas.infinitivos.get(i),
            participle: mapas.participios.get(i),
            ki: mapas.kis.get(i),
            ketivQere: mapas.ketivQere.get(i),
            suffix: mapas.sufijos.get(i),
            disjunctive: mapas.disyuntivas.get(i),
            article: mapas.articulos.get(i),
            role: mapas.roles.get(i),
            verb: mapas.verbos.get(i),
            preposition: mapas.preposiciones.get(i),
            mirror: mapas.espejos.get(i),
            ...(onInvestigate ? { onInvestigate: () => onInvestigate(word) } : {}),
        };
    }, [analysis.words, mapas.antepuestas, mapas.discurso, mapas.infinitivos, mapas.participios, mapas.kis, mapas.ketivQere, mapas.sufijos, mapas.disyuntivas, mapas.articulos, mapas.roles, mapas.verbos, mapas.preposiciones, mapas.espejos, onInvestigate]);
}

