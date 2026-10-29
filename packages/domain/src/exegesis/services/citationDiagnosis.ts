import type { VerifiedCitation } from '../entities/CitationVerification';
import { isCitationAlarm } from './citationReview';
import { namesCitationKey } from './analysisClaims';

/**
 * «Diagnosticar esta cita» (TP #8, fase 8b, D4).
 *
 * En el TP #8 cada alarma se resolvió con Claude al lado: «está en la 170, no
 * en la 171», «la fuente dice A y la oración agrega B», «eso lo dice Mayor,
 * no Adamson», «Adamson lo atribuye a Mayor». Esto clasifica la causa con
 * reglas fijas sobre lo que el verificador ya guardó (la búsqueda en el libro
 * de D1, lo atribuido y el tramo de apoyo de D3) y propone UN remedio con la
 * nota de revisión ya escrita. No llama a ningún modelo.
 *
 * Las causas, en el orden en que se prueban:
 *   1 · está en otra página del libro   → corregir a p. N (si lo hallado dice
 *       la afirmación central; si es algo parecido, `claimCoverage: partial`, es la 2)
 *   3 · otra fuente del corpus lo dice  → cambiar la atribución (con nota)
 *   5 · segunda mano                    → reescribir «según X»
 *   2 · afirmación mixta                → separar la conclusión propia
 *   6 · nadie lo dice                   → quitar la cita
 * La 4 (varias páginas o fuentes) la resuelve el verificador antes (D1) y no
 * llega a ser alarma.
 */
export type CitationCause = 'other-page' | 'mixed-claim' | 'other-source' | 'second-hand' | 'nobody-says-it';

export type CitationRemedy =
    | { kind: 'correct-page'; page: number; pageKind: 'printed' | 'sheet'; label: string }
    | { kind: 'review-with-note'; note: string }
    | { kind: 'remove' };

export interface CitationDiagnosis {
    cause: CitationCause;
    /** Los datos con que la interfaz arma la explicación. */
    detail: {
        foundAt?: string;
        sourceSays?: string;
        sentenceAdds?: string;
        otherSource?: string;
        reportedAuthor?: string;
        /** Hallada en otra página, y además la oración agrega esto propio. */
        ownPart?: string;
    };
    remedy: CitationRemedy;
}

/**
 * El diagnóstico de una alarma, o `null` cuando no es alarma o no hay con qué
 * diagnosticarla (la primera pasada todavía no buscó: sin D1 no se puede
 * afirmar «nadie lo dice»).
 *
 * `knownAuthors`: las claves de cita del corpus, para reconocer la segunda
 * mano («Mayor, Knowling y Ropes entienden…» en la página de Adamson).
 */
export function diagnoseCitation(
    verdict: VerifiedCitation,
    language: 'es' | 'en',
    knownAuthors: ReadonlyArray<string> = [],
): CitationDiagnosis | null {
    if (!isCitationAlarm(verdict.status)) return null;
    const es = language !== 'en';

    // 1 · Otra página: el verificador la halló en el libro, en otra página.
    if (verdict.status === 'page-mismatch' && verdict.matchedPage) {
        const pagina = parseInt(verdict.matchedPage, 10);
        const etiqueta = verdict.matchedPageLabel ?? `p. ${verdict.matchedPage}`;
        const propio = verdict.notFromSource?.trim() || '';
        // …pero lo hallado es solo ALGO PARECIDO: no es la página lo que está
        // mal sino la atribución, y cambiar la página pegaría la etiqueta a
        // otro sitio sin arreglarla. TP #9, 4:15: «El genitivo se manifiesta en
        // el artículo…; el pronombre funciona como sujeto acusativo de «decir»
        // (Robertson, pp. 1069–1070)» halló en la 1067 que el infinitivo perdió
        // sus terminaciones, y el diagnóstico proponía «corregir a p. 1067».
        //
        // Lo decide `claimCoverage` (el juez: ¿el apoyo dice la afirmación
        // central?), no `notFromSource`: casi toda oración trae análisis propio
        // —el prompt no se lo exige a la fuente—, y con esa regla una página
        // realmente equivocada (Adamson 171 → 170, con «lo que confirma su
        // trasfondo sapiencial» agregado) salía «mixta» y escondía la
        // corrección (revisión adversarial).
        if (verdict.claimCoverage === 'partial') {
            // Lo que la fuente dice, con sus palabras: el tramo copiado antes que
            // la paráfrasis del juez.
            const dice = verdict.supportingSpan?.text?.trim() || verdict.takenFromSource?.trim() || '';
            const agrega = propio || verdict.evidence;
            return {
                cause: 'mixed-claim',
                detail: { foundAt: etiqueta, sourceSays: dice, sentenceAdds: agrega },
                remedy: {
                    kind: 'review-with-note',
                    note: es
                        ? `Afirmación mixta: la fuente no dice exactamente eso. Lo más cercano (${etiqueta}) dice «${recortar(dice)}»; «${recortar(agrega)}» es tuyo: va en otra oración, sin la cita, y la cita respalda solo lo que la fuente dice.`
                        : `Mixed claim: the source does not say exactly that. The closest passage (${etiqueta}) says "${recortar(dice)}"; "${recortar(agrega)}" is yours: it goes in another sentence, without the citation, and the citation backs only what the source says.`,
                },
            };
        }
        if (Number.isInteger(pagina) && pagina > 0) {
            return {
                cause: 'other-page',
                // Hallada entera en otra página: se corrige la página. Si además
                // agrega algo propio, se dice aparte («además, X es tuyo»).
                detail: { foundAt: etiqueta, ...(propio ? { ownPart: propio } : {}) },
                remedy: { kind: 'correct-page', page: pagina, pageKind: /\bhoja\b/i.test(etiqueta) ? 'sheet' : 'printed', label: etiqueta },
            };
        }
    }

    // 3 · Otra fuente del corpus lo dice.
    if (verdict.foundInOtherSource) {
        const otra = verdict.foundInOtherSource;
        return {
            cause: 'other-source',
            detail: { otherSource: `${otra.sourceKey}${otra.pageLabel ? `, ${otra.pageLabel}` : ''}` },
            remedy: {
                kind: 'review-with-note',
                note: es
                    ? `Lo dice ${otra.sourceKey}${otra.pageLabel ? ` (${otra.pageLabel})` : ''}, no ${verdict.author}: cambiar la atribución.`
                    : `${otra.sourceKey}${otra.pageLabel ? ` (${otra.pageLabel})` : ''} says it, not ${verdict.author}: change the attribution.`,
            },
        };
    }

    // 5 · Segunda mano: el tramo de apoyo nombra a otro autor del corpus, que
    // la fuente reporta («Mayor, Knowling y Ropes entienden…»).
    const apoyo = verdict.supportingSpan?.text ?? '';
    const reportado = knownAuthors.find(a =>
        // Con mayúsculas: «Mayor» el autor, no «en mayor medida» (revisión de 8b).
        a.trim().length >= 3 && normal(a) !== normal(verdict.author) && namesCitationKey(apoyo, a));
    if (reportado && apoyo) {
        return {
            cause: 'second-hand',
            detail: { reportedAuthor: reportado, sourceSays: apoyo },
            remedy: {
                kind: 'review-with-note',
                note: es
                    ? `Segunda mano: ${verdict.author} atribuye la idea a ${reportado}. Reescribir como «${verdict.author} atribuye a ${reportado}…», sin citar a ${reportado} como leído.`
                    : `Second-hand: ${verdict.author} attributes the idea to ${reportado}. Rewrite as "${verdict.author} attributes to ${reportado}…", without citing ${reportado} as read.`,
            },
        };
    }

    // 2 · Afirmación mixta: la fuente sostiene una parte (hay tramo de apoyo)
    // y la oración agrega algo que la fuente no dice.
    if (apoyo && (verdict.status === 'fuzzy-low' || verdict.status === 'not-found')) {
        const atribuido = verdict.takenFromSource?.trim() || apoyo;
        return {
            cause: 'mixed-claim',
            detail: { sourceSays: atribuido, sentenceAdds: verdict.notFromSource?.trim() || verdict.evidence },
            remedy: {
                kind: 'review-with-note',
                note: es
                    ? `Afirmación mixta: la fuente dice «${recortar(atribuido)}»; el resto es conclusión propia y va en otra oración, sin la cita.`
                    : `Mixed claim: the source says "${recortar(atribuido)}"; the rest is our own conclusion and goes in another sentence, without the citation.`,
            },
        };
    }

    // 6 · Nadie lo dice: se leyó la página, sus vecinas y el libro entero.
    if (verdict.bookSearch === 'not-in-book') {
        return { cause: 'nobody-says-it', detail: {}, remedy: { kind: 'remove' } };
    }
    return null;
}

function normal(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function recortar(s: string, max = 160): string {
    const t = s.trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
