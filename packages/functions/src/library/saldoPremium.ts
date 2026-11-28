import { getFirestore } from 'firebase-admin/firestore';
import { readBalance } from './processingBalance';

/**
 * ¿Alcanza el saldo premium para extraer este libro por LlamaParse?
 *
 * La extracción cobra DESPUÉS de extraer, y `consumePagesAdmin` no tiene piso:
 * sin esta revisión, un libro de 1.368 páginas con 150 de saldo dejaba la
 * cuenta en negativo (caso real 2026-11-17: −2.270). Cuando no alcanza, la
 * extracción pasa a Estándar y deja el aviso en el libro; nunca se bloquea la
 * subida (decisión del fundador, 2026-11-28).
 *
 * - El super admin no se revisa: su extracción la paga la biblioteca común,
 *   igual que en `reprocessWithLlamaParse`.
 * - Sin el número de páginas (pdf-parse no pudo leerlo) alcanza con tener
 *   saldo positivo: no hay contra qué comparar, y frenar ahí castigaría al
 *   usuario por una falla de lectura nuestra.
 */
export function premiumAlcanza(args: { saldo: number; paginas: number | undefined; esAdmin: boolean }): boolean {
    if (args.esAdmin) return true;
    if (!(args.saldo > 0)) return false;
    if (args.paginas === undefined || !Number.isFinite(args.paginas) || args.paginas <= 0) return true;
    return args.saldo >= args.paginas;
}

export interface RevisionDeSaldoPremium {
    alcanza: boolean;
    saldo: number;
}

/**
 * Lee el rol y el saldo y aplica `premiumAlcanza`. Si la lectura falla, deja
 * seguir en premium (lo que el usuario pidió): una falla de Firestore no debe
 * degradar su extracción, y el riesgo es un descuento de más, no una pérdida.
 */
export async function revisarSaldoPremium(userId: string, paginas: number | undefined): Promise<RevisionDeSaldoPremium> {
    try {
        const [usuario, balance] = await Promise.all([
            getFirestore().collection('users').doc(userId).get(),
            readBalance(userId),
        ]);
        const esAdmin = usuario.data()?.role === 'super_admin';
        const saldo = balance.premiumPagesAvailable;
        return { alcanza: premiumAlcanza({ saldo, paginas, esAdmin }), saldo };
    } catch (err) {
        console.error(`[saldoPremium] no se pudo revisar el saldo premium de ${userId.substring(0, 8)}…; se sigue en premium:`, err);
        return { alcanza: true, saldo: Number.NaN };
    }
}

/**
 * El aviso que queda en el libro (tooltip del motor en la tarjeta), con el
 * mismo formato que los demás avisos de `extractionWarning`.
 */
export function avisoSinSaldoPremium(saldo: number, paginas: number | undefined, cayoABasico: boolean): string {
    const motor = cayoABasico ? 'Estándar y, como falló, Básico (pdf-parse) sin cobro' : 'Estándar';
    return `Saldo premium insuficiente (${saldo} de ${paginas ?? '?'} páginas); usamos ${motor}. Compra un pack premium si quieres reprocesarlo.`;
}
