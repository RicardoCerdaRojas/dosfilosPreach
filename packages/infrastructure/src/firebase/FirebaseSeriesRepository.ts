import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { ISeriesRepository, SermonSeriesEntity } from '@dosfilos/domain';
import { db } from '../config/firebase';

export class FirebaseSeriesRepository implements ISeriesRepository {
    private collectionName = 'series';

    async create(series: SermonSeriesEntity): Promise<SermonSeriesEntity> {
        const seriesRef = doc(db, this.collectionName, series.id);
        await setDoc(seriesRef, this.seriesToFirestore(series));
        return series;
    }

    async update(series: SermonSeriesEntity): Promise<SermonSeriesEntity> {
        const seriesRef = doc(db, this.collectionName, series.id);
        await setDoc(seriesRef, this.seriesToFirestore(series), { merge: true });
        return series;
    }

    async delete(id: string): Promise<void> {
        const seriesRef = doc(db, this.collectionName, id);
        await deleteDoc(seriesRef);
    }

    async findById(id: string): Promise<SermonSeriesEntity | null> {
        const seriesRef = doc(db, this.collectionName, id);
        const snapshot = await getDoc(seriesRef);

        if (!snapshot.exists()) {
            return null;
        }

        return this.firestoreToSeries(snapshot.id, snapshot.data());
    }

    async findByUserId(userId: string): Promise<SermonSeriesEntity[]> {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => this.firestoreToSeries(doc.id, doc.data()));
    }

    private seriesToFirestore(series: SermonSeriesEntity): any {
        const metadata = series.metadata
            ? this.metadataToFirestore(series.metadata)
            : null;

        return {
            userId: series.userId,
            title: series.title,
            description: series.description,
            coverUrl: series.coverUrl ?? null,
            startDate: series.startDate ? Timestamp.fromDate(series.startDate) : null,
            endDate: series.endDate ? Timestamp.fromDate(series.endDate) : null,
            sermonIds: series.sermonIds,
            draftIds: series.draftIds,
            createdAt: Timestamp.fromDate(series.createdAt),
            updatedAt: serverTimestamp(),
            type: series.type || 'manual',
            metadata: metadata,
            resourceIds: series.resourceIds || [],
            // null = serie suelta; mismo significado que la clave ausente.
            projectId: series.projectId ?? null,
        };
    }

    // Firestore rejects `undefined` anywhere in the payload. The pericope
    // assistant adds optional fields (`paperId`, `syntacticUnit`, `status`,
    // `pericopeAssistantVersion/Status`) that are absent for legacy series,
    // so we explicitly map every field and substitute `null` for missing
    // values rather than spreading `...ps` and risking an undefined leak.
    private metadataToFirestore(metadata: any): any {
        const out: any = { ...metadata };

        if (metadata.expository) {
            out.expository = {
                book: metadata.expository.book ?? null,
                chapterRange: metadata.expository.chapterRange ?? null,
                originalLanguageAnalysis: metadata.expository.originalLanguageAnalysis ?? null,
                pericopeAssistantVersion: metadata.expository.pericopeAssistantVersion ?? null,
                pericopeAssistantStatus: metadata.expository.pericopeAssistantStatus ?? null,
            };
        }

        if (metadata.plannedSermons) {
            out.plannedSermons = metadata.plannedSermons.map((ps: any) => {
                const unit = ps.syntacticUnit
                    ? {
                          book: ps.syntacticUnit.book,
                          chapterStart: ps.syntacticUnit.chapterStart,
                          verseStart: ps.syntacticUnit.verseStart,
                          chapterEnd: ps.syntacticUnit.chapterEnd,
                          verseEnd: ps.syntacticUnit.verseEnd,
                          originalLanguage: ps.syntacticUnit.originalLanguage ?? null,
                          justification: ps.syntacticUnit.justification ?? null,
                      }
                    : null;

                const enrichment = ps.expositoryEnrichment
                    ? {
                          exegeticalProposition: ps.expositoryEnrichment.exegeticalProposition,
                          homileticalProposition: ps.expositoryEnrichment.homileticalProposition,
                          pastoralObjective: ps.expositoryEnrichment.pastoralObjective,
                          caseTreatment: ps.expositoryEnrichment.caseTreatment ?? null,
                          sourcedExegeticalUnitIds:
                              ps.expositoryEnrichment.sourcedExegeticalUnitIds ?? [],
                          macroSectionId: ps.expositoryEnrichment.macroSectionId ?? null,
                          fidelityNotes: ps.expositoryEnrichment.fidelityNotes ?? null,
                      }
                    : null;

                return {
                    id: ps.id,
                    week: ps.week,
                    title: ps.title,
                    description: ps.description,
                    passage: ps.passage,
                    scheduledDate: ps.scheduledDate
                        ? Timestamp.fromDate(new Date(ps.scheduledDate))
                        : null,
                    draftId: ps.draftId ?? null,
                    paperId: ps.paperId ?? null,
                    syntacticUnit: unit,
                    status: ps.status ?? null,
                    expositoryEnrichment: enrichment,
                };
            });
        }

        // El spread copia la clave aunque venga undefined; Firestore la rechaza.
        if (out.projectSourceExclusions === undefined) delete out.projectSourceExclusions;

        return out;
    }

    private firestoreToSeries(id: string, data: any): SermonSeriesEntity {
        let metadata = data.metadata || undefined;
        if (metadata) {
            metadata = this.metadataFromFirestore(metadata);
        }

        return SermonSeriesEntity.create({
            id,
            userId: data.userId,
            title: data.title,
            description: data.description,
            coverUrl: data.coverUrl,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : undefined,
            endDate: data.endDate?.toDate(),
            sermonIds: data.sermonIds ?? [],
            draftIds: data.draftIds ?? [],
            type: data.type || 'manual',
            metadata: metadata,
            resourceIds: data.resourceIds || [],
            // Documento viejo sin la clave → serie suelta (undefined).
            projectId: data.projectId ?? undefined,
            // Las fechas reales: create() ya no inventa createdAt al leer.
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined,
        });
    }

    // Inverse of `metadataToFirestore`: collapses `null` placeholders back to
    // `undefined` so the domain types (which use `?:`) stay honest.
    private metadataFromFirestore(metadata: any): any {
        const out: any = { ...metadata };

        if (metadata.expository) {
            out.expository = {
                book: metadata.expository.book ?? undefined,
                chapterRange: metadata.expository.chapterRange ?? undefined,
                originalLanguageAnalysis: metadata.expository.originalLanguageAnalysis ?? undefined,
                pericopeAssistantVersion: metadata.expository.pericopeAssistantVersion ?? undefined,
                pericopeAssistantStatus: metadata.expository.pericopeAssistantStatus ?? undefined,
            };
        }

        if (metadata.plannedSermons) {
            out.plannedSermons = metadata.plannedSermons.map((ps: any) => {
                const unit = ps.syntacticUnit
                    ? {
                          book: ps.syntacticUnit.book,
                          chapterStart: ps.syntacticUnit.chapterStart,
                          verseStart: ps.syntacticUnit.verseStart,
                          chapterEnd: ps.syntacticUnit.chapterEnd,
                          verseEnd: ps.syntacticUnit.verseEnd,
                          originalLanguage: ps.syntacticUnit.originalLanguage ?? undefined,
                          justification: ps.syntacticUnit.justification ?? undefined,
                      }
                    : undefined;

                const enrichment = ps.expositoryEnrichment
                    ? {
                          exegeticalProposition: ps.expositoryEnrichment.exegeticalProposition,
                          homileticalProposition: ps.expositoryEnrichment.homileticalProposition,
                          pastoralObjective: ps.expositoryEnrichment.pastoralObjective,
                          caseTreatment: ps.expositoryEnrichment.caseTreatment ?? undefined,
                          sourcedExegeticalUnitIds:
                              ps.expositoryEnrichment.sourcedExegeticalUnitIds ?? [],
                          macroSectionId: ps.expositoryEnrichment.macroSectionId ?? undefined,
                          fidelityNotes: ps.expositoryEnrichment.fidelityNotes ?? undefined,
                      }
                    : undefined;

                return {
                    id: ps.id,
                    week: ps.week,
                    title: ps.title,
                    description: ps.description,
                    passage: ps.passage,
                    scheduledDate: ps.scheduledDate?.toDate
                        ? ps.scheduledDate.toDate()
                        : ps.scheduledDate ?? undefined,
                    draftId: ps.draftId ?? undefined,
                    paperId: ps.paperId ?? undefined,
                    syntacticUnit: unit,
                    status: ps.status ?? undefined,
                    expositoryEnrichment: enrichment,
                };
            });
        }

        return out;
    }
}
