/**
 * Los casos de la regla de los saltos de línea (`LINE_BREAK_RULE`), tomados
 * de un sermón real del fundador (Jonás 4:5-11, 2026-10-04). Los usan las
 * pruebas de los TRES lectores —el atril, la web y Word/PDF— para que no
 * vuelvan a leer el mismo texto de tres maneras.
 *
 * `lines`: lo que debe verse, bloque por bloque y renglón por renglón.
 */
export interface LineBreakFixture {
    name: string;
    markdown: string;
    lines: string[][];
}

export const LINE_BREAK_FIXTURES: LineBreakFixture[] = [
    {
        name: 'etiqueta en negrita y su texto (salto suelto, como lo guardaba el editor)',
        markdown: '**A nivel institucional**\nHace muchos años observé un fenómeno.',
        lines: [['A nivel institucional', 'Hace muchos años observé un fenómeno.']],
    },
    {
        name: 'pregunta y respuesta en renglones distintos',
        markdown: 'Alguno dirá: ¿Yo tengo problemas?\nSi eso es lo que pensaste: acabas de darme la razón.',
        lines: [['Alguno dirá: ¿Yo tengo problemas?', 'Si eso es lo que pensaste: acabas de darme la razón.']],
    },
    {
        name: 'implicación numerada con su exhortación debajo',
        markdown: '1. El desprecio por Nínive revela una inclinación.\n   Debemos resistirnos a esta inclinación.',
        lines: [['El desprecio por Nínive revela una inclinación.', 'Debemos resistirnos a esta inclinación.']],
    },
    {
        name: 'salto estándar (barra al final), como lo guarda ahora el editor',
        markdown: 'Primera línea.\\\nSegunda línea.',
        lines: [['Primera línea.', 'Segunda línea.']],
    },
    {
        name: 'una línea en blanco sigue separando párrafos',
        markdown: 'Un párrafo.\n\nOtro párrafo.',
        lines: [['Un párrafo.'], ['Otro párrafo.']],
    },
];
