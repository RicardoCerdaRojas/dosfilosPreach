
import { ISessionRepository, StudySession, ExegeticalInsight, SessionsPage } from '@dosfilos/domain';
import { db } from '../../config/firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

export class FirestoreGreekSessionRepository implements ISessionRepository {
    private sessionsCollection = 'greek_sessions';
    private syntaxAnalysisCacheCollection = 'syntax_analysis_cache'; // New for Phase 4B

    async createSession(session: StudySession): Promise<void> {
        const docRef = doc(db, this.sessionsCollection, session.id);
        const { id, ...data } = session; // Firestore doc ID is session.id
        await setDoc(docRef, removeUndefined(data));
    }

    async getSession(sessionId: string): Promise<StudySession | null> {
        const docRef = doc(db, this.sessionsCollection, sessionId);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) return null;

        // Flatten data back into domain entity
        return {
            id: snapshot.id,
            ...snapshot.data()
        } as StudySession;
    }

    /**
     * Retrieves all sessions for a specific user
     * Uses Firestore query with where clause for proper permissions
     */
    async getAllSessions(userId: string): Promise<StudySession[]> {
        const sessionsRef = collection(db, this.sessionsCollection);
        const q = query(sessionsRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);

        const sessions: StudySession[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            sessions.push({
                id: doc.id, // Use doc.id for the document ID
                userId: data.userId,
                passage: data.passage,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                status: data.status,
                units: data.units || [],
                responses: data.responses || {},
                sessionProgress: data.sessionProgress,
                projectId: data.projectId,
            });
        });

        return sessions;
    }

    /**
     * Paginated read for the dashboard. Delegates to the
     * `getGreekDashboardSessions` callable, which reads server-side (Admin
     * SDK, in-datacenter) and returns each session with units TRIMMED to the
     * few fields the dashboard renders (greekForm + progress), dropping the
     * heavy per-unit LLM text + morphologyBreakdown + the session `responses`
     * map. Reading the full docs in the browser was ~10s for a dozen sessions;
     * the trimmed payload makes it instant. The full session is fetched only
     * when the pastor opens it (`getSession`).
     *
     * Ordering createdAt DESC; `cursorCreatedAt` (a Date) is sent as epoch
     * millis and fed to `startAfter` server-side.
     */
    async getSessionsPage(_userId: string, pageSize: number, cursorCreatedAt?: Date): Promise<SessionsPage> {
        const callable = httpsCallable<
            { pageSize: number; cursorCreatedAt?: number },
            { sessions: any[]; hasMore: boolean; nextCursor?: number }
        >(getFunctions(), 'getGreekDashboardSessions');

        const res = await callable({
            pageSize,
            ...(cursorCreatedAt ? { cursorCreatedAt: cursorCreatedAt.getTime() } : {}),
        });
        const data = res.data;

        const sessions: StudySession[] = (data.sessions ?? []).map((s: any) => ({
            id: s.id,
            userId: s.userId,
            passage: s.passage,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            status: s.status,
            units: s.units ?? [], // trimmed server-side; dashboard reads only greekForm + progress
            responses: {},
            sessionProgress: s.sessionProgress,
            projectId: s.projectId,
        }));

        return {
            sessions,
            hasMore: !!data.hasMore,
            nextCursor: typeof data.nextCursor === 'number' ? new Date(data.nextCursor) : undefined,
        };
    }

    async updateSession(session: StudySession): Promise<void> {
        const docRef = doc(db, this.sessionsCollection, session.id);
        // We only update specific fields to avoid overwriting (though for MVP full rewrite might be okay)
        // Let's rewrite for now as session object is authoritative in this architecture
        const { id, ...data } = session;
        await setDoc(docRef, removeUndefined(data), { merge: true });
    }

    /**
     * Liga una sesión existente a un proyecto («Vincular existente» del panel
     * del proyecto). Toca solo `projectId` y `updatedAt`, como su par de
     * hebreo (`FirestoreHebrewStudySessionRepository.linkToProject`).
     */
    async linkToProject(sessionId: string, projectId: string | null): Promise<void> {
        await updateDoc(doc(db, this.sessionsCollection, sessionId), {
            projectId: projectId ?? null,
            updatedAt: serverTimestamp(),
        });
    }

    async saveInsight(insight: ExegeticalInsight): Promise<void> {
        // Store insights at user level for cross-session access
        // Path: users/{userId}/greek_insights/{insightId}
        // This allows insights to persist beyond individual study sessions

        if (!insight.userId) {
            throw new Error('userId is required to save insight');
        }

        const insightsRef = collection(db, 'users', insight.userId, 'greek_insights');
        const docRef = doc(insightsRef, insight.id);
        const { id, ...data } = insight;

        await setDoc(docRef, removeUndefined({
            ...data,
            createdAt: data.createdAt || new Date(),
            updatedAt: new Date()
        }));

        console.log(`[FirestoreGreekSessionRepository] Saved insight ${insight.id} for user ${insight.userId}`);
    }

    async getInsightsBySession(sessionId: string): Promise<ExegeticalInsight[]> {
        // For backward compatibility - gets insights filtered by sessionId
        // Note: This requires querying across all users, which is inefficient
        // Recommend using getUserInsights instead
        console.warn('[FirestoreGreekSessionRepository] getInsightsBySession is deprecated. Use getUserInsights instead.');

        // Since insights are now user-level, this method is not efficient
        // Return empty array - clients should use getUserInsights
        return [];
    }

    async getUserInsights(userId: string): Promise<ExegeticalInsight[]> {
        // Retrieve all insights for a user
        // Path: users/{userId}/greek_insights

        try {
            const insightsRef = collection(db, 'users', userId, 'greek_insights');
            const snapshot = await getDocs(insightsRef);

            const insights = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate()
            })) as ExegeticalInsight[];

            // Sort by most recent first
            insights.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            return insights;
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] getUserInsights error:', error);
            throw new Error(`Failed to retrieve insights for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async updateInsight(insightId: string, updates: Partial<ExegeticalInsight>): Promise<void> {
        // Update insight title, tags, or other fields
        // Need userId to locate the document

        if (!updates.userId) {
            throw new Error('userId is required in updates to locate insight');
        }

        try {
            const insightRef = doc(db, 'users', updates.userId, 'greek_insights', insightId);

            // Remove fields that shouldn't be updated
            const { id, userId, sessionId, createdAt, ...allowedUpdates } = updates;

            await updateDoc(insightRef, removeUndefined({
                ...allowedUpdates,
                updatedAt: new Date()
            }));

            console.log(`[FirestoreGreekSessionRepository] Updated insight ${insightId}`);
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] updateInsight error:', error);
            throw new Error(`Failed to update insight ${insightId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteInsight(userId: string, insightId: string): Promise<void> {
        // Delete an insight from user's collection
        try {
            const insightRef = doc(db, 'users', userId, 'greek_insights', insightId);
            await deleteDoc(insightRef);
            console.log(`[FirestoreGreekSessionRepository] Deleted insight ${insightId} for user ${userId}`);
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] deleteInsight error:', error);
            throw new Error(`Failed to delete insight ${insightId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========== Phase 3A: Progress Tracking Methods ==========

    /**
     * Updates progress for a specific training unit within a session.
     * Finds the unit and updates its progress field.
     */
    async updateUnitProgress(
        sessionId: string,
        unitId: string,
        progress: import('@dosfilos/domain').UnitProgress
    ): Promise<void> {
        const sessionRef = doc(db, this.sessionsCollection, sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const session = sessionSnap.data() as any;

        // Update the specific unit's progress
        const updatedUnits = (session.units || []).map((unit: any) =>
            unit.id === unitId
                ? { ...unit, progress: removeUndefined(progress) }
                : unit
        );

        await setDoc(sessionRef, {
            units: updatedUnits,
            updatedAt: new Date()
        }, { merge: true });
    }

    /**
     * Saves a quiz attempt to Firestore.
     * Stored as subcollection for queryability and analytics.
     */
    async saveQuizAttempt(
        sessionId: string,
        attempt: import('@dosfilos/domain').QuizAttempt
    ): Promise<void> {
        const attemptsRef = collection(db, this.sessionsCollection, sessionId, 'quiz_attempts');
        const docRef = doc(attemptsRef, attempt.id);

        await setDoc(docRef, removeUndefined(attempt));
    }

    /**
     * Retrieves session-level progress information.
     */
    async getSessionProgress(sessionId: string): Promise<import('@dosfilos/domain').SessionProgress | null> {
        const sessionRef = doc(db, this.sessionsCollection, sessionId);
        const snapshot = await getDoc(sessionRef);

        if (!snapshot.exists()) return null;

        return snapshot.data().sessionProgress as import('@dosfilos/domain').SessionProgress || null;
    }

    // ========== Phase 3A: Quiz Caching Methods ==========

    /**
     * Retrieves cached quiz questions from global quiz cache collection.
     * Enables hybrid quiz generation strategy (cache first, then Gemini).
     */
    async getCachedQuiz(cacheKey: string): Promise<import('@dosfilos/domain').QuizQuestion[]> {
        try {
            const cacheRef = doc(db, 'quiz_cache', cacheKey);
            const snapshot = await getDoc(cacheRef);

            if (!snapshot.exists()) {
                return [];
            }

            const data = snapshot.data();
            return data.questions || [];
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] getCachedQuiz error:', error);
            return [];
        }
    }

    /**
     * Stores quiz questions in global cache for future reuse.
     * Reduces Gemini API costs and improves latency.
     */
    async cacheQuiz(
        cacheKey: string,
        questions: import('@dosfilos/domain').QuizQuestion[]
    ): Promise<void> {
        try {
            const cacheRef = doc(db, 'quiz_cache', cacheKey);

            await setDoc(cacheRef, {
                cacheKey,
                questions: questions.map(q => removeUndefined(q)),
                createdAt: new Date(),
                lastUsedAt: new Date(),
                usageCount: 1
            });
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] cacheQuiz error:', error);
            // Non-critical - don't throw
        }
    }

    // ========== Phase 3C: Morphology Persistence ==========

    /**
     * Updates the morphology breakdown for a specific training unit.
     * Persists to Firestore to avoid regenerating with Gemini.
     */
    async updateUnitMorphology(
        sessionId: string,
        unitId: string,
        morphology: import('@dosfilos/domain').MorphologyBreakdown
    ): Promise<void> {
        const sessionRef = doc(db, this.sessionsCollection, sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const sessionData = sessionSnap.data();
        const units = sessionData.units || [];

        const unitIndex = units.findIndex((u: any) => u.id === unitId);
        if (unitIndex === -1) {
            throw new Error(`Unit ${unitId} not found in session ${sessionId}`);
        }

        // Update the specific unit's morphology
        units[unitIndex].morphologyBreakdown = removeUndefined(morphology);

        await updateDoc(sessionRef, {
            units,
            updatedAt: new Date()
        });

        console.log(`[FirestoreGreekSessionRepository] Updated morphology for unit ${unitId}`);
    }

    // ========== Phase 3D: Passage Caching (Global) ==========

    private passageCacheCollection = 'passage_cache';

    private readonly BOOK_ALIASES: Record<string, string> = {
        // Spanish
        'romanos': 'rom', 'rom': 'rom',
        'juan': 'jhn', 'jn': 'jhn',
        'mateo': 'mat', 'mt': 'mat',
        'marcos': 'mrk', 'mc': 'mrk',
        'lucas': 'luk', 'lc': 'luk',
        'hechos': 'act', 'hch': 'act',
        'efesios': 'eph', 'ef': 'eph',
        'gálatas': 'gal', 'galatas': 'gal',
        'filipenses': 'php', 'fil': 'php',
        'colosenses': 'col', 'col': 'col',
        '1 tesalonicenses': '1th', '1tes': '1th',
        '2 tesalonicenses': '2th', '2tes': '2th',
        '1 timoteo': '1ti', '1tim': '1ti',
        '2 timoteo': '2ti', '2tim': '2ti',
        'tito': 'tit',
        'filemón': 'phm', 'filemon': 'phm',
        'hebreos': 'heb',
        'santiago': 'jas', 'stg': 'jas',
        '1 pedro': '1pe',
        '2 pedro': '2pe',
        '1 juan': '1jn',
        '2 juan': '2jn',
        '3 juan': '3jn',
        'judas': 'jud',
        'apocalipsis': 'rev', 'apoc': 'rev',

        // English
        'romans': 'rom',
        'john': 'jhn',
        'matthew': 'mat',
        'mark': 'mrk',
        'luke': 'luk',
        'acts': 'act',
        'ephesians': 'eph',
        'galatians': 'gal',
        'philippians': 'php',
        'colossians': 'col',
        '1 thessalonians': '1th',
        '2 thessalonians': '2th',
        '1 timothy': '1ti',
        '2 timothy': '2ti',
        'titus': 'tit',
        'philemon': 'phm',
        'hebrews': 'heb',
        'james': 'jas',
        '1 peter': '1pe',
        '2 peter': '2pe',
        '1 john': '1jn',
        '2 john': '2jn',
        '3 john': '3jn',
        'jude': 'jud',
        'revelation': 'rev'
    };

    /**
     * Normalizes a biblical reference to use as cache key
     * E.g., "Romanos 12:1-2" -> "rom_12_1_2"
     * E.g., "Romans 12:1-2" -> "rom_12_1_2" (Shared Cache!)
     */
    private normalizeReference(reference: string): string {
        const lowerRef = reference.toLowerCase().trim();

        // Split into book and chapters/verses
        // Match standard format: "{Book Name} {Chapter}:{Verse}"
        // Handle "1 John" vs "John" prefixing
        const match = lowerRef.match(/^((?:\d\s)?[a-z\u00C0-\u00FF]+)\s+(.+)$/);

        if (!match) {
            // Fallback to simple cleanup if not parseable
            return lowerRef
                .replace(/\s+/g, '_')
                .replace(/:/g, '_')
                .replace(/-/g, '_')
                .replace(/[^a-z0-9_]/g, '');
        }

        const bookPart = match[1].trim(); // e.g. "romans" or "1 juan"
        const restPart = match[2]
            .replace(/\s+/g, '') // Remove spaces in "12: 1-2"
            .replace(/:/g, '_')
            .replace(/-/g, '_');

        // Lookup canonical book ID
        const canonicalBook = this.BOOK_ALIASES[bookPart] || bookPart.replace(/\s+/g, '_');

        return `${canonicalBook}_${restPart}`;
    }

    /**
     * Retrieves a cached passage from Firestore by reference.
     * Returns null if not cached.
     */
    /**
     * Retrieves a cached passage from Firestore by reference.
     * Returns null if not cached.
     * Now supports language-scoped caching to prevent thrashing.
     */
    async getCachedPassage(
        reference: string,
        language: string = 'Spanish'
    ): Promise<import('@dosfilos/domain').BiblicalPassage | null> {
        try {
            const normalizedRef = this.normalizeReference(reference);
            // Append language to cache key (e.g., "rom_12_1_2_en")
            // Default to 'es' for backward compatibility if needed, but explicit is better
            const langCode = language.toLowerCase().startsWith('en') ? 'en' : 'es'; // Normalize to code
            const cacheKey = `${normalizedRef}_${langCode}`;

            const cacheRef = doc(db, this.passageCacheCollection, cacheKey);
            const cacheSnap = await getDoc(cacheRef);

            if (!cacheSnap.exists()) {
                // Fallback attempt: try legacy key without language suffix (migration path)
                // Only if looking for Spanish, as legacy data is likely Spanish
                if (langCode === 'es') {
                    const legacyKey = normalizedRef;
                    const legacySnap = await getDoc(doc(db, this.passageCacheCollection, legacyKey));
                    if (legacySnap.exists()) {
                        // We found legacy data. We could return it, but next save will upgrade it to scoped key.
                        const data = legacySnap.data();
                        // But we must be careful not to return Spanish legacy data if user asked for English
                        // This is handled by the "Deep Validation" in UseCase anyway, so safe to return.
                        return {
                            reference: data.reference,
                            rv60Text: data.rv60Text,
                            greekText: data.greekText,
                            transliteration: data.transliteration,
                            words: data.words || []
                        };
                    }
                }

                return null;
            }

            const data = cacheSnap.data();

            // Update usage stats
            await updateDoc(cacheRef, {
                lastUsedAt: new Date(),
                usageCount: (data.usageCount || 0) + 1
            });

            return {
                reference: data.reference,
                rv60Text: data.rv60Text,
                greekText: data.greekText,
                transliteration: data.transliteration,
                words: data.words || []
            };
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] getCachedPassage error:', error);
            return null; // Non-critical - proceed without cache
        }
    }

    /**
     * Caches a passage in Firestore for reuse
     * Non-critical: If caching fails (e.g., permissions), feature still works without cache
     */
    async cachePassage(
        passage: import('@dosfilos/domain').BiblicalPassage,
        language: string = 'Spanish'
    ): Promise<void> {
        try {
            const normalizedRef = this.normalizeReference(passage.reference);
            const langCode = language.toLowerCase().startsWith('en') ? 'en' : 'es';
            const cacheKey = `${normalizedRef}_${langCode}`;

            const cacheRef = doc(db, this.passageCacheCollection, cacheKey);

            await setDoc(cacheRef, {
                reference: passage.reference,
                rv60Text: passage.rv60Text,
                greekText: passage.greekText,
                transliteration: passage.transliteration,
                words: passage.words,
                language: langCode, // Store language metadata explicitly
                createdAt: new Date(),
                lastUsedAt: new Date(),
                usageCount: 1
            });

            console.log(`[FirestoreGreekSessionRepository] Cached passage: ${passage.reference} (${langCode})`);
        } catch (error) {
            // Non-critical error - feature works without cache
            console.warn('[FirestoreGreekSessionRepository] Could not cache passage:', error);
        }
    }

    // ========== Phase 4A: Session Management ==========

    /**
     * Deletes a session from Firestore
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const sessionRef = doc(db, this.sessionsCollection, sessionId);
            await deleteDoc(sessionRef);
            console.log(`[FirestoreGreekSessionRepository] Deleted session: ${sessionId}`);
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] deleteSession error:', error);
            throw new Error(`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========== Phase 4B: Syntax Analysis Caching (Global) ==========

    /**
     * Retrieves cached syntax analysis from Firestore by passage reference.
     * Returns null if not cached.
     * 
     * Caching strategy:
     * - Global cache (not per-user, not per-session)
     * - Cache key: normalized passage reference
     * - Significantly reduces Gemini API calls for common passages
     */
    async getCachedSyntaxAnalysis(
        reference: string,
        language: string = 'Spanish'
    ): Promise<import('@dosfilos/domain').PassageSyntaxAnalysis | null> {
        try {
            const normalizedRef = this.normalizeReference(reference);
            // Append language to cache key to separate EN/ES analysis
            // e.g. "romanos_12_1_2_en" or "romanos_12_1_2_es"
            const cacheKey = `${normalizedRef}_${language.toLowerCase().substring(0, 2)}`;
            const cacheRef = doc(db, this.syntaxAnalysisCacheCollection, cacheKey);
            const cacheSnap = await getDoc(cacheRef);

            if (cacheSnap.exists()) {
                const data = cacheSnap.data();

                // Reconstruct the domain entity from Firestore data
                return {
                    passageReference: data.passageReference,
                    clauses: data.clauses,
                    rootClauseId: data.rootClauseId,
                    structureDescription: data.structureDescription,
                    analyzedAt: data.analyzedAt?.toDate() || new Date()
                } as import('@dosfilos/domain').PassageSyntaxAnalysis;
            }

            console.log(`[FirestoreGreekSessionRepository] No cached syntax analysis for: ${reference}`);
            return null;
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] getCachedSyntaxAnalysis error:', error);
            // Non-critical: return null if cache read fails
            return null;
        }
    }

    /**
     * Caches syntax analysis in Firestore for reuse
     * 
     * Non-critical operation:
     * - If caching fails (e.g., permissions), the feature still works
     * - The next request will just regenerate with Gemini
     * 
     * Document structure:
     * - Collection: syntax_analysis_cache
     * - Document ID: {normalized_reference} (e.g., "romanos_12_1_2")
     * - Fields: passageReference, clauses, rootClauseId, structureDescription, analyzedAt, usageCount
     */
    async cacheSyntaxAnalysis(
        analysis: import('@dosfilos/domain').PassageSyntaxAnalysis,
        language: string = 'Spanish'
    ): Promise<void> {
        try {
            const normalizedRef = this.normalizeReference(analysis.passageReference);
            // Append language to cache key
            const cacheKey = `${normalizedRef}_${language.toLowerCase().substring(0, 2)}`;
            const cacheRef = doc(db, this.syntaxAnalysisCacheCollection, cacheKey);

            // Check if already exists to increment usage count
            const existingSnap = await getDoc(cacheRef);
            const usageCount = existingSnap.exists()
                ? (existingSnap.data()?.usageCount || 0) + 1
                : 1;

            const cacheData = {
                passageReference: analysis.passageReference,
                clauses: analysis.clauses,
                rootClauseId: analysis.rootClauseId,
                structureDescription: analysis.structureDescription,
                analyzedAt: analysis.analyzedAt,
                usageCount,
                lastAccessedAt: new Date()
            };

            await setDoc(cacheRef, removeUndefined(cacheData));
            console.log(
                `[FirestoreGreekSessionRepository] Cached syntax analysis for: ${analysis.passageReference} ` +
                `(usage: ${usageCount})`
            );
        } catch (error) {
            console.error('[FirestoreGreekSessionRepository] cacheSyntaxAnalysis error:', error);
            // Non-critical: don't throw, just log the error
            // The feature works fine without caching, just slower
        }
    }
}

