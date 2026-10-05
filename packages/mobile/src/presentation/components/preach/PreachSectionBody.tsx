import React from 'react';
import { Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useCallback, useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import type { HighlightColor, MarkStyle, PreacherGlyph, ReadingBlock, ReadingUnit, UnitMetric } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { GLYPH_SYMBOL } from '@/core/theme/preacherGlyphs';
import type { DeliveryFace } from '@/core/theme/typography';
import {
    DELIVERY_LINE_HEIGHT,
    FACE_CLASS,
    FACE_FAMILY,
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
    /** Citas plegadas a un renglón (opción). Por defecto se leen completas. */
    collapseQuotes?: boolean;
    /**
     * Dónde empieza cada bloque, medido desde el contenedor (el documento
     * continuo: un toque en el costado deja arriba un comienzo).
     */
    onBlockTop?: (index: number, y: number) => void;
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
    collapseQuotes = false,
    onBlockTop,
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

    // Qué se muestra, como texto: `blocks` es un arreglo nuevo en cada render
    // (el reloj re-renderiza cada segundo) y no sirve de dependencia.
    const blocksKey = blocks.map((b) => `${b.units[0]?.sourceStart ?? -1}:${b.units.length}`).join(',');
    useEffect(() => {
        if (!onBlockLayout) return;
        // En el frame siguiente: al correr el efecto, el layout nativo puede
        // no haber bajado todavía y se mediría la posición vieja.
        const frame = requestAnimationFrame(() => {
            for (const [first, node] of blockNodes.current.entries()) reportParagraph(first, node);
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutKey, blocksKey]);

    /** Lo que cada párrafo informa al montarse y al desmontarse. */
    const registry: ParagraphRegistry = {
        attach: (first, node) => blockNodes.current.set(first, node),
        setUnits: (first, units) => paragraphUnits.current.set(first, units),
        detach: (first) => {
            blockNodes.current.delete(first);
            paragraphUnits.current.delete(first);
            paragraphLines.current.delete(first);
            paragraphY.current.delete(first);
        },
    };

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

    const paragraph = (units: ReadingUnit[], key: React.Key, style?: object, continued = false, verseNumbers = false) => (
        <MeasuredParagraph
            key={key}
            units={units}
            registry={registry}
            style={style}
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
                faceFamilies={FACE_FAMILY[face]}
                hangingIndent={hangingIndent ? fontSize * HANGING_INDENT_EM : 0}
                continued={continued}
                verseNumbers={verseNumbers}
                verseNumberColor={tokens.textSecondary}
                onUnitLines={(lines) => {
                    const first = units[0];
                    if (!first) return;
                    paragraphLines.current.set(first.sourceStart, lines);
                    reportBlockMetrics();
                    const node = blockNodes.current.get(first.sourceStart);
                    if (node) reportParagraph(first.sourceStart, node);
                }}
            />
        </MeasuredParagraph>
    );

    return (
        <>
            {blocks.map((block, blockIndex) => {
                const rendered = block.kind === 'quote' && !collapseQuotes ? (
                    // La cita COMPLETA, como texto de lectura. En el manuscrito
                    // del pastor la cita al comienzo de un punto es la Escritura
                    // que se lee en voz alta; plegarla obligaba a tocar, leer en
                    // una capa y cerrar justo al empezar el punto (lo vio el
                    // fundador). Con filete del acento, y resaltado y tinta como
                    // cualquier párrafo.
                    <View
                        key={blockIndex}
                        style={{
                            borderLeftWidth: 3,
                            borderLeftColor: tokens.accent,
                            paddingLeft: fontSize * 0.6,
                            marginBottom: fontSize * PARAGRAPH_GAP_EM,
                        }}
                    >
                        {paragraph(block.units, 'q', undefined, block.continued, !!block.scripture)}
                    </View>
                ) : block.kind === 'quote' ? (
                    // Plegada (opción): el aparato de estudio de P5, para quien
                    // usa las citas como notas que no se dicen en voz alta.
                    <TouchableOpacity
                        key={blockIndex}
                        onPress={() => onPressApparatus(block.text)}
                        accessibilityRole="button"
                        accessibilityLabel={block.text.replace(/\n/g, ' ')}
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
                            {block.text.replace(/\n/g, ' · ')}
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
                if (!isBlockDimmed && !onBlockTop) return rendered;
                return (
                    <View
                        key={`focus-${blockIndex}`}
                        onLayout={onBlockTop ? (e) => onBlockTop(blockIndex, e.nativeEvent.layout.y) : undefined}
                        style={{ opacity: isBlockDimmed?.(blockIndex) ? DIMMED_OPACITY : 1 }}
                    >
                        {rendered}
                    </View>
                );
            })}
        </>
    );
}

interface ParagraphRegistry {
    attach: (first: number, node: View) => void;
    setUnits: (first: number, units: ReadingUnit[]) => void;
    detach: (first: number) => void;
}

/**
 * La vista de un párrafo, con un callback de ref ESTABLE.
 *
 * En React 19 un ref en línea se limpia y se vuelve a llamar en cada render.
 * Esa limpieza borraba los renglones de cada oración, que no vuelven a llegar
 * porque `onLayout` no se repite: la tinta caía al párrafo entero (revisión
 * adversarial de «Atril: tinta y lectura»). Acá el callback cambia sólo si
 * cambia el párrafo.
 */
function MeasuredParagraph({
    units,
    registry,
    style,
    onLayout,
    children,
}: {
    units: ReadingUnit[];
    registry: ParagraphRegistry;
    style?: object;
    onLayout: (e: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const first = units[0]?.sourceStart;
    const latest = useRef(registry);
    useEffect(() => {
        latest.current = registry;
    });
    useEffect(() => {
        if (first !== undefined) latest.current.setUnits(first, units);
    }, [first, units]);
    const ref = useCallback(
        (node: View | null) => {
            if (first === undefined || !node) return;
            latest.current.attach(first, node);
            latest.current.setUnits(first, units);
            return () => latest.current.detach(first);
        },
        // Sólo cuando cambia el párrafo: las oraciones se actualizan aparte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [first],
    );
    return (
        <View ref={ref} style={style} onLayout={onLayout}>
            {children}
        </View>
    );
}
