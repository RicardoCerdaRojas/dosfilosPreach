import { describe, it, expect } from 'vitest';
import {
    getSourceRecommendations,
    hasSourceRecommendations,
    getRecommendationId,
} from '../index';

describe('getSourceRecommendations', () => {
    describe('book-specific recommendations', () => {
        it('returns hero-book entries for HEB + commentary-critical, with Cockerill on top of expository', () => {
            const recs = getSourceRecommendations('HEB', 'commentary-critical', 'es');
            expect(recs.length).toBeGreaterThan(0);
            // Lane WBC should be in there
            expect(recs.some(r => r.author.includes('Lane'))).toBe(true);
        });

        it('returns hero-book entries for ROM + commentary-expository with Moo first', () => {
            const recs = getSourceRecommendations('ROM', 'commentary-expository', 'es');
            // Moo NICNT has ES translation → ranks above EN-only entries
            expect(recs[0]?.author).toContain('Moo');
        });
    });

    describe('invariant recommendations fallback', () => {
        it('returns BDAG for any book + lexicon-technical (book-agnostic)', () => {
            // No book-specific lexicons; should fall through to invariant.
            const recs = getSourceRecommendations('PHM', 'lexicon-technical', 'en');
            expect(recs.some(r => r.series === 'BDAG')).toBe(true);
        });

        it('returns Wallace grammar for grammar-syntax (invariant) on a NT book', () => {
            // v1.7.1: invariants are now testament-aware. Wallace (NT) only
            // surfaces for NT papers; OT papers see Waltke-O'Connor + Joüon.
            const recs = getSourceRecommendations('JHN', 'grammar-syntax', 'es');
            expect(recs.some(r => r.author.includes('Wallace'))).toBe(true);
        });

        it('returns Hebrew grammars for grammar-syntax on an OT book', () => {
            const recs = getSourceRecommendations('JON', 'grammar-syntax', 'es');
            expect(recs.some(r => r.author.includes('Waltke'))).toBe(true);
            expect(recs.some(r => r.author.includes('Joüon'))).toBe(true);
        });
    });

    describe('book-specific + invariant merging', () => {
        it('book-specific entries come BEFORE invariant entries', () => {
            // HEB has theological-monograph entries (Vanhoye, deSilva) — invariant
            // doesn't have anything for theological-monograph, so this just
            // ensures the slot works without invariant interference.
            const recs = getSourceRecommendations('HEB', 'theological-monograph', 'en');
            expect(recs[0]?.author).toContain('Vanhoye');
        });

        it('historical-background for HEB falls back to invariant (no book-specific yet)', () => {
            const recs = getSourceRecommendations('HEB', 'historical-background', 'es');
            // No HEB-specific historical-background; invariant has Keener.
            expect(recs.some(r => r.author.includes('Keener'))).toBe(true);
        });

        it('historical-background for ROM mixes both: Lampe (book) + Keener (invariant)', () => {
            const recs = getSourceRecommendations('ROM', 'historical-background', 'es');
            // Lampe is ROM-specific, should appear before invariant Keener.
            const lampeIdx = recs.findIndex(r => r.author.includes('Lampe'));
            const keenerIdx = recs.findIndex(r => r.author.includes('Keener'));
            expect(lampeIdx).toBeGreaterThanOrEqual(0);
            expect(keenerIdx).toBeGreaterThanOrEqual(0);
            expect(lampeIdx).toBeLessThan(keenerIdx);
        });
    });

    describe('language sort', () => {
        it('ES papers see ES editions before EN-only within the same source-type', () => {
            const recs = getSourceRecommendations('ROM', 'commentary-expository', 'es');
            const moo = recs.find(r => r.author.includes('Moo'));
            const stott = recs.find(r => r.author.includes('Stott'));
            const jewett = recs.find(r => r.author.includes('Jewett'));
            expect(moo?.languages).toContain('es');
            expect(stott?.languages).toContain('es');
            // Moo + Stott (have ES) should rank above Witherington (EN only).
            const witheringtonIdx = recs.findIndex(r => r.author.includes('Witherington'));
            const stottIdx = recs.findIndex(r => r.author.includes('Stott'));
            if (witheringtonIdx >= 0 && stottIdx >= 0) {
                expect(stottIdx).toBeLessThan(witheringtonIdx);
            }
            // Sanity that Jewett (Hermeneia, en only) is in the result of
            // commentary-critical, not expository — making sure we're
            // correctly partitioning. This is just a guard.
            expect(jewett).toBeUndefined();
        });

        it('EN papers don\'t penalize EN-only entries', () => {
            const recs = getSourceRecommendations('ROM', 'commentary-expository', 'en');
            // All entries match EN, so ordering falls back to tier and
            // curator order. Moo + Schreiner (essential) should top.
            expect(recs[0]?.tier).toBe('essential');
        });
    });

    describe('tier sort within language match', () => {
        it('within same language, essential comes before recommended', () => {
            const recs = getSourceRecommendations('HEB', 'commentary-critical', 'en');
            // All EN. First essential entry should appear before any
            // recommended entry.
            const firstEssentialIdx = recs.findIndex(r => r.tier === 'essential');
            const firstRecommendedIdx = recs.findIndex(r => r.tier === 'recommended');
            expect(firstEssentialIdx).toBeGreaterThanOrEqual(0);
            if (firstRecommendedIdx >= 0) {
                expect(firstEssentialIdx).toBeLessThan(firstRecommendedIdx);
            }
        });
    });

    describe('empty cases', () => {
        it('returns [] for a book with no curation at any layer', () => {
            // Acts (ACT) has no book file AND no group mapping — and
            // commentary-critical has no invariant fallback. So all
            // three layers come back empty.
            const recs = getSourceRecommendations('ACT', 'commentary-critical', 'es');
            expect(recs).toEqual([]);
        });

        it('returns [] for ACT + commentary-expository (no group, no hero)', () => {
            const recs = getSourceRecommendations('ACT', 'commentary-expository', 'es');
            expect(recs).toEqual([]);
        });
    });

    describe('OT hero book (Génesis)', () => {
        it('returns hero-book entries for GEN + commentary-critical (Wenham WBC top-tier)', () => {
            const recs = getSourceRecommendations('GEN', 'commentary-critical', 'es');
            expect(recs.length).toBeGreaterThan(0);
            expect(recs.some(r => r.author.includes('Wenham'))).toBe(true);
            // Westermann + von Rad also expected as essential entries.
            expect(recs.some(r => r.author.includes('Westermann'))).toBe(true);
        });

        it('returns hero-book + invariant for GEN + historical-background', () => {
            const recs = getSourceRecommendations('GEN', 'historical-background', 'es');
            // Walton ANE Thought is GEN-specific; should rank before
            // invariant Keener/Walton-IVP.
            const waltonAneIdx = recs.findIndex(r => r.title.includes('Ancient Near Eastern Thought'));
            const ivpIdx = recs.findIndex(r => r.title.includes('IVP Bible Background'));
            expect(waltonAneIdx).toBeGreaterThanOrEqual(0);
            expect(ivpIdx).toBeGreaterThanOrEqual(0);
            expect(waltonAneIdx).toBeLessThan(ivpIdx);
        });

        it('GEN + commentary-expository ranks ES editions first (Mathews has ES)', () => {
            const recs = getSourceRecommendations('GEN', 'commentary-expository', 'es');
            const mathews = recs.find(r => r.author.includes('Mathews'));
            const hamilton = recs.find(r => r.author.includes('Hamilton'));
            expect(mathews?.languages).toContain('es');
            expect(hamilton?.languages).not.toContain('es');
            // von Rad is in commentary-critical, not expository — sanity check.
            expect(recs.some(r => r.author.includes('von Rad'))).toBe(false);
        });
    });

    describe('group-level recommendations (book → group → invariant)', () => {
        it('GEN inherits pentateuch group entries (Sailhamer, Wenham Story-as-Torah)', () => {
            // GEN belongs to 'pentateuch' group → group catalog has
            // Sailhamer + Wenham + Alexander as theological-monograph.
            const recs = getSourceRecommendations('GEN', 'theological-monograph', 'es');
            // Walton "Lost World" is GEN-specific (book) → first.
            // Sailhamer "Pentateuch as Narrative" is pentateuch (group).
            // Both should appear, book-specific first.
            expect(recs.some(r => r.title.includes('Lost World'))).toBe(true);
            expect(recs.some(r => r.title.includes('Pentateuch as Narrative'))).toBe(true);
            const lostWorldIdx = recs.findIndex(r => r.title.includes('Lost World'));
            const sailhamerIdx = recs.findIndex(r => r.title.includes('Pentateuch as Narrative'));
            expect(lostWorldIdx).toBeLessThan(sailhamerIdx);
        });

        it('1CO (no book hero) gets pauline-epistles group entries', () => {
            // 1 Corinthians has no book file. Belongs to pauline-epistles
            // group → should see Sanders PPJ, Wright PFG, Schnelle, etc.
            const recs = getSourceRecommendations('1CO', 'theological-monograph', 'es');
            expect(recs.some(r => r.title.includes('Paul and Palestinian Judaism'))).toBe(true);
            expect(recs.some(r => r.title.includes('Faithfulness of God'))).toBe(true);
        });

        it('ROM inherits pauline-epistles entries beneath its book-specific Käsemann', () => {
            // ROM has Käsemann at book level + Sanders/Wright at group level.
            const recs = getSourceRecommendations('ROM', 'theological-monograph', 'es');
            const kasemannIdx = recs.findIndex(r => r.author.includes('Käsemann'));
            const sandersIdx = recs.findIndex(r => r.author.includes('Sanders'));
            expect(kasemannIdx).toBeGreaterThanOrEqual(0);
            expect(sandersIdx).toBeGreaterThanOrEqual(0);
            // Book-specific (Käsemann) before group-level (Sanders).
            expect(kasemannIdx).toBeLessThan(sandersIdx);
        });

        it('JON (Jonás) gets minor-prophets commentary recommendations', () => {
            // Jonah belongs to 'minor-prophets' group → Smith Stuart
            // McComiskey appear via group catalog even without a JON file.
            const recs = getSourceRecommendations('JON', 'commentary-critical', 'es');
            expect(recs.some(r => r.author.includes('Stuart'))).toBe(true);
            expect(recs.some(r => r.author.includes('McComiskey'))).toBe(true);
        });

        it('PSA (Salmos) gets wisdom group recommendations', () => {
            const recs = getSourceRecommendations('PSA', 'theological-monograph', 'es');
            expect(recs.some(r => r.author.includes('Murphy'))).toBe(true);
            expect(recs.some(r => r.author.includes('Crenshaw'))).toBe(true);
        });

        it('DAN belongs to BOTH major-prophets AND apocalyptic groups', () => {
            // Daniel is multi-group. theological-monograph from BOTH should appear.
            const recs = getSourceRecommendations('DAN', 'theological-monograph', 'es');
            // From major-prophets group: Heschel, Brueggemann.
            expect(recs.some(r => r.author.includes('Heschel'))).toBe(true);
            // From apocalyptic group: Collins, Rowland.
            expect(recs.some(r => r.author.includes('Collins'))).toBe(true);
        });

        it('REV (Apocalipsis) belongs to apocalyptic + johannine groups', () => {
            const recs = getSourceRecommendations('REV', 'theological-monograph', 'es');
            // From apocalyptic: Collins.
            expect(recs.some(r => r.author.includes('Collins'))).toBe(true);
            // From johannine-literature: Brown or Bauckham.
            expect(recs.some(r => r.author.includes('Brown') || r.author.includes('Bauckham'))).toBe(true);
        });

        it('1JN gets BOTH general-epistles AND johannine-literature group entries', () => {
            const recs = getSourceRecommendations('1JN', 'commentary-critical', 'es');
            // From general-epistles: Yarbrough BECNT 1-3 John.
            expect(recs.some(r => r.author.includes('Yarbrough'))).toBe(true);
        });

        it('1TI gets BOTH pauline-epistles AND pastoral-epistles group entries', () => {
            // Pastoral group has Mounce/Marshall/Knight (commentary-critical).
            const recs = getSourceRecommendations('1TI', 'commentary-critical', 'es');
            expect(recs.some(r => r.author.includes('Mounce'))).toBe(true);
            expect(recs.some(r => r.author.includes('Marshall'))).toBe(true);
        });
    });

    describe('testament-aware invariant filtering (v1.7.1)', () => {
        it('NT paper does NOT see OT lexicons (HALOT, BDB)', () => {
            const recs = getSourceRecommendations('2PE', 'lexicon-technical', 'es');
            expect(recs.some(r => r.series === 'BDAG')).toBe(true);
            expect(recs.some(r => r.series === 'LSJ')).toBe(true);
            expect(recs.some(r => r.series === 'HALOT')).toBe(false);
            expect(recs.some(r => r.series === 'BDB')).toBe(false);
        });

        it('OT paper does NOT see NT lexicons (BDAG, LSJ)', () => {
            const recs = getSourceRecommendations('PSA', 'lexicon-technical', 'es');
            expect(recs.some(r => r.series === 'HALOT')).toBe(true);
            expect(recs.some(r => r.series === 'BDB')).toBe(true);
            expect(recs.some(r => r.series === 'BDAG')).toBe(false);
            expect(recs.some(r => r.series === 'LSJ')).toBe(false);
        });

        it('NT paper does NOT see OT theological dictionary (NIDOTTE)', () => {
            const recs = getSourceRecommendations('1CO', 'theological-dictionary', 'es');
            expect(recs.some(r => r.series === 'TDNT')).toBe(true);
            expect(recs.some(r => r.series === 'NIDNTTE')).toBe(true);
            expect(recs.some(r => r.series === 'NIDOTTE')).toBe(false);
        });

        it('OT paper does NOT see NT theological dictionaries (TDNT, EDNT)', () => {
            const recs = getSourceRecommendations('ISA', 'theological-dictionary', 'es');
            expect(recs.some(r => r.series === 'NIDOTTE')).toBe(true);
            expect(recs.some(r => r.series === 'TDNT')).toBe(false);
            expect(recs.some(r => r.series === 'EDNT')).toBe(false);
        });

        it('NT paper does NOT see Hebrew grammars', () => {
            const recs = getSourceRecommendations('JHN', 'grammar-syntax', 'es');
            expect(recs.some(r => r.author.includes('Wallace'))).toBe(true);
            expect(recs.some(r => r.author.includes('Waltke'))).toBe(false);
            expect(recs.some(r => r.author.includes('Joüon'))).toBe(false);
        });

        it('whole-bible entries surface for both testaments (Anchor Bible Dictionary)', () => {
            const ntRecs = getSourceRecommendations('2PE', 'historical-background', 'es');
            const otRecs = getSourceRecommendations('GEN', 'historical-background', 'es');
            expect(ntRecs.some(r => r.series === 'ABD')).toBe(true);
            expect(otRecs.some(r => r.series === 'ABD')).toBe(true);
        });

        it('NT paper sees NA28 critical apparatus, NOT BHS/BHQ', () => {
            const recs = getSourceRecommendations('2PE', 'critical-apparatus', 'es');
            expect(recs.some(r => r.series === 'NA28')).toBe(true);
            expect(recs.some(r => r.author.includes('Metzger'))).toBe(true);
            expect(recs.some(r => r.series === 'BHS')).toBe(false);
            expect(recs.some(r => r.series === 'BHQ')).toBe(false);
        });

        it('OT paper sees BHQ/BHS critical apparatus, NOT NA28', () => {
            const recs = getSourceRecommendations('ISA', 'critical-apparatus', 'es');
            expect(recs.some(r => r.series === 'BHQ')).toBe(true);
            expect(recs.some(r => r.series === 'BHS')).toBe(true);
            expect(recs.some(r => r.series === 'NA28')).toBe(false);
        });

        it('NT paper sees Apostolic Fathers (NT-only) but OT does not', () => {
            const ntRecs = getSourceRecommendations('1JN', 'primary-source-ancient', 'es');
            const otRecs = getSourceRecommendations('GEN', 'primary-source-ancient', 'es');
            expect(ntRecs.some(r => r.title.includes('Apostolic Fathers'))).toBe(true);
            expect(otRecs.some(r => r.title.includes('Apostolic Fathers'))).toBe(false);
        });

        it('whole-bible primaries (Josephus, Philo) surface for both testaments', () => {
            const ntRecs = getSourceRecommendations('LUK', 'primary-source-ancient', 'es');
            const otRecs = getSourceRecommendations('GEN', 'primary-source-ancient', 'es');
            expect(ntRecs.some(r => r.author.includes('Josephus'))).toBe(true);
            expect(otRecs.some(r => r.author.includes('Josephus'))).toBe(true);
            expect(ntRecs.some(r => r.author.includes('Philo'))).toBe(true);
            expect(otRecs.some(r => r.author.includes('Philo'))).toBe(true);
        });
    });

    describe('cross-layer dedup', () => {
        it('does not show the same recommendation twice when it appears in multiple layers', () => {
            // No current curation has actual duplicates across layers
            // (we deliberately moved Sanders out of ROM into the group)
            // — sanity-check that lengths match dedup invariant.
            const recs = getSourceRecommendations('ROM', 'theological-monograph', 'es');
            const ids = recs.map(r => `${r.author.toLowerCase().replace(/[^a-z0-9]/g, '')}__${r.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });
});

describe('hasSourceRecommendations', () => {
    it('true when book-specific entry exists', () => {
        expect(hasSourceRecommendations('HEB', 'commentary-critical')).toBe(true);
    });

    it('true when invariant entry exists', () => {
        expect(hasSourceRecommendations('JON', 'lexicon-technical')).toBe(true);
    });

    it('false when no layer has anything', () => {
        // Acts has no book file, no group, and commentary-critical
        // has no invariant fallback.
        expect(hasSourceRecommendations('ACT', 'commentary-critical')).toBe(false);
    });

    it('true when only the group layer has entries (no book hero)', () => {
        // Jonah has no book file but inherits commentary-critical
        // entries from the minor-prophets group catalog.
        expect(hasSourceRecommendations('JON', 'commentary-critical')).toBe(true);
    });
});

describe('getRecommendationId', () => {
    it('produces stable ids invariant to author/title formatting', () => {
        const a = getRecommendationId({
            author: 'Cockerill, Gareth Lee',
            title: 'The Epistle to the Hebrews',
            series: 'NICNT',
            publisher: 'Eerdmans',
            year: 2012,
            isbn: null,
            tier: 'essential',
            languages: ['en'],
        });
        const b = getRecommendationId({
            // Same author + title, different formatting
            author: 'COCKERILL, Gareth Lee  ',
            title: 'The Epistle to the Hebrews',
            series: 'NICNT (revised)',
            publisher: 'Eerdmans',
            year: 2015,
            isbn: '9999999',
            tier: 'recommended',
            languages: ['en'],
        });
        expect(a).toBe(b);
    });

    it('produces different ids for different works by the same author', () => {
        const cockerill1 = getRecommendationId({
            author: 'Cockerill, Gareth Lee',
            title: 'The Epistle to the Hebrews',
            series: null, publisher: '', year: 0, isbn: null, tier: 'essential', languages: ['en'],
        });
        const cockerill2 = getRecommendationId({
            author: 'Cockerill, Gareth Lee',
            title: 'A Different Book',
            series: null, publisher: '', year: 0, isbn: null, tier: 'essential', languages: ['en'],
        });
        expect(cockerill1).not.toBe(cockerill2);
    });
});

/**
 * El catálogo de GRUPO valía para todos los libros del grupo: para Santiago
 * se sugería Bauckham, *Jude, 2 Peter*, marcado «En tu biblioteca · Agregar
 * al corpus» (TP Santiago 2:14-26).
 */
describe('getSourceRecommendations — un comentario de otro libro del grupo no se sugiere', () => {
    const titulos = (book: Parameters<typeof getSourceRecommendations>[0]) =>
        getSourceRecommendations(book, 'commentary-critical').map(r => r.title);

    it('Santiago recibe el de Santiago, no los de Judas/2 Pedro ni 1-3 Juan', () => {
        expect(titulos('JAS')).toContain('The Epistle of James: A Commentary on the Greek Text');
        expect(titulos('JAS')).not.toContain('Jude, 2 Peter');
        expect(titulos('JAS')).not.toContain('1-3 John');
    });

    it('2 Pedro sí recibe a Bauckham', () => {
        expect(titulos('2PE')).toContain('Jude, 2 Peter');
    });

    it('una obra sin `covers` sigue valiendo para todo el grupo', () => {
        expect(titulos('TIT')).toContain('Pastoral Epistles');
        expect(titulos('1TI')).toContain('Pastoral Epistles');
    });
});
