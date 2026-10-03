import { describe, it, expect } from 'vitest';
import { citationAnchorFor, declaresNoFolios, type PageNumbering } from '../../outline/pageNumbering';
import { citedLocation } from '../../entities/CanonicalVerseAnalysis';
import { summarizeCitationAnchoring } from '../citationAnchoring';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';

/**
 * Pendiente 8 de la fase del TP de Santiago: libros sin páginas impresas
 * (Wallace en español, Farfán). «hoja 87» es verdad sobre el archivo pero el
 * lector del trabajo no la encuentra en el ejemplar; «§ 2.3» sí.
 */
const SIN_FOLIOS = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 711, offset: null }] } as unknown as PageNumbering;
const CON_FOLIOS = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 711, offset: -4 }] } as unknown as PageNumbering;

describe('declaresNoFolios', () => {
    it('una numeración con tramos y ninguno con folio declara que no hay páginas', () => {
        expect(declaresNoFolios(SIN_FOLIOS)).toBe(true);
        expect(declaresNoFolios(CON_FOLIOS)).toBe(false);
    });
    it('sin numeración no declara nada: todavía no se sabe', () => {
        expect(declaresNoFolios(null)).toBe(false);
    });
    it('detectada y sin confirmar tampoco: puede ser una lectura fallida', () => {
        expect(declaresNoFolios({ ...SIN_FOLIOS, origin: 'detected' } as PageNumbering)).toBe(false);
    });
});

describe('citationAnchorFor — por sección en un libro sin folios', () => {
    it('con sección: «§ sección», sin la hoja', () => {
        expect(citationAnchorFor({ sheet: 87, section: '2.3 El genitivo' }, SIN_FOLIOS)).toBe('§ 2.3 El genitivo');
    });
    it('sin sección: la hoja, como siempre (el silencio produce una página inventada)', () => {
        expect(citationAnchorFor({ sheet: 87, section: null }, SIN_FOLIOS)).toBe('hoja 87');
    });
    it('un libro con folios sigue con su página', () => {
        expect(citationAnchorFor({ sheet: 87, section: '2.3' }, CON_FOLIOS)).toBe('p. 83, § 2.3');
    });
});

describe('citedLocation', () => {
    const rotulo = (_k: string, p: number, kind: string) => (kind === 'printed' ? `p. ${p}` : `hoja ${p}`);
    it('por sección: «§ …», aunque el modelo repita el «§»', () => {
        expect(citedLocation({ sourceKey: 'W', page: 0, pageKind: 'section', locator: '§ 2.3' }, rotulo)).toBe('§ 2.3');
    });
    it('sección sin locator cae a la hoja: no se inventa', () => {
        expect(citedLocation({ sourceKey: 'W', page: 0, pageKind: 'section' }, rotulo)).toBe('hoja 0');
    });
    it('página impresa', () => {
        expect(citedLocation({ sourceKey: 'W', page: 83, pageKind: 'printed' }, rotulo)).toBe('p. 83');
    });
});

describe('summarizeCitationAnchoring — la sección cuenta como anclada', () => {
    it('se encuentra en el ejemplar', () => {
        const a = {
            ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 14 } as never),
            commentatorEngagement: [{ sourceKey: 'Wallace', page: 0, pageKind: 'section', locator: '2.3', role: 'technical', position: 'x', verbatimQuote: null }],
        } as never;
        const r = summarizeCitationAnchoring([a], [{ citationKey: 'Wallace', displayLabel: 'Wallace', numbering: SIN_FOLIOS }]);
        expect(r.unanchored).toBe(0);
    });
});

describe('revisión adversarial de E3 — la sección en la prosa y en el verificador', () => {
    const REF2 = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 14 } as never;
    const fuente = { sourceKey: 'Wallace', page: 0, pageKind: 'section' as const, locator: '2.3' };

    it('la prosa dice «Wallace, § 2.3», sin repetir la sección', async () => {
        const { renderVerseAnalysisProse } = await import('../renderVerseAnalysisProse');
        const a = {
            ...buildEmptyCanonicalVerseAnalysis(REF2),
            historicalContext: [{ aspect: 'fe', relevance: 'La fe sin obras está muerta.', sources: [fuente] }],
        };
        const prosa = renderVerseAnalysisProse(a as never, 'es');
        expect(prosa).toContain('Wallace, § 2.3)');
        expect(prosa).not.toContain('2.3, 2.3');
    });

    it('el verificador recibe «§ 2.3» y no prioriza por una hoja 0', async () => {
        const { analysisClaimsToCitations } = await import('../analysisClaims');
        const [c] = analysisClaimsToCitations(
            [{ site: 'commentator', path: 'p', claim: 'x', verbatimQuote: null, ...fuente } as never],
            () => null,
        );
        expect(c!.raw).toBe('Wallace, § 2.3');
        expect(c!.evidencePage).toBeNull();
    });
});
