import { useState } from 'react';
import type { PhraseKind, VersePhrase } from '@dosfilos/domain';

/**
 * U11b (revisión del profesor, Stg 2:16 ἐξ ὑμῶν, 2:21 ἐξ ἔργων: «¿un interruptor para marcarlas?»):
 * cómo se subraya una frase preposicional de MACULA. La forma de la línea dice la clase, no sólo el
 * color: CONTINUA si va con el verbo (adverbial o predicado), PUNTEADA si va con un nombre.
 * Las mismas clases en la palabra y en la leyenda.
 */
export const SUBRAYADO_FRASE: Readonly<Record<PhraseKind, string>> = {
    a: 'underline decoration-primary decoration-2 underline-offset-[6px]',
    p: 'underline decoration-primary decoration-2 underline-offset-[6px]',
    n: 'underline decoration-primary decoration-dashed decoration-2 underline-offset-[6px]',
};

/** Palabra («verso!n») → la clase de la frase que la contiene. */
export function frasePorRef(frases: readonly VersePhrase[]): ReadonlyMap<string, PhraseKind> {
    const m = new Map<string, PhraseKind>();
    for (const f of frases) for (const r of f.rs) m.set(r, f.kind);
    return m;
}

/** Posición en el versículo → clase de su frase (para la banda del versículo, alineada por posición). */
export function frasePorOrdinal(palabras: readonly { r: string }[], frases: readonly VersePhrase[]): ReadonlyMap<number, PhraseKind> {
    const porRef = frasePorRef(frases);
    const m = new Map<number, PhraseKind>();
    palabras.forEach((w, i) => { const k = porRef.get(w.r); if (k) m.set(i, k); });
    return m;
}

/** El interruptor «Frases», recordado en este navegador. Apagado por defecto. */
export function useFrasesVisibles(clave: string): [boolean, () => void] {
    const [visibles, setVisibles] = useState<boolean>(() => {
        try { return localStorage.getItem(clave) === '1'; } catch { return false; }
    });
    const alternar = () => setVisibles(v => {
        try { localStorage.setItem(clave, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
        return !v;
    });
    return [visibles, alternar];
}

/**
 * La sangría máxima de una fila de «Estructura», en las tarjetas y en el Diagrama: más no cabe en un teléfono
 * y la jerarquía se sigue leyendo. Medido (2026-11-13): ninguna fila del NT ni del AT pasa de 5 niveles sobre
 * la primera. El Diagrama suma uno para la línea «└» de la frase que cuelga del verbo.
 */
export const MAX_SANGRIA_FILAS = 5;
