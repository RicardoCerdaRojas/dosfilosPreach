/**
 * Detalles de presentación de «Consultar» (rediseño, 2026-10-17): puros, para
 * poder probarlos.
 */

/**
 * La sección de un fragmento, corta y sin repeticiones: «JAMES › JAMES ›
 * JAMES» → «James»; «The Book of James—A New Perspective › 22. Paragraph 22»
 * → «22. Paragraph 22» (el título del libro ya está en la ficha). A lo sumo
 * los dos últimos niveles.
 */
export function seccionCorta(seccion: string, tituloDelLibro = ''): string {
    const plegar = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const titulo = plegar(tituloDelLibro);
    const niveles: string[] = [];
    for (const crudo of seccion.split('›')) {
        const n = crudo.trim();
        if (!n) continue;
        if (titulo && (plegar(n) === titulo || titulo.startsWith(plegar(n)) && plegar(n).length > 12)) continue;
        if (niveles.length && plegar(niveles[niveles.length - 1]!) === plegar(n)) continue;
        niveles.push(n);
    }
    return niveles.slice(-2).map(tituloSiEstaEnMayusculas).join(' › ');
}

/** «HEALING OF THE SICK» → «Healing of the sick»: las mayúsculas sostenidas gritan en una línea de contexto. */
function tituloSiEstaEnMayusculas(s: string): string {
    const letras = s.replace(/[^\p{L}]/gu, '');
    if (letras.length < 4 || letras !== letras.toUpperCase()) return s;
    const minus = s.toLowerCase();
    return minus.charAt(0).toUpperCase() + minus.slice(1);
}

export type GrupoDeFecha = 'hoy' | 'ayer' | 'semana' | 'antes';

/** En qué grupo del historial cae una fecha. */
export function grupoDeFecha(fecha: Date, ahora: Date = new Date()): GrupoDeFecha {
    const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dias = Math.round((dia(ahora) - dia(fecha)) / 86_400_000);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 7) return 'semana';
    return 'antes';
}

/**
 * Cuántas barras (de 3) llena una pertinencia 0–10. Lo que se muestra ya
 * pasó el corte de 7: 7–8 son dos barras, 9–10 tres. Sin puntaje, ninguna.
 */
export function barrasDePertinencia(pertinencia: number | null | undefined): number {
    if (pertinencia === null || pertinencia === undefined) return 0;
    if (pertinencia >= 9) return 3;
    if (pertinencia >= 7) return 2;
    return 1;
}

/** La inicial que va en el lomo del libro: la del apellido del autor, o la del título. */
export function inicialDe(apellido: string, titulo: string): string {
    const base = (apellido || titulo).trim();
    if (/^mc/i.test(base)) return 'Mc';
    return base.charAt(0).toUpperCase() || '·';
}

/**
 * «(Varner, p. 187)» → «p. 187»: la página de una cita armada. Se busca el
 * ANCLA al final («p.», «pp.», «hoja», «s. p.», «§»), no lo que sigue a la
 * primera coma: sin autor, la clave es el título, que puede tener comas
 * («(Santiago: comentario, tomo 2, p. 5)»; revisión adversarial).
 */
export function paginaDeCita(cita: string): string {
    const s = cita.trim().replace(/^\(|\)$/g, '');
    const ancla = s.match(/(?:^|,\s*)((?:pp?\.|hoja|§)\s*[^,]+|s\.\s*p\.)$/i);
    if (ancla) return ancla[1]!.trim();
    const partes = s.split(/,\s*/);
    return (partes[partes.length - 1] ?? s).trim();
}
