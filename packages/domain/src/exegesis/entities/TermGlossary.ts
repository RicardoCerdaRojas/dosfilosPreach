/**
 * Las palabras que el trabajo NO debe usar, y por cuáles cambiarlas.
 *
 * Sale de una lectura real. En el trabajo de Salmo 23:1–3 el autor fue
 * tachando a mano términos que no eran suyos: «tronco» por «conjugación»
 * —una expresión que ni siquiera entendió al leerla—, «atestiguada» por
 * «documentada», y varios calcos del inglés que un hispanohablante de
 * Chile no escribe. Ninguno era un error de contenido: eran palabras de
 * otro puestas en su boca.
 *
 * Por qué no basta con pedírselo al modelo en el prompt: se le pide, y
 * casi siempre obedece. «Casi siempre» significa que el autor tiene que
 * releer buscando, que es justo el trabajo que no va a hacer en la
 * entrega número doce. Por eso el glosario viaja al prompt Y se comprueba
 * sobre el texto después.
 */

export interface GlossaryTerm {
    /** La palabra o expresión a evitar, tal como el autor la escribiría. */
    avoid: string;
    /** Por cuál cambiarla. Vacío cuando el autor sólo quiere que desaparezca. */
    prefer?: string;
    /** Por qué. Se muestra al revisar y viaja al prompt como razón. */
    note?: string;
}

export interface TermGlossary {
    ownerId: string;
    terms: ReadonlyArray<GlossaryTerm>;
    updatedAt: Date;
}

/** Tope de términos. Un glosario más largo que esto no se revisa: se ignora. */
export const MAX_GLOSSARY_TERMS = 60;

/** Dónde aparece un término del glosario dentro de un texto. */
export interface GlossaryHit {
    term: GlossaryTerm;
    /** Posición en el texto original, para poder señalarla. */
    at: number;
    /** El texto tal como aparece, que puede diferir en mayúsculas o tildes. */
    matched: string;
    /** El renglón donde cae, para reconocerlo sin abrir el documento. */
    context: string;
}

/**
 * Busca los términos del glosario en un texto.
 *
 * Compara sin tildes ni mayúsculas —el autor escribe «Atestiguada» al
 * empezar una oración— y exige límite de palabra: «tronco» no debe saltar
 * dentro de «troncos» si el autor escribió el singular... salvo que la
 * forma plural también sea suya, y por eso el límite se aplica al
 * PRINCIPIO y se permite el sufijo: «tronco» encuentra «troncos», y
 * «anclada» encuentra «ancladas», que es lo que el autor espera.
 */
export function findGlossaryHits(
    text: string,
    terms: ReadonlyArray<GlossaryTerm>,
): GlossaryHit[] {
    if (!text) return [];
    const plano = fold(text);
    const out: GlossaryHit[] = [];

    for (const term of terms.slice(0, MAX_GLOSSARY_TERMS)) {
        const aguja = fold(term.avoid.trim());
        if (aguja.length < 3) continue;

        let desde = 0;
        for (;;) {
            const at = plano.indexOf(aguja, desde);
            if (at === -1) break;
            desde = at + aguja.length;
            if (!empiezaPalabra(plano, at)) continue;
            out.push({
                term,
                at,
                matched: text.slice(at, at + aguja.length),
                context: renglonDe(text, at),
            });
        }
    }
    return out.sort((a, b) => a.at - b.at);
}

/** Cuántas veces aparece cada término, para contarlo de un vistazo. */
export function countGlossaryHits(hits: ReadonlyArray<GlossaryHit>): Map<string, number> {
    const out = new Map<string, number>();
    for (const hit of hits) out.set(hit.term.avoid, (out.get(hit.term.avoid) ?? 0) + 1);
    return out;
}

/**
 * Sin tildes y en minúsculas, conservando la longitud.
 *
 * La longitud importa: las posiciones del texto plegado tienen que servir
 * para cortar el texto ORIGINAL, que es lo que se le muestra al autor.
 * Por eso se normaliza descomponiendo y quitando las marcas una a una en
 * lugar de reemplazar caracteres.
 */
function fold(input: string): string {
    return [...input.normalize('NFD')]
        .filter(c => !/[̀-ͯ]/.test(c))
        .join('')
        .toLowerCase();
}

function empiezaPalabra(texto: string, at: number): boolean {
    if (at === 0) return true;
    return !/[\p{L}\p{N}]/u.test(texto[at - 1]!);
}

function renglonDe(texto: string, at: number): string {
    const inicio = texto.lastIndexOf('\n', at) + 1;
    const fin = texto.indexOf('\n', at);
    return texto.slice(inicio, fin === -1 ? texto.length : fin).trim();
}
