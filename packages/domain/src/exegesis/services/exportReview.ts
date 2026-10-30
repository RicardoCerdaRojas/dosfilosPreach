import { findInlineCitations } from './inlineCitations';
import { mechanicalProseFindings, type ProseCheckKind } from './proseReview';

/**
 * La revisión antes de exportar: lo que se puede corregir en la app antes
 * de que exista el Word (fase «Lecciones del TI #2», etapa 2).
 *
 * Los 9 errores del Word final del TI #2 entraron con ediciones hechas a
 * mano en Word después de exportar. La regla del fundador: cada error se
 * corrige donde nace. Lo que produce el sistema se corrige al generar
 * (etapa 4); lo que entra al editar se corrige en la app, y esto lo marca
 * antes de exportar. Sin modelo: cada control es una regla que se puede
 * contar.
 *
 * Medido sobre los Word entregados (TI #1 y TI #2): todo lo que marca es un
 * error real según la guía y ninguna marca es una falsa alarma.
 */
export type ExportReviewKind =
    /** Una palabra frecuente sin tilde, de una lista cerrada. */
    | 'accent'
    /** «..» que no son puntos suspensivos. */
    | 'double-period'
    /** Un párrafo con paréntesis sin cerrar o sin abrir. */
    | 'unbalanced-paren'
    /** qatal, yiqtol, wayyiqtol o weqatal sin glosa en un trabajo que dice perfecto/imperfecto (regla 22). */
    | 'nomenclature'
    /** «Waltke-O’Connor» en un trabajo que también escribe «Waltke y O’Connor». */
    | 'author-form'
    | Extract<ProseCheckKind, 'hyphen-range' | 'greek-grave' | 'punctuation'>;

export interface ExportFinding {
    kind: ExportReviewKind;
    /** Dónde empieza `find` en el texto revisado. */
    offset: number;
    /** El tramo exacto que se marca. */
    find: string;
    /** El reemplazo, cuando la corrección es mecánica; `null` si la decide el estudiante. */
    replace: string | null;
    /** Un poco del texto alrededor, para ubicarlo. */
    context: string;
}

/**
 * Palabras que sin tilde NO existen en español: corregirlas nunca cambia el
 * sentido. Quedan fuera «mas», «solo», «esta», «aun» y también formas
 * verbales que sí existen sin tilde: «titulo», «pagina», «numero»,
 * «critica», «termino», «articulo», «genero», «practica», «ultimo».
 * Medido: en los Word entregados marca «lexico» (TI #1), «aqui» y
 * «versiculo» (TI #2), y nada más.
 */
const SIN_TILDE: Readonly<Record<string, string>> = {
    aqui: 'aquí', alli: 'allí', ahi: 'ahí', asi: 'así', ademas: 'además', tambien: 'también',
    despues: 'después', segun: 'según', jamas: 'jamás', quizas: 'quizás', atras: 'atrás', detras: 'detrás', traves: 'través',
    versiculo: 'versículo', versiculos: 'versículos', investigacion: 'investigación', analisis: 'análisis',
    traduccion: 'traducción', oracion: 'oración', construccion: 'construcción',
    interpretacion: 'interpretación', conclusion: 'conclusión', introduccion: 'introducción', funcion: 'función',
    relacion: 'relación', accion: 'acción', razon: 'razón', expresion: 'expresión', version: 'versión',
    preposicion: 'preposición', vocalizacion: 'vocalización', sintactico: 'sintáctico', sintactica: 'sintáctica',
    sintacticos: 'sintácticos', sintacticas: 'sintácticas', lexico: 'léxico', lexica: 'léxica', lexicos: 'léxicos',
    lexicas: 'léxicas', biblico: 'bíblico', biblica: 'bíblica', teologico: 'teológico', teologica: 'teológica',
    semantico: 'semántico', semantica: 'semántica', gramatica: 'gramática', gramaticas: 'gramáticas',
    metafora: 'metáfora', proposito: 'propósito', enfasis: 'énfasis', tecnico: 'técnico', tecnica: 'técnica',
    unico: 'único', unica: 'única', dificil: 'difícil', facil: 'fácil', util: 'útil', logico: 'lógico',
    analogia: 'analogía', categoria: 'categoría', teologia: 'teología', metodologia: 'metodología', poesia: 'poesía',
    hipotesis: 'hipótesis', parentesis: 'paréntesis', simbolo: 'símbolo', proximo: 'próximo', dia: 'día',
};

/** El término de la nomenclatura del trabajo para cada sigla (regla 22). */
const NOMENCLATURA: Readonly<Record<string, string>> = {
    qatal: 'perfecto',
    yiqtol: 'imperfecto',
    weqatal: 'perfecto consecutivo',
    wayyiqtol: 'imperfecto consecutivo',
};

export function reviewBeforeExport(
    markdown: string,
    options: { citationKeys?: ReadonlyArray<string> } = {},
): ExportFinding[] {
    const texto = markdown ?? '';
    if (!texto.trim()) return [];
    // Lo que está dentro de una cita lo maqueta el exportador (páginas,
    // títulos de obras tal como se publicaron): no se marca.
    const citas = findInlineCitations(texto, options.citationKeys ?? []).map(c => [c.offset, c.end] as const);
    const enCita = (i: number) => citas.some(([a, b]) => i >= a && i < b);
    const out: ExportFinding[] = [
        ...acentos(texto),
        ...doblesPuntos(texto),
        ...parentesis(texto),
        ...nomenclatura(texto),
        ...formasDeAutor(texto),
        ...mecanicos(texto),
    ].filter(f => f.kind === 'unbalanced-paren' || !enCita(f.offset));
    return out.sort((a, b) => a.offset - b.offset);
}

/**
 * El texto con el aviso corregido, o `null` si no tiene reemplazo o si el
 * texto ya cambió en ese lugar (el aviso quedó viejo: se vuelve a revisar).
 */
export function applyExportFinding(markdown: string, finding: ExportFinding): string | null {
    if (finding.replace === null) return null;
    if (markdown.slice(finding.offset, finding.offset + finding.find.length) !== finding.find) return null;
    return markdown.slice(0, finding.offset) + finding.replace + markdown.slice(finding.offset + finding.find.length);
}

/**
 * Las clases que se corrigen sin decidir nada: una tilde, un punto de más,
 * una raya corta, una coma, la grave del griego. La nomenclatura y la forma
 * de autor proponen, pero las aplica el estudiante una por una.
 */
export const MECHANICAL_EXPORT_KINDS: ReadonlySet<ExportReviewKind> = new Set([
    'accent', 'double-period', 'hyphen-range', 'punctuation', 'greek-grave',
]);

/**
 * Aplica todos los avisos mecánicos. Revisa de nuevo después de cada uno: una
 * corrección cambia las posiciones de los que siguen.
 */
export function applyMechanicalExportFindings(
    markdown: string,
    options: { citationKeys?: ReadonlyArray<string> } = {},
): { markdown: string; applied: number } {
    let texto = markdown;
    let applied = 0;
    // Tope por las dudas: cada vuelta corrige uno y nunca agrega avisos.
    for (let vuelta = 0; vuelta < 500; vuelta++) {
        const siguiente = reviewBeforeExport(texto, options).find(f => MECHANICAL_EXPORT_KINDS.has(f.kind) && f.replace !== null);
        const nuevo = siguiente ? applyExportFinding(texto, siguiente) : null;
        if (!nuevo || nuevo === texto) break;
        texto = nuevo;
        applied++;
    }
    return { markdown: texto, applied };
}

function contexto(texto: string, offset: number, largo: number): string {
    const desde = Math.max(0, offset - 40);
    const hasta = Math.min(texto.length, offset + largo + 40);
    return `${desde > 0 ? '…' : ''}${texto.slice(desde, hasta).replace(/\s+/g, ' ').trim()}${hasta < texto.length ? '…' : ''}`;
}

function aviso(texto: string, kind: ExportReviewKind, offset: number, find: string, replace: string | null): ExportFinding {
    return { kind, offset, find, replace, context: contexto(texto, offset, find.length) };
}

function conLaMismaCaja(original: string, corregida: string): string {
    if (original === original.toUpperCase()) return corregida.toUpperCase();
    if (original[0] === original[0]!.toUpperCase()) return corregida[0]!.toUpperCase() + corregida.slice(1);
    return corregida;
}

function acentos(texto: string): ExportFinding[] {
    const out: ExportFinding[] = [];
    for (const m of texto.matchAll(/(?<![\p{L}\p{M}])[A-Za-zÑñ]+(?![\p{L}\p{M}])/gu)) {
        const corregida = SIN_TILDE[m[0].toLowerCase()];
        if (corregida) out.push(aviso(texto, 'accent', m.index!, m[0], conLaMismaCaja(m[0], corregida)));
    }
    return out;
}

function doblesPuntos(texto: string): ExportFinding[] {
    return [...texto.matchAll(/(?<!\.)\.\.(?!\.)/g)].map(m => aviso(texto, 'double-period', m.index!, '..', '.'));
}

/** Por párrafo: un paréntesis de más o de menos no se corrige solo, se avisa. */
function parentesis(texto: string): ExportFinding[] {
    const out: ExportFinding[] = [];
    let inicio = 0;
    for (const parrafo of texto.split(/\n\s*\n/)) {
        const abre = (parrafo.match(/\(/g) ?? []).length;
        const cierra = (parrafo.match(/\)/g) ?? []).length;
        const offset = texto.indexOf(parrafo, inicio);
        if (abre !== cierra && parrafo.trim()) {
            out.push({ kind: 'unbalanced-paren', offset, find: parrafo.trim().slice(0, 60), replace: null, context: parrafo.trim().slice(0, 140) });
        }
        inicio = offset + parrafo.length;
    }
    return out;
}

/**
 * Regla 22: una sola nomenclatura. Una sigla sin glosa —sin un paréntesis
 * cerca que diga perfecto o imperfecto— en un trabajo que usa perfecto o
 * imperfecto. «sujeto–yiqtol (sujeto seguido de imperfecto)» está glosado y
 * no se marca. El reemplazo se propone; lo aplica el estudiante.
 */
function nomenclatura(texto: string): ExportFinding[] {
    if (!/\b(?:im)?perfectos?\b/i.test(texto)) return [];
    const out: ExportFinding[] = [];
    for (const m of texto.matchAll(/\b(qatal|yiqtol|weqatal|wayyiqtol)\b/gi)) {
        const despues = texto.slice(m.index! + m[0].length, m.index! + m[0].length + 60);
        const glosa = despues.match(/^[^.;\n]{0,40}?\(([^)]*)\)/)?.[1] ?? '';
        if (/(?:im)?perfecto/i.test(glosa)) continue;
        // «el weqatal consecutivo» → «el perfecto consecutivo», no «perfecto consecutivo consecutivo».
        const termino = /^\s+consecutiv[oa]s?\b/i.test(despues)
            ? NOMENCLATURA[m[0].toLowerCase()]!.replace(/\s+consecutivo$/, '')
            : NOMENCLATURA[m[0].toLowerCase()]!;
        out.push(aviso(texto, 'nomenclature', m.index!, m[0], conLaMismaCaja(m[0], termino)));
    }
    return out;
}

/** «Waltke-O’Connor» cuando el trabajo también escribe «Waltke y O’Connor»: una sola forma. */
function formasDeAutor(texto: string): ExportFinding[] {
    const out: ExportFinding[] = [];
    for (const m of texto.matchAll(/(?<![\p{L}-])(\p{Lu}[\p{L}’']+)-(\p{Lu}[\p{L}’']+)(?![\p{L}-])/gu)) {
        const conY = [`${m[1]} y ${m[2]}`, `${m[1]} and ${m[2]}`].find(f => texto.includes(f));
        if (conY) out.push(aviso(texto, 'author-form', m.index!, m[0], conY));
    }
    return out;
}

/** Los mecánicos de la revisión de cada versículo, ubicados en el documento. */
function mecanicos(texto: string): ExportFinding[] {
    const out: ExportFinding[] = [];
    const desde = new Map<string, number>();
    for (const f of mechanicalProseFindings(texto)) {
        const i = texto.indexOf(f.excerpt, desde.get(f.excerpt) ?? 0);
        if (i < 0) continue;
        desde.set(f.excerpt, i + f.excerpt.length);
        out.push(aviso(texto, f.kind as ExportReviewKind, i, f.excerpt, f.replacement ?? null));
    }
    return out;
}
