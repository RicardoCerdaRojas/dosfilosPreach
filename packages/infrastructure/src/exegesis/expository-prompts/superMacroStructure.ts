import type { BookPanorama, SuperMacroInput } from '@dosfilos/domain';
import { buildSourcePreamble, formatVerses } from './shared';

/**
 * Pase 2a — Super-macroestructura (two-tier mode only).
 *
 * Optional broad division of long books (Génesis, Hechos, Isaías,
 * Jeremías, Salmos) into 2-5 super-macro sections BEFORE the regular
 * macro pass runs. Activated by the wizard when the pastor opts into
 * two-tier mode for a long book; skipped for short books where a
 * flat macro list is sufficient.
 *
 * Each super-macro is a broad function within the book ("primeros
 * relatos", "ciclos patriarcales", "viajes misioneros", etc.). The
 * regular macro pass then runs with these super-macros as scoping
 * input and produces macros nested under them via
 * `parentSuperMacroId`.
 */

export function buildSuperMacroSystemInstruction(displayLanguage: 'es' | 'en'): string {
    if (displayLanguage === 'es') {
        return [
            'Eres un homileta y exegeta experto. Continúas un análisis iniciado: en el paso previo identificaste el panorama del libro (género, propósito, problema pastoral, tema, movimientos, palabras clave).',
            '',
            'En este paso produces la SUPER-MACROESTRUCTURA: divides el libro en 2-5 bloques muy grandes que cumplen cada uno una función AMPLIA dentro del libro completo. Este nivel SOLO se usa para libros largos (Génesis, Hechos, Isaías, Jeremías, Salmos) donde una lista plana de 5-7 macros colapsaría 100+ versos por macro.',
            '',
            'Un super-macro NO es un capítulo ni una perícopa ni una macro-sección regular. Es un BLOQUE MUY GRANDE — típicamente decenas de capítulos en libros narrativos largos, varios libros internos en Salmos, ciclos de oráculos en profecía mayor.',
            '',
            '## Marcadores estructurales canónicos para super-macros',
            '',
            'Honra estos cortes cuando el libro lo demande, sin importar el conteo sugerido:',
            '',
            '- **Génesis**: "Primeros relatos (1-11)" / "Ciclo Abraham (12-25)" / "Ciclo Isaac-Jacob (26-36)" / "Ciclo José (37-50)". Variante aceptable: agrupar Isaac y Jacob, o tratar José aparte.',
            '- **Hechos**: división geográfica de Lucas — "Iglesia en Jerusalén (1-7)" / "Expansión a Judea-Samaria (8-12)" / "Misión a los gentiles (13-28)".',
            '- **Isaías**: división crítica clásica — "Isaías de Jerusalén (1-39)" / "Consolación del exilio (40-55)" / "Restauración post-exílica (56-66)".',
            '- **Jeremías**: "Predicación pre-exílica (1-25)" / "Narrativas biográficas (26-45)" / "Oráculos contra naciones (46-51)" / "Apéndice histórico (52)".',
            '- **Salmos**: la división canónica en 5 libros — Libro I (1-41), Libro II (42-72), Libro III (73-89), Libro IV (90-106), Libro V (107-150).',
            '- **Ezequiel**: "Llamado y oráculos pre-caída (1-24)" / "Oráculos contra naciones (25-32)" / "Restauración (33-48)".',
            '',
            '## Cuándo NO devolver super-macros',
            '',
            'Si el libro tiene menos de ~300 versos, normalmente NO necesita super-macros — el wizard no debería haber pedido este pase. Sin embargo, si el pastor lo solicita igual: devuelve 2-3 super-macros que reflejen las grandes divisiones tradicionales del libro (típicamente apertura + desarrollo + cierre).',
            '',
            '## Reglas innegociables',
            '',
            '- Los super-macros cubren TODO el libro sin huecos y sin solapamientos.',
            '- Mínimo 2, máximo 5. Si te dan ganas de devolver 6+, probablemente esos son macros normales y NO super-macros.',
            '- Cada super-macro abarca al menos ~30 versos. Bloques más pequeños son macros, no super-macros.',
            '',
            'Salida: JSON estricto con `superMacroSections: [{ id, title, chapterStart, verseStart, chapterEnd, verseEnd, theme, order }]`.',
            '- id: cadena única dentro del run (ej. "sm-1", "sm-2").',
        ].join('\n');
    }

    return [
        'You are an expert homiletician and exegete. You are continuing a multi-step analysis: in the previous step you identified the book\'s panorama (genre, purpose, pastoral problem, theme, movements, key terms).',
        '',
        'In this step, produce the SUPER-MACROSTRUCTURE: divide the book into 2-5 very large blocks, each performing a BROAD function within the whole book. This level is used ONLY for long books (Genesis, Acts, Isaiah, Jeremiah, Psalms) where a flat list of 5-7 macros would collapse 100+ verses per macro.',
        '',
        'A super-macro is NOT a chapter, a pericope, or a regular macro-section. It is a VERY LARGE BLOCK — typically tens of chapters in long narrative books, several internal books in Psalms, oracle cycles in major prophecy.',
        '',
        '## Canonical structural markers for super-macros',
        '',
        'Honor these breaks when the book demands them, regardless of the suggested count:',
        '',
        '- **Genesis**: "Primeval narratives (1-11)" / "Abraham cycle (12-25)" / "Isaac-Jacob cycle (26-36)" / "Joseph cycle (37-50)". Acceptable variant: group Isaac + Jacob, or split Joseph apart.',
        '- **Acts**: Luke\'s geographic division — "Church in Jerusalem (1-7)" / "Expansion to Judea-Samaria (8-12)" / "Mission to the Gentiles (13-28)".',
        '- **Isaiah**: classic critical division — "Isaiah of Jerusalem (1-39)" / "Exilic consolation (40-55)" / "Post-exilic restoration (56-66)".',
        '- **Jeremiah**: "Pre-exilic preaching (1-25)" / "Biographical narratives (26-45)" / "Oracles against the nations (46-51)" / "Historical appendix (52)".',
        '- **Psalms**: the canonical five-book division — Book I (1-41), Book II (42-72), Book III (73-89), Book IV (90-106), Book V (107-150).',
        '- **Ezekiel**: "Call and pre-fall oracles (1-24)" / "Oracles against nations (25-32)" / "Restoration (33-48)".',
        '',
        '## When NOT to return super-macros',
        '',
        'If the book has fewer than ~300 verses, it usually does NOT need super-macros — the wizard shouldn\'t have requested this pass. If the preacher requests it anyway: return 2-3 super-macros reflecting the book\'s traditional broad divisions (typically opening + body + closing).',
        '',
        '## Non-negotiable rules',
        '',
        '- Super-macros cover the ENTIRE book without gaps or overlaps.',
        '- Minimum 2, maximum 5. If you feel like returning 6+, those are probably regular macros, not super-macros.',
        '- Each super-macro spans at least ~30 verses. Smaller blocks are macros, not super-macros.',
        '',
        'Output: strict JSON with `superMacroSections: [{ id, title, chapterStart, verseStart, chapterEnd, verseEnd, theme, order }]`.',
        '- id: unique string within the run (e.g. "sm-1", "sm-2").',
    ].join('\n');
}

export function buildSuperMacroUserMessage(input: SuperMacroInput): string {
    const isSpanish = input.displayLanguage === 'es';
    const panoramaBlock = formatPanoramaForPrompt(input.panorama, isSpanish);
    const sourcePreamble = buildSourcePreamble(input.sourceLanguage, input.displayLanguage, input.book);

    if (isSpanish) {
        return [
            `Libro: ${input.book}`,
            '',
            panoramaBlock,
            '',
            `El libro tiene ${input.verses.length} versículos. Devuelve 2-5 super-macros que reflejen sus grandes divisiones.`,
            sourcePreamble,
            'Texto verso a verso (formato `cap:vers <TAB> texto`):',
            '',
            formatVerses(input.verses),
            '',
            '---',
            'Devuelve únicamente JSON estricto siguiendo el schema del system prompt.',
        ].join('\n');
    }

    return [
        `Book: ${input.book}`,
        '',
        panoramaBlock,
        '',
        `The book has ${input.verses.length} verses. Return 2-5 super-macros reflecting its broad divisions.`,
        sourcePreamble,
        'Verse-by-verse text (`ch:v <TAB> text` format):',
        '',
        formatVerses(input.verses),
        '',
        '---',
        'Return only strict JSON conforming to the system prompt schema.',
    ].join('\n');
}

function formatPanoramaForPrompt(panorama: BookPanorama, isSpanish: boolean): string {
    const lines: string[] = [];
    if (isSpanish) {
        lines.push('## Panorama del libro (Pase 1)');
        lines.push(`- Género: ${panorama.genre}`);
        lines.push(`- Propósito: ${panorama.purpose}`);
        lines.push(`- Problema pastoral: ${panorama.pastoralProblem}`);
        lines.push(`- Tema central: ${panorama.centralTheme}`);
        lines.push(`- Movimientos sugeridos: ${panorama.movements.join(' / ')}`);
    } else {
        lines.push('## Book panorama (Pass 1)');
        lines.push(`- Genre: ${panorama.genre}`);
        lines.push(`- Purpose: ${panorama.purpose}`);
        lines.push(`- Pastoral problem: ${panorama.pastoralProblem}`);
        lines.push(`- Central theme: ${panorama.centralTheme}`);
        lines.push(`- Suggested movements: ${panorama.movements.join(' / ')}`);
    }
    return lines.join('\n');
}

export const SUPER_MACRO_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        superMacroSections: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    chapterStart: { type: 'integer' },
                    verseStart: { type: 'integer' },
                    chapterEnd: { type: 'integer' },
                    verseEnd: { type: 'integer' },
                    theme: { type: 'string' },
                    order: { type: 'integer' },
                },
                required: [
                    'id',
                    'title',
                    'chapterStart',
                    'verseStart',
                    'chapterEnd',
                    'verseEnd',
                    'theme',
                    'order',
                ],
            },
        },
    },
    required: ['superMacroSections'],
} as const;
