import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Barrera de FUENTE sobre `grantUserCredits`.
 *
 * QUÉ ES Y QUÉ NO ES: esto no ejecuta el callable. `packages/functions` no
 * tiene mocks de `firebase-admin`, así que una prueba de comportamiento
 * exigiría montar esa infraestructura entera — otro trabajo. Lo que sí se
 * puede hoy es fijar las dos propiedades del CÓDIGO cuya ausencia rompió la
 * funcionalidad, con el mismo método que `allowedFlagsParity.test.ts`: leer el
 * fuente.
 *
 * POR QUÉ HACE FALTA. El otorgamiento de créditos del admin estuvo roto de dos
 * maneras a la vez, y las dos eran invisibles desde el panel:
 *
 *   1. Incrementaba SÓLO `processingBalance.standardPagesAvailable`. Pero
 *      `readBalance` recalcula ese agregado como plan + pack en cada lectura,
 *      así que la ruta de consumo ignoraba el otorgamiento por completo. El
 *      admin veía el número subir y el usuario no podía gastar ni una página.
 *
 *   2. Sembraba la estructura con `set(merge:true)` SIN CONDICIÓN, lo que
 *      ponía en cero el saldo disponible y los contadores históricos de gasto
 *      antes de incrementar. Otorgar compensaba con una mano y borraba con la
 *      otra.
 *
 * `addPackAdmin` ya resolvía ambas —su propio comentario advierte de la
 * siembra incondicional—. La ruta de admin simplemente no lo usaba.
 */
const GRANT_TS = join(__dirname, '../grantUserCredits.ts');

/**
 * SE QUITAN LOS COMENTARIOS. Las aserciones de abajo son de AUSENCIA, y el
 * archivo explica en prosa justo lo que no debe hacer: el comentario que
 * documenta por qué no va un `set(merge:true)` contiene esa misma cadena. Sin
 * este paso la prueba falla por su propia documentación — y una baranda que se
 * dispara en falso enseña a ignorarla.
 */
function leerFuente(): string {
    return readFileSync(GRANT_TS, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
}

describe('grantUserCredits — acredita por el helper canónico', () => {
    it('delega en addPackAdmin', () => {
        const src = leerFuente();
        expect(src).toContain("import { addPackAdmin }");
        expect(src).toMatch(/addPackAdmin\(\s*userId,\s*'standard'/);
        expect(src).toMatch(/addPackAdmin\(\s*userId,\s*'premium'/);
    });

    it('NO escribe el agregado a mano', () => {
        // Escribirlo desincroniza el invariante `available = plan + pack`, y
        // `readBalance` lo recalcula de todos modos: el valor escrito se pierde.
        const src = leerFuente();
        expect(src).not.toMatch(/processingBalance\.standardPagesAvailable/);
        expect(src).not.toMatch(/processingBalance\.premiumPagesAvailable/);
    });

    it('NO siembra la estructura de saldo sin condición', () => {
        // El `set(..., { merge: true })` incondicional ponía en cero los campos
        // que enumeraba —incluidos los contadores históricos— en cada llamada.
        const src = leerFuente();
        expect(src).not.toMatch(/standardSpentTotal:\s*0/);
        expect(src).not.toMatch(/merge:\s*true/);
    });
});
