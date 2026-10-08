import type React from 'react';
import { segmentGreekWord, type GreekMorphLayer, type GreekWordToken } from '@dosfilos/domain';
import type { GreekColorMode } from './GreekVerseTools';

/** Capa 1: color de la palabra ENTERA por su categoría. */
export const POS_COLOR: Record<GreekWordToken['pos'], string> = {
    V: 'text-primary',
    N: 'text-info',
    A: 'text-warning',
    RA: 'text-muted-foreground',
    RP: 'text-success',
    RR: 'text-success',
    RD: 'text-success',
    RI: 'text-success',
    // FALTABAN LAS PALABRAS DE ENLACE, y son las que articulan el argumento:
    // καί, ἵνα y ἐν quedaban del color base, indistinguibles de "sin
    // clasificar" — el fundador las marcó en su captura. Una capa de
    // categorías que deja fuera una categoría no es una capa: es un descuido
    // con leyenda.
    C: 'text-destructive',
    P: 'text-accent-foreground',
    D: 'text-foreground/70',
    X: 'text-destructive/70',
    I: 'text-destructive/70',
};

/** Capa 2: color del MORFEMA según su función. La raíz queda en el color base. */
export const LAYER_COLOR: Record<GreekMorphLayer, string> = {
    stem: '',
    caseEnding: 'text-info',
    tenseMarker: 'text-warning',
    moodMarker: 'text-success',
    augment: 'text-primary',
};


/** La palabra según la capa activa (categorías o morfemas). Sin capa: texto plano. */
export function pintarPalabraGriega(tok: GreekWordToken, colorMode: GreekColorMode): React.ReactNode {
    if (colorMode === 'pos') {
        return <span className={POS_COLOR[tok.pos]}>{tok.text}</span>;
    }
    if (colorMode === 'morph') {
        // Honestidad heredada del segmentador: la palabra sin marca
        // confirmada queda entera en el color base.
        return segmentGreekWord(tok).map((seg, j) => (
            <span key={j} className={LAYER_COLOR[seg.layer]}>
                {seg.text}
            </span>
        ));
    }
    return tok.text;
}
