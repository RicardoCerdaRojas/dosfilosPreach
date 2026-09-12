import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { STRUCTURED_EXTRACTION_VERSIONS, isStructuredExtractionVersion } from '../extractionVersions';
import { EXTRACTION_VERSION as VERSION_DE_LA_COLA } from '../extractRangeTask';

/**
 * Una versión de extracción nueva tiene DOS hermanas, y olvidarse de cualquiera
 * de las dos deja el libro fuera del producto sin que nada falle.
 *
 * CASO REAL, 12-09-2026. La cola extrajo el comentario de Sasson entero —392
 * páginas, sin huecos, verificado— y lo etiquetó `6.0-gemini-cola`. Esa versión
 * no estaba en la lista de las indexables:
 *
 *     [AutoIndex] …: omitido (unsupported-extraction)
 *
 * El libro quedó perfecto y **inutilizable**: sin índice no sirve para
 * exégesis, que es para lo único que se sube. Y no falló nada — el recurso dice
 * `ready`.
 *
 * Y la lista está DUPLICADA, porque `packages/functions` no puede importar
 * `@dosfilos/domain` (ADR-025). Cuando se escribió esta prueba las dos copias
 * ya diferían: `6.0-thml-public-domain` estaba en una y no en la otra.
 *
 * Es la pregunta §1 de `docs/REVISION_ADVERSARIAL.md` —«¿esto tiene una
 * hermana?»— aplicada a una constante que vive en dos paquetes.
 */
describe('toda versión que el código escribe tiene que ser indexable', () => {
    it('la versión de la cola está en la lista de indexables', () => {
        expect(
            isStructuredExtractionVersion(VERSION_DE_LA_COLA),
            `«${VERSION_DE_LA_COLA}» no es indexable: un libro extraído por la cola quedaría ` +
            `perfecto y sin índice, que es lo mismo que no tenerlo.`,
        ).toBe(true);
    });

    /**
     * Se lee el fuente porque las versiones se escriben como literales en cada
     * módulo que extrae. Lo que hay que comprobar no es un valor, es que NINGUNA
     * de las que el código puede escribir quede afuera.
     */
    it('ninguna versión escrita por un extractor queda fuera de la lista', () => {
        const dir = path.join(__dirname, '..');
        const sospechosos = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
        const escritas = new Set<string>();

        for (const archivo of sospechosos) {
            const fuente = fs.readFileSync(path.join(dir, archivo), 'utf8');
            // `const EXTRACTION_VERSION = '…'` y `extractionVersion = '…'`.
            for (const m of fuente.matchAll(/(?:EXTRACTION_VERSION|extractionVersion)\s*=\s*'([^']+)'/g)) {
                escritas.add(m[1]!);
            }
        }

        expect(escritas.size, 'no se encontró ninguna versión en el fuente: el patrón quedó obsoleto').toBeGreaterThan(0);

        for (const v of escritas) {
            expect(
                isStructuredExtractionVersion(v),
                `«${v}» se escribe en el código pero no está en STRUCTURED_EXTRACTION_VERSIONS. ` +
                `Un libro con esa versión se extrae bien y nunca se indexa.`,
            ).toBe(true);
        }
    });

    /**
     * `packages/functions` no puede importar `@dosfilos/domain` (ADR-025), así
     * que la lista está escrita dos veces. Dos copias que deben coincidir y
     * nadie compara terminan no coincidiendo — ya había pasado.
     */
    it('las dos copias de la lista dicen lo mismo', () => {
        const fuenteDominio = fs.readFileSync(
            path.join(__dirname, '..', '..', '..', '..', 'domain', 'src', 'entities', 'LibraryResource.ts'),
            'utf8',
        );
        const bloque = fuenteDominio.slice(
            fuenteDominio.indexOf('STRUCTURED_EXTRACTION_VERSIONS'),
            fuenteDominio.indexOf('] as const;', fuenteDominio.indexOf('STRUCTURED_EXTRACTION_VERSIONS')),
        );
        const enDominio = [...bloque.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort();

        expect(
            enDominio,
            'La lista de versiones indexables difiere entre `domain` y `functions`. ' +
            'La UI y el indexador van a discrepar sobre el mismo recurso.',
        ).toEqual([...STRUCTURED_EXTRACTION_VERSIONS].sort());
    });
});
