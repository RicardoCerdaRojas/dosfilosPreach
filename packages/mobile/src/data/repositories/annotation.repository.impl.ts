import {
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc,
} from '@react-native-firebase/firestore';
import { HIGHLIGHT_COLORS, MARK_STYLES } from '@dosfilos/domain';
import type { InkNote, InkStroke } from '@dosfilos/domain';
import { reportWriteFailure } from '@/core/errors/writeFailures';
import type {
    HighlightColor,
    MarkStyle,
    SermonAnnotation,
    SermonAnnotationAnchor,
} from '@dosfilos/domain';

import { AnnotationRepository } from '@/domain/repositories/annotation.repository';
import { getFirebaseAuth, getFirebaseDb } from '@/data/sources/firebase.source';

/**
 * `sermons/{sermonId}/annotations` — las reglas ya restringen la
 * subcolección al dueño del sermón (firestore.rules), así que la tablet
 * escribe directo sin callable.
 *
 * Todo pasa por la caché de disco del SDK nativo: en el púlpito, sin señal,
 * el resaltado aparece igual y la escritura sale de la cola al reconectar
 * (M-02). Por eso las lecturas NO fuerzan `source: 'server'`.
 *
 * TRAMPA DEL SDK: sin red, la promesa de una escritura NO se resuelve hasta
 * que el servidor confirma — puede tardar horas. Esperarla congelaría el
 * púlpito justo cuando más importa. Por eso las tres escrituras aplican en
 * la caché local (efecto inmediato) y la promesa se observa aparte para
 * registrar el fallo, no para bloquear al predicador. El id se genera en el
 * cliente para no depender del ack.
 */
const annotationsRef = (sermonId: string) =>
    collection(getFirebaseDb(), 'sermons', sermonId, 'annotations');

const toDate = (value: unknown): Date => {
    if (value && typeof (value as any).toDate === 'function') return (value as any).toDate();
    if (typeof value === 'number') return new Date(value);
    return new Date();
};

const isHighlightColor = (value: unknown): value is HighlightColor =>
    HIGHLIGHT_COLORS.includes(value as HighlightColor);

// Ausente significa `highlight`: es lo único que existía antes del campo.
const toMarkStyle = (value: unknown): MarkStyle =>
    MARK_STYLES.includes(value as MarkStyle) ? (value as MarkStyle) : 'highlight';

export class AnnotationRepositoryImpl implements AnnotationRepository {
    async list(sermonId: string): Promise<SermonAnnotation[]> {
        const snap = await getDocs(annotationsRef(sermonId));
        return snap.docs
            .map((d): SermonAnnotation | null => {
                const data = d.data() as any;
                // F2 escribirá tinta y glifos en la misma colección: lo que no
                // sea un resaltado se ignora en vez de romper la pantalla.
                if (data?.type !== 'highlight' || !isHighlightColor(data.color)) return null;
                return {
                    id: d.id,
                    type: 'highlight' as const,
                    sectionSlug: String(data.sectionSlug ?? ''),
                    offset: Number(data.offset ?? 0),
                    length: Number(data.length ?? 0),
                    exact: String(data.exact ?? ''),
                    prefix: String(data.prefix ?? ''),
                    suffix: String(data.suffix ?? ''),
                    color: data.color,
                    style: toMarkStyle(data.style),
                    createdAt: toDate(data.createdAt),
                    updatedAt: toDate(data.updatedAt),
                    updatedBy: data.updatedBy === 'web' ? ('web' as const) : ('mobile' as const),
                };
            })
            .filter((a): a is SermonAnnotation => a !== null && a.exact.length > 0);
    }

    /**
     * Notas de tinta. Viven en la MISMA subcolección que las marcas, con
     * `type: 'ink'` — son la misma clase de cosa: algo que el pastor puso
     * sobre su sermón, anclado al texto.
     */
    async listInk(sermonId: string): Promise<InkNote[]> {
        const snap = await getDocs(annotationsRef(sermonId));
        return snap.docs
            .map((d): InkNote | null => {
                const data = d.data() as any;
                if (data?.type !== 'ink' || !Array.isArray(data.strokes)) return null;
                return {
                    id: d.id,
                    type: 'ink',
                    sectionSlug: String(data.sectionSlug ?? ''),
                    offset: Number(data.offset ?? 0),
                    length: Number(data.length ?? 0),
                    exact: String(data.exact ?? ''),
                    prefix: String(data.prefix ?? ''),
                    suffix: String(data.suffix ?? ''),
                    strokes: data.strokes as InkStroke[],
                    createdAt: toDate(data.createdAt),
                    updatedAt: toDate(data.updatedAt),
                    updatedBy: data.updatedBy === 'web' ? 'web' : 'mobile',
                };
            })
            .filter((n): n is InkNote => n !== null && n.exact.length > 0);
    }

    async appendInkStroke(
        sermonId: string,
        anchor: SermonAnnotationAnchor,
        stroke: InkStroke,
        existingId?: string,
    ): Promise<string> {
        // Un trazo por documento sería más simple pero multiplicaría las
        // lecturas; una nota agrupa los trazos que comparten ancla.
        if (existingId) {
            settleOffline(
                updateDoc(doc(annotationsRef(sermonId), existingId), {
                    strokes: arrayUnion(stroke),
                    updatedAt: serverTimestamp(),
                    updatedBy: 'mobile',
                }),
                `ink append ${existingId}`,
            );
            return existingId;
        }
        const ref = doc(annotationsRef(sermonId));
        settleOffline(
            setDoc(ref, {
                ...anchor,
                type: 'ink',
                strokes: [stroke],
                userId: getFirebaseAuth().currentUser?.uid ?? null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                updatedBy: 'mobile',
            }),
            `ink create ${ref.id}`,
        );
        return ref.id;
    }

    /** Deja la nota con exactamente estos trazos. Lo usa la goma. */
    async replaceInkStrokes(
        sermonId: string,
        annotationId: string,
        strokes: InkStroke[],
    ): Promise<void> {
        settleOffline(
            updateDoc(doc(annotationsRef(sermonId), annotationId), {
                strokes,
                updatedAt: serverTimestamp(),
                updatedBy: 'mobile',
            }),
            `ink replace ${annotationId}`,
        );
    }

    async createHighlight(
        sermonId: string,
        anchor: SermonAnnotationAnchor,
        color: HighlightColor,
        style: MarkStyle,
    ): Promise<SermonAnnotation> {
        const now = new Date();
        const ref = doc(annotationsRef(sermonId));
        settleOffline(
            setDoc(ref, {
                ...anchor,
                type: 'highlight',
                color,
                style,
                userId: getFirebaseAuth().currentUser?.uid ?? null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                updatedBy: 'mobile',
            }),
            `create ${ref.id}`,
        );
        return {
            ...anchor,
            id: ref.id,
            type: 'highlight',
            color,
            style,
            createdAt: now,
            updatedAt: now,
            updatedBy: 'mobile',
        };
    }

    async updateMark(
        sermonId: string,
        annotationId: string,
        color: HighlightColor,
        style: MarkStyle,
    ): Promise<void> {
        settleOffline(
            updateDoc(doc(annotationsRef(sermonId), annotationId), {
                color,
                style,
                updatedAt: serverTimestamp(),
                updatedBy: 'mobile',
            }),
            `updateMark ${annotationId}`,
        );
    }

    /** Borra cualquier anotación por id — marca o nota de tinta. */
    async deleteAnnotation(sermonId: string, annotationId: string): Promise<void> {
        settleOffline(
            deleteDoc(doc(annotationsRef(sermonId), annotationId)),
            `delete ${annotationId}`,
        );
    }

    async remove(sermonId: string, annotationId: string): Promise<void> {
        settleOffline(deleteDoc(doc(annotationsRef(sermonId), annotationId)), `remove ${annotationId}`);
    }
}

/**
 * Observa una escritura sin esperarla: la caché local ya aplicó el cambio y
 * el SDK reintenta solo. Un fallo real (permisos, doc inexistente) queda en
 * el log en vez de perderse en silencio.
 */
function settleOffline(write: Promise<unknown>, label: string): void {
    write.catch((error) => reportWriteFailure('annotation', { label, error }));
}
