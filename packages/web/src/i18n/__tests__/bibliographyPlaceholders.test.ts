import { describe, expect, it } from 'vitest';
import es from '../locales/es/exegesis.json';
import en from '../locales/en/exegesis.json';

/**
 * UN TEXTO DE EJEMPLO NO PUEDE PARECER UN DATO.
 *
 * Los de esta ficha eran los datos reales de un libro —«Allen P. Ross»,
 * «Kregel», «Grand Rapids», «2011», el ISBN—, así que al abrir la ficha
 * de CUALQUIER otro libro el formulario mostraba una ficha completa y
 * verosímil de Ross en gris. Sobre un extracto de la Biblia Hebraica se
 * veía así, y se lee como si estuviera lleno.
 *
 * Es el mismo criterio que gobierna el lector de portadas —un dato
 * verosímil y falso es peor que un hueco, porque el hueco se ve—, solo
 * que aplicado al formulario. Estas comprobaciones atan los campos por
 * los que un dato se cuela: el año, el ISBN y el nombre propio.
 */
describe('los textos de ejemplo de la ficha bibliográfica', () => {
    const idiomas = { es, en } as Record<string, typeof es>;

    for (const [idioma, json] of Object.entries(idiomas)) {
        const ejemplos = json.detail.bibliography.placeholders as Record<string, string>;

        it(`${idioma}: ningún ejemplo empieza por una cifra`, () => {
            // «1», «1–41» y «2ª ed.» son datos del mismo ejemplar de Ross.
            // Lo que los delata es que abren con el número; una
            // descripción de qué escribir, no.
            for (const campo of ['volume', 'volumeTitle', 'edition']) {
                expect(ejemplos[campo], campo).not.toMatch(/^\s*\d/);
            }
        });

        it(`${idioma}: ninguno está vacío`, () => {
            for (const [campo, texto] of Object.entries(ejemplos)) {
                expect(texto.trim(), campo).not.toBe('');
            }
        });

        it(`${idioma}: el año no puede leerse como un año`, () => {
            expect(ejemplos.year).not.toMatch(/^\s*\d{4}\s*$/);
        });

        it(`${idioma}: el ISBN no puede leerse como un ISBN`, () => {
            expect(ejemplos.isbn).not.toMatch(/\d{9}/);
        });

        it(`${idioma}: el autor no puede leerse como el nombre de una persona`, () => {
            // Un nombre propio son palabras capitalizadas y nada más.
            // «Allen P. Ross» pasaba; «Nombre como firma en la portada» no.
            expect(ejemplos.author).not.toMatch(/^(\p{Lu}\p{L}*\.?\s+){1,3}\p{Lu}\p{L}+$/u);
        });

        it(`${idioma}: ni la editorial ni la ciudad nombran una editorial o una ciudad reales`, () => {
            // Los cinco campos que pueden nombrar el libro de otro. Es un
            // guardia de esta regresión y no una regla general: un ejemplo
            // futuro podría usar otra editorial real y pasaría.
            const inventario = [
                ejemplos.publisher, ejemplos.city, ejemplos.series,
                ejemplos.title, ejemplos.shortTitle, ejemplos.authorSorted,
            ].join(' ').toLowerCase();
            for (const real of ['kregel', 'grand rapids', 'eisenbrauns', 'zondervan', 'cambridge', 'psalms', 'ross']) {
                expect(inventario, real).not.toContain(real);
            }
        });
    }
});
