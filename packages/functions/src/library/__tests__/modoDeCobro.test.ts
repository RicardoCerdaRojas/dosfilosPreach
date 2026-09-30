import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { modoDeCobro } from '../extractionVersions';

/**
 * Cada caída a la capa de texto cobraba sus páginas mientras el aviso del
 * recurso decía «sin cobro». Caso real, 2026-09-29: una gramática hebrea de 78
 * páginas pedida por imágenes; la visión se cortó por MAX_TOKENS, el texto salió
 * de la capa del PDF (`7.0-pdfjs-lineas`), y el saldo estándar bajó de 3 796 a
 * 3 718. La regla de gratuidad sólo conocía los nombres viejos.
 */
describe('modoDeCobro', () => {
    it('la capa de texto no cobra, en ninguna de sus versiones', () => {
        expect(modoDeCobro('7.0-pdfjs-lineas')).toBeNull();
        expect(modoDeCobro('5.0-pdfparse-structured')).toBeNull();
        expect(modoDeCobro('fallback-pdfparse')).toBeNull();
    });

    it('cobra lo que tuvo proveedor: LlamaParse premium, la visión estándar', () => {
        expect(modoDeCobro('3.0-llamaparse')).toBe('premium');
        expect(modoDeCobro('4.0-gemini-standard')).toBe('standard');
        expect(modoDeCobro('6.0-gemini-cola')).toBe('standard');
    });
});

/**
 * La regla vive en un sitio. Si el disparador vuelve a decidir el cobro con su
 * propia comparación de versiones, las dos terminan divergiendo — que es
 * exactamente como se coló este defecto.
 */
describe('el disparador cobra por `modoDeCobro`', () => {
    const fuente = fs.readFileSync(path.join(__dirname, '..', 'extractPdfWithGemini.ts'), 'utf8');

    it('no decide gratuidad comparando nombres de versión', () => {
        expect(fuente).not.toMatch(/isFreeFallback/);
        expect(fuente).toMatch(/modoDeCobro\(extractionVersion\)/);
    });
});
