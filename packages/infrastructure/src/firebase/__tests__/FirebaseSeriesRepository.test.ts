import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { SermonSeriesEntity } from '@dosfilos/domain';
import { FirebaseSeriesRepository } from '../FirebaseSeriesRepository';

// We exercise the private mapper methods directly via cast — they are
// pure transforms and the alternative (full Firestore round-trip) would
// require live infra. The roadmap (`feature_sermon_series_pericope_pipeline.md`)
// flags this as non-negotiable for every `*Repository.ts` change because
// Firestore rejects payloads that contain `undefined`, and the new
// pericope-assistant fields are all optional.
const repo = new FirebaseSeriesRepository();
const toFs = (m: any) => (repo as any).metadataToFirestore(m);
const fromFs = (m: any) => (repo as any).metadataFromFirestore(m);

describe('FirebaseSeriesRepository — metadata round-trip', () => {
    it('serializes and deserializes legacy metadata (no exegetical fields)', () => {
        const original = {
            expository: { book: '2 Pedro', chapterRange: '1-3' },
            plannedSermons: [
                {
                    id: 'p1',
                    week: 1,
                    title: 'Llamados firmes',
                    description: 'Intro',
                    passage: '2 Pedro 1:1-11',
                },
            ],
        };

        const fs = toFs(original);

        // No `undefined` may reach Firestore.
        for (const key of Object.keys(fs.expository)) {
            expect(fs.expository[key]).not.toBeUndefined();
        }
        const ps = fs.plannedSermons[0];
        for (const key of Object.keys(ps)) {
            expect(ps[key]).not.toBeUndefined();
        }

        const back = fromFs(fs);
        expect(back.expository.book).toBe('2 Pedro');
        expect(back.expository.chapterRange).toBe('1-3');
        expect(back.expository.pericopeAssistantVersion).toBeUndefined();
        expect(back.plannedSermons[0].paperId).toBeUndefined();
        expect(back.plannedSermons[0].syntacticUnit).toBeUndefined();
        expect(back.plannedSermons[0].status).toBeUndefined();
        expect(back.plannedSermons[0].expositoryEnrichment).toBeUndefined();
    });

    it('round-trips the v1.5 expositoryEnrichment field (propositions + pastoralObjective)', () => {
        const original = {
            plannedSermons: [
                {
                    id: 'p1',
                    week: 1,
                    title: 'Llamados firmes',
                    description: 'Intro',
                    passage: '2 Pedro 1:1-11',
                    expositoryEnrichment: {
                        exegeticalProposition: 'Pedro establece la base teológica de la elección.',
                        homileticalProposition: 'Vive con confianza en Aquel que te llamó.',
                        pastoralObjective: 'Anclar la identidad del oyente en la fidelidad de Dios.',
                        caseTreatment: 'salutation',
                        sourcedExegeticalUnitIds: ['eu-1', 'eu-2'],
                        macroSectionId: 'ms-1',
                    },
                },
            ],
        };

        const fs = toFs(original);
        const enrichmentFs = fs.plannedSermons[0].expositoryEnrichment;
        // No undefined leaks into Firestore.
        for (const key of Object.keys(enrichmentFs)) {
            expect(enrichmentFs[key]).not.toBeUndefined();
        }

        const back = fromFs(fs);
        const enrichment = back.plannedSermons[0].expositoryEnrichment;
        expect(enrichment.exegeticalProposition).toBe('Pedro establece la base teológica de la elección.');
        expect(enrichment.homileticalProposition).toBe('Vive con confianza en Aquel que te llamó.');
        expect(enrichment.pastoralObjective).toBe('Anclar la identidad del oyente en la fidelidad de Dios.');
        expect(enrichment.caseTreatment).toBe('salutation');
        expect(enrichment.sourcedExegeticalUnitIds).toEqual(['eu-1', 'eu-2']);
        expect(enrichment.macroSectionId).toBe('ms-1');
        // Optional field omitted on input → undefined on read.
        expect(enrichment.fidelityNotes).toBeUndefined();
    });

    it('round-trips the new exegetical fields (paperId, syntacticUnit, status, assistant version)', () => {
        const scheduled = new Date('2026-06-01T12:00:00Z');
        const original = {
            expository: {
                book: '2 Pedro',
                chapterRange: '1-3',
                pericopeAssistantVersion: 'gemini-2.5-pro@v1',
                pericopeAssistantStatus: 'reviewed',
            },
            plannedSermons: [
                {
                    id: 'p1',
                    week: 1,
                    title: 'Llamados firmes',
                    description: 'Intro',
                    passage: '2 Pedro 1:1-11',
                    scheduledDate: scheduled,
                    paperId: 'paper-abc',
                    status: 'paper-done',
                    syntacticUnit: {
                        book: '2 Pedro',
                        chapterStart: 1,
                        verseStart: 1,
                        chapterEnd: 1,
                        verseEnd: 11,
                        originalLanguage: 'greek',
                        justification: 'Inclusio enmarcada por κλῆσις',
                    },
                },
            ],
        };

        const fs = toFs(original);

        // Date became Timestamp on the way to Firestore.
        expect(fs.plannedSermons[0].scheduledDate).toBeInstanceOf(Timestamp);
        expect(fs.expository.pericopeAssistantVersion).toBe('gemini-2.5-pro@v1');
        expect(fs.plannedSermons[0].syntacticUnit.justification).toBe(
            'Inclusio enmarcada por κλῆσις',
        );

        const back = fromFs(fs);
        expect(back.expository.pericopeAssistantStatus).toBe('reviewed');
        expect(back.plannedSermons[0].paperId).toBe('paper-abc');
        expect(back.plannedSermons[0].status).toBe('paper-done');
        expect(back.plannedSermons[0].syntacticUnit.chapterStart).toBe(1);
        expect(back.plannedSermons[0].syntacticUnit.verseEnd).toBe(11);
        expect(back.plannedSermons[0].syntacticUnit.originalLanguage).toBe('greek');
        // Date came back as a Date (Timestamp.toDate() called in mapper).
        expect(back.plannedSermons[0].scheduledDate).toBeInstanceOf(Date);
        expect((back.plannedSermons[0].scheduledDate as Date).toISOString()).toBe(
            scheduled.toISOString(),
        );
    });

    it('keeps syntacticUnit absent (not null) when omitted on input', () => {
        const fs = toFs({
            plannedSermons: [
                {
                    id: 'p1',
                    week: 1,
                    title: 't',
                    description: 'd',
                    passage: '2 Pedro 1:1',
                },
            ],
        });
        // For Firestore we use null (undefined would be rejected),
        expect(fs.plannedSermons[0].syntacticUnit).toBeNull();

        const back = fromFs(fs);
        // but on the way back to the domain we collapse to undefined to
        // honour the optional `?:` field shape.
        expect(back.plannedSermons[0].syntacticUnit).toBeUndefined();
    });
});

// ADR-046 etapa 3: la serie sabe a qué proyecto pertenece y conserva su
// fecha de creación real al leerse.
const seriesToFs = (s: SermonSeriesEntity) => (repo as any).seriesToFirestore(s);
const seriesFromFs = (id: string, data: any): SermonSeriesEntity =>
    (repo as any).firestoreToSeries(id, data);

const serieBase = {
    id: 's1',
    userId: 'u1',
    title: 'Nehemías',
    description: 'Serie expositiva',
    sermonIds: [],
    draftIds: [],
    type: 'expository' as const,
    resourceIds: [],
};

// Recorre todo el árbol: Firestore rechaza undefined en cualquier nivel.
// Timestamp y el centinela de serverTimestamp son hojas, no se recorren.
function rutasUndefined(valor: unknown, ruta = ''): string[] {
    if (valor === undefined) return [ruta || '(raíz)'];
    if (valor === null || typeof valor !== 'object' || valor instanceof Timestamp) return [];
    if (Array.isArray(valor)) return valor.flatMap((v, i) => rutasUndefined(v, `${ruta}[${i}]`));
    if (Object.getPrototypeOf(valor) !== Object.prototype) return [];
    return Object.entries(valor).flatMap(([k, v]) => rutasUndefined(v, ruta ? `${ruta}.${k}` : k));
}

describe('FirebaseSeriesRepository — serie con proyecto', () => {
    it('una serie sin proyecto escribe projectId null y ninguna clave undefined', () => {
        const fs = seriesToFs(SermonSeriesEntity.create(serieBase));
        expect(fs).toHaveProperty('projectId', null);
        for (const key of Object.keys(fs)) {
            expect(fs[key], key).not.toBeUndefined();
        }
    });

    it('una serie con proyecto escribe su projectId', () => {
        const fs = seriesToFs(SermonSeriesEntity.create({ ...serieBase, projectId: 'p1' }));
        expect(fs.projectId).toBe('p1');
    });

    it('un documento viejo sin la clave projectId se lee como serie suelta (Jonás)', () => {
        const serie = seriesFromFs('jonas', {
            userId: 'u1',
            title: 'Jonás',
            description: 'Serie vieja',
            type: 'expository',
            createdAt: Timestamp.fromDate(new Date('2026-08-01T12:00:00Z')),
        });
        expect(serie.projectId).toBeUndefined();
    });

    it('ida y vuelta conserva el proyecto', () => {
        const fs = seriesToFs(SermonSeriesEntity.create({ ...serieBase, projectId: 'p1' }));
        expect(seriesFromFs('s1', fs).projectId).toBe('p1');
    });

    it('un projectId null guardado vuelve como serie suelta', () => {
        const fs = seriesToFs(SermonSeriesEntity.create(serieBase));
        expect(seriesFromFs('s1', fs).projectId).toBeUndefined();
    });

    it('la fecha de creación guardada vuelve como esa fecha y no como hoy', () => {
        const creada = new Date('2026-09-01T12:00:00Z');
        const editada = new Date('2026-09-05T12:00:00Z');
        const serie = seriesFromFs('s1', {
            ...serieBase,
            createdAt: Timestamp.fromDate(creada),
            updatedAt: Timestamp.fromDate(editada),
        });
        expect(serie.createdAt.toISOString()).toBe(creada.toISOString());
        expect(serie.updatedAt.toISOString()).toBe(editada.toISOString());
        // Y la vuelta a Firestore escribe la misma fecha de creación.
        expect((seriesToFs(serie).createdAt as Timestamp).toDate().toISOString()).toBe(
            creada.toISOString(),
        );
    });

    it('las obras desmarcadas del proyecto hacen ida y vuelta', () => {
        const serie = SermonSeriesEntity.create({
            ...serieBase,
            projectId: 'p1',
            metadata: { projectSourceExclusions: ['r1'] },
        });
        const fs = seriesToFs(serie);
        expect(fs.metadata.projectSourceExclusions).toEqual(['r1']);
        expect(seriesFromFs('s1', fs).metadata?.projectSourceExclusions).toEqual(['r1']);
    });

    it('sin obras desmarcadas la clave no viaja como undefined', () => {
        const fs = toFs({ projectSourceExclusions: undefined, plannedSermons: [] });
        expect('projectSourceExclusions' in fs).toBe(false);
    });

    it('ningún undefined en todo el árbol de una serie completa', () => {
        const serie = SermonSeriesEntity.create({
            ...serieBase,
            metadata: {
                expository: { book: 'Nehemías' },
                projectSourceExclusions: undefined,
                plannedSermons: [
                    { id: 'ps1', week: 1, title: 'Muro', description: 'd', passage: 'Neh 1:1-11' },
                ],
            },
        });
        expect(rutasUndefined(seriesToFs(serie))).toEqual([]);
    });
});
