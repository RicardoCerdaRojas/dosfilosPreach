import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { ReadingBlock } from '@dosfilos/domain';
import { groupUnbreakableBlocks, packPages } from '@dosfilos/domain';

/**
 * Paginación real del púlpito (D7, P1).
 *
 * REGLA DEL MANUSCRITO: la página nunca termina a mitad de oración. Paginar
 * "por sección" no alcanza — un movimiento largo no entra en una pantalla y
 * se sigue scrolleando, que es exactamente lo que rompe la memoria espacial:
 * en una página fija el ojo aprende dónde está cada cosa y el regreso de la
 * mirada es gratis; al scrollear, todo se mueve todo el tiempo.
 *
 * CÓMO. No hay forma de saber cuánto mide un bloque sin renderizarlo, así que
 * se hace una pasada de medición invisible, se guardan las alturas y recién
 * entonces se arman las páginas empaquetando bloques enteros. El bloque es el
 * átomo: nunca se parte, y como los bloques ya vienen cortados en unidades de
 * sentido, ninguna página corta una oración.
 *
 * GRUPOS QUE NO SE SEPARAN. Empaquetar bloques sueltos cortaba donde no debe:
 * una proposición homilética con sus puntos es UNA unidad de lectura, y
 * partirla obliga a pasar página en medio de la idea. `groupUnbreakableBlocks`
 * decide qué va junto; acá se empaquetan grupos, no bloques. Si un grupo no
 * entra en una página vacía se parte igual — mejor cortar donde no queríamos
 * que perder texto.
 *
 * LÍMITE CONOCIDO: si un bloque solo excede el alto disponible —un párrafo de
 * ~150 palabras a 28 pt— ocupa su propia página y esa página se puede
 * scrollear. Es preferible a perder texto, y en prosa de sermón es raro.
 */
export interface Pagination {
    /** Páginas, cada una con los índices de bloque que le tocan. */
    pages: number[][];
    /** `true` mientras faltan alturas por medir. */
    measuring: boolean;
    /** Nodo de medición: montarlo una vez, fuera de la vista. */
    probe: React.ReactNode;
}

interface Options {
    blocks: ReadingBlock[];
    /** Alto útil de la página, ya descontado el tablero inferior. */
    availableHeight: number;
    /** Render de un bloque, el MISMO que usa la página real. */
    renderBlock: (block: ReadingBlock, index: number) => React.ReactNode;
    /**
     * Cambia cuando cambia cualquier cosa que altere las alturas (cuerpo,
     * colometría, sección). Fuerza volver a medir.
     */
    layoutKey: string;
    /**
     * Lo que va arriba de la primera página (título del sermón y del
     * movimiento). Se mide como un bloque más y se descuenta de la primera
     * página (A7): antes no se contaba y esa página se pasaba del alto.
     */
    header?: React.ReactNode;
}

export function usePagination({
    blocks,
    availableHeight,
    renderBlock,
    layoutKey,
    header,
}: Options): Pagination {
    const [heights, setHeights] = useState<Record<string, number[]>>({});
    const [headerHeights, setHeaderHeights] = useState<Record<string, number>>({});

    const measured = heights[layoutKey];
    const headerHeight = header ? headerHeights[layoutKey] : 0;
    // Un movimiento SIN CUERPO (un `##` seguido de otro) es completo de
    // entrada: antes `complete` exigía bloques, la medición no terminaba
    // nunca y la página quedaba invisible, título incluido (A7).
    const bodyMeasured =
        blocks.length === 0 || (measured?.length === blocks.length && measured.every((h) => h > 0));
    const complete = bodyMeasured && headerHeight !== undefined;

    const onMeasured = useCallback(
        (index: number, height: number) => {
            setHeights((current) => {
                const forKey = current[layoutKey] ? [...current[layoutKey]] : [];
                if (forKey[index] === height) return current;
                forKey[index] = height;
                return { ...current, [layoutKey]: forKey };
            });
        },
        [layoutKey],
    );

    const pages = useMemo(() => {
        if (!complete || availableHeight <= 0 || blocks.length === 0) return [];
        return packPages(
            groupUnbreakableBlocks(blocks),
            measured,
            availableHeight,
            availableHeight - (headerHeight ?? 0),
        );
    }, [blocks, measured, complete, availableHeight, headerHeight]);

    const probe = complete ? null : (
        <View
            // Fuera de la vista pero con el ancho real: medir a otro ancho
            // daría otro alto y las páginas saldrían mal cortadas.
            style={{ position: 'absolute', opacity: 0, left: 0, right: 0 }}
            pointerEvents="none"
        >
            {header ? (
                <View
                    key={`${layoutKey}-header`}
                    onLayout={(e) => {
                        const h = e.nativeEvent.layout.height;
                        setHeaderHeights((cur) => (cur[layoutKey] === h ? cur : { ...cur, [layoutKey]: h }));
                    }}
                >
                    {header}
                </View>
            ) : null}
            {blocks.map((block, index) => (
                <View
                    key={`${layoutKey}-${index}`}
                    onLayout={(e) => onMeasured(index, e.nativeEvent.layout.height)}
                >
                    {renderBlock(block, index)}
                </View>
            ))}
        </View>
    );

    return { pages, measuring: !complete, probe };
}
