/**
 * Encabezados numerados: «VIII. The Genitive (True) Case», «2. CAUSAL
 * SENTENCES.». La extracción marca algunos como título y deja a sus hermanos
 * como texto común. Medido en Robertson (2026-11-23): de los casos, VIII
 * (genitivo) llegó como `###` y IX a XII (ablativo, locativo, instrumental,
 * dativo) como un párrafo más; en MODE, «2. CAUSAL SENTENCES» llegó como
 * título y 5 a 9 como texto. Sin los hermanos, la subsección del primero se
 * arrastra por todo lo que sigue, o se pierde.
 *
 * Regla: un párrafo que EMPIEZA con el número que sigue al de un encabezado
 * numerado de la ruta, con el mismo estilo, es su hermano. Solo dos estilos,
 * los que no se confunden con una enumeración del cuerpo:
 *   - romano en mayúsculas seguido de un título con mayúscula («IX. The…»);
 *   - arábigo seguido de un título en MAYÚSCULAS («5. TEMPORAL CLAUSES.»), y
 *     solo si el encabezado de la ruta también está en mayúsculas.
 * Una lista del cuerpo («2. El verbo indica…») no cumple ninguno de los dos.
 */

export interface Numeracion {
    estilo: 'romano' | 'arabigo' | 'parrafo' | 'referencia';
    /** En una referencia, capítulo × 1000 + versículo del comienzo. */
    n: number;
    /** El título (sin lo que va entre paréntesis) está en mayúsculas. */
    mayusculas: boolean;
    /** Solo en una referencia: dónde termina su rango, y el libro que la precede («JAMES»), en minúsculas. */
    fin?: number;
    libro?: string;
}

/** Cuánto puede saltar la numeración: en MODE, del 2 al 5 (el 3 y el 4 no llegaron en la extracción). */
export const SALTO_MAXIMO_DE_LA_NUMERACION = 3;
/** Largo máximo del título de un encabezado que va dentro de un párrafo. */
export const LARGO_MAXIMO_DEL_TITULO = 120;

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function romano(s: string): number | null {
    if (!/^[IVXLC]{1,7}$/.test(s)) return null;
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        const v = ROMANOS[s[i]!]!;
        const sig = ROMANOS[s[i + 1] ?? ''] ?? 0;
        total += v < sig ? -v : v;
    }
    // Solo la forma canónica («IIII» o «IC» no son números de sección).
    return aRomano(total) === s ? total : null;
}

function aRomano(n: number): string {
    const tabla: Array<[number, string]> = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of tabla) while (n >= v) { s += r; n -= v; }
    return s;
}

/** Las letras latinas del título, sin lo que va entre paréntesis (el griego, «Oratio Obliqua»). */
function letrasDelTitulo(resto: string): string {
    return resto.replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z]/g, '');
}

/** El número con que empieza un encabezado: «VIII. », «5. », «§ 11. », «§8. ». */
const PREFIJO = /^(§\s*\d{1,3}\.?|[IVXLC]{1,7}\.|\d{1,2}\.)\s+/;

/**
 * Una referencia al comienzo del título, con su rango: «7.53-8.11 Pericope
 * of the Adulteress», «8.44 οὐκ ἔστηκεν», «1:12–27 The Gospel Promise»,
 * «JAMES 2:1–7». Una numeración decimal de secciones («1.2 El aoristo») tiene
 * la misma forma y el mismo orden. «1.2.1» no es una referencia.
 */
const REFERENCIA = /^(?:((?:[1-3]\s?)?[A-Za-zÀ-ÿ]{2,15}\.?)\s+)?(\d{1,3})[.:](\d{1,3})(?:\s*[-–]\s*(?:(\d{1,3})[.:])?(\d{1,3}))?(?![.:]?\d)/;

/** Palabras que preceden un número sin ser un libro bíblico: «Vol. 2:3», «Section 2.3». */
const NO_ES_LIBRO = /^(vol|volume|volumen|section|sección|seccion|chapter|capítulo|capitulo|cap|part|parte|page|página|pagina|pp?|fig|figure|figura|table|tabla|art|no|nº|ed|edition|edición)\.?$/i;

function referenciaDe(t: string): Numeracion | null {
    const m = t.match(REFERENCIA);
    if (!m || (m[1] && NO_ES_LIBRO.test(m[1].trim()))) return null;
    const cap = Number(m[2]), ver = Number(m[3]);
    const capFin = m[4] ? Number(m[4]) : cap;
    const verFin = m[5] ? Number(m[5]) : ver;
    const n = cap * 1000 + ver;
    const fin = Math.max(n, capFin * 1000 + verFin);
    return { estilo: 'referencia', n, fin, mayusculas: false, libro: (m[1] ?? '').toLowerCase().replace(/[\s.]/g, '') };
}

/** La numeración de un título, o null si no empieza con un número de sección. */
export function numeracionDe(titulo: string): Numeracion | null {
    const t = titulo.trim();
    const ref = referenciaDe(t);
    if (ref) return ref;
    const m = t.match(PREFIJO);
    if (!m || t.length === m[0].length) return null;
    const resto = t.slice(m[0].length);
    const letras = letrasDelTitulo(resto);
    const mayusculas = letras.length >= 3 && letras === letras.toUpperCase();
    // El párrafo con «§» (Hodge: «§8. El esquema Agustiniano.», «§ 11. El séptimo mandamiento.»).
    if (m[1]!.startsWith('§')) return { estilo: 'parrafo', n: Number(m[1]!.replace(/\D/g, '')), mayusculas };
    // Un título tiene palabras: «3. LXX. Cf. Gen. 4:3.», una nota al pie, no
    // (revisión adversarial). «7. WISHES.» sí.
    if (letras.length < 5) return null;
    // Una cita no es un título: «II. Thess. 2:3 speaks of…», «II. Kings 5»,
    // «I. Cor. 13:4», y tampoco una inicial: «C. H. Dodd».
    if (/^\p{Lu}\p{L}{0,7}\.?\s+\d/u.test(resto) || /^\p{Lu}\p{L}{0,3}\.(\s|$)/u.test(resto)) return null;
    if (/^\d/.test(m[1]!)) return { estilo: 'arabigo', n: Number(m[1]!.slice(0, -1)), mayusculas };
    const n = romano(m[1]!.slice(0, -1));
    // Una abreviatura sola tras el romano es una cita cortada en su punto: «II. Thess.».
    if (n === null || !/^\p{Lu}/u.test(resto) || /^\p{Lu}\p{L}{0,6}\.$/u.test(resto)) return null;
    return { estilo: 'romano', n, mayusculas };
}

/**
 * Si `candidato` es el hermano siguiente de `previo`. El tope de salto es lo
 * que distingue un romano de una letra de lista: «C. Los objetos del
 * bautismo» (Ryrie) no es el CENTÉSIMO hermano de «III. LA ORDENANZA».
 * `marcado`: el candidato ya llegó como título; entonces el arábigo no
 * necesita mayúsculas («1. *Sufficient Data Base*», «2. *Semantic…*» en Wallace),
 * pero sí las MISMAS que su hermano: «4. Voice» no es hermano de «3. THE VERB»
 * ni «2. Josefo» de «1. INTRODUCCIÓN» (revisión adversarial).
 */
export function sigueLaNumeracion(previo: Numeracion, candidato: Numeracion, marcado = false): boolean {
    if (previo.estilo !== candidato.estilo) return false;
    // Una referencia es hermana de la anterior si empieza DESPUÉS de que esta
    // termina; dentro de su rango es su hija («8.2» dentro de «7.53-8.11»). Sin
    // tope de salto, y solo entre títulos marcados: no se promueve del texto.
    if (candidato.estilo === 'referencia') return marcado && previo.libro === candidato.libro && candidato.n > (previo.fin ?? previo.n);
    if (candidato.n <= previo.n || candidato.n > previo.n + SALTO_MAXIMO_DE_LA_NUMERACION) return false;
    if (marcado) return previo.mayusculas === candidato.mayusculas;
    if (candidato.estilo === 'arabigo') return previo.mayusculas && candidato.mayusculas;
    if (candidato.estilo === 'parrafo') return true;
    return previo.mayusculas === candidato.mayusculas;
}

/**
 * El título del encabezado numerado con que empieza un párrafo: la línea
 * entera, o hasta el primer punto que cierra el título cuando sigue el texto
 * en el mismo renglón («IX. The Ablative (…) Case (…). The treatment…»).
 */
export function tituloAlComienzo(parrafo: string): string | null {
    const linea = parrafo.trimStart().split('\n')[0]!.trim();
    const m = linea.match(PREFIJO);
    if (!m) return null;
    let profundidad = 0;
    for (let i = m[0].length; i < linea.length && i <= LARGO_MAXIMO_DEL_TITULO; i++) {
        const c = linea[i]!;
        if (c === '(') profundidad++;
        else if (c === ')') profundidad = Math.max(0, profundidad - 1);
        else if (c === '.' && profundidad === 0 && (i === linea.length - 1 || /\s/.test(linea[i + 1]!))) return linea.slice(0, i + 1);
    }
    return linea.length <= LARGO_MAXIMO_DEL_TITULO ? linea : null;
}

export interface TramoNumerado {
    /** El encabezado que abre el tramo, o null para el texto antes del primero. */
    titulo: string | null;
    /** El lugar de la ruta que toma el encabezado (el de su hermano); null para el texto de antes. */
    indice: number | null;
    /** Desde dónde va el tramo dentro del cuerpo. */
    desde: number;
    hasta: number;
}

/**
 * Corta un cuerpo en los párrafos que abren un hermano numerado de algún
 * encabezado de la ruta, del más profundo al más alto: con «THE CASES › VIII.
 * The Genitive › 1. MEANING…», «IX. The Ablative» es hermano de VIII, no del
 * arábigo. Un romano también cuenta tras un salto de línea simple
 * («…texto\nIX. The Ablative Case.»): la extracción no siempre deja el
 * renglón en blanco. Cada hermano encontrado entra en la ruta para el siguiente.
 */
export function cortarPorHermanosNumerados(cuerpo: string, ruta: ReadonlyArray<string>): TramoNumerado[] {
    const tramos: TramoNumerado[] = [{ titulo: null, indice: null, desde: 0, hasta: cuerpo.length }];
    const local = [...ruta];
    if (!local.some(h => numeracionDe(h))) return tramos;
    const enBlanco = new Set([0, ...[...cuerpo.matchAll(/\n[ \t]*\n/g)].map(m => m.index! + m[0].length)]);
    const simples = [...cuerpo.matchAll(/\n/g)].map(m => m.index! + 1).filter(i => !enBlanco.has(i));
    const comienzos = [...new Set([...enBlanco, ...simples])].sort((a, b) => a - b);
    for (const desde of comienzos) {
        if (desde < tramos[tramos.length - 1]!.desde) continue;
        const titulo = tituloAlComienzo(cuerpo.slice(desde, desde + LARGO_MAXIMO_DEL_TITULO + 40));
        const num = titulo ? numeracionDe(titulo) : null;
        if (!titulo || !num || num.estilo === 'referencia') continue;
        if (!enBlanco.has(desde) && num.estilo !== 'romano') continue;
        let indice: number | null = null;
        for (let i = local.length - 1; i >= 0 && indice === null; i--) {
            const otro = numeracionDe(local[i]!);
            if (otro && sigueLaNumeracion(otro, num)) indice = i;
        }
        if (indice === null) continue;
        tramos[tramos.length - 1]!.hasta = desde;
        tramos.push({ titulo, indice, desde, hasta: cuerpo.length });
        local.length = indice;
        local.push(titulo);
    }
    // Sin texto antes del primer hermano, el primer tramo sobra.
    return tramos.filter(t => t.titulo !== null || cuerpo.slice(t.desde, t.hasta).trim().length > 0);
}

/**
 * Dónde va un encabezado numerado que llega MARCADO: en el lugar de su
 * hermano anterior si está en la ruta, aunque la extracción le dio otro nivel
 * («## VII. The Accusative» y «### VIII. The Genitive» en Robertson). Si hay
 * varios, el inmediato anterior (n − 1); si no, el más profundo: con «2. The
 * Text › 1. Greek» en la ruta, «3. Next» va en el lugar de «2. The Text».
 * null si no tiene hermano anterior en la ruta.
 */
export function lugarDelHermano(ruta: ReadonlyArray<string>, titulo: string): number | null {
    const num = numeracionDe(titulo);
    if (!num) return null;
    // Una referencia: el primer título, desde arriba, cuyo rango ya terminó.
    // Con «JOHN › 7.53-8.11 › 8.10» en la ruta, «8.16» queda fuera de la
    // perícopa y es hermano de ella, no de «8.10» (Metzger).
    if (num.estilo === 'referencia') {
        for (let i = 0; i < ruta.length; i++) {
            const otro = numeracionDe(ruta[i]!);
            if (otro && sigueLaNumeracion(otro, num, true)) return i;
        }
        return null;
    }
    let masProfundo: number | null = null;
    for (let i = ruta.length - 1; i >= 0; i--) {
        const otro = numeracionDe(ruta[i]!);
        if (!otro || !sigueLaNumeracion(otro, num, true)) continue;
        if (otro.n === num.n - 1) return i;
        masProfundo ??= i;
    }
    return masProfundo;
}
