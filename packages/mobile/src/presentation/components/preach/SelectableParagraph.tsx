import React, { useRef } from 'react';
import { GestureResponderEvent, LayoutRectangle, Text, View } from 'react-native';
import type { ReadingUnit } from '@dosfilos/domain';
import { findBibleReferences, splitWords } from '@dosfilos/domain';

import { tokenizeCitations } from '@/core/utils/sermonSections';

/** Una palabra con su rango en el cuerpo CRUDO y su rectángulo en pantalla. */
interface PlacedWord {
    text: string;
    sourceStart: number;
    sourceEnd: number;
    /** Marcadores `[N]` que contiene, si es que la palabra es uno. */
    ordinals: number[] | null;
    /** La referencia bíblica de la que es parte («Jonás 4:2»), si alguna. */
    reference: string | null;
}

/** Umbral del long press propio. El de RN son ~500 ms y no se puede bajar. */
const LONG_PRESS_MS = 240;

export interface SelectionRange {
    start: number;
    end: number;
}

interface Props {
    units: ReadingUnit[];
    fontSize: number;
    lineHeight: number;
    color: string;
    /** Rango en curso, para pintar la selección mientras el dedo se mueve. */
    selection: SelectionRange | null;
    /** Estilo por palabra ya resuelto desde las marcas guardadas. */
    styleAt: (sourceStart: number) => { background?: string; underline?: boolean; strike?: boolean } | null;
    /**
     * Marca de predicador sobre la palabra que EMPIEZA en este rango (C7), o
     * `null`. Se dibuja encima, sin ocupar lugar: la paginación no cambia.
     */
    glyphAt?: (sourceStart: number, sourceEnd: number) => string | null;
    glyphColor?: string;
    onSelectionChange: (range: SelectionRange | null) => void;
    onSelectionEnd: (range: SelectionRange, atY: number) => void;
    onTapAt: (pageX: number) => void;
    onPressCitation: (ordinals: number[]) => void;
    /**
     * Tocar una referencia bíblica del manuscrito muestra el versículo sin
     * salir de la página (C7). Antes sólo había el botón de la cabecera, que
     * abría la primera referencia del sermón.
     */
    onPressReference?: (reference: string) => void;
    /** Color de las referencias que se pueden tocar. */
    referenceColor?: string;
    selectionColor: string;
    /** Clase de NativeWind de la familia elegida (font-lexend, font-literata…). */
    faceClass: string;
    /**
     * Sangría francesa, en unidades del cuerpo: la primera línea arranca en el
     * margen y las siguientes entran. Marca dónde EMPIEZA cada párrafo, que es
     * lo que el ojo busca al volver del público.
     */
    hangingIndent?: number;
}

/**
 * Párrafo con selección POR PALABRA (arrastrando el dedo).
 *
 * POR QUÉ SE RENDERIZA PALABRA POR PALABRA. En React Native un `<Text>`
 * anidado no es una vista: no reporta `onLayout` y no se puede saber dónde
 * cayó cada palabra en pantalla. Sin esa geometría no hay forma de resolver
 * qué se está seleccionando mientras el dedo se mueve. Por eso cada palabra
 * es una `<View>` en una fila que envuelve — se paga en cantidad de nodos y
 * se gana lo único que el pastor pidió: ver lo que está por marcar antes de
 * marcarlo.
 *
 * El espacio entre palabras va DENTRO de cada palabra (marginRight), no como
 * nodo aparte: así la selección no puede quedar "entre" dos palabras.
 */
export function SelectableParagraph({
    units,
    fontSize,
    lineHeight,
    color,
    selection,
    styleAt,
    glyphAt,
    glyphColor,
    onSelectionChange,
    onSelectionEnd,
    onTapAt,
    onPressCitation,
    onPressReference,
    referenceColor,
    selectionColor,
    faceClass,
    hangingIndent = 0,
}: Props) {
    const rects = useRef<Map<number, LayoutRectangle>>(new Map());
    const anchor = useRef<PlacedWord | null>(null);
    const container = useRef<View | null>(null);
    /**
     * Origen del contenedor en coordenadas de PANTALLA.
     *
     * Hace falta porque los rectángulos de las palabras llegan relativos al
     * contenedor, mientras que el toque sólo trae `pageX/pageY` fiables. Usar
     * `locationX/locationY` fue el bug: en RN son relativas al elemento que
     * recibió el toque —cada palabra es su propia vista—, así que al arrastrar
     * llegaban valores casi en cero y la búsqueda resolvía siempre la primera
     * palabra del párrafo. De ahí que seleccionara todo hacia atrás.
     */
    const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressStart = useRef<{ x: number; y: number } | null>(null);

    const words: PlacedWord[] = [];
    units.forEach((unit) => {
        const references = onPressReference ? findBibleReferences(unit.text) : [];
        splitWords(unit.text).forEach((w) => {
            const tokens = tokenizeCitations(w.text);
            const citation = tokens.find((t) => t.kind === 'citation');
            const reference = references.find((r) => w.start < r.end && w.end > r.start);
            words.push({
                text: w.text,
                sourceStart: unit.sourceStart + w.start,
                sourceEnd: unit.sourceStart + w.end,
                ordinals: citation && citation.kind === 'citation' ? citation.ordinals : null,
                reference: reference?.reference ?? null,
            });
        });
    });

    const wordAt = (pageX: number, pageY: number): PlacedWord | null => {
        const x = pageX - origin.current.x;
        const y = pageY - origin.current.y;
        let closest: PlacedWord | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const [index, rect] of rects.current.entries()) {
            const word = words[index];
            if (!word) continue;
            if (y < rect.y || y > rect.y + rect.height) continue;
            // Dentro del renglón, la palabra más cercana en X. Así el dedo no
            // tiene que caer exacto: en el atril nunca cae exacto.
            const distance = Math.abs(x - (rect.x + rect.width / 2));
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = word;
            }
        }
        return closest;
    };

    const rangeBetween = (a: PlacedWord, b: PlacedWord): SelectionRange => ({
        start: Math.min(a.sourceStart, b.sourceStart),
        end: Math.max(a.sourceEnd, b.sourceEnd),
    });

    // Props de responder en crudo, no PanResponder: crearlo con useRef obliga a
    // leer `.current` durante el render, que el compilador de React prohíbe.
    // Así los handlers son funciones normales y ven las palabras de este
    // render, sin refs de por medio.
    const cancelPress = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
        pressStart.current = null;
    };

    /**
     * Long press propio en vez del de `Text`: el de RN tarda ~500 ms y no se
     * puede bajar. A 240 ms el gesto se siente inmediato y sigue sin dispararse
     * por un roce.
     */
    const handleTouchStart = (e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
        pressStart.current = { x: pageX, y: pageY };
        cancelTimerOnly();
        pressTimer.current = setTimeout(() => {
            const word = wordAt(pageX, pageY);
            if (!word) return;
            anchor.current = word;
            onSelectionChange({ start: word.sourceStart, end: word.sourceEnd });
        }, LONG_PRESS_MS);
    };

    const cancelTimerOnly = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
    };

    const handleTouchMove = (e: GestureResponderEvent) => {
        // Si el dedo se fue antes de que prendiera la selección, era un swipe
        // o un scroll: se cancela para no robarle el gesto a la navegación.
        if (anchor.current || !pressStart.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const moved =
            Math.abs(pageX - pressStart.current.x) + Math.abs(pageY - pressStart.current.y);
        if (moved > 12) cancelTimerOnly();
    };

    const handleMove = (e: GestureResponderEvent) => {
        if (!anchor.current) return;
        const word = wordAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (word) onSelectionChange(rangeBetween(anchor.current, word));
    };

    const handleRelease = (e: GestureResponderEvent) => {
        cancelPress();
        if (!anchor.current) return;
        const word = wordAt(e.nativeEvent.pageX, e.nativeEvent.pageY) ?? anchor.current;
        const range = rangeBetween(anchor.current, word);
        anchor.current = null;
        onSelectionEnd(range, e.nativeEvent.pageY);
    };

    const handleTerminate = () => {
        cancelPress();
        anchor.current = null;
        onSelectionChange(null);
    };

    return (
        <View
            ref={container}
            className="flex-row flex-wrap"
            style={{ paddingLeft: hangingIndent }}
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
            // Con una selección viva, NO se cede el gesto. Sin esto el swipe
            // de pasar página lo reclama a mitad del arrastre, el párrafo
            // recibe onResponderTerminate y la selección se borra sola: era
            // el bug de "marco una palabra y al avanzar se desmarca todo".
            onResponderTerminationRequest={() => anchor.current === null}
            onResponderMove={handleMove}
            onResponderRelease={handleRelease}
            onResponderTerminate={handleTerminate}
        >
            {words.map((word, index) => {
                const selected =
                    selection !== null &&
                    word.sourceStart >= selection.start &&
                    word.sourceEnd <= selection.end;
                const mark = styleAt(word.sourceStart);
                const glyph = glyphAt?.(word.sourceStart, word.sourceEnd) ?? null;
                return (
                    <View
                        key={index}
                        onLayout={(e) => rects.current.set(index, e.nativeEvent.layout)}
                        style={{
                            backgroundColor: selected
                                ? selectionColor
                                : (mark?.background ?? 'transparent'),
                            // Padding y no margen: el espacio entre palabras
                            // queda DENTRO del fondo, así el resaltado sale
                            // continuo en vez de entrecortado.
                            paddingRight: fontSize * 0.28,
                            // La primera palabra sale de la sangría: es lo que
                            // deja la primera línea afuera y el resto adentro.
                            marginLeft: index === 0 ? -hangingIndent : 0,
                        }}
                    >
                        <Text
                            onPress={(e) => {
                                if (word.ordinals) onPressCitation(word.ordinals);
                                else if (word.reference && onPressReference) onPressReference(word.reference);
                                else onTapAt(e.nativeEvent.pageX);
                            }}
                            suppressHighlighting
                            style={{
                                color: word.ordinals ? undefined : word.reference ? (referenceColor ?? color) : color,
                                fontSize,
                                lineHeight,
                                textDecorationLine: mark?.strike
                                    ? 'line-through'
                                    : mark?.underline
                                      ? 'underline'
                                      : 'none',
                            }}
                            className={faceClass}
                        >
                            {word.text}
                        </Text>
                        {glyph ? (
                            <Text
                                pointerEvents="none"
                                accessible={false}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: -fontSize * 0.42,
                                    fontSize: fontSize * 0.5,
                                    lineHeight: fontSize * 0.6,
                                    color: glyphColor ?? color,
                                }}
                            >
                                {glyph}
                            </Text>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}
