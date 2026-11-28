import { useEffect, useState } from 'react';
import { processingBalanceService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * Páginas premium disponibles del usuario, en vivo. `null` mientras carga o si
 * la lectura falla: quien lo usa no juzga sin el dato.
 *
 * Lo lee el formulario de subida para no recomendar Premium cuando el saldo no
 * cubre el libro (caso real 2026-11-17: −2.270 páginas premium).
 */
export function useSaldoPremium(): number | null {
    const { user } = useFirebase();
    const [saldo, setSaldo] = useState<number | null>(null);

    useEffect(() => {
        if (!user) {
            setSaldo(null);
            return;
        }
        const unsubscribe = processingBalanceService.subscribeToBalance(
            user.uid,
            (b) => setSaldo(typeof b?.premiumPagesAvailable === 'number' ? b.premiumPagesAvailable : null),
            () => setSaldo(null),
        );
        return () => unsubscribe();
    }, [user]);

    return saldo;
}
