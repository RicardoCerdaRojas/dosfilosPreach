import { useCallback, useEffect, useRef, useState } from 'react';
import { FirestoreGreekInsightRepository, GreekInsightService } from '@dosfilos/infrastructure';
import type { DiscourseCandidate, GreekVerseInsight, GreekWordToken, NominalFacts, StructureNode, VerbCandidate } from '@dosfilos/domain';

/**
 * El análisis del modelo para el versículo activo: caché global primero,
 * generación bajo demanda después.
 *
 * PULL, NO AUTO. Generar al navegar quemaría una llamada por cada versículo
 * visitado de pasada; el pastor que está LEYENDO morfología no pidió pagar un
 * análisis. El botón lo pide una vez y el caché lo vuelve gratis para todos —
 * el texto griego es el mismo para todo el mundo.
 */
export function useGreekInsight(
    reference: string,
    tokens: readonly GreekWordToken[] | undefined,
    /**
     * El versículo anterior, para que el análisis pueda ver la ANÁFORA: el
     * artículo que abre Santiago 1:4 señala al v.3, y eso es indetectable
     * mirando un solo versículo.
     */
    previousVerse?: { reference: string; text: string },
    /** Las filas de «Estructura»: el análisis trae la lectura de cada una (G1 + G5). */
    structure?: readonly StructureNode[] | null,
    /** Los verbos con sus funciones posibles (G2): el análisis trae la de cada uno. */
    verbs?: readonly VerbCandidate[],
    /** Hechos de G3 (agencia, anáfora): el asistente los explica. */
    nominal?: NominalFacts,
    /** G4: partículas y pronombres explícitos. */
    discourse?: readonly DiscourseCandidate[],
) {
    const repoRef = useRef<FirestoreGreekInsightRepository>();
    if (!repoRef.current) repoRef.current = new FirestoreGreekInsightRepository();
    const serviceRef = useRef<GreekInsightService>();
    if (!serviceRef.current) serviceRef.current = new GreekInsightService();

    const [insight, setInsight] = useState<GreekVerseInsight | null>(null);
    /** El caché no se pudo leer — distinto de "no hay análisis". */
    const [cacheUnavailable, setCacheUnavailable] = useState(false);
    const [checking, setChecking] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** El versículo en pantalla: un resultado que llega después de navegar no se pone en otro. */
    const actualRef = useRef(reference);
    actualRef.current = reference;

    useEffect(() => {
        let vivo = true;
        setInsight(null);
        setError(null);
        setChecking(true);
        setCacheUnavailable(false);
        repoRef.current!.get(reference).then((cached) => {
            if (!vivo) return;
            if (cached === 'unavailable') {
                setCacheUnavailable(true);
            } else if (cached && tokens && cached.words.length === tokens.length) {
                // EL CACHÉ SE VALIDA CONTRA LOS TOKENS: un análisis viejo de
                // otra edición del texto, desalineado, es peor que ninguno.
                setInsight(cached);
            }
            setChecking(false);
        });
        return () => {
            vivo = false;
        };
    }, [reference, tokens]);

    const generate = useCallback(async () => {
        if (!tokens || tokens.length === 0) return;
        setGenerating(true);
        setError(null);
        try {
            const result = await serviceRef.current!.analyzeVerse({ reference, tokens, previousVerse, structure: structure ?? undefined, verbs, nominal, discourse });
            void repoRef.current!.save(result);
            if (actualRef.current === reference) setInsight(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setGenerating(false);
        }
    }, [reference, tokens, previousVerse, structure, verbs, nominal, discourse]);

    return { insight, checking, generating, error, cacheUnavailable, generate };
}
