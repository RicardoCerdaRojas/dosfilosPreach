import type { IHebrewSessionRepository, VerseAnalysis } from '@dosfilos/domain';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

// Helper to recursively remove undefined fields (Firestore doesn't accept undefined)
function removeUndefined<T>(obj: T): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = removeUndefined(value);
            }
        }
        return cleaned;
    }

    return obj;
}

/**
 * La traducción que corrigió un usuario, guardada APARTE del análisis generado.
 *
 * Antes se escribía encima de `analysis.literalTranslation` /
 * `fluidTranslation`, y «Re-analizar» (que reescribe el análisis) la borraba;
 * por eso tampoco se podía versionar la caché. Ahora vive en `userTranslations`
 * y se aplica encima al leer. Las corregidas ANTES de este cambio siguen dentro
 * del análisis y no se distinguen: ésas sí se pierden si se re-analiza.
 */
export interface UserTranslations {
    literal?: string;
    fluid?: string;
}

export function withUserTranslations(analysis: VerseAnalysis, user: UserTranslations | undefined): VerseAnalysis {
    if (!user) return analysis;
    return {
        ...analysis,
        ...(typeof user.literal === 'string' ? { literalTranslation: user.literal } : {}),
        ...(typeof user.fluid === 'string' ? { fluidTranslation: user.fluid } : {}),
    };
}

export class FirebaseHebrewSessionRepository implements IHebrewSessionRepository {
    private readonly cacheCollection = 'hebrew_analysis_cache';

    async getCachedAnalysis(reference: string): Promise<VerseAnalysis | null> {
        try {
            const cacheKey = reference.replace(/\./g, '_') + '_v2'; // e.g. Jonah.2.3 -> Jonah_2_3_v2
            const docRef = doc(db, this.cacheCollection, cacheKey);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                return null;
            }

            console.log(`[FirebaseHebrewSessionRepository] Cache hit for ${reference}`);
            const data = snapshot.data();
            return withUserTranslations(data.analysis as VerseAnalysis, data.userTranslations as UserTranslations | undefined);
        } catch (error) {
            console.error('[FirebaseHebrewSessionRepository] Error reading cache:', error);
            // Non-critical, return null to proceed with fresh analysis
            return null;
        }
    }

    async cacheAnalysis(reference: string, analysis: VerseAnalysis): Promise<void> {
        try {
            const cacheKey = reference.replace(/\./g, '_') + '_v2';
            const docRef = doc(db, this.cacheCollection, cacheKey);

            // `mergeFields`: se reemplaza lo generado ENTERO y no se toca
            // `userTranslations`. (`merge: true` mezclaría en profundidad y
            // dejaría campos del análisis anterior.)
            await setDoc(docRef, removeUndefined({
                reference,
                analysis,
                cachedAt: new Date(),
                usageCount: 1 // We can increment this later if we update the doc on read
            }), { mergeFields: ['reference', 'analysis', 'cachedAt', 'usageCount'] });

            console.log(`[FirebaseHebrewSessionRepository] Cached analysis for ${reference}`);
        } catch (error) {
            console.error('[FirebaseHebrewSessionRepository] Error caching analysis:', error);
            // Non-critical, just won't cache
        }
    }

    async getSavedAnalyses(): Promise<VerseAnalysis[]> {
        // For MVP, just return the most recently cached global analyses
        // If we want user-specific history, we would need a user_id filter
        try {
            const cacheRef = collection(db, this.cacheCollection);
            const snapshot = await getDocs(cacheRef);
            
            const analyses: VerseAnalysis[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.analysis) {
                    analyses.push(withUserTranslations(data.analysis as VerseAnalysis, data.userTranslations as UserTranslations | undefined));
                }
            });

            return analyses;
        } catch (error) {
            console.error('[FirebaseHebrewSessionRepository] Error reading saved analyses:', error);
            return [];
        }
    }

    async updateTranslation(
        reference: string,
        updates: { literalTranslation?: string; fluidTranslation?: string },
    ): Promise<void> {
        try {
            const cacheKey = reference.replace(/\./g, '_') + '_v2';
            const docRef = doc(db, this.cacheCollection, cacheKey);

            // Aparte del análisis generado: así «Re-analizar» no la borra.
            const patch: Record<string, string> = {};
            if (updates.literalTranslation !== undefined) {
                patch['userTranslations.literal'] = updates.literalTranslation;
            }
            if (updates.fluidTranslation !== undefined) {
                patch['userTranslations.fluid'] = updates.fluidTranslation;
            }

            if (Object.keys(patch).length === 0) return;

            await updateDoc(docRef, patch);
            console.log(`[FirebaseHebrewSessionRepository] Updated translation for ${reference}`);
        } catch (error) {
            console.error('[FirebaseHebrewSessionRepository] Error updating translation:', error);
            throw error; // Surface to the UI so the user knows it failed
        }
    }
}
