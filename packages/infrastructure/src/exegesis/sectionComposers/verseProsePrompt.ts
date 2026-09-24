import {
    buildAcademicVoiceBlock,
    buildWordBudgetBlock,
    formatPassageReference,
    serializeAnalysis,
    type ComposeVerseInput,
    type ComposerSourceMetadata,
} from '@dosfilos/domain';

const ES_INSTRUCTION = `Eres un redactor académico de exégesis bíblica nivel TMS/Turabian. Recibes el análisis canónico estructurado de UN versículo y produces 1-3 párrafos de prosa académica continua sobre ese versículo SOLAMENTE.

REGLAS DURAS:
- NUNCA escribas sobre versículos vecinos. Solo este versículo.
- NUNCA agregues introducción ni conclusión global. La prosa entra directo en el análisis del verso.
- NO uses listas numeradas, viñetas, ni encabezados. Prosa continua.
- Integra la morfología EN la prosa (no tablas).
- Citas inline en formato (Autor, "Título", p. N) siguiendo la guía de estilo cuando esté configurada.
- COPIÁ el rótulo de página TAL CUAL viene en el briefing. Si dice «hoja 55», escribí «hoja 55» — NUNCA lo conviertas a «p. 55»: significa que la página impresa de ese libro se desconoce, y escribir «p.» mandaría al lector a otra página.
- Cierra el último párrafo con la tesis del verso + la decisión de traducción comprometida.
- Si el análisis declara confianza baja en algún hallazgo, calibra el lenguaje hedge ("posiblemente", "es plausible que…").
- NO inventes citas: solo usa los sourceKey que aparecen en el análisis. Si necesitas citar algo y no hay sourceKey disponible, omítelo.

FORMATO DE SALIDA:
- Markdown plano. Solo párrafos separados por línea en blanco.
- Sin título, sin "Versículo N:" — la prosa empieza directo.
- Sin sección de bibliografía — esa la arma el composer del paper completo.`;

const EN_INSTRUCTION = `You are an academic biblical-exegesis writer at TMS / Turabian rigor. You receive the canonical structured analysis of ONE verse and produce 1-3 paragraphs of continuous academic prose covering THAT verse only.

HARD RULES:
- NEVER write about adjacent verses. This verse only.
- NEVER add a global introduction or conclusion. The prose drops directly into the verse analysis.
- NO numbered lists, bullets, or headings. Continuous prose.
- Integrate morphology INTO the prose (no tables).
- Inline citations as (Author, "Title", p. N) following the style guide when configured.
- COPY the page label EXACTLY as the briefing gives it. If it says "hoja 55", write "hoja 55" — NEVER convert it to "p. 55": it means that book's printed page is unknown, and writing "p." would send the reader to a different page.
- Close the final paragraph with the verse's thesis + the committed translation decision.
- If the analysis declares low confidence on a finding, calibrate hedge language ("possibly", "it is plausible that…").
- DO NOT invent citations: use only the sourceKey values that appear in the analysis. If you'd cite something and no sourceKey is available, omit it.

OUTPUT FORMAT:
- Plain markdown. Just paragraphs separated by blank lines.
- No title, no "Verse N:" — prose starts directly.
- No bibliography section — that lives in the whole-paper composer.`;

export function buildVerseProsePrompt(input: ComposeVerseInput): {
    systemInstruction: string;
    userMessage: string;
} {
    const lang = input.language;
    const baseInstruction = lang === 'en' ? EN_INSTRUCTION : ES_INSTRUCTION;

    const styleGuideBlock = input.styleGuideContent.trim().length > 0
        ? [
            lang === 'en' ? 'STYLE GUIDE (authoritative):' : 'GUÍA DE ESTILO (autoritativa):',
            '"""',
            input.styleGuideContent.trim(),
            '"""',
        ].join('\n')
        : (lang === 'en'
            ? 'No style guide attached. Apply TMS / Turabian conventions as default.'
            : 'Sin guía de estilo configurada. Aplica TMS / Turabian como default.');

    // El glosario va en la INSTRUCCIÓN y no en el mensaje: es una regla de
    // cómo escribir, no un dato del verso, y vale igual para todas las
    // pasadas sobre este trabajo.
    const glosario = (input.glossary ?? []).filter(t => t.avoid.trim().length >= 3);
    const glossaryBlock = glosario.length > 0
        ? [
            lang === 'en'
                ? 'WORDS THIS AUTHOR DOES NOT USE (hard rule — never write them):'
                : 'PALABRAS QUE ESTE AUTOR NO USA (regla dura — nunca las escribas):',
            ...glosario.map(t => {
                const cambio = t.prefer?.trim()
                    ? (lang === 'en' ? ` → write "${t.prefer.trim()}"` : ` → escribe «${t.prefer.trim()}»`)
                    : (lang === 'en' ? ' → rephrase without it' : ' → reformula sin ella');
                return `- "${t.avoid.trim()}"${cambio}${t.note?.trim() ? ` (${t.note.trim()})` : ''}`;
            }),
        ].join('\n')
        : '';

    // La voz va en la instrucción, junto al estilo y al glosario: las tres
    // dicen CÓMO escribir, no QUÉ escribir.
    const voiceBlock = buildAcademicVoiceBlock(input.voiceSamples ?? [], lang);

    const systemInstruction = [baseInstruction, '', styleGuideBlock, glossaryBlock,
        buildWordBudgetBlock(input.wordBudget ?? null, lang), voiceBlock]
        .filter(Boolean)
        .join('\n');

    const verseRef = input.verseAnalysis.reference;
    const verseLabel = `${verseRef.bookId} ${verseRef.chapterStart}:${verseRef.verseStart}${
        verseRef.verseEnd && verseRef.verseEnd !== verseRef.verseStart ? `-${verseRef.verseEnd}` : ''
    }`;

    const sourceTable = input.sources.length > 0
        ? [
            lang === 'en' ? 'AVAILABLE SOURCES (cite by sourceKey):' : 'FUENTES DISPONIBLES (cita por sourceKey):',
            ...input.sources.map(s => `- ${s.citationKey}: ${describeSource(s)}`),
            lang === 'en'
                ? 'Publisher, city and year are given here ONLY when someone copied them from the book. If a datum is missing above, do not write it and do not guess it.'
                : 'La editorial, la ciudad y el año están arriba SOLO cuando alguien los copió del libro. Si un dato no aparece, no lo escribas ni lo deduzcas.',
        ].join('\n')
        : (lang === 'en'
            ? 'No external sources configured for this paper.'
            : 'Sin fuentes externas configuradas para este paper.');

    const briefBlock = input.assignmentBrief?.trim()
        ? [
            lang === 'en' ? 'PAPER BRIEF (background only — do not restate):' : 'BRIEF DEL PAPER (contexto, no lo repitas):',
            '"""',
            input.assignmentBrief.trim(),
            '"""',
        ].join('\n')
        : '';

    // Lo que el autor pide corregir en esta pasada. Va al final del
    // mensaje, después del análisis, porque es lo último que el modelo
    // debe tener presente al escribir; y se enmarca como exigencia de
    // esta redacción, no como contenido nuevo: las reglas duras siguen
    // rigiendo y el análisis sigue siendo la única fuente.
    const guidance = input.guidance?.trim();
    const guidanceBlock = guidance
        ? [
            lang === 'en'
                ? 'WHAT TO FIX IN THIS PASS (the author\'s instruction — obey it within the hard rules; it is not new content):'
                : 'QUÉ CORREGIR EN ESTA PASADA (indicación del autor — obedécela dentro de las reglas duras; no es contenido nuevo):',
            '"""',
            guidance,
            '"""',
        ].join('\n')
        : '';

    const target = input.targetWords && input.targetWords > 0 ? Math.round(input.targetWords) : null;
    const lengthBlock = target
        ? (lang === 'en'
            ? `TARGET LENGTH: about ${target} words. Develop what the analysis holds — morphology, syntax, the commentators' positions and the lexical range — until it is covered. If the analysis does not hold that much, write what it holds: padding, repeating, or inventing is worse than a short paragraph.`
            : `EXTENSIÓN OBJETIVO: unas ${target} palabras. Desarrolla lo que el análisis contiene —morfología, sintaxis, las posturas de los comentaristas y el rango léxico— hasta cubrirlo. Si el análisis no da para tanto, escribe lo que hay: rellenar, repetir o inventar es peor que un párrafo corto.`)
        : '';

    const userMessage = [
        lang === 'en'
            ? `Pericope: ${formatPassageReference(input.paperPassage, lang)}`
            : `Pericopa: ${formatPassageReference(input.paperPassage, lang)}`,
        lang === 'en'
            ? `Target verse: ${verseLabel}`
            : `Verso a redactar: ${verseLabel}`,
        '',
        briefBlock,
        sourceTable,
        '',
        lang === 'en' ? 'CANONICAL ANALYSIS (the only authoritative content source):' : 'ANÁLISIS CANÓNICO (única fuente autoritativa):',
        serializeAnalysis(input.verseAnalysis, lang, { pageLabel: input.pageLabel }),
        lengthBlock,
        guidanceBlock,
    ].filter(Boolean).join('\n\n');

    return { systemInstruction, userMessage };
}


/**
 * La ficha de una fuente tal como el compositor puede citarla.
 *
 * Se escribe lo que hay y nada más. Antes esta línea llevaba autor,
 * título y año, y el resto de la referencia —ciudad y editorial— salía
 * del modelo: en el trabajo de Salmo 23 llegaron inventadas.
 */
function describeSource(s: ComposerSourceMetadata): string {
    const parts = [`${s.author}, "${s.title}"`];
    if (s.seriesVolume) parts.push(s.seriesVolume);
    if (s.edition) parts.push(s.edition);
    const imprint = [s.city, s.publisher, s.year ? String(s.year) : ''].filter(Boolean);
    if (imprint.length > 0) parts.push(`(${imprint.join(': ')})`);
    return parts.join(', ');
}
