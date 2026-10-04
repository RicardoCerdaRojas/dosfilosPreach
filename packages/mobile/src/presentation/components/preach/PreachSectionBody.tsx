import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { HighlightColor, MarkStyle, PreacherGlyph, ReadingBlock, ReadingUnit, UnitMetric } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { GLYPH_SYMBOL } from '@/core/theme/preacherGlyphs';
import type { DeliveryFace } from '@/core/theme/typography';
import {
    DELIVERY_LINE_HEIGHT,
    FACE_CLASS,
    HANGING_INDENT_EM,
    PARAGRAPH_GAP_EM,
    TYPE_SCALE,
} from '@/core/theme/typography';
import { SelectableParagraph, SelectionRange, type UnitLines } from './SelectableParagraph';

/** Marca ya reanclada al cuerpo crudo de ESTA sección. */
export interface ResolvedGlyph {
    id: string;
    glyph: PreacherGlyph;
    start: number;
}

export interface ResolvedHighlight {
    id: string;
    color: HighlightColor;
    style: MarkStyle;
    start: number;
    end: number;
}

/** Un bloque, o el tramo de sus oraciones que cae en esta página. */
export type PageBlock = ReadingBlock & { continued?: boolean };

interface Props {
    blocks: PageBlock[];
    highlights: ResolvedHighlight[];
    /** Marcas de predicador ya resueltas (C7): dónde empieza cada una. */
    glyphs?: ResolvedGlyph[];
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
    /**
     * Renglones de cada oración del (único) bloque, medidos desde su borde de
     * arriba. Lo usa la medición fuera de pantalla de la paginación (L-1).
     */
    onUnitMetrics?: (metrics: UnitMetric[]) => void;
    /** Foco de lectura (L-3): los bloques fuera de foco van atenuados. */
    isBlockDimmed?: (index: number) => boolean;
}

/** Cuánto se atenúa lo que no está en foco: se lee, pero no llama la vista. */
const DIMMED_OPACITY = 0.38;

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
    glyphs,
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
    onUnitMetrics,
    isBlockDimmed,
}: Props) {
    /** Vista de cada párrafo (por el comienzo de su primera oración), para medirla sin depender de `onLayout`. */
    const blockNodes = useRef<Map<number, View>>(new Map());
    /** Oraciones de cada párrafo y sus renglones, cuando ya se midieron. */
    const paragraphUnits = useRef<Map<number, ReadingUnit[]>>(new Map());
    const paragraphLines = useRef<Map<number, UnitLines[]>>(new Map());
    /** Dónde está cada párrafo dentro del bloque (colometría: uno por oración). */
    const paragraphY = useRef<Map<number, number>>(new Map());

    /**
     * La tinta se ancla a la ORACIÓN (T-4): con la paginación por oración un
     * párrafo puede seguir en otra página, y una nota anclada al párrafo
     * entero se dibujaba en la página donde el párrafo empieza. Se informa la
     * posición de cada oración: su primer renglón. Las notas viejas, ancladas
     * al comienzo del párrafo, caen en su primera oración, que está en el
     * mismo lugar de siempre.
     */
    const reportParagraph = (first: number, node: View) => {
        if (!onBlockLayout) return;
        node.measureInWindow((x, y, _width, height) => {
            const units = paragraphUnits.current.get(first) ?? [];
            const lines = paragraphLines.current.get(first);
            if (!lines || lines.length !== units.length) {
                onBlockLayout(first, { x, y, height });
                return;
            }
            units.forEach((unit, i) => {
                const line = lines[i]!;
                onBlockLayout(unit.sourceStart, { x, y: y + line.top, height: Math.max(1, line.bottom - line.top) });
            });
        });
    };

    useEffect(() => {
        if (!onBlockLayout) return;
        // En el frame siguiente: al correr el efecto, el layout nativo puede
        // no haber bajado todavía y se mediría la posición vieja.
        const frame = requestAnimationFrame(() => {
            for (const [first, node] of blockNodes.current.entries()) reportParagraph(first, node);
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutKey, blocks]);

    /** Las métricas del bloque para la paginación, cuando están todos sus párrafos. */
    const reportedMetrics = useRef('');
    const reportBlockMetrics = () => {
        if (!onUnitMetrics || blocks.length !== 1) return;
        const firsts = [...paragraphUnits.current.keys()].sort((a, b) => a - b);
        const metrics: UnitMetric[] = [];
        for (const first of firsts) {
            const lines = paragraphLines.current.get(first);
            const top = paragraphY.current.get(first);
            if (!lines || top === undefined) return;
            for (const line of lines) metrics.push({ top: top + line.top, bottom: top + line.bottom });
        }
        if (metrics.length !== blocks[0]!.units.length) return;
        const signature = metrics.map((m) => `${m.top}:${m.bottom}`).join('|');
        if (signature === reportedMetrics.current) return;
        reportedMetrics.current = signature;
        onUnitMetrics(metrics);
    };
    /**
     * Traduce las marcas guardadas al trazo que le toca a cada palabra.
     * En tinta electrónica el color no existe, así que toda marca cae a
     * subrayado — es la degradación honesta, no un bug.
     */
    const glyphAt = (start: number, end: number) => {
        const found = glyphs?.find((g) => g.start >= start && g.start < end);
        return found ? GLYPH_SYMBOL[found.glyph] : null;
    };

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

    const paragraph = (units: ReadingUnit[], key: React.Key, style?: object, continued = false) => (
        <View
            key={key}
            style={style}
            ref={(node) => {
                const first = units[0];
                if (!first || !node) return;
                blockNodes.current.set(first.sourceStart, node);
                paragraphUnits.current.set(first.sourceStart, units);
                return () => {
                    blockNodes.current.delete(first.sourceStart);
                    paragraphUnits.current.delete(first.sourceStart);
                    paragraphLines.current.delete(first.sourceStart);
                    paragraphY.current.delete(first.sourceStart);
                };
            }}
            onLayout={(e) => {
                const first = units[0];
                if (!first) return;
                paragraphY.current.set(first.sourceStart, e.nativeEvent.layout.y);
                reportBlockMetrics();
                const node = blockNodes.current.get(first.sourceStart);
                if (node) reportParagraph(first.sourceStart, node);
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
                glyphAt={glyphAt}
                glyphColor={tokens.accent}
                onSelectionChange={onSelectionChange}
                onSelectionEnd={onSelectionEnd}
                onTapAt={onTapAt}
                onPressCitation={onPressCitation}
                onPressReference={onPressReference}
                referenceColor={tokens.accent}
                faceClass={FACE_CLASS[face].regular}
                hangingIndent={hangingIndent ? fontSize * HANGING_INDENT_EM : 0}
                continued={continued}
                onUnitLines={(lines) => {
                    const first = units[0];
                    if (!first) return;
                    paragraphLines.current.set(first.sourceStart, lines);
                    reportBlockMetrics();
                    const node = blockNodes.current.get(first.sourceStart);
                    if (node) reportParagraph(first.sourceStart, node);
                }}
            />
        </View>
    );

    return (
        <>
            {blocks.map((block, blockIndex) => {
                const rendered = block.kind === 'quote' ? (
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
                            {block.continued ? '' : '•'}
                        </Text>
                        <View style={{ flex: 1 }}>{paragraph(block.units, 'li', undefined, block.continued)}</View>
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
                    paragraph(
                        block.units,
                        blockIndex,
                        { marginBottom: fontSize * PARAGRAPH_GAP_EM },
                        block.continued,
                    )
                );
                if (!isBlockDimmed) return rendered;
                return (
                    <View key={`focus-${blockIndex}`} style={{ opacity: isBlockDimmed(blockIndex) ? DIMMED_OPACITY : 1 }}>
                        {rendered}
                    </View>
                );
            })}
        </>
    );
}
