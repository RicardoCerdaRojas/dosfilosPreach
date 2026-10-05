import React, { useRef } from 'react';
import { GestureResponderEvent, LayoutRectangle, Text, View } from 'react-native';
import { splitWords } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { DELIVERY_LINE_HEIGHT, FACE_CLASS } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';
import type { BibleMark } from '@/domain/bible/entities/BibleMark';
import { verseKey } from '@/domain/bible/entities/BibleMark';

/** Una palabra del capítulo, con su dirección: versículo y posición. */
export interface PlacedWord {
    text: string;
    verse: number;
    /** Posición dentro del versículo. Es el ancla de una marca parcial. */
    index: number;
    /** La primera palabra del versículo lleva el número en volado. */
    leading: boolean;
}

/** Selección viva: de una palabra a otra, cruzando versículos si hace falta. */
export interface WordSelection {
    startVerse: number;
    startWord: number;
    endVerse: number;
    endWord: number;
}

/** Umbral del long press propio. El de RN son ~500 ms y no se puede bajar. */
const LONG_PRESS_MS = 240;

interface Props {
    bookId: string;
    chapter: number;
    verses: string[];
    marks: Map<string, BibleMark>;
    tokens: ReadingModeTokens;
    face: DeliveryFace;
    fontSize: number;
    /** Múltiplo de la interlínea base. 1 es la del atril. */
    lineSpacing?: number;
    /** Números de versículo a la vista. Apagados, la página vuelve a prosa. */
    showVerseNumbers?: boolean;
    selection: WordSelection | null;
    onSelectionChange: (selection: WordSelection | null) => void;
    /** Al soltar: el rango final y la Y donde terminó, para el popover. */
    onSelectionEnd: (selection: WordSelection, atY: number) => void;
    /** Posición del primer renglón de cada versículo, para anclar la tinta. */
    onVerseLayout?: (verse: number, rect: { x: number; y: number; height: number }) => void;
    /** Firma del layout vigente: al cambiar, los versículos se vuelven a medir. */
    layoutKey?: string;
}

/** ¿La palabra `(verse, index)` cae dentro del rango? */
function inSelection(verse: number, index: number, s: WordSelection | null): boolean {
    if (!s) return false;
    const after = verse > s.startVerse || (verse === s.startVerse && index >= s.startWord);
    const before = verse < s.endVerse || (verse === s.endVerse && index <= s.endWord);
    return after && before;
}

/** Ordena los extremos: se puede arrastrar hacia atrás. */
function normalize(a: PlacedWord, b: PlacedWord): WordSelection {
    const aFirst = a.verse < b.verse || (a.verse === b.verse && a.index <= b.index);
    const start = aFirst ? a : b;
    const end = aFirst ? b : a;
    return {
        startVerse: start.verse,
        startWord: start.index,
        endVerse: end.verse,
        endWord: end.index,
    };
}

/**
 * El capítulo como PROSA CONTINUA, seleccionable POR PALABRA.
 *
 * POR QUÉ CADA PALABRA ES UNA VISTA. Un `<Text>` anidado no es una vista: no
 * reporta `onLayout` y no se puede saber dónde cayó en pantalla. Sin esa
 * geometría no hay forma de resolver qué se está seleccionando mientras el
 * dedo se mueve. Se paga en cantidad de nodos.
 *
 * LA UNIDAD ES LA PALABRA, NO EL VERSÍCULO. Marcar el versículo entero es lo
 * que hace casi toda app de Biblia, y es demasiado grueso para trabajar: el
 * pastor subraya "y Jehová preparó un gran pez", no los treinta y cuatro
 * versículos donde eso vive. El versículo sigue disponible de un toque, que es
 * el gesto rápido para el caso frecuente.
 *
 * El número de versículo queda tenue y en volado — disponible cuando se lo
 * busca, invisible cuando se lee.
 */
export function SelectableVerses({
    bookId,
    chapter,
    verses,
    marks,
    tokens,
    face,
    fontSize,
    lineSpacing = 1,
    showVerseNumbers = true,
    selection,
    onSelectionChange,
    onSelectionEnd,
    onVerseLayout,
    layoutKey,
}: Props) {
    const rects = useRef<Map<number, LayoutRectangle>>(new Map());
    const anchor = useRef<PlacedWord | null>(null);
    const container = useRef<View | null>(null);
    /**
     * Origen del contenedor en coordenadas de PANTALLA: los rectángulos de las
     * palabras llegan relativos al contenedor y el toque sólo trae `pageX/Y`
     * fiables. `locationX/Y` son relativas a la vista que recibió el toque
     * —cada palabra es la suya—, y usarlas hacía que el arrastre resolviera
     * siempre la primera palabra.
     */
    const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressStart = useRef<{ x: number; y: number } | null>(null);
    /** Vista del primer renglón de cada versículo, para medirla a pedido. */
    const verseNodes = useRef<Map<number, View>>(new Map());

    const words: PlacedWord[] = [];
    verses.forEach((text, position) => {
        const verse = position + 1;
        splitWords(text).forEach((w, index) => {
            words.push({ text: w.text, verse, index, leading: index === 0 });
        });
    });

    // Al cambiar el layout los versículos se vuelven a medir a mano: `onLayout`
    // sólo dispara si la vista se movió, y con eso solo la tinta quedaba a
    // medias. Es el mismo aprendizaje del púlpito.
    React.useEffect(() => {
        if (!onVerseLayout) return;
        const frame = requestAnimationFrame(() => {
            for (const [verse, node] of verseNodes.current.entries()) {
                node.measureInWindow((x, y, _width, height) => {
                    onVerseLayout(verse, { x, y, height });
                });
            }
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutKey, bookId, chapter, fontSize]);

    const wordAt = (pageX: number, pageY: number): PlacedWord | null => {
        const x = pageX - origin.current.x;
        const y = pageY - origin.current.y;
        let closest: PlacedWord | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const [position, rect] of rects.current.entries()) {
            const word = words[position];
            if (!word) continue;
            if (y < rect.y || y > rect.y + rect.height) continue;
            // Dentro del renglón, la palabra más cercana en X: el dedo no tiene
            // que caer exacto.
            const distance = Math.abs(x - (rect.x + rect.width / 2));
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = word;
            }
        }
        return closest;
    };

    const cancelTimerOnly = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
    };

    const cancelPress = () => {
        cancelTimerOnly();
        pressStart.current = null;
    };

    const handleTouchStart = (e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
        // El capítulo se desplaza y `onLayout` no se entera: el origen medido
        // al armar quedaba viejo y un toque largo marcaba otro versículo.
        // Se vuelve a medir en cada toque, antes de que venza la espera.
        container.current?.measureInWindow((x, y) => {
            origin.current = { x, y };
        });
        pressStart.current = { x: pageX, y: pageY };
        cancelTimerOnly();
        pressTimer.current = setTimeout(() => {
            const word = wordAt(pageX, pageY);
            if (!word) return;
            anchor.current = word;
            onSelectionChange(normalize(word, word));
        }, LONG_PRESS_MS);
    };

    const handleTouchMove = (e: GestureResponderEvent) => {
        // Si el dedo se fue antes de que prendiera la selección, era scroll.
        if (anchor.current || !pressStart.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const moved =
            Math.abs(pageX - pressStart.current.x) + Math.abs(pageY - pressStart.current.y);
        if (moved > 12) cancelTimerOnly();
    };

    const handleMove = (e: GestureResponderEvent) => {
        if (!anchor.current) return;
        const word = wordAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (word) onSelectionChange(normalize(anchor.current, word));
    };

    const handleRelease = (e: GestureResponderEvent) => {
        cancelPress();
        if (!anchor.current) return;
        const word = wordAt(e.nativeEvent.pageX, e.nativeEvent.pageY) ?? anchor.current;
        const range = normalize(anchor.current, word);
        anchor.current = null;
        onSelectionEnd(range, e.nativeEvent.pageY);
    };

    const handleTerminate = () => {
        cancelPress();
        anchor.current = null;
        onSelectionChange(null);
    };

    /** Toque simple: el versículo entero, que es el gesto rápido de siempre. */
    const selectWholeVerse = (verse: number, pageY: number) => {
        const last = words.filter((w) => w.verse === verse).length - 1;
        const range: WordSelection = {
            startVerse: verse,
            startWord: 0,
            endVerse: verse,
            endWord: Math.max(0, last),
        };
        onSelectionChange(range);
        onSelectionEnd(range, pageY);
    };

    const lineHeight = fontSize * DELIVERY_LINE_HEIGHT * lineSpacing;

    return (
        <View
            ref={container}
            // Dirección y envoltura POR ESTILO. Con `className` la envoltura
            // podía no aplicarse y entonces cada versículo salía en un solo
            // renglón interminable, corriéndose fuera de la pantalla. Ya nos
            // pasó lo mismo en el rail y en el paralelo: donde el layout es
            // crítico, no se delega.
            style={{ flexDirection: 'row', flexWrap: 'wrap' }}
            onLayout={() =>
                container.current?.measureInWindow((x, y) => {
                    origin.current = { x, y };
                })
            }
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={cancelPress}
            onTouchCancel={cancelPress}
            onStartShouldSetResponder={() => false}
            onMoveShouldSetResponder={() => anchor.current !== null}
            // Con una selección viva NO se cede el gesto: si no, el scroll la
            // reclama a mitad del arrastre y se borra sola.
            onResponderTerminationRequest={() => anchor.current === null}
            onResponderMove={handleMove}
            onResponderRelease={handleRelease}
            onResponderTerminate={handleTerminate}
        >
            {words.map((word, position) => {
                const mark = marks.get(verseKey(bookId, chapter, word.verse));
                // Una marca sin extremos cubre el versículo entero: así se
                // guardaban todas antes de que existiera la marca por palabra.
                const marked =
                    !!mark &&
                    (mark.from === undefined ||
                        (word.index >= mark.from && word.index <= (mark.to ?? mark.from)));
                const isSelected = inSelection(word.verse, word.index, selection);
                return (
                    <View
                        key={position}
                        ref={
                            word.leading
                                ? (node) => {
                                      if (!node) return;
                                      verseNodes.current.set(word.verse, node);
                                      return () => {
                                          verseNodes.current.delete(word.verse);
                                      };
                                  }
                                : undefined
                        }
                        onLayout={(e) => {
                            rects.current.set(position, e.nativeEvent.layout);
                            if (word.leading && onVerseLayout) {
                                e.currentTarget.measureInWindow((x, y, _w, height) =>
                                    onVerseLayout(word.verse, { x, y, height }),
                                );
                            }
                        }}
                        style={{
                            backgroundColor: isSelected
                                ? tokens.selection
                                : marked && mark.style === 'highlight'
                                  ? tokens.highlightColors[mark.color]
                                  : 'transparent',
                            // Padding y no margen: el espacio entre palabras
                            // queda DENTRO del fondo y el resaltado sale
                            // continuo en vez de entrecortado.
                            paddingRight: fontSize * 0.28,
                        }}
                    >
                        <Text
                            onPress={(e) => selectWholeVerse(word.verse, e.nativeEvent.pageY)}
                            suppressHighlighting
                            style={{
                                color: tokens.textPrimary,
                                fontSize,
                                lineHeight,
                                textDecorationLine: !marked
                                    ? 'none'
                                    : mark.style === 'strike'
                                      ? 'line-through'
                                      : mark.style === 'underline' || tokens.highlightUnderline
                                        ? 'underline'
                                        : 'none',
                            }}
                            className={FACE_CLASS[face].regular}
                        >
                            {word.leading && showVerseNumbers ? (
                                <Text
                                    style={{
                                        color: tokens.textSecondary,
                                        fontSize: fontSize * 0.58,
                                        lineHeight,
                                        textDecorationLine: 'none',
                                    }}
                                    className={FACE_CLASS[face].semibold}
                                >
                                    {`${word.verse} `}
                                </Text>
                            ) : null}
                            {word.text}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

/** El texto exacto que abarca una selección, para copiarlo al sermón. */
export function selectionText(verses: string[], selection: WordSelection): string {
    const parts: string[] = [];
    for (let verse = selection.startVerse; verse <= selection.endVerse; verse += 1) {
        const words = splitWords(verses[verse - 1] ?? '').map((w) => w.text);
        const from = verse === selection.startVerse ? selection.startWord : 0;
        const to = verse === selection.endVerse ? selection.endWord : words.length - 1;
        parts.push(words.slice(from, to + 1).join(' '));
    }
    return parts.join(' ').trim();
}
