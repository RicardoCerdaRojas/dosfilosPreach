import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AIProject, IAIProjectRepository, ProjectOutput } from '@dosfilos/domain';

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
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                    archivedAt: data.archivedAt?.toDate?.() ?? data.archivedAt ?? undefined,
                    deletedAt: data.deletedAt?.toDate?.() ?? data.deletedAt ?? undefined,
                } as AIProject;
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getProject(projectId: string): Promise<AIProject | null> {
        const snap = await getDoc(this.docRef(projectId));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            archivedAt: data.archivedAt?.toDate?.() ?? data.archivedAt ?? undefined,
            deletedAt: data.deletedAt?.toDate?.() ?? data.deletedAt ?? undefined,
        } as AIProject;
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

    async updateProject(
        projectId: string,
        updates: Partial<Pick<AIProject, 'title' | 'color' | 'type' | 'icon' | 'contextNote' | 'sourceIds' | 'courseInfo' | 'workTypes'>>
    ): Promise<AIProject> {
        const ref = this.docRef(projectId);
        // Firestore does not accept undefined values — strip them before the update
        const clean = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        );
        await updateDoc(ref, { ...clean, updatedAt: new Date() });
        const updated = await this.getProject(projectId);
        if (!updated) throw new Error(`Project ${projectId} not found after update`);
        return updated;
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
