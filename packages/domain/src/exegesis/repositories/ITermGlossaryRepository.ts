import type { GlossaryTerm, TermGlossary } from '../entities/TermGlossary';

/**
 * El glosario del usuario: un documento por persona, no por trabajo.
 *
 * Las palabras que no son suyas no lo son en ningún trabajo. Guardarlo
 * por trabajo obligaría a repetir la misma lista en cada entrega, y la
 * lista sólo crece con el uso: cada vez que corrige una palabra a mano,
 * esa palabra debería dejar de aparecer en el siguiente.
 */
export interface ITermGlossaryRepository {
    getGlossary(ownerId: string): Promise<TermGlossary | null>;
    saveTerms(ownerId: string, terms: ReadonlyArray<GlossaryTerm>): Promise<TermGlossary>;
}
