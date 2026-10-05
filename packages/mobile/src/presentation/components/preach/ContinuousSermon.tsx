import React from 'react';
import { View } from 'react-native';
import type { OutlineItem, ReadingBlock } from '@dosfilos/domain';

import type { ReadingModeTokens } from '@/core/theme/readingModes';
import type { DeliveryFace } from '@/core/theme/typography';
import type { SermonSection } from '@/core/utils/sermonSections';
import { PreachOutline } from './PreachOutline';
import { PreachSectionBody, type ResolvedGlyph, type ResolvedHighlight } from './PreachSectionBody';
import type { SelectionRange } from './SelectableParagraph';

const NONE: never[] = [];

export interface ContinuousSection {
    section: SermonSection;
    blocks: ReadingBlock[];
    /** Bosquejo del movimiento, si se lee en bosquejo. */
    outline?: OutlineItem[];
    /** Índice de su primer bloque en el sermón entero (para el foco). */
    firstBlock: number;
}

interface Props {
    sections: ContinuousSection[];
    /** La Lectura, antes del primer movimiento, si la hay. */
    reading: React.ReactNode;
    /** Título del sermón y del movimiento: el mismo encabezado que en páginas. */
    headerFor: (index: number) => React.ReactNode;
    /** Al pie: las atribuciones. */
    footer: React.ReactNode;
    outline: boolean;
    tokens: ReadingModeTokens;
    fontSize: number;
    face: DeliveryFace;
    senseLines: boolean;
    hangingIndent: boolean;
    collapseQuotes: boolean;
    /** Marcas ya resueltas de cada movimiento. */
    highlights: Record<string, ResolvedHighlight[]>;
    glyphs: Record<string, ResolvedGlyph[]>;
    /** La selección en curso, y en qué movimiento. */
    selection: { slug: string; range: SelectionRange } | null;
    onSelectionChange: (slug: string, range: SelectionRange | null) => void;
    onSelectionEnd: (slug: string, range: SelectionRange, atY: number) => void;
    onTapAt: (pageX: number) => void;
    onPressCitation: (ordinals: number[]) => void;
    onPressReference: (reference: string) => void;
    onPressApparatus: (text: string) => void;
    /** Dónde está cada oración en pantalla, para anclar la tinta. */
    onUnitLayout: (slug: string, sourceStart: number, rect: { x: number; y: number; height: number }) => void;
    layoutKey: string;
    /** Foco de lectura: ¿va atenuado este bloque? (índice en el sermón entero). */
    isBlockDimmed?: (globalIndex: number) => boolean;
    /** Dónde empieza cada movimiento, medido desde el comienzo de esta vista. */
    onSectionTop: (index: number, y: number) => void;
    /** Dónde empieza cada bloque, medido desde el comienzo de su movimiento. */
    onBlockTop?: (slug: string, index: number, y: number) => void;
}

/**
 * El sermón entero como UN documento (fase «Atril continuo»): la Lectura, y
 * cada movimiento con su título, uno debajo del otro. Lo que en páginas se
 * mostraba de a tramos acá va completo; el atril lo desplaza.
 *
 * Cada movimiento sigue siendo SUYO: sus marcas y su tinta se anclan a su
 * propio cuerpo, como en páginas, así que cambiar de modo no mueve nada.
 */
export const ContinuousSermon = React.memo(function ContinuousSermon({
    sections,
    reading,
    headerFor,
    footer,
    outline,
    tokens,
    fontSize,
    face,
    senseLines,
    hangingIndent,
    collapseQuotes,
    highlights,
    glyphs,
    selection,
    onSelectionChange,
    onSelectionEnd,
    onTapAt,
    onPressCitation,
    onPressReference,
    onPressApparatus,
    onUnitLayout,
    layoutKey,
    isBlockDimmed,
    onSectionTop,
    onBlockTop,
}: Props) {
    return (
        <View>
            {reading}
            {sections.map(({ section, blocks, outline: items, firstBlock }, index) => (
                <View
                    key={section.slug}
                    testID={`continuous-${section.slug}`}
                    onLayout={(e) => onSectionTop(index, e.nativeEvent.layout.y)}
                    // Aire entre movimientos: el título de uno no queda pegado
                    // al último párrafo del anterior.
                    style={{ paddingTop: index === 0 && !reading ? 0 : fontSize * 1.2 }}
                >
                    {headerFor(index)}
                    {outline ? (
                        <PreachOutline items={items ?? []} tokens={tokens} fontSize={fontSize} face={face} onTapAt={onTapAt} />
                    ) : (
                        <PreachSectionBody
                            blocks={blocks}
                            isBlockDimmed={isBlockDimmed ? (i) => isBlockDimmed(firstBlock + i) : undefined}
                            collapseQuotes={collapseQuotes}
                            highlights={highlights[section.slug] ?? NONE}
                            glyphs={glyphs[section.slug] ?? NONE}
                            fontSize={fontSize}
                            tokens={tokens}
                            senseLines={senseLines}
                            face={face}
                            hangingIndent={hangingIndent}
                            onBlockLayout={(start, rect) => onUnitLayout(section.slug, start, rect)}
                            layoutKey={layoutKey}
                            onTapAt={onTapAt}
                            onPressApparatus={onPressApparatus}
                            selection={selection?.slug === section.slug ? selection.range : null}
                            onSelectionChange={(range) => onSelectionChange(section.slug, range)}
                            onSelectionEnd={(range, y) => onSelectionEnd(section.slug, range, y)}
                            onPressCitation={onPressCitation}
                            onPressReference={onPressReference}
                            onBlockTop={onBlockTop ? (i, y) => onBlockTop(section.slug, i, y) : undefined}
                        />
                    )}
                </View>
            ))}
            {footer}
        </View>
    );
});
