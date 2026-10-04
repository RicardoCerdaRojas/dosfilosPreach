import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { HighlightColor, MarkStyle, ReadingBlock, ReadingUnit } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import type { DeliveryFace } from '@/core/theme/typography';
import {
    DELIVERY_LINE_HEIGHT,
    FACE_CLASS,
    HANGING_INDENT_EM,
    PARAGRAPH_GAP_EM,
    TYPE_SCALE,
} from '@/core/theme/typography';
import { SelectableParagraph, SelectionRange } from './SelectableParagraph';

/** Marca ya reanclada al cuerpo crudo de ESTA sección. */
export interface ResolvedHighlight {
    id: string;
    color: HighlightColor;
    style: MarkStyle;
    start: number;
    end: number;
}

interface Props {
    blocks: ReadingBlock[];
    highlights: ResolvedHighlight[];
    fontSize: number;
    tokens: ReadingModeTokens;
    /** Colometría: cada oración abre renglón, con sangría francesa (D6). */
    senseLines: boolean;
    /** Selección en curso, para pintarla mientras el dedo se mueve. */
    selection: SelectionRange | null;
    onSelectionChange: (range: SelectionRange | null) => void;
    onSelectionEnd: (range: SelectionRange, atY: number) => void;
    /** Tap sobre el texto: la navegación por zonas ⅓ sigue viva encima del cuerpo. */
    onTapAt: (pageX: number) => void;
    onPressCitation: (ordinals: number[]) => void;
    /** Tocar una referencia bíblica del manuscrito (C7). */
    onPressReference?: (reference: string) => void;
    /** Abre una cita de bloque colapsada (aparato de estudio, P5). */
    onPressApparatus: (text: string) => void;
    /** Familia de entrega elegida por el predicador. */
    face: DeliveryFace;
    /** Sangría francesa encendida. Preferencia, no ajuste con respuesta única. */
    hangingIndent: boolean;
    /**
     * Posición de cada BLOQUE en pantalla, para anclar la tinta.
     *
     * Antes se reportaba palabra por palabra. Eran cientos de entradas por
     * página y dependía de que `onLayout` volviera a dispararse para cada una
     * — cosa que RN sólo hace si la vista efectivamente se movió. Al apagar el
     * tercio inferior, por ejemplo, las palabras de arriba no se mueven, así
     * que nadie re-reportaba y la tinta se quedaba sin dónde dibujarse. Con
     * bloques son unos pocos por página y el ancla es igual de significativa:
     * la nota vive al lado de SU párrafo.
     */
    onBlockLayout?: (sourceStart: number, rect: { x: number; y: number; height: number }) => void;
    /**
     * Firma del layout vigente. Cuando cambia, los bloques se vuelven a MEDIR
     * a mano en vez de esperar a `onLayout`.
     *
     * Esperar era el bug: RN sólo dispara `onLayout` de una vista que
     * efectivamente se movió. Al apagar el tercio inferior los párrafos de
     * arriba se quedan quietos, así que reportaban unos pocos y no los demás,
     * y la tinta quedaba a medias — trazos que desaparecen, trazos que se
     * corren. Medir explícitamente no deja a nadie sin posición.
     */
    layoutKey?: string;
}

/** Marca que cubre un punto del cuerpo crudo. La unidad ahora es la palabra. */
function highlightAt(
    sourceStart: number,
    highlights: ResolvedHighlight[],
): ResolvedHighlight | null {
    return highlights.find((h) => sourceStart >= h.start && sourceStart < h.end) ?? null;
}

export function PreachSectionBody({
    blocks,
    highlights,
    fontSize,
    tokens,
    senseLines,
    selection,
    onSelectionChange,
    onSelectionEnd,
    onTapAt,
    onPressCitation,
    onPressReference,
    onPressApparatus,
    face,
    hangingIndent,
    onBlockLayout,
    layoutKey,
}: Props) {
    /** Vista de cada bloque, para poder medirla sin depender de `onLayout`. */
    const blockNodes = useRef<Map<number, View>>(new Map());

    useEffect(() => {
        if (!onBlockLayout) return;
        // En el frame siguiente: al correr el efecto, el layout nativo puede
        // no haber bajado todavía y se mediría la posición vieja.
        const frame = requestAnimationFrame(() => {
            for (const [offset, node] of blockNodes.current.entries()) {
                node.measureInWindow((x, y, _width, height) => {
                    onBlockLayout(offset, { x, y, height });
                });
            }
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutKey, blocks]);
    /**
     * Traduce las marcas guardadas al trazo que le toca a cada palabra.
     * En tinta electrónica el color no existe, así que toda marca cae a
     * subrayado — es la degradación honesta, no un bug.
     */
    const styleAt = (at: number) => {
        const mark = highlightAt(at, highlights);
        if (!mark) return null;
        if (tokens.highlightUnderline) {
            return { underline: mark.style !== 'strike', strike: mark.style === 'strike' };
        }
        return {
            background: mark.style === 'highlight' ? tokens.highlightColors[mark.color] : undefined,
            underline: mark.style === 'underline',
            strike: mark.style === 'strike',
        };
    };

    const paragraph = (units: ReadingUnit[], key: React.Key, style?: object) => (
        <View
            key={key}
            style={style}
            ref={(node) => {
                const first = units[0];
                if (!first || !node) return;
                blockNodes.current.set(first.sourceStart, node);
                return () => {
                    blockNodes.current.delete(first.sourceStart);
                };
            }}
            onLayout={(e) => {
                const first = units[0];
                if (!first || !onBlockLayout) return;
                e.currentTarget.measureInWindow((x, y, _width, height) => {
                    onBlockLayout(first.sourceStart, { x, y, height });
                });
            }}
        >
            <SelectableParagraph
                units={units}
                fontSize={fontSize}
                lineHeight={fontSize * DELIVERY_LINE_HEIGHT}
                color={tokens.textPrimary}
                selection={selection}
                selectionColor={tokens.selection}
                styleAt={styleAt}
                onSelectionChange={onSelectionChange}
                onSelectionEnd={onSelectionEnd}
                onTapAt={onTapAt}
                onPressCitation={onPressCitation}
                onPressReference={onPressReference}
                referenceColor={tokens.accent}
                faceClass={FACE_CLASS[face].regular}
                hangingIndent={hangingIndent ? fontSize * HANGING_INDENT_EM : 0}
            />
        </View>
    );

    return (
        <>
            {blocks.map((block, blockIndex) =>
                block.kind === 'quote' ? (
                    // P5 — el aparato de estudio se colapsa a una marca al
                    // margen. Es el comentario que se leyó el martes: en el
                    // púlpito ocupaba una pantalla entera de algo que nadie
                    // va a decir en voz alta.
                    <TouchableOpacity
                        key={blockIndex}
                        onPress={() => onPressApparatus(block.text)}
                        accessibilityRole="button"
                        accessibilityLabel={block.text}
                        className="flex-row items-center"
                        style={{
                            borderLeftWidth: 2,
                            borderLeftColor: tokens.border,
                            paddingLeft: fontSize * 0.4,
                            paddingVertical: fontSize * 0.25,
                            marginBottom: fontSize * PARAGRAPH_GAP_EM,
                        }}
                    >
                        <MaterialIcons
                            name="format-quote"
                            size={fontSize * TYPE_SCALE.apparatus}
                            color={tokens.textSecondary}
                        />
                        <Text
                            numberOfLines={1}
                            style={{
                                color: tokens.textSecondary,
                                fontSize: fontSize * TYPE_SCALE.apparatus,
                                marginLeft: fontSize * 0.25,
                                flex: 1,
                            }}
                            className="font-lexend"
                        >
                            {block.text}
                        </Text>
                    </TouchableOpacity>
                ) : block.kind === 'listitem' ? (
                    <View
                        key={blockIndex}
                        className="flex-row"
                        style={{ marginBottom: fontSize * 0.45 }}
                    >
                        <Text
                            style={{
                                color: tokens.textPrimary,
                                fontSize,
                                lineHeight: fontSize * DELIVERY_LINE_HEIGHT,
                                width: fontSize * 1.1,
                            }}
                            className={FACE_CLASS[face].regular}
                        >
                            {'•'}
                        </Text>
                        <View style={{ flex: 1 }}>{paragraph(block.units, 'li')}</View>
                    </View>
                ) : block.kind === 'subheading' ? (
                    <Text
                        key={blockIndex}
                        style={{
                            color: tokens.textSecondary,
                            fontSize: fontSize * TYPE_SCALE.movementTitle,
                            marginTop: fontSize * 0.6,
                            marginBottom: fontSize * 0.4,
                        }}
                        className={`${FACE_CLASS[face].semibold} uppercase tracking-wide`}
                    >
                        {block.text}
                    </Text>
                ) : senseLines ? (
                    // Colometría con sangría francesa: la oración abre en el
                    // margen y sus continuaciones entran, así el ojo que vuelve
                    // del público distingue de un golpe el comienzo de una
                    // frase de su continuación. RN no tiene text-indent
                    // negativo: de ahí el padding con margen negativo.
                    <View key={blockIndex} style={{ marginBottom: fontSize * PARAGRAPH_GAP_EM }}>
                        {block.units.map((unit, unitIndex) =>
                            paragraph([unit], unitIndex, { marginBottom: fontSize * 0.12 }),
                        )}
                    </View>
                ) : (
                    paragraph(block.units, blockIndex, {
                        marginBottom: fontSize * PARAGRAPH_GAP_EM,
                    })
                ),
            )}
        </>
    );
}
