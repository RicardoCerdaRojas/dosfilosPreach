import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    query,
    where,
    orderBy,
    runTransaction,
    type DocumentData,
    type UpdateData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AIProject, IAIProjectRepository, ProjectOutput, withCappedHypothesisLog, type AIProjectUpdate, type CourseRecord, type ProjectFraming } from '@dosfilos/domain';

/** El registro del encuadre se agrega sin tope (`arrayUnion`): el tope de 200 se aplica aquí, al leer. */
function framingLeido(data: DocumentData): { framing?: ProjectFraming } {
    const f = data.framing as ProjectFraming | undefined;
    return f && typeof f === 'object' ? { framing: withCappedHypothesisLog(f) } : {};
}

/** Un documento leído como proyecto: fechas de Firestore a `Date` y el registro del encuadre con tope. */
function proyectoLeido(id: string, data: DocumentData): AIProject {
    return {
        id,
        ...data,
        ...framingLeido(data),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        archivedAt: data.archivedAt?.toDate?.() ?? data.archivedAt ?? undefined,
        deletedAt: data.deletedAt?.toDate?.() ?? data.deletedAt ?? undefined,
    } as AIProject;
}

export class FirestoreAIProjectRepository implements IAIProjectRepository {
    private collectionRef() {
        return collection(db, 'ai_projects');
    }

    private docRef(projectId: string) {
        return doc(db, 'ai_projects', projectId);
    }

    async getUserProjects(userId: string): Promise<AIProject[]> {
        const q = query(
            this.collectionRef(),
            where('userId', '==', userId)
            // orderBy intentionally omitted — requires a composite index.
            // Sorting is done client-side below.
        );
        const snap = await getDocs(q);
        return snap.docs
            .map(d => proyectoLeido(d.id, d.data()))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getProject(projectId: string): Promise<AIProject | null> {
        const snap = await getDoc(this.docRef(projectId));
        if (!snap.exists()) return null;
        return proyectoLeido(snap.id, snap.data());
    }

    async createProject(project: Omit<AIProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIProject> {
        const ref = doc(this.collectionRef());
        const now = new Date();
        const newProject: AIProject = {
            ...project,
            id: ref.id,
            createdAt: now,
            updatedAt: now,
        };
        // Firestore does not accept undefined values — strip them before saving
        const docData = Object.fromEntries(
            Object.entries(newProject).filter(([, v]) => v !== undefined)
        );
        await setDoc(ref, docData);
        return newProject;
    }

    async updateProject(projectId: string, updates: AIProjectUpdate): Promise<AIProject> {
        await updateDoc(this.docRef(projectId), this.buildFirestoreUpdates(updates) as UpdateData<DocumentData>);
        const updated = await this.getProject(projectId);
        if (!updated) throw new Error(`Project ${projectId} not found after update`);
        return updated;
    }

    /**
     * Curso: leer, aplicar y escribir en UNA transacción. Si otra pestaña
     * escribió el proyecto entre la lectura y la escritura, Firestore repite
     * la función sobre lo nuevo; por eso `mutate` es pura. El resto del cambio
     * (`alongside`) va en la misma escritura, con las mismas reglas que
     * `updateProject` (`buildFirestoreUpdates`).
     */
    async updateCourseRecord(
        projectId: string,
        mutate: (project: AIProject) => CourseRecord,
        alongside: Omit<AIProjectUpdate, 'courseSchedule' | 'feedbackPatterns'> = {},
    ): Promise<AIProject> {
        const ref = this.docRef(projectId);
        await runTransaction(db, async tx => {
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error(`updateCourseRecord: proyecto ${projectId} no encontrado`);
            const { schedule, patterns } = mutate(proyectoLeido(snap.id, snap.data()));
            // Las listas salen solo de `mutate`, aunque `alongside` trajera otras.
            const { courseSchedule: _s, feedbackPatterns: _p, ...resto } = alongside as AIProjectUpdate;
            tx.update(ref, this.buildFirestoreUpdates({ ...resto, courseSchedule: schedule, feedbackPatterns: patterns }) as UpdateData<DocumentData>);
        });
        const updated = await this.getProject(projectId);
        if (!updated) throw new Error(`Project ${projectId} not found after course update`);
        return updated;
    }

    /**
     * El payload de `updateProject`, en UN solo `updateDoc`. El encuadre va
     * por rutas con punto (`framing.centralIdea`): guardar el formulario no
     * pisa el registro ni la revisión. `null` borra con `deleteField()`.
     * Una anotación suelta (`hypothesisAppend`) va con `arrayUnion`: no lee
     * ni reescribe el registro.
     */
    buildFirestoreUpdates(updates: AIProjectUpdate): Record<string, unknown> {
        const { framingPatch, bibleBooks, contextNote, hypothesisAppend, courseSchedule, feedbackPatterns, courseScheduleMode, ...resto } = updates;
        // Firestore does not accept undefined values — strip them before the update
        const out: Record<string, unknown> = Object.fromEntries(
            Object.entries(resto).filter(([, v]) => v !== undefined)
        );
        // Curso: listas enteras (ya limpias en el caso de uso). Vacías o null se
        // borran: un campo ausente se lee igual que una lista vacía.
        if (courseSchedule !== undefined) out.courseSchedule = courseSchedule?.length ? courseSchedule : deleteField();
        if (feedbackPatterns !== undefined) out.feedbackPatterns = feedbackPatterns?.length ? feedbackPatterns : deleteField();
        if (courseScheduleMode !== undefined) out.courseScheduleMode = courseScheduleMode ?? deleteField();
        // Vaciar la nota la borra: antes '' se volvía undefined y se descartaba.
        if (contextNote !== undefined) out.contextNote = contextNote?.trim() ? contextNote.trim() : deleteField();
        if (bibleBooks !== undefined) {
            // Firestore rechaza `bibliographyCriteria` y una ruta suya en el mismo update.
            if (out.bibliographyCriteria !== undefined) {
                out.bibliographyCriteria = { ...((out.bibliographyCriteria as object | null) ?? {}), bibleBooks };
            } else {
                out['bibliographyCriteria.bibleBooks'] = bibleBooks;
            }
        }
        const campos = Object.entries(framingPatch ?? {}).filter(([k, v]) => v !== undefined && k !== 'updatedAt');
        for (const [k, v] of campos) out[`framing.${k}`] = v === null ? deleteField() : v;
        if (hypothesisAppend) {
            // Firestore no acepta la misma ruta dos veces: si el cambio ya reescribe
            // el registro entero, la anotación va al final de ese arreglo.
            const entero = framingPatch?.hypothesisLog;
            out['framing.hypothesisLog'] = Array.isArray(entero) ? [...entero, hypothesisAppend] : arrayUnion(hypothesisAppend);
        }
        if (campos.length || hypothesisAppend) out['framing.updatedAt'] = new Date().toISOString();
        out.updatedAt = new Date();
        return out;
    }

    async setProjectArchived(projectId: string, archived: boolean): Promise<AIProject> {
        const ref = this.docRef(projectId);
        await updateDoc(ref, {
            archivedAt: archived ? new Date() : null,
            updatedAt: new Date(),
        });
        const updated = await this.getProject(projectId);
        if (!updated) throw new Error(`Project ${projectId} not found after archive`);
        return updated;
    }

    async setProjectDeleted(projectId: string, deleted: boolean): Promise<AIProject> {
        const ref = this.docRef(projectId);
        await updateDoc(ref, {
            deletedAt: deleted ? new Date() : null,
            updatedAt: new Date(),
        });
        const updated = await this.getProject(projectId);
        if (!updated) throw new Error(`Project ${projectId} not found after soft-delete`);
        return updated;
    }

    async deleteProject(projectId: string): Promise<void> {
        await deleteDoc(this.docRef(projectId));
    }

    // ── Outputs (stored as subcollection under user for tenant isolation) ───

    private outputsCollection(userId: string, projectId: string) {
        return collection(db, 'users', userId, 'projects', projectId, 'outputs');
    }

    private outputDoc(userId: string, projectId: string, outputId: string) {
        return doc(db, 'users', userId, 'projects', projectId, 'outputs', outputId);
    }

    async listOutputs(userId: string, projectId: string): Promise<ProjectOutput[]> {
        const snap = await getDocs(this.outputsCollection(userId, projectId));
        return snap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                } as ProjectOutput;
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getOutput(userId: string, projectId: string, outputId: string): Promise<ProjectOutput | null> {
        const snap = await getDoc(this.outputDoc(userId, projectId, outputId));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ProjectOutput;
    }

    async createOutput(output: Omit<ProjectOutput, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectOutput> {
        const ref = doc(this.outputsCollection(output.userId, output.projectId));
        const now = new Date();
        const newOutput: ProjectOutput = {
            ...output,
            id: ref.id,
            createdAt: now,
            updatedAt: now,
        };
        const docData = Object.fromEntries(
            Object.entries(newOutput).filter(([, v]) => v !== undefined)
        );
        await setDoc(ref, docData);
        return newOutput;
    }

    async updateOutput(
        userId: string,
        projectId: string,
        outputId: string,
        updates: Partial<Pick<ProjectOutput, 'title' | 'content' | 'kind'>>
    ): Promise<ProjectOutput> {
        await updateDoc(this.outputDoc(userId, projectId, outputId), {
            ...updates,
            updatedAt: new Date(),
        });
        const updated = await this.getOutput(userId, projectId, outputId);
        if (!updated) throw new Error(`Output ${outputId} not found after update`);
        return updated;
    }

    async deleteOutput(userId: string, projectId: string, outputId: string): Promise<void> {
        await deleteDoc(this.outputDoc(userId, projectId, outputId));
    }
}
