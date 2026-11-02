/**
 * Los controles mecánicos del texto que va al Word: rango con guion, grave
 * del griego y coma doble. Corrigen sin leer el argumento, y los usa la
 * revisión antes de exportar (`exportReview.ts`) sobre todo el documento.
 *
 * Es lo único que queda de la «Revisión antes de entregar» (TP #8, fase 8b),
 * que se dio de baja por decisión del fundador (2026-11-02): ver «Decisión
 * del 2026-11-02» en `docs/FASE_LECCIONES_TI2_2026-11.md`.
 */
export type MechanicalProseKind = 'hyphen-range' | 'greek-grave' | 'punctuation';

export interface MechanicalProseFinding {
    kind: MechanicalProseKind;
    /** El tramo del texto donde está, tal como aparece. */
    excerpt: string;
    /** El reemplazo: «584–585». */
    replacement: string;
}

export function mechanicalProseFindings(prose: string): MechanicalProseFinding[] {
    return [...hyphenRanges(prose), ...greekGraves(prose), ...punctuation(prose)];
}

const RANGO_CON_GUION = /(?<![\p{L}\p{N}/.-])(\d+(?::\d+)?)\s?[-‐‑]\s?(\d+(?::\d+)?)(?![\p{L}\p{N}/-])/gu;

function hyphenRanges(prose: string): MechanicalProseFinding[] {
    const out: MechanicalProseFinding[] = [];
    for (const m of sinEnlaces(prose).matchAll(RANGO_CON_GUION)) {
        // «2026-10» es una fecha, no un rango.
        if (/^\d{4}$/.test(m[1]!) && /^\d{2}$/.test(m[2]!)) continue;
        out.push({ kind: 'hyphen-range', excerpt: m[0], replacement: `${m[1]}–${m[2]}` });
    }
    return out;
}

/** Pronombres y verbos enclíticos: el oxítono que los precede conserva el agudo. */
const ENCLITICAS = new Set([
    'με', 'μου', 'μοι', 'σε', 'σου', 'σοι', 'τις', 'τι', 'τινος', 'τινι', 'τινα', 'τινες', 'τινων', 'τισι', 'τισιν', 'τινας',
    'εστι', 'εστιν', 'εισι', 'εισιν', 'ειμι', 'εσμεν', 'εστε', 'πως', 'ποτε', 'που', 'πω', 'γε', 'τε', 'τοι', 'περ',
]);
const PALABRA_GRIEGA = /[\p{Script=Greek}][\p{Script=Greek}\p{M}]*/gu;
const OXITONO = /[αεηιουω][̓̔̈]*́[̓̔̈ͅ]*[ςνρξψ]?$/u;

/**
 * «διά τό» → «διὰ τὸ»: un oxítono con agudo seguido de otra palabra griega,
 * sin puntuación en medio, lleva grave. Excepciones: el interrogativo τίς/τί
 * y una enclítica detrás.
 */
function greekGraves(prose: string): MechanicalProseFinding[] {
    const out: MechanicalProseFinding[] = [];
    const palabras = [...prose.matchAll(PALABRA_GRIEGA)];
    for (let i = 0; i < palabras.length - 1; i++) {
        const w = palabras[i]!;
        const sig = palabras[i + 1]!;
        const entre = prose.slice(w.index! + w[0].length, sig.index!);
        // Solo espacio en la misma línea: dos párrafos no son una frase.
        if (!/^[ \t\u00a0]+$/.test(entre)) continue;
        const nfd = w[0].normalize('NFD').toLowerCase();
        if (!OXITONO.test(nfd)) continue;
        const base = sinMarcas(w[0]);
        if (base === 'τις' || base === 'τι') continue;
        if (ENCLITICAS.has(sinMarcas(sig[0]))) continue;
        const corregida = nfd.replace(/́(?=[^́]*$)/u, '̀').normalize('NFC');
        const conMayuscula = w[0][0] !== w[0][0]!.toLowerCase()
            ? corregida[0]!.toUpperCase() + corregida.slice(1)
            : corregida;
        out.push({ kind: 'greek-grave', excerpt: `${w[0]} ${sig[0]}`, replacement: `${conMayuscula} ${sig[0]}` });
    }
    return out;
}

function punctuation(prose: string): MechanicalProseFinding[] {
    const out: MechanicalProseFinding[] = [];
    for (const m of prose.matchAll(/(\S{0,20}),\s*,(\s*\S{0,20})/gu)) {
        out.push({ kind: 'punctuation', excerpt: m[0].trim(), replacement: `${m[1]},${m[2]}`.trim() });
    }
    for (const m of prose.matchAll(/(\S{1,20})\s+,(\s*\S{0,20})/gu)) {
        out.push({ kind: 'punctuation', excerpt: m[0].trim(), replacement: `${m[1]},${m[2]}`.trim() });
    }
    return out;
}

function sinMarcas(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ').toLowerCase().replace(/σ$/u, 'ς');
}

/** El texto sin las direcciones web, donde un guion no es un rango. */
function sinEnlaces(s: string): string {
    return s.replace(/https?:\/\/\S+/g, m => ' '.repeat(m.length));
}
