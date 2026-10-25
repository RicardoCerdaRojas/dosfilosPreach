import type { FidelityInput } from '@dosfilos/domain';
import { buildSourcePreamble, formatVerses } from './shared';

/**
 * Pase 5 — Evaluación de fidelidad.
 *
 * The reviewer takes the full output of Pases 1-4 and audits the
 * preachable units against the methodology's anti-patterns:
 * separating exhortations from grounds, breaking parallelisms,
 * splitting narrative climaxes, mixing distinct prophetic oracles,
 * grouping independent proverbs without grounds, predicating an OT
 * citation without explaining its function, etc.
 *
 * Output is ADVISORY: issues with severity + recommendation. The
 * wizard surfaces them as warnings; nothing is silently rewritten.
 * The pastor decides whether to accept the suggestions.
 */

export function buildFidelitySystemInstruction(displayLanguage: 'es' | 'en'): string {
    if (displayLanguage === 'es') {
        return [
            'Eres un homileta y exegeta experto. Continúas un análisis ya iniciado: identificaste el panorama del libro (Pase 1), su macroestructura (Pase 2), sus unidades exegéticas (Pase 3) y la propuesta de unidades predicables (Pase 4).',
            '',
            'En este paso debes EVALUAR LA FIDELIDAD de las unidades predicables propuestas. Tu rol es de auditor crítico, no de re-escritor: identificas issues y das recomendaciones; el predicador decide qué hacer con ellas.',
            '',
            '## Cosas que debes verificar',
            '',
            'Para cada unidad predicable individual:',
            '- ¿Respeta la estructura del texto?',
            '- ¿Respeta el género literario detectado?',
            '- ¿Está demasiado larga? (más de 30-40 versículos en un libro denso es señal de que conviene dividir)',
            '- ¿Está demasiado corta? (menos de 3-5 versículos sin justificación literaria fuerte es señal de fragmentación artificial)',
            '- ¿Une textos que no deberían unirse (oráculos distintos, escenas separadas, proverbios independientes)?',
            '- ¿Separa textos que deberían permanecer juntos (paralelismos rotos, escenas narrativas con tensión cortada, exhortación separada de su fundamento, cita del AT separada de la afirmación que explica)?',
            '- ¿La proposición exegética surge realmente del texto o introduce ideas externas?',
            '- ¿La proposición homilética es derivable de la exegética o salta a una aplicación que no se sostiene?',
            '- ¿El objetivo pastoral es coherente con el género (no exhortar imperativos en un texto puramente narrativo, no extraer doctrina abstracta de poesía sin sus imágenes, etc.)?',
            '- ¿El caseTreatment (cuando aplica) está bien identificado?',
            '',
            'Verificaciones globales sobre la serie completa:',
            '- ¿Cubre toda la macroestructura sin huecos significativos?',
            '- ¿Hay macro-secciones enteras (clímax, doxología, código legal completo) que la propuesta omite?',
            '- ¿La cantidad de sermones es proporcional a la extensión y densidad del libro?',
            '- ¿Hay duplicación temática que sugiera unidades innecesariamente fragmentadas?',
            '',
            '## Para cada issue, produce:',
            '',
            '- unitId: id de la unidad predicable afectada (string), o null si el issue afecta a la serie completa.',
            '- severity: una de "info" | "warning" | "critical".',
            '  - info: observación que el predicador puede ignorar sin riesgo (ej. "considera renombrar para mayor claridad").',
            '  - warning: problema metodológico que debería revisarse antes de predicar (ej. "esta unidad agrupa dos oráculos proféticos distintos sin justificación textual").',
            '  - critical: ruptura grave de la metodología que produciría un sermón infiel al texto (ej. "esta unidad separa la exhortación de 1 Pedro 5:8 del fundamento de 5:6-7; predicarla aislada distorsiona el argumento").',
            '- description: 1-3 oraciones describiendo qué falla y por qué.',
            '- recommendation (opcional): sugerencia concreta para corregir (ej. "considera mover los versos 9-10 al sermón siguiente para preservar el paralelismo"). Omite cuando el issue es un señalamiento sin acción clara.',
            '',
            'Además, produce un campo `overallConfidence` entre 0 y 1 que estime cuán fielmente las unidades predicables representan la intención del autor. Bajo 0.7 indica que la propuesta tiene problemas significativos; sobre 0.85 indica una propuesta sólida.',
            '',
            '## Reglas innegociables',
            '',
            '- NO re-escribas las unidades predicables — solo emite issues y recomendaciones.',
            '- NO inventes problemas para parecer riguroso. Si no hay issues serios, devuelve un array vacío y un overallConfidence alto.',
            '- Sé específico: cita versos concretos, marcadores literarios, nombres de figuras retóricas. "Esta unidad rompe un paralelismo" sin más es ruido; "esta unidad rompe el paralelismo antitético entre 23:1 y 23:5" es útil.',
            '- Crítica severidad: reserva "critical" para rupturas que distorsionan el sentido autoral, no para preferencias estilísticas.',
            '',
            'Salida: JSON estricto con `{ overallConfidence, issues: [{ unitId, severity, description, recommendation? }] }`.',
        ].join('\n');
    }

    return [
        'You are an expert homiletician and exegete. You are continuing a multi-step analysis: you identified the book\'s panorama (Pass 1), its macrostructure (Pass 2), its exegetical units (Pass 3), and the preachable units proposal (Pass 4).',
        '',
        'In this step, EVALUATE THE FIDELITY of the proposed preachable units. Your role is critical auditor, not rewriter: you identify issues and give recommendations; the preacher decides what to do with them.',
        '',
        '## Things to verify',
        '',
        'For each individual preachable unit:',
        '- Does it respect the text\'s structure?',
        '- Does it respect the detected literary genre?',
        '- Is it too long? (more than 30-40 verses in a dense book signals it should be split)',
        '- Is it too short? (fewer than 3-5 verses without strong literary justification signals artificial fragmentation)',
        '- Does it merge texts that should not be merged (distinct oracles, separated scenes, independent proverbs)?',
        '- Does it separate texts that should stay together (broken parallelisms, narrative scenes with cut tension, exhortation separated from its grounds, OT citation separated from the affirmation it explains)?',
        '- Does the exegetical proposition truly arise from the text or introduce external ideas?',
        '- Is the homiletical proposition derivable from the exegetical, or does it leap to an unsupported application?',
        '- Is the pastoral objective coherent with the genre (no imperative exhortation in purely narrative texts, no abstract doctrine extracted from poetry without its imagery, etc.)?',
        '- Is the caseTreatment (when applicable) correctly identified?',
        '',
        'Global checks across the full series:',
        '- Does it cover the full macrostructure without significant gaps?',
        '- Are there entire macro-sections (climax, doxology, complete legal code) the proposal omits?',
        '- Is the sermon count proportional to the book\'s length and density?',
        '- Is there thematic duplication suggesting unnecessarily fragmented units?',
        '',
        '## For each issue, produce:',
        '',
        '- unitId: id of the affected preachable unit (string), or null if the issue affects the whole series.',
        '- severity: one of "info" | "warning" | "critical".',
        '  - info: observation the preacher can ignore without risk.',
        '  - warning: methodological problem worth reviewing before preaching.',
        '  - critical: severe methodology rupture that would produce a sermon unfaithful to the text.',
        '- description: 1-3 sentences describing what fails and why.',
        '- recommendation (optional): concrete suggestion to fix. Omit when the issue is a flag without clear action.',
        '',
        'Also produce `overallConfidence` between 0 and 1 estimating how faithfully the preachable units represent the author\'s intent. Below 0.7 indicates significant problems; above 0.85 indicates a solid proposal.',
        '',
        '## Non-negotiable rules',
        '',
        '- DO NOT rewrite the preachable units — only emit issues and recommendations.',
        '- DO NOT invent problems to appear rigorous. If there are no serious issues, return an empty array and a high overallConfidence.',
        '- Be specific: cite concrete verses, literary markers, names of rhetorical figures.',
        '- Severity discipline: reserve "critical" for ruptures that distort authorial sense, not stylistic preferences.',
        '',
        'Output: strict JSON with `{ overallConfidence, issues: [{ unitId, severity, description, recommendation? }] }`.',
    ].join('\n');
}

export function buildFidelityUserMessage(input: FidelityInput): string {
    const isSpanish = input.displayLanguage === 'es';
    const macroBlock = formatMacrosForPrompt(input.macroSections, isSpanish);
    const microBlock = formatMicrosForPrompt(input.exegeticalUnits, isSpanish);
    const preachableBlock = formatPreachablesForPrompt(input.preachableUnits, isSpanish);
    const sourcePreamble = buildSourcePreamble(input.sourceLanguage, input.displayLanguage, input.book);

    if (isSpanish) {
        return [
            `Libro: ${input.book}`,
            `Género: ${input.panorama.genre}`,
            `Tema central: ${input.panorama.centralTheme}`,
            `Problema pastoral: ${input.panorama.pastoralProblem}`,
            '',
            macroBlock,
            '',
            microBlock,
            '',
            preachableBlock,
            sourcePreamble,
            'Texto verso a verso (referencia):',
            '',
            formatVerses(input.verses),
            '',
            '---',
            'Devuelve únicamente JSON estricto siguiendo el schema. Si la propuesta es sólida, devuelve issues vacío y un overallConfidence alto — no inventes problemas.',
        ].join('\n');
    }

    return [
        `Book: ${input.book}`,
        `Genre: ${input.panorama.genre}`,
        `Central theme: ${input.panorama.centralTheme}`,
        `Pastoral problem: ${input.panorama.pastoralProblem}`,
        '',
        macroBlock,
        '',
        microBlock,
        '',
        preachableBlock,
        sourcePreamble,
        'Verse-by-verse text (reference):',
        '',
        formatVerses(input.verses),
        '',
        '---',
        'Return only strict JSON. If the proposal is solid, return an empty issues array and a high overallConfidence — do not invent problems.',
    ].join('\n');
}

function formatMacrosForPrompt(
    macros: ReadonlyArray<{ id: string; title: string; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number; functionInBook: string }>,
    isSpanish: boolean,
): string {
    const heading = isSpanish ? '## Macroestructura (Pase 2)' : '## Macrostructure (Pass 2)';
    const lines = [heading];
    macros.forEach((m) => {
        const range = m.chapterStart === m.chapterEnd
            ? `${m.chapterStart}:${m.verseStart}-${m.verseEnd}`
            : `${m.chapterStart}:${m.verseStart}-${m.chapterEnd}:${m.verseEnd}`;
        lines.push(`- ${m.id} | ${range} | "${m.title}" | ${m.functionInBook}`);
    });
    return lines.join('\n');
}

function formatMicrosForPrompt(
    micros: ReadonlyArray<{ id: string; macroSectionId: string; suggestedTitle: string; syntacticUnit: { chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number } }>,
    isSpanish: boolean,
): string {
    const heading = isSpanish ? '## Unidades exegéticas (Pase 3)' : '## Exegetical units (Pass 3)';
    const lines = [heading];
    micros.forEach((u) => {
        const u_ = u.syntacticUnit;
        const range = u_.chapterStart === u_.chapterEnd
            ? `${u_.chapterStart}:${u_.verseStart}-${u_.verseEnd}`
            : `${u_.chapterStart}:${u_.verseStart}-${u_.chapterEnd}:${u_.verseEnd}`;
        lines.push(`- ${u.id} (${u.macroSectionId}) | ${range} | "${u.suggestedTitle}"`);
    });
    return lines.join('\n');
}

function formatPreachablesForPrompt(
    units: ReadonlyArray<{ id: string; title: string; passage: string; sourcedExegeticalUnitIds: string[]; exegeticalProposition: string; homileticalProposition: string; pastoralObjective: string; caseTreatment?: string }>,
    isSpanish: boolean,
): string {
    const heading = isSpanish ? '## Unidades predicables propuestas (Pase 4)' : '## Proposed preachable units (Pass 4)';
    const lines = [heading];
    units.forEach((p) => {
        lines.push(`- ${p.id} | ${p.passage} | "${p.title}"${p.caseTreatment ? ` | ${p.caseTreatment}` : ''}`);
        lines.push(`    fuentes: ${p.sourcedExegeticalUnitIds.join(', ')}`);
        lines.push(`    proposición exegética: ${p.exegeticalProposition}`);
        lines.push(`    proposición homilética: ${p.homileticalProposition}`);
        lines.push(`    objetivo pastoral: ${p.pastoralObjective}`);
    });
    return lines.join('\n');
}

export const FIDELITY_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        overallConfidence: { type: 'number' },
        issues: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    unitId: { type: 'string' },
                    severity: {
                        type: 'string',
                        enum: ['info', 'warning', 'critical'],
                    },
                    description: { type: 'string' },
                    recommendation: { type: 'string' },
                },
                required: ['severity', 'description'],
            },
        },
    },
    required: ['overallConfidence', 'issues'],
} as const;
