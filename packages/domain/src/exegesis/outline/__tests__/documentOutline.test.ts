import { describe, expect, it } from 'vitest';
import {
    outlineStructureQuality,
    parseHeadingReference,
    referencesOverlap,
    resolveOutlineReferences,
    selectChunksForPassage,
    type DocumentOutlineEntry,
} from '../documentOutline';
import { parsePassageReference } from '../../../bible/canon/passage-reference';

function ref(input: string) {
    const parsed = parsePassageReference(input);
    if (!parsed.ok) throw new Error(`fixture inválida: ${input}`);
    return parsed.ref;
}

function entry(
    chunkIndex: number,
    section: string | null,
    sectionPath: string[] = [],
    page = 1,
): DocumentOutlineEntry {
    return { chunkIndex, page, section, sectionPath };
}

describe('parseHeadingReference', () => {
    it('lee un encabezado con libro y referencia', () => {
        // Forma real medida en "The Minor Prophets" (metadata.section).
        expect(parseHeadingReference('Micah 4:8', null)).toEqual(ref('Micah 4:8'));
    });

    it('lee un encabezado desnudo prestándole el libro del contexto', () => {
        expect(parseHeadingReference('1:1-3', 'JON')).toEqual(ref('Jonah 1:1-3'));
    });

    it('rechaza el encabezado desnudo cuando no hay libro en contexto', () => {
        expect(parseHeadingReference('1:1-3', null)).toBeNull();
    });

    it('rechaza una línea de cuerpo promovida a encabezado por el extractor', () => {
        // Caso real de un PDF escaneado.
        expect(
            parseHeadingReference('6 [7]. TVJTJ (will be): Waw-relative introduces a', 'MIC'),
        ).toBeNull();
    });

    it('rechaza texto que menciona una referencia sin ser un encabezado de sección', () => {
        expect(parseHeadingReference('ver 1:1-3', 'JON')).toBeNull();
    });

    // Formas medidas en comentarios reales del usuario. Sin ellas, un
    // comentario de 98 páginas sobre Jonás quedaba con CERO encabezados
    // utilizables aunque los tuviera en los 278 chunks.

    it('lee la referencia entre paréntesis al final del título', () => {
        expect(parseHeadingReference('Pues el mar se embravecía más y más (1:11)', 'JON'))
            .toEqual(ref('Jonah 1:11'));
    });

    it('lee un paréntesis final aunque el título sea largo', () => {
        // El tope de longitud descarta líneas de cuerpo promovidas a
        // encabezado; un "(c:v)" final es señal fuerte por sí sola y estos
        // títulos son largos porque citan el versículo.
        const long = '… pero tú sacaste de la fosa mi vida, oh Señor, Dios mío, y te di gracias (2:6)';
        expect(parseHeadingReference(long, 'JON')).toEqual(ref('Jonah 2:6'));
    });

    it('lee un rango entre paréntesis que cruza capítulos', () => {
        expect(parseHeadingReference("IV. Jonah Objects to Nineveh's Survival (4:1-11)", 'JON'))
            .toEqual(ref('Jonah 4:1-11'));
    });

    it('lee "prosa + Libro c:v" al final', () => {
        expect(parseHeadingReference('Escena segunda: el vientre del pez Jonás 1:17-2:10', null))
            .toEqual(ref('Jonah 1:17-2:10'));
    });

    it('no confunde el paréntesis final cuando no hay libro en contexto', () => {
        expect(parseHeadingReference('Pues el mar se embravecía más y más (1:11)', null)).toBeNull();
    });

    it('sigue rechazando la línea de cuerpo aunque ahora haya más formas', () => {
        expect(
            parseHeadingReference('6 [7]. TVJTJ (will be): Waw-relative introduces a', 'MIC'),
        ).toBeNull();
    });
});

describe('parseHeadingReference — encabezado de página de un comentario de notas (TP #8, A3)', () => {
    // Formas reales de Mayor, «The Epistle of St. James» (3.ª ed.): las páginas
    // impares llevan «IV 2, 3] NOTES» y el comentario nunca dice «James».
    it('lee capítulo en romanos y versículos con el libro del contexto', () => {
        expect(parseHeadingReference('IV 2, 3] NOTES', 'JAS')).toEqual(ref('James 4:2-3'));
        expect(parseHeadingReference('IV 2] NOTES', 'JAS')).toEqual(ref('James 4:2'));
        expect(parseHeadingReference('IV 3–5] NOTES', 'JAS')).toEqual(ref('James 4:3-5'));
        expect(parseHeadingReference('IV 6]', 'JAS')).toEqual(ref('James 4:6'));
    });

    it('cruza de capítulo', () => {
        expect(parseHeadingReference('III 17–IV 1] NOTES', 'JAS')).toEqual(ref('James 3:17-4:1'));
    });

    it('sin libro del contexto no adivina', () => {
        expect(parseHeadingReference('IV 2, 3] NOTES', null)).toBeNull();
    });

    it('rechaza lo que no es un encabezado de notas', () => {
        expect(parseHeadingReference('IV 2, 3 NOTES', 'JAS')).toBeNull();
        expect(parseHeadingReference('Chapter IV 2] and more', 'JAS')).toBeNull();
        expect(parseHeadingReference('IV 5–3] NOTES', 'JAS')).toBeNull();
        expect(parseHeadingReference('IQ 2] NOTES', 'JAS')).toBeNull();
    });
});

describe('resolveOutlineReferences', () => {
    it('lee los encabezados de Mayor con el libro del trabajo y las páginas pares heredan', () => {
        const resolved = resolveOutlineReferences(
            [
                entry(0, 'IV 2, 3] NOTES', ['NOTES', 'IV 2, 3] NOTES'], 411),
                entry(1, 'THE EPISTLE OF ST. JAMES', ['NOTES', 'THE EPISTLE OF ST. JAMES'], 412),
                entry(2, 'IV 3–5] NOTES', ['NOTES', 'IV 3–5] NOTES'], 413),
            ],
            'JAS',
        );

        expect(resolved.map(e => e.resolution)).toEqual(['heading', 'inherited', 'heading']);
        expect(resolved[1]!.reference).toEqual(ref('James 4:2-3'));
        expect(resolved[2]!.reference).toEqual(ref('James 4:3-5'));
    });

    it('sin el libro del trabajo, el mismo documento no se lee', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'IV 2, 3] NOTES', ['NOTES', 'IV 2, 3] NOTES']),
        ]);
        expect(resolved[0]!.reference).toBeNull();
    });

    it('el libro prestado no pasa a ser el libro del documento (revisión de 8a)', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'IV 2, 3] NOTES', ['NOTES']),
            entry(1, '1:1-3', ['NOTES']),
        ], 'JAS');
        expect(resolved[0]!.reference).toEqual(ref('James 4:2-3'));
        // «1:1-3» no es Santiago 1:1-3: hereda la nota anterior, no se lee con el libro prestado.
        expect(resolved[1]!.resolution).toBe('inherited');
    });

    it('un capítulo que el libro no tiene no es un encabezado de notas', () => {
        expect(parseHeadingReference('VI 2] NOTES', 'JAS')).toBeNull();
    });

    it('el libro del trabajo no se presta a una referencia desnuda', () => {
        // Un comentario de Hebreos y Santiago sin libro en la miga: «1:1-3» no
        // es Santiago 1:1-3 sólo porque el trabajo sea de Santiago.
        const resolved = resolveOutlineReferences([entry(0, '1:1-3', ['Commentary'])], 'JAS');
        expect(resolved[0]!.reference).toBeNull();
    });

    it('un libro nombrado en la miga manda sobre el del trabajo', () => {
        const resolved = resolveOutlineReferences([entry(0, '1:1-3', ['Jonah'])], 'JAS');
        expect(resolved[0]!.reference).toEqual(ref('Jonah 1:1-3'));
    });

    it('hereda la referencia del encabezado hacia el cuerpo que le sigue', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'Jonah 1:1-3', ['Jonah', 'Jonah 1:1-3']),
            entry(1, null, ['Jonah', 'Jonah 1:1-3']),
            entry(2, null, ['Jonah', 'Jonah 1:1-3']),
        ]);

        expect(resolved.map(e => e.resolution)).toEqual(['heading', 'inherited', 'inherited']);
        expect(resolved[2]!.reference).toEqual(ref('Jonah 1:1-3'));
    });

    it('corta la herencia al cambiar de libro', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'Jonah 1:1-3', ['Jonah', 'Jonah 1:1-3']),
            entry(1, null, ['Jonah', 'Jonah 1:1-3']),
            entry(2, null, ['Micah']),
        ]);

        expect(resolved[2]!.reference).toBeNull();
        expect(resolved[2]!.resolution).toBe('none');
    });

    it('toma el libro del nivel más profundo de la miga de pan', () => {
        // Miga real de "The Minor Prophets": el volumen entero arriba, el
        // libro concreto abajo.
        const resolved = resolveOutlineReferences([
            entry(0, '1:1-3', ['The Minor Prophets', 'A Commentary on Obadiah, Jonah,', 'Jonah']),
        ]);

        expect(resolved[0]!.reference).toEqual(ref('Jonah 1:1-3'));
    });

    it('no adivina el libro cuando la miga nombra varios', () => {
        const resolved = resolveOutlineReferences([
            entry(0, '1:1-3', ['A Commentary on Obadiah, Jonah, Micah']),
        ]);

        expect(resolved[0]!.reference).toBeNull();
    });

    it('deja sin referencia un documento extraído sin encabezados', () => {
        // Caso real: "Obadiah, Jonah and Micah" indexa con section null en
        // todos sus chunks.
        const resolved = resolveOutlineReferences([
            entry(0, null, []),
            entry(1, null, []),
        ]);

        expect(resolved.every(e => e.reference === null)).toBe(true);
    });

    it('ordena por chunkIndex antes de heredar', () => {
        const resolved = resolveOutlineReferences([
            entry(2, null, ['Jonah']),
            entry(0, 'Jonah 1:1-3', ['Jonah']),
            entry(1, null, ['Jonah']),
        ]);

        expect(resolved.map(e => e.chunkIndex)).toEqual([0, 1, 2]);
        expect(resolved[2]!.reference).toEqual(ref('Jonah 1:1-3'));
    });
});

describe('referencesOverlap', () => {
    it('un versículo suelto solapa el rango que lo contiene', () => {
        expect(referencesOverlap(ref('Jonah 1:2'), ref('Jonah 1:1-3'))).toBe(true);
    });

    it('un capítulo entero solapa cualquier versículo suyo', () => {
        expect(referencesOverlap(ref('Jonah 1'), ref('Jonah 1:2'))).toBe(true);
    });

    it('no solapa entre libros distintos', () => {
        expect(referencesOverlap(ref('Micah 1:1'), ref('Jonah 1:1'))).toBe(false);
    });

    it('no solapa rangos disjuntos del mismo libro', () => {
        expect(referencesOverlap(ref('Jonah 3:1-5'), ref('Jonah 1:1-3'))).toBe(false);
    });

    it('solapa a través de capítulos', () => {
        expect(referencesOverlap(ref('Jonah 1:15-2:2'), ref('Jonah 2:1'))).toBe(true);
    });
});

describe('selectChunksForPassage', () => {
    const outline = resolveOutlineReferences([
        entry(0, 'Introduction', ['Jonah']),
        entry(1, 'Jonah 1:1-3', ['Jonah']),
        entry(2, null, ['Jonah']),
        entry(3, null, ['Jonah']),
        entry(4, 'Jonah 1:4-6', ['Jonah']),
        entry(5, null, ['Jonah']),
    ]);

    it('devuelve el tramo contiguo de la sección del pasaje', () => {
        const selection = selectChunksForPassage(outline, ref('Jonah 1:1-3'), {
            contextChunks: 0,
        });

        expect(selection.ranges).toEqual([{ start: 1, end: 3 }]);
        expect(selection.chunkCount).toBe(3);
    });

    it('agrega los vecinos de contexto sin salirse del documento', () => {
        const selection = selectChunksForPassage(outline, ref('Jonah 1:1-3'), {
            contextChunks: 1,
        });

        expect(selection.ranges).toEqual([{ start: 0, end: 4 }]);
    });

    it('devuelve vacío cuando el pasaje no está en el documento', () => {
        const selection = selectChunksForPassage(outline, ref('Micah 1:1'));

        expect(selection.ranges).toEqual([]);
        expect(selection.chunkCount).toBe(0);
    });

    it('respeta el tope y lo señala', () => {
        const selection = selectChunksForPassage(outline, ref('Jonah 1:1-3'), {
            contextChunks: 0,
            maxChunks: 2,
        });

        expect(selection.chunkCount).toBe(2);
        expect(selection.truncated).toBe(true);
    });

    it('prefiere el encabezado específico sobre la perícopa envolvente', () => {
        // Forma real de "The Minor Prophets": el comentario encabeza dos
        // veces el mismo material, con el título de la perícopa entera y con
        // el del tramo concreto. Quedarse con el envolvente arrastraba 1:4-16.
        const nested = resolveOutlineReferences([
            entry(0, 'I. Jonah Goes His Own Way (1:1-16)', ['Jonah']),
            entry(1, 'Jonah 1:1-3', ['Jonah']),
            entry(2, null, ['Jonah']),
            entry(3, 'Jonah 1:4-6', ['Jonah']),
            entry(4, 'I. Jonah Goes His Own Way (1:1-16)', ['Jonah']),
        ]);

        const selection = selectChunksForPassage(nested, ref('Jonah 1:1-3'), {
            contextChunks: 0,
        });

        expect(selection.ranges).toEqual([{ start: 1, end: 2 }]);
    });

    it('usa el envolvente cuando no hay nada más fino', () => {
        // Comentarios que no bajan del nivel de perícopa: ahí el envolvente
        // es lo mejor que hay y descartarlo dejaría la fuente sin nada.
        const coarse = resolveOutlineReferences([
            entry(0, 'I. Jonah Goes His Own Way (1:1-16)', ['Jonah']),
            entry(1, null, ['Jonah']),
        ]);

        const selection = selectChunksForPassage(coarse, ref('Jonah 1:1-3'), {
            contextChunks: 0,
        });

        expect(selection.ranges).toEqual([{ start: 0, end: 1 }]);
    });

    it('separa tramos no contiguos', () => {
        const disjoint = resolveOutlineReferences([
            entry(0, 'Jonah 1:1', ['Jonah']),
            entry(1, 'Micah 1:1', ['Micah']),
            entry(2, 'Jonah 1:2', ['Jonah']),
        ]);

        const selection = selectChunksForPassage(disjoint, ref('Jonah 1:1-3'), {
            contextChunks: 0,
        });

        expect(selection.ranges).toEqual([{ start: 0, end: 0 }, { start: 2, end: 2 }]);
    });
});

describe('outlineStructureQuality', () => {
    it('marca usable un documento con encabezados por referencia', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'Jonah 1:1-3', ['Jonah']),
            entry(1, 'Jonah 1:4-6', ['Jonah']),
        ]);

        expect(outlineStructureQuality(resolved).usable).toBe(true);
    });

    it('marca no usable un documento sin encabezados', () => {
        const resolved = resolveOutlineReferences([entry(0, null, []), entry(1, null, [])]);
        const quality = outlineStructureQuality(resolved);

        expect(quality.usable).toBe(false);
        expect(quality.headingCount).toBe(0);
    });

    it('marca no usable un documento con un solo encabezado suelto', () => {
        const resolved = resolveOutlineReferences([
            entry(0, 'Jonah 1:1-3', ['Jonah']),
            entry(1, null, ['Jonah']),
        ]);

        expect(outlineStructureQuality(resolved).usable).toBe(false);
    });
});
