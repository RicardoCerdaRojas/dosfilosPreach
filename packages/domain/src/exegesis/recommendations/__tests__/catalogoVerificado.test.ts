import { describe, it, expect } from 'vitest';
import { getSourceRecommendations, VERIFIED_BOOKS } from '../index';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../../entities/SourceType';
import { catalogCandidates, catalogEvaluationFor } from '../../services/bibliographyCandidates';
import { findLibraryResourceForRecommendation } from '../libraryMatch';
import { BIBLE_CANON } from '../../../bible/canon/BibleCanon';
import { mergeBibliographyCandidates } from '../../services/projectBibliography';
import { JAMES_RECOMMENDATIONS } from '../nt/james';
import { SECOND_PETER_RECOMMENDATIONS } from '../nt/2peter';
import { JONAH_RECOMMENDATIONS } from '../ot/jonah';
import { EZRA_RECOMMENDATIONS } from '../ot/ezra';
import { NEHEMIAH_RECOMMENDATIONS } from '../ot/nehemiah';
import { RUTH_RECOMMENDATIONS } from '../ot/ruth';

/**
 * Etapa 2c: el catálogo de títulos reconocidos no se escribe de memoria.
 * Cada obra de los libros verificados trae el registro con que coincidió
 * (scripts/catalog/verificar-catalogo.ts), y ningún ISBN del catálogo es
 * un número mal formado.
 */
const VERIFICADOS = [JAMES_RECOMMENDATIONS, SECOND_PETER_RECOMMENDATIONS, JONAH_RECOMMENDATIONS, EZRA_RECOMMENDATIONS, NEHEMIAH_RECOMMENDATIONS, RUTH_RECOMMENDATIONS];
const obras = (b: typeof VERIFICADOS[number]) => Object.values(b.bySourceType).flat();
const TIPOS = Object.keys(SOURCE_TYPE_CATALOG) as SourceType[];

/** El dígito de control del ISBN-13. */
const isbnValido = (isbn: string) => /^97[89]\d{10}$/.test(isbn)
    && [...isbn].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0;

describe('catálogo verificado', () => {
    it('los libros verificados son los de su archivo, y cada obra trae su registro', () => {
        expect(VERIFICADOS.map(b => b.bookId).sort()).toEqual([...VERIFIED_BOOKS].sort());
        for (const b of VERIFICADOS) {
            const xs = obras(b);
            expect(xs.length).toBeGreaterThan(8);
            for (const r of xs) {
                expect(r.verified, `${b.bookId} · ${r.author} · ${r.title}`).toBeDefined();
                expect(r.verified!.ref).toMatch(/^(\/works\/OL\d+W|\/isbn\/\d{13}|doi:10\.\S+|bne:\d+)$/);
                expect(r.verified!.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        }
    });

    it('todo el catálogo trae su registro, salvo las obras pendientes de verificar a mano (lista cerrada)', () => {
        // Obras reales que las bases abiertas no tienen con ese año o título
        // (revisado a mano el 2026-10-24). Una obra nueva sin registro rompe esta prueba.
        const PENDIENTES = new Set([
            'Goldingay, John · 2009', 'Joüon, Paul; Muraoka, Takamitsu · 2006', 'Wright, N. T. · 2002',
            'Dunn, James D. G. · 1988', 'Philo of Alexandria · 1993', 'Caird, G. B. · 1959',
            'Aland, Barbara; Aland, Kurt; Karavidopoulos, Johannes; Martini, Carlo M.; Metzger, Bruce M. (eds.) · 2017',
        ]);
        const sinRegistro = new Set<string>();
        for (const book of BIBLE_CANON.map(b => b.id)) {
            for (const t of TIPOS) for (const r of getSourceRecommendations(book, t, 'es')) if (!r.verified) sinRegistro.add(`${r.author} · ${r.year}`);
        }
        expect([...sinRegistro].sort()).toEqual([...PENDIENTES].sort());
    });

    it('ningún ISBN del catálogo entero está mal formado (Holmes traía el de otra obra: se corrigió con el registro)', () => {
        const malos: string[] = [];
        for (const book of BIBLE_CANON.map(b => b.id)) {
            for (const t of TIPOS) for (const r of getSourceRecommendations(book, t, 'es')) if (r.isbn && !isbnValido(r.isbn)) malos.push(`${r.author}: ${r.isbn}`);
        }
        expect(malos).toEqual([]);
        expect(getSourceRecommendations('JAS', 'primary-source-ancient', 'en').find(r => r.author.startsWith('Holmes'))?.isbn).toBe('9780801034688');
    });

    it('cada lista mezcla enfoques, y no rotula tradiciones (juicio del estudiante)', () => {
        for (const b of VERIFICADOS) {
            const xs = obras(b);
            expect(new Set(xs.map(r => r.approach).filter(Boolean)).size, b.bookId).toBeGreaterThanOrEqual(3);
            expect(xs.some(r => r.approach === 'historical-critical'), b.bookId).toBe(true);
            expect(xs.some(r => r.approach === 'historical-grammatical' || r.approach === 'canonical-theological'), b.bookId).toBe(true);
            expect(xs.every(r => !('tradition' in r)), b.bookId).toBe(true);
        }
    });

    it('la misma serie cae siempre en el mismo tipo (NICOT, NICNT, BECNT, PNTC, NAC y ZEC son expositivos)', () => {
        const expositivas = /^(NICOT|NICNT|BECNT|PNTC|NAC\b|ZECOT|ZECNT|Hearing the Message)/;
        for (const b of VERIFICADOS) {
            for (const r of b.bySourceType['commentary-critical'] ?? []) expect(r.series ?? '', `${r.author} · ${r.series}`).not.toMatch(expositivas);
        }
    });

    it('la sigla de una serie no liga una obra al libro de otro autor, ni una palabra común a cualquier libro', () => {
        const trampas = [
            { id: 'lane', title: 'Hebrews 1-8 (WBC 47A)', author: 'William L. Lane' },
            { id: 'kost', title: 'Invitation to Biblical Interpretation', author: 'Andreas J. Köstenberger' },
            { id: 'two', title: 'Two Views on Women in Ministry', author: 'James R. Beck' },
            { id: 'ot', title: 'The Old Testament in the New', author: 'Steve Moyise' },
            { id: 'na28', title: 'Novum Testamentum Graece', author: 'Nestle-Aland' },
            { id: 'niv', title: 'NIV Study Bible', author: 'Kenneth Barker' },
            { id: 'black', title: 'Black Theology', author: 'James H. Cone' },
            // Sin autor: «The» o «Two» (primera palabra de una serie) no pueden bastar.
            { id: 'sin-autor', title: 'The Two Ways in Early Christian Literature' },
        ];
        const mal: string[] = [];
        for (const b of VERIFICADOS) for (const r of obras(b)) {
            const x = findLibraryResourceForRecommendation(r, trampas);
            if (x) mal.push(`${r.author} → ${x.title}`);
        }
        expect(mal).toEqual([]);
        // La sigla sigue sirviendo con el mismo autor.
        const williamson = NEHEMIAH_RECOMMENDATIONS.bySourceType['commentary-critical']!.find(r => r.author.startsWith('Williamson'))!;
        expect(findLibraryResourceForRecommendation(williamson, [{ id: 'w', title: 'Ezra, Nehemiah (WBC 16)', author: 'H. G. M. Williamson' }])?.id).toBe('w');
    });

    it('Nehemías trae comentarios técnicos, expositivos para la serie y una edición en español', () => {
        const neh = NEHEMIAH_RECOMMENDATIONS.bySourceType;
        expect(neh['commentary-critical']!.some(r => r.author.startsWith('Williamson'))).toBe(true);
        expect(neh['commentary-expository']!.length).toBeGreaterThanOrEqual(4);
        expect(obras(NEHEMIAH_RECOMMENDATIONS).some(r => r.languages.includes('es'))).toBe(true);
    });

    it('la candidata del catálogo lleva el ISBN o el DOI del registro; el enfoque queda como sugerencia, no como evaluación', () => {
        const cands = catalogCandidates(['JAS'], [], 'es');
        const laws = cands.find(c => c.title.startsWith('Does Scripture Speak in Vain'))!;
        expect(laws).toMatchObject({ sourceType: 'journal-article', identifiers: { doi: '10.1017/s002868850001626x' } });
        const fichas = mergeBibliographyCandidates([], cands, (() => { let n = 0; return () => `f${++n}`; })());
        const johnson = fichas.find(f => f.title.startsWith('The Letter of James: A New Translation'))!;
        expect(johnson.evaluation).toBeUndefined();
        expect(johnson.identifiers?.isbn).toBe('9780385413602');
        // La propuesta del curador, para mostrar como sugerida.
        expect(catalogEvaluationFor(johnson, ['JAS'])).toEqual({ approach: 'socio-rhetorical' });
        expect(catalogEvaluationFor({ title: 'Una obra que no está', author: 'Nadie', sourceType: null }, ['JAS'])).toEqual({});
    });
});
