import { describe, it, expect } from 'vitest';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { deserializePaperForTest, serializePaperForTest } from '../FirestoreExegeticalPaperRepository';

/**
 * `seriesPlacement` va y vuelve de Firestore. El repositorio arma el
 * documento campo por campo: un campo nuevo que no se mapea se pierde en
 * silencio al guardar.
 */
const papel = (over: Partial<ExegeticalPaper> = {}): ExegeticalPaper => ({
    id: 'p1', ownerId: 'u1', createdAt: new Date(), updatedAt: new Date(),
    passage: { bookId: 'EZR', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 5 },
    displayLanguage: 'es', title: 'La oposición', assignmentBrief: null, styleGuideId: null,
    sources: [], rubric: null, stepPlan: { perStep: {} } as never, phase: 'configuring', steps: [],
    currentStepId: null, assembledMarkdown: null, archivedAt: null,
    ...over,
} as ExegeticalPaper);

const lugar = { position: 2, total: 3, previous: { passage: 'Esdras 3:1-13', title: 'El altar' } };

describe('seriesPlacement en el documento', () => {
    it('se guarda y se lee igual', () => {
        const doc = serializePaperForTest(papel({ seriesPlacement: lugar }));
        expect(doc.seriesPlacement).toEqual(lugar);
        expect(deserializePaperForTest('p1', doc).seriesPlacement).toEqual(lugar);
    });

    it('un estudio sin el campo no lo escribe ni lo inventa al leer', () => {
        const doc = serializePaperForTest(papel());
        expect('seriesPlacement' in doc).toBe(false);
        expect('seriesPlacement' in deserializePaperForTest('p1', doc)).toBe(false);
    });

    it('uno malformado se descarta al leer en vez de romper el estudio', () => {
        const leido = deserializePaperForTest('p1', { ...serializePaperForTest(papel()), seriesPlacement: { position: 5, total: 3 } });
        expect('seriesPlacement' in leido).toBe(false);
        expect(leido.title).toBe('La oposición');
    });
});
