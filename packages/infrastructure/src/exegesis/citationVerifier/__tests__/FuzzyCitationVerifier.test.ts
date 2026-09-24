import { describe, it, expect } from 'vitest';
import type { VerifierSource } from '@dosfilos/domain';
import { FuzzyCitationVerifier } from '../FuzzyCitationVerifier';

describe('FuzzyCitationVerifier', () => {
    const verifier = new FuzzyCitationVerifier();

    const laneSource: VerifierSource = {
        corpusId: 'corpus-lane',
        citationKey: 'Lane',
        fullAuthor: 'Lane, William L.',
        displayLabel: 'Hebrews 1-8',
        chunks: [
            {
                text: 'In these last days God has spoken to us in his Son. The polyphony of prophetic revelation reaches its climax in the Son who shares the divine nature.',
                pageHint: 'p. 47',
            },
            {
                text: 'The author articulates a sustained Christological argument running through the first chapter.',
                pageHint: 'p. 53',
            },
        ],
    };

    const bruceSource: VerifierSource = {
        corpusId: 'corpus-bruce',
        citationKey: 'Bruce',
        fullAuthor: 'Bruce, F. F.',
        displayLabel: 'The Epistle to the Hebrews',
        chunks: [
            {
                text: 'The exordium of Hebrews introduces the readers to a Son superior to angels.',
                pageHint: 'p. 12',
            },
        ],
    };

    it('returns verified for a quoted phrase that overlaps an excerpt', async () => {
        const markdown = [
            'The author claims, "the polyphony of prophetic revelation reaches its climax in the Son" (Lane, "Hebrews 1-8", p. 47).',
        ].join('\n');
        const { citations } = await verifier.verify({
            markdown,
            sources: [laneSource, bruceSource],
        });
        expect(citations).toHaveLength(1);
        expect(citations[0]!.status).toBe('verified');
        expect(citations[0]!.matchedCorpusId).toBe('corpus-lane');
    });

    it('flags page-mismatch when the cited page differs from the matching excerpt', async () => {
        const markdown = [
            'The author argues that "the polyphony of prophetic revelation reaches its climax in the Son" (Lane, "Hebrews 1-8", p. 99).',
        ].join('\n');
        const { citations } = await verifier.verify({
            markdown,
            sources: [laneSource],
        });
        expect(citations).toHaveLength(1);
        expect(citations[0]!.status).toBe('page-mismatch');
        expect(citations[0]!.matchedPage).toBe('47');
    });

    it('returns not-found when the source matches but the claim text is absent', async () => {
        const markdown = [
            'Lane interprets the chapter cosmologically — "the seven seals open the celestial liturgy" (Lane, "Hebrews 1-8", p. 47).',
        ].join('\n');
        const { citations } = await verifier.verify({
            markdown,
            sources: [laneSource],
        });
        expect(citations).toHaveLength(1);
        expect(citations[0]!.status).toBe('not-found');
        expect(citations[0]!.matchedCorpusId).toBe('corpus-lane');
    });

    it('returns not-found when the author is unknown', async () => {
        const markdown = 'Some claim (Phantom, "Phantom Title", p. 1).';
        const { citations } = await verifier.verify({
            markdown,
            sources: [laneSource, bruceSource],
        });
        expect(citations).toHaveLength(1);
        expect(citations[0]!.status).toBe('not-found');
        expect(citations[0]!.matchedCorpusId).toBeNull();
    });

    it('matches via title-fragment when author token is unfamiliar', async () => {
        const markdown = [
            'The author articulates a sustained Christological argument running through the first chapter (Anonymous, "Hebrews 1-8", p. 53).',
        ].join('\n');
        const { citations } = await verifier.verify({
            markdown,
            sources: [laneSource],
        });
        expect(citations[0]!.matchedCorpusId).toBe('corpus-lane');
        expect(citations[0]!.status).toBe('verified');
    });

    it('full-document mode: la página citada no se puede comprobar contra nada', async () => {
        const fullDocSource: VerifierSource = {
            corpusId: 'corpus-full',
            citationKey: 'Cockerill',
            fullAuthor: 'Cockerill, Gareth',
            displayLabel: 'NICNT Hebrews',
            chunks: [
                {
                    text: 'The exordium presents God speaking definitively in the Son after a long history of prophetic speech.',
                    pageHint: null,
                },
            ],
        };
        const markdown = [
            'God speaks "definitively in the Son after a long history of prophetic speech" (Cockerill, "NICNT Hebrews", p. 99).',
        ].join('\n');
        const { citations } = await verifier.verify({
            markdown,
            sources: [fullDocSource],
        });
        // Este test afirmaba `verified`, y ese era el defecto: el modo
        // documento completo no trae ancla de página, así que la «p. 99» de
        // la cita no se comparó con nada y el veredicto la daba por buena.
        // El texto SÍ está en la fuente —por eso no es `not-found`— y la
        // página sigue sin respaldo, que es lo que este estado dice.
        expect(citations[0]!.status).toBe('page-unverifiable');
        expect(citations[0]!.matchedPage).toBeNull();
    });

    it('returns no citations when markdown is empty', async () => {
        const { citations } = await verifier.verify({ markdown: '', sources: [laneSource] });
        expect(citations).toHaveLength(0);
    });
});

describe('FuzzyCitationVerifier — citas provistas por el llamador', () => {
    it('verifica las citas recibidas en vez de parsear el markdown', async () => {
        // El análisis canónico no tiene markdown: si el adaptador parseara
        // el vacío, devolvería cero citas y el paso pasaría por verificado.
        const { FuzzyCitationVerifier } = await import('../FuzzyCitationVerifier');
        const verifier = new FuzzyCitationVerifier();
        const out = await verifier.verify({
            markdown: '',
            sources: [{
                corpusId: 'c1', citationKey: 'Ross', fullAuthor: 'Ross', displayLabel: 'Ross',
                chunks: [{ text: 'Shepherd is an active participle used substantively, stressing the meaning of the word.', pageHint: 'p. 559' }],
            }],
            citations: [{
                raw: 'Ross, p. 559', author: 'Ross', title: '', pages: '559', offset: 0,
                evidence: 'Shepherd is an active participle used substantively, stressing the meaning of the word.',
                evidenceIsQuoted: true,
            }],
        });
        expect(out.citations).toHaveLength(1);
        expect(out.citations[0]!.status).toBe('verified');
    });
});
