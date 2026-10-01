import type { ComposerSourceMetadata } from '@dosfilos/domain';

/**
 * Shared prompt fragments for the three ministry composers (sermon /
 * devotional / study guide). They share guardrails about not
 * re-analyzing, not inventing claims, and respecting the
 * `theologicalHooks` bridge from exegesis to systematic theology.
 *
 * Style-guide handling: ministry composers treat the guide as
 * advisory, not binding. The seminary's citation conventions don't
 * govern pulpit register; the analyses' confidence flags and
 * theological hooks do.
 */

export function commonGuardrails(lang: 'es' | 'en'): string {
    if (lang === 'en') {
        return [
            `## Guardrails (NON-NEGOTIABLE)`,
            `- The exegetical work is ALREADY DONE in the structured analyses below. Your job is COMPOSITION for this format. Do NOT re-analyze the Greek, do NOT introduce new exegetical claims, do NOT invent sources or citations.`,
            `- ONLY use ideas, decisions, and citations PRESENT in the analyses. Translation commitments must be the ones the analyses adopted.`,
            `- Calibrate hedge language to the analyses' \`confidenceFlags\`: high → "demonstrates / establishes"; medium → "argues / contends"; tentative → "suggests / could be read as".`,
            `- Theological synthesis is informed by each analysis's \`theologicalHooks\` — surface the doctrinal locus the verse touches, anchored in what the analysis actually established.`,
            `- NO devotional inflation. NO doctrinal claims the text doesn't support. NO modern political/cultural commentary unless directly mandated by the assignment brief.`,
        ].join('\n');
    }
    return [
        `## Salvaguardas (NO NEGOCIABLES)`,
        `- El trabajo exegético YA ESTÁ HECHO en los análisis estructurados de abajo. Tu tarea es COMPOSICIÓN para este formato. NO re-analizes el griego, NO introduzcas afirmaciones exegéticas nuevas, NO inventes fuentes o citas.`,
        `- SOLO usa ideas, decisiones y citas PRESENTES en los análisis. Los compromisos de traducción deben ser los que los análisis adoptaron.`,
        `- Calibra el lenguaje hedge a los \`confidenceFlags\` de los análisis: high → "demuestra / establece"; medium → "sostiene / argumenta"; tentative → "sugiere / podría leerse como".`,
        `- La síntesis teológica se informa con los \`theologicalHooks\` de cada análisis — destaca el locus doctrinal que el verso toca, anclado en lo que el análisis efectivamente estableció.`,
        `- SIN inflación devocional. SIN afirmaciones doctrinales que el texto no respalda. SIN comentario político/cultural contemporáneo salvo que el encuadre del paper lo demande directamente.`,
    ].join('\n');
}

export function formatSourceRegistry(
    sources: ReadonlyArray<ComposerSourceMetadata>,
    lang: 'es' | 'en',
): string {
    if (sources.length === 0) {
        return lang === 'en' ? '(No sources configured.)' : '(Sin fuentes configuradas.)';
    }
    return sources.map(s => `- **${s.citationKey}**: ${s.author}, *${s.title}*`).join('\n');
}

export function formatAssignmentBrief(brief: string | null, lang: 'es' | 'en'): string {
    if (!brief || !brief.trim()) return '';
    const heading = lang === 'en' ? '## Pastoral / paper framing' : '## Encuadre pastoral / del paper';
    return [``, heading, brief.trim()].join('\n');
}

export function regenerationHintBlock(hint: string | null, lang: 'es' | 'en'): string {
    if (!hint) return '';
    const heading = lang === 'en' ? '### Regeneration hint' : '### Hint de regeneración';
    return ['', heading, hint, ''].join('\n');
}
