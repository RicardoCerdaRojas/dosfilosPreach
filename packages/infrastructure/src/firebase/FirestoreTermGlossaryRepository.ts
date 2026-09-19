import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { GlossaryTerm, ITermGlossaryRepository, TermGlossary } from '@dosfilos/domain';
import { MAX_GLOSSARY_TERMS } from '@dosfilos/domain';

/**
 * El glosario en Firestore: `termGlossaries/{ownerId}`.
 *
 * El id del documento ES el del dueño. No hace falta consultar por
 * `ownerId` —hay uno solo por persona— y así la regla de acceso se
 * escribe sobre la ruta, que es la forma más difícil de equivocar.
 */
export class FirestoreTermGlossaryRepository implements ITermGlossaryRepository {
    private docRef(ownerId: string) {
        return doc(db, 'termGlossaries', ownerId);
    }

    async getGlossary(ownerId: string): Promise<TermGlossary | null> {
        const snap = await getDoc(this.docRef(ownerId));
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            ownerId,
            terms: Array.isArray(data.terms) ? data.terms : [],
            updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        };
    }

    async saveTerms(ownerId: string, terms: ReadonlyArray<GlossaryTerm>): Promise<TermGlossary> {
        // Se limpia acá y no en la interfaz: son datos que viajan al prompt
        // y al cotejo, y un término con espacios de más no encuentra nada.
        const limpios = terms
            .map(t => ({
                avoid: t.avoid.trim(),
                ...(t.prefer?.trim() ? { prefer: t.prefer.trim() } : {}),
                ...(t.note?.trim() ? { note: t.note.trim() } : {}),
            }))
            .filter(t => t.avoid.length >= 3)
            .slice(0, MAX_GLOSSARY_TERMS);

        const updatedAt = new Date();
        await setDoc(this.docRef(ownerId), { ownerId, terms: limpios, updatedAt });
        return { ownerId, terms: limpios, updatedAt };
    }
}
